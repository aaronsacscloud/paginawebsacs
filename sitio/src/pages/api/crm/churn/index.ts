// CHURN · lista de casos + alta manual.
//
// La lista trae lo que la tabla necesita para pintarse sin pedir nada más:
// empresa, uso real de SACS (para el semáforo de la gracia) y el contacto que
// decide. Un renglón que obliga a otra petición para saber si el cliente está
// usando el sistema es un renglón que nunca lo va a decir.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { ABIERTAS, validarTransicion, anotar, type Etapa } from '../../../../lib/crm/churn.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const SELECT = `*,
  companies(id, nombre, nombre_comercial, sacs_account, sucursales, plan, estado_cuenta,
            dias_sin_venta, uso_sacs, actividad_sync_at, health_score),
  subscriptions!churn_casos_subscription_id_fkey(id, nombre_plan, ciclo, mrr, cancelada_at, razon_cancelacion)`;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const etapa = url.searchParams.get('etapa') || '';
  const busca = (url.searchParams.get('search') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '300'), 500);

  let q = supabase.from('churn_casos').select(SELECT).limit(limit);

  /* «Todos» son los casos VIVOS, no todos los registros. Es la misma lección
     de Leads: una pestaña que mezcla lo cerrado con lo que se está trabajando
     deja de servir para trabajar. Los cerrados tienen su pestaña. */
  if (etapa && etapa !== 'todos') q = q.eq('etapa', etapa);
  else q = q.in('etapa', ABIERTAS);

  // Lo que urge primero: la gracia por vencer manda sobre lo demás.
  q = q.order('gracia_fin', { ascending: true, nullsFirst: false }).order('detectado_at', { ascending: false });

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let filas = data || [];
  if (busca) {
    const t = busca.toLowerCase();
    filas = filas.filter((c: any) =>
      `${c.companies?.nombre || ''} ${c.companies?.nombre_comercial || ''} ${c.motivo_detalle || ''} ${c.gracia_acuerdo || ''}`
        .toLowerCase().includes(t));
  }

  // Los contadores se calculan sobre TODO, no sobre la página: un número que
  // solo cuenta lo que cupo es un número que miente.
  const { data: todos } = await supabase.from('churn_casos').select('etapa, mrr_perdido, gracia_fin, resultado, cerrado_at, gracia_mrr');
  const hoy = new Date().toISOString().slice(0, 10);
  const cuenta: any = { detectado: 0, conciliacion: 0, gracia: 0, recuperado: 0, irrecuperable: 0, todos: 0 };
  let mrrEnRescate = 0, mrrRecuperado = 0, graciaVencida = 0;
  for (const c of todos || []) {
    cuenta[c.etapa] = (cuenta[c.etapa] || 0) + 1;
    if (ABIERTAS.includes(c.etapa)) { cuenta.todos++; mrrEnRescate += Number(c.mrr_perdido || 0); }
    if (c.etapa === 'recuperado') mrrRecuperado += Number(c.gracia_mrr || c.mrr_perdido || 0);
    if (c.etapa === 'gracia' && c.gracia_fin && String(c.gracia_fin) < hoy) graciaVencida++;
  }
  const cerrados = (cuenta.recuperado || 0) + (cuenta.irrecuperable || 0);

  return json({
    data: filas,
    cuenta,
    kpis: {
      mrr_en_rescate: Math.round(mrrEnRescate),
      mrr_recuperado: Math.round(mrrRecuperado),
      gracia_vencida: graciaVencida,
      // Sin casos cerrados la tasa no existe. Cero por cero es cero, y un 0%
      // pintado cuando todavía no cierras nada es una mentira desmoralizante.
      tasa_recuperacion: cerrados ? Math.round(((cuenta.recuperado || 0) / cerrados) * 100) : null,
    },
  });
};

/** Alta manual: «canceló por fuera del sistema». Exige motivo y queda auditada. */
export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.company_id) return json({ error: 'Falta la empresa.' }, 400);
  if (!String(b.motivo_detalle || '').trim() && !b.motivo_categoria) {
    return json({ error: 'El alta manual exige decir por qué canceló.' }, 400);
  }

  // Un solo caso abierto por empresa: si ya hay uno, se anota ahí en vez de
  // abrir uno paralelo que partiría la historia en dos.
  const { data: vivo } = await supabase.from('churn_casos')
    .select('id, etapa').eq('company_id', b.company_id).in('etapa', ABIERTAS).maybeSingle();
  if (vivo) {
    await anotar(vivo, 'nota', 'Otra cancelación de la misma cuenta', String(b.motivo_detalle || ''), false);
    return json({ ok: true, caso_id: vivo.id, ya_existia: true });
  }

  const { data: previos } = await supabase.from('churn_casos')
    .select('id, episodio').eq('company_id', b.company_id).order('episodio', { ascending: false }).limit(1);
  const previo = previos?.[0];

  const { data, error } = await supabase.from('churn_casos').insert({
    company_id: b.company_id,
    subscription_id: b.subscription_id || null,
    mrr_perdido: Number(b.mrr_perdido || 0),
    motivo_categoria: b.motivo_categoria || null,
    motivo_detalle: String(b.motivo_detalle || '').trim() || null,
    episodio: (previo?.episodio || 0) + 1,
    caso_previo_id: previo?.id || null,
    owner_id: b.owner_id || user.id || null,
  }).select('id').single();
  if (error) return json({ error: error.message }, 500);

  await anotar({ id: data.id, company_id: b.company_id }, 'nota',
    'Caso de churn abierto a mano', `Por ${user.email || 'el equipo'}`, false);
  return json({ ok: true, caso_id: data.id });
};
