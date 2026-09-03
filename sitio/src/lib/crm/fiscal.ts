// Los datos fiscales de una cuenta, en un solo lugar.
//
// Vivían dentro de CuentaCliente.tsx —catálogo, regex y reglas— y al pedirlos
// también en el alta de pago la copia era inevitable. Copiado significa que
// dentro de un mes un lado acepta un RFC que el otro rechaza, y el cliente se
// entera cuando pide su factura.
//
// La regla de fondo: se piden ANTES de que hagan falta. Cuando el cliente pide
// factura ya es tarde para andar buscándole el régimen.

/* RFC mexicano: 3-4 letras + fecha + homoclave. Laxo a propósito (las
   mayúsculas se normalizan): el candado fuerte es del SAT, no de este input. */
export const RFC_OK = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

/* Los regímenes del SAT que de verdad aparecen en comercio. El catálogo
   completo tiene 20+; enseñar los ocho de siempre y dejar «Otro» evita un
   select interminable donde nadie encuentra el suyo. */
export const REGIMENES = [
  '601 · General de Ley Personas Morales',
  '626 · RESICO (Régimen Simplificado de Confianza)',
  '612 · Personas Físicas con Actividades Empresariales',
  '621 · Incorporación Fiscal',
  '603 · Personas Morales con Fines no Lucrativos',
  '625 · Actividades a través de Plataformas Tecnológicas',
  '616 · Sin obligaciones fiscales',
  'Otro',
];

export type Fiscales = {
  rfc?: string | null;
  razon_social?: string | null;
  cp_fiscal?: string | null;
  regimen_fiscal?: string | null;
  constancia_fiscal_url?: string | null;
  constancia_fiscal_nombre?: string | null;
};

/** Los CUATRO obligatorios. La constancia NO entra: es opcional a propósito
 *  —muchos negocios no la traen a la mano— y exigirla frenaría el cobro. */
export const CAMPOS_OBLIGATORIOS = ['razon_social', 'rfc', 'cp_fiscal', 'regimen_fiscal'] as const;

/** ¿Cuáles le faltan? Devuelve las llaves, para poder decir QUÉ falta y no
 *  solo que «faltan datos». */
export function faltantes(f: Fiscales | null | undefined): string[] {
  if (!f) return [...CAMPOS_OBLIGATORIOS];
  return CAMPOS_OBLIGATORIOS.filter(k => !String((f as any)[k] ?? '').trim());
}

export const faltanFiscales = (f: Fiscales | null | undefined) => faltantes(f).length > 0;

const ETIQUETA: Record<string, string> = {
  razon_social: 'la razón social', rfc: 'el RFC',
  cp_fiscal: 'el código postal', regimen_fiscal: 'el régimen fiscal',
};

/** «Falta el RFC» / «Faltan el RFC y el código postal». Se lee, no se descifra. */
export function textoFaltantes(f: Fiscales | null | undefined): string {
  const n = faltantes(f).map(k => ETIQUETA[k] || k);
  if (!n.length) return '';
  if (n.length === 1) return `Falta ${n[0]}`;
  return `Faltan ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

/**
 * Valida y normaliza lo capturado. Devuelve `{ error }` con el PRIMER problema
 * en el orden en que están los campos en pantalla: mandar al usuario al último
 * campo cuando el primero también está mal lo hace dar dos vueltas.
 */
export function validarFiscales(b: Fiscales): { ok: true; datos: Required<Pick<Fiscales, 'rfc' | 'razon_social' | 'cp_fiscal' | 'regimen_fiscal'>> } | { ok: false; error: string; campo: string } {
  const razon = String(b.razon_social || '').trim();
  const rfc = String(b.rfc || '').trim().toUpperCase();
  const cp = String(b.cp_fiscal || '').trim();
  const regimen = String(b.regimen_fiscal || '').trim();

  if (!razon) return { ok: false, error: 'Falta la razón social.', campo: 'razon_social' };
  if (!rfc) return { ok: false, error: 'Falta el RFC.', campo: 'rfc' };
  if (!RFC_OK.test(rfc)) return { ok: false, error: 'Ese RFC no tiene la forma correcta (ej. XAXX010101000).', campo: 'rfc' };
  if (!/^\d{5}$/.test(cp)) return { ok: false, error: 'El código postal son 5 dígitos.', campo: 'cp_fiscal' };
  if (!regimen) return { ok: false, error: 'Falta el régimen fiscal (viene en su constancia).', campo: 'regimen_fiscal' };

  return { ok: true, datos: { rfc, razon_social: razon, cp_fiscal: cp, regimen_fiscal: regimen } };
}
