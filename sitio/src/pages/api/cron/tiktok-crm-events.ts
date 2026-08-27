// GET /api/cron/tiktok-crm-events — le devuelve a TikTok qué pasó con sus leads.
//
// Busca los contactos que vinieron de un formulario de TikTok, mira en qué
// etapa están hoy, y reporta las que todavía no se han reportado. La bitácora
// `tiktok_crm_eventos` es el candado: TikTok cuenta CADA envío como una
// conversión, así que mandar dos veces "este lead compró" le enseña al
// algoritmo que ese lead vale el doble de lo que vale.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { enviarEventoCRM, configurado, ETAPAS_A_TIKTOK } from '../../../lib/crm/tiktok-crm-events';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  const cfg = configurado();
  if (!cfg.listo) return json({ ok: false, msg: 'Sin configurar', falta: cfg.falta });

  const av = { revisados: 0, enviados: 0, yaEstaban: 0, sinLeadId: 0, errores: 0, detalle: [] as any[] };

  // Solo los que TIENEN lead_id: sin él TikTok no puede atarlo al formulario y
  // el evento se descarta del lado de ellos.
  const { data: leads } = await supabase.from('contacts')
    .select('id, email, company_id, lifecycle_stage, updated_at, propiedades')
    .not('propiedades->tiktok->>lead_id', 'is', null)
    .in('lifecycle_stage', Object.keys(ETAPAS_A_TIKTOK))
    .limit(500);

  if (!leads?.length) return json({ ok: true, ...av, msg: 'Nada que reportar.' });

  // Lo ya reportado, de un jalón: una consulta por lead sería una tormenta de
  // peticiones para no mandar nada la mayoría de las veces.
  const leadIds = leads.map((c: any) => String(c.propiedades?.tiktok?.lead_id)).filter(Boolean);
  const { data: yaEnviados } = await supabase.from('tiktok_crm_eventos')
    .select('lead_id, evento').in('lead_id', leadIds).eq('ok', true);
  const hecho = new Set((yaEnviados || []).map((x: any) => `${x.lead_id}|${x.evento}`));

  for (const c of leads as any[]) {
    av.revisados++;
    const leadId = String(c.propiedades?.tiktok?.lead_id || '');
    if (!leadId) { av.sinLeadId++; continue; }

    const evento = ETAPAS_A_TIKTOK[c.lifecycle_stage];
    if (!evento) continue;
    if (hecho.has(`${leadId}|${evento}`)) { av.yaEstaban++; continue; }

    // El monto solo acompaña a la conversión. En las etapas intermedias no hay
    // dinero todavía y mandar un valor inventado le enseña al algoritmo a
    // perseguir leads que "valen" algo que nunca entró.
    let valor: number | null = null;
    if (c.lifecycle_stage === 'cliente') {
      // `arr` es el valor canónico de una suscripción en este CRM (los add-ons y
      // descuentos viven en monto_proximo y NO son ingreso recurrente). Es el
      // número correcto para que TikTok optimice por dinero y no por conteo.
      if (c.company_id) {
        const { data: sus } = await supabase.from('subscriptions')
          .select('arr').eq('company_id', c.company_id)
          .order('arr', { ascending: false }).limit(1).maybeSingle();
        valor = sus?.arr ? Number(sus.arr) : null;
      }
    }

    const r = await enviarEventoCRM({
      leadId,
      evento,
      // La fecha del CAMBIO, no la de hoy: si el lead se volvió cliente hace
      // tres semanas, reportarlo con la fecha de hoy le miente al algoritmo
      // sobre cuánto tarda un lead bueno en madurar.
      cuando: c.updated_at ? new Date(c.updated_at) : new Date(),
      valor,
    });

    await supabase.from('tiktok_crm_eventos').insert({
      contact_id: c.id, lead_id: leadId, evento, etapa: c.lifecycle_stage,
      valor, ok: r.ok, respuesta: r as any,
    }).then(() => {}, () => {});

    if (r.ok) { av.enviados++; }
    else {
      av.errores++;
      av.detalle.push({ email: c.email, evento, error: r.mensaje });
      // Sin permiso sobre el dataset no es un fallo pasajero: es que el token
      // no tiene ese activo. Se corta aquí en vez de repetir 500 veces el
      // mismo error contra la API de TikTok.
      if (r.sinPermiso) {
        return json({ ok: false, ...av,
          msg: 'El token no tiene permiso sobre el dataset de CRM. Asígnale el activo en TikTok Business Center.' });
      }
    }
  }

  return json({ ok: true, ...av });
};
