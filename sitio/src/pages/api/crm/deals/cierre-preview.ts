// GET /api/crm/deals/cierre-preview?deal_id=…
//
// Qué va a pasar si marco esta oportunidad como GANADA, ANTES de marcarla.
//
// Hay dos cierres muy distintos y hasta ahora se veían igual:
//   · el cliente YA existe → solo se le agrega lo vendido y listo;
//   · viene de un LEAD → se va a CREAR un cliente nuevo. Eso no puede pasar en
//     silencio: es un registro nuevo en la base con nombre heredado del trato,
//     y quien cierra tiene que verlo y confirmarlo.
//
// Es solo lectura: no crea ni modifica nada. Lo que aquí se describe es
// exactamente lo que hará materializarDealGanado.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { calcularTotales, nombrePlanDeItems } from '../../../../lib/crm/deal-items';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const money = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('deal_id') || '';
  if (!id) return json({ error: 'deal_id requerido' }, 400);

  const { data: deal } = await supabase.from('deals')
    .select('id, nombre, company_id, contact_id, items, descuento_pct, mrr, valor_unico, valor_total, billing_period, plan, categoria, companies(id, nombre, estado_cuenta), contacts(id, nombre, apellido, lifecycle_stage)')
    .eq('id', id).maybeSingle();
  if (!deal) return json({ error: 'No encontré esa oportunidad.' }, 404);

  const empresa: any = Array.isArray(deal.companies) ? deal.companies[0] : deal.companies;
  const contacto: any = Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts;

  // ¿Ya es cliente? No basta con que exista la empresa: una empresa creada como
  // prospecto sigue siendo un lead. Cliente = tiene (o tuvo) suscripción.
  let yaEsCliente = false;
  if (deal.company_id) {
    const { data: sub } = await supabase.from('subscriptions').select('id')
      .eq('company_id', deal.company_id).limit(1).maybeSingle();
    yaEsCliente = !!sub || empresa?.estado_cuenta === 'activo';
  }
  // Se creará un cliente NUEVO cuando no hay empresa por ningún lado.
  let creaCliente = false;
  let nombreCliente = empresa?.nombre || '';
  if (!deal.company_id) {
    if (deal.contact_id) {
      const { data: ct } = await supabase.from('contacts').select('company_id, companies(nombre)').eq('id', deal.contact_id).maybeSingle();
      const co: any = Array.isArray(ct?.companies) ? ct?.companies[0] : ct?.companies;
      if (ct?.company_id) { nombreCliente = co?.nombre || ''; }
      else {
        creaCliente = true;
        nombreCliente = String(deal.nombre || '').replace(/^Oportunidad\s*[—-]\s*/i, '').trim()
          || [contacto?.nombre, contacto?.apellido].filter(Boolean).join(' ').trim() || 'Cliente sin nombre';
      }
    } else {
      creaCliente = false;   // sin contacto tampoco hay de dónde crear
    }
  }

  const items = Array.isArray(deal.items) ? deal.items : [];
  const t = items.length
    ? calcularTotales(items as any, deal.descuento_pct)
    : { mrr: Number(deal.mrr || 0), arr: Number(deal.mrr || 0) * 12, valor_unico: Number(deal.valor_unico || 0), valor_total: Number(deal.valor_total || 0), tipo_ingreso: null as any, billing_period: (deal.billing_period as any) || 'mensual', subtotal_recurrente_periodo: 0 };

  const ciclo = t.billing_period === 'anual' ? 'anual' : 'mensual';
  const precioRec = ciclo === 'anual' ? Math.round(t.mrr * 12) : Math.round(t.mrr);

  // Lo que ya existe creado por este mismo trato no se va a duplicar.
  const { data: yaCreadas } = await supabase.from('subscriptions').select('id, ciclo').eq('deal_id', id).limit(10);
  const yaRecurrente = (yaCreadas || []).some((s: any) => s.ciclo !== 'vitalicia');
  const yaUnico = (yaCreadas || []).some((s: any) => s.ciclo === 'vitalicia');

  const pasos: string[] = [];
  if (creaCliente) pasos.push(`Se creará el cliente “${nombreCliente}” y el contacto quedará marcado como cliente.`);
  else if (yaEsCliente) pasos.push(`${nombreCliente || 'El cliente'} ya está registrado: solo se le agrega lo vendido.`);
  else if (nombreCliente) pasos.push(`Se activará la cuenta de “${nombreCliente}”.`);

  if (t.mrr > 0) {
    pasos.push(yaRecurrente
      ? 'La suscripción de esta oportunidad ya existe: no se duplicará.'
      : `Se creará la suscripción “${nombrePlanDeItems(items as any, deal.plan || 'Licencia SACS')}” por ${money(precioRec)}/${ciclo === 'anual' ? 'año' : 'mes'} (programada, se activa con el primer pago).`);
  }
  if (t.valor_unico > 0) {
    pasos.push(yaUnico
      ? 'El pago único de esta oportunidad ya está registrado: no se duplicará.'
      : `Quedará un pago único por cobrar de ${money(t.valor_unico)} (no suma al ARR).`);
  }
  if (t.mrr <= 0 && t.valor_unico <= 0) pasos.push('⚠ La oportunidad no tiene monto capturado: se marcará ganada pero no generará ningún cobro.');
  pasos.push('Todo esto quedará escrito en la Actividad del cliente.');

  return json({
    deal_id: id, nombre: deal.nombre,
    convierte_lead: creaCliente,
    ya_es_cliente: yaEsCliente,
    cliente: nombreCliente || null,
    contacto: contacto ? [contacto.nombre, contacto.apellido].filter(Boolean).join(' ') : null,
    mrr: t.mrr, arr: t.arr, valor_unico: t.valor_unico, valor_total: t.valor_total,
    ciclo, precio_recurrente: precioRec,
    pasos,
  });
};
