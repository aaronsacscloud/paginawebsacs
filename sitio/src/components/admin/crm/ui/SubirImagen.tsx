// CRM · Campo de imagen: arrastra, pega o elige un archivo; se optimiza al
// tamaño del preset y se sube. Sustituye a "pega aquí la URL" en todo el CRM.
// El link sigue disponible como alternativa (para reusar una imagen existente).
import { useEffect, useRef, useState } from 'react';
import { optimizarImagen, subirAStorage, PRESETS, type PresetImagen } from '../../../../lib/crm/imagen';

const C = { g900: '#111827', g700: '#374151', g500: '#6B7280', g400: '#9CA3AF', g300: '#D1D5DB', g200: '#E5E7EB', g100: '#F3F4F6', g50: '#F9FAFB', morado: '#9B8CFA', moradoTinta: '#5B4BD6', moradoAgua: '#EEECFE', rojo: '#EF4444', rojo50: '#FEF2F2', rojo700: '#B91C1C', verde: '#1E8A63', verde50: '#EAF8F2' };

export default function SubirImagen({ valor, onCambio, preset = 'libre', carpeta = 'general', etiqueta, ayuda, alto = 150, permitirUrl = true }: {
  valor?: string | null;
  onCambio: (url: string | null) => void;
  preset?: keyof typeof PRESETS | PresetImagen;
  carpeta?: string;
  etiqueta?: string;
  ayuda?: string;
  alto?: number;
  permitirUrl?: boolean;
}) {
  const p: PresetImagen = typeof preset === 'string' ? PRESETS[preset] : preset;
  const [estado, setEstado] = useState<'idle' | 'trabajando' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState<string>('');
  const [drag, setDrag] = useState(false);
  const [modoUrl, setModoUrl] = useState(false);
  const [url, setUrl] = useState(valor || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setUrl(valor || ''); }, [valor]);

  const procesar = async (file: File | null | undefined) => {
    if (!file) return;
    setEstado('trabajando'); setMsg(''); setInfo('');
    try {
      const opt = await optimizarImagen(file, preset);
      const publica = await subirAStorage(opt.blob, opt.nombre, opt.mime, carpeta);
      setInfo(`${opt.ancho}×${opt.alto} · ${opt.original_kb} KB → ${opt.final_kb} KB`);
      setEstado('idle'); onCambio(publica);
    } catch (e: any) { setEstado('error'); setMsg(e?.message || String(e)); }
  };

  // Pegar desde el portapapeles (Cmd/Ctrl+V con la caja enfocada o el mouse encima).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!cajaRef.current?.matches(':hover') && document.activeElement !== cajaRef.current) return;
      const f = Array.from(e.clipboardData?.files || []).find(x => /^image\//.test(x.type));
      if (f) { e.preventDefault(); procesar(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [preset, carpeta]);

  const lab: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 };
  return (
    <div>
      {etiqueta && <label style={lab}>{etiqueta}</label>}
      {valor ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.g200}`, background: C.g50 }}>
          <img src={valor} alt="" style={{ display: 'block', width: '100%', height: alto, objectFit: p?.modo === 'contain' ? 'contain' : 'cover', background: C.g100 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', borderTop: `1px solid ${C.g100}` }}>
            <span style={{ fontSize: 10, color: C.verde, fontWeight: 700 }}>{info || 'Imagen lista'}</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => fileRef.current?.click()} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: C.g700, cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar</button>
            <button onClick={() => { onCambio(null); setInfo(''); setUrl(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 11, fontFamily: 'inherit' }}>Quitar</button>
          </div>
        </div>
      ) : (
        <div ref={cajaRef} tabIndex={0}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); procesar(e.dataTransfer.files?.[0]); }}
          onClick={() => estado !== 'trabajando' && fileRef.current?.click()}
          style={{ border: `2px dashed ${drag ? C.morado : estado === 'error' ? C.rojo : C.g300}`, background: drag ? C.moradoAgua : estado === 'error' ? C.rojo50 : C.g50, borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: estado === 'trabajando' ? 'progress' : 'pointer', outline: 'none' }}>
          {estado === 'trabajando' ? (
            <span style={{ fontSize: 12, color: C.moradoTinta, fontWeight: 700 }}>Optimizando y subiendo…</span>
          ) : (<>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={drag ? C.moradoTinta : C.g400} strokeWidth="1.7" style={{ marginBottom: 4 }}><path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" /></svg>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.g700 }}>Arrastra una imagen, pégala o haz clic</div>
            <div style={{ fontSize: 10.5, color: C.g400, marginTop: 3, lineHeight: 1.4 }}>
              {ayuda || `Se ajusta sola a ${p.ancho}×${p.alto}px y se comprime a ≤${p.maxKB} KB`}
            </div>
          </>)}
        </div>
      )}
      {estado === 'error' && msg && <div style={{ fontSize: 11, color: C.rojo700, marginTop: 5 }}>{msg}</div>}
      {permitirUrl && !valor && (
        <div style={{ marginTop: 6 }}>
          {!modoUrl ? (
            <button onClick={() => setModoUrl(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: C.g400, fontFamily: 'inherit', padding: 0 }}>o pegar una URL</button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
                style={{ flex: 1, minWidth: 0, border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={() => { if (/^https?:\/\/\S+$/i.test(url.trim())) { onCambio(url.trim()); setModoUrl(false); } else { setEstado('error'); setMsg('La URL debe empezar con http(s)://'); } }}
                style={{ border: 'none', background: C.morado, color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Usar</button>
            </div>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { procesar(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
