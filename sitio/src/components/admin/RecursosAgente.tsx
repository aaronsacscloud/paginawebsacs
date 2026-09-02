import { useEffect, useRef, useState } from 'react';

/* ═══ Recursos del agente ═══
 * Imágenes, PDF y videos que el agente puede adjuntar (y que el dueño adjunta al aprobar
 * o corregir). Cada recurso lleva QUÉ muestra y CUÁNDO usarlo: eso es lo que el agente
 * lee para decidir. La subida va directo a Storage con URL firmada (Vercel corta el body
 * en 4.5 MB y un video pesa más); la función solo firma y registra. Formatos: los que
 * WhatsApp admite —si no, el envío falla horas después sin que nadie lo vea. */
export type Recurso = { id: string; nombre: string; url: string; tipo: 'image' | 'document' | 'video'; descripcion?: string | null; cuando?: string | null; mime?: string | null; bytes?: number | null; usos?: number };
export type AdjuntoSel = { id: string; tipo: Recurso['tipo']; url: string; nombre: string; por_que?: string };

export const TIPO_L: Record<Recurso['tipo'], string> = { image: 'Imagen', document: 'PDF', video: 'Video' };
const ACEPTA = 'image/*,video/mp4,video/3gpp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
const mb = (n?: number | null) => n ? `${(n / 1048576).toFixed(n > 10485760 ? 0 : 1)} MB` : '';

