// GET /api/auth/yo — quién está en la sesión actual.
//
// Existe porque el menú necesita saludar por su nombre a quien entró y la
// pantalla de Configuración muestra sus datos, y ninguna de las dos puede leer
// la cookie firmada desde el navegador.
//
// Devuelve lo mínimo para pintar: nombre, correo, rol y cuándo entró. Nada de tokens ni de
// permisos: lo que se manda al cliente es lo que se puede leer con las
// herramientas del navegador, así que solo va lo que ya se muestra en pantalla.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../lib/auth/scope';
import { permisosDe } from '../../../lib/crm/permisos';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  /* El último ingreso se pide aparte y no se mete al select de la sesión: esa
     consulta corre en CADA petición autenticada del CRM y esto solo lo lee una
     pantalla. Si falla, el renglón de sesión se queda sin fecha y ya. */
  const { data: fila } = await supabase.from('team_members')
    .select('last_login_at').eq('id', user.id).maybeSingle();
  return new Response(JSON.stringify({
    id: user.id, nombre: user.nombre || null, email: user.email || null, rol: user.role,
    // La foto y los permisos SÍ viajan: el menú tiene que esconder las
    // secciones que esta persona no puede ver y pintar su cara en el pie. Son
    // sus propios permisos, no los de nadie más, y el candado de verdad vive
    // en el middleware — esto solo evita mostrar puertas que no abren.
    foto_url: user.foto_url || null,
    permisos: permisosDe({ rol: user.role, permisos: user.permisos }),
    // Cuándo entraste. Lo enseña el renglón «Sesión» de Configuración.
    last_login_at: fila?.last_login_at || null,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
