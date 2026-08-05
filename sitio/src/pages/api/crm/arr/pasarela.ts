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

  // ── Salud del webhook ──
  // Un aviso rechazado por firma se ve EXACTAMENTE igual que "el cliente no ha
  // pagado", y esa confusión cuesta dinero: se le reclama a quien ya pagó y no
  // se cobra el mes de quien sí debe. Por eso el estado de la conexión no es
  // solo "hay token", sino "los avisos están entrando".
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: ev } = await supabase.from('crm_webhook_eventos')
    .select('resultado, detalle, topic, recibido_at').eq('pasarela', 'mercadopago')
    .gte('recibido_at', desde).order('recibido_at', { ascending: false }).limit(200);
  const rechazados = (ev || []).filter(e => e.resultado === 'rechazado');
  // El letrero rojo solo se enciende con avisos que MUEVEN DINERO. Mercado Pago
  // manda también `merchant_order` y otros que aquí se ignoran: si esos
  // encendieran la alarma, estaría prendida siempre y nadie la volvería a leer
  // el día que sí signifique pagos perdiéndose.
  const rechazadosDinero = rechazados.filter(e => /^(payment|subscription_)/.test(String(e.topic || '')));
  const modoActual = data.modo === 'produccion' ? 'produccion' : 'prueba';

  // Nunca se devuelve el token: solo si existe y su cola, para reconocerlo.
  return json({
    conectada: !!(data.token_prueba || data.token_produccion),
    modo: data.modo,
    tiene_prueba: !!data.token_prueba,
    tiene_produccion: !!data.token_produccion,
    // El secreto es por entorno. Lo que importa no es "hay alguno", sino "hay
    // uno para el modo en el que estás cobrando".
    tiene_webhook_secret: !!((modoActual === 'produccion' ? data.webhook_secret_produccion : data.webhook_secret_prueba) ?? data.webhook_secret),
    secreto_prueba: !!(data.webhook_secret_prueba ?? data.webhook_secret),
    secreto_produccion: !!(data.webhook_secret_produccion ?? data.webhook_secret),
    // Verdadero cuando el secreto en uso NUNCA se capturó para este modo, sino
    // que se heredó del otro: es el caso que rechaza todos los cobros.
    secreto_heredado: !(modoActual === 'produccion' ? data.webhook_secret_produccion : data.webhook_secret_prueba) && !!data.webhook_secret,
    webhook: {
      recibidos_7d: (ev || []).length,
      rechazados_7d: rechazadosDinero.length,
      rechazados_otros_7d: rechazados.length - rechazadosDinero.length,
      ultimo_at: ev?.[0]?.recibido_at || null,
      ultimo_rechazo: rechazadosDinero[0] ? { at: rechazadosDinero[0].recibido_at, motivo: rechazadosDinero[0].detalle } : null,
    },
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
  // El secreto se guarda EN LA COLUMNA DE SU MODO. Mercado Pago da una clave de
  // firma distinta por entorno, y compartir columna hacía que capturar la de
  // prueba pisara la de producción (y viceversa): a partir de ahí todos los
  // avisos reales se rechazaban con 401 y ningún pago se registraba.
  if (b?.webhook_secret) {
    fila[modo === 'produccion' ? 'webhook_secret_produccion' : 'webhook_secret_prueba'] = cifrar(String(b.webhook_secret).trim());
  }

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
