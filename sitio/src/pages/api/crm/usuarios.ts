// Usuarios del CRM y sus permisos por sección.
//
// Solo el founder administra esto. Un consultor con permiso de "editar
// Configuración" tampoco puede tocarlo: quien reparte los permisos no puede ser
// alguien a quien se le pueden repartir, o el candado se abre solo.
//
// GET    → la lista, con sus permisos efectivos ya resueltos.
// POST   → alta. Devuelve UNA VEZ la contraseña temporal; no se guarda en claro
//          y no hay forma de volver a verla (se genera otra).
// PUT    → cambia rol, permisos, activo o la contraseña de alguien.
// DELETE → no borra: desactiva. Un usuario borrado dejaría huérfana su
//          actividad —quién capturó qué— y ese rastro es la mitad del CRM.
import type { APIRoute } from 'astro';
import { randomBytes } from 'crypto';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { hashPassword } from '../../../lib/auth/password';
import { permisosDe, SECCIONES, PRESETS, type Nivel } from '../../../lib/crm/permisos';

export const prerender = false;

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Solo founder. Devuelve el usuario o null. */
async function soloFounder(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'founder') return null;
  return user;
}

/** Limpia lo que llega: solo secciones conocidas y solo niveles válidos. */
function saneaPermisos(p: any): Record<string, Nivel> | null {
  if (!p || typeof p !== 'object') return null;
  const out: Record<string, Nivel> = {};
  for (const s of SECCIONES) {
    const v = p[s.id];
    if (v === 'edit' || v === 'ver' || v === 'no') out[s.id] = v;
  }
  return Object.keys(out).length ? out : null;
}

export const GET: APIRoute = async ({ request }) => {
  if (!(await soloFounder(request))) return json({ error: 'Solo el founder administra usuarios.' }, 403);

  const { data, error } = await supabase
    .from('team_members')
    .select('id, nombre, email, rol, activo, foto_url, permisos, last_login_at, created_at')
    .order('created_at');
  if (error) return json({ error: error.message }, 500);

  return json({
    usuarios: (data || []).map(u => ({ ...u, permisos_efectivos: permisosDe(u as any) })),
    roles: Object.entries(PRESETS).map(([id, r]) => ({ id, label: r.label, permisos: r.permisos })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await soloFounder(request);
  if (!yo) return json({ error: 'Solo el founder administra usuarios.' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const nombre = String(b.nombre || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const rol = ['founder', 'cs', 'lectura', 'partner'].includes(b.rol) ? b.rol : 'cs';

  if (nombre.length < 2) return json({ error: 'Falta el nombre.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Ese correo no tiene forma de correo.' }, 400);

  const { data: ocupado } = await supabase.from('team_members').select('id, activo').ilike('email', email).maybeSingle();
  if (ocupado) return json({ error: 'Ya hay un usuario con ese correo.' }, 409);

  // Contraseña temporal legible: se enseña una vez y quien entra la cambia.
  const temporal = 'sacs-' + randomBytes(4).toString('hex');
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      nombre, email, rol, activo: true,
      password_hash: await hashPassword(temporal),
      permisos: saneaPermisos(b.permisos) || PRESETS[rol]?.permisos || null,
    })
    .select('id, nombre, email, rol, activo, permisos').maybeSingle();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, usuario: { ...data, permisos_efectivos: permisosDe(data as any) }, password_temporal: temporal });
};

export const PUT: APIRoute = async ({ request }) => {
  const yo = await soloFounder(request);
  if (!yo) return json({ error: 'Solo el founder administra usuarios.' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const id = String(b.id || '');
  if (!id) return json({ error: 'Falta el usuario.' }, 400);

  const patch: Record<string, any> = {};
  if (typeof b.nombre === 'string' && b.nombre.trim().length >= 2) patch.nombre = b.nombre.trim();
  if (['founder', 'cs', 'lectura', 'partner'].includes(b.rol)) patch.rol = b.rol;
  if (b.permisos !== undefined) patch.permisos = saneaPermisos(b.permisos);
  if (typeof b.activo === 'boolean') patch.activo = b.activo;

  let temporal: string | null = null;
  if (b.resetear_password === true) {
    temporal = 'sacs-' + randomBytes(4).toString('hex');
    patch.password_hash = await hashPassword(temporal);
  }

  // No dejarse a uno mismo fuera: quitarse el rol de founder o desactivarse es
  // la forma más rápida de quedarse sin nadie que pueda arreglarlo.
  if (id === yo.id && (patch.rol && patch.rol !== 'founder')) return json({ error: 'No puedes quitarte a ti mismo el rol de founder.' }, 400);
  if (id === yo.id && patch.activo === false) return json({ error: 'No puedes desactivar tu propia cuenta.' }, 400);

  if (!Object.keys(patch).length) return json({ error: 'Nada que guardar.' }, 400);

  const { data, error } = await supabase
    .from('team_members').update(patch).eq('id', id)
    .select('id, nombre, email, rol, activo, permisos').maybeSingle();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, usuario: { ...data, permisos_efectivos: permisosDe(data as any) }, password_temporal: temporal });
};

export const DELETE: APIRoute = async ({ request }) => {
  const yo = await soloFounder(request);
  if (!yo) return json({ error: 'Solo el founder administra usuarios.' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const id = String(b.id || '');
  if (!id) return json({ error: 'Falta el usuario.' }, 400);
  if (id === yo.id) return json({ error: 'No puedes desactivar tu propia cuenta.' }, 400);

  const { error } = await supabase.from('team_members').update({ activo: false }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  // Se le cierran las sesiones abiertas: si no, sigue dentro hasta que caduque.
  await supabase.from('partner_sessions').update({ revoked_at: new Date().toISOString() })
    .eq('team_member_id', id).is('revoked_at', null);
  return json({ ok: true });
};
