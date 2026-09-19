/**
 * MANDAR UNA PLANTILLA Y DEJARLA VISIBLE EN EL INBOX.
 *
 * Pedido del dueño (2-sep-2026): «todo lo que se le mande al usuario de forma
 * clara debo verlo en el inbox, sin irme a ningún lado».
 *
 * Antes cada quien mandaba su plantilla por su cuenta, y cuatro de ellas
 * —cancelación, reagendada, «no llegaste» y la bienvenida— NO se espejaban:
 * el cliente las recibía y quien abría el chat no veía nada. Otras sí se
 * espejaban pero guardando un remedo del texto: «[Foto]» donde iba la foto y
 * «[Botones: …]» donde iban los botones.
 *
 * Aquí hay UN camino para todas, y el espejo guarda lo que el cliente VIO:
 *   · el cuerpo APROBADO de Meta con sus variables puestas —no una copia a
 *     mano que se desincroniza el día que alguien edita la plantilla—;
 *   · la foto del encabezado como imagen de verdad, para que se vea en la
 *     burbuja en vez de leerse «[Foto]»;
 *   · los botones como botones, no como una línea de texto.
 */
import { supabase } from '../supabase';
import { enviarPlantilla } from './kapso-api';
import { registrarMensaje } from './espejo';

export type PlantillaViva = {
  nombre: string; status?: string | null; variables?: number | null;
  header_tipo?: string | null; header_media_url?: string | null;
  cuerpo?: string | null; footer?: string | null; botones?: any;
  categoria?: string | null; respaldo_utility?: string | null; respaldo_params?: any;
};

/** La plantilla, si Meta la tiene aprobada. `null` si no se puede usar. */
export async function plantillaAprobada(nombre: string, idioma = 'es_MX'): Promise<PlantillaViva | null> {
  if (!nombre) return null;
  const { data } = await supabase.from('wa_plantillas')
    .select('nombre, status, variables, header_tipo, header_media_url, cuerpo, footer, botones, categoria, respaldo_utility, respaldo_params')
    .eq('nombre', nombre).eq('idioma', idioma).maybeSingle();
  return data?.status === 'APPROVED' ? (data as PlantillaViva) : null;
}

/** El cuerpo aprobado con las variables puestas. Sin foto ni botones: esos
 *  viajan aparte, como lo que son. */
export function resolverCuerpo(pl: PlantillaViva | null, params: string[], respaldo = ''): string {
  let t = String(pl?.cuerpo || '').trim();
  if (!t) return respaldo;
  params.forEach((v, i) => { t = t.split(`{{${i + 1}}}`).join(String(v ?? '')); });
  return pl?.footer ? `${t}\n\n${pl.footer}` : t;
}

const MIME: Record<string, string> = { IMAGE: 'image/jpeg', VIDEO: 'video/mp4', DOCUMENT: 'application/pdf' };

/**
 * LA REGLA DEL RESPALDO.
 *
 * Meta trata distinto las dos categorías: una plantilla de MARKETING no le
 * llega a quien apagó ese tipo de mensajes, ni a quien ya recibió demasiados
 * esta semana — y no falla en silencio siempre: a veces truena AL ENVIAR, con
 * «Meta limitó los mensajes de marketing a este número».
 *
 * Cuando eso pasa, el lead se queda sin nada. Pasó de verdad: Michelle se
 * registró el 2 de septiembre, se le mandó el primer mensaje de marketing,
 * Meta lo rechazó en el acto y no salió NADA más.
 *
 * Regla del dueño (3-sep-2026): toda plantilla de marketing automática lleva
 * SIEMPRE una de utilidad de respaldo. La de utilidad dice menos, pero pasa
 * por donde la otra no pasa.
 *
 * Vive aquí, en el camino común, y no repetida en cada llamador: una regla
 * copiada en cinco lugares se cumple en cuatro.
 */
export type Respaldo = { plantilla: string; params?: string[]; textoRespaldo?: string };

/**
 * Manda la plantilla y la espeja. No lanza por el espejo: si el mensaje ya
 * salió, no poder anotarlo no lo deshace.
 *
 * Devuelve `enviado:false` con motivo cuando no salió NINGUNA —ni la principal
 * ni su respaldo—; quien llama decide si eso merece una alerta. Nunca se traga
 * ese caso en silencio inventando otro camino.
 */
