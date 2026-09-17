/**
 * QA de la CABINA parada en «te toca decidir», sin marcarle a nadie.
 * Se fabrica una sesión con un item en estado `cierre` y veredicto persona
 * —exactamente lo que queda cuando cuelgas tras hablar con alguien— y se mira
 * que la pantalla: (1) diga que la lista te espera, (2) enseñe lo que la IA
 * propone sin haberlo ejecutado, y (3) traiga el panel de acciones ejecutable.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raiz = '/opt/sacs/paginawebsacs';
const env = Object.fromEntries(readFileSync(`${raiz}/sitio/.env`, 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const base = `http://localhost:${process.argv.includes('--puerto') ? process.argv[process.argv.indexOf('--puerto') + 1] : '4321'}`;
const SID = 'CA' + 'dece0000'.repeat(4);
const USER = '60be8bd8-995a-45ca-926f-1bcb159d3c1e';

const { data: conv } = await db.from('wa_conversaciones').select('id, telefono, contact_id').eq('contact_id', '7ad08ae4-c329-4def-9573-30ca25a73e97').limit(1).maybeSingle();

const limpiar = async () => {
  const { data: ses } = await db.from('tel_sesiones').select('id').eq('nombre', 'QA decisión').limit(5);
  for (const s of ses || []) {
    await db.from('tel_sesion_items').delete().eq('sesion_id', s.id);
    await db.from('tel_sesiones').delete().eq('id', s.id);
  }
  await db.from('tel_acciones').delete().eq('call_sid', SID);
  await db.from('wa_llamadas').delete().eq('call_id', SID);
};
await limpiar();

const { data: ses } = await db.from('tel_sesiones').insert({
  owner_id: USER, nombre: 'QA decisión', estado: 'activa', modo: 'manual', total: 2,
  presentacion_nombre: 'QA', iniciada_at: new Date().toISOString(), agente_en_sala: true,
  config: { auto_continuar: true, wrapup_seg: 8 },
}).select('id').maybeSingle();

const propuesta = {
  resultado: 'volver_llamar',
  nota: 'Pidió que le marquen más tarde: está atendiendo la tienda. Tiene tres sucursales y lleva el inventario en Excel.',
  siguiente_paso: 'Llamarle hoy a las 18:00',
  compromisos: [{ tipo: 'llamada', fecha: new Date(Date.now() + 86400e3).toISOString().slice(0, 10), hora: '18:00', motivo: 'lo pidió en la llamada', reunion_tipo: 'llamada-discovery', confianza: 1 }],
  datos: [{ campo: 'sucursales', valor: '3', confianza: 1, evidencia: 'tenemos tres tiendas' }],
  envios: [], etapa: null, no_llamar: false,
};
const { data: it } = await db.from('tel_sesion_items').insert({
  sesion_id: ses.id, contact_id: conv.contact_id, conversation_id: conv.id, telefono: conv.telefono,
  nombre: 'Prueba Aaron', empresa: 'Boutique de prueba', orden: 0, estado: 'cierre', intentos: 1,
  call_sid: SID, veredicto: 'persona', veredicto_fuente: 'reglas', duracion_seg: 96,
  marcado_at: new Date(Date.now() - 200000).toISOString(), contestado_at: new Date(Date.now() - 190000).toISOString(),
  en_linea_at: new Date(Date.now() - 185000).toISOString(), terminado_at: new Date(Date.now() - 60000).toISOString(),
  oido: [{ t: 5000, texto: 'Ahorita ando en la tienda, márcame más tarde por favor.', final: true, quien: 'contacto' }],
  cierre_estado: 'propuesto', cierre_ia: { propuesta, generado_at: new Date().toISOString() },
}).select('id').maybeSingle();
await db.from('tel_sesiones').update({ item_actual: it.id }).eq('id', ses.id);
await db.from('wa_llamadas').insert({ call_id: SID, canal: 'telefono', conversation_id: conv.id, telefono: conv.telefono, direccion: 'saliente', estado: 'terminada', atendida_por: USER, duracion_seg: 96, payload: { qa: true } });
await db.from('tel_acciones').insert({
  call_sid: SID, item_id: it.id, contact_id: conv.contact_id, conversation_id: conv.id, telefono: conv.telefono,
  accion: 'volver_a_llamar', params: { fecha: new Date(Date.now() + 86400e3).toISOString().slice(0, 10), hora: '18:00' },
  frase: 'márcame más tarde por favor', origen: 'regla', estado: 'propuesta', user_id: USER,
});

const nav = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone'] });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', e => errores.push(e.message));
p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`);
try {
  await p.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  await p.goto(`${base}/admin/crm?tab=llamadas`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(6000);
  // La cabina se abre desde la lista de sesiones: se entra por la de la prueba.
  // Se entra por el botón «Seguir» de esa jornada, que es como se abre.
  const fila = p.locator('div', { hasText: /^QA decisión/ }).last();
  await (await fila.getByRole('button', { name: /Seguir|Ver/ }).count()
    ? fila.getByRole('button', { name: /Seguir|Ver/ }).first()
    : p.getByRole('button', { name: /Seguir/ }).first()).click({ timeout: 20000 });
  await p.waitForTimeout(7000);
  const txt = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
  if (process.argv.includes('--ver')) console.log('\nPANTALLA:', txt.slice(0, 1200), '\n');
  paso('Dice que la lista te espera', /la lista se queda aquí hasta que tú decidas/i.test(txt), '');
  paso('Dice que la IA NO ha hecho nada', /no ha hecho nada todavía/i.test(txt), '');
  paso('Enseña lo que propone', /Pidió que le marquen más tarde/i.test(txt), '');
  paso('Trae el panel de acciones', /Te pidió algo/i.test(txt) && /Volver a llamarle/i.test(txt), '');
  paso('El botón confirma antes de ejecutar', /Confirmar lo de la IA y seguir/i.test(txt), '');
  paso('Salidas en un clic (1 h, mañana, el lunes)', /Llamarle en 1 h/.test(txt) && /Mañana 10:00/.test(txt) && /El lunes/.test(txt), '');
  paso('Día y hora exactos para la llamada de vuelta', /Agendar esa llamada/.test(txt), '');
  paso('Se puede leer lo que se dijo', /Ver lo que se dijo/.test(txt), '');
  paso('Se puede oír la llamada', /Oír la llamada/.test(txt), '');
  paso('La propuesta se corrige (quitar)', /Quitar/.test(txt), '');
  paso('Se puede descartar la propuesta entera', /No fue eso: descartar/.test(txt), '');
  paso('Dice quién sigue', /SIGUE/.test(txt), '');
  paso('Dice los atajos de teclado', /1-5 cómo quedó/.test(txt), '');
  await p.screenshot({ path: '/tmp/qa-cabina-decision.png', fullPage: true });
  console.log(errores.length ? `\n  ⚠ ${errores.length} error(es): ${errores.slice(0, 3).join(' | ')}` : '\n  ✓ sin errores de JS');
} finally {
  await nav.close();
  if (!process.argv.includes('--dejar')) { await limpiar(); console.log('  ✓ base limpia'); }
}
