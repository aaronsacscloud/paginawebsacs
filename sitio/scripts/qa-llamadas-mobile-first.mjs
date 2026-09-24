/**
 * QA MÓVIL PRIMERO DEL CENTRO DE LLAMADAS · con TODAS las APIs simuladas.
 *
 * Pedido del dueño (23-sep-2026): que todo el recorrido de Llamadas
 * inteligentes —armar la lista, la lista generada, la cabina marcando, en
 * llamada, el cierre con IA, el fin de la jornada y la llamada manual desde el
 * inbox— se vea bien en el teléfono y que cualquier botón se pueda apretar con
 * el pulgar. Para poder juzgar cada pantalla hay que VERLA en su estado, y esos
 * estados sólo existen en medio de una jornada de verdad: marcándole a gente.
 *
 * Así que aquí NADA toca el mundo real:
 *   · Todo POST/PATCH/PUT/DELETE del sitio se contesta con datos de mentiras
 *     (nunca llega al servidor). Los de Supabase directos se abortan.
 *   · Los GET de telefonía que deciden el estado de la cabina (marcador,
 *     sala, contexto, candidatos, tablero, token…) y el inbox se simulan.
 *   · El SDK de Twilio se cambia por uno falso con la misma superficie
 *     (Device/Call con on/emit), como en qa-telefonia-estados.mjs: el
 *     componente es el real y sus transiciones son las reales; lo único falso
 *     es el otro lado del cable.
 * El único request real que sale es el login (en su propio contexto, antes de
 * instalar nada) y los GET de páginas/assets de Astro.
 *
 *   node scripts/qa-llamadas-mobile-first.mjs <id|todas> [--ancho 390] [--escritorio] [--out DIR]
 *
 * Pantallas: armador, lista_generada, cabina_inicio, cabina_marcando,
 * cabina_en_llamada, cabina_cierre, cabina_fin, manual_sala.
 *
 * Por cada pantalla (y sub-estado) deja tres PNG en DIR:
 *   <id>[-sub].png          lo que se ve sin tocar (el viewport)
 *   <id>[-sub].full.png     página completa
 *   <id>[-sub].largo.png    con los contenedores con scroll interno desplegados
 *                           (las hojas y la cabina scrollean por dentro, así que
 *                           la «página completa» sola no enseña lo de abajo)
 * y un <id>.json con las medidas. Imprime: scrollWidth vs ancho, tocables
 * <44 px, tocables pegados (<8 px), textos <12 px, inputs <16 px, la acción
 * principal (¿se ve sin scroll?, ¿en la zona del pulgar?) y errores de JS.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA_LOGIN = resolve(aqui, '../../.crm-login');
const B = 'http://127.0.0.1:4321';

// ── Argumentos ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const ESCRITORIO = args.includes('--escritorio');
const ANCHO = ESCRITORIO ? 1280 : Number(arg('ancho', '390'));
const ALTO = ESCRITORIO ? 800 : ({ 360: 780, 390: 844, 414: 896 }[ANCHO] || 844);
const OUT = resolve(arg('out', `/tmp/qa-llamadas-mf/${ESCRITORIO ? 'escritorio' : ANCHO}`));
const PANTALLAS = ['armador', 'lista_generada', 'cabina_inicio', 'cabina_marcando', 'cabina_en_llamada', 'cabina_cierre', 'cabina_fin', 'manual_sala'];
const pedida = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a) && a !== arg('out', '')) || 'todas';
const aCorrer = pedida === 'todas' ? PANTALLAS : pedida.split(',');
for (const id of aCorrer) if (!PANTALLAS.includes(id)) { console.error(`Pantalla desconocida: ${id}. Usa una de: ${PANTALLAS.join(', ')} o «todas».`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

if (!existsSync(RUTA_LOGIN)) { console.error(`Falta ${RUTA_LOGIN}`); process.exit(1); }
const login = Object.fromEntries(readFileSync(RUTA_LOGIN, 'utf8').split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

// ══ LOS DATOS DE MENTIRAS ══════════════════════════════════════════════════
// Nombres mexicanos, tiendas de ropa y teléfonos +52 55 5010 xxxx (rango que no
// se le asigna a nadie). Creíbles para juzgar el diseño, imposibles de marcar.
const hoy = () => new Date();
const iso = (msAtras = 0) => new Date(Date.now() - msAtras).toISOString();
const dia = n => { const d = new Date(Date.now() + n * 86400e3); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const tel = n => `+525550100${String(100 + n).slice(-3)}`;
const GENTE = [
  ['Mariana López Treviño', 'Boutique Mariana', 'Ropa para dama', 3],
  ['José Luis Hernández', 'Moda Hernández Hermanos', 'Ropa para caballero', 7],
  ['Guadalupe Ramírez', 'Lupita Fashion', 'Ropa para dama', 2],
  ['Fernando Castañeda Ruiz', 'Jeans Castañeda', 'Mezclilla', 12],
  ['Alejandra Villaseñor', 'Ale Kids', 'Ropa infantil', 4],
  ['Ricardo Ochoa Medina', 'Uniformes Ochoa', 'Uniformes', 5],
  ['Daniela Fuentes', 'Novias Daniela', 'Vestidos de novia', 1],
  ['Héctor Salazar Pineda', 'Calzado y Moda Salazar', 'Zapatería', 9],
  ['Paola Guerrero', 'Pao Boutique', 'Ropa para dama', 2],
  ['Arturo Domínguez', 'Tiendas Domínguez', 'Ropa para caballero', 18],
  ['Ximena Robles', 'Ximena Lencería', 'Lencería', 3],
  ['Carlos Alberto Ibarra Gómez', 'Deportes Ibarra', 'Ropa deportiva', 6],
  ['Verónica Mendoza', 'La Casa del Rebozo', 'Artesanal', 1],
  ['Miguel Ángel Torres', 'Mayoreo Torres Villa Hidalgo', 'Mayoreo', 4],
  ['Sofía Aguilar', 'Sofi Accesorios', 'Accesorios', 2],
  ['Juan Pablo Cervantes', 'Camisería Cervantes', 'Ropa para caballero', 3],
  ['Claudia Navarro', 'Claudia Tallas Extra', 'Ropa para dama', 5],
  ['Eduardo Rangel', 'Rangel Sport', 'Ropa deportiva', 8],
  ['Beatriz Montes de Oca', 'Bety Moda Infantil', 'Ropa infantil', 2],
  ['Roberto Carlos Vázquez', 'Trajes Vázquez', 'Ropa para caballero', 4],
  ['Adriana Luna', 'Luna Bikinis', 'Trajes de baño', 1],
  ['Óscar Delgado', 'Delgado Mezclilla', 'Mezclilla', 10],
  ['Lucía Espinoza', 'Espinoza Boutique', 'Ropa para dama', 3],
  ['Gerardo Padilla', 'Padilla Uniformes Escolares', 'Uniformes', 6],
];
const ETAPAS = ['lead', 'lead', 'lead_calificado', 'rezagado'];
const filaCandidato = (g, i) => ({
  id: `crm:qa-${i}`, fuente: 'crm', virtual: true, wa_id: null, contact_id: `qa-c-${i}`, company_id: null, telefono: tel(i),
  contacto: { nombre: g[0], lifecycle_stage: ETAPAS[i % 4] }, empresa: { nombre: g[1], nombre_comercial: g[1] },
  giro: g[2], sucursales: g[3], tiene_wa: i % 3 !== 2,
});
const CANDIDATOS = GENTE.map(filaCandidato);
const TOTAL_LISTA = 82;

const item = (i, extra = {}) => {
  const g = GENTE[i % GENTE.length];
  return {
    id: `qa-it-${i}`, contact_id: `qa-c-${i}`, conversation_id: i % 2 ? `qa-conv-${i}` : null, nombre: g[0], empresa: g[1], telefono: tel(i),
    orden: i, estado: 'pendiente', intentos: 0, resultado: null, motivo_exclusion: null, veredicto: null, veredicto_fuente: null, veredicto_ms: null,
    resumen: `${g[2]} · ${g[3]} ${g[3] === 1 ? 'tienda' : 'tiendas'} · etapa ${ETAPAS[i % 4].replace('_', ' ')}`,
    nota: null, duracion_seg: null, terminado_at: null, call_sid: null, volver_at: null, prioridad: 0, costo_usd: null,
    cierre_estado: null, correccion: null, cortes: null, compromiso_tarea_id: null, hecho: [], cierre_motivo: null, cierre_fallo: null,
    ...extra,
  };
};
const hecho = (i, resultado, seg, extra = {}) => item(i, { estado: 'hecho', intentos: 1, resultado, duracion_seg: seg, terminado_at: iso((30 - i) * 60e3), call_sid: `CA${'qa'.repeat(3)}${String(i).padStart(26, '0')}`, veredicto: ['contesto', 'volver_llamar', 'dieron_datos', 'no_interesa'].includes(resultado) ? 'persona' : resultado === 'buzon' ? 'buzon' : null, ...extra });

const sesionBase = (id, nombre, estado, extra = {}) => ({
  id, nombre, estado, modo: 'manual', total: TOTAL_LISTA, contestadas: 9, buzon: 14, sin_contestar: 21, porteros: 3, invalidos: 2,
  segundos_hablados: 1260, costo_usd: 4.37, created_at: iso(3 * 3600e3), iniciada_at: iso(2 * 3600e3), terminada_at: estado === 'terminada' ? iso(600e3) : null,
  presentacion_nombre: 'Andrea de Sacscloud', presentacion_motivo: 'le llamo para dar seguimiento a su solicitud de información',
  buzon_dejar_mensaje: false, pausa_motivo: null, item_actual: null,
  origen: { descripcion: 'Mis leads · Ropa para dama · WhatsApp verificado', qs: 'fuente=crm&giros=Ropa+para+dama' },
  config: { auto_continuar: true, wrapup_seg: 8, lineas: 1, reintentos_buzon: 1 },
  ...extra,
});

const SES = { lista: 'qa-ses-lista', marcando: 'qa-ses-marcando', llamada: 'qa-ses-llamada', cierre: 'qa-ses-cierre', fin: 'qa-ses-fin' };
const NOMBRE = {
  marcando: 'Leads nuevos · CDMX y Edomex', llamada: 'Rezagados · Guadalajara', cierre: 'Ya calificados · jueves',
  fin: 'Mis leads · Ropa para dama · WhatsApp verificado',
};

const APERTURA = 'Hola, ¿qué tal? Soy Andrea de Sacscloud, le llamo para dar seguimiento a su solicitud de información. ¿Tiene un minuto?';
const DIALOGO = [
  'Cliente: ¿Bueno? Sí, ¿quién habla?',
  'Vendedor: Hola, qué tal, soy Andrea de Sacscloud, le llamo por la información que pidió del sistema para su tienda.',
  'Cliente: Ah, sí. Mire, ahorita llevamos todo en Excel y ya no nos da, tenemos tres sucursales en Guadalajara.',
  'Vendedor: Justo para eso es. ¿Cómo le hacen hoy con el inventario por talla y color?',
  'Cliente: Pues a mano, cada fin de semana contamos. ¿Me puede mandar la información por WhatsApp?',
].join('\n');

const PROPUESTA = {
  resultado: 'contesto',
  nota: 'Mariana tiene 3 sucursales en Guadalajara y lleva el inventario en Excel; cuenta por talla y color cada fin de semana. Le interesa ver cómo se controla el inventario entre tiendas. Pidió la información por WhatsApp.',
  siguiente_paso: 'Demo personalizada el jueves a las 16:00',
  compromisos: [{ tipo: 'reunion', fecha: dia(2), hora: '16:00', motivo: 'ver inventario por talla y color entre sucursales', reunion_tipo: 'demo', confianza: 0.92 }],
  datos: [
    { campo: 'sucursales', valor: '3', confianza: 1, evidencia: 'tenemos tres sucursales' },
    { campo: 'ciudad', valor: 'Guadalajara', confianza: 0.9, evidencia: 'en Guadalajara' },
  ],
  envios: [{ id: 'qa-env-1', conocimiento_id: 'qa-k-info', tema: 'Información de Sacs', estado: 'listo' }],
  etapa: 'lead_calificado', no_llamar: false, extras: [{ nombre: 'ti_cambio_marketing_v2', params: ['como quedamos en la llamada, aquí tienes cómo te cambias a Sacs.'] }],
};

const HUECOS = [0, 1, 2, 3, 4].flatMap(d => ['10:00', '11:30', '13:00', '16:00', '17:30'].map(h => ({ fecha: dia(d + 1), hora: h })));
const TIPOS = [{ slug: 'demo', nombre: 'Demo personalizada', minutos: 30 }, { slug: 'llamada-discovery', nombre: 'Llamada de descubrimiento', minutos: 15 }, { slug: 'seguimiento', nombre: 'Llamada de seguimiento', minutos: 15 }];

const ACCIONES = [
  { id: 'qa-a1', accion: 'mandar_info', etiqueta: 'Mandarle la información por WhatsApp', auto: true, frase: '¿Me puede mandar la información por WhatsApp?', origen: 'regla', estado: 'hecha', resultado: 'Le llegó el PDF «Información de Sacs» por WhatsApp', params: {}, pide: [], pide_texto: false, envio_id: null },
  { id: 'qa-a2', accion: 'volver_a_llamar', etiqueta: 'Volver a llamarle', auto: false, frase: 'márqueme el jueves en la tarde', origen: 'regla', estado: 'propuesta', resultado: null, params: { fecha: dia(2), hora: '17:00' }, pide: [{ campo: 'fecha', etiqueta: 'Día', tipo: 'date', valor: dia(2) }, { campo: 'hora', etiqueta: 'Hora', tipo: 'time', valor: '17:00' }], pide_texto: false, envio_id: null },
];
const OIDO = [
  { quien: 'contacto', texto: '¿Bueno? Sí, ¿quién habla?', t: 1000 },
  { quien: 'vendedor', texto: 'Hola, qué tal, soy Andrea de Sacscloud, le llamo por la información que pidió.', t: 3500 },
  { quien: 'contacto', texto: 'Ah, sí. Llevamos todo en Excel y ya no nos da, tenemos tres sucursales.', t: 9000 },
  { quien: 'contacto', texto: '¿Me puede mandar la información por WhatsApp?', t: 15000 },
];

const CONTEXTO = {
  hay: true, contactId: 'qa-c-0', seguimiento: null, descalificado: null,
  origen: { detalle: 'Llenó el formulario de la página de boutiques el 19 de sep.' },
  marca: 'Boutique Mariana', giro: 'Ropa para dama', puesto: 'Dueña', ciudad: 'Guadalajara', sitio: null, sucursales: 3, hora_local: null,
  mensajes: [
    { direccion: 'entrante', created_at: iso(4 * 86400e3), cuerpo: 'Hola, quiero información del sistema para mi tienda', tipo: 'text' },
    { direccion: 'saliente', created_at: iso(4 * 86400e3 - 600e3), cuerpo: '¡Hola Mariana! Con gusto. ¿Cuántas tiendas tienes?', tipo: 'text' },
    { direccion: 'entrante', created_at: iso(3 * 86400e3), cuerpo: 'Tres, en Guadalajara', tipo: 'text' },
  ],
  previas: [{ started_at: iso(2 * 86400e3), duracion_seg: 0, estado: 'perdida', minuta: null, resultado: 'no contestó' }],
  conversationId: 'qa-conv-0', nombre: 'Mariana López Treviño', empresa: 'Boutique Mariana', etapa: 'lead', proximoPaso: 'Mandarle precios del plan Moda',
  llamadas: 1, ultima: { cuando: iso(2 * 86400e3), buzon: false, estado: 'perdida', duracion: 0, direccion: 'saliente' },
};

const LISTA_RESUMEN = (() => {
  const grupos = [
    { id: 'accion', label: 'Con cita o seguimiento', que: 'ya hay un proceso en marcha: se les llama en su fecha' },
    { id: 'contesto', label: 'Contestaron sin acción', que: 'hablaron pero no quedó cita ni seguimiento' },
    { id: 'descalificado', label: 'Descalificados', que: 'no les interesa o se descartaron' },
    { id: 'buzon', label: 'Buzón', que: 'nunca contestó una persona: cayó al buzón' },
    { id: 'contestadora', label: 'Contestadora', que: 'contestó un asistente o filtro de llamadas' },
    { id: 'nunca', label: 'Nunca contestaron', que: 'sólo timbró u ocupado, en todas las rondas' },
    { id: 'sin_marcar', label: 'Sin marcar', que: 'todavía no se les llama' },
    { id: 'fuera', label: 'Fuera de la lista', que: 'quitados, vetados o número inválido' },
  ];
  const reparto = ['accion', 'accion', 'contesto', 'descalificado', 'buzon', 'buzon', 'buzon', 'contestadora', 'nunca', 'nunca', 'nunca', 'nunca', 'nunca', 'sin_marcar', 'fuera', 'nunca', 'buzon', 'contesto', 'nunca', 'nunca', 'accion', 'nunca', 'buzon', 'nunca'];
  const R = { accion: ['no_contesto', 'contesto'], contesto: ['buzon', 'contesto'], descalificado: ['no_interesa'], buzon: ['buzon', 'buzon'], contestadora: ['portero', 'no_contesto'], nunca: ['no_contesto', 'ocupado'], sin_marcar: ['pendiente'], fuera: ['fuera'] };
  const personas = GENTE.map((g, i) => ({
    clave: tel(i).slice(-10), contact_id: `qa-c-${i}`, nombre: g[0], empresa: g[1], telefono: tel(i), grupo: reparto[i],
    accion: reparto[i] === 'accion' ? `demo el ${dia(2)} 16:00` : reparto[i] === 'descalificado' ? 'no le interesa' : null,
    rondas: R[reparto[i]].map((r, k) => ({ ronda: k + 1, r })), intentos_hechos: R[reparto[i]].length,
  }));
  return {
    ok: true, raiz: { id: SES.fin, nombre: NOMBRE.fin },
    rondas: [{ id: SES.fin, n: 1, nombre: NOMBRE.fin, estado: 'terminada', fecha: iso(86400e3) }, { id: 'qa-ses-fin-2', n: 2, nombre: `${NOMBRE.fin} · ronda 2`, estado: 'terminada', fecha: iso(3600e3) }],
    total: personas.length, conteo: Object.fromEntries(grupos.map(g => [g.id, personas.filter(p => p.grupo === g.id).length])), grupos, personas,
    plantillas: [
      { nombre: 'llamada_saliente_no_contesto', categoria: 'UTILITY', cuerpo: 'Hola {{1}}, te marqué hace un rato de Sacscloud. ¿A qué hora te puedo llamar?' },
      { nombre: 'seguimiento_vio_info', categoria: 'MARKETING', cuerpo: 'Hola {{1}}, ¿alcanzaste a ver la información que te mandé?' },
    ],
  };
})();

const COMPROMISOS = [
  { tipo: 'reunion', fecha: dia(2), hora: '16:00', quien: 'Mariana López Treviño', empresa: 'Boutique Mariana', reunion_tipo: 'demo', en_google: true, contact_id: 'qa-c-0' },
  { tipo: 'llamada', fecha: dia(1), hora: '11:30', quien: 'José Luis Hernández', empresa: 'Moda Hernández Hermanos', en_google: false, contact_id: 'qa-c-1' },
];

// ══ EL ESTADO DE CADA SESIÓN (lo que devolvería `latir`) ═══════════════════
function estadoDe(id) {
  if (id === SES.lista) {
    const items = GENTE.slice(0, 20).map((_, i) => item(i));
    items.push(item(20, { estado: 'excluido', motivo_exclusion: 'marcado «no llamar»' }), item(21, { estado: 'excluido', motivo_exclusion: 'sin teléfono válido' }));
    return { est: { sesion: sesionBase(id, 'Mis leads · Ropa para dama · WhatsApp verificado', 'lista', { contestadas: 0, buzon: 0, sin_contestar: 0, porteros: 0, invalidos: 0, segundos_hablados: 0, costo_usd: 0 }), actual: null, pendientes: 20, vivos: [], lineas: 1, abandonadas: 0, proximo: null, siguiente_item: null, ahora: iso() }, items };
  }
  if (id === SES.marcando) {
    const vivos = [0, 1, 2].map(i => ({ id: `qa-it-${i}`, nombre: GENTE[i][0], empresa: GENTE[i][1], telefono: tel(i), estado: i === 2 ? 'marcando' : 'timbrando', veredicto: null, intentos: 1, con_vendedor: false, segundos: [14, 9, 2][i] }));
    const items = [
      ...[0, 1, 2].map(i => item(i, { estado: i === 2 ? 'marcando' : 'timbrando', intentos: 1 })),
      ...[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => item(i)),
      hecho(13, 'buzon', 0), hecho(14, 'no_contesto', 0), hecho(15, 'contesto', 184),
      item(16, { estado: 'excluido', motivo_exclusion: 'la cancelaste mientras timbraba' }),
      item(17, { estado: 'excluido', motivo_exclusion: 'la quitaste de la lista' }),
      item(18, { estado: 'excluido', motivo_exclusion: 'ya tiene una reunión el viernes' }),
    ];
    const actual = { ...items[0], oido_texto: '', dialogo: '', segundos_en_linea: 0, hora_local: null };
    return { est: { sesion: sesionBase(id, NOMBRE.marcando, 'activa', { item_actual: null, config: { auto_continuar: true, wrapup_seg: 8, lineas: 3, reintentos_buzon: 1 } }), actual: null, vivos, lineas: 3, abandonadas: 1, pendientes: 10, proximo: { nombre: GENTE[5][0], telefono: tel(5), volver_at: new Date(Date.now() + 25 * 60e3).toISOString() }, siguiente_item: { nombre: GENTE[3][0], empresa: GENTE[3][1], telefono: tel(3), resumen: items[3].resumen, intentos: 0 }, ahora: iso(), _actualSiHace: actual }, items };
  }
  if (id === SES.llamada || id === SES.cierre) {
    const enCierre = id === SES.cierre;
    const items = [
      item(0, {
        estado: enCierre ? 'cierre' : 'en_linea', intentos: 1, veredicto: 'persona', veredicto_fuente: 'reglas', veredicto_ms: 1400,
        call_sid: 'CA' + 'qa11'.repeat(8), duracion_seg: enCierre ? 212 : null, terminado_at: enCierre ? iso(5000) : null,
        cierre_estado: enCierre ? 'propuesto' : null,
      }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => item(i)),
      hecho(9, 'buzon', 0), hecho(10, 'contesto', 95), hecho(11, 'no_contesto', 0),
    ];
    const actual = {
      ...items[0], lada: '33', apertura: APERTURA, oido_texto: DIALOGO.split('\n').filter(l => l.startsWith('Cliente')).join(' '),
      dialogo: DIALOGO, segundos_en_linea: enCierre ? 212 : 97, hora_local: null,
      cierre_ia: enCierre ? { propuesta: PROPUESTA, generado_at: iso(3000) } : null,
    };
    return { est: { sesion: sesionBase(id, enCierre ? NOMBRE.cierre : NOMBRE.llamada, 'activa', { item_actual: actual.id }), actual, vivos: [], lineas: 1, abandonadas: 0, pendientes: 8, proximo: null, siguiente_item: { nombre: GENTE[1][0], empresa: GENTE[1][1], telefono: tel(1), resumen: items[1].resumen, intentos: 0 }, ahora: iso() }, items };
  }
  if (id === SES.fin) {
    const res = ['contesto', 'buzon', 'no_contesto', 'volver_llamar', 'buzon', 'portero', 'no_interesa', 'no_contesto', 'dieron_datos', 'invalido', 'colgo_rapido', 'ocupado', 'contesto', 'buzon', 'no_contesto', 'contesto'];
    const items = res.map((r, i) => hecho(i, r, ['contesto', 'volver_llamar', 'no_interesa', 'dieron_datos'].includes(r) ? 60 + i * 11 : 0, i === 3 ? { volver_at: new Date(Date.now() + 86400e3).toISOString() } : i === 8 ? { cierre_estado: 'sin_datos', cierre_fallo: 'tiempo', cierre_motivo: 'se acabó el tiempo' } : {}));
    items.push(item(16), item(17));
    return {
      est: {
        sesion: sesionBase(id, NOMBRE.fin, 'terminada'), actual: null, vivos: [], lineas: 1, abandonadas: 0, pendientes: 2, proximo: null, siguiente_item: null, ahora: iso(),
        colgaron_en_silencio: 1, embudo: { contestaron: 12, hablaron: 7, con_cita: 3, demos: 2, saludo_seg: 3.2, sin_voz_tuya: 1 },
      }, items,
    };
  }
  return null;
}

const PREVIAS = [
  { ...sesionBase(SES.marcando, NOMBRE.marcando, 'activa'), total: 45, contestadas: 3, buzon: 5, sin_contestar: 8, porteros: 0 },
  { ...sesionBase(SES.llamada, NOMBRE.llamada, 'activa'), total: 12, contestadas: 2, buzon: 1, sin_contestar: 2, porteros: 0 },
  { ...sesionBase(SES.cierre, NOMBRE.cierre, 'activa'), total: 12, contestadas: 2, buzon: 1, sin_contestar: 2, porteros: 0 },
  { ...sesionBase(SES.fin, NOMBRE.fin, 'terminada'), total: 82 },
  { ...sesionBase('qa-ses-vieja', 'Rezagados · agosto', 'pausada'), total: 30, contestadas: 4, buzon: 9, sin_contestar: 11, porteros: 1 },
];

const TABLERO = {
  ok: true, hoy: dia(0),
  reuniones: [
    { id: 'qa-r1', fecha: dia(0), hora: '17:00', quien: 'Mariana López Treviño', empresa: 'Boutique Mariana', telefono: tel(0), tipo: 'Demo personalizada', host: 'Andrea', estado: 'confirmada', en_google: true, contact_id: 'qa-c-0', es_hoy: true, atribucion: null },
    { id: 'qa-r2', fecha: dia(2), hora: '11:30', quien: 'Fernando Castañeda Ruiz', empresa: 'Jeans Castañeda', telefono: tel(3), tipo: 'Llamada de descubrimiento', host: 'Andrea', estado: 'confirmada', en_google: false, contact_id: 'qa-c-3', es_hoy: false, atribucion: null },
  ],
  seguimientos: [], vencidos: [], oportunidades: [], descalificados: [],
  listas: PREVIAS.map(s => ({ id: s.id, nombre: s.nombre, fecha: s.created_at, estado: s.estado, reanudable: s.estado !== 'terminada', viva: s.estado === 'activa', total: s.total, contestadas: s.contestadas, buzon: s.buzon, sin_contestar: s.sin_contestar, faltan: 10, minutos: 21, costo: 4.37, duenio: 'Andrea', motivo_pausa: null, modo: 'manual' })),
  conteos: { reuniones: 2, seguimientos: 0, seguimientos_vencidos: 0, oportunidades: 0, descalificados: 0, listas: PREVIAS.length, listas_reanudables: 4 },
};

const INBOX = {
  conversaciones: GENTE.slice(0, 12).map((g, i) => ({
    id: `qa-conv-${i}`, wa_id: `qa-conv-${i}`, email_id: null, canales: ['whatsapp'], telefono: tel(i), estado: 'abierta',
    ultimo_mensaje_at: iso(i * 3600e3), ultimo_mensaje_texto: ['Hola, quiero información del sistema', '¿Cuánto cuesta para 3 tiendas?', 'Gracias, lo reviso', '¿Tienen demo?'][i % 4],
    ultima_direccion: i % 2 ? 'saliente' : 'entrante', ultimo_canal: 'whatsapp', no_leidos: i % 3 === 0 ? 1 : 0, ventana_expira_at: new Date(Date.now() + 20 * 3600e3).toISOString(),
    ultimo_entrante_at: iso(i * 3600e3), ultimo_entrante_auto: false, alerta: null, mencion: false, tiene_notas: false, phone_number_id: 'qa', estado_crm: 'abierta',
    snooze_until: null, interna: false, asignado_a: null, contact_id: `qa-c-${i}`, company_id: null,
    contacto: { id: `qa-c-${i}`, nombre: g[0], email: null, lifecycle_stage: ETAPAS[i % 4], tipo: 'lead' }, empresa: { id: `qa-e-${i}`, nombre: g[1], plan: null, mrr: 0 },
    _extra: { fuente: 'web', creado: iso(9 * 86400e3), sucursales: g[3], giro: g[2], etiquetas: [], etiquetas_conv: [] },
  })),
  counts: { todas: 373, mias: 22, sin_asignar: 169, no_leidas: 18, sin_respuesta: 48, pospuestas: 0, accion: 24, internas: 1, programados: 0, con_reunion: 7, por_etapa: { lead: 31, lead_calificado: 12, rezagado: 17, cliente: 69, oportunidad: 12 } },
  total_filtrado: 12, hay_mas: false,
};

// El SDK de Twilio, falso. La sala se «acepta» sola (la central no existe);
// la llamada manual la conduce el script: ringing → accept → disconnect.
const SDK_FALSO = `
class Emisor { constructor(){ this._h = {}; } on(e, f){ (this._h[e] = this._h[e] || []).push(f); return this; } removeListener(){ return this; } off(){ return this; } emit(e, ...a){ (this._h[e] || []).slice().forEach(f => f(...a)); } }
class Llamada extends Emisor {
  constructor(from){ super(); this.parameters = { CallSid: 'CA' + 'qa22'.repeat(8), From: from || '' }; }
  mute(v){ this._mudo = v; } isMuted(){ return !!this._mudo; } sendDigits(){ } disconnect(){ this.emit('disconnect'); }
  accept(){ this.emit('accept', this); } reject(){ this.emit('reject'); } status(){ return 'open'; }
}
export class Device extends Emisor {
  constructor(){ super(); window.__dispositivo = this; }
  async register(){ } destroy(){ } updateToken(){ } unregister(){ }
  async connect({ params }){
    const c = new Llamada(); c.destino = params.To;
    if (String(params.To).startsWith('sala:')) { window.__sala = c; setTimeout(() => c.emit('accept', c), 40); }
    else window.__llamada = c;
    return c;
  }
}
export const Call = Llamada;
export default { Device, Call: Llamada };
`;

// ══ LA RED: todo simulado ══════════════════════════════════════════════════
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function instalarRed(p, bitacora) {
  await p.route('**/*voice-sdk*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SDK_FALSO }));
  // Cualquier escritura directa a Supabase se tira: aquí no se toca la base.
  await p.route(/supabase\.(co|in)\//, r => {
    if (r.request().method() === 'GET' || r.request().method() === 'HEAD') return r.continue();
    bitacora.push(`ABORTADO ${r.request().method()} ${r.request().url().slice(0, 90)}`);
    return r.abort();
  });
  await p.route(u => u.origin === B, async r => {
    const req = r.request();
    const url = new URL(req.url());
    const m = req.method();
    const ruta = url.pathname;
    if (!ruta.startsWith('/api/')) {
      // fallback y no continue: deja pasar al SDK falso de Twilio (otra ruta) en vez de ir a la red.
      if (m === 'GET' || m === 'HEAD') return r.fallback();
      bitacora.push(`SIMULADO ${m} ${ruta}`);
      return json(r, { ok: true });
    }
    let b = {};
    try { b = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }

    if (m !== 'GET' && m !== 'HEAD') {
      bitacora.push(`SIMULADO ${m} ${ruta}${b.accion ? ` · ${b.accion}` : ''}`);
      if (ruta === '/api/crm/telefonia/marcador') {
        switch (b.accion) {
          case 'crear': return json(r, { ok: true, id: SES.lista, total: 20, excluidos: 2, compromisos: 0 });
          case 'huecos': return json(r, { ok: true, tipo: b.tipo || 'demo', tipos: TIPOS, huecos: HUECOS, de_quien: 'de quien la da' });
          case 'cierre_opciones': return json(r, {
            ok: true, ventana_abierta: false, primer_nombre: 'Mariana',
            conocimientos: [
              { id: 'qa-k-info', tema: 'Información de Sacs', pdf: true, plantilla: { nombre: 'ti_info_utility_v1', cuerpo: 'Hola {{1}}, {{2}}' }, param: PROPUESTA.extras[0].params[0], liga: 'https://www.sacscloud.com' },
              { id: 'qa-k-precios', tema: 'Planes y precios', pdf: true, plantilla: { nombre: 'ti_precios_utility_v1', cuerpo: 'Hola {{1}}, {{2}}' }, param: 'como quedamos en la llamada, aquí tienes los planes y precios.', liga: 'https://www.sacscloud.com/planes' },
            ],
            plantillas: [
              { nombre: 'ti_cambio_marketing_v2', categoria: 'MARKETING', cuerpo: 'Hola {{1}}, {{2}} Te dejo el paso a paso para migrar tu inventario sin cerrar la tienda.', variables: 2, con_documento: true },
              { nombre: 'ti_demo_marketing_v1', categoria: 'MARKETING', cuerpo: 'Hola {{1}}, {{2}} En la demo vemos tu inventario real por talla y color.', variables: 2, con_documento: false },
              { nombre: 'seguimiento_vio_info', categoria: 'UTILITY', cuerpo: 'Hola {{1}}, ¿alcanzaste a ver la información que te mandé?', variables: 1, con_documento: false },
            ],
          });
          case 'lista_resumen': return json(r, LISTA_RESUMEN);
          case 'grabacion': return json(r, { ok: false, motivo: 'QA: sin grabación simulada' });
          default: return json(r, { ok: true });
        }
      }
      if (ruta === '/api/crm/telefonia/sala') {
        if (b.accion === 'cerrar') return json(r, { ok: true, item_id: 'qa-it-suelta', cierre: { estado: 'propuesto', propuesta: PROPUESTA, motivo: null }, acciones: ACCIONES });
        if (b.accion === 'aplicar') return json(r, { ok: true, hecho: ['Demo personalizada el jueves 16:00 (en Google Calendar)', '2 datos: sucursales, ciudad'], acciones: ACCIONES });
        return json(r, { ok: true, acciones: ACCIONES });
      }
      return json(r, { ok: true });
    }

    // ── GET simulados ──
    if (ruta === '/api/crm/telefonia/token') return json(r, { token: 'jwt.falso.qa', identity: 'crm-qa', numero: '+525550100999' });
    if (ruta === '/api/crm/telefonia/marcador') {
      if (url.searchParams.get('lista')) return json(r, { sesiones: PREVIAS, telefonia: true, faltantes: [], identity: 'crm-qa', fernanda: true });
      const e = estadoDe(url.searchParams.get('id') || '');
      if (!e) return json(r, { error: 'No existe la sesión' }, 404);
      if (url.searchParams.get('items')) return json(r, { items: e.items });
      if (url.searchParams.get('compromisos')) return json(r, { compromisos: COMPROMISOS });
      const { _actualSiHace, ...est } = e.est;
      return json(r, { ...est, identity: 'crm-qa' });
    }
    if (ruta === '/api/crm/telefonia/candidatos') {
      if (url.searchParams.get('catalogo')) return json(r, {
        ok: true,
        giros_abm: [['Ropa para dama', 2321, 1402], ['Ropa para caballero', 1180, 690], ['Zapatería', 960, 511], ['Ropa infantil', 740, 402], ['Mezclilla', 388, 201], ['Uniformes', 356, 170], ['Lencería', 214, 120], ['Vestidos de novia', 190, 133]].map(([giro, n, con_wa]) => ({ giro, n, con_wa })),
        giros_crm: [['Ropa para dama', 64], ['Ropa para caballero', 31], ['Zapatería', 22], ['Ropa infantil', 18], ['Mezclilla', 11], ['Uniformes escolares y empresariales de temporada', 9], ['Lencería', 7], ['Accesorios', 6], ['Ropa deportiva', 6], ['Vestidos de novia', 4], ['Trajes de baño', 3], ['Artesanal', 2], ['Mayoreo', 2], ['Calzado', 2]].map(([giro, n]) => ({ giro, n })),
        estados: [['Jalisco', 912], ['Ciudad de México', 870], ['Estado de México', 655], ['Nuevo León', 402], ['Puebla', 310], ['Guanajuato', 288]].map(([estado, n]) => ({ estado, n })),
      });
      return json(r, { ok: true, conversaciones: CANDIDATOS, total_filtrado: TOTAL_LISTA, aprox: true, hay_mas: false, siguiente_offset: 200, descartados: { quemados: 6, con_reunion: 2, descalificados: 3, con_accion: 11 } });
    }
    if (ruta === '/api/crm/telefonia/tablero') return json(r, TABLERO);
    if (ruta === '/api/crm/telefonia/sala') return json(r, { hay: true, item_id: 'qa-it-suelta', oido: OIDO, escuchando: true, acciones: ACCIONES, catalogo: [], cierre: { estado: null, propuesta: null, hecho: null, motivo: null }, llamada: { estado: 'en_linea', resultado: null, duracion_seg: null } });
    if (ruta === '/api/crm/telefonia/contexto') return json(r, CONTEXTO);
    if (ruta === '/api/crm/telefonia/llamada') return json(r, { existe: true, estado: 'terminada', duracion_seg: 212, motivo: null, conversation_id: 'qa-conv-0', minuta_esperada: true, minuta_lista: false });
    if (ruta.startsWith('/api/crm/telefonia/')) return json(r, { ok: true });
    if (ruta === '/api/crm/whatsapp/inbox') return json(r, url.searchParams.get('limit') === '1' ? { ...INBOX, conversaciones: INBOX.conversaciones.slice(0, 1) } : INBOX);
    if (ruta === '/api/scheduling/event-types') return json(r, TIPOS.map(t => ({ ...t, duracion_minutos: t.minutos, activo: true })));
    if (ruta === '/api/scheduling/available-slots') return json(r, { dates: Object.fromEntries([1, 2, 3, 4].map(d => [dia(d), ['10:00', '11:30', '13:00', '16:00']])) });
    return r.fallback();
  });
}

