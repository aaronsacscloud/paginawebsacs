// HERRAMIENTA GRATIS · margen, markup y hasta dónde aguanta un remate.
//
// El error que esta calculadora existe para evitar: confundir margen con
// markup. «Le subo 50% al costo» (markup) NO es lo mismo que «gano 50% de lo
// que vendo» (margen) — son la misma prenda con dos números distintos, y quien
// mezcla los dos termina cobrando de menos sin darse cuenta. Ejemplo real: una
// prenda de $200 de costo con 50% de MARKUP se vende en $300 (margen real
// 33.3%); la misma prenda con 50% de MARGEN se vende en $400. La diferencia es
// $100 por pieza, todo el año, en todo el catálogo.
//
// La segunda razón de ser: el descuento de temporada. En moda casi toda la
// mercancía se remata alguna vez, y la pregunta que nadie calcula a tiempo es
// «¿hasta qué % de descuento sigo ganando algo?». Aquí se responde con el
// mismo cálculo, no con una regla de dedo («nunca bajes de 30%») que no sabe
// cuánto costó tu prenda.
import { z } from 'zod';
import { definirHerramienta } from '../herramienta';

/* El IVA se separa del precio de lista porque en México el precio que ve el
   cliente YA lo incluye, pero el costo que paga la tienda al proveedor no es
   comparable contra ese precio completo: la parte de IVA no es ingreso de la
   tienda, es dinero que se entera al SAT. Comparar costo contra precio CON IVA
   da un margen inflado que no existe. */
export const Entrada = z.object({
  costo: z.number().min(0.01).max(10_000_000)
    .describe('Costo unitario de la prenda, SIN IVA: lo que pagaste al proveedor o fabricante por una pieza, antes de impuesto.'),
  precio_venta: z.number().min(0.01).max(10_000_000)
    .describe('Precio de venta al público, CON IVA incluido: el que va en la etiqueta o el ticket, el que ve el cliente.'),
  iva_pct: z.number().min(0).max(100).default(16)
    .describe('Tasa de IVA en México: 16% en el resto del país, 8% en la franja fronteriza. Se usa para saber cuánto del precio de etiqueta es ingreso real de la tienda.'),
  descuento_pct: z.number().min(0).max(95).optional()
    .describe('Porcentaje de descuento que piensas aplicar en temporada de rebajas o remate (ej. 30 para «30% de descuento»). Si lo das, la respuesta dice si a ese descuento todavía ganas o ya pierdes.'),
});

