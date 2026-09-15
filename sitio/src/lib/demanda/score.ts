// DEMAND ENGINE · el score de oportunidad.
//
// Determinista a propósito: los juicios los da el modelo (evaluar.ts), pero el
// NÚMERO lo calcula esta fórmula con los pesos vigentes. Así se puede explicar
// cada punto, recalibrar los pesos sin volver a pagar por todo el corpus, y
// comparar hoy contra el mes pasado sabiendo qué cambió.
//
// También por eso cada factor guarda su valor por separado en `desglose`: el
// día que el aprendizaje diga «las oportunidades con distribución alta traen
// mejores clientes», hay con qué demostrarlo.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import type { ResultadoHandler } from './tipos';

export type Pesos = Record<string, number>;

export const PESOS_V1: Pesos = {
  demanda: 20, relevancia: 15, intencion: 15, conversion: 15,
  capacidad: 10, distribucion: 10, ventaja: 10, eficiencia: 5,
};

export async function pesosVigentes(): Promise<{ version: number; pesos: Pesos }> {
  const { data } = await supabase.from('de_pesos').select('version, pesos').eq('vigente', true).maybeSingle();
  return { version: data?.version ?? 1, pesos: (data?.pesos as Pesos) || PESOS_V1 };
}

/** Curva suave para volúmenes: la diferencia entre 1 y 5 señales importa mucho
 *  más que entre 100 y 104, y una escala lineal aplastaría todo lo demás. */
const log100 = (n: number, techo = 40) => Math.min(100, (Math.log10(Math.max(0, n) + 1) / Math.log10(techo + 1)) * 100);

export type Factores = Record<string, number>;

export function factoresDe(c: any, intencionMedia: number | null): Factores {
  const p = (x: any, d = 50) => (Number.isFinite(x) ? Number(x) : d);
  const dificultad = p(c.dificultad, 50);

  return {
    // Cuánta gente lo pide, con la tendencia como empujón suave.
    demanda: Math.min(100, log100(c.senales_n || 0) * 0.7 + log100(c.queries_n || 0, 15) * 0.3),
    relevancia: p(c.relevancia_sacs),
    // Sin datos de intención de las consultas se usa el juicio del evaluador;
    // cuando llegue Search Console, manda el dato observado.
    intencion: intencionMedia != null ? intencionMedia * 100 : p(c.potencial_conversion),
    conversion: p(c.potencial_conversion),
    // Poder ganar es lo contrario de la dificultad, y sube si ya tenemos página.
    capacidad: Math.max(0, 100 - dificultad) * (c.pagina_sacs ? 1.15 : 1),
    distribucion: Math.max(p(c.potencial_distribucion_ia, 30), p(c.potencial_herramienta, 30)),
    ventaja: Math.max(p(c.potencial_red, 20), p(c.valor_dato, 20)),
    // Lo barato de hacer vale: una página pesa menos que una herramienta.
    eficiencia: Math.max(0, 100 - dificultad * 0.6),
  };
}

export function combinar(f: Factores, pesos: Pesos): number {
  const total = Object.values(pesos).reduce((s, x) => s + x, 0) || 1;
  const suma = Object.entries(pesos).reduce((s, [k, w]) => s + (f[k] ?? 50) * w, 0);
  return Math.round((suma / total) * 100) / 100;
}

export async function puntuarClusters(limite = 500): Promise<{ puntuados: number; version: number }> {
  const { version, pesos } = await pesosVigentes();
  const { data: clusters } = await supabase
    .from('de_clusters')
    .select('id, senales_n, queries_n, relevancia_sacs, potencial_conversion, potencial_herramienta, potencial_red, valor_dato, potencial_distribucion_ia, dificultad, pagina_sacs')
    .not('relevancia_sacs', 'is', null)
    .neq('estado', 'descartado')
    .limit(limite);
  if (!clusters?.length) return { puntuados: 0, version };

  // La intención observada de las consultas del cluster, cuando la hay.
  const { data: intenciones } = await supabase
    .from('de_queries').select('cluster_id, intent_comercial').not('cluster_id', 'is', null).not('intent_comercial', 'is', null);
  const porCluster = new Map<string, number[]>();
  for (const q of intenciones || []) {
    if (!porCluster.has(q.cluster_id)) porCluster.set(q.cluster_id, []);
    porCluster.get(q.cluster_id)!.push(Number(q.intent_comercial));
  }

  let puntuados = 0;
  for (const c of clusters) {
    const lista = porCluster.get(c.id) || [];
    const media = lista.length ? lista.reduce((s, x) => s + x, 0) / lista.length : null;
    const f = factoresDe(c, media);
    await supabase.from('de_clusters')
      .update({ score_oportunidad: combinar(f, pesos), updated_at: new Date().toISOString() })
      .eq('id', c.id);
    puntuados++;
  }
  return { puntuados, version };
}

registrar('puntuar', async (): Promise<ResultadoHandler> => {
  const r = await puntuarClusters();
  return { ok: true, resumen: `${r.puntuados} problemas puntuados con los pesos v${r.version}`, datos: r };
});
