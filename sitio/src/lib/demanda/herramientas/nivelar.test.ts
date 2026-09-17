/**
 * Qué mover entre tiendas.
 *
 * Esta es la herramienta con más forma de arruinar algo: propone MOVER
 * mercancía, y cada movimiento cuesta flete, personal y días en tránsito. Un
 * traspaso mal propuesto no es un número feo en una pantalla, es un costo real
 * a cambio de nada — o peor, una tienda que estaba completa y quedó rota.
 *
 * Por eso el invariante que más se prueba aquí no es que repare, sino que
 * **nunca rompa**: ninguna tienda puede acabar peor de como empezó, y ningún
 * movimiento se propone si no deja la corrida entera.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/herramientas/nivelar.test.ts
 */
import { calcular } from './nivelar.ts';

let ok = 0; const fallas: string[] = [];
const cmp = (r: unknown, e: unknown, q: string) => {
  const a = JSON.stringify(r), b = JSON.stringify(e);
  if (a === b) { ok++; return; }
  fallas.push(`${q}\n      esperaba ${b}\n      llegó    ${a}`);
};
const si = (c: boolean, q: string) => { c ? ok++ : fallas.push(q); };

const TALLAS = ['XS', 'S', 'M', 'L', 'XL'];
const min = 2;

/** Reconstruye la existencia final aplicando los movimientos propuestos. Es la
 *  única forma honesta de comprobar los invariantes: sobre lo que la
 *  herramienta DICE que hay que hacer, no sobre su estado interno. */
function aplicar(tiendas: { nombre: string; existencia: number[] }[], movs: any[]) {
  const m = new Map(tiendas.map(t => [t.nombre, [...t.existencia]]));
  for (const mv of movs) {
    const k = TALLAS.indexOf(mv.talla);
    m.get(mv.de)![k] -= mv.piezas;
    m.get(mv.a)![k] += mv.piezas;
  }
  return m;
}

// ── El caso del artículo: Centro sin M ni L ─────────────────────────────────
{
  const tiendas = [
    { nombre: 'Centro',   existencia: [6, 3, 0, 0, 5] },
    { nombre: 'Norte',    existencia: [1, 4, 9, 7, 2] },
    { nombre: 'Galerías', existencia: [0, 2, 5, 6, 1] },
  ];
  const r = calcular({ tallas: TALLAS, tiendas, minimo_por_talla: min });
  cmp(r.rotas_antes, ['Centro'], 'solo Centro tiene hueco en el centro de la corrida');
  cmp(r.rotas_despues, [], 'después de mover, ninguna queda rota');
  cmp(r.piezas_movidas, 4, 'se reparan las dos tallas con 2 piezas cada una');
  si(r.movimientos.every(m => m.a === 'Centro'), 'todo lo que se mueve va a la tienda rota');
}

// ── El invariante que más importa: nadie acaba peor ─────────────────────────
{
  const casos = [
    [{ nombre: 'A', existencia: [5, 2, 0, 2, 5] }, { nombre: 'B', existencia: [5, 0, 0, 0, 5] }, { nombre: 'C', existencia: [1, 4, 9, 4, 1] }],
    [{ nombre: 'A', existencia: [0, 0, 0, 0, 0] }, { nombre: 'B', existencia: [9, 9, 9, 9, 9] }],
    [{ nombre: 'A', existencia: [3, 3, 3, 3, 3] }, { nombre: 'B', existencia: [3, 3, 3, 3, 3] }, { nombre: 'C', existencia: [0, 1, 1, 1, 0] }],
  ];
  for (const tiendas of casos) {
    const r = calcular({ tallas: TALLAS, tiendas, minimo_por_talla: min });
    const final = aplicar(tiendas, r.movimientos);

    // 1. Ninguna tienda que estaba completa puede quedar rota.
    for (const t of tiendas) {
      const antesRota = r.rotas_antes.includes(t.nombre);
      const f = final.get(t.nombre)!;
      const despuesRota = r.nucleo.some(n => f[TALLAS.indexOf(n)] < min);
      si(antesRota || !despuesRota,
        `«${t.nombre}» estaba completa y los movimientos la rompen — eso es mover el problema`);
    }

    // 2. Ningún movimiento propuesto puede ser parcial: quien recibe queda entero.
    for (const dest of new Set(r.movimientos.map(m => m.a))) {
      const f = final.get(dest)!;
      si(r.nucleo.every(n => f[TALLAS.indexOf(n)] >= min),
        `se propone mandar piezas a «${dest}» y aun así le sigue faltando centro: flete sin venta`);
    }

    // 3. Nada sale de la nada ni desaparece.
    for (let k = 0; k < TALLAS.length; k++) {
      const antes = tiendas.reduce((a, t) => a + t.existencia[k], 0);
      const despues = [...final.values()].reduce((a, f) => a + f[k], 0);
      cmp(despues, antes, `la talla ${TALLAS[k]} no puede cambiar de total al mover`);
    }

    // 4. Nunca existencias negativas.
    si([...final.values()].every(f => f.every(n => n >= 0)),
      'ningún movimiento puede dejar una existencia en negativo');
  }
}

