// TRABAJO INTELIGENTE · Encender el switch del arranque (aprobado: «cuando el
// panel F1 esté vivo»). Desde este momento, todo lead NUEVO que entre se
// enrola solo a la cadencia (T1 speed-to-lead). Reversible: --apagar.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const apagar = process.argv.includes('--apagar');
const { data: cfg } = await supabase.from('ti_config').select('valor').eq('id', 1).single();
const valor = { ...cfg.valor, arranque_desde: apagar ? null : new Date().toISOString() };
const { error } = await supabase.from('ti_config').update({ valor }).eq('id', 1);
console.log(error ? 'ERROR: ' + error.message : (apagar ? 'apagado.' : 'ENCENDIDO desde ' + valor.arranque_desde));
