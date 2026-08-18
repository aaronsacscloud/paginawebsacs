// WhatsApp de ventas — número y armado de mensajes. FUENTE ÚNICA.
//
// Todo CTA comercial del sitio termina en este número. El mensaje precargado
// es lo que define la conversación: si dice "prueba gratis", el asesor recibe
// a alguien pidiendo trial; si dice "demo", recibe a alguien pidiendo demo.

export const WHATSAPP_NUMBER = '5215536634392';

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
