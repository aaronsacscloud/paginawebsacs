// GET /api/cron/sync-sacs-activity?key=... — liga el CRM con la realidad y
// detecta señales de churn/sospecha.
//
// ⏰ HORARIO: UNA SOLA corrida al día, a las 3:00 am CDMX (= 9:00 UTC; Vercel
//    programa en UTC y México ya no cambia de horario, así que el desfase es
//    fijo de 6 h todo el año). Fuera de esa hora este cron NO toca Mongo.
//
//    Antes corría cada 6 horas = 00:00, 06:00, 12:00 y 18:00 UTC, o sea
//    **mediodía y 6 pm hora de México**: 8 agregaciones simultáneas sobre las
//    colecciones de ventas más grandes de la plataforma (la mayor tiene 4.4
//    millones de documentos) justo en hora pico de punto de venta. Medido: 42 s
//    de trabajo de Mongo por corrida con la caché caliente, y varios minutos en
//    frío. El CRM no necesita ese dato al minuto — se mueve a la madrugada.
//
// ⏱️ PRESUPUESTO DE TIEMPO: como ahora es una sola corrida, tiene que caber
//    TODA la cartera (~140 cuentas) en una invocación. Warm son ~35 s, pero en
//    frío una cuenta grande sola puede tardar 50 s y la corrida se pasaría del
//    límite de Vercel, que mata la función a media escritura.
//
//    Por eso no se confía en que quepa: antes de pedir cada lote se mira el
//    reloj y, si ya se gastó el presupuesto, la corrida se detiene sola y
//    reporta cuántas quedaron pendientes. Como el cursor va por
//    `actividad_sync_at` (las más desactualizadas primero), lo que no alcanzó
//    hoy es exactamente lo primero que se sincroniza mañana. Nunca se pierde
//    una cuenta: se retrasa un día.
//
// v2: además de guardar la actividad, calcula HEALTH SCORE (0-100) con factores
// y dispara ALERTAS (activities con dedup 7 días + WhatsApp al admin):
//  - caida_ventas: tendencia 30d vs previa cae >50%
//  - cancelada_pero_usando: sub cancelada y la cuenta sigue vendiendo (usa sin pagar)
//  - sucursales_excedidas: sucursales reales > contratadas (subcobro/upsell)
//  - entro_a_riesgo: cruzó los 15 días sin vender (churn probable)
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { sendWhatsApp } from '../../../lib/kapso';
import { healthScoreV2 } from '../../../lib/crm/health';
import { cuentasPorEmpresa, agregarActividad, guardarPorCuenta, normCuenta, errorSacs } from '../../../lib/crm/sacs-cuentas';
import { cargarCatalogo } from '../../../lib/crm/plan-modulos-db';
import { registrarOportunidad } from '../../../lib/crm/oportunidades';
import { planBase, pluginsContratados, modulosFueraDePlan, planQueLoCubre, ARR_PLAN } from '../../../lib/crm/plan-modulos';

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const ADMIN_WHATSAPP = (import.meta.env.CRM_ADMIN_WHATSAPP || '').trim();

const r0 = (n?: number | null) => Math.round(Number(n || 0));

// Contador de la bandeja por corrida: si el registro falla, se ve en la respuesta
// del cron en vez de quedar como una bandeja misteriosamente vacía.
const OPORT = { creadas: 0, reconfirmadas: 0, errores: 0 };

