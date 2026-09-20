// GET  /api/crm/demanda/borradores?estado=  — lo que el motor escribió y espera lectura
// POST /api/crm/demanda/borradores  { id, accion: publicar|rechazar|editar, motivo, cambios }
//
// La bandeja donde el dueño lee lo que el motor escribió y decide.
//
// POR QUÉ PUBLICAR NO SE AUTOMATIZA, aunque el motor escriba bien
// Una página publicada lleva el nombre de la empresa y se queda en internet.
// El costo de leer cinco borradores al día se mide en minutos; el de una página
// que afirma algo falso sobre Sacs o sobre un competidor, no. La autonomía que
// conviene subir es la de ESCRIBIR, no la de publicar.
//
// EL RECHAZO NO TIRA EL TRABAJO: LO ENSEÑA
// Cuando se rechaza, el motivo se guarda en el contenido. El brief de la
// siguiente tanda lo lee y no repite el error. Sin eso, el dueño corregiría lo
// mismo cada semana y la sensación sería que el motor no aprende — cuando lo que
// pasa es que nadie le dijo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { aHtml, palabras as contarPalabras } from '../../../../lib/demanda/bloques';
import { giroDe } from '../../../../lib/demanda/publicar';

/* Lo que el referee dejó dicho, en el tamaño que cabe en una tarjeta. */
function resumenReferee(auditorias: any) {
  const r = auditorias?.referee;
  if (!r?.puntajes) return null;
  const vals = Object.values(r.puntajes as Record<string, number>);
  return {
    pasa: !!r.pasa,
    promedio: Math.round((vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1)) * 10) / 10,
    puntajes: r.puntajes,
    ronda: r.ronda ?? 0,
    por_que: r.por_que || '',
    fallos: r.fallos || [],
    mejor_que_competencia: !!r.mejor_que_competencia,
    cuando: r.cuando || null,
  };
}

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  /* Por defecto solo lo APROBADO por el referee. Lo que está en «borrador» y no
     pasó no se le enseña al dueño: se reescribe solo. La excepción son las
     atascadas (dos rondas sin pasar), que se listan aparte con el veredicto. */
  const estado = url.searchParams.get('estado') || 'aprobado,borrador';
  const id = url.searchParams.get('id');

  // Una pieza concreta, con su HTML listo para leer.
  if (id) {
    const { data, error } = await supabase.from('de_contenido')
      .select('id, seccion, slug, titulo, h1, meta_desc, cuerpo, brief, estado, auditorias, created_at, actualizado_at')
      .eq('id', id).maybeSingle();
    if (error || !data) return json({ ok: false, error: error?.message || 'no existe' }, 404);
    const { data: similares } = await supabase.from('de_paginas_similares')
      .select('url, titulo, tipo, palabras_aprox, tiene_faq, tiene_tabla_o_pasos, cubre_bien, le_falta, por_que_rankea')
      .eq('contenido_id', id).order('analizada_at', { ascending: false }).limit(8);
    return json({
      ok: true,
      pieza: {
        ...data,
        html: aHtml(data.cuerpo as any),
        palabras: contarPalabras(data.cuerpo as any),
        url: `https://www.sacscloud.com/${data.seccion}/${data.slug}/`,
        referee: resumenReferee(data.auditorias),
        portada: (data.brief as any)?.portada || null,
        giro: giroDe(data.brief),
        atascada: !!(data.brief as any)?.atascada,
        competencia: { paginas: similares || [], hueco: (data.brief as any)?.competencia?.hueco_comun || null },
      },
    });
  }

  const { data, error } = await supabase.from('de_contenido')
    .select('id, seccion, slug, titulo, meta_desc, estado, brief, cuerpo, auditorias, created_at')
    .in('estado', estado.split(','))
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return json({ ok: false, error: error.message }, 500);

  /* Se manda un resumen por pieza, no el cuerpo entero: la bandeja lista veinte
     y cargar veinte artículos de dos mil palabras para enseñar veinte títulos es
     tráfico que nadie pidió. El cuerpo llega al abrir una. */
  const piezas = (data || []).filter(p => {
    // En «borrador» solo las atascadas: las demás están a medio camino del referee.
    return p.estado !== 'borrador' || !!(p.brief as any)?.atascada;
  }).map(p => {
    const c = (p.cuerpo || []) as any[];
    return {
      referee: resumenReferee(p.auditorias),
      portada: (p.brief as any)?.portada?.url || null,
      giro: giroDe(p.brief)?.label || null,
      atascada: !!(p.brief as any)?.atascada,
      id: p.id, seccion: p.seccion, slug: p.slug, titulo: p.titulo,
      meta_desc: p.meta_desc, estado: p.estado, created_at: p.created_at,
      palabras: contarPalabras(c),
      bloques: c.length,
      pregunta: (p.brief as any)?.pregunta || null,
      quien: (p.brief as any)?.quien || null,
      // Lo que el brief avisó que NO se puede afirmar: es lo primero que hay que
      // comprobar al leer, así que viaja en el resumen.
      advertencia: (p.brief as any)?.nota_honestidad || null,
      revisado: !!(p.auditorias as any)?.automatica,
    };
  });

  return json({ ok: true, piezas, cuantas: piezas.length });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ ok: false, error: 'sin sesión' }, 401);

  const { id, accion, motivo, cambios } = (await request.json().catch(() => ({}))) as any;
  if (!id || !accion) return json({ ok: false, error: 'faltan id y accion' }, 400);

  const { data: pieza } = await supabase.from('de_contenido').select('id, estado, slug, seccion').eq('id', id).maybeSingle();
  if (!pieza) return json({ ok: false, error: 'no existe ese contenido' }, 404);

  if (accion === 'editar') {
    /* Editar antes de publicar es lo normal, no la excepción. Se guarda lo
       editado y se deja en «aprobado»: quien corrigió ya lo leyó. */
    const campos: any = { actualizado_at: new Date().toISOString() };
    for (const k of ['titulo', 'h1', 'meta_desc', 'cuerpo']) if (cambios?.[k] !== undefined) campos[k] = cambios[k];
    const { error } = await supabase.from('de_contenido').update(campos).eq('id', id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, estado: pieza.estado });
  }

  if (accion === 'rechazar') {
    if (!motivo || String(motivo).trim().length < 10) {
      // El motivo es lo único que hace que la siguiente tanda salga mejor. Un
      // rechazo sin motivo es trabajo tirado dos veces: el de ahora y el de la
      // próxima, que va a repetir el mismo error.
      return json({ ok: false, error: 'hace falta el motivo: es lo que el motor lee para no repetirlo' }, 400);
    }
    const { error } = await supabase.from('de_contenido').update({
      estado: 'rechazado',
      auditorias: { rechazo: { motivo: String(motivo).trim(), por: user.id, cuando: new Date().toISOString() } },
      actualizado_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, estado: 'rechazado' });
  }

  if (accion === 'publicar') {
    // `publicar()` guarda versión, respeta el freno de salida y avisa a Bing.
    const { publicar } = await import('../../../../lib/demanda/publicar');
    try {
      // Tiene que estar en «aprobado» para que `publicar()` lo acepte.
      if (pieza.estado === 'borrador') {
        await supabase.from('de_contenido').update({
          estado: 'aprobado',
          auditorias: { humana: { por: user.id, cuando: new Date().toISOString() } },
        }).eq('id', id);
      }
      const r = await publicar(id, `publicado desde la bandeja por ${user.id}`);
      return json({ ok: true, url: r.url, version: r.version, simulado: r.simulado });
    } catch (e: any) {
      return json({ ok: false, error: String(e?.message || e) }, 500);
    }
  }

  return json({ ok: false, error: `acción desconocida: ${accion}` }, 400);
};
