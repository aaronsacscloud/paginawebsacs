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

    if (vista === 'ia') {
      const dias = Math.min(Number(url.searchParams.get('dias')) || 30, 180);
      const [prompts, competidores, fuentes, avs, ultimas] = await Promise.all([
        supabase.rpc('de_ia_por_prompt', { dias }),
        supabase.rpc('de_competidores_en_ia', { dias }),
        supabase.rpc('de_fuentes_citadas_ia', { dias }),
        supabase.rpc('de_avs', { dias }),
        supabase.from('de_metricas_diarias').select('fecha, metrica, valor')
          .eq('dimension', 'ia').order('fecha', { ascending: false }).limit(60),
      ]);
      const a = (avs.data || [])[0] || {};
      const medidas = Number(a.medidas || 0);
      return json({
        ok: true,
        resumen: {
          medidas,
          prompts: Number(a.prompts || 0),
          menciones: Number(a.con_mencion || 0),
          citas: Number(a.con_cita || 0),
          avs: medidas ? Math.round(((Number(a.con_mencion) / medidas) * 40 + (Number(a.con_cita) / medidas) * 25 + (Number(a.en_top3) / medidas) * 35) * 10) / 10 : 0,
        },
        prompts: prompts.data || [],
        competidores: (competidores.data || []).slice(0, 25),
        fuentes: (fuentes.data || []).slice(0, 25),
        serie: ultimas.data || [],
      });
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

    /* ATRIBUCIÓN · qué de lo que hace el motor acaba en un cliente.
       La cobertura va SIEMPRE junto a las cifras, en la misma respuesta y no en
       una llamada aparte: solo 4% de los contactos trae rastro web porque la
       mayoría llega por WhatsApp, ABM y TikTok. Una atribución baja sin ese
       contexto al lado se lee como «el motor no funciona», y sería inventar un
       fracaso. Separarlas en dos endpoints es garantizar que alguna pantalla
       acabe enseñando una sin la otra. */
    /* La serie diaria del tráfico: lo único que contesta «¿vamos mejor que la
       semana pasada?» sin que nadie tenga que abrir Search Console.

       Se sirven juntas las métricas de tráfico y las del motor porque la
       pregunta real las cruza: si publicamos doce páginas y las impresiones sin
       marca no se mueven en tres semanas, el problema no es el ritmo de
       publicación. */
    if (vista === 'serie') {
      const dias = Math.min(Number(url.searchParams.get('dias')) || 30, 365);
      const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('de_metricas_diarias')
        .select('fecha, metrica, valor')
        .gte('fecha', desde)
        .order('fecha', { ascending: true });
      if (error) return json({ ok: false, error: error.message }, 500);

      // fecha → { metrica: valor }
      const porDia = new Map<string, Record<string, number>>();
      for (const r of data || []) {
        const d = porDia.get(r.fecha) || {};
        d[r.metrica] = Number(r.valor);
        porDia.set(r.fecha, d);
      }
      const serie: Record<string, any>[] = [...porDia.entries()].map(([fecha, m]) => ({ fecha, ...m }));

      /* Comparar la última semana contra la anterior, no contra el día previo:
         el tráfico de búsqueda tiene forma de semana —los lunes no se parecen a
         los domingos— y comparar días sueltos hace ver subidas y caídas que son
         el calendario, no el trabajo. */
      const ult7 = serie.slice(-7), prev7 = serie.slice(-14, -7);
      const suma = (xs: any[], k: string) => xs.reduce((n, x) => n + (Number(x[k]) || 0), 0);
      const cambio = (k: string) => {
        const a = suma(ult7, k), b = suma(prev7, k);
        return { ahora: a, antes: b, delta: a - b, pct: b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null };
      };

      return json({
        ok: true,
        serie,
        dias_con_dato: serie.length,
        semana: {
          clics_sin_marca: cambio('clics_sin_marca'),
          impresiones_sin_marca: cambio('impresiones_sin_marca'),
          consultas_sin_marca: cambio('consultas_sin_marca'),
          clics_totales: cambio('clics_totales'),
          herramientas_usos_dia: cambio('herramientas_usos_dia'),
          leads_atribuidos: cambio('leads_atribuidos'),
        },
        // Lo último de lo que no es acumulable por semana (son fotos, no sumas).
        hoy: serie.length ? {
          avs: serie[serie.length - 1].avs ?? null,
          dcs: serie[serie.length - 1].dcs ?? null,
          paginas_indexables: serie[serie.length - 1].paginas_indexables ?? null,
          contenido_publicado: serie[serie.length - 1].contenido_publicado ?? null,
          pct_sin_marca: serie[serie.length - 1].pct_sin_marca ?? null,
        } : null,
      });
    }

    if (vista === 'atribucion') {
      const [activos, cobertura, recorridos, toques] = await Promise.all([
        supabase.from('de_atribucion').select('*').order('clientes', { ascending: false }).order('leads', { ascending: false }),
        supabase.from('de_atribucion_cobertura').select('*').maybeSingle(),
        supabase.from('de_recorridos').select('*').order('contacto_at', { ascending: false }).limit(limite),
        supabase.from('de_toques').select('tipo, activo'),
      ]);

      // Los toques se agrupan aquí porque la vista devuelve uno por fila y lo
      // que la pantalla enseña es el conteo por activo.
      const porActivo = new Map<string, { tipo: string; activo: string; toques: number }>();
      for (const t of toques.data || []) {
        const k = `${t.tipo}|${t.activo}`;
        const v = porActivo.get(k) || { tipo: t.tipo, activo: t.activo, toques: 0 };
        v.toques++; porActivo.set(k, v);
      }

      return json({
        ok: true,
        activos: activos.data || [],
        cobertura: cobertura.data || null,
        recorridos: recorridos.data || [],
        toques: [...porActivo.values()].sort((a, b) => b.toques - a.toques),
      });
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
