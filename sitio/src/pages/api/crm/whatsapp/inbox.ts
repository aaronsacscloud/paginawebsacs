// WHATSAPP · La lista del inbox: conversaciones + contadores del rail.
//
// GET ?filtro=todas|mias|sin_asignar|no_leidas & etapa=<lifecycle_stage>
//     & search= & limit=50 & offset=0
// → { conversaciones: [{...conv, contacto, empresa}], counts }
//
// Los counts se calculan SIEMPRE sobre el universo completo (no sobre la
// página): el rail dice cuánto hay en cada cajón aunque estés viendo otro.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const filtro = url.searchParams.get('filtro') || 'todas';
  const etapa = url.searchParams.get('etapa') || '';
  const search = (url.searchParams.get('search') || '').trim();
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const offset = Number(url.searchParams.get('offset') || 0);

  // Universo: todas las conversaciones con su contacto pegado.
  const { data: convs, error } = await supabase.from('wa_conversaciones')
    .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo), companies(id, nombre, nombre_comercial, plan, mrr)')
    .order('ultimo_mensaje_at', { ascending: false })
    .limit(1000);
  if (error) return json({ error: error.message }, 500);

  const todas = (convs || []).map((c: any) => ({
    id: c.id, telefono: c.telefono, estado: c.estado,
    ultimo_mensaje_at: c.ultimo_mensaje_at, ultimo_mensaje_texto: c.ultimo_mensaje_texto,
    ultima_direccion: c.ultima_direccion, no_leidos: c.no_leidos || 0,
    asignado_a: c.asignado_a, contact_id: c.contact_id, company_id: c.company_id,
    contacto: c.contacts ? {
      id: c.contacts.id,
      nombre: `${c.contacts.nombre || ''} ${c.contacts.apellido || ''}`.trim() || null,
      email: c.contacts.email, lifecycle_stage: c.contacts.lifecycle_stage, tipo: c.contacts.tipo,
    } : null,
    empresa: c.companies ? {
      id: c.companies.id, nombre: c.companies.nombre_comercial || c.companies.nombre,
      plan: c.companies.plan, mrr: c.companies.mrr,
    } : null,
  }));

  // Contadores del rail sobre el universo.
  const counts: any = { todas: todas.length, mias: 0, sin_asignar: 0, no_leidas: 0, por_etapa: {} as Record<string, number> };
  for (const c of todas) {
    if (user && c.asignado_a === user.id) counts.mias++;
    if (!c.asignado_a && c.estado === 'active') counts.sin_asignar++;
    if (c.no_leidos > 0) counts.no_leidas++;
    const e = c.contacto?.lifecycle_stage;
    if (e) counts.por_etapa[e] = (counts.por_etapa[e] || 0) + 1;
  }

  // Filtro + búsqueda en memoria: el universo cabe (limit 1000) y evita
  // duplicar la lógica de joins en SQL.
  let lista = todas;
  if (filtro === 'mias' && user) lista = lista.filter(c => c.asignado_a === user.id);
  if (filtro === 'sin_asignar') lista = lista.filter(c => !c.asignado_a && c.estado === 'active');
  if (filtro === 'no_leidas') lista = lista.filter(c => c.no_leidos > 0);
  if (etapa) lista = lista.filter(c => c.contacto?.lifecycle_stage === etapa);
  if (search) {
    const q = search.toLowerCase();
    const qTel = telefonoWhatsApp(search);
    lista = lista.filter(c =>
      (c.contacto?.nombre || '').toLowerCase().includes(q) ||
      (c.empresa?.nombre || '').toLowerCase().includes(q) ||
      (c.ultimo_mensaje_texto || '').toLowerCase().includes(q) ||
      c.telefono.includes(qTel || search.replace(/\D/g, '') || '∅'));
  }

  return json({ conversaciones: lista.slice(offset, offset + limit), counts, total_filtrado: lista.length });
};
