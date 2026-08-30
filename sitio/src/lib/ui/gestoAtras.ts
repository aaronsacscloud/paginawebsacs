/**
 * DESLIZAR DESDE EL BORDE PARA VOLVER — con la pantalla siguiendo al dedo.
 *
 * El hilo YA se cerraba con el botón físico de Android y con el gesto nativo
 * de iOS, porque abrir una conversación empuja una entrada al historial
 * (useDrawerHistory). Lo que no había era el arrastre: la pantalla no se movía
 * con el dedo, así que el gesto era invisible —nadie lo intenta si nada indica
 * que existe— y el cambio de pantalla era un corte seco.
 *
 * Aquí la pantalla sigue al dedo. Eso hace tres cosas de golpe: enseña que el
 * gesto existe, deja arrepentirse a media vía (si sueltas antes del umbral,
 * vuelve a su sitio), y convierte el corte en un movimiento.
 *
 * Decisiones que no son de estilo:
 *
 *  · Solo desde los primeros 28 px del borde izquierdo. Más adentro, cualquier
 *    arrastre horizontal —una imagen ancha, una tabla— se leería como "volver".
 *  · El eje se decide en los primeros 10 px y no se cambia. Un arrastre en
 *    diagonal es scroll, y robárselo hace que el hilo se sienta atorado.
 *  · Se mueve el elemento a mano (transform directo, sin estado de React).
 *    Un re-render por fotograma con un hilo de 200 mensajes detrás se ve peor
 *    que no animar nada.
 *  · `preventDefault` en cuanto el gesto es nuestro: si no, iOS dispara ADEMÁS
 *    su propio deslizamiento de historial y se cierran dos niveles de un tirón.
 *  · Umbral por distancia O por velocidad: un flick corto y rápido es una
 *    intención tan clara como arrastrar media pantalla, y exigir la mitad de
 *    la pantalla siempre se siente pesado.
 */
import { useEffect, useRef } from 'react';
import { tic } from './tacto';

const BORDE = 28;      // desde dónde se puede empezar
const UMBRAL = 0.32;   // fracción del ancho que confirma
const FLICK = 0.5;     // px/ms: un tirón rápido también confirma

export function useGestoAtras(
  ref: { current: HTMLElement | null },
  activo: boolean,
  alVolver: () => void,
) {
  // El callback se guarda en una ref y NO entra en las dependencias. Si entrara,
  // el efecto se volvería a montar en cada render —quien lo usa suele pasar una
  // arrow nueva cada vez— y su limpieza borraría el `transform` a media
  // arrastre: medido, la pantalla no se movía ni un píxel aunque el gesto sí
  // completara. Un gesto no puede depender de que el padre no re-renderice.
  const alVolverRef = useRef(alVolver);
  alVolverRef.current = alVolver;

  useEffect(() => {
    const el = ref.current;
    if (!activo || !el || typeof window === 'undefined') return;
    if (!matchMedia('(hover: none)').matches) return;   // con ratón no aplica

    let x0 = 0, y0 = 0, t0 = 0, dx = 0, eje: '?' | 'x' | 'y' = '?', vivo = false;
    const ancho = () => el.getBoundingClientRect().width || window.innerWidth;

    const pintar = (v: number) => {
      el.style.transition = 'none';
      el.style.transform = v ? `translateX(${v}px)` : '';
      // La sombra crece con el arrastre: da la sensación de que la pantalla se
      // despega de la de atrás, que es lo que hace que se lea como una capa.
      el.style.boxShadow = v ? `-12px 0 28px rgba(0,0,0,${Math.min(0.18, v / ancho() * 0.4).toFixed(3)})` : '';
    };
    const soltarAnimando = (hasta: number, luego?: () => void) => {
      el.style.transition = 'transform 200ms cubic-bezier(.22,.61,.36,1), box-shadow 200ms linear';
      el.style.transform = hasta ? `translateX(${hasta}px)` : 'translateX(0)';
      if (!hasta) el.style.boxShadow = '';
      setTimeout(() => {
        if (!luego) { el.style.transition = ''; el.style.transform = ''; el.style.boxShadow = ''; }
        luego?.();
      }, 205);
    };

    const inicio = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > BORDE) return;
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); dx = 0; eje = '?'; vivo = true;
    };
    const mover = (e: TouchEvent) => {
      if (!vivo) return;
      const t = e.touches[0];
      const ax = t.clientX - x0, ay = t.clientY - y0;
      if (eje === '?') {
        if (Math.abs(ax) < 10 && Math.abs(ay) < 10) return;
        eje = Math.abs(ax) > Math.abs(ay) * 1.3 ? 'x' : 'y';
        if (eje === 'y') { vivo = false; return; }
      }
      dx = Math.max(0, ax);
      pintar(dx);
      if (e.cancelable) e.preventDefault();
    };
    const fin = () => {
      if (!vivo) return;
      vivo = false;
      if (eje !== 'x') return;
      const v = dx / Math.max(1, Date.now() - t0);
      if (dx > ancho() * UMBRAL || v > FLICK) {
        tic();
        // Sale del todo ANTES de avisar: si se desmonta a media animación, se
        // ve un salto en vez de una salida.
        soltarAnimando(ancho(), () => alVolverRef.current());
      } else soltarAnimando(0);
    };

    el.addEventListener('touchstart', inicio, { passive: true });
    el.addEventListener('touchmove', mover, { passive: false });
    el.addEventListener('touchend', fin);
    el.addEventListener('touchcancel', fin);
    return () => {
      el.removeEventListener('touchstart', inicio);
      el.removeEventListener('touchmove', mover as any);
      el.removeEventListener('touchend', fin);
      el.removeEventListener('touchcancel', fin);
      el.style.transition = ''; el.style.transform = ''; el.style.boxShadow = '';
    };
  }, [activo]);   // ← a propósito: ni el callback ni la ref (ver arriba)
}
