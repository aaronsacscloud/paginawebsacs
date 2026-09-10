// WHATSAPP · Las líneas (números) por las que vive una conversación. Multilínea.
// GET                → las líneas activas para el selector del composer (+ default)
// GET ?resumen=1     → tablero por línea: enviados hoy, tope, cupo, pausa, entregados/leídos, convs activas
// GET ?reglas=1      → reglas de ruteo (contexto/origen → línea) + catálogo de contextos
// POST { conversation_id? | telefono, phone_number_id }  → muda la conversación a esa línea
//      (si solo hay teléfono, crea la conversación para que el primer mensaje ya salga por ahí).
//      Devuelve ventana_abierta en esa línea, para que el composer avise si tiene que ir plantilla.
// POST { accion:'regla', regla:{ id?, contexto, origen?, phone_number_id, orden?, nota? } } → crea/edita
// POST { accion:'regla_borrar', id }
// POST { accion:'linea', phone_number_id, firma?, agente_nombre?, tope_diario?, pausada?, pausada_motivo?, redirigir_a?, redirigir_texto? }
// GET ?migracion=1   → config de la migración asistida (wa_config.migracion_*) + avance y candidatos de hoy
// POST { accion:'migracion', migracion_activa?, migracion_desde?, migracion_hacia?, migracion_plantilla?, migracion_tope_diario?, migracion_dias_actividad? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { upsertConversacion } from '../../../../lib/whatsapp/espejo';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { lineasActivas, todasLasLineas, lineaDefault, cupoLinea, ventanaEnLinea, olvidarCacheLineas, CONTEXTOS } from '../../../../lib/whatsapp/linea';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  if (p.get('reglas')) {
    const { data } = await supabase.from('wa_reglas_linea').select('*').order('orden').order('created_at');
    return json({ reglas: data || [], contextos: CONTEXTOS, lineas: await todasLasLineas() });
  }
  if (p.get('migracion')) {
    const { data: cfg } = await supabase.from('wa_config').select('migracion_activa, migracion_desde, migracion_hacia, migracion_plantilla, migracion_tope_diario, migracion_dias_actividad').eq('id', 1).maybeSingle();
    const c: any = cfg || {};
    let avance: any = null;
    if (c.migracion_desde) {
      const desde = new Date(Date.now() - (c.migracion_dias_actividad || 180) * 86400e3).toISOString();
      const [{ count: enVieja }, { count: migradas }, { count: enNueva }, { count: candidatos }] = await Promise.all([
        supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true }).eq('phone_number_id', c.migracion_desde),
        supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true }).not('migrada_at', 'is', null),
        c.migracion_hacia ? supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true }).eq('phone_number_id', c.migracion_hacia) : Promise.resolve({ count: 0 } as any),
        supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true }).eq('phone_number_id', c.migracion_desde).is('migrada_at', null).not('contact_id', 'is', null).or('interna.is.null,interna.eq.false').gte('ultimo_mensaje_at', desde),
      ]);
      avance = { en_vieja: enVieja || 0, migradas: migradas || 0, en_nueva: enNueva || 0, candidatos: candidatos || 0 };
    }
    const { data: pl } = c.migracion_plantilla ? await supabase.from('wa_plantillas').select('status').eq('nombre', c.migracion_plantilla).order('status').limit(1).maybeSingle() : { data: null } as any;
    const { data: plantillas } = await supabase.from('wa_plantillas').select('nombre, status, categoria, variables').eq('status', 'APPROVED').order('nombre');
    return json({ migracion: c, avance, plantilla_status: pl?.status || null, plantillas: plantillas || [], lineas: await todasLasLineas() });
  }
  if (p.get('resumen')) {
    const lineas = await todasLasLineas();
    const hoy = new Date(); hoy.setUTCHours(hoy.getUTCHours() - 6); hoy.setUTCHours(6, 0, 0, 0);
    const hace7 = new Date(Date.now() - 7 * 86400e3).toISOString();
    const filas = await Promise.all(lineas.map(async l => {
      const [cupo, { count: convs }, { data: msgs }] = await Promise.all([
        cupoLinea(l.id).catch(() => ({ tope: l.tope_diario, usados: 0, libres: null, pausada: l.pausada })),
        supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true }).eq('phone_number_id', l.id).gte('ultimo_mensaje_at', hace7),
        supabase.from('wa_mensajes').select('status, wa_conversaciones!inner(phone_number_id)').eq('direccion', 'saliente').gte('created_at', hace7).eq('wa_conversaciones.phone_number_id', l.id).limit(2000),
      ]);
      const m = msgs || [];
      const n = m.length;
      const entregados = m.filter((x: any) => ['delivered', 'read'].includes(x.status)).length;
      const leidos = m.filter((x: any) => x.status === 'read').length;
      const fallidos = m.filter((x: any) => x.status === 'failed').length;
      return { ...l, enviados_hoy: cupo.usados, tope: cupo.tope, libres: cupo.libres, convs_activas: convs || 0, semana: { enviados: n, entregados_pct: n ? Math.round(entregados / n * 100) : null, leidos_pct: n ? Math.round(leidos / n * 100) : null, fallidos } };
    }));
    return json({ lineas: filas, default: await lineaDefault() });
  }
  return json({ lineas: await lineasActivas(), default: await lineaDefault() });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));

  if (b.accion === 'regla') {
    const r = b.regla || {};
    const contexto = String(r.contexto || '*').trim() || '*';
    const pn = String(r.phone_number_id || '').trim();
    if (!pn) return json({ error: 'Falta la línea de la regla' }, 400);
    const fila = { contexto, origen: r.origen ? String(r.origen).trim().toLowerCase() : null, phone_number_id: pn, orden: Number.isFinite(+r.orden) ? +r.orden : 100, nota: r.nota ? String(r.nota) : null, activa: r.activa !== false };
    const q = r.id ? supabase.from('wa_reglas_linea').update(fila).eq('id', r.id).select().maybeSingle() : supabase.from('wa_reglas_linea').insert(fila).select().maybeSingle();
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    olvidarCacheLineas();
    return json({ ok: true, regla: data });
  }
  if (b.accion === 'regla_borrar') {
    if (!b.id) return json({ error: 'Falta id' }, 400);
    const { error } = await supabase.from('wa_reglas_linea').delete().eq('id', b.id);
    if (error) return json({ error: error.message }, 500);
    olvidarCacheLineas();
    return json({ ok: true });
  }
  if (b.accion === 'migracion') {
    const cambios: any = { id: 1, updated_at: new Date().toISOString() };
    if ('migracion_activa' in b) cambios.migracion_activa = !!b.migracion_activa;
    for (const k of ['migracion_desde', 'migracion_hacia', 'migracion_plantilla']) if (k in b) cambios[k] = String(b[k] || '').trim() || null;
    if ('migracion_tope_diario' in b) cambios.migracion_tope_diario = Math.min(500, Math.max(1, Math.floor(+b.migracion_tope_diario) || 40));
    if ('migracion_dias_actividad' in b) cambios.migracion_dias_actividad = Math.min(3650, Math.max(1, Math.floor(+b.migracion_dias_actividad) || 180));
    if (cambios.migracion_activa) {
      // Encender exige que todo esté: dos líneas distintas y plantilla aprobada. Si no, se guarda apagada.
      const { data: cfg } = await supabase.from('wa_config').select('migracion_desde, migracion_hacia, migracion_plantilla').eq('id', 1).maybeSingle();
      const f = { ...(cfg || {}), ...cambios } as any;
      if (!f.migracion_desde || !f.migracion_hacia || !f.migracion_plantilla) return json({ error: 'Para encenderla hacen falta línea vieja, línea nueva y plantilla.' }, 400);
      if (f.migracion_desde === f.migracion_hacia) return json({ error: 'La línea vieja y la nueva son la misma.' }, 400);
      const { data: pl } = await supabase.from('wa_plantillas').select('status').eq('nombre', f.migracion_plantilla).eq('status', 'APPROVED').limit(1).maybeSingle();
      if (!pl) return json({ error: `La plantilla ${f.migracion_plantilla} no está aprobada por Meta.` }, 400);
    }
    const { error } = await supabase.from('wa_config').upsert(cambios);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (b.accion === 'linea') {
    const pn = String(b.phone_number_id || '').trim();
    if (!pn) return json({ error: 'Falta phone_number_id' }, 400);
    const cambios: any = {};
    for (const k of ['firma', 'agente_nombre', 'pausada_motivo', 'redirigir_a', 'redirigir_texto']) if (k in b) cambios[k] = b[k] ? String(b[k]).trim() || null : null;
    if ('tope_diario' in b) cambios.tope_diario = b.tope_diario === null || b.tope_diario === '' ? null : Math.max(0, Math.floor(+b.tope_diario) || 0);
    if ('pausada' in b) { cambios.pausada = !!b.pausada; if (!b.pausada) cambios.pausada_motivo = null; }
    if ('retirada' in b) cambios.retirada_at = b.retirada ? new Date().toISOString() : null;
    if (cambios.redirigir_a) cambios.redirigir_a = cambios.redirigir_a.replace(/[^\d]/g, '') || null;
    const { error } = await supabase.from('wa_numeros').update(cambios).eq('phone_number_id', pn);
    if (error) return json({ error: error.message }, 500);
    olvidarCacheLineas();
    return json({ ok: true, cambios });
  }

  // ── Mover la conversación de línea ──
  const linea = String(b.phone_number_id || '').trim();
  if (!linea) return json({ error: 'Falta phone_number_id' }, 400);
  if (!(await lineasActivas()).some(l => l.id === linea)) return json({ error: 'Esa línea no está activa en Kapso' }, 400);
  let id = b.conversation_id ? String(b.conversation_id) : null;
  if (!id) {
    const tel = telefonoWhatsApp(b.telefono);
    if (!tel) return json({ error: 'Falta conversation_id o un teléfono válido' }, 400);
    const conv = await upsertConversacion({ telefono: tel });
    if (!conv) return json({ error: 'No se pudo abrir la conversación' }, 500);
    id = conv.id;
  }
  const { data: conv, error } = await supabase.from('wa_conversaciones').update({ phone_number_id: linea }).eq('id', id).select('id, ventanas, ultimo_entrante_at, phone_number_id').maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const v = ventanaEnLinea(conv, linea);
  return json({ ok: true, conversation_id: id, phone_number_id: linea, ventana_abierta: v.abierta, ventana_expira_at: v.expira_at });
};
