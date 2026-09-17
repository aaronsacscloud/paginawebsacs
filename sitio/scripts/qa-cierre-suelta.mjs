/**
 * QA del CIERRE CON IA de una llamada suelta (entrante), con la IA de verdad.
 *
 * Escribe una llamada entrante con su transcripción —una conversación real de
 * venta: dice cuántas tiendas tiene, da su correo, pide que le manden info y
 * queda de verse— y corre el MISMO cierre que usan las llamadas de la lista:
 *   proponerCierre → (opcional) aplicarCierre
 *
 * Con `--aplicar` ejecuta de verdad (crea reunión, datos y envíos) y luego
 * borra lo que creó. Sin bandera sólo enseña lo que la IA propone, que es lo
 * que se quiere revisar la primera vez.
 *
 *   node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *     scripts/qa-cierre-suelta.mjs [--aplicar]
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const SID = 'CA' + 'cd34ab12'.repeat(4);
const USER = process.argv.includes('--usuario') ? process.argv[process.argv.indexOf('--usuario') + 1] : null;

const { data: conv } = await db.from('wa_conversaciones').select('id, telefono, contact_id')
  .eq('contact_id', '7ad08ae4-c329-4def-9573-30ca25a73e97').limit(1).maybeSingle();
if (!conv) { console.error('No está la conversación de «Prueba Aaron»'); process.exit(1); }

const limpiar = async () => {
  const { data: it } = await db.from('tel_sesion_items').select('id').eq('call_sid', SID).maybeSingle();
  if (it) {
    const { data: envios } = await db.from('tel_envios').select('id').eq('item_id', it.id);
    for (const e of envios || []) await db.from('ti_tareas').delete().contains('payload', { envio_id: e.id });
    await db.from('tel_envios').delete().eq('item_id', it.id);
    await db.from('wa_notas').delete().contains('metadata', { sesion_item: it.id });
    await db.from('tel_sesion_items').delete().eq('id', it.id);
  }
  /* Las tareas que dejaron las acciones y los envíos fallidos: si no se
     borran, cada corrida del QA deja basura en Mi día de alguien. */
  await db.from('ti_tareas').delete().like('payload->>instruccion', 'Prueba:%');
  await db.from('ti_tareas').delete().like('payload->>instruccion', '%Prueba Aaron%');
  await db.from('tel_acciones').delete().eq('call_sid', SID);
  await db.from('wa_llamadas').delete().eq('call_id', SID);
};
await limpiar();

/* La conversación: lo que de verdad se dice en una llamada de venta de moda.
   Trae las cuatro cosas que el cierre tiene que sacar — cuántas tiendas, el
   correo, lo que se prometió mandar y la cita. */
const oido = [
  { t: 800, texto: 'Bueno, buenas tardes.', final: true, quien: 'contacto' },
  { t: 3000, texto: 'Qué tal, buenas tardes, le hablo de Sacs, el sistema para tiendas de moda. ¿Hablo con el dueño?', final: true, quien: 'vendedor' },
  { t: 9000, texto: 'Sí, sí, yo soy. Dígame.', final: true, quien: 'contacto' },
  { t: 13000, texto: '¿Ustedes cuántas tiendas manejan?', final: true, quien: 'vendedor' },
  { t: 17000, texto: 'Tenemos tres tiendas, dos aquí en León y una en Guanajuato, y también vendemos por Instagram.', final: true, quien: 'contacto' },
  { t: 26000, texto: '¿Y cómo llevan hoy el inventario entre las tres?', final: true, quien: 'vendedor' },
  { t: 31000, texto: 'Pues ahorita todo en Excel, y la verdad ya no nos da. Cuando una clienta pide una talla tenemos que hablarle a la otra tienda.', final: true, quien: 'contacto' },
  { t: 44000, texto: 'Eso es exactamente lo que resuelve el sistema: una sola matriz de tallas y colores para las tres, con traspasos.', final: true, quien: 'vendedor' },
  { t: 52000, texto: 'Mándame la información por WhatsApp para verla con calma.', final: true, quien: 'contacto' },
  { t: 58000, texto: 'Claro que sí, se la mando ahorita mismo. ¿Le parece si le enseño el sistema con sus propios productos en una demo de quince minutos?', final: true, quien: 'vendedor' },
  { t: 68000, texto: 'Va, pero márcame el jueves a las cuatro de la tarde, hoy ando en la tienda.', final: true, quien: 'contacto' },
  { t: 76000, texto: 'Perfecto, el jueves a las cuatro. ¿Me confirma su correo para mandarle la invitación?', final: true, quien: 'vendedor' },
  { t: 84000, texto: 'Sí, es contacto arroba boutiquelamoda punto com.', final: true, quien: 'contacto' },
  { t: 90000, texto: 'Quedamos entonces. Le llega la confirmación por WhatsApp. Gracias.', final: true, quien: 'vendedor' },
];

