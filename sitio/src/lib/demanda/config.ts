// DEMAND ENGINE · configuración viva y control del gasto.
import { supabase } from '../supabase';
import type { Config } from './tipos';

const DEFECTO: Config = {
  autonomia_global: 2, presupuesto_mensual_usd: 150, gasto_mes_usd: 0, mes_en_curso: null,
  kill_switch: false, modo: 'normal', mercados: ['MX'], idiomas: ['es'],
  umbrales: {}, pesos_version: 1, dueno_whatsapp: null, arrancado_at: null,
};

/** Caché corta a propósito: el worker lee la config en cada corrida y el dueño
 *  tiene que poder apagar el motor sin esperar a que expire un caché largo. */
let cache: { at: number; cfg: Config } | null = null;

export async function leerConfig(forzar = false): Promise<Config> {
  if (!forzar && cache && Date.now() - cache.at < 20_000) return cache.cfg;
  const { data } = await supabase.from('de_config').select('*').eq('id', 1).maybeSingle();
  const cfg = { ...DEFECTO, ...(data || {}) } as Config;
  cache = { at: Date.now(), cfg };
  return cfg;
}

export async function guardarConfig(parche: Partial<Config>): Promise<Config> {
  // `kill_switch` y `modo` son interruptores del dueño; el resto son ajustes.
  await supabase.from('de_config').update({ ...parche, actualizado_at: new Date().toISOString() }).eq('id', 1);
  cache = null;
  return leerConfig(true);
}

export const umbral = (cfg: Config, k: string, porDefecto: number) =>
  Number.isFinite(cfg.umbrales?.[k]) ? Number(cfg.umbrales[k]) : porDefecto;

const mesActual = () => new Date().toISOString().slice(0, 7);

export type EstadoPresupuesto = {
  mes: string; gastado: number; /** Lo que gasta TODA la IA del CRM, para contexto. */ todo_el_crm: number; tope: number; pct: number;
  /** Con el presupuesto agotado el motor no se apaga: se vuelve selectivo. */
  restringido: boolean; agotado: boolean;
};

/**
 * Lo gastado se SUMA de `ia_uso`, no se lleva en un contador.
 *
 * `lib/ai/client.ts` registra ahí cada llamada a un modelo, venga del worker,
 * de un script o de una pantalla. Un contador aparte solo cuenta lo que alguien
 * se acordó de sumarle, y en el momento en que se desincroniza —una corrida
 * manual, un proceso que murió a medias— el tope deja de proteger sin avisar.
 * Una suma sobre la bitácora no puede mentir.
 */
export async function presupuesto(cfg?: Config): Promise<EstadoPresupuesto> {
  const c = cfg || await leerConfig();
  const mes = mesActual();
  // El presupuesto es DEL MOTOR, no de toda la IA del CRM: el agente de
  // Trabajo Inteligente tiene su propia cuenta y frenar uno por el gasto del
  // otro sería castigar al que no gastó.
  const [{ data: propio }, { data: total }] = await Promise.all([
    supabase.rpc('de_gasto_del_mes', { mes, solo_motor: true }),
    supabase.rpc('de_gasto_del_mes', { mes, solo_motor: false }),
  ]);
  const gastado = Number(propio ?? 0);
  const todo_el_crm = Number(total ?? 0);
  const tope = Number(c.presupuesto_mensual_usd || 0);
  const pct = tope > 0 ? Math.round((gastado / tope) * 100) : 0;
  return { mes, gastado, todo_el_crm, tope, pct, restringido: tope > 0 && pct >= 80, agotado: tope > 0 && gastado >= tope };
}

/**
 * Deja constancia de lo que costó una acción en la propia fila de la acción.
 *
 * El gasto REAL se lee de `ia_uso` (ver arriba); esto es para poder decir
 * «este ciclo costó X» sin cruzar dos tablas, y para que el espejo del mes en
 * `de_config` sirva de referencia rápida en las pantallas.
 */
export async function cobrar(usd: number): Promise<void> {
  if (!usd || usd <= 0) return;
  try {
    const mes = mesActual();
    const { data } = await supabase.rpc('de_gasto_del_mes', { mes, solo_motor: true });
    await supabase.from('de_config').update({ gasto_mes_usd: Number(data ?? 0), mes_en_curso: mes }).eq('id', 1);
    cache = null;
  } catch { /* medir no puede tumbar lo que mide */ }
}
