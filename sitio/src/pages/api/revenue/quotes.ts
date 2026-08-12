import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { validatePartnerQuoteBody, canPartnerEditQuote, canPartnerDeleteQuote } from '../../../lib/quotes/permissions';
import { parseMeta, serializeMeta, addTimelineEvent } from '../../../lib/quotes/meta';

export const prerender = false;

// Only pass known DB columns to avoid PostgREST errors
const QUOTE_FIELDS = [
  'empresa', 'contacto', 'email', 'whatsapp', 'items', 'iva_incluido',
  'descuento_global', 'descuento_tipo', 'moneda', 'template', 'condiciones',
  'vigencia', 'estado', 'subtotal', 'iva_monto', 'total', 'notas',
  'bank_account_id', 'mostrar_banco', 'link_pago', 'urgencia',
  'aceptado_por', 'aceptado_fecha',
  // Partner authorship
  'partner_id', 'created_via',
  // Ligado a CRM (match cliente/contacto desde el alta de cliente)
  'company_id', 'contact_id',
];

function pick(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
  }
  return result;
}

function jsonResponse(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const id = url.searchParams.get('id');

  // Cuánto lleva abonado cada cotización: es lo único que permite distinguir
  // "Enviada" de "Pago parcial" en la lista. Sin esto, una cotización con
  // anticipo se sigue viendo como si el cliente no hubiera pagado nada.
  const conAbonos = async (filas: any[]) => {
    const ids = (filas || []).map((q: any) => q.id);
    if (!ids.length) return filas;
    const { data: pagos } = await supabase.from('payments').select('quote_id, monto').in('quote_id', ids);
    const m = new Map<string, number>();
    for (const p of pagos || []) m.set(p.quote_id, (m.get(p.quote_id) || 0) + Number(p.monto || 0));
    return (filas || []).map((q: any) => ({ ...q, abonado: Math.round((m.get(q.id) || 0) * 100) / 100 }));
  };


  if (id) {
    // Public URL access needed (e.g., client accepting quote) — don't enforce scope on single lookup
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single();
    if (error) return jsonResponse({ error: error.message }, 404);
    return jsonResponse(data);
  }

  // Partner scope: cotizaciones donde partner_id = user.id, con fallback legacy
  // (deal.owner_id / contact.owner_id) para cotizaciones previas a la migración.
  if (user && user.role === 'partner') {
    const { data: ownedDeals } = await supabase.from('deals').select('id').eq('owner_id', user.id);
    const dealIds = (ownedDeals || []).map((d: any) => d.id);
    const { data: ownedContacts } = await supabase.from('contacts').select('id').eq('owner_id', user.id);
    const contactIds = (ownedContacts || []).map((c: any) => c.id);

    const orParts: string[] = [`partner_id.eq.${user.id}`];
    if (dealIds.length) orParts.push(`deal_id.in.(${dealIds.join(',')})`);
    if (contactIds.length) orParts.push(`contact_id.in.(${contactIds.join(',')})`);

    const { data, error } = await supabase
      .from('quotes').select('*')
      .or(orParts.join(','))
      .neq('estado', 'deleted') // ocultar archivadas de la lista
      .order('created_at', { ascending: false });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse(await conAbonos(data || []));
  }

  // ?archivadas=1 → SOLO las archivadas. El archivo existe justo para que nada
  // se pierda: se sacan de la vista activa, no de la base.
  if (url.searchParams.get('archivadas') === '1') {
    const { data, error } = await supabase.from('quotes').select('*')
      .eq('estado', 'deleted').order('created_at', { ascending: false });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse(await conAbonos(data || []));
  }

  // Founder/cs see all. Unauthenticated preserves legacy behavior (admin UI without auth header).
  const { data, error } = await supabase.from('quotes').select('*')
    .neq('estado', 'deleted') // ocultar archivadas de la lista
    .neq('estado', 'plantilla') // las plantillas de partner no son cotizaciones reales
    .order('created_at', { ascending: false });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse(await conAbonos(data || []));
};

