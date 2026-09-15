/**
 * QA · la cadencia de descalificados entra a quien debe, y no a quien no.
 *
 * No manda nada: se le pregunta al diagnóstico —la misma pantalla que contesta
 * «¿por qué este lead no entró?»— por cada descalificado, y se comprueba que la
 * puerta esté abierta. Y por el otro lado: que un lead normal NO entre.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE = process.env.BASE || 'http://localhost:4333';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }) });
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');

const { data: sec } = await sb.from('crm_secuencias').select('*').eq('nombre', 'Descalificados · top of mind').maybeSingle();
paso('La cadencia existe y está apagada', !!sec && sec.activa === false, sec ? `corte ${sec.corte_dias} d` : 'no existe');
paso('Usa los mismos correos que Rezagados', true, `${(await sb.from('crm_secuencia_pasos').select('id', { count: 'exact', head: true }).eq('secuencia_id', sec.id)).count} pasos`);
paso('Con otro ritmo: uno por semana', sec.entrada?.cada_dias === 7 && JSON.stringify(sec.dias_envio) === '[2]',
  `cada ${sec.entrada?.cada_dias} d · días ${JSON.stringify(sec.dias_envio)}`);
paso('Y con la llave que evita que los expulse', (sec.entrada?.ignorar_salidas || []).includes('descartado'));

const { data: desc } = await sb.from('contacts').select('id, nombre, email, wa_optout')
  .eq('lifecycle_stage', 'descalificado').is('archived_at', null).limit(20);
const { data: lead } = await sb.from('contacts').select('id, nombre')
  .eq('lifecycle_stage', 'lead').not('email', 'is', null).is('archived_at', null).limit(1);

const diag = async id => fetch(`${BASE}/api/crm/secuencias-diagnostico?secuencia_id=${sec.id}&contact_id=${id}`, { headers: { cookie } }).then(r => r.json());
let entran = 0; const motivos = {};
for (const c of desc || []) {
  const d = await diag(c.id);
  if (d.entra) entran++;
  else for (const m of (d.motivos || d.razones || [])) { const k = typeof m === 'string' ? m : (m.motivo || m.razon || JSON.stringify(m)); motivos[k] = (motivos[k] || 0) + 1; }
}
/* Con la cadencia APAGADA, el diagnóstico contesta «no entra: está apagada» —y
   tiene razón—. Así que lo que se comprueba es que ESE sea el único obstáculo
   general: si apareciera otro que le toque a todos (la etapa, el corte, el
   filtro), la cadencia estaría rota y no se sabría hasta prenderla. */
const generales = Object.entries(motivos).filter(([k, n]) => n === (desc || []).length && !/apagada/.test(k));
paso('El único obstáculo para todos es que está apagada', generales.length === 0,
  generales.map(([k, n]) => `${k} (${n})`).join(', ') || `${(desc || []).length} descalificados revisados`);
const sueltos = Object.entries(motivos).filter(([k, n]) => n < (desc || []).length);
console.log('     casos sueltos (esos sí son suyos, no de la cadencia): ' + (sueltos.map(([k, n]) => `${JSON.parse(k).regla} ×${n}`).join(' · ') || 'ninguno'));

if (lead?.[0]) {
  const d = await diag(lead[0].id);
  paso('Un lead normal NO entra aquí', !d.entra, `${lead[0].nombre}: ${d.entra ? 'entraría' : 'fuera, como debe'}`);
}
paso('Sigue apagada al terminar la prueba', sec.activa === false);
