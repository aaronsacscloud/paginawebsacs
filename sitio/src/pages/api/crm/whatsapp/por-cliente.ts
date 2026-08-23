// WHATSAPP · El historial espejo de UN cliente (ficha 360).
//
// GET ?company_id=<uuid> → { conversaciones: [{ ..., mensajes: [...] }] }
//
// Mismo patrón que Outbound/Soporte: la ficha lo pide aparte al abrir su tab.
// Se buscan conversaciones por company_id Y por los teléfonos de sus
// contactos: un mensaje pudo llegar ANTES de que el contacto existiera (espejo
// huérfano) — al encontrarlo por teléfono se ADOPTA, ligándolo al cliente,
// para que la próxima vez ya salga por la llave fuerte.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return json({ error: 'Falta company_id' }, 400);

  const { data: contactos } = await supabase.from('contacts')
    .select('id, nombre, apellido, whatsapp, telefono').eq('company_id', companyId);

  const telefonos = new Set<string>();
  const contactoPorTel: Record<string, any> = {};
  for (const c of contactos || []) {
    for (const bruto of [c.whatsapp, c.telefono]) {
      const e = telefonoWhatsApp(bruto);
      if (e) { telefonos.add(e); contactoPorTel[e] = contactoPorTel[e] || c; }
    }
  }

  // Por la llave fuerte…
  const { data: porCompany } = await supabase.from('wa_conversaciones')
    .select('*').eq('company_id', companyId);
  // …y por teléfono (los espejos huérfanos de antes de conocer al contacto).
  const { data: porTel } = telefonos.size
    ? await supabase.from('wa_conversaciones').select('*').in('telefono', [...telefonos]).is('company_id', null)
    : { data: [] as any[] };

  // Adopción: el huérfano encontrado por teléfono se liga al cliente.
  for (const conv of porTel || []) {
    const c = contactoPorTel[conv.telefono];
    await supabase.from('wa_conversaciones')
      .update({ company_id: companyId, contact_id: c?.id || null }).eq('id', conv.id);
    conv.company_id = companyId; conv.contact_id = c?.id || null;
  }

  const todas = [...(porCompany || []), ...(porTel || [])]
    .sort((a, b) => String(b.ultimo_mensaje_at).localeCompare(String(a.ultimo_mensaje_at)));

  const conversaciones = [];
  for (const conv of todas.slice(0, 20)) {
    const { data: mensajes } = await supabase.from('wa_mensajes')
      .select('id, direccion, tipo, cuerpo, transcript, media_url, media_id, mime, filename, autor, status, error, enviado_at, created_at, metadata, borrado_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true }).limit(200);
    const c = (contactos || []).find(x => x.id === conv.contact_id) || contactoPorTel[conv.telefono] || null;
    conversaciones.push({
      ...conv,
      contacto: c ? `${c.nombre || ''} ${c.apellido || ''}`.trim() || null : null,
      mensajes: mensajes || [],
    });
  }

  return json({ conversaciones });
};
