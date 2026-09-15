// ══ Los países del motor Account-Based ══════════════════════════════════════
//
// Sin dependencias de servidor: lo importan igual las rutas de la API, el
// cron y los componentes del navegador (el filtro del goteo). El espejo del
// lado del barrido es docs/prospeccion/barrido/pais/paises.py: la LADA y el
// largo del móvil tienen que coincidir en los dos.
//
// El modelo (manual §13.3): la CUENTA tiene país; el país cae en una REGIÓN;
// la región decide qué cadencia y qué plantillas se usan (`abm_cadencias.region`,
// `abm_plantillas.region`) y en qué español escribe la IA. Un guion por
// región, variables por país: {{pais}}, {{xv}}, {{landing}}.

export type Region = 'mexico' | 'latam' | 'espana';

export type Pais = {
  iso: string;                // minúscula, la que usa el barrido
  nombre: string;             // como se escribe en el correo
  region: Region;
  gl: string;                 // el `gl` de Google Maps
  lada: string;               // sin el +
  moneda: string;             // la llave de src/data/plans.ts (mxn, cop, usd…)
  tz: string;                 // zona horaria de la capital
  xv: string;                 // cómo le dicen a la fiesta de quince
  trato: 'usted' | 'tú';
  /** La página del giro novias para ese país: la de México es la raíz. */
  landingNovias: string;
  /** Lo que la ley del país exige en un correo comercial no solicitado. Se
   *  revisa con el dueño antes de encender (manual §13.4). */
  legal: string;
};

export const PAISES: Record<string, Pais> = {
  mx: { iso: 'mx', nombre: 'México', region: 'mexico', gl: 'MX', lada: '52', moneda: 'mxn', tz: 'America/Mexico_City', xv: 'XV años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta', legal: 'B2B libre; identificación del remitente y baja.' },
  co: { iso: 'co', nombre: 'Colombia', region: 'latam', gl: 'CO', lada: '57', moneda: 'cop', tz: 'America/Bogota', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/colombia', legal: 'Ley 1581 (habeas data): decir de dónde salió el dato, identificarse, baja inmediata.' },
  cl: { iso: 'cl', nombre: 'Chile', region: 'latam', gl: 'CL', lada: '56', moneda: 'clp', tz: 'America/Santiago', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/chile', legal: 'Ley 19.496 art. 28 B: remitente identificado, asunto sin engaño, opt-out obligatorio.' },
  ar: { iso: 'ar', nombre: 'Argentina', region: 'latam', gl: 'AR', lada: '54', moneda: 'ars', tz: 'America/Argentina/Buenos_Aires', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/argentina', legal: 'Ley 25.326: opt-out en cada envío y origen del dato.' },
  pe: { iso: 'pe', nombre: 'Perú', region: 'latam', gl: 'PE', lada: '51', moneda: 'pen', tz: 'America/Lima', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/peru', legal: 'Ley 28493: el asunto lleva la palabra «PUBLICIDAD» y el remitente sus datos completos.' },
  ec: { iso: 'ec', nombre: 'Ecuador', region: 'latam', gl: 'EC', lada: '593', moneda: 'usd', tz: 'America/Guayaquil', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/ecuador', legal: 'LOPDP 2021: base legal e información al titular.' },
  cr: { iso: 'cr', nombre: 'Costa Rica', region: 'latam', gl: 'CR', lada: '506', moneda: 'usd', tz: 'America/Costa_Rica', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/costa-rica', legal: 'Ley 8968: identificación y baja.' },
  pa: { iso: 'pa', nombre: 'Panamá', region: 'latam', gl: 'PA', lada: '507', moneda: 'usd', tz: 'America/Panama', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/panama', legal: 'Ley 81/2019.' },
  uy: { iso: 'uy', nombre: 'Uruguay', region: 'latam', gl: 'UY', lada: '598', moneda: 'usd', tz: 'America/Montevideo', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/uruguay', legal: 'Ley 18.331 y regulación de URSEC: opt-out.' },
  do: { iso: 'do', nombre: 'República Dominicana', region: 'latam', gl: 'DO', lada: '1', moneda: 'usd', tz: 'America/Santo_Domingo', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/republica-dominicana', legal: 'Ley 172-13.' },
  gt: { iso: 'gt', nombre: 'Guatemala', region: 'latam', gl: 'GT', lada: '502', moneda: 'usd', tz: 'America/Guatemala', xv: '15 años', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/guatemala', legal: 'Sin ley específica de datos; aplican las reglas de la casa.' },
  es: { iso: 'es', nombre: 'España', region: 'espana', gl: 'ES', lada: '34', moneda: 'eur', tz: 'Europe/Madrid', xv: 'fiesta de quince', trato: 'usted', landingNovias: '/giros/novias-y-fiesta/espana', legal: 'RGPD + LSSI art. 21: correo comercial B2B solo con interés legítimo, identificación, origen del dato y baja. Revisar con abogado antes del primer correo.' },
};

const POR_NOMBRE: Record<string, Pais> = Object.fromEntries(Object.values(PAISES).map(p => [p.nombre.toLowerCase(), p]));

/** El país de una cuenta a partir de `abm_cuentas.pais` («Colombia») o del iso («co»). */
export function paisDe(v?: string | null): Pais {
  const s = String(v || '').trim().toLowerCase();
  return PAISES[s] || POR_NOMBRE[s] || PAISES.mx;
}

export function regionDe(pais?: string | null): Region {
  return paisDe(pais).region;
}

/** Los países de una región, para armar goteos y filtros. */
export function paisesDe(region: Region): Pais[] {
  return Object.values(PAISES).filter(p => p.region === region);
}

/** La frase de alcance del cierre del correo: dice el país del prospecto,
 *  no «solo somos de México». Para México no hace falta aclarar nada más que
 *  el «en todo México», que es lo que el dueño pidió que quedara claro. */
export function alcanceDe(pais?: string | null): string {
  const p = paisDe(pais);
  if (p.region === 'mexico') return 'Atendemos negocios de moda en todo México y en más de 7 países, por videollamada.';
  return `Atendemos negocios de moda en ${p.nombre} por videollamada, en su horario.`;
}

/** El asunto como lo exige la ley del país. Perú (Ley 28493, art. 6) obliga a
 *  que todo correo comercial no solicitado lleve la palabra «PUBLICIDAD» al
 *  inicio del asunto; sin eso el envío es ilegal, con o sin buena redacción.
 *  Se pone aquí, una sola vez, y no en cada plantilla: la plantilla de Latam
 *  es una para diez países. Los demás países no piden nada en el asunto. */
export function asuntoPais(pais: string | null | undefined, asunto: string): string {
  const p = paisDe(pais);
  if (p.iso === 'pe' && !/^publicidad\b/i.test(asunto.trim())) return 'PUBLICIDAD: ' + asunto.trim();
  return asunto;
}
