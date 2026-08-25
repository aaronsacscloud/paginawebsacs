// CRON · Recalcula el estatus operativo de TODOS los leads contra sus hechos.
// Corre de madrugada; también es el backfill (misma consulta, idempotente).
// Es quien mueve nuevo→sin_respuesta (el único peldaño que necesita que el
// tiempo pase) y quien corrige cualquier deriva de los disparadores en vivo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { SQL_RECALCULO_ESTATUS } from '../../../lib/crm/estatus-lead.sql';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.rpc('exec_estatus_recalculo');
  if (!error) return new Response(JSON.stringify({ ok: true, ...(data?.[0] || {}) }), { headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ error: error.message, hint: 'la función exec_estatus_recalculo debe existir en la BD' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
};
