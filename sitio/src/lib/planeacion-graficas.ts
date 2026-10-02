/**
 * Gráficas de /producto/planeacion-de-demanda: SVG inline calculado en el build (sin librerías de gráficas).
 * Todo sale como `d` de un <path> o como coordenadas; el navegador solo anima (stroke-dashoffset, opacidad).
 */

export type Punto = [number, number];

/** Curva suave que pasa por todos los puntos (Catmull-Rom → Bézier cúbica). */
export function suave(pts: Punto[]): string {
  if (!pts.length) return '';
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(p2[0])},${r(p2[1])}`;
  }
  return d;
}

/** Línea recta por tramos. */
export function recta(pts: Punto[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${r(p[0])},${r(p[1])}`).join(' ');
}

const r = (n: number) => Math.round(n * 10) / 10;

/** Escala lineal de un dominio a un rango. */
export function escala([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

/**
 * Una serie (por ejemplo, piezas por semana) dentro de una caja w×h con margen `m`.
 * `max` fija el tope común para comparar varias series en la misma caja.
 */
export function serie(v: number[], { w, h, m = 0, max, min = 0 }: { w: number; h: number; m?: number; max: number; min?: number }) {
  const x = escala([0, Math.max(1, v.length - 1)], [m, w - m]);
  const y = escala([min, max], [h - m, m]);
  const pts: Punto[] = v.map((n, i) => [x(i), y(n)]);
  return { pts, x, y, d: suave(pts) };
}

/** Banda (área entre dos series) para el margen del pronóstico. */
export function banda(sup: Punto[], inf: Punto[]): string {
  return `${suave(sup)} L${[...inf].reverse().map((p) => `${r(p[0])},${r(p[1])}`).join(' L')} Z`;
}

/** Área bajo una serie hasta la base `y0`. */
export function area(pts: Punto[], y0: number): string {
  if (!pts.length) return '';
  return `${suave(pts)} L${r(pts[pts.length - 1][0])},${r(y0)} L${r(pts[0][0])},${r(y0)} Z`;
}

/** Miles con coma: 28400 → «28,400». */
export const miles = (n: number) => n.toLocaleString('en-US');
