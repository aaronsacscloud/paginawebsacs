// /api/crm/email/suprimidos — quién no recibe, por qué, y cómo restaurarlo.
//
// Restaurar borra en LOS DOS lados: la tabla del CRM y la lista de supresión
// de SendGrid. Si solo se borrara aquí, SendGrid seguiría descartando el
// correo en silencio (evento `dropped`) y nadie entendería por qué esa
// persona nunca recibe nada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { reactivar } from '../../../../lib/email/bajas';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const ETIQUETA: Record<string, string> = {
  baja: 'Se dio de baja', queja: 'Marcó como spam', rebote_duro: 'El correo no existe',
  rebote_suave: 'Rebotó varias veces', dropped: 'SendGrid lo descartó',
  manual: 'Suprimido a mano', pausa: 'En pausa temporal', sunset: 'Sin actividad (higiene)',
};
/** Restaurar a quien marcó spam daña la reputación: se avisa, no se impide. */
const RIESGOSO = new Set(['queja', 'rebote_duro']);

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const { data } = await supabase.from('email_suppressions')
    .select('*, contacts(nombre, apellido)').eq('tenant_id', t.id).is('restaurado_at', null)
    .order('created_at', { ascending: false }).limit(1000);
  return json({
    suprimidos: (data || []).map((s: any) => ({
      ...s,
      etiqueta: ETIQUETA[s.motivo] || s.motivo,
      riesgoso_restaurar: RIESGOSO.has(s.motivo),
      nombre: s.contacts ? [s.contacts.nombre, s.contacts.apellido].filter(Boolean).join(' ') : null,
    })),
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return json({ error: 'Falta el correo.' }, 400);

  if (body.accion === 'restaurar') {
    await reactivar(t.id, email);
    // Y en SendGrid: sin esto seguiría descartándolo sin avisar.
    const key = (import.meta.env.SENDGRID_API_KEY || '').trim();
    const borrados: string[] = [];
    if (key) {
      for (const lista of ['bounces', 'blocks', 'spam_reports', 'invalid_emails']) {
        const r = await fetch(`https://api.sendgrid.com/v3/suppression/${lista}/${encodeURIComponent(email)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${key}` },
        }).catch(() => null);
        if (r && (r.status === 204 || r.ok)) borrados.push(lista);
      }
      if (t.sendgrid_asm_group_id) {
        await fetch(`https://api.sendgrid.com/v3/asm/groups/${t.sendgrid_asm_group_id}/suppressions/${encodeURIComponent(email)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${key}` },
        }).catch(() => null);
      }
    }
    return json({ ok: true, sendgrid_limpiado: borrados });
  }

  // Suprimir a mano desde el panel.
  const { data: c } = await supabase.from('contacts').select('id').eq('email', email).limit(1).maybeSingle();
  await supabase.from('email_suppressions').insert({
    tenant_id: t.id, email, contact_id: c?.id || null,
    motivo: 'manual', origen: 'panel', detalle: body.detalle || null,
  });
  return json({ ok: true });
};
