// TRABAJO INTELIGENTE · Las reglas del motor — la cadencia, los tipos y los
// textos. Spec completo: sitio/PLAN-TRABAJO-INTELIGENTE.md (6 rondas).
//
// Todo lo que un humano querría ajustar sin leer el motor vive AQUÍ o en la
// fila de ti_config; motor.ts solo ejecuta.

/** CDMX es UTC-6 FIJO: México abolió el horario de verano en 2022. */
export const TZ_OFFSET_H = 6;
const MS_H = 3600e3, MS_D = 86400e3;

export type PasoId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8';

/** La cadencia aprobada: 9 toques en ~3 semanas (4 llamadas, 3 WA, 2 correos —
 *  el T0 automático lo manda el flujo de entrada, no este motor).
 *  `espera` = días DESPUÉS del paso anterior (reloj relativo al último toque:
 *  así la cadencia se DESLIZA cuando un día no se trabaja, sin duplicarse). */
export const PASOS: { paso: PasoId; espera: number; tipo: 'llamada' | 'wa_plantilla' | 'correo'; bloque: 'am' | 'pm' }[] = [
  { paso: 'T1', espera: 0, tipo: 'llamada', bloque: 'am' },
  { paso: 'T2', espera: 2, tipo: 'llamada', bloque: 'pm' },
  { paso: 'T3', espera: 1, tipo: 'wa_plantilla', bloque: 'am' },
  { paso: 'T4', espera: 1, tipo: 'llamada', bloque: 'am' },
  { paso: 'T5', espera: 3, tipo: 'correo', bloque: 'am' },
  { paso: 'T6', espera: 3, tipo: 'wa_plantilla', bloque: 'pm' },
  { paso: 'T7', espera: 4, tipo: 'llamada', bloque: 'pm' },
  { paso: 'T8', espera: 4, tipo: 'wa_plantilla', bloque: 'am' },
];

export const pasoDef = (p: string) => PASOS.find(x => x.paso === p) || null;
export const pasoSiguiente = (p: string, saltarLlamadas = false): typeof PASOS[number] | null => {
  const i = PASOS.findIndex(x => x.paso === p);
  if (i < 0) return null;
  for (let k = i + 1; k < PASOS.length; k++) {
    if (saltarLlamadas && PASOS[k].tipo === 'llamada') continue;
    return PASOS[k];
  }
  return null;
};

/** Resultados de llamada — específicos del tipo (decisión de la 3ª ronda). */
export const RESULTADOS_LLAMADA = ['contesto', 'buzon', 'no_contesto', 'ocupado', 'numero_malo'] as const;
export const RESULTADOS_LLAMADA_L: Record<string, string> = {
  contesto: 'Contestó', buzon: 'Buzón', no_contesto: 'No contestó',
  ocupado: 'Ocupado', numero_malo: 'Número malo',
};

/** Los textos de cadencia — tono tú-cercano mexicano (6ª ronda). {nombre} se
 *  interpola con el primer nombre. Cuando exista la wiki comercial (F5), la
 *  IA personaliza por giro; estos son el piso que siempre funciona. */
export const TEXTOS: Record<string, { instr: (n: string, x?: any) => string; mensaje?: (n: string) => string; asunto?: (n: string) => string }> = {
  T1: { instr: n => `Llámale a ${n} — acaba de entrar` },
  T2: { instr: n => `Llámale a ${n} — 2º intento, otro horario` },
  T3: {
    instr: n => `Mándale el «te busqué» a ${n}`,
    mensaje: n => `Hola ${n}, soy del equipo de Sacscloud. Te marqué un par de veces para platicar cómo controlar tu inventario y tus ventas en un solo lugar. ¿Te queda bien una llamada rápida hoy o mañana? Dime tu horario y yo me acomodo.`,
  },
  T4: { instr: n => `Llámale a ${n} — 3er intento` },
  T5: {
    instr: n => `Correo personalizado para ${n}`,
    asunto: n => `¿Sigues buscando ordenar tu negocio, ${n}?`,
    mensaje: n => `Hola ${n}:\n\nTe escribí por WhatsApp y te marqué un par de veces — no quiero ser insistente, solo dejarte esto: si ordenar tu inventario y tus ventas sigue en tu lista, en 15 minutos te enseño cómo se ve tu negocio adentro de Sacscloud.\n\nY si no es el momento, dime y no te busco más.\n\nSaludos`,
  },
  T6: {
    instr: n => `WhatsApp con ángulo nuevo para ${n}`,
    mensaje: n => `Hola ${n}, te comparto algo corto: negocios como el tuyo usan Sacscloud para dejar de perder ventas por falta de control de inventario. Si me das 15 minutos te enseño cómo se vería el tuyo. ¿Va?`,
  },
  T7: { instr: n => `Llámale a ${n} — último intento` },
  T8: {
    instr: n => `Cierre con ${n}: ¿lo dejamos aquí?`,
    mensaje: n => `${n}, no logré encontrarte y no quiero saturarte. Si el tema sigue vivo, contéstame y lo retomamos cuando digas; si no, aquí quedo para cuando lo necesites. ¡Éxito con tu negocio!`,
  },
};

