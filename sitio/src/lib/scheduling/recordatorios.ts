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

/** Lee la configuración de un tipo de reunión sin confiar en su forma. */
export function leerRecordatorios(raw: any): Recordatorio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && r.activo !== false && (r.email || r.whatsapp))
    .map((r, i) => ({
      id: String(r.id || `r${i + 1}`),
      cantidad: Math.max(0, Number(r.cantidad) || 0),
      unidad: (UNIDADES.some(u => u.v === r.unidad) ? r.unidad : 'minutos') as Unidad,
      email: !!r.email, whatsapp: !!r.whatsapp, activo: true,
    }))
    .filter(r => r.cantidad > 0)
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
export function datosEmail(b: DatosReunion, anticipacion?: string) {
  return {
    nombre: b.invitee_nombre || '',
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

export const PLANTILLA_CLIENTE = 'reunion_recordatorio';
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
    const f = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
    return `${f.format(d)} en tu zona (${tz})`;
  } catch { return ''; }
}

/** «sesión 2 de 3» — sin esto, en una capacitación nadie sabe en cuál va. */
export function etiquetaSerie(b: { serie_indice?: number | null; serie_total?: number | null }): string {
  const i = Number(b?.serie_indice), n = Number(b?.serie_total);
  return i > 0 && n > 1 ? `sesión ${i} de ${n}` : '';
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
