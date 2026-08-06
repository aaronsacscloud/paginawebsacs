// POST /api/crm/arr/mp-cancelar { subscription_id, accion: 'cancelar'|'pausar'|'reanudar', tambien_crm? }
//
// Deja de cobrarle en Mercado Pago desde el CRM. Antes había que entrar al panel
// de MP a buscar la suscripción entre 38, y mientras tanto se le seguía cobrando
// a alguien que ya canceló — que es la peor forma de perder un cliente que ya se
// había ido en buenos términos.
//
// LO QUE SE CANCELA Y LO QUE NO: cancelar en Mercado Pago detiene el COBRO. Que
// la suscripción del CRM pase a cancelada es otra decisión —a veces se detiene
// el cargo mientras el cliente cambia de tarjeta— así que va aparte, en
// `tambien_crm`, y el aviso lo dice antes de hacerlo.
//
// En Mercado Pago cancelar es IRREVERSIBLE: una suscripción cancelada no se
// reactiva, hay que crear otra y que el cliente la autorice de nuevo. Por eso
// existe 'pausar', que sí se puede deshacer.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';
import { recalcCompany } from './subscriptions';
import { recordDelta } from '../../../../lib/crm/mrr-ledger';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const ESTADO_MP: Record<string, string> = { cancelar: 'cancelled', pausar: 'paused', reanudar: 'authorized' };

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b?.accion || 'cancelar');
  if (!b?.subscription_id) return json({ error: 'subscription_id requerido' }, 400);
  if (!ESTADO_MP[accion]) return json({ error: 'acción no válida' }, 400);

  let cx;
  try { cx = await conexionActiva(); } catch (e: any) { return json({ error: e?.message }, 500); }
  if (!cx) return json({ error: 'Conecta tu cuenta de Mercado Pago primero.' }, 400);

  const { data: sub } = await supabase.from('subscriptions')
    .select('id, company_id, nombre_plan, estado, precio, ciclo, mrr, mp_preapproval_id')
    .eq('id', b.subscription_id).maybeSingle();
  if (!sub) return json({ error: 'Suscripción no encontrada' }, 404);
  if (!sub.mp_preapproval_id) return json({ error: 'Esa suscripción no tiene una domiciliación de Mercado Pago que detener.' }, 400);

  let pre: any;
  try {
    pre = await mpFetch('/preapproval/' + sub.mp_preapproval_id, {
      method: 'PUT', body: JSON.stringify({ status: ESTADO_MP[accion] }),
    }, cx);
  } catch (e: any) {
    return json({ error: 'Mercado Pago no pudo ' + accion + ': ' + (e?.message || e) }, 502);
  }

  const verbo = accion === 'cancelar' ? 'cancelada' : accion === 'pausar' ? 'pausada' : 'reactivada';
  await supabase.from('activities').insert({
    tipo: 'sistema', company_id: sub.company_id, automatico: true,
    titulo: `Cobro automático ${verbo} en Mercado Pago: ${sub.nombre_plan}`,
    descripcion: accion === 'cancelar'
      ? 'Ya no se le va a cobrar. En Mercado Pago esto no se deshace: para volver a cobrarle hay que crear otra domiciliación y que la autorice.'
      : null,
    metadata: { audit: 'mp_' + accion, subscription_id: sub.id, mp_preapproval_id: sub.mp_preapproval_id, estado_mp: pre?.status },
  }).select().maybeSingle();

  // El CRM solo se toca si lo pidieron: detener el cargo y dar de baja al
  // cliente no son lo mismo.
  let crm = null;
  if (b?.tambien_crm && (accion === 'cancelar' || accion === 'pausar')) {
    const nuevo = accion === 'cancelar' ? 'cancelada' : 'pausada';
    const aportabaAntes = (sub.estado === 'activa' || sub.estado === 'pendiente_pago') ? Number(sub.mrr || 0) : 0;
    const upd: any = { estado: nuevo, updated_at: new Date().toISOString() };
    if (accion === 'cancelar') {
      upd.cancelada_at = new Date().toISOString();
      upd.razon_cancelacion = b?.razon || 'Cancelada desde Mercado Pago';
    } else {
      upd.pausada_at = new Date().toISOString();
      upd.razon_pausa = b?.razon || 'Cobro detenido en Mercado Pago';
    }
    await supabase.from('subscriptions').update(upd).eq('id', sub.id);
    await recalcCompany(sub.company_id);
    await recordDelta({
      subscription_id: sub.id, company_id: sub.company_id,
      mrr_anterior: aportabaAntes, mrr_nuevo: 0,
      motivo: accion === 'cancelar' ? 'cancelación (desde Mercado Pago)' : 'pausa (desde Mercado Pago)',
      actor: 'admin',
    });
    crm = nuevo;
  }

  return json({ ok: true, estado_mp: pre?.status || ESTADO_MP[accion], crm });
};
