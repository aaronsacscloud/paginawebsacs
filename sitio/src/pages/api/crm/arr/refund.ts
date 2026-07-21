// POST /api/crm/arr/refund — reversa un pago mal capturado o reembolsado.
// Body: { payment_id, motivo? }
// Efecto: marca el pago original como reembolsado, inserta un pago-ajuste
// NEGATIVO (mismo monto en negativo) para que el total_pagado y los reportes
// cuadren, resta del total_pagado de la sub y regresa la proxima_factura un
// ciclo (el periodo cobrado se revierte). Registra actividad.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcCompany } from './subscriptions';

export const prerender = false;
const r2 = (n: number) => Math.round(n * 100) / 100;

function restaCiclo(fecha: string, ciclo: string): string {
  const d = new Date(fecha + 'T12:00:00Z');
  if (ciclo === 'anual') d.setUTCFullYear(d.getUTCFullYear() - 1); else d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  if (!b?.payment_id) return new Response(JSON.stringify({ error: 'payment_id requerido' }), { status: 400 });

  const { data: pago } = await supabase.from('payments').select('*').eq('id', b.payment_id).maybeSingle();
  if (!pago) return new Response(JSON.stringify({ error: 'pago no encontrado' }), { status: 404 });
  if (pago.reembolsado) return new Response(JSON.stringify({ error: 'ese pago ya fue reembolsado' }), { status: 409 });
  if (Number(pago.monto || 0) < 0 || pago.es_ajuste) return new Response(JSON.stringify({ error: 'no se puede reembolsar un ajuste' }), { status: 400 });

  const monto = Number(pago.monto || 0);
  const hoy = new Date().toISOString().slice(0, 10);
  const refRev = 'reversa de ' + (pago.referencia || pago.id);

  // Idempotencia SIN depender de la columna `reembolsado` (SQL-5 puede no estar):
  // si ya existe el pago-reversa de este pago, no reembolsar de nuevo.
  const { data: yaRev } = await supabase.from('payments').select('id').eq('referencia', refRev).limit(1).maybeSingle();
  if (yaRev) return new Response(JSON.stringify({ error: 'ese pago ya fue reembolsado', ajuste_id: yaRev.id }), { status: 409 });

  // 1 · marcar original + insertar ajuste negativo (tolerante a SQL-5)
  let mk = await supabase.from('payments').update({ reembolsado: true }).eq('id', pago.id);
  if (mk.error && /column .* does not exist|schema cache/i.test(mk.error.message || '')) {
    // sin columna reembolsado: al menos deja el ajuste
  }
  const ajuste: any = {
    fecha: hoy, monto: -Math.abs(monto), metodo: pago.metodo, referencia: refRev,
    notas: 'Reembolso/ajuste' + (b.motivo ? ': ' + b.motivo : ''),
    company_id: pago.company_id, contact_id: pago.contact_id, subscription_id: pago.subscription_id,
    periodo_cubierto: pago.periodo_cubierto, es_ajuste: true,
  };
  let ins = await supabase.from('payments').insert(ajuste).select('id').single();
  if (ins.error && /column .* does not exist|schema cache/i.test(ins.error.message || '')) {
    delete ajuste.es_ajuste;
    ins = await supabase.from('payments').insert(ajuste).select('id').single();
  }
  if (ins.error) return new Response(JSON.stringify({ error: ins.error.message }), { status: 500 });

  // 2 · revertir la suscripción (total_pagado, pagos, proxima_factura)
  if (pago.subscription_id) {
    const { data: sub } = await supabase.from('subscriptions').select('*').eq('id', pago.subscription_id).maybeSingle();
    if (sub) {
      // Solo retroceder la próxima factura si este ERA el último pago real de la
      // sub — si hubo cobros posteriores, la fecha ya avanzó por ellos y jalarla
      // hacia atrás la dejaría mal.
      const { data: posterior } = await supabase.from('payments').select('id')
        .eq('subscription_id', sub.id).gt('fecha', pago.fecha).gt('monto', 0).limit(1).maybeSingle();
      const upd: any = {
        total_pagado: r2(Math.max(0, Number(sub.total_pagado || 0) - monto)),
        pagos_realizados: Math.max(0, Number(sub.pagos_realizados || 0) - 1),
        updated_at: new Date().toISOString(),
      };
      if (!posterior && sub.proxima_factura) upd.proxima_factura = restaCiclo(sub.proxima_factura, sub.ciclo);
      await supabase.from('subscriptions').update(upd).eq('id', sub.id);
    }
  }
  // 3 · timeline + agregados
  if (pago.company_id) {
    await supabase.from('activities').insert({
      tipo: 'sistema', titulo: `↩️ Pago reembolsado: $${Math.abs(monto).toLocaleString('es-MX')} MXN` + (b.motivo ? ` — ${b.motivo}` : ''),
      company_id: pago.company_id, contact_id: pago.contact_id, automatico: true,
      metadata: { audit: 'refund', payment_id: pago.id, ajuste_id: ins.data.id },
    }).select().maybeSingle();
    await recalcCompany(pago.company_id);
  }
  return new Response(JSON.stringify({ ok: true, ajuste_id: ins.data.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