// ══ LAS MEDIDAS ════════════════════════════════════════════════════════════
async function medir(p, principal) {
  return p.evaluate(({ principal, esMovil }) => {
    const W = window.innerWidth, H = window.innerHeight;
    const visible = el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
      if (r.right <= 0 || r.left >= W) return false;   // un cajón cerrado, fuera por un lado
      { const d = el.closest('details:not([open])'); if (d && !el.closest('summary')) return false; }   // dentro de un <details> cerrado
      // Lo que queda fuera de la pantalla dentro de algo fijo (la hoja escondida con translateY(101%)) no cuenta.
      if (r.top >= H - 1) for (let a = el; a; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return false;
      return true;
    };
    const texto = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 48);
    const doc = document.documentElement;
    // Qué se sale por la derecha (y no está dentro de un carril con scroll horizontal a propósito).
    // Carril a propósito = el que declara scroll horizontal él mismo (overflowX inline o la clase crm-scroll-x).
    // Un overflowY:auto también computa overflowX:auto, y eso NO es un carril: es contenido cortado.
    const enCarril = el => { for (let a = el.parentElement; a; a = a.parentElement) { if ((/(auto|scroll)/.test(a.style.overflowX) || a.classList.contains('crm-scroll-x')) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
    const salidos = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.right <= W + 1 || !visible(el) || enCarril(el)) continue;
      if ([...el.children].some(c => c.getBoundingClientRect().right > W + 1)) continue;   // sólo la hoja más profunda
      salidos.push(`${el.tagName.toLowerCase()} «${texto(el)}» → ${Math.round(r.right)}px`);
      if (salidos.length >= 8) break;
    }
    // Los tocables.
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], summary, label:has(> input[type=checkbox]), label:has(> input[type=radio])';
    let tocables = [...document.querySelectorAll(sel)].filter(el => !el.disabled && visible(el))
      .filter(el => !(el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')));   // cuenta la etiqueta, que es el blanco real
    // Con un modal abierto, lo de atrás no se puede tocar: sólo cuenta lo del modal y lo fijo que quede ENCIMA de él.
    const fijoDe = el => { for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return a; return null; };
    const zDe = el => { let z = 0; for (let a = el; a && a !== document.body; a = a.parentElement) { const v = parseInt(getComputedStyle(a).zIndex); if (!isNaN(v)) z = Math.max(z, v); } return z; };
    // Modal = un diálogo que ocupa la pantalla, o cualquier capa fija opaca que la tape casi entera (la pantalla de la llamada).
    const opaca = el => { const cs = getComputedStyle(el); return cs.pointerEvents !== 'none' && (cs.backgroundImage !== 'none' || !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.backgroundColor)); };
    const modales = [
      ...[...document.querySelectorAll('[role=dialog], [aria-modal=true]')].filter(el => { if (!visible(el)) return false; const r = el.getBoundingClientRect(); return r.width * r.height >= W * H * 0.6; }),
      ...[...document.querySelectorAll('body *')].filter(el => { if (getComputedStyle(el).position !== 'fixed' || !visible(el)) return false; const r = el.getBoundingClientRect(); return r.width * r.height >= W * H * 0.9 && opaca(el); }),
    ];
    const modal = modales.sort((a, b) => zDe(a) - zDe(b)).pop() || null;
    let fueraDelModal = 0;
    if (modal) {
      const zm = zDe(modal);
      tocables = tocables.filter(el => { const ok = modal.contains(el) || (fijoDe(el) && zDe(el) > zm); if (!ok) fueraDelModal++; return ok; });
    }
    /* Tapados: el centro del botón lo ocupa OTRA capa fija (el panel de la sala, la navegación del CRM…).
       Lo que sólo pasa por debajo de la barra de su misma pantalla al hacer scroll no cuenta aquí: eso lo
       mide «fondo» (¿al final del scroll queda algo debajo de la barra?). Lo que está tapado por contenido
       normal (un menú de escritorio escondido detrás) tampoco es un tocable real y se ignora. */
    const tapados = [];
    const capaDe = el => { for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const ps = getComputedStyle(a).position; if (ps === 'fixed' || ps === 'sticky') return a; } return null; };
    const cubierto = el => {
      const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) return null;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || el.contains(hit) || hit.contains(el) || (el.tagName === 'LABEL' && el.control === hit)) return null;
      return hit;
    };
    tocables = tocables.filter(el => {
      const hit = cubierto(el); if (!hit) return true;
      const capaHit = capaDe(hit), capaEl = capaDe(el);
      if (!capaHit) return false;                                    // escondido detrás de contenido normal: no es un blanco real
      if (capaHit === capaEl || (capaEl && capaEl.contains(capaHit)) || (capaEl && capaHit.contains(capaEl))) return true;   // su misma capa (scroll bajo su pie)
      if (capaEl) tapados.push(`«${texto(el).slice(0, 30)}» bajo «${texto(capaHit).slice(0, 30)}»`);   // una capa fija encima de otra: bug
      return true;                                                   // contenido que pasa bajo una barra: lo decide «fondo»
    });
    const chicos = [];
    for (const el of tocables) {
      const r = el.getBoundingClientRect();
      const t = texto(el);
      const icono = !String(el.innerText || '').trim() || String(el.innerText || '').trim().length <= 2;
      if (r.height < 44 - 0.5 || (icono && r.width < 44 - 0.5)) chicos.push({ t, w: Math.round(r.width), h: Math.round(r.height) });
    }
    // Pegados: dos tocables a menos de 8 px (se miden los que están en pantalla).
    const enPantalla = tocables.filter(el => !cubierto(el)).map(el => ({ el, r: el.getBoundingClientRect() })).filter(x => x.r.bottom > 0 && x.r.top < H);
    const pegados = [];
    for (let i = 0; i < enPantalla.length; i++) for (let j = i + 1; j < enPantalla.length; j++) {
      const a = enPantalla[i], c = enPantalla[j];
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      const dx = Math.max(0, Math.max(a.r.left, c.r.left) - Math.min(a.r.right, c.r.right));
      const dy = Math.max(0, Math.max(a.r.top, c.r.top) - Math.min(a.r.bottom, c.r.bottom));
      if (dx < 8 && dy < 8 && Math.max(dx, dy) < 8) pegados.push(`«${texto(a.el).slice(0, 22)}» ↔ «${texto(c.el).slice(0, 22)}» (${Math.round(Math.max(dx, dy))}px)`);
    }
    // Textos.
    const chicosTxt = new Map(); let de12a14 = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (!s || s.length < 2) continue;
      const el = n.parentElement; if (!el || !visible(el)) continue;
      if (el.closest('svg, script, style, noscript')) continue;
      { const h = cubierto(el); if (h && !capaDe(el) && capaDe(h)) continue; }   // detrás de una capa fija que lo tapa
      if (modal && !modal.contains(el) && !(capaDe(el) && zDe(el) > zDe(modal))) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12 - 0.01) { const k = `${fs}px «${s.slice(0, 40)}»`; chicosTxt.set(k, (chicosTxt.get(k) || 0) + 1); }
      else if (fs < 14 - 0.01) de12a14++;
    }
    const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')].filter(visible)
      .map(el => ({ t: texto(el), fs: parseFloat(getComputedStyle(el).fontSize) })).filter(x => x.fs < 16).map(x => `${x.fs}px «${x.t}»`);
    // La acción principal: ¿se ve sin scroll y en la zona del pulgar (último 40 % de la pantalla)?
    let accion = null;
    if (principal) {
      const re = new RegExp(principal, 'i');
      const cand = [...document.querySelectorAll('button, a[href], [role=button]')].filter(el => visible(el) && re.test(`${el.getAttribute('aria-label') || ''} ${el.innerText || ''}`));
      // Se prefiere la que está en la zona del pulgar y sin tapar (la de la barra de abajo), luego cualquiera en pantalla.
      const enVista = e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= H; };
      const enPulgar = e => { const r = e.getBoundingClientRect(); return r.top >= H * 0.6 && r.bottom <= H; };
      const el = cand.find(e => enPulgar(e) && !cubierto(e)) || cand.find(e => enVista(e) && !cubierto(e)) || cand.find(enVista) || cand[0];
      if (el) {
        const r = el.getBoundingClientRect(); const tapa = cubierto(el);
        accion = { texto: texto(el), top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), sinScroll: r.top >= 0 && r.bottom <= H && !tapa, pulgar: r.top >= H * 0.6 && r.bottom <= H, tapadaPor: tapa ? texto(capaDe(tapa) || tapa) : null, deshabilitado: !!el.disabled };
      } else accion = { texto: principal, noEncontrada: true };
    }
    // Barras fijas abajo (para saber qué tapa qué).
    const fijos = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); if (s.position !== 'fixed') return false; const r = el.getBoundingClientRect(); return r.height > 30 && r.height < H * 0.5 && r.bottom >= H - 2 && r.top < H && r.width > W * 0.5; })
      .map(el => `${Math.round(el.getBoundingClientRect().height)}px «${texto(el).slice(0, 40)}»`).slice(0, 4);
    return {
      ancho: W, alto: H, scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), desborde: Math.max(doc.scrollWidth, document.body.scrollWidth) > W + 1,
      salidos, tocables: tocables.length, modal: modal ? (modal.getAttribute('aria-label') || 'dialog') : null, fueraDelModal, tapados, chicos, pegados: pegados.slice(0, 40), nPegados: pegados.length,
      textosChicos: [...chicosTxt.entries()].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)), de12a14,
      inputsChicos: inputs, accion, fijos,
    };
  }, { principal, esMovil: !ESCRITORIO });
}

