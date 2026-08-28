// CRM · SECUENCIAS de UN contacto — lo que ve el vendedor desde el inbox:
// en qué secuencias está, en qué día va, qué canales siguen vivos, y los
// controles de mano: pausar, reanudar o inscribir.
//   GET  ?contact_id= → { secuencias: [{id, nombre, activa, estado, dia,
//        canales_detenidos, motivo, enviados_n}] }
//   POST { contact_id, secuencia_id, accion: 'pausar'|'reanudar'|'inscribir' }
//     pausar   → salida manual (motivo 'pausado_manual'); los envíos paran YA.
//     reanudar → vuelve a dejarla correr (limpia la salida; conserva enviados
//                para no repetir pasos).
//     inscribir→ lo mete hoy (día 1 = hoy) aunque no cumpla las reglas de
//                entrada — decisión humana, queda firmada en la actividad.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const contactId = url.searchParams.get('contact_id');
  if (!contactId) return json({ error: 'contact_id requerido' }, 400);
  const [{ data: secs }, { data: mems }] = await Promise.all([
    supabase.from('crm_secuencias').select('id, nombre, activa').order('created_at'),
    supabase.from('crm_secuencia_miembros').select('*').eq('contact_id', contactId),
  ]);
  const porSec = new Map<string, any>((mems || []).map((m: any) => [m.secuencia_id, m]));
  const ahora = Date.now();
  return json({
    secuencias: (secs || []).map((s: any) => {
      const m = porSec.get(s.id);
      if (!m) return { id: s.id, nombre: s.nombre, activa: s.activa, estado: 'fuera' };
      const dia = Math.floor((ahora - Date.parse(m.inicio)) / 86400000) + 1;
      return {
        id: s.id, nombre: s.nombre, activa: s.activa,
        estado: m.detenida_at ? 'detenida' : 'dentro',
        dia, motivo: m.motivo || null,
        canales_detenidos: m.canales_detenidos || {},
        enviados_n: Object.keys(m.enviados || {}).length,
      };
    }),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const { contact_id, secuencia_id, accion } = b || {};
  if (!contact_id || !secuencia_id || !['pausar', 'reanudar', 'inscribir'].includes(accion)) {
    return json({ error: 'contact_id, secuencia_id y accion (pausar|reanudar|inscribir) requeridos' }, 400);
  }
  const { data: sec } = await supabase.from('crm_secuencias').select('id, nombre').eq('id', secuencia_id).maybeSingle();
  if (!sec) return json({ error: 'Secuencia no encontrada' }, 404);
  const { data: m } = await supabase.from('crm_secuencia_miembros')
    .select('id, detenida_at').eq('contact_id', contact_id).eq('secuencia_id', secuencia_id).maybeSingle();

  if (accion === 'pausar') {
    if (!m || m.detenida_at) return json({ error: 'No está corriendo en esta secuencia' }, 400);
    const { error } = await supabase.from('crm_secuencia_miembros')
      .update({ detenida_at: new Date().toISOString(), motivo: 'pausado_manual' }).eq('id', m.id);
    if (error) return json({ error: error.message }, 500);
  } else if (accion === 'reanudar') {
    if (!m || !m.detenida_at) return json({ error: 'No está detenida en esta secuencia' }, 400);
    const { error } = await supabase.from('crm_secuencia_miembros')
      .update({ detenida_at: null, motivo: null }).eq('id', m.id);
    if (error) return json({ error: error.message }, 500);
  } else {
    if (m && !m.detenida_at) return json({ error: 'Ya está dentro' }, 400);
    if (m) {
      const { error } = await supabase.from('crm_secuencia_miembros')
        .update({ detenida_at: null, motivo: null, inicio: new Date().toISOString(), enviados: {}, canales_detenidos: {} }).eq('id', m.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await supabase.from('crm_secuencia_miembros')
        .insert({ contact_id, secuencia_id });
      if (error) return json({ error: error.message }, 500);
    }
  }
  await supabase.from('activities').insert({ contact_id, tipo: 'secuencia_manual', automatico: false,
    titulo: `Secuencia "${sec.nombre}": ${accion === 'pausar' ? 'pausada' : accion === 'reanudar' ? 'reanudada' : 'inscrito'} a mano`,
    metadata: { secuencia_id, accion } });
  return json({ ok: true });
};
