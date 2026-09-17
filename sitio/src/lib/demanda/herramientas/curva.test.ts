/**
 * El cálculo de la curva de tallas.
 *
 * Esta función es el producto: la misma respuesta la da la web, la dará el MCP
 * y la da la API. Si un día cambia de criterio sin que nadie lo note, no se cae
 * nada —sigue devolviendo porcentajes que suman 100— y le decimos a un retailer
 * que compre mal. Un error aquí es invisible y caro, que es la peor mezcla.
 *
 * Los casos guardan las decisiones que ya se tomaron y por qué, no solo los
 * números: el tope de la proyección, el núcleo mínimo de tres, el reparto por
 * resto mayor y el caso sin agotamientos (donde la herramienta debe admitir que
 * no tiene nada que corregir, en vez de inventar una diferencia).
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/herramientas/curva.test.ts
 *
 * (El `--import` del hook hace falta porque curva.ts importa `../herramienta`
 *  sin extensión, como todo el repo: Vite lo resuelve, Node pelado no.)
 */
import { calcular } from './curva.ts';

let ok = 0; const fallas: string[] = [];
const cmp = (real: unknown, esperado: unknown, que: string) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; return; }
  fallas.push(`${que}\n      esperaba ${b}\n      llegó    ${a}`);
};
const si = (cond: boolean, que: string) => { cond ? ok++ : fallas.push(que); };

// ── Sin agotamientos, la corrección no debe inventar nada ───────────────────
{
  const r = calcular({ periodo_dias: 60, piezas_a_comprar: 100, tallas: [
    { talla: 'S', vendidas: 20 }, { talla: 'M', vendidas: 50 }, { talla: 'L', vendidas: 30 },
  ]});
  cmp(r.tallas.map(t => t.curva_corregida), [20, 50, 30],
    'sin días de agotamiento la curva corregida ES la ingenua');
  cmp(r.diferencia_pct, 0, 'sin agotamientos la diferencia es 0, no un número decorativo');
  cmp(r.corrida_rota, false, 'sin agotamientos no hay corrida rota');
  si(r.lectura.includes('ningun') || r.lectura.includes('Ningun') || !r.lectura.includes('agotaron'),
    'sin agotamientos la lectura no debe hablar de tallas agotadas');
}

// ── El caso que justifica la herramienta ────────────────────────────────────
{
  const r = calcular({ periodo_dias: 60, piezas_a_comprar: 60, tallas: [
    { talla: 'XS', vendidas: 4,  dias_con_existencia: 60 },
    { talla: 'S',  vendidas: 12, dias_con_existencia: 60 },
    { talla: 'M',  vendidas: 14, dias_con_existencia: 9  },
    { talla: 'L',  vendidas: 11, dias_con_existencia: 22 },
    { talla: 'XL', vendidas: 5,  dias_con_existencia: 60 },
  ]});
  const M = r.tallas.find(t => t.talla === 'M')!;
  si(M.curva_corregida > M.curva_ingenua,
    'la M se agotó el día 9: su peso TIENE que subir, no bajar');
  cmp(M.demanda_real, 42,
    'la M se topa en el triple de lo vendido (14×3), no en la proyección plana de 93.3');
  si(M.estimacion_topada === true, 'la M debe venir marcada como estimación topada');
  const L = r.tallas.find(t => t.talla === 'L')!;
  si(!L.estimacion_topada, 'la L proyecta 30 (< 33 = 11×3): NO se topa');
  cmp(L.demanda_real, 30, 'la L proyecta 11/22×60 = 30');
  const XS = r.tallas.find(t => t.talla === 'XS')!;
  cmp(XS.demanda_real, 4, 'una talla que nunca se agotó conserva su venta tal cual');
  si(r.corrida_rota, 'M y L son del núcleo y se agotaron: la corrida está rota');
  si(r.nucleo.length >= 3, 'el núcleo nunca es de una sola talla');
}

// ── Las piezas suman EXACTAMENTE lo que se pidió comprar ────────────────────
{
  // El resto mayor existe por esto: repartir 7 piezas entre 5 tallas con
  // redondeo normal devuelve 5, 6 u 8 según dónde caigan los decimales, y la
  // orden de compra sale por una cantidad distinta a la que el comprador puso.
  for (const total of [7, 13, 60, 101, 999]) {
    const r = calcular({ periodo_dias: 30, piezas_a_comprar: total, tallas: [
      { talla: 'XS', vendidas: 3 }, { talla: 'S', vendidas: 7 }, { talla: 'M', vendidas: 11 },
      { talla: 'L', vendidas: 7 },  { talla: 'XL', vendidas: 3 },
    ]});
    cmp(r.tallas.reduce((a, t) => a + (t.piezas || 0), 0), total,
      `repartir ${total} piezas tiene que dar ${total}, no ${total} ± 1`);
  }
}

// ── Casos de borde que no deben reventar ni mentir ──────────────────────────
{
  const cero = calcular({ periodo_dias: 60, tallas: [
    { talla: 'S', vendidas: 0 }, { talla: 'M', vendidas: 0 },
  ]});
  si(Array.isArray(cero.tallas) && cero.tallas.length === 2,
    'sin una sola venta la herramienta responde en vez de dividir entre cero');
  si(cero.tallas.every(t => Number.isFinite(t.curva_corregida)),
    'sin ventas los porcentajes son números, no NaN');

  const undia = calcular({ periodo_dias: 60, tallas: [
    { talla: 'S', vendidas: 10, dias_con_existencia: 60 },
    { talla: 'M', vendidas: 2,  dias_con_existencia: 1 },
  ]});
  const m = undia.tallas.find(t => t.talla === 'M')!;
  cmp(m.demanda_real, 6,
    'agotada el día 1: el tope la deja en 6 (2×3), no en los 120 de la proyección plana');
}

console.log(fallas.length
  ? `\n✗ curva de tallas: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ curva de tallas: ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
