// Los tres corazones que laten mientras el CRM trae algo.
//
// Un "Cargando…" pelón se lee como una pantalla trabada; el latido dice que hay
// algo pasando. Es UN solo gesto para toda la aplicación —panel del cliente,
// botón guardando, lista buscando— porque así se aprende una vez.
//
// Dos cosas que evitan el susto de "se rompió":
//  · A los 8 segundos el texto cambia solo a "está tardando más de lo normal".
//  · A los 20 aparece "Reintentar" (si quien lo usa le pasó un reintento).
//
// Y respeta `prefers-reduced-motion`: a quien lo tenga activado, los corazones
// se quedan quietos en tres tonos en vez de parpadear.
import { useEffect, useState } from 'react';

const CSS = `
@keyframes sacs-latido {
  0%, 70%, 100% { transform: scale(.82); opacity: .3; }
  35%           { transform: scale(1.12); opacity: 1; }
}
.sacs-corazones { display: inline-flex; align-items: center; gap: .38em; line-height: 1; }
.sacs-corazones svg { display: block; animation: sacs-latido 1.15s ease-in-out infinite; transform-origin: center; }
.sacs-corazones svg:nth-child(2) { animation-delay: .16s; }
.sacs-corazones svg:nth-child(3) { animation-delay: .32s; }
@media (prefers-reduced-motion: reduce) {
  .sacs-corazones svg { animation: none; opacity: .35; transform: none; }
  .sacs-corazones svg:nth-child(1) { opacity: 1; }
  .sacs-corazones svg:nth-child(2) { opacity: .6; }
}
`;

function Estilos() {
  // Se inyecta una sola vez por documento: tres corazones en pantalla no
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

/** Los corazones solos: para un botón, un renglón o junto a un texto. */
export function Corazones({ size = 13, color = '#9B8CFA' }: { size?: number; color?: string }) {
  return (
    <span className="sacs-corazones" aria-hidden="true">
      <Estilos />
      {[0, 1, 2].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M12 21s-7.5-4.6-9.6-9A5.4 5.4 0 0 1 12 6.5 5.4 5.4 0 0 1 21.6 12c-2.1 4.4-9.6 9-9.6 9z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * El bloque completo, centrado: corazones + texto + el aviso de que tarda.
 * `onReintentar` es opcional; sin él, a los 20 s solo cambia el texto.
 */
export default function Cargando({
  texto = 'Cargando…', size = 15, alto = 180, onReintentar,
}: { texto?: string; size?: number; alto?: number | string; onReintentar?: () => void }) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeg(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const lento = seg >= 8;
  const mucho = seg >= 20;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 11, minHeight: alto, padding: 24 }}>
      <Corazones size={size} />
      <div style={{ fontSize: '0.83rem', color: '#8a8590', textAlign: 'center', lineHeight: 1.5 }}>
        {mucho ? 'Sigue sin responder.' : lento ? 'Está tardando más de lo normal…' : texto}
      </div>
      {mucho && onReintentar && (
        <button onClick={onReintentar}
          style={{ border: '1px solid #e2e0e8', borderRadius: 9, padding: '7px 14px', background: '#fff', fontSize: '0.78rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
          Reintentar
        </button>
      )}
    </div>
  );
}
