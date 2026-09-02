import { useEffect, useMemo, useState } from 'react';
import { ESTILOS_ENVIOS } from './TrabajoEnvios';
import { SelectorAdjuntos, MiniRecurso, type Recurso, type AdjuntoSel } from './RecursosAgente';

/* ═══ Aprendizaje del agente ═══
 * POR REVISAR se recorre de UNO EN UNO, en cinco pasos numerados (qué dijo el lead → la
 * respuesta → la regla detrás → adjuntos → tu decisión): el consultor avanza en orden y
 * no se pierde entre 120 tarjetas. APROBADO es una lista compacta que se abre a la misma
 * ficha para editar. Cada cambio vuelve al prompt del agente en el siguiente turno. */
type Ej = { id: string; estado: string; giro?: string | null; situacion: string; mensaje_lead?: string | null; respuesta?: string | null; pulida?: string | null; por_que?: string | null; fuente: string; imagen_id?: string | null; adjuntos?: AdjuntoSel[]; estado_rev: string; usos?: number; created_at: string; criterio: string; contacto?: { nombre?: string | null; giro?: string | null } | null };
type Env = { id: string; contact_id: string | null; origen: string; mensaje: string; mensaje_original?: string | null; salida: any; enviado_at?: string | null; imagen_id?: string | null; imagen_url?: string | null; adjuntos?: AdjuntoSel[]; humano_respuesta?: string | null; humano_at?: string | null; contacto?: { nombre?: string | null } | null };
type Item = { clave: string; tipo: 'ejemplo' | 'envio' | 'par'; ej?: Ej; env?: Env };

const ESTADO_L: Record<string, string> = { nuevo: 'Nuevo', descubriendo: 'Descubriendo', proponiendo: 'Proponiendo', agendada: 'Agendada', confirmando: 'Confirmando', no_show: 'No-show', reunion_hecha: 'Reunión hecha', silencio: 'Silencio', descalificado: 'Descalificado', humano: 'Humano' };
const FUENTE_L: Record<string, string> = { convirtio: 'Conversación que convirtió', correccion_dueno: 'Tu corrección', correccion_implicita: 'Corrección implícita', humano_antes: 'El consultor contestó antes' };
const fecha = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const post = (body: any) => fetch('/api/crm/ti/aprendizaje', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(e => ({ error: String(e) }));

const ESTILOS = `
.apr { max-width: 940px; margin: 0 auto; }
.apr-cab { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
.apr-seg { display:inline-flex; background:#f1eff8; border-radius:12px; padding:4px; gap:4px; }
.apr-seg button { border:none; background:none; font:inherit; font-weight:700; font-size:.86rem; padding:8px 14px; border-radius:9px; cursor:pointer; color:#6b6580; display:flex; gap:8px; align-items:center; }
.apr-seg button.on { background:#fff; color:#241d43; box-shadow:0 1px 4px rgba(16,24,40,.08); }
.apr-seg b { background:#5B4BD6; color:#fff; border-radius:20px; padding:1px 8px; font-size:.7rem; }
.apr-seg button:not(.on) b { background:#d9d4ea; color:#4a4658; }
.apr-prog { height:6px; background:#ece9f5; border-radius:6px; overflow:hidden; margin:8px 0 14px; }
.apr-prog i { display:block; height:100%; background:linear-gradient(90deg,#5B4BD6,#9B8CFA); border-radius:6px; transition:width .3s ease; }
.apr-nav { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 10px; }
.apr-nav .pos { font-size:.82rem; color:#6b6580; font-variant-numeric:tabular-nums; }
.apr-nav .btns { display:flex; gap:6px; }
.apr-ficha { background:#fff; border:1px solid #e7e3f1; border-radius:16px; box-shadow:0 8px 30px rgba(36,29,67,.06); overflow:hidden; }
.apr-ficha-cab { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:14px 18px; border-bottom:1px solid #f1eff8; background:#fbfaff; }
.apr-ficha-cab b { font-size:1.02rem; letter-spacing:-.01em; margin-right:4px; }
.apr-paso { display:grid; grid-template-columns:44px 1fr; gap:0 14px; padding:16px 18px; border-bottom:1px solid #f3f1f8; }
.apr-paso:last-child { border-bottom:none; }
.apr-num { width:30px; height:30px; border-radius:50%; background:#EEECFE; color:#4c1d95; font-weight:800; font-size:.85rem; display:flex; align-items:center; justify-content:center; }
.apr-paso h4 { margin:5px 0 8px; font-size:.7rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:#6b6580; }
.apr-lead { background:#f6f5fa; border-radius:12px; padding:10px 14px; font-size:.93rem; line-height:1.5; }
.apr-lead ol { margin:0; padding-left:20px; display:grid; gap:5px; }
.apr-ctx { margin-top:8px; font-size:.82rem; color:#71707C; font-style:italic; }
.apr-ficha textarea.ti-envio-texto { width:100%; box-sizing:border-box; }
.apr-orig { margin-top:8px; font-size:.8rem; color:#6b6580; } .apr-orig summary { cursor:pointer; font-weight:700; } .apr-orig div { margin-top:6px; white-space:pre-wrap; background:#fbfaff; border-radius:10px; padding:8px 12px; }
.apr-dec { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.apr-ok { margin-top:8px; font-size:.84rem; font-weight:700; color:#14532d; } .apr-err { margin-top:8px; font-size:.84rem; font-weight:700; color:#7f1d1d; }
.apr-lista { display:grid; gap:8px; }
.apr-fila { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; background:#fff; border:1px solid #e7e3f1; border-radius:12px; padding:10px 14px; cursor:pointer; }
.apr-fila:hover { border-color:#c9c1ea; }
.apr-fila .txt { font-size:.86rem; color:#241d43; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.apr-fila .meta { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:3px; }
.apr-vacio { text-align:center; padding:48px 20px; color:#6b6580; }
.apr-par { display:grid; grid-template-columns:1fr 1fr; gap:10px; } @media (max-width:720px) { .apr-par { grid-template-columns:1fr; } .apr-paso { grid-template-columns:34px 1fr; padding:14px 12px; } }
`;

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return <div className="apr-paso"><div className="apr-num">{n}</div><div style={{ minWidth: 0 }}><h4>{titulo}</h4>{children}</div></div>;
}

