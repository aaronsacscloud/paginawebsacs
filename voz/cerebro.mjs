// EL CEREBRO · Claude en streaming, con herramientas y caché de prompt.
//
// Devuelve los tokens de texto conforme salen (para que la boca empiece a
// hablar) y al final los bloques completos (texto + tool_use) con el uso.
// No sabe nada del CRM ni de Twilio: recibe system + herramientas + historial.
import Anthropic from '@anthropic-ai/sdk';

const MODELO = process.env.MODELO_VOZ || 'claude-haiku-4-5';
let cliente = null;
const anthropic = () => (cliente ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20000 }));

export const hayCerebro = () => !!process.env.ANTHROPIC_API_KEY;

/** Precio por millón de tokens (USD) para reportar el costo de cada llamada. */
const PRECIOS = {
  'claude-haiku-4-5': { in: 1, out: 5, cacheW: 1.25, cacheR: 0.1 },
  'claude-sonnet-4-5': { in: 3, out: 15, cacheW: 3.75, cacheR: 0.3 },
};
export function costoUsd(uso, modelo = MODELO) {
  const p = PRECIOS[modelo] || PRECIOS['claude-haiku-4-5'];
  return ((uso.input || 0) * p.in + (uso.output || 0) * p.out + (uso.cacheW || 0) * p.cacheW + (uso.cacheR || 0) * p.cacheR) / 1e6;
}

/**
 * Un turno de pensamiento. `alToken(texto)` se llama con cada pedazo de texto.
 * Resuelve con { contenido: bloques del asistente, stop, uso, texto }.
 * Si `signal` se aborta (interrupción), resuelve con lo que alcanzó a decir.
 */
export async function pensar({ system, herramientas, mensajes, alToken, signal, maxTokens = 400 }) {
  const t0 = Date.now();
  const cuerpo = {
    model: MODELO,
    max_tokens: maxTokens,
    system,
    messages: mensajes,
    temperature: 0.4,
  };
  if (herramientas?.length) {
    // La última herramienta lleva cache_control: se cachea todo lo anterior (tools + system).
    cuerpo.tools = herramientas.map((h, i) => (i === herramientas.length - 1 ? { ...h, cache_control: { type: 'ephemeral' } } : h));
  }
  const stream = anthropic().messages.stream(cuerpo, { signal });
  let texto = '';
  let tPrimero = 0;
  try {
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
        if (!tPrimero) tPrimero = Date.now();
        texto += ev.delta.text;
        alToken?.(ev.delta.text);
      }
    }
  } catch (e) {
    if (signal?.aborted) return { contenido: texto ? [{ type: 'text', text: texto }] : [], stop: 'interrumpido', uso: {}, texto, ms: { primero: tPrimero ? tPrimero - t0 : 0, total: Date.now() - t0 } };
    throw e;
  }
  const final = await stream.finalMessage();
  const u = final.usage || {};
  const uso = { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheW: u.cache_creation_input_tokens || 0, cacheR: u.cache_read_input_tokens || 0 };
  return {
    contenido: final.content,
    stop: final.stop_reason,
    uso,
    texto,
    ms: { primero: tPrimero ? tPrimero - t0 : 0, total: Date.now() - t0 },
  };
}

export const MODELO_VOZ = MODELO;
