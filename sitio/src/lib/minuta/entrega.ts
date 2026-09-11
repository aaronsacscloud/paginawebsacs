// MINUTA DE LLAMADA · Del texto al PDF, y del PDF a manos del cliente.
//
// Corre justo después de que Claude redacta la minuta. Hace tres cosas y las
// tres pueden fallar por separado sin arrastrar a las otras:
//   1. Dibuja el PDF con la marca de Sacs y lo guarda.
//   2. Deja el enlace en la llamada, para el inbox y la ficha.
//   3. Se lo manda al cliente por WhatsApp, si se puede.
//
// ── EL PROBLEMA DE FONDO: LA VENTANA DE 24 HORAS ───────────────────────────
// Meta solo deja mandar un archivo libremente durante las 24 h siguientes al
// último mensaje DEL CLIENTE. Una llamada no abre esa ventana. Así que el caso
// más común —le llamaste a alguien que nunca te ha escrito por WhatsApp— cae
// justo del lado malo. Hay tres caminos, en este orden:
//
//   A. Ventana abierta        → se manda el PDF y ya.
//   B. Ventana cerrada + hay una plantilla con encabezado de DOCUMENTO
//                             → el PDF viaja dentro de la plantilla.
//   C. Ventana cerrada y no hay tal plantilla
//                             → se manda una plantilla de aviso («tenemos tu
//                               minuta, respóndenos»). Su respuesta ABRE la
//                               ventana, y ahí el PDF sale solo.
//
// El camino C no es un consuelo: es el único que existe hoy, porque ninguna de
// las plantillas aprobadas admite documentos. Por eso la minuta queda marcada
// como `pendiente_ventana` y el webhook de entrada la busca en cada mensaje.
import { supabase } from '../supabase';
import { telefonoWhatsApp } from '../telefono';
import { enviarMediaLink, enviarPlantilla, enContexto } from '../whatsapp/kapso-api';
import { ventanaEnLinea } from '../whatsapp/linea';
import { permitido } from '../whatsapp/permisos';
import { minutaPDF, folioDe } from './pdf';

const BUCKET = 'wa-media';   // público: Meta tiene que poder descargar el archivo

export type ResultadoEntrega = {
  pdf: string | null;
  estado: 'enviada' | 'pendiente_ventana' | 'no_aplica' | 'fallo' | null;
  motivo: string;
};

const primerNombre = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || '';

