// PUT /api/crm/comisiones/lineas — ajustar el % de UNA línea, solo por esta vez.
//
// Existe porque la realidad no siempre cabe en la tarifa: un cliente al que se
// le respetó otro trato, un cobro partido, un acuerdo puntual. Antes eso se
// resolvía con un ajuste suelto —un abono al final del corte—, y el documento
// quedaba mintiendo: el renglón seguía diciendo 35% y aparte colgaba un abono
// sin relación visible. Aquí la excepción vive DONDE OCURRIÓ.
//
// Tres candados, y cada uno tapa una forma de mover dinero ya comprometido:
//
//   · una línea PAGADA no se toca — el dinero ya salió;
//   · una línea que viaja en un corte CERRADO o PAGADO tampoco: ese documento
//     ya se envió, y cambiarle un renglón por detrás es peor que no poder;
//   · el % va de 0 a 100. Sin tope, un dedo de más en el teclado paga de más.
//
// Se pide NOTA. No por burocracia: en tres meses nadie se acuerda de por qué
// esta línea cobró distinto, y esa pregunta siempre llega.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { aplicarPctManual } from '../../../../lib/crm/comisiones.lib';
import { recalcularTotales, CORTES_FIRMES } from '../../../../lib/crm/comisiones.cortes';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (!b.id) return json({ error: 'Falta la línea.' }, 400);

    // Vacío o nulo = quitar el ajuste y volver a la tarifa configurada.
    const quitar = b.pct === '' || b.pct == null;
    const pct = quitar ? null : Number(b.pct);
    if (!quitar && (Number.isNaN(pct!) || pct! < 0 || pct! > 100))
      return json({ error: 'El porcentaje va de 0 a 100.' }, 400);

    const { data: l, error: e1 } = await supabase.from('comision_lineas')
      .select('id, estado, corte_id, base, pct, descuento_exceso, regla_id, tasa_reducida, es_renovacion')
      .eq('id', b.id).maybeSingle();
    if (e1) throw e1;
    if (!l) return json({ error: 'Esa línea ya no existe.' }, 404);
    if (l.estado === 'pagada')
      return json({ error: 'Esta comisión ya se pagó: no se le puede cambiar el porcentaje.' }, 409);

    if (l.corte_id) {
      const { data: c } = await supabase.from('comision_cortes')
        .select('estado').eq('id', l.corte_id).maybeSingle();
      if (c && CORTES_FIRMES.includes(c.estado as any))
        return json({ error: `El corte ya está ${c.estado}. Reábrelo para cambiar un renglón.` }, 409);
    }

    // Al quitar el ajuste hay que volver al % de la TARIFA, no al que quedó
    // escrito: `pct` en la fila es el manual, y dejarlo congelaría la excepción
    // para siempre bajo la apariencia de una tarifa normal.
    //
    // Y hay que volver a la tarifa QUE LE TOCA: si la línea es una renovación,
    // eso es la tasa de anualidad, no la de primera venta. Leer solo `pct`
    // devolvía una anualidad al 35% —el número que justamente se corrigió— y el
    // error se veía como si el ajuste manual lo hubiera causado.
    let pct_base = Number(l.pct);
    if (quitar && l.regla_id && !l.tasa_reducida) {
      const { data: r } = await supabase.from('comision_reglas')
        .select('pct, pct_renovacion').eq('id', l.regla_id).maybeSingle();
      if (r) {
        pct_base = l.es_renovacion && r.pct_renovacion != null
          ? Number(r.pct_renovacion) : Number(r.pct);
      }
    }

    const fila = aplicarPctManual({ ...l, pct: pct_base }, pct, b.nota);
    const { error: e2 } = await supabase.from('comision_lineas').update({
      pct: fila.pct, monto: fila.monto,
      pct_manual: fila.pct_manual, pct_manual_nota: fila.pct_manual_nota, pct_manual_at: fila.pct_manual_at,
    }).eq('id', b.id);
    if (e2) throw e2;

    // El total del corte es un derivado: dejarlo desincronizado es como se
    // acaba enviando un documento cuyo total no cuadra con su propio detalle.
    const totales = l.corte_id ? await recalcularTotales(l.corte_id) : null;
    return json({ ok: true, pct: fila.pct, monto: fila.monto, totales });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
