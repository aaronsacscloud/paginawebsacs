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
      titulo: `Scheduling: ${event} — ${slug}`,
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