await db.from('wa_llamadas').insert({
  call_id: SID, canal: 'telefono', conversation_id: conv.id, telefono: conv.telefono,
  direccion: 'entrante', estado: 'aceptada', answered_at: new Date().toISOString(),
  atendida_por: USER, payload: { qa: true },
});

const { itemDeLlamada, cerrarLlamadaSuelta } = await import('../src/lib/telefonia/suelta.ts');
const it = await itemDeLlamada(SID, { userId: USER, nombreUsuario: 'QA' });
if (!it) { console.error('no se creó el item'); process.exit(1); }
await db.from('tel_sesion_items').update({ oido }).eq('id', it.id);
await cerrarLlamadaSuelta(SID, { userId: USER, resultado: null, nota: 'QA: llamada de prueba del cierre' });

/* Con `--ya-mandado` se finge que durante la llamada ya salió el PDF de la
   información (que es lo que hace `acciones.ts` en cuanto el cliente lo pide).
   El cierre lee la misma transcripción y NO debe mandarlo otra vez: el cliente
   recibiría dos veces el mismo PDF. */
if (process.argv.includes('--ya-mandado')) {
  await db.from('tel_acciones').insert({
    call_sid: SID, item_id: it.id, contact_id: conv.contact_id, conversation_id: conv.id,
    telefono: conv.telefono, accion: 'mandar_info', params: { tema: 'la información de Sacs' },
    frase: 'mándame la información por whatsapp', origen: 'regla', estado: 'hecha',
    resultado: 'la información de Sacs: se mandó por WhatsApp',
  });
  console.log('(se finge que el PDF ya salió durante la llamada)');
}

console.log('\n── La IA lee la llamada ──────────────────────────────────');
const t0 = Date.now();
const { proponerCierre, aplicarCierre } = await import('../src/lib/telefonia/cierre.ts');
const p = await proponerCierre(it.id);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (!p) {
  const { data } = await db.from('tel_sesion_items').select('cierre_estado, cierre_ia').eq('id', it.id).maybeSingle();
  console.log('SIN PROPUESTA:', data?.cierre_estado, JSON.stringify(data?.cierre_ia));
} else {
  console.log(JSON.stringify(p, null, 1));
  const tiene = (q, ok) => console.log(`  ${ok ? '✓' : '✗'} ${q}`);
  tiene('saca el compromiso del jueves a las 4', (p.compromisos || []).some(c => c.hora === '16:00'));
  tiene('apunta que hay que mandarle la información', (p.envios || []).length > 0);
  tiene('se queda con los datos que dijo (tiendas / correo)', (p.datos || []).length > 0);
  tiene('el resultado no es «no interesa»', p.resultado !== 'no_interesa');
}

if (process.argv.includes('--aplicar') && p) {
  console.log('\n── Se aplica ─────────────────────────────────────────────');
  /* El cierre ESCRIBE en la ficha (correo, ciudad, etapa…). Es un contacto de
     pruebas, pero se guarda una foto antes y se restaura después: una prueba
     que deja el dato del dueño cambiado es una prueba que no se vuelve a
     correr. */
  const { data: antes } = await db.from('contacts').select('*').eq('id', conv.contact_id).maybeSingle();
  const r = await aplicarCierre(it.id, { userId: USER, autor: 'QA' });
  console.log(r.ok ? '✓ aplicado' : '✗ falló', r.hecho);
  if (process.argv.includes('--ya-mandado')) {
    const dosVeces = (r.hecho || []).some(h => /se mandó por WhatsApp|se mandó con plantilla/.test(h));
    const loDijo = (r.hecho || []).some(h => /ya se le había mandado durante la llamada/.test(h));
    console.log(`  ${!dosVeces && loDijo ? '✓' : '✗'} no le manda dos veces lo mismo, y lo dice`);
  }
  const { data: bk } = await db.from('bookings').select('id, fecha, hora_inicio, asunto, estado').eq('contact_id', conv.contact_id).order('created_at', { ascending: false }).limit(2);
  console.log('reuniones creadas:', bk);
  for (const b of bk || []) if (String(b.asunto || '').includes('Prueba')) await db.from('bookings').delete().eq('id', b.id);
  if (antes) {
    const { id, created_at, ...campos } = antes;
    await db.from('contacts').update(campos).eq('id', id);
    await db.from('activities').delete().eq('contact_id', id).contains('metadata', { regla: 'cierre_llamada' });
    console.log('✓ la ficha del contacto de pruebas quedó como estaba');
  }
}

if (!process.argv.includes('--dejar')) { await limpiar(); console.log('\n✓ base limpia'); }
