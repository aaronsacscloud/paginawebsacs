// POST /api/crm/arr/estado-cuenta-oferta — configura (o quita) un descuento de
// "pronto pago" para la suscripción, que se muestra en su estado de cuenta
// público (/estado-cuenta/<id>) con un countdown.
//
// SEGURIDAD: gateado por el middleware (/api/crm/* → founder/cs). El descuento
// se PERSISTE en la suscripción (columnas pp_*), NUNCA viaja en la URL → el
// cliente no puede manipular el % ni extender el timer.
//
// REGLA: el vencimiento SIEMPRE se clampa a antes de la fecha de la próxima
// factura (es un incentivo a pagar ANTES de que venza).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

// Instante (ms) del inicio del día de la próxima factura, horario de México.
function proximaFacturaMs(proxima: string | null): number | null {
  if (!proxima) return null;
  const d = new Date(String(proxima).slice(0, 10) + 'T00:00:00-06:00');
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const subId = body?.subscription_id;
  if (!subId) return json({ error: 'subscription_id requerido' }, 400);

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select('id, ciclo, precio, monto_proximo, proxima_factura')
    .eq('id', subId).single();
  if (error || !sub) return json({ error: 'suscripción no encontrada' }, 404);

  // Quitar la oferta
  if (body.action === 'clear' || body.pct == null) {
    await supabase.from('subscriptions').update({ pp_monto: null, pp_pct: null, pp_expira_at: null, pp_creado_at: null }).eq('id', subId);
    return json({ ok: true, cleared: true });
  }

  const pct = Math.round(Number(body.pct));
  const horas = Number(body.vigencia_horas);
  if (!Number.isFinite(pct) || pct < 1 || pct > 90) return json({ error: 'El descuento debe ser entre 1% y 90%.' }, 400);
  if (!Number.isFinite(horas) || horas < 1) return json({ error: 'La vigencia debe ser de al menos 1 hora.' }, 400);
  if (sub.ciclo === 'vitalicia') return json({ error: 'Una suscripción vitalicia (pago único) no tiene mensualidad para ofrecer pronto pago.' }, 400);

  const now = Date.now();
  const facturaMs = proximaFacturaMs(sub.proxima_factura);
  if (!facturaMs || facturaMs <= now) {
    return json({ error: 'No hay una fecha de próximo pago futura: no se puede ofrecer un descuento de pronto pago.' }, 400);
  }

  // Vencimiento pedido, CLAMPEADO a antes de la fecha de la próxima factura.
  const pedido = now + horas * 3600000;
  const techo = facturaMs; // no puede alcanzar la fecha de pago
  const expiraMs = Math.min(pedido, techo);
  if (expiraMs <= now) {
    return json({ error: 'La fecha de pago es demasiado próxima para un descuento con esa vigencia.' }, 400);
  }
  const clamped = pedido > techo;

  const base = Number(sub.monto_proximo ?? sub.precio) || 0;
  const ppMonto = Math.round(base * (1 - pct / 100));

  const { error: upErr } = await supabase.from('subscriptions').update({
    pp_monto: ppMonto,
    pp_pct: pct,
    pp_expira_at: new Date(expiraMs).toISOString(),
    pp_creado_at: new Date(now).toISOString(),
  }).eq('id', subId);
  if (upErr) return json({ error: upErr.message }, 500);

  return json({
    ok: true,
    subscription_id: subId,
    base,
    pp_monto: ppMonto,
    pct,
    expira_at: new Date(expiraMs).toISOString(),
    clamped, // true si la vigencia se recortó para caber antes de la fecha de pago
  });
};
