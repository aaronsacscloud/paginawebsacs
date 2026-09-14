// ¿QUIÉN ES ESTE NÚMERO? — EL QUE VIENE DE UN CORREO NUESTRO
//
// Caso que lo destapó (14-sep-2026): Matin Vera Vera, cuenta cancelada de
// sujuma, recibió el correo del año sin costo, hizo clic en el botón de
// WhatsApp a las 20:48:46 y su mensaje llegó a las 20:49:51 desde un número que
// no teníamos. El CRM lo registró como lead nuevo, sin nombre, y lo metió a la
// cadencia de rezagados. Todo lo que hacía falta para reconocerlo YA estaba
// guardado: el clic vive en `email_sends.clicked_links` con el contacto, el
// enlace y el segundo exacto.
//
// El botón de esos correos lleva el texto YA ESCRITO en el propio enlace
// (`wa.me/...?text=Hola Andrea, me interesa la reunión...`). Así que no hay que
// adivinar nada: si lo que acaba de llegar es ese mismo texto, es esa persona.
// Y si lo editó, el clic solo —uno, reciente, de una sola persona— alcanza para
// PROPONERLO, nunca para darlo por hecho.
/* La base se pide DENTRO de la función, no arriba: así las dos reglas que
   deciden —leer el texto del enlace y ver si coincide— se pueden probar solas,
   sin levantar medio sistema para comprobar una comparación de cadenas. */

export type Identificado = {
  contactId: string;
  companyId: string | null;
  nombre: string | null;
  /** `exacta` = el texto es el del enlace. `clic` = solo hizo clic; se propone. */
  certeza: 'exacta' | 'clic';
  motivo: string;
  campana: string | null;
  clicAt: string;
};

/** Para comparar como compara una persona: sin acentos, sin signos, sin dobles espacios. */
const norm = (s: string) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** El `?text=` de un enlace de WhatsApp, o null si no lo trae. */
export function textoDelEnlace(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)wa\.me$|(^|\.)api\.whatsapp\.com$/i.test(u.hostname)) return null;
    return u.searchParams.get('text');
  } catch { return null; }
}

/**
 * ¿Lo que llegó es el texto que llevaba el enlace?
 *
 * «Empieza igual» y no «idéntico»: WhatsApp recorta el texto precargado si es
 * largo, y hay quien le agrega una línea antes de mandarlo. Cuarenta caracteres
 * en común son de sobra —el precargado es una frase entera— y no dan falsos:
 * nadie escribe por su cuenta la primera línea de nuestro correo.
 */
export function coincideTexto(entrante: string, delEnlace: string): boolean {
  const a = norm(entrante), b = norm(delEnlace);
  if (!a || !b) return false;
  /* Se compara el principio que ambos tienen, hasta cuarenta caracteres. Y hace
     falta un MÍNIMO de veinticinco: sin ese piso, un «Hola» pelón encajaba con
     cualquier enlace que empezara con «Hola» —le habríamos puesto nombre y
     apellido al primero que saludara—. Veinticinco caracteres son media frase;
     nadie escribe por su cuenta media frase de nuestro correo. */
  const n = Math.min(40, a.length, b.length);
  if (n < 25) return a === b;
  return a.slice(0, n) === b.slice(0, n);
}

/**
 * Busca de quién es un mensaje que llegó de un número desconocido.
 *
 * @param texto    lo que escribió (su primer mensaje)
 * @param minutos  cuánto atrás se miran los clics (por defecto hora y media)
 */
export async function identificarPorClic(texto: string, minutos = 90): Promise<Identificado | null> {
  const { supabase } = await import('../supabase');
  const desde = new Date(Date.now() - minutos * 60000).toISOString();
  const { data } = await supabase.from('email_sends')
    .select('contact_id, clicked_at, clicked_links, asunto, contacts(id, nombre, apellido, company_id, whatsapp)')
    .gt('clicked_at', desde).not('clicked_links', 'is', null)
    .order('clicked_at', { ascending: false }).limit(60);

  const entrante = norm(texto);
  const candidatos: Identificado[] = [];
  for (const s of data || []) {
    const c: any = (s as any).contacts;
    if (!c?.id) continue;
    for (const l of (s.clicked_links as any[]) || []) {
      const t = textoDelEnlace(String(l?.url || ''));
      if (t === null) continue;
      const base: Omit<Identificado, 'certeza' | 'motivo'> = {
        contactId: c.id, companyId: c.company_id || null,
        nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || null,
        campana: s.asunto || null, clicAt: String(l?.clicked_at || s.clicked_at),
      };
      const pega = coincideTexto(texto, t);
      candidatos.push(pega
        ? { ...base, certeza: 'exacta', motivo: `Hizo clic en el WhatsApp del correo «${s.asunto || 'de campaña'}» y mandó ese mismo texto` }
        : { ...base, certeza: 'clic', motivo: `Hizo clic en el WhatsApp del correo «${s.asunto || 'de campaña'}»` });
    }
  }

  const exactos = candidatos.filter(c => c.certeza === 'exacta');
  // Con el texto no hace falta más: es esa persona.
  if (exactos.length === 1) return exactos[0];
  /* Dos personas con el mismo texto precargado —el mismo correo masivo— y el
     mismo minuto: no se elige a cara o cruz. Se queda el más cercano en el
     tiempo, pero como PROPUESTA, para que lo confirme quien atiende. */
  if (exactos.length > 1) return { ...exactos[0], certeza: 'clic', motivo: `${exactos[0].motivo} (y alguien más hizo clic en el mismo minuto: confírmalo)` };

  const porClic = [...new Map(candidatos.map(c => [c.contactId, c])).values()];
  if (porClic.length === 1) return porClic[0];
  return null;
}
