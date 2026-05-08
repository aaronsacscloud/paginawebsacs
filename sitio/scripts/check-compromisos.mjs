// Reporta el estado de compromisos de cada invitación
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return [l.slice(0, i).trim(), v];
}));

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const { data, error } = await supabase
  .from('partner_invitations')
  .select('id, numero, nombre, compromisos')
  .order('created_at', { ascending: false });
if (error) { console.error(error); process.exit(1); }

for (const r of data) {
  const titles = (r.compromisos || []).map(c => c.title);
  console.log(`${r.numero} · ${r.nombre} · ${titles.length} items`);
  titles.forEach((t, i) => console.log(`  ${String(i+1).padStart(2,'0')} ${t}`));
  console.log('');
}
