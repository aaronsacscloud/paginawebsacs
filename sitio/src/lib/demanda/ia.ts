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
  gemini:    { volumen: 'gemini-2.5-flash', trabajo: 'gemini-3.5-flash', estrategia: 'gemini-3.1-pro-preview' }, // 2.5-pro ya no existe para cuentas nuevas (404, 21-sep-2026)
  openai:    { volumen: 'gpt-5', trabajo: 'gpt-5', estrategia: 'gpt-5' }, // gpt-5-pro solo existe en /v1/responses: 404 en chat/completions (21-sep-2026)
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
  'gemini-3.1-pro-preview': { in: 2, out: 12 },   // aproximado (21-sep-2026): ajustar cuando Google publique la tarifa
  'gemini-3.5-flash': { in: 0.30, out: 2.50 },   // aproximado
  'gemini-flash-lite-latest': { in: 0.10, out: 0.40 },
  'gpt-5': { in: 1.25, out: 10 },
  'gpt-5-pro': { in: 15, out: 120 },
  'openai/gpt-oss-120b': { in: 0.15, out: 0.75 },
  // Solo lo usa la medición GEO, no el motor: ahí Perplexity se consulta como
  // plataforma —«¿qué le contesta a un comprador?»— y no como proveedor.
  'perplexity/sonar': { in: 1, out: 1 },
};

/* Las APIs devuelven el modelo CON FECHA —`gpt-5-2025-08-07`, no `gpt-5`— y la
   tabla está escrita sin ella, que es como uno pide el modelo. Buscar solo por
   igualdad convertía la llamada más cara de la medición (22,582 tokens de
   entrada, ~$0.06) en un cero perfecto.

   Se busca primero exacto y luego por prefijo MÁS LARGO. Lo del prefijo más
   largo no es un detalle: si se tomara el primero que empata, `gpt-5-pro-...`
   caería en la tarifa de `gpt-5` y se cobraría doce veces menos de lo real. */
const PREFIJOS = Object.keys(PRECIOS).sort((a, b) => b.length - a.length);

export const costoDe = (modelo: string, ent: number, sal: number) => {
  const p = PRECIOS[modelo] || PRECIOS[PREFIJOS.find(k => modelo.startsWith(k)) || ''];
  if (!p) {
    /* «Precio desconocido» tiene que DOLER en la bitácora. Antes se devolvía
       cero en silencio y el presupuesto del mes se quedaba corto sin que nadie
       supiera por cuánto. */
    if (ent || sal) console.warn(`[ia] sin tarifa para «${modelo}»: ${ent + sal} tokens contados como $0. Agrégalo a PRECIOS.`);
    return 0;
  }
  return (ent * p.in + sal * p.out) / 1_000_000;
};

/* La medición GEO llama a las plataformas por HTTP directo, no por `preguntar`:
   tiene que preguntar TAL CUAL, sin sistema ni esquema, o deja de medir lo que
   ve un comprador. El efecto secundario fue que ese gasto no pasaba por aquí y
   por tanto no existía para el presupuesto: `de_ia_muestras.costo_usd` salía en
   cero en las 68 muestras, y el tope mensual de $150 no lo veía venir.

   Esto le da la misma puerta de entrada a `ia_uso` sin obligarla a pasar por el
   contrato de `preguntar`, que es justo lo que no puede usar. */
export async function anotarUso(modelo: string, proposito: string, ent: number, sal: number, ok: boolean, error: string | null, ms: number, busquedas = 0) {
  const costo = costoDe(modelo, ent, sal);
  await registrar(modelo.includes(':') ? '' : 'geo', modelo, proposito, ent, sal, costo, ok, error, ms, busquedas);
  return costo;
}

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
  const orden = [...new Set([forzado, ...PREFERENCIA[trabajo]].filter((p): p is Proveedor => !!p && hay.includes(p)))];

  /* Un proveedor que hace diez minutos contestó «tu saldo es demasiado bajo» va
     a contestar lo mismo ahora. Preguntarle otra vez cuesta un viaje de red por
     llamada y ensucia `ia_uso` con fallos que no son fallos del motor.

     Medido en este proyecto el 17-sep-2026: 9,152 llamadas fallidas en cinco
     días contra una cuenta sin saldo, y la del CRM llegó a 5,474 en un solo día.
     Nadie las miraba porque cada una conmutaba bien al siguiente proveedor; el
     desperdicio estaba en volver a descubrirlo cada vez. */
  const ahora = Date.now();
  const marcas = (u.ia_sin_saldo || {}) as Record<string, { hasta?: string }>;
  const caido = (p: Proveedor) => {
    const local = sinSaldoLocal.get(p);
    if (local && local > ahora) return true;
    const t = Date.parse(marcas[p]?.hasta || '');
    return Number.isFinite(t) && t > ahora;
  };

  const vivos = orden.filter(p => !caido(p));
  /* Si TODOS están marcados, se intenta igual con el orden completo: una marca
     vieja no puede dejar al motor mudo. Más vale un viaje perdido que no hacer
     nada. */
  return vivos.length ? vivos : orden;
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
  /** false = sin razonamiento previo. Opus 5 piensa por defecto y esos tokens
   *  salen del MISMO max_tokens: en una página de 3,000 palabras el
   *  razonamiento se comía 20-30k y la respuesta llegaba cortada (22-sep-2026).
   *  Escribir con un encargo explícito no necesita pensar; juzgar sí. */
  pensar?: boolean;
};

