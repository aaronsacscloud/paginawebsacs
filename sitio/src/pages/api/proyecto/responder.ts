import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getSessionFromRequest } from '../../../lib/auth/session';
import { briefPorToken, etapasDe, bitacora, json } from '../../../lib/proyecto/store';
import { escribir, resolver, hilosDe, pendientesDelCliente, avisarRevision } from '../../../lib/proyecto/hilos';
import { ETAPAS_POR_CLAVE } from '../../../lib/proyecto/etapas';

export const prerender = false;

/**
 * La revisión de una etapa, pregunta por pregunta. Sustituye a la nota suelta
 * de `revisar`: aquí Sacs deja un comentario CONCRETO en cada respuesta y, si
 * hace falta, repregunta ahí mismo.
 *
 * Cuerpo:
 *   { token, clave, notas: [{ campo, texto, pregunta?: boolean }], cierre?: string }
 *
 * Si queda al menos una pregunta abierta, la etapa vuelve al cliente en
 * 'cambios'. Si no queda ninguna, se aprueba y se abre la siguiente. Esa es
 * toda la mecánica: no hay un botón de aprobar aparte que pueda contradecirla.
 */
export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionFromRequest(request);
  if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
    return json({ error: 'No autorizado' }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const { token, clave, notas, cierre } = body || {};

  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);

  const def = ETAPAS_POR_CLAVE.get(String(clave));
  if (!def) return json({ error: 'Etapa desconocida' }, 400);

  const etapas = await etapasDe(brief.id);
  const fila = etapas.find((e) => e.clave === def.clave);
  if (!fila) return json({ error: 'Etapa no encontrada' }, 404);

  const validos = new Set(def.campos.map((c) => c.id));
  const preguntas: { campo: string; texto: string }[] = [];

  for (const n of Array.isArray(notas) ? notas : []) {
    const campo = String(n?.campo || '');
    const texto = String(n?.texto || '').trim();
    if (!validos.has(campo) || !texto) continue;
    const esPregunta = !!n?.pregunta;
    await escribir(brief.id, def.clave, campo, 'sacs', texto, esPregunta ? 'abierto' : 'resuelto');
    if (!esPregunta) await resolver(brief.id, def.clave, campo);
    else preguntas.push({ campo: def.campos.find((c) => c.id === campo)?.etiqueta || campo, texto });
  }

  if (cierre) await escribir(brief.id, def.clave, null, 'sacs', String(cierre), 'resuelto');

  // La verdad de "¿falta algo?" sale de los hilos, no de lo que traiga el body.
  const abiertos = pendientesDelCliente(await hilosDe(brief.id)).filter((h) => h.etapa_clave === def.clave);
  const aprobar = abiertos.length === 0;

  let siguiente: string | null = null;
  if (aprobar) {
    await supabase
      .from('proyecto_etapa')
      .update({ estado: 'aprobada', aprobada_at: new Date().toISOString(), nota_sacs: cierre || null })
      .eq('id', fila.id);
    const sig = etapas.find((e) => e.orden === fila.orden + 1);
    if (sig && sig.estado === 'bloqueada') {
      await supabase.from('proyecto_etapa').update({ estado: 'abierta' }).eq('id', sig.id);
      siguiente = sig.clave;
    }
    await bitacora(brief.id, 'sacs', 'Etapa aprobada', def.clave, cierre || null);
  } else {
    await supabase
      .from('proyecto_etapa')
      .update({ estado: 'cambios', nota_sacs: cierre || null })
      .eq('id', fila.id);
    await bitacora(
      brief.id,
      'sacs',
      `Etapa revisada · ${abiertos.length} ${abiertos.length === 1 ? 'pregunta' : 'preguntas'}`,
      def.clave,
      cierre || null,
    );
  }

  await supabase.from('proyecto_brief').update({ revisado_at: new Date().toISOString() }).eq('id', brief.id);
  await avisarRevision(brief as any, def.clave, preguntas, aprobar, siguiente);

  return json({ ok: true, aprobada: aprobar, preguntas: abiertos.length, siguiente });
};
