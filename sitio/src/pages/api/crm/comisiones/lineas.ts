// PUT /api/crm/comisiones/lineas — corregir UNA línea del corte.
//
// Dos correcciones distintas, juntas o por separado:
//
//   · el PORCENTAJE, cuando la realidad no cupo en la tarifa: un cliente al que
//     se le respetó otro trato, un cobro partido, un acuerdo puntual;
//   · la CUENTA a la que entró el pago, cuando se capturó mal. La comisión no
//     sale de lo que pagó el cliente sino de lo que queda después del costo de
//     recibirlo —16% de IVA en la corporativa, 6% de dispersión en la pagadora—,
//     así que equivocarse de cuenta sobre $7,000 mueve la base $700 y la
//     comisión ~$245 en un solo renglón.
//
// Las dos podían "arreglarse" antes con un ajuste suelto al final del corte,
// pero eso dejaba el documento mintiendo: el renglón seguía diciendo 35% y
// aparte colgaba un abono sin relación visible. Aquí la corrección vive DONDE
// OCURRIÓ, y la suma cuadra sola.
//
// Tres candados, y cada uno tapa una forma de mover dinero ya comprometido:
//
//   · una línea PAGADA no se toca — el dinero ya salió;
//   · una línea que viaja en un corte CERRADO o PAGADO tampoco: ese documento
//     ya se envió, y cambiarle un renglón por detrás es peor que no poder;
//   · el % va de 0 a 100 y la cuenta tiene que existir. Sin tope, un dedo de más
//     en el teclado paga de más.
//
// El % pide NOTA; la cuenta no. Un porcentaje distinto es un TRATO y hay que
// poder explicarlo en tres meses; la cuenta es un DATO que estaba mal.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { aplicarPctManual, aplicarCuenta, CUENTAS } from '../../../../lib/crm/comisiones.lib';
import { recalcularTotales, CORTES_FIRMES } from '../../../../lib/crm/comisiones.cortes';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (!b.id) return json({ error: 'Falta la línea.' }, 400);

    // Dos correcciones distintas por el mismo camino: el % del renglón y la
    // cuenta a la que entró el pago. Se pueden mandar juntas o por separado.
    const tocaPct = 'pct' in b;
    const tocaCuenta = 'cuenta' in b;
    if (!tocaPct && !tocaCuenta) return json({ error: 'No hay nada que cambiar.' }, 400);

    const cuenta = tocaCuenta ? (b.cuenta === '' || b.cuenta == null ? null : String(b.cuenta)) : undefined;
    if (cuenta != null && !CUENTAS.some(c => c.v === cuenta))
      return json({ error: 'Esa cuenta no existe.' }, 400);

    // Vacío o nulo = quitar el ajuste y volver a la tarifa configurada.
    const quitar = tocaPct && (b.pct === '' || b.pct == null);
    const pct = !tocaPct || quitar ? null : Number(b.pct);
    if (tocaPct && !quitar && (Number.isNaN(pct!) || pct! < 0 || pct! > 100))
      return json({ error: 'El porcentaje va de 0 a 100.' }, 400);

    const { data: l, error: e1 } = await supabase.from('comision_lineas')
      .select('id, estado, corte_id, base, pct, monto_bruto, descuento_exceso, regla_id, tasa_reducida, es_renovacion, cuenta, cuenta_manual, modelo_id, payment_id, pct_manual, pct_manual_nota, pct_manual_at')
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

    let fila: any = { ...l, pct: tocaPct ? pct_base : Number(l.pct) };

    // EL ORDEN IMPORTA: la cuenta rehace la base y el % se aplica sobre ella.
    // Al revés, un renglón con las dos correcciones cobraría el porcentaje
    // correcto sobre la base equivocada.
    if (tocaCuenta) {
      const { data: m } = await supabase.from('comision_modelos')
        .select('*').eq('id', l.modelo_id).maybeSingle();
      if (!m) return json({ error: 'La línea no tiene modelo: no se puede saber cuánto descuenta cada cuenta.' }, 409);

      // Limpiar la corrección devuelve la línea a la cuenta DEL PAGO, no al
      // default del modelo. Sin esto, quitar la corrección de un pago que entró
      // a la pagadora lo mandaba a la corporativa —otro descuento, otra
      // comisión— hasta que el recálculo de la madrugada lo enderezara solo.
      let efectiva = cuenta as any;
      if (efectiva == null) {
        const { data: pago } = await supabase.from('payments')
          .select('comision_cuenta').eq('id', (l as any).payment_id).maybeSingle();
        efectiva = pago?.comision_cuenta || null;
      }
      fila = aplicarCuenta(fila, efectiva, m as any);
      // Guardado explícito: solo hay corrección si vino una cuenta a la fuerza.
      fila.cuenta_manual = cuenta as any;
    }

    // El % se re-aplica siempre que exista uno manual, aunque esta llamada solo
    // venga a cambiar la cuenta: si no, cambiar la cuenta borraría el ajuste de
    // porcentaje sin que nadie lo pidiera.
    const pctFinal = tocaPct ? pct : (l.pct_manual == null ? null : Number(l.pct_manual));
    const notaFinal = tocaPct ? b.nota : l.pct_manual_nota;
    const cuandoFinal = tocaPct ? undefined : l.pct_manual_at;
    fila = aplicarPctManual(fila, pctFinal, notaFinal, cuandoFinal);

    const patch: any = {
      pct: fila.pct, monto: fila.monto,
      pct_manual: fila.pct_manual, pct_manual_nota: fila.pct_manual_nota, pct_manual_at: fila.pct_manual_at,
    };
    if (tocaCuenta) {
      patch.cuenta = fila.cuenta;
      patch.cuenta_manual = fila.cuenta_manual;
      patch.descuento_pct = fila.descuento_pct;
      patch.base = fila.base;
    }
    const { error: e2 } = await supabase.from('comision_lineas').update(patch).eq('id', b.id);
    if (e2) throw e2;

    // El total del corte es un derivado: dejarlo desincronizado es como se
    // acaba enviando un documento cuyo total no cuadra con su propio detalle.
    const totales = l.corte_id ? await recalcularTotales(l.corte_id) : null;
    return json({ ok: true, pct: fila.pct, monto: fila.monto, base: fila.base, cuenta: fila.cuenta, totales });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
