/**
 * Punto de reorden: los casos guardan por qué el punto de reorden no es cero,
 * qué significa un `dias_para_reordenar` negativo (pedido atrasado, no «a
 * tiempo»), y que una talla sin venta no debe inventar un ritmo.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/herramientas/reorden.test.ts
 */
import { calcular } from './reorden.ts';

let ok = 0; const fallas: string[] = [];
const cmp = (real: unknown, esperado: unknown, que: string) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; return; }
  fallas.push(`${que}\n      esperaba ${b}\n      llegó    ${a}`);
};
const si = (cond: boolean, que: string) => { cond ? ok++ : fallas.push(que); };

// ── El caso central: una talla atrasada y una tranquila ─────────────────────
{
  const r = calcular({
    periodo_dias: 30, tiempo_entrega_dias: 10, dias_seguridad: 5,
    tallas: [
      { talla: 'M', vendidas: 60, existencia_actual: 25 },  // consumo 2/día, ROP 2×15=30
      { talla: 'S', vendidas: 15, existencia_actual: 20 },  // consumo 0.5/día, ROP 0.5×15=7.5
    ],
  });
  const M = r.tallas.find(t => t.talla === 'M')!;
  const S = r.tallas.find(t => t.talla === 'S')!;

  cmp(M.consumo_diario, 2, 'M vendió 60 en 30 días = 2/día');
  cmp(M.punto_reorden, 30, 'ROP de M = 2 × (10+5) = 30');
  si(M.pedir_ahora, 'M tiene 25 de existencia contra un ROP de 30: ya hay que pedir');
  cmp(M.cantidad_a_pedir, 5, 'a M le faltan 30-25=5 piezas para volver a estar cubierta');
  si(M.dias_para_reordenar! < 0, 'M ya pasó su punto de reorden: los días deben salir NEGATIVOS (atrasado)');
  cmp(M.dias_para_reordenar, -2.5, 'M se pasó del ROP hace (25-30)/2 = -2.5 días');

  cmp(S.punto_reorden, 7.5, 'ROP de S = 0.5 × 15 = 7.5');
  si(!S.pedir_ahora, 'S tiene 20 de existencia contra un ROP de 7.5: todavía no urge');
  cmp(S.cantidad_a_pedir, 0, 'si no urge pedir, la cantidad a pedir es 0, no negativa');
  si(S.dias_para_reordenar! > 0, 'a S le faltan días POSITIVOS para llegar a su punto de reorden');
  cmp(S.dias_para_reordenar, 25, 'S llega a su ROP en (20-7.5)/0.5 = 25 días');

  cmp(r.urgentes, ['M'], 'solo M aparece en la lista de urgentes');
  cmp(r.total_piezas_a_pedir, 5, 'el total a pedir es la suma de lo que urge, no de todas las tallas');
}

// ── Una talla sin venta no debe inventar un ritmo ──────────────────────────
{
  const r = calcular({
    periodo_dias: 30, tiempo_entrega_dias: 10, dias_seguridad: 5,
    tallas: [{ talla: 'XXL', vendidas: 0, existencia_actual: 5 }],
  });
  const t = r.tallas[0];
  cmp(t.consumo_diario, 0, 'sin ventas el consumo diario es 0, no NaN');
  cmp(t.punto_reorden, 0, 'sin consumo el punto de reorden es 0: no hay ritmo que cubrir');
  si(t.dias_para_reordenar === null, 'sin ritmo de venta no se inventa una fecha: debe ser null');
  si(!t.pedir_ahora, 'con existencia > 0 y ROP en 0, no urge pedir por ritmo (aunque no se venda)');
}

// ── Tiempo de entrega cero: el punto de reorden es solo el colchón ─────────
{
  const r = calcular({
    periodo_dias: 10, tiempo_entrega_dias: 0, dias_seguridad: 4,
    tallas: [{ talla: 'L', vendidas: 20, existencia_actual: 3 }],
  });
  const t = r.tallas[0];
  cmp(t.consumo_diario, 2, '20 en 10 días = 2/día');
  cmp(t.punto_reorden, 8, 'sin tiempo de entrega, el ROP es solo el colchón: 2 × 4 = 8');
  si(t.pedir_ahora, 'existencia 3 contra ROP 8: hay que pedir');
  cmp(t.cantidad_a_pedir, 5, 'faltan 8-3=5 piezas');
}

// ── Cero existencia siempre urge, salvo con ritmo también cero ──────────────
{
  const r = calcular({
    periodo_dias: 30, tiempo_entrega_dias: 15, dias_seguridad: 5,
    tallas: [{ talla: 'XS', vendidas: 3, existencia_actual: 0 }],
  });
  si(r.tallas[0].pedir_ahora, 'existencia en cero con algo de venta siempre urge pedir');
  si(r.tallas[0].cantidad_a_pedir > 0, 'la cantidad a pedir con existencia 0 tiene que ser positiva');
}

console.log(fallas.length
  ? `\n✗ punto de reorden: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ punto de reorden: ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
