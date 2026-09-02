// ══ Recordatorios de reunión: las reglas, en un solo lugar ═════════════════
//
// Antes los dos recordatorios que existían estaban ESCRITOS EN EL CRON: correo
// a las 24 h, WhatsApp a la hora. No se podían cambiar, ni agregar otro, ni
// elegir canal, y un recordatorio de 10 minutos era imposible porque el cron
// corría cada hora. Ahora la política vive en `event_types.recordatorios` y
// aquí solo está cómo se interpreta y cómo se redacta.
//
// TODO texto que sale de aquí dice la hora Y que es de CDMX. Una reunión sin
// huso es una reunión a la que alguien llega tarde: el cliente puede estar en
// Tijuana o en Cancún, que son dos horas de diferencia entre sí.

/** México abolió el horario de verano en 2022: CDMX es UTC−6 fijo. */
export const MX_OFFSET_MS = 6 * 3600000;
export const TZ_ETIQUETA = 'hora del centro de México (CDMX)';

export type Unidad = 'minutos' | 'horas' | 'dias' | 'semanas';
export type Recordatorio = {
  id: string; cantidad: number; unidad: Unidad;
  email: boolean; whatsapp: boolean; activo: boolean;
};

export const UNIDADES: { v: Unidad; l: string; l1: string; min: number }[] = [
  { v: 'minutos', l: 'minutos', l1: 'minuto', min: 1 },
  { v: 'horas',   l: 'horas',   l1: 'hora',   min: 60 },
  { v: 'dias',    l: 'días',    l1: 'día',    min: 1440 },
  { v: 'semanas', l: 'semanas', l1: 'semana', min: 10080 },
];

/** Cuántos minutos ANTES del inicio cae este recordatorio. */
export function aMinutos(r: { cantidad: number; unidad: Unidad }): number {
  const u = UNIDADES.find(x => x.v === r.unidad);
  return Math.max(0, Math.round(Number(r.cantidad) || 0)) * (u ? u.min : 1);
}

/** «1 día», «3 horas», «10 minutos» — singular cuando toca. */
export function etiqueta(r: { cantidad: number; unidad: Unidad }): string {
  const u = UNIDADES.find(x => x.v === r.unidad) || UNIDADES[0];
  const n = Math.round(Number(r.cantidad) || 0);
  return `${n} ${n === 1 ? u.l1 : u.l}`;
}

/**
 * La MISMA etiqueta, pero dicha sobre el tiempo que falta de verdad.
 *
 * El cron corre cada 5 minutos y dispara en cuanto el faltante entra a la
 * ventana, nunca después —un «1 día antes» que llega tarde anuncia una hora
 * que ya no es—. El precio es que sale algo antes de la marca, y el rótulo
 * salía de la configuración, no del reloj: el recordatorio de «10 minutos»
 * llegó cuando faltaban 15 y aun así dijo «es en 10 minutos». En un día de
 * anticipación cinco minutos no se notan; en diez, es la mitad.
 *
 * Se redondea en la unidad del recordatorio para que siga sonando a persona:
 * 15 → «15 minutos», 185 → «3 horas», 1500 → «1 día».
 */
export function etiquetaReal(r: { cantidad: number; unidad: Unidad }, faltaMin: number): string {
  const u = UNIDADES.find(x => x.v === r.unidad) || UNIDADES[0];
  const falta = Number(faltaMin);
  if (!Number.isFinite(falta) || falta <= 0) return etiqueta(r);
  const n = Math.max(1, Math.round(falta / u.min));
  return `${n} ${n === 1 ? u.l1 : u.l}`;
}

/** Lee la configuración de un tipo de reunión sin confiar en su forma. */
export function leerRecordatorios(raw: any): Recordatorio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && r.activo !== false && (r.email || r.whatsapp))
    .map((r, i) => ({
      id: String(r.id || `r${i + 1}`),
      cantidad: Math.max(0, Number(r.cantidad) || 0),
      /* Una unidad que no reconocemos se DESCARTA (queda como null y el
         filtro de abajo la tira). Degradarla a minutos era peor que fallar:
         «5 semanas» se volvía «5 minutos» y el aviso salía cinco minutos
         antes diciendo «5 minutos» — un recordatorio equivocado en vez de
         ninguno. Pasa con datos que no vienen de la pantalla (SQL a mano,
         importaciones). */
      unidad: (UNIDADES.some(u => u.v === r.unidad) ? r.unidad : null) as Unidad,
      email: !!r.email, whatsapp: !!r.whatsapp, activo: true,
    }))
    .filter(r => r.cantidad > 0 && !!r.unidad)
    /* De mayor a menor anticipación: si dos caen en la misma corrida del cron,
       manda el más lejano — decir «falta 1 día» cuando ya faltan 3 horas es
       peor que no decir nada. */
    .sort((a, b) => aMinutos(b) - aMinutos(a));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «martes 2 de septiembre de 2026» — el día de la semana ayuda a ubicarse. */
