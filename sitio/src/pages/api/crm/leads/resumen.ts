// GET /api/crm/leads/resumen?dias=30 — los números de la pantalla de Leads.
//
// Dos definiciones que cambian el resultado y por eso se escriben aquí:
//
//  · CONVERTIDO cuenta cuando nace su primera suscripción, no cuando alguien
//    mueve la etapa a mano. La etapa se olvida; el cobro no.
//  · La CONVERSIÓN se mide sobre los leads que entraron hace 60 días o más, no
//    sobre el total. Medida contra todos, entre más leads entren peor se ve el
//    número aunque estés cerrando igual — y castigar una buena semana de
//    captación es exactamente lo contrario de lo que debe hacer un tablero.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { origenDeRegistro } from '../../../../lib/crm/origenes';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const ETAPAS_LEAD = ['lead', 'lead_calificado', 'oportunidad'];
const hace = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const GET: APIRoute = async ({ url }) => {
  const dias = Math.min(365, Math.max(1, Number(url.searchParams.get('dias')) || 30));
  const desde = hace(dias);

  const [ctsQ, subsQ] = await Promise.all([
    supabase.from('contacts')
      .select('id, created_at, lifecycle_stage, fuente, utm_source, propiedades, company_id, last_contact_at')
      .is('archived_at', null),
    supabase.from('subscriptions').select('company_id, fecha_inicio, arr, estado'),
  ]);
  const cts = ctsQ.data || [];
  const subs = subsQ.data || [];

  // Primera suscripción de cada empresa: el momento real en que se volvió cliente.
  const primeraDe: Record<string, { fecha: string; arr: number }> = {};
  subs.forEach((s: any) => {
    if (!s.fecha_inicio || !s.company_id) return;
    const f = String(s.fecha_inicio).slice(0, 10);
    if (!primeraDe[s.company_id] || f < primeraDe[s.company_id].fecha) {
      primeraDe[s.company_id] = { fecha: f, arr: Number(s.arr || 0) };
    }
  });

  const abiertos = cts.filter((c: any) => ETAPAS_LEAD.includes(c.lifecycle_stage));
  const nuevos = abiertos.filter((c: any) => String(c.created_at || '') >= desde);
  const sinSeguimiento = abiertos.filter((c: any) => !c.last_contact_at || String(c.last_contact_at) < hace(7));

  const desdeDia = desde.slice(0, 10);
  const convertidos = cts.filter((c: any) =>
    c.company_id && primeraDe[c.company_id] && primeraDe[c.company_id].fecha >= desdeDia);
  const arrConvertido = Array.from(new Set(convertidos.map((c: any) => c.company_id)))
    .reduce((a: number, id: any) => a + (primeraDe[id]?.arr || 0), 0);

  // Cohorte: los que entraron hace 60 días o más ya tuvieron tiempo de decidir.
  const corte = hace(60);
  const cohorte = cts.filter((c: any) => String(c.created_at || '') < corte);
  const cohorteConv = cohorte.filter((c: any) => c.company_id && primeraDe[c.company_id]);
  const conversion = cohorte.length ? Math.round((cohorteConv.length / cohorte.length) * 100) : null;

  // Por origen: volumen y qué tan bien cierra cada canal. Es la comparación que
  // decide dónde poner el dinero — el que trae más no siempre es el que cierra.
  const porOrigen: Record<string, { n: number; conv: number }> = {};
  cts.forEach((c: any) => {
    const o = origenDeRegistro(c) || 'sin_definir';
    porOrigen[o] = porOrigen[o] || { n: 0, conv: 0 };
    porOrigen[o].n++;
    if (c.company_id && primeraDe[c.company_id]) porOrigen[o].conv++;
  });

  return json({
    dias,
    nuevos: nuevos.length,
    abiertos: abiertos.length,
    convertidos: new Set(convertidos.map((c: any) => c.company_id)).size,
    arr_convertido: Math.round(arrConvertido),
    conversion, cohorte: cohorte.length,
    sin_seguimiento: sinSeguimiento.length,
    origenes: Object.entries(porOrigen)
      .map(([v, x]) => ({ v, n: x.n, conv: x.conv, pct: x.n ? Math.round((x.conv / x.n) * 100) : 0 }))
      .sort((a, b) => b.n - a.n),
  });
};