/** «Fondo»: al final de cada scroll, ¿lo último que se puede tocar/leer queda debajo de una barra fija ajena?
 *  Es la prueba de que el padding de abajo alcanza (la barra del pulgar, la navegación del CRM, el panel de la sala). */
async function medirFondo(p) {
  return p.evaluate(async () => {
    const W = window.innerWidth, H = window.innerHeight;
    const capaDe = el => { for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const ps = getComputedStyle(a).position; if (ps === 'fixed' || ps === 'sticky') return a; } return null; };
    const texto = el => (el.getAttribute?.('aria-label') || el.innerText || el.value || el.placeholder || el.tagName || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    // Sólo los scrolls de la capa de arriba: con la pantalla de la llamada encima, el inbox de atrás no se mide.
    const zDe = el => { let z = 0; for (let a = el; a && a !== document.body; a = a.parentElement) { const v = parseInt(getComputedStyle(a).zIndex); if (!isNaN(v)) z = Math.max(z, v); } return z; };
    const opaca = el => { const cs = getComputedStyle(el); return cs.pointerEvents !== 'none' && (cs.backgroundImage !== 'none' || !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.backgroundColor)); };
    const modal = [...document.querySelectorAll('body *')].filter(el => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width * r.height >= W * H * (el.matches('[role=dialog], [aria-modal=true]') ? 0.6 : 0.9) && (el.matches('[role=dialog], [aria-modal=true]') || opaca(el)); })
      .sort((a, b) => zDe(a) - zDe(b)).pop() || null;
    const arriba = el => !modal || modal.contains(el) || zDe(el) > zDe(modal);
    const scrolls = [...(modal ? [] : [document.scrollingElement]), ...[...document.querySelectorAll('body *')].filter(el => { const cs = getComputedStyle(el); return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.getBoundingClientRect().height > 80 && arriba(el); })];
    const antes = scrolls.map(el => el.scrollTop);
    const out = [];
    for (const sc of scrolls) {
      sc.scrollTop = sc.scrollHeight;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const raiz = sc === document.scrollingElement ? document.body : sc;
      const hojas = [...raiz.querySelectorAll('button, a[href], input, select, textarea, p, span, b, div')].filter(el => {
        if (sc === document.scrollingElement && capaDe(el)) return false;
        if (!el.innerText?.trim() && !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(el.tagName)) return false;
        if ([...el.children].some(c => c.innerText?.trim())) return /^(BUTTON|A)$/.test(el.tagName);
        const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < H && r.bottom > 0 && r.left < W;
      });
      const ultimo = hojas.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
      if (!ultimo) continue;
      const r = ultimo.getBoundingClientRect(); const cy = Math.min(H - 1, r.top + r.height / 2), cx = Math.min(W - 1, Math.max(0, r.left + Math.min(r.width, W) / 2));
      const hit = document.elementFromPoint(cx, cy);
      if (hit && !ultimo.contains(hit) && !hit.contains(ultimo)) {
        const capa = capaDe(hit);
        if (capa && capa !== capaDe(ultimo) && !capa.contains(ultimo)) out.push(`al final del scroll «${texto(ultimo)}» queda bajo «${texto(capa)}»`);
      }
    }
    scrolls.forEach((el, i) => { el.scrollTop = antes[i]; });
    return [...new Set(out)];
  });
}

