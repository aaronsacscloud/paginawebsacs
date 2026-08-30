/**
 * DESLIZAR UNA FILA PARA ACTUAR — el gesto de bandeja de toda la vida.
 *
 * En un teléfono, resolver una conversación obligaba a abrirla, buscar el
 * control y volver: tres pasos para decir "ya está". Deslizando es uno, y es el
 * gesto que cualquiera ya trae aprendido de su app de correo.
 *
 * Las reglas que lo hacen usable y no un accidente:
 *
 *  1. SOLO horizontal, y solo si el dedo lo dice claro. Un arrastre en diagonal
 *     es scroll: robárselo hace que la lista se sienta atorada. Se decide con
 *     los primeros 10 px y ya no se cambia de opinión.
 *  2. UMBRAL con resistencia. La fila sigue al dedo hasta el tope; pasado el
 *     umbral la acción se "arma" y el fondo cambia de tono, así se sabe ANTES
 *     de levantar el dedo. Sin eso, cualquier roce ejecutaría.
 *  3. NO se ejecuta al soltar a medias: vuelve a su sitio. Un gesto ambiguo
 *     nunca debe decidir por el usuario.
 *  4. SE PUEDE DESHACER. La fila se va de la lista al instante —se siente
 *     rápido— pero la acción real se manda después de 4 s, y mientras tanto hay
 *     un "Deshacer". Es lo que separa un gesto cómodo de uno que da miedo.
 *  5. Solo en táctil. Con ratón no se desliza; ahí están los controles de
 *     siempre.
 *
 * El tap normal sigue funcionando: si no hubo desplazamiento, se deja pasar.
 */
import { useEffect, useRef, useState } from 'react';
import { tic, ticListo } from '../../../../lib/ui/tacto';

/* La fila necesita fondo OPACO —si no, se ve la acción de atrás a través del
 * texto— pero NO puede ser un blanco fijo: el CRM tiene modo oscuro en el
 * teléfono y un #fff aquí pinta cada renglón de blanco sobre la pantalla negra.
 * Pasó tal cual: el usuario abrió el inbox y la lista salió en dos colores.
 * Va por clase para que el tema oscuro pueda alcanzarla. */
const CSS_DESLIZ = `
.wa-desliz-fila { background: #fff; }
.wa-desliz-hecho { background: #f7f6fa; color: #6b6875; }
@media (prefers-color-scheme: dark) and (max-width: 899px) {
  [data-crm-dark="1"] .wa-desliz-fila { background: #131318; }
  [data-crm-dark="1"] .wa-desliz-hecho { background: #1d1d24; color: #b3b1bd; }
}
`;

const UMBRAL = 84;
const TOPE = 128;

export type AccionDeslizar = {
  etiqueta: string;
  color: string;
  fondo: string;
  icono?: React.ReactNode;
  onAccion: () => void | Promise<void>;
};

export default function FilaDeslizable({ children, izquierda, alDeshacer }: {
  children: React.ReactNode;
  /** La acción que aparece al deslizar hacia la IZQUIERDA (el dedo va a la izquierda). */
  izquierda?: AccionDeslizar;
  alDeshacer?: () => void;
}) {
  const [x, setX] = useState(0);
  const [ido, setIdo] = useState(false);
  const ini = useRef<{ x: number; y: number } | null>(null);
  const eje = useRef<'?' | 'x' | 'y'>('?');
  const temporizador = useRef<any>(null);

  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('wa-desliz-css')) {
      const el = document.createElement('style');
      el.id = 'wa-desliz-css'; el.textContent = CSS_DESLIZ;
      document.head.appendChild(el);
    }
    return () => { if (temporizador.current) clearTimeout(temporizador.current); };
  }, []);

  if (!izquierda) return <>{children}</>;

  const armada = x <= -UMBRAL;
  // Un golpecito EN EL MOMENTO en que el gesto se arma: es la señal de que
  // soltar ya ejecuta. Antes solo cambiaba el tono del fondo, que es
  // justamente lo que el pulgar está tapando mientras desliza.
  const armadaPrev = useRef(false);
  useEffect(() => { if (armada && !armadaPrev.current) tic(); armadaPrev.current = armada; }, [armada]);

  const soltar = () => {
    ini.current = null;
    if (eje.current !== 'x') { eje.current = '?'; return; }
    eje.current = '?';
    if (!armada) { setX(0); return; }
    // Regla 4: se va de la lista YA, y la acción sale con retraso para que
    // quepa un arrepentimiento.
    setIdo(true); ticListo();
    temporizador.current = setTimeout(() => { izquierda.onAccion(); }, 4000);
  };

  const deshacer = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setIdo(false); setX(0);
    alDeshacer?.();
  };

  if (ido) {
    return (
      <div className="wa-desliz-hecho" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px' }}>
        {/* sin color inline: lo pone la clase, que sí tiene variante oscura */}
        <span style={{ fontSize: '0.82rem' }}>{izquierda.etiqueta}</span>
        <button onClick={deshacer}
          style={{ border: 'none', background: 'none', color: '#5B4BD6', fontWeight: 800, fontSize: '0.82rem', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44, padding: '0 4px' }}>
          Deshacer
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* El fondo con la acción, detrás de la fila. Se oscurece al armarse: es
          el aviso de que soltar YA ejecuta. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 22, background: izquierda.fondo, opacity: armada ? 1 : 0.55,
        transition: 'opacity 120ms ease',
      }}>
        <span style={{ color: izquierda.color, fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          {izquierda.icono}{izquierda.etiqueta}
        </span>
      </div>
      <div
        onTouchStart={e => { if (e.touches.length !== 1) return; ini.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; eje.current = '?'; }}
        onTouchMove={e => {
          if (!ini.current) return;
          const dx = e.touches[0].clientX - ini.current.x;
          const dy = e.touches[0].clientY - ini.current.y;
          // Regla 1: el eje se decide una vez y no se cambia.
          if (eje.current === '?') {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            eje.current = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
          }
          if (eje.current !== 'x') return;
          if (dx > 0) { setX(0); return; }        // solo hacia la izquierda
          setX(Math.max(-TOPE, dx));
          if (e.cancelable) e.preventDefault();
        }}
        onTouchEnd={soltar}
        onTouchCancel={soltar}
        style={{
          transform: `translateX(${x}px)`,
          transition: x === 0 ? 'transform 180ms ease' : 'none',
          position: 'relative',
        }}
        className="wa-desliz-fila">
        {children}
      </div>
    </div>
  );
}