function LeadDijo({ texto, contexto }: { texto?: string | null; contexto?: string | null }) {
  if (!texto && !contexto) return null;
  const partes = String(texto || '').split(' ⏎ ').filter(Boolean);
  return (
    <>
      {partes.length > 1 ? <div className="apr-lead"><div style={{ fontSize: '.7rem', fontWeight: 800, color: '#6b6580', marginBottom: 6 }}>{partes.length} MENSAJES SEGUIDOS</div><ol>{partes.map((t, i) => <li key={i}>{t}</li>)}</ol></div>
        : texto ? <div className="apr-lead">{texto}</div> : null}
      {contexto && <div className="apr-ctx">Qué buscaba el agente: {contexto}</div>}
    </>
  );
}

/* La ficha de revisión: cinco pasos, mismos para un ejemplo y para un mensaje del agente. */
function Ficha({ titulo, chips, leadDijo, contexto, original, textoInicial, criterioInicial, adjuntosInicial, galeria, onNuevo, acciones, onHecho }: {
  titulo: string; chips: string[]; leadDijo?: string | null; contexto?: string | null; original?: string | null; textoInicial: string; criterioInicial: string; adjuntosInicial: AdjuntoSel[]; galeria: Recurso[]; onNuevo: (r: Recurso) => void;
  acciones: { label: string; clase?: string; run: (v: { pulida: string; criterio: string; adjuntos: string[] }) => Promise<any> }[]; onHecho?: () => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [criterio, setCriterio] = useState(criterioInicial);
  const [adjuntos, setAdjuntos] = useState<AdjuntoSel[]>(adjuntosInicial);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setTexto(textoInicial); setCriterio(criterioInicial); setAdjuntos(adjuntosInicial); setMsg(''); }, [textoInicial, criterioInicial, adjuntosInicial.map(a => a.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const editado = texto !== textoInicial;
  return (
    <div className="apr-ficha">
      <div className="apr-ficha-cab"><b>{titulo}</b>{chips.map((c, i) => <span key={i} className="ti-chip chip-tipo">{c}</span>)}</div>
      <Paso n={1} titulo="Qué dijo el lead"><LeadDijo texto={leadDijo} contexto={contexto} /></Paso>
      <Paso n={2} titulo={editado ? 'La respuesta — tu versión' : 'La respuesta'}>
        <textarea className={'ti-envio-texto' + (editado ? ' editado' : '')} rows={Math.min(12, Math.max(4, Math.ceil(texto.length / 90) + 1))} value={texto} onChange={e => setTexto(e.target.value)} />
        {original && original !== textoInicial && <details className="apr-orig"><summary>Ver lo que el agente había propuesto</summary><div>{original}</div></details>}
      </Paso>
      <Paso n={3} titulo="La regla detrás (qué debe considerar el agente)">
        <input className="ti-envio-input" placeholder="Ej.: si hace varias preguntas, contéstalas todas en un solo mensaje y cierra con una sola pregunta" value={criterio} onChange={e => setCriterio(e.target.value)} />
        <div className="ti-suave" style={{ margin: '5px 0 0', fontSize: '.74rem' }}>Opcional, pero es lo que generaliza: el texto es el ejemplo, la regla es lo que el agente aplica a casos parecidos.</div>
      </Paso>
      <Paso n={4} titulo="Adjuntos (imagen, PDF o video · hasta 5)"><SelectorAdjuntos valor={adjuntos} galeria={galeria} onChange={setAdjuntos} onNuevo={onNuevo} /></Paso>
      <Paso n={5} titulo="Tu decisión">
        <div className="apr-dec">
          {acciones.map(a => <button key={a.label} className={'ti-btn ' + (a.clase || '')} disabled={ocupado} onClick={async () => { setOcupado(true); const r = await a.run({ pulida: texto.trim(), criterio: criterio.trim(), adjuntos: adjuntos.map(x => x.id) }); setOcupado(false); if (r?.error) { setMsg('No se guardó: ' + r.error); return; } setMsg(r?.hecho || 'Guardado.'); setTimeout(() => onHecho?.(), 650); }}>{a.label}</button>)}
        </div>
        {msg && <div className={msg.startsWith('No') ? 'apr-err' : 'apr-ok'}>{msg}</div>}
      </Paso>
    </div>
  );
}

export default function TrabajoAprendizaje() {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'revisar' | 'aprobado'>('revisar');
  const [filtro, setFiltro] = useState<'todo' | 'ejemplos' | 'envios' | 'pares'>('todo');
  const [hechos, setHechos] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [abierto, setAbierto] = useState<string | null>(null);
  const cargar = () => fetch('/api/crm/ti/aprendizaje').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  const gal: Recurso[] = d?.galeria || [];
  const addGal = (r: Recurso) => setD((x: any) => ({ ...x, galeria: [r, ...(x.galeria || [])] }));

  const cola: Item[] = useMemo(() => {
    if (!d || d.error) return [];
    const pr = d.por_revisar;
    const items: Item[] = [
      ...((filtro === 'todo' || filtro === 'pares') ? pr.pares.map((e: Env) => ({ clave: 'par:' + e.id, tipo: 'par' as const, env: e })) : []),
      ...((filtro === 'todo' || filtro === 'envios') ? pr.envios_solos.map((e: Env) => ({ clave: 'env:' + e.id, tipo: 'envio' as const, env: e })) : []),
      ...((filtro === 'todo' || filtro === 'ejemplos') ? pr.ejemplos.map((ej: Ej) => ({ clave: 'ej:' + ej.id, tipo: 'ejemplo' as const, ej })) : []),
    ];
    return items.filter(i => !hechos[i.clave]);
  }, [d, filtro, hechos]);
  useEffect(() => { if (idx >= cola.length) setIdx(Math.max(0, cola.length - 1)); }, [cola.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const ap = d.aprobados;
  const nHechos = Object.keys(hechos).length;
  const totalSesion = cola.length + nHechos;
  const actual = cola[idx];
  const avanzar = () => setIdx(i => Math.min(i + 1, Math.max(0, cola.length - 1)));
  const marcar = (clave: string, como: string) => { setHechos(h => ({ ...h, [clave]: como })); };

  const fichaEjemplo = (ej: Ej, aprobado: boolean, onHecho?: () => void) => (
    <Ficha key={ej.id} titulo={ej.contacto?.nombre || 'Ejemplo'} chips={[ESTADO_L[ej.estado] || ej.estado, FUENTE_L[ej.fuente] || ej.fuente, ej.estado_rev === 'dudoso' ? 'dudoso' : '', fecha(ej.created_at)].filter(Boolean)}
      leadDijo={ej.mensaje_lead} contexto={ej.situacion} original={ej.respuesta} textoInicial={ej.pulida || ej.respuesta || ''} criterioInicial={ej.criterio || ''} adjuntosInicial={Array.isArray(ej.adjuntos) ? ej.adjuntos : []} galeria={gal} onNuevo={addGal} onHecho={onHecho}
      acciones={aprobado ? [
        { label: 'Guardar cambios', clase: 'primario', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, ...v }); return r.error ? r : { hecho: 'Guardado: el agente lo usa desde el siguiente turno.' }; } },
        { label: 'Retirar este ejemplo', clase: 'peligro', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, decision: 'rechazar', criterio: v.criterio }); if (!r.error) marcar('ej:' + ej.id, 'retirado'); return r.error ? r : { hecho: 'Retirado.' }; } },
      ] : [
        { label: 'Aprobar', clase: 'primario grande', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, decision: 'aprobar', ...v }); if (!r.error) marcar('ej:' + ej.id, 'aprobado'); return r.error ? r : { hecho: 'Aprobado. Siguiente…' }; } },
        { label: 'Rechazar', clase: 'peligro', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, decision: 'rechazar', criterio: v.criterio }); if (!r.error) marcar('ej:' + ej.id, 'rechazado'); return r.error ? r : { hecho: 'Rechazado. Siguiente…' }; } },
      ]} />
  );
  const fichaEnvio = (e: Env, aprobado: boolean, onHecho?: () => void) => (
    <Ficha key={e.id} titulo={e.contacto?.nombre || 'Lead'} chips={[ESTADO_L[e.salida?.estado] || e.salida?.estado || '', aprobado ? 'aprobado y enviado' : 'salió solo al vencer la ventana', fecha(e.enviado_at)].filter(Boolean)}
      leadDijo={e.salida?.ultimo_mensaje} contexto={e.salida?.objetivo} original={e.mensaje_original || null} textoInicial={e.mensaje} criterioInicial="" galeria={gal} onNuevo={addGal} onHecho={onHecho}
      adjuntosInicial={Array.isArray(e.adjuntos) && e.adjuntos.length ? e.adjuntos : e.imagen_url ? [{ id: e.imagen_id || '', tipo: 'image', url: e.imagen_url, nombre: 'Imagen' }] : []}
      acciones={aprobado ? [
        { label: 'Guardar como ejemplo con mis cambios', clase: 'primario', run: async v => { const r = await post({ accion: 'envio', id: e.id, decision: 'validar', ...v }); return r.error ? r : { hecho: 'Guardado como ejemplo.' }; } },
      ] : [
        { label: 'Estuvo bien: aprobar', clase: 'primario grande', run: async v => { const r = await post({ accion: 'envio', id: e.id, decision: 'validar', ...v }); if (!r.error) marcar('env:' + e.id, 'aprobado'); return r.error ? r : { hecho: 'Aprobado como ejemplo. Siguiente…' }; } },
        { label: 'Descartar (no enseña nada)', run: async () => { const r = await post({ accion: 'envio', id: e.id, decision: 'descartar' }); if (!r.error) marcar('env:' + e.id, 'descartado'); return r.error ? r : { hecho: 'Descartado. Siguiente…' }; } },
      ]} />
  );
  const fichaPar = (e: Env) => (
    <div className="apr-ficha" key={e.id}>
      <div className="apr-ficha-cab"><b>{e.contacto?.nombre || 'Lead'}</b><span className="ti-chip chip-tipo">par agente / consultor</span><span className="ti-chip chip-tipo">{fecha(e.humano_at)}</span></div>
      <Paso n={1} titulo="Qué dijo el lead"><LeadDijo texto={e.salida?.ultimo_mensaje} contexto={e.salida?.objetivo} /></Paso>
      <Paso n={2} titulo="Las dos respuestas">
        <div className="apr-par">
          <div><div className="ti-envio-lbl">El agente iba a decir</div><div className="apr-lead">{e.mensaje}</div></div>
          <div><div className="ti-envio-lbl">El consultor dijo</div><div className="apr-lead">{e.humano_respuesta}</div></div>
        </div>
      </Paso>
      <Paso n={3} titulo="Tu decisión: ¿cuál debe aprender el agente?">
        <div className="apr-dec">
          {[['humano_mejor', 'Mejor el consultor', 'primario'], ['agente_mejor', 'Mejor el agente', ''], ['empate', 'Empate', '']].map(([v, l, c]) => (
            <button key={v} className={'ti-btn ' + c} onClick={async () => { const r = await fetch('/api/crm/ti/envios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, accion: 'par', veredicto: v }) }).then(x => x.json()); if (!r.error) marcar('par:' + e.id, v); }}>{l}</button>
          ))}
        </div>
      </Paso>
    </div>
  );

  return (
    <div className="ti-envios apr">
      <style>{ESTILOS_ENVIOS}{ESTILOS}</style>
      <div className="apr-cab">
        <div>
          <h2 className="ti-h" style={{ margin: 0 }}>Aprendizaje del agente</h2>
          <p className="ti-porque" style={{ margin: '4px 0 0' }}>Revisa de uno en uno: lo que dijo el lead, la respuesta, la regla detrás, los adjuntos y tu decisión. Lo aprobado queda como criterio del agente desde el siguiente turno.</p>
        </div>
        <div className="apr-seg" role="tablist">
          <button role="tab" className={sub === 'revisar' ? 'on' : ''} onClick={() => { setSub('revisar'); setIdx(0); }}>Por revisar <b>{cola.length}</b></button>
          <button role="tab" className={sub === 'aprobado' ? 'on' : ''} onClick={() => setSub('aprobado')}>Aprobado <b>{ap.ejemplos.length + ap.envios.length}</b></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['todo', 'Todo'], ['ejemplos', 'Ejemplos propuestos'], ['envios', 'Mensajes del agente'], ['pares', 'Pares agente/consultor']] as const).map(([v, l]) => (
          <button key={v} className={'ti-chip-btn' + (filtro === v ? ' on' : '')} onClick={() => { setFiltro(v); setIdx(0); }}>{l}</button>
        ))}
        <span className="ti-suave" style={{ margin: '0 0 0 auto', fontSize: '.75rem' }}>rechazados: {d.rechazados}</span>
      </div>

      {sub === 'revisar' && (
        <>
          <div className="apr-prog" title={`${nHechos} revisados en esta sesión`}><i style={{ width: `${totalSesion ? Math.round((nHechos / totalSesion) * 100) : 0}%` }} /></div>
          {!actual ? (
            <div className="apr-vacio"><h2 style={{ margin: '0 0 6px' }}>{nHechos ? `Listo: ${nHechos} revisados` : 'Nada por revisar'}</h2><p>Cuando el ciclo nocturno proponga ejemplos, un mensaje salga sin tu aprobación o el consultor conteste antes que el agente, aparece aquí.</p></div>
          ) : (
            <>
              <div className="apr-nav">
                <span className="pos">{idx + 1} de {cola.length}{nHechos ? ` · ${nHechos} revisados hoy` : ''}</span>
                <div className="btns">
                  <button className="ti-btn" disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))}>← Anterior</button>
                  <button className="ti-btn" disabled={idx >= cola.length - 1} onClick={avanzar}>Saltar por ahora →</button>
                </div>
              </div>
              {actual.tipo === 'par' && fichaPar(actual.env!)}
              {actual.tipo === 'envio' && fichaEnvio(actual.env!, false)}
              {actual.tipo === 'ejemplo' && fichaEjemplo(actual.ej!, false)}
            </>
          )}
        </>
      )}

      {sub === 'aprobado' && (
        <div className="apr-lista" style={{ marginTop: 12 }}>
          {(filtro === 'todo' || filtro === 'envios') && ap.envios.map((e: Env) => abierto === 'env:' + e.id ? <div key={e.id}>{fichaEnvio(e, true)}<button className="ti-link" onClick={() => setAbierto(null)}>Cerrar</button></div> : (
            <div key={e.id} className="apr-fila" onClick={() => setAbierto('env:' + e.id)}>
              <div style={{ minWidth: 0 }}><div className="txt">{e.mensaje}</div><div className="meta"><span className="ti-chip chip-p2">aprobado y enviado</span><span className="ti-chip chip-tipo">{ESTADO_L[e.salida?.estado] || '—'}</span>{(e.adjuntos || []).map(a => <MiniRecurso key={a.id} r={a} size={22} />)}<span className="ti-suave" style={{ margin: 0, fontSize: '.72rem' }}>{e.contacto?.nombre || ''} · {fecha(e.enviado_at)}</span></div></div>
              <span className="ti-link" style={{ padding: 0 }}>Editar</span>
            </div>
          ))}
          {(filtro === 'todo' || filtro === 'ejemplos') && ap.ejemplos.filter((x: Ej) => !hechos['ej:' + x.id]).map((ej: Ej) => abierto === 'ej:' + ej.id ? <div key={ej.id}>{fichaEjemplo(ej, true)}<button className="ti-link" onClick={() => setAbierto(null)}>Cerrar</button></div> : (
            <div key={ej.id} className="apr-fila" onClick={() => setAbierto('ej:' + ej.id)}>
              <div style={{ minWidth: 0 }}><div className="txt">{ej.pulida || ej.respuesta}</div><div className="meta"><span className="ti-chip chip-tipo">{ESTADO_L[ej.estado] || ej.estado}</span><span className="ti-chip chip-tipo">{FUENTE_L[ej.fuente] || ej.fuente}</span>{(ej.adjuntos || []).map(a => <MiniRecurso key={a.id} r={a} size={22} />)}{ej.criterio && <span className="ti-suave" style={{ margin: 0, fontSize: '.72rem' }}>regla: {ej.criterio.slice(0, 60)}</span>}<span className="ti-suave" style={{ margin: 0, fontSize: '.72rem' }}>{fecha(ej.created_at)}</span></div></div>
              <span className="ti-link" style={{ padding: 0 }}>Editar</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
