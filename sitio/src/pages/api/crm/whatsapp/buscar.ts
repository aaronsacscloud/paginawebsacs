// WHATSAPP · Buscar en TODO el archivo de mensajes, no solo en lo cargado.
//
// GET ?q=texto[&conversation_id=…][&limit=]
//  → { resultados: [{ mensaje…, conversacion: {id, telefono, contacto} }] }
//
// Con hilos de 1,300 mensajes, la búsqueda del front (que solo ve la página
// cargada) no encuentra "¿quién preguntó por facturación en marzo?". Esta sí:
// pega en cuerpo y en transcripciones de notas de voz, con índice trigram.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const q = String(url.searchParams.get('q') || '').trim();
  const convId = url.searchParams.get('conversation_id');
  const limit = Math.min(80, parseInt(url.searchParams.get('limit') || '40', 10) || 40);
  if (q.length < 2) return json({ error: 'Escribe al menos 2 caracteres' }, 400);

  // ilike con % escapados: el índice trigram lo cubre aunque sea subcadena.
  const patron = `%${q.replace(/[%_]/g, '\\$&')}%`;
  let sel = supabase.from('wa_mensajes')
    .select('id, conversation_id, direccion, tipo, cuerpo, transcript, created_at, autor')
    .or(`cuerpo.ilike.${patron},transcript.ilike.${patron}`)
    .is('borrado_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (convId) sel = sel.eq('conversation_id', convId);
  const { data: msjs, error } = await sel;
  if (error) return json({ error: error.message }, 500);

  // La conversación de cada resultado, en UNA consulta.
  const convIds = [...new Set((msjs || []).map(m => m.conversation_id))];
  const { data: convs } = convIds.length
    ? await supabase.from('wa_conversaciones')
        .select('id, telefono, contact_id, contacts(nombre, apellido)')
        .in('id', convIds)
    : { data: [] as any[] };
  const porId = new Map((convs || []).map(c => [c.id, c]));

  const resultados = (msjs || []).map(m => {
    const c: any = porId.get(m.conversation_id);
    const texto = m.cuerpo || m.transcript || '';
    const idx = texto.toLowerCase().indexOf(q.toLowerCase());
    // Fragmento centrado en la coincidencia: la fila del resultado ya enseña
    // el contexto sin abrir el hilo.
    const desde = Math.max(0, idx - 60);
    return {
      id: m.id, conversation_id: m.conversation_id, direccion: m.direccion,
      tipo: m.tipo, created_at: m.created_at, autor: m.autor,
      es_transcripcion: !m.cuerpo && !!m.transcript,
      fragmento: (desde > 0 ? '…' : '') + texto.slice(desde, desde + 160) + (desde + 160 < texto.length ? '…' : ''),
      conversacion: c ? {
        id: c.id, telefono: c.telefono,
        contacto: c.contacts ? `${c.contacts.nombre || ''} ${c.contacts.apellido || ''}`.trim() : null,
      } : null,
    };
  });
  return json({ resultados, total: resultados.length });
};
