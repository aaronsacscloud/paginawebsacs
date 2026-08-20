// GET /api/cron/email-campanas — el motor que de verdad manda las campañas.
//
// Corre cada 5 minutos. Toma las campañas programadas cuya hora ya llegó y las
// va vaciando; si no termina, el siguiente tick continúa. Procesa TODO lo
// vencido y no "lo de este tick": un tick perdido no puede dejar una campaña
// varada para siempre.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { procesar } from '../../../lib/email/campanas';
import { marcarEnviosDudosos } from '../../../lib/email/pipeline';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url, request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const soloUna = url.searchParams.get('campana');

  // Envíos que quedaron a medias por una función muerta: se marcan, no se
  // reintentan (ver pipeline.ts).
  const dudosos = await marcarEnviosDudosos(10);

  const ahora = new Date().toISOString();
  let q = supabase.from('email_campaigns').select('id, nombre, estado, programada_para')
    .in('estado', ['programada', 'enviando']).order('programada_para', { ascending: true }).limit(10);
  if (soloUna) q = supabase.from('email_campaigns').select('id, nombre, estado, programada_para').eq('id', soloUna);
  const { data: campanas } = await q;

  const resultados: any[] = [];
  // Presupuesto global de la invocación repartido entre campañas.
  const presupuestoTotal = 240_000;
  const inicio = Date.now();

  for (const c of campanas || []) {
    if (Date.now() - inicio > presupuestoTotal) break;
    if (c.estado === 'programada' && c.programada_para && c.programada_para > ahora) continue;
    const restante = presupuestoTotal - (Date.now() - inicio);
    const av = await procesar(c.id, Math.max(15_000, restante));
    resultados.push({ campana: c.nombre, ...av });
  }

  return json({ ok: true, dudosos_marcados: dudosos, campanas: resultados });
};
