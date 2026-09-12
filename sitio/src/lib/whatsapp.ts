// WhatsApp de ventas — número y armado de mensajes. FUENTE ÚNICA.
//
// Todo CTA comercial del sitio termina en este número. El mensaje precargado
// es lo que define la conversación: si dice "prueba gratis", el asesor recibe
// a alguien pidiendo trial; si dice "demo", recibe a alguien pidiendo demo.

/* EL NÚMERO OFICIAL DE LA EMPRESA (12-sep-2026): +52 55 9302 7234. Es el mismo de Twilio,
   así que el WhatsApp y el teléfono son UNO: si el cliente ve una llamada perdida, le escribe
   al mismo número, y si escribe, le podemos llamar desde ahí. Antes era el +52 55 9302 7234.
   Se escribe una sola vez AQUÍ: el resto del sitio y del CRM lo importa. */
export const WHATSAPP_NUMBER = '525593027234';
/** Como se lee en pantalla («escríbenos al …»). */
export const WHATSAPP_LEGIBLE = '+52 55 9302 7234';

/** Link a wa.me con el mensaje precargado. */
export function waLink(message: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Mensaje de demo POR GIRO. Lleva el giro y su descripción para que el asesor
 * sepa de entrada de qué negocio se trata y prepare la demo de ese vertical.
 */
export function waDemoGiroMessage(label: string, description: string): string {
  return `¡Hola! Quiero agendar una demo en línea de Sacscloud. Mi giro es: ${label} — ${description}.`;
}

/** Link de demo por giro, listo para el href. */
export function waDemoGiro(label: string, description: string): string {
  return waLink(waDemoGiroMessage(label, description));
}
