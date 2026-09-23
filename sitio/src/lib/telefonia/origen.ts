/* ══ «¿DE DÓNDE NOS CONOCE?» (22-sep-2026) ═════════════════════════════════
 *
 * Medido en 68 llamadas reales: el caso más común (29 %) es «¿de dónde?»,
 * «yo no me registré», «no sé». El vendedor sólo alcanzaba a decir «te
 * registraste…» —casi todos llegaron por WhatsApp migrados de respond.io, con
 * fecha de alta falsa (la de la migración)— y la llamada se caía ahí.
 *
 * La prueba sí existía: su PRIMER MENSAJE de WhatsApp, con fecha y texto. O el
 * formulario de TikTok / de la página con su fecha. Esto la busca y la deja en
 * una frase lista para decir: «Te llamo porque el 3 de mayo nos escribiste por
 * WhatsApp: "quiero información del sistema"».
 */
import { supabase } from '../supabase';

const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', ...(new Date(iso).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
const limpio = (t: string) => String(t || '').replace(/\s+/g, ' ').trim();

export type Origen = { corta: string; detalle: string; primer_mensaje: { fecha: string; texto: string } | null };

export async function origenDelLead(o: { contact_id?: string | null; telefono?: string | null }): Promise<Origen | null> {
  const t10 = String(o.telefono || '').replace(/\D/g, '').slice(-10);
  const [{ data: c }, { data: convs }] = await Promise.all([
    o.contact_id ? supabase.from('contacts').select('fuente, created_at, giro, sucursales_interes, utm_campaign, companies(nombre_comercial, nombre)').eq('id', o.contact_id).maybeSingle() : Promise.resolve({ data: null as any }),
    supabase.from('wa_conversaciones').select('id').or([o.contact_id ? `contact_id.eq.${o.contact_id}` : null, t10.length === 10 ? `telefono.like.%${t10}` : null].filter(Boolean).join(',') || 'id.is.null').limit(5),
  ]);
  const ids = (convs || []).map((x: any) => x.id);
  /* Los primeros mensajes a veces son el texto AUTOMÁTICO del botón del
     anuncio («Envíar por este chat»): eso dice que llegó por un anuncio, no
     qué quería. Se cita el primero que escribió de verdad. */
  const { data: primeros } = ids.length
    ? await supabase.from('wa_mensajes').select('cuerpo, created_at').in('conversation_id', ids).eq('direccion', 'entrante').not('cuerpo', 'is', null).order('created_at').limit(6)
    : { data: [] as any[] };
  const AUTO = /^(env[ií]ar por este chat|hola!?|hola,? buen(os|as) (d[ií]as|tardes|noches)|buen(os|as) (d[ií]as|tardes)|info|informaci[oó]n)\.?$/i;
  const deAnuncio = (primeros || []).some((m: any) => /^env[ií]ar por este chat$/i.test(limpio(m.cuerpo)));
  const citable = (primeros || []).find((m: any) => !AUTO.test(limpio(m.cuerpo)) && limpio(m.cuerpo).length > 3);
  const primero = (primeros || [])[0] ? { created_at: (primeros as any)[0].created_at, cuerpo: citable?.cuerpo || null } : null;
  const fuente = String((c as any)?.fuente || '');
  const empresa = (c as any)?.companies?.nombre_comercial || (c as any)?.companies?.nombre || null;
  const extra = [(c as any)?.giro ? `giro: ${(c as any).giro}` : null, (c as any)?.sucursales_interes ? `${(c as any).sucursales_interes} tiendas` : null, empresa ? `tienda: ${empresa}` : null].filter(Boolean).join(' · ');
  // Una migración no es un registro: su fecha no se dice.
  const altaReal = !/respond\.io|migraci/i.test(fuente) && (c as any)?.created_at ? fechaLarga((c as any).created_at) : null;

  if (primero) {
    const texto = primero.cuerpo ? limpio(primero.cuerpo).slice(0, 90) : '';
    const via = deAnuncio ? 'por WhatsApp desde un anuncio de Sacs' : 'por WhatsApp';
    return {
      corta: `el ${fechaLarga(primero.created_at)} nos escribiste ${via}`,
      detalle: `Nos escribió ${via} el ${fechaLarga(primero.created_at)}${texto ? `: «${texto}»` : ''}${extra ? ` · ${extra}` : ''}`,
      primer_mensaje: texto ? { fecha: primero.created_at, texto } : null,
    };
  }
  if (/tiktok/i.test(fuente)) return { corta: `${altaReal ? `el ${altaReal} ` : ''}dejaste tus datos en un anuncio de Sacs en TikTok`, detalle: `Dejó sus datos en un anuncio de TikTok${altaReal ? ` el ${altaReal}` : ''}${extra ? ` · ${extra}` : ''}`, primer_mensaje: null };
  if (/website|web|sitio|formulario/i.test(fuente)) return { corta: `${altaReal ? `el ${altaReal} ` : ''}llenaste el formulario de sacscloud.com`, detalle: `Llenó el formulario de sacscloud.com${altaReal ? ` el ${altaReal}` : ''}${extra ? ` · ${extra}` : ''}`, primer_mensaje: null };
  if (extra || altaReal) return { corta: altaReal ? `el ${altaReal} nos dejaste tus datos` : 'nos dejaste tus datos', detalle: `Registro en el CRM${altaReal ? ` del ${altaReal}` : ''}${fuente ? ` (${fuente})` : ''}${extra ? ` · ${extra}` : ''}`, primer_mensaje: null };
  return null;
}
