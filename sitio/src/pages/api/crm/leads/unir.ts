// LEADS · Unir fichas duplicadas.
//   GET  ?id=<contact_id>                        → el grupo de fichas repetidas
//   POST { principal_id, otras_ids[], ensayo? }  → une (o ensaya)
//
// El trabajo pesado vive en la función `unir_leads` de la base (ver
// migraciones/2026-08-24-unir-leads.sql). No está aquí a propósito: son 27
// tablas las que apuntan a un contacto, y hacerlo con 27 updates sueltos deja
// la fusión a medias en cuanto uno falle. Allá es una sola transacción.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const norm = (s?: string | null) => String(s || '').trim().toLowerCase();
const tel10 = (s?: string | null) => String(s || '').replace(/\D/g, '').slice(-10);
const ABIERTOS = ['lead', 'lead_calificado', 'oportunidad'];

/** Las fichas que son la misma persona: mismo correo (sin importar mayúsculas)
 *  o mismo teléfono a diez dígitos. Casi todos los duplicados de hoy son el
 *  mismo correo escrito distinto —OETDALAG@ / oetdalag@—, así que comparar tal
 *  cual no encontraría nada. */
export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const { data: yo } = await supabase.from('contacts').select('*, companies(nombre)').eq('id', id).maybeSingle();
  if (!yo) return json({ error: 'No existe' }, 404);

  const e = norm(yo.email), t = tel10(yo.whatsapp || yo.telefono);
  const { data: cand } = await supabase.from('contacts')
    .select('*, companies(nombre)')
    .in('lifecycle_stage', ABIERTOS).is('archived_at', null).limit(4000);

  const grupo = (cand || []).filter((c: any) =>
    c.id === id || (e && norm(c.email) === e) || (t.length === 10 && tel10(c.whatsapp || c.telefono) === t));

  if (grupo.length < 2) return json({ grupo: [] });

  // La carga de cada ficha: es lo que decide cuál conviene que se quede.
  const ids = grupo.map((c: any) => c.id);
  const [acts, books, quotes] = await Promise.all([
    supabase.from('activities').select('contact_id').in('contact_id', ids),
    supabase.from('bookings').select('contact_id').in('contact_id', ids),
    supabase.from('quotes').select('contact_id').in('contact_id', ids),
  ]);
  const cuenta = (l: any[], k: string) => (l || []).filter((x: any) => x.contact_id === k).length;

  const fichas = grupo.map((c: any) => ({
    id: c.id, nombre: [c.nombre, c.apellido].filter(Boolean).join(' '),
    email: c.email, whatsapp: c.whatsapp, telefono: c.telefono,
    empresa: (Array.isArray(c.companies) ? c.companies[0] : c.companies)?.nombre || null,
    created_at: c.created_at, lifecycle_stage: c.lifecycle_stage,
    actividades: cuenta(acts.data || [], c.id),
    reuniones: cuenta(books.data || [], c.id),
    cotizaciones: cuenta(quotes.data || [], c.id),
  })).map((f: any) => ({ ...f, historia: f.actividades + f.reuniones + f.cotizaciones }));

  // La sugerida es la que trae MÁS HISTORIA, y si empatan, la más vieja. En el
  // caso real que motivó esto, gana la ficha que tiene la reunión agendada
  // aunque tenga menos actividades: una reunión pesa más que dos visitas.
  const sugerida = fichas.slice().sort((a: any, b: any) =>
    b.historia - a.historia || String(a.created_at).localeCompare(String(b.created_at)))[0];

  return json({ grupo: fichas, sugerida: sugerida?.id });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const b = await request.json().catch(() => ({}));
  const principal = b.principal_id;
  const otras = Array.isArray(b.otras_ids) ? b.otras_ids.filter(Boolean) : [];
  if (!principal || !otras.length) return json({ error: 'Faltan las fichas que se van a unir.' }, 400);

  const { data, error } = await supabase.rpc('unir_leads', {
    p_principal: principal, p_otras: otras, p_dry_run: !!b.ensayo,
  });
  // El mensaje de la función ya está escrito para una persona ("una de las
  // fichas ya es cliente"), así que se devuelve tal cual en vez de taparlo.
  if (error) return json({ error: error.message || 'No se pudieron unir.' }, 400);
  return json({ ok: true, resumen: data });
};
