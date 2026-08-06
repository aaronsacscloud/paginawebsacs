import { useEffect, useMemo, useState } from 'react';

/* ═══ Alta de suscripción (cliente nuevo o ya registrado) ═══
 *
 * Es la acción principal del hub de Suscripciones: dar de alta lo que se acaba
 * de vender. Antes el botón grande era "Registrar pago", que es el paso de
 * DESPUÉS — para cobrar ya tiene que existir la suscripción; el 💰 de cada fila
 * sigue haciendo eso.
 *
 * Un solo formulario: cliente (existente o nuevo) → plan y ciclo con los montos
 * del catálogo a la vista → cómo se le cobra. Si se elige Mercado Pago, la
 * domiciliación se crea aquí mismo y el link de autorización sale listo para
 * mandarse; creada desde el CRM lleva `external_reference: sub:<id>` desde el
 * primer cobro, así que sus pagos se registran solos (la que se crea en el
 * panel de Mercado Pago nace huérfana y hay que vincularla a mano después).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fmt = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

// WhatsApp en formato Meta (+52 sin el 1 de móvil), igual que el alta de cliente.
function metaWa(p: string): string {
  let c = String(p || '').replace(/[^\d+]/g, '');
  if (!c) return '';
  if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
  if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
  return c;
}

const M = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflow: 'auto' },
  modal: { background: '#fff', borderRadius: 14, padding: 22, width: 'min(680px, 100%)' } as const,
  h: { fontSize: '0.72rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '18px 0 8px' },
  input: { padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fff' },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '10px 16px', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  ayuda: { fontSize: '0.73rem', color: '#8C8C8C', lineHeight: 1.5 } as const,
};

const ESTADOS_ALTA = ['programada', 'activa', 'pendiente_pago'];

// Tarjeta de ciclo: enseña el monto del catálogo para ese periodo, para no
// tener que salirse a la lista de precios antes de elegir.
function CicloCard({ ciclo, titulo, monto, nota, activo, onClick }: any) {
  return (
    <button type="button" onClick={onClick} data-ciclo={ciclo}
      style={{
        flex: '1 1 150px', textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 10,
        border: '1px solid ' + (activo ? '#1a1a1a' : '#ddd'), background: activo ? '#fafafa' : '#fff',
        boxShadow: activo ? 'inset 0 0 0 1px #1a1a1a' : 'none',
      }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1a1a1a' }}>{titulo}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: activo ? '#1a1a1a' : '#555', fontVariantNumeric: 'tabular-nums' }}>{monto}</div>
      {nota && <div style={{ fontSize: '0.68rem', color: '#1A8F7A', fontWeight: 700 }}>{nota}</div>}
    </button>
  );
}

export default function NuevaSuscripcionModal({ onClose, onCreated, companyIdInicial }: {
  onClose: () => void;
  onCreated: (companyId?: string) => void;
  companyIdInicial?: string | null;
}) {
  const [modo, setModo] = useState<'existente' | 'nuevo'>(companyIdInicial ? 'existente' : 'existente');
  const [companies, setCompanies] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasos, setPasos] = useState<string[]>([]);
  const [hecho, setHecho] = useState<any>(null); // resultado con el link de domiciliación

  const [f, setF] = useState<any>({
    // cliente existente
    company_id: companyIdInicial || '', buscar: '',
    // cliente nuevo
    n_nombre: '', n_ciudad: '', c_nombre: '', c_email: '', c_whatsapp: '', sacs: '',
    // suscripción
    plan_ref: '', plan_id: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', estado: 'programada',
    // cobro
    cobro: 'manual', payer_email: '',
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch('/api/crm/companies').then(r => r.json()).then(j => setCompanies(j.companies || j.data || [])).catch(() => {});
    fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlanes(j.data || j.plans || [])).catch(() => {});
  }, []);

  const empresa = useMemo(() => companies.find((c: any) => c.id === f.company_id) || null, [companies, f.company_id]);
  // Contacto al que cuelga la sub: el que tiene correo manda, porque de ahí
  // salen estado de cuenta, recordatorios y el correo pagador de Mercado Pago.
  const contactoEmpresa = useMemo(() => {
    const cs = empresa?.contacts || [];
    return cs.find((c: any) => c.email) || cs[0] || null;
  }, [empresa]);

  const filtradas = useMemo(() => {
    const q = f.buscar.trim().toLowerCase();
    const base = q ? companies.filter((c: any) => String(c.nombre || '').toLowerCase().includes(q) || String(c.sacs_account || '').toLowerCase().includes(q)) : companies;
    return base.slice(0, 60);
  }, [companies, f.buscar]);

  const plan = useMemo(() => planes.find((p: any) => (p.id || p.slug) === f.plan_ref) || null, [planes, f.plan_ref]);
  const ahorroAnual = plan?.precio_mensual && plan?.precio_anual
    ? Math.round((1 - Number(plan.precio_anual) / (Number(plan.precio_mensual) * 12)) * 100) : 0;

  function elegirPlan(ref: string) {
    const p = planes.find((x: any) => (x.id || x.slug) === ref);
    const tarifa = p ? (f.ciclo === 'mensual' ? p.precio_mensual : f.ciclo === 'anual' ? p.precio_anual : null) : null;
    setF((prev: any) => ({
      ...prev, plan_ref: ref,
      // plan_id es columna uuid: los plugins y el catálogo de respaldo no traen
      // uuid, y mandar un slug ahí revienta con 22P02.
      plan_id: p?.id || '', nombre_plan: p?.nombre || '',
      precio: tarifa ?? prev.precio,
    }));
  }
  function elegirCiclo(c: string) {
    const tarifa = plan ? (c === 'mensual' ? plan.precio_mensual : c === 'anual' ? plan.precio_anual : null) : null;
    setF((prev: any) => ({ ...prev, ciclo: c, precio: tarifa ?? prev.precio, cobro: c === 'vitalicia' ? 'manual' : prev.cobro }));
  }

  // Correo con el que se va a domiciliar: el que se escriba gana; si no, el del
  // contacto (existente o el que se está capturando).
  const correoMP = String(f.payer_email || (modo === 'nuevo' ? f.c_email : contactoEmpresa?.email) || '').trim();
  const whatsappDestino = modo === 'nuevo' ? f.c_whatsapp : (contactoEmpresa?.whatsapp || '');
  const precioNum = parseFloat(f.precio) || 0;

  const textoWa = (link: string) =>
    `Hola 👋 Para que ya no tengas que pagar manual cada ${f.ciclo === 'anual' ? 'año' : 'mes'}, aquí puedes autorizar el cargo automático de tu ${f.nombre_plan} (${fmt(precioNum)}):\n${link}`;

  async function crear() {
    // ── Validación previa ──
    // Todo lo de Mercado Pago se valida ANTES de insertar: si la domiciliación
    // se cayera después, la suscripción ya nació y habría que acordarse de
    // volver por el 🔁 de su fila.
    if (modo === 'existente' && !f.company_id) { alert('Elige el cliente.'); return; }
    if (modo === 'nuevo') {
      if (!f.n_nombre.trim()) { alert('El nombre del negocio es obligatorio.'); return; }
      if (!f.c_nombre.trim()) { alert('El nombre del contacto es obligatorio.'); return; }
      if (f.c_email && !EMAIL_RE.test(f.c_email.trim())) { alert('El correo del contacto no se ve válido.'); return; }
      if (f.c_whatsapp && metaWa(f.c_whatsapp).replace(/\D/g, '').length < 12) { alert('El WhatsApp debe tener 10 dígitos.'); return; }
    }
    if (!f.nombre_plan) { alert('Elige el plan.'); return; }
    if (f.cobro === 'mp') {
      if (f.ciclo === 'vitalicia') { alert('Una licencia vitalicia es un pago único: no se domicilia.'); return; }
      if (!(precioNum > 0)) { alert('Para domiciliar hace falta el monto que se le va a cobrar cada periodo.'); return; }
      if (!EMAIL_RE.test(correoMP)) { alert('Escribe el correo con el que el cliente paga en Mercado Pago.'); return; }
    }

    setBusy(true);
    const hechos: string[] = [];
    try {
      let companyId = f.company_id;
      let contactId = contactoEmpresa?.id || null;

      // 1) Cliente nuevo: empresa + contacto principal (+ cuenta SACS si la hay)
      if (modo === 'nuevo') {
        const rCo = await fetch('/api/crm/companies', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: f.n_nombre.trim(), ciudad: f.n_ciudad.trim() || null, estado_cuenta: 'activo' }),
        });
        const jCo = await rCo.json().catch(() => ({}));
        companyId = jCo?.data?.id || jCo?.id;
        if (!rCo.ok || jCo.error || !companyId) { alert(jCo.error || 'No se pudo crear el cliente.'); setBusy(false); return; }
        hechos.push('Cliente creado'); setPasos([...hechos]);

        const rCt = await fetch('/api/crm/contacts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: f.c_nombre.trim(), email: f.c_email.trim() || null, whatsapp: f.c_whatsapp ? metaWa(f.c_whatsapp) : null, company_id: companyId, tipo: 'cliente', lifecycle_stage: 'cliente' }),
        });
        const jCt = await rCt.json().catch(() => ({}));
        contactId = jCt?.data?.id || jCt?.id || null;
        if (!rCt.ok || jCt.error) hechos.push('⚠ Contacto no se pudo crear: ' + (jCt.error || ''));
        else {
          hechos.push('Contacto agregado');
          if (contactId) await fetch('/api/crm/contacts/principal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, company_id: companyId }) }).catch(() => {});
        }
        setPasos([...hechos]);

        if (f.sacs.trim()) {
          const rL = await fetch('/api/crm/arr/link-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, sacs_account: f.sacs.trim().toLowerCase() }) });
          const jL = await rL.json().catch(() => ({}));
          if (!rL.ok || jL.error) hechos.push('⚠ Cuenta SACS: ' + (jL.error || 'no se pudo ligar'));
          else {
            hechos.push('Cuenta SACS ligada');
            await fetch('/api/crm/arr/sync-cuenta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId }) }).catch(() => {});
          }
          setPasos([...hechos]);
        }
      }

      // 2) La suscripción
      const bodyS: any = {
        company_id: companyId, contact_id: contactId,
        nombre_plan: f.nombre_plan, plan_id: f.plan_id || null,
        ciclo: f.ciclo, precio: precioNum, estado: f.estado,
      };
      if (f.proxima_factura) bodyS.proxima_factura = f.proxima_factura;
      const rS = await fetch('/api/crm/arr/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyS) });
      const jS = await rS.json().catch(() => ({}));
      if (!rS.ok || jS.error || !jS?.data?.id) {
        hechos.push('⚠ Suscripción: ' + (jS.error || 'no se pudo crear'));
        setPasos([...hechos]); setBusy(false);
        alert(jS.error || 'No se pudo crear la suscripción.');
        return;
      }
      hechos.push('Suscripción creada'); setPasos([...hechos]);

      // 3) Domiciliación en Mercado Pago (si se pidió cobro automático)
      if (f.cobro === 'mp') {
        const d = await fetch('/api/crm/arr/mp-domiciliar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription_id: jS.data.id, payer_email: correoMP }),
        }).then(x => x.json()).catch(() => ({ error: 'No se pudo crear la domiciliación' }));
        if (d?.error) {
          // La licencia SÍ quedó: decirlo, o se da de alta otra creyendo que
          // falló todo y el cliente termina con dos.
          hechos.push('⚠ Domiciliación: ' + d.error);
          setPasos([...hechos]); setBusy(false);
          onCreated(companyId);
          alert(`La suscripción se creó, pero la domiciliación no:\n\n${d.error}\n\nPuedes reintentarla con el botón 🔁 en el cliente.`);
          return;
        }
        hechos.push('Domiciliación creada en Mercado Pago'); setPasos([...hechos]);
        try { navigator.clipboard?.writeText(d.link); } catch { /* el link queda a la vista */ }
        setHecho({ ...d, companyId, monto: d.monto ?? precioNum, ciclo: d.ciclo || f.ciclo, correo: d.correo || correoMP });
        setBusy(false);
        onCreated(companyId);
        return;
      }

      setBusy(false);
      onCreated(companyId);
      onClose();
    } catch (e: any) { setBusy(false); alert('Error: ' + (e?.message || e)); }
  }

  // ── Pantalla final: el link de domiciliación ──
  // No se cierra solo: el link es TODO el trámite y sin mandarlo no pasa nada.
  if (hecho) {
    const wa = String(whatsappDestino || '').replace(/\D/g, '');
    return (
      <div style={M.overlay} onClick={onClose}>
        <div style={{ ...M.modal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>🔁 Domiciliación creada{hecho.modo === 'prueba' ? ' · MODO PRUEBA' : ''}</h3>
            <button style={{ ...M.btnG, border: 'none' }} onClick={onClose}>✕</button>
          </div>
          <div style={{ ...M.ayuda, margin: '10px 0 12px', color: '#555' }}>
            <b>{fmt(hecho.monto)}</b> cada {hecho.ciclo === 'anual' ? 'año' : 'mes'} a <b>{hecho.correo}</b>
            {hecho.arranca && hecho.arranca !== 'al autorizar' ? ` · arranca el ${fmtDate(hecho.arranca)}` : ' · arranca al autorizar'}.
            <br />Falta que él la autorice desde su cuenta de Mercado Pago: hasta entonces no se le cobra nada.
          </div>
          <div style={{ background: '#f7f9fc', border: '1px solid #e6ebf2', borderRadius: 8, padding: '9px 11px', fontSize: '0.74rem', color: '#4B7BE5', wordBreak: 'break-all', marginBottom: 12 }}>{hecho.link}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={M.btnG} onClick={() => { try { navigator.clipboard?.writeText(hecho.link); } catch { /* está a la vista */ } }}>📋 Copiar link</button>
            <button style={{ ...M.btnG, color: '#1A8F7A', borderColor: '#bfe8df', fontWeight: 700 }}
              onClick={() => window.open((wa ? 'https://wa.me/' + wa : 'https://wa.me/') + '?text=' + encodeURIComponent(textoWa(hecho.link)), '_blank', 'noopener')}>
              💬 Enviar por WhatsApp
            </button>
            <div style={{ flex: 1 }} />
            <button style={M.btn} onClick={onClose}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Nueva suscripción</h3>
          <button style={{ ...M.btnG, border: 'none' }} onClick={onClose}>✕</button>
        </div>

        {/* ── 1 · Cliente ── */}
        <div style={M.h}>1 · Cliente</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['existente', 'nuevo'] as const).map(m => (
            <button key={m} type="button" onClick={() => setModo(m)}
              style={{ ...M.btnG, fontWeight: 700, background: modo === m ? '#1a1a1a' : '#fff', color: modo === m ? '#fff' : '#333', borderColor: modo === m ? '#1a1a1a' : '#ddd' }}>
              {m === 'existente' ? 'Ya es cliente' : 'Cliente nuevo'}
            </button>
          ))}
        </div>

        {modo === 'existente' ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={M.lbl}>Buscar</label>
              <input value={f.buscar} onChange={e => set('buscar', e.target.value)} placeholder="nombre o cuenta SACS…" style={M.input} />
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label style={M.lbl}>Cliente *</label>
              <select value={f.company_id} onChange={e => set('company_id', e.target.value)} style={M.input}>
                <option value="">— elegir cliente —</option>
                {filtradas.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}{c.sacs_account ? ` · ${c.sacs_account}` : ''}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100%', ...M.ayuda }}>
              {empresa
                ? (contactoEmpresa
                  ? <>Va a colgar de <b>{contactoEmpresa.nombre}</b>{contactoEmpresa.email ? ` (${contactoEmpresa.email})` : ' — sin correo registrado'}.</>
                  : <>Este cliente no tiene contactos: la suscripción se crea igual, pero sin correo no hay estado de cuenta ni domiciliación.</>)
                : (companies.length ? 'Si no aparece, búscalo arriba.' : 'Cargando clientes…')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}><label style={M.lbl}>Nombre del negocio *</label><input value={f.n_nombre} onChange={e => set('n_nombre', e.target.value)} placeholder="Papelería El Faro" style={M.input} /></div>
            <div style={{ flex: '1 1 140px' }}><label style={M.lbl}>Ciudad</label><input value={f.n_ciudad} onChange={e => set('n_ciudad', e.target.value)} style={M.input} /></div>
            <div style={{ flex: '1 1 160px' }}><label style={M.lbl}>Cuenta SACS</label><input value={f.sacs} onChange={e => set('sacs', e.target.value)} placeholder="ej. dibujotecnico" style={M.input} /></div>
            <div style={{ flex: '1 1 200px' }}><label style={M.lbl}>Contacto *</label><input value={f.c_nombre} onChange={e => set('c_nombre', e.target.value)} style={M.input} /></div>
            <div style={{ flex: '1 1 200px' }}><label style={M.lbl}>Correo</label><input type="email" value={f.c_email} onChange={e => set('c_email', e.target.value)} placeholder="correo@…" style={M.input} /></div>
            <div style={{ flex: '1 1 160px' }}><label style={M.lbl}>WhatsApp</label><input value={f.c_whatsapp} onChange={e => set('c_whatsapp', e.target.value)} placeholder="+52…" style={M.input} /></div>
          </div>
        )}

        {/* ── 2 · Plan y ciclo ── */}
        <div style={M.h}>2 · Qué se le vendió</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={M.lbl}>Plan *</label>
            <select value={f.plan_ref} onChange={e => elegirPlan(e.target.value)} style={M.input}>
              <option value="">— elegir plan —</option>
              {planes.filter((p: any) => (p.categoria || 'plan') !== 'plugin').map((p: any) => (
                <option key={p.id || p.slug} value={p.id || p.slug}>{p.nombre}{p.a_la_medida ? ' (a la medida)' : ''}</option>
              ))}
              <optgroup label="🧩 Plugins / módulos (a la medida)">
                {planes.filter((p: any) => p.categoria === 'plugin').map((p: any) => (
                  <option key={p.id || p.slug} value={p.id || p.slug}>{p.nombre}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={M.lbl}>Monto a cobrar *</label>
            <input type="number" value={f.precio} onChange={e => set('precio', e.target.value)} placeholder="0" style={M.input} />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={M.lbl}>Próxima factura</label>
            <input type="date" value={f.proxima_factura} onChange={e => set('proxima_factura', e.target.value)} style={M.input} />
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label style={M.lbl}>Estado</label>
            <select value={f.estado} onChange={e => set('estado', e.target.value)} style={M.input}>
              {ESTADOS_ALTA.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <label style={M.lbl}>Ciclo de cobro</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <CicloCard ciclo="mensual" titulo="Mensual" activo={f.ciclo === 'mensual'} onClick={() => elegirCiclo('mensual')}
            monto={plan?.precio_mensual ? fmt(plan.precio_mensual) + '/mes' : 'a la medida'} />
          <CicloCard ciclo="anual" titulo="Anual" activo={f.ciclo === 'anual'} onClick={() => elegirCiclo('anual')}
            monto={plan?.precio_anual ? fmt(plan.precio_anual) + '/año' : 'a la medida'}
            nota={ahorroAnual > 0 ? `ahorra ${ahorroAnual}% vs mensual` : ''} />
          <CicloCard ciclo="vitalicia" titulo="Vitalicia" activo={f.ciclo === 'vitalicia'} onClick={() => elegirCiclo('vitalicia')}
            monto="pago único" nota="" />
        </div>
        <div style={M.ayuda}>
          {f.ciclo === 'vitalicia'
            ? 'La vitalicia no renueva ni suma al ARR: es un pago único (legacy).'
            : `Se le cobrará ${fmt(precioNum)} cada ${f.ciclo === 'anual' ? 'año' : 'mes'}. El monto es editable: manda lo que capturaste, no la lista.`}
        </div>

        {/* ── 3 · Cómo se le cobra ── */}
        <div style={M.h}>3 · Cómo se le cobra</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <select value={f.cobro} disabled={f.ciclo === 'vitalicia'} onChange={e => set('cobro', e.target.value)}
              title={f.ciclo === 'vitalicia' ? 'Una vitalicia es un pago único: no se domicilia.' : ''}
              style={{ ...M.input, opacity: f.ciclo === 'vitalicia' ? 0.55 : 1 }}>
              <option value="manual">💳 Cobro manual — le mandas el link cada periodo</option>
              <option value="mp">🔁 Automático con Mercado Pago — se le cobra solo</option>
            </select>
          </div>
          {f.cobro === 'mp' && (
            <div style={{ flex: '1 1 240px' }}>
              <input type="email" value={f.payer_email} onChange={e => set('payer_email', e.target.value)}
                placeholder={correoMP || 'correo con el que paga en Mercado Pago'} style={M.input} />
            </div>
          )}
        </div>
        {f.cobro === 'mp' && (
          <div style={{ ...M.ayuda, marginTop: 8, background: '#f7fbfd', border: '1px solid #d9edf7', borderRadius: 8, padding: 10 }}>
            Al crearla se genera el link de autorización de <b>{fmt(precioNum)} cada {f.ciclo === 'anual' ? 'año' : 'mes'}</b>
            {correoMP ? <> para <b>{correoMP}</b></> : ' (falta el correo del cliente)'} y se copia listo para mandárselo.
            No se le cobra nada hasta que él lo autorice{f.proxima_factura ? `, y el primer cargo sale hasta el ${fmtDate(f.proxima_factura)}` : ''}. Solo funciona con tarjeta.
          </div>
        )}

        {pasos.length > 0 && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10, marginTop: 14, fontSize: '0.78rem' }}>
            {pasos.map((p, i) => <div key={i}>{p.startsWith('⚠') ? p : '✅ ' + p}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={M.btnG} onClick={onClose}>Cancelar</button>
          <button style={M.btn} disabled={busy} onClick={crear}>
            {busy ? 'Creando…' : (f.cobro === 'mp' ? '✅ Crear y generar liga' : '✅ Crear suscripción')}
          </button>
        </div>
      </div>
    </div>
  );
}
