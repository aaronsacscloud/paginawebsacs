// GET /api/crm/demanda/demanda — lo que el motor sabe del mercado.
//
//   ?vista=problemas | oportunidades | paginas | resumen
//
// Un endpoint y no cuatro: las cuatro vistas comparten filtros y la pantalla
// cambia de una a otra sin volver a pedir el catálogo entero.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const vista = url.searchParams.get('vista') || 'resumen';
  const limite = Math.min(Number(url.searchParams.get('limite')) || 100, 500);
  const q = (url.searchParams.get('q') || '').trim();
  const categoria = url.searchParams.get('categoria');
  const icp = url.searchParams.get('icp');
  const fuente = url.searchParams.get('fuente');

  try {
    if (vista === 'problemas') {
      let sel = supabase.from('de_clusters')
        .select('id, problema_canonico, descripcion, categoria, icp, senales_n, queries_n, score_oportunidad, relevancia_sacs, potencial_contenido, potencial_herramienta, potencial_conversion, dificultad, naturaleza_dominante, estado, capturado_por, pagina_sacs, created_at')
        .neq('estado', 'descartado')
        .order('score_oportunidad', { ascending: false, nullsFirst: false })
        .limit(limite);
      if (q) sel = sel.ilike('problema_canonico', `%${q}%`);
      if (categoria) sel = sel.eq('categoria', categoria);
      if (icp) sel = sel.contains('icp', [icp]);
      const { data, error } = await sel;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, problemas: data || [] });
    }

    if (vista === 'oportunidades') {
      let sel = supabase.from('de_oportunidades')
        .select('id, tipo, titulo, descripcion, score, desglose, estado, esfuerzo, accion_recomendada, descubrimiento_tipo, evidencia, cluster_id, created_at')
        .order('score', { ascending: false, nullsFirst: false })
        .limit(limite);
      const estado = url.searchParams.get('estado');
      if (estado) sel = sel.in('estado', estado.split(','));
      if (q) sel = sel.ilike('titulo', `%${q}%`);
      const { data, error } = await sel;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, oportunidades: data || [] });
    }

    if (vista === 'issues') {
      let sel = supabase.from('de_issues')
        .select('id, tipo, severidad, url, detalle, estado, detectado_at, resuelto_at')
        .order('detectado_at', { ascending: false }).limit(limite);
      const estado = url.searchParams.get('estado') || 'abierto';
      if (estado !== 'todos') sel = sel.in('estado', estado.split(','));
      const sev = url.searchParams.get('severidad');
      if (sev) sel = sel.eq('severidad', sev);
      const { data, error } = await sel;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, issues: data || [] });
    }

    if (vista === 'contenido') {
      const { data, error } = await supabase.from('de_contenido')
        .select('id, seccion, slug, titulo, meta_desc, tipo, estado, version, auditorias, publicado_at, actualizado_at')
        .order('actualizado_at', { ascending: false }).limit(limite);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, contenido: data || [] });
    }

    if (vista === 'paginas') {
      const { data, error } = await supabase.from('de_paginas')
        .select('url, titulo, h1, meta_desc, estado_http, indexable, palabras, enlaces_in, enlaces_out, huerfana, schema_tipos, rastreada_at')
        .order('enlaces_in', { ascending: false }).limit(limite);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, paginas: data || [] });
    }

    if (vista === 'senales') {
      let sel = supabase.from('de_senales')
        .select('id, fuente, tipo_senal, naturaleza, texto, query_cruda, observada_at, confianza, cluster_id')
        .order('observada_at', { ascending: false }).limit(limite);
      if (fuente) sel = sel.eq('fuente', fuente);
      const cluster = url.searchParams.get('cluster');
      if (cluster) sel = sel.eq('cluster_id', cluster);
      const { data, error } = await sel;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, senales: data || [] });
    }

    // Resumen: los números de arriba y de dónde salen.
    const [senales, clusters, queries, paginas, oportunidades, fuentes, categorias, top, ultimoCiclo] = await Promise.all([
      supabase.from('de_senales').select('id', { count: 'exact', head: true }),
      supabase.from('de_clusters').select('id', { count: 'exact', head: true }).neq('estado', 'descartado'),
      supabase.from('de_queries').select('id', { count: 'exact', head: true }),
      supabase.from('de_paginas').select('url', { count: 'exact', head: true }),
      supabase.from('de_oportunidades').select('id', { count: 'exact', head: true }).eq('estado', 'nueva'),
      supabase.rpc('de_senales_por_fuente'),
      supabase.rpc('de_clusters_por_categoria'),
      supabase.from('de_oportunidades').select('id, tipo, titulo, score, accion_recomendada, esfuerzo, evidencia')
        .eq('estado', 'nueva').order('score', { ascending: false, nullsFirst: false }).limit(5),
      supabase.from('de_ciclos').select('id, tipo, inicio, fin, estado, acciones_ok, acciones_fallidas, costo_usd, top5')
        .order('inicio', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const [huerfanas, sinMeta, delgadas, sinEvaluar, issuesAbiertos, issuesAltos, publicadas] = await Promise.all([
      supabase.from('de_paginas').select('url', { count: 'exact', head: true }).eq('huerfana', true),
      supabase.from('de_paginas').select('url', { count: 'exact', head: true }).is('meta_desc', null),
      supabase.from('de_paginas').select('url', { count: 'exact', head: true }).lt('palabras', 300),
      supabase.from('de_clusters').select('id', { count: 'exact', head: true }).is('relevancia_sacs', null),
      supabase.from('de_issues').select('id', { count: 'exact', head: true }).eq('estado', 'abierto'),
      supabase.from('de_issues').select('id', { count: 'exact', head: true }).eq('estado', 'abierto').in('severidad', ['critica', 'alta']),
      supabase.from('de_contenido').select('id', { count: 'exact', head: true }).eq('estado', 'publicado'),
    ]);

    return json({
      ok: true,
      conteos: {
        senales: senales.count || 0, problemas: clusters.count || 0, consultas: queries.count || 0,
        paginas: paginas.count || 0, oportunidades: oportunidades.count || 0,
        sin_evaluar: sinEvaluar.count || 0,
        huerfanas: huerfanas.count || 0, sin_meta: sinMeta.count || 0, delgadas: delgadas.count || 0,
        issues: issuesAbiertos.count || 0, issues_serios: issuesAltos.count || 0,
        publicadas: publicadas.count || 0,
      },
      fuentes: fuentes.data || [],
      categorias: categorias.data || [],
      top5: top.data || [],
      ultimo_ciclo: ultimoCiclo.data || null,
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
