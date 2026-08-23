// CRM · Catálogo configurable del ciclo de vida (encima de contacts.lifecycle_stage).
// GET → { etapas: [{...cat, n: contactos}] } (incluye inactivas solo con ?todas=1)
// POST { id?, nombre, emoji, color, tipo, sugerencias } → crea o actualiza (id nuevo = slug del nombre)
// POST { accion:'orden', ids:[...] } → reordena
// DELETE { id, migrar_a } → archiva la etapa moviendo sus contactos a otra
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const [{ data: cat }, { data: cuentas }] = await Promise.all([
    supabase.from('crm_lifecycle_etapas').select('*').order('orden'),
    supabase.from('contacts').select('lifecycle_stage').is('archived_at', null),
  ]);
  const n = new Map<string, number>();
  for (const c of cuentas || []) n.set(c.lifecycle_stage || '', (n.get(c.lifecycle_stage || '') || 0) + 1);
  const etapas = (cat || []).filter(e => url.searchParams.get('todas') || e.activo).map(e => ({ ...e, n: n.get(e.id) || 0 }));
  return json({ etapas, sin_etapa: n.get('') || 0 });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'orden') {
    if (!Array.isArray(b.ids)) return json({ error: 'Falta ids' }, 400);
    for (let i = 0; i < b.ids.length; i++) await supabase.from('crm_lifecycle_etapas').update({ orden: i + 1 }).eq('id', String(b.ids[i]));
    return json({ ok: true });
  }
  const nombre = String(b.nombre || '').trim();
  if (!nombre) return json({ error: 'Falta el nombre de la etapa' }, 400);
  if (nombre.length > 30) return json({ error: 'Nombre: máximo 30 caracteres' }, 400);
  const id = String(b.id || nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')).slice(0, 40);
  if (!id) return json({ error: 'Nombre inválido' }, 400);
  const { data: existentes } = await supabase.from('crm_lifecycle_etapas').select('id, nombre, orden, activo');
  const yo = (existentes || []).find(e => e.id === id);
  if (!b.id && (existentes || []).some(e => e.nombre.toLowerCase() === nombre.toLowerCase() && e.activo)) return json({ error: `Ya existe una etapa "${nombre}"` }, 409);
  if (!b.id && (existentes || []).filter(e => e.activo).length >= 15) return json({ error: 'Máximo 15 etapas: archiva alguna antes de crear otra' }, 400);
  const fila: any = { id, nombre, activo: true };
  for (const k of ['emoji', 'color', 'tipo']) if (b[k]) fila[k] = String(b[k]).slice(0, k === 'emoji' ? 8 : 20);
  if ('sugerencias' in b) fila.sugerencias = Array.isArray(b.sugerencias) ? b.sugerencias.slice(0, 10) : [];
  if (!yo) fila.orden = Math.max(0, ...(existentes || []).map(e => e.orden)) + 1;
  const { error } = await supabase.from('crm_lifecycle_etapas').upsert(fila, { onConflict: 'id' });
  return error ? json({ error: error.message }, 500) : json({ ok: true, id });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('lifecycle_stage', b.id).is('archived_at', null);
  if ((count || 0) > 0) {
    if (!b.migrar_a) return json({ error: `La etapa tiene ${count} contactos: elige a qué etapa moverlos`, contactos: count }, 409);
    const { data: destino } = await supabase.from('crm_lifecycle_etapas').select('id').eq('id', b.migrar_a).eq('activo', true).maybeSingle();
    if (!destino) return json({ error: 'La etapa destino no existe' }, 400);
    await supabase.from('contacts').update({ lifecycle_stage: b.migrar_a }).eq('lifecycle_stage', b.id);
  }
  await supabase.from('crm_lifecycle_etapas').update({ activo: false }).eq('id', b.id);
  return json({ ok: true, movidos: count || 0 });
};
