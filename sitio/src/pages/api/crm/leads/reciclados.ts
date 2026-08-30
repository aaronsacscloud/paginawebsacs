/**
 * GET /api/crm/leads/reciclados?dias=7
 *
 * Quién volvió del rezago. Es el momento más caliente del embudo: alguien que
 * nos ignoró un mes vuelve a levantar la mano.
 *
 * Hasta ahora eso solo dejaba una nota en el hilo del inbox — y esa nota la ve
 * quien YA está dentro de esa conversación. Justo aquí lo que hace falta es que
 * alguien ENTRE. Por eso también sale en el inicio del móvil.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 403);

  const dias = Math.max(1, Math.min(60, Number(url.searchParams.get('dias')) || 7));
  const desde = new Date(Date.now() - dias * 864e5).toISOString();

  const { data } = await supabase.from('contacts')
    .select('id, nombre, apellido, whatsapp, email, reciclado_at, reciclado_veces, ultima_actividad_venta_tipo, eng_emails_leidos')
    .not('reciclado_at', 'is', null)
    .gte('reciclado_at', desde)
    // El que ya compró no necesita que nadie lo persiga.
    .neq('lifecycle_stage', 'cliente')
    .is('archived_at', null)
    .order('reciclado_at', { ascending: false })
    .limit(20);

  return json({
    leads: (data || []).map(c => ({
      id: c.id,
      nombre: [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre',
      whatsapp: c.whatsapp, email: c.email,
      cuando: c.reciclado_at,
      vuelta: c.reciclado_veces || 1,
      senal: c.ultima_actividad_venta_tipo,
      leidos: c.eng_emails_leidos || 0,
    })),
  });
};
