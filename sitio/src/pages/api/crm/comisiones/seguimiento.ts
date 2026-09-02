// /api/crm/comisiones/seguimiento — la evidencia para decidir la condición A.
//
// La condición A ("hubo contacto y seguimiento reales") la marca una persona, y
// eso no cambia: es de criterio. Lo que cambia es que hasta ahora se marcaba a
// ciegas. Aquí se junta lo que sí se puede saber de cada cuenta:
//
//   1. USO   — cuántos módulos de Sacs opera hoy y cuáles se sumaron o se
//              apagaron contra su línea base;
//   2. REUNIONES — con su minuta y si asistieron;
//   3. CONVERSACIÓN — WhatsApp de ida y vuelta;
//   4. SOPORTE — sus tickets, para abrir cada uno.
//
// No calcula la comisión ni decide la tasa: es el expediente que se mira antes
// de decidir, y el lugar donde se ve qué cuenta necesita atención.
//
// ── LO QUE ESTOS DATOS NO PUEDEN DECIR (medido, no supuesto) ──
//
// · La EVOLUCIÓN contra el arranque de los snapshots no sirve: 70 de 84 cuentas
//   "mejoraron" y solo 2 bajaron (+2.51 módulos de promedio). Lo que creció fue
//   el recolector durante agosto, no los negocios. Por eso se compara contra una
//   línea base congelada y la respuesta dice desde cuándo mide.
// · Un día sin `uso->modulos` NO es un cero: es un día sin dato. Solo ~80 de 144
//   cuentas lo traen en un día dado. Contarlo como cero fabrica caídas.
// · Las LLAMADAS no existen como dato: `activities` no tiene un tipo de llamada
//   ni de sesión. Lo más cercano es el WhatsApp, y va rotulado como lo que es.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Módulos con actividad en los últimos 30 días, por nombre. */
function activos(uso: any): string[] {
  const mods = Array.isArray(uso?.modulos) ? uso.modulos : [];
  return mods
    // Los sub-módulos (los que cuelgan de un padre, como "Devoluciones" bajo
    // Punto de venta) no cuentan aparte: inflarían el número sin que la cuenta
    // esté usando nada nuevo.
    .filter((m: any) => !m.padre && Number(m.docs_30d || 0) > 0)
    .map((m: any) => String(m.modulo));
}

