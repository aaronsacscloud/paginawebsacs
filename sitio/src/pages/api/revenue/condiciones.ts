// Plantillas de términos y condiciones.
//
// El texto vivía hardcodeado en el componente y se editaba a mano en cada
// cotización: cada quien mandaba su versión y cambiar una cláusula era tocar
// código. Aquí se administran, y la marcada como predeterminada es la que trae
// una cotización nueva.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('quote_condiciones')
    .select('*').eq('activa', true)
    .order('es_default', { ascending: false }).order('nombre');
  if (error) return json([], 200);   // sin plantillas se sigue pudiendo cotizar
  return json(data || []);
};

// Solo una predeterminada: con dos, cuál gana depende del orden en que las
// devuelva Postgres. El índice único lo impide, así que hay que limpiar antes.
async function quitarDefault(exceptoId?: string) {
  const q = supabase.from('quote_condiciones').update({ es_default: false }).eq('es_default', true);
  if (exceptoId) await q.neq('id', exceptoId); else await q;
}

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const nombre = String(b?.nombre || '').trim();
  const texto = String(b?.texto || '').trim();
  if (!nombre || !texto) return json({ error: 'La plantilla necesita nombre y texto.' }, 400);
  if (b?.es_default) await quitarDefault();
  const { data, error } = await supabase.from('quote_condiciones')
    .insert({ nombre, texto, es_default: !!b?.es_default }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta el id.' }, 400);
  if (b?.es_default) await quitarDefault(id);
  const patch: any = {};
  if (typeof b.nombre === 'string') patch.nombre = b.nombre.trim();
  if (typeof b.texto === 'string') patch.texto = b.texto.trim();
  if (typeof b.es_default === 'boolean') patch.es_default = b.es_default;
  const { data, error } = await supabase.from('quote_condiciones').update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data);
};

// Baja lógica: las cotizaciones ya mandadas guardan su texto copiado, pero
// borrar la plantilla perdería el histórico de qué se ofrecía y cuándo.
export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'Falta el id.' }, 400);
  await supabase.from('quote_condiciones').update({ activa: false, es_default: false }).eq('id', b.id);
  return json({ ok: true });
};
