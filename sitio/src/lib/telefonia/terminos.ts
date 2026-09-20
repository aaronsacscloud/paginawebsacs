/* CÓMO SE ESCRIBEN LAS PALABRAS QUE LA TRANSCRIPCIÓN NUNCA ACIERTA.
 *
 * PEDIDO DEL DUEÑO (20-sep-2026): «corrígele a que ponga Sacs o Sacscloud en
 * su caso».
 *
 * De dónde sale. La minuta de la llamada con Maela Sport quedó encabezada
 * «**Participante Sax:** Fernando», y dentro decía «lo coticé también con
 * odo». Ni el modelo ni la minuta inventaron nada: Whisper oyó eso. Nuestra
 * marca no existe en su vocabulario, y ante un sonido que no conoce escribe la
 * palabra que más se le parezca —«sax», «saks», «sacks»—; con Odoo hace lo
 * mismo y se come la vocal.
 *
 * POR QUÉ IMPORTA MÁS DE LO QUE PARECE. Estos textos no se quedan en un cajón:
 * de ellos salen la minuta que lee el equipo, el PDF que se le manda al
 * cliente, lo que el cierre con IA extrae de la llamada y el corpus con el que
 * se va a clonar la voz. Un documento nuestro que escribe mal el nombre de la
 * empresa en la primera línea se lee como descuido, y con razón.
 *
 * LAS DOS DEFENSAS, Y POR QUÉ HACEN FALTA LAS DOS
 *
 *  1. Antes: a Whisper se le pasa el vocabulario (`prompt`) para que escriba
 *     bien de entrada. Es la buena, porque además le ayuda a oír el resto de
 *     la frase — pero es una pista, no una garantía.
 *  2. Después: esta tabla, para lo que igual se cuele y para las miles de
 *     llamadas ya transcritas, que no se van a volver a procesar.
 *
 * LA REGLA AL AGREGAR UN TÉRMINO. Solo palabras que en una llamada de Sacs no
 * pueden ser otra cosa. «Sax» es un saxofón en cualquier otro contexto: aquí
 * no, porque el universo es «vendedor de software de punto de venta hablando
 * con una tienda de ropa». Ante la duda, NO se agrega: corregir de más mete
 * una palabra que nadie dijo en un documento que el cliente va a leer, y eso
 * es peor que una marca mal escrita.
 */

/** [qué se oyó, cómo se escribe]. El orden importa: lo más largo primero. */
const TERMINOS: [RegExp, string][] = [
  /* Sacscloud junto, que es como se dice el dominio. Va antes que «Sacs» solo,
     o «Sax cloud» se convertiría en «Sacs cloud». */
  [/\b(?:sax|saks|sacks|sacs)[\s-]?cloud\b/gi, 'Sacscloud'],
  [/\bsaxcloud\b/gi, 'Sacscloud'],
  /* La marca sola. `sacs` bien escrito también entra, para que quede con
     mayúscula como se escribe (ver la memoria de la marca). */
  [/\b(?:sax|saks|sacks|sacs)\b/gi, 'Sacs'],
  /* Odoo: se le come una o. «Odo» suelto en una llamada de software de gestión
     no es otra cosa. */
  [/\b(?:odo|oddo|odó|odoo)\b/gi, 'Odoo'],
  /* Las otras que se dicen en cada llamada y salen torcidas. */
  [/\bshopi?fy\b/gi, 'Shopify'],
  [/\bshopi\b/gi, 'Shopify'],
  [/\bmercado\s*pago\b/gi, 'Mercado Pago'],
  [/\bmercado\s*libre\b/gi, 'Mercado Libre'],
  [/\bwhats\s*app\b/gi, 'WhatsApp'],
  [/\btik\s*tok\b/gi, 'TikTok'],
];

/**
 * El texto con los nombres propios bien escritos.
 *
 * No toca nada más: ni puntuación, ni mayúsculas, ni el resto de las palabras.
 * Lo que entra torcido en gramática sale igual — esto corrige nombres, no
 * redacta.
 */
export function corregirTerminos(texto?: string | null): string {
  let s = String(texto || '');
  if (!s) return s;
  for (const [re, bien] of TERMINOS) s = s.replace(re, bien);
  return s;
}

/**
 * El vocabulario que se le adelanta a Whisper.
 *
 * Es una FRASE, no una lista de palabras sueltas: el `prompt` de Whisper se
 * usa como «así venía hablando esto», así que una oración natural le sirve
 * mejor que un diccionario. Va corta a propósito — un prompt largo empieza a
 * sesgar lo que oye de verdad.
 */
export const VOCABULARIO_LLAMADA =
  'Llamada de Sacs (Sacscloud), software de punto de venta para tiendas de moda en México. ' +
  'Se mencionan Odoo, Shopify, Mercado Pago, Mercado Libre, WhatsApp, TikTok, inventario por talla y color, sucursales, apartados y consignación.';
