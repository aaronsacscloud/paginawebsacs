// SOPORTE · Sacar del chat de Intercom lo que vale dinero.
//
// Un HALLAZGO es una propuesta leída de una conversación, no un hecho: "este
// cliente pidió X", con la frase textual que lo respalda. Se guarda pendiente y
// una persona lo acepta o lo descarta; al aceptarlo se materializa en el motor
// que ya existe (Bandeja de Oportunidades o Consultoría).
//
// POR QUÉ CON UN MODELO Y NO CON REGLAS: medido contra los 161 tickets de
// producción, un juego de expresiones regulares con las frases obvias ("sería
// posible", "cuánto cuesta", "quiero contratar") atrapó UNA — y era un falso
// positivo. Leyendo los mismos textos hay once señales reales. Nadie escribe
// "quiero contratar"; escriben "¿me podrían apoyar activando la gestión de
// lotes?". Por eso tampoco hay cribado previo por reglas: tiraría justo las
// buenas.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { supabase } from '../supabase';
import { anthropic, MODELS, hasApiKey } from '../ai/client';
import { MODULOS_PLANOS } from '../crm/modulos-sacs';
import { citaVerificada, huellaDe } from './citas';

export { normaliza, citaVerificada, huellaDe } from './citas';

const API = 'https://api.intercom.io';
const TOKEN = (import.meta.env.INTERCOM_ACCESS_TOKEN || process.env.INTERCOM_ACCESS_TOKEN || '').trim();
const IV = { Authorization: 'Bearer ' + TOKEN, 'Intercom-Version': '2.11', 'Content-Type': 'application/json' };

/** Tope de texto que se le manda al modelo por conversación. Un hilo de soporte
 *  larguísimo suele ser el mismo problema repetido; los primeros 12 mil
 *  caracteres del cliente traen la petición completa en todos los casos reales
 *  que revisé. */
const TOPE_TEXTO = 12000;

export const TIPOS = ['oportunidad', 'mejora', 'riesgo', 'testimonio'] as const;
export type TipoHallazgo = typeof TIPOS[number];

// ── Esquema de salida ──────────────────────────────────────────────────────
// Cerrado a propósito: el modelo no puede devolver un campo que no esté aquí, y
// si falta uno obligatorio el hallazgo no existe.
const Hallazgo = z.object({
  tipo: z.enum(TIPOS).describe('oportunidad = quiere algo que se vende o se activa; mejora = el producto no hace algo que necesita; riesgo = molesto, reincidente o amenaza con irse; testimonio = elogio explícito en primera persona'),
  cita: z.string().describe('Frase TEXTUAL del cliente, copiada tal cual del hilo, sin corregir ortografía ni acentos. Entre 15 y 300 caracteres.'),
  titulo: z.string().describe('Qué pide, en una línea de máximo 80 caracteres. En español.'),
  modulo: z.string().nullable().describe('Módulo de SACS al que se refiere, EXACTO de la lista dada, o null.'),
  producto: z.string().nullable().describe('Solo si el cliente nombra algo que ya se vende; si no, null. Nunca inventes un producto.'),
  accion: z.string().describe('Qué haría una persona mañana con esto. Imperativo, concreto, una frase.'),
  confianza: z.enum(['alta', 'media', 'baja']).describe('alta = lo pide sin ambigüedad; media = se deduce; baja = corazonada'),
});
const Salida = z.object({
  hallazgos: z.array(Hallazgo).describe('Vacío si la conversación es puro soporte operativo. Lo normal es que esté vacío.'),
});
export type HallazgoLeido = z.infer<typeof Hallazgo>;

// ── Hilo de Intercom, solo lo que dijo el cliente ──────────────────────────
const sinHtml = (s: string) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const ES_CLIENTE = new Set(['user', 'lead', 'contact']);
const MENSAJE = new Set(['comment', 'note', 'message']);

/**
 * Trae el hilo completo y devuelve SOLO los mensajes del cliente.
 *
 * Lo que contestó soporte se descarta antes de leer: si no, el modelo "detecta"
 * como intención de compra justo lo que nosotros le ofrecimos, y la bandeja se
 * llena de ecos de nuestro propio discurso comercial.
 */
