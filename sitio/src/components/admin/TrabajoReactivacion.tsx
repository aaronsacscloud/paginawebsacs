import { useEffect, useState } from 'react';

/* ═══ Reactivación de leads viejos ═══ El agente redacta un primer contacto personalizado por lead (qué preguntó,
   en qué se quedó, una novedad). Aquí se ve QUIÉN es cada uno antes del mensaje, se aprueba, se edita o se
   rechaza. Rampa: 20 aprobadas seguidas sin editar → salen solas con 10 min de veto. Máximo 15 al día. */
const postJ = (body: any) => fetch('/api/crm/ti/reactivacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const ESTADO_L: Record<string, { l: string; c: string; bg: string }> = {
  propuesta: { l: 'Por aprobar', c: '#4c1d95', bg: '#EEECFE' }, programada: { l: 'Programado', c: '#1e3a8a', bg: '#e0e7ff' }, enviada: { l: 'Enviado', c: '#14532d', bg: '#dcfce7' },
  respondio: { l: 'Respondió', c: '#14532d', bg: '#bbf7d0' }, descartada: { l: 'Descartado por el agente', c: '#4a4658', bg: '#f3f4f6' }, rechazada: { l: 'Rechazado', c: '#7f1d1d', bg: '#fee2e2' }, error: { l: 'Error', c: '#7f1d1d', bg: '#fee2e2' },
};
const MOTIVOS = ['No es el lead correcto', 'El ángulo no le pega', 'Muy vendedor', 'Todavía no: esperar', 'Otro'];
const fecha = (iso?: string) => iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export default function TrabajoReactivacion() {
  const [d, setD] = useState<any>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState<'pendientes' | 'intencion' | 'conversacion' | 'programadas' | 'historial'>('pendientes');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/ti/reactivacion').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const filas: any[] = d.filas || []; const seg = d.segmentos || {}; const rampa = d.rampa || {};
  const pend = filas.filter(f => f.estado === 'propuesta');
  const lista = filtro === 'pendientes' ? pend : filtro === 'intencion' || filtro === 'conversacion' ? pend.filter(f => f.segmento === filtro) : filtro === 'programadas' ? filas.filter(f => f.estado === 'programada') : filas.filter(f => !['propuesta', 'programada'].includes(f.estado));
  const porSeg = (s: string) => pend.filter(f => f.segmento === s).length;
  const decidir = async (f: any, accion: 'aprobar' | 'rechazar', motivo?: string) => {
    setOcupado(f.id); setMsg('');
    const r = await postJ(accion === 'aprobar' ? { accion, id: f.id, mensaje: textos[f.id] ?? f.mensaje } : { accion, id: f.id, motivo });
    setOcupado(null); setRechazando(null);
    if (r?.error) { setMsg(r.error); return; }
    setMsg(accion === 'aprobar' ? `Programado para ${fecha(r.sale_at)}.` : 'Rechazado. El agente lo toma como lección.');
    cargar();
  };
  const generar = async () => { setOcupado('gen'); setMsg('Redactando… tarda un minuto por lead.'); const r = await postJ({ accion: 'generar', n: 5 }); setOcupado(null); setMsg(r?.error ? r.error : `${r.propuestas || 0} propuestas nuevas (${r.candidatos || 0} candidatos leídos).`); cargar(); };
  const chip = (k: typeof filtro, l: string, n?: number) => <button key={k} className={'ti-res-chip' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>{l}{typeof n === 'number' ? ` · ${n}` : ''}</button>;
  return (
    <div className="ti-lienzo" style={{ maxWidth: 860 }}>
      <div className="ti-carta" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="ti-chip chip-p2" style={{ display: 'inline-block' }}>Reactivación</div>
            <h2 style={{ margin: '8px 0 4px', fontSize: 20 }}>Leads que preguntaron hace meses</h2>
            <p style={{ margin: 0, color: '#6b6580', fontSize: 13, lineHeight: 1.5, maxWidth: 560 }}>El agente escribe un primer contacto por lead, con su pregunta original y una novedad que le sirva. Tú apruebas; a partir de la respuesta sigue el ciclo normal. Salen máximo 15 al día en horas distintas, solo entre semana.</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#6b6580' }}>
            <div><b style={{ color: '#241d43' }}>{d.candidatos?.intencion || 0}</b> por redactar · {seg.intencion?.corto}</div>
            <div><b style={{ color: '#241d43' }}>{d.candidatos?.conversacion || 0}</b> por redactar · {seg.conversacion?.corto}</div>
            <div style={{ marginTop: 6 }}>Rampa: <b style={{ color: rampa.automatico ? '#14532d' : '#241d43' }}>{rampa.automatico ? 'automática (veto 10 min)' : `${rampa.sin_editar || 0} de 20 sin editar`}</b>
              {rampa.automatico && <button onClick={async () => { await postJ({ accion: 'rampa', automatico: false }); cargar(); }} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Volver a manual</button>}
            </div>
            <button className="ti-btn" disabled={ocupado === 'gen'} onClick={generar} style={{ marginTop: 8, fontSize: 12, padding: '7px 12px' }}>{ocupado === 'gen' ? 'Redactando…' : 'Redactar 5 ahora'}</button>
          </div>
        </div>
        <div className="ti-res-chips" style={{ marginTop: 12 }}>
          {chip('pendientes', 'Por aprobar', pend.length)}{chip('intencion', seg.intencion?.corto || 'Pidió precio/demo', porSeg('intencion'))}{chip('conversacion', seg.conversacion?.corto || 'Preguntó', porSeg('conversacion'))}{chip('programadas', 'Programados', filas.filter(f => f.estado === 'programada').length)}{chip('historial', 'Historial')}
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: msg.startsWith('No') || msg.includes('error') ? '#b91c1c' : '#14532d', fontWeight: 600 }}>{msg}</div>}
      </div>
      {!lista.length && <div className="ti-carta"><div className="ti-fin"><h2>Nada aquí</h2><p>{filtro === 'pendientes' ? 'El lote diario se redacta a las 9:30. Si quieres adelantar, usa «Redactar 5 ahora».' : 'Sin registros en esta vista.'}</p></div></div>}
      {lista.map(f => {
        const k = f.contacts || {}; const emp = k.companies?.nombre_comercial || k.companies?.nombre; const es = ESTADO_L[f.estado] || ESTADO_L.propuesta;
        const editable = f.estado === 'propuesta'; const txt = textos[f.id] ?? f.mensaje; const cambiado = editable && txt.trim() !== String(f.mensaje_original || f.mensaje).trim();
        return (
          <div className="ti-carta" key={f.id} style={{ padding: 18, marginBottom: 12, opacity: ocupado === f.id ? .6 : 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span className="ti-chip" style={{ background: f.segmento === 'intencion' ? '#fef3c7' : '#f3f4f6', color: f.segmento === 'intencion' ? '#78350f' : '#4a4658' }}>{seg[f.segmento]?.l || f.segmento}</span>
              <span className="ti-chip" style={{ background: es.bg, color: es.c }}>{es.l}{f.sale_at && f.estado === 'programada' ? ` · ${fecha(f.sale_at)}` : ''}</span>
              <span style={{ fontSize: 12, color: '#8e88a8' }}>hace {f.meses_sin_hablar} {f.meses_sin_hablar === 1 ? 'mes' : 'meses'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
              <div style={{ background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', marginBottom: 6 }}>Quién es</div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{k.nombre || 'Sin nombre'}{emp ? <span style={{ fontWeight: 600, color: '#6b6580' }}> · {emp}</span> : null}</div>
                <div style={{ fontSize: 12, color: '#8e88a8', marginTop: 2 }}>{f.telefono}{k.email ? ` · ${k.email}` : ''}</div>
                {f.pregunta_original && <div style={{ marginTop: 10, fontSize: 13 }}><span style={{ color: '#8e88a8' }}>Preguntó:</span> «{f.pregunta_original}»</div>}
                {f.resumen_lead && <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45 }}>{f.resumen_lead}</div>}
                {f.angulo && <div style={{ marginTop: 8, fontSize: 12, color: '#5B4BD6', fontWeight: 700 }}>Palanca: {f.angulo}</div>}
                {f.por_que && <div style={{ marginTop: 4, fontSize: 12, color: '#6b6580' }}>{f.por_que}</div>}
                {f.estado === 'descartada' && f.error && <div style={{ marginTop: 6, fontSize: 12.5, color: '#4a4658' }}>Motivo: {f.error}</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', marginBottom: 6 }}>Lo que va a decir {cambiado && <span style={{ color: '#b45309' }}>· se guardará tu versión</span>}</div>
                <div style={{ fontSize: 12, color: '#8e88a8', marginBottom: 4 }}>Hola {String(k.nombre || '').split(' ')[0] || '…'},</div>
                {editable
                  ? <textarea className="ti-campo" rows={6} value={txt} onChange={e => setTextos(t => ({ ...t, [f.id]: e.target.value }))} style={{ fontSize: 14, margin: 0 }} />
                  : <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.mensaje}</div>}
                <div style={{ fontSize: 11.5, color: '#8e88a8', marginTop: 6 }}>La plantilla cierra sola con la invitación a 15 minutos y la salida amable.</div>
                {editable && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="ti-btn prim" disabled={!!ocupado} onClick={() => decidir(f, 'aprobar')} style={{ flex: 1 }}>{cambiado ? 'Aprobar mi versión' : 'Aprobar y programar'}</button>
                    <button className="ti-btn" disabled={!!ocupado} onClick={() => setRechazando(rechazando === f.id ? null : f.id)}>Rechazar</button>
                  </div>
                )}
                {f.estado === 'programada' && <button className="ti-btn" disabled={!!ocupado} onClick={() => decidir(f, 'rechazar', 'cancelado antes de salir')} style={{ marginTop: 10 }}>Cancelar envío</button>}
                {rechazando === f.id && (
                  <div className="ti-res-chips" style={{ marginTop: 8 }}>
                    {MOTIVOS.map(m => <button key={m} className="ti-res-chip" onClick={() => decidir(f, 'rechazar', m)}>{m}</button>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
