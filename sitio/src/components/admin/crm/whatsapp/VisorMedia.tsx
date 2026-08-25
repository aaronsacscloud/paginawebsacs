// WHATSAPP · Ver los adjuntos SIN descargarlos.
//
// `MediaEnLinea` pinta la miniatura real dentro del mensaje (imagen, video,
// audio con player, documento con su carátula) y `VisorMedia` los abre a
// pantalla completa: las imágenes con zoom, los PDF en un visor embebido, el
// video con controles. Se usa en el hilo del inbox, en la ficha del cliente y
// en el tab de Adjuntos, para que todos se vean igual.
import { useEffect, useState } from 'react';

const esImagen = (m: any) => m?.tipo === 'image' || m?.tipo === 'sticker' || /^image\//.test(m?.mime || '') || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(m?.media_url || '');
const esVideo = (m: any) => m?.tipo === 'video' || /^video\//.test(m?.mime || '') || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(m?.media_url || '');
const esAudio = (m: any) => m?.tipo === 'audio' || /^audio\//.test(m?.mime || '') || /\.(ogg|oga|mp3|m4a|opus|amr)(\?|$)/i.test(m?.media_url || '');
const esPdf = (m: any) => /pdf/i.test(m?.mime || '') || /\.pdf(\?|$)/i.test(m?.media_url || '');

/** Etiqueta corta del tipo de archivo, para la carátula del documento. */
export function extensionDe(m: any): string {
  const u = (m?.media_url || '').split('?')[0];
  const ext = u.includes('.') ? u.split('.').pop()!.toLowerCase() : '';
  if (ext && ext.length <= 5) return ext.toUpperCase();
  const mime = (m?.mime || '').toLowerCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'XLSX';
  if (mime.includes('word')) return 'DOCX';
  if (mime.includes('xml')) return 'XML';
  if (mime.includes('zip')) return 'ZIP';
  return 'ARCHIVO';
}
const COLOR_EXT: Record<string, string> = {
  PDF: '#C0554E', XML: '#9a6a10', XLSX: '#1E8A63', XLS: '#1E8A63', CSV: '#1E8A63',
  DOCX: '#2C5FC4', DOC: '#2C5FC4', ZIP: '#5B4BD6', TXT: '#666',
};

/** Miniatura dentro del mensaje. Click → visor. */
export function MediaEnLinea({ m, onAbrir, max = 240 }: { m: any; onAbrir: (m: any) => void; max?: number }) {
  const [rota, setRota] = useState(false);
  const url = m?.media_url;
  if (!url) return null;

  if (esImagen(m) && !rota) {
    return (
      <img src={url} alt={m.cuerpo || 'Imagen'} loading="lazy" onError={() => setRota(true)}
        onClick={() => onAbrir(m)}
        style={{ display: 'block', maxWidth: '100%', maxHeight: m.tipo === 'sticker' ? 120 : max,
                 borderRadius: 10, cursor: 'zoom-in', marginBottom: 5, objectFit: 'cover',
                 background: m.tipo === 'sticker' ? 'transparent' : '#f1f0f6' }} />
    );
  }
  if (esVideo(m) && !rota) {
    return (
      <video src={url} controls preload="metadata" onError={() => setRota(true)}
        style={{ display: 'block', maxWidth: '100%', maxHeight: max, borderRadius: 10, marginBottom: 5, background: '#000' }} />
    );
  }
  if (esAudio(m)) {
    return <audio src={url} controls preload="none" style={{ display: 'block', width: '100%', maxWidth: 260, marginBottom: 5, height: 34 }} />;
  }
  // Documento: carátula con la extensión y un CTA que ABRE, no descarga.
  const ext = extensionDe(m);
  const color = COLOR_EXT[ext] || '#5B4BD6';
  return (
    <button onClick={() => onAbrir(m)} style={{
      display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'rgba(255,255,255,.7)', border: '1px solid rgba(0,0,0,.06)', borderRadius: 9,
      padding: '7px 9px', marginBottom: 5, fontFamily: 'inherit',
    }}>
      <span style={{ width: 32, height: 38, borderRadius: 5, background: color, color: '#fff', fontSize: 9,
                     fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ext}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.filename || m.cuerpo || `Documento ${ext}`}
        </b>
        <span style={{ fontSize: 10, color: '#8a8a92' }}>{esPdf(m) ? 'Clic para verlo aquí mismo' : 'Clic para abrirlo'}</span>
      </span>
    </button>
  );
}

/** Pantalla completa: imagen con zoom, PDF embebido, video con controles. */
export default function VisorMedia({ m, onCerrar }: { m: any; onCerrar: () => void }) {
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onCerrar]);
  const url = m?.media_url;
  if (!url) return null;
  const nombre = m.filename || m.cuerpo || extensionDe(m);

  return (
    <div onClick={onCerrar} role="dialog" style={{
      position: 'fixed', inset: 0, background: 'rgba(12,10,22,.88)', zIndex: 1200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 22,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 1100, marginBottom: 10, color: '#fff' }}>
        <b style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</b>
        <span style={{ flex: 1 }} />
        <a href={url} target="_blank" rel="noreferrer" download={m.filename || undefined}
           style={{ fontSize: 12, fontWeight: 700, color: '#cfc7ff', textDecoration: 'none' }}>Descargar</a>
        <button onClick={onCerrar} aria-label="Cerrar" style={{ border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}>✕</button>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {esImagen(m) ? (
          <img src={url} alt={nombre} onClick={() => setZoom(z => !z)}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8,
                     cursor: zoom ? 'zoom-out' : 'zoom-in', transform: zoom ? 'scale(1.8)' : 'none', transition: 'transform .2s' }} />
        ) : esVideo(m) ? (
          <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, background: '#000' }} />
        ) : esAudio(m) ? (
          <audio src={url} controls autoPlay style={{ width: 'min(520px, 90%)' }} />
        ) : esPdf(m) ? (
          <iframe src={url} title={nombre} style={{ width: '100%', height: '100%', minHeight: '70vh', border: 'none', borderRadius: 8, background: '#fff' }} />
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, padding: '26px 30px', textAlign: 'center', maxWidth: 420 }}>
            <b style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>{nombre}</b>
            <p style={{ fontSize: 12, color: '#8a8a92', margin: '0 0 14px' }}>Este tipo de archivo ({extensionDe(m)}) no se puede ver dentro del CRM.</p>
            <a href={url} target="_blank" rel="noreferrer" download={m.filename || undefined}
               style={{ display: 'inline-block', background: '#9B8CFA', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Descargarlo</a>
          </div>
        )}
      </div>
    </div>
  );
}
