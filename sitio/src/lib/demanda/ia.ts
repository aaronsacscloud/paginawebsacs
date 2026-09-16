// DEMAND ENGINE · las llamadas al modelo, sin casarse con un proveedor.
//
// Todo lo que el motor le pregunta a un modelo pasa por aquí, y aquí se decide
// CUÁL modelo. Que sea intercambiable no es elegancia: el 16-sep-2026 la cuenta
// de Anthropic se quedó sin saldo y el motor entero se detuvo. Un sistema que se
// para porque falla la facturación de un tercero no es autónomo.
//
// ⚠️ OJO CON UNA DISTINCIÓN QUE SÍ IMPORTA: aquí se puede cambiar de proveedor
// entre llamadas sin consecuencias, porque cada respuesta es independiente. Con
// los EMBEDDINGS es al revés y está prohibido (ver embeddings.ts): vectores de
// dos modelos distintos no viven en el mismo espacio y compararlos da números
// que parecen similitudes y no significan nada.
import { anthropic, calculateCost } from '../ai/client';
import { createAgentRun, finishAgentRun } from '../ai/audit';
import { redactPII } from '../ai/redact';
import { supabase } from '../supabase';

const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

export type Proveedor = 'anthropic' | 'gemini' | 'openai' | 'groq';

/** El trabajo decide el modelo, no al revés. */
export type Trabajo = 'volumen' | 'trabajo' | 'estrategia';

const LLAVE: Record<Proveedor, string> = {
  anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY', groq: 'GROQ_API_KEY',
};

/**
 * volumen    → clasificar, normalizar, extraer. Miles de llamadas, juicio bajo.
 * trabajo    → redactar, auditar, analizar una SERP. Decenas, juicio medio.
 * estrategia → prioridades de la semana, decisiones de producto. Pocas, juicio alto.
 */
const MODELOS: Record<Proveedor, Record<Trabajo, string>> = {
  anthropic: { volumen: 'claude-haiku-4-5', trabajo: 'claude-sonnet-5', estrategia: 'claude-opus-5' },
  gemini:    { volumen: 'gemini-2.5-flash', trabajo: 'gemini-2.5-flash', estrategia: 'gemini-2.5-pro' },
  openai:    { volumen: 'gpt-5', trabajo: 'gpt-5', estrategia: 'gpt-5-pro' },
  groq:      { volumen: 'openai/gpt-oss-120b', trabajo: 'openai/gpt-oss-120b', estrategia: 'openai/gpt-oss-120b' },
};

/** Dólares por millón de tokens. ⚠️ Los precios de cada proveedor cambian; si
 *  un modelo no está aquí se registra el gasto como cero, que es mentira barata
 *  pero visible —el conteo de tokens sí queda—. Revisar al cambiar de modelo. */
const PRECIOS: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-opus-5': { in: 5, out: 25 },
  'gemini-2.5-flash': { in: 0.30, out: 2.50 },
  'gemini-2.5-pro': { in: 1.25, out: 10 },
  'gemini-flash-lite-latest': { in: 0.10, out: 0.40 },
  'gpt-5': { in: 1.25, out: 10 },
  'gpt-5-pro': { in: 15, out: 120 },
  'openai/gpt-oss-120b': { in: 0.15, out: 0.75 },
};

const costoDe = (modelo: string, ent: number, sal: number) => {
  const p = PRECIOS[modelo];
  return p ? (ent * p.in + sal * p.out) / 1_000_000 : 0;
};

export const disponibles = (): Proveedor[] =>
  (Object.keys(LLAVE) as Proveedor[]).filter(p => env(LLAVE[p]).length > 0);

/**
 * El orden de intento DEPENDE DEL TRABAJO, y eso vale dinero y calidad.
 *
 * No es una preferencia: está medido en este proyecto. Para clasificar —«¿esto
 * es demanda, sí o no?»— Gemini Flash hace el mismo trabajo 3 veces más barato,
 * y son miles de llamadas. Para JUZGAR el valor de una oportunidad se comportó
 * peor: calificaba «distribución por IA» alto para casi todo (33 de 80 por
 * encima de 75) y el backlog se llenó de propuestas que no tenían sentido. Ahí
 * son decenas de llamadas y el criterio importa más que el centavo.
 *
 * Poner un solo proveedor para todo obliga a elegir entre pagar de más en lo
 * masivo o decidir peor en lo importante. Esto evita esa disyuntiva.
 */
const PREFERENCIA: Record<Trabajo, Proveedor[]> = {
  volumen:    ['gemini', 'groq', 'anthropic', 'openai'],
  trabajo:    ['anthropic', 'gemini', 'openai', 'groq'],
  estrategia: ['anthropic', 'openai', 'gemini', 'groq'],
};

