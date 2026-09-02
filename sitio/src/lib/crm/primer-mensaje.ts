/**
 * EL PRIMER MENSAJE AL CONTACTO — marketing primero, utilidad de respaldo.
 *
 * Decisión del dueño (2-sep-2026): el primer WhatsApp sale como MARKETING —
 * con foto, preguntas concretas y texto más suelto, que es lo que de verdad
 * abre conversación—. Diez minutos después se revisa si llegó. Si Meta lo
 * bloqueó, entonces —y solo entonces— sale la de UTILIDAD, que es más seca
 * pero pasa por donde el marketing no pasa.
 *
 * POR QUÉ HACEN FALTA LAS DOS. Meta trata distinto las dos categorías: quien
 * apagó los mensajes de marketing, o quien ya recibió demasiados esta semana,
 * simplemente no los recibe —y el envío no falla al mandarlo, falla después,
 * en el estado—. Por eso no basta con mirar la respuesta de la API: hay que
 * volver a mirar más tarde. Eso es lo que hace el cron `wa-primer-mensaje`.
 *
 * REGLAS DURAS:
 * - Es el PRIMER mensaje: uno por número, una vez en la vida. La unicidad
 *   vive en la base (`wa_primer_mensaje.telefono`), no en esta lógica, para
 *   que dos fuentes de leads a la vez no puedan abrir dos conversaciones.
 * - Si ese número YA tiene conversación nuestra, no es el primero: no sale.
 * - Si la plantilla de marketing no está aprobada, NO se calla: sale la de
 *   utilidad de una vez y queda avisado. Una plantilla en revisión no puede
 *   dejar a un lead sin ningún mensaje.
 */
import { supabase } from '../supabase';
import { mandarPlantilla, plantillaAprobada } from '../whatsapp/plantilla-espejo';
import { telefonoWhatsApp } from '../telefono';
import { permitido, configDe } from '../whatsapp/permisos';
import { notificar } from './notificaciones';

const POR_DEFECTO = {
  plantilla_marketing: 'primer_contacto_moda',
  plantilla_utility: 'solicitud_asignada_asesor',
  espera_min: 10,
};

type Resultado = { ok: boolean; via?: 'marketing' | 'utility'; motivo?: string };

const plantillaViva = (nombre: string) => plantillaAprobada(nombre);

/** Los parámetros del cuerpo, recortados a las que la plantilla declara. */
function params(pl: any, primerNombre: string, empresa?: string | null): string[] {
  const todos = [primerNombre, String(empresa || '').trim()].filter(Boolean);
  return todos.slice(0, Math.max(0, Number(pl?.variables) || 0));
}

/**
 * Manda por el camino COMÚN de plantillas, que ya espeja la foto como foto y
 * los botones como botones. Antes aquí se armaba el texto a mano y el inbox
 * enseñaba «[Foto]» en vez de la imagen: quien abría el chat no podía saber
 * qué foto se le había mandado al cliente.
 */
async function mandar(pl: any, telefono: string, primerNombre: string, empresa?: string | null) {
  const ps = params(pl, primerNombre, empresa);
  const r = await mandarPlantilla({
    telefono, plantilla: pl.nombre, params: ps, pl,
    metadata: { motivo: 'primer_mensaje' },
  });
  if (!r.enviado) throw new Error(r.motivo || 'plantilla no disponible');
  return { wamid: r.wamid, texto: r.texto };
}

/**
 * Abre la conversación con un contacto nuevo.
 *
 * No lanza: un lead que entra no se pierde porque WhatsApp falle.
 */
