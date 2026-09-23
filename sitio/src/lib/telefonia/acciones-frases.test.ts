/**
 * Pruebas de las frases que piden una acción DENTRO de la llamada.
 *
 * Esto dispara WhatsApps a clientes reales y baja gente de las campañas, así
 * que tiene que tener prueba. Los casos están escritos como habla la gente en
 * México por teléfono —con la transcripción de Twilio comiéndose acentos y
 * signos—, no como se escribiría en un formulario.
 *
 * Lo que se cuida en las dos direcciones:
 *   · que CACE lo que sí es una petición («mándame la info por whatsapp»);
 *   · que NO cace lo que se le parece pero no lo es («no me mandes nada»,
 *     o el vendedor prometiendo «yo te mando la info»), porque un falso
 *     positivo aquí es un mensaje que el cliente no pidió.
 *
 * Correr:  node --experimental-strip-types src/lib/telefonia/acciones-frases.test.ts
 */
import { detectarCatalogo, interpretarCuando } from './acciones-frases.ts';

let ok = 0; const fallas: string[] = [];
const es = (a: unknown, e: unknown, q: string) => {
  if (JSON.stringify(a) === JSON.stringify(e)) { ok++; return; }
  fallas.push(`${q}\n    esperaba ${JSON.stringify(e)}\n    obtuvo   ${JSON.stringify(a)}`);
};
/** Los ids que caza una frase, en orden. */
const ids = (f: string) => detectarCatalogo(f).map(d => d.accion);
const caza = (f: string, id: string) => es(ids(f).includes(id), true, `«${f}» → ${id}`);
const noCaza = (f: string, id: string) => es(ids(f).includes(id), false, `«${f}» NO debe ser ${id}`);

// ══ 1 · «Mándame la info» — el caso que reportó el dueño ═══════════════════
// «¿De dónde?» / «yo no me registré»: 20 de 68 llamadas reales (22-sep-2026).
caza('de donde perdon', 'quien_soy');
caza('este no, yo no me registre', 'quien_soy');
caza('de parte de quien', 'quien_soy');
caza('no fijate que ya tenemos un sistema', 'mandar_cambio');
caza('nosotros usamos sicar desde hace anos', 'mandar_cambio');
caza('y como funciona', 'mandar_demo');
caza('cuanto tarda la implementacion', 'mandar_demo');
es(detectarCatalogo('pasame los precios')[0]?.accion, 'mandar_cotizacion', 'precios sigue siendo cotización');
caza('mandame la informacion por whatsapp', 'mandar_info');
caza('me puedes mandar la info', 'mandar_info');
caza('si, pasame la informacion', 'mandar_info');
caza('mandamelo por whatsapp por favor', 'mandar_info');
caza('tienes algo por escrito', 'mandar_info');

// ══ 2 · Cotización y precios, antes que la info genérica ══════════════════
caza('mandame la cotizacion', 'mandar_cotizacion');
caza('me puedes pasar el presupuesto', 'mandar_cotizacion');
caza('mandame los precios', 'mandar_cotizacion');

// ══ 3 · Material concreto ════════════════════════════════════════════════
caza('mandame el catalogo', 'mandar_material');
caza('me puedes mandar el video', 'mandar_material');
es(detectarCatalogo('mandame el catalogo')[0].params.tema, 'el catalogo', 'saca el tema de la frase');

// ══ 4 · Volver a llamar, con y sin fecha ═════════════════════════════════
caza('marcame el jueves', 'volver_a_llamar');
caza('llamame mas tarde', 'volver_a_llamar');
caza('me puedes marcar manana', 'volver_a_llamar');
caza('hablamos la proxima semana', 'volver_a_llamar');

// ══ 5 · Demo ═════════════════════════════════════════════════════════════
caza('agendame una demo', 'agendar_demo');
caza('quiero ver el sistema', 'agendar_demo');
caza('hagamos una reunion', 'agendar_demo');

// ══ 6 · No es buen momento ═══════════════════════════════════════════════
caza('estoy manejando', 'ahorita_no');
caza('ahorita no puedo', 'ahorita_no');
caza('marcame en un rato', 'ahorita_no');

// «Estoy manejando, márcame en un rato» es UNA petición, no dos tarjetas.
es(ids('ahorita estoy manejando, marcame en un rato'), ['ahorita_no'], 'sin día concreto gana «ahorita no»');
es(ids('ahorita no puedo, marcame el jueves').sort(), ['ahorita_no', 'volver_a_llamar'], 'con día concreto van las dos');

