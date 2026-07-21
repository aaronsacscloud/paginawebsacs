// Precio efectivo de una suscripción = precio base del plan + add-ons − descuentos.
// Es lo que REALMENTE se cobra (monto_proximo), no la ARR de lista. Un solo
// lugar para que add-ons y descuentos coincidan en toda la cobranza.
// Tolerante: si las tablas SQL-5 no existen, devuelve el precio base.
import { supabase } from '../supabase';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Recalcula subscriptions.monto_proximo = base + add-ons − descuentos (piso 0). */
export async function recalcMontoProximo(subId: string): Promise<number | null> {
  const { data: sub } = await supabase.from('subscriptions').select('precio').eq('id', subId).maybeSingle();
  if (!sub) return null;
  let monto = Number(sub.precio || 0);

  const { data: addons } = await supabase.from('subscription_addons')
    .select('precio, cantidad').eq('subscription_id', subId).eq('activo', true);
  for (const a of (addons || [])) monto += Number(a.precio || 0) * Number(a.cantidad || 1);

  const { data: descs } = await supabase.from('discounts')
    .select('tipo, valor').eq('subscription_id', subId).eq('activo', true);
  for (const dsc of (descs || [])) {
    monto -= dsc.tipo === 'porcentaje' ? monto * (Number(dsc.valor || 0) / 100) : Number(dsc.valor || 0);
  }

  const val = Math.max(0, r2(monto));
  await supabase.from('subscriptions').update({ monto_proximo: val }).eq('id', subId);
  return val;
}
