// /api/crm/pipelines — GET los 3 pipelines (con fallback a defaults si la tabla
// aún no existe) · PUT guarda/actualiza el pipeline de un tipo (upsert por tipo).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getPipelines, TIPOS, type Stage } from '../../../lib/crm/pipelines';

export const prerender = false;
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

const slugify = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'etapa';

export const GET: APIRoute = async () => {
  const pipelines = await getPipelines();
  return json({ data: pipelines });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const tipo = String(body?.tipo || '');
  if (!TIPOS.includes(tipo as any)) return json({ error: 'tipo inválido' }, 400);

  // Normaliza y de-duplica las etapas (key único, label obligatorio).
  const seen = new Set<string>();
  const stages: Stage[] = (Array.isArray(body?.stages) ? body.stages : [])
    .map((s: any) => {
      const label = String(s?.label || '').trim();
      if (!label) return null;
      let key = String(s?.key || slugify(label)) || slugify(label);
      while (seen.has(key)) key = key + '_2';
      seen.add(key);
      return { key, label: label.slice(0, 60), color: String(s?.color || '#64748B') };
    })
    .filter(Boolean) as Stage[];
  if (!stages.length) return json({ error: 'Agrega al menos una etapa.' }, 400);

  const row = { tipo, nombre: String(body?.nombre || 'Pipeline').slice(0, 80), stages, activo: true, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('pipelines').upsert(row, { onConflict: 'tipo' }).select().single();
  if (error) return json({ error: error.message + ' — ¿corriste migration-2026-07-pipelines.sql?' }, 500);
  return json({ ok: true, data });
};
