// PÚBLICO · La respuesta del cliente a una carta de conciliación: firmar o no.
//
// VIVE FUERA DE /api/crm/ A PROPÓSITO. Todo `/api/crm/*` exige sesión de admin
// (ADMIN_PREFIXES en middleware.ts), y quien firma una conciliación es
// justamente alguien que YA NO ES CLIENTE y no tiene con qué entrar. Medido: con
// el endpoint bajo /api/crm/ el middleware contestaba «No autenticado» antes de
// llegar al handler, así que la carta no se podía firmar.
//
// La llave aquí es el TOKEN del link —48 hex aleatorios—, y lo único que se
// puede hacer con él es contestar sí o no a UN documento: no lista nada, no
// enseña otros acuerdos y no cambia los términos.
//
// POST { accion:'firmar'|'rechazar', token, firmante?, motivo? } → { ok }
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let b: any; try { b = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  const accion = b.accion === 'rechazar' ? 'rechazar' : 'firmar';
  const token = String(b.token || '').trim();
  if (!/^[0-9a-f]{48}$/i.test(token)) return json({ error: 'Liga inválida' }, 400);

  const { data: c } = await supabase.from('conciliaciones')
    .select('id, estado, vigencia, titulo, contact_id').eq('token', token).maybeSingle();
  if (!c) return json({ error: 'Esta propuesta ya no existe' }, 404);
  // Un borrador no se firma: todavía no se le enseñó a nadie.
  if (c.estado === 'borrador') return json({ error: 'Esta propuesta todavía no está lista' }, 409);
  if (c.estado === 'aceptada') return json({ ok: true, ya: true });
  if (c.estado === 'rechazada') return json({ error: 'Esta propuesta ya fue rechazada' }, 409);
  if (c.vigencia && c.vigencia < new Date().toISOString().slice(0, 10)) {
    await supabase.from('conciliaciones').update({ estado: 'vencida' }).eq('id', c.id);
    return json({ error: 'Esta propuesta venció. Escríbenos y la renovamos.' }, 409);
  }
  const ahora = new Date().toISOString();

  if (accion === 'rechazar') {
    await supabase.from('conciliaciones').update({
      estado: 'rechazada', rechazada_at: ahora,
      rechazo_motivo: String(b.motivo || '').slice(0, 300), updated_at: ahora,
    }).eq('id', c.id).eq('estado', 'enviada');
    if (c.contact_id) {
      await supabase.from('activities').insert({
        contact_id: c.contact_id, tipo: 'conciliacion', automatico: true,
        titulo: 'Dijo que no a la conciliación',
      }).then(() => {}, () => {});
    }
    return json({ ok: true });
  }

  const firmante = String(b.firmante || '').trim().slice(0, 120);
  // El nombre ES la firma: sin él no hay a quién atribuirle la aceptación.
  if (firmante.length < 3) return json({ error: 'Escribe tu nombre completo para firmar' }, 400);

  const { data: upd, error } = await supabase.from('conciliaciones').update({
    estado: 'aceptada', aceptada_at: ahora, firmante, firmante_ip: clientAddress || null, updated_at: ahora,
  }).eq('id', c.id).eq('estado', 'enviada').select('id').maybeSingle();
  if (error) return json({ error: error.message }, 500);
  // `.eq('estado','enviada')` cierra la carrera de dos pestañas: si otra ya
  // firmó, este update no toca nada y no se dispara el proceso dos veces.
  if (!upd) return json({ ok: true, ya: true });

  /* EL PROCESO ARRANCA SOLO. Firmar es el disparo, no un aviso: pasa a «En
     conciliación», queda la tarea de HOY y suena la campana. Una firma guardada
     de la que nadie se entera es peor que no tener la carta. */
  if (c.contact_id) {
    await supabase.from('contacts')
      .update({ lifecycle_stage: 'en_conciliacion', updated_at: ahora }).eq('id', c.contact_id)
      .in('lifecycle_stage', ['churned', 'descalificado', 'rezagado', 'lead']).then(() => {}, () => {});
    await supabase.from('crm_seguimientos').insert({
      contact_id: c.contact_id,
      motivo: `FIRMÓ la conciliación («${c.titulo}») — arrancar el proceso`,
      fecha: ahora.slice(0, 10),
    }).then(() => {}, () => {});
    await supabase.from('activities').insert({
      contact_id: c.contact_id, tipo: 'conciliacion', automatico: true,
      titulo: 'Firmó la propuesta de conciliación', descripcion: `Firmó: ${firmante}`,
    }).then(() => {}, () => {});
    await supabase.from('crm_notificaciones').insert({
      clave: `conciliacion_firmada:${c.id}`, tipo: 'conciliacion', nivel: 'alerta',
      titulo: `${firmante} firmó la conciliación`,
      detalle: 'Pasó a «En conciliación» y quedó la tarea de arrancar el proceso hoy.',
      destino: 'churn',
    }).then(() => {}, () => {});
  }
  return json({ ok: true });
};
