// La bitácora de una cuenta, por el lado de lo que hacemos NOSOTROS.
//
// Correo, apertura y clic los apunta el cartero solo. Esto es para lo que no
// tiene API: la llamada, el WhatsApp que se manda a mano, el mensaje directo
// de Instagram o Facebook, la invitación de LinkedIn y la junta. Si el CRM no
// los guarda, el vendedor cree que tocó una cuenta que nunca tocó.
//
// GET  /api/crm/abm/actividad?cuenta_id=      → la línea de tiempo
// POST /api/crm/abm/actividad { cuenta_id, canal, tipo, texto?, transcripcion?, resultado? }
//   canal: llamada | whatsapp | dm_ig | dm_fb | linkedin | reunion | email
//   tipo:  llamada | whatsapp | dm | respuesta | reunion | nota
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar, apuntar } from '../../../../lib/crm/abm.lib';

export const prerender = false;

const CANALES = new Set(['llamada', 'whatsapp', 'dm_ig', 'dm_fb', 'linkedin', 'reunion', 'email', 'sistema']);
const TIPOS = new Set(['llamada', 'whatsapp', 'dm', 'respuesta', 'reunion', 'nota']);

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const cuenta_id = url.searchParams.get('cuenta_id');
  if (!esUuid(cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
  const { data } = await supabase.from('abm_actividad')
    .select('id, canal, tipo, texto, transcripcion, detalle, ocurrio_at')
    .eq('cuenta_id', cuenta_id).order('ocurrio_at', { ascending: false }).limit(200);
  return json({ actividad: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  if (!esUuid(b?.cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
  const canal = String(b.canal || '');
  const tipo = String(b.tipo || '');
  if (!CANALES.has(canal) || !TIPOS.has(tipo)) return json({ error: 'canal o tipo inválido' }, 400);

  const texto = limpiar(b.texto, 4000);
  await apuntar(b.cuenta_id, canal, tipo, {
    persona_id: esUuid(b.persona_id) ? b.persona_id : null,
    texto: texto ? `${yo.nombre}: ${texto}` : `${yo.nombre} registró ${tipo} por ${canal}`,
    transcripcion: limpiar(b.transcripcion, 20000) || null,
    detalle: { resultado: b.resultado || null, por: yo.nombre },
  });

  // Que alguien conteste cambia el estado de la cuenta y frena lo programado:
  // seguir mandando correos a quien ya respondió es la forma más rápida de
  // perder una conversación que ya estaba ganada.
  if (tipo === 'respuesta' || tipo === 'reunion' || b.resultado === 'contesto') {
    await supabase.from('abm_cuentas')
      .update({ etapa: tipo === 'reunion' ? 'reunion' : 'respondio', updated_at: new Date().toISOString() })
      .eq('id', b.cuenta_id).in('etapa', ['sin_tocar', 'en_cadencia']);
    await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'la cuenta contestó' })
      .eq('cuenta_id', b.cuenta_id).in('estado', ['borrador', 'aprobado', 'programado']);
  }
  return json({ ok: true });
};
