// WHATSAPP · Notas internas de una conversación: se ven en el hilo (ámbar),
// nunca viajan a WhatsApp. El autor sale de la sesión, no del body.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { notificar } from '../../../../lib/crm/notificaciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const texto = String(b.texto || '').trim();
  if (!b.conversation_id || !texto) return json({ error: 'Faltan conversation_id y texto' }, 400);
  const user = await getCurrentUser(request);
  // Menciones: "@Nombre" → ids (se guardan para la bandeja "Requiere mi acción").
  const menciones = [...texto.matchAll(/@([\wáéíóúñÁÉÍÓÚÑ]+)/g)].map(m => m[1].toLowerCase());
  const { data: equipo } = menciones.length ? await supabase.from('team_members').select('id, nombre').eq('activo', true) : { data: [] as any[] };
  const mencionados = (equipo || []).filter(m => { const primer = (m.nombre || '').split(' ')[0].toLowerCase(); return primer && menciones.includes(primer); });
  const { data: convN } = await supabase.from('wa_conversaciones').select('contact_id').eq('id', b.conversation_id).maybeSingle();
  const { data, error } = await supabase.from('wa_notas').insert({
    conversation_id: b.conversation_id,
    contact_id: convN?.contact_id || null,    // 19) la nota es del contacto
    autor: user?.nombre || user?.email || 'equipo',
    texto: texto.slice(0, 2000),
    menciones: mencionados.map(m => m.id),
  }).select('id, autor, texto, created_at').single();
  if (error) return json({ error: error.message }, 500);

  // La campana del CRM es un feed común, así que el título carga el nombre.
  if (mencionados.length) {
    for (const m of mencionados) {
      {
        await notificar({
          clave: `wa_mencion_${data!.id}_${m.id}`,
          tipo: 'wa_mencion',
          titulo: `${user?.nombre || 'Alguien'} mencionó a ${m.nombre} en una nota de WhatsApp: ${texto.slice(0, 70)}`,
          destino: 'whatsapp',
          metadata: { conversation_id: b.conversation_id, nota_id: data!.id, para: m.id },
        });
      }
    }
  }
  return json({ ok: true, nota: data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const { error } = await supabase.from('wa_notas').delete().eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