// ══ 7 · Ya es cliente: soporte, no venta ═════════════════════════════════
caza('ya soy cliente', 'soporte');
caza('tengo un problema con el sistema', 'soporte');
caza('no me funciona el sistema', 'soporte');

// ══ 8 · La decisión es de otro ═══════════════════════════════════════════
caza('hablalo con mi socio', 'otro_contacto');
caza('el que ve eso es mi hermano', 'otro_contacto');
caza('yo no decido', 'otro_contacto');

// ══ 9 · Corregir datos ═══════════════════════════════════════════════════
caza('mi correo es contacto arroba tienda punto com', 'corregir_dato');
caza('ese numero ya no existe', 'corregir_dato');
es(detectarCatalogo('mi correo es aaron@sacscloud.com').find(d => d.accion === 'corregir_dato')?.params.valor,
  'aaron@sacscloud.com', 'saca el correo cuando la transcripción lo deja bien');

// ══ 10 · No me llamen — la que NUNCA sale sola ═══════════════════════════
caza('no me vuelvan a llamar', 'no_llamar');
caza('quitame de tu lista', 'no_llamar');
caza('dejen de llamarme', 'no_llamar');
caza('no me llamen mas por favor', 'no_llamar');

// ══ LO QUE NO DEBE CAZAR ═════════════════════════════════════════════════
// Una negativa no es una petición de material.
noCaza('no me mandes nada', 'mandar_info');
noCaza('gracias pero no me interesa', 'mandar_info');
// Hablar de whatsapp no es pedir que le manden algo.
noCaza('te escribo por whatsapp cuando lo vea', 'mandar_info');
// Una llamada normal, sin petición, no dispara NADA.
es(ids('si bueno buenas tardes con quien tengo el gusto'), [], 'un saludo no pide nada');
es(ids('ah mira que interesante y cuantas tiendas manejan ustedes'), [], 'una plática no pide nada');
// Demasiado corto para juzgar: un parcial de la transcripción.
es(ids('manda'), [], 'un fragmento suelto no basta');

// ══ CUÁNDO · la fecha que se saca de lo que dijo ═════════════════════════
const jueves = new Date('2026-09-17T18:00:00Z');   // jueves 17-sep, 12:00 del centro
const c = (f: string) => interpretarCuando(f, 'America/Mexico_City', jueves);
es(c('marcame en una hora'), { fecha: '2026-09-17', hora: '13:00' }, 'en una hora');
es(c('marcame en diez minutos'), { fecha: '2026-09-17', hora: '12:10' }, 'en diez minutos');
es(c('marcame manana a las 10'), { fecha: '2026-09-18', hora: '10:00' }, 'mañana a las diez');
es(c('hablamos el lunes a las 4'), { fecha: '2026-09-21', hora: '16:00' }, 'el lunes a las 4 es de la tarde');
es(c('marcame el jueves'), { fecha: '2026-09-24', hora: '10:00' }, '«el jueves» dicho en jueves es el de la semana que entra');
es(c('la proxima semana'), { fecha: '2026-09-24', hora: '10:00' }, 'la próxima semana');
es(c('marcame mas tarde'), { fecha: '2026-09-17', hora: '14:00' }, 'más tarde son dos horas');
es(c('marcame manana temprano'), { fecha: '2026-09-18', hora: '09:00' }, 'mañana temprano');
es(c('a las 9 de la noche'), { fecha: '2026-09-17', hora: '21:00' }, 'las 9 de la noche de hoy');
es(c('a las 8'), { fecha: '2026-09-18', hora: '08:00' }, 'las 8 ya pasaron hoy: es mañana');
es(c('me marcas cuando puedas'), null, 'sin fecha ni hora no se inventa nada');
// La hora es la DEL CONTACTO: las 10 en Tijuana no son las 10 aquí.
es(interpretarCuando('manana a las 10', 'America/Tijuana', jueves), { fecha: '2026-09-18', hora: '10:00' }, 'mañana a las 10 en su zona');

if (fallas.length) {
  console.error(`\n❌ ${fallas.length} fallas de ${ok + fallas.length}:\n\n${fallas.join('\n\n')}\n`);
  process.exit(1);
}
console.log(`✅ ${ok} pruebas de las frases que piden una acción`);
