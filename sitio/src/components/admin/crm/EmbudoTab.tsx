import { useEffect, useMemo, useState } from 'react';
import KpiCard from './ui/KpiCard';
import ContextoLead from './ti/ContextoLead';

/* ═══ Embudo por ciclo de vida ═══ La pregunta del dueño: de los leads de un canal (TikTok primero), ¿con cuántos
   hubo conversación real, cuántos nunca contestaron, cuántos descalificamos después de hablar, cuántas demos se
   agendaron y completaron, cuántos están en cotización, cuánto se vendió y cuánto invertí? Cada número abre su
   desglose; cada lead abre su conversación. */
type Fila = any;
const RANGOS = [{ k: '7', l: '7 días', d: 7 }, { k: '30', l: '30 días', d: 30 }, { k: '90', l: '90 días', d: 90 }, { k: 'mes', l: 'Este mes', d: 0 }];
const pesos = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-MX');
const pct = (a: number, b: number) => b ? Math.round(a / b * 100) + '%' : '—';
const fecha = (iso?: string) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
const ETAPA: Record<string, string> = { lead: 'Lead', lead_calificado: 'Calificado', oportunidad: 'Oportunidad', cliente: 'Cliente', descalificado: 'Descalificado', rezagado: 'Rezagado', churned: 'Churn' };

const METRICAS: Record<string, { l: string; que: string; f: (r: Fila) => boolean }> = {
  leads: { l: 'Leads que llegaron', que: 'Contactos creados en el rango por el canal elegido.', f: () => true },
  contactados: { l: 'Les escribimos o llamamos', que: 'Al menos un mensaje nuestro o una llamada.', f: r => r.msgs_out > 0 || r.llamada_max_seg > 0 },
  conversacion_real: { l: 'Conversación real', que: 'Al menos 2 mensajes suyos y 2 nuestros, o una llamada de 2 minutos o más.', f: r => r.conversacion_real },
  respondio_algo: { l: 'Contestaron algo y ya', que: 'Un mensaje suyo, sin llegar a conversación real.', f: r => !r.conversacion_real && r.msgs_in > 0 },
  nunca_contesto: { l: 'Nunca contestaron', que: 'Les escribimos y no hubo ni un mensaje ni llamada suya.', f: r => r.nunca_contesto && r.msgs_out > 0 },
  sin_contactar: { l: 'Sin contactar', que: 'Nadie les ha escrito ni llamado y ellos tampoco.', f: r => r.msgs_out === 0 && r.llamada_max_seg === 0 && r.msgs_in === 0 },
  descalificados_hablados: { l: 'Descalificados tras hablar', que: 'Hubo conversación real y no eran del perfil.', f: r => r.descalificado && r.conversacion_real },
  descalificados_sin_hablar: { l: 'Descalificados sin hablar', que: 'Descalificados sin conversación real (casi siempre por silencio).', f: r => r.descalificado && !r.conversacion_real },
  agendaron: { l: 'Agendaron demo', que: 'Tienen al menos una reunión en el calendario, del estado que sea.', f: r => r.citas_total > 0 },
  completadas: { l: 'Demo completada', que: 'Al menos una reunión marcada como asistió.', f: r => r.citas_asistio > 0 },
  no_asistio: { l: 'No asistieron', que: 'Reunión marcada como no asistió y ninguna completada.', f: r => r.citas_no_asistio > 0 && r.citas_asistio === 0 },
  vigentes: { l: 'Demo por venir', que: 'Reunión agendada o confirmada todavía pendiente.', f: r => r.citas_vigentes > 0 },
  cotizacion: { l: 'En cotización', que: 'Al menos una cotización enviada, aceptada, pagada o vencida.', f: r => r.cot_total > 0 },
  vendidos: { l: 'Compraron', que: 'Con pago confirmado, cotización pagada o suscripción.', f: r => r.pagado > 0 || r.cot_pagadas > 0 || r.suscripciones > 0 },
};

