// LEADS · Config de la cadencia de seguimiento (para el módulo).
// GET → {config, pasos} · POST → guarda config y/o pasos completos.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  const [{ data: cfg }, { data: pasos }] = await Promise.all([
    supabase.from('wa_config').select('cadencia_activa, cadencia_corte_dias, cadencia_hora_inicio, cadencia_hora_fin').eq('id', 1).maybeSingle(),
    supabase.from('crm_cadencia_pasos').select('*').order('orden'),
  ]);
  return json({ config: cfg || {}, pasos: pasos || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if ('cadencia_activa' in b || 'cadencia_corte_dias' in b || 'cadencia_hora_inicio' in b || 'cadencia_hora_fin' in b) {
    const cambios: any = { id: 1 };
    if ('cadencia_activa' in b) cambios.cadencia_activa = !!b.cadencia_activa;
    if ('cadencia_corte_dias' in b) cambios.cadencia_corte_dias = Math.max(1, Math.min(60, Number(b.cadencia_corte_dias) || 14));
    if ('cadencia_hora_inicio' in b) cambios.cadencia_hora_inicio = Math.max(0, Math.min(23, Number(b.cadencia_hora_inicio) ?? 10));
    if ('cadencia_hora_fin' in b) cambios.cadencia_hora_fin = Math.max(1, Math.min(24, Number(b.cadencia_hora_fin) ?? 18));
    const { error } = await supabase.from('wa_config').upsert(cambios);
    if (error) return json({ error: error.message }, 500);
  }
  if (Array.isArray(b.pasos)) {
    // Reemplazo completo: es una lista corta y así el módulo puede reordenar,
    // quitar y agregar sin un API por operación.
    const filas = b.pasos
      .filter((p: any) => p.dia && ['correo', 'wa'].includes(p.canal))
      .map((p: any, i: number) => ({
        orden: i + 1, dia: Math.max(1, Number(p.dia) || 1), canal: p.canal,
        email_template_id: p.canal === 'correo' ? (p.email_template_id || null) : null,
        wa_plantilla: p.canal === 'wa' ? (String(p.wa_plantilla || '').trim() || null) : null,
        activo: p.activo !== false,
      }));
    const { error: e1 } = await supabase.from('crm_cadencia_pasos').delete().neq('dia', -1);
    if (e1) return json({ error: e1.message }, 500);
    if (filas.length) {
      const { error: e2 } = await supabase.from('crm_cadencia_pasos').insert(filas);
      if (e2) return json({ error: e2.message }, 500);
    }
  }
  return json({ ok: true });
};
