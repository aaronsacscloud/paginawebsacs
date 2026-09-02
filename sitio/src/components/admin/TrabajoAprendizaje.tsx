import { useEffect, useState } from 'react';
import { ESTILOS_ENVIOS } from './TrabajoEnvios';

/* ═══ Aprendizaje del agente ═══
 * Dos sub-pestañas. POR REVISAR: lo que espera el criterio del dueño (ejemplos que el
 * ciclo nocturno propuso o marcó dudosos, pares agente/consultor sin veredicto y mensajes
 * que salieron solos al vencer la ventana). APROBADO: todo lo que ya aceptó y envió, y las
 * correcciones que hizo. En las dos se puede cambiar el texto, poner el criterio (la regla
 * detrás) y la imagen; cada cambio vuelve al prompt del agente en el siguiente turno. */
type Ej = { id: string; estado: string; giro?: string | null; situacion: string; mensaje_lead?: string | null; respuesta?: string | null; pulida?: string | null; por_que?: string | null; fuente: string; imagen_id?: string | null; estado_rev: string; usos?: number; created_at: string; criterio: string; contacto?: { nombre?: string | null; giro?: string | null } | null };
type Env = { id: string; contact_id: string | null; origen: string; mensaje: string; mensaje_original?: string | null; salida: any; enviado_at?: string | null; imagen_id?: string | null; imagen_url?: string | null; humano_respuesta?: string | null; humano_at?: string | null; contacto?: { nombre?: string | null } | null };
type Img = { id: string; nombre: string; url: string; descripcion?: string | null; cuando?: string | null };

const ESTADO_L: Record<string, string> = { nuevo: 'Nuevo', descubriendo: 'Descubriendo', proponiendo: 'Proponiendo', agendada: 'Agendada', confirmando: 'Confirmando', no_show: 'No-show', reunion_hecha: 'Reunión hecha', silencio: 'Silencio', descalificado: 'Descalificado', humano: 'Humano' };
const FUENTE_L: Record<string, string> = { convirtio: 'De una conversación que convirtió', correccion_dueno: 'Tu corrección', correccion_implicita: 'Corrección implícita', humano_antes: 'El consultor contestó antes' };
const fecha = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

async function post(body: any) {
  const r = await fetch('/api/crm/ti/aprendizaje', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(e => ({ error: String(e) }));
  return r;
}

function SelectorImagen({ galeria, valor, onChange }: { galeria: Img[]; valor: string | null; onChange: (id: string | null) => void }) {
  const img = galeria.find(g => g.id === valor) || null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {img && <img src={img.url} alt={img.nombre} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e8e5f0' }} />}
      <select className="ti-envio-input" style={{ maxWidth: 360 }} value={valor || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">Sin imagen</option>
        {galeria.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.cuando ? ` — ${g.cuando.slice(0, 50)}` : ''}</option>)}
      </select>
      {!galeria.length && <span className="ti-suave" style={{ fontSize: '0.74rem' }}>La galería está vacía: súbela en Próximos envíos.</span>}
    </div>
  );
}

