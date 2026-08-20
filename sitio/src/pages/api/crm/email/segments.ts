// /api/crm/email/segments — audiencias dinámicas.
//
// GET            lista los segmentos del inquilino (con su último conteo)
// GET ?id=       uno solo, con su definición
// POST           crea · PUT actualiza · DELETE archiva
// POST ?preview  resuelve una definición SIN guardarla: es lo que hace que el
//                constructor muestre "hoy serían 143" mientras se edita.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { resolverMiembros, CATALOGO, ETIQUETA_OPERADOR, frase, type Definicion } from '../../../../lib/email/segmentos';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);

  // El catálogo viaja con la respuesta: la UI no debe tener su propia copia
  // de los campos, o el día que se agregue uno habrá dos verdades.
  if (url.searchParams.get('catalogo') === '1') {
    return json({ catalogo: CATALOGO, operadores: ETIQUETA_OPERADOR });
  }

  const id = url.searchParams.get('id');
  if (id) {
    const { data } = await supabase.from('email_segments').select('*').eq('id', id).eq('tenant_id', t.id).maybeSingle();
    if (!data) return json({ error: 'No existe ese segmento.' }, 404);
    const miembros = await resolverMiembros(t, data.definicion as Definicion, 200);
    return json({ segmento: data, miembros, total: miembros.length });
  }

  const { data } = await supabase.from('email_segments').select('*')
    .eq('tenant_id', t.id).is('archived_at', null).order('created_at', { ascending: false });
  return json({ segmentos: data || [] });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));

  // Vista previa: resolver sin guardar.
  if (url.searchParams.get('preview') === '1' || body?.preview) {
    const def = (body.definicion || { grupos: [] }) as Definicion;
    const miembros = await resolverMiembros(t, def, 50);
    // El total real puede ser mayor que la muestra que se pinta.
    const todos = await resolverMiembros(t, def, 20000);
    return json({
      total: todos.length,
      muestra: miembros.slice(0, 25),
      frases: (def.grupos || []).map(g => (g.condiciones || []).map(frase)),
    });
  }

  if (!body?.nombre?.trim()) return json({ error: 'Ponle nombre al segmento.' }, 400);
  const { data, error } = await supabase.from('email_segments').insert({
    tenant_id: t.id,
    nombre: body.nombre.trim(),
    descripcion: body.descripcion || null,
    definicion: body.definicion || { grupos: [], excluir: [] },
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ segmento: data }, 201);
};

export const PUT: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  if (!body?.id) return json({ error: 'Falta el id.' }, 400);

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of ['nombre', 'descripcion', 'definicion']) if (k in body) updates[k] = body[k];

  // Se recalcula el conteo al guardar: la lista de segmentos puede enseñar
  // "143 contactos · hace 2 min" sin resolver todo cada vez que se abre.
  if (body.definicion) {
    const m = await resolverMiembros(t, body.definicion as Definicion, 20000);
    updates.ultimo_conteo = m.length;
    updates.ultimo_conteo_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from('email_segments')
    .update(updates).eq('id', body.id).eq('tenant_id', t.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ segmento: data });
};

export const DELETE: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  const id = url.searchParams.get('id');
  if (!t || !id) return json({ error: 'Falta el id.' }, 400);
  // Archivar, no borrar: una campaña vieja apunta a este segmento y su
  // reporte debe seguir diciendo a quién se le mandó.
  await supabase.from('email_segments').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', t.id);
  return json({ ok: true });
};