export async function ordenDeProveedores(trabajo: Trabajo = 'volumen'): Promise<Proveedor[]> {
  const hay = disponibles();
  const { data } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
  const u = data?.umbrales || {};
  // Se puede forzar por trabajo (`ia_proveedor_volumen`) o en general
  // (`ia_proveedor`); lo específico manda sobre lo general.
  const forzado = (u[`ia_proveedor_${trabajo}`] || u.ia_proveedor) as Proveedor | undefined;
  const orden = [forzado, ...PREFERENCIA[trabajo]].filter((p): p is Proveedor => !!p && hay.includes(p));
  return [...new Set(orden)];
}

export type Peticion = {
  agente: string;
  trabajo?: Trabajo;
  sistema: string;
  usuario: string;
  /** Esquema de la respuesta. Sin él no hay contrato y hay que adivinar. */
  esquema?: Record<string, any>;
  max_tokens?: number;
  /** Texto de terceros o de clientes: se anonimiza ANTES de salir del servidor. */
  anonimizar?: boolean;
  contexto?: Record<string, any>;
  /** Fuerza un proveedor concreto (para comparar calidad entre ellos). */
  proveedor?: Proveedor;
};

export type Respuesta<T = any> = {
  ok: boolean; datos: T | null; texto: string; costo_usd: number;
  run_id: string | null; error?: string; definitivo?: boolean;
  proveedor?: Proveedor; modelo?: string;
};

/* Fallos que NO se arreglan insistiendo — pero SÍ cambiando de proveedor. Es la
   diferencia entre «reintenta en cinco minutos» y «prueba con otro». */
const SIN_REMEDIO = /credit balance|insufficient|billing|quota|invalid.?api.?key|authentication|permission|not have access|exceeded/i;

/** Gemini no acepta el vocabulario completo de JSON Schema. */
function esquemaGemini(e: any): any {
  if (Array.isArray(e)) return e.map(esquemaGemini);
  if (!e || typeof e !== 'object') return e;
  const out: any = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    out[k] = esquemaGemini(v);
  }
  return out;
}

type Cruda = { texto: string; ent: number; sal: number; stop?: string };

const trabajoDe = (p: Peticion): Trabajo => p.trabajo || 'volumen';

async function pedirA(prov: Proveedor, modelo: string, p: Peticion, usuario: string): Promise<Cruda> {
  const max = p.max_tokens || 4000;

  if (prov === 'anthropic') {
    const cuerpo: any = { model: modelo, max_tokens: max, system: p.sistema, messages: [{ role: 'user', content: usuario }] };
    if (p.esquema) cuerpo.output_config = { format: { type: 'json_schema', schema: p.esquema } };
    const r: any = await anthropic.messages.create(cuerpo);
    return {
      texto: (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''),
      ent: r.usage?.input_tokens || 0, sal: r.usage?.output_tokens || 0, stop: r.stop_reason,
    };
  }

  if (prov === 'gemini') {
    const cuerpo: any = {
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: [{ text: usuario }] }],
      generationConfig: { maxOutputTokens: max, temperature: 0 },
    };
    /* Gemini 2.5 «piensa» antes de responder y esos tokens salen del MISMO
       presupuesto de salida. Para clasificar —«¿esto es demanda, sí o no?»— el
       razonamiento no aporta nada y sí se come la respuesta: la primera corrida
       se cortó a media lista de sesenta elementos. Se apaga en el trabajo de
       volumen y se deja encendido donde sí hay que razonar. */
    if (trabajoDe(p) === 'volumen') cuerpo.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    if (p.esquema) {
      cuerpo.generationConfig.responseMimeType = 'application/json';
      cuerpo.generationConfig.responseSchema = esquemaGemini(p.esquema);
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${env('GEMINI_API_KEY')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    const j: any = await r.json();
    if (j.error) throw new Error(`gemini ${r.status}: ${j.error.message}`);
    const c = j.candidates?.[0];
    return {
      texto: (c?.content?.parts || []).map((x: any) => x.text || '').join(''),
      ent: j.usageMetadata?.promptTokenCount || 0, sal: j.usageMetadata?.candidatesTokenCount || 0,
      stop: c?.finishReason,
    };
  }

  // OpenAI y Groq hablan el mismo dialecto.
  const base = prov === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
  const cuerpo: any = {
    model: modelo,
    messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: usuario }],
    max_completion_tokens: max,
  };
  if (p.esquema) cuerpo.response_format = { type: 'json_schema', json_schema: { name: 'respuesta', schema: p.esquema, strict: false } };
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${env(LLAVE[prov])}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const j: any = await r.json();
  if (j.error) throw new Error(`${prov} ${r.status}: ${j.error.message}`);
  return {
    texto: j.choices?.[0]?.message?.content || '',
    ent: j.usage?.prompt_tokens || 0, sal: j.usage?.completion_tokens || 0,
    stop: j.choices?.[0]?.finish_reason,
  };
}

