// POST /api/revenue/mercadopago-webhook — Mercado Pago avisa que pasó algo.
//
// ═══ Las dos defensas contra el problema más caro ═══
//
// MP REINTENTA los avisos. Si el mismo pago se procesa dos veces,
// register-payment corre dos veces y la próxima factura se recorre DOS ciclos:
// dejas de cobrarle un mes completo a ese cliente y nadie lo nota hasta cuadrar.
//
//   1ª defensa · el evento: se inserta en crm_webhook_eventos ANTES de procesar,
//      con índice único. Si choca, ya se atendió → 200 y fuera.
//   2ª defensa · el pago: índice único en payments.mp_payment_id. Aunque el
//      evento llegue por otra vía (conciliación), el mismo pago no se duplica.
//
// ═══ Configúralo como WEBHOOK, no como IPN ═══
//
// Astro trae protección CSRF (`checkOrigin`) y rechaza los POST con
// `content-type` de formulario que vengan de otro origen — ANTES de llegar aquí,
// así que ni siquiera se puede registrar el intento. Comprobado en producción:
//
//   Content-Type: application/json         → pasa (incluye el id en el query)
//   Content-Type: x-www-form-urlencoded    → "Cross-site POST form submissions are forbidden"
//   sin content-type                       → 403
//
// El formato ACTUAL de Mercado Pago (panel → Webhooks) manda JSON y funciona. El
// IPN clásico manda formulario y quedaría bloqueado. No se apaga `checkOrigin`
// para acomodarlo: ese guardia protege los formularios de todo el CRM, y el IPN
// es un formato que MP ya no recomienda. La pantalla de conexión lo dice.
//
// ═══ Sobre "responder y luego procesar" ═══
//
// La integración de tiendas responde 200 y procesa después. Aquí NO se puede: en
// serverless la función se congela al devolver la respuesta. Se procesa síncrono
// (traer el pago de MP + registrar es ~1 s) y se contesta al final. MP tolera
// hasta ~22 s, así que hay margen de sobra.
import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabase } from '../../../lib/supabase';
import { conexionActiva, obtenerPago, mpFetch } from '../../../lib/pagos/mercadopago';
// Se importa el HANDLER, no se le pega por HTTP. Dos razones, y la primera es
// que el webhook simplemente NO FUNCIONABA: /api/crm/* está detrás del
// middleware de sesión, así que la llamada salía con 403 y ningún pago llegaba a
// registrarse. La segunda es que así hay UNA sola implementación del cobro —
// duplicar la lógica aquí sería peor que el bug.
import { POST as registrarPago } from '../crm/arr/register-payment';

export const prerender = false;
// A MP siempre se le contesta 200 salvo que la firma falle: un 500 lo hace
// reintentar en bucle por algo que no se va a arreglar solo.
const ok = (o: any = { ok: true }) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
const no = (m: string, s = 401) => new Response(JSON.stringify({ error: m }), { status: s, headers: { 'Content-Type': 'application/json' } });

const DERIVA_MAX_S = 5 * 60;   // 5 min: frena reenvíos de un aviso capturado

/**
 * Firma de MP: HMAC-SHA256 sobre
 *   "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * El header `x-signature` trae `ts=...,v1=<hex>`.
 */
