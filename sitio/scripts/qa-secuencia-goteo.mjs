/**
 * QA de «La secuencia» para un goteo permanente: la pantalla tiene que decir
 * que sale UN mensaje por vez y repartir las fechas, no enseñar 33 renglones
 * con la misma fecha de hoy.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4325';
const SEC = '739989ac-dd75-455c-8711-5bf76c741e18';          // Rezagados · top of mind
const CONV = 'b2e613e5-77db-4e14-86d6-2042c6f72c3e';
const CONTACTO = '9e5a9698-78eb-48a2-954e-447fdfac5502';

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1420, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});

// ── El dato, antes que la pantalla ──
const j = await (await p.request.get(`${BASE}/api/crm/secuencias/detalle?id=${SEC}&contacto=${CONTACTO}`)).json();
const pend = (j.pasos || []).filter(x => !x.enviado_at);
const fechas = [...new Set(pend.map(x => x.estimado).filter(Boolean))];
paso('Reconoce que es un goteo permanente', j.ritmo?.permanente === true, JSON.stringify(j.ritmo));
paso('Las fechas se reparten, no caen todas hoy', fechas.length > 5, `${fechas.length} fechas distintas para ${pend.length} pasos`);
paso('La primera fecha es la más cercana', fechas.slice().sort()[0] === (j.siguiente?.estimado || ''), `sigue el ${j.siguiente?.estimado} (${j.siguiente?.que?.slice(0, 40)})`);
paso('Cada paso con fecha trae su carril', pend.filter(x => x.estimado).every(x => x.dia_semana), `carriles ${JSON.stringify(j.ritmo?.carriles)}`);
paso('Los pasos que no pueden salir se marcan', pend.filter(x => x.sin_carril).length === j.ritmo?.muertos, `${j.ritmo?.muertos} muerto(s): ${pend.filter(x => x.sin_carril).map(x => x.que).join(', ')}`);
console.log(`     primeras fechas: ${fechas.slice().sort().slice(0, 6).join(' · ')}`);
console.log(`     última fecha: ${fechas.slice().sort().pop()}`);

// ── La pantalla ──
await p.goto(`${BASE}/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);
const link = p.locator('text=Ver qué manda y qué sigue').first();
paso('El hilo ofrece abrir la secuencia', (await link.count()) > 0);
await link.click();
await p.waitForTimeout(3500);
const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
paso('Dice que es un goteo, no una tanda', /Es un goteo, no una tanda/.test(t));
paso('Nombra los días del goteo', /lunes, miércoles y viernes/.test(t), t.match(/Sale un solo mensaje[^.]*\./)?.[0]?.slice(0, 160) || '');
paso('Los pasos se etiquetan por día de la semana, no «Día 1»', /Lun|Mié|Vie/.test(t) && !/Día 1 Correo/.test(t));
paso('Avisa de los pasos que nunca salen', /No va a salir: le falta el día de la semana/.test(t));
await p.screenshot({ path: '/tmp/qa-goteo.png' });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 3).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
