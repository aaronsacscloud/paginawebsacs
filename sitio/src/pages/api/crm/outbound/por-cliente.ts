// OUTBOUND · Toda la actividad del canal para UN cliente (ficha 360).
//
// GET ?company_id=<uuid> → { cuentas, campanas: [...], nps: [...], citas: [...],
//                            conversiones: [...], intereses }
// Mismo patrón que Reuniones/Mejoras: la ficha lo pide aparte al abrir su tab.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { cuentasDe, normCuenta } from '../../../../lib/crm/sacs-cuentas';
import { leerPaginado } from '../../../../lib/outbound/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return json({ error: 'Falta company_id' }, 400);

  const { data: co } = await supabase.from('companies')
    .select('id, sacs_account, intereses').eq('id', companyId).maybeSingle();
  if (!co) return json({ error: 'Cliente no encontrado' }, 404);

  const cuentas = await cuentasDe(companyId, co.sacs_account);
  if (!cuentas.length) return json({ cuentas: [], campanas: [], nps: [], citas: [], conversiones: [], intereses: co.intereses || null });

  // Eventos de TODAS sus cuentas (paginado: max_rows=1000)
  const evs = await leerPaginado((from, to) => supabase.from('inapp_eventos')
    .select('campana_id, evento, boton, valor, comentario, cuenta, dia, created')
    .in('cuenta', cuentas).order('id', { ascending: true }).range(from, to), 20000);

  // Agrupar por campaña con la información clave de cada acción
  const porCampana: Record<string, any> = {};
  const nps: any[] = [];
  for (const e of evs) {
    const g = porCampana[e.campana_id] = porCampana[e.campana_id] || {
      campana_id: e.campana_id, impresiones: 0, clics: [] as any[], cierres: 0, descartes: 0,
      citas: 0, encuestas: 0, primero: e.created, ultimo: e.created,
    };
    if (e.created < g.primero) g.primero = e.created;
    if (e.created > g.ultimo) g.ultimo = e.created;
    if (e.evento === 'impresion') g.impresiones++;
    if (e.evento === 'clic') g.clics.push({ boton: e.boton, dia: e.dia });
    if (e.evento === 'cierre') g.cierres++;
    if (e.evento === 'descarte') g.descartes++;
    if (e.evento === 'cita_agendada') g.citas++;
    if (e.evento === 'respuesta_encuesta') {
      g.encuestas++;
      nps.push({ campana_id: e.campana_id, valor: e.valor, comentario: e.comentario || null, dia: e.dia, cuenta: e.cuenta });
    }
  }
  const ids = Object.keys(porCampana);

  // Nombres y metas de esas campañas
  // Por LOTES sobre TODOS los ids: un solo slice marcaba campañas reales como
  // "(campaña eliminada)" pasando de 200 (el clásico truncado silencioso).
  let campanasInfo: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data: cs } = await supabase.from('inapp_campanas')
      .select('id, nombre, formato, estado, meta').in('id', ids.slice(i, i + 200));
    for (const c of (cs || [])) campanasInfo[c.id] = c;
  }

  // Conversiones del cliente (con monto atribuido)
  // Dos consultas parametrizadas en vez de un .or() interpolado a mano (la
  // interpolación cruda en el string del .or es inyectable si el dato de
  // origen cambia algún día).
  const [convA, convB] = await Promise.all([
    supabase.from('inapp_conversiones').select('campana_id, cuenta, brazo, convirtio_at, detalle')
      .eq('company_id', companyId).limit(500),
    supabase.from('inapp_conversiones').select('campana_id, cuenta, brazo, convirtio_at, detalle')
      .in('cuenta', cuentas).limit(500),
  ]);
  const vistosConv = new Set<string>();
  const convs = [...(convA.data || []), ...(convB.data || [])].filter((x: any) => {
    const k = `${x.campana_id}|${x.cuenta}`;
    if (vistosConv.has(k)) return false;
    vistosConv.add(k);
    return true;
  });

  // Citas nacidas de campañas (bookings con la utm del canal)
  const { data: citas } = await supabase.from('bookings')
    .select('fecha, hora_inicio, estado, utm_campaign, invitee_nombre, google_meet_link')
    .eq('company_id', companyId).eq('utm_source', 'outbound_inapp')
    .order('fecha', { ascending: false }).limit(50);

  const campanas = ids.map(id => ({
    ...porCampana[id],
    nombre: campanasInfo[id]?.nombre || '(campaña eliminada)',
    formato: campanasInfo[id]?.formato || null,
    estado: campanasInfo[id]?.estado || null,
    meta: campanasInfo[id]?.meta || null,
    convertida: (convs || []).some((x: any) => x.campana_id === id),
    monto: (convs || []).filter((x: any) => x.campana_id === id)
      .reduce((a: number, x: any) => a + (Number(x.detalle?.monto) || 0), 0),
  })).sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));

  nps.sort((a, b) => (a.dia < b.dia ? 1 : -1));

  return json({
    cuentas,
    campanas,
    nps: nps.slice(0, 50),
    citas: (citas || []).map((b: any) => ({ ...b, campana: campanasInfo[b.utm_campaign]?.nombre || null })),
    conversiones: convs || [],
    intereses: co.intereses || null,
  });
};
