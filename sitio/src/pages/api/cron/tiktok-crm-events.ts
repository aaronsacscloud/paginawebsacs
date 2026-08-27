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
import { enviarEventoCRM, enviarConversionPixel, dentroDeVentana, configurado, ETAPAS_A_TIKTOK, VENTANA_DIAS } from '../../../lib/crm/tiktok-crm-events';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  // La vía de CRM puede no estar lista (falta el dataset o el permiso) y aun
  // así la del píxel sí: son permisos distintos. No se aborta por una sola.
  const cfg = configurado();

  const av = { revisados: 0, enviados: 0, porPixel: 0, yaEstaban: 0, sinLeadId: 0,
               sinFecha: 0, fueraDeVentana: 0, errores: 0, detalle: [] as any[] };
  let viaCrmViva = cfg.listo;

  // TODOS los que vinieron de TikTok y ya avanzaron de etapa. Los que traen
  // lead_id van por CRM (alimenta el embudo); los demás por el píxel, con
  // correo y teléfono hasheados. La mayoría de los leads históricos no tiene
  // lead_id y TikTok ya los borró de su lado —guarda 90 días— así que sin esta
  // segunda vía sus conversiones no se reportarían nunca.
  const { data: leads } = await supabase.from('contacts')
    .select('id, email, whatsapp, company_id, lifecycle_stage, updated_at, propiedades, fuente, utm_source')
    .or('fuente.eq.tiktok-lead-form,utm_source.ilike.%tiktok%')
    .in('lifecycle_stage', Object.keys(ETAPAS_A_TIKTOK))
    .limit(500);

  if (!leads?.length) return json({ ok: true, ...av, msg: 'Nada que reportar.' });

  // Lo ya reportado, de un jalón: una consulta por lead sería una tormenta de
  // peticiones para no mandar nada la mayoría de las veces.
  //
  // La clave tiene que ser LA MISMA que se usa al registrar el envío. Al
  // principio esta lista solo juntaba `lead_id`, así que los reportados por el
  // píxel —que se guardan como `pixel:<contact_id>` porque no tienen lead_id—
  // nunca aparecían como ya enviados y se habrían mandado en CADA corrida.
  // TikTok cuenta cada envío como una conversión: eso le habría enseñado que
  // un solo cliente vale cuatro veces al día.
  const leadIds = leads.map((c: any) => {
    const lid = c.propiedades?.tiktok?.lead_id;
    return lid ? String(lid) : `pixel:${c.id}`;
  });
  const { data: yaEnviados } = await supabase.from('tiktok_crm_eventos')
    .select('lead_id, evento').in('lead_id', leadIds).eq('ok', true);
  const hecho = new Set((yaEnviados || []).map((x: any) => `${x.lead_id}|${x.evento}`));

  for (const c of leads as any[]) {
    av.revisados++;
    const leadId = String(c.propiedades?.tiktok?.lead_id || '');
    const evento = ETAPAS_A_TIKTOK[c.lifecycle_stage];
    if (!evento) continue;

    // La fecha del CAMBIO DE ETAPA, que el trigger `trg_contact_stage_change`
    // deja en `activities`. NO `updated_at`: ese se mueve con cualquier
    // edición del contacto, así que corregirle el teléfono a alguien hoy
    // reportaría su conversión como si hubiera sido hoy. Medido: hay contactos
    // con 73 días de diferencia entre una fecha y la otra — bastante para
    // sacar una conversión real de la ventana, o para meter una vieja.
    const { data: cambio } = await supabase.from('activities')
      .select('created_at')
      .eq('contact_id', c.id).eq('tipo', 'stage_change')
      .eq('metadata->>new_stage', c.lifecycle_stage)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    // Sin registro del cambio no se inventa una fecha: se salta. Un contacto
    // importado ya como cliente no tiene cuándo, y ponerle hoy sería decirle a
    // TikTok que convirtió por un anuncio de esta semana.
    if (!cambio?.created_at) { av.sinFecha++; continue; }
    const cuando = new Date(cambio.created_at);
    const clave = leadId || `pixel:${c.id}`;
    if (hecho.has(`${clave}|${evento}`)) { av.yaEstaban++; continue; }

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

    // La fecha del CAMBIO, no la de hoy: reportar con la fecha de hoy le miente
    // al algoritmo sobre cuánto tarda en madurar un lead bueno.
    let r;
    let via = 'crm';
    if (leadId && viaCrmViva) {
      r = await enviarEventoCRM({ leadId, evento, cuando, valor });
    } else {
      av.sinLeadId += leadId ? 0 : 1;
      via = 'pixel';
      // Solo la conversión se manda por el píxel: las etapas intermedias no
      // tienen equivalente ahí y `CompletePayment` de alguien que aún no paga
      // sería falso.
      if (c.lifecycle_stage !== 'cliente') continue;
      if (!dentroDeVentana(cuando)) { av.fueraDeVentana++; continue; }
      r = await enviarConversionPixel({
        email: c.email, telefono: c.whatsapp, cuando, valor,
        eventId: `crm_${c.id}_${evento}`,
      });
    }

    await supabase.from('tiktok_crm_eventos').insert({
      contact_id: c.id, lead_id: clave, evento, etapa: c.lifecycle_stage,
      valor, ok: r.ok, respuesta: { ...r, via } as any,
    }).then(() => {}, () => {});

    if (r.ok) { av.enviados++; if (via === 'pixel') av.porPixel++; }
    else {
      av.errores++;
      av.detalle.push({ email: c.email, evento, error: r.mensaje });
      // Sin permiso sobre el dataset no es un fallo pasajero: es que el token
      // no tiene ese activo. Se corta aquí en vez de repetir 500 veces el
      // mismo error contra la API de TikTok.
      // Sin permiso sobre el dataset no es transitorio: es que el token no tiene
      // ese activo. Se apaga la vía de CRM y se sigue por el píxel, que usa otro
      // permiso — abortar todo dejaría sin reportar también lo que SÍ se puede.
      if (r.sinPermiso) {
        viaCrmViva = false;
        av.detalle.push({ aviso: 'La vía de CRM está sin permiso; se continúa solo por el píxel.' });
      }
    }
  }

  return json({ ok: true, ...av });
};