/** Alerta con dedup: no repite la misma alerta para la misma company en 7 días. */
async function alertar(companyId: string, clave: string, titulo: string, metadata: any, avisos: string[], oportunidad?: { detalle?: string; accion?: string; valor?: number | null; peso?: number }) {
  // La bandeja tiene su propio ciclo de vida (se reconfirma, se silencia si
  // alguien la cerró), independiente del dedup de 7 días del timeline.
  if (oportunidad) {
    const r = await registrarOportunidad({
      company_id: companyId, tipo: clave, titulo,
      detalle: oportunidad.detalle, accion: oportunidad.accion,
      valor: oportunidad.valor ?? null, peso: oportunidad.peso ?? null, metadata,
    });
    if (r === 'creada') OPORT.creadas++;
    else if (r === 'reconfirmada') OPORT.reconfirmadas++;
    else if (r === 'error') OPORT.errores++;
  }
  const hace7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: previa } = await supabase.from('activities').select('id')
    .eq('company_id', companyId).eq('automatico', true)
    .contains('metadata', { alerta: clave })
    .gte('created_at', hace7d).limit(1).maybeSingle();
  if (previa) return;
  await supabase.from('activities').insert({
    tipo: 'sistema', titulo, company_id: companyId, automatico: true,
    metadata: { ...metadata, alerta: clave },
  }).select().maybeSingle();
  avisos.push(titulo);
}

