// Documentos de una suscripción: el contrato firmado, sus anexos, un
// comprobante. Vivían en ningún lado — se mandaban por correo y se perdían.
//
// Las ligas que devuelve el servidor CADUCAN, así que no se guardan ni se
// comparten: al cerrar y volver a abrir se piden de nuevo. Es a propósito, es
// lo que evita que un contrato quede accesible con una URL eterna.
import { useEffect, useRef, useState } from 'react';

const peso = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const fecha = (s: string) => new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');

export default function ArchivosSuscripcion({ subId, nombre, onCerrar, onCambio }: {
  subId: string; nombre?: string; onCerrar: () => void; onCambio?: (n: number) => void;
}) {
  const [archivos, setArchivos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement | null>(null);

  const cargar = () => fetch(`/api/crm/suscripciones/archivos?id=${subId}`).then(r => r.json())
    .then(j => { setArchivos(j.archivos || []); onCambio?.((j.archivos || []).length); setCargando(false); })
    .catch(() => setCargando(false));
  useEffect(() => { cargar(); }, [subId]);

  const subir = async (f: File) => {
    // Se avisa ANTES de mandarlo: subir 8 MB para que lo rechacen al final es
    // esperar en balde con datos móviles.
    if (f.size > 4 * 1024 * 1024) {
      setError(`"${f.name}" pesa ${(f.size / 1048576).toFixed(1)} MB y el máximo son 4 MB. Comprime el PDF antes de subirlo.`);
      return;
    }
    setError(''); setSubiendo(true);
    const fd = new FormData(); fd.append('id', subId); fd.append('file', f);
    // Se lee la respuesta como TEXTO primero: cuando la petición muere por
    // tamaño, el servidor contesta HTML y r.json() reventaba con un error de
    // parseo que no decía nada de lo que pasó.
    const r = await fetch('/api/crm/suscripciones/archivos', { method: 'POST', body: fd }).catch(() => null);
    setSubiendo(false);
    if (!r) { setError('No se pudo conectar. Revisa tu internet e intenta de nuevo.'); return; }
    const txt = await r.text().catch(() => '');
    let j: any = null;
    try { j = JSON.parse(txt); } catch { /* no era JSON */ }
    if (!r.ok || j?.error) {
      setError(j?.error || (r.status === 413
        ? 'El archivo es demasiado grande. El máximo son 4 MB.'
        : `El servidor respondió ${r.status}. ${txt.slice(0, 120)}`));
      return;
    }
    cargar();
  };

  const borrar = async (a: any) => {
    if (!confirm(`¿Borrar "${a.nombre}"?\n\nSe elimina el archivo, no solo el enlace.`)) return;
    await fetch('/api/crm/suscripciones/archivos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subId, path: a.path }),
    }).catch(() => {});
    cargar();
  };

  return (
    <div onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 560, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f1eff7', background: '#faf8ff', borderRadius: '14px 14px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, flex: 1 }}>Documentos de la suscripción</h3>
            <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
          {nombre && <div style={{ fontSize: '0.75rem', color: '#7a6fc9', marginTop: 2 }}>{nombre}</div>}
        </div>

        <div style={{ padding: '12px 18px', overflowY: 'auto', flex: 1 }}>
          {cargando && <div style={{ padding: 20, textAlign: 'center', color: '#9c99a6', fontSize: '0.85rem' }}>Cargando…</div>}
          {!cargando && archivos.length === 0 && (
            <div style={{ padding: '18px 0', color: '#9c99a6', fontSize: '0.82rem' }}>Todavía no hay documentos. Sube el contrato firmado o cualquier anexo.</div>
          )}
          {archivos.map((a: any) => (
            <div key={a.path} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid #f7f6fa' }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: '#EEECFE', color: '#5B4BD6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                {(a.nombre.split('.').pop() || '?').slice(0, 4).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{peso(a.size)} · {fecha(a.subido_at)}</div>
              </div>
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer"
                  style={{ border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '5px 12px', fontSize: '0.73rem', fontWeight: 700, color: '#2C5FC4', textDecoration: 'none' }}>Abrir</a>
              )}
              <button onClick={() => borrar(a)}
                style={{ border: '1px solid #e2e2e8', background: '#fff', borderRadius: 9, padding: '5px 10px', fontSize: '0.73rem', color: '#C0554E', cursor: 'pointer' }}>Borrar</button>
            </div>
          ))}
          {error && <div style={{ marginTop: 10, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 9, alignItems: 'center' }}>
          <input ref={input} type="file" style={{ display: 'none' }}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} />
          <button onClick={() => input.current?.click()} disabled={subiendo}
            style={{ border: 'none', borderRadius: 9, padding: '9px 16px', background: '#9B8CFA', color: '#fff', fontSize: '0.79rem', fontWeight: 700, cursor: subiendo ? 'wait' : 'pointer', opacity: subiendo ? .6 : 1 }}>
            {subiendo ? 'Subiendo…' : 'Subir documento'}
          </button>
          <span style={{ fontSize: '0.68rem', color: '#a5a2af', lineHeight: 1.4 }}>
            PDF, Word o imagen · hasta 4 MB.<br />Los enlaces caducan en una hora: no se pueden compartir por fuera.
          </span>
        </div>
      </div>
    </div>
  );
}
