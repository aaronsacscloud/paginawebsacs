// El motor de cadencias: analizar → generar con IA → aprobar a mano → programar.
//
// El orden importa y no se salta: NADA sale sin que una persona lo apruebe.
//
// GET  /api/crm/abm/cadencias                  → cadencias y plantillas por giro
// GET  /api/crm/abm/cadencias?cuenta_id=       → el análisis de esa cuenta y su cadencia sugerida
// POST /api/crm/abm/cadencias { accion, … }
//   generar   { cuenta_id }            → la IA redacta los 7 correos con los datos REALES de la cuenta
//   aprobar   { toque_id }             → lo pone en la fila de envío
//   editar    { toque_id, asunto?, cuerpo? }
//   cancelar  { toque_id }
//   aprobar_todo { cuenta_id }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar, apuntar } from '../../../../lib/crm/abm.lib';
import { generarCadencia } from '../../../../lib/crm/abm-generar';

export const prerender = false;

// El expediente, las REGLAS y la redacción viven en lib/crm/abm-generar.ts:
// los usa también el goteo (envíos progresivos) desde el cron, sin sesión.

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);

  const cuenta_id = url.searchParams.get('cuenta_id');
  if (cuenta_id) {
    if (!esUuid(cuenta_id)) return json({ error: 'id inválido' }, 400);
    const { data: c } = await supabase.from('abm_cuentas').select('*').eq('id', cuenta_id).maybeSingle();
    if (!c) return json({ error: 'no existe' }, 404);
    const [{ data: canales }, { data: personas }, { data: toques }] = await Promise.all([
      supabase.from('abm_canales').select('*').eq('cuenta_id', cuenta_id),
      supabase.from('abm_personas').select('*').eq('cuenta_id', cuenta_id),
      supabase.from('abm_toques').select('*').eq('cuenta_id', cuenta_id).order('programado_at'),
    ]);
    const { data: cad } = await supabase.from('abm_cadencias')
      .select('id, nombre, giro, ruta').eq('giro', c.giro).eq('ruta', c.ruta || 'demo').eq('activa', true).maybeSingle();
    return json({ cuenta: c, canales: canales || [], personas: personas || [], toques: toques || [], cadencia: cad || null });
  }

  const [{ data: cadencias }, { data: plantillas }] = await Promise.all([
    supabase.from('abm_cadencias').select('*').order('giro'),
    supabase.from('abm_plantillas').select('id, giro, canal, nombre, orden, asunto, objetivo').order('giro').order('orden'),
  ]);
  return json({ cadencias: cadencias || [], plantillas: plantillas || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  const accion = String(b?.accion || '');

  if (accion === 'generar') {
    if (!esUuid(b.cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
    const r = await generarCadencia(b.cuenta_id, { autor: yo.nombre, con_ia: b.con_ia !== false });
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ ok: true, correos: r.correos, con_ia: r.con_ia, ia_error: r.ia_error });
  }

  if (accion === 'aprobar' || accion === 'cancelar' || accion === 'editar') {
    if (!esUuid(b.toque_id)) return json({ error: 'toque inválido' }, 400);
    const patch: any = {};
    if (accion === 'aprobar') { patch.estado = 'aprobado'; patch.aprobado_por = yo.id; patch.aprobado_at = new Date().toISOString(); }
    if (accion === 'cancelar') patch.estado = 'cancelado';
    if (accion === 'editar') {
      if (b.asunto !== undefined) patch.asunto = limpiar(b.asunto, 200);
      if (b.cuerpo !== undefined) patch.cuerpo = limpiar(b.cuerpo, 6000);
      patch.estado = 'borrador';                            // editar un correo lo regresa a revisión
    }
    const { error } = await supabase.from('abm_toques').update(patch).eq('id', b.toque_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'aprobar_todo') {
    if (!esUuid(b.cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
    const { error } = await supabase.from('abm_toques')
      .update({ estado: 'aprobado', aprobado_por: yo.id, aprobado_at: new Date().toISOString() })
      .eq('cuenta_id', b.cuenta_id).eq('estado', 'borrador');
    if (error) return json({ error: error.message }, 500);
    await supabase.from('abm_cuentas').update({ etapa: 'en_cadencia', updated_at: new Date().toISOString() }).eq('id', b.cuenta_id).eq('etapa', 'sin_tocar');
    await apuntar(b.cuenta_id, 'sistema', 'nota', { texto: `${yo.nombre} aprobó la cadencia completa` });
    return json({ ok: true });
  }

  return json({ error: 'acción desconocida' }, 400);
};
