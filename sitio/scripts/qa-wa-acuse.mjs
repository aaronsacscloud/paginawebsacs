/**
 * QA · EL ACUSE DEL WHATSAPP ENTRANTE
 *
 * Reproduce el caso real del 30 de agosto: el asesor escribiendo en la
 * conversación y el bot soltándole al lead «ya estamos fuera de horario, te
 * contesto a partir de las 9». Era domingo —y el horario es de lunes a
 * sábado—, así que técnicamente el bot tenía razón y aun así quedó mintiendo
 * delante del cliente: el asesor le contestó doce minutos después.
 *
 * Se observa `auto_bienvenida_at` / `auto_fuera_at`, que `mandarAuto` marca
 * ANTES de intentar el envío: así la prueba mide la DECISIÓN de contestar sin
 * depender de que Kapso responda. Y se corre con la llave de Kapso apagada
 * para que ningún caso pueda mandarle un WhatsApp a nadie.
 */
import { check, resumen, sb } from './qa-cadencias.mjs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// Candado: sin llave, `enviarTexto` truena en su primera línea y no sale a la red.
delete process.env.KAPSO_API_KEY;
delete process.env.PUBLIC_KAPSO_API_KEY;

const require = createRequire(import.meta.url);
const out = '/tmp/claude-1000/-opt-sacs/qa-wa-auto.cjs';
/* Un punto de entrada de una línea para sacar las DOS piezas del mismo bundle:
   la función que se prueba y el olvido del caché de configuración. Sin lo
   segundo, el caché de 60 s hace que el segundo bloque de casos corra con los
   ajustes del primero — y falla por el reloj, no por la lógica. */
await build({
  stdin: { contents: `export { alRecibirMensaje } from './src/lib/whatsapp/automatizacion';
                      export { olvidarConfigEntrante } from './src/lib/whatsapp/config-entrante';`,
           resolveDir: '.', loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent',
  define: { 'import.meta.env': 'process.env' },
});
const { alRecibirMensaje, olvidarConfigEntrante } = require(out);

const SEQ = (await sb.from('crm_secuencias').select('id, activa, entrada').eq('disparador', 'wa_entrante').single()).data;
const ORIG = { activa: SEQ.activa, entrada: SEQ.entrada };
const HORARIO_DOM = { dias: [1, 2, 3, 4, 5, 6], desde: '09:00', hasta: '19:00' };

async function configurar(silencioHoras) {
  await sb.from('crm_secuencias').update({
    activa: true,
    entrada: { ...ORIG.entrada, horario: HORARIO_DOM,
      acuse: { ...(ORIG.entrada.acuse || {}), activo: true, silencio_humano_horas: silencioHoras } },
  }).eq('id', SEQ.id);
}

const CONVS = [];
/** Una conversación con su historial. `humanoHaceMin` = null → nadie del equipo escribió. */
async function conversacion({ humanoHaceMin = null } = {}) {
  const id = randomUUID();
  await sb.from('wa_conversaciones').insert({
    id, telefono: '+521' + String(Date.now()).slice(-10), estado: 'abierta',
    ultimo_mensaje_at: new Date().toISOString(), no_leidos: 1,
  });
  CONVS.push(id);
  if (humanoHaceMin != null) {
    const { data: h } = await sb.from('team_members').select('id, nombre').limit(1).single();
    await sb.from('wa_mensajes').insert({
      conversation_id: id, direccion: 'saliente', tipo: 'text', cuerpo: 'Hola, soy tu asesor',
      autor_id: h.id, autor: h.nombre, kapso_message_id: 'qa-' + randomUUID(),
      created_at: new Date(Date.now() - humanoHaceMin * 60000).toISOString(),
    });
  }
  return id;
}
const marcas = async id => {
  const { data } = await sb.from('wa_conversaciones').select('auto_bienvenida_at, auto_fuera_at').eq('id', id).single();
  return [data.auto_bienvenida_at, data.auto_fuera_at].filter(Boolean).length;
};

// ── El caso de Erika, tal cual pasó ──
console.log('\n  ── El asesor ya está en la conversación ──');
await configurar(6); olvidarConfigEntrante();
{
  const c = await conversacion({ humanoHaceMin: 19 });   // escribió hace 19 min, como Aaron
  await alRecibirMensaje(c);
  check('con el asesor escribiendo hace 19 min, NO sale acuse', await marcas(c), 0);
}
{
  const c = await conversacion({ humanoHaceMin: 60 * 5 });   // 5 h: sigue dentro de la ventana de 6
  await alRecibirMensaje(c);
  check('a 5 h del último mensaje humano, sigue callado', await marcas(c), 0);
}
{
  const c = await conversacion({ humanoHaceMin: 60 * 20 });  // 20 h: ya pasó la ventana
  await alRecibirMensaje(c);
  check('a 20 h ya nadie está atendiendo: el acuse vuelve', await marcas(c), 1);
}
{
  const c = await conversacion();   // nadie del equipo ha escrito nunca
  await alRecibirMensaje(c);
  check('lead que abre en frío sí recibe acuse (contrafactual)', await marcas(c), 1);
}

console.log('\n  ── El candado se puede apagar ──');
await configurar(0); olvidarConfigEntrante();
{
  const c = await conversacion({ humanoHaceMin: 19 });
  await alRecibirMensaje(c);
  check('con 0 h vuelve el comportamiento viejo: el acuse sale igual', await marcas(c), 1);
}

console.log('\n  ── La automatización NO cuenta como humano ──');
await configurar(6); olvidarConfigEntrante();
{
  const c = await conversacion();
  await sb.from('wa_mensajes').insert({
    conversation_id: c, direccion: 'saliente', tipo: 'text', cuerpo: 'correo de cadencia',
    autor_id: null, autor: null, kapso_message_id: 'qa-' + randomUUID(),
  });
  await alRecibirMensaje(c);
  check('un saliente sin autor_id no silencia nada', await marcas(c), 1);
}

console.log('\n  limpiando…');
for (const id of CONVS) {
  await sb.from('wa_mensajes').delete().eq('conversation_id', id);
  await sb.from('wa_notas').delete().eq('conversation_id', id);
  await sb.from('wa_conversaciones').delete().eq('id', id);
}
await sb.from('crm_secuencias').update(ORIG).eq('id', SEQ.id);
process.exit(resumen() ? 0 : 1);
