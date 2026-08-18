// Cotizaciones de una cuenta que todavía no tienen oportunidad.
//
// Una oportunidad debería existir por cada cosa cotizada, pero el puente
// cotización→oportunidad solo corría en ciertos estados, así que hay ventas
// COBRADAS sin oportunidad: la ficha del cliente dice "$0 ganado" cuando ya
// cobró. Carnes Rivera es el caso: COT-78900 se pagó el 31-jul y no aparecía en
// ninguna parte de su pestaña.
//
// GET  ?company_id=&q=  → las cotizaciones sueltas de esa cuenta (y, al buscar,
//                          también las que no están ligadas a ninguna cuenta,
//                          para poder adoptarlas).
// POST { quote_id, company_id } → crea la oportunidad desde esa cotización, con
//                          la etapa y la FECHA REAL que le corresponden.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Las plantillas no son cotizaciones de nadie: son el molde para escribir una.
const NO_SON = ['plantilla', 'deleted'];
const CAMPOS = 'id, numero, empresa, contacto, email, total, estado, created_at, pagado_fecha, company_id, deal_id';

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id') || '';
  const q = (url.searchParams.get('q') || '').trim();
  if (!companyId && !q) return json({ error: 'Falta la cuenta.' }, 400);

  const propias = companyId
    ? await supabase.from('quotes').select(CAMPOS)
        .eq('company_id', companyId).is('deal_id', null).not('estado', 'in', `(${NO_SON.join(',')})`)
        .order('created_at', { ascending: false }).limit(50)
    : { data: [] as any[] };

  // Al buscar se abre el rango a las cotizaciones HUÉRFANAS —las que se
  // hicieron antes de que existiera la cuenta y nunca se ligaron—. No se
  // incluyen las de OTRO cliente: adoptar la cotización de alguien más movería
  // dinero de ficha.
  let sueltas: any[] = [];
  if (q.length >= 2) {
    const patron = `%${q.replace(/[%,]/g, '')}%`;
    const { data } = await supabase.from('quotes').select(CAMPOS)
      .is('company_id', null).is('deal_id', null).not('estado', 'in', `(${NO_SON.join(',')})`)
      .or(`numero.ilike.${patron},empresa.ilike.${patron},email.ilike.${patron},contacto.ilike.${patron}`)
      .order('created_at', { ascending: false }).limit(25);
    sueltas = data || [];
  }

  const filtra = (rows: any[]) => !q ? rows : rows.filter((r: any) =>
    [r.numero, r.empresa, r.contacto, r.email].some((x: any) => String(x || '').toLowerCase().includes(q.toLowerCase())));

  return json({ propias: filtra(propias.data || []), huerfanas: sueltas });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const quoteId = String(b?.quote_id || '');
  const companyId = String(b?.company_id || '');
  if (!quoteId) return json({ error: 'Falta la cotización.' }, 400);

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!quote) return json({ error: 'Esa cotización ya no existe.' }, 404);
  if (quote.deal_id) return json({ error: 'Esa cotización ya tiene una oportunidad.' }, 409);

  // Una cotización huérfana se adopta; una que ya es de otro cliente NO se
  // mueve desde aquí: eso es una corrección de datos, no un alta.
  if (companyId && !quote.company_id) {
    await supabase.from('quotes').update({ company_id: companyId }).eq('id', quoteId);
    quote.company_id = companyId;
  } else if (companyId && quote.company_id && quote.company_id !== companyId) {
    return json({ error: 'Esa cotización pertenece a otro cliente.' }, 409);
  }

  const { etapaParaEstado, syncQuoteToDeal } = await import('../../../../lib/crm/sync-quote-deal');
  // Sin etapa conocida se abre como cotización enviada: la oportunidad tiene
  // que existir aunque el estado sea raro, que es justo el caso que la dejó
  // fuera la primera vez.
  const etapa = etapaParaEstado(String(quote.estado)) || 'cotizacion_enviada';
  // La fecha REAL: una venta de julio recuperada hoy no puede aparecer cerrada
  // hoy — desplazaría el mes en todo reporte.
  const cerrada = quote.pagado_fecha || quote.rechazado_fecha || (etapa === 'cerrada_perdida' ? quote.vigencia : null);

  let r: any;
  try {
    r = await syncQuoteToDeal(quoteId, {
      targetStage: etapa as any,
      valor_total: Math.round(Number(quote.total || 0)),
      trigger: 'alta_manual_desde_ficha',
      closed_at: cerrada ? new Date(cerrada).toISOString() : undefined,
      motivo_perdida: quote.estado === 'expired' ? 'Venció sin respuesta' : quote.estado === 'rejected' ? 'Rechazada por el cliente' : undefined,
    });
  } catch (e: any) {
    // El motivo real, no "no se pudo": el primer intento falló por una
    // restricción de catálogo y sin el mensaje no había por dónde empezar.
    return json({ error: String(e?.message || e) }, 500);
  }
  if (!r?.dealId) return json({ error: 'No se pudo crear la oportunidad de esa cotización.' }, 500);

  // Una cotización PAGADA cierra el círculo: cliente, suscripción o pago único.
  // Sin esto la oportunidad nace ganada pero no deja nada detrás.
  let cierre: any = null;
  if (etapa === 'cerrada_ganada') {
    try {
      const { data: deal } = await supabase.from('deals').select('*').eq('id', r.dealId).maybeSingle();
      if (deal) {
        const { materializarDealGanado } = await import('../../../../lib/crm/deal-cierre');
        cierre = await materializarDealGanado(deal);
      }
    } catch (e: any) { cierre = { error: String(e?.message || e) }; }
  }

  return json({ ok: true, deal_id: r.dealId, etapa, cierre }, 201);
};
