import { useEffect, useState } from 'react';
import { ESTILOS_ENVIOS } from './TrabajoEnvios';

/* ═══ Calificación ═══
 * Todos los días el sistema evalúa a cada lead activo (índice de vida 0–100) y sugiere qué hacer con los
 * que ya agotaron los intentos. Aquí el dueño decide con fundamentos (la plática real, lo que se intentó,
 * por qué), ve a todos los leads con su índice, y revisa a los descalificados con opción de revivirlos.
 * La RAMPA: 20 veredictos seguidos coincidiendo con la propuesta → descalificar pasa a automático. */
const ESTADO_L: Record<string, { l: string; c: string }> = {
  seguir: { l: 'Seguir', c: '#14532d' }, bajar_ritmo: { l: 'Bajar ritmo', c: '#B7791F' }, sugerir_descalificar: { l: 'Sugerir descalificar', c: '#b93333' },
  nutricion: { l: 'Nutrición', c: '#6b6580' }, esperando_reunion: { l: 'Esperando reunión', c: '#5B4BD6' }, con_consultor: { l: 'Con el consultor', c: '#241d43' },
};
const fecha = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const postJ = (url: string, body: any) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(e => ({ error: String(e) }));

function Platica({ mensajes }: { mensajes: any[] }) {
  if (!mensajes?.length) return <div className="ti-suave">Sin mensajes registrados.</div>;
  return (
    <div style={{ display: 'grid', gap: 4, margin: '6px 0' }}>
      {mensajes.map((m, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8, fontSize: '.8rem' }}>
          <span style={{ color: m.de === 'lead' ? '#5B4BD6' : '#6b6580', fontWeight: 700 }}>{m.de === 'lead' ? 'Lead' : m.de}</span>
          <span>{m.texto} <span className="ti-suave" style={{ margin: 0, fontSize: '.68rem' }}>· {fecha(m.at)}</span></span>
        </div>
      ))}
    </div>
  );
}

function Indice({ n }: { n: number | null }) {
  if (n == null) return <span className="ti-suave">—</span>;
  const c = n > 60 ? '#14532d' : n >= 35 ? '#B7791F' : '#b93333';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 54, height: 6, background: '#ece9f5', borderRadius: 6, overflow: 'hidden' }}><span style={{ display: 'block', width: `${n}%`, height: '100%', background: c }} /></span><b style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>{n}</b></span>;
}

