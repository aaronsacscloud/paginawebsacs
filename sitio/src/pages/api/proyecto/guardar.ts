import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { briefPorToken, etapasDe, bitacora, json } from '../../../lib/proyecto/store';
import { ETAPAS_POR_CLAVE, faltantes } from '../../../lib/proyecto/etapas';

export const prerender = false;

// Guardar el borrador de una etapa, y opcionalmente enviarla a revisión.
//
// Una etapa solo se puede escribir cuando está 'abierta' o en 'cambios'. En
// 'enviada' y 'aprobada' está cerrada: si el cliente pudiera seguir editando
// después de enviar, la aprobación no valdría nada.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { token, clave, respuestas, enviar } = body || {};

  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);
  if (!brief.firmado_at) return json({ error: 'Primero hay que firmar el brief' }, 403);

  const def = ETAPAS_POR_CLAVE.get(String(clave));
  if (!def) return json({ error: 'Etapa desconocida' }, 400);

  const etapas = await etapasDe(brief.id);
  const fila = etapas.find((e) => e.clave === def.clave);
  if (!fila) return json({ error: 'Etapa no encontrada' }, 404);
  if (fila.estado !== 'abierta' && fila.estado !== 'cambios') {
    return json({ error: 'Esta etapa ya no se puede editar', estado: fila.estado }, 409);
  }

  // Solo se guardan los campos que la etapa declara. Lo que venga de más se
  // tira: el jsonb no es un buzón abierto.
  const permitidos = new Set(def.campos.map((c) => c.id));
  const limpio: Record<string, any> = {};
  for (const [k, v] of Object.entries(respuestas || {})) {
    if (permitidos.has(k)) limpio[k] = v;
  }

  if (enviar) {
    const faltan = faltantes(def.clave, limpio);
    if (faltan.length) return json({ error: 'Faltan respuestas', faltan }, 400);
  }

  const parche: Record<string, any> = {
    respuestas: limpio,
    updated_at: new Date().toISOString(),
  };
  if (enviar) {
    parche.estado = 'enviada';
    parche.enviada_at = new Date().toISOString();
  }

  await supabase.from('proyecto_etapa').update(parche).eq('id', fila.id);

  if (enviar) {
    await bitacora(brief.id, 'cliente', 'Etapa enviada a revisión', def.clave, def.titulo);
  }

  return json({ ok: true, estado: parche.estado || fila.estado });
};
