// HERRAMIENTA GRATIS · punto de reorden por talla.
//
// La pregunta que esta herramienta contesta no es «¿cuánto me queda?» sino
// «¿ya debería haber pedido?». Son distintas: una tienda que revisa existencia
// y ve «me quedan 8 M» no sabe si eso es mucho o poco sin saber qué tan rápido
// se vende esa talla y cuánto tarda el proveedor en surtir. Las mismas 8
// piezas son sobra tranquila con un proveedor de 3 días y una M ya rota con
// uno de 30.
//
// El mismo error de lectura que corrige `curva-de-tallas` aplica aquí al
// revés: si se espera a que la talla LLEGUE A CERO para reordenar, ya se
// perdieron ventas mientras el pedido nuevo llegaba. El punto de reorden es el
// nivel de existencia en el que hay que levantar el pedido — antes de cero,
// con el colchón suficiente para aguantar el tiempo de entrega.
import { z } from 'zod';
import { definirHerramienta } from '../herramienta';

const Talla = z.object({
  talla: z.string().min(1).max(12)
    .describe('Nombre de la talla tal como la maneja la tienda: XS, S, M, 28, 5.5.'),
  vendidas: z.number().min(0).max(1_000_000)
    .describe('Piezas vendidas de esa talla en el periodo que estás midiendo.'),
  existencia_actual: z.number().min(0).max(1_000_000)
    .describe('Piezas que tienes AHORITA de esa talla, sumando tienda y almacén.'),
});

export const Entrada = z.object({
  periodo_dias: z.number().min(1).max(3650).default(30)
    .describe('Días que llevas midiendo la venta (2 a 4 semanas es lo normal): con esto se saca el ritmo de venta diario de cada talla.'),
  tiempo_entrega_dias: z.number().min(0).max(365)
    .describe('Cuántos días tarda tu proveedor en surtir el pedido, desde que lo levantas hasta que la mercancía está lista para vender.'),
  dias_seguridad: z.number().min(0).max(90).default(3)
    .describe('Colchón en DÍAS de venta, para cubrir imprevistos: que el proveedor se atrase o que la talla venda más rápido de lo normal. Se convierte en piezas multiplicando por el ritmo de venta de cada talla.'),
  tallas: z.array(Talla).min(1).max(40)
    .describe('Una entrada por talla del mismo modelo o de la misma familia de tallas.'),
});

