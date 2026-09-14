/**
 * Zonas horarias del agendador — del lado del navegador (sin supabase).
 *
 * La agenda vive en hora del centro de México (el anfitrión) y se vende fuera
 * del país. Todo lo que el invitado ve tiene que estar en SU hora, con SU
 * fecha: las 5:00 p.m. de CDMX son la 1:00 a.m. del día siguiente en Madrid.
 * Lo usan la página de agendar y la de reagendar; antes cada una traía su
 * copia y la de reagendar ni convertía.
 */

export const TZ_ANFITRION = 'America/Mexico_City';

export function getOffsetMinutes(tz: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: tz });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** El nombre de una zona que no está en la lista: la ciudad del identificador. */
export function nombreDeZona(tz: string): string {
  return (tz.split('/').pop() || tz).replace(/_/g, ' ');
}

/** «GMT+2» de una zona hoy, para que la etiqueta diga algo verificable. */
export function desfaseGmt(tz: string): string {
  try {
    const min = getOffsetMinutes(tz, new Date());
    if (min === 0) return 'GMT';
    const signo = min > 0 ? '+' : '-';
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `GMT${signo}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  } catch { return ''; }
}

/* Hora y fecha LOCALES del invitado para un horario del anfitrión. El día
   puede cambiar: las 5:00 p.m. de CDMX son la 1:00 a.m. del día SIGUIENTE en
   Madrid, y mostrar «1:00 AM» bajo la fecha de México manda a alguien el día
   equivocado. */
export function fechaHoraLocal(time24: string, dateStr: string, hostTz: string, localTz: string): { fecha: string; hora: string } {
  if (hostTz === localTz) return { fecha: dateStr, hora: time24 };
  try {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m] = time24.split(':').map(Number);
    const ref = new Date(Date.UTC(y, mo - 1, d, 12));
    const utcMs = Date.UTC(y, mo - 1, d, h, m) - getOffsetMinutes(hostTz, ref) * 60000;
    const local = new Date(utcMs + getOffsetMinutes(localTz, new Date(utcMs)) * 60000);
    const fecha = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
    const hora = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
    return { fecha, hora };
  } catch {
    return { fecha: dateStr, hora: time24 };
  }
}

/** En Europa la hora se lee en 24 h («18:00»); en América, con AM/PM. */
export function fmtHoraZona(time24: string, tz: string): string {
  return tz.startsWith('Europe/') || tz.startsWith('Africa/') ? time24 : to12h(time24);
}

/* Lada del país según la zona horaria, para el campo de WhatsApp: el
   servidor solo acepta un número sin «+» cuando es mexicano o de EE. UU.; a
   los nueve dígitos de un móvil español sin el +34 no les manda nada. Aquí se
   sugiere la lada en el campo y se antepone al enviar si la persona escribió
   solo su número local. */
export const LADA_POR_ZONA: Record<string, { lada: string; largo: number; ejemplo: string }> = {
  'Europe/Madrid': { lada: '+34', largo: 9, ejemplo: '+34 612 345 678' },
  'Europe/Lisbon': { lada: '+351', largo: 9, ejemplo: '+351 912 345 678' },
  'Europe/London': { lada: '+44', largo: 10, ejemplo: '+44 7400 123456' },
  'Europe/Paris': { lada: '+33', largo: 9, ejemplo: '+33 6 12 34 56 78' },
  'Europe/Rome': { lada: '+39', largo: 10, ejemplo: '+39 312 345 6789' },
  'America/Bogota': { lada: '+57', largo: 10, ejemplo: '+57 310 123 4567' },
  'America/Lima': { lada: '+51', largo: 9, ejemplo: '+51 912 345 678' },
  'America/Guayaquil': { lada: '+593', largo: 9, ejemplo: '+593 99 123 4567' },
  'America/Caracas': { lada: '+58', largo: 10, ejemplo: '+58 412 123 4567' },
  'America/Santiago': { lada: '+56', largo: 9, ejemplo: '+56 9 1234 5678' },
  'America/Argentina/Buenos_Aires': { lada: '+54', largo: 10, ejemplo: '+54 9 11 1234 5678' },
  'America/Montevideo': { lada: '+598', largo: 8, ejemplo: '+598 91 234 567' },
  'America/Sao_Paulo': { lada: '+55', largo: 11, ejemplo: '+55 11 91234 5678' },
  'America/Guatemala': { lada: '+502', largo: 8, ejemplo: '+502 5123 4567' },
  'America/Costa_Rica': { lada: '+506', largo: 8, ejemplo: '+506 8123 4567' },
  'America/Panama': { lada: '+507', largo: 8, ejemplo: '+507 6123 4567' },
  'America/New_York': { lada: '+1', largo: 10, ejemplo: '+1 305 123 4567' },
  'America/Chicago': { lada: '+1', largo: 10, ejemplo: '+1 312 123 4567' },
  'America/Los_Angeles': { lada: '+1', largo: 10, ejemplo: '+1 213 123 4567' },
};

export function ladaDeZona(tz: string) {
  if (LADA_POR_ZONA[tz]) return LADA_POR_ZONA[tz];
  if (tz.startsWith('America/') || !tz.includes('/')) return { lada: '+52', largo: 10, ejemplo: '+52 55 1234 5678' };
  return null;
}

/** El WhatsApp con su lada cuando la persona escribió solo el número local. */
export function whatsappConLada(bruto: string, tz: string): string {
  const s = (bruto || '').trim();
  if (!s || /^\+|^00/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  const z = ladaDeZona(tz);
  if (!z || z.lada === '+52' || d.length !== z.largo) return s;
  return `${z.lada} ${s}`;
}