export default function EmbudoTab() {
  const [rango, setRango] = useState('30');
  const [canal, setCanal] = useState('tiktok');
  const [d, setD] = useState<any>(null);
  const [metrica, setMetrica] = useState<string>('conversacion_real');
  const [ctx, setCtx] = useState<string | null>(null);
  const [gasto, setGasto] = useState({ canal: 'tiktok', campana: '', monto: '', periodo_inicio: '', periodo_fin: '', nota: '' });
  const [msg, setMsg] = useState('');
  const fechas = useMemo(() => { const hoy = new Date(); const r = RANGOS.find(x => x.k === rango)!; const hasta = hoy.toISOString().slice(0, 10); const desde = r.d ? new Date(hoy.getTime() - (r.d - 1) * 86400e3).toISOString().slice(0, 10) : hasta.slice(0, 8) + '01'; return { desde, hasta }; }, [rango]);
  const cargar = () => fetch(`/api/crm/embudo?desde=${fechas.desde}&hasta=${fechas.hasta}&canal=${canal}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { setD(null); cargar(); }, [fechas.desde, fechas.hasta, canal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGasto(g => ({ ...g, canal: canal === 'todos' ? g.canal : canal, periodo_inicio: g.periodo_inicio || fechas.desde, periodo_fin: g.periodo_fin || fechas.hasta })); }, [canal, fechas]);
  const r = d?.resumen || {}; const filas: Fila[] = d?.filas || [];
  const lista = useMemo(() => filas.filter(METRICAS[metrica]?.f || (() => true)), [filas, metrica]);
  const inv = r.inversion || 0;
  const costo = (n: number) => inv && n ? pesos(inv / n) : '—';
  const guardarGasto = async () => { setMsg(''); const j = await fetch('/api/crm/embudo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'gasto', ...gasto }) }).then(x => x.json()); if (j.error) { setMsg(j.error); return; } setGasto(g => ({ ...g, monto: '', campana: '', nota: '' })); setMsg('Inversión guardada.'); cargar(); };
  const chip = (on: boolean) => ({ border: `1px solid ${on ? '#5B4BD6' : '#e8e5f0'}`, background: on ? '#EEECFE' : '#fff', color: on ? '#4c1d95' : '#4a4658', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' });
  const paso = (k: string, base?: number) => {
    const v = r[k] || 0; const on = metrica === k;
    return <KpiCard key={k} label={METRICAS[k].l} valor={v} sub={base !== undefined ? `${pct(v, base)} del paso anterior · ${costo(v)} c/u` : `${costo(v)} por lead`} onClick={() => setMetrica(k)} activo={on} />;
  };
  return (
    <div style={{ padding: '18px 22px 60px', maxWidth: 1180, margin: '0 auto', fontFamily: 'inherit', color: '#241d43' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#5B4BD6' }}>Embudo por ciclo de vida</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 26 }}>Del lead a la venta, por canal</h1>
          <p style={{ margin: 0, color: '#6b6580', fontSize: 13.5 }}>Leads creados del {fechas.desde} al {fechas.hasta}. Cada número abre su lista; cada lead abre su conversación.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGOS.map(x => <button key={x.k} style={chip(rango === x.k)} onClick={() => setRango(x.k)}>{x.l}</button>)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {Object.entries(d?.canales || { tiktok: 'TikTok', todos: 'Todos' }).map(([k, l]: any) => <button key={k} style={chip(canal === k)} onClick={() => setCanal(k)}>{l}</button>)}
      </div>
      {d?.error && <p style={{ color: '#b91c1c' }}>{d.error}</p>}
      {!d && <p style={{ color: '#8e88a8', marginTop: 20 }}>Calculando…</p>}
      {d && !d.error && (<>
        {/* El embudo: cada paso respecto al anterior */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 16 }}>
          {paso('leads')}{paso('contactados', r.leads)}{paso('conversacion_real', r.contactados)}{paso('agendaron', r.conversacion_real)}{paso('completadas', r.agendaron)}{paso('cotizacion', r.completadas)}{paso('vendidos', r.cotizacion)}
        </div>
        {/* Lo que se cae en el camino */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
          {['sin_contactar', 'nunca_contesto', 'respondio_algo', 'descalificados_hablados', 'descalificados_sin_hablar', 'no_asistio', 'vigentes'].map(k => <KpiCard key={k} label={METRICAS[k].l} valor={r[k] || 0} color="#6b6580" sub={pct(r[k] || 0, r.leads) + ' de los leads'} onClick={() => setMetrica(k)} activo={metrica === k} />)}
        </div>
        {/* Dinero */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 10 }}>
          <KpiCard label="Inversión en el rango" valor={pesos(inv)} color="#1e3a8a" sub={inv ? `${costo(r.leads)} por lead · ${costo(r.conversacion_real)} por conversación real` : 'Captúrala abajo'} />
          <KpiCard label="Cobrado de estos leads" valor={pesos(r.monto_vendido)} color="#14532d" sub={inv ? `retorno ${((r.monto_vendido || 0) / inv).toFixed(1)}×` : `${r.vendidos || 0} compraron`} />
          <KpiCard label="MRR activo que dejaron" valor={pesos(r.mrr_activo)} color="#14532d" sub="suscripciones activas hoy" />
          <KpiCard label="Cotizado abierto" valor={pesos(r.cot_abierto_monto)} color="#78350f" sub="enviadas o aceptadas sin pagar" />
          <KpiCard label="Costo por demo completada" valor={costo(r.completadas)} color="#1e3a8a" sub={`${costo(r.agendaron)} por demo agendada`} />
          <KpiCard label="Costo por venta" valor={costo(r.vendidos)} color="#1e3a8a" sub={`${r.vendidos || 0} ventas`} />
        </div>

        {/* Desglose */}
        <div style={{ marginTop: 22, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div><b style={{ fontSize: 15 }}>{METRICAS[metrica]?.l}</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {lista.length} leads</span></div>
            <span style={{ color: '#6b6580', fontSize: 12.5 }}>{METRICAS[metrica]?.que}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
              <thead><tr style={{ background: '#faf9fc', color: '#8e88a8', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {['Lead', 'Canal', 'Llegó', 'Etapa', 'Mensajes (él / nosotros)', 'Llamada', 'Demos', 'Cotización', 'Pagado', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 800 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lista.slice(0, 300).map((x: Fila) => (
                  <tr key={x.contact_id} style={{ borderTop: '1px solid #f0eef6' }}>
                    <td style={{ padding: '8px 12px' }}><b>{x.nombre || 'Sin nombre'}</b>{x.empresa ? <span style={{ color: '#6b6580' }}> · {x.empresa}</span> : null}{x.giro ? <div style={{ color: '#8e88a8', fontSize: 11 }}>{x.giro}</div> : null}</td>
                    <td style={{ padding: '8px 12px', color: '#6b6580' }}>{x.fuente || '—'}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fecha(x.created_at)}</td>
                    <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, fontWeight: 800, background: x.descalificado ? '#fee2e2' : x.lifecycle_stage === 'cliente' ? '#dcfce7' : '#f3f4f6', color: x.descalificado ? '#7f1d1d' : x.lifecycle_stage === 'cliente' ? '#14532d' : '#4a4658', borderRadius: 999, padding: '2px 8px' }}>{ETAPA[x.lifecycle_stage] || x.lifecycle_stage}</span>{x.estatus_lead ? <div style={{ color: '#8e88a8', fontSize: 11 }}>{x.estatus_lead}</div> : null}</td>
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{x.msgs_in} / {x.msgs_out}{x.ultimo_entrante_at ? <div style={{ color: '#8e88a8', fontSize: 11 }}>último suyo {fecha(x.ultimo_entrante_at)}</div> : null}</td>
                    <td style={{ padding: '8px 12px' }}>{x.llamada_max_seg ? `${Math.round(x.llamada_max_seg / 60)} min` : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{x.citas_total ? `${x.citas_asistio}/${x.citas_total} completadas` : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{x.cot_total ? `${x.cot_total}${x.cot_pagadas ? ` · ${x.cot_pagadas} pagada` : ''}` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{x.pagado ? pesos(x.pagado) : '—'}{x.mrr_activo ? <div style={{ color: '#14532d', fontSize: 11 }}>MRR {pesos(x.mrr_activo)}</div> : null}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setCtx(x.contact_id)} style={{ border: '1px solid #d9d4ea', background: '#fff', color: '#4c1d95', borderRadius: 999, padding: '4px 10px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Conversación</button>
                      <a href={`/admin/crm?tab=pipeline&lead=${x.contact_id}`} style={{ marginLeft: 6, color: '#5B4BD6', fontWeight: 800, fontSize: 11.5, textDecoration: 'none' }}>Ficha</a>
                    </td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={10} style={{ padding: 18, color: '#8e88a8', textAlign: 'center' }}>Nadie en esta métrica para este rango y canal.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inversión */}
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }} className="embudo-inv">
          <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, padding: 16 }}>
            <b style={{ fontSize: 15 }}>Capturar inversión</b>
            <p style={{ margin: '4px 0 10px', color: '#6b6580', fontSize: 12.5 }}>Lo que pagaste al canal en un periodo. Se prorratea al rango que estés viendo.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 11, color: '#8e88a8', fontWeight: 800 }}>Canal<select value={gasto.canal} onChange={e => setGasto({ ...gasto, canal: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit' }}><option value="tiktok">TikTok</option><option value="meta">Meta (Facebook/Instagram)</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option><option value="otro">Otro</option></select></label>
              <label style={{ fontSize: 11, color: '#8e88a8', fontWeight: 800 }}>Monto MXN<input type="number" value={gasto.monto} onChange={e => setGasto({ ...gasto, monto: e.target.value })} placeholder="15000" style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit', boxSizing: 'border-box' }} /></label>
              <label style={{ fontSize: 11, color: '#8e88a8', fontWeight: 800 }}>Del<input type="date" value={gasto.periodo_inicio} onChange={e => setGasto({ ...gasto, periodo_inicio: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit', boxSizing: 'border-box' }} /></label>
              <label style={{ fontSize: 11, color: '#8e88a8', fontWeight: 800 }}>Al<input type="date" value={gasto.periodo_fin} onChange={e => setGasto({ ...gasto, periodo_fin: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit', boxSizing: 'border-box' }} /></label>
              <label style={{ fontSize: 11, color: '#8e88a8', fontWeight: 800, gridColumn: '1 / -1' }}>Campaña o nota (opcional)<input value={gasto.campana} onChange={e => setGasto({ ...gasto, campana: e.target.value })} placeholder="Lead form septiembre" style={{ display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit', boxSizing: 'border-box' }} /></label>
            </div>
            <button onClick={guardarGasto} disabled={!gasto.monto || !gasto.periodo_inicio || !gasto.periodo_fin} style={{ marginTop: 10, border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar inversión</button>
            {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.startsWith('No') || msg.startsWith('Falt') ? '#b91c1c' : '#14532d', fontWeight: 700 }}>{msg}</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, padding: 16 }}>
            <b style={{ fontSize: 15 }}>Inversión registrada en el rango</b>
            {!(d.gastos || []).length && <p style={{ color: '#8e88a8', fontSize: 12.5, marginTop: 6 }}>Nada capturado todavía para este canal y rango.</p>}
            {(d.gastos || []).map((g: any) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid #f0eef6', fontSize: 12.5 }}>
                <div><b>{g.canal}</b>{g.campana ? ` · ${g.campana}` : ''}<div style={{ color: '#8e88a8', fontSize: 11 }}>{g.periodo_inicio} → {g.periodo_fin}</div></div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{pesos(g.monto)}</b><div><button onClick={async () => { await fetch('/api/crm/embudo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'borrar_gasto', id: g.id }) }); cargar(); }} style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar</button></div></div>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11.5, color: '#8e88a8' }}>Fuentes en el rango (todos los canales): {Object.entries(d.fuentes || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).map(([k, v]: any) => `${k} ${v}`).join(' · ')}</div>
          </div>
        </div>
        <style>{`@media (max-width: 760px) { .embudo-inv { grid-template-columns: 1fr !important; } }`}</style>
      </>)}
      <ContextoLead contactId={ctx} open={!!ctx} onClose={() => setCtx(null)} />
    </div>
  );
}
