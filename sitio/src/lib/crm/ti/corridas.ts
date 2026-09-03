/** Corridas observables (3-sep): cada cron deja UNA fila en ti_corridas con inicio, fin, duración y el resultado o error
 *  de cada paso. Un paso que truena no tumba los demás. El latido avisa si un cron lleva >26 h sin corrida buena. */
import { supabase } from '../../supabase';

export async function correr(cron: string, pasos: Record<string, () => Promise<any>>) {
  const inicio = Date.now();
  const { data: fila } = await supabase.from('ti_corridas').insert({ cron, inicio: new Date(inicio).toISOString() }).select('id').single();
  const out: Record<string, any> = {}; let todoOk = true;
  for (const [nombre, fn] of Object.entries(pasos)) {
    const t0 = Date.now();
    try { const res = await fn(); out[nombre] = { ok: true, ms: Date.now() - t0, res }; }
    catch (e: any) { todoOk = false; out[nombre] = { ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 400) }; }
    if (fila?.id) await supabase.from('ti_corridas').update({ pasos: out }).eq('id', fila.id);   // progreso visible aunque el siguiente paso se corte por tiempo
  }
  const fin = Date.now();
  if (fila?.id) await supabase.from('ti_corridas').update({ fin: new Date(fin).toISOString(), duracion_ms: fin - inicio, ok: todoOk, pasos: out, error: todoOk ? null : Object.entries(out).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.error}`).join(' · ').slice(0, 800) }).eq('id', fila.id);
  return { ok: todoOk, duracion_ms: fin - inicio, pasos: out };
}

export async function ultimaCorrida(cron: string) {
  const { data } = await supabase.from('ti_corridas').select('inicio, fin, duracion_ms, ok, error').eq('cron', cron).order('inicio', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}
