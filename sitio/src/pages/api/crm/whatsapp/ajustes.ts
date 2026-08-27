// WHATSAPP · Ajustes de automatización (wa_config): bienvenida, fuera de
// horario y round-robin. GET → config · POST → guarda (whitelist).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async () => {
  const { data } = await supabase.from('wa_config')
    .select('bienvenida_activa, bienvenida_texto, fuera_activa, fuera_texto, horario, asignacion_rr, catalog_id, ubicaciones')
    .eq('id', 1).maybeSingle();
  return json({ ajustes: data || {} });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const cambios: any = { id: 1, updated_at: new Date().toISOString() };
  if ('bienvenida_activa' in b) cambios.bienvenida_activa = !!b.bienvenida_activa;
  if ('catalog_id' in b) cambios.catalog_id = String(b.catalog_id || '').trim() || null;
  if ('ubicaciones' in b) cambios.ubicaciones = Array.isArray(b.ubicaciones) ? b.ubicaciones.slice(0, 20) : [];
  if ('bienvenida_texto' in b) cambios.bienvenida_texto = String(b.bienvenida_texto || '').slice(0, 1000) || null;
  if ('fuera_activa' in b) cambios.fuera_activa = !!b.fuera_activa;
  if ('fuera_texto' in b) cambios.fuera_texto = String(b.fuera_texto || '').slice(0, 1000) || null;
  if ('horario' in b) {
    const h = b.horario || {};
    cambios.horario = (h.desde && h.hasta) ? {
      dias: Array.isArray(h.dias) ? h.dias.map(Number).filter((n: number) => n >= 1 && n <= 7) : [],
      desde: String(h.desde).slice(0, 5), hasta: String(h.hasta).slice(0, 5),
    } : null;
  }
  if ('asignacion_rr' in b) cambios.asignacion_rr = !!b.asignacion_rr;
  if ('bienvenida_tiktok_activa' in b) cambios.bienvenida_tiktok_activa = !!b.bienvenida_tiktok_activa;
  if ('bienvenida_tiktok_plantilla' in b) cambios.bienvenida_tiktok_plantilla = String(b.bienvenida_tiktok_plantilla || '').trim() || null;
  const { error } = await supabase.from('wa_config').upsert(cambios);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
