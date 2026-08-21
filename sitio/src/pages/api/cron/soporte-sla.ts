// SOPORTE · SLA. Corre periódico: (1) refresca el rollup/salud de las empresas
// con tickets abiertos —"estancado" depende del PASO DEL TIEMPO, que ningún
// webhook dispara—, y (2) avisa a la campana por tickets sin primera respuesta
// o estancados. Idempotente por clave.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { recomputarSoporteEmpresa, SLA_ESTANCADO_HORAS } from '../../../lib/crm/soporte-rollup';

export const prerender = false;
const FRT_HORAS = 8;                 // sin primera respuesta más de esto = alerta
const PRESUPUESTO_MS = 60_000;
const ABIERTO = ['abierto', 'en_curso', 'pausado'];
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

async function correr(): Promise<Response> {
  const deadline = Date.now() + PRESUPUESTO_MS;
  const out: any = { abiertos: 0, empresas: 0, avisos_sin_respuesta: 0, avisos_estancado: 0 };
  const { data: tks, error } = await supabase.from('crm_soporte_tickets')
    .select('conversation_id, company_id, asunto, estado, sentimiento, abierto_at, primera_respuesta_at, ultima_actividad_at, intercom_url')
    .in('estado', ABIERTO).limit(5000);
  if (error) return json({ error: error.message }, 500);

  const tickets = tks || [];
  out.abiertos = tickets.length;
  const empresas = new Set<string>();
  const ahora = Date.now();

  for (const t of tickets) {
    if (t.company_id) empresas.add(t.company_id);
    // Sin primera respuesta a tiempo.
    const abiertoMs = t.abierto_at ? new Date(t.abierto_at).getTime() : null;
    if (!t.primera_respuesta_at && abiertoMs && (ahora - abiertoMs) > FRT_HORAS * 3600_000) {
      const nuevo = await notificar({
        clave: `sla_soporte:${t.conversation_id}:sin_respuesta`,
        tipo: 'soporte_sla', nivel: t.sentimiento === 'urgente' ? 'urgente' : 'alerta',
        titulo: 'Ticket sin primera respuesta', detalle: (t.asunto || 'Sin asunto') + ` · ${Math.floor((ahora - abiertoMs) / 3600_000)} h esperando`,
        company_id: t.company_id, destino: 'soporte',
        metadata: { conversation_id: t.conversation_id, intercom_url: t.intercom_url },
      });
      if (nuevo) out.avisos_sin_respuesta++;
    }
    // Estancado (sin actividad).
    const refMs = t.ultima_actividad_at ? new Date(t.ultima_actividad_at).getTime() : abiertoMs;
    if (refMs && (ahora - refMs) > SLA_ESTANCADO_HORAS * 3600_000) {
      const nuevo = await notificar({
        clave: `sla_soporte:${t.conversation_id}:estancado`,
        tipo: 'soporte_sla', nivel: 'alerta',
        titulo: 'Ticket estancado', detalle: (t.asunto || 'Sin asunto') + ` · ${Math.floor((ahora - refMs) / 3600_000)} h sin movimiento`,
        company_id: t.company_id, destino: 'soporte',
        metadata: { conversation_id: t.conversation_id, intercom_url: t.intercom_url },
      });
      if (nuevo) out.avisos_estancado++;
    }
  }

  // Refrescar rollup/salud de cada empresa con tickets abiertos.
  for (const cid of empresas) {
    if (Date.now() > deadline) { out.presupuesto_agotado = true; break; }
    await recomputarSoporteEmpresa(cid);
    out.empresas++;
  }
  return json({ ok: true, ...out });
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  return correr();
};
export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  return correr();
};
