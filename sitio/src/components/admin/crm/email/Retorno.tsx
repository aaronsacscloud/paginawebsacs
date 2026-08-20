// Retorno por canal: cuánto cuesta un cliente, y de dónde viene el ARR.
//
// El CRM tenía las dos mitades sin juntar — de dónde vino cada contacto, y qué
// suscripciones se activaron. Faltaba el gasto, que se captura a mano.
import { useEffect, useState } from 'react';
import { S, Kpi, Cargando, Aviso, Tag, money, PedirTexto, Modal } from './ui';

export default function Retorno() {
  const [d, setD] = useState<any>(null);
  const [dias, setDias] = useState(180);
  const [registrando, setRegistrando] = useState(false);

  const cargar = () => { setD(null); fetch(`/api/crm/email/roi-canal?dias=${dias}`).then(r => r.json()).then(setD).catch(() => setD({ canales: [] })); };
  useEffect(() => { cargar(); }, [dias]);
  if (!d) return <Cargando que="el retorno" />;

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Retorno por canal</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>
            Qué canal trae clientes que pagan — no solo clics
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={dias} onChange={e => setDias(Number(e.target.value))} style={{ ...S.inp, width: 'auto' }}>
            <option value={90}>Últimos 90 días</option>
            <option value={180}>Últimos 6 meses</option>
            <option value={365}>Último año</option>
          </select>
          <button style={S.btnP} onClick={() => setRegistrando(true)}>Registrar gasto</button>
        </div>
      </div>

      {registrando && <GastoModal onCerrar={() => setRegistrando(false)} onListo={() => { setRegistrando(false); cargar(); }} />}

      {d.sin_gasto_capturado?.length > 0 && (
        <Aviso tono="aviso"
          accion={<button style={S.btnP} onClick={() => setRegistrando(true)}>Registrar</button>}>
          Ya se ve el ARR que trajo <b>{d.sin_gasto_capturado.join(' y ')}</b>, pero no si valió la pena.
          Con el gasto aparece el costo por cliente.
        </Aviso>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi etiqueta="ARR atribuido" valor={money(d.total?.arr)} sub={`${d.total?.clientes || 0} clientes nuevos`} tono="ok" />
        <Kpi etiqueta="Gasto registrado" valor={money(d.total?.gasto)} sub={`en ${d.periodo_dias} días`} />
        <Kpi etiqueta="Retorno" valor={d.total?.retorno ? `${d.total.retorno}×` : '—'}
          sub={d.total?.retorno ? 'de ARR por cada peso' : 'falta registrar gasto'} tono={d.total?.retorno >= 3 ? 'ok' : undefined} />
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>Canal</th><th style={S.th}>Leads</th><th style={S.th}>Clientes</th>
              <th style={S.th}>Conversión</th><th style={S.th}>Gasto</th>
              <th style={S.th}>Costo/cliente</th><th style={S.th}>ARR</th><th style={S.th}>Retorno</th>
            </tr></thead>
            <tbody>
              {(d.canales || []).length === 0 && (
                <tr><td style={{ ...S.td, color: '#a5a2af' }} colSpan={8}>Todavía no hay contactos con canal identificado en este periodo.</td></tr>
              )}
              {(d.canales || []).map((c: any) => (
                <tr key={c.canal}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{c.nombre}</td>
                  <td style={S.td}>{c.leads}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: c.clientes ? '#1E8A63' : '#c9c7d0' }}>{c.clientes}</td>
                  <td style={S.td}>{c.conversion_pct}%</td>
                  <td style={S.td}>{c.gasto ? money(c.gasto) : <span style={{ color: '#c9c7d0' }}>—</span>}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{c.costo_por_cliente ? money(c.costo_por_cliente) : <span style={{ color: '#c9c7d0' }}>—</span>}</td>
                  <td style={{ ...S.td, fontWeight: 800 }}>{c.arr ? money(c.arr) : '—'}</td>
                  <td style={S.td}>
                    {c.retorno != null
                      ? <Tag tono={c.retorno >= 3 ? 'ok' : c.retorno >= 1 ? 'aviso' : 'malo'}>{c.retorno}×</Tag>
                      : <span style={{ color: '#c9c7d0' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: '0.73rem', color: '#8a8a8a', marginTop: 12, lineHeight: 1.6, maxWidth: '72ch' }}>
        Cuando dos personas de la misma empresa llegan por canales distintos, el crédito se queda con el primero — el que la trajo.
        Repartirlo entre canales suena más justo, pero hace imposible comparar.
      </div>
    </div>
  );
}

function GastoModal({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ canal: 'tiktok', monto: '', periodo_inicio: hace30, periodo_fin: hoy, campana: '' });
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true); setErr(null);
    try {
      const r = await fetch('/api/crm/email/roi-canal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, monto: Number(f.monto) }),
      });
      const j = await r.json();
      if (j.error) { setErr(j.error); return; }
      onListo();
    } finally { setGuardando(false); }
  }

  return (
    <Modal titulo="Registrar gasto de anuncios" sub="Lo que pagaste a la plataforma en ese periodo."
      onCerrar={onCerrar} ancho={430}
      pie={<>
        <button style={{ ...S.btnP, opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button style={S.btnG} onClick={onCerrar}>Cancelar</button>
      </>}>
      <div style={{ marginBottom: 11 }}>
        <span style={S.lbl}>Canal</span>
        <select value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })} style={S.inp}>
          <option value="tiktok">TikTok Ads</option>
          <option value="google">Google</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </div>
      <div style={{ marginBottom: 11 }}>
        <span style={S.lbl}>Monto gastado (MXN)</span>
        <input type="number" value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} placeholder="15000" style={S.inp} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 11 }}>
        <div><span style={S.lbl}>Desde</span><input type="date" value={f.periodo_inicio} onChange={e => setF({ ...f, periodo_inicio: e.target.value })} style={S.inp} /></div>
        <div><span style={S.lbl}>Hasta</span><input type="date" value={f.periodo_fin} onChange={e => setF({ ...f, periodo_fin: e.target.value })} style={S.inp} /></div>
      </div>
      <div style={{ marginBottom: 11 }}>
        <span style={S.lbl}>Campaña (opcional)</span>
        <input value={f.campana} onChange={e => setF({ ...f, campana: e.target.value })} placeholder="Campaña para generación de Leads" style={S.inp} />
      </div>
      {err && <div style={{ fontSize: '0.78rem', color: '#C0554E' }}>{err}</div>}
    </Modal>
  );
}
