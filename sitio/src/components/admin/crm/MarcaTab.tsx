// Ajustes › Mi marca.
//
// La marca con la que salen las minutas y los reportes que firma este usuario.
// Es POR USUARIO, no por cuenta: si mañana entra otra consultora, sube su logo,
// elige su color y sus documentos salen con su nombre sin tocar los de nadie.
import { useEffect, useRef, useState } from 'react';
import Cargando, { Corazones } from './ui/Cargando';

const D = {
  card: { background: '#fff', border: '1px solid #eeecf3', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,.04)' } as React.CSSProperties,
  lbl: { fontSize: '0.62rem', fontWeight: 800, color: '#7a7684', textTransform: 'uppercase', letterSpacing: '.07em', margin: '18px 0 6px' } as React.CSSProperties,
  input: { width: '100%', border: '1px solid #e6e3ee', borderRadius: 9, padding: '9px 12px', fontSize: '0.82rem', color: '#2e2b38', fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
  hint: { fontSize: '0.72rem', color: '#9a97a5', lineHeight: 1.5, marginTop: 5 } as React.CSSProperties,
  btn: { border: 'none', borderRadius: 9, padding: '9px 16px', background: '#9B8CFA', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  btnG: { border: '1px solid #e2e0e8', borderRadius: 9, padding: '8px 14px', background: '#fff', fontSize: '0.79rem', fontWeight: 600, color: '#4a4a52', cursor: 'pointer' } as React.CSSProperties,
};

type Acento = { clave: string; label: string; swatch: string; hd: string };

export default function MarcaTab({ sinTitulo }: { sinTitulo?: boolean } = {}) {
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [marca, setMarca] = useState<any>(null);
  const [acentos, setAcentos] = useState<Acento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(); }, []);
  async function cargar() {
    const j = await fetch('/api/crm/marca').then(r => r.json()).catch(() => null);
    setCargando(false);
    if (!j || j.error) { setError(j?.error || 'No se pudo cargar tu marca.'); return; }
    setCampos(Object.fromEntries(Object.entries(j.campos || {}).map(([k, v]) => [k, (v as string) || ''])));
    setMarca(j.marca); setAcentos(j.acentos || []);
  }

  const set = (k: string, v: string) => { setCampos(c => ({ ...c, [k]: v })); setMsg(''); };

  async function guardar() {
    setGuardando(true); setError(''); setMsg('');
    const j = await fetch('/api/crm/marca', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    }).then(r => r.json()).catch(() => null);
    setGuardando(false);
    if (!j || j.error) { setError(j?.error || 'No se pudo guardar.'); return; }
    setMarca(j.marca); setMsg('Tu marca quedó guardada. Las minutas que descargues salen así.');
  }

  async function subirLogo(f: File) {
    setSubiendo(true); setError('');
    const fd = new FormData(); fd.append('file', f);
    const j = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd }).then(r => r.json()).catch(() => null);
    setSubiendo(false);
    if (!j || j.error) { setError(j?.error || 'No se pudo subir el logo.'); return; }
    set('marca_logo_url', j.url);
  }

  if (cargando) return <Cargando texto="Cargando tu marca…" alto={200} />;

  const acento = acentos.find(a => a.clave === (campos.marca_acento || 'rosa')) || acentos[0];
  const nombreVista = campos.marca_nombre || marca?.nombre || 'Tu marca';
  const logoVista = campos.marca_logo_url || null;
  const inis = (marca?.iniciales || 'SC');

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
      {!sinTitulo && <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 800 }}>Mi marca</h2>}
      <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: '#8d8a97', lineHeight: 1.6, maxWidth: 640 }}>
        Con esto salen las minutas que descargas y compartes con el cliente. Es tuya: cada persona del equipo
        configura la suya y firma sus propios documentos.
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...D.card, width: 440, maxWidth: '100%' }}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ ...D.lbl, marginTop: 0 }}>Logo</div>
            <div onClick={() => file.current?.click()}
              style={{ border: '1.5px dashed #e0dceb', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 13, background: '#fcfbfe', cursor: 'pointer' }}>
              <div style={{ width: 54, height: 54, borderRadius: 11, background: '#fff', border: '1px solid #efecf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {logoVista
                  ? <img src={logoVista} alt="logo" style={{ maxWidth: 44, maxHeight: 44, objectFit: 'contain' }} />
                  : <b style={{ fontFamily: 'Georgia, serif', fontSize: '1.15rem', color: '#B93C74', fontWeight: 400 }}>{inis}</b>}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#4a4a52', lineHeight: 1.5, flex: 1 }}>
                <b style={{ display: 'block', fontSize: '0.79rem', color: '#1a1a1a', marginBottom: 2 }}>
                  {subiendo ? 'Subiendo…' : logoVista ? 'Cambiar logo' : 'Sube tu logo'}
                </b>
                PNG o SVG con fondo transparente, mínimo 200 px de alto.
                <span style={{ display: 'block', color: '#a09daa', fontSize: '0.7rem' }}>Sin logo usamos el monograma con tus iniciales.</span>
              </div>
              {logoVista && (
                <button onClick={e => { e.stopPropagation(); set('marca_logo_url', ''); }} style={{ ...D.btnG, padding: '5px 10px', fontSize: '0.72rem' }}>Quitar</button>
              )}
            </div>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }} />

            <div style={D.lbl}>Nombre de la marca</div>
            <input style={D.input} value={campos.marca_nombre || ''} onChange={e => set('marca_nombre', e.target.value)}
              placeholder={marca?.nombre || 'Consultorías Andy'} />

            <div style={D.lbl}>Línea de apoyo</div>
            <input style={D.input} value={campos.marca_linea || ''} onChange={e => set('marca_linea', e.target.value)}
              placeholder="Acompañamiento estratégico · SACSCloud" />

            <div style={D.lbl}>Color de acento</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {acentos.map(a => {
                const on = (campos.marca_acento || 'rosa') === a.clave;
                return (
                  <button key={a.clave} onClick={() => set('marca_acento', a.clave)} title={a.label}
                    style={{ width: 40, height: 40, borderRadius: 10, background: a.swatch, cursor: 'pointer', border: 'none', outline: on ? '2px solid #2e2b38' : 'none', outlineOffset: 3 }} />
                );
              })}
            </div>
            <div style={D.hint}>
              Pinta el encabezado, los números de sección, los acuerdos y el cierre. Los compromisos conservan
              azul y morado para distinguir quién queda de qué.
            </div>

            {acento && (
              <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid #f0edf4' }}>
                <div style={{ background: acento.hd, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {logoVista ? <img src={logoVista} alt="" style={{ maxWidth: 22, maxHeight: 22, objectFit: 'contain' }} />
                      : <span style={{ fontFamily: 'Georgia, serif', fontSize: '0.75rem', color: '#3f3b4d' }}>{inis}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.92rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreVista}</div>
                    <div style={{ fontSize: '0.48rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
                      {campos.marca_linea || 'Acompañamiento estratégico'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={D.lbl}>Pie del documento</div>
            <input style={D.input} value={campos.marca_pie || ''} onChange={e => set('marca_pie', e.target.value)}
              placeholder="correo · sitio web" />

            <div style={D.lbl}>Firma</div>
            <input style={D.input} value={campos.marca_firma || ''} onChange={e => set('marca_firma', e.target.value)}
              placeholder={marca?.firma || 'Tu nombre'} />
            <div style={D.hint}>Es el nombre que va sobre la línea de firma, junto al del cliente.</div>
          </div>

          <div style={{ padding: '12px 18px 15px', borderTop: '1px solid #f1eff5', display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={guardar} disabled={guardando} style={{ ...D.btn, opacity: guardando ? .6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {guardando ? <><Corazones size={9} color="#fff" /> Guardando…</> : 'Guardar marca'}
            </button>
            <button onClick={() => window.open('/minuta/ejemplo', '_blank')} style={D.btnG}>Ver ejemplo</button>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#a09daa' }}>Cada usuario tiene la suya</span>
            {msg && <div style={{ width: '100%', fontSize: '0.76rem', color: '#1E8A63' }}>{msg}</div>}
            {error && <div style={{ width: '100%', fontSize: '0.76rem', color: '#C0554E' }}>{error}</div>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 260, maxWidth: 460 }}>
          <div style={{ ...D.card, padding: '15px 17px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 8 }}>Dónde se usa</div>
            <Punto t="Minuta descargable">
              Al abrir una minuta ya documentada aparece <b>Descargar minuta</b>: se abre el documento con tu
              marca y se guarda en PDF desde el navegador. La misma liga se comparte por WhatsApp.
            </Punto>
            <Punto t="La marca es de quien dio la sesión">
              El documento sale con la marca de quien atendió esa reunión, no con la de quien lo descarga.
            </Punto>
            <Punto t="Cinco acentos, no un selector libre">
              Son los colores de la plataforma. Un color abierto termina en documentos que no se parecen a nada.
            </Punto>
            <Punto t="El logo va sobre fondo blanco">
              A propósito: los logos de colores se pierden sobre un fondo saturado y casi nadie tiene una versión
              en blanco a la mano.
            </Punto>
          </div>
        </div>
      </div>
    </div>
  );
}

function Punto({ t, children }: { t: string; children: any }) {
  return (
    <div style={{ padding: '9px 0', borderTop: '1px solid #f4f3f7' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 2 }}>{t}</div>
      <div style={{ fontSize: '0.76rem', color: '#71717a', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
