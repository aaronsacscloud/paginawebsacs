// DEMAND ENGINE · qué vale cada problema.
//
// El reparto de trabajo aquí es deliberado y es lo que hace que el score se
// pueda auditar y recalibrar:
//
//   · el MODELO juzga cualidades —¿esto es de lo nuestro?, ¿quien lo pregunta
//     está cerca de comprar?, ¿se resuelve con una herramienta gratis?— y deja
//     por escrito POR QUÉ;
//   · el CÓDIGO calcula el número con esos juicios y los pesos vigentes.
//
// Si el modelo devolviera el score de una vez, nadie podría saber de dónde sale
// un 78, ni cambiar la fórmula sin volver a pagar por todo el corpus.
import { supabase } from '../supabase';
import { preguntar, PARA } from './ia';
import { MODULOS } from '../crm/ti/conocimiento/producto';
import { registrar } from './handlers';
import type { ResultadoHandler } from './tipos';

/** Lo que Sacs hace, en corto. Sale de la misma ficha que usa el agente SDR:
 *  una sola verdad sobre el producto, no dos que se desincronizan. */
const QUE_ES_SACS = `Sacs es un sistema para negocios de MODA en México: tiendas de ropa, boutiques multimarca, zapaterías, joyerías, marcas propias, mayoristas, novias y fiesta, deportivo, consignación y segunda mano.
Cubre en un solo sistema: ${MODULOS.slice(0, 40).map(m => m.nombre).join(', ')}.
Su diferencia es que todo vive junto —piso de venta, tienda en línea, inventario por talla y color, compras, clientes— así que los datos no están partidos entre herramientas.
NO es para: restaurantes, farmacias, ferreterías, servicios profesionales ni manufactura pesada.`;

const ESQUEMA = {
  type: 'object',
  properties: {
    evaluaciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          relevancia_sacs: { type: 'number' },
          potencial_conversion: { type: 'number' },
          potencial_herramienta: { type: 'number' },
          potencial_contenido: { type: 'number' },
          potencial_red: { type: 'number' },
          valor_dato: { type: 'number' },
          potencial_distribucion_ia: { type: 'number' },
          dificultad: { type: 'number' },
          descubrimiento_tipo: { type: 'string', enum: ['marketing', 'producto', 'integracion', 'dato', 'red', 'marketplace', 'api', 'skill'] },
          tipo_demanda: { type: 'string', enum: ['mercado', 'cliente_actual', 'en_proceso'] },
          por_que: { type: 'string' },
        },
        required: ['i', 'relevancia_sacs', 'potencial_conversion', 'potencial_contenido', 'tipo_demanda', 'por_que'],
        additionalProperties: false,
      },
    },
  },
  required: ['evaluaciones'],
  additionalProperties: false,
};

const SISTEMA = `${QUE_ES_SACS}

Te doy problemas reales que expresaron negocios de moda. Califica cada uno de 0 a 100 en:

- relevancia_sacs: qué tanto es de lo nuestro. 100 = Sacs lo resuelve hoy y es su terreno. 0 = no tiene nada que ver con moda ni con retail.
- potencial_conversion: si alguien con este problema nos encuentra, qué tan probable es que termine siendo cliente de pago.
- potencial_herramienta: qué tan bien se resolvería con una herramienta GRATIS y útil por sí sola (calculadora, auditor, generador).
- potencial_contenido: qué tanto se responde bien con una página que enseñe a resolverlo.
- potencial_red: si resolverlo nos acerca a conectar retailers con mayoristas, fabricantes o marcas.
- valor_dato: si al resolverlo generamos un dato agregado del ramo que nadie más tiene.
- potencial_distribucion_ia: qué tan bien funcionaría como algo que una IA pueda ejecutar por el usuario (API, MCP, skill).
- dificultad: qué tan difícil es ganar esa demanda contra quien hoy la responde. 100 = dificilísimo.
- descubrimiento_tipo: qué clase de oportunidad es sobre todo.
- tipo_demanda: la distinción MÁS importante de todas.
    · "mercado": alguien con este problema lo buscaría en Google o se lo preguntaría a una IA ANTES de conocernos. Es demanda que se puede capturar. Ej: «cómo saber qué tallas recomprar», «software para zapatería», «cómo controlar inventario por talla y color».
    · "cliente_actual": solo tiene sentido si ya usas Sacs. Es del PRODUCTO o del soporte, no del mercado. Ej: «no imprime el ticket», «no aparece el rol de administrador», «cómo conectarme a soporte».
    · "en_proceso": lo dice alguien que YA está hablando con nosotros. Es de ventas, no de demanda. Ej: «agendar una llamada», «cuándo es la capacitación», «me mandas la cotización».
  Esta etiqueta decide si el problema genera trabajo de marketing o de producto. Equivocarla manda a escribir una página sobre un error del sistema.

- por_que: UNA frase de MÁXIMO 20 PALABRAS que justifique la calificación más alta. Sin adjetivos vacíos, sin repetir el problema.

Sé severo con relevancia_sacs: un problema de soporte de un cliente actual puede ser muy relevante para el PRODUCTO pero tener poca demanda de búsqueda. Calificas el problema, no las ganas.`;

