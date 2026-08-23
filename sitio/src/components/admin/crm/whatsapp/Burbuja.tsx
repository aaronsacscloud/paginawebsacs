// INBOX · La burbuja de un mensaje de WhatsApp, con TODOS los tipos que Meta
// entrega: texto, imagen, video, audio/nota de voz, documento, sticker,
// ubicación, contacto compartido, respuesta de botón/lista, plantilla,
// reacción (la pinta Hilo como chip), borrado, no compatible.
// También: cita (context), autor del saliente, reintentar en failed y
// "responder" (cita) en hover.
import { useRef, useState } from 'react';
import { C, burbuja } from './estilo';
import EstadoEntrega from './EstadoEntrega';

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
export function Linkify({ texto, claro }: { texto: string; claro?: boolean }) {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  return (<>
    {partes.map((p, i) => /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: claro ? '#fff' : C.azulTinta, textDecoration: 'underline', wordBreak: 'break-all' }}>{p}</a>
      : <span key={i}>{p}</span>)}
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

export default function BurbujaMensaje({ item, q, conRing, chips, porWamid, onLightbox, onCitar, onReintentar }: {
  item: any; q: string; conRing: boolean; chips?: string[] | null;
  porWamid: Map<string, any>;
  onLightbox: (src: string) => void;
  onCitar?: (item: any) => void;
  onReintentar?: (item: any) => void;
}) {
  const saliente = item.direccion === 'saliente';
  const claro = saliente;
  const src = srcMedia(item);
  const tipo = item.tipo || 'text';
  const cita = item.metadata?.cita?.wamid ? porWamid.get(item.metadata.cita.wamid) : null;
  const fondoSuave = saliente ? 'rgba(255,255,255,.15)' : C.g50;
  const [mediaRota, setMediaRota] = useState(false);
  const tinta = saliente ? '#fff' : C.azulTinta;

  let contenido: any;
  if (item.borrado_at) {
    contenido = <span style={{ fontStyle: 'italic', opacity: .7, display: 'flex', alignItems: 'center', gap: 5 }}>🚫 Mensaje eliminado</span>;
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
      {src && !mediaRota ? <img src={src} alt={item.cuerpo || ''} onClick={() => onLightbox(src)} loading="lazy" onError={() => setMediaRota(true)}
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
    const nombre = item.filename || item.cuerpo || 'Documento';
    contenido = (<>
      <a href={srcMedia(item, true) || '#'} target="_blank" rel="noreferrer" download={item.filename || undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: fondoSuave, borderRadius: 8, padding: '8px 10px', textDecoration: 'none', color: tinta, fontSize: 12, fontWeight: 700, marginBottom: item.cuerpo && item.cuerpo !== nombre ? 6 : 0 }}>
        <IcoDoc /><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{nombre}</span>
        <span style={{ fontSize: 10, opacity: .75, flexShrink: 0 }}>{src ? 'Descargar' : 'No disponible'}</span>
      </a>
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
  } else if (tipo === 'interactive' || tipo === 'button') {
    contenido = (<>
      <span style={{ fontSize: 10, fontWeight: 800, display: 'block', opacity: .7, marginBottom: 2 }}>{ETIQUETA_INTERACTIVO[item.metadata?.interactivo] || 'Respuesta'}</span>
      <span style={{ display: 'inline-block', background: fondoSuave, borderRadius: 8, padding: '5px 10px', fontWeight: 700 }}>{item.cuerpo || '—'}</span>
    </>);
  } else if (tipo === 'unsupported') {
    contenido = <span style={{ fontStyle: 'italic', opacity: .7 }}>{item.cuerpo || 'Mensaje no compatible'}</span>;
  } else if (item.cuerpo) {
    contenido = (<>
      {tipo === 'template' && <span style={{ fontSize: 9, fontWeight: 800, display: 'block', opacity: .7, marginBottom: 2 }}>PLANTILLA</span>}
      <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.cuerpo} q={q} claro={claro} /></span>
    </>);
  } else if (src) {
    contenido = <a href={src} target="_blank" rel="noreferrer" style={{ color: tinta, fontWeight: 700, fontSize: 12 }}>Abrir archivo</a>;
  } else {
    contenido = <span style={{ opacity: .6 }}>[{tipo}]</span>;
  }

  return (
    <span className="wa-msg" style={{ display: 'flex', flexDirection: 'column', alignItems: saliente ? 'flex-end' : 'flex-start', gap: 2, position: 'relative' }}>
      {saliente && <span style={{ fontSize: 10, color: C.g400, padding: '0 4px' }}>{item.autor || 'Equipo SACS'}</span>}
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
        {onCitar && !item.borrado_at && item.kapso_message_id && (
          <button className="wa-citar" onClick={() => onCitar(item)} title="Responder citando este mensaje" aria-label="Responder"
            style={{ border: 'none', background: '#fff', borderRadius: 999, width: 24, height: 24, cursor: 'pointer', color: C.g400, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.12)', flexShrink: 0 }}>
            <IcoResponder />
          </button>
        )}
      </span>
      {chips && chips.length > 0 && (
        <span style={{ display: 'flex', gap: 3, marginTop: -6, zIndex: 1, padding: '0 6px' }}>
          {chips.map((emoji: string, i: number) => (
            <span key={i} style={{ background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 999, padding: '1px 6px', fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>{emoji}</span>
          ))}
        </span>
      )}
      {item.status === 'failed' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          <span style={{ fontSize: 10, color: C.rojo500 }}>{(item.error || 'No se pudo enviar').slice(0, 90)}</span>
          {onReintentar && saliente && (tipo === 'text' || src) && (
            <button onClick={() => onReintentar(item)} style={{ border: `1px solid ${C.rojo200}`, background: C.rojo50, color: C.rojo700, borderRadius: 999, padding: '1px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
          )}
        </span>
      )}
    </span>
  );
}