/* Una tarjeta editable: sirve para un ejemplo y para un envío (texto, criterio, imagen). */
function Tarjeta({ titulo, chips, leadDijo, original, textoInicial, criterioInicial, imagenInicial, galeria, acciones, nota }: {
  titulo: string; chips: string[]; leadDijo?: string | null; original?: string | null; textoInicial: string; criterioInicial: string; imagenInicial: string | null; galeria: Img[]; nota?: string | null;
  acciones: { label: string; clase?: string; run: (v: { pulida: string; criterio: string; imagen_id: string | null }) => Promise<any> }[];
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [criterio, setCriterio] = useState(criterioInicial);
  const [imagen, setImagen] = useState<string | null>(imagenInicial);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const editado = texto !== textoInicial || criterio !== criterioInicial || imagen !== imagenInicial;
  return (
    <div className="ti-envio" style={{ marginBottom: 12 }}>
      <div className="ti-envio-cab"><b className="ti-envio-nombre">{titulo}</b>{chips.map((c, i) => <span key={i} className="ti-chip chip-tipo">{c}</span>)}</div>
      {leadDijo && <div className="ti-envio-lead"><span>Lead dijo</span>{leadDijo}</div>}
      {nota && <div className="ti-envio-obj"><span>Contexto</span>{nota}</div>}
      {original && original !== textoInicial && <details className="ti-envio-datos"><summary>Lo que el agente había dicho</summary><div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{original}</div></details>}
      <label className="ti-envio-lbl">La respuesta {editado ? '— editada' : ''}</label>
      <textarea className={'ti-envio-texto' + (editado ? ' editado' : '')} rows={Math.min(10, Math.max(3, Math.ceil(texto.length / 80) + 1))} value={texto} onChange={e => setTexto(e.target.value)} />
      <label className="ti-envio-lbl">Qué debe considerar el agente (la regla detrás)</label>
      <input className="ti-envio-input" placeholder="Ej.: si hace varias preguntas, contéstalas todas en un solo mensaje y cierra con una sola pregunta" value={criterio} onChange={e => setCriterio(e.target.value)} />
      <label className="ti-envio-lbl">Imagen</label>
      <SelectorImagen galeria={galeria} valor={imagen} onChange={setImagen} />
      {msg && <div style={{ marginTop: 6, fontSize: '0.8rem', fontWeight: 600, color: msg.startsWith('No') ? '#7f1d1d' : '#14532d' }}>{msg}</div>}
      <div className="ti-envio-acc" style={{ marginTop: 8 }}>
        {acciones.map(a => <button key={a.label} className={'ti-btn ' + (a.clase || '')} disabled={ocupado} onClick={async () => { setOcupado(true); const r = await a.run({ pulida: texto.trim(), criterio: criterio.trim(), imagen_id: imagen }); setMsg(r?.error ? 'No se guardó: ' + r.error : (r?.hecho || 'Guardado.')); setOcupado(false); }}>{a.label}</button>)}
      </div>
    </div>
  );
}

export default function TrabajoAprendizaje() {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'revisar' | 'aprobado'>('revisar');
  const [filtro, setFiltro] = useState<'todo' | 'ejemplos' | 'envios' | 'pares'>('todo');
  const [ocultos, setOcultos] = useState<Record<string, string>>({});
  const cargar = () => fetch('/api/crm/ti/aprendizaje').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const gal: Img[] = d.galeria || [];
  const pr = d.por_revisar, ap = d.aprobados;
  const vis = (id: string) => !ocultos[id];
  const nRevisar = pr.ejemplos.filter((x: any) => vis(x.id)).length + pr.envios_solos.filter((x: any) => vis(x.id)).length + pr.pares.filter((x: any) => vis(x.id)).length;
  const nAprob = ap.ejemplos.length + ap.envios.length;
  const ocultar = (id: string, como: string) => setOcultos(o => ({ ...o, [id]: como }));

  const tarjetaEjemplo = (ej: Ej, aprobado: boolean) => (
    <Tarjeta key={ej.id} titulo={ej.contacto?.nombre || ej.situacion.slice(0, 60)} chips={[ESTADO_L[ej.estado] || ej.estado, FUENTE_L[ej.fuente] || ej.fuente, ej.estado_rev === 'dudoso' ? 'dudoso' : '', fecha(ej.created_at)].filter(Boolean)}
      leadDijo={ej.mensaje_lead} nota={ej.situacion} original={ej.respuesta} textoInicial={ej.pulida || ej.respuesta || ''} criterioInicial={ej.criterio || ''} imagenInicial={ej.imagen_id || null} galeria={gal}
      acciones={aprobado ? [
        { label: 'Guardar cambios', clase: 'primario', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, ...v }); return r.error ? r : { hecho: 'Guardado: el agente lo usa desde el siguiente turno.' }; } },
        { label: 'Retirar (rechazar)', clase: 'peligro', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, decision: 'rechazar', criterio: v.criterio }); if (!r.error) ocultar(ej.id, 'rechazado'); return r.error ? r : { hecho: 'Retirado.' }; } },
      ] : [
        { label: 'Aprobar', clase: 'primario grande', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, decision: 'aprobar', ...v }); if (!r.error) ocultar(ej.id, 'aprobado'); return r.error ? r : { hecho: 'Aprobado.' }; } },
        { label: 'Rechazar', clase: 'peligro', run: async v => { const r = await post({ accion: 'ejemplo', id: ej.id, decision: 'rechazar', criterio: v.criterio }); if (!r.error) ocultar(ej.id, 'rechazado'); return r.error ? r : { hecho: 'Rechazado.' }; } },
      ]} />
  );
  const tarjetaEnvio = (e: Env, aprobado: boolean) => (
    <Tarjeta key={e.id} titulo={e.contacto?.nombre || 'Lead'} chips={[ESTADO_L[e.salida?.estado] || e.salida?.estado || '', e.origen, aprobado ? 'aprobado y enviado' : 'salió solo al vencer la ventana', fecha(e.enviado_at)].filter(Boolean)}
      leadDijo={e.salida?.ultimo_mensaje} nota={e.salida?.objetivo} original={e.mensaje_original || null} textoInicial={e.mensaje} criterioInicial="" imagenInicial={e.imagen_id || null} galeria={gal}
      acciones={aprobado ? [
        { label: 'Guardar como ejemplo (con mis cambios)', clase: 'primario', run: async v => { const r = await post({ accion: 'envio', id: e.id, decision: 'validar', ...v }); return r.error ? r : { hecho: 'Guardado como ejemplo.' }; } },
      ] : [
        { label: 'Estuvo bien: aprobar', clase: 'primario grande', run: async v => { const r = await post({ accion: 'envio', id: e.id, decision: 'validar', ...v }); if (!r.error) ocultar(e.id, 'aprobado'); return r.error ? r : { hecho: 'Aprobado como ejemplo.' }; } },
        { label: 'Descartar (no enseña nada)', run: async () => { const r = await post({ accion: 'envio', id: e.id, decision: 'descartar' }); if (!r.error) ocultar(e.id, 'descartado'); return r.error ? r : { hecho: 'Descartado.' }; } },
      ]} />
  );
  const tarjetaPar = (e: Env) => (
    <div className="ti-envio" key={e.id} style={{ marginBottom: 12 }}>
      <div className="ti-envio-cab"><b className="ti-envio-nombre">{e.contacto?.nombre || 'Lead'}</b><span className="ti-chip chip-tipo">par agente / consultor</span><span className="ti-chip chip-tipo">{fecha(e.humano_at as any)}</span></div>
      {e.salida?.ultimo_mensaje && <div className="ti-envio-lead"><span>Lead dijo</span>{e.salida.ultimo_mensaje}</div>}
      <div className="ti-envio-obj"><span>El agente iba a decir</span>{e.mensaje}</div>
      <div className="ti-envio-obj"><span>El consultor dijo</span>{e.humano_respuesta}</div>
      <div className="ti-envio-acc">
        {[['humano_mejor', 'Mejor el consultor'], ['agente_mejor', 'Mejor el agente'], ['empate', 'Empate']].map(([v, l]) => (
          <button key={v} className={'ti-btn' + (v === 'humano_mejor' ? ' primario' : '')} onClick={async () => { const r = await fetch('/api/crm/ti/envios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, accion: 'par', veredicto: v }) }).then(x => x.json()); if (!r.error) ocultar(e.id, 'veredicto'); }}>{l}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="ti-envios">
      <style>{ESTILOS_ENVIOS}</style>
      <div className="ti-envio-cabecera">
        <h2 className="ti-h">Aprendizaje del agente</h2>
        <p className="ti-porque">Lo que ya aprobaste y enviaste vive en <b>Aprobado</b>. Lo que falta por tu criterio espera en <b>Por revisar</b>. En las dos puedes cambiar el texto, poner la regla detrás y la imagen: el agente lo usa desde el siguiente turno.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 12px' }}>
          <button className={'ti-chip-btn' + (sub === 'revisar' ? ' on' : '')} onClick={() => setSub('revisar')}>Por revisar · {nRevisar}</button>
          <button className={'ti-chip-btn' + (sub === 'aprobado' ? ' on' : '')} onClick={() => setSub('aprobado')}>Aprobado · {nAprob}</button>
          <span className="ti-suave" style={{ alignSelf: 'center', fontSize: '0.75rem' }}>rechazados: {d.rechazados}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {([['todo', 'Todo'], ['ejemplos', 'Ejemplos'], ['envios', 'Mensajes del agente'], ['pares', 'Pares agente/consultor']] as const).map(([v, l]) => (
            <button key={v} className={'ti-chip-btn' + (filtro === v ? ' on' : '')} onClick={() => setFiltro(v)}>{l}</button>
          ))}
        </div>
      </div>
      {sub === 'revisar' && (
        <>
          {nRevisar === 0 && <div className="ti-fin"><h2>Nada por revisar</h2><p>Cuando el ciclo nocturno proponga ejemplos, un mensaje salga sin tu aprobación o el consultor conteste antes que el agente, aparece aquí.</p></div>}
          {(filtro === 'todo' || filtro === 'pares') && pr.pares.filter((x: any) => vis(x.id)).map(tarjetaPar)}
          {(filtro === 'todo' || filtro === 'envios') && pr.envios_solos.filter((x: any) => vis(x.id)).map((e: Env) => tarjetaEnvio(e, false))}
          {(filtro === 'todo' || filtro === 'ejemplos') && pr.ejemplos.filter((x: any) => vis(x.id)).map((ej: Ej) => tarjetaEjemplo(ej, false))}
        </>
      )}
      {sub === 'aprobado' && (
        <>
          {(filtro === 'todo' || filtro === 'envios') && ap.envios.map((e: Env) => tarjetaEnvio(e, true))}
          {(filtro === 'todo' || filtro === 'ejemplos') && ap.ejemplos.filter((x: any) => vis(x.id)).map((ej: Ej) => tarjetaEjemplo(ej, true))}
        </>
      )}
    </div>
  );
}