export type Respuesta<T = any> = {
  ok: boolean; datos: T | null; texto: string; costo_usd: number;
  run_id: string | null; error?: string; definitivo?: boolean;
  proveedor?: Proveedor; modelo?: string;
};

/* Fallos que NO se arreglan insistiendo — pero SÍ cambiando de proveedor. Es la
   diferencia entre «reintenta en cinco minutos» y «prueba con otro». */
const SIN_REMEDIO = /credit balance|insufficient|billing|quota|invalid.?api.?key|authentication|permission|not have access|exceeded/i;

/* De todos los «sin remedio», estos son los que NO se arreglan solos y valen la
   pena RECORDAR: el proveedor se quedó sin saldo o su llave no sirve. Ninguno
   cambia en los próximos minutos.

   `quota` y `exceeded` quedan fuera a propósito: en Gemini casi siempre son el
   límite POR MINUTO, que se libera solo. Apuntar a Gemini como caído media hora
   por un límite de sesenta segundos sería cambiar un problema por otro peor. */
const SIN_SALDO = /credit balance|no credits remaining|insufficient|billing|invalid.?api.?key|authentication/i;

/** Cuánto se recuerda. Media hora: suficiente para que una corrida entera del
 *  worker deje de tocar la puerta, y poco para que pagar se note pronto. */
const OLVIDO_MS = 30 * 60 * 1000;

/* En memoria para la corrida en curso —que es donde está el volumen: un worker
   procesa decenas de acciones seguidas— y en `de_config.umbrales` para que la
   siguiente corrida tampoco lo reintente.
   Persistir ahí es gratis: `ordenDeProveedores` YA lee `umbrales`. */
const sinSaldoLocal = new Map<Proveedor, number>();

async function apuntarSinSaldo(prov: Proveedor, motivo: string) {
  const hasta = Date.now() + OLVIDO_MS;
  sinSaldoLocal.set(prov, hasta);
  try {
    const { data } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
    const u = { ...(data?.umbrales || {}) };
    u.ia_sin_saldo = { ...(u.ia_sin_saldo || {}), [prov]: { hasta: new Date(hasta).toISOString(), motivo: motivo.slice(0, 160) } };
    await supabase.from('de_config').update({ umbrales: u }).eq('id', 1);
  } catch { /* recordar no puede impedir el trabajo */ }
}

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

/* `yaAnotado`: la llamada YA quedó escrita en `ia_uso` por quien la hizo, y
   volver a anotarla aquí la contaría dos veces.
   Pasa con Anthropic y no con los demás: los otros proveedores se llaman por
   `fetch` pelón, pero Anthropic va por el cliente instrumentado del repo
   (`lib/ai/client.ts`), que registra su propio consumo.

   Medido el 18-sep-2026: cada llamada del motor a Anthropic dejaba DOS filas
   con los mismos tokens y el mismo costo —una como `claude-sonnet-5` y otra
   como `anthropic:claude-sonnet-5`—, o sea $1.03 de $2.5 del mes contados
   doble. El tope de $150 habría frenado el motor a los $75 reales, que es la
   peor forma de fallar: parece un límite respetado. */
type Cruda = { texto: string; ent: number; sal: number; stop?: string; yaAnotado?: boolean };

const trabajoDe = (p: Peticion): Trabajo => p.trabajo || 'volumen';

