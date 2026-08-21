// OUTBOUND · Cron cada 15 min: ingesta de eventos + metas + intereses +
// circuit breaker espejo + re-evaluación diaria del modo continuo.
//
// Mismos patrones de robustez que sync-sacs-*: presupuesto de tiempo,
// cursor progresivo persistido (inapp_sync), y FALLAR RUIDOSO — si había
// trabajo y no se avanzó nada, el status es 500 para que se note (el puente
// ya estuvo caído 6 días en silencio una vez).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { resolverAudiencia, docParaSacs, despublicarCampana, leerPaginado } from '../../../lib/outbound/motor';
import { normCuenta } from '../../../lib/crm/sacs-cuentas';
import { cortesEscala } from '../../../lib/outbound/catalogo';
import { notificar } from '../../../lib/crm/notificaciones';

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const PRESUPUESTO_MS = 120_000;

function lunesDe(d = new Date()): string {
  const x = new Date(d); const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

async function sacs(ruta: string, body: any) {
  const r = await fetch(SACS_API + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`sacs_api ${ruta} → ${r.status}`);
  return r.json();
}

async function leerSync(id: string): Promise<any> {
  const { data } = await supabase.from('inapp_sync').select('valor').eq('id', id).single();
  return data?.valor || {};
}
async function guardarSync(id: string, valor: any) {
  await supabase.from('inapp_sync').upsert({ id, valor, updated_at: new Date().toISOString() });
}

// ── 1. Ingesta de eventos (cursor progresivo) ────────────────────────────────
async function ingerirEventos(deadline: number): Promise<{ ingeridos: number; error?: string }> {
  const sync = await leerSync('eventos_cursor');
  let cursor = sync.desde || null;
  let cursorId = sync.desde_id || null;
  let ingeridos = 0;
  while (Date.now() < deadline) {
    const r = await sacs('/interno/crm/campanas-eventos', { desde: cursor, desde_id: cursorId, limite: 1000 });
    const evs = r.eventos || [];
    if (!evs.length) break;
    const filas = evs.map((e: any) => ({
      campana_id: e.campana_id, cuenta: normCuenta(e.cuenta), uid: String(e.uid || ''),
      evento: e.evento, boton: e.boton, valor: e.valor, variante: e.variante,
      comentario: e.comentario || null,
      dia: e.dia || null, created: e.created,
    })).filter((f: any) => f.uid && f.cuenta);
    // Los ids de campañas de PRUEBA (<uuid>-prueba) no existen en inapp_campanas
    // y no deben contar: se filtran aquí, no en sacs_api (allá son eventos válidos).
    const reales = filas.filter((f: any) => !String(f.campana_id).endsWith('-prueba'));
    if (reales.length) {
      const { error } = await supabase.from('inapp_eventos')
        .upsert(reales, { onConflict: 'campana_id,uid,evento,created', ignoreDuplicates: true });
      if (error) return { ingeridos, error: error.message };
      ingeridos += reales.length;
      // Alerta de DETRACTOR (NPS ≤ 6): el mismo día, no en el reporte del
      // trimestre. notificar() es idempotente por clave y nunca lanza.
      const encuestas = reales.filter((f: any) => f.evento === 'respuesta_encuesta' && f.valor != null);
      // Escala por campaña (para saber qué es detractor en ESTA escala).
      const escalaPorCamp: Record<string, string> = {};
      const esCsatSoporte: Record<string, boolean> = {};   // campaña CSAT post-soporte
      if (encuestas.length) {
        const idsE = Array.from(new Set(encuestas.map((f: any) => f.campana_id)));
        const { data: campsE } = await supabase.from('inapp_campanas').select('id, contenido, meta').in('id', idsE);
        for (const c of (campsE || [])) { escalaPorCamp[c.id] = c.contenido?.encuesta?.escala || 'nps'; esCsatSoporte[c.id] = c.meta?.csat_soporte === true; }
      }
      for (const d of encuestas) {
        const cx = cortesEscala(escalaPorCamp[d.campana_id]);
        let companyId: string | null = null;
        try {
          const { data: fila } = await supabase.from('company_sacs_accounts').select('company_id').eq('cuenta', d.cuenta).maybeSingle();
          companyId = fila?.company_id || null;
        } catch { /* sin empresa ligada: el aviso sale igual */ }

        // CSAT post-soporte: cerrar el loop escribiendo la calificación en el
        // ticket resuelto más reciente de esa cuenta que aún no tenga CSAT.
        if (esCsatSoporte[d.campana_id] && d.valor != null) {
          try {
            const { data: tk } = await supabase.from('crm_soporte_tickets')
              .select('conversation_id').eq('cuenta', d.cuenta).eq('estado', 'resuelto').is('csat_score', null)
              .order('resuelto_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
            if (tk) await supabase.from('crm_soporte_tickets')
              .update({ csat_score: Number(d.valor), csat_at: new Date().toISOString() })
              .eq('conversation_id', tk.conversation_id);
          } catch { /* mejor-esfuerzo */ }
        }
        if (Number(d.valor) <= cx.det) {
          await notificar({
            clave: `outbound-detractor:${d.campana_id}:${d.uid}:${d.created}`,
            tipo: 'outbound_detractor',
            nivel: 'alerta',
            titulo: `Encuesta detractor (${d.valor}) en ${d.cuenta}`,
            detalle: d.comentario ? `"${d.comentario}"` : 'Sin comentario. Vale una llamada de CS.',
            company_id: companyId,
            metadata: { campana_id: d.campana_id, cuenta: d.cuenta, valor: d.valor },
          });
          // …y la TAREA en la ficha, para que no se quede en aviso: el loop del
          // NPS se cierra con contacto humano, no con un badge.
          if (companyId) {
            const { data: yaTarea } = await supabase.from('activities')
              .select('id').eq('company_id', companyId).eq('tipo', 'tarea')
              .contains('metadata', { origen: 'outbound_detractor', evento_created: d.created }).limit(1);
            if (!yaTarea?.length) {
              await supabase.from('activities').insert({
                company_id: companyId, tipo: 'tarea',
                titulo: `Llamar: encuesta detractor (${d.valor}) en ${d.cuenta}`,
                descripcion: d.comentario ? `Comentario del cliente: "${d.comentario}"` : 'Respondió el NPS con calificación baja y sin comentario.',
                metadata: { origen: 'outbound_detractor', campana_id: d.campana_id, cuenta: d.cuenta, valor: d.valor, evento_created: d.created },
              });
            }
          }
        }
        // Promotor (según la escala): interés "Promotor NPS" → plantilla de reseña.
        if (Number(d.valor) >= cx.prom && cx.esNps && companyId) {
          try {
            // Merge leer-modificar-escribir: seguro dentro de un tick (ingesta
            // se await-ea completa antes del loop secuencial de campañas). Se
            // marca la fecha, no se acumula ciegamente el score, para que dos
            // ticks traslapados no inflen el promotor.
            const { data: comp } = await supabase.from('companies').select('intereses').eq('id', companyId).maybeSingle();
            const intereses = { ...(comp?.intereses || {}) };
            // "Promotor NPS" es un marcador (score 1), no un acumulador: dos
            // ticks traslapados no lo inflan. Refresca la fecha del último 9-10.
            intereses['Promotor NPS'] = { score: 1, ultimo: new Date().toISOString(), campana: d.campana_id };
            await supabase.from('companies').update({ intereses }).eq('id', companyId);
          } catch { /* el interés es mejor-esfuerzo */ }
        }
      }
    }
    // Guard de no-avance: si el cursor no se movió con hay_mas=true, salir en
    // vez de quemar el presupuesto reintentando la misma página.
    const nuevoCursor = r.siguiente || cursor;
    const nuevoId = r.siguiente_id || cursorId;
    if (r.hay_mas && nuevoCursor === cursor && nuevoId === cursorId) break;
    cursor = nuevoCursor;
    cursorId = nuevoId;
    await guardarSync('eventos_cursor', { desde: cursor, desde_id: cursorId });
    if (!r.hay_mas) break;
  }
  return { ingeridos };
}

// ── 2. Métricas + breaker + metas por campaña activa ─────────────────────────
async function procesarCampana(c: any): Promise<any> {
  // Paginado: max_rows=1000 de PostgREST capa cualquier select — sin esto, el
  // circuit breaker y el brazo expuesto/control se calculan sobre un
  // subconjunto arbitrario en cuanto la campaña rebasa 1000 eventos.
  const evs = await leerPaginado((from, to) => supabase.from('inapp_eventos')
    .select('evento, uid, cuenta, valor').eq('campana_id', c.id)
    .order('id', { ascending: true }).range(from, to));
  const usuarios = new Set<string>(); const clics = new Set<string>(); const cuentasVieron = new Set<string>();
  const vistas: Record<string, number> = {}; const interesados = new Set<string>();
  const cuentaDeUsuario: Record<string, string> = {};
  let impresiones = 0, descartes = 0;
  const citas: Array<{ cuenta: string; uid: string }> = [];
  const npsValores: number[] = [];
  for (const e of evs) {
    cuentaDeUsuario[e.uid] = e.cuenta;
    if (e.evento === 'impresion') { impresiones++; usuarios.add(e.uid); cuentasVieron.add(e.cuenta); vistas[e.uid] = (vistas[e.uid] || 0) + 1; }
    if (e.evento === 'clic' || e.evento === 'chat_abierto' || e.evento === 'respuesta_encuesta') { clics.add(e.uid); interesados.add(e.uid); }
    if (e.evento === 'cita_agendada') { citas.push({ cuenta: e.cuenta, uid: e.uid }); clics.add(e.uid); interesados.add(e.uid); }
    if (e.evento === 'respuesta_encuesta' && e.valor != null) npsValores.push(Number(e.valor));
    if (e.evento === 'descarte') descartes++;
  }
  for (const [u, n] of Object.entries(vistas)) if (n >= 2) interesados.add(u);

  // Circuit breaker espejo (sacs_api ya lo aplica en vivo; aquí se refleja el
  // estado en el CRM y se despublica del todo).
  if (c.estado === 'activa' && impresiones >= 200 && descartes / Math.max(impresiones, 1) > 0.6) {
    await despublicarCampana(c.id);
    await supabase.from('inapp_campanas').update({ estado: 'pausada', pausa_motivo: 'circuit_breaker', updated_at: new Date().toISOString() }).eq('id', c.id);
    await notificar({
      clave: `outbound-breaker:${c.id}`, tipo: 'outbound_breaker', nivel: 'urgente',
      titulo: `Campaña auto-pausada: "${c.nombre}"`,
      detalle: `El descarte superó el umbral (${descartes} descartes en ${impresiones} impresiones). Revisa el mensaje antes de reanudarla.`,
      metadata: { campana_id: c.id },
    });
  }

  // ── Meta (view-through): se evalúa por CUENTA objetivo contra los datos del
  // puente. Brazo: 'expuesto' si la cuenta vio la campaña; 'control' si no
  // registra NINGÚN evento (proxy del holdout — se refina en F4 con el sorteo
  // por uid cuando el nivel es de usuarios). plugin_activo queda para F4: el
  // puente aún no reporta plugins por cuenta.
  const targets: string[] = (c.materializada?.cuentas_lista || []).map(normCuenta);
  let conversiones = 0;
  // Meta "agendó una cita": el evento cita_agendada (postMessage del embed →
  // sacs3 → sacs_api) YA trae cuenta y uid — conversión directa, brazo expuesto
  // por definición (para agendar tuvo que ver el modal).
  if (c.meta?.tipo === 'cita_agendada' && citas.length) {
    const vistasCitas = new Set<string>();
    for (const cita of citas) {
      const k = `${cita.cuenta}|${cita.uid}`;
      if (vistasCitas.has(k)) continue;
      vistasCitas.add(k);
      const { error } = await supabase.from('inapp_conversiones')
        .upsert({ campana_id: c.id, company_id: null, cuenta: cita.cuenta, uid: cita.uid, brazo: 'expuesto', detalle: { meta: c.meta } },
                { onConflict: 'campana_id,cuenta,uid' });
      if (!error) conversiones++;
    }
  }
  if (c.meta && targets.length && ['uso_modulo', 'plan', 'plugin_activo'].includes(c.meta.tipo)) {
    const desde = c.publicada_at ? new Date(c.publicada_at) : null;
    // Por LOTES (no un tope mudo): con >N cuentas objetivo, el resto quedaba
    // sin evaluar la meta en silencio.
    const filas: any[] = [];
    for (let i = 0; i < targets.length; i += 500) {
      const { data } = await supabase.from('company_sacs_accounts')
        .select('cuenta, company_id, companies(id, plan, uso_sacs)')
        .in('cuenta', targets.slice(i, i + 500));
      filas.push(...(data || []));
    }
    for (const f of (filas || [])) {
      const comp: any = (f as any).companies;
      if (!comp) continue;
      let convirtio = false;
      if (c.meta.tipo === 'plan') convirtio = comp.plan === c.meta.valor;
      if (c.meta.tipo === 'plugin_activo') {
        const pls: any[] = comp.uso_sacs?.plugins || [];
        convirtio = pls.indexOf(String(c.meta.valor || '').trim()) !== -1;
      }
      if (c.meta.tipo === 'uso_modulo') {
        const mods: any[] = comp.uso_sacs?.modulos || [];
        const m = mods.find((x: any) => x && x.modulo === c.meta.valor && x.usa);
        convirtio = !!m && (!desde || !m.ultimo || new Date(m.ultimo) >= desde);
        // Meta con RETENCIÓN: "lo usó al menos N veces" (docs_30d del puente),
        // no un toque de curiosidad. Sin `veces` basta con usarlo.
        if (convirtio && Number(c.meta.veces) > 1) {
          convirtio = (Number(m?.docs_30d) || 0) >= Number(c.meta.veces);
        }
      }
      if (!convirtio) continue;
      const cuenta = normCuenta(f.cuenta);
      const tieneEventos = evs.some(e => e.cuenta === cuenta);
      const brazo = cuentasVieron.has(cuenta) ? 'expuesto' : (tieneEventos ? 'expuesto' : 'control');
      // Ingreso atribuido: para la meta "plan", el ARR de las suscripciones de
      // ESE plan nacidas después de publicar (dentro de la ventana). Para
      // plugin_activo aún no hay monto mapeable (los plugins no siempre son
      // una suscripción propia) — queda en 0 y el conteo sí habla.
      let monto = 0;
      if (c.meta.tipo === 'plan' && desde) {
        const hasta = new Date(desde.getTime() + (Number(c.ventana_atribucion_dias) || 14) * 86400000);
        const { data: subs } = await supabase.from('subscriptions')
          .select('arr, created_at, nombre_plan').eq('company_id', comp.id)
          .gte('created_at', desde.toISOString()).lte('created_at', hasta.toISOString());
        monto = (subs || []).filter((sb: any) => String(sb.nombre_plan || '').toLowerCase().includes(String(c.meta.valor || '').toLowerCase()))
          .reduce((a: number, sb: any) => a + (Number(sb.arr) || 0), 0);
      }
      // upsert SIN ignoreDuplicates: el primer tick puede calcular monto=0
      // (companies.plan cambia antes de que exista la suscripción) y el
      // siguiente lo corrige — congelarlo dejaba el KPI de ingreso mintiendo.
      const { error } = await supabase.from('inapp_conversiones')
        .upsert({ campana_id: c.id, company_id: comp.id, cuenta, uid: '', brazo, detalle: { meta: c.meta, monto } },
                { onConflict: 'campana_id,cuenta,uid' });
      if (!error) conversiones++;
    }
  }

  // ── Interés por módulo → companies.intereses (condición de audiencia de email)
  const modInteres = c.meta?.tipo === 'uso_modulo' ? c.meta.valor : (c.contenido?.modulo_interes || null);
  if (modInteres && interesados.size) {
    const cuentasInteres = new Set<string>();
    for (const u of interesados) if (cuentaDeUsuario[u]) cuentasInteres.add(cuentaDeUsuario[u]);
    if (cuentasInteres.size) {
      const listaInteres = Array.from(cuentasInteres);
      const filas: any[] = [];
      for (let i = 0; i < listaInteres.length; i += 500) {
        const { data } = await supabase.from('company_sacs_accounts')
          .select('cuenta, company_id, companies(id, intereses)')
          .in('cuenta', listaInteres.slice(i, i + 500));
        filas.push(...(data || []));
      }
      const porCompany: Record<string, { intereses: any; score: number }> = {};
      for (const f of (filas || [])) {
        const comp: any = (f as any).companies;
        if (!comp) continue;
        porCompany[comp.id] = porCompany[comp.id] || { intereses: comp.intereses || {}, score: 0 };
        porCompany[comp.id].score++;
      }
      for (const [companyId, v] of Object.entries(porCompany)) {
        // merge en JS (leer-modificar-escribir): el cron es el único escritor
        // de esta columna, y el merge por llave evita pisar los intereses que
        // otras campañas ya escribieron en el mismo jsonb.
        const intereses = { ...(v.intereses || {}) };
        const prev = intereses[modInteres] || { score: 0 };
        intereses[modInteres] = {
          score: Math.max(Number(prev.score) || 0, v.score),
          ultimo: new Date().toISOString(),
          campana: c.id,
        };
        await supabase.from('companies').update({ intereses }).eq('id', companyId);
      }
    }
  }

  // Ingreso atribuido desde la verdad (suma de detalle.monto de conversiones)
  let ingreso = 0;
  try {
    const { data: convRows } = await supabase.from('inapp_conversiones')
      .select('detalle').eq('campana_id', c.id).eq('brazo', 'expuesto').limit(1000);
    ingreso = (convRows || []).reduce((a: number, r: any) => a + (Number(r.detalle?.monto) || 0), 0);
  } catch { /* sin ingreso legible: 0 */ }

  // Primera conversión: aviso de hito (idempotente por clave)
  if (conversiones > 0) {
    await notificar({
      clave: `outbound-primera-conversion:${c.id}`, tipo: 'outbound_hito', nivel: 'info',
      titulo: `Primera conversión de "${c.nombre}"`,
      detalle: `La meta ya se cumplió al menos una vez.` + (ingreso ? ` Ingreso atribuido: $${Math.round(ingreso).toLocaleString('es-MX')}.` : ''),
      metadata: { campana_id: c.id },
    });
  }

  // ── Resumen cacheado para la lista (la verdad completa vive en resultados.ts)
  await supabase.from('inapp_campanas').update({
    resumen: {
      impresiones, usuarios: usuarios.size, cuentas_vieron: cuentasVieron.size,
      clics: clics.size, ctr: usuarios.size ? +((clics.size / usuarios.size) * 100).toFixed(1) : 0,
      descartes, interes: interesados.size, conversiones,
      citas: citas.length,
      ingreso,
      nps: npsValores.length ? (() => {
        const cx = cortesEscala(c.contenido?.encuesta?.escala);
        const prom = npsValores.filter(v => v >= cx.prom).length;
        const det = npsValores.filter(v => v <= cx.det).length;
        return {
          respuestas: npsValores.length,
          promedio: +(npsValores.reduce((a, b) => a + b, 0) / npsValores.length).toFixed(1),
          promotores: prom, pasivos: npsValores.length - prom - det, detractores: det,
          score: cx.esNps ? Math.round((prom - det) / npsValores.length * 100) : null,
        };
      })() : null,
      at: new Date().toISOString(),
    },
  }).eq('id', c.id);
  return { id: c.id, impresiones, conversiones };
}

// ── 3. Modo continuo: re-materializar una vez al día ─────────────────────────
async function reevaluarContinuas(deadline: number): Promise<number> {
  const { data: campanas } = await supabase.from('inapp_campanas')
    .select('*').eq('estado', 'activa').eq('modo', 'continua').limit(100);
  let re = 0;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const c of (campanas || [])) {
    if (Date.now() > deadline) break;
    if ((c.materializada?.at || '').slice(0, 10) === hoy) continue; // ya se re-evaluó hoy
    try {
      const res = await resolverAudiencia(c.audiencia || {});
      if (!res.cuentas.length) continue;
      await sacs('/interno/crm/campanas-publicar', { campanas: [docParaSacs(c, res.cuentas)] });
      await supabase.from('inapp_campanas').update({
        publicada_at: c.publicada_at || new Date().toISOString(),
        materializada: {
          cuentas: res.cuentas.length, companies: res.companies.length,
          exclusiones: res.exclusiones, cuentas_lista: res.cuentas, at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', c.id);
      re++;
    } catch { /* la siguiente corrida la reintenta; el fallo global se reporta abajo */ }
  }
  return re;
}


// ── 4. Pasos cross-canal (embudo): in-app → email → tarea WhatsApp ──────────
// Regla de oro: quien YA cumplió la meta sale del embudo (no se le vende lo
// comprado). Un paso de email ejecuta UNA vez (las campañas de email son de
// un solo disparo): la cohorte elegible del momento arma una lista fija y la
// campaña referenciada se programa a +5 min — el cron de email hace el resto,
// con SUS supresiones y presión. La tarea de WhatsApp es HUMANA: una tarea en
// activities por empresa, nunca un envío automatizado.
async function correrPasos(deadline: number): Promise<{ ejecutados: number; errores: string[] }> {
  const out = { ejecutados: 0, errores: [] as string[] };
  const { data: pasos } = await supabase.from('inapp_pasos')
    .select('*, inapp_campanas!inner(id, nombre, estado, publicada_at, materializada)')
    .eq('inapp_campanas.estado', 'activa')
    .in('canal_paso', ['email', 'tarea_whatsapp'])
    .order('orden');
  for (const paso of (pasos || [])) {
    if (Date.now() > deadline) break;
    const camp: any = (paso as any).inapp_campanas;
    if (!camp?.publicada_at) continue;
    const due = new Date(camp.publicada_at).getTime() + (Number(paso.espera_dias) || 0) * 86400000;
    if (Date.now() < due) continue;

    try {
      // ¿Ya se ejecutó? (email usa el marcador global '*')
      const { data: marca } = await supabase.from('inapp_paso_ejecuciones')
        .select('id').eq('paso_id', paso.id).eq('cuenta', '*').maybeSingle();
      if (paso.canal_paso === 'email' && marca) continue;

      // Cohorte elegible: cuentas objetivo − convertidas − las que no cumplen
      // la condición del paso.
      const targets: string[] = (camp.materializada?.cuentas_lista || []).map(normCuenta).filter(Boolean);
      if (!targets.length) continue;
      const evs = await leerPaginado((from, to) => supabase.from('inapp_eventos')
        .select('evento, cuenta').eq('campana_id', camp.id).order('id', { ascending: true }).range(from, to));
      const vieron = new Set<string>(); const actuaron = new Set<string>(); const clicaron = new Set<string>();
      for (const e of evs) {
        if (e.evento === 'impresion') vieron.add(e.cuenta);
        if (e.evento === 'clic') { clicaron.add(e.cuenta); actuaron.add(e.cuenta); }
        if (['chat_abierto', 'respuesta_encuesta', 'cita_agendada'].includes(e.evento)) actuaron.add(e.cuenta);
      }
      const { data: convs } = await supabase.from('inapp_conversiones').select('cuenta').eq('campana_id', camp.id).limit(1000);
      const convertidas = new Set((convs || []).map((x: any) => normCuenta(x.cuenta)));
      const { data: ejec } = await supabase.from('inapp_paso_ejecuciones').select('cuenta').eq('paso_id', paso.id).limit(2000);
      const yaEjec = new Set((ejec || []).map((x: any) => x.cuenta));

      const elegibles = targets.filter(cu => {
        if (convertidas.has(cu) || yaEjec.has(cu)) return false;
        if (paso.condicion === 'no_visto') return !vieron.has(cu);
        if (paso.condicion === 'sin_interaccion') return !actuaron.has(cu);
        if (paso.condicion === 'sin_clic') return !clicaron.has(cu);
        return true; // 'siempre'
      });
      if (!elegibles.length) continue;

      // company_id + contactos por lotes
      const filasCsa: any[] = [];
      for (let i = 0; i < elegibles.length; i += 500) {
        const { data } = await supabase.from('company_sacs_accounts')
          .select('cuenta, company_id').in('cuenta', elegibles.slice(i, i + 500));
        filasCsa.push(...(data || []));
      }
      const companyDeCuenta: Record<string, string> = {};
      for (const f of filasCsa) if (f.company_id) companyDeCuenta[normCuenta(f.cuenta)] = f.company_id;
      const companyIds = Array.from(new Set(Object.values(companyDeCuenta)));

      if (paso.canal_paso === 'email') {
        if (!paso.email_campaign_id) { out.errores.push(`paso ${paso.id}: sin campaña de email referenciada`); continue; }
        const { data: refCamp } = await supabase.from('email_campaigns')
          .select('id, tenant_id, estado, nombre, utm_campaign').eq('id', paso.email_campaign_id).maybeSingle();
        if (!refCamp) { out.errores.push(`paso ${paso.id}: la campaña de email no existe`); continue; }
        if (refCamp.estado !== 'borrador') { out.errores.push(`paso ${paso.id}: la campaña de email está en "${refCamp.estado}" (debe ser borrador)`); continue; }
        const contactos: any[] = [];
        for (let i = 0; i < companyIds.length; i += 500) {
          const { data } = await supabase.from('contacts')
            .select('id, email, nombre').in('company_id', companyIds.slice(i, i + 500))
            .not('email', 'is', null).is('archived_at', null);
          contactos.push(...(data || []));
        }
        if (!contactos.length) { out.errores.push(`paso ${paso.id}: cohorte sin contactos con correo`); continue; }
        const { data: lista, error: eL } = await supabase.from('email_lists')
          .insert({ tenant_id: refCamp.tenant_id, nombre: `Outbound · ${camp.nombre} · paso ${paso.orden}`, descripcion: 'Cohorte del embudo cross-canal (generada por el cron de Outbound)' })
          .select().single();
        if (eL || !lista) { out.errores.push(`paso ${paso.id}: no se pudo crear la lista: ${eL?.message}`); continue; }
        // El índice único de miembros es de EXPRESIÓN (list_id, lower(email)):
        // PostgREST no puede hacer ON CONFLICT contra él. La lista es NUEVA,
        // así que basta deduplicar por email en JS e insertar plano.
        const porEmail = new Map<string, any>();
        for (const ct of contactos) {
          const em = String(ct.email).trim().toLowerCase();
          if (em && !porEmail.has(em)) porEmail.set(em, ct);
        }
        const unicos = Array.from(porEmail.entries());
        for (let i = 0; i < unicos.length; i += 200) {
          const filas = unicos.slice(i, i + 200).map(([em, ct]) => ({
            list_id: lista.id, email: em, nombre: ct.nombre || null,
            contact_id: ct.id, agregado_por: 'outbound',
          }));
          const { error: eM } = await supabase.from('email_list_members').insert(filas);
          if (eM) out.errores.push(`paso ${paso.id}: miembros: ${eM.message}`);
        }
        const { data: gano, error: eC } = await supabase.from('email_campaigns').update({
          origen_tipo: 'lista', origen_id: lista.id, contact_ids: null,
          estado: 'programada', programada_para: new Date(Date.now() + 5 * 60000).toISOString(),
          utm_campaign: refCamp.utm_campaign || `outbound-${camp.id}`,
        }).eq('id', refCamp.id).eq('estado', 'borrador').select('id');
        if (eC) { out.errores.push(`paso ${paso.id}: no se pudo programar el email: ${eC.message}`); continue; }
        if (!gano?.length) {
          // Otro tick ganó la carrera: no marcar ejecutado ni notificar dos
          // veces, y no dejar la lista huérfana.
          await supabase.from('email_lists').delete().eq('id', lista.id);
          continue;
        }
        const ejecFilas = elegibles.map(cu => ({ paso_id: paso.id, campana_id: camp.id, cuenta: cu, detalle: { canal: 'email', lista_id: lista.id } }));
        ejecFilas.push({ paso_id: paso.id, campana_id: camp.id, cuenta: '*', detalle: { canal: 'email', lista_id: lista.id, contactos: contactos.length } as any });
        await supabase.from('inapp_paso_ejecuciones').upsert(ejecFilas, { onConflict: 'paso_id,cuenta', ignoreDuplicates: true });
        await notificar({
          clave: `outbound-paso-email:${paso.id}`, tipo: 'outbound_paso', nivel: 'info',
          titulo: `Embudo "${camp.nombre}": email programado`,
          detalle: `${contactos.length} contactos de ${elegibles.length} cuentas (condición: ${paso.condicion}). Sale en 5 minutos por el módulo de Email.`,
          metadata: { campana_id: camp.id, paso_id: paso.id },
        });
        out.ejecutados++;
      }

      if (paso.canal_paso === 'tarea_whatsapp') {
        let creadas = 0;
        for (const cu of elegibles.slice(0, 100)) {
          if (Date.now() > deadline) break;
          const companyId = companyDeCuenta[cu];
          const { error } = await supabase.from('inapp_paso_ejecuciones')
            .insert({ paso_id: paso.id, campana_id: camp.id, cuenta: cu, detalle: { canal: 'tarea_whatsapp' } });
          if (error) continue; // ya ejecutada (índice único) — no duplicar la tarea
          await supabase.from('activities').insert({
            company_id: companyId || null, tipo: 'tarea',
            titulo: `Contactar por WhatsApp: ${camp.nombre}`,
            descripcion: (paso.contenido?.mensaje || `La cuenta ${cu} no reaccionó a la campaña — toca contacto humano.`) + ` (cuenta: ${cu})`,
            metadata: { campana_id: camp.id, paso_id: paso.id, cuenta: cu, origen: 'outbound' },
          });
          creadas++;
        }
        if (creadas) {
          await notificar({
            clave: `outbound-paso-tarea:${paso.id}:${new Date().toISOString().slice(0, 10)}`,
            tipo: 'outbound_paso', nivel: 'info',
            titulo: `Embudo "${camp.nombre}": ${creadas} tareas de WhatsApp creadas`,
            detalle: `Cuentas que no reaccionaron (condición: ${paso.condicion}). Las tareas están en las fichas de cada cliente.`,
            metadata: { campana_id: camp.id, paso_id: paso.id },
          });
          out.ejecutados++;
        }
      }
    } catch (e: any) {
      out.errores.push(`paso ${paso.id}: ${e?.message || e}`);
    }
  }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  return correr();
};
export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  return correr();
};

async function correr() {
  const inicio = Date.now();
  const deadline = inicio + PRESUPUESTO_MS;
  const out: any = { ingeridos: 0, campanas: 0, continuas: 0, terminadas: 0, errores: [] as string[] };
  try {
    // Campañas cuya vigencia ya venció: se terminan y se despublican. Sin esto
    // el listado mostraba "activas" expiradas y el modo continuo las
    // re-publicaba para siempre.
    const { data: vencidas } = await supabase.from('inapp_campanas')
      .select('id').in('estado', ['activa', 'pausada'])
      .not('vigencia_hasta', 'is', null).lt('vigencia_hasta', new Date().toISOString());
    for (const v of (vencidas || [])) {
      try {
        await despublicarCampana(v.id);
        await supabase.from('inapp_campanas').update({ estado: 'terminada', updated_at: new Date().toISOString() }).eq('id', v.id);
        await notificar({ clave: `outbound-vencida:${v.id}`, tipo: 'outbound_hito', nivel: 'info', titulo: 'Campaña terminada por vigencia', detalle: 'Llegó a su fecha final y se retiró de la entrega.', metadata: { campana_id: v.id } });
        out.terminadas++;
      } catch (e: any) { out.errores.push(`vencida ${v.id}: ${e?.message || e}`); }
    }

    const ing = await ingerirEventos(deadline);
    out.ingeridos = ing.ingeridos;
    if (ing.error) out.errores.push('ingesta: ' + ing.error);

    const { data: activas } = await supabase.from('inapp_campanas')
      .select('*').in('estado', ['activa', 'pausada']).is('archived_at', null)
      .order('updated_at', { ascending: false }).limit(50);
    for (const c of (activas || [])) {
      if (Date.now() > deadline) { out.errores.push('presupuesto_agotado'); break; }
      try { await procesarCampana(c); out.campanas++; }
      catch (e: any) { out.errores.push(`campana ${c.id}: ${e?.message || e}`); }
    }

    out.continuas = await reevaluarContinuas(deadline);

    const pasosOut = await correrPasos(deadline);
    out.pasos = pasosOut.ejecutados;
    out.errores.push(...pasosOut.errores);

    // ── Presión por cliente/semana (una vez por hora): impresiones in-app +
    // correos enviados, para el paso Revisión y la vista Convivencia.
    const marcaPresion = await leerSync('presion');
    const horaActual = new Date().toISOString().slice(0, 13);
    if (marcaPresion.hora !== horaActual && Date.now() < deadline) {
      const semana = lunesDe();
      const desdeSemana = semana + 'T00:00:00.000Z';
      const porCuenta: Record<string, number> = {};
      const evSemana = await leerPaginado((from, to) => supabase.from('inapp_eventos')
        .select('cuenta').eq('evento', 'impresion').gte('created', desdeSemana)
        .order('id', { ascending: true }).range(from, to), 50000);
      for (const e of evSemana) porCuenta[e.cuenta] = (porCuenta[e.cuenta] || 0) + 1;
      const cuentasP = Object.keys(porCuenta);
      const porCompany: Record<string, { inapp: number; emails: number }> = {};
      for (let i = 0; i < cuentasP.length; i += 500) {
        const { data } = await supabase.from('company_sacs_accounts')
          .select('cuenta, company_id').in('cuenta', cuentasP.slice(i, i + 500));
        for (const f of (data || [])) {
          if (!f.company_id) continue;
          porCompany[f.company_id] = porCompany[f.company_id] || { inapp: 0, emails: 0 };
          porCompany[f.company_id].inapp += porCuenta[normCuenta(f.cuenta)] || 0;
        }
      }
      const sends = await leerPaginado((from, to) => supabase.from('email_sends')
        .select('contact_id').gte('created_at', desdeSemana).not('contact_id', 'is', null)
        .order('id', { ascending: true }).range(from, to), 20000).catch(() => [] as any[]);
      const contactIds = Array.from(new Set(sends.map((x: any) => x.contact_id)));
      const emailsPorContacto: Record<string, number> = {};
      for (const x of sends) emailsPorContacto[x.contact_id] = (emailsPorContacto[x.contact_id] || 0) + 1;
      for (let i = 0; i < contactIds.length; i += 500) {
        const { data } = await supabase.from('contacts')
          .select('id, company_id').in('id', contactIds.slice(i, i + 500)).not('company_id', 'is', null);
        for (const ct of (data || [])) {
          porCompany[ct.company_id] = porCompany[ct.company_id] || { inapp: 0, emails: 0 };
          porCompany[ct.company_id].emails += emailsPorContacto[ct.id] || 0;
        }
      }
      const filasP = Object.entries(porCompany).map(([company_id, v]) => ({
        company_id, semana, inapp: v.inapp, emails: v.emails, updated_at: new Date().toISOString(),
      }));
      for (let i = 0; i < filasP.length; i += 200) {
        await supabase.from('presion_por_company').upsert(filasP.slice(i, i + 200), { onConflict: 'company_id,semana' });
      }
      await guardarSync('presion', { hora: horaActual, companies: filasP.length });
      out.presion = filasP.length;
    }

    // ── Horas valle: una vez al día, el perfil de ventas por hora de las
    // cuentas con campañas activas (sacs_api lo calcula y lo guarda; la
    // entrega lo lee barato).
    const marcaPico = await leerSync('horas_pico');
    const hoyP = new Date().toISOString().slice(0, 10);
    if (marcaPico.dia !== hoyP && Date.now() < deadline) {
      const { data: activasP } = await supabase.from('inapp_campanas')
        .select('materializada').eq('estado', 'activa').is('archived_at', null).limit(50);
      const cuentasPico = Array.from(new Set((activasP || [])
        .flatMap((c: any) => (c.materializada?.cuentas_lista || []) as string[])
        .map(normCuenta).filter(Boolean)));
      let perfiladas = 0;
      for (let i = 0; i < cuentasPico.length && Date.now() < deadline; i += 50) {
        try {
          const r = await sacs('/interno/crm/campanas-horas-pico', { accounts: cuentasPico.slice(i, i + 50) });
          perfiladas += Object.keys(r.data || {}).length;
        } catch (e: any) { out.errores.push('horas_pico: ' + (e?.message || e)); break; }
      }
      await guardarSync('horas_pico', { dia: hoyP, perfiladas });
      out.horas_pico = perfiladas;
    }

    // ── Digest semanal (lunes, hora de México): el canal se resume solo.
    const ahoraMx = new Date(Date.now() - 6 * 3600000);
    if (ahoraMx.getUTCDay() === 1 && ahoraMx.getUTCHours() >= 8) {
      const semanaIso = ahoraMx.toISOString().slice(0, 10);
      const { data: paraDigest } = await supabase.from('inapp_campanas')
        .select('nombre, estado, resumen').in('estado', ['activa', 'pausada']).is('archived_at', null).limit(50);
      if (paraDigest?.length) {
        const lineas = paraDigest.map((c: any) => {
          const r = c.resumen || {};
          return `· ${c.nombre}: ${r.impresiones || 0} impresiones, ${r.ctr || 0}% CTR, ${r.conversiones || 0} conversiones` +
            (r.ingreso ? ` ($${Math.round(r.ingreso).toLocaleString('es-MX')})` : '') +
            (r.nps ? `, NPS ${r.nps.score}` : '') +
            (c.estado === 'pausada' ? ' [PAUSADA]' : '');
        });
        await notificar({
          clave: `outbound-digest:${semanaIso}`,
          tipo: 'outbound_digest', nivel: 'info',
          titulo: `Outbound, resumen semanal (${paraDigest.length} campañas)`,
          detalle: lineas.slice(0, 12).join('\n'),
          metadata: { semana: semanaIso },
        });
      }
    }

    // Recurrencia de encuestas (NPS cada X días): una vez al día por campaña,
    // sacs_api re-habilita a quien respondió hace >= recurrencia_dias (sin
    // tocar descartes). El día ya-corrido se persiste en inapp_sync.
    const { data: recurrentes } = await supabase.from('inapp_campanas')
      .select('id, recurrencia_dias').eq('estado', 'activa').eq('formato', 'encuesta')
      .not('recurrencia_dias', 'is', null);
    const hoyR = new Date().toISOString().slice(0, 10);
    for (const cR of (recurrentes || [])) {
      if (Date.now() > deadline) break;
      if (!cR.recurrencia_dias || cR.recurrencia_dias < 7) continue;
      const marca = await leerSync(`nps_reset:${cR.id}`);
      if (marca.dia === hoyR) continue;
      try {
        const r = await sacs('/interno/crm/campanas-reset-estado', { campana_id: cR.id, dias: cR.recurrencia_dias });
        await guardarSync(`nps_reset:${cR.id}`, { dia: hoyR, reseteados: r.reseteados || 0 });
        out.nps_resets = (out.nps_resets || 0) + 1;
      } catch (e: any) { out.errores.push(`nps_reset ${cR.id}: ${e?.message || e}`); }
    }
  } catch (e: any) {
    out.errores.push(e?.message || String(e));
  }
  out.ms = Date.now() - inicio;
  // Fallar ruidoso: un error de puente (fetch/secreto) sin nada procesado = 500.
  const fracaso = out.errores.length > 0 && out.ingeridos === 0 && out.campanas === 0;
  return json(out, fracaso ? 500 : 200);
}
