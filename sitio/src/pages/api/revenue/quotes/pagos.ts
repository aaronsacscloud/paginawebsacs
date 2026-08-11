// Abonos de una cotización.
//   POST   { quote_id, fecha, monto, metodo?, referencia?, nota? }  → registrar abono
//   PUT    { pago_id, fecha?, monto?, metodo?, referencia? }        → corregir un abono
//   PUT    { quote_id, pagado_fecha }                               → corregir la fecha de pago
//   DELETE { pago_id }                                              → quitar un abono
//
// Una cotización rara vez se paga de un golpe: hay anticipo y liquidación, o
// tres abonos. Guardar solo "pagada" pierde CUÁNDO entró cada peso, que es lo
// que después se necesita para conciliar contra el banco.
//
// La fecha SIEMPRE se puede corregir —incluso ya pagada—: el pago casi nunca se
// captura el día que ocurrió, y una fecha que no se puede arreglar obliga a
// borrar y recrear, que es peor.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { parseMeta, serializeMeta } from '../../../../lib/quotes/meta';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const hoy = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Deja el estado de la cotización acorde con lo abonado, y anota el movimiento.
 *  Cubierto el total → pagada, con la fecha del ÚLTIMO abono (no la de hoy: lo
 *  que importa es cuándo entró el dinero). Si se corrige a la baja y deja de
 *  estar cubierta, deja de estar pagada — al revés, el reporte cobraría de más. */
