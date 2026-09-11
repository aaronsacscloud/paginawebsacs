// TELEFONÍA · Con quién estás a punto de hablar. GET ?telefono=+52…
//
// Existe para los tres segundos que van entre que marcas y que contestan. En
// el escritorio siempre tienes la ficha al lado; en el teléfono la pantalla la
// ocupa la llamada y no hay dónde mirar. Lo que se devuelve es lo mínimo que
// cambia cómo saludas: quién es, en qué etapa va, y cuántas veces le has
// marcado sin encontrarlo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const limpio = String(url.searchParams.get('telefono') || '').replace(/\D/g, '').slice(-10);
  if (limpio.length !== 10) return json({ hay: false });

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id, contact_id, contacts(nombre, apellido, lifecycle_stage, proximo_paso), companies(nombre, nombre_comercial)')
    .like('telefono', `%${limpio}`).limit(1).maybeSingle();
  if (!conv) return json({ hay: false });

  const c: any = (conv as any).contacts, e: any = (conv as any).companies;
  const [{ data: cont }, { data: ultima }] = await Promise.all([
    (conv as any).contact_id
      ? supabase.from('v_llamadas_contacto').select('total, contestadas, intentos_fallidos, buzon, ultima_llamada_at, ultima_contestada_at').eq('contact_id', (conv as any).contact_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
    // La última llamada y CÓMO acabó: «la anterior cayó al buzón» cambia la
    // primera frase más que cualquier otro dato.
    supabase.from('wa_llamadas').select('estado, direccion, duracion_seg, started_at, payload')
      .eq('conversation_id', (conv as any).id).eq('canal', 'telefono')
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const u: any = ultima;
  return json({
    hay: true,
    conversationId: (conv as any).id,
    nombre: c?.nombre ? `${c.nombre} ${c.apellido || ''}`.trim() : null,
    empresa: e ? (e.nombre_comercial || e.nombre) : null,
    etapa: c?.lifecycle_stage || null,
    proximoPaso: c?.proximo_paso || null,
    llamadas: cont || null,
    ultima: u ? {
      cuando: u.started_at,
      buzon: /^machine_/.test(String(u.payload?.answered_by || '')),
      estado: u.estado, duracion: u.duracion_seg, direccion: u.direccion,
    } : null,
  });
};
