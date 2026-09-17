/* NOS LLAMARON Y NO ALCANZAMOS · el WhatsApp que sale solo.
 *
 * PEDIDO DEL DUEÑO (17-sep-2026): «si nos están llamando y no alcanzamos a
 * responder, manda un WhatsApp automático. Primero una plantilla de marketing
 * que mencione que no alcanzamos a responder, que le llamaremos a la brevedad;
 * sin embargo, si desea saber algo del sistema o tiene alguna pregunta, que lo
 * puede enviar directamente o enviar una nota de voz. Y de ahí, si no pasa la
 * de marketing, que pase la comprobación de tipo utility.»
 *
 * Quien marca y escucha el tono hasta que se rinde no sabe si le fallamos o si
 * el número está muerto. Un mensaje inmediato convierte una llamada perdida en
 * una conversación abierta, que es de lo único que sale una venta.
 *
 * LA CASCADA, Y POR QUÉ ESE ORDEN. Marketing primero: es la única de las dos
 * que puede invitar a escribir o mandar una nota de voz sin salirse de su
 * categoría —esa frase es comercial, y metida en una utility la reclasifica
 * Meta sola—. La utility es el respaldo, y entra casi siempre porque contesta
 * a algo que HIZO el cliente: nos llamó.
 *
 * ⚠️ EL ERROR QUE HAY QUE ATRAPAR NO ES EL DE LA VENTANA. Una plantilla de
 * marketing SÍ sale fuera de las 24 h. Lo que la tumba es el opt-out de
 * marketing del contacto (131050) y los topes de frecuencia de Meta. Mirar el
 * 131047 aquí sería vigilar la puerta equivocada.
 */
import { supabase } from '../supabase';
import { enviarPlantilla, enContexto, KapsoError } from '../whatsapp/kapso-api';
import { registrarMensaje, notaSistema } from '../whatsapp/espejo';
import { telefonoWhatsApp } from '../telefono';

/* Creadas en Meta el 17-sep. Mientras alguna siga PENDING su envío falla y la
   cascada sigue al siguiente escalón; si fallan las dos, queda la tarea, que es
   lo que de verdad evita que la llamada se pierda. */
const PLANTILLA_MARKETING = 'llamada_perdida_v1';
const PLANTILLA_UTILITY = 'llamada_perdida_util_v1';

/** Media hora: quien insiste tres veces seguidas no necesita tres avisos. */
const ANTI_REPE_MS = 30 * 60000;

export type ResultadoPerdida = { via: 'marketing' | 'utility' | 'solo_tarea' | 'ya_avisado' | 'sin_telefono'; tarea?: any };

export async function avisarLlamadaPerdida(telefonoCrudo: string, nombreDado?: string | null): Promise<ResultadoPerdida> {
  const destino = telefonoWhatsApp(String(telefonoCrudo || ''));
  if (!destino) return { via: 'sin_telefono' };

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id, contact_id, contacts(nombre)')
    .eq('telefono', destino).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
  const nombre = String(nombreDado || (conv as any)?.contacts?.nombre || '').trim().split(/\s+/)[0] || '';
  // Meta no acepta una variable vacía y la plantilla abre con «Hola {{1}},».
  const param = nombre || 'qué tal';

  if (conv?.id) {
    const { data: ya } = await supabase.from('wa_mensajes')
      .select('id').eq('conversation_id', conv.id).eq('direccion', 'saliente')
      .contains('metadata', { llamada_perdida: true })
      .gte('created_at', new Date(Date.now() - ANTI_REPE_MS).toISOString()).limit(1);
    if (ya?.length) return { via: 'ya_avisado' };
  }

  enContexto('cita');
  let via: ResultadoPerdida['via'] = 'solo_tarea';
  for (const [plantilla, etiqueta] of [[PLANTILLA_MARKETING, 'marketing'], [PLANTILLA_UTILITY, 'utility']] as const) {
    try {
      const r = await enviarPlantilla(destino, plantilla, 'es_MX', [param]);
      const wamid = r?.messages?.[0]?.id || null;
      if (!wamid) continue;
      await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino, direccion: 'saliente', tipo: 'template',
        cuerpo: `Te llamamos de vuelta: nos llamaste y no alcanzamos a contestar (${etiqueta}).`,
        status: 'sent', autor: 'Telefonía',
        metadata: { llamada_perdida: true, plantilla },
      });
      via = etiqueta;
      break;
    } catch (e: any) {
      /* Se sigue a la siguiente sin ruido: que la de marketing no entre es lo
         ESPERADO en quien se dio de baja de marketing, no una avería. Lo que sí
         se cuenta es cuando fallan las dos. */
      if (!(e instanceof KapsoError)) break;
    }
  }

  if (via === 'solo_tarea') {
    await notaSistema(destino, 'Te llamó y no se alcanzó a contestar. NO se le pudo avisar por WhatsApp (ninguna plantilla entró). Hay que devolverle la llamada.')
      .catch(() => {});
  }

  /* LA TAREA, SIEMPRE. Se haya podido avisar o no, quedó una llamada sin
     devolver — y una llamada perdida en silencio es la que no se devuelve. */
  let tarea: any = null;
  if (conv?.contact_id) {
    const { data } = await supabase.from('crm_seguimientos').insert({
      contact_id: conv.contact_id, conversation_id: conv.id,
      motivo: 'Te llamó y no alcanzaste a contestar — devolverle la llamada',
      fecha: new Date().toISOString().slice(0, 10),
    }).select('id').maybeSingle();
    tarea = data;
  }
  return { via, tarea };
}
