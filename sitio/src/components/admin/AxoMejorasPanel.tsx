// Solicitudes de mejora que llegan desde AXO — el panel del equipo (2026-10-04).
// Una fila por solicitud: de qué cuenta/empresa, qué pidió, en qué etapa va. Al abrirla, el
// equipo decide gratis o con costo, pone monto, tiempo y fecha estimada y la mueve de etapa.
// Lo que se guarda aquí es lo que el cliente ve en AXO (barra de etapas, monto, «Aceptar y pagar»).
import { useEffect, useState } from 'react';

const ETAPAS = ['recibida', 'evaluacion', 'cotizada', 'aceptada', 'pago_enviado', 'pago_confirmado', 'desarrollo', 'lista', 'rechazada'];
const NOMBRE: Record<string, string> = {
  recibida: 'Recibida', evaluacion: 'En evaluación', cotizada: 'Cotizada', aceptada: 'Aceptada', pago_enviado: 'Pago enviado',
  pago_confirmado: 'Pago confirmado', desarrollo: 'En desarrollo', lista: 'Lista', rechazada: 'Rechazada',
};
const fmt = (n: any) => (typeof n === 'number' ? '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '—');

export default function AxoMejorasPanel() {
  const [lista, setLista] = useState<any[]>([]);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string>('');
  const [form, setForm] = useState<any>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/crm/mejoras/axo', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo cargar');
      setLista(j.mejoras || []); setCuentas(j.cuentas_cobro || []);
    } catch (e: any) { setError(e.message); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (m: any) => {
    setAbierta(m.account + '|' + m.fid);
    setForm({ etapa: m.etapa, costo: m.costo || '', monto: m.monto ?? '', tiempo: m.tiempo || '', fecha_estimada: m.fechaEstimada || '', nota: m.notaEquipo || '', bank_account_id: '' });
  };
  const guardar = async (m: any) => {
    setGuardando(true); setError('');
    try {
      const body: any = { account: m.account, fid: m.fid, crm_mejora_id: m.crmMejoraId };
      Object.keys(form).forEach((k) => { if (form[k] !== '' && form[k] !== undefined) body[k] = k === 'monto' ? Number(form[k]) : form[k]; });
      if (body.etapa === m.etapa) delete body.etapa;
      const r = await fetch('/api/crm/mejoras/axo', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo guardar');
      setAbierta(''); await cargar();
    } catch (e: any) { setError(e.message); }
    setGuardando(false);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px', fontFamily: 'DM Sans, Inter, system-ui, sans-serif', color: '#0F172A' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Solicitudes de mejora desde AXO</h1>
      <p style={{ color: '#475569', margin: '0 0 18px', fontSize: 14 }}>Lo que los clientes le piden a AXO que Sacs haga. Cada una es una oportunidad: evalúa, cotiza y entrega — el cliente ve la etapa en su panel de AXO.</p>
      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {cargando ? <p>Cargando…</p> : !lista.length ? <p style={{ color: '#64748B' }}>Todavía no hay solicitudes.</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {lista.map((m) => {
            const id = m.account + '|' + m.fid;
            return (
              <div key={id} style={{ border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, background: '#fff' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: '#EFF4FF', color: '#1D4ED8', borderRadius: 999, padding: '3px 9px' }}>{NOMBRE[m.etapa] || m.etapa}</span>
                  <b style={{ fontSize: 15, flex: 1, minWidth: 200 }}>{m.titulo}</b>
                  <span style={{ fontSize: 12.5, color: '#475569' }}>{(m.empresa && (m.empresa.nombre_comercial || m.empresa.nombre)) || m.account}{m.empresa ? '' : ' · sin empresa ligada en el CRM'}</span>
                  <span style={{ fontSize: 13 }}>{m.costo === 'gratis' ? 'Gratis' : fmt(m.monto)}{m.tiempo ? ' · ' + m.tiempo : ''}</span>
                  <button onClick={() => (abierta === id ? setAbierta('') : abrir(m))} style={{ border: '1px solid #E5E7EB', background: '#fff', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}>{abierta === id ? 'Cerrar' : 'Atender'}</button>
                </div>
                {m.descripcion && <p style={{ margin: '8px 0 0', fontSize: 13.5, color: '#475569' }}>{m.descripcion}</p>}
                {m.comprobante && <p style={{ margin: '6px 0 0', fontSize: 13 }}>Comprobante: <a href={m.comprobante.url} target="_blank" rel="noopener">{m.comprobante.nombre}</a></p>}
                {abierta === id && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
                    <label style={{ fontSize: 12, color: '#475569' }}>Etapa<br />
                      <select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }}>
                        {ETAPAS.filter((x) => x !== 'rechazada' || m.etapa === 'rechazada').map((x) => <option key={x} value={x}>{NOMBRE[x]}</option>)}
                      </select></label>
                    <label style={{ fontSize: 12, color: '#475569' }}>Costo<br />
                      <select value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }}>
                        <option value="">Sin decidir</option><option value="gratis">Gratis</option><option value="con_costo">Con costo</option>
                      </select></label>
                    <label style={{ fontSize: 12, color: '#475569' }}>Monto (MXN)<br /><input type="number" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} /></label>
                    <label style={{ fontSize: 12, color: '#475569' }}>Tiempo estimado<br /><input value={form.tiempo} placeholder="Ej.: 2 semanas" onChange={(e) => setForm({ ...form, tiempo: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} /></label>
                    <label style={{ fontSize: 12, color: '#475569' }}>Fecha estimada<br /><input type="date" value={form.fecha_estimada} onChange={(e) => setForm({ ...form, fecha_estimada: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} /></label>
                    <label style={{ fontSize: 12, color: '#475569' }}>Cuenta de cobro<br />
                      <select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }}>
                        <option value="">La default</option>
                        {cuentas.map((c) => <option key={c.id} value={c.id}>{c.alias || c.banco}</option>)}
                      </select></label>
                    <label style={{ fontSize: 12, color: '#475569', gridColumn: '1 / -1' }}>Nota para el cliente<br /><input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} /></label>
                    <button disabled={guardando} onClick={() => guardar(m)} style={{ border: 0, background: '#0F172A', color: '#fff', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
