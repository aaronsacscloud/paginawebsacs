// CRON · MOTOR DE SECUENCIAS (cada hora). La ruta conserva su nombre viejo
// para no tocar vercel.json; el concepto ahora es multi-secuencia.
//
// Por cada secuencia ACTIVA, tres movimientos:
//   1. ENROLAR: leads que cumplen las reglas de entrada y no están dentro.
//   2. GRADUAR: salida TOTAL con motivo (agendó, cliente, descarte, corte,
//      archivado) — eso alimenta las métricas de rendimiento.
//      RESPONDER no saca de la secuencia: detiene SOLO el canal por el que
//      respondió (respondió por WhatsApp → paran los WhatsApps automáticos,
//      los correos siguen; y al revés). Si respondió por ambos, ahí sí sale.
//   3. ENVIAR: a los miembros vigentes, los pasos del día (máx 1 correo y
//      1 WhatsApp por corrida), en la ventana y días de ESTA secuencia.
// La pausa ("pidió tiempo") NO es salida: se salta el envío y al vencer sigue.
// Cada correo enviado y cada cambio de canal dejan NOTA en el hilo del inbox
// para que el vendedor sepa qué recibió el lead sin salir de la conversación.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { resolverTenant } from '../../../lib/email/tenant';
import { enviarCorreo } from '../../../lib/email/pipeline';
import { compilar, compilarTexto, interpolar } from '../../../lib/email/plantillas';
import { cumpleCondsLead } from '../../../lib/crm/leads-filtros';
import { notificar } from '../../../lib/crm/notificaciones';
import { puedeMandarWa, cadenciaPausadaPorPersona } from '../../../lib/whatsapp/presion';
import { entregarInapp, retirarInapp, cuentaDelLead, campanasDeSecuencia } from '../../../lib/crm/secuencia-inapp';
import { ctxRenovacion } from '../../../lib/crm/renovacion';
import { enviarPlantilla } from '../../../lib/whatsapp/kapso-api';
import { avisarCalientes } from '../../../lib/crm/aviso-lead';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

// La ESCALERA del lead y el umbral del objetivo: una secuencia gradúa al
// miembro cuando su avance ALCANZA el objetivo (o lo rebasa). Así "agendó"
// es salida para la secuencia de seguimiento (objetivo agendo) pero es la
// ENTRADA de la de demo agendada (objetivo demo_hecha).
/** La ventana de la cadencia de renovación: empieza a 90 días de la fecha.
 *  Se declara aquí porque la usan dos lugares —el enrolamiento y el cálculo del
 *  día— y si se separan, alguien entra en su día 3 creyendo que es el 1. */
const VENTANA_RENOVACION = 90;

const RANGO: Record<string, number> = { respondio: 1, descubrimiento: 1, agendado: 2, demo_hecha: 3, cotizado: 4, negociando: 4 };
const UMBRAL: Record<string, number> = { respondio: 1, agendo: 2, demo_hecha: 3, convertido: 99 };
function motivoSalida(c: any, objetivo: string, paraClientes = false): string | null {
  if (c.archived_at) return 'archivado';
  if (c.estatus_lead === 'descartado' || c.calificacion === 'no_califica') return 'descartado';
  /* En una cadencia de adquisición, convertir ES el final: quien ya compró no
     debe seguir recibiendo correos de venta. En una de RETENCIÓN —renovación,
     onboarding del cliente nuevo, cuenta dormida— ser cliente es el requisito
     de entrada, no la salida. Sin este `paraClientes` el cliente salía el
     primer día y ninguna cadencia de post-venta era construible. */
  if (c.lifecycle_stage === 'cliente' && !paraClientes) return 'convertido';
  const umbral = UMBRAL[objetivo] ?? 2;
  const rango = Math.max(RANGO[c.estatus_lead] || 0, c.lifecycle_stage === 'oportunidad' ? 2 : 0);
  if (rango >= umbral && objetivo !== 'convertido') return objetivo;
  return null;
}

// Nota interna en el hilo del inbox (si el contacto tiene conversación de WA).
async function notaInbox(contactId: string, texto: string) {
  const { data: conv } = await supabase.from('wa_conversaciones').select('id')
    .eq('contact_id', contactId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!conv) return;
  await supabase.from('wa_notas').insert({ conversation_id: conv.id, contact_id: contactId, autor: 'Secuencias', texto });
}

