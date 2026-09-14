// WHATSAPP · «Pásale esta conversación a alguien».
//
// Un clic y la liga YA está copiada: ese es el caso de todos los días —se
// pega en el WhatsApp del equipo y listo—, así que no se esconde detrás de un
// segundo clic. La hoja que se abre después es para lo que sigue: mandársela
// por dentro del CRM, con recado, y pasarle la conversación si además va a ser
// suya.
//
// La liga es la de siempre (`?wa_conv=`), la misma que ya usan la campana y la
// ficha del cliente: quien la abra sin sesión entra por el login y vuelve
// exactamente aquí (`requireFounder` guarda el `next`). Por eso no hace falta
// un token público ni una página aparte — y por eso tampoco se le puede pasar
// a alguien de fuera: esto es para el equipo.
import { useEffect, useRef, useState } from 'react';
import { C } from './estilo';
import { tic, ticListo } from '../../../../lib/ui/tacto';

/** La liga que se comparte. Con `mensajeId`, apunta al mensaje exacto. */
export function ligaDeConversacion(convId: string, mensajeId?: string | null) {
  const base = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin : 'https://www.sacscloud.com';
  return `${base}/admin/crm?tab=whatsapp&wa_conv=${convId}${mensajeId ? `&wa_msg=${mensajeId}` : ''}`;
}

/** Copia y dice si pudo. El portapapeles moderno falla sin https o sin gesto:
 *  cuando pasa, se copia con el truco viejo antes de rendirse. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sigue el plan B */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const IcoLiga = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.6 5.34" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-2.12 2.12a5 5 0 0 0 7.07 7.07l1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

type Props = {
  convId: string;
  /** Con esto, la liga cae en un mensaje concreto del hilo. */
  mensajeId?: string | null;
  equipo?: any[];
  /** Para no ofrecerte a ti mismo en «mandársela a». */
  yoId?: string | null;
  /** Ya asignada a alguien: la casilla de «y pásasela» nace apagada si es suya. */
  asignadoA?: string | null;
  /** Reusa el camino que ya existe (con sus avisos y su refresco). */
  onAsignar?: (id: string) => Promise<any>;
  movil?: boolean;
  /** Lo abre alguien de fuera (el menú ⋯ del móvil) en vez del botón propio. */
  abierto?: boolean;
  onCerrar?: () => void;
  /** Sin botón: solo la hoja, gobernada desde fuera. */
  sinBoton?: boolean;
};

