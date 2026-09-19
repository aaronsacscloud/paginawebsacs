/**
 * Margen y markup: los casos guardan la distinción que la herramienta existe
 * para no dejar confundir (margen ≠ markup), la identidad algebraica entre
 * margen y descuento de equilibrio, y el caso de vender ya bajo costo.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/herramientas/margen.test.ts
 */
import { calcular } from './margen.ts';

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

// ── El caso base: costo $200, precio $500, IVA 16% ─────────────────────────
{
  const r = calcular({ costo: 200, precio_venta: 500, iva_pct: 16 });
  // precio neto = 500/1.16 = 431.03
  cerca(r.precio_neto, 431.03, 'precio neto = precio de lista / (1+IVA)');
  // margen = (431.03-200)/431.03 = 53.6%
  cerca(r.margen_pct, 53.6, 'margen sobre precio neto');
  // markup = (431.03-200)/200 = 115.5%
  cerca(r.markup_pct, 115.5, 'markup sobre costo — y tiene que ser MAYOR que el margen, nunca igual');
  si(r.markup_pct > r.margen_pct, 'markup y margen NO son el mismo número (el error que la herramienta existe para evitar)');
  cmp(r.precio_equilibrio, 232, 'precio de equilibrio = costo × (1+IVA) = 200×1.16');
  si(r.ya_pierde_a_precio_lista === false, 'a $500 con costo $200 no se pierde');
}

// ── La identidad: descuento de equilibrio == margen (el IVA se cancela) ────
for (const [costo, precio, iva] of [[200, 500, 16], [80, 150, 16], [1200, 1990, 8], [50, 60, 16]] as const) {
  const r = calcular({ costo, precio_venta: precio, iva_pct: iva });
  cerca(r.descuento_equilibrio_pct, r.margen_pct,
    `descuento de equilibrio == margen para costo ${costo}, precio ${precio}, IVA ${iva}%`, 0.15);
}

// ── Un descuento que SIGUE conviniendo ──────────────────────────────────────
{
  const r = calcular({ costo: 200, precio_venta: 500, iva_pct: 16, descuento_pct: 30 });
  // precio con descuento = 350, neto = 350/1.16 = 301.72, margen = (301.72-200)/301.72 = 33.7%
  si(r.descuento!.conviene, '30% de descuento sobre $500 (costo $200) sigue ganando');
  cerca(r.descuento!.precio_con_descuento, 350, 'precio con 30% de descuento');
  cerca(r.descuento!.margen_pct, 33.7, 'margen al 30% de descuento', 0.2);
  si(r.descuento!.ganancia_o_perdida_por_pieza > 0, 'con descuento que conviene, la ganancia por pieza es positiva');
}

// ── Un descuento que YA NO conviene ─────────────────────────────────────────
{
  const r = calcular({ costo: 200, precio_venta: 500, iva_pct: 16, descuento_pct: 60 });
  // precio con descuento = 200 < precio de equilibrio 232 → pierde
  si(!r.descuento!.conviene, '60% de descuento sobre $500 (costo $200) YA vende bajo costo');
  si(r.descuento!.ganancia_o_perdida_por_pieza < 0, 'la pérdida por pieza sale negativa, no oculta como 0');
  si(r.lectura.includes('PIERDES') || r.lectura.toLowerCase().includes('pierdes'),
    'la lectura tiene que decir explícitamente que se pierde, no solo dar el número');
}

// ── Ya se vende bajo costo desde el precio de lista (sin descuento) ────────
{
  const r = calcular({ costo: 200, precio_venta: 210, iva_pct: 16 });
  // precio equilibrio = 232, precio de lista 210 < 232 → ya pierde
  si(r.ya_pierde_a_precio_lista, 'precio de lista por debajo del precio de equilibrio se marca como pérdida');
  si(r.margen_pct < 0, 'el margen sale negativo, no se trunca a 0 escondiendo el problema');
}

console.log(fallas.length
  ? `\n✗ margen y markup: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ margen y markup: ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
