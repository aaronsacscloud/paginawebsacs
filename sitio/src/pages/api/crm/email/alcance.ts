// GET /api/crm/email/alcance — a cuánta gente puedes llegar de verdad.
//
// La pregunta que nadie hace hasta que duele: de toda la base, ¿a cuántos se
// les puede escribir? El pipeline ya calculaba las exclusiones en cada envío y
// las tiraba; ahora quedan registradas y esto las suma.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { MOTIVO_TEXTO } from '../../../../lib/email/motivos';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const dias = Math.min(365, Math.max(7, Number(url.searchParams.get('dias')) || 90));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const { count: total } = await supabase.from('contacts')
    .select('id', { count: 'exact', head: true }).is('archived_at', null).not('email', 'is', null);
  const { count: suprimidos } = await supabase.from('email_suppressions')
    .select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).is('restaurado_at', null);

  // Por qué quedó fuera la gente en los envíos recientes.
  const { data: noAlc } = await supabase.from('email_no_alcanzados')
    .select('motivo, email').eq('tenant_id', t.id).gte('created_at', desde).limit(20000);
  const porMotivo: Record<string, { veces: number; personas: Set<string> }> = {};
  for (const r of noAlc || []) {
    const m = r.motivo || 'otro';
    if (!porMotivo[m]) porMotivo[m] = { veces: 0, personas: new Set() };
    porMotivo[m].veces++;
    porMotivo[m].personas.add(String(r.email || '').toLowerCase());
  }

  const motivos = Object.entries(porMotivo)
    .map(([id, v]) => ({ id, texto: MOTIVO_TEXTO[id] || id, veces: v.veces, personas: v.personas.size }))
    .sort((a, b) => b.personas - a.personas);

  // Sin correo no hay a quién escribirle, y eso también es alcance perdido.
  const { count: sinCorreo } = await supabase.from('contacts')
    .select('id', { count: 'exact', head: true }).is('archived_at', null).is('email', null);

  const alcanzables = Math.max(0, (total || 0) - (suprimidos || 0));
  return json({
    periodo_dias: dias,
    total_con_correo: total || 0,
    sin_correo: sinCorreo || 0,
    suprimidos: suprimidos || 0,
    alcanzables,
    pct_alcanzable: total ? Math.round((alcanzables / total) * 1000) / 10 : 0,
    motivos,
    // Lo accionable: la presión y el cap por empresa NO son pérdida definitiva
    // —esa gente sí se puede alcanzar, solo que otro día—, a diferencia de una
    // baja o un rebote. Distinguirlo evita conclusiones equivocadas.
    recuperables: motivos.filter(m => ['presion', 'presion_empresa', 'limite_diario'].includes(m.id)).reduce((s, m) => s + m.personas, 0),
    perdidos: motivos.filter(m => ['suprimido', 'email_invalido', 'role_account'].includes(m.id)).reduce((s, m) => s + m.personas, 0),
  });
};