async function recalcular(quoteId: string, quien: string, evento: string) {
  const { data: q } = await supabase.from('quotes').select('id, numero, total, estado, notas, pagado_fecha, company_id, contact_id').eq('id', quoteId).maybeSingle();
  if (!q) return null;
  const { data: pagos } = await supabase.from('payments').select('monto, fecha').eq('quote_id', quoteId);
  const pagado = (pagos || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0);
  const total = Number(q.total || 0);
  const cubierta = total > 0 && pagado >= total - 0.01;
  const ultima = (pagos || []).map((p: any) => p.fecha).filter(Boolean).sort().slice(-1)[0] || hoy();

  const upd: any = {};
  if (cubierta && q.estado !== 'paid') { upd.estado = 'paid'; upd.pagado_fecha = ultima; }
  // Solo se degrada desde 'paid': una aceptada con anticipo no debe cambiar de
  // estado por registrar un abono parcial.
  if (!cubierta && q.estado === 'paid') { upd.estado = 'accepted'; upd.pagado_fecha = null; }
  if (cubierta && q.estado === 'paid' && !q.pagado_fecha) upd.pagado_fecha = ultima;

  const { text, meta } = parseMeta(q.notas);
  meta.timeline = [...(meta.timeline || []), { event: 'abono', at: new Date().toISOString(), por: quien, detalle: evento }];
  upd.notas = serializeMeta(text, meta);
  await supabase.from('quotes').update(upd).eq('id', quoteId);

  if (q.company_id || q.contact_id) {
    await supabase.from('activities').insert({
      tipo: 'sistema', automatico: true, company_id: q.company_id || null, contact_id: q.contact_id || null,
      titulo: `💵 Cotización ${q.numero || ''}: ${evento}`.trim(),
      descripcion: `Abonado ${money(pagado)} de ${money(total)}` + (cubierta ? ' · queda PAGADA' : ` · saldo ${money(total - pagado)}`) + ` · por ${quien}`,
      metadata: { audit: 'quote_abono', quote_id: quoteId, numero: q.numero, pagado, total, cubierta },
    }).select().maybeSingle();
  }
  return { pagado, total, cubierta, estado: upd.estado || q.estado, pagado_fecha: upd.pagado_fecha ?? q.pagado_fecha };
}

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const quoteId = String(b?.quote_id || '');
  const monto = Number(b?.monto || 0);
  if (!quoteId) return json({ error: 'quote_id requerido' }, 400);
  if (!(monto > 0)) return json({ error: 'El monto del abono tiene que ser mayor a cero.' }, 400);
  const fecha = String(b?.fecha || hoy()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ error: 'Fecha inválida.' }, 400);

  const user = await getCurrentUser(request);
  const quien = user?.nombre || user?.email || 'admin';

  const { data: q } = await supabase.from('quotes').select('id, total, company_id, contact_id').eq('id', quoteId).maybeSingle();
  if (!q) return json({ error: 'No encontré esa cotización.' }, 404);

  const { data: pago, error } = await supabase.from('payments').insert({
    quote_id: quoteId, fecha, monto, metodo: b.metodo || 'transferencia',
    referencia: b.referencia || null, estado: 'confirmado',
    notas: b.nota || null,
    company_id: q.company_id || null, contact_id: q.contact_id || null,
  }).select().maybeSingle();
  if (error) return json({ error: error.message }, 500);

  const r = await recalcular(quoteId, quien, `abono de ${money(monto)} del ${fecha}`);
  return json({ ok: true, pago, ...r });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const user = await getCurrentUser(request);
  const quien = user?.nombre || user?.email || 'admin';

  // ── Corregir la fecha en que se pagó la cotización ──
  // Sin esto, marcar pagada hoy algo que se pagó el viernes deja el reporte del
  // mes mal y no hay forma de arreglarlo desde la pantalla.
  if (b?.quote_id && b?.pagado_fecha !== undefined) {
    const fecha = b.pagado_fecha ? String(b.pagado_fecha).slice(0, 10) : null;
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ error: 'Fecha inválida.' }, 400);
    const { data: q } = await supabase.from('quotes').select('id, numero, notas, pagado_fecha, company_id, contact_id').eq('id', b.quote_id).maybeSingle();
    if (!q) return json({ error: 'No encontré esa cotización.' }, 404);
    const { text, meta } = parseMeta(q.notas);
    meta.timeline = [...(meta.timeline || []), { event: 'fecha_pago_editada', at: new Date().toISOString(), por: quien, de: q.pagado_fecha || null, a: fecha }];
    await supabase.from('quotes').update({ pagado_fecha: fecha, notas: serializeMeta(text, meta) }).eq('id', b.quote_id);
    if (q.company_id || q.contact_id) {
      await supabase.from('activities').insert({
        tipo: 'sistema', automatico: true, company_id: q.company_id || null, contact_id: q.contact_id || null,
        titulo: `📅 Cotización ${q.numero || ''}: fecha de pago corregida`.trim(),
        descripcion: `${(q.pagado_fecha || '—')} → ${fecha || '—'} · por ${quien}`,
        metadata: { audit: 'quote_fecha_pago', quote_id: q.id, de: q.pagado_fecha, a: fecha },
      }).select().maybeSingle();
    }
    return json({ ok: true, pagado_fecha: fecha });
  }

  // ── Corregir un abono ──
  if (!b?.pago_id) return json({ error: 'pago_id requerido' }, 400);
  const { data: prev } = await supabase.from('payments').select('id, quote_id, fecha, monto, metodo, referencia').eq('id', b.pago_id).maybeSingle();
  if (!prev) return json({ error: 'No encontré ese abono.' }, 404);
  const upd: any = {};
  if (b.fecha !== undefined) {
    const f = String(b.fecha).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return json({ error: 'Fecha inválida.' }, 400);
    upd.fecha = f;
  }
  if (b.monto !== undefined) {
    const m = Number(b.monto);
    if (!(m > 0)) return json({ error: 'El monto tiene que ser mayor a cero.' }, 400);
    upd.monto = m;
  }
  if (b.metodo !== undefined) upd.metodo = b.metodo || 'otro';
  if (b.referencia !== undefined) upd.referencia = b.referencia || null;
  if (!Object.keys(upd).length) return json({ ok: true, sin_cambios: true });

  const { error } = await supabase.from('payments').update(upd).eq('id', b.pago_id);
  if (error) return json({ error: error.message }, 500);

  const detalle = [
    upd.fecha && upd.fecha !== prev.fecha ? `fecha ${prev.fecha} → ${upd.fecha}` : '',
    upd.monto && Number(upd.monto) !== Number(prev.monto) ? `monto ${money(prev.monto)} → ${money(upd.monto)}` : '',
  ].filter(Boolean).join(' · ') || 'abono corregido';
  const r = prev.quote_id ? await recalcular(prev.quote_id, quien, detalle) : null;
  return json({ ok: true, ...(r || {}) });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.pago_id) return json({ error: 'pago_id requerido' }, 400);
  const user = await getCurrentUser(request);
  const quien = user?.nombre || user?.email || 'admin';
  const { data: prev } = await supabase.from('payments').select('id, quote_id, monto, fecha').eq('id', b.pago_id).maybeSingle();
  if (!prev) return json({ error: 'No encontré ese abono.' }, 404);
  const { error } = await supabase.from('payments').delete().eq('id', b.pago_id);
  if (error) return json({ error: error.message }, 500);
  const r = prev.quote_id ? await recalcular(prev.quote_id, quien, `abono de ${money(prev.monto)} (${prev.fecha}) eliminado`) : null;
  return json({ ok: true, ...(r || {}) });
};