// ── Cuando no es acomodo, es compra ─────────────────────────────────────────
{
  const r = calcular({ tallas: TALLAS, minimo_por_talla: min, tiendas: [
    { nombre: 'A', existencia: [5, 0, 0, 0, 5] },
    { nombre: 'B', existencia: [5, 0, 0, 0, 5] },
  ]});
  cmp(r.movimientos, [], 'si nadie tiene de sobra, no se propone mover nada');
  si(r.lectura.includes('comprando'), 'y se dice con todas sus letras: esto se compra, no se mueve');
  si(r.faltantes_en_la_cadena.length === 3, 'se listan las tres tallas del centro que le faltan a la cadena');
}

// ── Nada que hacer ──────────────────────────────────────────────────────────
{
  const r = calcular({ tallas: TALLAS, minimo_por_talla: min, tiendas: [
    { nombre: 'A', existencia: [2, 3, 4, 4, 2] },
    { nombre: 'B', existencia: [2, 3, 5, 4, 2] },
  ]});
  cmp(r.movimientos, [], 'sin corridas rotas no se mueve nada');
  si(r.lectura.includes('fletes'), 'y se explica por qué no: nivelar de más solo gasta fletes');
}

// ── Una fila despareja se avisa, no se rellena ─────────────────────────────
{
  /* Por la web nunca pasa (la rejilla manda filas parejas), pero por API y MCP
     el que llama arma el arreglo a mano. Antes se rellenaba con ceros: una
     tienda con una talla de menos salía con un hueco inventado en el núcleo y
     la herramienta proponía mover piezas para taparlo. */
  let avisó = false;
  try {
    calcular({ tallas: TALLAS, minimo_por_talla: min, tiendas: [
      { nombre: 'Corta', existencia: [5, 3, 4] },
      { nombre: 'Buena', existencia: [1, 4, 9, 4, 1] }]});
  } catch (e: any) {
    avisó = /Corta/.test(e.message) && /3 cantidades/.test(e.message) && /5 tallas/.test(e.message);
  }
  si(avisó, 'una fila con menos cantidades que tallas tiene que avisar, y decir cuál y por qué');

  let avisóLarga = false;
  try {
    calcular({ tallas: TALLAS, minimo_por_talla: min, tiendas: [
      { nombre: 'Larga', existencia: [5, 3, 4, 2, 1, 9] },
      { nombre: 'Buena', existencia: [1, 4, 9, 4, 1] }]});
  } catch { avisóLarga = true; }
  si(avisóLarga, 'una fila con cantidades de más tampoco se recorta en silencio');
}

// ── El núcleo supuesto se declara ───────────────────────────────────────────
{
  const sin = calcular({ tallas: TALLAS, minimo_por_talla: min, tiendas: [
    { nombre: 'A', existencia: [5, 3, 0, 3, 5] }, { nombre: 'B', existencia: [1, 4, 9, 4, 1] }]});
  si(sin.nucleo_supuesto, 'sin núcleo dado, se marca como supuesto');
  cmp(sin.nucleo, ['S', 'M', 'L'], 'el supuesto son las tres de en medio');
  si(sin.lectura.includes('tomé como centro'), 'el supuesto se dice en la lectura, no en la letra chica');

  const con = calcular({ tallas: TALLAS, minimo_por_talla: min, nucleo: ['M'], tiendas: [
    { nombre: 'A', existencia: [5, 3, 0, 3, 5] }, { nombre: 'B', existencia: [1, 4, 9, 4, 1] }]});
  si(!con.nucleo_supuesto && !con.lectura.includes('tomé como centro'),
    'con núcleo dado no se inventa ni se avisa de un supuesto que no existe');
}

// ── Concordancia: nunca «las 1 corridas» ────────────────────────────────────
{
  const r = calcular({ tallas: TALLAS, minimo_por_talla: min, tiendas: [
    { nombre: 'A', existencia: [5, 3, 0, 3, 5] }, { nombre: 'B', existencia: [1, 4, 9, 4, 1] }]});
  si(!/\blas 1\b|\b1 corridas\b|\bEsas tienda\b/.test(r.lectura),
    `la lectura tiene que concordar en número: «${r.lectura.slice(0, 80)}…»`);
  si(!r.lectura.includes('**'), 'la lectura es texto plano en las tres puertas: sin asteriscos de markdown');
}

console.log(fallas.length
  ? `\n✗ nivelar entre tiendas: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ nivelar entre tiendas: ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
