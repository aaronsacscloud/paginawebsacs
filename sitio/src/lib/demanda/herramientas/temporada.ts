// HERRAMIENTA GRATIS · ¿vas a sacar este estilo antes de que acabe la temporada?
//
// El sell-through solo —«llevo 60% vendido»— no decide nada, y es el número que
// todo mundo mira. Sesenta por ciento en tres semanas es un éxito; el mismo
// sesenta en toda la temporada es mercancía que se va a quedar. Lo que el
// comprador necesita saber no es el porcentaje: es **si va a salir a tiempo, y
// si no, cuándo es el último momento útil para hacer algo**.
//
// Esa es la diferencia con las cien calculadoras de sell-through que hay en
// internet: todas dividen. Ninguna contesta la pregunta.
//
// Una honestidad que va en la respuesta y no en la letra chica: la proyección
// supone que el ritmo se mantiene. En moda no se mantiene —la novedad se agota
// antes que el inventario—, así que el sobrante proyectado es un PISO, no un
// techo. Decirlo cambia la decisión: quien cree que su estimación es generosa
// espera, y esperar es exactamente lo que no hay que hacer.
import { z } from 'zod';
import { definirHerramienta } from '../herramienta';

export const Entrada = z.object({
  recibidas: z.number().min(1).max(10_000_000)
    .describe('Piezas que RECIBISTE de ese estilo. Es el denominador correcto del sell-through: dividir entre lo que queda da un número siempre alto que nunca sirve para decidir.'),
  vendidas: z.number().min(0).max(10_000_000)
    .describe('Piezas vendidas hasta hoy.'),
  semanas_transcurridas: z.number().min(0.5).max(260)
    .describe('Semanas que lleva el estilo en piso. Con menos de dos el ritmo todavía es ruido.'),
  semanas_restantes: z.number().min(0).max(260)
    .describe('Semanas que le quedan a la temporada para ese estilo, hasta la fecha en que ya no se vende a precio normal.'),
  costo_unitario: z.number().min(0).max(10_000_000).optional()
    .describe('Lo que te costó cada pieza. Opcional: sirve para decir cuánto dinero queda atrapado si no sale.'),
  aceleracion_max: z.number().min(1).max(10).default(2)
    .describe('Cuántas veces más rápido crees que puedes llegar a vender con una rebaja o un empujón. Es un SUPUESTO tuyo, no un dato: el valor por omisión es 2 (vender al doble), que es lo más que una rebaja suele mover de verdad. Súbelo si tu mercado responde más.'),
});

