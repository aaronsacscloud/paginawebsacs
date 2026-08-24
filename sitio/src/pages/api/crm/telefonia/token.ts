// TELEFONÍA · Token de voz para el navegador (Twilio Voice SDK).
// GET → { token, identity, numero } · 503 con faltantes si no está configurada.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { supabase } from '../../../../lib/supabase';
import { tokenVoz, telefoniaConfigurada, telefoniaFaltantes, NUMERO } from '../../../../lib/telefonia/twilio';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (!telefoniaConfigurada()) return json({ error: 'Telefonía sin configurar', faltantes: telefoniaFaltantes() }, 503);
  // La identidad es por USUARIO: las entrantes timbran en el navegador de todos
  // los que tengan el CRM abierto (Twilio permite varios registros por identidad
  // distinta; usamos crm-<uuid corto> para poder enrutar por persona después).
  const identity = `crm-${String(user.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
  // Registro vivo: las llamadas ENTRANTES timbran en las identidades vistas en
  // los últimos 5 min (el cliente pide token nuevo cada ~4 min como latido).
  await supabase.from('tel_identidades').upsert({ identity, user_id: user.id, visto_at: new Date().toISOString() }).then(() => {}, () => {});
  return json({ token: tokenVoz(identity), identity, numero: NUMERO });
};
