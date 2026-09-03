// GET /api/crm/espacio/buscar?q=&canal_id= → { resultados }
// Busca en el texto y en las transcripciones de audio (que van dentro de
// adjuntos). Solo canales que puedo ver; los directos ajenos no aparecen.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, darForma, puedeVerCanal, type Canal } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return json({ resultados: [] });
  const canalId = url.searchParams.get('canal_id');
  const { data: canales } = await supabase.from('espacio_canales').select('*').is('archivado_at', null);
  const visibles = ((canales || []) as Canal[]).filter(c => puedeVerCanal(c, yo.id) && (!esUuid(canalId) || c.id === canalId));
  if (!visibles.length) return json({ resultados: [] });
  const nombres: Record<string, string> = {};
  for (const c of visibles) nombres[c.id] = c.tipo === 'directo' ? 'directo' : c.nombre;

  // La función busca en texto y en transcripciones de audio (adjuntos jsonb).
  const { data, error } = await supabase.rpc('espacio_buscar', { p_canales: visibles.map(c => c.id), p_q: q.replace(/[%_\\]/g, s => '\\' + s), p_limite: 40 });
  if (error) return json({ error: error.message }, 500);
  const lista = await darForma(data || [], yo.id);
  return json({ resultados: lista.map((m: any) => ({ ...m, canal_nombre: nombres[m.canal_id] })) });
};
