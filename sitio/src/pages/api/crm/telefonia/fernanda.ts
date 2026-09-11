// FERNANDA AL TELÉFONO · configuración (Configuración → Telefonía).
//
// GET  → { configurada, config, central: {ok, vivas, modelo…}, gasto_hoy_usd, voces[], puede_editar, pruebas[] }
// POST { config: Partial<ConfigVoz> }   (solo el dueño) → { ok, config }
//
// El secreto y la URL de la central viven en variables de entorno; aquí solo
// se edita lo que cambia con el uso: la voz, si revela que es IA, la duración
// del discovery, el tope diario de gasto y el anexo del dueño al guion.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { configVoz, guardarConfigVoz, gastoHoyVoz, saludCentral, vozConfigurada, VOCES, type ConfigVoz } from '../../../../lib/telefonia/voz';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const [config, central, gasto, pruebas] = await Promise.all([
    configVoz(true), vozConfigurada() ? saludCentral() : Promise.resolve({ ok: false, error: 'sin VOZ_SECRET' }), gastoHoyVoz(),
    supabase.from('tel_voz_pruebas').select('id, item, call_sid, resumen, created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  return json({ configurada: vozConfigurada(), config, central, gasto_hoy_usd: gasto, voces: VOCES, pruebas: pruebas.data || [], puede_editar: user.role === 'founder' });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (user.role !== 'founder') return json({ error: 'Solo el dueño puede cambiar a Fernanda' }, 403);
  let b: any = {};
  try { b = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  const c = b.config || {};
  const cambios: Partial<ConfigVoz> = {};
  if (typeof c.encendida === 'boolean') cambios.encendida = c.encendida;
  if (typeof c.revelar_ia === 'boolean') cambios.revelar_ia = c.revelar_ia;
  if (typeof c.voz === 'string' && /^[A-Za-z0-9]{10,40}$/.test(c.voz)) cambios.voz = c.voz;
  if (typeof c.anexo === 'string') cambios.anexo = c.anexo.slice(0, 4000);
  if (c.discovery_min !== undefined) { const n = Number(c.discovery_min); if (![15, 30, 45, 60].includes(n)) return json({ error: 'El discovery dura 15, 30, 45 o 60 minutos' }, 400); cambios.discovery_min = n; }
  if (c.tope_dia_usd !== undefined) { const n = Number(c.tope_dia_usd); if (!Number.isFinite(n) || n < 1 || n > 2000) return json({ error: 'El tope diario va de 1 a 2000 dólares' }, 400); cambios.tope_dia_usd = n; }
  if (c.max_min_llamada !== undefined) { const n = Number(c.max_min_llamada); if (!Number.isFinite(n) || n < 3 || n > 30) return json({ error: 'Una llamada dura entre 3 y 30 minutos como máximo' }, 400); cambios.max_min_llamada = n; }
  if (!Object.keys(cambios).length) return json({ error: 'Nada que guardar' }, 400);
  const config = await guardarConfigVoz(cambios);
  return json({ ok: true, config });
};