export default function TrabajoCalificacion() {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'sugerencias' | 'leads' | 'descalificados' | 'consultores'>('sugerencias');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [motivoNoLead, setMotivoNoLead] = useState<Record<string, string>>({});
  const cargar = () => fetch('/api/crm/ti/calificacion').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const rampa = d.rampa || {};
  const veredicto = async (t: any, resultado: string, detalle?: any) => {
    setOcupado(true);
    const r = await postJ('/api/crm/ti/tarea', { id: t.id, accion: 'hecha', resultado, detalle: detalle || null });
    setOcupado(false);
    if (r?.error) { setMsg('No se guardó: ' + r.error); return; }
    setMsg(`Listo: ${resultado === 'seguir' ? 'sigue' : resultado === 'descalificar' ? 'descalificado' : resultado}.`);
    cargar();
  };
  const resumen = (d.leads || []).reduce((a: any, l: any) => { a[l.estado] = (a[l.estado] || 0) + 1; return a; }, {});
  return (
    <div className="ti-envios" style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{ESTILOS_ENVIOS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h2 className="ti-h" style={{ margin: 0 }}>Calificación de leads</h2>
          <p className="ti-porque" style={{ margin: '4px 0 0' }}>Cada noche se evalúa a todos los leads activos con el índice de vida. Aquí decides sobre las sugerencias con la plática real y lo que se intentó; cada veredicto tuyo entrena la rampa.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ti-chip chip-tipo" title="Coincidencias seguidas entre tu veredicto y la propuesta">Rampa {Math.min(20, Number(rampa.coincidencias) || 0)}/20 · {rampa.automatico ? 'automático' : 'con tu clic'}</span>
          <button className="ti-btn" disabled={ocupado} onClick={async () => { const r = await postJ('/api/crm/ti/calificacion', { accion: 'rampa', automatico: !rampa.automatico }); if (!r.error) cargar(); }}>{rampa.automatico ? 'Volver al clic' : 'Hacerlo automático ya'}</button>
          <button className="ti-btn" disabled={ocupado} onClick={async () => { setOcupado(true); const r = await postJ('/api/crm/ti/calificacion', { accion: 'recalcular' }); setOcupado(false); setMsg(r.error ? 'No se pudo: ' + r.error : `Evaluados ${r.evaluados} · sugerencias nuevas ${r.sugerencias}${r.automaticas ? ` · automáticas ${r.automaticas}` : ''}`); cargar(); }}>{ocupado ? 'Evaluando…' : 'Evaluar ahora'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className={'ti-chip-btn' + (sub === 'sugerencias' ? ' on' : '')} onClick={() => setSub('sugerencias')}>Sugerencias de hoy · {(d.sugerencias || []).length}</button>
        <button className={'ti-chip-btn' + (sub === 'leads' ? ' on' : '')} onClick={() => setSub('leads')}>Todos los leads · {(d.leads || []).length}</button>
        <button className={'ti-chip-btn' + (sub === 'descalificados' ? ' on' : '')} onClick={() => setSub('descalificados')}>Descalificados · {(d.descalificados || []).length}</button>
        <button className={'ti-chip-btn' + (sub === 'consultores' ? ' on' : '')} onClick={() => setSub('consultores')}>Consultores · puntualidad</button>
        <span className="ti-suave" style={{ margin: '0 0 0 auto', fontSize: '.74rem' }}>{Object.entries(resumen).map(([k, v]: any) => `${ESTADO_L[k]?.l || k}: ${v}`).join(' · ')}{d.marca ? ` · última evaluación ${fecha(d.marca)}` : ''}</span>
      </div>
      {msg && <div className={'ti-envio-aviso ' + (msg.startsWith('No') ? 'err' : 'ok')} style={{ marginBottom: 10 }}>{msg}</div>}

      {sub === 'consultores' && (
        <div className="ti-carta" style={{ padding: 16 }}>
          <b style={{ fontSize: 15 }}>Puntualidad de la cadena (últimos 60 días)</b>
          <p className="ti-porque" style={{ margin: '4px 0 10px' }}>Resultado el mismo día (24 h), minuta 24 h, interés/cotización 48 h, cotizaciones dormidas 7 días. Lo que tarda cada consultor en capturar lo que le pide el sistema.</p>
          {!(d.consultores || []).length && <div className="ti-fin"><p>Todavía no hay tareas de la cadena resueltas: aparecerán conforme se capturen resultados, minutas y decisiones.</p></div>}
          {(d.consultores || []).length > 0 && (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead><tr style={{ color: '#8e88a8', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: '6px 8px' }}>Consultor</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Pedidas</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Hechas</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>A tiempo</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Horas prom.</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Vencidas abiertas</th><th style={{ textAlign: 'left', padding: '6px 8px' }}>Por eslabón</th></tr></thead>
              <tbody>{(d.consultores || []).map((c: any) => <tr key={c.consultor} style={{ borderTop: '1px solid #f0eef6' }}>
                <td style={{ padding: '8px' }}><b>{c.consultor}</b></td><td style={{ padding: '8px', textAlign: 'right' }}>{c.total}</td><td style={{ padding: '8px', textAlign: 'right' }}>{c.hechas}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: c.pct_a_tiempo == null ? '#8e88a8' : c.pct_a_tiempo >= 80 ? '#14532d' : c.pct_a_tiempo >= 50 ? '#78350f' : '#7f1d1d' }}>{c.pct_a_tiempo == null ? '—' : `${c.pct_a_tiempo}%`}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{c.horas_promedio == null ? '—' : `${c.horas_promedio} h`}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: c.vencidas_abiertas ? '#7f1d1d' : undefined, fontWeight: c.vencidas_abiertas ? 800 : undefined }}>{c.vencidas_abiertas}</td>
                <td style={{ padding: '8px', fontSize: 12, color: '#6b6580' }}>{Object.entries(c.por_campo || {}).map(([k, v]: any) => `${({ reunion_resultado: 'resultado', reunion_minuta: 'minuta', reunion_interes: 'interés', cotizacion_estado: 'cot. dormida', cotizacion_cobro: 'cobro' } as any)[k] || k} ${v.n}${v.horas != null ? ` (${v.horas} h)` : ''}`).join(' · ')}</td>
              </tr>)}</tbody>
            </table></div>
          )}
        </div>
      )}
      {sub === 'sugerencias' && (
        (d.sugerencias || []).length === 0 ? <div className="ti-fin"><h2>Sin sugerencias pendientes</h2><p>Cuando un lead agote los intentos reales y su índice baje de 35, aparece aquí con sus fundamentos.</p></div> :
        (d.sugerencias || []).map((t: any) => {
          const p = t.payload || {};
          return (
            <div key={t.id} className="ti-envio">
              <div className="ti-envio-cab"><b className="ti-envio-nombre">{t.contacto?.nombre || p.nombre || 'Lead'}</b>{t.contacto?.giro && <span className="ti-chip chip-tipo">{t.contacto.giro}</span>}{p.indice != null && <span className="ti-chip chip-ambar">índice {p.indice}/100</span>}<span className="ti-chip chip-tipo">propone: {p.propuesta === 'seguir' ? 'seguir' : 'descalificar'}</span><span className="ti-suave" style={{ margin: 0, fontSize: '.72rem' }}>{fecha(t.created_at)}</span></div>
              <div className="ti-envio-obj"><span>Por qué</span>{p.porque}</div>
              {Array.isArray(p.evidencia) && <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: '.82rem' }}>{p.evidencia.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
              <div className="ti-envio-lbl">La plática real (últimos mensajes)</div>
              <Platica mensajes={t.mensajes} />
              <div className="ti-envio-acc" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <button className="ti-btn primario" disabled={ocupado} onClick={() => veredicto(t, p.propuesta || 'descalificar')}>De acuerdo: {p.propuesta === 'seguir' ? 'que siga' : 'descalificar'}</button>
                {p.propuesta !== 'seguir' && <button className="ti-btn" disabled={ocupado} onClick={() => veredicto(t, 'seguir')}>No, que siga otro ciclo</button>}
                {p.propuesta === 'seguir' && <button className="ti-btn" disabled={ocupado} onClick={() => veredicto(t, 'descalificar')}>No, descalificar</button>}
                <button className="ti-btn" disabled={ocupado} onClick={() => veredicto(t, 'pausar', { hasta: new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10) })}>Pausar 14 días</button>
                <select className="ti-envio-input" style={{ maxWidth: 240 }} value={motivoNoLead[t.id] || ''} onChange={e => setMotivoNoLead({ ...motivoNoLead, [t.id]: e.target.value })}>
                  <option value="">No era lead (elige motivo)…</option>
                  {Object.entries(p.motivos_no_era_lead || {}).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                </select>
                {motivoNoLead[t.id] && <button className="ti-btn peligro" disabled={ocupado} onClick={() => veredicto(t, 'no_era_lead', { motivo: motivoNoLead[t.id] })}>Confirmar: no era lead</button>}
              </div>
            </div>
          );
        })
      )}

      {sub === 'leads' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
            <thead><tr style={{ textAlign: 'left', color: '#6b6580', fontSize: '.68rem', letterSpacing: '.08em', textTransform: 'uppercase' }}><th style={{ padding: '6px 8px' }}>Lead</th><th>Índice</th><th>Estado</th><th>Intentos</th><th>Sin respuesta</th><th>Por qué</th></tr></thead>
            <tbody>{(d.leads || []).map((l: any) => (
              <tr key={l.contact_id} style={{ borderTop: '1px solid #eeebf6' }}>
                <td style={{ padding: '8px' }}><b>{l.contacto?.nombre || '—'}</b><div className="ti-suave" style={{ margin: 0, fontSize: '.7rem' }}>{l.contacto?.giro || ''}{l.contacto?.sucursales_interes ? ` · ${l.contacto.sucursales_interes} tiendas` : ''}</div></td>
                <td><Indice n={l.indice} /></td>
                <td><span style={{ color: ESTADO_L[l.estado]?.c || '#6b6580', fontWeight: 700 }}>{ESTADO_L[l.estado]?.l || l.estado}</span></td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{l.intentos}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{l.detalle?.dias_sin_respuesta ?? '—'} d</td>
                <td className="ti-suave" style={{ margin: 0, fontSize: '.74rem', maxWidth: 320 }}>{(l.detalle?.razones || []).join(' · ')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {sub === 'descalificados' && (
        (d.descalificados || []).length === 0 ? <div className="ti-fin"><h2>Nadie descalificado</h2></div> :
        (d.descalificados || []).map((c: any) => (
          <div key={c.id} className="ti-envio">
            <div className="ti-envio-cab" onClick={() => setAbierto(abierto === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
              <b className="ti-envio-nombre">{c.nombre || 'Lead'}</b>{c.giro && <span className="ti-chip chip-tipo">{c.giro}</span>}
              <span className="ti-chip chip-ambar">{c.cerrado === 'no_era_lead' ? `no era lead · ${c.motivo || ''}` : c.cerrado === 'nutricion' || c.descarte_categoria === 'no_respondio' ? 'no respondió · nutrición' : c.motivo || c.estatus_lead || 'descalificado'}</span>
              {c.indice != null && <span className="ti-chip chip-tipo">índice {c.indice}</span>}
              <span className="ti-suave" style={{ margin: '0 0 0 auto', fontSize: '.72rem' }}>{fecha(c.cerrado_at || c.updated_at)} · {abierto === c.id ? 'cerrar' : 'ver fundamentos'}</span>
            </div>
            {abierto === c.id && (
              <div>
                <div className="ti-envio-obj"><span>Lo que se intentó</span>{c.intentos.length ? c.intentos.map((i: any) => `${i.tipo} (${i.franja}, ${String(i.at).slice(5, 10)}${i.valido === false ? ', no entregada' : ''})`).join(' · ') : 'sin intentos registrados'}{c.angulos?.length ? ` · ángulos: ${c.angulos.join(' · ')}` : ''}</div>
                <div className="ti-envio-lbl">La plática real</div>
                <Platica mensajes={c.mensajes} />
                <div className="ti-envio-acc" style={{ marginTop: 8 }}>
                  <button className="ti-btn primario" disabled={ocupado} onClick={async () => { setOcupado(true); const r = await postJ('/api/crm/ti/calificacion', { accion: 'revivir', contact_id: c.id }); setOcupado(false); setMsg(r.error ? 'No se pudo: ' + r.error : 'Revivido: vuelve a lead y el agente retoma.'); cargar(); }}>Revivir</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