/** Captura con los contenedores de scroll interno desplegados; luego lo deja como estaba. */
async function fotoLarga(p, ruta) {
  const n = await p.evaluate(() => {
    const cambiados = [];
    const guardar = el => { if (!el.__qaEstilo) { el.__qaEstilo = el.getAttribute('style') ?? ''; cambiados.push(el); } };
    const scrolls = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4; });
    for (const el of scrolls) {
      guardar(el);
      el.style.overflowY = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; el.style.flex = 'none';
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.position === 'fixed' || s.overflow === 'hidden' || s.maxHeight !== 'none' || /%|vh/.test(a.style.height || '') || s.height.endsWith('px')) {
          guardar(a);
          if (s.position === 'fixed') { a.style.position = 'absolute'; a.style.bottom = 'auto'; }
          a.style.overflow = 'visible'; a.style.maxHeight = 'none'; a.style.height = 'auto'; a.style.minHeight = '0';
        }
      }
    }
    window.__qaCambiados = cambiados;
    return scrolls.length;
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: ruta, fullPage: true }).catch(() => {});
  await p.evaluate(() => { for (const el of window.__qaCambiados || []) { el.setAttribute('style', el.__qaEstilo); delete el.__qaEstilo; } window.__qaCambiados = []; });
  return n;
}

