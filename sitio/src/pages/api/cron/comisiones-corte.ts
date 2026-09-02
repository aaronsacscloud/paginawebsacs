// COMISIONES · el corte semanal, cada lunes.
//
// Corre a las 5:00 am CDMX (11:00 UTC) de lunes, una hora después del recálculo
// diario. Ese orden importa: el corte tiene que armarse con las comisiones ya
// recalculadas de la semana, no con las de ayer.
//
// Qué hace, en orden:
//   1. recalcula la semana que acaba de cerrar, por si entró un pago tarde;
//   2. arma el corte de cada consultor con los siete días de esa semana;
//   3. absorbe los ajustes que quedaron pendientes de semanas anteriores;
//   4. avisa por la campana con el total a pagar y lo que quedó sin resolver.
//
// NO cierra ni paga nada: eso lo decide una persona. El cron deja el corte
// listo y a la vista, que es distinto de darlo por bueno.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { recalcularComisiones } from '../../../lib/crm/comisiones.recalculo';
import { generarCortes, semanaCerrada, leerCiclo, pagosNoReconocidos } from '../../../lib/crm/comisiones.cortes';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  const ciclo = await leerCiclo();
  const { desde, hasta, paga_el } = semanaCerrada(new Date(), ciclo);

  try {
    // 1 · La semana ya debió recalcularse en la madrugada, pero se repite sobre
    // el rango exacto: un pago capturado el viernes por la noche todavía no
    // tenía línea cuando corrió el recálculo diario.
    const recalc = await recalcularComisiones(desde, hasta);

    // 2 y 3 · Los cortes, con sus ajustes pendientes.
    const r = await generarCortes(desde, hasta, {
      automatico: true, paga_el,
      // Recoge las líneas de semanas pasadas que nunca entraron a un corte
      // porque su pago se capturó tarde. Sin esto se quedaban sin cobrar.
      arrastrar_desde: ciclo.arrastrar_desde,
    });

    // 4 · El aviso. Una sola notificación por semana, con clave única.
    const total = r.cortes.reduce((a, c) => a + Number(c.total || 0), 0);
    const sueltos = await pagosNoReconocidos(desde, hasta);

    const partes: string[] = [];
    partes.push(`${r.cortes.length} corte(s) por ${pesos(total)}, a pagar el ${paga_el}`);
    if (r.ajustes_absorbidos) partes.push(`${r.ajustes_absorbidos} ajuste(s) pendientes absorbidos`);
    if (r.rezagadas) partes.push(`${r.rezagadas} línea(s) rezagada(s) por ${pesos(r.monto_rezagado)} de semanas anteriores`);
    if (sueltos.length) partes.push(`${sueltos.length} pago(s) sin comisionar por revisar`);
    if (r.omitidos.length) partes.push(`${r.omitidos.length} omitido(s) por corte ya firme`);
    if (r.errores.length) partes.push(`${r.errores.length} error(es)`);

    await supabase.from('crm_notificaciones').insert({
      clave: `comisiones-corte-${hasta}`,
      tipo: 'comisiones_corte',
      nivel: sueltos.length || r.errores.length ? 'alerta' : 'info',
      titulo: `Corte de comisiones ${desde} → ${hasta}`,
      detalle: partes.join(' · '),
      monto: Math.round(total),
    }).then(() => {}, () => {});   // el aviso es cortesía: si falla, el cron no

    return json({ ok: true, desde, hasta, paga_el, recalculo: recalc, cortes: r, sin_comisionar: sueltos.length });
  } catch (e: any) {
    return json({ error: e?.message || String(e), desde, hasta }, 500);
  }
};
