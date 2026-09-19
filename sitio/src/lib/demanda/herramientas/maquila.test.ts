/**
 * Costo de maquila: los casos guardan que la merma se aplica solo a
 * insumos (no a corte/confección), que el lote es una multiplicación
 * simple, y la distinción margen-sobre-precio contra markup-sobre-costo que
 * es el error más común al fijar el precio de una prenda fabricada.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/herramientas/maquila.test.ts
 */
import { calcular } from './maquila.ts';

let ok = 0; const fallas: string[] = [];
const cmp = (real: unknown, esperado: unknown, que: string) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; return; }
  fallas.push(`${que}\n      esperaba ${b}\n      llegó    ${a}`);
};
const si = (cond: boolean, que: string) => { cond ? ok++ : fallas.push(que); };
const cerca = (real: number, esperado: number, que: string, tol = 0.05) => {
  Math.abs(real - esperado) <= tol ? ok++ : fallas.push(`${que}\n      esperaba ≈${esperado}\n      llegó    ${real}`);
};

// ── El caso base, sin margen objetivo ───────────────────────────────────────
{
  const r = calcular({
    insumos: [
      { nombre: 'tela principal', costo_por_prenda: 80 },
      { nombre: 'forro', costo_por_prenda: 20 },
      { nombre: 'cierre', costo_por_prenda: 15 },
      { nombre: 'botones', costo_por_prenda: 5 },
    ],
    corte_por_prenda: 20,
    confeccion_por_prenda: 45,
    merma_pct: 5,
    otros_costos_por_prenda: 10,
    piezas_del_lote: 200,
  });
  cmp(r.costo_insumos, 120, 'suma de insumos = 80+20+15+5');
  cmp(r.costo_insumos_con_merma, 126, 'insumos con 5% de merma = 120×1.05');
  cmp(r.costo_por_prenda, 201, 'costo por prenda = 126+20+45+10');
  cmp(r.costo_del_lote, 40200, 'costo del lote = 201×200');
  si(!r.precio_minimo, 'sin margen objetivo no debe salir precio mínimo');

  // La merma NO debe tocar corte ni confección — solo insumos.
  const sinMerma = calcular({
    insumos: [{ nombre: 'tela', costo_por_prenda: 100 }],
    corte_por_prenda: 20, confeccion_por_prenda: 30, merma_pct: 0, piezas_del_lote: 1,
  });
  const conMerma = calcular({
    insumos: [{ nombre: 'tela', costo_por_prenda: 100 }],
    corte_por_prenda: 20, confeccion_por_prenda: 30, merma_pct: 10, piezas_del_lote: 1,
  });
  cmp(conMerma.costo_corte, sinMerma.costo_corte, 'la merma no debe afectar el costo de corte');
  cmp(conMerma.costo_confeccion, sinMerma.costo_confeccion, 'la merma no debe afectar el costo de confección');
  si(conMerma.costo_por_prenda > sinMerma.costo_por_prenda, 'con merma el costo por prenda sí sube');
  cmp(conMerma.costo_por_prenda, 160, '100×1.10 + 20 + 30 = 160');
}

// ── Precio mínimo: margen sobre PRECIO, no markup sobre costo ──────────────
{
  const r = calcular({
    insumos: [
      { nombre: 'tela principal', costo_por_prenda: 80 },
      { nombre: 'forro', costo_por_prenda: 20 },
      { nombre: 'cierre', costo_por_prenda: 15 },
      { nombre: 'botones', costo_por_prenda: 5 },
    ],
    corte_por_prenda: 20, confeccion_por_prenda: 45, merma_pct: 5,
    otros_costos_por_prenda: 10, piezas_del_lote: 200,
    margen_objetivo_pct: 45, iva_pct: 16,
  });
  // costo por prenda = 201. precio neto = 201 / (1-0.45) = 365.4545...
  cerca(r.precio_minimo!.precio_neto, 365.45, 'precio neto = costo / (1 - margen)');
  cerca(r.precio_minimo!.precio_con_iva, 423.93, 'precio con IVA = precio neto × 1.16');
  // markup equivalente = (365.4545-201)/201*100 = 81.82%
  cerca(r.precio_minimo!.markup_equivalente_pct, 81.8, 'markup equivalente sale MAYOR que el margen objetivo (45%), nunca igual', 0.2);
  si(r.precio_minimo!.markup_equivalente_pct > r.precio_minimo!.margen_objetivo_pct,
    'el markup equivalente siempre es mayor que el margen objetivo — si salieran iguales, la fórmula estaría mal (sería markup, no margen)');

  // Verificación cruzada: vender AL precio calculado debe dar EXACTAMENTE el margen pedido.
  const margenReal = (r.precio_minimo!.precio_neto - r.costo_por_prenda) / r.precio_minimo!.precio_neto * 100;
  cerca(margenReal, 45, 'vendiendo al precio mínimo calculado, el margen real es el objetivo pedido', 0.5);
}

// ── Margen objetivo alto pero razonable no debe reventar ni dar Infinity ────
{
  const r = calcular({
    insumos: [{ nombre: 'tela', costo_por_prenda: 50 }],
    corte_por_prenda: 10, confeccion_por_prenda: 20, merma_pct: 0,
    piezas_del_lote: 1, margen_objetivo_pct: 90,
  });
  si(Number.isFinite(r.precio_minimo!.precio_neto), 'margen alto pero <100% debe dar un número finito');
  si(r.precio_minimo!.precio_neto > r.costo_por_prenda, 'el precio mínimo siempre debe superar el costo');
}

console.log(fallas.length
  ? `\n✗ costo de maquila: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ costo de maquila: ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