export type Salida = {
  sell_through: number;
  ritmo_semanal: number;
  existencia: number;
  semanas_de_cobertura: number | null;
  /** Lo que quedará sin vender si el ritmo se mantiene. Es un PISO. */
  sobrante_proyectado: number;
  dinero_atrapado: number | null;
  /** Cuántas veces más rápido hay que vender, desde hoy, para salir limpio. */
  aceleracion_necesaria: number | null;
  /** Última semana en la que la aceleración necesaria sigue siendo alcanzable. */
  semana_limite: number | null;
  veredicto: 'sale_solo' | 'ajustado' | 'no_sale' | 'ya_se_acabo' | 'muy_pronto';
  lectura: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function calcular(e: z.infer<typeof Entrada>): Salida {
  const existencia = Math.max(0, e.recibidas - e.vendidas);
  const sell = (e.vendidas / e.recibidas) * 100;
  const ritmo = e.vendidas / e.semanas_transcurridas;

  const cobertura = ritmo > 0 ? existencia / ritmo : null;
  const proyectadoAdicional = ritmo * e.semanas_restantes;
  const sobrante = Math.max(0, existencia - proyectadoAdicional);
  const dinero = e.costo_unitario != null ? Math.round(sobrante * e.costo_unitario) : null;

  // Lo que haría falta: vender toda la existencia en las semanas que quedan.
  const necesario = e.semanas_restantes > 0 ? existencia / e.semanas_restantes : Infinity;
  const aceleracion = ritmo > 0 && Number.isFinite(necesario) ? necesario / ritmo : null;

  /* La semana límite. Cada semana que pasa sin actuar, la existencia baja un
     poco (sigue vendiendo al ritmo de siempre) pero las semanas restantes bajan
     más rápido: la aceleración necesaria SUBE. Se busca la última semana en la
     que todavía cabe dentro de lo que el usuario cree que puede acelerar.

     Se recorre semana a semana en vez de despejarlo: la existencia no puede
     bajar de cero y la fórmula cerrada se rompe justo ahí, en el caso que más
     importa —el estilo que casi sale solo—. */
  let semanaLimite: number | null = null;
  if (ritmo > 0 && e.semanas_restantes > 0) {
    for (let w = 0; w < Math.floor(e.semanas_restantes); w++) {
      const quedan = e.semanas_restantes - w;
      const stock = Math.max(0, existencia - ritmo * w);
      if (stock <= 0) { semanaLimite = null; break; }
      if ((stock / quedan) / ritmo > e.aceleracion_max) break;
      semanaLimite = w;
    }
  }

  /* El veredicto va por el TAMAÑO del sobrante, no por si existe.
     La primera versión partía en `sobrante > 0`, y como sobrante > 0 equivale
     exactamente a aceleración > 1, un estilo al que le sobraban 3 piezas de 100
     salía con el mismo «no lo vas a sacar» que uno al que le sobraban 80. Ese
     aviso, dado por tres piezas, enseña a ignorar el aviso.

     El corte es 5% de lo recibido: por debajo de eso, una semana buena o un
     pedido de mayoreo lo resuelven y no hay nada que decidir. */
  const sobrantePct = (sobrante / e.recibidas) * 100;
  let veredicto: Salida['veredicto'];
  if (existencia <= 0) veredicto = 'ya_se_acabo';
  else if (e.semanas_transcurridas < 2) veredicto = 'muy_pronto';
  else if (ritmo <= 0) veredicto = 'no_sale';
  else if (sobrante <= 0) veredicto = 'sale_solo';
  else if (sobrantePct <= 5) veredicto = 'ajustado';
  else veredicto = 'no_sale';

  const pz = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? 'pieza' : 'piezas'}`;
  const dineroTxt = dinero ? ` Son ${dinero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })} a costo, parados.` : '';

  const lectura =
    veredicto === 'ya_se_acabo'
      ? `Vendiste todo: sell-through ${r1(sell)}%. La pregunta ya no es si sale, es si te faltó mercancía. Si se agotó antes de tiempo, lo que dejaste de vender no aparece en ningún reporte.`
    : veredicto === 'muy_pronto'
      ? `Lleva menos de dos semanas en piso: el ritmo todavía es ruido, no tendencia. Vuelve cuando haya corrido dos o tres semanas; decidir con esto es adivinar con decimales.`
    : veredicto === 'sale_solo'
      ? `Va bien: al ritmo de ${r1(ritmo)} piezas por semana, las ${pz(existencia)} que te quedan salen en ${r1(cobertura!)} semanas y te quedan ${r1(e.semanas_restantes)}. No toques el precio.`
    : veredicto === 'ajustado'
      ? `Sale raspando: te sobrarían ${pz(sobrante)} de las ${e.recibidas}, poco más del ${r1(sobrantePct)}%. Necesitas ${r1(necesario)} piezas por semana y vas a ${r1(ritmo)}. Una semana floja te deja con mercancía, así que este conviene mirarlo cada semana y no cada mes — pero todavía no es para rebajar.`
    : ritmo <= 0
      // Sin una sola venta no hay ritmo que proyectar, y decir «vende 0× más
      // rápido» —que es lo que salía— no significa nada. El problema tampoco es
      // de temporada: es que el estilo no arrancó.
      ? `No has vendido una sola pieza en ${r1(e.semanas_transcurridas)} ${e.semanas_transcurridas === 1 ? 'semana' : 'semanas'}. No hay ritmo que proyectar y esto ya no es un problema de temporada: o no se está exhibiendo, o el precio no corresponde, o ese estilo no es para este público. Las ${pz(existencia)} están completas.${dineroTxt}`
      : `No lo vas a sacar al ritmo de hoy. Te van a sobrar al menos ${pz(sobrante)} de las ${e.recibidas} que recibiste.${dineroTxt} Para salir limpio tendrías que vender ${r1(aceleracion!)}× más rápido desde esta semana`
        + (semanaLimite !== null && semanaLimite > 0
            ? `, y todavía te alcanza si actúas dentro de las próximas ${semanaLimite} ${semanaLimite === 1 ? 'semana' : 'semanas'}: después, ni vendiendo al ${e.aceleracion_max}× te da el tiempo.`
            : semanaLimite === 0
              ? `, y es esta semana: la siguiente ya no te da el tiempo aunque vendas al ${e.aceleracion_max}×.`
              : `. Ya pasó el punto en el que una rebaja normal alcanzaba; lo que queda es decidir cuánto vas a perder, no si vas a perder.`);

  return {
    sell_through: r1(sell),
    ritmo_semanal: r1(ritmo),
    existencia,
    semanas_de_cobertura: cobertura === null ? null : r1(cobertura),
    sobrante_proyectado: Math.round(sobrante),
    dinero_atrapado: dinero,
    aceleracion_necesaria: aceleracion === null || !Number.isFinite(aceleracion) ? null : r1(aceleracion),
    semana_limite: semanaLimite,
    veredicto,
    lectura,
  };
}

export const termometro = definirHerramienta({
  slug: 'sale-o-no-sale',
  nombre: '¿Vas a sacar este estilo a tiempo?',
  descripcion: 'Toma tu sell-through y contesta lo que el porcentaje no dice: si el estilo sale antes de fin de temporada, cuántas piezas sobran si no, y la última semana útil.',
  entrada: Entrada,
  puertas: ['web', 'mcp', 'api'],
  momento_sacs: 'Aquí escribiste un estilo, de memoria o de un reporte. Sacs lleva este cálculo de TODOS tus estilos al mismo tiempo, con sus recibos y sus ventas reales por tienda, y te avisa cuando uno cruza su semana límite — que es el único momento en que el dato sirve. Un cálculo que hay que acordarse de hacer es un cálculo que no se hace.',
  cache_min: 0,
  ejecutar: async (entrada) => {
    const r = calcular(entrada);

    const filas = [
      `· Sell-through: ${r.sell_through}% (${entrada.vendidas} de ${entrada.recibidas})`,
      `· Ritmo: ${r.ritmo_semanal} piezas por semana`,
      `· Te quedan ${r.existencia} piezas` + (r.semanas_de_cobertura !== null ? `, que a ese ritmo son ${r.semanas_de_cobertura} semanas de venta` : ''),
      r.sobrante_proyectado > 0 ? `· Sobrante proyectado: al menos ${r.sobrante_proyectado} piezas` : '',
      r.dinero_atrapado ? `· Dinero atrapado: ${r.dinero_atrapado.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })} a costo` : '',
      r.aceleracion_necesaria !== null ? `· Habría que vender ${r.aceleracion_necesaria}× más rápido para salir limpio` : '',
      r.semana_limite !== null ? `· Semana límite para actuar: dentro de ${r.semana_limite}` : '',
    ].filter(Boolean);

    return {
      ok: true,
      datos: r,
      resumen: r.lectura,
      respuesta_texto: [r.lectura, '', ...filas].join('\n'),
      fuentes: [
        { que: 'El sell-through', de: 'Vendidas ÷ RECIBIDAS. Dividir entre la existencia actual da un número siempre alto que no sirve para decidir.' },
        { que: 'El sobrante proyectado', de: 'Lo que queda menos lo que se vendería al ritmo actual en las semanas restantes. Es un PISO: en moda el ritmo baja conforme avanza la temporada, así que lo normal es que sobre más, no menos.' },
        { que: 'La semana límite', de: `La última semana en la que la aceleración que haría falta sigue cabiendo dentro del ${entrada.aceleracion_max ?? 2}× que se supuso alcanzable. Ese múltiplo es un supuesto tuyo, no un dato del mercado.` },
      ],
      siguiente_paso: r.veredicto === 'no_sale' || r.veredicto === 'ya_se_acabo'
        // Es el punto del artículo de sell-through: el número del estilo esconde
        // el de la talla. Un estilo «al 60%» puede ser centro agotado y extremos
        // intactos, y ahí la rebaja no arregla nada.
        ? { texto: 'Antes de rebajar, revisa si lo que te queda son tallas que nadie va a comprar o centro que se te agotó', url: '/herramientas/curva-de-tallas' }
        : { texto: 'Qué es el sell-through y contra qué se compara', url: '/recursos/sell-through' },
    };
  },
});
