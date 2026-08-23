// WHATSAPP · Masivos (broadcasts de Kapso) con estado POR DESTINATARIO.
//
// GET                → lista; los no-terminales se re-sincronizan con Kapso
//                      (throttle 60 s vía last_synced_at: dos refrescos
//                      seguidos = una sola llamada).
// GET ?id=…[&status=] → detalle con la tabla por destinatario; el filtro por
//                      status es NUESTRO (Kapso no filtra recipients).
// GET ?audiencia=1   → contactos con WhatsApp utilizable, para el wizard.
// POST {nombre, plantilla_id, destinatarios[]} → crea en Kapso + espejo.
// POST {accion:'enviar'|'programar', id, scheduled_at?}
//
// El "a quién le llegó" que pide el reporte viene del polling on-demand: el
// webhook de delivered/read no trae el id del broadcast, así que la fuente de
// verdad por destinatario es GET /broadcasts/{id}/recipients.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import {
  crearBroadcast, agregarDestinatarios, enviarBroadcast, programarBroadcast,
  obtenerBroadcast, listarDestinatarios, resolverTemplateId, sanearParam, KapsoError,
} from '../../../../lib/whatsapp/kapso-api';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const TERMINALES = new Set(['enviado', 'fallido', 'detenido']);
const ESTADO_KAPSO: Record<string, string> = {
  draft: 'borrador', scheduled: 'programado', sending: 'enviando',
  completed: 'enviado', failed: 'fallido', stopped: 'detenido',
};

/** Re-sincroniza counts (y opcionalmente destinatarios) de UN masivo. */
async function sincronizar(b: any, conDestinatarios: boolean) {
  if (!b.kapso_broadcast_id || TERMINALES.has(b.status)) return b;
  if (b.last_synced_at && Date.now() - new Date(b.last_synced_at).getTime() < 60_000) return b;

  try {
    const k = await obtenerBroadcast(b.kapso_broadcast_id);
    const cambios: any = {
      status: ESTADO_KAPSO[k?.status] || b.status,
      total: k?.total_recipients ?? b.total,
      enviados: k?.sent_count ?? b.enviados,
      entregados: k?.delivered_count ?? b.entregados,
      leidos: k?.read_count ?? b.leidos,
      respondidos: k?.responded_count ?? b.respondidos,
      fallidos: k?.failed_count ?? b.fallidos,
      last_synced_at: new Date().toISOString(),
    };
    await supabase.from('wa_broadcasts').update(cambios).eq('id', b.id);
    Object.assign(b, cambios);

    if (conDestinatarios) {
      // Todas las páginas: Kapso no filtra por status, así que se trae todo
      // y el filtro vive en nuestra tabla.
      for (let page = 1; page < 100; page++) {
        const r = await listarDestinatarios(b.kapso_broadcast_id, page, 100);
        const items = Array.isArray(r) ? r : (r?.recipients ?? []);
        if (!items.length) break;
        for (const d of items) {
          const tel = telefonoWhatsApp(d.phone_number) || String(d.phone_number || '');
          if (!tel) continue;
          await supabase.from('wa_broadcast_destinatarios').update({
            status: d.status || 'pending',
            delivered_at: d.delivered_at || null,
            read_at: d.read_at || null,
            responded_at: d.responded_at || null,
            error_message: d.error_message || (d.error_details ? JSON.stringify(d.error_details).slice(0, 300) : null),
          }).eq('broadcast_id', b.id).eq('telefono', tel);
        }
        if (items.length < 100) break;
      }
    }
  } catch (e) {
    console.warn('[wa-broadcasts] sync:', e instanceof KapsoError ? e.message : e);
  }
  return b;
}

