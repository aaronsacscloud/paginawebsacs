// ══ Mandar un WhatsApp suelto desde el sistema (avisos, recordatorios) ═════
//
// Lo usan el cron de recordatorios de citas, cancelaciones, reagendados, los
// avisos de ARR y los de Stripe. NO es el inbox: aquí no hay conversación
// abierta ni agente escribiendo, es el sistema avisando.
//
// Apuntaba a `api.kapso.ai/v1/messages/send`, una API de Kapso distinta de la
// que usa el inbox, y nadie leía el `{sent:false}` que devuelve al fallar: si
// ese camino estaba muerto, todos esos avisos se perdían en silencio. Ahora
// sale por la MISMA vía que el inbox —la que se usa todo el día y por lo tanto
// se sabe viva— y además queda espejado en la conversación del cliente, que es
// donde alguien lo va a buscar.
import { enviarTexto, enContexto, KapsoError } from './whatsapp/kapso-api';
import { registrarMensaje } from './whatsapp/espejo';
import { telefonoWhatsApp } from './telefono';

export async function sendWhatsApp(to: string, message: string, autor = 'Sistema', contexto: 'cliente' | 'cita' | 'sistema' | 'lead' | 'evento' = 'sistema'): Promise<{ sent: boolean; error?: string }> {
  // Estricto a propósito: si el número no sirve, NO se manda con algo
  // inventado. Un mensaje a un número que no existe se cobra igual y
  // desaparece sin error.
  const phone = telefonoWhatsApp(to);
  if (!phone) return { sent: false, error: `Teléfono no utilizable para WhatsApp: ${to}` };
  if (!String(message || '').trim()) return { sent: false, error: 'Mensaje vacío' };

  try {
    // Multilínea: la línea la resuelve lineaPara() por el teléfono (su conversación → reglas del
    // contexto → default). Aquí solo se dice QUÉ tipo de envío es.
    enContexto(contexto);

    const r = await enviarTexto(phone, message);
    const wamid = r?.messages?.[0]?.id;
    if (wamid) {
      // El espejo no es opcional: sin él, el equipo abre el chat y no ve lo
      // que el sistema ya le dijo al cliente.
      await registrarMensaje({
        kapsoMessageId: wamid, telefono: phone, direccion: 'saliente',
        tipo: 'text', cuerpo: message, status: 'sent', autor,
      }).catch(() => { /* el espejo puede fallar; el mensaje ya salió */ });
    }
    return { sent: true };
  } catch (err: any) {
    // Meta no acepta texto libre fuera de la ventana de 24 h. Antes esto se
    // perdía en un `{sent:false}` sin motivo; ahora el que llama puede decidir
    // (mandar plantilla, avisar al equipo) en vez de suponer que salió.
    if (err instanceof KapsoError && /131047|window|24/i.test(String(err.message))) {
      return { sent: false, error: 'Ventana de 24 h cerrada: este mensaje necesita plantilla' };
    }
    return { sent: false, error: String(err?.message || err) };
  }
}