export async function preguntar<T = any>(p: Peticion): Promise<Respuesta<T>> {
  const trabajo = p.trabajo || 'volumen';
  const orden = p.proveedor ? [p.proveedor] : await ordenDeProveedores(trabajo);
  if (!orden.length) return { ok: false, datos: null, texto: '', costo_usd: 0, run_id: null, error: 'no hay ninguna llave de IA configurada', definitivo: true };

  let usuario = p.usuario;
  let pii: string[] = [];
  if (p.anonimizar) { const r = redactPII(usuario); usuario = r.text; pii = r.piiFields || []; }

  const fallos: string[] = [];

  for (const prov of orden) {
    const modelo = MODELOS[prov][trabajo];
    const t0 = Date.now();
    let run_id: string | null = null;
    try {
      run_id = await createAgentRun({
        agent_name: p.agente, trigger_type: 'cron', model: `${prov}:${modelo}`,
        input: { ...(p.contexto || {}), largo: usuario.length }, pii_fields: pii,
      });
    } catch { /* la bitácora no puede impedir el trabajo */ }

    try {
      (globalThis as any).__ia_proposito = `demanda:${p.agente}`;
      const r = await pedirA(prov, modelo, p, usuario);
      const costo = costoDe(modelo, r.ent, r.sal);
      await registrar(prov, modelo, p.agente, r.ent, r.sal, costo, true, null, Date.now() - t0);

      let datos: T | null = null;
      try { datos = r.texto ? JSON.parse(r.texto) : null; } catch { datos = null; }

      if (p.esquema && datos === null) {
        /* Un «no vino como JSON» a secas manda a buscar el error en el esquema,
           que casi nunca es donde está. Las dos causas reales son que la
           respuesta se cortó por el tope de tokens —lo más común, y se arregla
           partiendo el lote— o que el modelo declinó. */
        const corto = /max_tokens|length|MAX_TOKENS/i.test(String(r.stop));
        const porque = corto
          ? `la respuesta se cortó en ${p.max_tokens || 4000} tokens: manda menos elementos por lote`
          : `la respuesta no es JSON válido (fin: ${r.stop})`;
        if (run_id) await finishAgentRun({ run_id, status: 'failed', error: { porque, stop: r.stop }, latency_ms: Date.now() - t0 });
        return { ok: false, datos: null, texto: r.texto, costo_usd: costo, run_id, error: porque, proveedor: prov, modelo };
      }

      if (run_id) await finishAgentRun({
        run_id, status: 'completed', output: { datos: datos ?? undefined, texto: datos ? undefined : r.texto.slice(0, 2000) },
        latency_ms: Date.now() - t0,
      });
      return { ok: true, datos, texto: r.texto, costo_usd: costo, run_id, proveedor: prov, modelo };

    } catch (e: any) {
      const mensaje = String(e?.message || e);
      await registrar(prov, modelo, p.agente, 0, 0, 0, false, mensaje, Date.now() - t0);
      if (run_id) await finishAgentRun({ run_id, status: 'failed', error: { mensaje }, latency_ms: Date.now() - t0 });
      fallos.push(`${prov}: ${mensaje.slice(0, 120)}`);

      // Un problema de saldo o de llave NO se arregla insistiendo con el mismo
      // proveedor — pero sí probando con el siguiente. Eso es lo que evita que
      // una factura de un tercero detenga el motor.
      if (!SIN_REMEDIO.test(mensaje)) {
        return { ok: false, datos: null, texto: '', costo_usd: 0, run_id, error: mensaje, proveedor: prov, modelo };
      }
    } finally {
      delete (globalThis as any).__ia_proposito;
    }
  }

  return {
    ok: false, datos: null, texto: '', costo_usd: 0, run_id: null,
    error: `ningún proveedor pudo responder · ${fallos.join(' | ')}`, definitivo: true,
  };
}

/** Todo queda en ia_uso, venga del proveedor que venga: el gasto del mes es uno
 *  solo aunque las facturas sean cuatro. */
async function registrar(prov: string, modelo: string, agente: string, ent: number, sal: number, costo: number, ok: boolean, error: string | null, ms: number) {
  try {
    await supabase.from('ia_uso').insert({
      modelo: `${prov}:${modelo}`, proposito: `demanda:${agente}`,
      input_tokens: ent, output_tokens: sal, cache_read: 0, cache_write: 0, busquedas_web: 0,
      costo_usd: costo, ok, error: error ? error.slice(0, 300) : null, ms,
    });
  } catch { /* medir no puede tumbar lo que mide */ }
}

/** Compatibilidad con lo ya escrito. */
export const PARA = { volumen: 'volumen', trabajo: 'trabajo', estrategia: 'estrategia' } as const;
