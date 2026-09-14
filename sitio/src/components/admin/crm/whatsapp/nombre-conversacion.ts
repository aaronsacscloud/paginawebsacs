/**
 * Con qué nombre se ve una conversación.
 *
 * Cuando alguien escribe desde un número que no conocemos, su ficha nace como
 * «WhatsApp 7300»: Kapso no siempre manda el nombre del perfil de WhatsApp. Si
 * esa ficha ya quedó ligada a una empresa —porque el teléfono coincidió con una
 * cuenta que paga, por ejemplo— enseñar el número es peor que enseñar el
 * negocio: «Tortillerías El Progreso» dice con quién estás hablando; «WhatsApp
 * 7300» no dice nada.
 *
 * El nombre GUARDADO no se toca. Esto es solo cómo se lee, y vive en su propio
 * archivo porque lo usan la lista (que se carga en diferido) y el hilo: si
 * colgara de cualquiera de los dos, importarlo arrastraría su chunk entero.
 */
import { telefonoLegible } from '../../../../lib/telefono.ts';

const ES_PLACEHOLDER = /^(WhatsApp|Contacto)\s+\d{3,}$/i;

export const esNombrePlaceholder = (n?: string | null) => ES_PLACEHOLDER.test(String(n || '').trim());

export function nombreParaMostrar(contacto?: any, empresa?: any, telefono?: string | null): string {
  const n = String(contacto?.nombre || '').trim();
  if (n && !ES_PLACEHOLDER.test(n)) return n;
  const e = String(empresa?.nombre_comercial || empresa?.nombre || '').trim();
  if (e) return e;
  return n || (telefono ? telefonoLegible(String(telefono)) : '—');
}