export function MiniRecurso({ r, size = 56 }: { r: { tipo: Recurso['tipo']; url: string; nombre: string }; size?: number }) {
  const base: any = { width: size, height: size, borderRadius: 8, border: '1px solid #e8e5f0', background: '#f6f5fa', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  if (r.tipo === 'image') return <img src={r.url} alt={r.nombre} style={{ ...base, objectFit: 'cover' }} />;
  return (
    <div style={{ ...base, flexDirection: 'column', gap: 2, color: r.tipo === 'video' ? '#7c3aed' : '#b91c1c', fontWeight: 800, fontSize: size >= 56 ? '0.68rem' : '0.58rem', letterSpacing: '.04em' }}>
      <span style={{ fontSize: size >= 56 ? '1.3rem' : '1rem', lineHeight: 1 }}>{r.tipo === 'video' ? '▶' : '▤'}</span>{r.tipo === 'video' ? 'VIDEO' : 'PDF'}
    </div>
  );
}

/* Sube un archivo: firmar → PUT directo a Storage → registrar (con qué muestra y cuándo). */
export function Subidor({ onListo, compacto }: { onListo: (r: Recurso) => void; compacto?: boolean }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [f, setF] = useState({ nombre: '', descripcion: '', cuando: '' });
  const [estado, setEstado] = useState<'' | 'subiendo' | 'registrando'>('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const elegir = (file: File | null) => { setArchivo(file); setError(''); if (file && !f.nombre) setF(x => ({ ...x, nombre: file.name.replace(/\.[a-z0-9]+$/i, '') })); };
  const listo = !!archivo && f.nombre.trim().length >= 2 && !estado;
  const subir = async () => {
    if (!archivo || !listo) return;
    setError('');
    try {
      setEstado('subiendo');
      const firma = await fetch('/api/crm/ti/recurso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'firmar', nombre: archivo.name, mime: archivo.type, bytes: archivo.size }) }).then(r => r.json());
      if (firma.error) throw new Error(firma.error);
      const put = await fetch(firma.signedUrl, { method: 'PUT', headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'x-upsert': 'false' }, body: archivo });
      if (!put.ok) throw new Error(`La subida falló (${put.status})`);
      setEstado('registrando');
      const reg = await fetch('/api/crm/ti/recurso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'registrar', path: firma.path, nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), cuando: f.cuando.trim(), mime: archivo.type, bytes: archivo.size }) }).then(r => r.json());
      if (reg.error) throw new Error(reg.error);
      onListo(reg.recurso);
      setArchivo(null); setF({ nombre: '', descripcion: '', cuando: '' }); if (input.current) input.current.value = '';
    } catch (e: any) { setError(String(e?.message || e)); }
    setEstado('');
  };
  return (
    <div style={{ display: 'grid', gap: 6, padding: compacto ? '8px 10px' : '10px 12px', border: '1px dashed #d9d4ea', borderRadius: 10, background: '#fbfaff' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b6580' }}>Subir imagen, PDF o video</div>
      <input ref={input} type="file" accept={ACEPTA} onChange={ev => elegir(ev.target.files?.[0] || null)} style={{ fontSize: '0.78rem' }} />
      <div className="ti-suave" style={{ fontSize: '0.7rem', margin: 0 }}>WhatsApp admite: imagen JPG/PNG hasta 5 MB (WebP se convierte solo) · video MP4 hasta 16 MB · PDF hasta 100 MB.</div>
      {archivo && <div className="ti-suave" style={{ fontSize: '0.74rem', margin: 0 }}>{archivo.name} · {mb(archivo.size)}</div>}
      <input className="ti-envio-input" placeholder="Nombre corto (ej. Tabla de precios 2026)" value={f.nombre} onChange={ev => setF({ ...f, nombre: ev.target.value })} />
      <input className="ti-envio-input" placeholder="Qué muestra (para que el agente decida)" value={f.descripcion} onChange={ev => setF({ ...f, descripcion: ev.target.value })} />
      <input className="ti-envio-input" placeholder="Cuándo conviene mandarlo (ej. cuando pide precio con 2+ tiendas)" value={f.cuando} onChange={ev => setF({ ...f, cuando: ev.target.value })} />
      {error && <div style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>{error}</div>}
      <div><button className="ti-btn" disabled={!listo} onClick={subir}>{estado === 'subiendo' ? 'Subiendo…' : estado === 'registrando' ? 'Guardando…' : 'Subir y guardar en la galería'}</button></div>
    </div>
  );
}

/* Selector de adjuntos (máx. 2) para una respuesta: chips + galería + subida directa. */
export function SelectorAdjuntos({ valor, galeria, onChange, onNuevo, porQue, max = 2, disabled }: {
  valor: AdjuntoSel[]; galeria: Recurso[]; onChange: (adj: AdjuntoSel[]) => void; onNuevo?: (r: Recurso) => void; porQue?: Record<string, string>; max?: number; disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<'' | Recurso['tipo']>('');
  const agregar = (r: Recurso) => { if (valor.some(a => a.id === r.id) || valor.length >= max) return; onChange([...valor, { id: r.id, tipo: r.tipo, url: r.url, nombre: r.nombre }]); };
  const lista = galeria.filter(g => !filtro || g.tipo === filtro);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {valor.length === 0 && <span className="ti-suave" style={{ margin: 0, fontSize: '0.78rem' }}>Sin adjuntos.</span>}
        {valor.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e8e5f0', borderRadius: 10, padding: '4px 8px 4px 4px', background: '#fff' }}>
            <MiniRecurso r={a} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{a.nombre} <span className="ti-suave" style={{ margin: 0, fontWeight: 500 }}>· {TIPO_L[a.tipo]}</span></div>
              {porQue?.[a.id] && <div className="ti-suave" style={{ margin: 0, fontSize: '0.7rem' }}>El agente lo eligió: {porQue[a.id]}</div>}
            </div>
            {!disabled && <button onClick={() => onChange(valor.filter(x => x.id !== a.id))} title="Quitar" style={{ border: 'none', background: 'none', color: '#8e88a8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>}
          </div>
        ))}
        {!disabled && valor.length < max && <button className="ti-btn" onClick={() => setAbierto(a => !a)}>{abierto ? 'Cerrar' : valor.length ? 'Agregar otro…' : 'Adjuntar imagen, PDF o video…'}</button>}
      </div>
      {abierto && !disabled && (
        <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([['', 'Todo'], ['image', 'Imágenes'], ['document', 'PDF'], ['video', 'Videos']] as const).map(([v, l]) => (
              <button key={v} className={'ti-chip-btn' + (filtro === v ? ' on' : '')} onClick={() => setFiltro(v as any)}>{l} · {galeria.filter(g => !v || g.tipo === v).length}</button>
            ))}
          </div>
          {lista.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {lista.map(g => {
                const on = valor.some(a => a.id === g.id);
                return (
                  <button key={g.id} disabled={on || valor.length >= max} onClick={() => { agregar(g); }} title={g.cuando || ''} style={{ textAlign: 'left', border: `1px solid ${on ? '#5B4BD6' : '#e8e5f0'}`, background: on ? '#f3f0ff' : '#fff', borderRadius: 10, padding: 8, cursor: on ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MiniRecurso r={g} size={44} /><div style={{ minWidth: 0 }}><div style={{ fontSize: '0.76rem', fontWeight: 700 }}>{g.nombre}</div><div className="ti-suave" style={{ margin: 0, fontSize: '0.68rem' }}>{TIPO_L[g.tipo]}{g.bytes ? ` · ${mb(g.bytes)}` : ''}</div></div></div>
                    {(g.cuando || g.descripcion) && <div className="ti-suave" style={{ margin: '5px 0 0', fontSize: '0.7rem', lineHeight: 1.35 }}>{(g.cuando || g.descripcion || '').slice(0, 80)}</div>}
                  </button>
                );
              })}
            </div>
          )}
          <Subidor compacto onListo={r => { onNuevo?.(r); agregar(r); }} />
        </div>
      )}
    </div>
  );
}

/* La galería completa, para administrar: ver, subir, agregar por URL y quitar. */
export function GaleriaRecursos({ galeria, onQuitar, onNuevo, onNuevaUrl }: { galeria: Recurso[]; onQuitar: (id: string) => Promise<void>; onNuevo: (r: Recurso) => void; onNuevaUrl: (img: { nombre: string; url: string; descripcion: string; cuando: string }) => Promise<Recurso | null> }) {
  const [abierta, setAbierta] = useState(false);
  const [u, setU] = useState({ nombre: '', url: '', descripcion: '', cuando: '' });
  const [msg, setMsg] = useState('');
  const porTipo = (t: Recurso['tipo']) => galeria.filter(g => g.tipo === t).length;
  return (
    <div style={{ margin: '18px 0 6px' }}>
      <button onClick={() => setAbierta(a => !a)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 className="ti-h3" style={{ margin: 0 }}>Recursos del agente</h3>
        <span className="ti-chip chip-tipo">{porTipo('image')} imágenes · {porTipo('document')} PDF · {porTipo('video')} videos</span>
        <span className="ti-suave" style={{ margin: 0, fontSize: '0.75rem' }}>{abierta ? 'ocultar' : 'ver y agregar'}</span>
      </button>
      <p className="ti-porque" style={{ marginTop: 4 }}>Lo que el agente puede adjuntar solo. A cada recurso dile <b>qué muestra</b> y <b>cuándo conviene</b>: imagen para ver algo concreto (tallas y colores, apartado, tabla de precios), PDF para lo que el lead consulta después (ficha de precios, requisitos), video solo si lo pide o si el flujo se entiende mejor viéndolo.</p>
      {abierta && (
        <div style={{ display: 'grid', gap: 10 }}>
          {galeria.map(g => (
            <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e8e5f0', borderRadius: 10, padding: 8, background: '#fff' }}>
              <MiniRecurso r={g} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{g.nombre} <span className="ti-suave" style={{ margin: 0, fontWeight: 500 }}>· {TIPO_L[g.tipo]}{g.bytes ? ` · ${mb(g.bytes)}` : ''} · usado {g.usos || 0} {g.usos === 1 ? 'vez' : 'veces'}</span></div>
                {g.descripcion && <div style={{ fontSize: '0.76rem', color: '#4a4658' }}>Muestra: {g.descripcion}</div>}
                {g.cuando && <div className="ti-suave" style={{ margin: 0, fontSize: '0.74rem' }}>Cuándo: {g.cuando}</div>}
                <a href={g.url} target="_blank" rel="noopener" style={{ fontSize: '0.72rem', color: '#5B4BD6' }}>abrir</a>
              </div>
              <button className="ti-btn" onClick={() => onQuitar(g.id)}>Quitar</button>
            </div>
          ))}
          <Subidor onListo={onNuevo} />
          <div style={{ display: 'grid', gap: 6, padding: '10px 12px', border: '1px dashed #d9d4ea', borderRadius: 10, background: '#fbfaff' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b6580' }}>O agregar una imagen por URL pública</div>
            <input className="ti-envio-input" placeholder="https://… (JPG, PNG o WebP; se convierte a JPG)" value={u.url} onChange={ev => setU({ ...u, url: ev.target.value })} />
            <input className="ti-envio-input" placeholder="Nombre corto" value={u.nombre} onChange={ev => setU({ ...u, nombre: ev.target.value })} />
            <input className="ti-envio-input" placeholder="Qué muestra" value={u.descripcion} onChange={ev => setU({ ...u, descripcion: ev.target.value })} />
            <input className="ti-envio-input" placeholder="Cuándo conviene mandarla" value={u.cuando} onChange={ev => setU({ ...u, cuando: ev.target.value })} />
            {msg && <div style={{ fontSize: '0.75rem', color: msg.startsWith('No') ? '#7f1d1d' : '#14532d' }}>{msg}</div>}
            <div><button className="ti-btn" disabled={u.nombre.trim().length < 2 || !/^https?:\/\//.test(u.url)} onClick={async () => { const r = await onNuevaUrl({ nombre: u.nombre.trim(), url: u.url.trim(), descripcion: u.descripcion.trim(), cuando: u.cuando.trim() }); setMsg(r ? 'Guardada.' : 'No se pudo guardar.'); if (r) setU({ nombre: '', url: '', descripcion: '', cuando: '' }); }}>Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
