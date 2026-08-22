/**
 * El teléfono, en el formato que WhatsApp entiende. UNA sola vez, para todos.
 *
 * Antes había dos copias —`telefonoMeta` en el importador de TikTok y
 * `normalizePhone` dentro de Kapso— y **ningún otro camino normalizaba**: el
 * formulario del sitio, la importación de contactos, la alta manual del CRM,
 * las cotizaciones y las suscripciones guardaban lo que la persona tecleara.
 * Medido en producción: 42 de 150 teléfonos (28%) no servían para abrir un
 * chat. Un número guardado como `5551234567` no falla con un error: abre
 * WhatsApp con un contacto que no existe, y eso se descubre cuando ya perdiste
 * al lead.
 *
 * Formato de salida: E.164 — `+` país + número, sin espacios ni signos.
 *
 * Dos detalles de México que rompen a quien no los conoce:
 *
 *  1. El **1 de móvil**. Los números mexicanos se escriben a veces como
 *     `+52 1 55 …`. WhatsApp NO lo quiere: el identificador es `+52` + los 10
 *     dígitos. Con el 1 el chat se abre vacío.
 *  2. **Diez dígitos sin país** es el caso más común aquí y hay que asumir
 *     México, pero solo cuando de verdad son diez: asumirlo con nueve o con
 *     doce produce un número inventado.
 */

/** Los dígitos, respetando un `+` inicial y el prefijo internacional `00`. */
function limpiar(bruto: string): { mas: boolean; d: string } {
  let s = String(bruto || '').trim();
  // Extensiones: "55 1234 5678 ext 12" — lo que va después no es el número.
  s = s.replace(/\b(ext|extensi[oó]n|x)\.?\s*\d+\s*$/i, '');
  const mas = /^\s*\+/.test(s) || /^\s*00\d/.test(s);
  let d = s.replace(/\D/g, '');
  if (!/^\s*\+/.test(s) && /^00\d/.test(s.replace(/\s/g, ''))) d = d.slice(2);
  return { mas, d };
}

/**
 * El número listo para WhatsApp, o `null` si no se puede afirmar cuál es.
 *
 * Devuelve null en vez de adivinar: un número inventado es peor que ninguno,
 * porque el botón parece funcionar.
 */
export function telefonoWhatsApp(bruto?: string | null): string | null {
  if (!bruto) return null;
  const { mas, d } = limpiar(bruto);
  if (!d) return null;

  // Basura evidente: todos los dígitos iguales, o secuencias de prueba.
  if (/^(\d)\1+$/.test(d)) return null;
  if (/^1234567890|^0{5}/.test(d)) return null;

  // México, en todas sus formas.
  if (d.length === 10) return '+52' + d;                       // local
  if (d.length === 12 && d.startsWith('52')) return '+' + d;   // +52 + 10
  if (d.length === 13 && d.startsWith('521')) return '+52' + d.slice(3);  // con el 1 de móvil
  if (d.length === 11 && d.startsWith('52')) return null;      // 52 + 9 dígitos: falta uno

  // Estados Unidos y Canadá.
  if (d.length === 11 && d.startsWith('1')) return '+1' + d.slice(1);

  // Cualquier otro país: solo si venía con `+` o `00`, que es la única señal
  // de que la persona SÍ escribió el código de país. Sin ella, doce dígitos
  // sueltos son un error de captura, no un número de Irán.
  if (mas && d.length >= 11 && d.length <= 15) return '+' + d;

  return null;
}

/**
 * Para GUARDAR: el normalizado si se pudo, y si no el original limpio.
 *
 * Nunca devuelve null cuando entró algo: perder el dato que la persona
 * escribió es peor que guardarlo raro — con el original todavía se puede
 * llamar y corregir a mano; sin él no queda nada.
 */
export function normalizarTelefono(bruto?: string | null): string | null {
  if (!bruto) return null;
  const bueno = telefonoWhatsApp(bruto);
  if (bueno) return bueno;
  const crudo = String(bruto).trim();
  return crudo || null;
}

/** ¿Se le puede escribir por WhatsApp? */
export const sirveParaWhatsApp = (t?: string | null): boolean => !!telefonoWhatsApp(t);

/** Para mostrar: +52 55 1234 5678. Solo estético, nunca para guardar. */
export function telefonoLegible(t?: string | null): string {
  const e = telefonoWhatsApp(t);
  if (!e) return String(t || '');
  if (e.startsWith('+52') && e.length === 13) {
    const n = e.slice(3);
    return `+52 ${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`;
  }
  if (e.startsWith('+1') && e.length === 12) {
    const n = e.slice(2);
    return `+1 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e;
}
