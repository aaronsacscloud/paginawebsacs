// HERRAMIENTA GRATIS · costo de maquila y precio mínimo de venta.
//
// Es la calculadora para quien FABRICA, no revende: una marca de ropa que
// manda cortar y coser su propia colección. El error que más se ve en marcas
// nuevas es sacar el costo sumando solo tela + maquila y olvidar la merma —el
// desperdicio de tela por errores de trazo, retazo y piezas que salen
// defectuosas—, que en moda no es un accidente ocasional: es un porcentaje
// esperado del patrón, y si no se mete al costo, se está regalando tela en
// cada prenda sin saberlo.
//
// La segunda pieza que le falta a un Excel de costeo casero: el precio no se
// saca sumándole «lo que se sienta bien» al costo. Se saca del margen que de
// verdad se quiere ganar SOBRE EL PRECIO DE VENTA (no sobre el costo, que es
// el otro error común — confundirlo con markup, el mismo que corrige la
// calculadora de margen).
import { z } from 'zod';
import { definirHerramienta } from '../herramienta';

const Insumo = z.object({
  nombre: z.string().min(1).max(60)
    .describe('Nombre del insumo o tela: "tela principal", "forro", "entretela", "cierre", "botones", "hilo", "etiqueta".'),
  costo_por_prenda: z.number().min(0).max(100_000)
    .describe('Cuánto cuesta ese insumo YA EN LA CANTIDAD que lleva una sola prenda. Si un metro de tela cuesta $120 y la prenda lleva 1.5 metros, aquí van $180 — la multiplicación se hace antes de capturar, no dentro de la herramienta, porque cada insumo se mide distinto (metros, piezas, pares).'),
});

export const Entrada = z.object({
  insumos: z.array(Insumo).min(1).max(30)
    .describe('Cada tela e insumo que lleva la prenda: tela principal, forro, entretela, cierre, botones, hilo, etiqueta, bolsa de empaque.'),
  corte_por_prenda: z.number().min(0).max(100_000)
    .describe('Costo de corte por prenda: lo que cobra el cortador, o tu propio costo de corte prorrateado entre las piezas del lote.'),
  confeccion_por_prenda: z.number().min(0).max(100_000)
    .describe('Costo de confección (maquila) por prenda: lo que cobra el taller por coser y armar una sola pieza.'),
  merma_pct: z.number().min(0).max(50).default(5)
    .describe('Porcentaje que se pierde de tela e insumos por errores de trazo, retazo y piezas defectuosas. En moda es normal entre 3% y 10% según qué tan complicado sea el patrón — un patrón con muchas piezas chicas desperdicia más que uno de piezas grandes.'),
  otros_costos_por_prenda: z.number().min(0).max(100_000).optional()
    .describe('Cualquier otro costo por prenda que no sea insumo, corte o confección: bordado, estampado, lavado, planchado, avíos de empaque, talla y etiquetado.'),
  piezas_del_lote: z.number().min(1).max(1_000_000).default(1)
    .describe('Cuántas piezas vas a mandar hacer en esta corrida, para sacar el costo total del lote (útil para cotizar con el taller o para saber cuánto capital necesitas).'),
  margen_objetivo_pct: z.number().min(0).max(95).optional()
    .describe('El margen que quieres ganar, medido SOBRE EL PRECIO DE VENTA (no sobre el costo — eso sería markup, un número distinto). Si lo das, la herramienta calcula el precio mínimo al que debes vender cada prenda para lograrlo.'),
  iva_pct: z.number().min(0).max(100).default(16)
    .describe('IVA para pasar el precio mínimo de venta de neto a precio de etiqueta. 16% es la tasa general en México, 8% en la franja fronteriza.'),
});

