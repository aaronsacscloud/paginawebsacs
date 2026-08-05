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

/**
 * Credencial activa. `null` significa NO CONFIGURADA; si hay credencial pero no
 * se puede descifrar, LANZA — son dos problemas distintos y confundirlos hacía
 * que una llave rotada se viera como "nunca conectaste tu cuenta".
 */
export async function conexionActiva(): Promise<Conexion | null> {
  const { data, error } = await supabase.from('crm_pasarelas').select('*').eq('pasarela', 'mercadopago').maybeSingle();
  if (error || !data) return null;
  const modo = data.modo === 'produccion' ? 'produccion' : 'prueba';
  const guardado = modo === 'produccion' ? data.token_produccion : data.token_prueba;
  if (!guardado) return null;
  // El secreto de firma es POR ENTORNO: la clave de prueba no valida los avisos
  // de producción. Guardarlo en una sola columna hacía que al cambiar de modo se
  // siguiera validando con la clave anterior y CADA pago real se rechazara con
  // 401 sin dejar rastro. `webhook_secret` se conserva como respaldo para las
  // instalaciones que solo tenían esa.
  const secretoGuardado = (modo === 'produccion' ? data.webhook_secret_produccion : data.webhook_secret_prueba)
    ?? data.webhook_secret;
  let token: string | null, webhookSecret: string | null;
  try {
    token = descifrar(guardado);
    webhookSecret = descifrar(secretoGuardado);
  } catch (e: any) {
    throw new Error('Hay credenciales de Mercado Pago guardadas pero no se pudieron descifrar (¿cambió SECRETS_ENCRYPTION_KEY?): ' + (e?.message || e));
  }
  if (!token) return null;
  return { modo, token, webhookSecret, mp_nickname: data.mp_nickname };
}

/**
 * Verifica el token contra Mercado Pago y dice de quién es.
 *
 * PRECISIÓN SOBRE QUÉ GARANTIZA CADA COSA, porque la diferencia importa:
 *  · Que el token SIRVE y a qué cuenta pertenece → lo confirma MP en /users/me.
 *  · Que es de producción o de prueba → se deduce del PREFIJO (`TEST-` vs
 *    `APP_USR-`), que es como MP los distingue. `/users/me` no devuelve el
 *    entorno, así que no hay forma de confirmarlo por ahí.
 *
 * Lo digo explícito porque el comentario anterior afirmaba que MP confirmaba el
 * entorno, y no es cierto. Una nota que promete una garantía que el código no da
 * es peor que no tener nota: el siguiente que lea confía en ella.
 *
 * Aun así, el prefijo alcanza para el candado que importa —impedir que una
 * credencial real quede guardada como si fuera de prueba—, que es justo el
 * accidente que en la integración de tiendas terminó en un cargo real.
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