async function pedirA(prov: Proveedor, modelo: string, p: Peticion, usuario: string): Promise<Cruda> {
  const max = p.max_tokens || 4000;

  if (prov === 'anthropic') {
    /* La etiqueta va en el CUERPO y no solo en la global: `pedirA` se llama
       desde dos caminos y solo uno pone `__ia_proposito`, así que el otro caía
       en «desconocido». El proxy la lee y la borra antes de salir a la API. */
    const cuerpo: any = { proposito: `demanda:${p.agente || trabajoDe(p)}`, model: modelo, max_tokens: max, system: p.sistema, messages: [{ role: 'user', content: usuario }] };
    if (p.esquema) cuerpo.output_config = { format: { type: 'json_schema', schema: p.esquema } };
    if (p.pensar === false) cuerpo.thinking = { type: 'disabled' };
    const r: any = await anthropic.messages.create(cuerpo);
    return {
      texto: (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''),
      ent: r.usage?.input_tokens || 0, sal: r.usage?.output_tokens || 0, stop: r.stop_reason,
      yaAnotado: true,
    };
  }

  if (prov === 'gemini') {
    const cuerpo: any = {
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: [{ text: usuario }] }],
      /* Gemini 3.x «piensa» dentro del MISMO tope de salida: con 28k un borrador
         de 3,000 palabras llegaba cortado. Se le da margen (hasta 65k) para que
         el razonamiento no se coma la respuesta. */
      generationConfig: { maxOutputTokens: max > 8000 ? Math.min(65536, max * 2) : max, temperature: 0 },
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
      // El costo se devuelve igual; lo que se evita es la SEGUNDA fila.
      if (!r.yaAnotado) await registrar(prov, modelo, p.agente, r.ent, r.sal, costo, true, null, Date.now() - t0);

      let datos: T | null = null;
      try { datos = r.texto ? JSON.parse(r.texto) : null; } catch { datos = null; }

      if (p.esquema && datos === null) {
        /* Un «no vino como JSON» a secas manda a buscar el error en el esquema,
           que casi nunca es donde está. Las dos causas reales son que la
           respuesta se cortó por el tope de tokens —lo más común, y se arregla
           partiendo el lote— o que el modelo declinó. */
        const corto = /max_tokens|length|MAX_TOKENS/i.test(String(r.stop));
        // Para diagnosticar QUÉ se cortó (¿contenido real o el modelo dando vueltas?).
        if (corto && process.env.IA_DUMP_CORTES) { try { (await import('node:fs')).writeFileSync(`${process.env.IA_DUMP_CORTES}/corte-${p.agente}-${Date.now()}.txt`, r.texto || ''); } catch {} }
        /* Degeneración: el modelo entra en bucle («/*x*\/;/*x*\/;…» 228 veces en
           novias, 22-sep-2026) y llena el tope con basura. No es un problema de
           tamaño: es una falla de esa corrida. Se prueba con el siguiente
           proveedor en vez de devolver «se cortó». */
        const cola = String(r.texto || '').slice(-400);
        const degenerado = corto && cola.length > 100 && (cola.match(new RegExp(cola.slice(-40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 4;
        const porque = degenerado
          ? `el modelo degeneró en un bucle y llenó ${p.max_tokens || 4000} tokens de basura`
          : corto
            ? `la respuesta se cortó en ${p.max_tokens || 4000} tokens: manda menos elementos por lote`
            : `la respuesta no es JSON válido (fin: ${r.stop})`;
        if (run_id) await finishAgentRun({ run_id, status: 'failed', error: { porque, stop: r.stop }, latency_ms: Date.now() - t0 });
        if (degenerado) { fallos.push(`${prov}: ${porque}`); continue; }
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
      if (SIN_SALDO.test(mensaje)) await apuntarSinSaldo(prov, mensaje);

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
async function registrar(prov: string, modelo: string, agente: string, ent: number, sal: number, costo: number, ok: boolean, error: string | null, ms: number, busquedas = 0) {
  try {
    await supabase.from('ia_uso').insert({
      modelo: prov ? `${prov}:${modelo}` : modelo, proposito: `demanda:${agente}`,
      input_tokens: ent, output_tokens: sal, cache_read: 0, cache_write: 0, busquedas_web: busquedas,
      costo_usd: costo, ok, error: error ? error.slice(0, 300) : null, ms,
    });
  } catch { /* medir no puede tumbar lo que mide */ }
}

/** Compatibilidad con lo ya escrito. */
export const PARA = { volumen: 'volumen', trabajo: 'trabajo', estrategia: 'estrategia' } as const;
