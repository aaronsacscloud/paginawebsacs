// Conexión de la pasarela de cobro (Fase 1).
//   GET  → estado de la conexión, SIN devolver credenciales
//   POST { token_prueba?, token_produccion?, webhook_secret?, modo? } → guarda y verifica
//   PUT  { modo }  → cambia entre prueba y producción
//
// Regla: el token se VERIFICA contra Mercado Pago antes de guardarse. Guardar una
// credencial que no funciona es peor que no tener ninguna — el fallo aparece
// después, en un cobro real, y no en la pantalla de configuración.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { cifrar, descifrar, enmascarar } from '../../../../lib/pagos/secretos';
import { identificarToken } from '../../../../lib/pagos/mercadopago';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async () => {
  const { data } = await supabase.from('crm_pasarelas').select('*').eq('pasarela', 'mercadopago').maybeSingle();
  if (!data) return json({ conectada: false });
  // Nunca se devuelve el token: solo si existe y su cola, para reconocerlo.
  return json({
    conectada: !!(data.token_prueba || data.token_produccion),
    modo: data.modo,
    tiene_prueba: !!data.token_prueba,
    tiene_produccion: !!data.token_produccion,
    tiene_webhook_secret: !!data.webhook_secret,
    token_visible: enmascarar(descifrar(data.modo === 'produccion' ? data.token_produccion : data.token_prueba)),
    mp_nickname: data.mp_nickname, mp_email: data.mp_email, mp_user_id: data.mp_user_id,
    token_es_produccion: data.token_es_produccion,
    conectada_at: data.conectada_at, ultimo_test_at: data.ultimo_test_at,
    ultimo_test_ok: data.ultimo_test_ok, ultimo_test_error: data.ultimo_test_error,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const modo: 'prueba' | 'produccion' = b?.modo === 'produccion' ? 'produccion' : 'prueba';
  const token = String((modo === 'produccion' ? b?.token_produccion : b?.token_prueba) || '').trim();
  if (!token) return json({ error: 'Pega el access token de Mercado Pago.' }, 400);

  // Se pregunta a MP de quién es el token ANTES de guardarlo.
  const id = await identificarToken(token);
  if (!id.ok) return json({ error: id.error }, 400);

  // El candado que faltó en la integración de tiendas: si el token es de
  // PRODUCCIÓN y se está guardando como prueba, se rechaza. Ahí la pantalla decía
  // "modo prueba" y Mercado Pago estaba cobrando de verdad.
  if (modo === 'prueba' && id.es_produccion) {
    return json({ error: `Ese token es de PRODUCCIÓN (cuenta ${id.nickname || id.user_id}), no de prueba. Si lo guardas como prueba, Mercado Pago va a cobrar de verdad mientras la pantalla dice que no. Pégalo en producción, o usa el token que empieza con TEST-.` }, 400);
  }
  if (modo === 'produccion' && !id.es_produccion) {
    return json({ error: 'Ese token es de PRUEBA (empieza con TEST-). En producción no va a cobrar nada real.' }, 400);
  }

  const fila: any = {
    pasarela: 'mercadopago', modo,
    mp_user_id: id.user_id, mp_nickname: id.nickname, mp_email: id.email,
    token_es_produccion: id.es_produccion,
    conectada_at: new Date().toISOString(),
    ultimo_test_at: new Date().toISOString(), ultimo_test_ok: true, ultimo_test_error: null,
    updated_at: new Date().toISOString(),
  };
  fila[modo === 'produccion' ? 'token_produccion' : 'token_prueba'] = cifrar(token);
  if (b?.webhook_secret) fila.webhook_secret = cifrar(String(b.webhook_secret).trim());

  const { error } = await supabase.from('crm_pasarelas').upsert(fila, { onConflict: 'pasarela' });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, cuenta: id.nickname || id.user_id, correo: id.email, modo });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const modo = b?.modo === 'produccion' ? 'produccion' : 'prueba';
  const { data } = await supabase.from('crm_pasarelas').select('token_prueba, token_produccion').eq('pasarela', 'mercadopago').maybeSingle();
  const tiene = modo === 'produccion' ? data?.token_produccion : data?.token_prueba;
  // Cambiar a un modo sin credencial dejaría el cobro roto sin avisar.
  if (!tiene) return json({ error: `Todavía no hay un token de ${modo} guardado.` }, 400);
  const { error } = await supabase.from('crm_pasarelas').update({ modo, updated_at: new Date().toISOString() }).eq('pasarela', 'mercadopago');
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, modo });
};
