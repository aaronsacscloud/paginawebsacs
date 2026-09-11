// POST /api/crm/sacs-prueba — dar de alta una PRUEBA GRATIS desde el CRM.
//
// Hasta ahora, arrancar una prueba era: entrar a otro sistema, crear la cuenta
// a mano, y acordarse de anotar en el CRM cuál cuenta era de quién. El último
// paso casi nunca pasaba, y por eso hoy hay CERO leads con cuenta ligada: el
// CRM no sabía que un lead estaba probando el producto, que es justo el momento
// en que más importa saberlo.
//
// Esto lo hace en un solo movimiento y deja las tres cosas atadas:
//   1. crea la cuenta en SACS con la marca de prueba y sus días,
//   2. la liga al contacto y a su empresa en el CRM,
//   3. deja una actividad en la ficha, para que aparezca en la línea de tiempo
//      como cualquier otro hecho del lead —y por lo tanto también en el inbox,
//      que pinta esa misma línea en su panel de detalle.
//   4. LO MUEVE A LA ETAPA «Prueba gratis», que es lo que lo mete a la cadencia
//      de onboarding. Sin este paso, el flujo anterior creaba la cuenta y ahí
//      se acababa: el lead se quedaba en «oportunidad» y no recibía ninguno de
//      los 14 correos. No fallaba nada; simplemente no pasaba nada. Medido
//      antes de este cambio: 14 correos cargados, 0 leads en prueba.
//
// Lo que NO hace: inventar el slug. El identificador de la cuenta es visible
// para el cliente (vive en su URL) y no puede salir de una heurística: se pide
// explícito y se valida contra el mismo pre-check que usa el registro público.
//
// El alta en sí (SACS /register + liga + iniciarPrueba) vive en `altaCuentaPrueba`
// (lib/crm/prueba.ts), que también usa Fernanda cuando el lead elige la cuenta
// gratis en la llamada: un solo camino para «crear una prueba».
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { altaCuentaPrueba, DIAS_PRUEBA, SLUG_OK } from '../../../lib/crm/prueba';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 403);

  const b = await request.json().catch(() => ({}));
  const cuenta = String(b.cuenta || '').trim().toLowerCase();
  const contactId = String(b.contact_id || '').trim();
  const dias = Math.max(1, Math.min(60, Number(b.dias) || DIAS_PRUEBA));

  if (!SLUG_OK.test(cuenta)) {
    return json({ error: 'El identificador de la cuenta solo admite minúsculas, números y guiones (3 a 40).' }, 400);
  }
  if (!contactId) return json({ error: 'Falta el contacto' }, 400);

  const { data: c, error: e1 } = await supabase
    .from('contacts')
    .select('id, nombre, email, whatsapp, company_id, companies(nombre, nombre_comercial)')
    .eq('id', contactId).single();
  if (e1 || !c) return json({ error: 'No encontré ese contacto' }, 404);
  if (!c.email) return json({ error: 'El contacto no tiene correo, y SACS lo pide para crear el acceso.' }, 400);

  const r = await altaCuentaPrueba(c, { cuenta, dias, quien: (user as any).email || (user as any).id || null });
  if (!r.ok) return json({ error: r.error, detalle: (r as any).detalle }, /^Falta/.test(r.error) ? 500 : (r as any).detalle ? 502 : 400);

  /* url SIEMPRE app.sacscloud.com (el slug es el tenant, no un host); la contraseña
     temporal se devuelve una sola vez y no se guarda en ningún lado. */
  return json({ ok: true, cuenta, dias, fin: r.fin, url: r.url, email: r.email, password_temporal: r.password_temporal });
};