export const GET: APIRoute = async ({ url, request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });

  // Las MÁS desactualizadas primero (nulls al frente), que es lo que hace segura
  // cualquier corrida incompleta: lo que no alcanzó encabeza la fila mañana.
  // El tope es la cartera completa: la corrida de las 3 am intenta cubrir TODAS
  // las cuentas. Quien frena de verdad no es este número sino el presupuesto de
  // tiempo de abajo, que sabe cuánto está tardando de verdad.
  const limit = Math.min(300, Number(url.searchParams.get('limit')) || 200);

  // Presupuesto de la corrida. 50 s es conservador a propósito: el cron hermano
  // (`sync-sacs-uso`) lleva tiempo corriendo 48 s sin que Vercel lo mate, así
  // que es un techo ya probado en este proyecto. Se puede subir con `?ms=` para
  // una corrida manual de recuperación.
  const presupuestoMs = Math.min(240000, Number(url.searchParams.get('ms')) || 50000);
  const arranque = Date.now();
  const transcurrido = () => Date.now() - arranque;
  const { data: companies, error } = await supabase.from('companies')
    .select('id, nombre, sacs_account, sucursales, dias_sin_venta, actividad_sync_at, uso_sacs, soporte_abiertos, soporte_estancado, soporte_sentimiento')
    .not('sacs_account', 'is', null).is('archived_at', null)
    .order('actividad_sync_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // suscripciones para las alertas de "cancelada pero usando"
  const { data: subsAll } = await supabase.from('subscriptions').select('company_id, estado, arr, nombre_plan, ciclo');
  const porCompany: Record<string, { activas: number; canceladas: number; arr: number; planes: string[]; subsActivas: any[] }> = {};
  (subsAll || []).forEach((s: any) => {
    if (!s.company_id) return;
    const e = (porCompany[s.company_id] = porCompany[s.company_id] || { activas: 0, canceladas: 0, arr: 0, planes: [], subsActivas: [] });
    if (s.estado === 'activa') { e.activas++; e.arr += Number(s.arr || 0); e.planes.push(String(s.nombre_plan || '')); e.subsActivas.push(s); }
    if (s.estado === 'cancelada') e.canceladas++;
  });

  // Un cliente puede operar VARIAS cuentas de SACS: se traen todas y se agregan
  // en una sola foto (ver lib/crm/sacs-cuentas.ts). Con una sola cuenta el
  // resultado es idéntico al de antes.
  const mapa = await cuentasPorEmpresa((companies || []).map(c => c.id));
  const cuentasDeEmpresa = (co: any): string[] => {
    const ls = mapa[co.id];
    return (ls && ls.length ? ls : [normCuenta(co.sacs_account)]).filter(Boolean);
  };
  const cuentas = Array.from(new Set((companies || []).flatMap(cuentasDeEmpresa)));
  OPORT.creadas = 0; OPORT.reconfirmadas = 0; OPORT.errores = 0;
  const out = { empresas: (companies || []).length, cuentas: cuentas.length, actualizadas: 0, sin_datos: 0, alertas: 0, pendientes: 0, ms: 0, oportunidades: OPORT, errores: [] as string[] };
  const avisos: string[] = [];
  const hoy = new Date();
  const catalogo = await cargarCatalogo();

  // 1) Traer la actividad de TODAS las cuentas y acumularla en un solo mapa. No
  //    se puede agregar lote por lote: las cuentas de una misma empresa pueden
  //    caer en lotes distintos y el cliente quedaría con la mitad de su realidad.
  const porCuenta: Record<string, any> = {};
  for (let i = 0; i < cuentas.length; i += 25) {
    const lote = cuentas.slice(i, i + 25);
    // Freno por reloj: si ya no queda presupuesto, se corta ANTES de pedir el
    // lote. Lo ya traído se escribe igual en el paso 2 (no se tira trabajo), y
    // las cuentas que no alcanzaron conservan su `actividad_sync_at` viejo, así
    // que mañana son las primeras de la fila.
    if (transcurrido() > presupuestoMs) {
      out.pendientes = cuentas.length - i;
      out.errores.push('presupuesto agotado (' + Math.round(transcurrido() / 1000) + ' s): quedaron ' + out.pendientes + ' cuentas para la corrida de mañana');
      break;
    }
    try {
      const res = await fetch(SACS_API + '/interno/crm/actividad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ accounts: lote }),
      });
      if (!res.ok) { out.errores.push('lote ' + i + ': ' + errorSacs(res.status)); continue; }
      const j = await res.json();
      Object.assign(porCuenta, j.data || {});
    } catch (e: any) {
      out.errores.push('lote ' + i + ': ' + (e?.message || String(e)));
    }
  }

  // 2) Agregar por empresa y escribir.
  for (const co of (companies || [])) {
    try {
        const misCuentas = cuentasDeEmpresa(co);
        const acct = misCuentas.join(' + ') || '(sin cuenta)';
        const suyas: Record<string, any> = {};
        for (const c of misCuentas) if (porCuenta[c]) suyas[c] = porCuenta[c];
        const a = agregarActividad(suyas);
        if (!a) { out.sin_datos++; continue; }
        await guardarPorCuenta(co.id, suyas);

        const dias = a.ultima_venta
          ? Math.max(0, Math.floor((hoy.getTime() - new Date(a.ultima_venta + 'T12:00:00Z').getTime()) / 86400000))
          : null;
        const diasPrev = co.dias_sin_venta;
        // Preservar la penalización de soporte (si no, el sync diario la borra).
        const { score, factors } = healthScoreV2(a, (co as any).uso_sacs, {
          abiertos: (co as any).soporte_abiertos, estancado: (co as any).soporte_estancado, sentimiento: (co as any).soporte_sentimiento,
        });

        const { error: ue } = await supabase.from('companies').update({
          actividad: a,
          ultima_venta_at: a.ultima_venta || null,
          dias_sin_venta: dias,
          actividad_sync_at: new Date().toISOString(),
          health_score: score,
          health_factors: factors,
          health_computed_at: new Date().toISOString(),
        }).eq('id', co.id);
        if (ue) { out.errores.push(acct + ': ' + ue.message); continue; }
        out.actualizadas++;

        // Snapshot ligero del día (histórico de ventas/salud; el cron de uso
        // completa el resto de campos). Upsert → no duplica por día.
        try {
          const { error: se } = await supabase.from('uso_snapshots').upsert({
            company_id: co.id,
            fecha: new Date().toISOString().slice(0, 10),
            ventas_30d: a.ventas_30d ?? null,
            total_30d: a.total_30d ?? null,
            tendencia_pct: a.tendencia_pct ?? null,
            dias_sin_venta: dias,
            health_score: score,
            usuarios_operando: a.usuarios_operando ?? null,
          }, { onConflict: 'company_id,fecha' });
          if (se) console.warn('[sync-sacs-activity] snapshot:', acct, se.message);
        } catch { /* nunca bloquea el sync */ }

        // ── alertas ──
        const subInfo = porCompany[co.id] || { activas: 0, canceladas: 0, arr: 0 };
        if (a.tendencia_pct != null && a.tendencia_pct <= -50 && subInfo.activas > 0) {
          await alertar(co.id, 'caida_ventas',
            `📉 ${co.nombre}: ventas cayeron ${r0(Math.abs(a.tendencia_pct))}% vs los 30 días previos ($${r0(a.total_30d).toLocaleString()} vs $${r0(a.total_30d_prev).toLocaleString()}) — ${'$' + r0(subInfo.arr).toLocaleString()} ARR en juego`,
            { tendencia_pct: a.tendencia_pct, cuenta: acct }, avisos,
            { detalle: 'Una caída así sostenida termina en cancelación.', accion: 'Llamada de diagnóstico: qué cambió en su operación.', valor: subInfo.arr, peso: 90 });
        }
        if (subInfo.activas === 0 && subInfo.canceladas > 0 && (a.ventas_30d || 0) > 0) {
          await alertar(co.id, 'cancelada_pero_usando',
            `🚨 ${co.nombre} (${acct}): canceló su suscripción pero SIGUE USANDO SACS (${a.ventas_30d} ventas / $${r0(a.total_30d).toLocaleString()} en 30d) — uso sin pagar`,
            { ventas_30d: a.ventas_30d, cuenta: acct }, avisos,
            { detalle: `Está transaccionando $${r0(a.total_30d).toLocaleString('es-MX')} al mes sin pagar suscripción.`,
              accion: 'Decidir política: reactivar con cobro, cobrar retroactivo o cortar el acceso.',
              valor: null, peso: 100 });
        }
        if (co.sucursales && a.sucursales && a.sucursales > co.sucursales && subInfo.activas > 0) {
          await alertar(co.id, 'sucursales_excedidas',
            `🏢 ${co.nombre}: usa ${a.sucursales} sucursales pero contrató ${co.sucursales} — posible subcobro / oportunidad de upsell`,
            { reales: a.sucursales, contratadas: co.sucursales, cuenta: acct }, avisos,
            { detalle: `Opera ${a.sucursales} sucursales y su plan cubre ${co.sucursales}.`,
              accion: `Ampliar el plan a ${a.sucursales} sucursales.`, peso: 70 });
        }
        // Paga un plan con inventario (Controla/Automatiza) pero en 30 días no usó
        // NINGÚN módulo de inventario → no le ve valor a lo que paga = churn en
        // cámara lenta (o oportunidad de reactivar con capacitación).
        const pagaInventario = (subInfo.planes || []).some(pl => /controla|automatiza/i.test(pl));
        const usaInventario = (a.modulos || []).some((m: string) => /inventario|compra|Transferencias/i.test(m));
        if (pagaInventario && !usaInventario && (a.ventas_30d || 0) > 0) {
          await alertar(co.id, 'plan_sin_uso',
            `📦 ${co.nombre}: paga plan con INVENTARIO (${(subInfo.planes || []).filter(pl => /controla|automatiza/i.test(pl)).join(', ')}) pero en 30 días no usó órdenes de compra ni transferencias — no le está viendo valor: capacitar o riesgo de downgrade`,
            { planes: subInfo.planes, modulos: a.modulos, cuenta: acct }, avisos,
            { detalle: 'Paga por inventario y no lo usa: no le ve valor a lo que paga.',
              accion: 'Capacitación para activarlo, o bajarlo de plan antes de que cancele.', valor: subInfo.arr, peso: 55 });
        }
        // Usa módulos que su plan no cubre → upsell con número. El uso viene de
        // `uso_sacs` (cron de madrugada); si esa cuenta aún no se ha barrido, no
        // hay nada que comparar y la alerta simplemente no sale.
        if (catalogo && subInfo.activas > 0) {
          const subsAct = (subInfo as any).subsActivas || [];
          const planReal = planBase(subsAct);
          const fuera = modulosFueraDePlan(planReal, (co as any).uso_sacs?.modulos, pluginsContratados(subsAct), catalogo);
          // Los `por_confirmar` no alertan: son los módulos cuyo tier todavía no
          // valida un humano y no vale la pena quemar la señal con dudosos.
          const firmes = fuera.filter(f => !f.por_confirmar);
          if (planReal && firmes.length) {
            const destino = planQueLoCubre(firmes, catalogo);
            const delta = destino && ARR_PLAN[destino] && ARR_PLAN[planReal] ? ARR_PLAN[destino] - ARR_PLAN[planReal] : 0;
            await alertar(co.id, 'modulo_fuera_de_plan',
              `💡 ${co.nombre} (${acct}): usa ${firmes.map(f => f.modulo).join(', ')} — su plan ${planReal} no lo cubre` +
              (destino ? ` → súbelo a ${destino}${delta > 0 ? ` (+$${delta.toLocaleString('es-MX')}/año)` : ''}` : ''),
              { plan: planReal, destino, modulos: firmes.map(f => f.modulo), cuenta: acct }, avisos,
              { detalle: `Usa ${firmes.map(f => f.modulo).join(', ')} sin que su plan lo cubra.`,
                accion: destino ? `Súbelo a ${destino}.` : 'Revisa qué plan o plugin corresponde.',
                valor: delta || null, peso: 75 });
          }
        }
        if (dias != null && dias > 15 && (diasPrev == null || diasPrev <= 15) && subInfo.activas > 0) {
          await alertar(co.id, 'entro_a_riesgo',
            `🔴 ${co.nombre} (${acct}) cruzó 15 días sin vender — churn probable, $${r0(subInfo.arr).toLocaleString()} ARR en riesgo`,
            { dias_sin_venta: dias, cuenta: acct }, avisos,
            { detalle: `Lleva ${dias} días sin registrar una venta.`, accion: 'Contacto inmediato: entender si dejó de operar o se fue a otro sistema.', valor: subInfo.arr, peso: 95 });
        }
    } catch (e: any) {
      out.errores.push(co.nombre + ': ' + (e?.message || String(e)));
    }
  }

  out.alertas = avisos.length;

  // WhatsApp al admin con el resumen de alertas nuevas (best-effort). Al ser una
  // sola corrida diaria, este mensaje es el parte del día completo — llega de
  // madrugada, junto con el barrido.
  if (avisos.length && ADMIN_WHATSAPP) {
    try {
      await sendWhatsApp(ADMIN_WHATSAPP, '⚠️ CRM SACS — ' + avisos.length + ' alerta(s) nueva(s):\n\n' + avisos.slice(0, 8).join('\n\n') + (avisos.length > 8 ? '\n\n…y ' + (avisos.length - 8) + ' más en el CRM.' : ''));
    } catch { /* el resumen queda en activities de todos modos */ }
  }
  out.ms = transcurrido();

  // Fallar RUIDOSO. Antes esto siempre devolvía 200 aunque los errores llenaran
  // out.errores: para Vercel la corrida era un éxito, nadie miraba el body, y el
  // CRM siguió mostrando la última venta y la salud viejas COMO SI FUERAN DE HOY.
  // Así estuvo 6 días en jul-2026 (sacs_api contestaba 401 a /interno/crm/*).
  // Cero cuentas actualizadas teniendo cuentas que sincronizar no es una corrida
  // buena: es el puente caído, y tiene que verse en el log de crons.
  const fracaso = cuentas.length > 0 && out.actualizadas === 0;
  return new Response(JSON.stringify(out, null, 2), { status: fracaso ? 500 : 200, headers: { 'Content-Type': 'application/json' } });
};