export const TIPO_LLAMADA: Record<string, string> = {
  T1: 'Primera llamada · cadencia', T2: 'Seguimiento de cadencia',
  T4: 'Seguimiento de cadencia', T7: 'Seguimiento de cadencia',
};

export const MOTIVOS_OMITIR = ['ya_contactado', 'mal_momento', 'dato_malo', 'duplicado', 'no_aplica', 'otro'] as const;

/** Config viva (fila única de ti_config). Estos son los DEFAULTS si falta. */
export const CONFIG_DEFAULT = {
  horario: { ini: 9, fin: 18, tz: 'America/Mexico_City' },
  sla_p1_min: 15,
  feriados: 'ignorar' as 'ignorar' | 'calendario_mx',
  capacidad_pct: 80,
  max_por_dia: { llamada: 1, mensaje: 1 },
  cadencia_max_dias: 35,
  valvula_plantilla_horas: 24,
  alerta_gasto_ia_usd: 200,
  /** null = el motor NO auto-enrola a nadie todavía (el switch del arranque). */
  arranque_desde: null as string | null,
};
export type TiConfig = typeof CONFIG_DEFAULT;

/* ── Tiempo en CDMX ── */
export const horaLocal = (d: Date) => ((d.getUTCHours() - TZ_OFFSET_H) % 24 + 24) % 24;
export const diaLocal = (d: Date) => new Date(d.getTime() - TZ_OFFSET_H * MS_H).getUTCDay(); // 0=dom … 6=sáb
export const esHorarioLaboral = (d: Date, cfg: TiConfig) => {
  const dia = diaLocal(d), h = horaLocal(d);
  return dia >= 1 && dia <= 5 && h >= cfg.horario.ini && h < cfg.horario.fin;
};

/** Devuelve `base + dias` puesto a la HORA correcta: la mejor hora aprendida
 *  del lead si existe, si no el bloque del paso (am 10:00 / pm 16:00) — y
 *  nunca en fin de semana (se recorre al lunes). */
export function programar(base: Date, dias: number, cfg: TiConfig, bloque: 'am' | 'pm', mejorHora?: number | null): Date {
  let objetivo = mejorHora ?? (bloque === 'pm' ? 16 : 10);
  objetivo = Math.min(Math.max(objetivo, cfg.horario.ini), cfg.horario.fin - 1);
  // fija fecha local (CDMX) y la hora objetivo
  const local = new Date(base.getTime() - TZ_OFFSET_H * MS_H + dias * MS_D);
  local.setUTCHours(objetivo, 0, 0, 0);
  let res = new Date(local.getTime() + TZ_OFFSET_H * MS_H);
  // si por el redondeo quedó en el pasado, al siguiente día hábil
  if (res.getTime() < base.getTime() && dias > 0) res = new Date(res.getTime() + MS_D);
  while ([0, 6].includes(diaLocal(res))) res = new Date(res.getTime() + MS_D);
  return res;
}

/** El arranque del T1: si es horario laboral, AHORA (speed-to-lead <30 min);
 *  si no, la primera hora hábil siguiente. */
export function arranqueT1(ahora: Date, cfg: TiConfig): Date {
  if (esHorarioLaboral(ahora, cfg)) return ahora;
  let res = new Date(ahora.getTime() - TZ_OFFSET_H * MS_H);
  if (horaLocal(ahora) >= cfg.horario.fin || diaLocal(ahora) === 0 || diaLocal(ahora) === 6) res = new Date(res.getTime() + MS_D);
  res.setUTCHours(cfg.horario.ini, 0, 0, 0);
  let out = new Date(res.getTime() + TZ_OFFSET_H * MS_H);
  while ([0, 6].includes(diaLocal(out))) out = new Date(out.getTime() + MS_D);
  return out;
}

export const primerNombre = (c: { nombre?: string | null }) =>
  String(c?.nombre || 'Hola').trim().split(/\s+/)[0].replace(/^./, x => x.toUpperCase());