export const GET: APIRoute = async ({ url }) => {
  // ── Audiencia para el wizard ──
  if (url.searchParams.get('audiencia') === '1') {
    const { data: contactos } = await supabase.from('contacts')
      .select('id, nombre, apellido, whatsapp, telefono, tipo, company_id, companies(nombre)')
      .is('archived_at', null).limit(3000);
    const audiencia = (contactos || [])
      .map((c: any) => ({
        contact_id: c.id,
        nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || '(sin nombre)',
        empresa: c.companies?.nombre || null,
        company_id: c.company_id,
        tipo: c.tipo,
        telefono: telefonoWhatsApp(c.whatsapp) || telefonoWhatsApp(c.telefono),
      }))
      .filter(c => c.telefono);
    // Sin duplicar teléfono: dos contactos con el mismo número serían dos
    // cobros de Meta por el mismo WhatsApp.
    const vistos = new Set<string>();
    return json({ audiencia: audiencia.filter(c => !vistos.has(c.telefono!) && vistos.add(c.telefono!)) });
  }

  // ── Detalle ──
  const id = url.searchParams.get('id');
  if (id) {
    const { data: b } = await supabase.from('wa_broadcasts').select('*').eq('id', id).maybeSingle();
    if (!b) return json({ error: 'Masivo no encontrado' }, 404);
    await sincronizar(b, true);

    let q = supabase.from('wa_broadcast_destinatarios')
      .select('*, contacts(nombre, apellido), companies(nombre)')
      .eq('broadcast_id', id).order('status').order('telefono');
    const filtro = url.searchParams.get('status');
    if (filtro) q = q.eq('status', filtro);
    const { data: destinatarios } = await q;
    return json({ broadcast: b, destinatarios: destinatarios || [] });
  }

  // ── Lista ──
  const { data: lista } = await supabase.from('wa_broadcasts')
    .select('*').order('created_at', { ascending: false }).limit(100);
  for (const b of lista || []) await sincronizar(b, false);
  return json({ broadcasts: lista || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));

  // ── Enviar / programar ──
  if (b.accion === 'enviar' || b.accion === 'programar') {
    const { data: masivo } = await supabase.from('wa_broadcasts').select('*').eq('id', b.id).maybeSingle();
    if (!masivo?.kapso_broadcast_id) return json({ error: 'Masivo no encontrado' }, 404);
    if (!['borrador', 'programado'].includes(masivo.status)) return json({ error: `Ya está ${masivo.status}` }, 409);
    try {
      if (b.accion === 'programar') {
        if (!b.scheduled_at) return json({ error: 'Falta scheduled_at' }, 400);
        await programarBroadcast(masivo.kapso_broadcast_id, b.scheduled_at);
        await supabase.from('wa_broadcasts').update({ status: 'programado', scheduled_at: b.scheduled_at }).eq('id', masivo.id);
        return json({ ok: true, status: 'programado' });
      }
      await enviarBroadcast(masivo.kapso_broadcast_id);
      await supabase.from('wa_broadcasts').update({
        status: 'enviando', sent_at: new Date().toISOString(), last_synced_at: null,
      }).eq('id', masivo.id);
      return json({ ok: true, status: 'enviando' });
    } catch (e: any) {
      return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
    }
  }

  // ── Crear ──
  const nombre = String(b.nombre || '').trim();
  if (!nombre) return json({ error: 'Falta el nombre del masivo' }, 400);
  const { data: plantilla } = await supabase.from('wa_plantillas')
    .select('*').eq('id', b.plantilla_id || '').maybeSingle();
  if (!plantilla) return json({ error: 'Plantilla no encontrada' }, 404);
  if (plantilla.status !== 'APPROVED') return json({ error: `La plantilla está ${plantilla.status}: solo una APPROVED puede salir en masivo` }, 400);

  const crudos: any[] = Array.isArray(b.destinatarios) ? b.destinatarios : [];
  const vistos = new Set<string>();
  const listos: Array<{ telefono: string; contact_id: string | null; company_id: string | null; params: string[] }> = [];
  const descartados: string[] = [];
  for (const d of crudos) {
    const tel = telefonoWhatsApp(d.telefono);
    if (!tel) { descartados.push(String(d.telefono || '¿?')); continue; }
    if (vistos.has(tel)) continue;
    vistos.add(tel);
    listos.push({
      telefono: tel, contact_id: d.contact_id || null, company_id: d.company_id || null,
      params: (Array.isArray(d.params) ? d.params : []).map(sanearParam),
    });
  }
  if (!listos.length) return json({ error: 'Ningún destinatario con teléfono utilizable', descartados }, 400);

  try {
    const templateId = await resolverTemplateId(plantilla.nombre, plantilla.idioma, plantilla.meta_template_id);
    if (!templateId) return json({ error: 'No pude resolver el id de la plantilla en Kapso' }, 502);

    const creado = await crearBroadcast(nombre, templateId);
    const kapsoId = String(creado?.id || '');
    if (!kapsoId) return json({ error: 'Kapso no devolvió el id del broadcast' }, 502);

    const { data: fila } = await supabase.from('wa_broadcasts').insert({
      kapso_broadcast_id: kapsoId, nombre,
      plantilla_nombre: plantilla.nombre, template_id: templateId,
      status: 'borrador', total: listos.length,
    }).select('id').single();

    await supabase.from('wa_broadcast_destinatarios').insert(listos.map(d => ({
      broadcast_id: fila!.id, telefono: d.telefono,
      contact_id: d.contact_id, company_id: d.company_id,
      params: d.params,
    })));

    await agregarDestinatarios(kapsoId, listos.map(d => ({
      phone_number: d.telefono,
      ...(d.params.length ? {
        template_components: [{ type: 'body', parameters: d.params.map(p => ({ type: 'text', text: p })) }],
      } : {}),
    })));

    return json({ ok: true, id: fila!.id, total: listos.length, descartados });
  } catch (e: any) {
    return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
  }
};
