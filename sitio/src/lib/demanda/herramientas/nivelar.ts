// HERRAMIENTA GRATIS · qué mover entre tus tiendas para reparar corridas.
//
// Nivelar no es repartir parejo: es que cada tienda tenga lo que PUEDE vender.
// Y lo que más valor mueve no es emparejar existencias, es **reparar corridas
// rotas**: una tienda a la que le faltan las tallas del centro no vende ese
// modelo, punto. Su reporte dirá «aquí no gusta» y esa mentira entra a la
// siguiente orden de compra, que le compra menos, que le rompe la corrida otra
// vez. El ciclo se cierra solo.
//
// Por eso el criterio de esta herramienta NO es igualar cobertura —que es lo que
// hacen las hojas de cálculo de nivelación— sino **reparar el máximo de corridas
// con las menos piezas movidas**. Una tienda a la que le falta una talla del
// centro se arregla con dos piezas y vuelve a vender el modelo entero; mover
// diez piezas para emparejar una tienda que ya tiene corrida completa no cambia
// nada.
//
// Entra solo la existencia, no las ventas. Es a propósito: la existencia por
// talla y tienda la tiene cualquiera a la mano, y la venta por talla y tienda en
// un periodo comparable casi nadie. Una herramienta que pide datos que nadie
// tiene es una herramienta que nadie usa.
import { z } from 'zod';
import { definirHerramienta } from '../herramienta';

export const Entrada = z.object({
  tallas: z.array(z.string().min(1).max(12)).min(2).max(40)
    .describe('Las tallas del modelo, EN ORDEN de menor a mayor: ["XS","S","M","L","XL"] o ["22","22.5","23"]. El orden importa: de ahí sale cuál es el centro de la corrida.'),
  tiendas: z.array(z.object({
    nombre: z.string().min(1).max(60),
    // Los topes de longitud no son diseño de producto, son seguridad: esto se
    // sirve por API pública sin llave, así que el tamaño de lo que se acepta lo
    // tiene que acotar el esquema y no lo que el cálculo aguante.
    existencia: z.array(z.number().min(0).max(100_000)).min(1).max(40)
      .describe('Piezas en existencia, una por talla, en el mismo orden y con la MISMA cantidad de elementos que el arreglo `tallas`.'),
  })).min(2).max(60)
    .describe('Una entrada por tienda con su existencia por talla. Mínimo dos: con una tienda no hay nada que nivelar.'),
  nucleo: z.array(z.string()).optional()
    .describe('Las tallas del centro de tu corrida, las que hacen la mayor parte de tu venta. Si no las das, se toman las tres de en medio del arreglo `tallas` — que es un supuesto razonable y se avisa en la respuesta.'),
  minimo_por_talla: z.number().min(1).max(20).default(2)
    .describe('Cuántas piezas quieres como mínimo de cada talla del centro en cada tienda. Por omisión 2: con una sola pieza la talla se agota con la primera venta y la corrida se vuelve a romper el mismo día.'),
});

export type Movimiento = { de: string; a: string; talla: string; piezas: number; repara: boolean };

export type Salida = {
  nucleo: string[];
  nucleo_supuesto: boolean;
  /** Tiendas con la corrida rota ANTES de mover nada. */
  rotas_antes: string[];
  rotas_despues: string[];
  movimientos: Movimiento[];
  piezas_movidas: number;
  /** Tallas del centro que faltan en la cadena ENTERA: no es acomodo, es compra. */
  faltantes_en_la_cadena: { talla: string; piezas_faltantes: number }[];
  lectura: string;
};

/** Las tres de en medio. No es ciencia: es el supuesto menos malo cuando no
 *  sabemos la venta, y se declara como supuesto en la respuesta. */
function centroPorOrden(tallas: string[]): string[] {
  if (tallas.length <= 3) return [...tallas];
  const medio = Math.floor(tallas.length / 2);
  const desde = Math.max(0, medio - 1);
  return tallas.slice(desde, desde + 3);
}

