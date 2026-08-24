// La chispa en órbita: lo que se ve mientras el CRM trae algo.
//
// Un "Cargando…" pelón se lee como una pantalla trabada; el movimiento dice que
// hay algo pasando. Es UN solo gesto para toda la aplicación —panel del
// cliente, botón guardando, lista buscando— porque así se aprende una vez.
//
// Por qué una órbita y no un parpadeo: el giro es el lenguaje universal de
// "espera", así que se entiende de reojo y a 13 px dentro de un botón, que es
// donde más aparece. Y el símbolo que gira es la chispa de la marca, no un
// spinner genérico.
//
// Dos cosas que evitan el susto de "se rompió":
//  · A los 8 segundos el texto cambia solo a "está tardando más de lo normal".
//  · A los 20 aparece "Reintentar" (si quien lo usa le pasó un reintento).
//
// Y respeta `prefers-reduced-motion`: a quien lo tenga activado, la chispa se
// queda quieta en vez de girar.
import { useEffect, useId, useState } from 'react';

const CSS = `
@keyframes sacs-orbita { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sacs-respira { 0%, 100% { transform: scale(.9); opacity: .78; } 50% { transform: scale(1.04); opacity: 1; } }
.sacs-chispa { position: relative; display: inline-grid; place-items: center; vertical-align: middle; flex-shrink: 0; }
.sacs-chispa .sacs-centro { display: grid; place-items: center; animation: sacs-respira 1.6s ease-in-out infinite; transform-origin: center; }
.sacs-chispa .sacs-anillo { position: absolute; inset: 0; animation: sacs-orbita 1.5s linear infinite; transform-origin: center; }
.sacs-chispa .sacs-anillo > * { position: absolute; top: 0; left: 50%; transform: translateX(-50%); }
@keyframes sacs-frase { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .sacs-chispa .sacs-centro, .sacs-chispa .sacs-anillo { animation: none; }
  .sacs-chispa .sacs-centro { opacity: 1; transform: none; }
  .sacs-chispa .sacs-anillo { opacity: .5; }
}
`;

function Estilos() {
  // Se inyecta una sola vez por documento: tres cargadores en pantalla no
  // necesitan tres copias de la misma animación.
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('sacs-cargando-css')) return;
    const el = document.createElement('style');
    el.id = 'sacs-cargando-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

const TRAZO = 'M12 1.6c.62 6.6 3.18 9.16 9.78 9.78-6.6.62-9.16 3.18-9.78 9.78-.62-6.6-3.18-9.16-9.78-9.78C8.82 10.76 11.38 8.2 12 1.6z';

/**
 * La chispa girando. Para un botón, un renglón o junto a un texto.
 *
 * `color` la pinta plana en vez del degradado de la marca: sobre un botón
 * morado el degradado morado→rosa se pierde, y ahí se necesita blanco.
 */
export function Chispas({ size = 13, color }: { size?: number; color?: string }) {
  // El id del degradado tiene que ser único por instancia: dos SVG con el mismo
  // id y el segundo hereda el del primero (queda de un solo tono).
  const uid = useId().replace(/:/g, '');
  const caja = Math.round(size * 1.7);
  const centro = size;
  const luna = Math.max(4, Math.round(size * 0.42));
  const relleno = color || `url(#chispa-${uid})`;

  const svg = (px: number, opacidad?: number) => (
    <svg width={px} height={px} viewBox="0 0 24 24" style={opacidad ? { opacity: opacidad } : undefined}>
      {!color && (
        <defs>
          <linearGradient id={`chispa-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9B8CFA" />
            <stop offset="100%" stopColor="#D9538E" />
          </linearGradient>
        </defs>
      )}
      <path d={TRAZO} fill={relleno} />
    </svg>
  );

  return (
    <span className="sacs-chispa" style={{ width: caja, height: caja }} aria-hidden="true">
      <Estilos />
      <span className="sacs-centro">{svg(centro)}</span>
      <span className="sacs-anillo">{svg(luna, 0.85)}</span>
    </span>
  );
}

/** Nombre viejo. Se conserva porque lo importan 21 pantallas; en código nuevo
 *  usa `Chispas`, que es lo que de verdad se dibuja desde ago-2026. */
export const Corazones = Chispas;

/** La frase de la marca —la misma del acceso al CRM—. Una fija y no una que
 *  rota: la repetición es lo que hace que una frase se quede. */
const FRASE = 'El verdadero éxito está en crecer mientras ayudas a otros a crecer.';

/**
 * El bloque completo, centrado: la chispa + texto + la frase + el aviso de que
 * tarda. `onReintentar` es opcional; sin él, a los 20 s solo cambia el texto.
 *
 * `alto` por omisión ocupa media pantalla: el cargador de un módulo se quedaba
 * pegado arriba de un área vacía enorme y se veía perdido. Quien lo mete en una
 * tarjeta chica ya pasa su propio `alto`, y ese manda.
 */
export default function Cargando({
  texto = 'Cargando…', size, alto = 'clamp(260px, 56vh, 560px)', onReintentar,
}: { texto?: string; size?: number; alto?: number | string; onReintentar?: () => void }) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeg(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const lento = seg >= 8;
  const mucho = seg >= 20;

  /* La frase entra con retraso. Casi todas estas pantallas cargan en menos de
     un segundo, y una frase que aparece y se va en 400 ms se lee como un
     parpadeo, no como un mensaje: si la carga fue rápida, nunca se ve. */
  const [conFrase, setConFrase] = useState(false);
  useEffect(() => { const t = setTimeout(() => setConFrase(true), 600); return () => clearTimeout(t); }, []);

  // En una tarjeta chica —cuando quien llama fijó un alto— la chispa se queda
  // discreta; suelta en el módulo, crece.
  const chico = typeof alto === 'number' && alto <= 240;
  const px = size ?? (chico ? 15 : 28);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: chico ? 11 : 15, minHeight: alto, padding: 24 }}>
      <Chispas size={px} />
      <div style={{ fontSize: chico ? '0.83rem' : '0.88rem', color: '#8a8590', textAlign: 'center', lineHeight: 1.5 }}>
        {mucho ? 'Sigue sin responder.' : lento ? 'Está tardando más de lo normal…' : texto}
      </div>
      {!chico && conFrase && !mucho && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, maxWidth: '34ch', animation: 'sacs-frase .6s ease' }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#241d43', textAlign: 'center', lineHeight: 1.5, letterSpacing: '-.01em', textWrap: 'balance' as any }}>
            <span style={{ color: '#5B4BD6' }}>“</span>{FRASE}<span style={{ color: '#5B4BD6' }}>”</span>
          </div>
          <div style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase',
            background: 'linear-gradient(100deg,#7C6BF0 0%,#8E7DEF 35%,#D9538E 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>Sacs CRM</div>
        </div>
      )}
      {mucho && onReintentar && (
        <button onClick={onReintentar}
          style={{ border: '1px solid #e2e0e8', borderRadius: 9, padding: '7px 14px', background: '#fff', fontSize: '0.78rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
          Reintentar
        </button>
      )}
    </div>
  );
}
