// HERRAMIENTA GRATIS · el auditor de curva de tallas.
//
// Por qué esta primero: es el único cálculo del ramo que casi ningún sistema
// hace bien, y que se puede hacer con datos que el retailer YA tiene a mano
// —lo que vendió por talla y cuándo se le agotó cada una—. No necesita
// integración, ni cuenta, ni subir un catálogo.
//
// La idea que la hace distinta de cualquier plantilla de Excel: **una talla que
// vendió poco no es lo mismo que una talla que no estuvo**. Si la M se agotó el
// día 9 de un periodo de 60, sus otros 51 días de cero no significan que no
// guste: significan que no había qué vender. Leer eso como «la M vende poco» y
// comprar menos M es cómo se rompe la curva temporada tras temporada.
//
// Todo el cálculo vive aquí y no en el navegador a propósito: es la misma
// función que va a atender al MCP y a la API. Una implementación, tres puertas.
import { z } from 'zod';
import { definirHerramienta } from '../herramienta';

/* Los `.describe()` NO son documentación de cortesía: son lo único que un
   modelo lee del esquema cuando decide qué mandar por el MCP. Sin ellos,
   `dias_con_existencia` es un número sin significado y la IA manda el periodo
   completo en todas las tallas «por si acaso» — con lo que la herramienta
   devuelve exactamente la lectura ingenua que existe para corregir. El JSDoc de
   arriba no viaja: zod no lo lee. El texto que importa va aquí. */
const Talla = z.object({
  talla: z.string().min(1).max(12)
    .describe('Nombre de la talla tal como la maneja la tienda: XS, S, M, 28, 5.5.'),
  vendidas: z.number().min(0).max(1_000_000)
    .describe('Piezas vendidas de esa talla en el periodo.'),
  dias_con_existencia: z.number().min(0).max(3650).optional()
    .describe('Cuántos de los días del periodo esa talla estuvo DISPONIBLE para vender. Es el dato que cambia el resultado: si la talla se agotó el día 9 de 60, aquí van 9, no 60. Omítelo solo si de verdad se desconoce; entonces se asume el periodo completo y no hay corrección por agotamiento.'),
  recibidas: z.number().min(0).max(1_000_000).optional()
    .describe('Piezas que se recibieron de esa talla. Opcional; hoy no entra al cálculo.'),
});

export const Entrada = z.object({
  periodo_dias: z.number().min(1).max(3650).default(60)
    .describe('Días que duró el periodo analizado (una temporada, un trimestre).'),
  tallas: z.array(Talla).min(2).max(40)
    .describe('Una entrada por talla del mismo estilo. Mínimo dos: una curva de una talla no es una curva.'),
  piezas_a_comprar: z.number().min(0).max(1_000_000).optional()
    .describe('Piezas que se piensan comprar en la siguiente orden. Si se da, la respuesta trae cuántas de cada talla; si no, solo la proporción.'),
});

export type Salida = {
  tallas: {
    talla: string;
    vendidas: number;
    /** Lo que habría vendido al ritmo que llevaba, con existencia todo el periodo. */
    demanda_real: number;
    dias_sin_existencia: number;
    se_agoto: boolean;
    estimacion_topada?: boolean;
    curva_ingenua: number;
    curva_corregida: number;
    piezas?: number;
  }[];
  nucleo: string[];
  corrida_rota: boolean;
  diferencia_pct: number;
  lectura: string;
};

/** Redondea una lista de proporciones a enteros conservando el total. El resto
 *  mayor se lleva la pieza sobrante: repartir «la que falta» al azar cambia la
 *  curva justo en las tallas del centro, que son las que importan. */
function repartir(proporciones: number[], total: number): number[] {
  const crudo = proporciones.map(p => p * total);
  const base = crudo.map(Math.floor);
  let faltan = total - base.reduce((a, b) => a + b, 0);
  const orden = crudo.map((c, i) => ({ i, resto: c - Math.floor(c) })).sort((a, b) => b.resto - a.resto);
  for (let k = 0; k < faltan; k++) base[orden[k % orden.length].i]++;
  return base;
}

