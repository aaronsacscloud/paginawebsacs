// WHATSAPP · La línea (número) por la que vive una conversación.
// GET  → las líneas activas (wa_numeros) para el selector del composer.
// POST { conversation_id? | telefono, phone_number_id } → muda la conversación a esa línea
//      (si solo hay teléfono, crea la conversación para que el primer mensaje ya salga por ahí).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { upsertConversacion } from '../../../../lib/whatsapp/espejo';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const DEFAULT = () => (import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim();

export async function lineasActivas() {
  const { data } = await supabase.from('wa_numeros').select('phone_number_id, display_phone_number, nombre, es_default').eq('activo', true).order('es_default', { ascending: false });
  const lista = (data || []).map(n => ({ id: n.phone_number_id, numero: n.display_phone_number || n.phone_number_id, nombre: n.nombre || '', es_default: !!n.es_default || n.phone_number_id === DEFAULT() }));
  if (!lista.some(l => l.id === DEFAULT()) && DEFAULT()) lista.unshift({ id: DEFAULT(), numero: 'Línea principal', nombre: '', es_default: true });
  return lista;
}

export const GET: APIRoute = async () => json({ lineas: await lineasActivas(), default: DEFAULT() });

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const linea = String(b.phone_number_id || '').trim();
  if (!linea) return json({ error: 'Falta phone_number_id' }, 400);
  if (!(await lineasActivas()).some(l => l.id === linea)) return json({ error: 'Esa línea no está activa en Kapso' }, 400);
  let id = b.conversation_id ? String(b.conversation_id) : null;
  if (!id) {
    const tel = telefonoWhatsApp(b.telefono);
    if (!tel) return json({ error: 'Falta conversation_id o un teléfono válido' }, 400);
    const conv = await upsertConversacion({ telefono: tel });
    if (!conv) return json({ error: 'No se pudo abrir la conversación' }, 500);
    id = conv.id;
  }
  const { error } = await supabase.from('wa_conversaciones').update({ phone_number_id: linea }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, conversation_id: id, phone_number_id: linea });
};
