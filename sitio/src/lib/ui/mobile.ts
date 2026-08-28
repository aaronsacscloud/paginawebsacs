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

/**
 * ¿La app está pintada en oscuro AHORA? El tema del CRM móvil se activa con
 * html[data-crm-dark="1"] y solo aplica si el sistema está en oscuro (las
 * reglas viven en un @media prefers-color-scheme). Las gráficas son SVG con
 * el color en ATRIBUTOS (stroke/fill), donde ninguna regla CSS de fondo llega:
 * necesitan saberlo en JavaScript para elegir su paleta.
 */
export function useCrmDark(): boolean {
  const sistemaOscuro = useMediaQuery('(prefers-color-scheme: dark)');
  const [attr, setAttr] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-crm-dark') === '1');
  useEffect(() => {
    const el = document.documentElement;
    const leer = () => setAttr(el.getAttribute('data-crm-dark') === '1');
    leer();
    const obs = new MutationObserver(leer);
    obs.observe(el, { attributes: true, attributeFilter: ['data-crm-dark'] });
    return () => obs.disconnect();
  }, []);
  return attr && sistemaOscuro;
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
// Stack de overlays con history activo. Un solo botón atrás dispara UN popstate
// que llega a TODOS los listeners: sin coordinación, cerraría todos los overlays
// anidados (drawer + modal). Con el stack, solo el overlay SUPERIOR responde.
let overlayStack: number[] = [];
let overlaySeq = 0;

export function useDrawerHistory(open: boolean, onClose: () => void) {
  const closedByPop = useRef(false);
  const pushed = useRef(false);
  const idRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    // scroll-lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // history + registro en el stack
    closedByPop.current = false;
    pushed.current = true;
    const myId = ++overlaySeq;
    idRef.current = myId;
    overlayStack.push(myId);
    try { window.history.pushState({ crmOverlay: true }, ''); } catch { pushed.current = false; }
    const onPop = () => {
      if (Date.now() < phantomPopUntil) { phantomPopUntil = 0; return; } // pop fantasma de nuestro back()
      if (overlayStack[overlayStack.length - 1] !== myId) return;        // no soy el overlay superior
      overlayStack.pop();
      closedByPop.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prevOverflow;
      overlayStack = overlayStack.filter(x => x !== myId);
      // si se cerró con ✕/backdrop (no con atrás), consumir la entrada fantasma
      if (pushed.current && !closedByPop.current) {
        phantomPopUntil = Date.now() + 400;
        try { window.history.back(); } catch { phantomPopUntil = 0; }
      }
    };
  }, [open]);
}
