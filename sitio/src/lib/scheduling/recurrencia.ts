// Reuniones recurrentes: convertir una REGLA en fechas concretas.
//
// La regla no se guarda para "calcular al vuelo" cada vez: se expande UNA vez y
// cada sesión queda como su propia fila. Una serie que se recalcula sola es una
// serie que se te mueve sola cuando alguien edita la regla, y aquí cada sesión
// lleva su estado, su minuta y su evento de Google. La regla se guarda solo
// para poder decir en pantalla "cada miércoles 16:00" y para extenderla.
//
// Todo se calcula en fechas locales (YYYY-MM-DD) sin tocar husos: la reunión es
// "el miércoles a las 4", no un instante UTC que se recorre con el horario de
// verano.

export type Frecuencia = 'semanal' | 'quincenal' | 'mensual';

export type ReglaSerie = {
  frecuencia: Frecuencia;
  /** Días de la semana (0=domingo … 6=sábado). Solo para semanal/quincenal. */
  dias?: number[];
  /** Cómo termina: n sesiones o una fecha tope. Nunca es infinita. */
  fin: { tipo: 'n'; n: number } | { tipo: 'fecha'; hasta: string };
};

/** Tope duro: un año de reuniones semanales. Un dedazo no llena la agenda
 *  hasta 2030, y series más largas nadie las mantiene: se extienden. */
export const MAX_SESIONES = 52;

const DIA_MS = 86400000;

const aFecha = (iso: string): Date => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const aISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Valida la regla y dice qué está mal, en lugar de devolver una lista vacía. */
export function revisarRegla(r: any): string | null {
  if (!r || typeof r !== 'object') return 'Falta la regla de repetición.';
  if (!['semanal', 'quincenal', 'mensual'].includes(r.frecuencia)) return 'Frecuencia desconocida.';
  if (r.frecuencia !== 'mensual') {
    const dias = Array.isArray(r.dias) ? r.dias.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    if (!dias.length) return 'Elige al menos un día de la semana.';
  }
  const fin = r.fin;
  if (!fin || (fin.tipo !== 'n' && fin.tipo !== 'fecha')) return 'Dile cuándo termina la serie.';
  if (fin.tipo === 'n') {
    const n = Number(fin.n);
    if (!Number.isFinite(n) || n < 1) return 'El número de reuniones no es válido.';
    if (n > MAX_SESIONES) return `El máximo son ${MAX_SESIONES} reuniones por serie. Si necesitas más, extiéndela después.`;
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fin.hasta || ''))) return 'La fecha de fin no es válida.';
  }
  return null;
}

/**
 * Expande la regla a fechas (YYYY-MM-DD), empezando en `desde` inclusive.
 *
 * `desde` SIEMPRE entra aunque no caiga en los días elegidos: es la fecha que
 * la persona escribió, y silenciarla la haría dudar de si se agendó o no.
 */
export function fechasDeSerie(desde: string, regla: ReglaSerie): string[] {
  const ini = aFecha(desde);
  const out: string[] = [aISO(ini)];

  const tope = regla.fin.tipo === 'n'
    ? Math.min(MAX_SESIONES, Math.max(1, Math.floor(regla.fin.n)))
    : MAX_SESIONES;
  const hasta = regla.fin.tipo === 'fecha' ? aFecha(regla.fin.hasta) : null;
  if (tope <= 1 && !hasta) return out;

  if (regla.frecuencia === 'mensual') {
    // "El mismo día de cada mes". Si el mes no tiene ese día (31 en febrero),
    // Date lo desborda al mes siguiente; se recorta al último día del mes para
    // que "cada 31" no se vuelva "cada 3 de marzo".
    const dia = ini.getDate();
    let i = 1;
    while (out.length < tope) {
      const d = new Date(ini.getFullYear(), ini.getMonth() + i, 1);
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dia, ultimo));
      if (hasta && d > hasta) break;
      out.push(aISO(d));
      i++;
      if (i > 400) break;
    }
    return out;
  }

  const dias = (regla.dias || []).slice().sort((a, b) => a - b);
  const saltoSemanas = regla.frecuencia === 'quincenal' ? 2 : 1;
  // Ancla: el lunes de la semana de la primera fecha. Las semanas "de descanso"
  // de la quincenal se miden contra ella, no contra la fecha suelta.
  const ancla = new Date(ini);
  ancla.setDate(ancla.getDate() - ((ancla.getDay() + 6) % 7));

  const cursor = new Date(ini);
  let guardia = 0;
  while (out.length < tope && guardia++ < 1000) {
    cursor.setDate(cursor.getDate() + 1);
    if (hasta && cursor > hasta) break;
    if (!dias.includes(cursor.getDay())) continue;
    if (saltoSemanas > 1) {
      const semanas = Math.floor((cursor.getTime() - ancla.getTime()) / (7 * DIA_MS));
      if (semanas % saltoSemanas !== 0) continue;
    }
    const iso = aISO(cursor);
    if (!out.includes(iso)) out.push(iso);
  }
  return out;
}

/** Cómo se lee la serie en pantalla: "cada miércoles · 5 sesiones". */
export function describirSerie(regla: ReglaSerie, total: number, hora?: string): string {
  const NOM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  let cada: string;
  if (regla.frecuencia === 'mensual') cada = 'cada mes';
  else {
    const ds = (regla.dias || []).slice().sort((a, b) => a - b).map(d => NOM[d]);
    const lista = ds.length > 1 ? ds.slice(0, -1).join(', ') + ' y ' + ds[ds.length - 1] : (ds[0] || '');
    cada = (regla.frecuencia === 'quincenal' ? 'cada dos semanas, ' : 'cada ') + lista;
  }
  return [cada, hora ? hora.slice(0, 5) : '', `${total} ${total === 1 ? 'sesión' : 'sesiones'}`]
    .filter(Boolean).join(' · ');
}
