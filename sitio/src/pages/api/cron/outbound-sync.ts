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

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const PRESUPUESTO_MS = 120_000;

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
  for (const e of evs) {
    cuentaDeUsuario[e.uid] = e.cuenta;
    if (e.evento === 'impresion') { impresiones++; usuarios.add(e.uid); cuentasVieron.add(e.cuenta); vistas[e.uid] = (vistas[e.uid] || 0) + 1; }
    if (e.evento === 'clic' || e.evento === 'chat_abierto' || e.evento === 'respuesta_encuesta') { clics.add(e.uid); interesados.add(e.uid); }
    if (e.evento === 'descarte') descartes++;
  }
  for (const [u, n] of Object.entries(vistas)) if (n >= 2) interesados.add(u);

  // Circuit breaker espejo (sacs_api ya lo aplica en vivo; aquí se refleja el
  // estado en el CRM y se despublica del todo).
  if (c.estado === 'activa' && impresiones >= 200 && descartes / Math.max(impresiones, 1) > 0.6) {
    await despublicarCampana(c.id);
    await supabase.from('inapp_campanas').update({ estado: 'pausada', pausa_motivo: 'circuit_breaker', updated_at: new Date().toISOString() }).eq('id', c.id);
  }

  // ── Meta (view-through): se evalúa por CUENTA objetivo contra los datos del
  // puente. Brazo: 'expuesto' si la cuenta vio la campaña; 'control' si no
  // registra NINGÚN evento (proxy del holdout — se refina en F4 con el sorteo
  // por uid cuando el nivel es de usuarios). plugin_activo queda para F4: el
  // puente aún no reporta plugins por cuenta.
  const targets: string[] = (c.materializada?.cuentas_lista || []).map(normCuenta);
  let conversiones = 0;
  if (c.meta && targets.length && ['uso_modulo', 'plan'].includes(c.meta.tipo)) {
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
      if (c.meta.tipo === 'uso_modulo') {
        const mods: any[] = comp.uso_sacs?.modulos || [];
        const m = mods.find((x: any) => x && x.modulo === c.meta.valor && x.usa);
        convirtio = !!m && (!desde || !m.ultimo || new Date(m.ultimo) >= desde);
      }
      if (!convirtio) continue;
      const cuenta = normCuenta(f.cuenta);
      const tieneEventos = evs.some(e => e.cuenta === cuenta);
      const brazo = cuentasVieron.has(cuenta) ? 'expuesto' : (tieneEventos ? 'expuesto' : 'control');
      const { error } = await supabase.from('inapp_conversiones')
        .upsert({ campana_id: c.id, company_id: comp.id, cuenta, uid: '', brazo, detalle: { meta: c.meta } },
                { onConflict: 'campana_id,cuenta,uid', ignoreDuplicates: true });
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

  // ── Resumen cacheado para la lista (la verdad completa vive en resultados.ts)
  await supabase.from('inapp_campanas').update({
    resumen: {
      impresiones, usuarios: usuarios.size, cuentas_vieron: cuentasVieron.size,
      clics: clics.size, ctr: usuarios.size ? +((clics.size / usuarios.size) * 100).toFixed(1) : 0,
      descartes, interes: interesados.size, conversiones,
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
  } catch (e: any) {
    out.errores.push(e?.message || String(e));
  }
  out.ms = Date.now() - inicio;
  // Fallar ruidoso: un error de puente (fetch/secreto) sin nada procesado = 500.
  const fracaso = out.errores.length > 0 && out.ingeridos === 0 && out.campanas === 0;
  return json(out, fracaso ? 500 : 200);
}