/** Sube el PDF y devuelve su URL pública. */
async function guardar(callId: string, buf: Buffer, sufijo = ''): Promise<string> {
  /* El bucket es público porque Meta descarga el archivo desde sus servidores,
     sin cookies ni cabeceras nuestras. El candado es el NOMBRE: lleva un tramo
     aleatorio, así que la URL no se puede adivinar a partir del CallSid. */
  const azar = Math.random().toString(36).slice(2, 12);
  const ruta = `minutas/${callId}${sufijo}-${azar}.pdf`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, buf, { contentType: 'application/pdf', upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`no se pudo guardar el PDF: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

/**
 * Genera el PDF de una minuta ya redactada y decide su entrega.
 * Nunca lanza: la minuta ya está guardada y no puede perderse por esto.
 */
export async function generarYEntregarMinuta(callId: string): Promise<ResultadoEntrega> {
  try {
    const { data: ll } = await supabase.from('wa_llamadas')
      .select('call_id, canal, direccion, telefono, duracion_seg, minuta, minuta_cliente, minuta_pdf_url, minuta_pdf_cliente_url, minuta_envio_estado, conversation_id, started_at, atendida_por_nombre')
      .eq('call_id', callId).maybeSingle();
    if (!ll) return { pdf: null, estado: null, motivo: 'la llamada no existe' };
    if (!String(ll.minuta || '').trim()) return { pdf: null, estado: null, motivo: 'todavía no hay minuta' };
    // Ya se entregó: esta función puede correr dos veces (reintento del webhook
    // de la grabación) y no debe mandar el mismo PDF dos veces.
    if (ll.minuta_envio_estado === 'enviada') return { pdf: ll.minuta_pdf_url, estado: 'enviada', motivo: 'ya se había entregado' };

    // ── Contexto para el documento ────────────────────────────────────────
    let contacto: string | null = null, empresa: string | null = null, conv: any = null;
    if (ll.conversation_id) {
      const { data } = await supabase.from('wa_conversaciones')
        .select('id, telefono, contact_id, phone_number_id, ventanas, ultimo_entrante_at, contacts(nombre, apellido), companies(nombre, nombre_comercial)')
        .eq('id', ll.conversation_id).maybeSingle();
      conv = data;
      const c: any = (data as any)?.contacts, e: any = (data as any)?.companies;
      if (c?.nombre) contacto = `${c.nombre} ${c.apellido || ''}`.trim();
      if (e) empresa = e.nombre_comercial || e.nombre || null;
    }

    // ── 1 · El PDF ────────────────────────────────────────────────────────
    let url = ll.minuta_pdf_url as string | null;
    if (!url) {
      const buf = await minutaPDF({
        callId, contacto, empresa, telefono: ll.telefono,
        direccion: (ll.direccion === 'entrante' ? 'entrante' : 'saliente'),
        fecha: ll.started_at ? new Date(ll.started_at) : new Date(),
        duracionSeg: Number(ll.duracion_seg || 0),
        atendio: ll.atendida_por_nombre, minuta: String(ll.minuta),
      });
      if (!buf?.length) throw new Error('el PDF salió vacío');
      url = await guardar(callId, buf);
      await supabase.from('wa_llamadas')
        .update({ minuta_pdf_url: url, minuta_pdf_at: new Date().toISOString() })
        .eq('call_id', callId);
    }

    /* ── 1b · LA VERSIÓN PARA EL CLIENTE ───────────────────────────────────
       Son DOS documentos, no uno. La minuta que escribe Claude es de
       observación interna y vale justamente por eso: la primera real decía de
       un cliente «dos socios con visiones diferentes», «consideraron que se
       dispara el precio», «el socio tecnológico se desanimó». Mandarle eso le
       devuelve sus propios desacuerdos citados.
       El PDF que se le manda sale de `minuta_cliente`, que el mismo modelo
       escribe sabiendo que él la va a leer. Si por lo que sea no viene, NO se
       cae al texto interno: mejor no mandar nada que mandar eso. */
    let urlCliente = ll.minuta_pdf_cliente_url as string | null;
    if (!urlCliente && String(ll.minuta_cliente || '').trim()) {
      try {
        const bufC = await minutaPDF({
          callId, contacto, empresa, telefono: ll.telefono,
          direccion: (ll.direccion === 'entrante' ? 'entrante' : 'saliente'),
          fecha: ll.started_at ? new Date(ll.started_at) : new Date(),
          duracionSeg: Number(ll.duracion_seg || 0),
          atendio: ll.atendida_por_nombre, minuta: String(ll.minuta_cliente),
        });
        if (bufC?.length) {
          urlCliente = await guardar(callId, bufC, '-cliente');
          await supabase.from('wa_llamadas').update({ minuta_pdf_cliente_url: urlCliente }).eq('call_id', callId);
        }
      } catch (e: any) { console.warn(`[minuta/entrega] la versión del cliente falló: ${String(e?.message || e)}`); }
    }

    // ── 2 · ¿Se le manda? ─────────────────────────────────────────────────
    /* El envío se atrapa APARTE del PDF. Si se juntan en un solo try, un error
       de WhatsApp devolvía `pdf: null` aunque el documento ya estuviera hecho y
       guardado: quien llamaba creía que no había PDF y lo volvía a generar. */
    const r = await entregar(callId, urlCliente, ll, conv, contacto)
      .catch((e: any) => {
        const motivo = String(e?.message || e);
        /* Si la ventana estaba ABIERTA y el envío falló por algo pasajero, se
           deja PENDIENTE en vez de muerto: al siguiente mensaje del cliente se
           reintenta solo. Un 'fallo' seco no se reintenta nunca. */
        const ventana = ventanaEnLinea(conv, conv?.phone_number_id);
        return ventana.abierta
          ? { estado: 'pendiente_ventana' as const, motivo: `no salió (${motivo}); se reintenta al siguiente mensaje` }
          : { estado: 'fallo' as const, motivo };
      });
    await supabase.from('wa_llamadas').update({
      minuta_envio_estado: r.estado, minuta_envio_motivo: r.motivo,
      ...(r.estado === 'enviada' ? { minuta_envio_at: new Date().toISOString() } : {}),
    }).eq('call_id', callId);

    /* Se reescribe la nota del inbox: nació cuando la llamada colgó, sin PDF
       —transcribir y redactar toma un minuto—, y ahora ya hay documento y ya
       se sabe si se le pudo mandar. `registrarBitacoraLlamada` corrige la que
       existe en vez de escribir otra. */
    try {
      const { registrarBitacoraLlamada } = await import('../telefonia/bitacora');
      await registrarBitacoraLlamada(callId);
    } catch { /* la nota vieja sigue ahí; el PDF ya está guardado */ }

    return { pdf: url, ...r };
  } catch (e: any) {
    // Aquí solo se llega si falló el PDF mismo (dibujarlo o guardarlo).
    const motivo = String(e?.message || e);
    console.error(`[minuta/entrega] ${callId}: ${motivo}`);
    await supabase.from('wa_llamadas').update({ minuta_envio_estado: 'fallo', minuta_envio_motivo: motivo }).eq('call_id', callId).then(() => {}, () => {});
    return { pdf: null, estado: 'fallo', motivo };
  }
}

/**
 * ¿Esta plantilla está APROBADA por Meta ahora mismo?
 *
 * Se pregunta antes de usarla, y no es paranoia: una plantilla recién creada
 * pasa horas en PENDING, y Meta también las PAUSA o las deshabilita después si
 * la gente las reporta. Sin esta comprobación, dejar el nombre configurado «para
 * cuando la aprueben» significaría que cada minuta falla hasta entonces —y peor,
 * que el día que Meta pause una, el envío se cae en silencio en vez de caer al
 * siguiente camino. Con ella, el nombre se puede dejar puesto desde el primer
 * día: el flujo se enciende solo en cuanto el estado cambia (lo sincroniza el
 * cron `wa-snooze`).
 */
async function aprobada(nombre?: string | null): Promise<boolean> {
  if (!nombre) return false;
  const { data } = await supabase.from('wa_plantillas')
    .select('status').eq('nombre', nombre).order('status').limit(1).maybeSingle();
  return String((data as any)?.status || '').toUpperCase() === 'APPROVED';
}

/** La decisión de envío, aislada para poder reusarla al abrirse la ventana. */
async function entregar(callId: string, url: string | null, ll: any, conv: any, contacto: string | null): Promise<{ estado: ResultadoEntrega['estado']; motivo: string }> {
  const { data: cfg } = await supabase.from('wa_config')
    .select('minuta_envio_activa, minuta_envio_plantilla_doc, minuta_envio_plantilla_aviso, minuta_envio_texto')
    .eq('id', 1).maybeSingle();
  if (!cfg?.minuta_envio_activa) return { estado: 'no_aplica', motivo: 'el envío automático de la minuta está apagado' };
  /* Sin versión para el cliente NO se manda nada. Caer al PDF interno sería
     exactamente el accidente que estas dos versiones existen para evitar. */
  if (!url) return { estado: 'no_aplica', motivo: 'no se pudo redactar la versión para el cliente; el PDF interno sí quedó' };
  if (!conv) return { estado: 'no_aplica', motivo: 'este teléfono no tiene conversación en el inbox' };

  const tel = telefonoWhatsApp(conv.telefono || ll.telefono);
  if (!tel) return { estado: 'no_aplica', motivo: 'el teléfono no sirve para WhatsApp' };
  // El interruptor maestro de automatizaciones también manda aquí.
  if (!(await permitido('minuta_llamada'))) return { estado: 'no_aplica', motivo: 'pausada en Automatizaciones' };

  const nombre = primerNombre(contacto) || 'qué tal';
  const archivo = `Minuta ${folioDe(callId)}.pdf`;
  enContexto('minuta', 'telefonia');

  const ventana = ventanaEnLinea(conv, conv.phone_number_id);

  // ── A · Ventana abierta: el PDF, directo ────────────────────────────────
  if (ventana.abierta) {
    const pie = String(cfg.minuta_envio_texto || '').replace(/\{\{\s*nombre\s*\}\}/gi, nombre);
    await enviarMediaLink(tel, 'document', url, archivo, pie || undefined);
    return { estado: 'enviada', motivo: 'se le mandó el PDF por WhatsApp' };
  }

  // ── B · Cerrada, pero hay plantilla que admite documento ────────────────
  if (await aprobada(cfg.minuta_envio_plantilla_doc)) {
    try {
      await enviarPlantilla(tel, String(cfg.minuta_envio_plantilla_doc), 'es_MX', [nombre], {
        headerMedia: { tipo: 'document', link: url, filename: archivo },
      });
      return { estado: 'enviada', motivo: 'se le mandó el PDF con plantilla (fuera de la ventana de 24 h)' };
    } catch (e: any) {
      /* Que la plantilla con documento falle NO puede dejar al cliente sin
         nada: se cae al aviso, que es justo para lo que existe. */
      console.warn(`[minuta/entrega] plantilla con documento falló: ${String(e?.message || e)}`);
    }
  }

  // ── C · Cerrada y sin plantilla de documento: se avisa y se espera ──────
  if (!(await aprobada(cfg.minuta_envio_plantilla_aviso))) {
    return {
      estado: 'no_aplica',
      motivo: cfg.minuta_envio_plantilla_aviso
        ? `fuera de la ventana de 24 h y la plantilla «${cfg.minuta_envio_plantilla_aviso}» todavía no está aprobada por Meta`
        : 'fuera de la ventana de 24 h y sin plantilla configurada para avisarle',
    };
  }
  await enviarPlantilla(tel, String(cfg.minuta_envio_plantilla_aviso), 'es_MX', [nombre]);
  return { estado: 'pendiente_ventana', motivo: 'se le avisó; el PDF sale en cuanto responda' };
}

/**
 * Al llegar un mensaje del cliente se abre la ventana de 24 h: es el momento
 * —el único— en que se le puede mandar el PDF que quedó esperando.
 * Lo llama el webhook de entrada. Nunca lanza.
 */
export async function entregarMinutasPendientes(conversationId: string): Promise<number> {
  try {
    const { data: cfg } = await supabase.from('wa_config')
      .select('minuta_envio_activa, minuta_envio_caduca_dias, minuta_envio_texto').eq('id', 1).maybeSingle();
    if (!cfg?.minuta_envio_activa) return 0;

    const { data: pendientes } = await supabase.from('wa_llamadas')
      .select('call_id, telefono, minuta_pdf_cliente_url, minuta_pdf_at, conversation_id')
      .eq('conversation_id', conversationId).eq('minuta_envio_estado', 'pendiente_ventana')
      .order('minuta_pdf_at', { ascending: false }).limit(3);
    if (!pendientes?.length) return 0;

    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('telefono, contacts(nombre)').eq('id', conversationId).maybeSingle();
    const tel = telefonoWhatsApp((conv as any)?.telefono || pendientes[0].telefono);
    if (!tel) return 0;
    const nombre = primerNombre((conv as any)?.contacts?.nombre) || 'qué tal';

    const caduca = Math.max(1, Number(cfg.minuta_envio_caduca_dias || 7)) * 24 * 3600e3;
    let mandadas = 0;
    for (const p of pendientes) {
      const edad = p.minuta_pdf_at ? Date.now() - Date.parse(p.minuta_pdf_at) : 0;
      /* Una minuta de hace un mes ya no le sirve a nadie y aparecer con ella
         de la nada es peor que no mandarla: se descarta con su motivo. */
      if (edad > caduca) {
        await supabase.from('wa_llamadas').update({ minuta_envio_estado: 'caducada', minuta_envio_motivo: `pasaron más de ${cfg.minuta_envio_caduca_dias} días esperando respuesta` }).eq('call_id', p.call_id);
        continue;
      }
      /* La versión del CLIENTE, nunca la interna. Esta rama corre días después
         del cierre y es justo donde un descuido pasaría inadvertido. */
      if (!p.minuta_pdf_cliente_url) continue;
      try {
        enContexto('minuta', 'telefonia');
        const pie = String(cfg.minuta_envio_texto || '').replace(/\{\{\s*nombre\s*\}\}/gi, nombre);
        await enviarMediaLink(tel, 'document', p.minuta_pdf_cliente_url, `Minuta ${folioDe(p.call_id)}.pdf`, pie || undefined);
        await supabase.from('wa_llamadas').update({
          minuta_envio_estado: 'enviada', minuta_envio_at: new Date().toISOString(),
          minuta_envio_motivo: 'se mandó al responder el cliente y abrirse la ventana',
        }).eq('call_id', p.call_id);
        mandadas++;
      } catch (e: any) {
        // Se deja pendiente: el próximo mensaje del cliente lo reintenta.
        console.warn(`[minuta/pendientes] ${p.call_id}: ${String(e?.message || e)}`);
      }
    }
    return mandadas;
  } catch (e: any) {
    console.error(`[minuta/pendientes] ${conversationId}: ${String(e?.message || e)}`);
    return 0;
  }
}
