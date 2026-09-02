// TRABAJO INTELIGENTE · LA GALERÍA DEL AGENTE.
//
// Decisión del dueño (2026-09-02): hay respuestas que valen más con imagen (la tabla
// de precios, la matriz talla × color, cómo se ve el apartado). El dueño sube las
// imágenes con una descripción de QUÉ muestran y CUÁNDO conviene mandarlas; el agente
// las ve en su prompt y elige una (máximo) cuando aporta; el dueño puede adjuntar o
// quitar la imagen al aprobar o corregir, y eso también queda como ejemplo.
import { supabase } from '../../supabase';

export type ImagenAgente = { id: string; nombre: string; url: string; descripcion: string | null; cuando: string | null; giros: string[]; temas: string[]; usos: number };

export async function galeriaActiva(): Promise<ImagenAgente[]> {
  const { data } = await supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando, giros, temas, usos').eq('activa', true).is('error', null).order('usos', { ascending: false }).limit(40);
  return (data || []) as ImagenAgente[];
}

/** Para el prompt: qué imágenes existen y cuándo usarlas. Vacío si no hay ninguna. */
export function galeriaTexto(lista: ImagenAgente[], giro?: string | null): string {
  if (!lista.length) return '';
  const g = String(giro || '').toLowerCase();
  const filtradas = lista.filter(i => !i.giros?.length || !g || i.giros.some(x => g.includes(String(x).toLowerCase())));
  if (!filtradas.length) return '';
  return '\n\nIMÁGENES QUE PUEDES MANDAR (máximo UNA por mensaje y solo si aporta de verdad; pon su id en "imagen.id", si no, null):\n'
    + filtradas.map(i => `[${i.id}] ${i.nombre} — muestra: ${i.descripcion || 's/d'}${i.cuando ? ` · úsala cuando: ${i.cuando}` : ''}`).join('\n');
}

export async function resolverImagen(id?: string | null): Promise<ImagenAgente | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { data } = await supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando, giros, temas, usos').eq('id', id).eq('activa', true).maybeSingle();
  return (data as ImagenAgente) || null;
}

export async function contarUso(id?: string | null) {
  if (!id) return;
  const { data } = await supabase.from('ia_imagenes').select('usos').eq('id', id).maybeSingle();
  await supabase.from('ia_imagenes').update({ usos: (Number(data?.usos) || 0) + 1 }).eq('id', id);
}

/** WhatsApp solo acepta JPG/PNG (131053: «WebP image uploads are not currently supported»). Lo que no lo sea se
 *  convierte a JPG con sharp y se sube al bucket público wa-media; devuelve la URL buena. */
const EXT_OK = /\.(jpe?g|png)(\?|$)/i;
export async function asegurarFormatoWhatsApp(url: string): Promise<{ url: string; convertida: boolean; error?: string }> {
  try {
    if (EXT_OK.test(url)) return { url, convertida: false };
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { url, convertida: false, error: `No se pudo leer la imagen (HTTP ${r.status})` };
    const mime = (r.headers.get('content-type') || '').split(';')[0];
    const buf = Buffer.from(await r.arrayBuffer());
    if (/^image\/(jpeg|png)$/.test(mime)) return { url, convertida: false };
    const sharp = (await import('sharp')).default;
    const out = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
    const path = `agente/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('wa-media').upload(path, out, { contentType: 'image/jpeg', upsert: false });
    if (error) return { url, convertida: false, error: error.message };
    return { url: supabase.storage.from('wa-media').getPublicUrl(path).data.publicUrl, convertida: true };
  } catch (e: any) { return { url, convertida: false, error: String(e?.message || e) }; }
}

/** Una imagen que WhatsApp rechazó deja de ofrecerse al agente hasta que el dueño la revise. */
export async function marcarErrorImagen(id: string | null | undefined, error: string) {
  if (!id) return;
  await supabase.from('ia_imagenes').update({ error: String(error).slice(0, 300) }).eq('id', id);
}