export function calcular(e: z.infer<typeof Entrada>): Salida {
  const periodo = e.periodo_dias;

  const filas = e.tallas.map(t => {
    const dias = Math.min(t.dias_con_existencia ?? periodo, periodo);
    const seAgoto = dias > 0 && dias < periodo;

    /* La proyección lineal es un TECHO, no una predicción, y hay que decirlo.
       Una talla que vendió 14 en 9 días no habría vendido 93 en 60: la demanda
       de una prenda decae conforme avanza la temporada —la novedad se agota
       antes que el inventario—. Proyectar plano sobrestima, y sobrestimar la
       talla del centro es el otro modo de romper la curva.

       El tope de 3× lo que se vendió de verdad es una barrera contra la
       extrapolación salvaje: sin él, una talla que se agotó el día 2 saldría
       con una demanda treinta veces mayor a lo observado y arrastraría la
       compra entera detrás de un dato de dos días. */
    const proyeccionPlana = dias > 0 ? (t.vendidas / dias) * periodo : t.vendidas;
    const techo = t.vendidas * 3;
    const demanda = seAgoto ? Math.min(proyeccionPlana, techo) : t.vendidas;
    const topada = seAgoto && proyeccionPlana > techo;
    return {
      talla: t.talla,
      vendidas: t.vendidas,
      demanda_real: Math.round(demanda * 10) / 10,
      dias_sin_existencia: Math.max(0, periodo - dias),
      se_agoto: seAgoto,
      estimacion_topada: topada,
    };
  });

  const totalVendido = filas.reduce((s, f) => s + f.vendidas, 0) || 1;
  const totalReal = filas.reduce((s, f) => s + f.demanda_real, 0) || 1;

  const tallas = filas.map(f => ({
    ...f,
    curva_ingenua: Math.round((f.vendidas / totalVendido) * 1000) / 10,
    curva_corregida: Math.round((f.demanda_real / totalReal) * 1000) / 10,
  }));

  if (e.piezas_a_comprar) {
    const piezas = repartir(tallas.map(t => t.demanda_real / totalReal), e.piezas_a_comprar);
    tallas.forEach((t, i) => ((t as any).piezas = piezas[i]));
  }

  /* El núcleo: las tallas que juntas hacen el 60% de la demanda, y nunca menos
     de tres. Una sola talla no es un núcleo: la corrida se rompe cuando faltan
     VARIAS del centro, y con un núcleo de uno la alerta no se dispararía nunca. */
  const porPeso = [...tallas].sort((a, b) => b.curva_corregida - a.curva_corregida);
  const nucleo: string[] = [];
  let acumulado = 0;
  for (const t of porPeso) {
    nucleo.push(t.talla);
    acumulado += t.curva_corregida;
    if (acumulado >= 60 && nucleo.length >= 3) break;
  }

  // Corrida rota: falta el centro, que es distinto de que falte mercancía.
  const corridaRota = tallas.filter(t => nucleo.includes(t.talla) && t.se_agoto).length >= 2;

  // Cuánto cambia la compra por hacer bien la lectura. Es el número que hace
  // entender el problema sin explicarlo.
  const diferencia = tallas.reduce((s, t) => s + Math.abs(t.curva_corregida - t.curva_ingenua), 0) / 2;

  const agotadas = tallas.filter(t => t.se_agoto);
  const topadas = tallas.filter((t: any) => t.estimacion_topada);
  const aviso = topadas.length
    ? ` (${topadas.map(t => t.talla).join(', ')} se agotó muy pronto: su estimación se topó en el triple de lo vendido, porque proyectar desde tan pocos días da números que no se sostienen).`
    : '';

  const lectura = !agotadas.length
    ? 'Ninguna talla se agotó en el periodo, así que la venta ya refleja la demanda real: las dos curvas coinciden.'
    : corridaRota
      ? `Se te rompió la corrida: ${agotadas.filter(t => nucleo.includes(t.talla)).map(t => t.talla).join(', ')} son de tu núcleo y se agotaron. Lo que quedó en piso ya no se vende como conjunto.`
      : `${agotadas.length} ${agotadas.length === 1 ? 'talla se agotó' : 'tallas se agotaron'} antes de tiempo (${agotadas.map(t => t.talla).join(', ')}). Su venta está subestimada: no dejaron de venderse, dejaron de estar.${aviso}`;

  return {
    tallas, nucleo, corrida_rota: corridaRota,
    diferencia_pct: Math.round(diferencia * 10) / 10,
    lectura,
  };
}

export const auditorCurva = definirHerramienta({
  slug: 'curva-de-tallas',
  nombre: 'Auditor de curva de tallas',
  descripcion: 'Calcula qué proporción de cada talla comprar, corrigiendo por los días que cada talla estuvo agotada. Vender poco no es lo mismo que no haber estado.',
  entrada: Entrada,
  puertas: ['web', 'mcp', 'api'],
  momento_sacs: 'La herramienta calcula la curva con los días de agotamiento que tú le des. Sacs los REGISTRA solos: sabe desde qué momento cada talla de cada tienda estuvo en cero, sin que nadie lo anote. Esa es la diferencia entre hacer este cálculo una vez al año a mano y tenerlo en cada orden de compra.',
  cache_min: 0,
  ejecutar: async (entrada) => {
    const r = calcular(entrada);
    // La tabla en texto es lo que lee un modelo por el MCP. Va con los mismos
    // números que la web enseña en su tabla: una sola fuente, dos formatos.
    const filas = r.tallas.map(t => {
      const marcas = [
        r.nucleo.includes(t.talla) ? 'núcleo' : '',
        t.se_agoto ? `se agotó, le faltaron ${t.dias_sin_existencia} días` : '',
      ].filter(Boolean).join('; ');
      const compra = t.piezas !== undefined ? `, comprar ${t.piezas}` : '';
      return `· ${t.talla}: vendió ${t.vendidas}, demanda real ${t.demanda_real}, `
        + `curva ${t.curva_ingenua}% → ${t.curva_corregida}%${compra}${marcas ? ` (${marcas})` : ''}`;
    });

    return {
      ok: true,
      datos: r,
      resumen: r.lectura,
      respuesta_texto: [
        r.lectura,
        '',
        'Curva corregida por talla:',
        ...filas,
        '',
        `Leer los agotamientos cambia la compra en ${r.diferencia_pct}% de las piezas.`,
      ].join('\n'),
      fuentes: [
        { que: 'La demanda real de una talla', de: 'Su ritmo de venta mientras tuvo existencia, proyectado al periodo — con tope en el triple de lo vendido, porque la demanda decae con la temporada y proyectar plano sobrestima' },
        { que: 'El núcleo', de: 'Las tallas que suman el 60% de la demanda corregida' },
      ],
      siguiente_paso: r.corrida_rota
        ? { texto: 'Antes de comprar, revisa si otra de tus tiendas tiene las tallas que a ti te faltan', url: '/recursos/nivelacion-inventario-entre-tiendas' }
        : { texto: 'Qué es la curva de tallas y por qué se rompe', url: '/recursos/curva-de-tallas' },
    };
  },
});
