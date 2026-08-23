// WHATSAPP · El hilo PRO (portado de sacs_inbox): burbujas emerald/blancas
// con cola, separadores de día y de conversación-resuelta, estados ✓✓ con
// tooltip de error en español, player de audio propio, lightbox, linkify,
// reacciones como chips y búsqueda en el hilo tipo Cmd+F.
import { useEffect, useMemo, useRef, useState } from 'react';
import Cargando from '../ui/Cargando';
import { telefonoLegible } from '../../../../lib/telefono';
import { lifecycleDe } from '../../../../lib/crm/lifecycle';
import { C, L, burbuja, separador, etiquetaDia } from './estilo';
import { IcoBuscar, IcoPuntos, IcoChevronArriba, IcoChevronAbajo } from './Iconos';
import { Avatar, IconoCanal } from './ListaConversaciones';
import EstadoEntrega from './EstadoEntrega';
import Composer from './Composer';

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const esImagen = (url?: string | null, tipo?: string | null) =>
  tipo === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

/** URLs → links (portado). */
function Linkify({ texto, claro }: { texto: string; claro?: boolean }) {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  return (<>
    {partes.map((p, i) => /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: claro ? '#fff' : C.azulTinta, textDecoration: 'underline', wordBreak: 'break-all' }}>{p}</a>
      : <span key={i}>{p}</span>)}
  </>);
}

function Resaltado({ texto, q, claro }: { texto: string; q: string; claro?: boolean }) {
  if (!q) return <Linkify texto={texto} claro={claro} />;
  const partes = texto.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (<>
    {partes.map((p, i) => p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="wa-mark">{p}</mark>
      : <Linkify key={i} texto={p} claro={claro} />)}
  </>);
}