export async function enviarPrimerMensaje(o: {
  telefono: string; contactId?: string | null; nombre?: string | null; empresa?: string | null;
}): Promise<Resultado> {
  if (!(await permitido('primer_mensaje'))) return { ok: false, motivo: 'pausado' };

  const tel = telefonoWhatsApp(o.telefono || '');
  if (!tel) return { ok: false, motivo: 'teléfono no utilizable para WhatsApp' };

  // ¿Ya se le mandó el primero alguna vez?
  const { data: ya } = await supabase.from('wa_primer_mensaje')
    .select('id, estado').eq('telefono', tel).maybeSingle();
  if (ya) return { ok: false, motivo: 'ya tuvo su primer mensaje' };

  /* Si ese número ya habló con nosotros, esto no es un primer contacto: es
     meterse en una conversación que ya existe con un mensaje de bienvenida. */
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id').eq('telefono', tel).maybeSingle();
  if (conv) {
    const { count } = await supabase.from('wa_mensajes')
      .select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id);
    if ((count || 0) > 0) return { ok: false, motivo: 'ese número ya tiene conversación' };
  }

  const cfg = { ...POR_DEFECTO, ...(await configDe('primer_mensaje')) };
  const primerNombre = String(o.nombre || '').trim().split(/\s+/)[0] || 'hola';

  const mkt = await plantillaViva(String(cfg.plantilla_marketing));
  const util = await plantillaViva(String(cfg.plantilla_utility));

  /* Sin ninguna de las dos aprobadas no hay nada que mandar, y eso SE DICE:
     un lead entrando a un embudo mudo es lo más caro que puede pasar aquí. */
  if (!mkt && !util) {
    await notificar({
      clave: `primer-mensaje-sin-plantilla:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'wa_plantilla', nivel: 'alerta',
      titulo: 'Los leads nuevos no están recibiendo WhatsApp',
      detalle: `Ni «${cfg.plantilla_marketing}» ni «${cfg.plantilla_utility}» están aprobadas en Meta.`,
      destino: 'whatsapp',
    }).catch(() => {});
    return { ok: false, motivo: 'sin plantilla aprobada' };
  }

  const espera = Math.max(1, Number(cfg.espera_min) || POR_DEFECTO.espera_min);
  const usa = mkt || util!;
  const esMkt = !!mkt;

  if (!mkt) {
    /* La de marketing todavía no pasa la revisión de Meta. Sale la de
       utilidad de una vez —el lead no espera a un trámite— y queda avisado
       una vez al día para que alguien lo empuje. */
    await notificar({
      clave: `primer-mensaje-mkt-pendiente:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'wa_plantilla', nivel: 'info',
      titulo: 'El primer mensaje está saliendo con la plantilla de respaldo',
      detalle: `«${cfg.plantilla_marketing}» no está aprobada, así que los leads nuevos reciben «${cfg.plantilla_utility}».`,
      destino: 'whatsapp',
    }).catch(() => {});
  }

  let salida: { wamid: string | null; texto: string };
  try {
    salida = await mandar(usa, tel, primerNombre, o.empresa);
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message || e).slice(0, 200) };
  }
  const wamid = salida.wamid;

  await supabase.from('wa_primer_mensaje').insert({
    telefono: tel, contact_id: o.contactId || null,
    plantilla_marketing: esMkt ? usa.nombre : null,
    plantilla_utility: String(cfg.plantilla_utility),
    wamid,
    /* Si ya salió la de utilidad no hay nada que verificar: no existe un
       tercer escalón al cual caer. */
    estado: esMkt ? 'esperando' : 'respaldo_enviado',
    verificar_at: new Date(Date.now() + espera * 60000).toISOString(),
    detalle: { primera: usa.nombre, con_foto: usa.header_tipo === 'IMAGE' },
  }).then(() => {}, () => {});

  await supabase.from('activities').insert({
    contact_id: o.contactId || null, tipo: 'bienvenida_wa', automatico: true,
    titulo: `Primer mensaje por WhatsApp (${esMkt ? 'marketing' : 'utilidad'}: ${usa.nombre})`,
    metadata: { plantilla: usa.nombre, telefono: tel, categoria: esMkt ? 'MARKETING' : 'UTILITY' },
  }).then(() => {}, () => {});

  return { ok: true, via: esMkt ? 'marketing' : 'utility' };
}