// ══ RECORRIDOS ═════════════════════════════════════════════════════════════
/* Tocar como el dedo; si algo lo tapa, se anota (es un hallazgo) y se toca por JS para que el recorrido siga. */
let notasPantalla = [];
async function tocar(loc, que) {
  try { await loc.click({ timeout: 4000 }); }
  catch { notasPantalla.push(`«${que}» no se pudo tocar con el dedo (algo lo tapa o no está en pantalla)`); await loc.evaluate(el => el.click()); }
}
const esperarTexto = (p, re, ms = 20000) => p.waitForFunction(src => new RegExp(src, 'i').test(document.body.innerText), re.source, { timeout: ms });
async function abrirLlamadas(p) {
  await p.goto(`${B}/admin/crm?tab=llamadas`, { waitUntil: 'domcontentloaded' });
  await esperarTexto(p, /Nueva llamada inteligente/, 45000);
  await p.waitForTimeout(1200);
}
async function abrirArmador(p) {
  await abrirLlamadas(p);
  await tocar(p.getByRole('button', { name: 'Nueva llamada inteligente' }).first(), 'Nueva llamada inteligente');
  await p.getByRole('dialog', { name: 'Nueva llamada inteligente' }).waitFor({ timeout: 15000 });
  await esperarTexto(p, /Llamar a estos 82/);
  await p.waitForTimeout(600);
}
/** Entra a la cabina por la primera lista y abre la sesión pedida desde «Sesiones anteriores». */
async function abrirSesion(p, nombre) {
  await abrirLlamadas(p);
  await tocar(p.locator('button', { hasText: 'No te han contestado' }).first(), 'No te han contestado');
  await esperarTexto(p, /Sesiones anteriores/);
  const fila = p.locator('div', { hasText: nombre }).filter({ has: p.getByRole('button', { name: /^(Abrir|Ver)$/ }) }).last();
  await tocar(fila.getByRole('button', { name: /^(Abrir|Ver)$/ }).first(), `Abrir «${nombre}»`);
  await p.waitForTimeout(1500);
}
/** La cabina entra a la sala con el SDK falso (se acepta sola): así aparece la barra del pulgar. */
async function entrarSala(p, id) {
  await p.evaluate(sid => document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sid } })), id);
  await p.waitForFunction(() => !!window.__sala, null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1500);
}

