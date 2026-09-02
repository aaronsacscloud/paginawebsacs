import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const VALID_EVENTS = ['page_view', 'date_selected', 'time_selected', 'form_started', 'form_submitted'] as const;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { event, slug, metadata, session_id } = body;

    if (!event || !slug) {
      return new Response(JSON.stringify({ error: 'Missing event or slug' }), { status: 400 });
    }

    if (!VALID_EVENTS.includes(event)) {
      return new Response(JSON.stringify({ error: 'Invalid event type' }), { status: 400 });
    }

    const tipo = event === 'page_view' ? 'page_visit' : 'sistema';

    await supabase.from('activities').insert({
      contact_id: null,
      deal_id: null,
      tipo,
      /* En español y sin jerga: «Scheduling: page_view — consultoria» lo lee
         un consultor en la ficha del cliente, no un programador. 535 en 30
         días, o sea el evento más repetido de toda la actividad. */
      titulo: ({
        page_view: `Abrió la página para agendar${slug ? ` (${slug})` : ''}`,
        date_selected: 'Eligió un día en el calendario',
        time_selected: 'Eligió una hora',
        form_started: 'Empezó a llenar sus datos',
        form_submitted: 'Terminó de agendar',
      } as Record<string, string>)[event] || `Agenda: ${event}${slug ? ` — ${slug}` : ''}`,
      metadata: {
        scheduling_event: event,
        slug,
        session_id: session_id || null,
        ...(metadata || {}),
      },
      automatico: true,
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
};
