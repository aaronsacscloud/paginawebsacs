// INBOX · La burbuja de un mensaje de WhatsApp, con TODOS los tipos que Meta
// entrega: texto, imagen, video, audio/nota de voz, documento, sticker,
// ubicación, contacto compartido, respuesta de botón/lista, plantilla,
// reacción (la pinta Hilo como chip), borrado, no compatible.
// También: cita (context), autor del saliente, reintentar en failed y
// "responder" (cita) en hover.
import { useRef, useState } from 'react';
import { C, burbuja } from './estilo';
import { tic } from '../../../../lib/ui/tacto';
import { extensionDe } from './VisorMedia';
import EstadoEntrega, { errorLegible } from './EstadoEntrega';

export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
export const esImagen = (url?: string | null, tipo?: string | null) =>
  tipo === 'image' || tipo === 'sticker' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

/** De dónde se lee la media: URL pública si la hay; si no, el proxy por media_id. */
export const srcMedia = (m: any, dl = false): string | null =>
  m?.media_url || (m?.media_id ? `/api/crm/whatsapp/media-entrante?id=${encodeURIComponent(m.media_id)}${dl ? '&dl=1' : ''}` : null);

/** Texto corto para previews/citas. */
export const resumenMensaje = (m: any): string => {
  if (!m) return '';
  if (m.borrado_at) return 'Mensaje eliminado';
  if (m.transcript) return `Nota de voz: ${m.transcript}`;
  if (m.cuerpo) return m.cuerpo;
  const n: Record<string, string> = { image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento', sticker: 'Sticker', location: 'Ubicación', contacts: 'Contacto', template: 'Plantilla' };
  return n[m.tipo] || m.tipo || 'Mensaje';
};

/** URLs → links (portado). */
/** Negritas de WhatsApp (*así*) y de markdown (**así**), que es lo que
 *  escriben la IA y los snippets. Se veían literales, con los asteriscos a la
 *  vista, en un hilo que el cliente también está leyendo del otro lado. */
function ConNegritas({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*\n]+\*\*|(?<![\w*])\*[^*\n]+\*(?![\w*]))/g);
  return (<>
    {partes.map((p, i) => {
      const dobles = /^\*\*[^*\n]+\*\*$/.test(p);
      const simples = /^\*[^*\n]+\*$/.test(p);
      if (!dobles && !simples) return <span key={i}>{p}</span>;
      return <b key={i} style={{ fontWeight: 700 }}>{p.slice(dobles ? 2 : 1, dobles ? -2 : -1)}</b>;
    })}
  </>);
}

export function Linkify({ texto, claro }: { texto: string; claro?: boolean }) {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  return (<>
    {partes.map((p, i) => /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: claro ? '#fff' : C.azulTinta, textDecoration: 'underline', wordBreak: 'break-all' }}>{p}</a>
      : <ConNegritas key={i} texto={p} />)}
  </>);
}

export function Resaltado({ texto, q, claro }: { texto: string; q: string; claro?: boolean }) {
  if (!q) return <Linkify texto={texto} claro={claro} />;
  const partes = texto.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (<>
    {partes.map((p, i) => p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="wa-mark">{p}</mark>
      : <Linkify key={i} texto={p} claro={claro} />)}
  </>);
}

