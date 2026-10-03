/**
 * Escenas de /experiencia/* que se cuentan con el scroll (2-oct-2026), en la línea de /planeacion-de-demanda.
 *
 * Cada <section data-escena> trae un riel ([data-riel]) más alto que la pantalla y, adentro, su escena pegada
 * (position: sticky en el CSS de cada componente). Mientras el riel pasa, la sección recibe:
 *   · --p (0 → 1): cuánto lleva la escena (para barridos y fundidos en CSS);
 *   · data-tramo (0…n-1) si declara data-tramos="n": el paso en que va (para pasos discretos).
 * La clase .is-escena en la sección prende el modo pegado; sin ella (sin JS o con «reducir movimiento») cada sección
 * va quieta y completa. También mueve la palabra gigante (--q) de las secciones .pda con .pda-fondo.
 * Un solo rAF, listener pasivo y solo con alguna sección en vista.
 */
export function iniciaEscenas() {
  const mov = window.matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 540px)');
  const secs = Array.from(document.querySelectorAll<HTMLElement>('[data-escena]'));
  const fondos = Array.from(document.querySelectorAll<HTMLElement>('.pd .pda')).filter((a) => a.querySelector('.pda-fondo'));
  const vivas = new Set<HTMLElement>();
  let raf = 0;

  const pinta = () => {
    raf = 0;
    const vh = window.innerHeight;
    vivas.forEach((s) => {
      if (s.hasAttribute('data-escena')) {
        if (!s.classList.contains('is-escena')) return;
        const riel = s.querySelector<HTMLElement>('[data-riel]');
        if (!riel) return;
        const r = riel.getBoundingClientRect();
        const total = r.height - vh;
        const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
        s.style.setProperty('--p', p.toFixed(4));
        const n = Number(s.dataset.tramos || 0);
        if (n) {
          const k = String(Math.min(n - 1, Math.floor(p * n)));
          if (s.dataset.tramo !== k) s.dataset.tramo = k;
        }
      }
      if (mov.matches && s.querySelector(':scope > .pda-fondo')) {
        const r = s.getBoundingClientRect();
        s.style.setProperty('--q', Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(4));
      }
    });
  };
  const alScroll = () => { if (!raf) raf = requestAnimationFrame(pinta); };

  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) vivas.add(e.target as HTMLElement); else vivas.delete(e.target as HTMLElement); });
    if (vivas.size) { window.addEventListener('scroll', alScroll, { passive: true }); alScroll(); }
    else window.removeEventListener('scroll', alScroll);
  }, { rootMargin: '100px 0px' });

  const modo = () => {
    secs.forEach((s) => {
      s.classList.toggle('is-escena', mov.matches);
      if (!mov.matches) { s.style.removeProperty('--p'); s.dataset.tramo = String(Number(s.dataset.tramos || 1) - 1); }
    });
    alScroll();
  };
  mov.addEventListener('change', modo);
  modo();
  new Set([...secs, ...fondos]).forEach((s) => io.observe(s));
  window.addEventListener('resize', alScroll, { passive: true });
}
