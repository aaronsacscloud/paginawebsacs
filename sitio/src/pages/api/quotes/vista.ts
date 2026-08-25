// Registrar que el cliente ABRIÓ una cotización. Lo llama la propia página
// pública (SIN sesión: por eso vive fuera de /api/crm, que es admin); el `sv` firmado —si el link venía
// de un correo o WhatsApp nuestro— es lo que dice QUIÉN la abrió.
//
// No cuenta las aperturas del equipo: el vendedor abre su propia propuesta
// diez veces y eso ensuciaría justo la señal que se quiere medir.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { verificarSv } from '../../../lib/tracking/identidad';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const quoteId = String(b.quote_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return json({ ok: false }, 400);

  // Si quien mira tiene sesión del CRM, es del equipo: no se cuenta.
  const user = await getCurrentUser(request).catch(() => null);
  if (user) return json({ ok: true, ignorada: 'equipo' });

  const contactId = verificarSv(b.sv);
  const segundos = Number.isFinite(Number(b.segundos)) ? Math.min(3600, Math.max(0, Number(b.segundos))) : null;

  // Una apertura por visitante cada 30 min: recargar la página no infla el conteo.
  const desde = new Date(Date.now() - 30 * 60000).toISOString();
  const { data: reciente } = await supabase.from('quote_vistas')
    .select('id').eq('quote_id', quoteId)
    .or(`visitor_id.eq.${b.visitor_id || 'x'},contact_id.eq.${contactId || '00000000-0000-0000-0000-000000000000'}`)
    .gte('created_at', desde).limit(1).maybeSingle();

  if (reciente && segundos) {
    await supabase.from('quote_vistas').update({ segundos }).eq('id', reciente.id);
    return json({ ok: true, actualizada: true });
  }
  if (reciente) return json({ ok: true, repetida: true });

  await supabase.from('quote_vistas').insert({
    quote_id: quoteId, contact_id: contactId,
    visitor_id: b.visitor_id ? String(b.visitor_id).slice(0, 80) : null,
    segundos, user_agent: (request.headers.get('user-agent') || '').slice(0, 200),
  });

  const { data: q } = await supabase.from('quotes').select('vistas, primera_vista_at').eq('id', quoteId).maybeSingle();
  const ahora = new Date().toISOString();
  await supabase.from('quotes').update({
    vistas: (q?.vistas || 0) + 1,
    primera_vista_at: q?.primera_vista_at || ahora,
    ultima_vista_at: ahora,
  }).eq('id', quoteId);

  // La primera apertura vale como actividad en la ficha: es el momento en que
  // el cliente pasó de "le mandé la propuesta" a "la está considerando".
  if (!q?.primera_vista_at && contactId) {
    await supabase.from('activities').insert({
      contact_id: contactId, tipo: 'quote_viewed',
      titulo: 'Abrió la cotización', quote_id: quoteId, automatico: true,
    }).then(() => {}, () => {});
  }
  return json({ ok: true, primera: !q?.primera_vista_at });
};
