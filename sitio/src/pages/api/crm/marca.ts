// Mi marca: la identidad con la que salen los documentos que firma este usuario.
//
// GET → la marca del usuario de la sesión (con los valores por defecto ya
//       resueltos, para que la vista previa nunca se vea vacía).
// PUT → la guarda. Cada quien la suya: no hay forma de escribir la de otro,
//       porque el id sale de la cookie y no del cuerpo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { ACENTOS, LISTA_ACENTOS, marcaDe, SELECT_MARCA, CAMPOS_MARCA } from '../../../lib/crm/marca';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado.' }, 401);

  const { data } = await supabase.from('team_members').select(SELECT_MARCA).eq('id', user.id).maybeSingle();
  const m = marcaDe(data || { nombre: user.nombre, email: user.email });
  return json({
    // Lo capturado tal cual (para que los campos vacíos se vean vacíos y el
    // placeholder enseñe qué se va a usar si no se llena).
    campos: Object.fromEntries(CAMPOS_MARCA.map(k => [k, (data as any)?.[k] ?? null])),
    // Y lo que realmente va a salir impreso.
    marca: { ...m, acento: undefined, acento_clave: m.acento_clave },
    acentos: LISTA_ACENTOS.map(a => ({ clave: a.clave, label: a.label, swatch: a.swatch, hd: a.hd })),
    logo_cotizaciones: (data as any)?.logo_url || null,
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado.' }, 401);
  const b = await request.json().catch(() => ({} as any));

  const p: Record<string, any> = {};
  for (const k of CAMPOS_MARCA) {
    if (!(k in b)) continue;
    const v = b[k] == null ? null : String(b[k]).trim().slice(0, k === 'marca_logo_url' ? 600 : 160);
    p[k] = v || null;
  }
  // El acento es catálogo cerrado: una clave inventada dejaría el documento sin
  // color en vez de fallar a la vista.
  if ('marca_acento' in p && p.marca_acento && !(p.marca_acento in ACENTOS)) p.marca_acento = 'rosa';
  if (!Object.keys(p).length) return json({ error: 'No hay nada que guardar.' }, 400);

  const { error } = await supabase.from('team_members').update(p).eq('id', user.id);
  if (error) return json({ error: error.message }, 500);

  const { data } = await supabase.from('team_members').select(SELECT_MARCA).eq('id', user.id).maybeSingle();
  const m = marcaDe(data || {});
  return json({ ok: true, marca: { ...m, acento: undefined, acento_clave: m.acento_clave } });
};