export type Salida = {
  costo_insumos: number;
  costo_insumos_con_merma: number;
  costo_corte: number;
  costo_confeccion: number;
  costo_otros: number;
  costo_por_prenda: number;
  costo_del_lote: number;
  desglose_pct: { concepto: string; pct: number }[];
  precio_minimo?: {
    margen_objetivo_pct: number;
    precio_neto: number;
    precio_con_iva: number;
    markup_equivalente_pct: number;
  };
  lectura: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcular(e: z.infer<typeof Entrada>): Salida {
  const costoInsumos = e.insumos.reduce((s, i) => s + i.costo_por_prenda, 0);
  const costoInsumosConMerma = costoInsumos * (1 + e.merma_pct / 100);
  const otros = e.otros_costos_por_prenda ?? 0;

  const costoPorPrenda = costoInsumosConMerma + e.corte_por_prenda + e.confeccion_por_prenda + otros;
  const costoDelLote = costoPorPrenda * e.piezas_del_lote;

  const base = costoPorPrenda || 1; // solo para no dividir entre 0 en el desglose
  const desglose = [
    { concepto: 'Telas e insumos (con merma)', pct: r1((costoInsumosConMerma / base) * 100) },
    { concepto: 'Corte', pct: r1((e.corte_por_prenda / base) * 100) },
    { concepto: 'Confección', pct: r1((e.confeccion_por_prenda / base) * 100) },
    ...(otros > 0 ? [{ concepto: 'Otros', pct: r1((otros / base) * 100) }] : []),
  ];

  let precioMinimo: Salida['precio_minimo'];
  if (e.margen_objetivo_pct != null) {
    /* Precio a partir de un margen sobre EL PRECIO, no sobre el costo: por eso
       se divide entre (1 - margen), no se multiplica por (1 + margen). Esa
       segunda forma es la fórmula del MARKUP, y usarla cuando lo que se
       quiere es un margen objetivo deja la prenda vendiéndose por debajo de
       lo que la marca cree que está ganando. */
    const precioNeto = costoPorPrenda / (1 - e.margen_objetivo_pct / 100);
    const precioConIva = precioNeto * (1 + e.iva_pct / 100);
    const markupEquivalente = ((precioNeto - costoPorPrenda) / costoPorPrenda) * 100;
    precioMinimo = {
      margen_objetivo_pct: e.margen_objetivo_pct,
      precio_neto: r2(precioNeto),
      precio_con_iva: r2(precioConIva),
      markup_equivalente_pct: r1(markupEquivalente),
    };
  }

  const lectura = precioMinimo
    ? `Cada prenda te cuesta $${r2(costoPorPrenda)} (lote de ${e.piezas_del_lote}: $${r2(costoDelLote)}). Para ganar ${precioMinimo.margen_objetivo_pct}% de margen, véndela en al menos $${precioMinimo.precio_con_iva} con IVA — eso es un markup de ${precioMinimo.markup_equivalente_pct}% sobre el costo, no de ${precioMinimo.margen_objetivo_pct}%.`
    : `Cada prenda te cuesta $${r2(costoPorPrenda)}. El lote completo de ${e.piezas_del_lote} piezas cuesta $${r2(costoDelLote)}.`;

  return {
    costo_insumos: r2(costoInsumos),
    costo_insumos_con_merma: r2(costoInsumosConMerma),
    costo_corte: r2(e.corte_por_prenda),
    costo_confeccion: r2(e.confeccion_por_prenda),
    costo_otros: r2(otros),
    costo_por_prenda: r2(costoPorPrenda),
    costo_del_lote: r2(costoDelLote),
    desglose_pct: desglose,
    precio_minimo: precioMinimo,
    lectura,
  };
}

export const costoDeMaquila = definirHerramienta({
  slug: 'costo-de-maquila',
  nombre: 'Costo de maquila por prenda',
  descripcion: 'Para marcas que fabrican: suma telas, insumos, corte, confección y merma para sacar el costo real por prenda, el costo del lote y el precio mínimo de venta para el margen que quieres.',
  entrada: Entrada,
  puertas: ['web', 'mcp', 'api'],
  momento_sacs: 'Este costo lo calculaste una vez, a mano, para un modelo. Sacs lo guarda por modelo y por lote, así que el costo real de fabricación —con su merma incluida— entra al inventario en el momento en que se recibe la corrida, y el margen que ves en reportes ya está sacado sobre el costo verdadero, no sobre uno aproximado en una hoja aparte.',
  cache_min: 0,
  ejecutar: async (entrada) => {
    const r = calcular(entrada);
    return {
      ok: true,
      datos: r,
      resumen: r.lectura,
      respuesta_texto: [
        r.lectura,
        '',
        `Insumos: $${r.costo_insumos} (con ${entrada.merma_pct}% de merma: $${r.costo_insumos_con_merma})`,
        `Corte: $${r.costo_corte} · Confección: $${r.costo_confeccion}${r.costo_otros ? ` · Otros: $${r.costo_otros}` : ''}`,
        `Costo por prenda: $${r.costo_por_prenda}`,
        `Costo del lote (${entrada.piezas_del_lote} piezas): $${r.costo_del_lote}`,
        ...(r.precio_minimo ? [
          '',
          `Precio mínimo para ${r.precio_minimo.margen_objetivo_pct}% de margen: $${r.precio_minimo.precio_con_iva} con IVA (markup equivalente ${r.precio_minimo.markup_equivalente_pct}%).`,
        ] : []),
      ].join('\n'),
      fuentes: [
        { que: 'El costo por prenda', de: 'Suma de insumos con merma, más corte, más confección, más otros costos' },
        { que: 'El precio mínimo', de: 'Costo por prenda entre (1 − margen objetivo), no costo × (1 + margen) — esa segunda fórmula es markup, no margen' },
      ],
      siguiente_paso: { texto: 'Antes de fijar el precio final, revisa cuánto margen deja cada descuento de temporada', url: '/herramientas/margen' },
    };
  },
});
