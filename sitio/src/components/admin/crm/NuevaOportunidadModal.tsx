import { useEffect, useMemo, useState } from 'react';
import { calcularTotales, lineaImporte, type DealItem } from '../../../lib/crm/deal-items';

/* ═══ Alta de oportunidad: qué se le va a vender y de qué tipo es el dinero ═══
 *
 * El alta anterior pedía UN plan y UN monto. Con eso no se podía representar lo
 * que de verdad se vende —licencia + un par de plugins + la implementación—, ni
 * distinguir lo que se repite cada mes de lo que se cobra una sola vez. El
 * pipeline sumaba todo junto y al ganar no había con qué crear la suscripción.
 *
 * Aquí se capturan LÍNEAS (catálogo, plugins, personalizado, pago único), cada
 * una con su descuento, y de ahí salen los tres números que sí se leen: MRR,
 * ARR y pago único. El servidor los recalcula igual, así que nunca hay dos
 * verdades.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

const M = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3vh 12px', overflow: 'auto' },
  modal: { background: '#fff', borderRadius: 14, padding: 22, width: 'min(760px, 100%)' } as const,
  h: { fontSize: '0.72rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '18px 0 8px' },
  input: { padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fff' },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '10px 16px', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  ayuda: { fontSize: '0.73rem', color: '#8C8C8C', lineHeight: 1.5 } as const,
};

const CICLO_LBL: Record<string, string> = { mensual: '/mes', anual: '/año', unico: 'único' };

export default function NuevaOportunidadModal({ onClose, onCreated, companyIdInicial, stageInicial }: {
  onClose: () => void;
  onCreated: (dealId?: string) => void;
  companyIdInicial?: string | null;
  stageInicial?: string;
}) {
  const [modo, setModo] = useState<'existente' | 'nuevo'>('existente');
  const [companies, setCompanies] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState<any>({
    company_id: companyIdInicial || '', buscar: '',
    n_nombre: '', c_nombre: '', c_email: '', c_whatsapp: '',
    nombre: '', descripcion: '', stage: stageInicial || '', fecha_cierre_esperada: '',
    descuento_pct: '',
  });
  const [items, setItems] = useState<DealItem[]>([]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch('/api/crm/companies').then(r => r.json()).then(j => setCompanies(j.companies || j.data || [])).catch(() => {});
    fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlanes(j.data || j.plans || [])).catch(() => {});
    fetch('/api/crm/pipelines').then(r => r.json()).then(j => {
      const op = (j.data || []).find((p: any) => p.tipo === 'oportunidad');
      const st = op?.stages || [];
      setEtapas(st);
      setF((p: any) => ({ ...p, stage: p.stage || st[0]?.key || 'calificacion' }));
    }).catch(() => {});
  }, []);

  const empresa = useMemo(() => companies.find((c: any) => c.id === f.company_id) || null, [companies, f.company_id]);
  const contactoEmpresa = useMemo(() => {
    const cs = empresa?.contacts || [];
    return cs.find((c: any) => c.email) || cs[0] || null;
  }, [empresa]);
  const filtradas = useMemo(() => {
    const q = f.buscar.trim().toLowerCase();
    const base = q ? companies.filter((c: any) => String(c.nombre || '').toLowerCase().includes(q)) : companies;
    return base.slice(0, 60);
  }, [companies, f.buscar]);

  // El nombre del trato se propone solo: nadie quiere escribirlo, y sin él la
  // lista se llena de "Oportunidad — sin nombre".
  useEffect(() => {
    const cliente = modo === 'nuevo' ? f.n_nombre : empresa?.nombre;
    if (cliente && !f.nombre) set('nombre', cliente);
  }, [modo, f.n_nombre, empresa?.nombre]);

  const t = useMemo(() => calcularTotales(items, Number(f.descuento_pct) || 0), [items, f.descuento_pct]);

  function agregarDelCatalogo(ref: string, ciclo: 'mensual' | 'anual') {
    const p = planes.find((x: any) => (x.id || x.slug) === ref);
    if (!p) return;
    const precio = ciclo === 'anual' ? p.precio_anual : p.precio_mensual;
    setItems(prev => [...prev, {
      tipo: p.categoria === 'plugin' ? 'plugin' : 'plan',
      plan_id: p.id || null, plan_slug: p.slug || null,
      nombre: p.nombre, cantidad: 1, precio_unitario: Number(precio || 0), ciclo, descuento_pct: 0,
    }]);
  }
  const agregarLibre = (ciclo: 'mensual' | 'anual' | 'unico') =>
    setItems(prev => [...prev, { tipo: ciclo === 'unico' ? 'unico' : 'personalizado', nombre: '', cantidad: 1, precio_unitario: 0, ciclo, descuento_pct: 0 }]);
  const editar = (i: number, patch: Partial<DealItem>) => setItems(prev => prev.map((x, k) => k === i ? { ...x, ...patch } : x));
  const quitar = (i: number) => setItems(prev => prev.filter((_, k) => k !== i));

  async function crear() {
    if (modo === 'existente' && !f.company_id) { alert('Elige el cliente.'); return; }
    if (modo === 'nuevo') {
      if (!f.n_nombre.trim()) { alert('El nombre del negocio es obligatorio.'); return; }
      if (f.c_email && !EMAIL_RE.test(f.c_email.trim())) { alert('El correo no se ve válido.'); return; }
    }
    if (!f.nombre.trim()) { alert('Ponle nombre a la oportunidad.'); return; }
    if (!items.length) { alert('Agrega al menos una línea: qué le vas a vender.'); return; }
    if (items.some(i => !String(i.nombre || '').trim())) { alert('Hay una línea sin nombre.'); return; }
    if (t.valor_total <= 0 && !confirm('La oportunidad vale $0. ¿Guardarla así?')) return;

    setBusy(true);
    try {
      let companyId = f.company_id;
      let contactId = contactoEmpresa?.id || null;

      if (modo === 'nuevo') {
        const rCo = await fetch('/api/crm/companies', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: f.n_nombre.trim(), estado_cuenta: 'prospecto' }),
        });
        const jCo = await rCo.json().catch(() => ({}));
        companyId = jCo?.data?.id || jCo?.id;
        if (!companyId) { alert(jCo.error || 'No se pudo crear el cliente.'); setBusy(false); return; }
        if (f.c_nombre.trim()) {
          const rCt = await fetch('/api/crm/contacts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: f.c_nombre.trim(), email: f.c_email.trim() || null, whatsapp: f.c_whatsapp.trim() || null, company_id: companyId, tipo: 'prospecto', lifecycle_stage: 'oportunidad' }),
          });
          const jCt = await rCt.json().catch(() => ({}));
          contactId = jCt?.data?.id || jCt?.id || null;
          if (contactId) await fetch('/api/crm/contacts/principal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, company_id: companyId }) }).catch(() => {});
        }
      }

      const r = await fetch('/api/crm/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null,
          company_id: companyId, contact_id: contactId,
          stage: f.stage, fecha_cierre_esperada: f.fecha_cierre_esperada || null,
          items, descuento_pct: Number(f.descuento_pct) || null,
          plan: items.find(i => i.ciclo !== 'unico')?.plan_slug || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok || j.error) { alert(j.error || 'No se pudo crear la oportunidad.'); return; }
      onCreated(j?.id);
      onClose();
    } catch (e: any) { setBusy(false); alert('Error: ' + (e?.message || e)); }
  }

  const planesPlan = planes.filter((p: any) => (p.categoria || 'plan') !== 'plugin');
  const planesPlugin = planes.filter((p: any) => p.categoria === 'plugin');

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Nueva oportunidad</h3>
          <button style={{ ...M.btnG, border: 'none' }} onClick={onClose}>✕</button>
        </div>

        {/* ── 1 · Cliente ── */}
        <div style={M.h}>1 · De quién es</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['existente', 'nuevo'] as const).map(m => (
            <button key={m} type="button" onClick={() => setModo(m)}
              style={{ ...M.btnG, fontWeight: 700, background: modo === m ? '#1a1a1a' : '#fff', color: modo === m ? '#fff' : '#333', borderColor: modo === m ? '#1a1a1a' : '#ddd' }}>
              {m === 'existente' ? 'Cliente / prospecto existente' : 'Nuevo'}
            </button>
          ))}
        </div>
        {modo === 'existente' ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label style={M.lbl}>Buscar</label>
              <input value={f.buscar} onChange={e => set('buscar', e.target.value)} placeholder="nombre…" style={M.input} /></div>
            <div style={{ flex: '1 1 260px' }}><label style={M.lbl}>Cliente *</label>
              <select value={f.company_id} onChange={e => set('company_id', e.target.value)} style={M.input}>
                <option value="">— elegir —</option>
                {filtradas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}{c.sacs_account ? ` · ${c.sacs_account}` : ''}</option>)}
              </select></div>
            <div style={{ flex: '1 1 100%', ...M.ayuda }}>
              {empresa ? (contactoEmpresa ? <>Contacto: <b>{contactoEmpresa.nombre}</b>{contactoEmpresa.email ? ` (${contactoEmpresa.email})` : ''}</> : 'Este cliente no tiene contactos capturados.')
                : 'Toda oportunidad cuelga de un cliente: así al ganarla ya sabe a quién cobrarle.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}><label style={M.lbl}>Negocio *</label><input value={f.n_nombre} onChange={e => set('n_nombre', e.target.value)} style={M.input} /></div>
            <div style={{ flex: '1 1 180px' }}><label style={M.lbl}>Contacto</label><input value={f.c_nombre} onChange={e => set('c_nombre', e.target.value)} style={M.input} /></div>
            <div style={{ flex: '1 1 180px' }}><label style={M.lbl}>Correo</label><input type="email" value={f.c_email} onChange={e => set('c_email', e.target.value)} style={M.input} /></div>
            <div style={{ flex: '1 1 150px' }}><label style={M.lbl}>WhatsApp</label><input value={f.c_whatsapp} onChange={e => set('c_whatsapp', e.target.value)} style={M.input} /></div>
          </div>
        )}

        {/* ── 2 · Qué se le vende ── */}
        <div style={M.h}>2 · Qué se le vende</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <select value="" onChange={e => { const [ref, ciclo] = e.target.value.split('|'); if (ref) agregarDelCatalogo(ref, ciclo as any); e.target.value = ''; }} style={{ ...M.input, flex: '1 1 260px' }}>
            <option value="">+ Agregar del catálogo…</option>
            <optgroup label="Planes · mensual">
              {planesPlan.map((p: any) => <option key={'m' + (p.id || p.slug)} value={`${p.id || p.slug}|mensual`}>{p.nombre}{p.precio_mensual ? ` · ${money(p.precio_mensual)}/mes` : ' · a la medida'}</option>)}
            </optgroup>
            <optgroup label="Planes · anual">
              {planesPlan.map((p: any) => <option key={'a' + (p.id || p.slug)} value={`${p.id || p.slug}|anual`}>{p.nombre}{p.precio_anual ? ` · ${money(p.precio_anual)}/año` : ' · a la medida'}</option>)}
            </optgroup>
            <optgroup label="🧩 Plugins (a la medida)">
              {planesPlugin.map((p: any) => <option key={'g' + (p.id || p.slug)} value={`${p.id || p.slug}|mensual`}>{p.nombre}</option>)}
            </optgroup>
          </select>
          <button style={M.btnG} onClick={() => agregarLibre('mensual')}>+ Personalizado</button>
          <button style={M.btnG} onClick={() => agregarLibre('unico')} title="Implementación, capacitación, hardware: se cobra una vez y no es ARR">+ Pago único</button>
        </div>

        {items.length === 0 ? (
          <div style={{ ...M.ayuda, border: '1px dashed #ddd', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            Sin líneas. Agrega lo que se le va a vender: de ahí salen el MRR, el ARR y el pago único — y la suscripción que nace al ganar.
          </div>
        ) : (
          <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', borderBottom: i < items.length - 1 ? '1px solid #f4f4f4' : 'none', background: it.ciclo === 'unico' ? '#fffdf7' : '#fff' }}>
                <input value={it.nombre} onChange={e => editar(i, { nombre: e.target.value })} placeholder="concepto" style={{ ...M.input, flex: '2 1 180px' }} />
                <input type="number" value={it.cantidad ?? 1} onChange={e => editar(i, { cantidad: Number(e.target.value) || 1 })} title="Cantidad (ej. sucursales)" style={{ ...M.input, flex: '0 0 62px' }} />
                <input type="number" value={it.precio_unitario} onChange={e => editar(i, { precio_unitario: Number(e.target.value) || 0 })} placeholder="precio" style={{ ...M.input, flex: '0 0 100px' }} />
                <select value={it.ciclo} onChange={e => editar(i, { ciclo: e.target.value as any })} style={{ ...M.input, flex: '0 0 100px' }}>
                  <option value="mensual">/mes</option><option value="anual">/año</option><option value="unico">único</option>
                </select>
                <input type="number" value={it.descuento_pct ?? 0} onChange={e => editar(i, { descuento_pct: Number(e.target.value) || 0 })} title="Descuento de esta línea (%)" style={{ ...M.input, flex: '0 0 62px' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 86, textAlign: 'right' }}>{money(lineaImporte(it))}<span style={{ color: '#aaa', fontWeight: 400 }}>{CICLO_LBL[it.ciclo]}</span></span>
                <button onClick={() => quitar(i)} style={{ ...M.btnG, padding: '6px 9px', color: '#b93333' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
          <div style={{ flex: '0 1 160px' }}>
            <label style={M.lbl}>Descuento del trato (%)</label>
            <input type="number" value={f.descuento_pct} onChange={e => set('descuento_pct', e.target.value)} placeholder="0" style={M.input} />
          </div>
          {/* Los tres números que sí se leen. Mezclarlos es lo que hacía que el
              pipeline no significara nada. */}
          <div style={{ flex: '1 1 320px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 92, background: '#f7f9ff', border: '1px solid #e4ebff', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#4B7BE5', textTransform: 'uppercase' }}>MRR</div>
              <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(t.mrr)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 92, background: '#f2fbf8', border: '1px solid #bfe8df', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1A8F7A', textTransform: 'uppercase' }}>ARR</div>
              <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(t.arr)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 92, background: '#fffaf3', border: '1px solid #f5e2b8', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#a06600', textTransform: 'uppercase' }}>Pago único</div>
              <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(t.valor_unico)}</div>
            </div>
          </div>
        </div>
        <div style={{ ...M.ayuda, marginTop: 6 }}>
          Valor del primer año: <b>{money(t.valor_total)}</b> (ARR + pago único). Una línea anual aporta su precio ÷ 12 al MRR — un solo número de recurrencia, igual que en Suscripciones.
        </div>

        {/* ── 3 · El trato ── */}
        <div style={M.h}>3 · El trato</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 240px' }}><label style={M.lbl}>Nombre *</label><input value={f.nombre} onChange={e => set('nombre', e.target.value)} style={M.input} /></div>
          <div style={{ flex: '1 1 160px' }}><label style={M.lbl}>Etapa</label>
            <select value={f.stage} onChange={e => set('stage', e.target.value)} style={M.input}>
              {etapas.map((s: any) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></div>
          <div style={{ flex: '0 1 160px' }}><label style={M.lbl}>Cierre esperado</label>
            <input type="date" value={f.fecha_cierre_esperada} onChange={e => set('fecha_cierre_esperada', e.target.value)} style={M.input} /></div>
          <div style={{ flex: '1 1 100%' }}><label style={M.lbl}>Notas</label>
            <input value={f.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="qué pidió, con quién se está compitiendo…" style={M.input} /></div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={M.btnG} onClick={onClose}>Cancelar</button>
          <button style={M.btn} disabled={busy} onClick={crear}>{busy ? 'Creando…' : '✅ Crear oportunidad'}</button>
        </div>
      </div>
    </div>
  );
}