/** Arriba del todo: la página y los scrolls internos de la cabina (el clic en «Abrir» deja la página bajada). */
async function alInicio(p) {
  await p.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.wa-scroll').forEach(e => { e.scrollTop = 0; }); });
  await p.waitForTimeout(300);
}

const RECORRIDOS = {
  async armador(p, foto) {
    await abrirArmador(p);
    await foto('', 'Llamar a estos');
    // Con un giro y «Más de 3» puestos: los chips encendidos.
    await tocar(p.getByRole('dialog').getByRole('button', { name: 'Prospección en frío' }).first(), 'Prospección en frío');
    await p.waitForTimeout(700);
    await tocar(p.getByRole('dialog').getByRole('button', { name: /Ropa para dama/ }).first(), 'Ropa para dama');
    await tocar(p.getByRole('dialog').getByRole('button', { name: 'Más de 3' }).first(), 'Más de 3');
    await p.waitForTimeout(900);
    await foto('filtros-abm', 'Llamar a estos');
  },
  async lista_generada(p, foto) {
    await abrirArmador(p);
    // La vista previa de candidatos: en el teléfono vive DEBAJO de los filtros.
    await p.getByText('para llamar', { exact: false }).first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    await foto('', 'Llamar a estos');
  },
  async cabina_inicio(p, foto) {
    await abrirArmador(p);
    await tocar(p.getByRole('button', { name: /Llamar a estos 82/ }), 'Llamar a estos 82');
    await esperarTexto(p, /Armar la lista con los filtros actuales/);
    await p.waitForTimeout(900);
    await alInicio(p);
    await foto('armar', 'Armar la lista');
    await tocar(p.getByRole('button', { name: /Armar la lista con los filtros actuales/ }), 'Armar la lista');
    await esperarTexto(p, /Empezar a marcar/);
    await p.waitForTimeout(1500);
    await alInicio(p);
    await foto('lista', 'Empezar a marcar');
  },
  async cabina_marcando(p, foto) {
    await abrirSesion(p, NOMBRE.marcando);
    await esperarTexto(p, /a la vez/);
    await entrarSala(p, SES.marcando);
    await alInicio(p);
    await foto('', 'Saltar|Pausar');
    const hoja = p.getByRole('button', { name: /^Lista · / });
    if (await hoja.count()) {
      // Por JS y no con el dedo: si la barra está tapada (se reporta como TAPADO), el recorrido sigue.
      await tocar(hoja.first(), 'Lista · N (barra del pulgar)'); await p.waitForTimeout(700);
      await foto('hoja', null);
      await tocar(p.getByRole('button', { name: /^Quitados/ }).first(), 'pestaña Quitados').catch(() => {});
      await p.waitForTimeout(600);
      await foto('quitados', 'Volver a meter');
    }
  },
  async cabina_en_llamada(p, foto) {
    await abrirSesion(p, NOMBRE.llamada);
    await esperarTexto(p, /Colgar/);
    await entrarSala(p, SES.llamada);
    await esperarTexto(p, /Horarios que le puedes ofrecer/).catch(() => {});
    await p.waitForTimeout(1200);
    await alInicio(p);
    await foto('', 'Colgar');
  },
  async cabina_cierre(p, foto) {
    await abrirSesion(p, NOMBRE.cierre);
    await esperarTexto(p, /Confirmar y seguir|Ya decidí/);
    await entrarSala(p, SES.cierre);
    await esperarTexto(p, /Así le van a llegar/).catch(() => {});
    await p.waitForTimeout(1000);
    await alInicio(p);
    await foto('', 'Confirmar y seguir|Ya decidí');
    const mas = p.getByRole('button', { name: /Mandarle también/ });
    if (await mas.count()) {
      await mas.first().scrollIntoViewIfNeeded(); await tocar(mas.first(), 'Mandarle también'); await p.waitForTimeout(900);
      await foto('mandarle-tambien', 'Confirmar y seguir|Ya decidí');
    }
  },
  async cabina_fin(p, foto) {
    await abrirSesion(p, NOMBRE.fin);
    await esperarTexto(p, /Ronda|ronda/);
    await p.waitForTimeout(1500);
    await alInicio(p);
    await foto('', 'ronda|Volver a llamar a los');
  },
  async manual_sala(p, foto) {
    await p.goto(`${B}/admin/crm?tab=whatsapp`, { waitUntil: 'domcontentloaded' });
    await esperarTexto(p, /Mariana López/, 45000);
    await p.waitForTimeout(1500);
    await p.evaluate(t => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: t, nombre: 'Mariana López Treviño' } })), tel(0));
    await p.waitForFunction(() => !!window.__llamada, null, { timeout: 15000 });
    await p.evaluate(() => window.__llamada.emit('ringing'));
    await p.waitForTimeout(600);
    await foto('timbrando', 'Colgar');
    await p.evaluate(() => window.__llamada.emit('accept', window.__llamada));
    await p.waitForTimeout(2200);
    await foto('en-linea', 'Colgar');
    const ficha = p.getByRole('button', { name: /Ver la ficha/ });
    if (await ficha.count()) { await tocar(ficha.first(), 'Ver la ficha y lo que te pidió'); await p.waitForTimeout(3500); }
    await foto('sala', 'Colgar');
    await p.evaluate(() => window.__llamada.disconnect());
    await esperarTexto(p, /Así le van a llegar|la IA propone|Confirmar|Aplicar/, 15000).catch(() => {});
    await p.waitForTimeout(2000);
    await foto('cierre', 'Confirmar|Aplicar|Cerrar la llamada|Listo');
  },
};