export type Salida = {
  precio_neto: number;
  margen_pct: number;
  markup_pct: number;
  precio_equilibrio: number;
  descuento_equilibrio_pct: number;
  ya_pierde_a_precio_lista: boolean;
  descuento?: {
    descuento_pct: number;
    precio_con_descuento: number;
    precio_neto_con_descuento: number;
    margen_pct: number;
    markup_pct: number;
    conviene: boolean;
    ganancia_o_perdida_por_pieza: number;
  };
  lectura: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcular(e: z.infer<typeof Entrada>): Salida {
  const factorIva = 1 + e.iva_pct / 100;

  const precioNeto = e.precio_venta / factorIva;
  const margenPct = ((precioNeto - e.costo) / precioNeto) * 100;
  const markupPct = ((precioNeto - e.costo) / e.costo) * 100;

  /* El precio de equilibrio es el precio DE ETIQUETA (con IVA) en el que ya no
     ganas ni pierdes: el costo, con el IVA que ese precio tendría que traer
     de vuelta para ser comparable. Por debajo de este precio, cada pieza que
     sale se vende bajo costo. */
  const precioEquilibrio = e.costo * factorIva;
  const yaPierde = e.precio_venta < precioEquilibrio;

  /* El descuento de equilibrio es, algebraicamente, EL MISMO NÚMERO que el
     margen: bajar el precio de etiqueta un % igual a tu margen te deja
     exactamente en el precio de equilibrio (el IVA se cancela en la cuenta).
     No es una coincidencia de este ejemplo — se cumple siempre —, y es la
     forma más rápida de contestar «¿cuánto puedo rebajar?»: lo mismo que ya
     ganas de margen, ni un punto más. */
  const descuentoEquilibrioPct = 100 * (1 - precioEquilibrio / e.precio_venta);

  let descuento: Salida['descuento'];
  if (e.descuento_pct != null) {
    const precioConDescuento = e.precio_venta * (1 - e.descuento_pct / 100);
    const precioNetoConDescuento = precioConDescuento / factorIva;
    const margenDescPct = ((precioNetoConDescuento - e.costo) / precioNetoConDescuento) * 100;
    const markupDescPct = ((precioNetoConDescuento - e.costo) / e.costo) * 100;
    descuento = {
      descuento_pct: e.descuento_pct,
      precio_con_descuento: r2(precioConDescuento),
      precio_neto_con_descuento: r2(precioNetoConDescuento),
      margen_pct: r1(margenDescPct),
      markup_pct: r1(markupDescPct),
      conviene: precioConDescuento >= precioEquilibrio,
      ganancia_o_perdida_por_pieza: r2(precioNetoConDescuento - e.costo),
    };
  }

  const lecturaBase = yaPierde
    ? `Ya vendes bajo costo a precio de lista: cada pieza a $${r2(e.precio_venta)} te cuesta más de lo que recuperas. Necesitas al menos $${r2(precioEquilibrio)} para no perder.`
    : `Con margen de ${r1(margenPct)}% (markup de ${r1(markupPct)}%), puedes rebajar hasta ${r1(descuentoEquilibrioPct)}% antes de vender bajo costo — el precio ya no puede bajar de $${r2(precioEquilibrio)}.`;

  const lecturaDescuento = descuento
    ? descuento.conviene
      ? ` Al ${descuento.descuento_pct}% de descuento sigues ganando $${descuento.ganancia_o_perdida_por_pieza} por pieza (margen ${descuento.margen_pct}%).`
      : ` Al ${descuento.descuento_pct}% de descuento ya PIERDES $${Math.abs(descuento.ganancia_o_perdida_por_pieza)} por pieza: ese remate cuesta más de lo que recupera.`
    : '';

  return {
    precio_neto: r2(precioNeto),
    margen_pct: r1(margenPct),
    markup_pct: r1(markupPct),
    precio_equilibrio: r2(precioEquilibrio),
    descuento_equilibrio_pct: r1(descuentoEquilibrioPct),
    ya_pierde_a_precio_lista: yaPierde,
    descuento,
    lectura: lecturaBase + lecturaDescuento,
  };
}

export const margenYMarkup = definirHerramienta({
  slug: 'margen',
  nombre: 'Margen y markup para moda',
  descripcion: 'Calcula margen y markup a partir de costo y precio, y hasta qué % de descuento de temporada puedes rematar antes de vender bajo costo.',
  entrada: Entrada,
  puertas: ['web', 'mcp', 'api'],
  momento_sacs: 'Aquí capturaste una prenda a mano. Sacs calcula margen y markup de TODO tu catálogo en automático desde el costo y el precio que ya tienes cargados, y avisa solo cuando una promoción o un descuento por sucursal deja una prenda vendiéndose bajo costo — antes de que se autorice, no después del corte de caja.',
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
        `Precio de venta: $${entrada.precio_venta} (neto sin IVA: $${r.precio_neto})`,
        `Costo: $${entrada.costo}`,
        `Margen: ${r.margen_pct}% · Markup: ${r.markup_pct}%`,
        `Precio de equilibrio (deja de convenir rematar por debajo): $${r.precio_equilibrio}`,
        `Descuento máximo antes de vender bajo costo: ${r.descuento_equilibrio_pct}%`,
        ...(r.descuento ? [
          '',
          `Con ${r.descuento.descuento_pct}% de descuento: precio $${r.descuento.precio_con_descuento}, margen ${r.descuento.margen_pct}%, ${r.descuento.conviene ? 'conviene' : 'YA NO conviene'}.`,
        ] : []),
      ].join('\n'),
      fuentes: [
        { que: 'El margen', de: 'Ganancia entre precio de venta SIN IVA (no todo el precio de etiqueta es ingreso de la tienda)' },
        { que: 'El precio de equilibrio', de: 'El costo llevado al precio de etiqueta con el mismo IVA, para que sea comparable contra lo que se cobra' },
      ],
      siguiente_paso: { texto: 'Si fabricas la prenda, calcula su costo real de maquila antes de fijar el precio', url: '/herramientas/costo-de-maquila' },
    };
  },
});
