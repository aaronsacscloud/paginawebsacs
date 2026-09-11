// LLAMADAS INTELIGENTES · La hora del CONTACTO, no la de la Ciudad de México.
// México tiene cuatro husos y el marcador no debe despertar a Tijuana a las
// 7 ni colgarle a Cancún a las 18. Se decide por la lada (los tres dígitos
// después del +52). Lo que no está aquí es Centro.
const TIJUANA = new Set(['664', '665', '663', '661', '646', '686', '658']);                       // Baja California (UTC-8, con horario de verano)
const HERMOSILLO = new Set(['622', '623', '631', '632', '633', '634', '637', '638', '641', '642', '643', '644', '645', '647', '651', '653', '662']); // Sonora (UTC-7 fijo); 635/636 son Chihuahua, van con Centro
const MAZATLAN = new Set([
  '667', '668', '669', '672', '673', '674', '687', '694', '695', '696', '697', '698',           // Sinaloa
  '612', '613', '615', '624',                                                                    // Baja California Sur
  '311', '319', '323', '324', '325', '327', '389',                                               // Nayarit (Bahía de Banderas va con Centro)
]);
const JUAREZ = new Set(['656']);                                                                 // Ciudad Juárez sigue a El Paso
const CANCUN = new Set(['983', '984', '987', '998']);                                            // Quintana Roo (UTC-5 fijo)

export const ladaDe = (e164: string | null | undefined): string | null => {
  const m = /^\+52(\d{3})/.exec(String(e164 || ''));
  if (m) return m[1];
  const us = /^\+1(\d{3})/.exec(String(e164 || ''));
  return us ? `1${us[1]}` : null;
};

export const zonaDeLada = (lada: string | null | undefined): string => {
  const l = String(lada || '');
  if (TIJUANA.has(l)) return 'America/Tijuana';
  if (HERMOSILLO.has(l)) return 'America/Hermosillo';
  if (MAZATLAN.has(l)) return 'America/Mazatlan';
  if (JUAREZ.has(l)) return 'America/Ciudad_Juarez';
  if (CANCUN.has(l)) return 'America/Cancun';
  if (/^1/.test(l)) return 'America/Chicago';   // un número de EE. UU.: Centro es la apuesta menos mala
  return 'America/Mexico_City';
};

export const zonaDeTelefono = (e164: string | null | undefined) => zonaDeLada(ladaDe(e164));

/** Hora local del contacto como «HH:MM». */
export const horaLocal = (zona: string, cuando = new Date()) =>
  cuando.toLocaleTimeString('es-MX', { timeZone: zona, hour: '2-digit', minute: '2-digit', hour12: false });

/** «AAAA-MM-DD» y «HH:MM» de un instante en esa zona. */
export const fechaHoraEn = (zona: string, cuando: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(cuando).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
};

/** El instante que corresponde a esa fecha y hora LOCALES de la zona (sin tablas de husos: se corrige con lo que la zona devuelve). */
export const instanteEnZona = (fecha: string, hora: string, zona: string): Date => {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  let t = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {                       // dos vueltas cubren el cambio de horario de verano
    const v = fechaHoraEn(zona, new Date(t));
    const [vy, vm, vd] = v.fecha.split('-').map(Number);
    const [vh, vmi] = v.hora.split(':').map(Number);
    t -= Date.UTC(vy, vm - 1, vd, vh, vmi) - Date.UTC(y, m - 1, d, h, mi);
  }
  return new Date(t);
};
