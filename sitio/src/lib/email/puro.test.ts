/**
 * Pruebas de la lógica pura del correo.
 *
 * Cada caso de aquí corresponde a un bug REAL que llegó a producción y que se
 * encontró a mano o con datos. La prueba no está para documentar la función:
 * está para que ese bug no vuelva.
 *
 * Correr:  node --experimental-strip-types src/lib/email/puro.test.ts
 */
import { calza, diaCdmx, ventanaDeLectura, clasificarOrigen, escalonCalentamiento, cualesDetener, direccionRespuesta, esEstadoValido, SALIDA, ESTADOS_INSCRIPCION, RUTA_INTERNA } from './puro.ts';

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
  // Si la fecha llega como timestamp completo, concatenar la hora daba NaN —y
  // NaN se arrastraba hasta quitar el límite diario entero.
  es(escalonCalentamiento('2026-08-22T00:00:00.000Z', 5000, t('2026-08-24T10:00:00Z')), 100, 'acepta el timestamp completo (día 2 = 100)');
  es(Number.isFinite(Number(escalonCalentamiento('no-es-fecha', 5000, t('2026-08-24T10:00:00Z')))), true, 'una fecha ilegible nunca devuelve NaN');
  es(escalonCalentamiento('no-es-fecha', 5000, t('2026-08-24T10:00:00Z')), 50, 'fecha ilegible: lo más conservador');
}

// ── cualesDetener ────────────────────────────────────────────────────────
{
  const T1 = 'inquilino-1', T2 = 'inquilino-2';
  const insc = [
    { id: 'e1', automation_id: 'a1' },   // de T1, con interruptor puesto
    { id: 'e2', automation_id: 'a2' },   // de T1, con interruptor APAGADO
    { id: 'e3', automation_id: 'a3' },   // de OTRO inquilino
    { id: 'e4', automation_id: 'a9' },   // embudo que no aparece
  ];
  const emb = [
    { id: 'a1', parar_si_responde: true, tenant_id: T1 },
    { id: 'a2', parar_si_responde: false, tenant_id: T1 },
    { id: 'a3', parar_si_responde: true, tenant_id: T2 },
  ];

  es(cualesDetener(insc, emb, { tenantId: T1 }), ['e1', 'e4'],
     'respeta el interruptor y NO toca los embudos de otro inquilino');
  es(cualesDetener(insc, emb, { tenantId: T1, soloSiParar: false }), ['e1', 'e2', 'e4'],
     'una baja pedida a mano ignora el interruptor, pero sigue acotada al inquilino');
  es(cualesDetener(insc, emb, {}).includes('e3'), true,
     'sin inquilino no se filtra por inquilino');
  es(cualesDetener(insc, emb, { tenantId: T1 }).includes('e3'), false,
     'la respuesta de un partner no apaga los embudos de otro');
  es(cualesDetener(insc, emb, { tenantId: T1 }).includes('e4'), true,
     'ante un embudo desconocido, callarse: se detiene');
  es(cualesDetener([], emb, { tenantId: T1 }), [], 'sin recorridos activos, nada que hacer');
}

// ── direccionRespuesta ───────────────────────────────────────────────────
// BUG REAL, encontrado por el usuario al intentar responder: el Reply-To
// llevaba el token firmado completo (166 caracteres) y el RFC 5321 limita la
// parte local a 64. Hostinger rechazaba la dirección: el correo llegaba
// perfecto y no se podía contestar.
{
  const ID = 'f32cc0c7-bec2-474d-af36-e5050ab80df0';
  const dir = direccionRespuesta(ID, 'crm.sacscloud.com')!;
  es(dir, 'reply+f32cc0c7bec2474daf36e5050ab80df0@crm.sacscloud.com', 'el id del envío sin guiones');
  es(dir.split('@')[0].length <= 64, true, 'la parte local CABE en el límite del RFC 5321');
  es(dir.split('@')[0].length, 38, 'mide 38, contra los 172 de antes');
  es(direccionRespuesta(ID, ''), null, 'sin dominio configurado no hay dirección de respuesta');
  es(direccionRespuesta(ID, '  '), null, 'un dominio en blanco tampoco');

  // El token viejo, para que nadie lo reintroduzca sin que suene la alarma.
  const tokenViejo = 'eyJOljoiMjY5YTc3YzEtMjhhNS00NzQ4LThlYTEtOWFmNGRhOTQwY2RkIiwibSI6ImFhcm9uQHNhY3NjbG91ZC5jb20iLCJzIjoiZjMyY2MwYzctYmVjMi00NzRkLWFmMzn4J9YuTiUiuB2VFWlQgwM9OBdd3zdiauBQFU';
  let lanzo = false;
  try { direccionRespuesta(tokenViejo, 'crm.sacscloud.com'); } catch { lanzo = true; }
  es(lanzo, true, 'una parte local que no cabe LANZA en vez de mandar un correo mudo');
}

// ── estados de inscripción ───────────────────────────────────────────────
// BUG REAL, dos veces: se escribieron 'detenido' y 'cancelado', que la base
// nunca permitió. Postgrest NO lanza ante un CHECK violado —devuelve el error
// en `error`— y el código solo leía `data`: el sistema aseguraba haber sacado
// a alguien de un embudo y no sacaba a nadie, sin una sola línea de aviso.
// Se descubrió respondiendo un correo de verdad y viendo que nada se detuvo.
es(esEstadoValido(SALIDA), true, 'el estado de salida es uno que la base acepta');
es(esEstadoValido('detenido'), false, "'detenido' NO existe (bug de agosto 2026)");
es(esEstadoValido('cancelado'), false, "'cancelado' tampoco (el mismo bug, más viejo)");
es(esEstadoValido('activo'), true, "'activo' sí");
es(SALIDA, 'unenrolled', 'la salida es unenrolled');
es([...ESTADOS_INSCRIPCION].sort(),
   ['activo', 'completado', 'error', 'goal_achieved', 'pausado', 'unenrolled'],
   'el catálogo coincide con el CHECK de la base');

console.log(`\n  ${ok} casos pasaron`);
if (fallas.length) {
  console.error(`  ${fallas.length} FALLARON:\n`);
  for (const f of fallas) console.error('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log('  todo bien\n');