export const GET: APIRoute = async ({ url }) => {
  const dry = url.searchParams.get('dry') === '1';
  const { data: secuencias } = await supabase.from('crm_secuencias').select('*').eq('activa', true);
  const lista = dry && !secuencias?.length
    ? (await supabase.from('crm_secuencias').select('*').limit(3)).data || []
    : secuencias || [];
  if (!lista.length) return json({ ok: true, sin_secuencias_activas: true });

  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const hora = cdmx.getUTCHours();
  const diaIso = cdmx.getUTCDay() === 0 ? 7 : cdmx.getUTCDay();   // 1=lun … 7=dom
  const t = await resolverTenant();
  const ahora = new Date();
  const res: any = { enrolados: 0, graduados: 0, canales_detenidos: 0, calientes: 0, envios: [], saltados: [] };

  // Tope GLOBAL entre secuencias: máximo 1 correo y 1 WhatsApp al día por
  // lead, sin importar en cuántas secuencias esté metido.
  const inicioDiaCdmx = new Date(Date.UTC(cdmx.getUTCFullYear(), cdmx.getUTCMonth(), cdmx.getUTCDate()) + 6 * 3600e3);
  const { data: hoyEnvs } = await supabase.from('activities')
    .select('contact_id, metadata').eq('tipo', 'secuencia_envio')
    .gte('created_at', inicioDiaCdmx.toISOString()).limit(2000);
  const envioHoy: Record<string, { correo?: boolean; wa?: boolean }> = {};
  for (const a of hoyEnvs || []) {
    const k = (a.metadata as any)?.canal;
    if (k === 'correo' || k === 'wa') (envioHoy[a.contact_id] = envioHoy[a.contact_id] || {})[k as 'correo' | 'wa'] = true;
  }

  for (const sec of lista) {
    // ── Blackout ──
    // Una marca de moda en pleno Buen Fin está vendiendo, no evaluando
    // software. La secuencia se congela sola: no manda ni gradúa, y al terminar
    // el rango continúa donde iba sin haber perdido a nadie.
    const hoyISO = ahora.toISOString().slice(0, 10);
    const congelada = (Array.isArray(sec.blackout) ? sec.blackout : [])
      .some((b: any) => b?.desde && b?.hasta && hoyISO >= b.desde && hoyISO <= b.hasta);
    if (congelada) { res.saltados.push({ sec: sec.nombre, motivo: 'blackout' }); continue; }

    const entrada = sec.entrada || {};
    const estatusIn = entrada.estatus?.length ? entrada.estatus : ['contactado', 'sin_respuesta'];
    const lifecycleIn = entrada.lifecycle?.length ? entrada.lifecycle : ['lead', 'lead_calificado'];

    // 1) ENROLAR — solo leads vigentes (no más viejos que el corte).
    // El filtro fino de la entrada: las MISMAS condiciones que la pestaña de
    // Leads. Estatus y etapa son la red gruesa; esto elige a quién de esa red
    // sí le hablamos. Como se evalúa con cumpleCondsLead —la misma función que
    // pinta la lista— filtrar para ver y filtrar para inscribir son idénticos:
    // lo que ves en la lista es exactamente lo que va a entrar.
    const filtrosIn = Array.isArray(entrada.filtros) ? entrada.filtros : [];
    const logicaIn = entrada.logica === 'OR' ? 'OR' : 'AND';
    // Con filtro se traen más candidatos: el filtro descarta en memoria y con
    // el tope de 60 se corría el riesgo de que un lote entero se fuera vacío
    // y la secuencia pareciera muerta.
    const tope = filtrosIn.length ? 400 : 60;
    const { data: crudos } = await supabase.from('contacts')
      .select('id, estatus_lead_at, prueba_inicio, ultima_actividad_venta_at, propiedades, nombre, email, whatsapp, telefono, campana, giro, estatus_lead, lifecycle_stage, calificacion, retenido_hasta, descarte_categoria, sucursales_interes, reuniones_total, reuniones_no_asistio, reuniones_reagendadas, last_contact_at, created_at, owner_id, companies(giro, sucursales)')
      .in('lifecycle_stage', lifecycleIn).in('estatus_lead', estatusIn)
      .is('archived_at', null).eq('wa_optout', false)
      .limit(tope);
    // Las condiciones de sitio web (visitas_n, visito_ruta) necesitan datos que
    // no viven en contacts. Se traen SOLO si algun filtro los pide: son 4,000+
    // filas y no hay por que leerlas en cada corrida.
    const pideWeb = filtrosIn.some((f: any) => f.campo === 'visitas_n' || f.campo === 'visito_ruta');
    if (pideWeb && (crudos || []).length) {
      const desde = new Date(Date.now() - 90 * 864e5).toISOString();
      const { data: vis } = await supabase.from('contact_visits')
        .select('contact_id, ruta').in('contact_id', (crudos || []).map(c => c.id))
        .gte('created_at', desde).limit(5000);
      const porC: Record<string, string[]> = {};
      for (const v of vis || []) (porC[v.contact_id] = porC[v.contact_id] || []).push(v.ruta);
      for (const c of crudos || []) {
        const r = porC[c.id] || [];
        (c as any).rutas_recientes = r;
        (c as any).visitas_recientes = r.length;
      }
    }
    const nuevos = filtrosIn.length
      ? (crudos || []).filter(c => cumpleCondsLead(c, filtrosIn, logicaIn)).slice(0, 60)
      : (crudos || []).slice(0, 60);
    if (filtrosIn.length) res.filtrados = (res.filtrados || 0) + ((crudos || []).length - nuevos.length);
    const candIds = (nuevos || []).map(c => c.id);
    const prevPor: Record<string, any> = {};
    if (candIds.length) {
      const { data: prev } = await supabase.from('crm_secuencia_miembros')
        .select('id, contact_id, detenida_at, motivo').eq('secuencia_id', sec.id).in('contact_id', candIds);
      for (const x of prev || []) prevPor[x.contact_id] = x;
    }
    for (const c of nuevos || []) {
      // ── El ANCLA: desde cuándo se cuenta que "llegó" ──
      // Por defecto es cuando cambió de estatus, que sirve para las cadencias
      // de lead. Pero NO para todas: mover a alguien a la etapa 'prueba_gratis'
      // cambia el lifecycle_stage y deja estatus_lead_at intacto, así que un
      // lead nutrido dos meses entraba con fecha de hace dos meses y el corte
      // lo descartaba — nunca recibía el día 1 de su onboarding. Cada secuencia
      // declara desde qué fecha cuenta.
      const ancla = String((entrada as any).ancla || 'estatus_lead_at');
      const llego = ancla === 'prueba_inicio' ? (c as any).prueba_inicio
                  : ancla === 'created_at'    ? c.created_at
                  : ((c.propiedades as any)?.tiktok?.creado || c.estatus_lead_at);
      // Si la secuencia pide un ancla que este contacto no tiene, no entra:
      // meterlo con otra fecha sería mandarle el día 1 en su día 9.
      if (ancla !== 'estatus_lead_at' && !llego) continue;
      if (llego && (ahora.getTime() - Date.parse(llego)) / 86400000 > sec.corte_dias) continue;
      const ya = prevPor[c.id];
      if (ya && !ya.detenida_at) continue;   // ya está corriendo
      if (ya) {
        // RE-ENTRADA: solo si volvió a levantar la mano DESPUÉS de salir, o si
        // su salida tiene más de 90 días y hoy vuelve a cumplir la entrada
        // (con actividad fresca — el corte de arriba filtra lo rancio).
        const salio = Date.parse(ya.detenida_at);
        const levantoLaMano = llego && Date.parse(llego) > salio;
        const viejo90 = (ahora.getTime() - salio) / 86400000 > 90;
        if (!levantoLaMano && !viejo90) continue;
        if (dry) { res.enrolados++; res.entrarian = [...(res.entrarian || []), c.id].slice(0, 12); continue; }
        await supabase.from('crm_secuencia_miembros')
          .update({ inicio: ahora.toISOString(), enviados: {}, canales_detenidos: {}, detenida_at: null, motivo: null }).eq('id', ya.id);
        res.enrolados++;
        await notaInbox(c.id, `Volvió a entrar a la secuencia "${sec.nombre}" (había salido por ${ya.motivo || 'motivo desconocido'}; día 1 hoy).`);
        continue;
      }
      if (dry) { res.enrolados++; res.entrarian = [...(res.entrarian || []), c.id].slice(0, 12); continue; }
      const { error } = await supabase.from('crm_secuencia_miembros')
        .insert({ secuencia_id: sec.id, contact_id: c.id })
        // ── Acción de ENTRADA ──
        // Lo que faltaba para cerrar el ciclo solo: la cadencia de rezagados
        // encuentra al lead sin señal y ELLA MISMA lo mueve a rezagado. Antes
        // alguien tenía que acordarse de hacerlo a mano, y nadie se acuerda de
        // noventa leads.
        {
          const ent2 = (sec.acciones || {}).al_entrar;
          if (ent2?.lifecycle && !dry) {
            await supabase.from('contacts').update({ lifecycle_stage: ent2.lifecycle }).eq('id', c.id);
            await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_accion', automatico: true,
              titulo: `"${sec.nombre}" lo movió a ${ent2.lifecycle}: sin señal de vida`,
              metadata: { secuencia: sec.nombre, ...ent2 } }).then(() => {}, () => {});
          }
        };
      if (!error) {
        res.enrolados++;
        await notaInbox(c.id, `Entró a la secuencia "${sec.nombre}" (día 1 hoy).`);
      }
    }

    // 2) GRADUAR + canales — miembros vigentes: salida total con motivo, o
    //    detención del canal por el que respondió.
    /* ⚠️ El `error` de aquí NO se puede tragar.
     *
     * Este `select` trae a `contacts(...)` como JOIN de PostgREST, y PostgREST
     * solo une dos tablas si hay LLAVE FORÁNEA declarada. Faltaba la de
     * `contact_id → contacts(id)`: la consulta devolvía PGRST200, el
     * `(miembros || [])` de más abajo lo convertía en lista vacía, y las
     * secuencias enrolaban gente sin mandarle NADA. Medido: cero filas
     * `secuencia_envio` en toda la historia de `activities`.
     *
     * Un error aquí significa que la secuencia está muerta, así que se grita.
     * Si alguien vuelve a agregar una tabla al select sin su FK, se entera hoy
     * y no dentro de tres meses. */
    const { data: miembros, error: eMiembros } = await supabase.from('crm_secuencia_miembros')
      .select('id, contact_id, inicio, enviados, canales_detenidos, contacts(id, nombre, apellido, email, whatsapp, campana, estatus_lead, lifecycle_stage, calificacion, retenido_hasta, wa_optout, archived_at, propiedades, prueba_inicio, created_at, reciclado_veces, ultima_actividad_venta_at, ultima_actividad_venta_tipo, eng_emails_leidos, company_id, prueba_cuenta, companies(nombre, nombre_comercial))')
      .eq('secuencia_id', sec.id).is('detenida_at', null).limit(300);
    if (eMiembros) {
      console.error(`[secuencias] "${sec.nombre}" NO PUDO LEER SUS MIEMBROS — no se envió nada:`, eMiembros.message);
      res.errores = res.errores || [];
      res.errores.push({ secuencia: sec.nombre, error: eMiembros.message });
      continue;
    }

    /* ── CUÁNTOS DÍAS LE FALTAN PARA RENOVAR ───────────────────────────────
       Solo si la secuencia cuenta hacia atrás. Una consulta para todos los
       miembros, no una por lead. */
    const renovaFaltan: Record<string, number> = {};
    if (String((sec.entrada || {}).ancla || '') === 'renovacion') {
      const ids = Array.from(new Set((miembros || []).map((m: any) => m.contacts?.company_id).filter(Boolean)));
      if (ids.length) {
        const { data: subs } = await supabase.from('subscriptions')
          .select('company_id, proxima_factura').in('company_id', ids)
          .eq('estado', 'activa').in('ciclo', ['anual', 'vitalicia'])
          .order('proxima_factura', { ascending: true });
        const porEmpresa: Record<string, string> = {};
        for (const x of subs || []) if (!porEmpresa[x.company_id]) porEmpresa[x.company_id] = x.proxima_factura;
        for (const mm of miembros || []) {
          const f = porEmpresa[(mm as any).contacts?.company_id];
          if (f) renovaFaltan[mm.contact_id] = Math.ceil((Date.parse(String(f).slice(0, 10) + 'T12:00:00Z') - ahora.getTime()) / 86400000);
        }
      }
    }

    /* ── QUIÉN YA PAGÓ ─────────────────────────────────────────────────────
       Una consulta para todos los miembros, no una por lead: son hasta 300 y
       la de arriba ya trajo sus company_id.

       `estado='activa'` y no `pendiente_pago`: un anual pendiente de pago es
       justo alguien a quien todavía hay que empujar, y sacarlo de la cadencia
       ahí sería soltarlo en el peor momento. Vitalicia cuenta igual — pagó más
       que un anual. */
    const compIds = Array.from(new Set((miembros || []).map((m: any) => m.contacts?.company_id).filter(Boolean)));
    const yaPagaron = new Set<string>();
    if (compIds.length) {
      const { data: subs } = await supabase.from('subscriptions')
        .select('company_id, ciclo, estado').in('company_id', compIds)
        .eq('estado', 'activa').in('ciclo', ['anual', 'vitalicia']);
      for (const x of subs || []) yaPagaron.add(x.company_id);
    }

    // Detección de respuesta POR CANAL, en lote (solo si alguien respondió).
    const idsRespondieron = (miembros || [])
      .filter((m: any) => ['respondio', 'descubrimiento'].includes(m.contacts?.estatus_lead))
      .map((m: any) => m.contact_id);
    const waEntrante: Record<string, string> = {};
    const correoEntrante: Record<string, string> = {};
    if (idsRespondieron.length) {
      const { data: convs } = await supabase.from('wa_conversaciones')
        .select('contact_id, ultimo_entrante_at').in('contact_id', idsRespondieron)
        .not('ultimo_entrante_at', 'is', null);
      for (const v of convs || []) {
        if (!waEntrante[v.contact_id] || v.ultimo_entrante_at > waEntrante[v.contact_id]) waEntrante[v.contact_id] = v.ultimo_entrante_at;
      }
      const { data: econvs } = await supabase.from('email_conversations')
        .select('id, contact_id').in('contact_id', idsRespondieron);
      if (econvs?.length) {
        const porConv: Record<string, string> = {};
        for (const e of econvs) porConv[e.id] = e.contact_id;
        const { data: emsgs } = await supabase.from('email_messages')
          .select('conversation_id, created_at').in('conversation_id', econvs.map(e => e.id))
          .eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(300);
        for (const e of emsgs || []) {
          const cid = porConv[e.conversation_id];
          if (cid && (!correoEntrante[cid] || e.created_at > correoEntrante[cid])) correoEntrante[cid] = e.created_at;
        }
      }
    }

    // Baja de correo (unsubscribe/rebote/queja): detiene el canal correo.
    // El pipeline ya se negaría a enviar, pero marcarlo aquí lo hace visible
    // y deja de intentarlo. La pausa temporal NO cuenta como baja.
    const emailsMiembros = [...new Set((miembros || []).map((m: any) => String(m.contacts?.email || '').toLowerCase()).filter(Boolean))];
    const correoBaja = new Set<string>();
    if (emailsMiembros.length && t) {
      const [b1, b2] = await Promise.all([
        supabase.from('email_unsubscribes').select('email').in('email', emailsMiembros).is('resubscribed_at', null),
        supabase.from('email_suppressions').select('email, motivo').eq('tenant_id', t.id).in('email', emailsMiembros).is('restaurado_at', null),
      ]);
      for (const x of b1.data || []) correoBaja.add(String(x.email).toLowerCase());
      for (const x of b2.data || []) if (x.motivo !== 'pausa') correoBaja.add(String(x.email).toLowerCase());
    }

    const vigentes: any[] = [];
    for (const m of miembros || []) {
      const c: any = m.contacts;
      if (!c) continue;
      // El DÍA de la secuencia también se cuenta desde el ancla, no desde que
      // el contacto entró. Si alguien lleva 3 días de prueba cuando se le marca
      // la etapa, su "día 1" ya pasó: mandarle el correo de bienvenida en su
      // día 3 y el de cierre en su día 17 —cuando la prueba ya venció— es peor
      // que no mandar nada. Con el ancla por defecto ambos coinciden, así que
      // las cadencias de siempre no cambian.
      // ── Modo PERMANENTE ──
      // El modelo de arco no sirve para el top of mind: no hay "día 1, día 3",
      // hay "cada N días, lo siguiente que no haya visto". El paso se elige por
      // cuántos lleva recibidos, así que agregar un correo nuevo a la secuencia
      // lo mete al goteo sin tocar a nadie ni reiniciar a nadie.
      const permanente = sec.modo === 'permanente';
      if (permanente) {
        const cadaDias = Math.max(1, Number((sec.entrada || {}).cada_dias) || 14);
        // ── Tres carriles, no una lista ──
        // Cada día de la semana tiene su tipo de contenido y avanza por su
        // cuenta. Sin esto, cargar tres insights seguidos le mandaría tres
        // lunes de insight y ningún tip: la rotación es POR CARRIL.
        const todos = (sec.pasos || []).filter((p: any) =>
          p.activo !== false && (!p.vigente_hasta || p.vigente_hasta >= hoyISO));
        const conCarril = todos.some((p: any) => p.dia_semana);
        const listos = conCarril
          ? todos.filter((p: any) => p.dia_semana === diaIso)
          : todos;
        const idsCarril = new Set(listos.map((p: any) => p.id));
        const yaEnviados = conCarril
          ? Object.keys(m.enviados || {}).filter(id => idsCarril.has(id)).length
          : Object.keys(m.enviados || {}).length;
        const ultimo = Object.values(m.enviados || {}).map((x: any) => Date.parse(String(x))).filter(Boolean).sort().pop();
        // Los pasos vencidos se saltan: una "novedad" de hace seis meses ya no
        // lo es, y mandarla resta credibilidad en vez de sumarla.
        // Se acabó el contenido: no se repite, se espera a que haya algo nuevo.
        if (!listos.length || yaEnviados >= listos.length) continue;
        if (ultimo && (ahora.getTime() - ultimo) / 86400000 < cadaDias) continue;
        const paso = listos[yaEnviados];
        if (!paso) continue;
        // El resto del bucle trabaja con `dias`; se le da el día del paso que
        // toca para que la comparación de más abajo lo deje pasar.
        (sec as any)._pasoForzado = paso;
      }

      const anclaSec = String((sec.entrada || {}).ancla || 'estatus_lead_at');
      /* ── El ancla, y el único caso que corre AL REVÉS ──
         Las demás cuentan días hacia adelante desde una fecha que ya pasó. La
         de renovación cuenta hacia ATRÁS hacia una que todavía no llega: su
         «día 1» es «faltan 90» y su último es «faltan 35».
         Se traduce a la misma escala (1, 2, 3…) para que el resto del bucle
         —`p.dia > dias`, el corte, los topes— siga funcionando igual sin
         tocarlo. Un motor con dos formas de contar el tiempo se rompe en la
         primera regla que se olvide de una de las dos. */
      let dias: number;
      if (anclaSec === 'renovacion') {
        const faltan = renovaFaltan[c.id];
        if (faltan == null) { res.saltados.push({ lead: c.id, motivo: 'sin_renovacion' }); continue; }
        dias = VENTANA_RENOVACION - faltan + 1;
        if (dias < 1) { res.saltados.push({ lead: c.id, motivo: 'todavia_lejos', faltan }); continue; }
      } else {
        const desde = anclaSec === 'prueba_inicio' ? (c as any).prueba_inicio
                    : anclaSec === 'created_at'    ? c.created_at
                    : m.inicio;
        dias = Math.floor((ahora.getTime() - Date.parse(desde || m.inicio)) / 86400000) + 1;
      }
      const cd: Record<string, any> = { ...(m.canales_detenidos || {}) };
      let cdCambio = false;

      // ── Ventana de respeto ──
      // Si acaba de pasar algo de verdad —una reunión, una cotización, un
      // mensaje suyo— mandarle "te extrañamos" es sordo. El sin_actividad
      // protege la ENTRADA; esto protege a quien ya está adentro cuando la vida
      // cambia. Solo aplica al goteo permanente: en un arco los pasos son una
      // conversación con hilo y saltarse uno la rompe.
      if (sec.modo === 'permanente') {
        const act = (c as any).ultima_actividad_venta_at;
        if (act && (ahora.getTime() - Date.parse(act)) / 86400000 < 7) {
          res.saltados.push({ lead: c.id, motivo: 'actividad_reciente' });
          continue;
        }
      }

      // ── La baja manda sobre todo ──
      // Quien se dio de baja no es un lead frío al que le bajamos el ritmo: es
      // alguien que pidió que dejáramos de escribirle. Seguir mandándole es
      // como acabamos marcados como spam, y eso arrastra la entregabilidad de
      // TODOS los demás. Sale de la secuencia entera, no del canal.
      if (c.email && correoBaja.has(String(c.email).toLowerCase())) {
        if (!dry) {
          await supabase.from('crm_secuencia_miembros')
            .update({ detenida_at: ahora.toISOString(), motivo: 'baja' }).eq('id', m.id);
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_salida', automatico: true,
            titulo: `Salió de "${sec.nombre}": se dio de baja`, metadata: { secuencia_id: sec.id, motivo: 'baja' } });
          await notaInbox(c.id, `Se dio de baja del correo — sale de "${sec.nombre}" y no debe recibir más envíos.`);
        }
        continue;
      }

      const objetivoSec = sec.objetivo || 'agendo';
      // Canal WhatsApp: optout o respuesta entrante después de entrar.
      if (!cd.wa && c.wa_optout) { cd.wa = { motivo: 'optout', at: ahora.toISOString() }; cdCambio = true; }
      if (!cd.correo && c.email && correoBaja.has(String(c.email).toLowerCase())) { cd.correo = { motivo: 'optout', at: ahora.toISOString() }; cdCambio = true; }
      if (!cd.wa && waEntrante[c.id] && waEntrante[c.id] > m.inicio) {
        cd.wa = { motivo: 'respondio', at: ahora.toISOString() }; cdCambio = true;
        if (!dry && objetivoSec !== 'respondio') await notaInbox(c.id, `Secuencia "${sec.nombre}": respondió por WhatsApp — se detienen los WhatsApps automáticos; los correos siguen.`);
      }
      // Canal correo: respuesta entrante después de entrar.
      if (!cd.correo && correoEntrante[c.id] && correoEntrante[c.id] > m.inicio) {
        cd.correo = { motivo: 'respondio', at: ahora.toISOString() }; cdCambio = true;
        if (!dry && objetivoSec !== 'respondio') await notaInbox(c.id, `Secuencia "${sec.nombre}": respondió por correo — se detienen los correos automáticos; los WhatsApps siguen.`);
      }
      if (cdCambio) {
        res.canales_detenidos++;
        if (!dry) {
          await supabase.from('crm_secuencia_miembros').update({ canales_detenidos: cd }).eq('id', m.id);
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_canal', automatico: true,
            titulo: `Secuencia "${sec.nombre}": canal detenido (${Object.keys(cd).join(' + ')})`, metadata: { secuencia_id: sec.id, canales: cd } });
        }
      }

      // Salida total: motivo duro, corte, respondió por AMBOS canales — o el
      // OBJETIVO de la secuencia es que responda y ya respondió por uno.
      const respondioAlgo = cd.wa?.motivo === 'respondio' || cd.correo?.motivo === 'respondio';
      const ambos = cd.wa?.motivo === 'respondio' && cd.correo?.motivo === 'respondio';
      /* Pagó su licencia: se acabó la cadencia, sea cual sea su etapa. Es la
         salida más importante de todas — el que ya pagó y sigue recibiendo «te
         doy 35% si contratas» aprende que le cobraron de más. */
      /* …y en una cadencia de cliente esta salida tampoco aplica: todos pagaron,
         por eso están ahí. Es la salida de la prueba gratis, no de la renovación. */
      const pago = (!(sec.entrada || {}).para_clientes && c.company_id && yaPagaron.has(c.company_id)) ? 'pago_licencia' : null;
      const motivo = pago || motivoSalida(c, objetivoSec, !!(sec.entrada || {}).para_clientes) || (dias > sec.corte_dias ? 'corte' : null)
        || (ambos ? 'respondio' : null)
        || (objetivoSec === 'respondio' && respondioAlgo ? 'respondio' : null);
      if (motivo) {
        if (!dry) {
          await supabase.from('crm_secuencia_miembros').update({ detenida_at: ahora.toISOString(), motivo, canales_detenidos: cd }).eq('id', m.id);
          /* Y se baja de los mensajes DENTRO de Sacs. Sin esto, el que acaba de
             pagar seguiría viendo el modal que le ofrece contratar: la peor
             forma de recibir a alguien que acaba de darte dinero. Las bajas
             importan tanto como las altas. */
          try {
            const camps = await campanasDeSecuencia(sec.id);
            if (camps.length) {
              const cuenta = await cuentaDelLead(c);
              if (cuenta) for (const cid of camps) await retirarInapp(cid, cuenta);
            }
          } catch (e: any) { console.warn('[secuencias] baja in-app', c.id, e?.message || e); }
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_salida', automatico: true,
            titulo: `Salió de la secuencia "${sec.nombre}": ${motivo}`, metadata: { secuencia_id: sec.id, motivo, dia: dias } });
          await notaInbox(c.id, `Salió de la secuencia "${sec.nombre}" (día ${dias}): ${motivo}.`);
          await ejecutarAcciones(sec, c, motivo, dias);
        }
        res.graduados++;
        continue;
      }
      vigentes.push({ m, c, dias, cd });
    }

    // 3) ENVIAR — ventana y días de ESTA secuencia (dry los ignora para simular).
    const diasEnvio: number[] = Array.isArray(sec.dias_envio) && sec.dias_envio.length ? sec.dias_envio : [1, 2, 3, 4, 5];
    if (!dry && (hora < sec.hora_inicio || hora >= sec.hora_fin || !diasEnvio.includes(diaIso))) continue;
    const { data: pasos } = await supabase.from('crm_secuencia_pasos')
      .select('*').eq('secuencia_id', sec.id).eq('activo', true).order('orden');
    // Freno de ráfaga: si una campaña mete cientos de leads, cada corrida
    // manda máximo esto por canal; el resto sale la siguiente hora solo.
    const MAX_POR_CORRIDA = 60;
    let corridaCorreos = 0, corridaWas = 0;

    // La reunión próxima de cada miembro: alimenta {{fecha_sesion}},
    // {{link_reagendar}}, {{link_gcal}} y {{link_meet}} en los correos.
    const reunionPor: Record<string, any> = {};
    const vencidaPor: Record<string, string> = {};   // reunión pasada sin asistencia marcada
    if (vigentes.length) {
      const hoyStr = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
      const { data: bks } = await supabase.from('bookings')
        .select('contact_id, fecha, hora_inicio, token_reagendar, google_meet_link, event_types(nombre, duracion_minutos)')
        .in('contact_id', vigentes.map(v => v.c.id)).eq('estado', 'confirmada').gte('fecha', hoyStr)
        .order('fecha').limit(300);
      for (const b of bks || []) if (!reunionPor[b.contact_id]) reunionPor[b.contact_id] = b;

      // La reunión que YA PASÓ y sigue en 'confirmada': nadie marcó asistencia.
      // Sin esto la secuencia no puede distinguir «todavía no llega» de «ya fue
      // y no lo registraron», y le manda preparación a quien ya estuvo.
      const { data: bksPasadas } = await supabase.from('bookings')
        .select('contact_id, fecha')
        .in('contact_id', vigentes.map(v => v.c.id)).eq('estado', 'confirmada').lt('fecha', hoyStr)
        .order('fecha', { ascending: false }).limit(300);
      for (const b of bksPasadas || []) if (!vencidaPor[b.contact_id]) vencidaPor[b.contact_id] = b.fecha;
    }
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const extrasReunion = (cid: string) => {
      const b = reunionPor[cid];
      if (!b) return { link_reagendar: 'https://www.sacscloud.com/agendar' };
      const [y, mo, d] = String(b.fecha).split('-').map(Number);
      const [hh, mi] = String(b.hora_inicio).slice(0, 5).split(':').map(Number);
      const dur = (b.event_types as any)?.duracion_minutos || 30;
      const ini = `${y}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}${String(mi).padStart(2, '0')}00`;
      const finMin = hh * 60 + mi + dur;
      const fin = `${y}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}T${String(Math.floor(finMin / 60)).padStart(2, '0')}${String(finMin % 60).padStart(2, '0')}00`;
      const titulo = encodeURIComponent(`Sesión consultiva con Sacs`);
      const detalles = encodeURIComponent(`Tu sesión consultiva.${b.google_meet_link ? ' Únete: ' + b.google_meet_link : ''}`);
      const ampm = hh >= 12 ? 'p. m.' : 'a. m.';
      const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      return {
        fecha_sesion: `${d} de ${MESES[mo - 1]}`,
        hora_sesion: `${h12}:${String(mi).padStart(2, '0')} ${ampm}`,
        link_reagendar: b.token_reagendar ? `https://www.sacscloud.com/agendar/reagendar?token=${b.token_reagendar}` : 'https://www.sacscloud.com/agendar',
        link_gcal: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${ini}/${fin}&ctz=America/Mexico_City&details=${detalles}`,
        link_meet: b.google_meet_link || '',
      };
    };
    for (const { m, c, dias, cd } of vigentes) {
      if (c.retenido_hasta && new Date(c.retenido_hasta) > ahora) continue;   // pausa: se salta, no sale
      const enviados: Record<string, string> = m.enviados || {};
      let correoHecho = false, waHecho = false, cambio = false;
      let inappHecho = false;   // un mensaje dentro de Sacs por lead y corrida
      // ── Las tres condiciones de la secuencia de demo agendada ──
      // El arco supone pista antes de la sesión, y no la hay: 27 de 31
      // reuniones se agendan para el mismo día o el siguiente (mediana 0). Sin
      // esto, casi todo el arco llega DESPUÉS de la reunión: preguntarle a
      // alguien qué quiere ver en una sesión que ya tuvo.
      const esDemo = (sec.objetivo || 'agendo') === 'demo_hecha';
      const reunionFutura = !!reunionPor[c.id];
      const reunionVencida = vencidaPor[c.id] || null;

      // (2) Si la reunión ya pasó y nadie marcó asistencia, la secuencia se
      // para sola y lo dice. Antes seguía mandando «¿se te movió la agenda?» a
      // quien ya estuvo en la llamada, por el simple retraso de un registro.
      if (esDemo && reunionVencida && !dry) {
        if (!m.detenida_at) {
          await supabase.from('crm_secuencia_miembros')
            .update({ detenida_at: ahora.toISOString(), motivo: 'reunion_sin_marcar' }).eq('id', m.id);
          await notaInbox(c.id, `Secuencia "${sec.nombre}" en pausa: la reunión del ${reunionVencida} ya pasó y no está marcada como asistió o no asistió. Márcala y la secuencia sigue sola.`);
        }
        continue;
      }

      // En permanente no manda el calendario, manda la rotación: el paso ya se
      // eligió arriba por cuántos lleva recibidos. Se recorre solo ese.
      const aRecorrer = (sec as any)._pasoForzado ? [(sec as any)._pasoForzado] : (pasos || []);
      for (const p of aRecorrer) {
        if (!(sec as any)._pasoForzado && (p.dia > dias || enviados[p.id])) continue;
        if ((sec as any)._pasoForzado && enviados[p.id]) continue;

        // (3) El arco son dos tramos, no una lista: los pasos hasta el día 4
        // PREPARAN la sesión y solo tienen sentido si la sesión no ha ocurrido;
        // del 6 en adelante RESCATAN, y solo tienen sentido si ya pasó sin
        // asistir. Como una sola lista lineal, el rescate le llegaba a quien sí
        // asistió y la preparación a quien ya no la necesitaba.
        if (esDemo) {
          const esPreparacion = p.dia <= 4;
          if (esPreparacion && !reunionFutura) continue;   // sin sesión por delante, no se prepara nada
          if (!esPreparacion && reunionFutura) continue;   // con sesión viva, no se rescata
        }
        if (p.canal === 'correo' && (cd.correo || correoHecho || !c.email || !p.email_template_id || corridaCorreos >= MAX_POR_CORRIDA || envioHoy[c.id]?.correo)) continue;
        if (p.canal === 'wa' && (cd.wa || waHecho || !c.whatsapp || !p.wa_plantilla || corridaWas >= MAX_POR_CORRIDA || envioHoy[c.id]?.wa)) continue;
        /* El in-app NO consume el cupo de «un correo y un WhatsApp por día»: no
           interrumpe a nadie —espera dentro del sistema a que entre— y no
           cuesta envío. Tampoco se detiene cuando el lead responde por otro
           canal: que conteste el correo no es razón para quitarle de la
           pantalla el modal que le explica su promoción. */
        if (p.canal === 'inapp' && (inappHecho || !p.inapp_campana_id)) continue;
        if (dry) { res.envios.push({ sec: sec.nombre, lead: c.id, dia: dias, paso: p.orden, canal: p.canal }); if (p.canal === 'correo') correoHecho = true; else if (p.canal === 'wa') waHecho = true; else inappHecho = true; continue; }
        const primerNombre = String(c.nombre || '').trim().split(/\s+/)[0] || null;
        /* Las variables de renovación —su fecha, su monto, sus dos fechas
           límite y lo que ahorra en cada tramo— solo se calculan si la
           secuencia las va a usar. `plantillas.ts` ya declaraba
           `monto_renovacion`, `plan` y `sucursales` como variables desde
           siempre; lo que faltaba era alguien que las llenara.

           Sin esto, el correo diría «renueva antes y te damos 10%» sin decir
           antes de cuándo ni sobre cuánto — y hacer esa cuenta le tocaría al
           que lo recibe, que es como no ofrecer nada. */
        let extraRenov: any = {};
        if (anclaSec === 'renovacion') {
          const r = await ctxRenovacion(c.company_id);
          /* Sin contexto NO se manda. Una suscripción sin fecha de próxima
             factura o sin monto —hay varias así en la base— produciría un correo
             que dice «tu renovación es el  por », con los huecos donde iban los
             datos. Es preferible saltarlo y que quede anotado. */
          if (!r) { res.saltados.push({ lead: c.id, motivo: 'sin_datos_de_renovacion' }); continue; }
          extraRenov = r;
        }
        const ctx = { nombre: primerNombre, campana: c.campana || null, empresa: (c as any).companies?.nombre_comercial || (c as any).companies?.nombre || null, ...extrasReunion(c.id), ...extraRenov };
        try {
          if (p.canal === 'correo') {
            // A/B: si el paso tiene variante B, el lead cae en A o B por el
            // hash de su id — estable entre corridas, mitad y mitad.
            // A/B: también en permanente. Es donde MÁS sirve, porque corre
            // indefinidamente y hay tiempo de que la mitad y la mitad digan algo.
            let tid = p.email_template_id, variante: string | null = null;
            if (p.email_template_id_b) {
              const par = parseInt(String(c.id).replace(/-/g, '').slice(0, 8), 16) % 2;
              variante = par ? 'B' : 'A';
              if (par) tid = p.email_template_id_b;
            }
            const { data: pl } = await supabase.from('email_templates').select('nombre, asunto, preview_text, bloques').eq('id', tid).maybeSingle();
            if (!pl?.bloques || !t) continue;
            const asunto = interpolar(pl.asunto || '', ctx);
            const r = await enviarCorreo({ tenantId: t.id, para: c.email, asunto,
              html: compilar(pl.bloques, ctx, t, pl.preview_text ? interpolar(pl.preview_text, ctx) : null),
              texto: compilarTexto(pl.bloques, ctx), categoria: 'relacion', contactId: c.id,
              templateId: tid, variante } as any);
            if (!(r as any)?.enviado) continue;
            correoHecho = true; corridaCorreos++; (envioHoy[c.id] = envioHoy[c.id] || {}).correo = true;
            await notaInbox(c.id, `Secuencia "${sec.nombre}" · día ${p.dia}: correo "${asunto}" enviado a ${c.email}.`);
          } else if (p.canal === 'wa') {
            // ── Dos candados antes de escribirle ──
            // 1. Un WhatsApp por lead por día, contando TODO lo que salió — el
            //    cron, otra secuencia, o un vendedor desde la bandeja. Aquí no
            //    se fuerza nunca: no hay nadie mirando.
            // 2. Si una persona tomó la conversación, la cadencia se hace a un
            //    lado 5 días. El lead no debe escuchar dos voces a la vez.
            const presion = await puedeMandarWa(c.whatsapp);
            if (!presion.ok) { res.saltados.push({ lead: c.id, motivo: 'presion_wa', libre_en: presion.libreEn?.toISOString() }); continue; }
            if (await cadenciaPausadaPorPersona(c.whatsapp)) { res.saltados.push({ lead: c.id, motivo: 'la tomo una persona' }); continue; }
            await enviarPlantilla(c.whatsapp, p.wa_plantilla, 'es_MX', [primerNombre || '👋']);
            waHecho = true; corridaWas++; (envioHoy[c.id] = envioHoy[c.id] || {}).wa = true;
          } else if (p.canal === 'inapp') {
            /* Se mete su cuenta en la audiencia de la campaña y se republica.
               La campaña es el mensaje; la secuencia decide a quién y cuándo. */
            const cuenta = await cuentaDelLead(c);
            if (!cuenta) { res.saltados.push({ lead: c.id, motivo: 'sin_cuenta_sacs' }); continue; }
            const r = await entregarInapp(p.inapp_campana_id, cuenta);
            /* Si falló NO se marca el paso como enviado: la próxima corrida lo
               reintenta. `incluir_cuentas` es un conjunto, así que reintentar no
               duplica a nadie. Marcarlo igual sería dar por entregado algo que
               el usuario nunca vio. */
            if (!r.ok) { res.saltados.push({ lead: c.id, motivo: 'inapp: ' + r.error }); continue; }
            inappHecho = true;
          }
          enviados[p.id] = ahora.toISOString(); cambio = true;
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_envio', automatico: true,
            titulo: `Secuencia "${sec.nombre}" día ${p.dia}: ${p.canal === 'correo' ? 'correo' : p.canal === 'wa' ? 'WhatsApp' : 'mensaje dentro de Sacs'}`,
            metadata: { secuencia_id: sec.id, paso: p.orden, canal: p.canal, plantilla: p.email_template_id || p.wa_plantilla || p.inapp_campana_id } });
          res.envios.push({ sec: sec.nombre, lead: c.id, dia: dias, paso: p.orden, canal: p.canal });
        } catch (e: any) { console.warn('[secuencias]', c.id, p.canal, e?.message || e); }
      }
      if (cambio) await supabase.from('crm_secuencia_miembros').update({ enviados }).eq('id', m.id);
    }

    // "Caliente sin respuesta": abrió 3+ correos y no ha respondido por
    // ningún canal → aviso a ventas (una sola vez por lead) — es el mejor
    // momento para una llamada y hoy nadie lo veía.
    if (!dry) {
      const candCal = vigentes.filter(v => !v.cd.wa && !v.cd.correo && !(v.c.propiedades as any)?.secuencia_caliente_avisado);
      if (candCal.length) {
        const { data: opens } = await supabase.from('email_sends')
          .select('contact_id, open_count').in('contact_id', candCal.map(v => v.c.id)).gt('open_count', 0).limit(1000);
        const suma: Record<string, number> = {};
        for (const o of opens || []) suma[o.contact_id] = (suma[o.contact_id] || 0) + (o.open_count || 0);
        const calientes = candCal.filter(v => (suma[v.c.id] || 0) >= 3);
        if (calientes.length) {
          try {
            await avisarCalientes(calientes.map(v => ({
              id: v.c.id,
              nombre: `${v.c.nombre || ''} ${v.c.apellido || ''}`.trim() || v.c.email || v.c.whatsapp || v.c.id.slice(0, 8),
              abiertos: suma[v.c.id],
            })));
          } catch (e: any) { console.warn('[secuencias] aviso calientes falló', e?.message || e); }
          for (const v of calientes) {
            res.calientes++;
            await supabase.from('contacts').update({ propiedades: { ...((v.c.propiedades as any) || {}), secuencia_caliente_avisado: ahora.toISOString() } }).eq('id', v.c.id);
            await supabase.from('activities').insert({ contact_id: v.c.id, tipo: 'secuencia_caliente', automatico: true,
              titulo: `Caliente: abrió ${suma[v.c.id]} correos de la secuencia sin responder`,
              metadata: { secuencia_id: sec.id, abiertos: suma[v.c.id] } });
            await notaInbox(v.c.id, `Caliente: abrió ${suma[v.c.id]} correos de la secuencia "${sec.nombre}" sin responder — buen momento para llamar.`);
          }
        }
      }
    }
  }
  return json({ ok: true, dry, ...res, envios: res.envios.length, muestra: res.envios.slice(0, 12) });
};


/**
 * Lo que la secuencia HACE al soltar a alguien, además de dejar de escribirle.
 *
 * Hasta ahora una secuencia solo reaccionaba a la etapa; ninguna la escribía.
 * Eso dejaba el ciclo de los rezagados a medias: la cadencia podía dejar de
 * mandarle, pero alguien tenía que acordarse de moverlo a mano — y nadie se
 * acuerda de 90 leads.
 *
 * Se configura en `acciones.al_salir`:
 *   lifecycle     — a qué etapa se le mueve
 *   marcar        — una marca en propiedades, para distinguirlo. Un lead que
 *                   vuelve de rezagado NO es un lead nuevo: ya nos conoce, ya
 *                   nos ignoró una vez, y el vendedor merece saberlo.
 *   inscribir_en  — el nombre de la secuencia que lo recibe
 *
 * Solo corre con motivos de ÉXITO. Salir por descarte o por baja no es volver
 * al ruedo: mover a `lead` a alguien que pidió que lo dejáramos en paz sería
 * exactamente la forma de acabar marcados como spam.
 */
const MOTIVOS_DE_EXITO = new Set(['respondio', 'agendo', 'demo_hecha', 'convertido']);

async function ejecutarAcciones(sec: any, c: any, motivo: string, dias: number) {
  const acc = (sec.acciones || {}).al_salir;
  if (!acc || !MOTIVOS_DE_EXITO.has(motivo)) return;

  // ── Tope de reciclajes ──
  // A la tercera vuelta completa sin comprar ya no es un lead tibio: es un
  // suscriptor. Devolverlo otra vez a la misma cadencia que ya ignoró dos veces
  // es gastar la relación y el remitente. Se queda donde está y se avisa.
  const vueltas = Number(c.reciclado_veces) || 0;
  const tope = Number((sec.acciones || {}).tope_reciclajes ?? 3);
  if (acc.marcar === 'reciclado' && vueltas >= tope) {
    await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_accion', automatico: true,
      titulo: `Mostró interés por ${vueltas + 1}ª vez pero NO se recicla: llegó al tope`,
      metadata: { secuencia: sec.nombre, vueltas, tope, motivo } }).then(() => {}, () => {});
    await notaInbox(c.id, `Volvió a mostrar interés (vuelta ${vueltas + 1}), pero ya llegó al tope de reciclajes. Vale una llamada, no otra cadencia.`);
    return;
  }

  const parche: any = {};
  if (acc.lifecycle) parche.lifecycle_stage = acc.lifecycle;
  if (acc.marcar) {
    const props = { ...(c.propiedades || {}) };
    props[acc.marcar] = { at: new Date().toISOString(), desde: sec.nombre, motivo };
    parche.propiedades = props;
    if (acc.marcar === 'reciclado') {
      parche.reciclado_at = new Date().toISOString();
      parche.reciclado_veces = (Number(c.reciclado_veces) || 0) + 1;
    }
  }
  if (!Object.keys(parche).length) return;
  await supabase.from('contacts').update(parche).eq('id', c.id);

  await supabase.from('activities').insert({
    contact_id: c.id, tipo: 'secuencia_accion', automatico: true,
    titulo: `Volvió del ciclo: ${sec.nombre} lo devuelve a ${acc.lifecycle || 'su etapa'}${acc.marcar ? ` como ${acc.marcar}` : ''}`,
    metadata: { secuencia: sec.nombre, motivo, dia: dias, ...acc },
  }).then(() => {}, () => {});

  // Encadenar: la siguiente cadencia lo recoge en su próxima corrida por sus
  // propias reglas de entrada. No se le fuerza la inscripción aquí — si ya no
  // cumple la entrada de la otra, meterlo a la fuerza sería saltarse su filtro.
  if (acc.inscribir_en) {
    await notaInbox(c.id, `Reciclado: vuelve como ${acc.lifecycle || 'lead'} y queda listo para "${acc.inscribir_en}".`);
  }

  // ── La campana ──
  // Es el momento más caliente de todo el embudo: alguien que nos ignoró un mes
  // vuelve a levantar la mano. Dejarlo solo como nota en el hilo es esconderlo
  // — la nota la ve quien ya está dentro de esa conversación, y justo aquí lo
  // que hace falta es que alguien ENTRE.
  if (acc.marcar === 'reciclado') {
    const quien = [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || 'Un lead';
    const eng = Number(c.eng_emails_leidos) || 0;
    const senal = c.ultima_actividad_venta_tipo ? ` Su última señal fue por ${c.ultima_actividad_venta_tipo}.` : '';
    await notificar({
      clave: `reciclado:${c.id}:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'lead_reciclado', nivel: 'alerta',
      titulo: `${quien} volvió después de estar rezagado`,
      detalle: `Estuvo ${dias} días en la cadencia de rezagados y mostró interés (${motivo}).${senal}`
             + (eng ? ` Ha leído ${eng} de nuestros correos.` : '')
             + (vueltas ? ` Es su vuelta número ${vueltas + 1}.` : ''),
      destino: 'leads',
      metadata: { contact_id: c.id, secuencia: sec.nombre, motivo, vueltas: vueltas + 1, dias },
    }).catch(() => {});
  }
}
