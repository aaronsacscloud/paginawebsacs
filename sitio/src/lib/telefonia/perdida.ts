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
import { enContexto } from '../whatsapp/kapso-api';
import { notaSistema } from '../whatsapp/espejo';
import { mandarPlantilla, plantillaAprobada } from '../whatsapp/plantilla-espejo';
import { telefonoWhatsApp } from '../telefono';

/* Creadas en Meta el 17-sep. Mientras alguna siga PENDING su envío falla y la
   cascada sigue al siguiente escalón; si fallan las dos, queda la tarea, que es
   lo que de verdad evita que la llamada se pierda. */
/* ══ LA CÁLIDA PRIMERO, LA VIEJA COMO RED (18-sep-2026) ════════════════════
   Pedido del dueño: «que sea una plantilla muy cordial, que explique que le
   llamamos, presentándonos y qué hacemos como Sacs; que no sean mensajes tan
   cerrados… que nos veamos formales, que le decimos que le marcamos por la
   solicitud que él mismo hizo, que nos ponemos a sus órdenes».

   Las `_v2` son esas. Están recién mandadas a Meta y tardan en aprobarse, así
   que la lista se recorre EN ORDEN y sale la primera que ya esté aprobada: hoy
   la vieja, y sola —sin que nadie tenga que volver aquí— la nueva en cuanto
   Meta la apruebe. Meta no deja editar el texto de una plantilla aprobada; por
   eso se versiona en vez de corregirse. */
const MARKETING = ['llamada_perdida_v2', 'llamada_perdida_v1'];
const UTILITY = ['llamada_perdida_util_v2', 'llamada_perdida_util_v1'];

/** La primera de la lista que Meta ya tenga aprobada. */
async function primeraViva(nombres: string[]): Promise<string | null> {
  for (const n of nombres) if (await plantillaAprobada(n)) return n;
  return null;
}

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
  /* ══ 🔴 EN EL CHAT SE LEE LO QUE LE LLEGÓ, NO UN RESUMEN ═════════════════
     Reporte del dueño (18-sep-2026), con la captura del inbox: «¿en este
     WhatsApp tiene en asteriscos marketing??? ¡mejóralo!».

     La burbuja decía «Te llamamos de vuelta: nos llamaste y no alcanzamos a
     contestar (marketing)». Eso NUNCA salió al cliente —lo que él recibió fue
     el cuerpo aprobado en Meta—, pero era lo único que veía quien abría el
     chat: un resumen escrito a mano aquí, con la categoría de Meta pegada al
     final como si fuera parte del mensaje.

     Dos daños: parece que le mandamos una nota técnica al cliente, y —peor—
     quien abre la conversación NO puede saber qué se le dijo, así que la
     llamada de vuelta empieza a ciegas. Un espejo que no espeja es peor que
     no tener espejo, porque se le cree.

     `mandarPlantilla` ya resuelve esto para todo el CRM desde el 2-sep: guarda
     el cuerpo APROBADO con las variables puestas, con su footer y sus botones,
     y trae la cascada marketing → utility de fábrica. Aquí sólo se le entrega
     el trabajo. La categoría se queda en `metadata`, que es su lugar. */
  const mkt = await primeraViva(MARKETING);
  const util = await primeraViva(UTILITY);
  if (!mkt && !util) return { via: 'solo_tarea' };
  const r = await mandarPlantilla({
    telefono: destino, plantilla: mkt || util!, params: [param], autor: 'Telefonía',
    metadata: { llamada_perdida: true },
    respaldo: mkt && util ? { plantilla: util, params: [param] } : null,
    textoRespaldo: `Hola ${param}, nos llamaste y no alcanzamos a responderte. Te devolvemos la llamada lo antes posible.`,
  }).catch(() => null);
  if (r?.enviado) via = r.via === 'respaldo' ? 'utility' : 'marketing';

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
