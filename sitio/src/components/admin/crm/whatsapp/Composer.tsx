// WHATSAPP · El composer: mensaje o nota interna, adjuntar archivo, y el
// candado de la ventana de 24 h — cerrada, solo queda la plantilla aprobada
// (mismo comportamiento que muestran los inbox profesionales).
import { useEffect, useRef, useState } from 'react';
import { Corazones } from '../ui/Cargando';

const btn = (primario?: boolean): React.CSSProperties => ({
  border: primario ? 'none' : '1px solid #e2e4e9', borderRadius: 9, padding: '8px 14px',
  background: primario ? '#9B8CFA' : '#fff', color: primario ? '#fff' : '#555',
  fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
});

export default function Composer({ ventana, api, telefono, equipo = [] }: { ventana: any; api: any; telefono: string; equipo?: any[] }) {
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'mensaje' | 'nota'>('mensaje');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [modalPlantilla, setModalPlantilla] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Respuestas rápidas: se cargan una vez; "/" al inicio abre el menú.
  const [respuestas, setRespuestas] = useState<any[]>([]);
  const [nuevaRespuesta, setNuevaRespuesta] = useState<{ atajo: string; texto: string } | null>(null);
  useEffect(() => {
    fetch('/api/crm/whatsapp/respuestas').then(r => r.json()).then(j => setRespuestas(j.respuestas || [])).catch(() => {});
  }, []);
  const slash = modo === 'mensaje' && texto.startsWith('/')
    ? respuestas.filter(r => `/${r.atajo}`.startsWith(texto.toLowerCase().split(' ')[0])).slice(0, 6)
    : [];
  // Menciones en notas: "@" + lo tecleado filtra al equipo.
  const arroba = modo === 'nota' ? (texto.match(/@([\wáéíóúñ]*)$/i)?.[1] ?? null) : null;
  const sugerenciasEquipo = arroba != null
    ? equipo.filter((m: any) => m.nombre.toLowerCase().startsWith(arroba.toLowerCase())).slice(0, 5)
    : [];

  const enviar = async () => {
    const t = texto.trim();
    if (!t || ocupado) return;
    setOcupado(true); setError('');
    const r = modo === 'nota' ? await api.crearNota(t) : await api.enviarTexto(t);
    setOcupado(false);
    if (r?.ventana_cerrada) { setError(''); setModalPlantilla(true); return; }
    if (r?.error) { setError(r.error); return; }
    setTexto('');
    areaRef.current?.focus();
  };

  const adjuntar = async (f: File | null) => {
    if (!f || ocupado) return;
    setOcupado(true); setError('');
    const r = await api.enviarArchivo(f);
    setOcupado(false);
    if (r?.ventana_cerrada) { setModalPlantilla(true); return; }
    if (r?.error) setError(r.error);
    if (fileRef.current) fileRef.current.value = '';
  };

  const cerrada = ventana && !ventana.abierta;

  return (
    <div style={{ borderTop: '1px solid #f0eff3', background: '#fff' }}>
      {cerrada && modo === 'mensaje' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#E3EDFD', padding: '10px 14px', fontSize: '0.74rem', color: '#2C5FC4', lineHeight: 1.5 }}>
          <b>La ventana de WhatsApp está cerrada.</b>
          <span style={{ flex: 1, minWidth: 180 }}>
            Meta no permite texto libre pasadas 24 h del último mensaje del cliente. Puedes mandar una plantilla aprobada, o esperar a que él escriba.
          </span>
          <button style={btn(true)} onClick={() => setModalPlantilla(true)}>Enviar plantilla</button>
        </div>
      )}
      {error && <div style={{ padding: '7px 14px', fontSize: '0.72rem', color: '#C0554E', background: '#FEF0EF' }}>{error}</div>}

      {slash.length > 0 && (
        <div style={{ margin: '8px 12px 0', border: '1px solid #e2dcfb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(40,20,90,.08)' }}>
          {slash.map(r => (
            <button key={r.id} onClick={() => { setTexto(r.texto); areaRef.current?.focus(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px', borderBottom: '1px solid #f7f6fa' }}>
              <b style={{ fontSize: '0.74rem', color: '#5B4BD6' }}>/{r.atajo}</b>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.texto}</span>
            </button>
          ))}
          <button onClick={() => setNuevaRespuesta({ atajo: texto.slice(1).split(' ')[0] || '', texto: '' })}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#fdfcff', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#2C5FC4' }}>
            + Nueva respuesta rápida
          </button>
        </div>
      )}
      {modo === 'mensaje' && texto.startsWith('/') && !slash.length && respuestas.length === 0 && (
        <div style={{ margin: '8px 12px 0' }}>
          <button onClick={() => setNuevaRespuesta({ atajo: texto.slice(1).split(' ')[0] || '', texto: '' })}
            style={{ border: '1px dashed #c9bcf7', background: '#fdfcff', color: '#5B4BD6', borderRadius: 9, padding: '7px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Crear tu primera respuesta rápida ("/{texto.slice(1).split(' ')[0] || 'atajo'}")
          </button>
        </div>
      )}
      {sugerenciasEquipo.length > 0 && (
        <div style={{ margin: '8px 12px 0', border: '1px solid #f3e3bd', borderRadius: 10, overflow: 'hidden' }}>
          {sugerenciasEquipo.map((m: any) => (
            <button key={m.id} onClick={() => { setTexto(texto.replace(/@[\wáéíóúñ]*$/i, `@${m.nombre.split(' ')[0]} `)); areaRef.current?.focus(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#fffdf6', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: '0.74rem', color: '#7a5a15', fontWeight: 600 }}>
              @{m.nombre}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '10px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['mensaje', 'nota'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)} title={m === 'nota' ? 'Nota interna: el cliente NO la ve' : 'Mensaje de WhatsApp'}
              style={{
                border: 'none', borderRadius: 7, padding: '4px 8px', fontSize: '0.62rem', fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.04em',
                background: modo === m ? (m === 'nota' ? '#FFF6E3' : '#EEECFE') : '#f4f4f6',
                color: modo === m ? (m === 'nota' ? '#9A6B15' : '#5B4BD6') : '#a5a2af',
              }}>{m}</button>
          ))}
        </div>
        <textarea ref={areaRef} value={texto} rows={1}
          onChange={e => { setTexto(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={modo === 'nota' ? 'Nota interna (el cliente no la ve)…' : cerrada ? 'Ventana cerrada: usa una plantilla →' : 'Escribe un mensaje… (Enter envía)'}
          disabled={modo === 'mensaje' && cerrada}
          style={{
            flex: 1, resize: 'none', border: '1.5px solid', borderColor: modo === 'nota' ? '#f3e3bd' : '#e4dffb',
            borderRadius: 10, padding: '10px 13px', fontSize: '0.85rem', fontFamily: 'inherit',
            background: modo === 'nota' ? '#fffdf6' : (cerrada ? '#f7f7f9' : '#fdfcff'), lineHeight: 1.45, maxHeight: 120,
          }} />
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.csv,.xlsx" hidden
          onChange={e => adjuntar(e.target.files?.[0] || null)} />
        <button title="Adjuntar archivo" onClick={() => fileRef.current?.click()} disabled={ocupado || (modo === 'mensaje' && cerrada)}
          style={{ ...btn(), padding: '8px 10px', opacity: (modo === 'mensaje' && cerrada) ? .45 : 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 11 12.5 18.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L10.6 15.8a1.7 1.7 0 0 1-2.4-2.4L15 6.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
        <button style={{ ...btn(true), opacity: (!texto.trim() || (modo === 'mensaje' && cerrada)) ? .5 : 1 }}
          disabled={ocupado || !texto.trim() || (modo === 'mensaje' && cerrada)} onClick={enviar}>
          {ocupado ? <Corazones size={9} color="#fff" /> : modo === 'nota' ? 'Guardar nota' : 'Enviar'}
        </button>
      </div>

      {modalPlantilla && (
        <SelectorPlantilla telefono={telefono} api={api} onClose={() => setModalPlantilla(false)} />
      )}
      {nuevaRespuesta && (
        <div onClick={() => setNuevaRespuesta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,40,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', width: 'min(440px, 94vw)' }}>
            <b style={{ fontSize: '0.9rem' }}>Nueva respuesta rápida</b>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#888', margin: '12px 0 4px' }}>Atajo (se escribe /atajo)</label>
            <input autoFocus value={nuevaRespuesta.atajo}
              onChange={e => setNuevaRespuesta({ ...nuevaRespuesta, atajo: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#888', margin: '10px 0 4px' }}>Texto que envía</label>
            <textarea value={nuevaRespuesta.texto} rows={3}
              onChange={e => setNuevaRespuesta({ ...nuevaRespuesta, texto: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button style={btn()} onClick={() => setNuevaRespuesta(null)}>Cancelar</button>
              <button style={btn(true)} disabled={!nuevaRespuesta.atajo || !nuevaRespuesta.texto.trim()}
                onClick={async () => {
                  const r = await fetch('/api/crm/whatsapp/respuestas', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nuevaRespuesta),
                  }).then(x => x.json()).catch(() => null);
                  if (r?.ok) setRespuestas(prev => [...prev.filter(x => x.id !== r.respuesta.id), r.respuesta].sort((a, b) => a.atajo.localeCompare(b.atajo)));
                  setNuevaRespuesta(null);
                }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Selector de plantillas APPROVED con inputs de variables. También lo usa
 *  "Nuevo chat" (una conversación nueva SIEMPRE arranca con plantilla). */
export function SelectorPlantilla({ telefono, api, onClose }: { telefono: string; api: any; onClose: () => void }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any>(null);
  const [params, setParams] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/crm/whatsapp/plantillas').then(r => r.json())
      .then(j => setLista((j.plantillas || []).filter((p: any) => p.status === 'APPROVED')))
      .catch(() => setLista([]));
  }, []);

  const enviar = async () => {
    setOcupado(true); setError('');
    const r = await api.enviarPlantilla({ nombre: sel.nombre, idioma: sel.idioma, params }, telefono);
    setOcupado(false);
    if (r?.error) { setError(r.error); return; }
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,40,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', width: 'min(480px, 94vw)', maxHeight: '84dvh', overflowY: 'auto' }}>
        <b style={{ fontSize: '0.9rem' }}>Enviar plantilla</b>
        {error && <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#C0554E' }}>{error}</div>}
        {lista === null && <div style={{ padding: 16, fontSize: '0.76rem', color: '#a5a2af' }}>Cargando plantillas…</div>}
        {lista?.length === 0 && (
          <div style={{ marginTop: 10, fontSize: '0.76rem', color: '#8a8a92', lineHeight: 1.6 }}>
            No hay plantillas aprobadas. Créala en WhatsApp → Plantillas y espera la aprobación de Meta.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {(lista || []).map(p => (
            <button key={p.id} onClick={() => { setSel(p); setParams(Array(p.variables || 0).fill('')); }}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 10, padding: '9px 12px',
                border: sel?.id === p.id ? '2px solid #9B8CFA' : '1px solid #e2e4e9',
                background: sel?.id === p.id ? '#f7f4ff' : '#fff',
              }}>
              <b style={{ fontSize: '0.78rem' }}>{p.nombre}</b>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#666', marginTop: 3 }}>{p.cuerpo}</span>
            </button>
          ))}
        </div>
        {sel && params.map((v, i) => (
          <div key={i} style={{ marginTop: 9 }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 3 }}>{`Variable {{${i + 1}}}`}</label>
            <input value={v} onChange={e => { const p = [...params]; p[i] = e.target.value; setParams(p); }}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 15, justifyContent: 'flex-end' }}>
          <button style={btn()} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn(true), opacity: sel ? 1 : .5 }} disabled={!sel || ocupado} onClick={enviar}>
            {ocupado ? <Corazones size={9} color="#fff" /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
