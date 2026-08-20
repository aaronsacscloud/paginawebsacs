// Datos del usuario: nombre completo, correo y foto.
//
// La foto no es adorno: hoy en el pie del menú, en la actividad de cada cliente
// y en el anfitrión de las reuniones sale un cuadrito con dos letras. Con
// varias personas dentro del CRM, "quién hizo esto" se responde de un vistazo
// con una cara y no leyendo iniciales.
//
// El correo es la credencial de acceso: cambiarlo cambia con qué se entra la
// próxima vez, así que se avisa antes de guardar.
import { useEffect, useRef, useState } from 'react';
import { Corazones } from './ui/Cargando';

const iniciales = (n?: string | null) => {
  const t = String(n || '').trim();
  if (!t) return '—';
  const p = t.split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || t.slice(0, 2).toUpperCase();
};

export default function MiPerfil({ onGuardado }: { onGuardado?: (p: any) => void }) {
  const [p, setP] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; x: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/crm/perfil').then(r => r.json()).then(j => {
      if (j?.error) return;
      setP(j); setNombre(j.nombre || ''); setEmail(j.email || ''); setFoto(j.foto_url || '');
    }).catch(() => {});
  }, []);

  const sucio = p && (nombre !== (p.nombre || '') || email !== (p.email || '') || foto !== (p.foto_url || ''));
  const cambiaCorreo = p && email !== (p.email || '');

  async function subir(f: File) {
    setSubiendo(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd });
      const j = await r.json();
      if (j?.url) setFoto(j.url);
      else setMsg({ t: 'err', x: j?.error || 'No se pudo subir la imagen.' });
    } catch { setMsg({ t: 'err', x: 'No se pudo subir la imagen.' }); }
    setSubiendo(false);
  }

  async function guardar() {
    if (cambiaCorreo && !confirm(`El correo es con el que entras al CRM.\n\nA partir de ahora entrarías con:\n${email}\n\n¿Guardar?`)) return;
    setGuardando(true); setMsg(null);
    const r = await fetch('/api/crm/perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, foto_url: foto }),
    });
    const j = await r.json().catch(() => ({}));
    setGuardando(false);
    if (!r.ok) { setMsg({ t: 'err', x: j?.error || 'No se pudo guardar.' }); return; }
    setP({ ...p, ...j.perfil });
    setMsg({ t: 'ok', x: 'Guardado.' });
    onGuardado?.(j.perfil);
  }

  if (!p) return <div style={{ padding: 20 }}><Corazones /></div>;

  const campo = { display: 'flex', flexDirection: 'column' as const, gap: 5, minWidth: 220, flex: '1 1 220px' };
  const rotulo = { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#a49dbd' };
  const input = { border: '1px solid #eae4f8', borderRadius: 9, padding: '9px 11px', fontFamily: 'inherit', fontSize: '0.83rem', color: '#241d43', background: '#FBFAFF', outline: 'none' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Foto */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => fileRef.current?.click()}
            title="Cambiar foto"
            style={{
              width: 74, height: 74, borderRadius: 20, border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
              background: foto ? `#fff url(${foto}) center/cover no-repeat` : 'linear-gradient(135deg,#9B8CFA,#7DA6F5)',
              color: '#fff', fontSize: '1.35rem', fontWeight: 800, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {!foto && iniciales(nombre || email)}
          </button>
          <span style={{
            position: 'absolute', right: -5, bottom: -5, width: 26, height: 26, borderRadius: 99,
            background: '#fff', border: '1px solid #eae4f8', boxShadow: '0 2px 6px rgba(40,20,90,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            {subiendo ? <Corazones size={8} /> : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C6BF0" strokeWidth="2">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3" />
              </svg>
            )}
          </span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} />
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
          <label style={campo}>
            <span style={rotulo}>Nombre completo</span>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={input} />
          </label>
          <label style={campo}>
            <span style={rotulo}>Correo</span>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={input} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <a href="/admin/cambiar-password" style={{ border: '1px solid #e6dff7', background: '#fff', borderRadius: 9, fontSize: '0.75rem', fontWeight: 700, color: '#4b4560', padding: '8px 13px', textDecoration: 'none' }}>Cambiar contraseña</a>
          <button onClick={guardar} disabled={!sucio || guardando}
            style={{ border: 'none', background: sucio ? '#9B8CFA' : '#e6e2f3', color: '#fff', borderRadius: 9, fontSize: '0.75rem', fontWeight: 800, padding: '9px 15px', cursor: sucio ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {foto && <button onClick={() => setFoto('')} style={{ border: 'none', background: 'none', color: '#8e88a8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Quitar foto</button>}
        {cambiaCorreo && <span style={{ fontSize: '0.72rem', color: '#9a6a10', background: '#FFF4E5', borderRadius: 8, padding: '5px 10px' }}>Con este correo entrarás la próxima vez.</span>}
        {msg && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: msg.t === 'ok' ? '#1E8A63' : '#C0554E' }}>{msg.x}</span>}
      </div>

      <div style={{ marginTop: 14, fontSize: '0.74rem', color: '#6b7280', lineHeight: 1.6, background: '#FBFAFF', border: '1px solid #f0edfa', borderRadius: 11, padding: '11px 13px' }}>
        Tu foto se usa en el <b>pie del menú</b>, en la <b>actividad de cada cliente</b> —para saber quién hizo qué— y como
        anfitrión en las reuniones. Sin foto se muestran tus iniciales.
      </div>
    </div>
  );
}
