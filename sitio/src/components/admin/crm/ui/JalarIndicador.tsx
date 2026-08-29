/**
 * El indicador de "jalar para refrescar": el círculo que aparece arriba
 * mientras se jala.
 *
 * Va aparte del gesto porque cada pantalla tiene su lienzo, pero el DIBUJO sí
 * debe ser el mismo en todas: si en el inbox gira una cosa y en Leads otra, el
 * gesto deja de sentirse parte del sistema.
 *
 * Dos detalles que lo hacen legible:
 *  · antes del umbral la flecha va tenue y crece con el tiro — el gesto se ve
 *    "cargando"; al pasarlo, se pinta completa: se sabe que ya cuenta ANTES de
 *    levantar el dedo;
 *  · mientras refresca, gira. Y con `prefers-reduced-motion` no gira: se queda
 *    quieta y llena, que sigue diciendo "estoy trabajando".
 */
import { useEffect } from 'react';

const CSS = `
@keyframes jalar-giro { to { transform: rotate(360deg); } }
.jalar-ind { position: absolute; left: 50%; top: 0; z-index: 5; display: grid; place-items: center;
  width: 34px; height: 34px; border-radius: 50%; background: #fff; box-shadow: 0 2px 10px rgba(40,20,90,.14);
  pointer-events: none; }
[data-crm-dark="1"] .jalar-ind { background: #232329; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
.jalar-ind.girando svg { animation: jalar-giro .9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .jalar-ind.girando svg { animation: none; } }
`;

export default function JalarIndicador({ tiro, refrescando, progreso, listo }: {
  tiro: number; refrescando: boolean; progreso: number; listo: boolean;
}) {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('jalar-css')) return;
    const el = document.createElement('style'); el.id = 'jalar-css'; el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  if (tiro <= 0 && !refrescando) return null;
  return (
    <div className={'jalar-ind' + (refrescando ? ' girando' : '')} aria-hidden="true"
      style={{ transform: `translate(-50%, ${Math.max(6, tiro - 34)}px)`, opacity: refrescando ? 1 : Math.max(0.35, progreso) }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke={listo || refrescando ? '#5B4BD6' : '#a5a2af'} strokeWidth="2.4" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-3.2-6.9" />
        {!refrescando && <path d="M21 3v6h-6" />}
      </svg>
    </div>
  );
}
