// Thin wrapper over Anthropic SDK + Vercel AI SDK.
// Centralizes: model selection, prompt caching, cost tracking, retry.

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_KEY = (import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim();

const anthropicRaw = new Anthropic({
  apiKey: ANTHROPIC_KEY,
});

/* ── CADA LLAMADA QUEDA REGISTRADA (4-sep-2026) ──
   Antes cada módulo calculaba su costo por su cuenta (y algunos con precios viejos: 15/75 en vez de 5/25) y
   muchos ni lo guardaban. Cuando se acabó el crédito no se pudo decir en qué se fue. Ahora `messages.create`
   pasa por aquí: se mide, se cobra con la tabla PRICING —una sola fuente— y se escribe en ia_uso, incluidas
   las búsquedas web (que se cobran aparte, ~$0.01 cada una). Si el registro falla, la llamada NO se cae. */
const proposito = () => {
  const linea = (new Error().stack || '').split('\n').find(l => /\/src\/(lib|pages)\//.test(l) && !/ai\/client/.test(l)) || '';
  const m = linea.match(/\/src\/(.+?):(\d+):/);
  return m ? `${m[1]}:${m[2]}` : 'desconocido';
};
async function registrarUso(o: { modelo: string; usage?: any; ok: boolean; error?: string; ms: number; desde: string }) {
  try {
    const { supabase } = await import('../supabase');
    const u = o.usage || {};
    const busquedas = Number(u?.server_tool_use?.web_search_requests) || 0;
    const c = o.ok ? calculateCost(o.modelo, u) : null;
    await supabase.from('ia_uso').insert({
      modelo: o.modelo, proposito: o.desde,
      input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0,
      cache_read: u.cache_read_input_tokens || 0, cache_write: u.cache_creation_input_tokens || 0,
      busquedas_web: busquedas,
      costo_usd: (c?.cost_usd || 0) + busquedas * 0.01,
      ok: o.ok, error: o.error ? String(o.error).slice(0, 300) : null, ms: o.ms,
    });
  } catch { /* medir no puede romper lo que mide */ }
}

/* ══ FUSIBLE DE SALDO (16-sep-2026) ═══════════════════════════════════════
   Medido: del 3 al 16 de septiembre la API respondió 400 «credit balance is
   too low» **20,223 veces** sobre 82 contactos, y NADIE se enteró en 13 días.
   El agente reintentaba cada 2 minutos contra un error que jamás se iba a
   arreglar solo.

   Un error de cobro no es un error transitorio: reintentar no lo resuelve,
   solo gasta invocaciones y llena la bitácora de ruido que tapa los errores
   de verdad. Así que a la primera:
     1. se avisa por la campana del CRM, en `urgente` y una sola vez al día;
     2. se ABRE el fusible y las llamadas siguientes fallan al instante, sin
        salir a la red.

   El fusible se cierra solo a los 15 minutos: cuando alguien recargue, el
   sistema revive sin que nadie tenga que redesplegar. Vive en memoria del
   proceso a propósito —una lectura a la base por llamada costaría más que el
   problema—; en Vercel cada instancia abre el suyo, así que el peor caso pasa
   de 30 intentos por hora a 4. */
const SIN_SALDO_MS = 15 * 60 * 1000;
let sinSaldoHasta = 0;
export const ERROR_SIN_SALDO = 'IA sin saldo: la cuenta de Anthropic no tiene crédito. Se pausaron las llamadas 15 minutos.';
const esFaltaDeSaldo = (e: any) => /credit balance is too low|billing|payment required|402/i.test(String(e?.message || e || ''));

async function avisarSinSaldo(desde: string, modelo: string) {
  try {
    const { notificar } = await import('../crm/notificaciones');
    await notificar({
      // Una por día: el objetivo es que se vea, no que sepulte la campana.
      clave: `ia_sin_saldo:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'ia_sin_saldo', nivel: 'urgente',
      titulo: 'La IA se quedó sin saldo — todo lo automático está detenido',
      detalle: `La API de Anthropic responde «credit balance is too low». Mientras no se recargue: el agente no contesta, no se resumen conversaciones y no se generan notas de contexto. Primera falla vista en ${modelo} desde ${desde}.`,
      destino: 'trabajo',
    });
  } catch { /* avisar no puede tumbar la llamada que falló */ }
}

export const anthropic = new Proxy(anthropicRaw, {
  get(target, prop, receiver) {
    if (prop !== 'messages') return Reflect.get(target, prop, receiver);
    const messages = Reflect.get(target, prop, receiver);
    return new Proxy(messages, {
      get(mTarget, mProp, mReceiver) {
        const fn = Reflect.get(mTarget, mProp, mReceiver);
        if (mProp !== 'create' || typeof fn !== 'function') return fn;
        return async (...args: any[]) => {
          const t0 = Date.now(); const desde = (globalThis as any).__ia_proposito || proposito(); const modelo = String(args?.[0]?.model || 'desconocido');
          // Fusible abierto: se falla aquí, sin gastar la llamada ni la espera.
          if (Date.now() < sinSaldoHasta) throw new Error(ERROR_SIN_SALDO);
          try {
            const r: any = await (fn as any).apply(mTarget, args);
            registrarUso({ modelo, usage: r?.usage, ok: true, ms: Date.now() - t0, desde });
            return r;
          } catch (e: any) {
            registrarUso({ modelo, ok: false, error: e?.message || String(e), ms: Date.now() - t0, desde });
            if (esFaltaDeSaldo(e)) {
              const yaAbierto = Date.now() < sinSaldoHasta;
              sinSaldoHasta = Date.now() + SIN_SALDO_MS;
              if (!yaAbierto) await avisarSinSaldo(desde, modelo);   // avisa al ABRIR, no en cada intento
            }
            throw e;
          }
        };
      },
    });
  },
});

// Model constants (centralized for easy version bump via canary)
export const MODELS = {
  // Lectura de conversaciones de soporte: el trabajo es de juicio (distinguir
  // "pide algo que vendemos" de "se le desconfiguró la impresora") sobre un
  // volumen chico —unas ocho conversaciones al día—, así que el modelo bueno
  // cuesta centavos y equivocarse cuesta la confianza en la bandeja entera.
  opus: 'claude-opus-5' as const,
  sonnet: 'claude-sonnet-4-5' as const,
  haiku: 'claude-haiku-4-5' as const,
  sonnet_fallback: 'claude-sonnet-4-5' as const,
  /* Sonnet 5 entra como llave APARTE y no reemplazando a `sonnet`: el agente
     de Trabajo Inteligente lleva meses calibrado contra 4.5 —con sus ejemplos
     aprobados y sus correcciones—, y cambiarle el modelo por debajo sería
     mover el piso de algo que ya funciona. Lo nuevo (motor de demanda) nace
     en 5; lo viejo migra el día que alguien lo mida. */
  sonnet5: 'claude-sonnet-5' as const,
} as const;

// Pricing per 1M tokens (input/output) in USD — for cost tracking
export const PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  'claude-opus-5': { input: 5.00, output: 25.00, cache_read: 0.50, cache_write: 6.25 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
  'claude-haiku-4-5': { input: 1.00, output: 5.00, cache_read: 0.10, cache_write: 1.25 },
  'claude-sonnet-5': { input: 2.00, output: 10.00, cache_read: 0.20, cache_write: 2.50 },
};

export interface AgentRunUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  model: string;
}

export function calculateCost(model: string, usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}): AgentRunUsage {
  // OJO: el respaldo apuntaba a 'claude-sonnet-4-7', que NO está en PRICING.
  // Un modelo desconocido daba `undefined` y el costo salía NaN — y ese NaN se
  // escribe en ia_uso, así que el gasto del mes quedaba inservible.
  const p = PRICING[model] || PRICING['claude-sonnet-4-5'];
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cw = usage.cache_creation_input_tokens || 0;
  const cr = usage.cache_read_input_tokens || 0;

  // Standard pricing per 1M tokens
  const cost = (input * p.input + output * p.output + cr * p.cache_read + cw * p.cache_write) / 1_000_000;

  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cr,
    cache_write_tokens: cw,
    cost_usd: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimals
    model,
  };
}

export function hasApiKey(): boolean {
  return ANTHROPIC_KEY.length > 0;
}
