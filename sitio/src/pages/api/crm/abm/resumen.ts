// El tablero del motor: qué hay, en qué etapa, qué está caliente y qué toca hoy.
// GET /api/crm/abm/resumen
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien } from '../../../../lib/crm/abm.lib';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);

  // Los contadores de canales viven en la cuenta (columnas derivadas con
  // trigger): contar filas de abm_canales aquí daba un número mentiroso,
  // porque Supabase corta la lectura en mil filas y había 2,534.
  const [cuentas, actividad, toques, senales] = await Promise.all([
    supabase.from('abm_cuentas').select('giro, etapa, ruta, puntaje, sucursales, google_rating, tiene_email, tiene_wa, canales_n').limit(5000),
    supabase.from('abm_actividad').select('tipo, ocurrio_at').gte('ocurrio_at', new Date(Date.now() - 30 * 864e5).toISOString()).limit(5000),
    supabase.from('abm_toques').select('id, estado, programado_at, canal').in('estado', ['aprobado', 'programado']).limit(2000),
    supabase.from('abm_senales').select('tipo, fecha').gte('fecha', new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)).limit(5000),
  ]);

  const cs = cuentas.data || [];
  const cuenta = (f: (c: any) => boolean) => cs.filter(f).length;
  const porGiro: Record<string, { n: number; puntaje: number; diagnostico: number }> = {};
  for (const c of cs) {
    const g = (porGiro[c.giro] ||= { n: 0, puntaje: 0, diagnostico: 0 });
    g.n++; g.puntaje += c.puntaje || 0; if (c.ruta === 'diagnostico') g.diagnostico++;
  }
  for (const g of Object.values(porGiro)) g.puntaje = Math.round(g.puntaje / Math.max(1, g.n));

  const porEtapa: Record<string, number> = {};
  for (const c of cs) porEtapa[c.etapa] = (porEtapa[c.etapa] || 0) + 1;


  const act: Record<string, number> = {};
  for (const a of actividad.data || []) act[a.tipo] = (act[a.tipo] || 0) + 1;

  // Cuántas se pueden LLAMAR de verdad: sin correo, con teléfono o WhatsApp y
  // sin llamada previa. Poner "sin correo" en la pestaña decía 433 sobre una
  // cola de 40.
  const { data: sinCorreo } = await supabase.from('abm_cuentas')
    .select('id').eq('tiene_email', false).neq('etapa', 'no_contactar').is('ya_es_cliente', null).limit(2000);
  const idsSin = (sinCorreo || []).map((c: any) => c.id);
  const conTel = new Set<string>();
  for (let i = 0; i < idsSin.length; i += 150) {
    const { data } = await supabase.from('abm_canales').select('cuenta_id')
      .in('cuenta_id', idsSin.slice(i, i + 150)).in('tipo', ['telefono', 'whatsapp_tienda', 'whatsapp_dueno']);
    for (const c of data || []) conTel.add(c.cuenta_id);
  }
  const yaLlamadas = new Set<string>();
  for (let i = 0; i < idsSin.length; i += 150) {
    const { data } = await supabase.from('abm_actividad').select('cuenta_id')
      .in('cuenta_id', idsSin.slice(i, i + 150)).eq('canal', 'llamada');
    for (const a of data || []) yaLlamadas.add(a.cuenta_id);
  }
  const para_llamar = [...conTel].filter(id => !yaLlamadas.has(id)).length;

  const hoy = new Date().toISOString().slice(0, 10);
  const pendientesHoy = (toques.data || []).filter((t: any) => (t.programado_at || '').slice(0, 10) <= hoy).length;

  const seDisparo: Record<string, number> = {};
  for (const s of senales.data || []) seDisparo[s.tipo] = (seDisparo[s.tipo] || 0) + 1;

  return json({
    total: cs.length,
    calientes: cuenta(c => (c.puntaje || 0) >= 60),
    diagnostico: cuenta(c => c.ruta === 'diagnostico'),
    multisucursal: cuenta(c => (c.sucursales || 0) >= 2),
    sin_canal: cuenta(c => !c.canales_n),
    con_email: cuenta(c => c.tiene_email), con_wa: cuenta(c => c.tiene_wa),
    para_llamar,
    porGiro, porEtapa, actividad: act, senales: seDisparo,
    toques_pendientes: (toques.data || []).length, toques_hoy: pendientesHoy,
  });
};