export async function hiloDelCliente(conversationId: string): Promise<string | null> {
  if (!TOKEN) return null;
  try {
    const r = await fetch(`${API}/conversations/${conversationId}`, { headers: IV });
    if (!r.ok) return null;
    const c: any = await r.json();
    const partes: string[] = [];
    if (ES_CLIENTE.has(c.source?.author?.type) && c.source?.body) partes.push(sinHtml(c.source.body));
    for (const p of (c.conversation_parts?.conversation_parts || [])) {
      if (!MENSAJE.has(p.part_type) || !p.body) continue;
      if (p.part_type === 'note') continue;                 // nota interna: la escribimos nosotros
      if (!ES_CLIENTE.has(p.author?.type)) continue;
      partes.push(sinHtml(p.body));
    }
    const texto = partes.filter(Boolean).join('\n\n').trim();
    return texto.length >= 25 ? texto.slice(0, TOPE_TEXTO) : null;
  } catch { return null; }
}

// ── Lectura ────────────────────────────────────────────────────────────────
const SISTEMA = [
  'Eres analista comercial de SACS, un software de punto de venta y administración para comercios en México.',
  'Lees UNA conversación de soporte —solo los mensajes del CLIENTE— y sacas lo que le sirve al equipo comercial o de producto.',
  '',
  'LO NORMAL ES NO ENCONTRAR NADA. La enorme mayoría de los tickets son operación pura: impresoras',
  'desconfiguradas, permisos, cortes que no cuadran, "no me deja facturar". Eso NO es un hallazgo.',
  'Devolver una lista vacía es la respuesta correcta y esperada. Marcar operación como oportunidad',
  'convierte la bandeja en ruido y deja de leerse.',
  '',
  'Marca un hallazgo SOLO cuando el cliente:',
  '- oportunidad: pregunta precios o cómo pagar, pide activar/contratar algo, quiere abrir sucursal,',
  '  agregar usuarios, migrar de otra plataforma, o pide algo que su plan no cubre.',
  '- mejora: describe un límite del producto que funciona COMO ESTÁ DISEÑADO pero no le alcanza',
  '  ("el sistema solo te permite seleccionar un tipo de tarjeta"), o pide una función que no existe.',
  '- riesgo: habla de CANCELAR o darse de baja, o expresa enojo explícito ("es inaceptable",',
  '  "llevo tres semanas con esto", "pésimo servicio").',
  '- testimonio: elogia el producto en primera persona, de forma citable.',
  '',
  'LO QUE NO ES UN HALLAZGO, aunque lo parezca:',
  '- UN BUG NO ES UNA MEJORA. "La factura la hizo mal el sistema", "no me deja facturar",',
  '  "me duplica las ventas", "no aparece el tipo de cambio": son fallas de algo que debería',
  '  funcionar. Eso lo arregla soporte, no ventas ni producto. No lo reportes.',
  '- Insistir NO ES RIESGO. "Sigue sin aparecer", "les escribí ayer", "de nuevo me pasa" es un',
  '  cliente dando seguimiento, no uno a punto de irse. Sin enojo explícito o mención de',
  '  cancelar, no hay riesgo.',
  '- Explicar el problema NO ES pedir una función. Que describa lo que le pasa es la materia',
  '  prima de cualquier ticket.',
  '',
  'Reglas duras:',
  '- MÁXIMO UN hallazgo de cada tipo por conversación. Si el cliente describe tres facetas del',
  '  mismo asunto, es UN hallazgo: elige la frase que mejor lo sostiene.',
  '- La CITA se copia TEXTUAL del hilo, sin corregir ortografía, acentos ni mayúsculas. Si no puedes',
  '  copiar una frase literal que sostenga el hallazgo, no lo reportes.',
  '- Nunca inventes precios, montos ni nombres de productos que no aparezcan en el catálogo dado.',
  '- Un mismo mensaje puede dar más de un hallazgo (por ejemplo un elogio y una petición).',
  '- Escribe en español, en el tono de quien va a llamar al cliente mañana.',
].join('\n');

export type ContextoCuenta = {
  cuenta?: string | null;
  empresa?: string | null;
  plan?: string | null;
  fueraDePlan?: string[];   // módulos que el cliente usa/pide y su plan no cubre
};

