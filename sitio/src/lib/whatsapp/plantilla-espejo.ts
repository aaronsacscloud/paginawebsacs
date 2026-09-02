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
 * Manda la plantilla y la espeja. No lanza por el espejo: si el mensaje ya
 * salió, no poder anotarlo no lo deshace.
 *
 * Devuelve `enviado:false` con motivo cuando la plantilla no está aprobada —
 * quien llama decide si eso merece una alerta. Nunca se traga ese caso en
 * silencio inventando otro camino.
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
}): Promise<{ enviado: boolean; wamid: string | null; texto: string; motivo?: string }> {
  const idioma = o.idioma || 'es_MX';
  const pl = o.pl !== undefined ? o.pl : await plantillaAprobada(o.plantilla, idioma);
  if (!pl) return { enviado: false, wamid: null, texto: '', motivo: `«${o.plantilla}» no está aprobada` };

  const ht = String(pl.header_tipo || 'TEXT').toUpperCase();
  const media = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && pl.header_media_url
    ? { tipo: ht.toLowerCase() as 'image' | 'video' | 'document', link: String(pl.header_media_url) }
    : null;

  const r = await enviarPlantilla(o.telefono, pl.nombre, idioma, o.params, media ? { headerMedia: media } : undefined);
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
  return { enviado: true, wamid, texto };
}
