// /api/crm/comisiones/ajustes — lo que el cálculo automático no supo resolver.
//
// Existe porque el motor solo sabe comisionar un pago que tiene dueño y tarifa.
// Todo lo demás —un pago capturado raro, un SKU sin configurar, un acuerdo
// puntual, una corrección de la semana pasada— necesitaba un lugar donde
// entrar, o se perdía.
//
// POST   crea un ajuste (abono suma, cargo resta)
// DELETE lo quita, si su corte todavía admite cambios
//
// La regla que hace que nada se caiga entre dos semanas: si el corte al que se
// apunta ya está cerrado o pagado, el ajuste se guarda SIN corte —queda
// pendiente— y el siguiente corte de esa persona lo absorbe solo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcularTotales, CORTES_FIRMES } from '../../../../lib/crm/comisiones.cortes';
import { getSessionFromRequest } from '../../../../lib/auth/session';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    const monto = Number(b.monto);
    const concepto = (b.concepto || '').trim();
    const tipo = b.tipo === 'cargo' ? 'cargo' : 'abono';

    if (!b.owner_id) return json({ error: 'Falta el consultor.' }, 400);
    if (!concepto) return json({ error: 'El ajuste necesita un concepto: es lo que se va a leer en el estado de cuenta.' }, 400);
    if (!Number.isFinite(monto) || monto <= 0) return json({ error: 'El monto debe ser mayor a cero. Para restar, usa el tipo «cargo».' }, 400);

    // ¿A qué corte entra? Si el indicado ya es firme, queda pendiente para el
    // siguiente en vez de rebotar: el usuario ya decidió que ese dinero cuenta.
    let corte_id: string | null = b.corte_id || null;
    let pendiente = false;
    if (corte_id) {
      const { data: c } = await supabase.from('comision_cortes')
        .select('id, estado, owner_id').eq('id', corte_id).maybeSingle();
      if (!c) return json({ error: 'Ese corte no existe.' }, 404);
      if (c.owner_id !== b.owner_id) return json({ error: 'El corte es de otra persona.' }, 400);
      if (CORTES_FIRMES.includes(c.estado)) { corte_id = null; pendiente = true; }
    } else {
      pendiente = true;
    }

    const sesion = await getSessionFromRequest(request).catch(() => null);

    const fila = {
      corte_id, owner_id: b.owner_id, tipo, concepto, monto,
      payment_id: b.payment_id || null,
      nota: (b.nota || '').trim() || null,
      creado_por: sesion?.id || null,
    };
    const { data, error } = await supabase.from('comision_ajustes').insert(fila).select().single();
    if (error) {
      if (error.code === '23505')
        return json({ error: 'Ese pago ya se agregó como ajuste para esta persona.' }, 409);
      throw error;
    }

    if (corte_id) await recalcularTotales(corte_id);
    return json({
      ajuste: data, pendiente,
      aviso: pendiente
        ? 'El corte ya estaba cerrado, así que este ajuste queda pendiente y entrará al siguiente.'
        : null,
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el ajuste.' }, 400);

    const { data: aj } = await supabase.from('comision_ajustes')
      .select('id, corte_id, comision_cortes(estado)').eq('id', id).maybeSingle();
    if (!aj) return json({ error: 'Ese ajuste ya no existe.' }, 404);

    const estado = (aj as any).comision_cortes?.estado;
    if (estado && CORTES_FIRMES.includes(estado))
      return json({ error: `El corte está ${estado}: un ajuste que ya se envió o se pagó no se borra. Compénsalo con otro ajuste.` }, 409);

    const { error } = await supabase.from('comision_ajustes').delete().eq('id', id);
    if (error) throw error;
    if (aj.corte_id) await recalcularTotales(aj.corte_id);
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
