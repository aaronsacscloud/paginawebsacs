// LLAMADAS INTELIGENTES · La API de la cabina (con sesión del CRM).
//
// GET  ?id=<sesión>            → estado vivo (y el latido: cierra huecos de tiempo)
// GET  ?id=<sesión>&items=1    → la lista completa con su estado
// GET  ?lista=1                → mis sesiones recientes
// POST { accion, ... }         → crear · iniciar · pausar · reanudar · siguiente ·
//                                saltar · colgar · tomar · resultado · nota ·
//                                excluir · incluir · terminar · relanzar · presentacion
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { twilioRest, telefoniaConfigurada, telefoniaFaltantes } from '../../../../lib/telefonia/twilio';
import {
  crearSesion, iniciarSesion, pausarSesion, terminarSesion, siguiente, saltar, tomar, latir, estadoSesion, listarItems, relanzar, recontar, getSesion,
} from '../../../../lib/telefonia/marcador';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const UUID = /^[0-9a-f-]{36}$/i;
const identidadDe = (userId: string) => `crm-${String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

/** La sesión es de quien la creó (o de un fundador). */
async function mia(id: string, user: any) {
  if (!UUID.test(id)) return null;
  const s = await getSesion(id);
  if (!s) return null;
  if (s.owner_id && s.owner_id !== user.id && !['founder', 'cs'].includes(String(user.role))) return null;
  return s;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  if (url.searchParams.get('lista')) {
    const { data } = await supabase.from('tel_sesiones')
      .select('id, nombre, estado, total, contestadas, buzon, sin_contestar, porteros, invalidos, segundos_hablados, iniciada_at, terminada_at, created_at, origen, presentacion_nombre, presentacion_motivo')
      .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(30);
    return json({ sesiones: data || [], telefonia: telefoniaConfigurada(), faltantes: telefoniaFaltantes(), identity: identidadDe(user.id) });
  }

  const id = String(url.searchParams.get('id') || '');
  const s = await mia(id, user);
  if (!s) return json({ error: 'No existe la sesión' }, 404);
  if (url.searchParams.get('items')) return json({ items: await listarItems(id) });
  const est = await latir(id);
  return json({ ...est, identity: identidadDe(user.id) });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b.accion || '');

  try {
    if (accion === 'crear') {
      if (!Array.isArray(b.items) || !b.items.length) return json({ error: 'La lista está vacía' }, 400);
      if (b.items.length > 500) return json({ error: 'Máximo 500 contactos por sesión' }, 400);
      const r = await crearSesion(user.id, {
        nombre: String(b.nombre || '').slice(0, 120) || undefined, origen: b.origen || {}, items: b.items,
        presentacion_nombre: String(b.presentacion_nombre || '').slice(0, 80), presentacion_motivo: String(b.presentacion_motivo || '').slice(0, 240),
        buzon_dejar_mensaje: !!b.buzon_dejar_mensaje, config: b.config || {},
      });
      return json({ ok: true, ...r });
    }

    const s = await mia(String(b.id || ''), user);
    if (!s) return json({ error: 'No existe la sesión' }, 404);

    switch (accion) {
      case 'presentacion': {
        await supabase.from('tel_sesiones').update({
          presentacion_nombre: String(b.presentacion_nombre ?? s.presentacion_nombre ?? '').slice(0, 80) || null,
          presentacion_motivo: String(b.presentacion_motivo ?? s.presentacion_motivo ?? '').slice(0, 240) || null,
          buzon_dejar_mensaje: b.buzon_dejar_mensaje ?? s.buzon_dejar_mensaje,
          nombre: String(b.nombre ?? s.nombre).slice(0, 120),
          config: { ...(s.config || {}), ...(b.config || {}) }, updated_at: new Date().toISOString(),
        }).eq('id', s.id);
        return json({ ok: true });
      }
      case 'iniciar':
      case 'reanudar': {
        if (!telefoniaConfigurada()) return json({ error: 'Telefonía sin configurar', faltantes: telefoniaFaltantes() }, 503);
        const ok = await iniciarSesion(s.id, identidadDe(user.id));
        return ok ? json({ ok: true, identity: identidadDe(user.id) }) : json({ error: `La sesión está ${s.estado}` }, 409);
      }
      case 'pausar': await pausarSesion(s.id, 'Pausada por ti'); return json({ ok: true });
      case 'terminar': await terminarSesion(s.id); return json({ ok: true });
      case 'siguiente': return json(await siguiente(s.id));
      case 'saltar': return json(await saltar(s.id));
      case 'tomar': return json({ ok: await tomar(s.id) });
      case 'colgar': {
        // Cuelga la pata del contacto (la del vendedor sigue en la sala).
        const it = s.item_actual ? (await supabase.from('tel_sesion_items').select('id, call_sid, estado').eq('id', s.item_actual).maybeSingle()).data : null;
        if (it?.call_sid && !['hecho', 'cierre'].includes(it.estado)) {
          if (b.resultado) await supabase.from('tel_sesion_items').update({ resultado: String(b.resultado).slice(0, 30) }).eq('id', it.id);
          try { await twilioRest(`/Calls/${it.call_sid}.json`, { Status: 'completed' }); } catch { /* ya colgó */ }
        }
        return json({ ok: true });
      }
      case 'resultado':
      case 'nota': {
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const cambio: any = { updated_at: new Date().toISOString() };
        if (b.resultado !== undefined) cambio.resultado = String(b.resultado || '').slice(0, 30) || null;
        if (b.nota !== undefined) cambio.nota = String(b.nota || '').slice(0, 2000) || null;
        const { data: it } = await supabase.from('tel_sesion_items').update(cambio).eq('id', itemId).eq('sesion_id', s.id).select('id, call_sid, conversation_id, contact_id').maybeSingle();
        if (it?.call_sid) {
          const w: any = {};
          if (cambio.resultado !== undefined) w.resultado = cambio.resultado;
          if (Object.keys(w).length) await supabase.from('wa_llamadas').update(w).eq('call_id', it.call_sid);
        }
        // «No me llames» se respeta para siempre, no solo en esta lista.
        if (cambio.resultado === 'no_interesa' && b.no_llamar && it?.contact_id) await supabase.from('contacts').update({ no_llamar: true }).eq('id', it.contact_id);
        if (cambio.nota && it?.conversation_id) {
          await supabase.from('wa_notas').insert({
            conversation_id: it.conversation_id, contact_id: it.contact_id || null, autor: (user as any)?.nombre || 'Equipo',
            texto: `📝 **Apunte de la sesión de llamadas**\n\n${cambio.nota}`,
            metadata: { tipo: 'nota_llamada', nota_llamada: it.call_sid || null, sesion_item: itemId, autor_id: user.id },
          }).then(() => {}, () => {});
        }
        await recontar(s.id);
        return json({ ok: true });
      }
      case 'excluir':
      case 'incluir': {
        const itemId = String(b.item || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const ex = accion === 'excluir';
        await supabase.from('tel_sesion_items').update({ estado: ex ? 'excluido' : 'pendiente', motivo_exclusion: ex ? 'lo quitaste tú' : null, updated_at: new Date().toISOString() })
          .eq('id', itemId).eq('sesion_id', s.id).in('estado', ex ? ['pendiente'] : ['excluido']);
        await recontar(s.id);
        return json({ ok: true });
      }
      case 'relanzar': {
        const r = await relanzar(s.id, user.id, Array.isArray(b.cuales) ? b.cuales : undefined);
        return json({ ok: true, ...r });
      }
      case 'estado': return json(await estadoSesion(s.id));
      default: return json({ error: 'Acción desconocida' }, 400);
    }
  } catch (e: any) {
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
};
