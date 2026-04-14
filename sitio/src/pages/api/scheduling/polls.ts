import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// POST: Create a new poll
export const POST: APIRoute = async ({ request }) => {
  const { titulo, event_type_slug, opciones, created_by } = await request.json();

  if (!titulo || !opciones || !Array.isArray(opciones) || opciones.length === 0) {
    return new Response(
      JSON.stringify({ error: 'titulo and opciones (array of {fecha, hora}) are required' }),
      { status: 400 },
    );
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .insert({
      tipo: 'sistema',
      titulo: `Poll: ${titulo}`,
      metadata: {
        poll: true,
        event_type_slug: event_type_slug || null,
        opciones,
        votos: [],
        estado: 'abierta',
        created_by: created_by || null,
        created_at: new Date().toISOString(),
      },
      automatico: true,
    })
    .select('id, metadata')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      poll_id: activity.id,
      url: `/agendar/poll/${activity.id}`,
    }),
    { status: 201 },
  );
};

// PUT: Vote on a poll
export const PUT: APIRoute = async ({ request }) => {
  const { poll_id, nombre, email, selected } = await request.json();

  if (!poll_id || !nombre || !email || !Array.isArray(selected)) {
    return new Response(
      JSON.stringify({ error: 'poll_id, nombre, email, and selected (array of indices) are required' }),
      { status: 400 },
    );
  }

  // Load the poll activity
  const { data: activity, error: fetchErr } = await supabase
    .from('activities')
    .select('id, metadata')
    .eq('id', poll_id)
    .single();

  if (fetchErr || !activity) {
    return new Response(JSON.stringify({ error: 'Poll not found' }), { status: 404 });
  }

  const meta = activity.metadata || {};
  if (!meta.poll) {
    return new Response(JSON.stringify({ error: 'Not a poll' }), { status: 400 });
  }

  if (meta.estado !== 'abierta') {
    return new Response(JSON.stringify({ error: 'Poll is closed' }), { status: 400 });
  }

  // Add the vote
  const votos = Array.isArray(meta.votos) ? [...meta.votos] : [];
  votos.push({
    nombre,
    email,
    selected,
    voted_at: new Date().toISOString(),
  });

  const { error: updateErr } = await supabase
    .from('activities')
    .update({
      metadata: { ...meta, votos },
    })
    .eq('id', poll_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, total_votes: votos.length }));
};

// GET: Get poll details
export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'id param required' }), { status: 400 });
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .select('id, titulo, metadata, created_at')
    .eq('id', id)
    .single();

  if (error || !activity) {
    return new Response(JSON.stringify({ error: 'Poll not found' }), { status: 404 });
  }

  const meta = activity.metadata || {};
  if (!meta.poll) {
    return new Response(JSON.stringify({ error: 'Not a poll' }), { status: 404 });
  }

  // Format response
  const opciones = (meta.opciones || []).map((op: { fecha: string; hora: string }, idx: number) => {
    const voteCount = (meta.votos || []).filter(
      (v: { selected: number[] }) => v.selected.includes(idx),
    ).length;
    return { ...op, index: idx, votes: voteCount };
  });

  return new Response(
    JSON.stringify({
      id: activity.id,
      titulo: activity.titulo?.replace('Poll: ', '') || '',
      estado: meta.estado,
      event_type_slug: meta.event_type_slug,
      opciones,
      total_voters: (meta.votos || []).length,
      created_at: activity.created_at,
    }),
  );
};
