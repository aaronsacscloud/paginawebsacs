import { useEffect, useMemo, useRef, useState } from 'react';
import ContextoLead from './crm/ti/ContextoLead';
import MinutaLead from './crm/MinutaLead';
import TrabajoDatos from './TrabajoDatos';

/* ═══ TORRE DE CONTROL ═══ (goal del dueño 2026-09-03)
   Una pantalla: la COLA de lo que sigue (izquierda), la ACCIÓN con las cuatro preguntas (centro) y el CONTEXTO del
   lead siempre abierto (derecha). En el teléfono son tres estados: cola → acción con barra fija → contexto en hoja.
   Cada tarjeta se decide con las mismas APIs de las pestañas; aquí solo cambia la composición. */
type Item = any;
const postJ = (url: string, body: any) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(e => ({ error: String(e) }));
const hora = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: 'numeric', minute: '2-digit' }) : '';
const fechaCorta = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short' }) : '';
const ETAPA: Record<string, string> = { lead: 'Lead', lead_calificado: 'Calificado', oportunidad: 'Oportunidad', cliente: 'Cliente', descalificado: 'Descalificado', rezagado: 'Rezagado', churned: 'Churn' };
const URG: Record<string, string> = { ahora: 'Ahora', hoy: 'Hoy', semana: 'Esta semana' };
const CHIP_COLOR: Record<string, { bg: string; fg: string }> = { 'Aprobar mensaje': { bg: '#EEECFE', fg: '#4c1d95' }, 'Llamar': { bg: '#fde7e5', fg: '#b3261e' }, 'Reunión': { bg: '#fff1dc', fg: '#a15c0a' }, 'Cotización': { bg: '#fff1dc', fg: '#a15c0a' }, 'Revisión diaria': { bg: '#EEECFE', fg: '#4c1d95' }, 'Reactivación': { bg: '#e0e7ff', fg: '#1e3a8a' }, 'Decidir': { bg: '#fde7e5', fg: '#b3261e' }, 'Aprendizaje': { bg: '#fff1dc', fg: '#a15c0a' }, 'Dato': { bg: '#f3f4f6', fg: '#4a4658' } };
const MOTIVOS_VETO = ['Tono', 'Dato incorrecto', 'No es el momento', 'Lo tomo yo', 'Otro'];
const MOTIVOS_REACT = ['No es el lead correcto', 'El ángulo no le pega', 'Muy vendedor', 'Todavía no'];
const useAncho = () => { const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200); useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []); return w; };

/* Feed de señales: lo que el lead hizo y vale saber. Se lee, no se hace. Si el agente actuó por un umbral, lo dice. */
function FeedSenales({ senales, onIr }: { senales: any[]; onIr: (cid: string) => void }) {
  const hace = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  const que = (s: any) => { const d = s.detalle || {}; if (s.tipo === 'cotizacion_vista') return `abrió la cotización${d.numero ? ` #${d.numero}` : ''} (${d.vistas || 1}ª vez${d.aperturas_24h > 1 ? `, ${d.aperturas_24h} hoy` : ''}${d.segundos_max >= 60 ? `, ${Math.round(d.segundos_max / 60)} min leyendo` : ''})`; if (s.tipo === 'lead_nuevo') return `entró por ${d.canal || 'un canal'}`; return s.tipo.replace(/_/g, ' '); };
  const acc = (s: any) => !s.umbral ? 'sin acción · solo registro' : s.accion === 'mensaje_unico' ? 'el agente mandó su mensaje único' : s.accion?.startsWith('sin_mensaje:unico_ya_usado') ? 'ya se le escribió por esta cotización · no se repite' : s.accion?.startsWith('sin_mensaje:') ? `umbral ${s.umbral} · ${s.accion.split(':')[1].replace(/_/g, ' ')}` : `umbral ${s.umbral}`;
  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {!senales.length && <div className="tc-vacio"><p>Hoy no hay señales todavía.</p></div>}
      {senales.map((s: any) => (
        <button key={s.id} onClick={() => s.contact_id && onIr(s.contact_id)} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f0eef6', background: 'transparent', padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
          <span style={{ fontSize: 10.5, color: '#8e88a8', fontWeight: 700, paddingTop: 2 }}>{hace(s.ocurrio_at)}</span>
          <span><span style={{ fontSize: 12.5 }}><b>{s.nombre}</b>{s.empresa ? <span style={{ color: '#6b6580' }}> · {s.empresa}</span> : null} {que(s)}</span><span style={{ display: 'block', fontSize: 11, color: s.accion === 'mensaje_unico' ? '#14532d' : '#8e88a8', marginTop: 2 }}>{acc(s)}</span></span>
        </button>
      ))}
    </div>
  );
}

