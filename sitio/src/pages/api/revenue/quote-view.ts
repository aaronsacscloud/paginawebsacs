import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ─── Meta helpers ───
// We store analytics in the `notas` field using a ---META--- separator
// because we can't add DB columns without psql access.
// Format: "visible notes\n---META---\n{json}"

function parseMeta(notas: string | null): { text: string; meta: Record<string, any> } {
  if (!notas) return { text: '', meta: {} };
  const sep = '\n---META---\n';
  const idx = notas.indexOf(sep);
  if (idx === -1) return { text: notas, meta: {} };
  try {
    return { text: notas.slice(0, idx), meta: JSON.parse(notas.slice(idx + sep.length)) };
  } catch {
    return { text: notas, meta: {} };
  }
}

function serializeMeta(text: string, meta: Record<string, any>): string {
  if (!Object.keys(meta).length) return text;
  return text + '\n---META---\n' + JSON.stringify(meta);
}

// POST — record a view
export const POST: APIRoute = async ({ request }) => {
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { data: quote, error } = await supabase.from('quotes')
    .select('notas, estado, partner_id, numero, empresa, contacto, total, moneda, company_id, contact_id, deal_id')
    .eq('id', id).single();
  if (error || !quote) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { text, meta } = parseMeta(quote.notas);
  const now = new Date().toISOString();

  // Update analytics
  meta.views = (meta.views || 0) + 1;
  if (!meta.first_viewed_at) meta.first_viewed_at = now;
  meta.last_viewed_at = now;

  // Append timeline event
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ event: 'viewed', at: now });

  // ─── Avisos al partner (momento de máximo interés del cliente) ───
  // Primera vista → "tu cliente está viendo la cotización AHORA".
  // 4+ vistas sin aceptar → "cotización caliente" (una sola vez).
  // Solo para quotes enviadas con partner; flags en meta evitan duplicados.
  const notifyFirstView = meta.views === 1 && quote.estado === 'sent' && quote.partner_id && !meta.view_notified_at;
  const notifyHot = meta.views >= 4 && quote.estado === 'sent' && quote.partner_id && !meta.hot_alerted;
  if (notifyFirstView) meta.view_notified_at = now;
  if (notifyHot) meta.hot_alerted = true;

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ notas: serializeMeta(text, meta) })
    .eq('id', id);

  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  // ── Que quede en la actividad del cliente / lead ──
  // Que la cotización se esté viendo es el dato más accionable que hay: es el
  // momento en que el cliente está pensando en comprar. Vivía enterrado en el
  // JSON de `notas` y no aparecía en el timeline de nadie.
  //
  // Con freno de 6 horas: recargar la página no puede llenar el timeline de
  // "vista" repetidas — un timeline con ruido se deja de leer, y entonces se
  // pierde también la señal buena.
  try {
    if (quote.company_id || quote.contact_id) {
      const hace6h = new Date(Date.now() - 6 * 3600000).toISOString();
      let qA = supabase.from('activities').select('id')
        .eq('tipo', 'cotizacion_vista').gte('created_at', hace6h).limit(1);
      qA = quote.company_id ? qA.eq('company_id', quote.company_id) : qA.eq('contact_id', quote.contact_id);
      const { data: reciente } = await qA.maybeSingle();
      if (!reciente) {
        const hora = new Date(now).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        await supabase.from('activities').insert({
          tipo: 'cotizacion_vista', automatico: true,
          company_id: quote.company_id || null, contact_id: quote.contact_id || null,
          deal_id: quote.deal_id || null,
          titulo: (`👀 Vio la cotización ${quote.numero || ''}`).trim() + (meta.views > 1 ? ` (${meta.views}ª vez)` : ''),
          descripcion: (`${hora} · ${quote.empresa || quote.contacto || ''}`).trim(),
          metadata: { audit: 'quote_view', quote_id: id, views: meta.views, at: now },
        }).select().maybeSingle();
      }
    }
  } catch (e) { console.error('[quote-view] actividad:', e); }

  // La campana: la primera vista y la cotización "caliente" son los dos momentos
  // en los que hablarle al cliente cambia el resultado.
  try {
    if (meta.views === 1 || meta.views === 4) {
      const { notificar } = await import('../../../lib/crm/notificaciones');
      await notificar({
        clave: `quote_view:${id}:${meta.views}`,
        tipo: 'cotizacion_vista', nivel: meta.views >= 4 ? 'alerta' : 'info',
        titulo: meta.views >= 4
          ? `🔥 ${quote.empresa || quote.contacto || 'Un cliente'} ya vio la cotización ${meta.views} veces`
          : (`👀 ${quote.empresa || quote.contacto || 'Un cliente'} está viendo tu cotización ${quote.numero || ''}`).trim(),
        detalle: meta.views >= 4
          ? 'La está estudiando y no la ha aceptado: es el momento de llamarle.'
          : 'Acaba de abrirla. Es el minuto de máximo interés.',
        monto: Number(quote.total || 0),
        company_id: quote.company_id || null,
        destino: 'cotizaciones', metadata: { quote_id: id, views: meta.views },
      });
    }
  } catch (e) { console.error('[quote-view] campana:', e); }

  // Envío fire-and-forget: un fallo de email jamás debe romper el tracking de vistas.
  if (notifyFirstView || notifyHot) {
    try {
      const [{ notify }, { getPartnerProfile }] = await Promise.all([
        import('../../../lib/notify'),
        import('../../../lib/partners/profile'),
      ]);
      const partner = await getPartnerProfile(quote.partner_id);
      if (partner && partner.email) {
        const data = {
          numero: quote.numero,
          empresa: quote.empresa,
          contacto: quote.contacto,
          total: quote.total,
          moneda: quote.moneda || 'MXN',
          views: meta.views,
          portalUrl: 'https://www.sacscloud.com/partner/portal',
        };
        if (notifyFirstView) {
          await notify({ channel: 'email', to: partner.email, template: 'quote_viewed_partner', data });
        }
        if (notifyHot) {
          await notify({ channel: 'email', to: partner.email, template: 'quote_hot_partner', data });
        }
      }
    } catch (e) {
      console.error('[quote-view] partner notify error:', e);
    }
  }

  return new Response(JSON.stringify({ views: meta.views }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// GET — retrieve analytics for a quote
export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { data: quote, error } = await supabase.from('quotes').select('notas').eq('id', id).single();
  if (error || !quote) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { meta } = parseMeta(quote.notas);
  return new Response(JSON.stringify({
    views: meta.views || 0,
    first_viewed_at: meta.first_viewed_at || null,
    last_viewed_at: meta.last_viewed_at || null,
    timeline: meta.timeline || [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
