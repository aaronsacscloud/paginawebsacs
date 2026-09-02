// «Para la reunión»: lo que el lead quiere ver en la demo. Lo llena el agente solo
// (datos campo tema_reunion) y el consultor a mano desde el inbox. Vive en
// contacts.propiedades.temas_reunion y se espeja en el evento del calendario.
// POST { contact_id, agregar?: string, quitar?: string, hecho?: { tema, valor } }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.contact_id) return json({ error: 'Falta contact_id' }, 400);
  const { data: c } = await supabase.from('contacts').select('id, company_id, propiedades').eq('id', b.contact_id).maybeSingle();
  if (!c) return json({ error: 'No existe el contacto' }, 404);
  const props: any = (c.propiedades && typeof c.propiedades === 'object') ? { ...(c.propiedades as any) } : {};
  let temas: any[] = Array.isArray(props.temas_reunion) ? [...props.temas_reunion] : [];
  const ahora = new Date().toISOString();
  const norm = (t: any) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (b.agregar) {
    const tema = String(b.agregar).replace(/\s+/g, ' ').trim().slice(0, 140);
    if (tema.length < 3) return json({ error: 'El tema está muy corto' }, 400);
    if (!temas.some(t => norm(t.tema) === norm(tema))) {
      temas.push({ tema, fuente: 'consultor', por: user.id, cuando: ahora });
      await supabase.from('activities').insert({ contact_id: c.id, company_id: c.company_id || null, tipo: 'tema_reunion', titulo: `Para la reunión (consultor): ${tema}`, automatico: false, created_by: user.id }).then(() => {}, () => {});
    }
  }
  if (b.quitar) temas = temas.filter(t => norm(t.tema) !== norm(b.quitar));
  if (b.hecho?.tema) temas = temas.map(t => norm(t.tema) === norm(b.hecho.tema) ? { ...t, hecho: b.hecho.valor !== false } : t);
  props.temas_reunion = temas.slice(-30);
  const { error } = await supabase.from('contacts').update({ propiedades: props, updated_at: ahora }).eq('id', c.id);
  if (error) return json({ error: error.message }, 500);
  let calendario = false;
  try { const { sincronizarTemasReunion } = await import('../../../../lib/crm/ti/datos-lead'); calendario = await sincronizarTemasReunion(c.id); } catch { /* el calendario no bloquea */ }
  return json({ ok: true, temas: props.temas_reunion, calendario });
};