export type Salida = {
  tallas: {
    talla: string;
    consumo_diario: number;
    punto_reorden: number;
    existencia_actual: number;
    pedir_ahora: boolean;
    cantidad_a_pedir: number;
    dias_para_reordenar: number | null;
  }[];
  urgentes: string[];
  total_piezas_a_pedir: number;
  lectura: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function calcular(e: z.infer<typeof Entrada>): Salida {
  const filas = e.tallas.map(t => {
    const consumoDiario = t.vendidas / e.periodo_dias;

    /* El punto de reorden es la demanda que se va a consumir MIENTRAS llega el
       pedido nuevo, más el colchón de seguridad — ambos medidos en piezas al
       mismo ritmo de venta de la talla. Cuando la existencia cae a este nivel
       o menos, ya no sobra margen: hay que pedir HOY, no cuando se pueda. */
    const puntoReorden = consumoDiario * (e.tiempo_entrega_dias + e.dias_seguridad);

    const pedirAhora = t.existencia_actual <= puntoReorden;

    /* Cuánto pedir: lo que hace falta para volver a tener cubierto el tiempo
       de entrega más el colchón, partiendo de la existencia que ya tienes.
       No es la orden completa del modelo — es SOLO lo que falta para dejar de
       estar en riesgo con esta talla. */
    const cantidadAPedir = pedirAhora ? Math.max(0, Math.round(puntoReorden - t.existencia_actual)) : 0;

    /* Días para llegar al punto de reorden: positivo = todavía faltan tantos
       días para que convenga levantar el pedido; negativo = ya se pasó esa
       fecha por esos mismos días (el pedido está atrasado, no a tiempo).
       Sin venta en el periodo no hay ritmo con qué contar los días: se avisa
       en vez de fingir un número. */
    const diasParaReordenar = consumoDiario > 0
      ? (t.existencia_actual - puntoReorden) / consumoDiario
      : null;

    return {
      talla: t.talla,
      consumo_diario: r1(consumoDiario),
      punto_reorden: Math.round(puntoReorden * 10) / 10,
      existencia_actual: t.existencia_actual,
      pedir_ahora: pedirAhora,
      cantidad_a_pedir: cantidadAPedir,
      dias_para_reordenar: diasParaReordenar === null ? null : r1(diasParaReordenar),
    };
  });

  const urgentes = filas.filter(f => f.pedir_ahora).map(f => f.talla);
  const totalAPedir = filas.reduce((s, f) => s + f.cantidad_a_pedir, 0);

  const masUrgente = filas
    .filter(f => f.dias_para_reordenar !== null)
    .sort((a, b) => (a.dias_para_reordenar as number) - (b.dias_para_reordenar as number))[0];

  const lectura = urgentes.length === 0
    ? `Ninguna talla necesita pedirse todavía. La más próxima a su punto de reorden es ${masUrgente ? `${masUrgente.talla} (en ${masUrgente.dias_para_reordenar} días)` : 'incierta por falta de venta registrada'}.`
    : `${urgentes.length} ${urgentes.length === 1 ? 'talla necesita' : 'tallas necesitan'} pedirse ya: ${urgentes.join(', ')}. En total son ${totalAPedir} piezas para no llegar a cero antes de que surta el proveedor.`;

  return { tallas: filas, urgentes, total_piezas_a_pedir: totalAPedir, lectura };
}

export const puntoDeReorden = definirHerramienta({
  slug: 'punto-de-reorden',
  nombre: 'Punto de reorden por talla',
  descripcion: 'Con tu venta diaria, el tiempo de entrega del proveedor y un colchón de seguridad, calcula cuándo volver a pedir cada talla y cuánto, antes de que se rompa la corrida.',
  entrada: Entrada,
  puertas: ['web', 'mcp', 'api'],
  momento_sacs: 'Aquí capturaste la existencia de un modelo, a mano, una vez. Sacs conoce la existencia y la venta por talla de TODOS tus modelos en TODAS tus tiendas en vivo, así que puede avisarte del punto de reorden de cada talla sin que nadie tenga que sentarse a calcularlo — el mismo cálculo que corre aquí gratis para un modelo, corriendo solo todo el tiempo para el catálogo completo.',
  cache_min: 0,
  ejecutar: async (entrada) => {
    const r = calcular(entrada);
    const filas = r.tallas.map(t => {
      const estado = t.pedir_ahora
        ? `PEDIR YA (pedir ${t.cantidad_a_pedir})`
        : t.dias_para_reordenar !== null
          ? `en ${t.dias_para_reordenar} días`
          : 'sin venta registrada en el periodo';
      return `· ${t.talla}: existencia ${t.existencia_actual}, consumo ${t.consumo_diario}/día, punto de reorden ${t.punto_reorden} → ${estado}`;
    });

    return {
      ok: true,
      datos: r,
      resumen: r.lectura,
      respuesta_texto: [
        r.lectura,
        '',
        'Por talla:',
        ...filas,
      ].join('\n'),
      fuentes: [
        { que: 'El punto de reorden', de: 'Consumo diario × (días de entrega + días de colchón de seguridad)' },
        { que: 'Cuánto pedir', de: 'Lo que falta para volver a cubrir el tiempo de entrega y el colchón, desde la existencia actual' },
      ],
      siguiente_paso: r.urgentes.length
        ? { texto: 'Antes de pedir, revisa si la curva de tallas de este modelo cambió por agotamientos', url: '/herramientas/curva-de-tallas' }
        : { texto: 'Cómo se arman las órdenes de compra por talla en Sacs', url: '/producto/ordenes-de-compra' },
    };
  },
});
