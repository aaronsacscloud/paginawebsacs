/**
 * PARCHE SEGURO DE ti_config (8-sep-2026).
 *
 * Lo que pasó: veinte lugares escribían la configuración como «leer la fila → {...valor, cambio} → update». Basta que UNA
 * lectura falle en silencio (error transitorio, `data` en null) para que el update reescriba la fila con solo el cambio y
 * se pierdan todas las demás llaves. Así se perdieron `agente_activo`, `agente_modo` y `arranque_desde`: el agente quedó
 * «apagado» dos horas sin que nadie lo apagara.
 *
 * Desde ahora TODO cambio de configuración pasa por aquí:
 *   · Primero el RPC `ti_config_parche(jsonb)`: `valor = valor || parche` en el servidor. Concatenar no puede borrar llaves.
 *   · Si el RPC no existe todavía (migración sin correr), se lee la fila COMPROBANDO el error: si la lectura falla o la fila
 *     no viene, se registra el error y NO se escribe nada (sin lanzar: un throw pararía el tick del observador). Escribir a ciegas es justo lo que rompió.
 *   · `ti_config_hist` guarda (por trigger) el valor anterior de cada cambio, para poder restaurar sin adivinar.
 *
 * Para quitar una llave se manda en null (queda `"llave": null`, que el código lee como ausente).
 */
import { supabase } from '../../supabase';

export async function parcharConfig(parche: Record<string, any>): Promise<Record<string, any>> {
  const limpio: Record<string, any> = {};
  for (const [k, v] of Object.entries(parche || {})) if (v !== undefined) limpio[k] = v;
  if (!Object.keys(limpio).length) return {};
  const { data, error } = await supabase.rpc('ti_config_parche', { p: limpio });
  if (!error && data && typeof data === 'object') return data as Record<string, any>;
  // Respaldo mientras no exista el RPC: lectura verificada, nunca a ciegas.
  const { data: fila, error: eLec } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  if (eLec) { console.error('[ti_config] no se pudo leer antes de escribir; NO se escribe nada:', eLec.message); return {}; }
  if (!fila || !fila.valor || typeof fila.valor !== 'object') { console.error('[ti_config] la fila vino vacía; NO se escribe nada para no borrar la configuración'); return {}; }
  const nuevo = { ...(fila.valor as Record<string, any>), ...limpio };
  const { error: eEsc } = await supabase.from('ti_config').update({ valor: nuevo }).eq('id', 1);
  if (eEsc) { console.error('[ti_config] no se pudo escribir:', eEsc.message); return {}; }
  return nuevo;
}