export function fmtFechaLarga(f: string): string {
  const [y, m, d] = String(f).split('-').map(Number);
  if (!y || !m || !d) return String(f);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]} de ${y}`;
}

/** «4:30 p.m.» — 12 h, que es como se lee la hora en México. */
export function fmtHora(t: string): string {
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h)) return String(t);
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

/** El instante de inicio, en milisegundos. La reunión se guarda en hora CDMX. */
export function inicioMs(fecha: string, hora: string): number {
  return new Date(`${fecha}T${String(hora).slice(0, 5)}:00-06:00`).getTime();
}

export function fmtRango(hora: string, duracion?: number | null): string {
  if (!duracion) return fmtHora(hora);
  const [h, m] = String(hora).split(':').map(Number);
  const fin = new Date(Date.UTC(2000, 0, 1, h, m || 0) + duracion * 60000);
  return `${fmtHora(hora)} a ${fmtHora(`${fin.getUTCHours()}:${String(fin.getUTCMinutes()).padStart(2, '0')}`)}`;
}

export type DatosReunion = {
  invitee_nombre?: string | null; fecha: string; hora_inicio: string;
  google_meet_link?: string | null; token_cancelar?: string | null; token_reagendar?: string | null;
  event_types?: { nombre?: string; duracion_minutos?: number | null; ubicacion_tipo?: string | null } | null;
};

const BASE = 'https://www.sacscloud.com';
export const urlReagendar = (b: DatosReunion) => b.token_reagendar ? `${BASE}/agendar/reagendar?token=${b.token_reagendar}` : '';
export const urlCancelar = (b: DatosReunion) => b.token_cancelar ? `${BASE}/agendar/cancelar?token=${b.token_cancelar}` : '';

/**
 * El texto de WhatsApp. Uno solo para confirmación y recordatorios: cambia el
 * encabezado, no los datos. Que el cliente reciba SIEMPRE los mismos campos en
 * el mismo orden es lo que hace que no tenga que leerlo entero para encontrar
 * la liga.
 */
export function textoWhatsApp(b: DatosReunion, anticipacion?: string): string {
  const evento = b.event_types?.nombre || 'reunión';
  const nombre = (b.invitee_nombre || '').split(' ')[0];
  const encabezado = anticipacion
    ? `Recordatorio: tu ${evento} con Sacs es en ${anticipacion}.`
    : `Listo${nombre ? ` ${nombre}` : ''}, tu ${evento} con Sacs quedó agendada.`;
  return [
    encabezado,
    ``,
    `Fecha: ${fmtFechaLarga(b.fecha)}`,
    `Hora: ${fmtRango(b.hora_inicio, b.event_types?.duracion_minutos)} — ${TZ_ETIQUETA}`,
    b.event_types?.duracion_minutos ? `Dura: ${b.event_types.duracion_minutos} minutos` : '',
    b.google_meet_link ? `` : '',
    b.google_meet_link ? `Te conectas aquí:` : '',
    b.google_meet_link ? b.google_meet_link : `Te mandamos la liga de la videollamada antes de la sesión.`,
    ``,
    urlReagendar(b) ? `¿No te queda? Reagenda sin pena: ${urlReagendar(b)}` : '',
  ].filter(l => l !== undefined && l !== null && l !== '' || l === '').join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Los datos que necesita la plantilla de correo. Mismos campos, mismo orden. */
export function datosEmail(b: DatosReunion, anticipacion?: string, faltaMin?: number) {
  /* ¿Este correo es de los que PREPARAN la sesión? Misma regla que el
     WhatsApp: con una hora o más todavía da tiempo de contestar y de que
     nosotros preparemos algo; diez minutos antes, pedirle a alguien que te
     cuente su operación llega tarde para los dos. */
  const prepara = Number.isFinite(Number(faltaMin)) ? Number(faltaMin) >= CORTE_PREP_MIN : false;
  return {
    prepara,
    nombre: b.invitee_nombre || '',
    /* `fecha` a secas es lo que LEE la plantilla booking_reminder (asunto,
       HTML y texto plano). Pasar solo `fecha_larga` dejaba el correo sin
       fecha: «tu Demo es en 3 horas —  4:30 p.m.» y «📅  a las 4:30 p.m.».
       Se mandan las dos para no depender de cuál lea la plantilla. */
    fecha: fmtFechaLarga(b.fecha),
    evento: b.event_types?.nombre || 'reunión',
    anticipacion: anticipacion || '',
    cuando: anticipacion ? `en ${anticipacion}` : '',
    fecha_larga: fmtFechaLarga(b.fecha),
    hora: fmtRango(b.hora_inicio, b.event_types?.duracion_minutos),
    zona: TZ_ETIQUETA,
    duracion: b.event_types?.duracion_minutos || null,
    meet_link: b.google_meet_link || '',
    reagendar_url: urlReagendar(b),
    cancelar_url: urlCancelar(b),
    confirmar_url: b.token_cancelar ? `${BASE}/api/scheduling/confirm-attendance?token=${b.token_cancelar}` : '',
  };
}

// ══ Los parámetros de las plantillas de WhatsApp ═══════════════════════════
//
// SIEMPRE se manda por PLANTILLA, sin excepción. Medido el 31-ago: de 280
// conversaciones solo 8 tenían la ventana de 24 h abierta, o sea que el texto
// libre habría fallado en el 97% de los casos — y en silencio, porque el
// error moría en la respuesta del cron. La plantilla llega siempre.

/* La que ya estaba aprobada. Se queda como RESPALDO: mientras Meta revisa las
   nuevas, los recordatorios siguen saliendo. Un flujo que funciona no se
   apaga esperando un trámite. */
export const PLANTILLA_CLIENTE = 'reunion_recordatorio';

/**
 * DOS mensajes, no uno.
 *
 * Decisión del dueño (2-sep-2026): el recordatorio también tiene que servir
 * para PREPARAR la sesión — que el cliente cuente cómo trabaja, por escrito o
 * en nota de voz, para llegar con algo hecho a su medida en vez de una demo
 * genérica.
 *
 * Pero eso no cabe en los tres recordatorios por igual: pedirle a alguien que
 * te cuente su operación **diez minutos antes** llega tarde para él y para
 * nosotros. Así que el que va lejos pide contexto y el que va encima solo
 * recuerda y da la liga.
 */
export const PLANTILLA_CLIENTE_PREP = 'reunion_recordatorio_prep';   // ≥ 1 hora
export const PLANTILLA_CLIENTE_CERCA = 'reunion_recordatorio_ya';    // < 1 hora
/** El corte. Con una hora todavía da tiempo de oír la nota y preparar algo. */
export const CORTE_PREP_MIN = 60;

/* ══ EL HORARIO EN QUE SE PUEDE MANDAR UN RECORDATORIO ═══════════════════
   Decisión del dueño (2-sep-2026): los recordatorios solo salen en horario
   laboral, 8:00 a 18:00. Un aviso a las 6 de la mañana o a las 11 de la noche
   no lo lee nadie —y sí quema la conversación—, así que la hora ideal no
   manda por sí sola: hay que preguntarse si a esa hora tiene sentido.

   Vive en el CRM (Reuniones ▸ Avisos al cliente), no aquí: cambiar la
   ventana no puede pedir un despliegue. */
export type HorarioEnvio = {
  desde: string; hasta: string;
  /** Cae ANTES de abrir: 'mover' lo recorre a la hora de apertura. */
  temprano: 'mover' | 'cancelar';
  /** Cae DESPUÉS de cerrar: por omisión ese recordatorio no sale. */
  tarde: 'mover' | 'cancelar';
};

export const HORARIO_ENVIO: HorarioEnvio = {
  desde: '08:00', hasta: '18:00', temprano: 'mover', tarde: 'cancelar',
};

const aMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
};

/** Lee la configuración sin confiar en su forma. Lo que no entienda, default. */
export function leerHorarioEnvio(raw: any): HorarioEnvio {
  const r = raw || {};
  const desde = aMin(r.desde) != null ? String(r.desde) : HORARIO_ENVIO.desde;
  const hasta = aMin(r.hasta) != null ? String(r.hasta) : HORARIO_ENVIO.hasta;
  /* Una ventana invertida (cierra antes de abrir) no se "interpreta": se
     descarta entera. Adivinar qué quiso decir es cómo se acaba mandando a las
     3 de la mañana. */
  if ((aMin(desde) as number) >= (aMin(hasta) as number)) return HORARIO_ENVIO;
  const modo = (x: any, d: 'mover' | 'cancelar') => (x === 'mover' || x === 'cancelar' ? x : d);
  return {
    desde, hasta,
    temprano: modo(r.temprano, HORARIO_ENVIO.temprano),
    tarde: modo(r.tarde, HORARIO_ENVIO.tarde),
  };
}

/**
 * A qué hora se manda DE VERDAD este recordatorio. `null` = no se manda.
 *
 * Se razona en hora del centro de México, que es la del negocio y la que
 * anuncian todos los mensajes.
 */
export function cuandoMandar(inicioReunion: number, anticipacionMin: number, h: HorarioEnvio = HORARIO_ENVIO): number | null {
  const inicio = Number(inicioReunion);
  const antes = Number(anticipacionMin);
  if (!Number.isFinite(inicio) || !Number.isFinite(antes)) return null;
  const ideal = inicio - antes * 60000;

  const desdeMin = aMin(h.desde) as number;
  const hastaMin = aMin(h.hasta) as number;

  /* La hora de pared en CDMX: `inicioMs` arma los instantes con -06:00, así
     que restarle el desfase y leerlo en UTC devuelve la hora local. */
  const local = new Date(ideal - MX_OFFSET_MS);
  const minutoDelDia = local.getUTCHours() * 60 + local.getUTCMinutes();
  const medianoche = ideal - minutoDelDia * 60000;

  if (minutoDelDia < desdeMin) {
    if (h.temprano === 'cancelar') return null;
    const movido = medianoche + desdeMin * 60000;
    /* Recorrerlo solo sirve si sigue siendo ANTES de la reunión: un
       "recordatorio" que llega cuando ya empezó no recuerda nada. */
    return movido < inicio ? movido : null;
  }
  if (minutoDelDia > hastaMin) {
    if (h.tarde === 'cancelar') return null;
    const movido = medianoche + hastaMin * 60000;
    return movido < inicio ? movido : null;
  }
  return ideal;
}

/** Cuál de las dos toca, según lo que falte de verdad. */
export function plantillaCliente(faltaMin: number): string {
  const f = Number(faltaMin);
  if (!Number.isFinite(f)) return PLANTILLA_CLIENTE_CERCA;
  return f >= CORTE_PREP_MIN ? PLANTILLA_CLIENTE_PREP : PLANTILLA_CLIENTE_CERCA;
}
export const PLANTILLA_HOST = 'reunion_recordatorio_host';
export const IDIOMA_PLANTILLA = 'es_MX';

/** Meta rechaza saltos de línea y tabs dentro de un parámetro. */
const limpio = (t: string) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, 900) || '—';

/** «miércoles 2 de septiembre de 2026, 4:30 p.m. a 5:30 p.m.» */
export function cuandoLargo(b: DatosReunion): string {
  return `${fmtFechaLarga(b.fecha)}, ${fmtRango(b.hora_inicio, b.event_types?.duracion_minutos)}`;
}

/**
 * La hora del invitado, cuando NO vive en CDMX. Decir solo «hora del centro de
 * México» es correcto pero le deja la cuenta a él, y una resta mal hecha es
 * una reunión perdida. Devuelve '' si es la misma zona o si no la sabemos.
 */
export function horaLocalInvitado(b: DatosReunion & { timezone_invitado?: string | null }): string {
  const tz = (b.timezone_invitado || '').trim();
  if (!tz || tz === 'America/Mexico_City') return '';
  try {
    const d = new Date(inicioMs(b.fecha, b.hora_inicio));
    const hora = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    /* Con el DÍA cuando allá es otro. `timezone_invitado` lo llena el
       navegador del que agenda, así que puede ser cualquier zona del mundo:
       una reunión a las 8 p.m. de CDMX es la madrugada del día SIGUIENTE en
       Madrid, y decir solo «4:00 a.m.» junto a una fecha de CDMX manda a
       alguien el día equivocado. */
    const diaCdmx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(d);
    const diaAlla = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    const dia = diaAlla !== diaCdmx ? `${fmtFechaLarga(diaAlla)}, ` : '';
    /* La ciudad, no el identificador: «America/Chicago» es jerga de sistemas
       y el cliente no tiene por qué leerla. */
    const ciudad = tz.split('/').pop()!.replace(/_/g, ' ');
    return `${dia}${hora} en tu zona (${ciudad})`;
  } catch { return ''; }
}

/** «sesión 2 de 3» — sin esto, en una capacitación nadie sabe en cuál va. */
export function etiquetaSerie(b: { serie_indice?: number | null; serie_total?: number | null }): string {
  const i = Number(b?.serie_indice), n = Number(b?.serie_total);
  return i > 0 && n > 1 ? `sesión ${i} de ${n}` : '';
}

/**
 * El texto de la plantilla YA RESUELTO, para espejarlo en el inbox.
 *
 * El espejo guardaba el rótulo «Recordatorio de reunión (3 horas antes)» —
 * un título, no el mensaje. Quien abría el chat no podía saber qué le llegó
 * de verdad al cliente, que es justo para lo que existe el espejo. Este texto
 * es el cuerpo aprobado de `reunion_recordatorio` con sus 5 variables puestas.
 */
export function textoPlantillaCliente(p: string[], plantilla: string = PLANTILLA_CLIENTE): string {
  const botones = `[Botones: «Ahí estaré» · «Reagendar»]`;
  const cuando = `Cuándo: ${p[3]} — hora del centro de México (CDMX).`;

  if (plantilla === PLANTILLA_CLIENTE_PREP) {
    return [
      `Hola ${p[0]} 👋 Te recuerdo tu ${p[1]}: es en ${p[2]}.`,
      ``,
      cuando,
      `Dónde: ${p[4]}`,
      ``,
      `Para que te sirva de verdad, cuéntame antes cómo trabajas hoy: cuántas tiendas manejas, con qué vendes y qué es lo que más te complica del día.`,
      ``,
      `Si se te hace más fácil, mándame una nota de voz 🎙️ — así me lo cuentas rápido y yo entiendo todo.`,
      ``,
      `Con eso preparo la sesión sobre tu operación y te enseño justo lo que te resuelve, en vez de una demo genérica.`,
      ``,
      `¿Te queda bien el horario? Si no, dímelo por aquí y la movemos.`,
      ``,
      botones,
    ].join('\n');
  }

  if (plantilla === PLANTILLA_CLIENTE_CERCA) {
    return [
      `Hola ${p[0]} 👋 Tu ${p[1]} es en ${p[2]}.`,
      ``,
      cuando,
      `Entra por aquí: ${p[4]}`,
      ``,
      `Si algo se te atravesó, dímelo por aquí y la movemos sin problema.`,
      ``,
      botones,
    ].join('\n');
  }

  // La de respaldo, la que ya estaba aprobada.
  return [
    `Hola ${p[0]}, te recordamos tu ${p[1]} con Sacs: es en ${p[2]}.`,
    ``,
    cuando,
    `Dónde: ${p[4]}`,
    ``,
    `Si no te queda, respóndenos por aquí y la movemos.`,
    ``,
    botones,
  ].join('\n');
}

/** Lo mismo para la del host. */
export function textoPlantillaHost(p: string[]): string {
  return [
    `Recordatorio: tienes ${p[0]} en ${p[1]}.`,
    ``,
    `Con: ${p[2]}`,
    `Cuándo: ${p[3]} — hora del centro de México (CDMX).`,
    `Dónde: ${p[4]}`,
    ``,
    `Si ya no puedes, avísale al cliente y muévela desde el CRM.`,
  ].join('\n');
}

/** Los 5 parámetros de `reunion_recordatorio`, en orden. */
export function paramsCliente(b: DatosReunion & { timezone_invitado?: string | null; serie_indice?: number | null; serie_total?: number | null }, anticipacion: string): string[] {
  const serie = etiquetaSerie(b);
  const local = horaLocalInvitado(b);
  return [
    limpio((b.invitee_nombre || '').split(' ')[0] || 'hola'),
    limpio(b.event_types?.nombre || 'reunión') + (serie ? ` (${serie})` : ''),
    limpio(anticipacion),
    limpio(cuandoLargo(b)) + (local ? ` · ${local}` : ''),
    limpio(b.google_meet_link || 'te mandamos la liga antes de la sesión'),
  ].map(limpio);
}

/** Los 5 de `reunion_recordatorio_host`. */
export function paramsHost(b: DatosReunion & { invitee_empresa?: string | null; serie_indice?: number | null; serie_total?: number | null }, anticipacion: string): string[] {
  const serie = etiquetaSerie(b);
  const quien = [b.invitee_nombre, b.invitee_empresa ? `(${b.invitee_empresa})` : ''].filter(Boolean).join(' ');
  return [
    limpio(b.event_types?.nombre || 'reunión') + (serie ? ` (${serie})` : ''),
    limpio(anticipacion),
    limpio(quien || 'un cliente'),
    limpio(cuandoLargo(b)),
    limpio(b.google_meet_link || 'sin liga de Meet todavía'),
  ].map(limpio);
}
