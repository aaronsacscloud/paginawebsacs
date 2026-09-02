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
  const { data } = await supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando, giros, temas, usos').eq('activa', true).order('usos', { ascending: false }).limit(40);
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