export type Evaluadas = { evaluados: number; costo_usd: number };

export async function evaluarClusters(limite = 20): Promise<Evaluadas> {
  const { data: clusters } = await supabase
    .from('de_clusters')
    .select('id, problema_canonico, categoria, icp, senales_n, queries_n, fuentes')
    .is('relevancia_sacs', null)
    .neq('estado', 'descartado')
    .order('senales_n', { ascending: false })
    .limit(limite);
  if (!clusters?.length) return { evaluados: 0, costo_usd: 0 };

  /* El ORIGEN va en el prompt porque cambia el significado: el mismo texto
     dicho por un cliente en soporte y por un desconocido en WhatsApp son dos
     problemas distintos, y el modelo no puede saberlo del texto solo. */
  const entrada = clusters.map((c, i) => {
    const f = Object.entries((c as any).fuentes || {}).map(([k, v]) => `${k} ${v}`).join(', ');
    return `[${i}] ${c.problema_canonico}${c.categoria ? ` (área: ${c.categoria})` : ''} — visto ${c.senales_n} ${c.senales_n === 1 ? 'vez' : 'veces'}${f ? ` [origen: ${f}]` : ''}`;
  }).join('\n');

  const r = await preguntar<{ evaluaciones: any[] }>({
    agente: 'demanda_evaluador',
    // Juzgar el valor de negocio pide más criterio que clasificar un texto:
    // aquí sí vale el modelo bueno, y son 40 problemas por llamada.
    modelo: PARA.trabajo,
    sistema: SISTEMA, usuario: entrada, esquema: ESQUEMA, max_tokens: 16000,
    contexto: { clusters: clusters.length },
  });
  if (!r.ok || !r.datos?.evaluaciones) {
    const e: any = new Error(r.error || 'el evaluador no devolvió nada');
    e.definitivo = r.definitivo;   // sin saldo o sin llave: no se reintenta
    throw e;
  }

  const n01 = (x: any) => (Number.isFinite(x) ? Math.max(0, Math.min(100, Number(x))) : null);
  let evaluados = 0;
  for (const e of r.datos.evaluaciones) {
    const c = clusters[Number(e.i)];
    if (!c) continue;
    await supabase.from('de_clusters').update({
      relevancia_sacs: n01(e.relevancia_sacs),
      potencial_conversion: n01(e.potencial_conversion),
      potencial_herramienta: n01(e.potencial_herramienta),
      potencial_contenido: n01(e.potencial_contenido),
      potencial_red: n01(e.potencial_red),
      valor_dato: n01(e.valor_dato),
      potencial_distribucion_ia: n01(e.potencial_distribucion_ia),
      dificultad: n01(e.dificultad),
      capturado_por: {
        por_que: String(e.por_que || '').slice(0, 400),
        descubrimiento_tipo: e.descubrimiento_tipo || null,
        tipo_demanda: e.tipo_demanda || 'mercado',
      },
      estado: 'activo',
      updated_at: new Date().toISOString(),
    }).eq('id', c.id);
    evaluados++;
  }
  return { evaluados, costo_usd: r.costo_usd };
}

registrar('clasificar', async (a, ctx): Promise<ResultadoHandler> => {
  let evaluados = 0, costo = 0;
  while (Date.now() < ctx.limite - 25_000) {
    try {
      const r = await evaluarClusters(20);
      evaluados += r.evaluados; costo += r.costo_usd;
      if (!r.evaluados) break;
    } catch (e: any) {
      // Si es un problema de saldo o de llave, se dice y se para: insistir solo
      // llena la bitácora de errores idénticos.
      if (e?.definitivo) return { ok: false, resumen: e.message, definitivo: true, datos: { evaluados }, costo_usd: costo };
      throw e;
    }
  }
  return {
    ok: true,
    resumen: evaluados ? `${evaluados} problemas evaluados` : 'no había problemas sin evaluar',
    datos: { evaluados }, costo_usd: costo,
  };
});
