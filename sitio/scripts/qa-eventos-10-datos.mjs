// QA con datos de prueba de los 10 puntos (JOYA Octubre 2026): siembra 3 registros, 1 turno y 1 cita
// pública, captura Seguimiento/Citas/Turnos/gafete/página pública, y al final borra lo sembrado.
// Uso: node scripts/qa-eventos-10-datos.mjs [--movil] [--base http://localhost:4322]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const S = '/tmp/claude-1000/-opt-sacs/aeb6a79e-2293-4ae9-bda3-16dd840d4ce3/scratchpad';
const env = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const bi = process.argv.indexOf('--base'); const BASE = bi > 0 ? process.argv[bi + 1] : 'http://localhost:4321';
const movil = process.argv.includes('--movil'); const suf = movil ? '-m' : '';
const ED = 'd96fe75d-6588-4f47-b3d8-b4a8c74cca30';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const pg = await nav.newPage({ viewport: movil ? { width: 390, height: 844 } : { width: 1360, height: 900 }, ...(movil ? { isMobile: true, hasTouch: true } : {}) });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); pg.on('response', async r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.request().method() + ' ' + r.url() + ' → ' + (await r.text().catch(() => '')).slice(0, 300)); });
const shot = async (n) => { await pg.waitForTimeout(700); await pg.screenshot({ path: `${S}/ev10-${n}${suf}.png` }); console.log('shot', n); };
const api = (body) => pg.evaluate(async (b) => (await fetch('/api/crm/eventos/edicion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json(), body);
await pg.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
await pg.fill('input[type="email"]', env.CRM_EMAIL); await pg.fill('input[type="password"]', env.CRM_PASSWORD); await pg.click('button[type="submit"]');
await pg.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(()=>{});
const creados = { registros: [], turnos: [], citas: [] };
try {
  const ed0 = await pg.evaluate(async (id) => (await fetch('/api/crm/eventos/edicion?id=' + id)).json(), ED);
  const yo = ed0.equipo?.[0];
  if (!ed0.edicion.horario_stand) await pg.evaluate(async (b) => (await fetch('/api/crm/eventos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json(), { accion: 'guardar_edicion', edicion_id: ED, horario_stand: { desde: '10:00', hasta: '18:00', duracion: 30, cupo: 2 } }).then(r => console.log('horario:', JSON.stringify(r).slice(0, 80)));
  for (const [i, r] of [
    { nombre: 'QA Prueba Caliente', empresa: 'Joyería QA Uno', whatsapp: '5511111101', temperatura: 'caliente', quiere_demo: true, giro: 'joyeria' },
    { nombre: 'QA Prueba Tibio', empresa: 'Boutique QA Dos', whatsapp: '5511111102', temperatura: 'tibio', giro: 'boutique' },
    { nombre: 'QA Prueba Frio', empresa: 'QA Tres', whatsapp: '5511111103', temperatura: 'frio' },
  ].entries()) {
    const j = await api({ accion: 'registro', edicion_id: ED, consentimiento: true, ...r }); console.log('registro', i, JSON.stringify(j).slice(0, 120)); if (j.id) creados.registros.push(j.id);
  }
  if (creados.registros[1]) await api({ accion: 'contactado', registro_id: creados.registros[1] });
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  if (yo) { const t = await api({ accion: 'turno', edicion_id: ED, usuario_id: yo.id, dia: '2026-10-13', desde: '10:00', hasta: '14:00' }); console.log('turno', JSON.stringify(t).slice(0, 120)); if (t.id) creados.turnos.push(t.id); }
  const tok = ed0.edicion.token_publico;
  // cita pública
  const c = await pg.evaluate(async ({ tok }) => (await fetch('/api/eventos/cita', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, dia: '2026-10-13', hora: '11:00', nombre: 'QA Prueba Cita', empresa: 'Joyería QA Cita', whatsapp: '5511111104', giro: 'joyeria', sitio_web: '' }) })).json(), { tok });
  console.log('cita pública:', JSON.stringify(c).slice(0, 160));
  await pg.goto(`${BASE}/admin/crm?tab=eventos&edicion=${ED}&vista=seguimiento`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(2200); await shot('4-seguimiento');
  const sh = pg.locator('.crm-sheet').last();
  await sh.getByRole('button', { name: /^Agendar demo/ }).first().click().catch(() => console.log('sin botón agendar demo')); await pg.waitForTimeout(1000); await shot('4b-agendar-demo'); await pg.locator('.crm-sheet').last().getByRole('button', { name: /Cerrar|Atrás/ }).first().click(); await pg.waitForTimeout(600);
  await sh.getByRole('button', { name: /^Citas/ }).first().click(); await pg.waitForTimeout(1800); await shot('5-citas');
  const dia = sh.locator('button', { hasText: /13/ }).first(); if (await dia.count()) { await dia.click(); await pg.waitForTimeout(1500); await shot('5a-citas-dia'); }
  await sh.getByRole('button', { name: /^Turnos/ }).first().click(); await pg.waitForTimeout(1500); await shot('6-turnos');
  await sh.getByRole('button', { name: /^A quién buscar/ }).first().click(); await pg.waitForTimeout(1500);
  const ruta = sh.getByRole('button', { name: /^Ruta/ }).first(); if (await ruta.count()) { await ruta.click(); await pg.waitForTimeout(1200); await shot('7b-ruta'); }
  await sh.getByRole('button', { name: /^Registros/ }).first().click(); await pg.waitForTimeout(1200); await shot('4c-registros');
  const stand = sh.getByRole('button', { name: 'Modo stand' }).first(); if (await stand.count()) { await stand.click(); await pg.waitForTimeout(1200); await shot('8-stand-gafete'); }
  if (tok) { await pg.goto(`${BASE}/e/${tok}/cita`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1500); await shot('9-cita-publica');
    const hora = pg.locator('#horas button:not([disabled])').first(); if (await hora.count()) { await hora.click(); await pg.waitForTimeout(500); await shot('9b-cita-hora'); } }
  const feed = await pg.evaluate(async () => { const j = await (await fetch('/api/crm/eventos/ical')).json(); return (await (await fetch(j.url)).text()).split('BEGIN:VEVENT')[1]?.slice(0, 500); });
  console.log('ical primer evento:', feed);
} finally {
  await pg.goto(`${BASE}/admin/crm?tab=eventos`, { waitUntil: 'networkidle' }).catch(() => {});
  const ed1 = await pg.evaluate(async (id) => (await fetch('/api/crm/eventos/edicion?id=' + id)).json(), ED);
  for (const c of ed1.citas || []) if (c.nombre?.startsWith('QA Prueba')) { await api({ accion: 'cita_estado', cita_id: c.id, estado: 'cancelada' }); }
  for (const r of ed1.registros || []) if (r.nombre?.startsWith('QA Prueba')) await api({ accion: 'borrar_registro', id: r.id });
  for (const t of ed1.turnos || []) await api({ accion: 'borrar_turno', id: t.id });
  console.log('limpieza: registros', (ed1.registros || []).filter(r => r.nombre?.startsWith('QA Prueba')).length, 'citas', (ed1.citas || []).filter(c => c.nombre?.startsWith('QA Prueba')).length, 'turnos', (ed1.turnos || []).length);
}
console.log('errores JS:', errs.length ? errs : 'ninguno');
await nav.close();