export async function mandarPlantilla(o: {
  telefono: string;
  plantilla: string;
  idioma?: string;
  params: string[];
  autor?: string;
  metadata?: any;
  /** Si la plantilla no está en la base, qué texto espejar. */
  textoRespaldo?: string;
  /** Para no volver a consultarla si el llamador ya la trae. */
  pl?: PlantillaViva | null;
  /** La de UTILIDAD que sale si la principal no está aprobada o Meta la rechaza. */
  respaldo?: Respaldo | null;
  /* ══ UN ARCHIVO DISTINTO EN CADA ENVÍO (19-sep-2026) ═════════════════════
     La plantilla guarda SU archivo de encabezado —el mismo para todos—, y eso
     vale para un folleto. Pero la minuta de una llamada es un PDF por llamada:
     sin esto, el único camino que espejaba no servía para ella, y la minuta
     salía por `enviarPlantilla` a secas. ¿Consecuencia? El mensaje quedaba
     registrado por el eco del webhook como «[Document]» pelado, sin URL ni
     mime — el dueño lo reportó: «en vez de que diga [Document], que aparezca un
     preview del PDF». Con el archivo aquí, el mensaje guarda su adjunto y la
     burbuja lo pinta como lo que es. */
  headerMedia?: { tipo: 'image' | 'video' | 'document'; link: string; filename?: string } | null;
}): Promise<{ enviado: boolean; wamid: string | null; texto: string; motivo?: string; via?: 'principal' | 'respaldo' }> {
  const idioma = o.idioma || 'es_MX';

  /* El respaldo se intenta por las DOS razones por las que la principal puede
     no salir: que no esté aprobada, y que Meta la rechace al enviarla. La
     segunda es la que dejó a Michelle sin mensaje. */
  const conRespaldo = async (motivo: string, pl?: PlantillaViva | null) => {
    /* ══ EL RESPALDO TIENE QUE HABLAR DEL MISMO TEMA ═══════════════════════
       Regla del dueño (15-sep-2026), y salió de un caso suyo: a Jakob se le
       mandó el aviso del número nuevo, Meta lo frenó, y en su lugar salió «que
       quedamos pendientes del tema de tu solicitud con Sacs». No tiene nada que
       ver con lo que le íbamos a decir. Siete personas recibieron eso.

       Así que el respaldo ya no se elige por conveniencia: lo declara la propia
       plantilla (`respaldo_utility`), que es donde sabe alguien qué dice la
       gemela. Si el llamador no pasa ninguno, se toma el de la plantilla; y si
       la plantilla no tiene gemela, NO SE MANDA NADA. Mejor silencio que
       confundir a un cliente. */
    const nombreRespaldo = o.respaldo?.plantilla || pl?.respaldo_utility || null;
    if (!nombreRespaldo) return { enviado: false, wamid: null, texto: '', motivo: `${motivo}; «${o.plantilla}» no tiene plantilla de utilidad que diga lo mismo, así que no se manda nada` };
    const rp = await plantillaAprobada(nombreRespaldo, idioma);
    if (!rp) return { enviado: false, wamid: null, texto: '', motivo: `${motivo}; y «${nombreRespaldo}» tampoco está aprobada` };
    /* Y tiene que ser UTILITY DE VERDAD. El nombre no vale: Meta reclasifica, y
       hay cinco plantillas nuestras que se llaman «…_utility_v1» y en Meta son
       MARKETING. Mandar una de esas como respaldo es tropezar con la misma
       piedra: el mismo carril, el mismo freno, el mismo lead sin mensaje. */
    if (String(rp.categoria || '').toUpperCase() !== 'UTILITY') {
      return { enviado: false, wamid: null, texto: '', motivo: `${motivo}; «${nombreRespaldo}» sería el respaldo pero en Meta es ${rp.categoria || 'de categoría desconocida'}, no UTILITY: chocaría con el mismo freno` };
    }
    try {
      /* LOS PARÁMETROS DEL RESPALDO.
         La gemela casi nunca tiene las mismas variables que la principal: la de
         seguimiento pide nombre Y tema, y la del aviso solo el nombre. Por eso
         la plantilla puede declarar `respaldo_params`: `null` en una posición
         significa «reusa el del mensaje original» y un texto es un literal.
         Sin eso, el {{2}} salía vacío y el mensaje decía «quedamos pendientes
         del tema de .» — el mismo error de forma distinta. */
      const declarados: any[] | null = Array.isArray(pl?.respaldo_params) ? pl!.respaldo_params : null;
      const nVars = Math.max(0, Number(rp.variables) || 0);
      const paramsRespaldo = o.respaldo?.params
        ?? (declarados ? Array.from({ length: nVars }, (_, i) => String(declarados[i] ?? o.params[i] ?? '')) 
                       : o.params.slice(0, nVars));
      const r = await mandarPlantilla({
        telefono: o.telefono, plantilla: rp.nombre, idioma, pl: rp,
        params: paramsRespaldo,
        autor: o.autor, textoRespaldo: o.respaldo?.textoRespaldo,
        /* Queda anotado de quién es respaldo: en el inbox se tiene que poder
           ver que salió la segunda, no la que se pidió. */
        metadata: { ...(o.metadata || {}), respaldo_de: o.plantilla, respaldo_motivo: motivo },
      });
      return { ...r, via: 'respaldo' as const };
    } catch (e: any) {
      return { enviado: false, wamid: null, texto: '', motivo: `${motivo}; el respaldo también falló: ${String(e?.message || e).slice(0, 120)}` };
    }
  };

  const pl = o.pl !== undefined ? o.pl : await plantillaAprobada(o.plantilla, idioma);
  if (!pl) return conRespaldo(`«${o.plantilla}» no está aprobada`, null);

  const ht = String(pl.header_tipo || 'TEXT').toUpperCase();
  const media = o.headerMedia
    ? o.headerMedia
    : (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && pl.header_media_url
      ? { tipo: ht.toLowerCase() as 'image' | 'video' | 'document', link: String(pl.header_media_url) }
      : null);

  let r: any;
  try {
    r = await enviarPlantilla(o.telefono, pl.nombre, idioma, o.params, media ? { headerMedia: media } : undefined);
  } catch (e: any) {
    /* Meta la rechazó AL ENVIAR. Es el caso de «Meta limitó los mensajes de
       marketing a este número»: cae al respaldo en el acto, no en diez
       minutos, porque aquí ya sabemos que no salió. */
    return conRespaldo(String(e?.message || e).slice(0, 160), pl);
  }
  const wamid = r?.messages?.[0]?.id || null;
  const texto = resolverCuerpo(pl, o.params, o.textoRespaldo || '');

  if (wamid) {
    await registrarMensaje({
      kapsoMessageId: wamid, telefono: o.telefono, direccion: 'saliente',
      /* Con archivo, el tipo es el del ARCHIVO y no «template»: la burbuja
         dibuja la tarjeta del documento —con su extensión y «verlo aquí
         mismo»— sólo si el tipo se lo dice. Como «template» salía el texto y
         el PDF quedaba invisible, que es lo que el dueño reportó viendo un
         «[Document]» pelado. El cuerpo aprobado se sigue guardando y se pinta
         debajo de la tarjeta; que era una plantilla queda en `metadata`. */
      tipo: media ? media.tipo : 'template',
      cuerpo: texto, status: 'sent', autor: o.autor || 'Agenda',
      mediaUrl: media ? media.link : null,
      mime: media ? (MIME[media.tipo.toUpperCase()] || MIME[ht] || null) : null,
      metadata: {
        ...(o.metadata || {}), plantilla: pl.nombre, botones: pl.botones || null,
        /* EL PLAN DE RESPALDO VIAJA CON EL MENSAJE.
           Meta acepta la plantilla y reporta el fallo DESPUÉS, por webhook de
           estado: al enviar no se sabe. Guardando aquí qué mandar en su lugar,
           el webhook puede dispararlo en cuanto llega el «failed», sin esperar
           al reloj de los diez minutos y sin que cada flujo tenga que
           acordarse de su propia red. */
        /* El plan viaja con el mensaje para cuando Meta reporte el fallo DESPUÉS
           (por webhook). Sale de lo que pidió el llamador o, si no pidió nada,
           de la gemela que declara la plantilla — la misma regla de arriba. */
        ...((o.respaldo?.plantilla || pl.respaldo_utility) ? { respaldo_plan: {
          plantilla: o.respaldo?.plantilla || pl.respaldo_utility,
          params: o.respaldo?.params
            ?? (Array.isArray(pl.respaldo_params)
                  ? (pl.respaldo_params as any[]).map((v, i) => String(v ?? o.params[i] ?? ''))
                  : o.params.slice(0, 6)),
          texto: o.respaldo?.textoRespaldo || null,
        } } : {}),
      },
    }).catch(() => { /* el espejo no tumba un envío que ya salió */ });
  }
  return { enviado: true, wamid, texto, via: 'principal' };
}


