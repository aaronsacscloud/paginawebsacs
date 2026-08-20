// GET/PUT /api/crm/perfil — los datos de QUIEN ESTÁ EN LA SESIÓN.
//
// Es el único endpoint donde una persona se edita a sí misma. La identidad sale
// de la cookie, nunca del cuerpo: si el id viniera en el JSON, cualquiera con
// una sesión válida podría cambiarle el nombre y el correo —o sea, el usuario
// con el que se entra— a otra persona.
//
// El correo es la credencial de acceso, así que se valida forma y se comprueba
// que no lo tenga alguien más. Cambiarlo cambia con qué se entra la próxima vez.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { permisosDe } from '../../../lib/crm/permisos';

export const prerender = false;

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const { data } = await supabase
    .from('team_members')
    .select('id, nombre, email, rol, foto_url, permisos, last_login_at, created_at')
    .eq('id', user.id)
    .maybeSingle();

  return json({ ...(data || {}), permisos_efectivos: permisosDe(data as any) });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const body = await request.json().catch(() => ({} as any));
  const patch: Record<string, any> = {};

  if (typeof body.nombre === 'string') {
    const n = body.nombre.trim();
    if (n.length < 2) return json({ error: 'El nombre no puede quedar vacío.' }, 400);
    patch.nombre = n;
  }

  if (typeof body.email === 'string') {
    const e = body.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: 'Ese correo no tiene forma de correo.' }, 400);
    const { data: ocupado } = await supabase
      .from('team_members').select('id').ilike('email', e).neq('id', user.id).maybeSingle();
    if (ocupado) return json({ error: 'Ya hay otro usuario con ese correo.' }, 409);
    patch.email = e;
  }

  // foto_url llega ya subida (el subidor es /api/revenue/upload-logo, el mismo
  // de Mi marca). Cadena vacía = quitar la foto y volver a las iniciales.
  if (typeof body.foto_url === 'string') patch.foto_url = body.foto_url.trim() || null;

  if (!Object.keys(patch).length) return json({ error: 'Nada que guardar.' }, 400);

  const { data, error } = await supabase
    .from('team_members').update(patch).eq('id', user.id)
    .select('id, nombre, email, rol, foto_url').maybeSingle();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, perfil: data });
};
