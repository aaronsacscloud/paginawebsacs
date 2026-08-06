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
import { anotarCobro, avisarCobroFallido } from '../../../lib/pagos/cobros-mp';
import { registrarOportunidad } from '../../../lib/crm/oportunidades';
import { notificar } from '../../../lib/crm/notificaciones';

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
function firmaValida(headers: Headers, dataId: string | null, secreto: string): { ok: boolean; motivo?: string } {
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

  // La plantilla de MP es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y la
  // regla es que EL VALOR QUE NO VENGA se quita de la plantilla, no se rellena.
  //
  // Esto no era teoría: el aviso `?id=…&topic=merchant_order` del formato viejo
  // NO trae `data.id`, y aquí se estaba usando el `id` del query como si lo
  // fuera. La firma calculada llevaba un segmento que MP nunca firmó, así que
  // todos esos avisos se rechazaban con 401 — y peor, encendían la alarma de
  // "Mercado Pago está avisando y lo estamos rechazando", que es la que avisa de
  // pagos perdidos. Una alarma que suena sola deja de leerse.
  //
  // MP especifica el id en MINÚSCULAS cuando es alfanumérico. Con id numérico da
  // igual, pero los de suscripción no lo son y la firma fallaría.
  const manifiesto = (dataId ? `id:${String(dataId).toLowerCase()};` : '') + `request-id:${reqId};ts:${ts};`;
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
  // Se separan a propósito: para la FIRMA solo cuenta `data.id` (es lo único que
  // MP mete en la plantilla), mientras que para saber DE QUÉ habla el aviso
  // sirve igual el `id` suelto del formato viejo. Confundirlos hacía que se
  // firmara un manifiesto que MP nunca firmó.
  const firmaId = url.searchParams.get('data.id') || body?.data?.id || null;
  const dataId = String(firmaId || url.searchParams.get('id') || body?.id || '');
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
    const v = firmaValida(request.headers, firmaId ? String(firmaId) : null, cx.webhookSecret);
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
        // Se guarda la firma que MANDÓ MP (es un MAC, no un secreto): sin ella,
        // diagnosticar el siguiente rechazo obliga a esperar a que se repita.
        payload: {
          query: Object.fromEntries(url.searchParams), request_id: reqId,
          x_signature: request.headers.get('x-signature') || null,
          traia_data_id: !!firmaId,
        },
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
      const { data: sv } = await supabase.from('subscriptions').select('id, company_id, nombre_plan, precio, ciclo, estado').eq('mp_preapproval_id', String(dataId)).maybeSingle();
      if (sv) {
        await supabase.from('activities').insert({
          tipo: 'sistema', company_id: sv.company_id, automatico: true,
          titulo: `Mercado Pago: la suscripción ${sv.nombre_plan} cambió a "${pre?.status}"`,
          metadata: { audit: 'mp_preapproval', subscription_id: sv.id, estado_mp: pre?.status },
        }).select().maybeSingle();

        // Dejó de cobrarse allá y aquí sigue contando en el ARR. El estado del
        // CRM NO se cambia solo —cancelar una suscripción es decisión de
        // negocio, y una cancelación en MP a veces es un cambio de tarjeta—
        // pero sí se abre la alerta: mientras nadie decida, el ARR está
        // reportando dinero que ya no va a entrar.
        if ((pre?.status === 'cancelled' || pre?.status === 'paused')
            && (sv.estado === 'activa' || sv.estado === 'pendiente_pago')) {
          const cancelada = pre.status === 'cancelled';
          const mensual = sv.ciclo === 'anual' ? Number(sv.precio || 0) / 12 : Number(sv.precio || 0);
          await registrarOportunidad({
            company_id: sv.company_id, tipo: cancelada ? 'mp_cancelada' : 'mp_pausada',
            titulo: cancelada
              ? `Canceló su suscripción en Mercado Pago (${sv.nombre_plan})`
              : `Pausó su suscripción en Mercado Pago (${sv.nombre_plan})`,
            detalle: `En el CRM sigue como "${sv.estado}" y sumando $${Math.round(mensual).toLocaleString('es-MX')} al mes de ARR. Mientras nadie decida, ese ingreso está reportado y no va a entrar.`,
            accion: cancelada
              ? 'Llámale antes de darla de baja: muchas cancelaciones en MP son un cambio de tarjeta, no una salida.'
              : 'Confirma si es una pausa acordada; si lo es, pásala a pausada aquí para que deje de contar.',
            peso: cancelada ? 95 : 78,
            valor: Math.round(mensual * 12),
            metadata: { subscription_id: sv.id, estado_mp: pre?.status },
          });
          await notificar({
            clave: `mp_preapproval:${dataId}:${pre?.status}`,
            tipo: 'mp_preapproval', nivel: 'urgente',
            titulo: cancelada
              ? `🔕 Canceló su domiciliación de Mercado Pago (${sv.nombre_plan})`
              : `⏸ Pausó su domiciliación de Mercado Pago (${sv.nombre_plan})`,
            detalle: `En el CRM sigue como "${sv.estado}" y sumando al ARR. Muchas cancelaciones en MP son un cambio de tarjeta: confirma antes de darla de baja.`,
            monto: Number(sv.precio || 0),
            company_id: sv.company_id, subscription_id: sv.id,
            metadata: { estado_mp: pre?.status },
          });
        }
      }
      await cerrar('ok', 'preapproval ' + dataId + ' → ' + pre?.status);
      return ok({ ok: true, preapproval: pre?.status });
    } else if (topic !== 'payment') {
      await cerrar('ignorado', 'topic ' + topic); return ok({ ignorado: topic });
    }

    const pago = await obtenerPago(pagoIdReal, cx);

    // ── ¿Este pago es un COBRO nuestro, o un gasto propio? ──
    // La misma cuenta de Mercado Pago se usa para cobrarle a los clientes y para
    // pagar cosas: en julio, 26 de 40 movimientos eran gastos (Oxxo, Petco,
    // anuncios, mensualidades de Mercado Crédito). Sin este filtro, el súper del
    // sábado terminaría en la bandeja de "pagos por identificar" y la volvería
    // inservible — que es justo como se muere una bandeja de pendientes.
    const { data: px } = await supabase.from('crm_pasarelas').select('mp_user_id').eq('pasarela', 'mercadopago').maybeSingle();
    const nuestro = String(px?.mp_user_id || '');
    if (nuestro && pago?.collector_id != null && String(pago.collector_id) !== nuestro) {
      await cerrar('ignorado', 'no es un cobro nuestro (cobrador ' + pago.collector_id + ')');
      return ok({ ignorado: 'movimiento propio, no un cobro a un cliente' });
    }

    const estado = String(pago?.status || '');

    // ── El cobro NO pasó ──
    // Antes esto se ignoraba en una línea. Es la señal más temprana que existe
    // de que un cliente que paga se va a caer este mes: llega el día del rebote,
    // no cuando alguien nota que no entró el dinero.
    if (estado !== 'approved') {
      // Solo interesan los rechazos definitivos: `in_process`/`pending` todavía
      // pueden aprobarse y avisar de ellos sería una falsa alarma diaria.
      if (estado === 'rejected' || estado === 'cancelled') {
        let sub: any = null;
        if (subPorPreapproval) {
          const { data } = await supabase.from('subscriptions').select('id, company_id, nombre_plan, precio').eq('id', subPorPreapproval).maybeSingle();
          sub = data;
        } else {
          const mr = String(pago?.external_reference || '').match(/^sub:([0-9a-f-]{36})/i);
          if (mr) {
            const { data } = await supabase.from('subscriptions').select('id, company_id, nombre_plan, precio').eq('id', mr[1]).maybeSingle();
            sub = data;
          }
        }
        const nuevo = await anotarCobro({
          mp_payment_id: String(pago.id), preapproval_id: subPorPreapproval ? String(dataId) : null,
          subscription_id: sub?.id || null, company_id: sub?.company_id || null,
          payer_email: pago?.payer?.email || null, monto: Number(pago?.transaction_amount || 0),
          moneda: pago?.currency_id, estado, detalle_estado: pago?.status_detail || null,
          metodo: pago?.payment_method_id || null,
          fecha: pago?.date_created || pago?.date_last_updated || null,
          external_reference: pago?.external_reference || null,
        });
        // Solo se avisa la PRIMERA vez que se ve este cobro: MP reintenta el
        // aviso y tres alertas del mismo rebote no son tres problemas.
        if (nuevo && sub?.company_id) {
          const { count } = await supabase.from('crm_cobros_mp')
            .select('id', { count: 'exact', head: true })
            .eq('subscription_id', sub.id).eq('estado', 'rejected')
            .gte('fecha', new Date(Date.now() - 45 * 86400000).toISOString());
          await avisarCobroFallido({
            company_id: sub.company_id, subscription_id: sub.id, nombre_plan: sub.nombre_plan,
            monto: Number(pago?.transaction_amount || 0), detalle_estado: pago?.status_detail || null,
            payer_email: pago?.payer?.email || null, intentos: count || 1,
            mp_payment_id: String(pago.id),
          });
        }
        await cerrar('ok', 'cobro rechazado (' + (pago?.status_detail || estado) + ')' + (sub ? ' · sub ' + sub.id : ' · sin identificar'));
        return ok({ rechazado: true, motivo: pago?.status_detail || estado });
      }
      await cerrar('ignorado', 'estado ' + estado); return ok({ ignorado: estado });
    }

    // ── 2ª defensa: el pago ──
    const { data: yaEsta } = await supabase.from('payments').select('id').eq('mp_payment_id', String(pago.id)).maybeSingle();
    if (yaEsta) { await cerrar('ignorado', 'pago ya registrado'); return ok({ duplicado: true }); }

    // `external_reference` es lo que amarra el pago con la suscripción; lo pone
    // el CRM al crear el link. Sin él no se adivina a quién pertenece: se guarda
    // como sin identificar y alguien lo asigna (eso es la Fase 6).
    const ref = String(pago?.external_reference || '');
    const m = ref.match(/^sub:([0-9a-f-]{36})(?::(.+))?$/i);

    // TERCERA vía, y la que resuelve los cobros de verdad: los cargos
    // recurrentes llegan con topic `payment` —no `subscription_authorized_payment`—
    // y sin referencia. Lo único que dice de qué suscripción salieron es
    // `metadata.preapproval_id`. Sin leerlo, cada mensualidad de una suscripción
    // ya vinculada caía en la bandeja como si nadie supiera de quién era.
    if (!m && !subPorPreapproval && pago?.metadata?.preapproval_id) {
      const { data: sv } = await supabase.from('subscriptions').select('id')
        .eq('mp_preapproval_id', String(pago.metadata.preapproval_id)).maybeSingle();
      if (sv) subPorPreapproval = sv.id;
    }
    // Dos vías para saber de quién es el pago: la referencia (links creados por
    // el CRM) o el vínculo con la suscripción de MP (las que ya existían allá).
    if (!m && !subPorPreapproval) {
      // Alguien PAGÓ y no sabemos a quién acreditárselo. Antes se contestaba 200
      // y ahí moría: el dinero entraba a la cuenta de MP y el cliente seguía
      // apareciendo como moroso. Ahora cae en la bandeja para que una persona lo
      // asigne, que es lo único que puede resolverlo.
      await anotarCobro({
        mp_payment_id: String(pago.id), payer_email: pago?.payer?.email || null,
        monto: Number(pago?.transaction_amount || 0), moneda: pago?.currency_id,
        estado: 'approved', metodo: pago?.payment_method_id || null,
        fecha: pago?.date_approved || pago?.date_created || null,
        external_reference: pago?.external_reference || null,
      });
      // Dinero que YA está en la cuenta y que nadie sabe de quién es: mientras
      // no se asigne, ese cliente sigue apareciendo como moroso.
      await notificar({
        clave: `pago_sin_dueno:${pago.id}`,
        tipo: 'pago_sin_identificar', nivel: 'alerta',
        titulo: `❓ Entró un pago de $${Number(pago?.transaction_amount || 0).toLocaleString('es-MX')} y no sé de quién es`,
        detalle: `${pago?.payer?.email || 'sin correo del pagador'} · asígnalo en Cobro con Mercado Pago para que deje de verse como moroso.`,
        monto: Number(pago?.transaction_amount || 0),
        destino: 'cobros', metadata: { mp_payment_id: String(pago.id) },
      });
      await cerrar('ok', 'pago sin referencia de suscripción — a la bandeja de sin identificar');
      return ok({ registrado: false, motivo: 'sin external_reference reconocible', a_bandeja: true });
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

    // ── Desfase de precio ──
    // Lo que MP cobra y lo que la suscripción dice pueden separarse: se subió el
    // plan y nadie lo actualizó allá, o al revés. El ARR reportado queda falso y
    // no lo delata nada. Se anota en la suscripción para poder señalarlo donde
    // se ve, y en el timeline para saber desde cuándo.
    // ── La campana ──
    // Un cargo domiciliado entra de madrugada, se registra y la próxima factura
    // avanza sin que nadie toque nada. Es justo lo que hace que nadie se entere
    // de que ese cliente ya pagó — ni de cuánto entró este mes.
    try {
      const { data: sv } = await supabase.from('subscriptions')
        .select('nombre_plan, ciclo, proxima_factura, company_id, companies(nombre)').eq('id', subId).maybeSingle();
      const emp: any = Array.isArray(sv?.companies) ? sv?.companies[0] : sv?.companies;
      // Domiciliado (se cobró solo) vs link que alguien mandó: para quien lee la
      // campana no es lo mismo "ya se cobró otra vez" que "por fin pagó".
      const automatico = !!(subPorPreapproval || pago?.metadata?.preapproval_id);
      await notificar({
        clave: `pago_mp:${pago.id}`,
        tipo: automatico ? 'pago_mp_automatico' : 'pago_mp', nivel: 'info',
        titulo: `${automatico ? '🔁 Se cobró solo' : '💚 Pagó por Mercado Pago'}: ${emp?.nombre || 'un cliente'} · $${bruto.toLocaleString('es-MX')}`,
        detalle: `${sv?.nombre_plan || 'Suscripción'}${sv?.ciclo ? ' · ' + sv.ciclo : ''}`
          + (sv?.proxima_factura ? ` · siguiente cobro ${sv.proxima_factura}` : '')
          + (comision > 0 ? ` · comisión $${Math.round(comision).toLocaleString('es-MX')}` : ''),
        monto: bruto,
        company_id: sv?.company_id || null, subscription_id: subId,
        payment_id: j?.payment_id || null, destino: 'pagos',
        metadata: { mp_payment_id: String(pago.id), automatico, comision },
      });
    } catch (e: any) { console.error('[mp-webhook] aviso de pago:', e?.message || e); }

    try {
      const { data: sub } = await supabase.from('subscriptions')
        .select('id, company_id, nombre_plan, precio, mp_monto_cobrado').eq('id', subId).maybeSingle();
      if (sub) {
        const esperado = Number(sub.precio || 0);
        // Un peso de diferencia es redondeo, no un desfase: se tolera 1%.
        const desfasado = esperado > 0 && Math.abs(bruto - esperado) > Math.max(1, esperado * 0.01);
        await supabase.from('subscriptions').update({
          mp_monto_cobrado: bruto,
          mp_desfase_at: desfasado ? new Date().toISOString() : null,
        }).eq('id', subId);
        // Solo se avisa cuando CAMBIA, no en cada cobro mensual del mismo desfase.
        if (desfasado && Number(sub.mp_monto_cobrado || 0) !== bruto) {
          const dif = bruto - esperado;
          await supabase.from('activities').insert({
            tipo: 'sistema', company_id: sub.company_id, automatico: true,
            titulo: `⚠️ Mercado Pago cobró $${bruto.toLocaleString('es-MX')} y la suscripción dice $${esperado.toLocaleString('es-MX')} (${dif > 0 ? '+' : ''}$${dif.toLocaleString('es-MX')})`,
            descripcion: dif < 0
              ? 'Se está cobrando de MENOS: el ARR reportado está inflado por esa diferencia.'
              : 'Se está cobrando de MÁS de lo que dice el CRM. Revisa cuál de los dos está mal antes de que el cliente lo note.',
            metadata: { audit: 'mp_desfase_precio', subscription_id: subId, cobrado: bruto, esperado },
          }).select().maybeSingle();
          await notificar({
            clave: `mp_desfase:${subId}:${bruto}`,
            tipo: 'mp_desfase_precio', nivel: 'alerta',
            titulo: `⚠️ Mercado Pago cobró $${bruto.toLocaleString('es-MX')} y la suscripción dice $${esperado.toLocaleString('es-MX')}`,
            detalle: dif < 0
              ? 'Se está cobrando de MENOS: el ARR reportado está inflado por esa diferencia.'
              : 'Se está cobrando de MÁS de lo que dice el CRM. Revisa cuál de los dos está mal antes de que el cliente lo note.',
            monto: bruto, company_id: sub.company_id, subscription_id: subId,
            metadata: { cobrado: bruto, esperado },
          });
        }
      }
    } catch (e: any) { console.error('[mp-webhook] desfase de precio:', e?.message || e); }

    await cerrar('ok', `pago ${pago.id} → sub ${subId}`);
    return ok({ registrado: true, payment_id: pago.id });
  } catch (e: any) {
    await cerrar('error', e?.message || String(e));
    // 200 aunque falle: el reintento no lo va a arreglar y la conciliación (Fase 6)
    // lo recupera. Lo que importa es que quedó registrado el error.
    return ok({ registrado: false, error: e?.message || String(e) });
  }
};