/**
 * Meta reportó que el mensaje NO se entregó. Si llevaba plan de respaldo, sale
 * ahora — no en diez minutos: ya sabemos que no llegó.
 *
 * Es el caso de 131049 («Meta limitó los mensajes de marketing a este número»)
 * y de 130472 («el número está en un experimento de Meta»): la API acepta el
 * envío y el rechazo llega después. Sin esto, el lead se queda sin nada.
 */
export async function respaldoPorFallo(kapsoMessageId: string, motivo?: string | null): Promise<boolean> {
  if (!kapsoMessageId) return false;
  const { data: m } = await supabase.from('wa_mensajes')
    .select('id, metadata, conversation_id').eq('kapso_message_id', kapsoMessageId).maybeSingle();
  const plan = (m as any)?.metadata?.respaldo_plan;
  /* Una sola vez: Meta puede repetir el webhook de estado y no vamos a
     mandarle al cliente el mismo mensaje tres veces. */
  if (!plan?.plantilla || (m as any)?.metadata?.respaldo_disparado) return false;

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('telefono').eq('id', (m as any).conversation_id).maybeSingle();
  if (!conv?.telefono) return false;

  /* Se marca ANTES de mandar: si el envío tarda y el webhook se repite, no
     salen dos. Vale más un respaldo perdido que dos mensajes al cliente. */
  await supabase.from('wa_mensajes')
    .update({ metadata: { ...((m as any).metadata || {}), respaldo_disparado: new Date().toISOString() } })
    .eq('id', (m as any).id);

  const r = await mandarPlantilla({
    telefono: conv.telefono, plantilla: String(plan.plantilla),
    params: Array.isArray(plan.params) ? plan.params : [],
    textoRespaldo: plan.texto || undefined,
    metadata: { respaldo_de: (m as any).metadata?.plantilla || null, respaldo_motivo: motivo || 'Meta no lo entregó' },
  }).catch(() => ({ enviado: false }) as any);

  /* Y se cierra la fila del PRIMER MENSAJE si era una de esas: el reloj de los
     diez minutos revisa lo mismo y, sin esto, le mandaría al cliente una
     segunda vez la de utilidad. Dos caminos hacia el mismo respaldo tienen que
     saber uno del otro. */
  if (r?.enviado) {
    await supabase.from('wa_primer_mensaje')
      .update({ estado: 'respaldo_enviado', updated_at: new Date().toISOString() })
      .eq('wamid', kapsoMessageId).eq('estado', 'esperando');
    // Envío del AGENTE (7-sep): la utility pasa a ser la pieza vigente, el reloj de 10 min ya no la repite, y el hilo lo dice.
    const envioId = plan.envio_id || (m as any)?.metadata?.envio_id || null;
    const hora = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' });
    if (envioId) {
      const { data: env } = await supabase.from('ti_envios').select('salida, origen').eq('id', envioId).maybeSingle();
      const esRecuperacion = ['reactivacion', 'reenganche', 'cotizacion', 'silencio'].includes(String((env as any)?.origen || ''));
      await supabase.from('ti_envios').update({ fallback_estado: 'utility_enviada', kapso_message_id: r.wamid || null, salida: { ...(((env as any)?.salida) || {}), marketing_wamid: kapsoMessageId, plantilla_usada: String(plan.plantilla), respaldo: 'webhook' }, updated_at: new Date().toISOString() }).eq('id', envioId).then(() => {}, () => {});
      await supabase.from('ia_log').insert({ accion: 'plantilla_fallback', razon: `marketing falló (${String(motivo || '').slice(0, 60)}) → utility ${plan.plantilla} al instante`, detalle: { envio_id: envioId, via: 'webhook' } }).then(() => {}, () => {});
      const { notaSistema } = await import('./espejo');
      await notaSistema(conv.telefono, `Meta no entregó la plantilla de marketing${motivo ? ` (${String(motivo).slice(0, 90)})` : ''}. Salió la plantilla de utilidad ${plan.plantilla} a las ${hora}${esRecuperacion ? '; el mensaje completo le llega en cuanto conteste' : ''}.`, { envio_id: envioId, fallback: 'webhook' });
    }
  }
  return !!r?.enviado;
}
