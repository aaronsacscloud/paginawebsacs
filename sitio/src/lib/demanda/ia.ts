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

export type Respuesta<T = any> = { ok: boolean; datos: T | null; texto: string; costo_usd: number; run_id: string | null; error?: string };

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

    if (run_id) await finishAgentRun({
      run_id, status: 'completed', output: { datos, texto: datos ? undefined : texto.slice(0, 2000) },
      usage: calculateCost(modelo, r.usage || {}), latency_ms: Date.now() - t0,
    });

    if (p.esquema && datos === null)
      return { ok: false, datos: null, texto, costo_usd: costo, run_id, error: 'la respuesta no vino como JSON válido' };

    return { ok: true, datos, texto, costo_usd: costo, run_id };
  } catch (e: any) {
    if (run_id) await finishAgentRun({ run_id, status: 'failed', error: { mensaje: String(e?.message || e) }, latency_ms: Date.now() - t0 });
    return { ok: false, datos: null, texto: '', costo_usd: 0, run_id, error: String(e?.message || e) };
  }
}
