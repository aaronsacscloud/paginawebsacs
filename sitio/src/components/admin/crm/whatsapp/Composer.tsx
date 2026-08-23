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

export default function Composer({ ventana, api, telefono }: { ventana: any; api: any; telefono: string }) {
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'mensaje' | 'nota'>('mensaje');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [modalPlantilla, setModalPlantilla] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

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
            borderRadius: 10, padding: '9px 12px', fontSize: '0.82rem', fontFamily: 'inherit',
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