export function calcular(e: z.infer<typeof Entrada>): Salida {
  const minimo = e.minimo_por_talla ?? 2;
  const nucleoSupuesto = !e.nucleo?.length;
  const nucleo = (nucleoSupuesto ? centroPorOrden(e.tallas) : e.nucleo!).filter(t => e.tallas.includes(t));
  const iNucleo = nucleo.map(t => e.tallas.indexOf(t));

  /* Una fila que no cuadra con las tallas se AVISA, no se rellena.

     Antes se completaba con ceros y se recortaba el sobrante en silencio. Por
     la web da igual —la rejilla manda filas parejas siempre—, pero por API y
     por MCP el arreglo lo arma quien llama: una tienda con una talla de menos
     salía con un cero inventado en la última, ese cero se leía como hueco del
     núcleo, y la herramienta proponía mover piezas para tapar un agujero que
     no existe. Quien la llamó no tenía forma de enterarse. */
  const desparejas = e.tiendas.filter(t => t.existencia.length !== e.tallas.length);
  if (desparejas.length) {
    throw new Error(
      `«${desparejas[0].nombre}» trae ${desparejas[0].existencia.length} cantidades y hay ${e.tallas.length} tallas. ` +
      `Cada tienda necesita una cantidad por talla, en el mismo orden.`);
  }

  // Copia de trabajo: los movimientos se aplican sobre ella para que dos
  // propuestas no repartan la misma pieza dos veces.
  const stock = e.tiendas.map(t => [...t.existencia]);
  const nombre = (i: number) => e.tiendas[i].nombre;

  const huecosDe = (ti: number) => iNucleo.filter(k => stock[ti][k] < minimo);
  const rotasAntes = e.tiendas.map((_, i) => i).filter(i => huecosDe(i).length > 0).map(nombre);

  const movimientos: Movimiento[] = [];

  /* Se atienden PRIMERO las tiendas con menos huecos.
     Es lo que maximiza corridas reparadas por pieza movida: una tienda a la que
     le falta una talla se arregla con dos piezas y vuelve a vender el modelo
     completo; una a la que le faltan las tres necesita seis y quizá la cadena no
     las tenga. Empezar por la más rota gasta el inventario disponible en el caso
     más caro y deja sin arreglar dos que costaban poco. */
  const orden = e.tiendas.map((_, i) => i)
    .filter(i => huecosDe(i).length > 0)
    .sort((a, b) => huecosDe(a).length - huecosDe(b).length);

  for (const destino of orden) {
    /* Se SIMULA la reparación completa y solo se confirma si la tienda queda
       con la corrida entera.

       Sin esto, el algoritmo mandaba piezas a una tienda a la que igual le iba a
       faltar otra talla del centro: cuatro piezas movidas, cero corridas
       reparadas, y la tienda que las dio, más débil. Un traspaso que no completa
       la corrida es flete pagado sin venta ganada — y es peor que no hacer nada,
       porque desarma a la que sí estaba completa.

       Si no se puede reparar entera, no se mueve nada y esa tienda aparece en el
       resultado como lo que es: un problema de compra, no de acomodo. */
    const respaldo = stock.map(f => [...f]);
    const candidatos: Movimiento[] = [];
    let completa = true;

    for (const k of iNucleo) {
      let faltan = minimo - stock[destino][k];
      while (faltan > 0) {
        let mejor = -1, mejorSobra = 0;
        for (let i = 0; i < stock.length; i++) {
          if (i === destino) continue;
          const sobra = stock[i][k] - minimo;
          if (sobra > mejorSobra) { mejor = i; mejorSobra = sobra; }
        }
        if (mejor < 0) { completa = false; break; }   // nadie puede dar sin romperse

        const mueve = Math.min(faltan, mejorSobra);
        stock[mejor][k] -= mueve;
        stock[destino][k] += mueve;
        faltan -= mueve;

        const ya = candidatos.find(m => m.de === nombre(mejor) && m.talla === e.tallas[k]);
        if (ya) ya.piezas += mueve;
        else candidatos.push({ de: nombre(mejor), a: nombre(destino), talla: e.tallas[k], piezas: mueve, repara: true });
      }
      if (!completa) break;
    }

    if (completa && huecosDe(destino).length === 0) {
      movimientos.push(...candidatos);
    } else {
      // Se deshace: mover y deshacer en la copia, nunca a medias en la real.
      for (let i = 0; i < stock.length; i++) stock[i] = respaldo[i];
    }
  }

  const rotasDespues = e.tiendas.map((_, i) => i).filter(i => huecosDe(i).length > 0).map(nombre);
  const piezas = movimientos.reduce((a, m) => a + m.piezas, 0);

  // Lo que falta de verdad: si la cadena entera no llega al mínimo por tienda,
  // no hay acomodo que lo arregle. Es una respuesta distinta y más útil.
  const faltantes = iNucleo.map((k, j) => {
    const total = stock.reduce((a, f) => a + f[k], 0);
    const necesario = minimo * e.tiendas.length;
    return { talla: nucleo[j], piezas_faltantes: Math.max(0, necesario - total) };
  }).filter(f => f.piezas_faltantes > 0);

  const reparadas = rotasAntes.length - rotasDespues.length;
  const supuesto = nucleoSupuesto
    ? ` (tomé como centro ${nucleo.join(', ')}, las de en medio de tu corrida; si tu venta se concentra en otras, dilo y cambia todo)`
    : '';

  /* La concordancia se arma con una función y no a mano: «reparas las 1
     corridas rotas» es exactamente el tipo de frase que hace que una
     herramienta parezca hecha con una plantilla, y quien la lee deja de creerle
     los números. Los asteriscos de markdown tampoco van: esta cadena se enseña
     como texto plano en las tres puertas y saldrían literales. */
  const corridas = (n: number) => n === 1 ? 'la corrida rota' : `las ${n} corridas rotas`;
  const tiendasRotas = (l: string[]) => l.length === 1
    ? `1 tienda tiene la corrida rota (${l[0]})`
    : `${l.length} tiendas tienen la corrida rota (${l.join(', ')})`;

  const lectura =
    rotasAntes.length === 0
      ? `Ninguna de tus ${e.tiendas.length} tiendas tiene la corrida rota${supuesto}. No hay nada que mover: nivelar de más solo gasta fletes.`
    : movimientos.length === 0
      ? `${tiendasRotas(rotasAntes)}${supuesto}, y no es un problema de acomodo: ninguna otra tienda tiene de sobra lo que ${rotasAntes.length === 1 ? 'le' : 'les'} falta. Esto se arregla comprando, no moviendo.`
    : reparadas === rotasAntes.length
      ? `Con ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'} en ${movimientos.length} ${movimientos.length === 1 ? 'movimiento' : 'movimientos'} reparas ${corridas(rotasAntes.length)}${supuesto}. ${rotasAntes.length === 1 ? 'Esa tienda vuelve' : 'Esas tiendas vuelven'} a poder vender el modelo completo — que es distinto de tener más inventario.`
      : `Reparas ${reparadas} de ${rotasAntes.length} corridas rotas con ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}${supuesto}. ${rotasDespues.length === 1 ? 'Queda' : 'Quedan'} ${rotasDespues.join(', ')}: lo que ${rotasDespues.length === 1 ? 'le' : 'les'} falta no lo tiene nadie de sobra, así que eso ya no se arregla moviendo.`;

  return {
    nucleo,
    nucleo_supuesto: nucleoSupuesto,
    rotas_antes: rotasAntes,
    rotas_despues: rotasDespues,
    movimientos,
    piezas_movidas: piezas,
    faltantes_en_la_cadena: faltantes,
    lectura,
  };
}

