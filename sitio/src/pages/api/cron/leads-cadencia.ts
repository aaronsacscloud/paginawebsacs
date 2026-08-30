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
import { puedeMandarWa, cadenciaPausadaPorPersona } from '../../../lib/whatsapp/presion';
import { enviarPlantilla } from '../../../lib/whatsapp/kapso-api';
import { avisarCalientes } from '../../../lib/crm/aviso-lead';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

// La ESCALERA del lead y el umbral del objetivo: una secuencia gradúa al
// miembro cuando su avance ALCANZA el objetivo (o lo rebasa). Así "agendó"
// es salida para la secuencia de seguimiento (objetivo agendo) pero es la
// ENTRADA de la de demo agendada (objetivo demo_hecha).
const RANGO: Record<string, number> = { respondio: 1, descubrimiento: 1, agendado: 2, demo_hecha: 3, cotizado: 4, negociando: 4 };
const UMBRAL: Record<string, number> = { respondio: 1, agendo: 2, demo_hecha: 3, convertido: 99 };
function motivoSalida(c: any, objetivo: string): string | null {
  if (c.archived_at) return 'archivado';
  if (c.estatus_lead === 'descartado' || c.calificacion === 'no_califica') return 'descartado';
  if (c.lifecycle_stage === 'cliente') return 'convertido';
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
      .select('id, estatus_lead_at, propiedades, nombre, email, whatsapp, telefono, campana, giro, estatus_lead, lifecycle_stage, calificacion, retenido_hasta, descarte_categoria, sucursales_interes, reuniones_total, reuniones_no_asistio, reuniones_reagendadas, last_contact_at, created_at, owner_id, companies(giro, sucursales)')
      .in('lifecycle_stage', lifecycleIn).in('estatus_lead', estatusIn)
      .is('archived_at', null).eq('wa_optout', false)
      .limit(tope);
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
      const llego = (c.propiedades as any)?.tiktok?.creado || c.estatus_lead_at;
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
        .insert({ secuencia_id: sec.id, contact_id: c.id });
      if (!error) {
        res.enrolados++;
        await notaInbox(c.id, `Entró a la secuencia "${sec.nombre}" (día 1 hoy).`);
      }
    }

    // 2) GRADUAR + canales — miembros vigentes: salida total con motivo, o
    //    detención del canal por el que respondió.
    const { data: miembros } = await supabase.from('crm_secuencia_miembros')
      .select('id, contact_id, inicio, enviados, canales_detenidos, contacts(id, nombre, apellido, email, whatsapp, campana, estatus_lead, lifecycle_stage, calificacion, retenido_hasta, wa_optout, archived_at, propiedades)')
      .eq('secuencia_id', sec.id).is('detenida_at', null).limit(300);

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
      const dias = Math.floor((ahora.getTime() - Date.parse(m.inicio)) / 86400000) + 1;
      const cd: Record<string, any> = { ...(m.canales_detenidos || {}) };
      let cdCambio = false;

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
      const motivo = motivoSalida(c, objetivoSec) || (dias > sec.corte_dias ? 'corte' : null)
        || (ambos ? 'respondio' : null)
        || (objetivoSec === 'respondio' && respondioAlgo ? 'respondio' : null);
      if (motivo) {
        if (!dry) {
          await supabase.from('crm_secuencia_miembros').update({ detenida_at: ahora.toISOString(), motivo, canales_detenidos: cd }).eq('id', m.id);
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_salida', automatico: true,
            titulo: `Salió de la secuencia "${sec.nombre}": ${motivo}`, metadata: { secuencia_id: sec.id, motivo, dia: dias } });
          await notaInbox(c.id, `Salió de la secuencia "${sec.nombre}" (día ${dias}): ${motivo}.`);
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

      for (const p of pasos || []) {
        if (p.dia > dias || enviados[p.id]) continue;

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
        if (dry) { res.envios.push({ sec: sec.nombre, lead: c.id, dia: dias, paso: p.orden, canal: p.canal }); if (p.canal === 'correo') correoHecho = true; else waHecho = true; continue; }
        const primerNombre = String(c.nombre || '').trim().split(/\s+/)[0] || null;
        const ctx = { nombre: primerNombre, campana: c.campana || null, ...extrasReunion(c.id) };
        try {
          if (p.canal === 'correo') {
            // A/B: si el paso tiene variante B, el lead cae en A o B por el
            // hash de su id — estable entre corridas, mitad y mitad.
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
          } else {
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
          }
          enviados[p.id] = ahora.toISOString(); cambio = true;
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_envio', automatico: true,
            titulo: `Secuencia "${sec.nombre}" día ${p.dia}: ${p.canal === 'correo' ? 'correo' : 'WhatsApp'}`,
            metadata: { secuencia_id: sec.id, paso: p.orden, canal: p.canal, plantilla: p.email_template_id || p.wa_plantilla } });
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
