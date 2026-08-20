/**
 * Pruebas de la lógica pura del correo.
 *
 * Cada caso de aquí corresponde a un bug REAL que llegó a producción y que se
 * encontró a mano o con datos. La prueba no está para documentar la función:
 * está para que ese bug no vuelva.
 *
 * Correr:  node --experimental-strip-types src/lib/email/puro.test.ts
 */
import { calza, diaCdmx, ventanaDeLectura, clasificarOrigen, escalonCalentamiento, RUTA_INTERNA } from './puro.ts';

let ok = 0;
const fallas: string[] = [];
function es(actual: unknown, esperado: unknown, que: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(esperado);
  if (a === e) { ok++; return; }
  fallas.push(`${que}\n    esperaba ${e}\n    obtuvo   ${a}`);
}

// ── calza ────────────────────────────────────────────────────────────────
// BUG REAL: una regla sobre la portada no disparaba nunca. `/` perdía la
// diagonal, quedaba en '' y el guard de "patrón vacío" la descartaba.
es(calza('/', '/'), true, 'la portada calza consigo misma');
es(calza('/?utm_source=tiktok', '/'), true, 'la portada calza con parámetros de campaña');
es(calza('/planes', '/'), false, 'la portada NO calza con cualquier otra página');
es(calza('/planes', ''), false, 'un patrón vacío no calza con nada');
es(calza('/planes', '   '), false, 'un patrón de puros espacios tampoco');

es(calza('/planes', '/planes'), true, 'ruta exacta');
es(calza('/planes/', '/planes'), true, 'la diagonal final no cambia nada');
es(calza('/planes?x=1', '/planes'), true, 'los parámetros no estorban');
es(calza('/planes/anual', '/planes'), true, 'una subruta calza con su padre');
es(calza('/planesXL', '/planes'), false, 'pero no un prefijo pegado');
es(calza('/PLANES', '/planes'), true, 'no distingue mayúsculas');
es(calza('/blog/lo-que-sea', '/blog/*'), true, 'el comodín');

// BUG REAL: las rutas del panel disparaban reglas con nuestras propias sesiones.
es(calza('/admin/crm', '/admin/crm'), false, 'el panel nunca calza');
es(calza('/api/tracking/identify', '/api/*'), false, 'las APIs tampoco');
es(calza('/email/baja', '/email/baja'), false, 'ni el pie de un correo');
es(RUTA_INTERNA.test('/planes'), false, 'una página pública no es interna');

// ── diaCdmx ──────────────────────────────────────────────────────────────
// BUG REAL: el "un correo por persona al día" se apagaba solo de 18:00 a 24:00
// CDMX, porque el lector usaba UTC y la columna `dia` usa America/Mexico_City.
{
  // 20 de agosto de 2026, 23:30 CDMX = 21 de agosto 05:30 UTC.
  const nocheEnMexico = new Date('2026-08-21T05:30:00Z');
  es(diaCdmx(nocheEnMexico), '2026-08-20', 'a las 23:30 de México sigue siendo el día 20');
  es(nocheEnMexico.toISOString().slice(0, 10), '2026-08-21', '…mientras que en UTC ya es 21 (el bug)');
  es(diaCdmx(new Date('2026-08-20T12:00:00Z')), '2026-08-20', 'al mediodía UTC coinciden');
}

// ── ventanaDeLectura ─────────────────────────────────────────────────────
// BUG REAL: `ausencia` era imposible de cumplir. Se leían N días de visitas y
// luego se exigía que la última tuviera N días de antigüedad.
es(ventanaDeLectura('ausencia', 2) > 2, true, 'ausencia lee MÁS allá de su umbral');
es(ventanaDeLectura('ausencia', 2), 15, 'ausencia con umbral 2 lee 15 días');
es(ventanaDeLectura('ausencia', 90), 120, 'la ventana tiene tope de 120 días');
es(ventanaDeLectura('pagina', 7), 7, 'las demás reglas leen exactamente su ventana');
es(ventanaDeLectura('secuencia', 30), 30, 'incluidas las de recorrido');

// ── clasificarOrigen ─────────────────────────────────────────────────────
// BUG REAL: TODO el tráfico pagado se marcaba "directo". Los utm/ttclid viajan
// en la URL de la página, no en el referrer.
es(clasificarOrigen({ ruta: '/?utm_source=tiktok&utm_medium=cpc' }), 'anuncio', 'utm en la URL = anuncio');
es(clasificarOrigen({ ruta: '/campana/pos?ttclid=E_C_P_xyz' }), 'anuncio', 'ttclid de TikTok = anuncio');
es(clasificarOrigen({ ruta: '/planes?gclid=abc' }), 'anuncio', 'gclid de Google = anuncio');
es(clasificarOrigen({ ruta: '/planes', referrer: 'https://l.facebook.com/?utm_source=x' }), 'anuncio', 'o en el referrer, si ahí viene');
es(clasificarOrigen({ ruta: '/planes', sendId: 'abc' }), 'email', 'un clic de correo gana sobre todo');
es(clasificarOrigen({ ruta: '/planes' }), 'directo', 'sin referrer ni marcas: directo');
es(clasificarOrigen({ ruta: '/planes', referrer: 'https://www.google.com/' }), 'buscador', 'búsqueda orgánica');
es(clasificarOrigen({ ruta: '/planes', referrer: 'https://www.tiktok.com/@x' }), 'social', 'social orgánico');
es(clasificarOrigen({ ruta: '/planes', referrer: 'https://blogdeotro.mx/post' }), 'referido', 'un enlace de otro sitio');
// Trampa: 'utm_' dentro de la RUTA sin ser parámetro no debe contar.
es(clasificarOrigen({ ruta: '/blog/que-es-utm_source' }), 'directo', 'utm_ en el texto de la ruta no es un anuncio');

// ── escalonCalentamiento ─────────────────────────────────────────────────
{
  const t = (iso: string) => Date.parse(iso);
  es(escalonCalentamiento(null, 5000), null, 'sin fecha de arranque no hay rampa');
  es(escalonCalentamiento('2026-08-20', 5000, t('2026-08-20T10:00:00Z')), 50, 'día 0: 50 correos');
  es(escalonCalentamiento('2026-08-20', 5000, t('2026-08-21T10:00:00Z')), 50, 'día 1: sigue en 50');
  es(escalonCalentamiento('2026-08-20', 5000, t('2026-08-22T10:00:00Z')), 100, 'día 2: dobla');
  es(escalonCalentamiento('2026-08-20', 5000, t('2026-08-24T10:00:00Z')), 200, 'día 4: dobla otra vez');
  es(escalonCalentamiento('2026-08-20', 5000, t('2026-09-08T10:00:00Z')), null, 'al pasar el límite, la rampa termina');
  es(escalonCalentamiento('2026-08-20', 80, t('2026-08-22T10:00:00Z')), null, 'un límite bajo la termina antes');
  // Una fecha futura no puede abrir la llave de par en par.
  es(escalonCalentamiento('2026-12-01', 5000, t('2026-08-20T10:00:00Z')), 50, 'fecha futura: lo mínimo, no lo máximo');
}

console.log(`\n  ${ok} casos pasaron`);
if (fallas.length) {
  console.error(`  ${fallas.length} FALLARON:\n`);
  for (const f of fallas) console.error('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log('  todo bien\n');
