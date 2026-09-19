/* ¿ESTE MENSAJE LO ESCRIBIÓ UNA PERSONA, O SU WHATSAPP BUSINESS?
 *
 * PEDIDO DEL DUEÑO (19-sep-2026): «cuando el prospecto responde algún mensaje
 * automático no debe manejarse como "no contestadas", ya que no hay nada que
 * responder: fue una respuesta de publicidad automática. Revisa todos estos
 * casos; cuando haya una respuesta de ese tipo debe seguir donde esté el
 * contacto en ese momento, porque eso no representa ningún tipo de contacto
 * real».
 *
 * Es el tercer caso de la misma familia —después de la llamada propia que se
 * guardaba como entrante y de los 64 que nunca contestaron— y el más
 * engañoso: aquí SÍ entra un mensaje del otro lado, sólo que no lo escribió
 * nadie. Su WhatsApp Business contesta «gracias por contactarnos, nuestro
 * horario es…» a los dos segundos de escribirle, y esa conversación salta al
 * tope de la única bandeja que sirve para trabajar.
 *
 * QUÉ SE MIRA, Y QUÉ NO
 *
 * Sólo el texto, y sólo patrones que ninguna persona escribe como primera
 * respuesta a una oferta: el saludo de bienvenida corporativo, el horario de
 * atención, el «te responderemos a la brevedad» y las variantes de «mensaje
 * automático». Deliberadamente NO se mira si llegó rápido: alguien que está
 * mirando el teléfono contesta «sí» en tres segundos, y ese «sí» es oro.
 *
 * El costo de equivocarse es asimétrico y por eso los patrones son estrechos:
 * marcar de más esconde a alguien que sí quería hablar. Marcar de menos sólo
 * deja la bandeja como está hoy.
 */

/** Frases que sólo aparecen en una respuesta automática de negocio. */
const SENALES = [
  /gracias por (contactarnos|escribirnos|comunicarte|tu mensaje)/i,
  /nuestro horario de atenci[oó]n/i,
  /horario de atenci[oó]n es de/i,
  /(te|le) (daremos|responderemos|contestaremos) respuesta/i,
  /(responderemos|contestaremos|te atendemos) (lo antes posible|a la brevedad|en breve)/i,
  /(este|es un) mensaje autom[aá]tico/i,
  /respuesta autom[aá]tica/i,
  /en (este )?momento no podemos (responder|atender)/i,
  /fuera de (nuestro )?horario/i,
  /hemos recibido tu (mensaje|solicitud)/i,
  /en cuanto (est|volvamos|regresemos)/i,
  /un asesor (se comunicar[aá]|te atender[aá])/i,
];

/**
 * `true` si el texto entrante es, casi con seguridad, una respuesta automática.
 *
 * Pide DOS cosas para decir que sí, y las dos juntas casi nunca se dan en un
 * mensaje escrito a mano:
 *  · que aparezca alguna de las frases de arriba;
 *  · y que el mensaje sea largo (más de 40 caracteres) o traiga dos señales.
 *    Un «gracias por contactarnos» suelto de tres palabras puede ser una
 *    persona educada; el bloque de bienvenida con horario y emojis, no.
 */
export function esAutorespuesta(texto?: string | null): boolean {
  const t = String(texto || '').trim();
  if (t.length < 18) return false;          // «ok», «sí», «gracias» jamás
  const golpes = SENALES.filter(r => r.test(t)).length;
  if (!golpes) return false;
  return golpes >= 2 || t.length > 40;
}
