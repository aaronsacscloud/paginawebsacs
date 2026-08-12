// GET  /api/revenue/quotes/religar        → QUÉ se ligaría (no toca nada)
// POST /api/revenue/quotes/religar        → lo aplica y crea las oportunidades
//
// Las cotizaciones nacieron con el cliente escrito a mano, sin apuntar a nadie:
// hoy 32 de 32 están así. Por eso no aparecen en la ficha del cliente, ni sus
// pagos, ni el registro de que la abrió.
//
// Se religa por CORREO exacto del contacto, que es el único empate que no
// inventa nada. El nombre de la empresa no sirve como llave: "Ruben's",
// "Ruben's Bridal" y "Rubens" se parecen y no siempre son el mismo cliente.
// Lo que no empata se devuelve en una lista para resolverlo a mano — vale más
// dejar 5 sin ligar que ligar 5 al cliente equivocado.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const norm = (s: any) => String(s || '').trim().toLowerCase();

async function proponer() {
  const { data: quotes } = await supabase.from('quotes')
    .select('id, numero, empresa, contacto, email, total, estado, company_id, contact_id, deal_id')
    .is('company_id', null).not('estado', 'in', '(deleted,plantilla)').limit(500);

  const correos = Array.from(new Set((quotes || []).map((q: any) => norm(q.email)).filter(Boolean)));
  const { data: contactos } = correos.length
    ? await supabase.from('contacts').select('id, nombre, email, company_id, companies(id, nombre)').in('email', correos).limit(1000)
    : { data: [] as any[] };

  const porCorreo = new Map<string, any[]>();
  for (const c of contactos || []) {
    const k = norm(c.email);
    porCorreo.set(k, [...(porCorreo.get(k) || []), c]);
  }

  const ligables: any[] = [];
  const ambiguas: any[] = [];
  const sinEmpate: any[] = [];
  for (const q of quotes || []) {
    const cs = porCorreo.get(norm(q.email)) || [];
    const conEmpresa = cs.filter((c: any) => c.company_id);
    if (conEmpresa.length === 1) {
      const co: any = Array.isArray(conEmpresa[0].companies) ? conEmpresa[0].companies[0] : conEmpresa[0].companies;
      ligables.push({ quote_id: q.id, numero: q.numero, empresa_escrita: q.empresa, total: q.total, estado: q.estado, company_id: conEmpresa[0].company_id, contact_id: conEmpresa[0].id, cliente: co?.nombre });
    } else if (conEmpresa.length > 1) {
      // Mismo correo en dos clientes: aquí una persona tiene que decidir.
      ambiguas.push({ quote_id: q.id, numero: q.numero, email: q.email, opciones: conEmpresa.map((c: any) => ({ company_id: c.company_id, cliente: (Array.isArray(c.companies) ? c.companies[0] : c.companies)?.nombre })) });
    } else {
      sinEmpate.push({ quote_id: q.id, numero: q.numero, empresa_escrita: q.empresa, email: q.email, total: q.total });
    }
  }
  // Ligadas pero SIN oportunidad: pasa cuando se ligó a mano en el editor antes
  // de que existiera el automatismo, o si la creación falló. Sin esto quedan en
  // tierra de nadie — el cliente correcto, la ficha vacía.
  const { data: huerfanas } = await supabase.from('quotes')
    .select('id, numero, empresa, total, estado, company_id, companies(nombre)')
    .not('company_id', 'is', null).is('deal_id', null)
    .in('estado', ['draft', 'sent', 'accepted']).limit(300);
  const sinOportunidad = (huerfanas || []).map((q: any) => ({
    quote_id: q.id, numero: q.numero, total: q.total, estado: q.estado,
    company_id: q.company_id, cliente: (Array.isArray(q.companies) ? q.companies[0] : q.companies)?.nombre,
  }));

  return { ligables, ambiguas, sin_empate: sinEmpate, sin_oportunidad: sinOportunidad };
}

export const GET: APIRoute = async () => json(await proponer());

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const { ligables, ambiguas, sin_empate, sin_oportunidad } = await proponer();
  // Se puede aplicar solo un subconjunto (ids), para revisar por partes.
  const filtro: string[] | null = Array.isArray(b?.quote_ids) && b.quote_ids.length ? b.quote_ids.map(String) : null;
  const aplicar = filtro ? ligables.filter(x => filtro.includes(x.quote_id)) : ligables;

  let ligadas = 0, oportunidades = 0;
  const errores: any[] = [];
  for (const x of aplicar) {
    const { error } = await supabase.from('quotes')
      .update({ company_id: x.company_id, contact_id: x.contact_id }).eq('id', x.quote_id);
    if (error) { errores.push({ numero: x.numero, error: error.message }); continue; }
    ligadas++;

    // Y su oportunidad, para que la cotización viva aparezca en la ficha del
    // cliente. Solo las ACTIVAS: crear una oportunidad de algo vencido o
    // rechazado ensuciaría el pipeline con trabajo que ya no existe.
    if (['draft', 'sent', 'accepted'].includes(String(x.estado))) {
      try {
        const { syncQuoteToDeal } = await import('../../../../lib/crm/sync-quote-deal');
        const etapa = x.estado === 'accepted' ? 'negociacion' : x.estado === 'sent' ? 'cotizacion_enviada' : 'calificacion';
        const r = await syncQuoteToDeal(x.quote_id, { targetStage: etapa as any, valor_total: Number(x.total || 0), trigger: 'religado' });
        if (r?.created) oportunidades++;
      } catch (e: any) { errores.push({ numero: x.numero, error: 'oportunidad: ' + (e?.message || e) }); }
    }
  }

  // Y las que ya tenían cliente pero se quedaron sin oportunidad.
  for (const x of (filtro ? sin_oportunidad.filter((y: any) => filtro.includes(y.quote_id)) : sin_oportunidad)) {
    try {
      const { syncQuoteToDeal } = await import('../../../../lib/crm/sync-quote-deal');
      const etapa = x.estado === 'accepted' ? 'negociacion' : x.estado === 'sent' ? 'cotizacion_enviada' : 'calificacion';
      const r = await syncQuoteToDeal(x.quote_id, { targetStage: etapa as any, valor_total: Number(x.total || 0), trigger: 'religado_sin_oportunidad' });
      if (r?.created) oportunidades++;
    } catch (e: any) { errores.push({ numero: x.numero, error: 'oportunidad: ' + (e?.message || e) }); }
  }

  return json({
    ok: true, ligadas, oportunidades,
    pendientes: { ambiguas: ambiguas.length, sin_empate: sin_empate.length },
    ambiguas, sin_empate, errores,
  });
};
