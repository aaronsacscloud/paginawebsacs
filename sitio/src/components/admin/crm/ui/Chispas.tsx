/* Los destellos de la marca, para la banda del título de una pantalla.
 *
 * Es la misma chispa del logo y de la entrada del CRM. La regla —que nació en
 * el Tablero— es que viven SOLO en la franja del encabezado: es la única sin
 * cifras, y un destello detrás de un número estorba al leerlo.
 *
 * Vive aquí y no dentro de una pantalla porque ya son dos las que lo usan, y
 * un segundo juego de destellos con otros tamaños se vería como otra casa.
 *
 * Uso:
 *   <div className="chispas-cab" style={{ position:'relative', ... }}>
 *     <Chispas />
 *     <div style={{ position:'relative', zIndex:1 }}>…el título…</div>
 *   </div>
 */

export const CHISPA =
  'M12 1.6c.62 6.6 3.18 9.16 9.78 9.78-6.6.62-9.16 3.18-9.78 9.78-.62-6.6-3.18-9.16-9.78-9.78C8.82 10.76 11.38 8.2 12 1.6z';

/* Destellos de distinto tamaño y con el latido desfasado para que no parpadeen
   a coro. Son decoración: sin texto y ocultos al lector de pantalla.
   [ancho, x, y, opacidad, retraso, color]

   Van en DOS capas y esa es toda la gracia. La primera son los diez grandes
   —hasta 20 px y hasta media opacidad—: son los que se ven. La segunda son
   ocho chiquitos, ninguno pasa de 9 px ni de 0.26 de opacidad, metidos en los
   huecos que dejó la primera y a alturas distintas. Más destellos del mismo
   tamaño saturan; unos más chicos y más tenues detrás se leen como fondo, que
   es justo lo que tienen que ser. */
const DESTELLOS: [number, string, number, number, number, string][] = [
  // Capa 1 · los que se ven
  [12, '2%', 2, 0.5, 0, '#D9538E'], [8, '10%', 44, 0.38, 1.1, '#9B8CFA'],
  [16, '21%', -4, 0.26, 2.2, '#EFA6CA'], [9, '29%', 50, 0.42, 0.6, '#D9538E'],
  [20, '38%', 8, 0.22, 1.7, '#9B8CFA'], [8, '47%', 40, 0.46, 2.8, '#EFA6CA'],
  [11, '56%', 0, 0.28, 0.3, '#D9538E'], [7, '64%', 48, 0.4, 1.4, '#9B8CFA'],
  [14, '73%', 4, 0.2, 2.4, '#EFA6CA'], [9, '85%', 42, 0.32, 0.9, '#D9538E'],
  // Capa 2 · el polvo de estrellas
  [6, '6%', 28, 0.22, 3.4, '#EFA6CA'], [5, '16%', 14, 0.26, 1.9, '#D9538E'],
  [7, '25%', 32, 0.18, 0.8, '#9B8CFA'], [6, '34%', 54, 0.24, 3.1, '#EFA6CA'],
  [5, '43%', 20, 0.2, 2.0, '#D9538E'], [8, '52%', 30, 0.16, 1.2, '#9B8CFA'],
  [6, '61%', 34, 0.22, 3.8, '#EFA6CA'], [5, '78%', 26, 0.2, 2.6, '#D9538E'],
];

/** El CSS del efecto. Se inyecta una vez con el componente para que una
 *  pantalla nueva no tenga que copiar los keyframes —copiarlos es como se
 *  llega a dos latidos con distinta velocidad—. */
export const CSS_CHISPAS = `
  .chispas-cab { position: relative; }
  .chispas-cab > *:not(.chispas) { position: relative; z-index: 1; }
  .chispas { position: absolute; inset: -14px -10px -6px -8px; z-index: 0; pointer-events: none; }
  .chispas svg { position: absolute; animation: chispaLatir 4.2s ease-in-out infinite; }
  @keyframes chispaLatir {
    0%, 100% { opacity: var(--o, .5); transform: scale(1) rotate(0deg); }
    50%      { opacity: calc(var(--o, .5) * .4); transform: scale(.84) rotate(8deg); }
  }
  @media (prefers-reduced-motion: reduce) { .chispas svg { animation: none; } }
`;

export default function Chispas() {
  return (
    <div className="chispas" aria-hidden="true">
      {DESTELLOS.map(([w, x, y, o, dl, c], i) => (
        <svg key={i} width={w} height={w} viewBox="0 0 24 24"
          style={{ left: x, top: y, ['--o' as any]: o, animationDelay: `${dl}s` }}>
          <path d={CHISPA} fill={c} />
        </svg>
      ))}
    </div>
  );
}

/** El sello con la frase de la pantalla. Mismo peso en todas: es la firma de
 *  la casa, no un subtítulo — por eso no crece ni cambia de color por sección.
 *  En pantalla angosta se esconde: al lado del título robaría el renglón. */
export function Sello({ children }: { children: any }) {
  return (
    <span className="chispas-sello" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff',
      border: '1px solid rgba(217,83,142,.3)', borderRadius: 999, padding: '5px 13px',
      fontSize: '.58rem', fontWeight: 800, letterSpacing: '.11em',
      textTransform: 'uppercase', color: '#9c3d70', whiteSpace: 'nowrap',
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d={CHISPA} fill="#D9538E" /></svg>
      {children}
    </span>
  );
}

export const CSS_SELLO = `
  @media (max-width: 760px) { .chispas-sello { display: none; } }
`;