export default function Compartir({ convId, mensajeId, equipo, yoId, asignadoA, onAsignar, movil, abierto, onCerrar, sinBoton }: Props) {
  const [propio, setPropio] = useState(false);
  const abrir = sinBoton ? !!abierto : propio;
  const cerrar = () => { setPropio(false); onCerrar?.(); };

  const liga = ligaDeConversacion(convId, mensajeId);
  const [copiada, setCopiada] = useState(false);
  const [para, setPara] = useState('');
  const [recado, setRecado] = useState('');
  const [pasar, setPasar] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [aviso, setAviso] = useState('');
  const caja = useRef<HTMLSpanElement>(null);

  // Al abrirse, la liga ya está copiada. Es lo que se pidió del botón: un clic,
  // liga lista. Lo de abajo es para quien quiera algo más que pegarla.
  useEffect(() => {
    if (!abrir) return;
    setAviso(''); setCopiada(false);
    copiarTexto(liga).then(ok => { setCopiada(ok); if (ok) ticListo(); });
  }, [abrir, liga]);

  // Cerrar con Esc o con un clic afuera (en escritorio; en el teléfono la hoja
  // trae su propio velo).
  useEffect(() => {
    if (!abrir || movil) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) cerrar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('mousedown', fuera); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc); };
  }, [abrir, movil]);

  const gente = (equipo || []).filter(m => m.id !== yoId && !m.es_agente);

  const mandar = async () => {
    if (!para || mandando) return;
    setMandando(true); setAviso('');
    const r = await fetch('/api/crm/whatsapp/compartir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: convId, para, recado, mensaje_id: mensajeId || null }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setAviso(r.error); setMandando(false); return; }
    // La asignación va por el camino de siempre, no por este endpoint: así
    // arrastra sus avisos (ventana, permisos) y refresca la lista igual que
    // cuando se asigna desde el menú.
    if (pasar && onAsignar) await onAsignar(para).catch(() => null);
    setMandando(false);
    setAviso(`Listo, le llegó a ${r.para}${pasar ? ' y ya es suya' : ''}`);
    setTimeout(cerrar, 1300);
  };

  const cuerpo = (
    <>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
        {copiada ? 'Liga copiada' : 'Liga de esta conversación'}
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input readOnly value={liga} onFocus={e => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0, border: `1px solid ${C.g200}`, borderRadius: 9, padding: movil ? '11px 10px' : '7px 9px', fontSize: movil ? 13 : 11.5, fontFamily: 'inherit', color: C.g700, background: C.g50 }} />
        <button onClick={async () => { const ok = await copiarTexto(liga); setCopiada(ok); ok ? ticListo() : setAviso('El navegador no dejó copiar: selecciona la liga y cópiala a mano'); }}
          style={{ border: 'none', background: copiada ? C.emerald50 : C.morado, color: copiada ? C.emerald700 : '#fff', borderRadius: 9, padding: movil ? '11px 14px' : '7px 12px', fontSize: movil ? 13 : 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {copiada ? 'Copiada ✓' : 'Copiar'}
        </button>
      </span>
      <span style={{ display: 'block', fontSize: 11, color: C.g400, marginTop: 6, lineHeight: 1.5 }}>
        {mensajeId ? 'Abre el hilo justo en ese mensaje.' : 'Abre esta conversación en el CRM.'} Solo funciona para el equipo: quien no tenga sesión entrará por el login y caerá aquí.
      </span>

      {!!gente.length && (<>
        <span style={{ display: 'block', height: 1, background: C.g100, margin: movil ? '16px 0 14px' : '12px 0 10px' }} />
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
          Mandársela a un compañero
        </span>
        <select value={para} onChange={e => setPara(e.target.value)}
          style={{ width: '100%', border: `1px solid ${C.g200}`, borderRadius: 9, padding: movil ? '11px 10px' : '7px 9px', fontSize: movil ? 14 : 12.5, fontFamily: 'inherit', background: '#fff', color: para ? C.g900 : C.g400 }}>
          <option value="">Elige a quién…</option>
          {gente.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <textarea value={recado} onChange={e => setRecado(e.target.value)} rows={2}
          placeholder="Recado: qué hay que hacer con esto (opcional)"
          style={{ width: '100%', marginTop: 7, border: `1px solid ${C.g200}`, borderRadius: 9, padding: movil ? '10px' : '7px 9px', fontSize: movil ? 14 : 12.5, fontFamily: 'inherit', resize: 'vertical', color: C.g900 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: movil ? 13.5 : 12, color: C.g700, cursor: 'pointer' }}>
          <input type="checkbox" checked={pasar} onChange={e => setPasar(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.morado }} />
          Y pásale la conversación (queda asignada a esa persona)
        </label>
        <button onClick={mandar} disabled={!para || mandando}
          style={{ width: '100%', marginTop: 10, border: 'none', borderRadius: 10, padding: movil ? '13px' : '9px', background: !para || mandando ? C.g200 : C.morado, color: !para || mandando ? C.g500 : '#fff', fontSize: movil ? 15 : 13, fontWeight: 700, cursor: !para || mandando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {mandando ? 'Mandando…' : 'Mandar'}
        </button>
        <span style={{ display: 'block', fontSize: 11, color: C.g400, marginTop: 7, lineHeight: 1.5 }}>
          Le suena la campana del CRM con tu recado y con un clic cae aquí. Queda anotado en el hilo, para que se sepa quién se la pasó a quién.
        </span>
      </>)}

      {aviso && (
        <span style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 600, color: /Listo/.test(aviso) ? C.emerald700 : C.rojo700 }}>{aviso}</span>
      )}
    </>
  );

  return (
    <span ref={caja} style={{ position: 'relative', flexShrink: 0, display: sinBoton ? 'contents' : 'inline-flex' }}>
      {!sinBoton && (
        <button onClick={() => { tic(); setPropio(v => !v); }} title="Compartir esta conversación" aria-label="Compartir esta conversación"
          style={{ border: 'none', background: propio ? C.moradoAgua : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: propio ? C.moradoTinta : C.g400, display: 'inline-flex' }}>
          <IcoLiga size={movil ? 19 : 15} />
        </button>
      )}
      {abrir && movil && <span onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 960, background: 'rgba(8,7,12,.62)' }} />}
      {abrir && (
        <span style={movil
          ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 961, background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -14px 40px rgba(12,11,18,.3)', display: 'block', padding: '8px 18px calc(24px + env(safe-area-inset-bottom))', maxHeight: '86dvh', overflowY: 'auto' }
          : { position: 'absolute', right: 0, top: '120%', zIndex: 961, width: 330, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 14, boxShadow: '0 14px 34px rgba(36,29,67,.18)', display: 'block', padding: 14 }}>
          {movil && <span style={{ display: 'block', width: 40, height: 5, borderRadius: 99, background: '#e2e1e8', margin: '4px auto 14px' }} />}
          {cuerpo}
        </span>
      )}
    </span>
  );
}
