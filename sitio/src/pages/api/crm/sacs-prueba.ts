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
//      como cualquier otro hecho del lead.
//
// Lo que NO hace: inventar el slug. El identificador de la cuenta es visible
// para el cliente (vive en su URL) y no puede salir de una heurística: se pide
// explícito y se valida contra el mismo pre-check que usa el registro público.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const REGISTER_SECRET = (import.meta.env.SACS_REGISTER_SECRET || '').trim();

/** Slug válido de SACS: minúsculas, números y guiones. Es parte de una URL. */
const SLUG_OK = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/;

export const POST: APIRoute = async ({ request }) => {
  if (!REGISTER_SECRET) {
    return json({ error: 'Falta SACS_REGISTER_SECRET en el entorno: sin ese secreto SACS rechaza el alta.' }, 500);
  }
  const b = await request.json().catch(() => ({}));
  const cuenta = String(b.cuenta || '').trim().toLowerCase();
  const contactId = String(b.contact_id || '').trim();
  const dias = Math.max(1, Math.min(60, Number(b.dias) || 14));

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

  const empresa = (c as any).companies?.nombre_comercial || (c as any).companies?.nombre || c.nombre || cuenta;

  /* Contraseña temporal: la genera el servidor y se devuelve UNA vez, para
     dictarla. No se guarda en el CRM — una contraseña almacenada «por
     comodidad» es una fuga esperando su turno, y el cliente puede cambiarla
     desde el primer acceso. */
  const temporal = 'sacs' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);

  const r = await fetch(SACS_API + '/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-register-secret': REGISTER_SECRET },
    body: JSON.stringify({
      account_id: cuenta,
      account_name: empresa,
      nombre: c.nombre || empresa,
      email: c.email,
      password: temporal,
      telefono: c.whatsapp || undefined,
      prueba_gratis: true,
      prueba_dias: dias,
      prueba_origen: 'crm',
    }),
  }).then(x => x.json()).catch(e => ({ success: false, msg: String(e) }));

  if (!r?.success) return json({ error: r?.msg || 'SACS rechazó el alta', detalle: r }, 502);

  /* La liga en la tabla, no en `companies.sacs_account`: es la que aguanta
     varias cuentas por empresa y la que lee el cron de uso. */
  if (c.company_id) {
    await supabase.from('company_sacs_accounts')
      .insert({ company_id: c.company_id, cuenta, es_principal: true })
      .then(() => {}, () => {});
  }

  await supabase.from('activities').insert({
    contact_id: c.id, company_id: c.company_id || null,
    tipo: 'prueba_iniciada', automatico: false,
    titulo: `Prueba gratis de ${dias} días · cuenta ${cuenta}`,
    metadata: { cuenta, dias },
  }).then(() => {}, () => {});

  return json({
    ok: true, cuenta, dias,
    url: `https://${cuenta}.sacscloud.com`,
    email: c.email,
    /* Se devuelve una sola vez y no se guarda en ningún lado. */
    password_temporal: temporal,
  });
};
