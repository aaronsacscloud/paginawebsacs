// TRABAJO INTELIGENTE · LA GALERÍA DEL AGENTE.
//
// Decisión del dueño (2026-09-02): hay respuestas que valen más con imagen (la tabla
// de precios, la matriz talla × color, cómo se ve el apartado). El dueño sube las
// imágenes con una descripción de QUÉ muestran y CUÁNDO conviene mandarlas; el agente
// las ve en su prompt y elige una (máximo) cuando aporta; el dueño puede adjuntar o
// quitar la imagen al aprobar o corregir, y eso también queda como ejemplo.
import { supabase } from '../../supabase';

export type TipoRecurso = 'image' | 'document' | 'video';
export type ImagenAgente = { id: string; nombre: string; url: string; descripcion: string | null; cuando: string | null; giros: string[]; temas: string[]; usos: number; tipo: TipoRecurso; mime?: string | null; bytes?: number | null; grupo?: string | null };
export const MAX_ADJUNTOS = 5;
export type Adjunto = { id: string; tipo: TipoRecurso; url: string; nombre: string; por_que?: string };
export const TIPO_L: Record<TipoRecurso, string> = { image: 'imagen', document: 'PDF/documento', video: 'video' };

/* Lo que WhatsApp (Cloud API vía Kapso) acepta. Fuera de esto, el envío falla en silencio horas después. */
export const REGLAS_WA: Record<TipoRecurso, { mimes: string[]; maxBytes: number; nota: string }> = {
  image: { mimes: ['image/jpeg', 'image/png'], maxBytes: 5 * 1024 * 1024, nota: 'JPG o PNG, máximo 5 MB (WebP/GIF/SVG se convierten a JPG)' },
  video: { mimes: ['video/mp4', 'video/3gpp'], maxBytes: 16 * 1024 * 1024, nota: 'MP4 (H.264 + AAC) o 3GP, máximo 16 MB' },
  document: { mimes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain'], maxBytes: 100 * 1024 * 1024, nota: 'PDF (o Word/Excel/PowerPoint), máximo 100 MB' },
};
const CONVERTIBLES = ['image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'];

/** Clasifica y valida un archivo antes de subirlo. */
export function validarRecurso(o: { mime?: string | null; bytes?: number | null; nombre?: string | null }): { ok: true; tipo: TipoRecurso; convertir: boolean } | { ok: false; error: string } {
  const mime = String(o.mime || '').split(';')[0].toLowerCase();
  const bytes = Number(o.bytes) || 0;
  const tipo: TipoRecurso | null = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : REGLAS_WA.document.mimes.includes(mime) ? 'document' : null;
  if (!tipo) return { ok: false, error: `Formato no admitido por WhatsApp (${mime || 'desconocido'}). Imagen JPG/PNG, video MP4 o documento PDF.` };
  const r = REGLAS_WA[tipo];
  const convertir = tipo === 'image' && !r.mimes.includes(mime);
  if (tipo === 'image' && !r.mimes.includes(mime) && !CONVERTIBLES.includes(mime)) return { ok: false, error: `Imagen en ${mime}: usa JPG o PNG.` };
  if (tipo !== 'image' && !r.mimes.includes(mime)) return { ok: false, error: `${tipo === 'video' ? 'Video' : 'Documento'} en ${mime}: ${r.nota}.` };
  if (bytes > r.maxBytes) return { ok: false, error: `Pesa ${(bytes / 1048576).toFixed(1)} MB; WhatsApp admite ${r.nota}.` };
  return { ok: true, tipo, convertir };
}

/** Los adjuntos que el agente eligió, validados contra la galería (el guion le pide máximo 2; el dueño puede poner hasta MAX_ADJUNTOS). */
export function resolverAdjuntos(ids: any, galeria: ImagenAgente[], max = MAX_ADJUNTOS): Adjunto[] {
  const lista: any[] = Array.isArray(ids) ? ids : [];
  const out: Adjunto[] = [];
  for (const x of lista) {
    const id = typeof x === 'string' ? x : x?.id;
    const g = galeria.find(i => i.id === id);
    if (g && !out.some(a => a.id === g.id)) out.push({ id: g.id, tipo: g.tipo || 'image', url: g.url, nombre: g.nombre, por_que: String(x?.por_que || '').slice(0, 160) || undefined });
    if (out.length >= max) break;
  }
  return out;
}

export async function galeriaActiva(): Promise<ImagenAgente[]> {
  const { data } = await supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando, giros, temas, usos, tipo, mime, bytes, grupo').eq('activa', true).is('error', null).order('usos', { ascending: false }).limit(80);
  return (data || []) as ImagenAgente[];
}

/** Para el prompt: qué imágenes existen y cuándo usarlas. Vacío si no hay ninguna. */
export function galeriaTexto(lista: ImagenAgente[], giro?: string | null): string {
  if (!lista.length) return '';
  const g = String(giro || '').toLowerCase();
  const filtradas = lista.filter(i => !i.giros?.length || !g || i.giros.some(x => g.includes(String(x).toLowerCase())));
  if (!filtradas.length) return '';
  return '\n\nRECURSOS QUE PUEDES ADJUNTAR (imágenes, PDF, videos; normalmente UNO o DOS por mensaje y solo si aportan; si un grupo de fotos va junto —mismo «grupo»— puedes mandar el grupo completo, hasta 5; pon sus ids en "adjuntos", si no, []):\n'
    + filtradas.map(i => `[${i.id}] (${TIPO_L[i.tipo || 'image']}${i.grupo ? `, grupo «${i.grupo}»` : ''}) ${i.nombre} — muestra: ${i.descripcion || 's/d'}${i.cuando ? ` · úsala cuando: ${i.cuando}` : ''}`).join('\n');
}

export async function resolverImagen(id?: string | null): Promise<ImagenAgente | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { data } = await supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando, giros, temas, usos, tipo, mime, bytes').eq('id', id).eq('activa', true).maybeSingle();
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
