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

// No avisar "sin primera respuesta" de tickets MUY viejos: el histórico
// importado nunca tuvo primera_respuesta registrada y generaría una avalancha
// de avisos de backlog. Solo alertamos los abiertos recientes (SLA operativo).
const VENTANA_SIN_RESP_DIAS = 5;

async function correr(): Promise<Response> {
  const deadline = Date.now() + PRESUPUESTO_MS;
  const out: any = { abiertos: 0, empresas: 0, avisos_sin_respuesta: 0, avisos_estancado: 0 };
  // PostgREST corta en 1000; paginar para no dejar tickets fuera del SLA.
  const cols = 'conversation_id, company_id, asunto, estado, sentimiento, abierto_at, primera_respuesta_at, ultima_actividad_at, intercom_url';
  const tickets: any[] = [];
  for (let off = 0; off < 200000; off += 1000) {
    const { data, error } = await supabase.from('crm_soporte_tickets').select(cols).in('estado', ABIERTO).order('conversation_id').range(off, off + 999);
    if (error) return json({ error: error.message }, 500);
    tickets.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  out.abiertos = tickets.length;
  const empresas = new Set<string>();
  const ahora = Date.now();

  for (const t of tickets) {
    if (t.company_id) empresas.add(t.company_id);
    // Sin primera respuesta a tiempo — solo tickets recientes (no el backlog).
    const abiertoMs = t.abierto_at ? new Date(t.abierto_at).getTime() : null;
    const reciente = abiertoMs != null && (ahora - abiertoMs) < VENTANA_SIN_RESP_DIAS * 86400_000;
    if (!t.primera_respuesta_at && abiertoMs && reciente && (ahora - abiertoMs) > FRT_HORAS * 3600_000) {
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
