/* ══ LA SUSCRIPCIÓN DICE LO MISMO QUE SU COTIZACIÓN (12-oct-2026) ═══════════
   Tres cuentas (Jadash COT-80122, Love Cosmetics COT-80127, Marketplace
   COT-80120) cobraban como anual lo que se vendió mensual: la cotización se
   editó antes del cobro y la suscripción nació con las líneas viejas del trato.
   La causa se arregló en syncQuoteToDeal; esta revisión es la red: si por
   cualquier otro camino (editar una cotización ya cobrada, un alta a mano) la
   suscripción y la cotización dejan de coincidir en ciclo o precio, la campana
   lo dice en vez de que lo descubra el cliente con un cobro equivocado.

   Solo AVISA, nunca corrige: cuál de las dos tiene razón lo decide una persona. */
import { supabase } from '../supabase';
import { notificar } from './notificaciones';

export type Descuadre = {
  subscription_id: string; company_id: string | null; numero: string; empresa: string;
  cotizacion: { ciclo: string; precio: number }; suscripcion: { ciclo: string; precio: number };
};

/** Ciclo y precio recurrente que la cotización vendió (el total manda: el
 *  descuento global y el IVA se reparten entre las líneas). */
export function recurrenteDeCotizacion(q: any): { ciclo: string; precio: number } | null {
  const items: any[] = Array.isArray(q?.items) ? q.items : [];
  const rec = items.filter(i => i.tipo === 'plan' || (i.tipo === 'extra' && i.recurrente));
  if (!rec.length) return null;
  const anuales = rec.filter(i => i.periodo === 'anual' || i.periodo_extra === 'anual');
  const ciclo = anuales.length === rec.length ? 'anual' : 'mensual';
  const monto = (i: any) => Number(i.subtotal ?? i.monto ?? 0) || 0;
  const bruto = items.reduce((a, i) => a + monto(i), 0);
  const factor = bruto > 0 && Number(q.total) > 0 ? Number(q.total) / bruto : 1;
  return { ciclo, precio: Math.round(rec.reduce((a, i) => a + monto(i), 0) * factor * 100) / 100 };
}

export async function auditarSubsContraCotizacion(opts: { avisar?: boolean } = {}): Promise<Descuadre[]> {
  const { data: subs } = await supabase.from('subscriptions')
    .select('id, company_id, quote_id, ciclo, precio, estado')
    .not('quote_id', 'is', null).neq('ciclo', 'vitalicia')
    .in('estado', ['activa', 'programada', 'pendiente_pago', 'pausada']);
  const ids = [...new Set((subs || []).map(s => s.quote_id))];
  if (!ids.length) return [];
  const { data: quotes } = await supabase.from('quotes').select('id, numero, empresa, total, items').in('id', ids);
  const porId = new Map((quotes || []).map(q => [q.id, q]));

  const out: Descuadre[] = [];
  for (const s of subs || []) {
    const q = porId.get(s.quote_id);
    const e = q && recurrenteDeCotizacion(q);
    if (!e) continue;
    const precioSub = Number(s.precio || 0);
    if (e.ciclo === s.ciclo && Math.abs(e.precio - precioSub) <= 1) continue;
    const d: Descuadre = {
      subscription_id: s.id, company_id: s.company_id, numero: q.numero, empresa: (q.empresa || '').trim(),
      cotizacion: e, suscripcion: { ciclo: s.ciclo, precio: precioSub },
    };
    out.push(d);
    if (opts.avisar) {
      const fmt = (x: { ciclo: string; precio: number }) => `${x.ciclo} $${x.precio.toLocaleString('es-MX')}`;
      await notificar({
        // La clave lleva los dos lados: si alguien corrige y vuelve a descuadrar, avisa de nuevo.
        clave: `sub-vs-cot:${s.id}:${s.ciclo}:${precioSub}:${e.ciclo}:${e.precio}`,
        tipo: 'sub_descuadre_cotizacion', nivel: 'alerta', destino: 'pagos',
        company_id: s.company_id, subscription_id: s.id,
        titulo: `${d.empresa || 'Cliente'}: la suscripción no coincide con su cotización ${q.numero}`,
        detalle: `Cotización: ${fmt(e)}. Suscripción: ${fmt(d.suscripcion)}. Revisa cuál es la buena antes del siguiente cobro.`,
        metadata: { quote_id: q.id, cotizacion: e, suscripcion: d.suscripcion },
      });
    }
  }
  return out;
}
