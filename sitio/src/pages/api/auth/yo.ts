// GET /api/auth/yo — quién está en la sesión actual.
//
// Existe porque el menú necesita saludar por su nombre a quien entró y la
// pantalla de Configuración muestra sus datos, y ninguna de las dos puede leer
// la cookie firmada desde el navegador.
//
// Devuelve lo mínimo para pintar: nombre, correo y rol. Nada de tokens ni de
// permisos: lo que se manda al cliente es lo que se puede leer con las
// herramientas del navegador, así que solo va lo que ya se muestra en pantalla.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({
    id: user.id, nombre: user.nombre || null, email: user.email || null, rol: user.role,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
