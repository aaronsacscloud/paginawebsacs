/**
 * QA · un hilo de solo correo también se cierra.
 *
 * Hasta hoy no tenía cómo: el selector de estado solo salía para las
 * conversaciones de WhatsApp, y esos hilos se quedaban en «No contestadas» para
 * siempre. Se prueba de punta a punta —abrirlo como lo abre una persona, ver el
 * control, cerrarlo, comprobar en la base y ver que se va de la bandeja— y al
 * final se deja como estaba.
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
const BASE = process.env.BASE || 'http://localhost:4334';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

// El hilo de prueba del propio equipo, no el de un cliente.
const { data: hilo } = await sb.from('email_conversations').select('id, email, estado')
  .eq('email', 'mccpubliherz@gmail.com').maybeSingle();
paso('Hay un hilo de solo correo para probar', !!hilo, hilo ? `${hilo.email} · ${hilo.estado}` : 'no hay');
const estadoOriginal = hilo.estado;
await sb.from('email_conversations').update({ estado: 'abierta' }).eq('id', hilo.id);

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }) });
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');

const antes = await fetch(`${BASE}/api/crm/whatsapp/inbox?filtro=no_leidas&limit=200&_=${Date.now()}`, { headers: { cookie } }).then(r => r.json());
paso('Aparece en «No contestadas»', (antes.conversaciones || []).some(c => c.email_id === hilo.id || c.id === hilo.id), `${antes.counts?.no_leidas} filas`);

// ── Lo que ve y toca una persona ──
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(20000);
/* A la bandeja donde está: la lista carga 50 filas por vez y este hilo es del
   19 de agosto — en «Todas» queda muy por debajo del primer lote. */
await p.locator('text=No contestadas').first().click().catch(() => {});
await p.waitForTimeout(7000);
const fila = p.locator('[data-conv]').filter({ hasText: 'mccpubliherz' }).first();
paso('El hilo de correo está en la lista', (await fila.count()) > 0);
await fila.click().catch(() => {});
await p.waitForTimeout(9000);
const haySelector = await p.evaluate(() => [...document.querySelectorAll('select')].some(s => [...s.options].some(o => /Resuelta/i.test(o.text))));
paso('Al abrirlo, la pantalla ofrece el selector de estado', haySelector);
await p.screenshot({ path: '/tmp/qa-cerrar-correo.png' });
await nav.close();

// ── Y cerrarlo, por el mismo camino que usa ese selector ──
const r = await fetch(`${BASE}/api/crm/whatsapp/hilo`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({ email_id: hilo.id, estado_crm: 'resuelta', cierre_categoria: 'Otro' }),
}).then(x => x.json());
paso('El servidor acepta cerrarlo', r?.ok === true, JSON.stringify(r));

const { data: tras } = await sb.from('email_conversations').select('estado').eq('id', hilo.id).maybeSingle();
paso('Queda cerrado en la base', tras?.estado === 'cerrada', `estado: ${tras?.estado}`);

/* El inbox tiene micro-caché de unos segundos: sin esperar, la segunda llamada
   devuelve la MISMA lista y la prueba diría que no se fue cuando sí se fue. */
await new Promise(x => setTimeout(x, 11000));
const despues = await fetch(`${BASE}/api/crm/whatsapp/inbox?filtro=no_leidas&limit=200&_=${Date.now()}`, { headers: { cookie } }).then(r => r.json());
paso('Y se va de «No contestadas»', !(despues.conversaciones || []).some(c => c.email_id === hilo.id || c.id === hilo.id),
  `${antes.counts?.no_leidas} → ${despues.counts?.no_leidas}`);

// Se deja como estaba: la prueba no decide por el dueño.
await sb.from('email_conversations').update({ estado: estadoOriginal }).eq('id', hilo.id);
const { data: fin } = await sb.from('email_conversations').select('estado').eq('id', hilo.id).maybeSingle();
paso('Se devuelve el hilo a como estaba', fin?.estado === estadoOriginal, `vuelve a «${fin?.estado}»`);
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
