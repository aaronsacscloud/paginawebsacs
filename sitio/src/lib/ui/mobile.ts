// Utilidades RESPONSIVE compartidas del CRM (base del rediseño mobile-first).
// Breakpoints ÚNICOS del sistema — no volver a hardcodear 768/900 en tabs.
import { useEffect, useRef, useState } from 'react';

export const BP = {
  mobile: 900, // < 900px = teléfono/tablet chica → layout mobile
  tight: 560,  // < 560px = teléfono angosto → grids a 1 columna, listas
};

/** true si el media query matchea (SSR-safe: false en servidor). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Layout mobile (< BP.mobile por defecto). */
export function useIsMobile(bp: number = BP.mobile): boolean {
  return useMediaQuery(`(max-width: ${bp - 1}px)`);
}

/** Dispositivo táctil (sin hover real). */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
}

/**
 * Historial + scroll-lock para overlays (drawers/sheets/modals):
 * - pushState al abrir → el botón ATRÁS del teléfono cierra el overlay en vez
 *   de salir del CRM (popstate → onClose).
 * - bloquea el scroll del body mientras está abierto y lo restaura al cerrar.
 *
 * Pop FANTASMA: al cerrar con ✕/backdrop hacemos history.back() para consumir
 * la entrada que pusimos. Ese back() es ASÍNCRONO y su popstate llegaría al
 * overlay de abajo (o a uno recién abierto) cerrándolo también — p.ej. cerrar
 * un ActionSheet sobre un drawer cerraba el drawer. `phantomPopUntil` (module-
 * level, compartido entre instancias) marca una ventana corta en la que el
 * próximo popstate se ignora; se autoexpira para no comerse un back legítimo.
 */
let phantomPopUntil = 0;

export function useDrawerHistory(open: boolean, onClose: () => void) {
  const closedByPop = useRef(false);
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    // scroll-lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // history
    closedByPop.current = false;
    pushed.current = true;
    try { window.history.pushState({ crmOverlay: true }, ''); } catch { pushed.current = false; }
    const onPop = () => {
      if (Date.now() < phantomPopUntil) { phantomPopUntil = 0; return; } // pop fantasma de nuestro back()
      closedByPop.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prevOverflow;
      // si se cerró con ✕/backdrop (no con atrás), consumir la entrada fantasma
      if (pushed.current && !closedByPop.current) {
        phantomPopUntil = Date.now() + 400;
        try { window.history.back(); } catch { phantomPopUntil = 0; }
      }
    };
  }, [open]);
}
