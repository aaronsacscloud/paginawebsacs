// TRABAJO INTELIGENTE · El interruptor del copiloto (F5).
//   node scripts/ti-copiloto.mjs --on | --off | --estado
// El kill-switch del dueño: --off apaga TODA respuesta autónoma al instante.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: cfg } = await supabase.from('ti_config').select('valor').eq('id', 1).single();
const on = process.argv.includes('--on'), off = process.argv.includes('--off');
if (!on && !off) {
  const { count } = await supabase.from('ia_log').select('id', { count: 'exact', head: true });
  console.log('copiloto:', cfg.valor.copiloto_activo === false ? 'APAGADO' : 'encendido', '· eventos en ia_log:', count || 0);
  process.exit(0);
}
const valor = { ...cfg.valor, copiloto_activo: on };
const { error } = await supabase.from('ti_config').update({ valor }).eq('id', 1);
console.log(error ? 'ERROR: ' + error.message : (on ? 'copiloto ENCENDIDO' : 'copiloto APAGADO (kill-switch)'));
