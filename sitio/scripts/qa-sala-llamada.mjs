/**
 * QA VISUAL de la SALA DE LA LLAMADA, con la API y la base de verdad.
 *
 * Qué es falso y qué no: falso, sólo el SDK de Twilio (el mismo truco de
 * `qa-telefonia-estados.mjs`: se intercepta el módulo que sirve Vite y se
 * devuelve uno con la misma superficie). Todo lo demás es real — el
 * componente, `/api/crm/telefonia/sala`, el motor de acciones y la base.
 *
 * Para que la API tenga de dónde agarrarse, el guion escribe primero en
 * `wa_llamadas` la misma fila que escribiría el TwiML al entrar la llamada, y
 * le mete a la transcripción las frases que diría un cliente. Al terminar
 * borra todo lo que creó.
 *
 *   node scripts/qa-sala-llamada.mjs [--puerto 4321] [--dejar]
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const base = `http://localhost:${arg('puerto', '4321')}`;
const SID = 'CA' + 'ab12cd34'.repeat(4);

const env = Object.fromEntries(readFileSync(resolve(raiz, 'sitio/.env'), 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const login = Object.fromEntries(readFileSync(resolve(raiz, '.crm-login'), 'utf8').split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
// Las librerías del CRM leen `process.env` cuando corren fuera de Astro.
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// El contacto de pruebas del dueño y su conversación.
const { data: conv } = await db.from('wa_conversaciones').select('id, telefono, contact_id').eq('contact_id', '7ad08ae4-c329-4def-9573-30ca25a73e97').limit(1).maybeSingle();
if (!conv) { console.error('No está la conversación de «Prueba Aaron»'); process.exit(1); }

const SDK_FALSO = `
class Emisor { constructor(){ this._h={}; } on(e,f){ (this._h[e]=this._h[e]||[]).push(f); return this; } removeListener(){ return this; } emit(e,...a){ (this._h[e]||[]).slice().forEach(f=>f(...a)); } }
class Llamada extends Emisor {
  constructor(from){ super(); this.parameters={ CallSid:'${SID}', From: from||'' }; }
  mute(v){ this._mudo=v; } isMuted(){ return !!this._mudo; }
  disconnect(){ this.emit('disconnect'); } accept(){ this.emit('accept', this); } reject(){ this.emit('reject'); }
}
export class Device extends Emisor {
  constructor(){ super(); window.__dispositivo=this; }
  async register(){} destroy(){} updateToken(){}
  async connect({ params }){ const c=new Llamada(); c.destino=params.To; window.__llamada=c; return c; }
}
export const Call = Llamada;
export default { Device, Call: Llamada };
window.__LlamadaFalsa = Llamada;
`;

const limpiar = async () => {
  const { data: it } = await db.from('tel_sesion_items').select('id, contact_id').eq('call_sid', SID).maybeSingle();
  if (it) {
    await db.from('tel_envios').delete().eq('item_id', it.id);
    await db.from('tel_sesion_items').delete().eq('id', it.id);
  }
  await db.from('tel_acciones').delete().eq('call_sid', SID);
  await db.from('tel_accion_reglas').delete().eq('call_sid', SID);
  await db.from('wa_notas').delete().eq('metadata->>nota_llamada', SID);
  await db.from('wa_llamadas').delete().eq('call_id', SID);
  await db.from('tel_conocimiento').delete().ilike('texto', 'QA: así se factura%');
};
await limpiar();

// La fila que escribe el TwiML cuando entra una llamada.
await db.from('wa_llamadas').insert({
  call_id: SID, canal: 'telefono', conversation_id: conv.id, telefono: conv.telefono,
  direccion: 'entrante', estado: 'aceptada', answered_at: new Date().toISOString(), payload: { qa: true },
});

const nav = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await nav.newContext({ viewport: { width: 1360, height: 1000 }, permissions: ['microphone'] });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', e => errores.push(e.message));
p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
await p.route('**/*voice-sdk*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SDK_FALSO }));
await p.route('**/api/crm/telefonia/token*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'jwt.falso.qa', identity: 'crm-qa', numero: '+525593027234' }) }));

const paso = (n, ok, det = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${det ? ` — ${det}` : ''}`);
const sala = () => p.evaluate(() => {
  const d = document.querySelector('[aria-label="Llamada en curso"], [aria-label="Resumen de la llamada"]');
  return d ? d.innerText.trim().replace(/\n+/g, ' · ') : '(la sala no está abierta)';
});
const foto = async n => { await p.waitForTimeout(400); await p.screenshot({ path: `/tmp/qa-sala-${n}.png`, fullPage: true }); };

try {
  await p.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  await p.goto(`${base}/admin/crm?tab=whatsapp`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(7000);

  // ── Entra una llamada y se contesta ─────────────────────────────────────
  await p.evaluate(tel => {
    const c = new window.__LlamadaFalsa(tel);
    window.__llamada = c;                     // para poder colgar desde el otro lado
    window.__dispositivo.emit('incoming', c);
  }, conv.telefono);
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Contestar' }).click();
  await p.waitForTimeout(2500);
  let t = await sala();
  paso('La entrante abre la sala con la ficha', /Prueba Aaron/.test(t), t.slice(0, 70));
  await foto('1-viva');

  // ── Lo que el cliente pide, por el mismo camino que el webhook ──────────
  const { data: item } = await db.from('tel_sesion_items').select('id, contact_id, conversation_id, telefono, nombre').eq('call_sid', SID).maybeSingle();
  paso('La llamada suelta ya tiene item', !!item, item?.id || 'NO se creó');
  if (item) {
    const oido = [
      { t: 1000, texto: 'Sí, bueno, buenas tardes.', final: true, quien: 'contacto' },
      { t: 4000, texto: 'Qué tal, le hablo de Sacs.', final: true, quien: 'vendedor' },
      { t: 9000, texto: 'Oye, ¿y me puedes mandar la información por WhatsApp?', final: true, quien: 'contacto' },
      { t: 15000, texto: 'Y mejor márcame el jueves a las 4, ahorita ando en la tienda.', final: true, quien: 'contacto' },
    ];
    await db.from('tel_sesion_items').update({ oido }).eq('id', item.id);
    const { detectar, anotarYHacer } = await import('../src/lib/telefonia/acciones.ts');
    const c = { callSid: SID, itemId: item.id, contactId: item.contact_id, conversationId: item.conversation_id, telefono: item.telefono, nombre: item.nombre, userId: null };
    for (const o of oido.filter(x => x.quien === 'contacto')) {
      const d = await detectar(o.texto);
      if (d.length) await anotarYHacer(c, d);
    }
  }
  /* Se ESPERA a que el pulso de la sala (cada 3 s) traiga las acciones, en vez
     de dormir un rato fijo: con un `waitForTimeout` la prueba pasaba o fallaba
     según lo que tardara la red de ese momento. */
  await p.waitForFunction(() => {
    const d = document.querySelector('[aria-label="Llamada en curso"]');
    return !!d && /Volver a llamarle/.test(d.innerText);
  }, null, { timeout: 20000 }).catch(() => {});
  t = await sala();
  paso('Se pinta lo que se está oyendo', /me puedes mandar la informacion|información por WhatsApp/i.test(t), '');
  paso('Aparece «te pidió algo» con la acción', /Mandarle la información por WhatsApp/.test(t), '');
  paso('Y la que necesita confirmación', /Volver a llamarle/.test(t), '');
  await foto('2-acciones');

  // ── Se dicta lo que no reconoció ────────────────────────────────────────
  await p.getByPlaceholder(/Dime qué había que hacer/).first().fill('mándale el manual de facturación');
  await p.getByRole('button', { name: /Hazlo y apréndelo/ }).click();
  await p.waitForTimeout(2500);
  t = await sala();
  paso('El dictado deja su acción en la pantalla', /manual de facturaci|se lo dictaste/i.test(t), '');
  await foto('3-dictado');

  /* ── «No sé qué mandarle»: se escribe una vez y queda para siempre ──────
     Es la mitad de aprender que más se usa: el envío sale ahora y el texto se
     guarda en la biblioteca. Aquí el envío NO puede salir (el servidor de
     desarrollo no tiene llave de Kapso), pero lo que se comprueba es lo otro:
     que lo escrito quede guardado. */
  const pendiente = p.getByPlaceholder(/Escribe lo que hay que mandarle/).first();
  await pendiente.fill('QA: así se factura en Sacs — se timbra desde la venta, con CFDI 4.0, y el PDF le llega al cliente por correo.');
  await p.getByRole('button', { name: /Mandarlo y guardarlo/ }).first().click();
  await p.waitForTimeout(3500);
  const { data: aprendido } = await db.from('tel_conocimiento').select('id, tema, texto').ilike('texto', 'QA: así se factura%').maybeSingle();
  paso('Lo que se escribe queda en la biblioteca', !!aprendido, aprendido?.tema || 'NO se guardó');

  // ── Se termina la llamada → la misma pantalla se vuelve el resumen ──────
  const enSala = p.getByLabel('Llamada en curso');
  if (process.argv.includes('--colgo-el')) {
    /* EL CASO NORMAL: cuelga el CLIENTE. Nadie tocó el botón, así que nadie
       dijo qué pasó — y antes eso dejaba la llamada abierta para siempre. */
    await p.evaluate(() => window.__llamada.disconnect());
    await p.waitForTimeout(2500);
    t = await sala();
    paso('Colgó él: la sala se queda y pide el desenlace', /colgó él|qué pasó/i.test(t), t.slice(0, 80));
    await foto('4-colgo-el');
    const resumenSala = p.getByLabel('Resumen de la llamada');
    await resumenSala.getByRole('button', { name: 'Le interesa', exact: true }).click();
    await resumenSala.getByRole('button', { name: 'Cerrar la llamada' }).click();
    await p.waitForTimeout(6000);
  } else {
    await enSala.getByRole('button', { name: 'Le interesa', exact: true }).click();
    await enSala.getByRole('button', { name: 'Colgar' }).click();
    await p.waitForTimeout(6000);
  }
  t = await sala();
  paso('La sala se queda como resumen al colgar', /cerrar la llamada|lo que se dijo/i.test(t), t.slice(0, 80));
  paso('Y dice la verdad sobre el cierre con IA', /saldo de IA|no pudo cerrarla|transcrita|Aplicar el cierre/.test(t), '');
  const { data: itemFin } = await db.from('tel_sesion_items').select('estado, resultado, cierre_estado').eq('call_sid', SID).maybeSingle();
  paso('El item quedó cerrado en la base', itemFin?.estado === 'hecho', JSON.stringify(itemFin));
  await foto('4-fin');

  const { data: acciones } = await db.from('tel_acciones').select('accion, estado, resultado').eq('call_sid', SID);
  console.log('\n  Acciones en la base:');
  for (const a of acciones || []) console.log(`   · ${a.accion} [${a.estado}] ${a.resultado || ''}`);

  console.log(errores.length ? `\n  ⚠ ${errores.length} error(es) de JS:\n     ${errores.slice(0, 5).join('\n     ')}` : '\n  ✓ sin errores de JS');
} finally {
  await nav.close();
  if (!process.argv.includes('--dejar')) { await limpiar(); console.log('  ✓ base limpia'); }
}
