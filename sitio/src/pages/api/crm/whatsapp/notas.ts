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
  const { data, error } = await supabase.from('wa_notas').insert({
    conversation_id: b.conversation_id,
    autor: user?.nombre || user?.email || 'equipo',
    texto: texto.slice(0, 2000),
  }).select('id, autor, texto, created_at').single();
  if (error) return json({ error: error.message }, 500);

  // Menciones: "@Nombre" avisa por la campana a quien fue nombrado. La
  // campana del CRM es un feed común, así que el título carga el nombre.
  const menciones = [...texto.matchAll(/@([\wáéíóúñÁÉÍÓÚÑ]+)/g)].map(m => m[1].toLowerCase());
  if (menciones.length) {
    const { data: equipo } = await supabase.from('team_members').select('id, nombre').eq('activo', true);
    for (const m of equipo || []) {
      const primer = (m.nombre || '').split(' ')[0].toLowerCase();
      if (primer && menciones.includes(primer)) {
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