export const nivelar = definirHerramienta({
  slug: 'nivelar-entre-tiendas',
  nombre: 'Qué mover entre tus tiendas',
  descripcion: 'Te dice qué piezas mover de qué tienda a cuál para reparar corridas rotas. No empareja existencias: repara más corridas moviendo menos piezas.',
  entrada: Entrada,
  puertas: ['web', 'mcp', 'api'],
  momento_sacs: 'Esto lo corriste con la existencia de un modelo, copiada a mano. Sacs ve la existencia por talla de TODOS tus modelos en TODAS tus tiendas al mismo tiempo, en vivo, y te avisa cuando una corrida se rompe — no cuando alguien se acuerda de revisarla. Además sabe la venta por talla de cada tienda, así que el centro de la corrida no lo supone: lo sabe.',
  cache_min: 0,
  ejecutar: async (entrada) => {
    const r = calcular(entrada);

    const lineas = [
      r.lectura, '',
      ...(r.movimientos.length ? ['Movimientos:', ...r.movimientos.map(m =>
        `· ${m.piezas} ${m.piezas === 1 ? 'pieza' : 'piezas'} de la talla ${m.talla}: ${m.de} → ${m.a}${m.repara ? ' (repara la corrida)' : ''}`), ''] : []),
      ...(r.faltantes_en_la_cadena.length ? ['Lo que le falta a la cadena entera (esto se compra, no se mueve):',
        ...r.faltantes_en_la_cadena.map(f => `· ${f.talla}: faltan ${f.piezas_faltantes} piezas para que todas las tiendas lleguen al mínimo`), ''] : []),
    ];

    return {
      ok: true,
      datos: r,
      resumen: r.lectura,
      respuesta_texto: lineas.join('\n'),
      fuentes: [
        { que: 'Corrida rota', de: `Una tienda a la que le falta al menos una talla del centro por debajo del mínimo (${entrada.minimo_por_talla ?? 2} piezas).` },
        { que: 'El orden de los movimientos', de: 'Se atienden primero las tiendas con MENOS huecos. Es lo que repara más corridas por pieza movida: empezar por la más rota gasta el inventario disponible en el caso más caro y deja sin arreglar dos que costaban poco.' },
        { que: 'Quién puede dar', de: `Solo quien queda por encima del mínimo después de dar. Quitarle a una tienda hasta dejarla corta es mover el problema, no resolverlo.` },
        ...(r.nucleo_supuesto ? [{ que: 'El centro de la corrida', de: `SUPUESTO: se tomaron las tres tallas de en medio (${r.nucleo.join(', ')}) porque no se dieron. Si tu venta se concentra en otras, el resultado cambia por completo.` }] : []),
      ],
      siguiente_paso: r.nucleo_supuesto
        ? { texto: 'Saca cuál es de verdad el centro de tu corrida con tu propia venta', url: '/herramientas/curva-de-tallas' }
        : { texto: 'Qué es la nivelación entre tiendas y por qué no es repartir parejo', url: '/recursos/nivelacion-inventario-entre-tiendas' },
    };
  },
});
