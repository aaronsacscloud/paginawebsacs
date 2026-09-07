// QA con navegador de los 10 puntos de Ferias y eventos: comparador, calendario iCal, seguimiento,
// citas, turnos, ruta, gafete y la página pública de cita. Uso: node scripts/qa-eventos-10.mjs [--movil] [--base http://localhost:4322]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const S = '/tmp/claude-1000/-opt-sacs/aeb6a79e-2293-4ae9-bda3-16dd840d4ce3/scratchpad';
const env = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const bi = process.argv.indexOf('--base'); const BASE = bi > 0 ? process.argv[bi + 1] : 'http://localhost:4321';
const movil = process.argv.includes('--movil'); const suf = movil ? '-m' : '';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await nav.newPage({ viewport: movil ? { width: 390, height: 844 } : { width: 1360, height: 900 }, ...(movil ? { isMobile: true, hasTouch: true } : {}) });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); pg.on('response', async r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.request().method() + ' ' + r.url() + ' → ' + (await r.text().catch(() => '')).slice(0, 300)); });
const shot = async (n) => { await pg.waitForTimeout(700); await pg.screenshot({ path: `${S}/ev10-${n}${suf}.png` }); console.log('shot', n); };
await pg.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
await pg.fill('input[type="email"]', env.CRM_EMAIL); await pg.fill('input[type="password"]', env.CRM_PASSWORD); await pg.click('button[type="submit"]');
await pg.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(()=>{});
// edición «vamos» con stand para probar citas/turnos
const ev = await pg.evaluate(async () => (await fetch('/api/crm/eventos')).json());
const eds = ev.eventos.flatMap(e => e.ediciones.map(ed => ({ ...ed, evento: e })));
const vamos = eds.find(ed => ed.participacion === 'vamos' && ed.rol === 'stand') || eds.find(ed => ed.participacion === 'vamos');
console.log('edición de prueba:', vamos ? `${vamos.evento.nombre} · ${vamos.nombre} (${vamos.id})` : 'NINGUNA vamos');
await pg.goto(`${BASE}/admin/crm?tab=eventos`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1500);
await shot('1-home');
await pg.getByText('Comparar ferias', { exact: true }).first().click(); await pg.waitForTimeout(2000); await shot('2-comparar');
await pg.getByRole('button', { name: /Suscribirse al calendario|^Calendario$/ }).last().click(); await pg.waitForTimeout(1200); await shot('3-ical');
const feed = await pg.evaluate(async () => { const j = await (await fetch('/api/crm/eventos/ical')).json(); const t = await (await fetch(j.url)).text(); return { url: j.url, head: t.slice(0, 400), vevents: (t.match(/BEGIN:VEVENT/g) || []).length }; });
console.log('ical:', feed.vevents, 'eventos;', feed.head.split('\n').slice(0, 6).join(' | '));
await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
if (vamos) {
  await pg.goto(`${BASE}/admin/crm?tab=eventos&edicion=${vamos.id}&vista=seguimiento`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(2000); await shot('4-seguimiento');
  const sh = pg.locator('.crm-sheet').last();
  for (const [t, n] of [['Citas', '5-citas'], ['Turnos', '6-turnos'], ['A quién buscar', '7-buscar']]) {
    const b = sh.getByRole('button', { name: new RegExp('^' + t) }).first();
    if (await b.count()) { await b.click(); await pg.waitForTimeout(1500); await shot(n); } else console.log('sin pestaña', t);
  }
  const ruta = sh.getByRole('button', { name: /^Ruta/ }).first(); if (await ruta.count()) { await ruta.click(); await pg.waitForTimeout(1200); await shot('7b-ruta'); }
  const inv = sh.getByRole('button', { name: /^Citas/ }).first(); if (await inv.count()) { await inv.click(); await pg.waitForTimeout(800);
    const bi2 = sh.getByRole('button', { name: /Invitar a la base|Ver invitación/ }).first(); if (await bi2.count()) { await bi2.click(); await pg.waitForTimeout(2000); await shot('5b-invitar'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); } }
  const stand = sh.getByRole('button', { name: 'Modo stand' }).first(); if (await stand.count()) { await stand.click(); await pg.waitForTimeout(1200); await shot('8-stand-gafete'); }
  // página pública de cita
  const ed = await pg.evaluate(async (id) => (await fetch('/api/crm/eventos/edicion?id=' + id)).json(), vamos.id);
  const tok = ed.edicion?.token_publico;
  if (tok) { await pg.goto(`${BASE}/e/${tok}/cita`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1500); await shot('9-cita-publica');
    const hora = pg.locator('#horas button:not([disabled])').first(); if (await hora.count()) { await hora.click(); await pg.waitForTimeout(400); await shot('9b-cita-hora'); } else console.log('cita pública: sin horas libres o cerrada'); }
}
console.log('errores JS:', errs.length ? errs : 'ninguno');
await nav.close();