// ══ CORRER ═════════════════════════════════════════════════════════════════
const nav = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
let fallasTot = 0;
const resumen = [];
try {
  // 1 · El login, solo, sin nada interceptado (es el único request que va al servidor de verdad).
  const cl = await nav.newContext();
  const pl = await cl.newPage();
  await pl.goto(`${B}/admin/login`, { waitUntil: 'networkidle' });
  await pl.fill('input[type="email"]', login.CRM_EMAIL);
  await pl.fill('input[type="password"]', login.CRM_PASSWORD);
  await pl.click('button[type="submit"]');
  await pl.waitForURL('**/admin/crm**', { timeout: 45000 }).catch(() => {});
  if (!/\/admin\/crm/.test(pl.url())) { console.error(`✗ No entró al CRM (quedó en ${pl.url()}). ¿Sigue vivo el dev server en ${B}?`); process.exit(1); }
  const estado = await cl.storageState();
  await cl.close();

  console.log(`\nQA móvil primero · Llamadas · ${ESCRITORIO ? 'escritorio 1280×800' : `${ANCHO}×${ALTO} táctil`} → ${OUT}\n`);
  for (const id of aCorrer) {
    const ctx = await nav.newContext({
      storageState: estado, viewport: { width: ANCHO, height: ALTO }, permissions: ['microphone'],
      ...(ESCRITORIO ? {} : { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }),
      locale: 'es-MX', timezoneId: 'America/Mexico_City',
    });
    // Cada pantalla empieza limpia: sin jornada recordada ni presentación de otra corrida.
    await ctx.addInitScript(() => {
      try { localStorage.removeItem('cabina.sesion'); } catch { /* privado */ }
      // La barra de herramientas de Astro sólo existe en desarrollo: en producción no está y aquí taparía botones.
      document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'astro-dev-toolbar{display:none!important}'; document.head.appendChild(st); });
    });
    const p = await ctx.newPage();
    const errores = [], bitacora = [];
    notasPantalla = [];
    p.on('pageerror', e => errores.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|\[vite\]|net::ERR_ABORTED|net::ERR_FAILED/.test(m.text())) errores.push(m.text().slice(0, 200)); });
    await instalarRed(p, bitacora);

    const fotos = [];
    const foto = async (sub, principal) => {
      const nombre = `${id}${sub ? `-${sub}` : ''}`;
      await p.waitForTimeout(300);
      const med = await medir(p, principal);
      await p.screenshot({ path: join(OUT, `${nombre}.png`) });
      await p.screenshot({ path: join(OUT, `${nombre}.full.png`), fullPage: true });
      const fondo = await medirFondo(p).catch(() => []);
      const nScroll = await fotoLarga(p, join(OUT, `${nombre}.largo.png`));
      fotos.push({ nombre, ...med, fondo, contenedoresConScroll: nScroll });
    };
    let alcanzada = true, porque = '';
    try { await RECORRIDOS[id](p, foto); }
    catch (e) {
      alcanzada = false; porque = String(e?.message || e).split('\n')[0].slice(0, 200);
      await p.screenshot({ path: join(OUT, `${id}-FALLO.png`) }).catch(() => {});
    }
    const propios = errores.filter(e => !/async_hooks/.test(e));
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify({ id, ancho: ANCHO, alto: ALTO, escritorio: ESCRITORIO, alcanzada, porque, notas: notasPantalla, fotos, errores: propios, red: bitacora }, null, 2));

    // ── Lo que se imprime ──
    console.log(`━━ ${id} ${alcanzada ? '' : `✗ NO SE ALCANZÓ: ${porque}`}`);
    for (const f of fotos) {
      const ok = !f.desborde && !f.tapados.length && !f.fondo.length && !f.chicos.length && !f.textosChicos.length && !f.inputsChicos.length && !f.nPegados && (!f.accion || f.accion.sinScroll);
      if (!ok) fallasTot++;
      console.log(`  ${ok ? '✓' : '✗'} ${f.nombre}.png`);
      console.log(`     ancho: scrollWidth ${f.scrollWidth} vs ${f.ancho}${f.desborde ? '  ← DESBORDA' : ''}${f.salidos.length ? `\n       se salen: ${f.salidos.join(' · ')}` : ''}`);
      console.log(`     tocables <44px: ${f.chicos.length}/${f.tocables}${f.chicos.length ? '\n       ' + f.chicos.slice(0, 25).map(c => `«${c.t}» ${c.w}×${c.h}`).join('\n       ') + (f.chicos.length > 25 ? `\n       … y ${f.chicos.length - 25} más` : '') : ''}`);
      if (f.tapados.length) console.log(`     tocables TAPADOS por otra capa: ${f.tapados.length}\n       ${f.tapados.slice(0, 8).join('\n       ')}`);
      if (f.fondo.length) console.log(`     tapado al final del scroll: ${f.fondo.join(' · ')}`);
      if (f.nPegados) console.log(`     tocables a <8px: ${f.nPegados}\n       ${f.pegados.slice(0, 8).join('\n       ')}`);
      console.log(`     textos <12px: ${f.textosChicos.length}${f.textosChicos.length ? '\n       ' + f.textosChicos.slice(0, 15).join('\n       ') + (f.textosChicos.length > 15 ? `\n       … y ${f.textosChicos.length - 15} más` : '') : ''}  (entre 12 y 14 px: ${f.de12a14})`);
      console.log(`     inputs <16px: ${f.inputsChicos.length}${f.inputsChicos.length ? '  ' + f.inputsChicos.join(' · ') : ''}`);
      if (f.accion) console.log(`     acción principal: ${f.accion.noEncontrada ? `NO ENCONTRADA (${f.accion.texto})` : `«${f.accion.texto}» ${f.accion.w}×${f.accion.h} y=${f.accion.top} · ${f.accion.tapadaPor ? `TAPADA por «${f.accion.tapadaPor}»` : f.accion.sinScroll ? 'visible sin scroll' : 'HAY QUE HACER SCROLL'} · ${f.accion.pulgar ? 'en zona del pulgar' : 'fuera de la zona del pulgar'}${f.accion.deshabilitado ? ' · deshabilitada' : ''}`}`);
      if (f.fijos.length) console.log(`     barras fijas abajo: ${f.fijos.join(' · ')}`);
    }
    if (notasPantalla.length) console.log(`  recorrido: ${notasPantalla.join(' · ')}`);
    console.log(`  errores JS: ${propios.length}${propios.length ? '\n     ' + propios.slice(0, 5).join('\n     ') : ''}`);
    console.log(`  red simulada: ${bitacora.length} escrituras interceptadas${bitacora.length ? ` (${[...new Set(bitacora)].slice(0, 6).join(' · ')})` : ''}\n`);
    resumen.push({ id, alcanzada, fotos: fotos.length, errores: propios.length });
    await ctx.close();
  }
} finally { await nav.close(); }
console.log(`PNG y JSON en ${OUT}`);
process.exit(resumen.some(r => !r.alcanzada) ? 2 : fallasTot ? 1 : 0);
