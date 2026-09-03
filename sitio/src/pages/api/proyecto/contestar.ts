import type { APIRoute } from 'astro';
import { briefPorToken, etapasDe, bitacora, json } from '../../../lib/proyecto/store';
import { escribir } from '../../../lib/proyecto/hilos';
import { ETAPAS_POR_CLAVE } from '../../../lib/proyecto/etapas';

export const prerender = false;

// El cliente contesta UNA pregunta dentro de su hilo. No cambia el estado de
// la etapa: eso pasa cuando le da a "volver a enviar", para que pueda contestar
// tres hilos y mandar todo junto.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { token, clave, campo, texto } = body || {};

  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);
  if (!brief.firmado_at) return json({ error: 'Primero hay que firmar el brief' }, 403);

  const def = ETAPAS_POR_CLAVE.get(String(clave));
  if (!def) return json({ error: 'Etapa desconocida' }, 400);
  if (!def.campos.some((c) => c.id === campo)) return json({ error: 'Pregunta desconocida' }, 400);

  const etapas = await etapasDe(brief.id);
  const fila = etapas.find((e) => e.clave === def.clave);
  if (!fila || (fila.estado !== 'cambios' && fila.estado !== 'abierta')) {
    return json({ error: 'Esta etapa no está abierta para contestar' }, 409);
  }

  const t = String(texto || '').trim();
  if (!t) return json({ error: 'Escribe tu respuesta' }, 400);

  await escribir(brief.id, def.clave, String(campo), 'cliente', t, 'abierto');
  await bitacora(brief.id, 'cliente', 'Contestó una pregunta', def.clave, def.campos.find((c) => c.id === campo)?.etiqueta || null);
  return json({ ok: true });
};