/** ¿Llegó de verdad? Se pregunta pasada la espera, no al enviar. */
async function llego(fila: any): Promise<boolean> {
  // 1. El estado que reportó Meta por el webhook.
  if (fila.wamid) {
    const { data: m } = await supabase.from('wa_mensajes')
      .select('status').eq('kapso_message_id', fila.wamid).maybeSingle();
    if (m?.status && ['delivered', 'read'].includes(String(m.status))) return true;
  }
  /* 2. Y la prueba que no admite discusión: contestó. Puede pasar que el
     estado se pierda —un webhook que no llegó— y el cliente sí lo tenga
     enfrente; mandarle entonces la segunda plantilla sería escribirle dos
     veces lo mismo. */
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id').eq('telefono', fila.telefono).maybeSingle();
  if (conv) {
    const { count } = await supabase.from('wa_mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id).eq('direccion', 'entrante')
      .gt('created_at', fila.enviado_at);
    if ((count || 0) > 0) return true;
  }
  return false;
}

/** El segundo paso: revisar los que ya cumplieron su espera. */
export async function revisarPrimerosMensajes(): Promise<any> {
  const res = { revisados: 0, llegaron: 0, respaldos: 0, fallas: 0 };
  if (!(await permitido('primer_mensaje'))) return { ...res, pausado: true };

  const { data: filas } = await supabase.from('wa_primer_mensaje')
    .select('*').eq('estado', 'esperando')
    .lte('verificar_at', new Date().toISOString())
    .order('verificar_at').limit(50);

  for (const f of filas || []) {
    res.revisados++;
    const marca = (estado: string, detalle?: any) => supabase.from('wa_primer_mensaje')
      .update({ estado, updated_at: new Date().toISOString(), detalle: { ...(f.detalle || {}), ...(detalle || {}) } })
      .eq('id', f.id);

    if (await llego(f)) { await marca('llego'); res.llegaron++; continue; }

    // No llegó: sale la de utilidad.
    const util = await plantillaViva(String(f.plantilla_utility || POR_DEFECTO.plantilla_utility));
    if (!util) {
      await marca('sin_respaldo', { motivo: 'la plantilla de utilidad no está aprobada' });
      res.fallas++;
      await notificar({
        clave: `primer-mensaje-sin-respaldo:${new Date().toISOString().slice(0, 10)}`,
        tipo: 'wa_plantilla', nivel: 'alerta',
        titulo: 'Un lead se quedó sin primer mensaje',
        detalle: `El de marketing no llegó y «${f.plantilla_utility}» no está aprobada para respaldarlo.`,
        destino: 'whatsapp',
      }).catch(() => {});
      continue;
    }

    const { data: c } = f.contact_id
      ? await supabase.from('contacts').select('nombre').eq('id', f.contact_id).maybeSingle()
      : { data: null as any };
    const primerNombre = String(c?.nombre || '').trim().split(/\s+/)[0] || 'hola';

    try {
      const r2 = await mandar(util, f.telefono, primerNombre, null);
      await marca('respaldo_enviado', { respaldo: util.nombre, respaldo_wamid: r2.wamid });
      res.respaldos++;
      await supabase.from('activities').insert({
        contact_id: f.contact_id || null, tipo: 'bienvenida_wa', automatico: true,
        titulo: `El primer mensaje de marketing no llegó: salió el de utilidad (${util.nombre})`,
        metadata: { plantilla: util.nombre, telefono: f.telefono, categoria: 'UTILITY' },
      }).then(() => {}, () => {});
    } catch (e: any) {
      /* Se queda en «esperando» a propósito: la próxima corrida lo reintenta.
         Marcarlo como enviado sería dar por hecho un mensaje que no salió. */
      res.fallas++;
      await notificar({
        clave: `primer-mensaje-respaldo-falla:${f.id}`,
        tipo: 'wa_plantilla', nivel: 'alerta',
        titulo: 'No salió el mensaje de respaldo de un lead nuevo',
        detalle: String(e?.message || e).slice(0, 300),
        destino: 'whatsapp',
        metadata: { contact_id: f.contact_id, telefono: f.telefono },
      }).catch(() => {});
    }
  }
  return res;
}