/** El snapshot más reciente que de verdad trae la lista de módulos. */
function ultimoValido(filas: any[]): any | null {
  for (const f of filas) if (Array.isArray(f.uso?.modulos) && f.uso.modulos.length) return f;
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const company_id = String(url.searchParams.get('company_id') || '');
    if (!UUID.test(company_id)) return json({ error: 'Falta la empresa.' }, 400);

    const [snaps, basal, reuniones, tickets, wa] = await Promise.all([
      // 60 días alcanzan para el estado de hoy y para ver la tendencia corta.
      supabase.from('uso_snapshots')
        .select('fecha, uso, health_score, ventas_30d, dias_sin_venta, usuarios_operando')
        .eq('company_id', company_id).order('fecha', { ascending: false }).limit(60),
      supabase.from('comision_seguimiento_basal')
        .select('fecha, modulos_activos, modulos, dias_muestra').eq('company_id', company_id).maybeSingle(),
      supabase.from('bookings')
        .select('id, fecha, hora_inicio, estado, asunto, minuta, invitee_nombre, google_meet_link, serie_indice, serie_total')
        .eq('company_id', company_id).order('fecha', { ascending: false }).limit(50),
      supabase.from('crm_soporte_tickets')
        .select('id, asunto, vista_previa, estado, prioridad, tema, sentimiento, abierto_at, resuelto_at, mensajes_count, csat_score, intercom_url')
        .eq('company_id', company_id).order('abierto_at', { ascending: false }).limit(60),
      supabase.from('activities')
        .select('tipo, created_at')
        .eq('company_id', company_id).in('tipo', ['whatsapp_enviado', 'whatsapp_recibido'])
        .order('created_at', { ascending: false }).limit(500),
    ]);

    const filas = snaps.data || [];
    const hoy = ultimoValido(filas);
    const modulosHoy = hoy ? activos(hoy.uso) : [];
    const b = basal.data;

    // Ganados y perdidos contra la línea base. Sin base todavía no se compara:
    // decir "creció" contra un número que nadie congeló es justo el error que
    // esta pantalla existe para no cometer.
    const base: string[] = Array.isArray(b?.modulos) ? b!.modulos as string[] : [];
    const comparable = !!b && !!hoy;
    const ganados = comparable ? modulosHoy.filter(m => !base.includes(m)) : [];
    const perdidos = comparable ? base.filter(m => !modulosHoy.includes(m)) : [];

    // Días con dato de verdad: los que traen la lista. Es lo que se puede
    // afirmar, y la pantalla lo dice para que nadie lea una racha que no hubo.
    const conDato = filas.filter((f: any) => Array.isArray(f.uso?.modulos) && f.uso.modulos.length);

    /**
     * El "ahora" de la evolución es una MEDIANA de los últimos días, igual que
     * la base — no el último día suelto.
     *
     * Medir un extremo con mediana y el otro con un solo día mete un sesgo en
     * una sola dirección: recién congeladas las 83 líneas base, el delta ya daba
     * 6 cuentas en positivo, 77 en cero y NINGUNA en negativo (+0.10 de
     * promedio). Pequeño, pero siempre a favor — y esto alimenta una decisión
     * de tasa. Mediana contra mediana arranca en cero de verdad.
     */
    const mediana = (ns: number[]) => ns.length ? [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] : null;
    const ahoraMediana = mediana(conDato.slice(0, 5).map((f: any) => activos(f.uso).length));

    const R = reuniones.data || [];
    const T = tickets.data || [];
    const W = wa.data || [];
    const d90 = Date.now() - 90 * 86400000;
    const enRango = (s?: string | null) => !!s && Date.parse(s) >= d90;

    return json({
      company_id,
      uso: {
        medido_el: hoy?.fecha ?? null,
        modulos_activos: modulosHoy.length,
        modulos: modulosHoy,
        // La familia dice DÓNDE está creciendo: una cuenta que solo factura no
        // es lo mismo que una que ya opera inventario.
        por_familia: (hoy?.uso?.modulos || [])
          .filter((m: any) => !m.padre && Number(m.docs_30d || 0) > 0)
          .reduce((a: any, m: any) => { a[m.familia || 'Otros'] = (a[m.familia || 'Otros'] || 0) + 1; return a; }, {}),
        nunca_usados: Array.isArray(hoy?.uso?.modulos_nunca) ? hoy.uso.modulos_nunca : [],
        health_score: hoy?.health_score ?? null,
        ventas_30d: hoy?.ventas_30d ?? null,
        dias_sin_venta: hoy?.dias_sin_venta ?? null,
        usuarios_operando: hoy?.usuarios_operando ?? null,
        dias_con_dato: conDato.length,
      },
      evolucion: {
        comparable,
        desde: b?.fecha ?? null,
        base: b?.modulos_activos ?? null,
        ahora: ahoraMediana,
        delta: comparable && ahoraMediana != null ? ahoraMediana - Number(b!.modulos_activos) : null,
        ganados, perdidos,
        // Sin esto, un +3 medido en cuatro días se lee igual que uno de un año.
        dias: b?.fecha ? Math.round((Date.now() - Date.parse(b.fecha + 'T12:00:00Z')) / 86400000) : null,
      },
      reuniones: {
        total: R.length,
        asistidas: R.filter((r: any) => r.estado === 'asistio').length,
        no_asistidas: R.filter((r: any) => r.estado === 'no_asistio').length,
        proximas: R.filter((r: any) => ['agendada', 'confirmada'].includes(r.estado)).length,
        con_minuta: R.filter((r: any) => r.minuta).length,
        lista: R,
      },
      conversacion: {
        // Rotulado como WhatsApp y no como "llamadas": no hay dato de llamadas,
        // y llamarle así a otra cosa haría que la pantalla mienta.
        enviados: W.filter((a: any) => a.tipo === 'whatsapp_enviado').length,
        recibidos: W.filter((a: any) => a.tipo === 'whatsapp_recibido').length,
        // Que CONTESTEN es la señal, no que se les escriba.
        recibidos_90d: W.filter((a: any) => a.tipo === 'whatsapp_recibido' && enRango(a.created_at)).length,
        ultimo: W[0]?.created_at ?? null,
      },
      soporte: {
        total: T.length,
        abiertos: T.filter((t: any) => t.estado !== 'resuelto').length,
        negativos: T.filter((t: any) => t.sentimiento === 'negativo').length,
        csat: (() => {
          const c = T.map((t: any) => t.csat_score).filter((n: any) => n != null);
          return c.length ? Math.round((c.reduce((a: number, n: number) => a + Number(n), 0) / c.length) * 10) / 10 : null;
        })(),
        lista: T,
      },
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

/**
 * POST — congela la línea base de uso.
 *
 * Sin cuerpo la toma para TODAS las cuentas evaluadas que aún no la tienen; con
 * `company_id`, solo esa. Es idempotente por diseño: `rehacer` tiene que pedirse
 * a propósito, porque volver a congelar borra la referencia contra la que se
 * venía midiendo y de golpe todas las cuentas "dejan de crecer".
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json().catch(() => ({}));
    const rehacer = b.rehacer === true;
    const uno = UUID.test(String(b.company_id || '')) ? String(b.company_id) : null;

    let q = supabase.from('uso_snapshots')
      .select('company_id, fecha, uso')
      .order('fecha', { ascending: false }).limit(4000);
    if (uno) q = q.eq('company_id', uno);
    const { data, error } = await q;
    if (error) throw error;

    const porEmpresa = new Map<string, any[]>();
    for (const f of data || []) {
      if (!Array.isArray(f.uso?.modulos) || !f.uso.modulos.length) continue;
      if (!porEmpresa.has(f.company_id)) porEmpresa.set(f.company_id, []);
      porEmpresa.get(f.company_id)!.push(f);
    }

    const { data: yaTienen } = await supabase.from('comision_seguimiento_basal').select('company_id');
    const con = new Set((yaTienen || []).map((r: any) => r.company_id));

    // `uso_snapshots` no tiene llave foránea a `companies`, así que sobreviven
    // snapshots de empresas ya borradas —hoy una, con 6 días—. Sin este filtro
    // el insert entero se cae por una fila huérfana y no se congela ninguna.
    const { data: vivas } = await supabase.from('companies').select('id').limit(5000);
    const existe = new Set((vivas || []).map((c: any) => c.id));

    const filas: any[] = [];
    for (const [company_id, snaps] of porEmpresa) {
      if (!existe.has(company_id)) continue;
      if (con.has(company_id) && !rehacer) continue;
      // MEDIANA de hasta 5 días, no el último: hay escrituras parciales, y un
      // día flojo congelado como base haría que la cuenta parezca crecer sola.
      const muestra = snaps.slice(0, 5);
      const cuentas = muestra.map(s => activos(s.uso).length).sort((x, y) => x - y);
      const mediana = cuentas[Math.floor(cuentas.length / 2)];
      // La lista de módulos se toma del día que quedó en la mediana, para que
      // el número y los nombres se correspondan.
      const elegido = muestra.find(s => activos(s.uso).length === mediana) || muestra[0];
      filas.push({
        company_id, fecha: elegido.fecha,
        modulos_activos: mediana, modulos: activos(elegido.uso),
        dias_muestra: muestra.length,
      });
    }

    if (filas.length) {
      const { error: e2 } = await supabase.from('comision_seguimiento_basal')
        .upsert(filas, { onConflict: 'company_id' });
      if (e2) throw e2;
    }
    return json({ ok: true, congeladas: filas.length, ya_tenian: con.size });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
