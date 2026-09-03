// QA del brief de proyecto: recorre el ciclo completo — firmar, contestar,
// enviar, y aprobar desde el lado de Sacs — contra el servidor de desarrollo.
//
//   node scripts/qa-proyecto-brief.mjs <token>
//
// Aprende de dos trampas ya pagadas: hay que traer el lienzo A LA VISTA antes
// de trazar (un mouse.move fuera del viewport no llega al elemento), y el
// login de Sacs se hace por API para reusar la cookie en el contexto.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const OUT = process.env.QA_OUT || '/tmp';
const BASE = process.env.QA_BASE || 'http://localhost:4321';
const RUTA = BASE + '/proyecto/' + process.argv[2];

const cred = Object.fromEntries(
  readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split('=').map((x) => x.trim().replace(/^["']|["']$/g, ''))),
);

const b = await chromium.launch();
const errs = [];
const vigilar = (p) => {
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
};

// ── Lado del cliente ──────────────────────────────────────────────────
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
vigilar(p);
await p.goto(RUTA, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.screenshot({ path: OUT + '/pb-1-portada.png' });

const yaFirmado = await p.locator('.pb-firmado').count();
if (!yaFirmado) {
  await p.locator('#firma').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  const box = await p.locator('#f-canvas').boundingBox();
  await p.mouse.move(box.x + 60, box.y + 100);
  await p.mouse.down();
  for (let i = 0; i < 26; i++) await p.mouse.move(box.x + 60 + i * 9, box.y + 100 - Math.sin(i / 2.2) * 32);
  await p.mouse.up();
  await p.fill('#f-puesto', 'Director general');
  await p.screenshot({ path: OUT + '/pb-2-firma.png' });
  await p.click('#f-firmar');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1200);
}

const firmado = await p.locator('.pb-firmado').count();
const etapas = await p.locator('.pb-et').count();
const abiertas = await p.locator('.pb-et[data-estado=abierta]').count();
const campos = await p.locator('.pb-et[data-abierta] .pb-campo').count();
const controlesEnCliente = await p.locator('.pb-rev').count();

await p.locator('#etapas').scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({ path: OUT + '/pb-3-etapas.png' });

// Autoguardado + validación de obligatorios
await p.fill('.pb-et[data-abierta] [data-v=redes]', 'instagram.com/rubensbridal');
await p.waitForTimeout(1600);
const guardado = await p.locator('#pb-guardado').isVisible().catch(() => false);
await p.click('.pb-et[data-abierta] [data-enviar]');
await p.waitForTimeout(1400);
const errTxt = (await p.locator('.pb-et[data-abierta] .pb-error').first().textContent().catch(() => '')) || '';
await p.screenshot({ path: OUT + '/pb-4-faltantes.png' });

// ── Lado de Sacs ──────────────────────────────────────────────────────
const admin = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const login = await admin.request.post(BASE + '/api/auth/login', {
  data: { email: cred.CRM_EMAIL, password: cred.CRM_PASSWORD },
});
const ap = await admin.newPage();
vigilar(ap);
await ap.goto(RUTA, { waitUntil: 'networkidle' });
await ap.waitForTimeout(1200);
const modoSacs = await ap.locator('.pb-modo-sacs').count();
await ap.locator('#etapas').scrollIntoViewIfNeeded();
await ap.waitForTimeout(400);
await ap.screenshot({ path: OUT + '/pb-7-sacs.png' });
const controlesEnSacs = await ap.locator('.pb-rev').count();

// ── Móvil ─────────────────────────────────────────────────────────────
const mp = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
vigilar(mp);
await mp.goto(RUTA, { waitUntil: 'networkidle' });
await mp.waitForTimeout(1200);
await mp.screenshot({ path: OUT + '/pb-5-movil.png' });
const desborde = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await mp.locator('#etapas').scrollIntoViewIfNeeded();
await mp.waitForTimeout(500);
await mp.screenshot({ path: OUT + '/pb-6-movil-etapas.png' });

console.log(JSON.stringify({
  firmado, etapas, abiertas, campos, guardado,
  errTxt: errTxt.slice(0, 200),
  controlesEnCliente, loginSacs: login.status(), modoSacs, controlesEnSacs,
  desborde, errs,
}, null, 1));
await b.close();
