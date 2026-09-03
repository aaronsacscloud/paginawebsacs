// ══ Onboarding: la lista y el interruptor ══════════════════════════════════
// GET  → config (interruptor + reglas) + casos vivos con su empresa
// POST { accion: 'encender' | 'apagar' }  → el interruptor maestro.
//      { accion: 'consultor', caso_id, consultor_id } → reasignar.
//      { accion: 'abrir', company_id } → meter a alguien A MANO (la única
//        puerta para clientes de antes del encendido).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { configOnboarding } from '../../../../lib/crm/onboarding.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const cfg = await configOnboarding();
  const { data: casos } = await supabase.from('onboarding_casos')
    .select('*, companies(id, nombre, nombre_comercial, sacs_account, uso_sync_at), team_members:consultor_id(id, nombre)')
    .order('created_at', { ascending: false }).limit(300);
  const { data: equipo } = await supabase.from('team_members').select('id, nombre').eq('activo', true).order('nombre');
  return json({ config: cfg, casos: casos || [], equipo: equipo || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const quien = (user as any).nombre || (user as any).email || 'CRM';

  if (b.accion === 'encender' || b.accion === 'apagar') {
    const activo = b.accion === 'encender';
    /* `activado_at` SOLO se escribe al encender por primera vez: es la línea
       que separa a los clientes nuevos de los de antes. Si se re-escribiera
       en cada encendido, apagar y prender movería la línea y clientes de la
       semana pasada se volverían «viejos». */
    const cfg = await configOnboarding();
    const upd: any = { activo, updated_at: new Date().toISOString() };
    if (activo && !cfg.activado_at) upd.activado_at = new Date().toISOString();
    const { error } = await supabase.from('onboarding_config').update(upd).eq('id', 'main');
    if (error) return json({ error: error.message }, 500);
    await supabase.from('activities').insert({
      tipo: 'sistema', automatico: false,
      titulo: `Onboarding ${activo ? 'ENCENDIDO' : 'apagado'} por ${quien}`,
      metadata: { onboarding: true },
    });
    return json({ ok: true, activo });
  }

  if (b.accion === 'consultor') {
    const { error } = await supabase.from('onboarding_casos')
      .update({ consultor_id: b.consultor_id || null, updated_at: new Date().toISOString() })
      .eq('id', b.caso_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (b.accion === 'abrir') {
    /* A mano NO se filtra por «cliente nuevo»: es justo la puerta para meter
       a un cliente viejo que el consultor quiera acompañar. Sí exige cuenta
       ligada y respeta el caso único abierto. */
    const companyId = String(b.company_id || '');
    const { data: liga } = await supabase.from('company_sacs_accounts').select('cuenta').eq('company_id', companyId).limit(1);
    /* El consultor NO sale de `companies.owner_id`: esa columna NUNCA existió.
       PostgREST contestaba 400, el select entero moría y `co` quedaba en null, así
       que las DOS puertas del onboarding —la automática y el botón «Abrir»—
       contestaban «no existe la empresa» sobre empresas que sí existen. Medido el
       3-sep-2026: 0 casos de onboarding en 345 empresas. El módulo nunca pudo
       abrir uno. El dueño de la cuenta vive en `contacts.owner_id`. */
    const { data: co, error: eCo } = await supabase.from('companies')
      .select('id, nombre, sacs_account, uso_sacs, contacts(owner_id)').eq('id', companyId).maybeSingle();
    if (eCo) console.error('[onboarding] empresa:', eCo.message);
    const consultorDeLaCuenta = ((co as any)?.contacts || []).map((c: any) => c.owner_id).find(Boolean) || null;
    if (!co) return json({ error: 'No existe esa empresa' }, 404);
    if (!liga?.[0]?.cuenta && !co.sacs_account) return json({ error: 'Primero liga su cuenta de SACS: sin cuenta no hay qué medir.' }, 400);
    const { error } = await supabase.from('onboarding_casos').insert({
      company_id: companyId, consultor_id: consultorDeLaCuenta, uso_al_abrir: co.uso_sacs || null,
    });
    if (error) return json({ error: /duplicate|unique/i.test(error.message) ? 'Ya tiene un caso abierto.' : error.message }, 409);
    await supabase.from('activities').insert({
      company_id: companyId, tipo: 'sistema', automatico: false,
      titulo: `Onboarding abierto a mano por ${quien}`, metadata: { onboarding: true },
    });
    return json({ ok: true });
  }

  return json({ error: 'Acción desconocida' }, 400);
};
