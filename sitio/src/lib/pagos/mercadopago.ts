// Cliente de Mercado Pago para el CRM.
//
// Es la cuenta PROPIA de SACS cobrándole a sus clientes — no el modelo
// marketplace de sacs_api, donde cada comercio conecta la suya por OAuth para
// cobrarle a sus compradores. Por eso aquí hay una sola credencial y no un
// constructor por cuenta.
import { supabase } from '../supabase';
import { descifrar } from './secretos';

const API = 'https://api.mercadopago.com';

export type Conexion = {
  modo: 'prueba' | 'produccion';
  token: string;
  webhookSecret: string | null;
  mp_nickname?: string | null;
};

/** Credencial activa según el modo guardado. Devuelve null si no hay conexión. */
export async function conexionActiva(): Promise<Conexion | null> {
  const { data, error } = await supabase.from('crm_pasarelas').select('*').eq('pasarela', 'mercadopago').maybeSingle();
  if (error || !data) return null;
  const modo = data.modo === 'produccion' ? 'produccion' : 'prueba';
  const token = descifrar(modo === 'produccion' ? data.token_produccion : data.token_prueba);
  if (!token) return null;
  return { modo, token, webhookSecret: descifrar(data.webhook_secret), mp_nickname: data.mp_nickname };
}

/**
 * ¿Este token es de producción?
 *
 * NO se decide por lo que diga el formulario. En la integración de tiendas
 * alguien conectó con la casilla de "modo prueba" marcada usando una credencial
 * real, la pantalla decía prueba y Mercado Pago cobró de verdad — confirmado con
 * un cargo real. Aquí se pregunta a MP quién es el dueño del token y se guarda lo
 * que ÉL contesta, no lo que se tecleó.
 *
 * El prefijo (`TEST-` vs `APP_USR-`) es una pista, no una prueba: se usa solo
 * como respaldo si MP no informa el entorno.
 */
export async function identificarToken(token: string): Promise<
  { ok: true; user_id: string; nickname: string | null; email: string | null; es_produccion: boolean }
  | { ok: false; error: string }
> {
  try {
    const r = await fetch(API + '/users/me', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) return { ok: false, error: 'Mercado Pago no reconoce ese token (401). Revisa que lo hayas copiado completo.' };
    if (!r.ok) return { ok: false, error: 'Mercado Pago respondió ' + r.status + ' al verificar el token.' };
    const u = await r.json();
    return {
      ok: true,
      user_id: String(u.id ?? ''),
      nickname: u.nickname ?? null,
      email: u.email ?? null,
      es_produccion: !String(token).startsWith('TEST-'),
    };
  } catch (e: any) {
    return { ok: false, error: 'No se pudo contactar a Mercado Pago: ' + (e?.message || e) };
  }
}

/** Llamada autenticada a la API de MP con la conexión activa. */
export async function mpFetch(ruta: string, init: RequestInit = {}, conexion?: Conexion) {
  const cx = conexion || await conexionActiva();
  if (!cx) throw new Error('No hay una cuenta de Mercado Pago conectada.');
  const r = await fetch(API + ruta, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cx.token,
      ...(init.headers || {}),
    },
  });
  const cuerpo = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = cuerpo?.message || cuerpo?.error || ('HTTP ' + r.status);
    throw new Error('Mercado Pago: ' + msg);
  }
  return cuerpo;
}

export const obtenerPago = (id: string | number, cx?: Conexion) => mpFetch('/v1/payments/' + id, {}, cx);
