// GET /api/cron/soporte-oportunidades — lee el chat de Intercom y saca lo que
// vale dinero: peticiones de mejora, intenciones de compra y clientes que se
// están calentando.
//
// Corre a las 3:15 am CDMX (9:15 UTC), justo DESPUÉS del análisis de cuentas de
// las 3:00: así la salud y el uso ya están frescos y "pidió esto" se puede leer
// junto a "y además su uso subió".
//
// PROGRESIVO Y CON CURSOR: solo mira las conversaciones que se movieron desde la
// corrida anterior — en régimen son un puñado al día, no las 161 del histórico.
// La primera corrida barre lo viejo por lotes, sin pasarse del presupuesto de
// tiempo; lo que no alcanzó encabeza la fila mañana.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { hasApiKey } from '../../../lib/ai/client';
import { hiloDelCliente, leerConversacion, guardarHallazgos } from '../../../lib/soporte/hallazgos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

const CURSOR = 'soporte_hallazgos_cursor';
const PRESUPUESTO_MS = 240_000;   // Vercel corta a los 300 s; se deja aire para cerrar.

async function leerCursor(): Promise<string | null> {
  const { data } = await supabase.from('inapp_sync').select('valor').eq('id', CURSOR).maybeSingle();
  return (data?.valor as any)?.hasta || null;
}
async function guardarCursor(hasta: string) {
  await supabase.from('inapp_sync').upsert({ id: CURSOR, valor: { hasta, at: new Date().toISOString() } });
}

export const GET: APIRoute = async ({ url, request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  // Un análisis de conversaciones no puede tumbar nada: si falta la clave, el
  // cron termina en verde diciendo por qué no hizo nada.
  if (!hasApiKey()) return json({ ok: true, saltado: 'sin ANTHROPIC_API_KEY' });

  const inicio = Date.now();
  const limite = Math.min(60, Number(url.searchParams.get('limit')) || 25);
  const desde = url.searchParams.get('desde') || await leerCursor();

  // Las que se MOVIERON desde el corte. Sin cursor (primera corrida) se toman
  // las más recientes primero: son las que todavía se pueden trabajar.
  let q = supabase.from('crm_soporte_tickets')
    .select('conversation_id, company_id, cuenta, tema, ultima_actividad_at, abierto_at')
    .order('ultima_actividad_at', { ascending: false, nullsFirst: false })
    .limit(limite);
  if (desde) q = q.gt('ultima_actividad_at', desde);
  const { data: tickets, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const out = {
    revisadas: 0, con_hilo: 0, sin_texto: 0,
    hallazgos: 0, duplicados: 0, sin_cita: 0, colapsados: 0,
    por_tipo: {} as Record<string, number>,
    errores: [] as string[],
    cursor_previo: desde, cursor_nuevo: desde,
    ms: 0,
  };

  // Plan y módulos fuera de plan, en UNA consulta para todas las empresas del
  // lote: sin esto el modelo no puede distinguir "pide algo que ya paga" de
  // "pide algo que habría que venderle".
  const ids = [...new Set((tickets || []).map(t => t.company_id).filter(Boolean))] as string[];
  const ctxEmpresa = new Map<string, { empresa: string | null; plan: string | null }>();
  if (ids.length) {
    const { data: emp } = await supabase.from('companies').select('id, nombre, nombre_comercial, plan').in('id', ids);
    for (const e of (emp || [])) ctxEmpresa.set(e.id, { empresa: e.nombre_comercial || e.nombre || null, plan: e.plan || null });
  }

  let ultima: string | null = desde;
  for (const t of (tickets || [])) {
    if (Date.now() - inicio > PRESUPUESTO_MS) { out.errores.push('presupuesto de tiempo agotado'); break; }
    out.revisadas++;

    const hilo = await hiloDelCliente(t.conversation_id);
    if (!hilo) { out.sin_texto++; }
    else {
      out.con_hilo++;
      const c = t.company_id ? ctxEmpresa.get(t.company_id) : null;
      const r = await leerConversacion(hilo, { cuenta: t.cuenta, empresa: c?.empresa || null, plan: c?.plan || null });
      if (r.error) out.errores.push(`${t.conversation_id}: ${r.error}`);
      out.sin_cita += r.descartados;
      if (r.hallazgos.length) {
        const g = await guardarHallazgos(t, r.hallazgos);
        out.hallazgos += g.creados;
        out.duplicados += g.duplicados;
        out.colapsados += g.colapsados;
        for (const h of [...new Set(r.hallazgos.map(x => x.tipo))]) out.por_tipo[h] = (out.por_tipo[h] || 0) + 1;
      }
    }

    // El cursor avanza aunque la conversación no diera nada: revisada es
    // revisada. Si avanzara solo con hallazgos, cada corrida releería lo mismo.
    const ref = t.ultima_actividad_at || t.abierto_at;
    if (ref && (!ultima || ref > ultima)) ultima = ref;
  }

  if (ultima && ultima !== desde) { await guardarCursor(ultima); out.cursor_nuevo = ultima; }
  out.ms = Date.now() - inicio;
  return json({ ok: true, ...out });
};
