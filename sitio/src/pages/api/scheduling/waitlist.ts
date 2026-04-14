import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

/**
 * POST: Create a waitlist entry (stored as a system activity).
 * Body: { event_type_slug, fecha, nombre, email, whatsapp? }
 *
 * GET: List waitlist entries, optionally filtered by ?fecha=YYYY-MM-DD
 */

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { event_type_slug, fecha, nombre, email, whatsapp } = body;

    if (!event_type_slug || !fecha || !nombre || !email) {
      return new Response(
        JSON.stringify({ error: 'event_type_slug, fecha, nombre, and email are required' }),
        { status: 400 },
      );
    }

    // Find or create contact for the waitlist entry
    let contact_id: string | null = null;

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single();

    if (existingContact) {
      contact_id = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          nombre,
          email,
          whatsapp: whatsapp || null,
          tipo: 'lead',
          lifecycle_stage: 'lead',
          fuente: 'waitlist',
        })
        .select('id')
        .single();

      if (newContact) {
        contact_id = newContact.id;
      }
    }

    // Store waitlist entry as activity
    const { data: activity, error } = await supabase.from('activities').insert({
      contact_id,
      tipo: 'sistema',
      titulo: `Waitlist: ${nombre} para ${fecha}`,
      metadata: {
        waitlist: true,
        event_type_slug,
        fecha,
        nombre,
        email,
        whatsapp: whatsapp || null,
      },
      automatico: true,
    }).select('id').single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ ok: true, id: activity?.id }),
      { status: 201 },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to create waitlist entry' }),
      { status: 500 },
    );
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const fecha = url.searchParams.get('fecha');

    let query = supabase
      .from('activities')
      .select('*')
      .eq('tipo', 'sistema')
      .not('metadata', 'is', null)
      .order('created_at', { ascending: false });

    // We filter for waitlist entries using metadata->>'waitlist'
    // Since Supabase JS doesn't support jsonb path filters directly in all versions,
    // we filter the title prefix as a practical approach
    query = query.like('titulo', 'Waitlist:%');

    if (fecha) {
      // Further filter by fecha in the title
      query = query.like('titulo', `%${fecha}%`);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Extract waitlist info from metadata
    const entries = (data || []).map(a => ({
      id: a.id,
      created_at: a.created_at,
      contact_id: a.contact_id,
      ...(a.metadata || {}),
    }));

    return new Response(JSON.stringify({ entries }));
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to fetch waitlist' }),
      { status: 500 },
    );
  }
};