export default function TorreControl({ irA }: { irA?: (tab: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [fTipo, setFTipo] = useState<string>('todo');
  const [fCuando, setFCuando] = useState<string>('todo');
  const [agrupar, setAgrupar] = useState<'lead' | 'cliente'>('lead');
  const filtro = fTipo; const setFiltro = setFTipo;
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [criterio, setCriterio] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<{ key: string; sel: string; texto: string } | null>(null);
  const [valor, setValor] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<Record<string, string>>({});
  const [minutaDe, setMinutaDe] = useState<any>(null);
  const [ctxAbierto, setCtxAbierto] = useState(false);   // móvil: hoja de contexto
  const [vistaMovil, setVistaMovil] = useState<'cola' | 'accion'>('cola');
  const [verSenales, setVerSenales] = useState(false);   // el feed de señales sustituye al contexto mientras esté abierto
  const ancho = useAncho(); const movil = ancho < 960;
  const cargar = () => fetch('/api/crm/ti/torre').then(r => r.json()).then(j => { setD(j); }).catch(() => setD({ error: 'No se pudo cargar la torre' }));
  useEffect(() => { cargar(); const t = setInterval(cargar, 20000); return () => clearInterval(t); }, []);
  const TIPOS: [string, string, (x: Item) => boolean][] = [
    ['todo', 'Todo', () => true],
    ['aprobar', 'Aprobar mensajes', x => x.tipo === 'envio' || x.tipo === 'revision'],
    ['reenganche', 'Reenganche', x => x.tipo === 'envio' && x.datos?.origen === 'reenganche'],
    ['reactivacion', 'Reactivación', x => x.tipo === 'reactivacion' || (x.tipo === 'envio' && x.datos?.origen === 'reactivacion')],
    ['llamar', 'Llamar', x => x.tipo === 'tarea' && x.datos?.tipo === 'llamada'],
    ['reunion', 'Reunión', x => x.chip === 'Reunión' || x.datos?.tipo === 'cotizar' || x.datos?.payload?.reloj === 'segunda_reunion'],
    ['cotizacion', 'Cotización', x => x.chip === 'Cotización' || String(x.datos?.payload?.reloj || '').startsWith('cot_')],
    ['datos', 'Datos', x => x.tipo === 'tarea' && x.datos?.tipo === 'dato' && !String(x.datos?.payload?.campo_clave || '').startsWith('reunion_') && !String(x.datos?.payload?.campo_clave || '').startsWith('cotizacion_')],
    ['aprendizaje', 'Aprendizaje', x => x.tipo === 'aprendizaje'],
    ['decidir', 'Decidir', x => x.tipo === 'tarea' && x.datos?.tipo === 'veredicto'],
  ];
  const items: Item[] = useMemo(() => {
    const all: Item[] = d?.items || [];
    const ft = TIPOS.find(t => t[0] === fTipo)?.[2] || (() => true);
    return all.filter(x => ft(x) && (fCuando === 'todo' || x.urgencia === fCuando));
  }, [d, fTipo, fCuando]); // eslint-disable-line react-hooks/exhaustive-deps
  const actual: Item | null = useMemo(() => items.find(x => x.key === sel) || items[0] || null, [items, sel]);
  useEffect(() => { if (actual && actual.key !== sel) setSel(actual.key); }, [actual?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const siguiente = (dir = 1) => { if (!actual) return; const i = items.findIndex(x => x.key === actual.key); const n = items[(i + dir + items.length) % items.length]; if (n) setSel(n.key); };
  const listo = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 3500); };
  const tras = (r: any, okTxt: string) => { setOcupado(false); if (r?.error) { listo('No se pudo: ' + r.error, false); return false; } listo(okTxt); const i = items.findIndex(x => x.key === actual?.key); const n = items[i + 1] || items[i - 1]; setSel(n?.key || null); cargar(); return true; };
  const texareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── acciones por tipo ── */
  const accionEnvio = async (e: any, modo: 'aprobar' | 'vetar', mot?: string) => {
    setOcupado(true);
    if (modo === 'vetar') return tras(await postJ('/api/crm/ti/envios', { id: e.id, accion: 'vetar', motivo: mot || 'detenido desde la torre' }), 'Detenido: no se le manda nada.');
    const txt = edit[e.id]; const cambiado = txt != null && txt.trim() !== String(e.mensaje).trim();
    const r = cambiado ? await postJ('/api/crm/ti/envios', { id: e.id, accion: 'editar', mensaje: txt, criterio: criterio[e.id] || undefined, enviar: true }) : await postJ('/api/crm/ti/envios', { id: e.id, accion: 'enviar_ya' });
    return tras(r, cambiado ? 'Tu versión salió y quedó en Aprendizaje.' : 'Aprobado y enviado.');
  };
  const accionRevision = async (f: any, accion: 'aceptar' | 'rechazar', mot?: string) => { setOcupado(true); return tras(await postJ('/api/crm/ti/revision', { accion, id: f.id, texto: edit[f.id] ?? f.propuesta?.texto, motivo: accion === 'rechazar' ? (mot || '') : undefined }), accion === 'aceptar' ? 'Aceptado: ya se ejecuta.' : 'Rechazado: el revisor lo aprende.'); };
  const accionReact = async (x: any, accion: 'aprobar' | 'rechazar', mot?: string) => { setOcupado(true); return tras(await postJ('/api/crm/ti/reactivacion', accion === 'aprobar' ? { accion, id: x.id, mensaje: edit[x.id] ?? x.mensaje } : { accion, id: x.id, motivo: mot }), accion === 'aprobar' ? 'Programado en el siguiente hueco.' : 'Rechazado.'); };
  const accionTarea = async (t: any, accion: 'hecha' | 'posponer' | 'omitir', extra: any = {}) => { setOcupado(true); return tras(await postJ('/api/crm/ti/tarea', { id: t.id, accion, ...extra }), accion === 'hecha' ? 'Hecho.' : accion === 'posponer' ? 'Pospuesto a mañana.' : 'Omitido.'); };

  /* ── teclado (escritorio): J/K moverse · A aprobar · E editar · V detener ── */
  useEffect(() => {
    if (movil) return;
    const h = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (ev.key === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); siguiente(1); }
      if (ev.key === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); siguiente(-1); }
      if (ev.key === 'e') { ev.preventDefault(); texareaRef.current?.focus(); }
      if (ev.key === 'a' && actual && !ocupado) { ev.preventDefault(); if (actual.tipo === 'envio') accionEnvio(actual.datos, 'aprobar'); else if (actual.tipo === 'revision') accionRevision(actual.datos, 'aceptar'); else if (actual.tipo === 'reactivacion') accionReact(actual.datos, 'aprobar'); }
      if (ev.key === 'v' && actual && actual.tipo === 'envio') { ev.preventDefault(); setMotivo({ key: actual.key, sel: '', texto: '' }); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const p = d?.pulsos || {};
  const pulso = (k: string, l: string, v: any, sub?: string, tab?: string) => (
    <button key={k} onClick={() => tab ? irA?.(tab) : setFiltro(filtro === k ? 'todo' : k)} className={'tc-pulso' + (filtro === k ? ' on' : '')}><b>{v}</b><span>{l}</span>{sub && <small>{sub}</small>}</button>
  );
  const NIV: Record<string, string> = d?.niveles || {};
  const grupos = [1, 2, 3, 4, 5, 6, 7].map(n => ({ u: String(n), xs: items.filter(x => x.nivel === n) })).filter(g => g.xs.length);
  const chipStyle = (c: string) => ({ background: CHIP_COLOR[c]?.bg || '#f3f4f6', color: CHIP_COLOR[c]?.fg || '#4a4658' });

  /* ── la tarjeta de acción: cuatro preguntas ── */
  const Tarjeta = ({ it }: { it: Item }) => {
    const L = it.lead; const x = it.datos; const key = it.key;
    const cab = (
      <>
        <div className="tc-cab"><span className="tc-chip" style={chipStyle(it.chip)}>{it.chip}</span><span className="tc-urg">{URG[it.urgencia]}{it.cuando ? ` · ${it.urgencia === 'semana' ? fechaCorta(it.cuando) : hora(it.cuando)}` : ''}</span>{!movil && <span className="tc-teclas">J / K siguiente · A aprobar · E editar · V detener</span>}</div>
        <h3 className="tc-nombre">{L.nombre}{L.empresa ? <span> · {L.empresa}</span> : null}</h3>
        <div className="tc-kv">{L.giro && <span>{L.giro}</span>}{L.canal && <span>{L.canal}</span>}{L.etapa && <span>{ETAPA[L.etapa] || L.etapa}</span>}{L.telefono && <span>{L.telefono}</span>}</div>
      </>
    );
    if (it.tipo === 'envio') {
      const s = x.salida || {}; const txt = edit[x.id] ?? x.mensaje; const cambiado = txt.trim() !== String(x.mensaje).trim();
      const ult = Array.isArray(s.ultimos_mensajes) && s.ultimos_mensajes.length ? s.ultimos_mensajes : null;
      return (<div className="tc-tarjeta">{cab}
        <div className="tc-bloque"><div className="tc-lbl">Qué pasó</div><div className="tc-txt">{ult ? <>El lead dijo: {ult.map((m: string, i: number) => <div key={i}>«{m}»</div>)}</> : s.lead_dijo ? <>El lead dijo: «{s.lead_dijo}»</> : (s.objetivo || 'El agente decidió responder.')}{s.estado ? <div className="tc-suave">Etapa que ve el agente: {s.estado}</div> : null}</div></div>
        <div className="tc-bloque"><div className="tc-lbl">Qué hago · el agente propone {cambiado && <em>· se guardará tu versión</em>}</div>
          <textarea ref={texareaRef} className="tc-ta" rows={5} value={txt} onChange={ev => setEdit({ ...edit, [x.id]: ev.target.value })} />
          {cambiado && <input className="tc-in" placeholder="Criterio para el agente (esto es lo que aprende): «si pregunta precio, primero el dolor…»" value={criterio[x.id] || ''} onChange={ev => setCriterio({ ...criterio, [x.id]: ev.target.value })} />}
          {Array.isArray(x.adjuntos) && x.adjuntos.length > 0 && <div className="tc-suave">Adjuntos: {x.adjuntos.map((a: any) => a.nombre || a.tipo).join(', ')}</div>}
          {x.plantilla && <div className="tc-suave">Sale como plantilla (ventana cerrada): {x.plantilla.marketing || x.plantilla.utility}</div>}
        </div>
        {motivo?.key === key ? (
          <div className="tc-bloque"><div className="tc-lbl">Por qué lo detienes (lo aprende)</div><div className="tc-chips">{MOTIVOS_VETO.map(m => <button key={m} className={'tc-mchip' + (motivo!.sel === m ? ' on' : '')} onClick={() => setMotivo({ ...motivo!, sel: m })}>{m}</button>)}</div><input className="tc-in" placeholder="Detalle (opcional)" value={motivo!.texto} onChange={ev => setMotivo({ ...motivo!, texto: ev.target.value })} />
            <div className="tc-btns"><button className="tc-btn peligro" disabled={!motivo!.sel || ocupado} onClick={() => { const m = [motivo!.sel, motivo!.texto].filter(Boolean).join(': '); setMotivo(null); accionEnvio(x, 'vetar', m); }}>Detener</button><button className="tc-btn" onClick={() => setMotivo(null)}>Cancelar</button></div></div>
        ) : (
          <div className="tc-btns"><button className="tc-btn p" disabled={ocupado} onClick={() => accionEnvio(x, 'aprobar')}>{cambiado ? 'Aprobar mi versión' : 'Aprobar y enviar'}</button><button className="tc-btn" onClick={() => texareaRef.current?.focus()}>Editar</button><button className="tc-btn" onClick={() => setMotivo({ key, sel: '', texto: '' })}>Detener…</button></div>
        )}
        <div className="tc-despues"><b>Después:</b> {x.plantilla ? 'sale como plantilla' : 'sale por texto'} {x.sale_at ? `(${fechaCorta(x.sale_at)} ${hora(x.sale_at)})` : ''}; si no contesta, el agente hace su siguiente intento en otra franja. Tu decisión queda en Aprendizaje.</div>
      </div>);
    }
    if (it.tipo === 'revision') {
      const pr = x.propuesta || {}; const conTexto = ['mensaje_extra', 'adjunto', 'plantilla'].includes(pr.tipo); const txt = edit[x.id] ?? pr.texto ?? '';
      return (<div className="tc-tarjeta">{cab}
        <div className="tc-bloque"><div className="tc-lbl">Qué pasó · {x.avance === 'avanzo' ? 'avanzó' : x.avance === 'retrocedio' ? 'retrocedió' : 'igual'}</div><div className="tc-txt">{x.resumen}{x.que_funciono ? <div className="tc-suave">Funcionó: {x.que_funciono}</div> : null}{Array.isArray(x.preguntas_abiertas) && x.preguntas_abiertas.length ? <div className="tc-suave">Abiertas: {x.preguntas_abiertas.join(' · ')}</div> : null}</div></div>
        <div className="tc-bloque"><div className="tc-lbl">Qué hago · {pr.tipo?.replace('_', ' ')} · riesgo {x.riesgo || 'medio'}</div><div className="tc-txt" style={{ borderColor: '#5B4BD6' }}>{pr.fundamento}</div>{conTexto && <textarea ref={texareaRef} className="tc-ta" rows={4} value={txt} onChange={ev => setEdit({ ...edit, [x.id]: ev.target.value })} />}</div>
        {motivo?.key === key ? (
          <div className="tc-bloque"><div className="tc-lbl">Por qué no (lo aprende)</div><input className="tc-in" autoFocus placeholder="Una línea" value={motivo!.texto} onChange={ev => setMotivo({ ...motivo!, texto: ev.target.value })} /><div className="tc-btns"><button className="tc-btn peligro" disabled={!motivo!.texto || ocupado} onClick={() => { const m = motivo!.texto; setMotivo(null); accionRevision(x, 'rechazar', m); }}>Rechazar</button><button className="tc-btn" onClick={() => setMotivo(null)}>Cancelar</button></div></div>
        ) : (<div className="tc-btns"><button className="tc-btn p" disabled={ocupado} onClick={() => accionRevision(x, 'aceptar')}>Aceptar y ejecutar</button><button className="tc-btn" onClick={() => setMotivo({ key, sel: '', texto: '' })}>Rechazar…</button></div>)}
        <div className="tc-despues"><b>Después:</b> {pr.tipo === 'descalificar' ? 'el lead pasa a descalificado y a la cadencia mecánica.' : pr.tipo === 'llamada' ? 'aparece la llamada en tu cola de hoy.' : 'el mensaje se programa y sale con ventana de veto.'} Cada aceptación suma a la rampa de la Revisión.</div>
      </div>);
    }
    if (it.tipo === 'reactivacion') {
      const txt = edit[x.id] ?? x.mensaje; const cambiado = txt.trim() !== String(x.mensaje_original || x.mensaje).trim();
      return (<div className="tc-tarjeta">{cab}
        <div className="tc-bloque"><div className="tc-lbl">Qué pasó · hace {x.meses_sin_hablar} meses</div><div className="tc-txt">{x.pregunta_original ? <>Preguntó: «{x.pregunta_original}»<br /></> : null}{x.resumen_lead}{x.angulo ? <div className="tc-suave">Palanca: {x.angulo}{x.por_que ? ` · ${x.por_que}` : ''}</div> : null}</div></div>
        <div className="tc-bloque"><div className="tc-lbl">Qué hago · primer contacto {cambiado && <em>· tu versión</em>}</div><div className="tc-suave">Hola {(L.nombre || '').split(' ')[0] || 'qué tal'},</div><textarea ref={texareaRef} className="tc-ta" rows={5} value={txt} onChange={ev => setEdit({ ...edit, [x.id]: ev.target.value })} /><div className="tc-suave">La plantilla cierra sola con la invitación a 15 minutos y la salida amable.</div></div>
        {motivo?.key === key ? (
          <div className="tc-bloque"><div className="tc-chips">{MOTIVOS_REACT.map(m => <button key={m} className="tc-mchip" disabled={ocupado} onClick={() => { setMotivo(null); accionReact(x, 'rechazar', m); }}>{m}</button>)}<button className="tc-mchip" onClick={() => setMotivo(null)}>Cancelar</button></div></div>
        ) : (<div className="tc-btns"><button className="tc-btn p" disabled={ocupado} onClick={() => accionReact(x, 'aprobar')}>{cambiado ? 'Aprobar mi versión' : 'Aprobar y programar'}</button><button className="tc-btn" onClick={() => setMotivo({ key, sel: '', texto: '' })}>Rechazar…</button></div>)}
        <div className="tc-despues"><b>Después:</b> sale en el siguiente hueco (máx. 15 al día, horas distintas). Si contesta, entra al ciclo normal del agente.</div>
      </div>);
    }
    if (it.tipo === 'aprendizaje') {
      const txt = edit[x.id] ?? (x.pulida || x.respuesta || ''); const cambiado = txt.trim() !== String(x.pulida || x.respuesta || '').trim();
      const decidir = async (decision: 'aprobar' | 'rechazar') => { setOcupado(true); return tras(await postJ('/api/crm/ti/aprendizaje', { accion: 'ejemplo', id: x.id, decision, pulida: decision === 'aprobar' ? txt : undefined, criterio: criterio[x.id] || undefined }), decision === 'aprobar' ? 'Aprobado: el agente lo usa desde el siguiente mensaje.' : 'Rechazado: no lo repite.'); };
      return (<div className="tc-tarjeta">{cab}
        <div className="tc-bloque"><div className="tc-lbl">Qué pasó · {x.fuente || 'respuesta'}</div><div className="tc-txt">{x.situacion || 'El agente no está seguro de haber respondido bien.'}</div></div>
        <div className="tc-bloque"><div className="tc-lbl">Qué hago · la respuesta que quedó {cambiado && <em>· se guardará tu versión</em>}</div><textarea ref={texareaRef} className="tc-ta" rows={5} value={txt} onChange={ev => setEdit({ ...edit, [x.id]: ev.target.value })} /><input className="tc-in" placeholder="Criterio para el agente (lo que aprende): «cuando pregunte X, primero Y»" value={criterio[x.id] || ''} onChange={ev => setCriterio({ ...criterio, [x.id]: ev.target.value })} /></div>
        <div className="tc-btns"><button className="tc-btn p" disabled={ocupado} onClick={() => decidir('aprobar')}>{cambiado ? 'Aprobar mi versión' : 'Aprobar'}</button><button className="tc-btn" disabled={ocupado} onClick={() => decidir('rechazar')}>Rechazar</button></div>
        <div className="tc-despues"><b>Después:</b> lo aprobado entra a la biblioteca de ejemplos que el agente lee en cada respuesta; lo rechazado se guarda como lo que evita.</div>
      </div>);
    }
    // tarea
    const pl = x.payload || {}; const resultados: Record<string, string> = pl.resultados || {};
    const esDato = x.tipo === 'dato'; const opciones: string[] | null = Array.isArray(pl.opciones) ? pl.opciones : null;
    const v = valor[x.id] ?? (pl.fuente ? String(pl.valor || '') : '');
    return (<div className="tc-tarjeta">{cab}
      <div className="tc-bloque"><div className="tc-lbl">Qué pasó</div><div className="tc-txt">{pl.porque || it.resumen || '—'}{Array.isArray(pl.hechos) && pl.hechos.length ? <div className="tc-hechos">{pl.hechos.map((h: any, i: number) => <span key={i} className={'tc-hecho ' + (h[3] || '')}><b>{h[1]}</b> {h[0]}{h[2] ? ` · ${h[2]}` : ''}</span>)}</div> : null}{Array.isArray(pl.evidencia) && pl.evidencia.length ? <ul className="tc-ev">{pl.evidencia.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul> : null}</div></div>
      <div className="tc-bloque"><div className="tc-lbl">Qué hago</div>
        {pl.minuta_ia ? <button className="tc-btn p" onClick={() => setMinutaDe(x)}>Abrir la minuta con IA: pega la transcripción o tus notas</button>
        : esDato ? (opciones ? <div className="tc-chips">{opciones.map(o => <button key={o} className={'tc-mchip' + (v === o ? ' on' : '')} onClick={() => setValor({ ...valor, [x.id]: o })}>{(pl.opciones_l || {})[o] || o}</button>)}</div> : pl.multilinea ? <textarea ref={texareaRef} className="tc-ta" rows={4} placeholder={pl.input || pl.campo} value={v} onChange={ev => setValor({ ...valor, [x.id]: ev.target.value })} /> : <input className="tc-in" placeholder={pl.input || pl.campo} value={v} onChange={ev => setValor({ ...valor, [x.id]: ev.target.value })} />)
        : Object.keys(resultados).length ? <div className="tc-chips">{Object.entries(resultados).map(([k, l]) => <button key={k} className={'tc-mchip' + (valor[x.id] === k ? ' on' : '')} onClick={() => setValor({ ...valor, [x.id]: k })}>{l as string}</button>)}</div>
        : pl.mensaje ? <textarea ref={texareaRef} className="tc-ta" rows={4} value={edit[x.id] ?? pl.mensaje} onChange={ev => setEdit({ ...edit, [x.id]: ev.target.value })} /> : null}
        {(x.tipo === 'llamada' || x.tipo === 'veredicto') && <input className="tc-in" placeholder="Nota rápida (opcional)" value={nota[x.id] || ''} onChange={ev => setNota({ ...nota, [x.id]: ev.target.value })} />}
        {x.tipo === 'llamada' && L.telefono && <a className="tc-tel" href={`tel:${String(L.telefono).replace(/[^\d+]/g, '')}`}>Llamar al {L.telefono}</a>}
      </div>
      {!pl.minuta_ia && (<div className="tc-btns">
        {esDato ? <button className="tc-btn p" disabled={ocupado || !(v || pl.valor)} onClick={() => accionTarea(x, 'hecha', { detalle: { campo: pl.campo, valor: v || pl.valor } })}>{pl.fuente ? 'Confirmar y guardar' : 'Guardar'}</button>
        : Object.keys(resultados).length ? <button className="tc-btn p" disabled={ocupado || !valor[x.id]} onClick={() => accionTarea(x, 'hecha', { resultado: valor[x.id], texto: nota[x.id] || undefined })}>Registrar</button>
        : <button className="tc-btn p" disabled={ocupado} onClick={() => accionTarea(x, 'hecha', { resultado: 'hecha', texto: nota[x.id] || undefined })}>Hecho</button>}
        <button className="tc-btn" disabled={ocupado} onClick={() => accionTarea(x, 'posponer', { horas: 24 })}>Mañana</button>
        <button className="tc-btn" disabled={ocupado} onClick={() => { const m = prompt('¿Por qué se omite? (queda en el log)'); if (m) accionTarea(x, 'omitir', { motivo: m }); }}>Omitir…</button>
      </div>)}
      <div className="tc-despues"><b>Después:</b> {x.tipo === 'llamada' ? 'el resultado decide la siguiente tarea; si agenda, el agente se retira.' : esDato ? 'el dato se escribe en el CRM y la cadena avanza al siguiente eslabón.' : x.tipo === 'veredicto' ? 'tu veredicto entrena la rampa; si no decides en 48 h se aplica la propuesta.' : 'la tarea se cierra y no vuelve a aparecer.'}</div>
    </div>);
  };

  const Cola = () => (
    <div className="tc-cola">
      {!items.length && <div className="tc-vacio"><b>Nada pendiente</b><p>Cuando el agente proponga un mensaje, la revisión sugiera algo o una reunión necesite resultado, aparece aquí.</p></div>}
      {grupos.map(g => (<div key={g.u}><div className="tc-grp">{g.u}. {NIV[g.u] || URG[g.u] || g.u} · {g.xs.length}</div>
        {g.xs.map(x => <button key={x.key} className={'tc-item' + (actual?.key === x.key ? ' on' : '')} onClick={() => { setSel(x.key); setVistaMovil('accion'); }}><div className="tc-item-n">{x.lead.nombre}{x.lead.empresa ? <span> · {x.lead.empresa}</span> : null}</div><div className="tc-item-m"><span className="tc-chip chico" style={chipStyle(x.chip)}>{x.chip}</span> {x.tipo === 'envio' && x.cuando ? `sale ${hora(x.cuando)}` : x.titulo.slice(0, 60)}</div></button>)}
      </div>))}
    </div>
  );

  if (!d) return <div className="tc-cargando">Cargando la torre…</div>;
  if (d.error) return <div className="tc-cargando">{d.error}</div>;
  return (
    <div className={'tc' + (movil ? ' movil' : '')}>
      <div className="tc-pulsos">
        <button className={'tc-pulso' + (verSenales ? ' on' : '')} onClick={() => setVerSenales(v => !v)}><b>{p.senales || 0}</b><span>Señales hoy</span></button>
        {pulso('aprobar', 'Por aprobar', p.por_aprobar || 0)}{pulso('llamar', 'Llamadas', p.llamadas || 0)}{pulso('reunion', 'Reunión sin resultado', p.reunion || 0)}{pulso('cotizacion', 'Cotizaciones', p.cotizaciones || 0)}{pulso('datos', 'Datos faltantes', p.datos || 0)}{pulso('aprendizaje', 'Aprendizaje', p.aprendizaje || 0)}
        <div className={'tc-pulso agente ' + (p.agente?.activo ? (p.agente.vivo ? 'ok' : 'warn') : 'off')}><b>{p.agente?.activo ? (p.agente.modo === 'vivo' ? 'Activo' : 'Sombra') : 'Apagado'}</b><span>Agente · {p.agente?.latido_hace_min == null ? 'sin latido' : p.agente.latido_hace_min <= 5 ? 'al día' : `latido hace ${p.agente.latido_hace_min} min`}</span></div>
      </div>
      {msg && <div className={'tc-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
      {movil && verSenales && <div className="tc-col" style={{ marginBottom: 10 }}><div className="tc-col-h">Señales de hoy<button className="tc-link" onClick={() => setVerSenales(false)}>cerrar</button></div><FeedSenales senales={d.senales || []} onIr={() => {}} /></div>}
      {movil ? (
        vistaMovil === 'cola' || !actual ? <Cola /> : (
          <div className="tc-accion-movil">
            <div className="tc-mov-cab"><button className="tc-link" onClick={() => setVistaMovil('cola')}>‹ Cola</button><span className="tc-suave">{items.findIndex(x => x.key === actual.key) + 1} de {items.length}</span><button className="tc-link" onClick={() => siguiente(1)}>Siguiente ›</button></div>
            <Tarjeta it={actual} />
            <button className="tc-btn ancho" onClick={() => setCtxAbierto(true)}>Ver conversación y ficha</button>
            <ContextoLead contactId={actual.contact_id} open={ctxAbierto} onClose={() => setCtxAbierto(false)} />
          </div>
        )
      ) : (
        <div className="tc-cols">
          <aside className="tc-col">
            <div className="tc-selects">
              <select value={fTipo} onChange={e => setFTipo(e.target.value)}>{TIPOS.map(([k, l, fn]) => <option key={k} value={k}>{l}{k !== 'todo' ? ` · ${(d?.items || []).filter(fn).length}` : ''}</option>)}</select>
              <select value={fCuando} onChange={e => setFCuando(e.target.value)}><option value="todo">Cuándo: todo</option><option value="ahora">Ahora</option><option value="hoy">Hoy</option><option value="semana">Esta semana</option></select>
            </div>
            <div className="tc-selects sub">
              {fTipo === 'datos' && <select value={agrupar} onChange={e => setAgrupar(e.target.value as any)}><option value="lead">Agrupar: por dato</option><option value="cliente">Agrupar: por cliente</option></select>}
              <span className="tc-cuenta">{items.length} pendiente{items.length === 1 ? '' : 's'}</span>
            </div>
            <Cola />
          </aside>
          <main className="tc-col centro">{fTipo === 'datos' && agrupar === 'cliente'
            ? <TrabajoDatos datos={items.map(x => x.datos)} guardando={ocupado} error="" onRecargar={cargar}
                onGuardar={async (x: any, valor: any) => { setOcupado(true); const r = await postJ('/api/crm/ti/tarea', { id: x.id, accion: 'hecha', detalle: { campo: x.payload?.campo || x.payload?.campo_clave, valor } }); setOcupado(false); if (r?.error) { listo('No se pudo: ' + r.error, false); return false; } cargar(); return true; }}
                onPosponer={async (x: any) => { await postJ('/api/crm/ti/tarea', { id: x.id, accion: 'posponer', horas: 24 }); cargar(); }} />
            : actual ? <Tarjeta it={actual} /> : <div className="tc-vacio"><b>Sin nada que decidir</b><p>Elige un tipo o espera a que el agente proponga.</p></div>}</main>
          <aside className="tc-col ctx">{verSenales ? <><div className="tc-col-h">Señales de hoy · solo lectura<button className="tc-link" onClick={() => setVerSenales(false)}>volver al contexto</button></div><FeedSenales senales={d.senales || []} onIr={(cid: string) => { const it = items.find(x => x.contact_id === cid); if (it) setSel(it.key); }} /></> : <><div className="tc-col-h">Contexto</div>{actual?.contact_id ? <ContextoLead key={actual.contact_id} inline contactId={actual.contact_id} open onClose={() => {}} /> : <div className="tc-vacio"><p>Sin contacto ligado.</p></div>}</>}</aside>
        </div>
      )}
      {minutaDe && <MinutaLead reunion={{ id: minutaDe.payload?.reunion?.id || minutaDe.payload?.sujeto, fecha: minutaDe.payload?.reunion?.fecha, event_types: { nombre: 'Demo' } }} lead={minutaDe.payload?.lead || {}} onClose={() => setMinutaDe(null)} onGuardado={async () => { const x = minutaDe; setMinutaDe(null); await postJ('/api/crm/ti/tarea', { id: x.id, accion: 'hecha', detalle: { campo: 'minuta', ya_escrito: true } }); listo('Minuta guardada y aplicada.'); cargar(); }} />}
      <style>{`
        .tc{--acc:#5B4BD6;--accs:#EEECFE;--ink:#241d43;--mute:#8e88a8;--line:#e8e5f0;color:var(--ink);font-family:inherit}
        .tc-pulsos{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px}
        .tc-pulso{flex-shrink:0;min-width:118px;text-align:left;border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px 12px;cursor:pointer;font-family:inherit;color:var(--ink)}
        .tc-pulso b{display:block;font-size:20px;line-height:1.1}.tc-pulso span{display:block;font-size:10.5px;color:var(--mute);font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
        .tc-pulso.on{border-color:var(--acc);background:var(--accs)}.tc-pulso.agente.ok b{color:#14532d}.tc-pulso.agente.warn b{color:#b45309}.tc-pulso.agente.off b{color:#7f1d1d}
        .tc-cols{display:grid;grid-template-columns:280px minmax(0,1fr) 360px;gap:12px;height:calc(100vh - 230px);min-height:520px}
        .tc-col{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
        .tc-col-h{padding:10px 14px;border-bottom:1px solid #f0eef6;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mute);display:flex;justify-content:space-between;align-items:center}
        .tc-selects{display:flex;gap:6px;padding:10px 10px 0}.tc-selects.sub{padding:6px 10px 4px;align-items:center;justify-content:space-between}.tc-selects select{flex:1;min-width:0;border:1px solid var(--line);border-radius:9px;padding:7px 8px;font-family:inherit;font-size:12px;font-weight:700;color:var(--ink);background:#fff}.tc-cuenta{font-size:11px;color:var(--mute);font-weight:800;margin-left:auto}
        .tc-cola{overflow-y:auto;padding:8px;flex:1}.tc-grp{font-size:10px;font-weight:800;color:var(--mute);letter-spacing:.06em;text-transform:uppercase;margin:8px 4px 6px}
        .tc-item{display:block;width:100%;text-align:left;border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;margin-bottom:6px;cursor:pointer;font-family:inherit;color:var(--ink)}
        .tc-item.on{border-color:var(--acc);background:var(--accs)}.tc-item-n{font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tc-item-n span{font-weight:600;color:#6b6580}.tc-item-m{font-size:11.5px;color:var(--mute);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tc-chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800}.tc-chip.chico{font-size:10px;padding:1px 7px}
        .tc-col.centro{overflow-y:auto;padding:18px 20px}.tc-col.ctx{padding:0}
        .tc-tarjeta{max-width:760px}.tc-cab{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tc-urg{font-size:11.5px;color:var(--mute);font-weight:700}.tc-teclas{margin-left:auto;font-size:10.5px;color:var(--mute)}
        .tc-nombre{margin:8px 0 2px;font-size:21px;font-weight:800;letter-spacing:-.01em}.tc-nombre span{font-weight:600;color:#6b6580}
        .tc-kv{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:#6b6580}
        .tc-bloque{margin-top:14px}.tc-lbl{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mute);margin-bottom:5px}.tc-lbl em{font-style:normal;color:#b45309;text-transform:none;letter-spacing:0}
        .tc-txt{background:#faf9fc;border:1px solid #ecebf2;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}.tc-suave{font-size:11.5px;color:var(--mute);margin-top:6px}
        .tc-ta{width:100%;box-sizing:border-box;border:1px solid var(--acc);border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.5;font-family:inherit;margin-top:6px;resize:vertical}
        .tc-in{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:13px;font-family:inherit;margin-top:6px}
        .tc-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.tc-btn{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}.tc-btn.p{background:var(--acc);border-color:var(--acc);color:#fff}.tc-btn.peligro{border-color:#fecdd3;color:#b91c1c}.tc-btn:disabled{opacity:.5;cursor:default}.tc-btn.ancho{width:100%;margin-top:12px}
        .tc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.tc-mchip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--ink)}.tc-mchip.on{border-color:var(--acc);background:var(--accs);color:#4c1d95}
        .tc-despues{margin-top:14px;font-size:12.5px;color:#6b6580;border-left:3px solid var(--acc);padding-left:10px;line-height:1.5}
        .tc-hechos{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.tc-hecho{font-size:11.5px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:3px 8px}.tc-hecho.rojo{border-color:#fecdd3;color:#7f1d1d}.tc-hecho.ambar{border-color:#fde68a;color:#78350f}
        .tc-ev{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:#6b6580}.tc-tel{display:inline-block;margin-top:8px;font-weight:800;color:var(--acc);text-decoration:none}
        .tc-vacio{padding:30px 16px;text-align:center;color:var(--mute);font-size:13px}.tc-vacio b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
        .tc-msg{margin:0 0 10px;padding:8px 12px;border-radius:10px;font-size:12.5px;font-weight:700}.tc-msg.ok{background:#e7f7ee;color:#14532d}.tc-msg.err{background:#fde7e5;color:#b3261e}
        .tc-link{border:none;background:transparent;color:var(--acc);font-weight:800;cursor:pointer;font-family:inherit;font-size:12px}
        .tc-cargando{padding:30px;color:var(--mute)}
        .tc.movil .tc-cola{padding:0}.tc.movil .tc-item{padding:12px}.tc-accion-movil{padding-bottom:80px}.tc-mov-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .tc.movil .tc-btns{position:sticky;bottom:0;background:#fff;padding:10px 0;margin-top:14px;border-top:1px solid var(--line)}.tc.movil .tc-btn{flex:1;min-height:44px}.tc.movil .tc-mchip{min-height:40px}
        @media (max-width:1240px){.tc-cols{grid-template-columns:250px minmax(0,1fr) 320px}}
      `}</style>
    </div>
  );
}