function firmaValida(headers: Headers, dataId: string, secreto: string): { ok: boolean; motivo?: string } {
  const sig = headers.get('x-signature') || '';
  const reqId = headers.get('x-request-id') || '';
  if (!sig) return { ok: false, motivo: 'sin x-signature' };
  const partes: Record<string, string> = {};
  for (const seg of sig.split(',')) {
    const i = seg.indexOf('=');
    if (i > 0) partes[seg.slice(0, i).trim()] = seg.slice(i + 1).trim();
  }
  const ts = partes.ts, v1 = partes.v1;
  if (!ts || !v1) return { ok: false, motivo: 'x-signature incompleto' };
  const deriva = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(deriva) || deriva > DERIVA_MAX_S) return { ok: false, motivo: 'timestamp fuera de rango' };

  // MP especifica el id en MINÚSCULAS cuando es alfanumérico. Con id numérico da
  // igual, pero los de suscripción no lo son y la firma fallaría.
  const manifiesto = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${ts};`;
  const esperado = createHmac('sha256', secreto).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado, 'utf8'), b = Buffer.from(v1, 'utf8');
  // Comparación de tiempo constante: si no, la latencia filtra byte por byte.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, motivo: 'firma no coincide' };
  return { ok: true };
}

export const POST: APIRoute = async ({ request, url }) => {
  // El cuerpo puede venir vacío: Mercado Pago tiene DOS formatos vivos y el
  // viejo (IPN) manda todo en el query — `?topic=payment&id=123`. Leer solo el
  // body descartaba esos avisos en silencio, con un 200, y el pago se perdía.
  let body: any = null;
  try { body = await request.json(); } catch { body = null; }

  const topic = String(url.searchParams.get('type') || url.searchParams.get('topic') || body?.type || body?.topic || '');
  const dataId = String(url.searchParams.get('data.id') || url.searchParams.get('id') || body?.data?.id || body?.id || '');
  const accion = String(body?.action || '');
  const reqId = request.headers.get('x-request-id') || '';
  if (!dataId) return ok({ ignorado: 'aviso sin id' });

  // Ojo con la diferencia: "no configurada" se contesta 200 (no hay nada que
  // hacer y no queremos que MP reintente para siempre). Un fallo al descifrar sí
  // devuelve 500 A PROPÓSITO: es un problema reparable —una llave rotada— y el
  // 500 hace que MP reintente, así que los pagos de esas horas no se pierden.
  let cx;
  try { cx = await conexionActiva(); }
  catch (e: any) {
    console.error('[mp-webhook] credenciales ilegibles:', e?.message || e);
    return new Response(JSON.stringify({ error: 'credenciales de Mercado Pago ilegibles' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  if (!cx) return ok({ ignorado: 'no hay cuenta de Mercado Pago conectada' });

  // ── Firma ──
  // Si hay secreto configurado, se exige. Si no lo hay, se acepta pero se deja
  // constancia: un webhook sin validar significa que cualquiera que adivine la
  // URL puede marcar suscripciones como pagadas.
  let firmado = false;
  if (cx.webhookSecret) {
    const v = firmaValida(request.headers, dataId, cx.webhookSecret);
    if (!v.ok) {
      // El rechazo se ANOTA. Antes solo se devolvía 401: MP reintentaba unas
      // horas, se rendía, y el pago nunca se registraba sin que nadie se
      // enterara — la falla más cara posible, porque se ve igual que "no ha
      // pagado". La causa típica es la clave equivocada tras cambiar de modo, y
      // con este rastro la pantalla de conexión lo puede gritar.
      // La llave lleva `rechazo:` para no bloquear el reproceso del mismo aviso
      // si después llega bien firmado, y para que los reintentos no inflen la
      // tabla (chocan contra el índice único).
      await supabase.from('crm_webhook_eventos').insert({
        pasarela: 'mercadopago', evento_id: `rechazo:${topic}:${dataId}`, topic,
        procesado_at: new Date().toISOString(), resultado: 'rechazado',
        detalle: 'firma inválida: ' + v.motivo + ' (modo ' + cx.modo + ')',
        payload: { query: Object.fromEntries(url.searchParams), request_id: reqId },
      });
      return no('firma inválida: ' + v.motivo);
    }
    firmado = true;
  }

  // ── 1ª defensa: el evento ──
  // La llave es la IDENTIDAD del aviso, no el x-request-id: MP cambia ese header
  // en cada reintento, así que usarlo hacía que cada reintento se viera nuevo y
  // la primera defensa no frenaba nada. Se incluye `action` para no confundir dos
  // cambios de estado reales del mismo pago (pending → approved) con un reintento.
  const eventoId = `${topic}:${dataId}:${accion || 'sin-accion'}`;
  const { error: eDup } = await supabase.from('crm_webhook_eventos')
    .insert({ pasarela: 'mercadopago', evento_id: eventoId, topic, payload: { body, query: Object.fromEntries(url.searchParams), request_id: reqId } });
  if (eDup) {
    // Choque de índice único = ya lo procesamos. Es el caso NORMAL de un reintento.
    if (/duplicate key|23505/i.test(eDup.message || '')) return ok({ duplicado: true });
    return ok({ ignorado: 'no se pudo registrar el evento: ' + eDup.message });
  }

  const cerrar = async (resultado: string, detalle?: string) => {
    await supabase.from('crm_webhook_eventos')
      .update({ procesado_at: new Date().toISOString(), resultado, detalle: detalle || null })
      .eq('pasarela', 'mercadopago').eq('evento_id', eventoId);
  };

  try {
    // ── Cobro recurrente de una suscripción vinculada ──
    // Estos NO traen `external_reference` cuando la suscripción se creó en
    // Mercado Pago (que es el caso de las 38 que ya existían): el vínculo es el
    // preapproval_id guardado en la sub. Se resuelve el pago real y se sigue por
    // el mismo camino de abajo.
    let pagoIdReal = dataId;
    let subPorPreapproval: string | null = null;
    if (topic === 'subscription_authorized_payment') {
      const ap = await mpFetch('/authorized_payments/' + dataId, {}, cx);
      const pid = ap?.payment?.id || ap?.payment_id;
      const pre = ap?.preapproval_id;
      if (!pid) { await cerrar('ignorado', 'cobro sin pago asociado'); return ok({ ignorado: 'sin pago' }); }
      pagoIdReal = String(pid);
      if (pre) {
        const { data: sv } = await supabase.from('subscriptions').select('id').eq('mp_preapproval_id', String(pre)).maybeSingle();
        subPorPreapproval = sv?.id || null;
        if (!subPorPreapproval) {
          // Se cobró en MP pero nadie la ha vinculado: no se adivina de quién es.
          await cerrar('ok', 'cobro de una suscripción de MP sin vincular (' + pre + ')');
          return ok({ registrado: false, motivo: 'suscripción de MP sin vincular', preapproval_id: pre });
        }
      }
    } else if (topic === 'subscription_preapproval') {
      // Cambió el estado de la suscripción allá (cancelada, pausada). Se anota en
      // el timeline; cambiar el estado en el CRM automáticamente es decisión de
      // negocio y no se toma sola.
      const pre = await mpFetch('/preapproval/' + dataId, {}, cx);
      const { data: sv } = await supabase.from('subscriptions').select('id, company_id, nombre_plan').eq('mp_preapproval_id', String(dataId)).maybeSingle();
      if (sv) {
        await supabase.from('activities').insert({
          tipo: 'sistema', company_id: sv.company_id, automatico: true,
          titulo: `Mercado Pago: la suscripción ${sv.nombre_plan} cambió a "${pre?.status}"`,
          metadata: { audit: 'mp_preapproval', subscription_id: sv.id, estado_mp: pre?.status },
        }).select().maybeSingle();
      }
      await cerrar('ok', 'preapproval ' + dataId + ' → ' + pre?.status);
      return ok({ ok: true, preapproval: pre?.status });
    } else if (topic !== 'payment') {
      await cerrar('ignorado', 'topic ' + topic); return ok({ ignorado: topic });
    }

    const pago = await obtenerPago(pagoIdReal, cx);
    const estado = String(pago?.status || '');
    if (estado !== 'approved') { await cerrar('ignorado', 'estado ' + estado); return ok({ ignorado: estado }); }

    // ── 2ª defensa: el pago ──
    const { data: yaEsta } = await supabase.from('payments').select('id').eq('mp_payment_id', String(pago.id)).maybeSingle();
    if (yaEsta) { await cerrar('ignorado', 'pago ya registrado'); return ok({ duplicado: true }); }

    // `external_reference` es lo que amarra el pago con la suscripción; lo pone
    // el CRM al crear el link. Sin él no se adivina a quién pertenece: se guarda
    // como sin identificar y alguien lo asigna (eso es la Fase 6).
    const ref = String(pago?.external_reference || '');
    const m = ref.match(/^sub:([0-9a-f-]{36})(?::(.+))?$/i);
    // Dos vías para saber de quién es el pago: la referencia (links creados por
    // el CRM) o el vínculo con la suscripción de MP (las que ya existían allá).
    if (!m && !subPorPreapproval) {
      await cerrar('ok', 'pago sin referencia de suscripción — queda por identificar');
      return ok({ registrado: false, motivo: 'sin external_reference reconocible' });
    }

    const subId = subPorPreapproval || m![1];
    const periodo = m ? (m[2] || null) : null;
    const bruto = Number(pago?.transaction_amount || 0);
    // El pago se guarda BRUTO y la comisión aparte: si se guardara el neto, el
    // ARR reportaría de menos justo por lo que cobra Mercado Pago.
    const comision = Number(pago?.fee_details?.reduce?.((a: number, f: any) => a + Number(f.amount || 0), 0) || 0);

    const cuerpo = JSON.stringify({
        subscription_id: subId, monto: bruto,
        fecha: String(pago?.date_approved || '').slice(0, 10) || undefined,
        metodo: 'mercadopago', referencia: String(pago.id),
        periodo_cubierto: periodo || undefined,
        notas: `Mercado Pago · ${pago?.payment_method_id || ''} · ${firmado ? 'firma verificada' : 'SIN firma verificada'}`,
      pasarela: 'mercadopago', mp_payment_id: String(pago.id), comision, neto: bruto - comision,
    });
    // El handler solo usa `request`, así que un contexto sintético basta.
    const r = await registrarPago({
      request: new Request(new URL('/api/crm/arr/register-payment', request.url), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo,
      }),
    } as any) as Response;
    const j = await r.json().catch(() => ({}));
    // register-payment tiene su propio guard (mismo monto, misma sub, mismo
    // periodo) y contesta 409. Eso NO es un fallo: es la tercera defensa contra
    // el duplicado haciendo su trabajo. Tratarlo como error dejaría el evento
    // marcado en rojo y a alguien persiguiendo un problema que no existe.
    if (r.status === 409 && j?.duplicado) { await cerrar('ignorado', 'ya estaba registrado (' + j.payment_id + ')'); return ok({ duplicado: true }); }
    if (!r.ok || j?.error) { await cerrar('error', j?.error || ('HTTP ' + r.status)); return ok({ registrado: false, error: j?.error }); }

    // Dejar marcado con qué pasarela se cobra: si el pago no vino del link del
    // CRM (importado, o generado a mano en MP) la sub se quedaba sin bandera y
    // luego nadie sabe por dónde le cobra a ese cliente.
    try { await supabase.from('subscriptions').update({ pasarela_cobro: 'mercadopago' }).eq('id', subId).is('pasarela_cobro', null); } catch { /* no bloquea */ }
    await cerrar('ok', `pago ${pago.id} → sub ${subId}`);
    return ok({ registrado: true, payment_id: pago.id });
  } catch (e: any) {
    await cerrar('error', e?.message || String(e));
    // 200 aunque falle: el reintento no lo va a arreglar y la conciliación (Fase 6)
    // lo recupera. Lo que importa es que quedó registrado el error.
    return ok({ registrado: false, error: e?.message || String(e) });
  }
};
