import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { keep_id, merge_id } = await request.json();

  if (!keep_id || !merge_id) {
    return new Response(JSON.stringify({ error: 'keep_id and merge_id required' }), { status: 400 });
  }

  // Move all related records from merge_id to keep_id
  await Promise.all([
    supabase.from('activities').update({ contact_id: keep_id }).eq('contact_id', merge_id),
    supabase.from('deals').update({ contact_id: keep_id }).eq('contact_id', merge_id),
    supabase.from('quotes').update({ contact_id: keep_id }).eq('contact_id', merge_id),
    supabase.from('payments').update({ contact_id: keep_id }).eq('contact_id', merge_id),
    supabase.from('bookings').update({ contact_id: keep_id }).eq('contact_id', merge_id),
    supabase.from('automation_enrollments').update({ contact_id: keep_id }).eq('contact_id', merge_id),
    supabase.from('email_sends').update({ contact_id: keep_id }).eq('contact_id', merge_id),
  ]);

  // Archive the merged contact
  await supabase.from('contacts').update({ archived_at: new Date().toISOString() }).eq('id', merge_id);

  // Log
  await supabase.from('activities').insert({
    contact_id: keep_id,
    tipo: 'sistema',
    titulo: 'Contactos fusionados',
    metadata: { merged_contact_id: merge_id },
    automatico: true,
  });

  return new Response(JSON.stringify({ success: true, kept: keep_id, merged: merge_id }));
};