/** Player de audio propio (portado de MessageBubble:81-171). */
function PlayerAudio({ src, claro }: { src: string; claro?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <span className="wa-audio" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, maxWidth: 260 }}>
      <audio ref={ref} src={src} preload="metadata"
        onLoadedMetadata={e => setDur((e.target as HTMLAudioElement).duration || 0)}
        onTimeUpdate={e => setT((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => setSonando(false)} />
      <button onClick={() => { const a = ref.current!; if (sonando) { a.pause(); setSonando(false); } else { a.play(); setSonando(true); } }}
        style={{
          width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: claro ? 'rgba(255,255,255,.25)' : C.emerald500, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
        {sonando
          ? <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          : <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <span style={{ flex: 1, position: 'relative', height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        onClick={e => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const pct = (e.clientX - r.left) / r.width;
          if (ref.current && dur) { ref.current.currentTime = pct * dur; setT(pct * dur); }
        }}>
        <span style={{ width: '100%', height: 6, borderRadius: 999, background: claro ? 'rgba(255,255,255,.3)' : C.g200, overflow: 'hidden', display: 'block' }}>
          <span style={{ display: 'block', height: '100%', width: `${dur ? (t / dur) * 100 : 0}%`, background: claro ? '#fff' : C.emerald500 }} />
        </span>
        <span className="wa-thumb" style={{ position: 'absolute', left: `calc(${dur ? (t / dur) * 100 : 0}% - 6px)`, width: 12, height: 12, borderRadius: 999, background: claro ? '#fff' : C.emerald600, boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
      </span>
      <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: claro ? 'rgba(255,255,255,.85)' : C.g500, flexShrink: 0 }}>
        {sonando || t > 0 ? fmt(t) : fmt(dur)}
      </span>
    </span>
  );
}

export default function Hilo({ hilo, filaActiva, equipo, api, mobile, onBack, onVerDetalle }: {
  hilo: any; filaActiva?: any; equipo: any[]; api: any; mobile?: boolean;
  onBack?: () => void; onVerDetalle?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const conv = hilo?.conversacion;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  // Línea de tiempo unificada: mensajes + correos + notas + eventos + reacciones.
  const { timeline, reacciones } = useMemo(() => {
    if (!hilo) return { timeline: [], reacciones: new Map() };
    const msjsCrudos = (hilo.mensajes || []);
    const reac = new Map<string, string[]>();
    const msjs: any[] = [];
    for (const m of msjsCrudos) {
      if (m.tipo === 'reaction' && m.metadata?.reacciona_a) {
        const arr = reac.get(m.metadata.reacciona_a) || []; arr.push(m.cuerpo || '👍'); reac.set(m.metadata.reacciona_a, arr);
        continue;
      }
      msjs.push({ ...m, _clase: 'mensaje', _t: m.enviado_at || m.created_at });
    }
    const notas = (hilo.notas || []).map((n: any) => ({ ...n, _clase: 'nota', _t: n.created_at }));
    const correos = (hilo.correos || []).flatMap((h: any) => (h.mensajes || []).map((m: any) => ({
      ...m, _clase: 'correo', _t: m.created_at, _asunto: m.asunto || h.conversacion?.asunto || '',
    })));
    const eventos = (hilo.eventos || []).map((e: any) => ({ ...e, _clase: 'evento', _t: e.created_at }));
    const timeline = [...msjs, ...notas, ...correos, ...eventos].sort((a, b) =>
      String(a._t).localeCompare(String(b._t)) || String(a.created_at).localeCompare(String(b.created_at)));
    return { timeline, reacciones: reac };
  }, [hilo]);

  // Búsqueda en el hilo (Cmd+F portado).
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return timeline.filter((it: any) =>
      it._clase !== 'evento' && String(it.cuerpo || it.cuerpo_texto || it.transcript || it.texto || '').toLowerCase().includes(ql));
  }, [timeline, q]);
  useEffect(() => { setMatchIdx(0); }, [q]);
  const irAMatch = (idx: number) => {
    const it = matches[idx]; if (!it) return;
    const el = document.getElementById(`wa-item-${it._clase}-${it.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setResaltada(`${it._clase}-${it.id}`);
    setTimeout(() => setResaltada(null), 2000);
  };
  useEffect(() => { if (matches.length) irAMatch(matchIdx); }, [matchIdx, matches.length]);

  const nRef = useRef(0);
  useEffect(() => {
    if (timeline.length !== nRef.current) {
      nRef.current = timeline.length;
      if (!buscando) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [timeline.length]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setLightbox(null); setBuscando(false); } };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, []);

  // Fila virtual (contacto sin conversación): héroe + elegir plantilla.
  if (!hilo && filaActiva?.virtual) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderLeft: mobile ? 'none' : `1px solid ${C.g200}`, background: C.g50 }}>
        <div style={{ height: L.header, display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px', background: '#fff', borderBottom: `1px solid ${C.g100}` }}>
          {onBack && <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, minWidth: 36 }}>←</button>}
          <Avatar nombre={filaActiva.contacto?.nombre} telefono={String(filaActiva.telefono || '?')} size={28} canal="crm" />
          <b style={{ fontSize: 13 }}>{filaActiva.contacto?.nombre || filaActiva.telefono}</b>
          <span style={{ fontSize: 9, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '2px 8px' }}>Sin conversación</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: 76, height: 76, borderRadius: 999, background: 'linear-gradient(135deg, #A7F3D0, #34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconoCanal canal="wa" size={34} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '14px 0 4px' }}>Inicia una conversación</p>
          <div style={{ maxWidth: 380, background: 'rgba(236,253,245,.6)', border: `1px solid #A7F3D0`, borderRadius: 12, padding: '14px 16px', marginTop: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.g500, lineHeight: 1.55, margin: '0 0 10px' }}>
              WhatsApp solo permite iniciar con una <b>plantilla aprobada</b>; cuando el contacto responda, el chat queda abierto 24 horas.
            </p>
            <button onClick={() => api.enviarPlantilla && document.dispatchEvent(new CustomEvent('wa-abrir-plantillas'))}
              style={{ border: 'none', borderRadius: 8, padding: '9px 18px', background: C.emerald600, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Elegir plantilla
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hilo) return <div style={{ flex: 1, minWidth: 0, borderLeft: `1px solid ${C.g200}` }}><Cargando texto="Abriendo conversación…" /></div>;

  const etapa = lifecycleDe(conv?.contacts?.lifecycle_stage);
  const nombre = conv?.contacts ? `${conv.contacts.nombre || ''} ${conv.contacts.apellido || ''}`.trim() : null;
  let diaPrevio = '';
  let resueltaPrevia = false;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: mobile ? 'none' : `1px solid ${C.g200}`, background: C.g50, height: mobile ? 'calc(100dvh - 64px)' : undefined }}>
      {/* ── Header h-44 ── */}
      <div style={{ height: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#fff', borderBottom: `1px solid ${C.g100}` }}>
        {onBack && <button onClick={onBack} aria-label="Atrás" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, minWidth: 36, height: 36 }}>←</button>}
        <span style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
          <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre || telefonoLegible(conv.telefono)}</b>
          {etapa && <span style={{ fontSize: 9, fontWeight: 700, background: etapa.bg, color: etapa.fg, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{etapa.label}</span>}
          <span style={{ fontSize: 10, color: C.g400, flexShrink: 0 }}>{telefonoLegible(conv.telefono)}</span>
        </span>
        {conv.id && <select value={conv.asignado_a || ''} onChange={e => api.patchConversacion({ asignado_a: e.target.value || null })}
          aria-label="Asignar a"
          style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', background: '#fff', color: C.g500, maxWidth: 110, flexShrink: 0, cursor: 'pointer' }}>
          <option value="">Sin asignar</option>
          {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>}
        {conv.id && <select value={conv.estado_crm || 'abierta'} onChange={e => api.patchConversacion({ estado_crm: e.target.value })}
          aria-label="Estado" title="Estado de la conversación"
          style={{
            border: '1px solid', borderRadius: 8, padding: '4px 6px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
            borderColor: conv.estado_crm === 'resuelta' ? '#A7F3D0' : conv.estado_crm === 'pendiente' ? C.ambar200 : C.g200,
            background: conv.estado_crm === 'resuelta' ? C.emerald50 : conv.estado_crm === 'pendiente' ? C.ambar50 : '#fff',
            color: conv.estado_crm === 'resuelta' ? C.emerald700 : conv.estado_crm === 'pendiente' ? C.ambar700 : C.g500,
          }}>
          <option value="abierta">Abierta</option>
          <option value="pendiente">Pendiente</option>
          <option value="resuelta">Resuelta</option>
        </select>}
        <button onClick={() => setBuscando(b => !b)} title="Buscar en la conversación"
          style={{ border: 'none', background: buscando ? C.moradoAgua : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: buscando ? C.moradoTinta : C.g400 }}>
          <IcoBuscar size={15} />
        </button>
        {conv.id && <MenuHilo conv={conv} api={api} abierto={menu} setAbierto={setMenu} />}
        {onVerDetalle && (
          <button onClick={onVerDetalle} style={{ border: `1px solid ${C.azulBorde}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: '#fff', color: C.azulTinta, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Detalle</button>
        )}
      </div>

      {/* ── Barra de búsqueda del hilo ── */}
      {buscando && (
        <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: 'rgba(249,250,251,.7)', borderBottom: `1px solid ${C.g100}` }}>
          <IcoBuscar size={13} style={{ color: C.g400 }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setMatchIdx(i => (i + 1) % Math.max(matches.length, 1)); }}
            placeholder="Buscar en la conversación…"
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <span style={{ fontSize: 11, color: C.g400, fontVariantNumeric: 'tabular-nums' }}>{matches.length ? `${matchIdx + 1}/${matches.length}` : '0/0'}</span>
          <button disabled={!matches.length} onClick={() => setMatchIdx(i => (i - 1 + matches.length) % matches.length)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2, opacity: matches.length ? 1 : .3 }}><IcoChevronArriba size={13} /></button>
          <button disabled={!matches.length} onClick={() => setMatchIdx(i => (i + 1) % matches.length)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2, opacity: matches.length ? 1 : .3 }}><IcoChevronAbajo size={13} /></button>
          <button onClick={() => { setBuscando(false); setQ(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 13 }}>✕</button>
        </div>
      )}

      {/* ── Mensajes ── */}
      <div ref={scrollRef} className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {timeline.map((item: any) => {
          const dia = etiquetaDia(item._t);
          const sepDia = dia !== diaPrevio; diaPrevio = dia;
          // Boundary: al pasar por un evento "resuelta", el siguiente bloque abre nueva etapa.
          const esBoundary = item._clase === 'evento' && item.tipo === 'estado' && /resuelta/i.test(item.detalle || '');
          const clave = `${item._clase}-${item.id}`;
          const conRing = resaltada === clave;
          const chips = item._clase === 'mensaje' && item.kapso_message_id ? reacciones.get(item.kapso_message_id) : null;
          if (esBoundary) { resueltaPrevia = true; }
          const sep = separador(false);
          const sepOscuro = separador(true);
          return (
            <span key={clave} id={`wa-item-${clave}`} style={{ display: 'contents' }}>
              {sepDia && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <span style={sep.linea} /><span style={sep.chip}>{dia}</span><span style={sep.linea} />
                </span>
              )}
              {esBoundary ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <span style={sepOscuro.linea} />
                  <span style={sepOscuro.chip}>✓ Conversación resuelta{item.autor ? ` · ${item.autor}` : ''}</span>
                  <span style={sepOscuro.linea} />
                </span>
              ) : item._clase === 'evento' ? (
                <span style={{ alignSelf: 'center', fontSize: 11, color: C.g400, fontStyle: 'italic' }}>
                  {item.detalle}{item.autor ? ` · ${item.autor}` : ''}
                </span>
              ) : item._clase === 'nota' ? (
                <span style={{ ...burbuja.nota, boxShadow: conRing ? `0 0 0 2px ${C.morado}` : 'none', transition: 'box-shadow .3s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 999, background: C.ambar400, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(item.autor || 'E')[0].toUpperCase()}
                    </span>
                    <b style={{ fontSize: 11, color: C.ambar700 }}>Comentario interno · {item.autor}</b>
                    <span style={{ fontSize: 9, fontWeight: 700, background: C.ambar100, color: C.ambar700, borderRadius: 999, padding: '1px 7px' }}>Solo equipo</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: C.ambar500 }}>{horaDe(item._t)}</span>
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.texto} q={q} /></span>
                </span>
              ) : item._clase === 'correo' ? (
                <span style={{ ...burbuja.correo(item.direccion === 'saliente'), boxShadow: conRing ? `0 0 0 2px ${C.morado}` : 'none', transition: 'box-shadow .3s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <IconoCanal canal="email" />
                    <b style={{ fontSize: 12, color: C.azulTinta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item._asunto || 'Correo'}</b>
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap', display: 'block', maxHeight: 220, overflow: 'hidden' }}>
                    <Resaltado texto={(item.cuerpo_texto || '').slice(0, 1200)} q={q} />
                  </span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                    {item.autor && <span style={{ fontSize: 10, color: C.g400 }}>{item.autor}</span>}
                    <span style={{ fontSize: 10, color: C.g400 }}>{horaDe(item._t)}</span>
                    {item.direccion === 'saliente' && <span style={{ fontSize: 9, fontWeight: 800, background: C.azulAgua, color: C.azulTinta, borderRadius: 999, padding: '1px 7px' }}>correo</span>}
                  </span>
                </span>
              ) : (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: item.direccion === 'entrante' ? 'flex-start' : 'flex-end', gap: 2 }}>
                  {item.direccion === 'saliente' && (
                    <span style={{ fontSize: 10, color: C.g400, padding: '0 4px' }}>Agente</span>
                  )}
                  <span style={{
                    ...(item.direccion === 'entrante' ? burbuja.entrante : burbuja.salienteWa),
                    boxShadow: conRing ? `0 0 0 2px ${C.morado}, 0 0 0 4px #fff` : 'none', transition: 'box-shadow .3s',
                  }}>
                    {item.transcript ? (<>
                      <span style={{ fontSize: 10, fontWeight: 800, display: 'block', opacity: .8, marginBottom: 3 }}>NOTA DE VOZ · transcripción</span>
                      {item.media_url && <PlayerAudio src={item.media_url} claro={item.direccion === 'saliente'} />}
                      <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginTop: item.media_url ? 6 : 0 }}>
                        <Resaltado texto={item.transcript} q={q} claro={item.direccion === 'saliente'} />
                      </span>
                    </>) : item.tipo === 'audio' && item.media_url ? (
                      <PlayerAudio src={item.media_url} claro={item.direccion === 'saliente'} />
                    ) : null}
                    {item.media_url && esImagen(item.media_url, item.tipo) && (
                      <img src={item.media_url} alt="" onClick={() => setLightbox(item.media_url)}
                        style={{ borderRadius: 10, maxHeight: 256, maxWidth: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block', marginBottom: item.cuerpo ? 6 : 0 }} />
                    )}
                    {item.media_url && !esImagen(item.media_url, item.tipo) && item.tipo !== 'audio' && !item.transcript && (
                      <a href={item.media_url} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: item.direccion === 'saliente' ? 'rgba(255,255,255,.15)' : C.g50, borderRadius: 8, padding: '8px 10px', textDecoration: 'none', color: item.direccion === 'saliente' ? '#fff' : C.azulTinta, fontSize: 12, fontWeight: 700, marginBottom: item.cuerpo ? 6 : 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h8l4 4v16H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                        {item.cuerpo || 'Documento'} · Descargar
                      </a>
                    )}
                    {!item.transcript && item.cuerpo && !(item.media_url && !esImagen(item.media_url, item.tipo) && item.tipo !== 'audio') && (
                      <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo} q={q} claro={item.direccion === 'saliente'} /></span>
                    )}
                    {!item.transcript && !item.cuerpo && !item.media_url && (
                      <span style={{ opacity: .6 }}>[{item.tipo || 'mensaje'}]</span>
                    )}
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: item.direccion === 'saliente' ? '#A7F3D0' : C.g400 }}>{horaDe(item._t)}</span>
                      <EstadoEntrega status={item.status} direccion={item.direccion} error={item.error} />
                    </span>
                  </span>
                  {chips && chips.length > 0 && (
                    <span style={{ display: 'flex', gap: 3, marginTop: -6, zIndex: 1, padding: '0 6px' }}>
                      {chips.map((emoji: string, i: number) => (
                        <span key={i} style={{ background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 999, padding: '1px 6px', fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>{emoji}</span>
                      ))}
                    </span>
                  )}
                  {item.error && item.status === 'failed' && (
                    <span style={{ fontSize: 10, color: C.rojo500, padding: '0 4px' }}>{item.error.slice(0, 90)}</span>
                  )}
                </span>
              )}
            </span>
          );
        })}
        {!timeline.length && (
          <span style={{ alignSelf: 'center', marginTop: 30, fontSize: 12, color: C.g400 }}>Todavía no hay mensajes.</span>
        )}
        {conv.estado_crm === 'resuelta' && timeline.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <span style={separador(true).linea} /><span style={separador(true).chip}>✓ Conversación resuelta</span><span style={separador(true).linea} />
          </span>
        )}
      </div>

      {/* ── Composer ── */}
      <Composer ventana={hilo.ventana} api={api} telefono={conv.telefono} equipo={equipo}
        canales={{ ...hilo.canales, wa_id: conv.id }}
        contacto={{ nombre, email: conv.contacts?.email, empresa: conv.companies?.nombre_comercial || conv.companies?.nombre, plan: conv.companies?.plan, etapa: etapa?.label }} />

      {/* ── Lightbox ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 20, border: 'none', background: 'none', color: '#fff', fontSize: 26, cursor: 'pointer' }}>✕</button>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/** Menú ⋯ del hilo: posponer / exportar. */
function MenuHilo({ conv, api, abierto, setAbierto }: { conv: any; api: any; abierto: boolean; setAbierto: (v: boolean) => void }) {
  const posponer = async (hasta: Date) => { setAbierto(false); await api.patchConversacion({ snooze_until: hasta.toISOString(), no_leidos: 0 }); };
  const manana9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
  const lunes9 = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; };
  const dormida = conv.snooze_until && new Date(conv.snooze_until) > new Date();
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setAbierto(!abierto)} title="Más acciones"
        style={{ border: 'none', background: dormida ? C.ambar50 : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: dormida ? C.ambar700 : C.g400 }}>
        <IcoPuntos size={16} />
      </button>
      {abierto && <span onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 940 }} />}
      {abierto && (
        <span style={{ position: 'absolute', right: 0, top: '112%', zIndex: 941, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.12)', minWidth: 190, display: 'block', overflow: 'hidden' }}>
          <span style={{ display: 'block', padding: '8px 12px 3px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Posponer hasta</span>
          {[{ l: 'En 3 horas', f: () => new Date(Date.now() + 3 * 3600e3) }, { l: 'Mañana 9:00', f: manana9 }, { l: 'Lunes 9:00', f: lunes9 }].map(o => (
            <button key={o.l} onClick={() => posponer(o.f())}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.g700 }}>{o.l}</button>
          ))}
          {dormida && (
            <button onClick={() => { setAbierto(false); api.patchConversacion({ snooze_until: null }); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.ambar700, fontWeight: 700 }}>Despertar ahora</button>
          )}
          <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          <a href={`/api/crm/whatsapp/exportar?id=${conv.id}`} download onClick={() => setAbierto(false)}
            style={{ display: 'block', padding: '9px 12px', fontSize: 12, color: C.azulTinta, fontWeight: 700, textDecoration: 'none' }}>Exportar conversación (.txt)</a>
        </span>
      )}
    </span>
  );
}
