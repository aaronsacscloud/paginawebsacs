// Bandeja de oportunidades: la lista de señales que HAY QUE TRABAJAR.
//   GET  ?estado=nueva|contactado|ganada|descartada|abiertas  → lista
//   PUT  { id, estado, motivo_descarte?, owner_id? }          → mueve una
//
// Lo que la hace distinta de /api/crm/arr/oportunidades (que calcula señales al
// vuelo): aquí cada una tiene estado, dueño e historia. Sin eso no se sabe si
// alguien la atendió, y sin saber cuáles se cerraron no hay forma de afinar un
// umbral — no se distingue la señal que vende de la que es ruido.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const ESTADOS = ['nueva', 'contactado', 'ganada', 'descartada'];

export const GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado') || 'abiertas';
  let q = supabase.from('expansion_signals')
    .select('id, company_id, signal_type, titulo, detalle, accion, peso, estado, opportunity_value, owner_id, motivo_descarte, detected_at, visto_at, cerrada_at, metadata, companies(nombre, sacs_account, arr, health_score, dias_sin_venta)')
    .order('peso', { ascending: false, nullsFirst: false })
    .order('detected_at', { ascending: false });
  if (estado === 'abiertas') q = q.in('estado', ['nueva', 'contactado']);
  else if (ESTADOS.includes(estado)) q = q.eq('estado', estado);
  const { data, error } = await q.range(0, 499);
  if (error) return json({ error: error.message, data: [] }, 200);

  const filas = data || [];
  const abiertas = filas.filter((f: any) => f.estado === 'nueva' || f.estado === 'contactado');
  return json({
    data: filas,
    resumen: {
      total: filas.length,
      nuevas: filas.filter((f: any) => f.estado === 'nueva').length,
      contactadas: filas.filter((f: any) => f.estado === 'contactado').length,
      // Solo el valor de las ABIERTAS: sumar las ganadas y descartadas inflaría
      // un número que se lee como "dinero disponible".
      valor_abierto: Math.round(abiertas.reduce((a: number, f: any) => a + Number(f.opportunity_value || 0), 0)),
      por_tipo: Object.entries(abiertas.reduce((m: any, f: any) => { m[f.signal_type] = (m[f.signal_type] || 0) + 1; return m; }, {}))
        .map(([tipo, n]) => ({ tipo, n })).sort((a: any, b: any) => b.n - a.n),
    },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id || !ESTADOS.includes(b.estado)) return json({ error: 'id y estado válidos requeridos' }, 400);
  // Descartar SIN decir por qué es lo que impide aprender: si nadie escribe el
  // motivo, en tres meses no se sabe qué umbral estaba mal.
  if (b.estado === 'descartada' && !String(b.motivo_descarte || '').trim()) {
    return json({ error: 'Escribe por qué no aplica — es lo único que permite afinar la señal después.' }, 400);
  }
  const cierra = b.estado === 'ganada' || b.estado === 'descartada';
  const upd: any = { estado: b.estado, updated_at: new Date().toISOString() };
  if (b.owner_id !== undefined) upd.owner_id = b.owner_id || null;
  if (b.motivo_descarte !== undefined) upd.motivo_descarte = b.motivo_descarte || null;
  upd.cerrada_at = cierra ? new Date().toISOString() : null;
  if (b.estado === 'descartada') upd.dismissed_at = new Date().toISOString();  // compat con el banner viejo

  const { data, error } = await supabase.from('expansion_signals').update(upd).eq('id', b.id).select().single();
  if (error) return json({ error: error.message }, 500);

  // Queda en el timeline del cliente: quién la movió y a qué.
  try {
    await supabase.from('activities').insert({
      tipo: 'sistema', company_id: data.company_id, automatico: true,
      titulo: `Oportunidad ${b.estado}: ${data.titulo || data.signal_type}` + (b.motivo_descarte ? ` · ${b.motivo_descarte}` : ''),
      metadata: { audit: 'oportunidad', signal_type: data.signal_type, estado: b.estado },
    });
  } catch { /* la auditoría no bloquea el cambio de estado */ }
  return json({ ok: true, data });
};