async function getMaxFolio(): Promise<number> {
  const { data } = await supabase.from('quotes').select('numero');
  let max = 0;
  if (Array.isArray(data)) {
    for (const row of data) {
      const m = String(row?.numero || '').match(/(\d+)\s*$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return max;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json();

  // Validación de permisos del partner ANTES de limpiar
  if (user?.role === 'partner') {
    const permErr = validatePartnerQuoteBody(user, body);
    if (permErr) return jsonResponse({ error: permErr.message, code: permErr.code }, permErr.status);
  }

  const clean = pick(body, QUOTE_FIELDS);

  // Si el actor es un partner, forzamos partner_id = user.id y created_via = 'partner_portal'
  // (no confiamos en lo que mande el body).
  if (user?.role === 'partner') {
    clean.partner_id = user.id;
    clean.created_via = 'partner_portal';
  } else if (!clean.created_via) {
    clean.created_via = 'admin';
  }

  // Folio configurado = mínimo inicial (solo aplica cuando no hay folios más altos ya usados)
  const folioStart = (parseInt(body._folio_offset) || 0) + 1;

  const vigencia = clean.vigencia || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const estado = clean.estado || 'draft';

  // ── Qué era el cotizante HOY ──
  // Se congela al crear y no se vuelve a tocar. Si se dedujera al leer, un lead
  // que compra se convierte en cliente y su cotización pasaría a contarse "de
  // cliente" hacia atrás: el mes en que trajiste cuentas nuevas se vería vacío.
  // Lo decide el servidor desde la ficha del cliente, no el navegador.
  if (!clean.origen_cotizante) {
    if (!clean.company_id) clean.origen_cotizante = 'sin_ligar';
    else {
      const { data: co } = await supabase.from('companies').select('estado_cuenta').eq('id', clean.company_id).maybeSingle();
      const ec = co?.estado_cuenta;
      clean.origen_cotizante = ec === 'activo' ? 'cliente' : (ec === 'cancelado' || ec === 'vencido') ? 'excliente' : 'lead';
    }
  }

  // Las PLANTILLAS del partner no consumen folio COT-xxx (no son cotizaciones reales)
  if (estado === 'plantilla') {
    const { data, error } = await supabase.from('quotes').insert({
      ...clean, numero: 'PLANTILLA', vigencia, estado,
    }).select().single();
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse(data, 201);
  }

  // Intento con reintentos por si hay colisión (race o UNIQUE constraint)
  const MAX_TRIES = 6;
  let lastErr: any = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const maxExisting = await getMaxFolio();
    const nextNum = Math.max(maxExisting + 1, folioStart) + attempt;
    const num = `COT-${String(nextNum).padStart(3, '0')}`;

    const { data, error } = await supabase.from('quotes').insert({
      ...clean,
      numero: num,
      vigencia,
      estado,
    }).select().single();

    if (!error) {
      // ── Crear una cotización TAMBIÉN crea su oportunidad ──
      // El puente vivía solo en el PUT (al pasar de borrador a enviada), así que
      // una cotización nacida ya como "enviada" —el flujo normal del botón
      // "Crear y enviar"— nunca generaba oportunidad. Es exactamente lo que se
      // reportó: se cotiza y no aparece nada en el cliente.
      try {
        if (['draft', 'sent', 'accepted'].includes(String(data?.estado))) {
          const { syncQuoteToDeal } = await import('../../../lib/crm/sync-quote-deal');
          const etapa = data.estado === 'accepted' ? 'negociacion'
            : data.estado === 'sent' ? 'cotizacion_enviada' : 'calificacion';
          await syncQuoteToDeal(data.id, {
            targetStage: etapa as any, valor_total: Math.round(data.total || 0), trigger: 'quote_created',
          });
        }
      } catch (e) { console.error('[quotes POST] oportunidad:', e); }
      return jsonResponse(data, 201);
    }
    lastErr = error;
    // 23505 = unique_violation de Postgres; si no es eso, no tiene sentido reintentar
    if (error.code !== '23505') break;
  }

  return jsonResponse({ error: lastErr?.message || 'No se pudo asignar folio' }, 500);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json();
  const { id } = body;
  if (!id) return jsonResponse({ error: 'id requerido' }, 400);

  // Fetch previous state before update (also for ownership / lock checks)
  const { data: prev } = await supabase
    .from('quotes')
    .select('estado, deal_id, total, partner_id')
    .eq('id', id)
    .single();

  if (!prev) return jsonResponse({ error: 'cotización no encontrada' }, 404);

  // Ownership / permission checks para partner
  if (user?.role === 'partner') {
    if (prev.partner_id && prev.partner_id !== user.id) {
      return jsonResponse({ error: 'no autorizado' }, 403);
    }

    // Transición PURA a 'paid': marcar cobrada una cotización enviada/aceptada.
    // Es la ÚNICA escritura permitida sobre una quote "locked" (aceptada), y solo
    // si el body no trae NADA más que el estado — marcar pagada ≠ editar contenido.
    const extraKeys = Object.keys(body).filter((k) => k !== 'id' && k !== 'estado');
    if (body.estado === 'paid' && extraKeys.length === 0) {
      if (!['sent', 'accepted'].includes(String(prev.estado || ''))) {
        return jsonResponse({
          error: `Solo puedes marcar como pagada una cotización enviada o aceptada (esta está ${prev.estado}).`,
          code: 'invalid_paid_transition',
        }, 409);
      }
      const { data: full } = await supabase.from('quotes').select('notas').eq('id', id).single();
      // El timestamp del evento 'paid' en el timeline es la fecha de pago que
      // usan los resultados por periodo — no solo auditoría.
      const notas = addTimelineEvent(full?.notas || null, 'paid');
      const { data: paidData, error: paidErr } = await supabase
        .from('quotes')
        .update({ estado: 'paid', notas })
        .eq('id', id)
        .select()
        .single();
      if (paidErr) return jsonResponse({ error: paidErr.message }, 500);
      return jsonResponse(paidData);
    }

    if (!canPartnerEditQuote(prev.estado)) {
      return jsonResponse({
        error: `No puedes editar una cotización ${prev.estado}`,
        code: 'quote_locked',
      }, 409);
    }
    const permErr = validatePartnerQuoteBody(user, body);
    if (permErr) return jsonResponse({ error: permErr.message, code: permErr.code }, permErr.status);
  }

  const clean = pick(body, QUOTE_FIELDS);

  // Partner no puede reasignar partner_id ni cambiar created_via
  if (user?.role === 'partner') {
    delete clean.partner_id;
    delete clean.created_via;
  }

  // El origen se congela una sola vez. Si la cotización nació sin cliente y
  // apenas ahora se liga, este es el mejor momento disponible para fijarlo; si
  // ya lo tiene, no se toca aunque el cliente haya cambiado de estado después.
  if (clean.company_id) {
    const { data: prev } = await supabase.from('quotes').select('origen_cotizante').eq('id', id).maybeSingle();
    if (!prev?.origen_cotizante) {
      const { data: co } = await supabase.from('companies').select('estado_cuenta').eq('id', clean.company_id).maybeSingle();
      const ec = co?.estado_cuenta;
      clean.origen_cotizante = ec === 'activo' ? 'cliente' : (ec === 'cancelado' || ec === 'vencido') ? 'excliente' : 'lead';
    }
  }

  // ─── Paquetes A/B: al ACEPTAR con opción elegida, fijar items y totales ───
  // La cotización multi-opción guarda total = paquete recomendado; cuando el
  // cliente acepta una opción concreta, el documento queda con ESE paquete
  // (los precios los recalcula el server — nunca el navegador del cliente).
  try {
    if (clean.estado === 'accepted' && typeof clean.notas === 'string') {
      const { meta } = parseMeta(clean.notas);
      const paqs = Array.isArray(meta?.paquetes) ? meta.paquetes : null;
      const opcion = meta?.opcion_elegida;
      if (paqs && paqs.length >= 2 && opcion && paqs.some((p: any) => p.id === opcion)) {
        const { data: full } = await supabase.from('quotes')
          .select('items, descuento_global, descuento_tipo, iva_incluido')
          .eq('id', id).single();
        const allItems = Array.isArray(full?.items) ? full.items : [];
        const chosen = allItems.filter((it: any) => !it.paquete || it.paquete === opcion);
        if (chosen.length > 0) {
          const ivaMode = meta.iva_mode || (full?.iva_incluido ? 'suma' : 'sin');
          const { calcQuoteTotals } = await import('../../../lib/quotes/totals');
          const t = calcQuoteTotals({
            items: chosen,
            descuento_global: full?.descuento_global,
            descuento_tipo: full?.descuento_tipo,
            iva_mode: ivaMode,
          });
          clean.items = chosen;
          clean.subtotal = t.itemsSubtotal;
          clean.iva_monto = Math.round(t.ivaMonto);
          clean.total = Math.round(t.grandTotal);
        }
      }
    }
  } catch (e) {
    console.error('[quotes PUT] paquete resolve error:', e);
  }

  // ── Historial de cambios (qué cambió, quién y cuándo) ──
  // Editar sobrescribía sin dejar rastro: nadie podía decir después si el
  // precio bajó porque se pactó o porque alguien se equivocó al teclear. Se
  // graba solo lo que DE VERDAD cambió, en lenguaje legible; los campos de
  // control (notas, estado interno) no ensucian el historial.
  try {
    const { data: antes } = await supabase.from('quotes')
      .select('total, subtotal, descuento_global, vigencia, empresa, contacto, email, whatsapp, moneda, items, notas')
      .eq('id', id).maybeSingle();
    if (antes) {
      // El historial guarda CAMPOS y CONCEPTOS por separado. Antes decía "se
      // editaron los conceptos (2)", que es como no decir nada: lo que importa
      // no es cuántos se tocaron, sino cuál bajó de precio y cuál se quitó.
      const campos: { k: string; antes: string; despues: string }[] = [];
      const dinero = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX');
      const cmp = (k: string, a: any, b: any, fmt = (x: any) => String(x ?? '—')) => {
        if (b === undefined) return;
        if (String(a ?? '') === String(b ?? '')) return;
        campos.push({ k, antes: fmt(a), despues: fmt(b) });
      };
      cmp('Total', antes.total, clean.total, dinero);
      cmp('Vigencia', antes.vigencia, clean.vigencia);
      cmp('Descuento', antes.descuento_global, clean.descuento_global, dinero);
      cmp('Cliente', antes.empresa, clean.empresa);
      cmp('Contacto', antes.contacto, clean.contacto);
      cmp('Correo', antes.email, clean.email);
      cmp('WhatsApp', antes.whatsapp, clean.whatsapp);
      cmp('Moneda', antes.moneda, clean.moneda);

      // Conceptos, comparados por NOMBRE: es la única llave estable que tienen
      // (no llevan id), y renombrar un concepto se lee como quitar uno y poner
      // otro — que es exactamente lo que pasó.
      const conceptos: { op: 'mod' | 'add' | 'del'; nombre: string; antes?: string; despues?: string }[] = [];
      if (clean.items !== undefined) {
        const monto = (i: any) => Number(i?.subtotal ?? i?.monto ?? 0);
        const mapa = (arr: any[]) => new Map((Array.isArray(arr) ? arr : []).map((i: any) => [String(i?.nombre || '').trim().toLowerCase(), i]));
        const mA = mapa(antes.items as any[]); const mD = mapa(clean.items);
        for (const [k, i] of mD) {
          const prev = mA.get(k);
          if (!prev) conceptos.push({ op: 'add', nombre: i.nombre, despues: dinero(monto(i)) });
          else if (monto(prev) !== monto(i)) conceptos.push({ op: 'mod', nombre: i.nombre, antes: dinero(monto(prev)), despues: dinero(monto(i)) });
        }
        for (const [k, i] of mA) if (!mD.has(k)) conceptos.push({ op: 'del', nombre: i.nombre, antes: dinero(monto(i)) });
      }

      // Se conserva `cambios` en texto para que el historial viejo y el nuevo se
      // sigan leyendo con el mismo código.
      const cambios: string[] = [
        ...campos.map(c => `${c.k}: ${c.antes} → ${c.despues}`),
        ...conceptos.map(c => c.op === 'add' ? `Agregado: ${c.nombre} ${c.despues}`
          : c.op === 'del' ? `Quitado: ${c.nombre} ${c.antes}`
          : `${c.nombre}: ${c.antes} → ${c.despues}`),
      ];

      if (cambios.length) {
        const { text: tx, meta: mt } = parseMeta(antes.notas);
        mt.cambios = [
          { at: new Date().toISOString(), por: user?.nombre || user?.email || 'admin', cambios, campos, conceptos },
          ...(mt.cambios || []),
        ].slice(0, 200);
        // Se escribe ANTES del update principal para no pisar `clean.notas` si
        // la edición también trae notas; si las trae, gana la del formulario y
        // el historial se reintenta después.
        if (clean.notas === undefined) clean.notas = serializeMeta(tx, mt);
        else {
          const { text: tx2, meta: mt2 } = parseMeta(clean.notas);
          mt2.cambios = mt.cambios;
          clean.notas = serializeMeta(tx2, mt2);
        }
      }
    }
  } catch (e) { console.error('[quotes PUT] historial de cambios:', e); }

  const { data, error } = await supabase.from('quotes').update(clean).eq('id', id).select().single();

  if (error) return jsonResponse({ error: error.message }, 500);

  // ─── Sync to deal (non-blocking on errors) ───
  try {
    const { syncQuoteToDeal, advanceDealStage } = await import('../../../lib/crm/sync-quote-deal');
    const items = Array.isArray(data?.items) ? data.items : [];
    const monthlyPlan = items.filter((i: any) => i.tipo === 'plan' && i.periodo === 'mensual')
      .reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    const recurMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual')
      .reduce((s: number, i: any) => s + (i.monto || 0), 0);
    const valorMensual = Math.round(monthlyPlan + recurMonthly);
    const valorTotal = Math.round(data?.total || 0);

    // Draft → sent transition: advance deal to cotizacion_enviada
    const transitionedToSent = prev && prev.estado !== 'sent' && data?.estado === 'sent';
    if (transitionedToSent) {
      // Timeline: registrar "cotización enviada" (antes no quedaba huella en activities)
      try {
        await supabase.from('activities').insert({
          company_id: data.company_id || null, contact_id: data.contact_id || null,
          deal_id: data.deal_id || null, quote_id: id,
          tipo: 'cotizacion', titulo: `Cotización ${data.numero || ''} enviada · $${Math.round(data.total || 0).toLocaleString()}`,
          metadata: { event: 'cotizacion_enviada', quote_id: id, total: data.total },
          automatico: true,
        });
      } catch { /* nunca bloquea el envío */ }
      if (data?.deal_id) {
        await advanceDealStage(data.deal_id, 'cotizacion_enviada', {
          valor_total: valorTotal, valor_mensual: valorMensual, trigger: 'quote_sent',
        });
      } else {
        await syncQuoteToDeal(id, {
          targetStage: 'cotizacion_enviada', valor_total: valorTotal, valor_mensual: valorMensual, trigger: 'quote_sent',
        });
      }
    } else if (data?.deal_id && (valorTotal !== (prev?.total || 0))) {
      // Total changed → sync deal amounts without moving stage
      await supabase.from('deals').update({ valor_total: valorTotal, valor_mensual: valorMensual }).eq('id', data.deal_id);
    } else if (!data?.deal_id && data?.company_id && ['draft', 'sent', 'accepted'].includes(String(data?.estado))) {
      // ── Ligar un cliente TAMBIÉN crea la oportunidad ──
      // El puente solo se disparaba al pasar de borrador a enviada. Si la
      // cotización ya estaba enviada y apenas ahora se le liga el cliente —el
      // caso de las 32 que existen— la oportunidad no nacía nunca y la ficha del
      // cliente se veía vacía aunque tuviera cotizaciones vivas por miles.
      const etapa = data.estado === 'accepted' ? 'negociacion'
        : data.estado === 'sent' ? 'cotizacion_enviada' : 'calificacion';
      await syncQuoteToDeal(id, {
        targetStage: etapa as any, valor_total: valorTotal, valor_mensual: valorMensual, trigger: 'quote_linked',
      });
    }
  } catch (syncErr) {
    console.error('[quotes PUT] deal sync error:', syncErr);
  }

  return jsonResponse(data);
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);

  // id por query (?id=) o por body, para flexibilidad del cliente.
  let id = url.searchParams.get('id');
  if (!id) {
    try { const body = await request.json(); id = body?.id; } catch (e) { /* sin body */ }
  }
  if (!id) return jsonResponse({ error: 'id requerido' }, 400);

  const { data: prev } = await supabase
    .from('quotes')
    .select('id, estado, deal_id, partner_id, notas')
    .eq('id', id)
    .single();

  if (!prev) return jsonResponse({ error: 'cotización no encontrada' }, 404);

  // Ownership + estado — SIN RLS en la tabla, este check en app es la ÚNICA barrera
  // contra que un partner borre cotizaciones de otro partner.
  if (user?.role === 'partner') {
    if (prev.partner_id && prev.partner_id !== user.id) {
      return jsonResponse({ error: 'no autorizado' }, 403);
    }
    if (!canPartnerDeleteQuote(prev.estado)) {
      return jsonResponse({
        error: `No puedes eliminar una cotización ${prev.estado}: ya tiene implicaciones de pago.`,
        code: 'quote_not_deletable',
      }, 409);
    }
  }

  const estado = String(prev.estado || '');
  // Borrado real para borradores y plantillas (ninguno tiene valor histórico)
  const isDraft = estado === 'draft' || estado === 'plantilla';

  // Desvincular el deal para no dejar referencias colgando (deals.quote_id es uuid sin FK).
  if (prev.deal_id) {
    try {
      await supabase.from('deals').update({ quote_id: null }).eq('id', prev.deal_id).eq('quote_id', id);
    } catch (e) {
      console.error('[quotes DELETE] no se pudo desvincular el deal:', e);
    }
  }

  if (isDraft) {
    // Borrado REAL: un borrador no tiene valor histórico. payments/invoices con
    // quote_id están declarados ON DELETE SET NULL, así que no rompe auditoría.
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, mode: 'deleted' });
  }

  // ARCHIVADO (soft): estado='deleted' + guardamos el estado previo en la meta
  // para poder restaurar y para auditoría. Se oculta de las listas (GET filtra 'deleted').
  const { text, meta } = parseMeta(prev.notas || '');
  meta.deleted_from = estado;
  meta.deleted_at = new Date().toISOString();
  if (user?.id) meta.deleted_by = user.id;

  const { error } = await supabase.from('quotes')
    .update({ estado: 'deleted', notas: serializeMeta(text, meta) })
    .eq('id', id);
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ ok: true, mode: 'archived' });
};
