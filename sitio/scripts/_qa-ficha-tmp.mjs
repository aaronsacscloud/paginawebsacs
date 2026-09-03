/** Captura la ficha de un contacto con una respuesta de correo en su historial. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^"|"$/g,'')]));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const cred = Object.fromEntries(readFileSync('../.crm-login','utf8').split('\n').filter(l=>l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));

const id = randomUUID();
await sb.from('contacts').insert({ id, nombre: 'Zutana', apellido: 'QAcorreo',
  email: `qa-${id.slice(0,8)}@example.invalid`, tipo: 'lead', lifecycle_stage: 'lead',
  estatus_lead: 'respondio', campana: 'qa-arnes-cadencias' });
const acts = [
  { tipo:'email_enviado', titulo:'Le enviamos: ¿Vemos juntos cómo montar tu operación?' },
  { tipo:'email_opened',  titulo:'Abrió el correo' },
  { tipo:'email_respuesta', titulo:'Respondió por correo: Hola! Sí me interesa, ¿pueden llamarme mañana en la tarde?' },
];
for (const a of acts) await sb.from('activities').insert({ contact_id: id, automatico: true, ...a });

const nav = await chromium.launch({ args:['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1360, height: 1000 } });
const errs = []; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{ if (m.type()==='error') errs.push(m.text()); });
try {
  await p.goto('http://localhost:4321/admin/login', { waitUntil:'networkidle' });
  await p.fill('input[type="email"]', cred.CRM_EMAIL);
  await p.fill('input[type="password"]', cred.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 40000 }).catch(()=>{});
  await p.waitForTimeout(6000);
  // La ficha se abre desde el buscador global.
  const inputs = await p.locator('input').all();
  for (const i of inputs) console.log('input:', JSON.stringify(await i.getAttribute('placeholder')));
  const buscador = p.locator('input[placeholder*="usca" i], input[type="search"]').first();
  await buscador.click(); await buscador.type('Zutana', { delay: 90 });
  await p.waitForTimeout(5000);
  await p.screenshot({ path:'/tmp/claude-1000/-opt-sacs/busqueda.png' });
  console.log('tras buscar:', (await p.locator('body').innerText()).slice(0,300).replace(/\n+/g,' · '));
  await p.getByText('qa-', { exact: false }).first().click({ timeout: 15000 });
  await p.waitForTimeout(9000);
  // La ficha abre en la pestaña de resumen; el historial vive en su propia pestaña.
  await p.getByRole('button', { name: /actividad|historial|timeline/i }).first().click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(4000);
  await p.screenshot({ path:'/tmp/claude-1000/-opt-sacs/ficha-correo.png' });
  const t = (await p.locator('body').innerText());
  console.log('¿pinta el tipo crudo?  ', t.includes('email_respuesta') ? '✗ SÍ (mal)' : '✓ no');
  console.log('¿pinta la etiqueta?    ', t.includes('Te respondió por correo') ? '✓ sí' : '✗ no');
  console.log(errs.length ? `⚠ ${errs.length} errores JS: ${errs.slice(0,2).join(' | ')}` : '✓ sin errores de JS');
} finally {
  await nav.close();
  await sb.from('activities').delete().eq('contact_id', id);
  await sb.from('contacts').delete().eq('id', id);
}
