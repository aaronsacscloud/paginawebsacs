/**
 * JALAR PARA REFRESCAR — el gesto que todo el mundo ya sabe hacer.
 *
 * En el teléfono nadie busca un botón de recargar: se jala la lista hacia abajo.
 * Y en una PWA instalada no hay barra del navegador, así que sin este gesto NO
 * HAY forma de forzar una actualización: hay que esperar al polling o cerrar la
 * app. Por eso importa más aquí que en la web.
 *
 * Las reglas que lo hacen sentir nativo y no un accidente:
 *
 *  1. SOLO desde arriba del todo. Si la lista está a medio scroll, jalar hacia
 *     abajo es scrollear, no refrescar. Confundirlos hace que la pantalla se
 *     recargue sola cuando uno solo quería subir.
 *  2. SOLO si el dedo va claramente en vertical. Un arrastre diagonal es un
 *     scroll o un swipe lateral, y robárselo rompe los dos.
 *  3. RESISTENCIA. El indicador avanza a la mitad de lo que avanza el dedo:
 *     así el gesto se siente con peso y no se dispara por un roce.
 *  4. UMBRAL, y aviso antes de soltar. A partir de 64 px ya cuenta; el
 *     indicador cambia para que se sepa ANTES de levantar el dedo.
 *  5. Nada de esto en escritorio: ahí el mouse no jala, y hay F5.
 *
 * Devuelve el estado para dibujar el indicador; el dibujo lo pone quien llama,
 * porque cada pantalla tiene su propio lienzo.
 */
import { useEffect, useRef, useState } from 'react';

const UMBRAL = 64;
const RESISTENCIA = 0.5;
const MAX = 96;

export function useJalarParaRefrescar(
  onRefrescar: () => void | Promise<void>,
  activo = true,
) {
  const [tiro, setTiro] = useState(0);        // px "jalados", ya con resistencia
  const [refrescando, setRefrescando] = useState(false);
  const ini = useRef<{ y: number; x: number } | null>(null);
  const valido = useRef(false);
  const cb = useRef(onRefrescar);
  cb.current = onRefrescar;

  useEffect(() => {
    if (!activo || typeof window === 'undefined') return;
    // Sin táctil no hay gesto que escuchar: en escritorio ni se engancha.
    if (!('ontouchstart' in window)) return;

    const arriba = () => {
      // El scroll puede vivir en la ventana o en un contenedor interno (el
      // inbox y el hilo tienen el suyo). Se considera "arriba" solo si NINGUNO
      // está desplazado: si no, jalar dentro de una lista a medias refrescaría.
      if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) return false;
      const cont = document.querySelector('[data-scroll-principal]') as HTMLElement | null;
      if (cont && cont.scrollTop > 2) return false;
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (refrescando || e.touches.length !== 1 || !arriba()) { ini.current = null; return; }
      ini.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
      valido.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!ini.current || refrescando) return;
      const dy = e.touches[0].clientY - ini.current.y;
      const dx = Math.abs(e.touches[0].clientX - ini.current.x);
      if (dy <= 0) { setTiro(0); return; }
      // Regla 2: el gesto tiene que ser claramente vertical.
      if (!valido.current) {
        if (dy < 8) return;
        if (dx > dy * 0.7) { ini.current = null; return; }
        valido.current = true;
      }
      const d = Math.min(MAX, dy * RESISTENCIA);
      setTiro(d);
      // Se evita el "rebote" del navegador SOLO cuando el gesto ya es nuestro.
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = async () => {
      if (!ini.current) return;
      const paso = tiro >= UMBRAL * RESISTENCIA;
      ini.current = null; valido.current = false;
      if (!paso) { setTiro(0); return; }
      setRefrescando(true); setTiro(UMBRAL * RESISTENCIA);
      try { await cb.current(); } catch { /* refrescar nunca rompe la pantalla */ }
      // Un parpadeo mínimo: si la respuesta vuelve en 80 ms, el indicador
      // aparece y desaparece de golpe y se lee como que no hizo nada.
      setTimeout(() => { setRefrescando(false); setTiro(0); }, 320);
    };

    // passive:false en move porque ahí se llama preventDefault.
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [activo, refrescando, tiro]);

  return {
    tiro,
    refrescando,
    /** 0-1: cuánto falta para que suelte y cuente. Para animar el indicador. */
    progreso: Math.min(1, tiro / (UMBRAL * RESISTENCIA)),
    listo: tiro >= UMBRAL * RESISTENCIA,
  };
}
