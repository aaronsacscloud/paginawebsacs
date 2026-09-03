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
};

/** La plantilla, si Meta la tiene aprobada. `null` si no se puede usar. */
export async function plantillaAprobada(nombre: string, idioma = 'es_MX'): Promise<PlantillaViva | null> {
  if (!nombre) return null;
  const { data } = await supabase.from('wa_plantillas')
    .select('nombre, status, variables, header_tipo, header_media_url, cuerpo, footer, botones')
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
}): Promise<{ enviado: boolean; wamid: string | null; texto: string; motivo?: string; via?: 'principal' | 'respaldo' }> {
  const idioma = o.idioma || 'es_MX';

  /* El respaldo se intenta por las DOS razones por las que la principal puede
     no salir: que no esté aprobada, y que Meta la rechace al enviarla. La
     segunda es la que dejó a Michelle sin mensaje. */
  const conRespaldo = async (motivo: string) => {
    if (!o.respaldo?.plantilla) return { enviado: false, wamid: null, texto: '', motivo };
    const rp = await plantillaAprobada(o.respaldo.plantilla, idioma);
    if (!rp) return { enviado: false, wamid: null, texto: '', motivo: `${motivo}; y «${o.respaldo.plantilla}» tampoco está aprobada` };
    try {
      const r = await mandarPlantilla({
        telefono: o.telefono, plantilla: rp.nombre, idioma, pl: rp,
        /* Sin params propios se reusan los de la principal, recortados a las
           variables que declara el respaldo: mandarle de más a Meta es un 400 y
           el mensaje no sale. */
        params: o.respaldo.params ?? o.params.slice(0, Math.max(0, Number(rp.variables) || 0)),
        autor: o.autor, textoRespaldo: o.respaldo.textoRespaldo,
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
  if (!pl) return conRespaldo(`«${o.plantilla}» no está aprobada`);

  const ht = String(pl.header_tipo || 'TEXT').toUpperCase();
  const media = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && pl.header_media_url
    ? { tipo: ht.toLowerCase() as 'image' | 'video' | 'document', link: String(pl.header_media_url) }
    : null;

  let r: any;
  try {
    r = await enviarPlantilla(o.telefono, pl.nombre, idioma, o.params, media ? { headerMedia: media } : undefined);
  } catch (e: any) {
    /* Meta la rechazó AL ENVIAR. Es el caso de «Meta limitó los mensajes de
       marketing a este número»: cae al respaldo en el acto, no en diez
       minutos, porque aquí ya sabemos que no salió. */
    return conRespaldo(String(e?.message || e).slice(0, 160));
  }
  const wamid = r?.messages?.[0]?.id || null;
  const texto = resolverCuerpo(pl, o.params, o.textoRespaldo || '');

  if (wamid) {
    await registrarMensaje({
      kapsoMessageId: wamid, telefono: o.telefono, direccion: 'saliente', tipo: 'template',
      cuerpo: texto, status: 'sent', autor: o.autor || 'Agenda',
      mediaUrl: media ? media.link : null,
      mime: media ? MIME[ht] : null,
      metadata: { ...(o.metadata || {}), plantilla: pl.nombre, botones: pl.botones || null },
    }).catch(() => { /* el espejo no tumba un envío que ya salió */ });
  }
  return { enviado: true, wamid, texto, via: 'principal' };
}
