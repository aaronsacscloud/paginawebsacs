// SOPORTE · Webhook de Intercom (PÚBLICO — Intercom avisa desde sus servidores,
// sin sesión). Candado: firma HMAC-SHA1 (X-Hub-Signature) validada por el
// handler, + dedup por crm_webhook_eventos. Mismo blindaje que el de Mercado
// Pago. Registra/actualiza el ticket y lo liga al perfil del cliente.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { hayConfig, firmaValida, parseEvento, upsertTicket } from '../../../lib/soporte/intercom';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  // Fail-closed: sin secreto configurado, no se acepta nada.
  if (!hayConfig()) return json({ error: 'Intercom no configurado' }, 503);

  const raw = await request.text();
  if (!firmaValida(raw, request.headers.get('x-hub-signature'))) {
    return json({ error: 'firma inválida' }, 401);
  }

  let body: any; try { body = JSON.parse(raw); } catch { return json({ error: 'body inválido' }, 400); }

  // Ping de verificación de Intercom al configurar el webhook.
  if (body?.type === 'ping' || body?.topic === 'ping') return json({ ok: true, pong: true });

  const eventoId = String(body?.id || body?.data?.item?.id || '') + ':' + String(body?.topic || '');
  // Dedup: Intercom reintenta; el índice único corta el reproceso.
  try {
    const { error } = await supabase.from('crm_webhook_eventos')
      .insert({ pasarela: 'intercom', evento_id: eventoId, topic: body?.topic || null, payload: body });
    if (error && /duplicate|23505/i.test(error.message)) return json({ ok: true, duplicado: true });
  } catch { /* si la tabla falla, seguimos: el upsert del ticket es idempotente igual */ }

  try {
    const ev = parseEvento(body);
    if (!ev) return json({ ok: true, ignorado: true }); // topic que no nos interesa
    const r = await upsertTicket(ev);
    return json({ ok: true, ligado: !!r.company_id });
  } catch (e: any) {
    console.error('[intercom] webhook:', e?.message);
    return json({ ok: true, error_interno: true }); // 200 para que Intercom no reintente en bucle
  }
};
