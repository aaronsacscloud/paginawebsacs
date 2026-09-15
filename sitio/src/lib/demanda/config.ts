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
  mes: string; gastado: number; tope: number; pct: number;
  /** Con el presupuesto agotado el motor no se apaga: se vuelve selectivo. */
  restringido: boolean; agotado: boolean;
};

export async function presupuesto(cfg?: Config): Promise<EstadoPresupuesto> {
  const c = cfg || await leerConfig();
  const mes = mesActual();
  // El mes cambió: el contador se reinicia solo, no hay que acordarse.
  let gastado = c.mes_en_curso === mes ? Number(c.gasto_mes_usd || 0) : 0;
  if (c.mes_en_curso !== mes) {
    await supabase.from('de_config').update({ mes_en_curso: mes, gasto_mes_usd: 0 }).eq('id', 1);
    cache = null;
  }
  const tope = Number(c.presupuesto_mensual_usd || 0);
  const pct = tope > 0 ? Math.round((gastado / tope) * 100) : 0;
  return { mes, gastado, tope, pct, restringido: tope > 0 && pct >= 80, agotado: tope > 0 && gastado >= tope };
}

/** Suma lo que costó una acción. Nunca lanza: medir el gasto no puede tumbar
 *  el trabajo que se está midiendo. */
export async function cobrar(usd: number): Promise<void> {
  if (!usd || usd <= 0) return;
  try {
    const mes = mesActual();
    const { data } = await supabase.from('de_config').select('gasto_mes_usd, mes_en_curso').eq('id', 1).maybeSingle();
    const base = data?.mes_en_curso === mes ? Number(data.gasto_mes_usd || 0) : 0;
    await supabase.from('de_config').update({ gasto_mes_usd: base + usd, mes_en_curso: mes }).eq('id', 1);
    cache = null;
  } catch { /* noop */ }
}