/** Player de audio propio (portado de MessageBubble:81-171). */
export function PlayerAudio({ src, claro }: { src: string; claro?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [fallo, setFallo] = useState(false);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  if (fallo) return <span style={{ fontSize: 11, opacity: .7 }}>Audio no disponible (Meta lo conserva 30 días)</span>;
  return (
    <span className="wa-audio" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, maxWidth: 260 }}>
      <audio ref={ref} src={src} preload="metadata" onError={() => setFallo(true)}
        onLoadedMetadata={e => setDur((e.target as HTMLAudioElement).duration || 0)}
        onTimeUpdate={e => setT((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => setSonando(false)} />
      <button onClick={() => { const a = ref.current!; if (sonando) { a.pause(); setSonando(false); } else { a.play(); setSonando(true); } }}
        aria-label={sonando ? 'Pausar' : 'Reproducir'}
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

const IcoDoc = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h8l4 4v16H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
const IcoPin = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.1 7-12a7 7 0 1 0-14 0c0 4.9 7 12 7 12z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" /></svg>;
const IcoPersona = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" /><path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
const IcoResponder = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 7 4 12l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 12h10a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

const ETIQUETA_INTERACTIVO: Record<string, string> = { button_reply: 'Eligió el botón', list_reply: 'Eligió de la lista', button: 'Eligió el botón' };

const IcoReenviar = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m15 7 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 12H10a6 6 0 0 0-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

/**
 * Al soltar el dedo tras una pulsación larga, el navegador manda ADEMÁS un
 * click en esas coordenadas. Para entonces la hoja de acciones ya está abierta
 * y ocupa la pantalla: el click cae en su fondo y la cierra sola, sin que dé
 * tiempo de leerla (medido — abría y desaparecía en el mismo gesto).
 *
 * No sirve ignorar los clicks "durante los primeros N ms": el dedo se levanta
 * cuando quiera, medio segundo o tres después de que la hoja apareció. Lo que
 * define a este click es que pertenece AL MISMO toque, así que se traga
 * exactamente uno, en captura y antes de que llegue a nadie. El plazo de 700 ms
 * es solo la red de seguridad para el caso en que ese click nunca llegue
 * (Android a veces no lo manda) y no quede un oyente colgado.
 */
function tragarSiguienteClick() {
  if (typeof document === 'undefined') return;
  const swallow = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); limpiar(); };
  const limpiar = () => { document.removeEventListener('click', swallow, true); clearTimeout(t); };
  document.addEventListener('click', swallow, true);
  const t = setTimeout(limpiar, 700);
}

const EMOJIS_RAPIDOS = ['👍', '❤️', '😂', '🙏', '😮', '😢', '🎉', '✅'];

export default function BurbujaMensaje({ item, q, conRing, chips, porWamid, onLightbox, onCitar, onReintentar, onReenviar, onReaccionar, onMantener, mismoAutorQueElAnterior }: {
  item: any; q: string; conRing: boolean; chips?: { emoji: string; dir: string }[] | null;
  porWamid: Map<string, any>;
  mismoAutorQueElAnterior?: boolean;   // para no repetir el nombre en cada burbuja seguida
  onLightbox: (m: any) => void;
  onCitar?: (item: any) => void;
  onReintentar?: (item: any) => void;
  onReenviar?: (item: any) => void;
  onReaccionar?: (item: any, emoji: string) => void;
  /** Táctil: mantener el dedo sobre la burbuja pide las acciones al padre. */
  onMantener?: (item: any) => void;
}) {
  const [pickReac, setPickReac] = useState(false);

  // ── MANTENER PRESIONADO ─────────────────────────────────────────────────
  // Responder/reaccionar/reenviar se revelan con hover, y en el teléfono el
  // hilo los apagaba por completo (.wa-hilo-m .wa-citar { display: none }).
  // O sea: en el teléfono NO se podía responder a un mensaje. El gesto que la
  // gente ya trae aprendido de WhatsApp es mantener el dedo encima, así que es
  // el que se usa; la hoja de acciones la abre el padre, UNA sola para todo el
  // hilo en vez de una por burbuja.
  const pres = useRef<{ t: any; x: number; y: number; disparado: boolean }>({ t: null, x: 0, y: 0, disparado: false });
  const cancelarPres = () => { if (pres.current.t) { clearTimeout(pres.current.t); pres.current.t = null; } };
  const gestos = onMantener ? {
    onTouchStart: (e: any) => {
      if (e.touches.length !== 1) return;
      pres.current = { t: null, x: e.touches[0].clientX, y: e.touches[0].clientY, disparado: false };
      pres.current.t = setTimeout(() => { pres.current.disparado = true; tic(); onMantener(item); }, 420);
    },
    // Si el dedo se mueve es scroll, no una pulsación: se abandona. Sin esto,
    // recorrer el hilo abriría la hoja a media lectura.
    onTouchMove: (e: any) => {
      const d = Math.abs(e.touches[0].clientX - pres.current.x) + Math.abs(e.touches[0].clientY - pres.current.y);
      if (d > 10) cancelarPres();
    },
    onTouchEnd: () => { cancelarPres(); if (pres.current.disparado) tragarSiguienteClick(); },
    onTouchCancel: cancelarPres,
  } : {};
  const saliente = item.direccion === 'saliente';
  const claro = saliente;
  const src = srcMedia(item);
  let tipo = item.tipo || 'text';
  // Los migrados y algunos entrantes traen tipos raros ('file') o el mime en
  // vez del tipo: se normaliza aquí para no caer al render genérico.
  const mime = String(item.mime || '');
  if (!['image','sticker','video','audio','document','location','contacts','interactive','template','reaction'].includes(tipo)) {
    if (/^image\//.test(mime) || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src || '')) tipo = 'image';
    else if (/^video\//.test(mime) || /\.(mp4|mov|webm)(\?|$)/i.test(src || '')) tipo = 'video';
    else if (/^audio\//.test(mime) || /\.(ogg|oga|mp3|m4a|opus|amr)(\?|$)/i.test(src || '')) tipo = 'audio';
    else if (src) tipo = 'document';
  }

  const cita = item.metadata?.cita?.wamid ? porWamid.get(item.metadata.cita.wamid) : null;
  const fondoSuave = saliente ? 'rgba(255,255,255,.15)' : C.g50;
  const [mediaRota, setMediaRota] = useState(false);
  const tinta = saliente ? '#fff' : C.azulTinta;

  let contenido: any;
  if (item.borrado_at) {
    contenido = <span style={{ fontStyle: 'italic', opacity: .7, display: 'flex', alignItems: 'center', gap: 5 }}>Mensaje eliminado por el cliente</span>;
  } else if (item.transcript) {
    contenido = (<>
      <span style={{ fontSize: 10, fontWeight: 800, display: 'block', opacity: .8, marginBottom: 3 }}>NOTA DE VOZ · transcripción</span>
      {src && <PlayerAudio src={src} claro={claro} />}
      <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginTop: src ? 6 : 0 }}><Resaltado texto={item.transcript} q={q} claro={claro} /></span>
    </>);
  } else if (tipo === 'audio') {
    contenido = src ? <PlayerAudio src={src} claro={claro} /> : <span style={{ opacity: .7 }}>{item.metadata?.voz ? 'Nota de voz' : 'Audio'} (sin archivo)</span>;
  } else if (tipo === 'image' || tipo === 'sticker') {
    contenido = (<>
      {src && !mediaRota ? <img src={src} alt={item.cuerpo || ''} onClick={() => onLightbox({ ...item, media_url: src })} loading="lazy" onError={() => setMediaRota(true)}
        style={{ borderRadius: 10, maxHeight: tipo === 'sticker' ? 140 : 256, maxWidth: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block', marginBottom: item.cuerpo ? 6 : 0, background: tipo === 'sticker' ? 'transparent' : C.g100 }} />
        : <span style={{ opacity: .7, fontStyle: 'italic' }}>{tipo === 'sticker' ? 'Sticker' : 'Imagen'} no disponible (Meta la conserva 30 días)</span>}
      {item.cuerpo && <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo} q={q} claro={claro} /></span>}
    </>);
  } else if (tipo === 'video') {
    contenido = (<>
      {src && !mediaRota ? <video src={src} controls preload="metadata" onError={() => setMediaRota(true)} style={{ borderRadius: 10, maxHeight: 256, maxWidth: '100%', display: 'block', marginBottom: item.cuerpo ? 6 : 0, background: '#000' }} />
        : <span style={{ opacity: .7 }}>Video no disponible</span>}
      {item.cuerpo && <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo} q={q} claro={claro} /></span>}
    </>);
  } else if (tipo === 'document') {
    const ext = extensionDe({ ...item, media_url: src });
    const nombre = item.filename || (item.cuerpo && item.cuerpo.length < 60 ? item.cuerpo : null) || `Documento ${ext}`;
    const verAqui = /PDF|XML|TXT|CSV/.test(ext);
    contenido = (<>
      <button onClick={() => src && onLightbox({ ...item, media_url: src })} disabled={!src}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: fondoSuave, border: 'none', borderRadius: 9, padding: '8px 10px', color: saliente ? '#fff' : C.g700, cursor: src ? 'pointer' : 'default', fontFamily: 'inherit', marginBottom: item.cuerpo && item.cuerpo !== nombre ? 6 : 0 }}>
        <span style={{ width: 30, height: 36, borderRadius: 5, background: saliente ? 'rgba(255,255,255,.22)' : C.morado, color: '#fff', fontSize: 8.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ext}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</b>
          <span style={{ fontSize: 10, opacity: .75 }}>{!src ? 'No disponible' : verAqui ? 'Verlo aquí mismo' : 'Abrir'}</span>
        </span>
      </button>
      {item.cuerpo && item.cuerpo !== nombre && <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo} q={q} claro={claro} /></span>}
    </>);
  } else if (tipo === 'location') {
    const { lat, lng, nombre, direccion } = item.metadata || {};
    const maps = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;
    contenido = (
      <a href={maps || '#'} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: fondoSuave, borderRadius: 8, padding: '8px 10px', textDecoration: 'none', color: saliente ? '#fff' : C.g700, fontSize: 12 }}>
        <span style={{ color: tinta, marginTop: 1 }}><IcoPin /></span>
        <span>
          <b style={{ display: 'block' }}>{nombre || 'Ubicación compartida'}</b>
          {direccion && <span style={{ opacity: .8 }}>{direccion}</span>}
          {maps && <span style={{ display: 'block', fontSize: 10, color: tinta, fontWeight: 700, marginTop: 2 }}>Abrir en Google Maps</span>}
        </span>
      </a>
    );
  } else if (tipo === 'contacts') {
    const lista: any[] = item.metadata?.contactos || [];
    contenido = (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(lista.length ? lista : [{ nombre: item.cuerpo || 'Contacto', telefonos: [] }]).map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: fondoSuave, borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
            <span style={{ color: tinta }}><IcoPersona /></span>
            <span><b style={{ display: 'block' }}>{c.nombre}</b>{(c.telefonos || []).map((t: string) => <span key={t} style={{ opacity: .8, display: 'block', fontSize: 11 }}>{t}</span>)}</span>
          </span>
        ))}
      </span>
    );
  } else if (tipo === 'interactive' && item.direccion === 'saliente' && item.metadata?.enviado) {
    const e = item.metadata.enviado;
    const btn = (t: string, k: string | number) => <span key={k} style={{ display: 'block', textAlign: 'center', background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '6px 8px', fontSize: 12, fontWeight: 700, marginTop: 4 }}>{t}</span>;
    contenido = (<>
      {e.header && <b style={{ display: 'block', marginBottom: 3 }}>{e.header}</b>}
      {e.cuerpo && <span style={{ whiteSpace: 'pre-wrap', display: 'block' }}><Resaltado texto={e.cuerpo} q={q} claro={claro} /></span>}
      {e.footer && <span style={{ display: 'block', fontSize: 10, opacity: .75, marginTop: 3 }}>{e.footer}</span>}
      {e.tipo === 'botones' && e.botones?.map((b: any, i: number) => btn(b.titulo, i))}
      {e.tipo === 'lista' && <>{btn(`≡ ${e.boton || 'Elegir'}`, 'l')}<span style={{ display: 'block', fontSize: 10, opacity: .75, marginTop: 3 }}>{e.secciones?.reduce((a: number, s: any) => a + (s.filas?.length || 0), 0)} opciones</span></>}
      {e.tipo === 'cta_url' && btn(`↗ ${e.texto_boton || 'Abrir'}`, 'u')}
      {e.tipo === 'pedir_ubicacion' && btn('Enviar ubicación', 'p')}
      {e.tipo === 'pedir_contacto' && btn('Compartir mi contacto', 'pc')}
      {e.tipo === 'permiso_llamada' && btn('Permitir llamadas', 'pl')}
      {e.tipo === 'catalogo' && btn('Ver catálogo', 'cat')}
      {e.tipo === 'carrusel' && <span style={{ display: 'flex', gap: 4, marginTop: 4, overflowX: 'auto' }}>{e.tarjetas?.map((t: any, i: number) => <span key={i} style={{ flexShrink: 0, width: 96, background: 'rgba(255,255,255,.15)', borderRadius: 8, overflow: 'hidden' }}><img src={t.imagen} alt="" style={{ width: 96, height: 64, objectFit: 'cover', display: 'block' }} /><span style={{ display: 'block', fontSize: 10, padding: '3px 5px', lineHeight: 1.3 }}>{t.cuerpo}</span></span>)}</span>}
      {(e.tipo === 'producto' || e.tipo === 'productos') && btn(e.tipo === 'producto' ? 'Ver producto' : 'Ver productos', 'pr')}
    </>);
  } else if (tipo === 'interactive' || tipo === 'button') {
    contenido = (<>
      <span style={{ fontSize: 10, fontWeight: 800, display: 'block', opacity: .7, marginBottom: 2 }}>{ETIQUETA_INTERACTIVO[item.metadata?.interactivo] || 'Respuesta'}</span>
      <span style={{ display: 'inline-block', background: fondoSuave, borderRadius: 8, padding: '5px 10px', fontWeight: 700 }}>{item.cuerpo || '—'}</span>
    </>);
  } else if (tipo === 'unsupported') {
    contenido = <span style={{ fontStyle: 'italic', opacity: .7 }}>{item.cuerpo || 'Mensaje no compatible'}</span>;
  } else if (tipo === 'template') {
    const botones: any[] = item.metadata?.botones || [];
    const esImg = src && /image/.test(item.mime || '') || (src && /\.(png|jpe?g|webp)(\?|$)/i.test(src));
    contenido = (<>
      <span style={{ fontSize: 9, fontWeight: 800, display: 'block', opacity: .7, marginBottom: 2 }}>PLANTILLA{item.metadata?.plantilla ? ` · ${item.metadata.plantilla}` : ''}</span>
      {src && esImg && !mediaRota && <img src={src} alt="" onClick={() => onLightbox({ ...item, media_url: src })} onError={() => setMediaRota(true)} style={{ borderRadius: 10, maxHeight: 200, maxWidth: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block', marginBottom: 6 }} />}
      {src && !esImg && <a href={src} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: fondoSuave, borderRadius: 8, padding: '8px 10px', textDecoration: 'none', color: tinta, fontSize: 12, fontWeight: 700, marginBottom: 6 }}><IcoDoc />{/video/.test(item.mime || '') ? 'Video' : 'Documento'} del encabezado</a>}
      <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo || ''} q={q} claro={claro} /></span>
      {botones.map((b: any, i: number) => <span key={i} style={{ display: 'block', textAlign: 'center', background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '6px 8px', fontSize: 12, fontWeight: 700, marginTop: 4 }}>{b.tipo === 'URL' ? '↗ ' : b.tipo === 'PHONE_NUMBER' ? '☎ ' : ''}{b.texto || b.tipo}</span>)}
    </>);
  } else if (item.cuerpo) {
    contenido = (<>
      <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo} q={q} claro={claro} /></span>
    </>);
  } else if (src) {
    contenido = <a href={src} target="_blank" rel="noreferrer" style={{ color: tinta, fontWeight: 700, fontSize: 12 }}>Abrir archivo</a>;
  } else {
    contenido = <span style={{ opacity: .6 }}>[{tipo}]</span>;
  }

  return (
    <span className="wa-msg" {...gestos} style={{ display: 'flex', flexDirection: 'column', alignItems: saliente ? 'flex-end' : 'flex-start', gap: 2, position: 'relative',
      // Sin esto, mantener el dedo dispara ADEMÁS el menú nativo de iOS
      // ("Copiar / Buscar") encima del nuestro. Copiar no se pierde: va como
      // acción de la hoja, igual que en WhatsApp.
      ...(onMantener ? { WebkitTouchCallout: 'none' as any, WebkitUserSelect: 'none' as any, userSelect: 'none' as const } : {}) }}>
      {/* El nombre solo cuando CAMBIA de autor: con tres mensajes seguidos
          tuyos se repetía tres veces y partía el bloque en tres. */}
      {saliente && !mismoAutorQueElAnterior && <span style={{ fontSize: 10, color: C.g400, padding: '0 4px' }}>{item.autor || 'Equipo SACS'}</span>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: saliente ? 'row-reverse' : 'row', maxWidth: '100%' }}>
        <span style={{
          ...(saliente ? burbuja.salienteWa : burbuja.entrante),
          boxShadow: conRing ? `0 0 0 2px ${C.morado}, 0 0 0 4px #fff` : 'none', transition: 'box-shadow .3s',
          opacity: item.status === 'failed' ? .75 : 1,
        }}>
          {cita !== null && item.metadata?.cita?.wamid && (
            <span onClick={() => { const el = document.getElementById(`wa-item-mensaje-${cita?.id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
              style={{ display: 'block', borderLeft: `3px solid ${saliente ? '#A7F3D0' : C.emerald500}`, background: saliente ? 'rgba(0,0,0,.12)' : C.g100, borderRadius: 6, padding: '4px 8px', marginBottom: 6, fontSize: 11, cursor: cita ? 'pointer' : 'default', maxWidth: 280 }}>
              <b style={{ display: 'block', fontSize: 10, opacity: .85 }}>{cita ? (cita.direccion === 'saliente' ? (cita.autor || 'Equipo SACS') : 'Cliente') : 'Mensaje citado'}</b>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: .9 }}>{cita ? resumenMensaje(cita).slice(0, 120) : '(mensaje anterior al historial)'}</span>
            </span>
          )}
          {contenido}
          <span style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 }}>
            {item.metadata?.editado && <span style={{ fontSize: 9, opacity: .7 }}>editado</span>}
            <span style={{ fontSize: 10, color: saliente ? '#A7F3D0' : C.g400 }}>{horaDe(item.enviado_at || item.created_at)}</span>
            <EstadoEntrega status={item.status} direccion={item.direccion} error={item.error} />
          </span>
        </span>
        {!item.borrado_at && item.kapso_message_id && (onCitar || onReenviar) && (
          <span className="wa-citar" style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
            {onCitar && <button onClick={() => onCitar(item)} title="Responder citando este mensaje" aria-label="Responder"
              style={{ border: 'none', background: '#fff', borderRadius: 999, width: 24, height: 24, cursor: 'pointer', color: C.g400, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.12)' }}>
              <IcoResponder />
            </button>}
            {onReaccionar && item.direccion === 'entrante' && (
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <button onClick={() => setPickReac(p => !p)} title="Reaccionar" aria-label="Reaccionar"
                  style={{ border: 'none', background: '#fff', borderRadius: 999, width: 24, height: 24, cursor: 'pointer', color: C.g400, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.12)', fontSize: 13 }}>☺</button>
                {pickReac && (
                  <span style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 999, padding: '3px 6px', display: 'flex', gap: 2, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 5 }}>
                    {EMOJIS_RAPIDOS.map(e => <button key={e} onClick={() => { setPickReac(false); onReaccionar(item, e); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>{e}</button>)}
                    {chips?.some(c => c.dir === 'saliente') && <button onClick={() => { setPickReac(false); onReaccionar(item, ''); }} title="Quitar mi reacción" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: C.g400, padding: '0 4px' }}>quitar</button>}
                  </span>
                )}
              </span>
            )}
            {onReenviar && (item.cuerpo || item.transcript || item.media_url) && <button onClick={() => onReenviar(item)} title="Reenviar a otra conversación" aria-label="Reenviar"
              style={{ border: 'none', background: '#fff', borderRadius: 999, width: 24, height: 24, cursor: 'pointer', color: C.g400, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.12)' }}>
              <IcoReenviar />
            </button>}
          </span>
        )}
      </span>
      {chips && chips.length > 0 && (
        <span style={{ display: 'flex', gap: 3, marginTop: -6, zIndex: 1, padding: '0 6px' }}>
          {chips.map((c, i) => (
            <span key={i} title={c.dir === 'saliente' ? 'Tu reacción' : 'Reacción del cliente'} style={{ background: '#fff', border: `1px solid ${c.dir === 'saliente' ? C.emerald500 : C.g200}`, borderRadius: 999, padding: '1px 6px', fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>{c.emoji}</span>
          ))}
        </span>
      )}
      {item.status === 'failed' && (
        <span className="wa-fallo" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', flexWrap: 'wrap' }}>
          {/* En un mensaje de la cola SÍ se dice el motivo también en el
              teléfono: no hay banda global que lo explique, y «Error» a secas
              no le dice a nadie que fue la señal. */}
          <span className={'wa-err-msg' + (item._cola ? ' wa-err-cola' : '')} style={{ fontSize: 10, color: C.rojo500 }} title={item.error || ''}>
            {(item._cola ? (item.error || 'No se pudo enviar') : errorLegible(item.error)).slice(0, 90)}
          </span>
          {onReintentar && saliente && (tipo === 'text' || src) && (
            <button onClick={() => onReintentar(item)} style={{ border: `1px solid ${C.rojo200}`, background: C.rojo50, color: C.rojo700, borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
          )}
        </span>
      )}
    </span>
  );
}
