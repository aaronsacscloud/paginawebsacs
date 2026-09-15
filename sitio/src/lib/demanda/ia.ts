// DEMAND ENGINE · las llamadas al modelo.
//
// Todo lo que el motor le pregunta a un modelo pasa por aquí, para que tres
// cosas sean automáticas y no dependan de que cada agente se acuerde:
//   · queda registrada la corrida con su costo (agent_runs + ia_uso);
//   · el modelo se elige por TRABAJO, no por gusto;
//   · lo que vuelve es JSON validado, no texto que hay que adivinar.
import { anthropic, MODELS, calculateCost } from '../ai/client';
import { createAgentRun, finishAgentRun } from '../ai/audit';
import { redactPII } from '../ai/redact';

/** El modelo se elige por la naturaleza del trabajo, y ese mapa vive en un
 *  solo lugar: cambiar de modelo no puede ser una cacería por el repo. */
export const PARA = {
  /** Clasificar, normalizar, extraer, resumir: volumen alto, juicio bajo. */
  volumen: MODELS.haiku,
  /** Redactar, auditar, analizar una SERP o un competidor. */
  trabajo: MODELS.sonnet5,
  /** Estrategia, prioridades de la semana, decisiones de producto. */
  estrategia: MODELS.opus,
} as const;

export type Peticion = {
  agente: string;
  modelo?: string;
  sistema: string;
  usuario: string;
  /** Esquema JSON de la respuesta. Sin él no hay contrato y hay que adivinar. */
  esquema?: Record<string, any>;
  max_tokens?: number;
  /** Texto de terceros o de clientes: se anonimiza ANTES de salir del servidor. */
  anonimizar?: boolean;
  contexto?: Record<string, any>;
};

export type Respuesta<T = any> = {
  ok: boolean; datos: T | null; texto: string; costo_usd: number; run_id: string | null; error?: string;
  /** No tiene caso reintentar: reintentar no repone el saldo ni arregla la llave. */
  definitivo?: boolean;
};

/* Fallos que NO se arreglan insistiendo. Distinguirlos importa de verdad: el
   14-sep la cuenta se quedó sin saldo y el agente de WhatsApp reintentó 1,775
   veces contra un error que ninguna cantidad de reintentos podía resolver. */
const ES_DEFINITIVO = /credit balance|insufficient|invalid.?api.?key|authentication|permission|not have access|quota/i;

export async function preguntar<T = any>(p: Peticion): Promise<Respuesta<T>> {
  const modelo = p.modelo || PARA.volumen;
  const t0 = Date.now();
  let usuario = p.usuario;
  let pii: string[] = [];

  if (p.anonimizar) {
    const r = redactPII(usuario);
    usuario = r.text;
    pii = r.piiFields || [];
  }

  let run_id: string | null = null;
  try {
    run_id = await createAgentRun({
      agent_name: p.agente, trigger_type: 'cron', model: modelo,
      input: { ...(p.contexto || {}), largo: usuario.length }, pii_fields: pii,
    });
  } catch { /* la bitácora no puede impedir el trabajo */ }

  /* El registro de costo de `lib/ai/client.ts` deduce el propósito del stack, y
     con los tipos despojados de TypeScript ese stack no siempre resuelve: parte
     del gasto aparecía como «desconocido». Declararlo a mano deja la cuenta
     exacta y, de paso, da el costo POR AGENTE sin trabajo extra: quién gasta y
     en qué es media pregunta del control de presupuesto. */
  (globalThis as any).__ia_proposito = `demanda:${p.agente}`;

  try {
    const cuerpo: any = {
      model: modelo,
      max_tokens: p.max_tokens || 4000,
      system: p.sistema,
      messages: [{ role: 'user', content: usuario }],
    };
    // Salida estructurada: el modelo devuelve exactamente la forma pedida en
    // vez de un texto con un JSON adentro que hay que rescatar con regex.
    if (p.esquema) cuerpo.output_config = { format: { type: 'json_schema', schema: p.esquema } };

    const r: any = await anthropic.messages.create(cuerpo);
    const texto = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const costo = calculateCost(modelo, r.usage || {}).cost_usd;

    let datos: T | null = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = null; }

    /* Un «no vino como JSON» a secas manda a buscar el error en el esquema, que
       casi nunca es donde está. Las dos causas reales son que la respuesta se
       cortó por `max_tokens` —lo más común, y se arregla partiendo el lote— o
       que el modelo declinó. Decirlo aquí ahorra la media hora de depurar el
       lugar equivocado. */
    if (p.esquema && datos === null) {
      const por_que = r.stop_reason === 'max_tokens'
        ? `la respuesta se cortó en ${p.max_tokens || 4000} tokens: manda menos elementos por lote`
        : r.stop_reason === 'refusal'
          ? `el modelo declinó (${r.stop_details?.category || 'sin categoría'})`
          : `la respuesta no es JSON válido (stop_reason: ${r.stop_reason})`;
      if (run_id) await finishAgentRun({ run_id, status: 'failed', error: { por_que, stop_reason: r.stop_reason }, usage: calculateCost(modelo, r.usage || {}), latency_ms: Date.now() - t0 });
      return { ok: false, datos: null, texto, costo_usd: costo, run_id, error: por_que };
    }

    if (run_id) await finishAgentRun({
      run_id, status: 'completed', output: { datos, texto: datos ? undefined : texto.slice(0, 2000) },
      usage: calculateCost(modelo, r.usage || {}), latency_ms: Date.now() - t0,
    });

    return { ok: true, datos, texto, costo_usd: costo, run_id };
  } catch (e: any) {
    const mensaje = String(e?.message || e);
    const definitivo = ES_DEFINITIVO.test(mensaje);
    if (run_id) await finishAgentRun({ run_id, status: 'failed', error: { mensaje, definitivo }, latency_ms: Date.now() - t0 });
    return { ok: false, datos: null, texto: '', costo_usd: 0, run_id, error: mensaje, definitivo };
  } finally {
    delete (globalThis as any).__ia_proposito;
  }
}
