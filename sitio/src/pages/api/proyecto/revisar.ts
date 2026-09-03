import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getSessionFromRequest } from '../../../lib/auth/session';
import { briefPorToken, etapasDe, bitacora, json } from '../../../lib/proyecto/store';
import { ETAPAS_POR_CLAVE } from '../../../lib/proyecto/etapas';

export const prerender = false;

// Aprobar una etapa o devolverla con cambios. Este es el único lado del brief
// que NO abre el token: aquí decide Sacs, así que exige sesión founder/cs
// (el middleware ya la pide; esto es el segundo candado).
export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionFromRequest(request);
  if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
    return json({ error: 'No autorizado' }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const { token, clave, accion, nota } = body || {};

  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);

  const def = ETAPAS_POR_CLAVE.get(String(clave));
  if (!def) return json({ error: 'Etapa desconocida' }, 400);

  const etapas = await etapasDe(brief.id);
  const fila = etapas.find((e) => e.clave === def.clave);
  if (!fila) return json({ error: 'Etapa no encontrada' }, 404);

  const quien = user.nombre || user.email || 'Sacs';

  if (accion === 'aprobar') {
    await supabase
      .from('proyecto_etapa')
      .update({
        estado: 'aprobada',
        aprobada_at: new Date().toISOString(),
        nota_sacs: String(nota || '').slice(0, 2000) || null,
      })
      .eq('id', fila.id);

    // Aprobar una etapa abre la siguiente. Es la mecánica entera del brief:
    // nadie contesta la etapa 3 antes de que la 2 esté cerrada.
    const sig = etapas.find((e) => e.orden === fila.orden + 1);
    if (sig && sig.estado === 'bloqueada') {
      await supabase.from('proyecto_etapa').update({ estado: 'abierta' }).eq('id', sig.id);
    }
    await bitacora(brief.id, 'sacs', 'Etapa aprobada', def.clave, quien);
    return json({ ok: true, siguiente: sig?.clave || null });
  }

  if (accion === 'cambios') {
    const n = String(nota || '').trim();
    if (!n) return json({ error: 'Escribe qué hay que corregir' }, 400);
    await supabase
      .from('proyecto_etapa')
      .update({ estado: 'cambios', nota_sacs: n.slice(0, 2000) })
      .eq('id', fila.id);
    await bitacora(brief.id, 'sacs', 'Etapa devuelta con cambios', def.clave, n.slice(0, 300));
    return json({ ok: true });
  }

  if (accion === 'reabrir') {
    await supabase.from('proyecto_etapa').update({ estado: 'abierta' }).eq('id', fila.id);
    await bitacora(brief.id, 'sacs', 'Etapa reabierta', def.clave, quien);
    return json({ ok: true });
  }

  return json({ error: 'Acción desconocida' }, 400);
};
