// SOPORTE · Bandeja de hallazgos: lo que la lectura nocturna del chat sacó.
//   GET  ?estado=pendiente|aceptado|descartado|todos  → lista + resumen
//   PUT  { id, estado, motivo_descarte? }             → acepta o descarta
//
// Aceptar MATERIALIZA el hallazgo en el motor que ya existe: una oportunidad va
// a la Bandeja de Oportunidades (expansion_signals) y una mejora a Consultoría.
// Descartar lo silencia. Nada se convierte en trabajo real sin ese clic — un
// CRM que se llena solo con lo que un modelo entendió de un chat deja de ser
// confiable, y un dato inventado en el pipeline cuesta más que el minuto que
// ahorra.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { registrarOportunidad } from '../../../../lib/crm/oportunidades';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const ESTADOS = ['pendiente', 'aceptado', 'descartado'];

const COLS = 'id, conversation_id, company_id, cuenta, tipo, titulo, cita, modulo, producto, accion, confianza, estado, motivo_descarte, destino, destino_id, detectado_at, resuelto_at, resuelto_por';

export const GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado') || 'pendiente';
  let q = supabase.from('crm_soporte_hallazgos')
    .select(`${COLS}, companies(nombre, nombre_comercial, plan, arr, health_score, estado_cuenta)`)
    .order('detectado_at', { ascending: false }).limit(200);
  if (ESTADOS.includes(estado)) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) return json({ error: error.message, data: [] }, 200);

  const filas = (data || []).map((f: any) => {
    const e = Array.isArray(f.companies) ? f.companies[0] : f.companies;
    const { companies, ...resto } = f;
    return { ...resto, nombre: e?.nombre_comercial || e?.nombre || null, plan: e?.plan || null, estado_cuenta: e?.estado_cuenta || null };
  });

  // El resumen se cuenta SIEMPRE sobre lo pendiente, sin importar qué liste la
  // pantalla: es el número que alimenta el aviso de Consultoría, y tiene que
  // decir lo mismo se mire desde donde se mire.
  const { data: pend } = await supabase.from('crm_soporte_hallazgos').select('tipo').eq('estado', 'pendiente');
  const porTipo = (pend || []).reduce((m: Record<string, number>, x: any) => { m[x.tipo] = (m[x.tipo] || 0) + 1; return m; }, {});

  // Cuántas se aceptan: el único número que dice si el detector sirve o es ruido.
  const { count: aceptados } = await supabase.from('crm_soporte_hallazgos').select('id', { count: 'exact', head: true }).eq('estado', 'aceptado');
  const { count: descartados } = await supabase.from('crm_soporte_hallazgos').select('id', { count: 'exact', head: true }).eq('estado', 'descartado');
  const cerrados = (aceptados || 0) + (descartados || 0);

  return json({
    data: filas,
    resumen: {
      pendientes: (pend || []).length,
      por_tipo: porTipo,
      aceptados: aceptados || 0,
      descartados: descartados || 0,
      tasa_aceptacion: cerrados ? Math.round(((aceptados || 0) / cerrados) * 100) : null,
    },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  const estado = String(b?.estado || '');
  if (!id || !['aceptado', 'descartado'].includes(estado)) return json({ error: 'id y estado (aceptado|descartado) requeridos' }, 400);
  // Descartar sin decir por qué es lo que impide afinar el detector: en tres
  // meses nadie sabría qué estaba marcando de más.
  if (estado === 'descartado' && !String(b.motivo_descarte || '').trim()) {
    return json({ error: 'Escribe por qué no aplica — es lo único que permite afinar la lectura después.' }, 400);
  }

  const { data: h, error: e0 } = await supabase.from('crm_soporte_hallazgos').select('*').eq('id', id).maybeSingle();
  if (e0 || !h) return json({ error: 'No encontré ese hallazgo.' }, 404);
  if (h.estado !== 'pendiente') return json({ error: 'Ese hallazgo ya se resolvió.' }, 409);

  let destino: string | null = null, destinoId: string | null = null;

  if (estado === 'aceptado') {
    if (!h.company_id) return json({ error: 'Este hallazgo no está ligado a un cliente todavía: el cron de backfill tiene que mapear la cuenta primero.' }, 409);

    if (h.tipo === 'mejora') {
      const { data: m, error } = await supabase.from('mejoras').insert({
        company_id: h.company_id,
        titulo: String(h.titulo).slice(0, 200),
        descripcion: [`Lo pidió el cliente en soporte:`, `"${h.cita}"`, h.accion ? `\nSugerido: ${h.accion}` : ''].filter(Boolean).join('\n'),
        estado: 'idea', categoria: 'pendiente',
        modulo: h.modulo || null,
        creado_por: user.nombre || user.email || 'CRM',
      }).select('id').single();
      if (error) return json({ error: error.message }, 500);
      destino = 'mejora'; destinoId = m.id;
    } else {
      // Oportunidad, riesgo y testimonio van a la Bandeja de Oportunidades, que
      // ya sabe deduplicar, reconfirmar y silenciar 30 días lo que se cerró.
      const r = await registrarOportunidad({
        company_id: h.company_id,
        tipo: `soporte_${h.tipo}`,
        titulo: String(h.titulo).slice(0, 200),
        detalle: `El cliente escribió en soporte: "${h.cita}"`,
        accion: h.accion || null,
        peso: h.confianza === 'alta' ? 80 : 60,
        metadata: { origen: 'soporte_ia', conversation_id: h.conversation_id, hallazgo_id: h.id, modulo: h.modulo || null },
      });
      if (r === 'error') return json({ error: 'No se pudo registrar la oportunidad.' }, 500);
      destino = 'expansion_signal';
      const { data: sig } = await supabase.from('expansion_signals').select('id')
        .eq('company_id', h.company_id).eq('signal_type', `soporte_${h.tipo}`)
        .in('estado', ['nueva', 'contactado']).limit(1).maybeSingle();
      destinoId = sig?.id || null;
    }
  }

  const { data, error } = await supabase.from('crm_soporte_hallazgos').update({
    estado,
    motivo_descarte: estado === 'descartado' ? String(b.motivo_descarte).trim().slice(0, 500) : null,
    destino, destino_id: destinoId,
    resuelto_at: new Date().toISOString(),
    resuelto_por: user.nombre || user.email || 'CRM',
  }).eq('id', id).select(COLS).single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, data, destino });
};
