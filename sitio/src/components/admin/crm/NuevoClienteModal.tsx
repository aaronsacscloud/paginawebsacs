import { useEffect, useState } from 'react';

/* ═══ Alta completa de cliente ═══
 * Un solo formulario con 4 bloques: Empresa → Contacto principal → Cuenta SACS
 * (opcional) → Primera suscripción (opcional). Crea todo ligado y ordenado:
 * company → contact (principal) → liga sacs_account + sync → subscription. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function metaWa(p: string): string {
  let c = String(p || '').replace(/[^\d+]/g, '');
  if (!c) return '';
  if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
  if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
  return c;
}

const M = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflow: 'auto' } as const,
  modal: { background: '#fff', borderRadius: 14, padding: 22, width: 'min(720px, 100%)' } as const,
  h: { fontSize: '0.72rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '16px 0 8px' },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '9px 16px', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
};

const ROLES = ['Dueño', 'Gerente', 'Facturación', 'Sistemas', 'Compras', 'Otro'];
const CICLOS = ['anual', 'mensual', 'vitalicia'];

export default function NuevoClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (companyId?: string) => void }) {
  const [f, setF] = useState<any>({
    // empresa
    nombre: '', giro: '', rfc: '', ciudad: '', sucursales: '1',
    // contacto
    c_nombre: '', c_email: '', c_whatsapp: '', c_rol: 'Dueño',
    // sacs
    sacs: '',
    // sub
    conSub: false, plan_slug: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', sub_estado: 'programada',
    // cotización a ligar (match)
    cotizacion_id: '',
  });
  const [planes, setPlanes] = useState<any[]>([]);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasos, setPasos] = useState<string[]>([]);

  useEffect(() => { fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlanes(j.data || j.plans || [])).catch(() => {}); }, []);
  // Cotizaciones SIN cliente ligado (para poder hacer el match desde aquí).
  useEffect(() => {
    fetch('/api/revenue/quotes').then(r => r.json()).then((rows: any) => {
      const list = Array.isArray(rows) ? rows : (rows?.data || []);
      setCotizaciones(list.filter((q: any) => !q.company_id && q.estado !== 'deleted' && q.estado !== 'plantilla'));
    }).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  function pickPlan(slug: string) {
    const p = planes.find((x: any) => x.slug === slug);
    const precio = p ? (f.ciclo === 'mensual' ? p.precio_mensual : p.precio_anual) : '';
    setF((prev: any) => ({ ...prev, plan_slug: slug, nombre_plan: p?.nombre || slug, precio: precio ?? '' }));
  }

  async function crear() {
    // Validación
    if (!f.nombre.trim()) { alert('El nombre del cliente/negocio es obligatorio.'); return; }
    if (!f.c_nombre.trim()) { alert('El nombre del contacto principal es obligatorio.'); return; }
    if (f.c_email && !EMAIL_RE.test(f.c_email.trim())) { alert('El correo del contacto no se ve válido.'); return; }
    if (f.c_whatsapp && metaWa(f.c_whatsapp).replace(/\D/g, '').length < 12) { alert('El WhatsApp debe tener 10 dígitos.'); return; }
    if (f.conSub && !f.nombre_plan) { alert('Elige el plan de la suscripción (o desmarca "Agregar suscripción").'); return; }

    setBusy(true);
    const hechos: string[] = [];
    try {
      // 1) Empresa
      const rCo = await fetch('/api/crm/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: f.nombre.trim(), giro: f.giro.trim() || null, rfc: f.rfc.trim() || null, ciudad: f.ciudad.trim() || null, sucursales: parseInt(f.sucursales) || 1, estado_cuenta: 'activo' }) });
      const jCo = await rCo.json().catch(() => ({}));
      const companyId = jCo?.data?.id || jCo?.id;
      if (!rCo.ok || jCo.error || !companyId) { alert(jCo.error || 'No se pudo crear el cliente.'); setBusy(false); return; }
      hechos.push('Cliente creado'); setPasos([...hechos]);

      // 2) Contacto principal
      const bodyC: any = { nombre: f.c_nombre.trim(), email: f.c_email.trim() || null, whatsapp: f.c_whatsapp ? metaWa(f.c_whatsapp) : null, company_id: companyId, tipo: 'cliente', lifecycle_stage: 'cliente' };
      const rCt = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyC) });
      const jCt = await rCt.json().catch(() => ({}));
      const contactId = jCt?.data?.id || jCt?.id;
      if (!rCt.ok || jCt.error) hechos.push('⚠ Contacto no se pudo crear: ' + (jCt.error || ''));
      else {
        hechos.push('Contacto agregado');
        // rol + principal (tolerante si no ha corrido la migración)
        if (contactId) {
          await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contactId, rol: f.c_rol || null }) }).catch(() => {});
          await fetch('/api/crm/contacts/principal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, company_id: companyId }) }).catch(() => {});
        }
      }
      setPasos([...hechos]);

      // 3) Cuenta SACS (opcional)
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

      // 4) Primera suscripción (opcional)
      if (f.conSub) {
        const bodyS: any = { company_id: companyId, contact_id: contactId || null, nombre_plan: f.nombre_plan, plan_id: f.plan_slug || null, ciclo: f.ciclo, precio: parseFloat(f.precio) || 0, estado: f.sub_estado };
        if (f.proxima_factura) bodyS.proxima_factura = f.proxima_factura;
        const rS = await fetch('/api/crm/arr/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyS) });
        const jS = await rS.json().catch(() => ({}));
        if (!rS.ok || jS.error) hechos.push('⚠ Suscripción: ' + (jS.error || 'no se pudo crear'));
        else hechos.push('Suscripción creada');
        setPasos([...hechos]);
      }

      // 5) Ligar cotización (match del cliente/contacto con una cotización existente)
      if (f.cotizacion_id) {
        const rQ = await fetch('/api/revenue/quotes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.cotizacion_id, company_id: companyId, contact_id: contactId || null }) });
        const jQ = await rQ.json().catch(() => ({}));
        if (!rQ.ok || jQ.error) hechos.push('⚠ Cotización: ' + (jQ.error || 'no se pudo ligar'));
        else hechos.push('Cotización ligada');
        setPasos([...hechos]);
      }

      onCreated(companyId);
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setBusy(false);
  }

  const campo = (label: string, k: string, ph = '', type = 'text', width = '1 1 180px') => (
    <div style={{ flex: width }}>
      <label style={M.lbl}>{label}</label>
      <input type={type} value={f[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={M.input} />
    </div>
  );

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Nuevo cliente</h3>
          <button style={{ ...M.btnG, border: 'none' }} onClick={onClose}>✕</button>
        </div>

        <div style={M.h}>1 · Datos del cliente</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {campo('Nombre del negocio *', 'nombre', 'Papelería El Faro')}
          {campo('Giro', 'giro', 'papelería, boutique…')}
          {campo('RFC', 'rfc')}
          {campo('Ciudad', 'ciudad')}
          {campo('Sucursales', 'sucursales', '', 'number', '0 1 100px')}
        </div>

        <div style={M.h}>2 · Contacto principal</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {campo('Nombre *', 'c_nombre')}
          {campo('Correo', 'c_email', 'correo@…')}
          {campo('WhatsApp', 'c_whatsapp', '+52…')}
          <div style={{ flex: '0 1 140px' }}>
            <label style={M.lbl}>Rol</label>
            <select value={f.c_rol} onChange={e => set('c_rol', e.target.value)} style={M.input}>
              {ROLES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <div style={M.h}>3 · Cuenta SACS (opcional)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {campo('Subdominio de su cuenta', 'sacs', 'ej. dibujotecnico')}
          <div style={{ flex: '2 1 260px', fontSize: '0.74rem', color: '#999', alignSelf: 'flex-end', paddingBottom: 6 }}>
            Si la pones, se liga y se sincroniza su actividad real (ventas, módulos) de inmediato.
          </div>
        </div>

        <div style={M.h}>4 · Primera suscripción (opcional)</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', marginBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.conSub} onChange={e => set('conSub', e.target.checked)} /> Agregar suscripción ahora
        </label>
        {f.conSub && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={M.lbl}>Plan</label>
              <select value={f.plan_slug} onChange={e => pickPlan(e.target.value)} style={M.input}>
                <option value="">— elegir plan —</option>
                {planes.map((p: any) => <option key={p.slug} value={p.slug}>{p.nombre}{p.precio_anual ? ` ($${p.precio_anual}/año)` : ''}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <label style={M.lbl}>Ciclo</label>
              <select value={f.ciclo} onChange={e => { const c = e.target.value; const p = planes.find((x: any) => x.slug === f.plan_slug); setF((prev: any) => ({ ...prev, ciclo: c, precio: p ? ((c === 'mensual' ? p.precio_mensual : p.precio_anual) ?? prev.precio) : prev.precio })); }} style={M.input}>
                {CICLOS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            {campo('Precio', 'precio', '', 'number', '0 1 110px')}
            {campo('Próxima factura', 'proxima_factura', '', 'date', '0 1 160px')}
            <div style={{ flex: '0 1 150px' }}>
              <label style={M.lbl}>Estado</label>
              <select value={f.sub_estado} onChange={e => set('sub_estado', e.target.value)} style={M.input}>
                {['programada', 'activa', 'pendiente_pago'].map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={M.h}>5 · Cotización (opcional)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 100%' }}>
            <label style={M.lbl}>Ligar una cotización existente (match)</label>
            <select value={f.cotizacion_id} onChange={e => set('cotizacion_id', e.target.value)} style={M.input}>
              <option value="">— sin cotización —</option>
              {cotizaciones.map((q: any) => (
                <option key={q.id} value={q.id}>
                  {(q.numero || 'COT')} · {q.empresa || q.contacto || 's/empresa'}{q.total ? ` · $${Number(q.total).toLocaleString()}` : ''}{q.estado ? ` · ${q.estado}` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.74rem', color: '#999', marginTop: 4 }}>
              {cotizaciones.length ? 'Se ligará esta cotización a este cliente/contacto (solo aparecen las que aún no tienen cliente).' : 'No hay cotizaciones sin cliente para ligar.'}
            </div>
          </div>
        </div>

        {pasos.length > 0 && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10, margin: '14px 0 0', fontSize: '0.78rem' }}>
            {pasos.map((p, i) => <div key={i}>{p.startsWith('⚠') ? p : '✅ ' + p}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={M.btnG} onClick={onClose}>Cancelar</button>
          <button style={M.btn} disabled={busy} onClick={crear}>{busy ? 'Creando…' : '✅ Crear cliente'}</button>
        </div>
      </div>
    </div>
  );
}