/** Lee una conversación. Devuelve solo hallazgos con cita verificada. */
export async function leerConversacion(hilo: string, ctx: ContextoCuenta = {}): Promise<{ hallazgos: HallazgoLeido[]; descartados: number; error?: string }> {
  if (!hasApiKey()) return { hallazgos: [], descartados: 0, error: 'sin ANTHROPIC_API_KEY' };
  const catalogo = [
    `Módulos de SACS (usa EXACTAMENTE estos nombres en el campo modulo): ${MODULOS_PLANOS.join(' · ')}`,
    'Planes que se venden, de menor a mayor: vende, controla, fideliza, automatiza.',
    ctx.plan ? `Plan actual de este cliente: ${ctx.plan}.` : 'No sabemos qué plan tiene este cliente.',
    ctx.fueraDePlan?.length ? `Módulos que su plan NO cubre (si pide uno de estos, es oportunidad): ${ctx.fueraDePlan.join(' · ')}.` : '',
  ].filter(Boolean).join('\n');

  try {
    const r = await anthropic.messages.parse({
      model: MODELS.opus,
      max_tokens: 4000,
      system: SISTEMA,
      output_config: { format: zodOutputFormat(Salida) },
      messages: [{
        role: 'user',
        content: [
          catalogo,
          '',
          `Cliente: ${ctx.empresa || ctx.cuenta || 'sin identificar'}`,
          '',
          'Mensajes del cliente en esta conversación:',
          '"""',
          hilo,
          '"""',
        ].join('\n'),
      }],
    });
    const crudos = r.parsed_output?.hallazgos || [];
    // Dos filtros: la confianza baja no se encola (es una corazonada, y una
    // corazonada en la bandeja cuesta el tiempo de quien la lee), y la cita
    // tiene que existir de verdad en el hilo.
    const buenos = crudos.filter(h => h.confianza !== 'baja' && citaVerificada(h.cita, hilo));
    return { hallazgos: buenos, descartados: crudos.length - buenos.length };
  } catch (e: any) {
    return { hallazgos: [], descartados: 0, error: e?.message || 'error al leer' };
  }
}

// ── Guardado ───────────────────────────────────────────────────────────────
export type TicketMin = { conversation_id: string; company_id?: string | null; cuenta?: string | null; tema?: string | null };

/** Inserta los hallazgos de una conversación. El índice único parcial sobre la
 *  huella hace el deduplicado en la base, no en memoria: dos corridas en
 *  paralelo no pueden crear la misma fila dos veces. */
export async function guardarHallazgos(t: TicketMin, hallazgos: HallazgoLeido[]): Promise<{ creados: number; duplicados: number; colapsados: number }> {
  let creados = 0, duplicados = 0;
  // UNO por tipo y conversación. Medido en producción, el modelo partía un mismo
  // reclamo en tres tarjetas ("no aparece el tipo de cambio", "aparece el pago
  // en dólares y no el total", "hice el corte y sigue igual") y quien revisa
  // tiene que descartar dos para llegar a la buena. El prompt ya lo pide, pero
  // pedirlo no es garantizarlo. Gana la de más confianza, y a igualdad la que
  // trae la cita más larga: sostiene mejor el caso.
  const orden = { alta: 2, media: 1, baja: 0 } as Record<string, number>;
  const mejorPorTipo = new Map<string, HallazgoLeido>();
  for (const h of hallazgos) {
    const previo = mejorPorTipo.get(h.tipo);
    const gana = !previo
      || (orden[h.confianza] ?? 0) > (orden[previo.confianza] ?? 0)
      || ((orden[h.confianza] ?? 0) === (orden[previo.confianza] ?? 0) && h.cita.length > previo.cita.length);
    if (gana) mejorPorTipo.set(h.tipo, h);
  }
  const colapsados = hallazgos.length - mejorPorTipo.size;
  for (const h of mejorPorTipo.values()) {
    const fila = {
      conversation_id: t.conversation_id,
      company_id: t.company_id || null,
      cuenta: t.cuenta || null,
      tipo: h.tipo,
      titulo: h.titulo.slice(0, 200),
      cita: h.cita.slice(0, 1000),
      modulo: MODULOS_PLANOS.includes(h.modulo as string) ? h.modulo : null,
      producto: h.producto || null,
      accion: h.accion?.slice(0, 500) || null,
      confianza: h.confianza,
      huella: huellaDe(t.company_id || null, t.cuenta || null, h.tipo, h.cita),
      metadata: { origen: 'soporte_ia', tema: t.tema || null },
    };
    const { error } = await supabase.from('crm_soporte_hallazgos').insert(fila);
    if (!error) { creados++; continue; }
    // 23505 = ya hay uno pendiente con la misma huella. No es un fallo.
    if ((error as any).code === '23505') { duplicados++; continue; }
    console.error('[hallazgos] no se pudo guardar', h.titulo, '→', error.message);
  }
  return { creados, duplicados, colapsados };
}
