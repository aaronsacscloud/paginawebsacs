/**
 * QA · «Ya no estoy interesado» cierra el ciclo.
 *
 * Dos partes: que el DATO quedó bien (etapa, motivo, estatus) y que se VE —la
 * ficha dice Descalificado y el hilo lo explica con una línea de sistema, para
 * que mañana nadie crea que el CRM se movió solo.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE = process.env.BASE || 'http://localhost:4331';
const CONV = 'c1378387-d149-4d93-b3c4-c0cb667e8c51';   // Jovanna, la que dijo que ya no
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

// ── El dato ──
const { data: sueltos } = await sb.from('ti_perfil')
  .select('contact_id, contacts!inner(nombre, lifecycle_stage)')
  .eq('agente_estado->>cerrado', 'opt_out');
const malos = (sueltos || []).filter(x => ['lead', 'lead_calificado', 'rezagado'].includes(x.contacts?.lifecycle_stage));
paso('Nadie que dijo que no sigue como lead', malos.length === 0, malos.map(m => `${m.contacts.nombre} (${m.contacts.lifecycle_stage})`).join(', ') || `${(sueltos || []).length} opt-out revisados`);

const { data: c } = await sb.from('contacts').select('nombre, lifecycle_stage, descarte_categoria, estatus_lead')
  .eq('id', '0d09a3b9-ef13-4380-93fb-c44330cb1580').maybeSingle();
paso('Quedó descalificada', c?.lifecycle_stage === 'descalificado', `${c?.nombre}: ${c?.lifecycle_stage}`);
paso('Con el motivo que dijo ella', c?.descarte_categoria === 'no_interesado', String(c?.descarte_categoria));
paso('Y como descartada en el funnel', c?.estatus_lead === 'descartado', String(c?.estatus_lead));

// ── Y cómo se ve ──
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
/* Se espera a que el hilo esté PINTADO, no a un reloj: con 22 s fijos la prueba
   fallaba unas veces sí y otras no, que es la peor clase de prueba. */
await p.waitForFunction(() => /pas[oó] de rezagado a DESCALIFICADO/i.test(document.body.innerText), null, { timeout: 45000 }).catch(() => {});
// El panel de la derecha llega un paso después del hilo: también se espera.
await p.waitForFunction(() => /no atiende la etapa/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
paso('El hilo dice qué pasó y por qué', /pas[oó] de rezagado a DESCALIFICADO/i.test(t));
paso('La nota la firma el Sistema, no una persona', /Sistema · \+52/.test(t));
paso('La ficha la enseña descalificada y descartada', /Descalificado/i.test(t) && /Descartado/i.test(t));
paso('Y el agente ya no la atiende', /no atiende la etapa/i.test(t));
await p.screenshot({ path: '/tmp/qa-optout.png' });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
