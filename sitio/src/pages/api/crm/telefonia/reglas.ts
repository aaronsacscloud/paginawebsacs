// TELEFONÍA · Lo que el marcador aprende (Configuración → Telefonía).
//
// Dos memorias:
//  · `tel_reglas`: frases que engañaron al detector de buzón/persona. Nacen
//    «propuesta» cuando el vendedor corrige (tomó una llamada que se creía
//    máquina, o saltó una que se creía persona); el dueño las aprueba o
//    descarta y solo las activas entran a los oídos.
//  · `tel_conocimiento`: lo que ya se contestó una vez sobre qué mandarle al
//    cliente (precios, cómo funciona X…). Se reutiliza en el cierre con IA.
//
// GET  → { reglas[], conocimiento[] }
// POST { accion: 'aprobar'|'descartar', id }               (solo el dueño)
// POST { accion: 'conocimiento_editar', id, texto, tema? } (solo el dueño)
// POST { accion: 'conocimiento_quitar', id }               (solo el dueño)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { olvidarReglas } from '../../../../lib/telefonia/marcador';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const UUID = /^[0-9a-f-]{36}$/i;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const [{ data: reglas }, { data: conocimiento }] = await Promise.all([
    supabase.from('tel_reglas').select('id, tipo, patron, origen, estado, ejemplo, veces, created_at').neq('estado', 'descartada').order('estado').order('veces', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    supabase.from('tel_conocimiento').select('id, tema, claves, texto, pdf_url, origen, estado, veces_usado, created_at').neq('estado', 'descartado').order('veces_usado', { ascending: false }).order('created_at', { ascending: false }).limit(200),
  ]);
  return json({ reglas: reglas || [], conocimiento: conocimiento || [], puede_editar: user.role === 'founder' });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (user.role !== 'founder') return json({ error: 'Solo el dueño puede cambiar lo que el marcador aprende' }, 403);
  let b: any = {};
  try { b = await request.json(); } catch { /* vacío */ }
  const id = String(b.id || '');
  if (!UUID.test(id)) return json({ error: 'Falta el id' }, 400);
  const t = new Date().toISOString();
  switch (String(b.accion || '')) {
    case 'aprobar':
    case 'descartar': {
      const estado = b.accion === 'aprobar' ? 'activa' : 'descartada';
      const { data } = await supabase.from('tel_reglas').update({ estado, updated_at: t }).eq('id', id).select('id').maybeSingle();
      if (!data) return json({ error: 'No existe esa frase' }, 404);
      olvidarReglas();
      return json({ ok: true, estado });
    }
    case 'conocimiento_editar': {
      const texto = String(b.texto || '').trim();
      if (texto.length < 10) return json({ error: 'Escribe al menos una línea' }, 400);
      const up: any = { texto: texto.slice(0, 6000), estado: 'activo', updated_at: t };
      if (b.tema) up.tema = String(b.tema).slice(0, 120);
      const { data } = await supabase.from('tel_conocimiento').update(up).eq('id', id).select('id').maybeSingle();
      if (!data) return json({ error: 'No existe ese tema' }, 404);
      return json({ ok: true });
    }
    case 'conocimiento_quitar': {
      await supabase.from('tel_conocimiento').update({ estado: 'descartado', updated_at: t }).eq('id', id);
      return json({ ok: true });
    }
    default: return json({ error: 'Acción desconocida' }, 400);
  }
};
