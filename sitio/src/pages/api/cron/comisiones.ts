// COMISIONES · recálculo diario.
//
// Corre a las 4:00 am CDMX (10:00 UTC), después del sync de actividad y de los
// barridos de ARR: así el día arranca con las comisiones cuadradas contra los
// pagos que entraron ayer, sin que nadie apriete nada.
//
// Recalcula el mes en curso Y el anterior. El mes anterior sigue vivo porque
// los pagos se capturan con retraso (un comprobante que llega el día 3 lleva
// fecha del día 28) y porque un reembolso tardío tiene que poder revertir su
// comisión. Lo ya marcado como PAGADO no lo toca nunca, así que reprocesar el
// mes cerrado no reescribe nada liquidado.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { recalcularComisiones, evaluarRenovaciones } from '../../../lib/crm/comisiones.recalculo';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Primer día del mes N meses atrás, en UTC. */
function primerDia(mesesAtras: number): string {
  const h = new Date();
  const d = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - mesesAtras, 1));
  return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  const desde = primerDia(1);
  const hasta = new Date().toISOString().slice(0, 10);

  try {
    // La condición B de renovación se recalcula ANTES: si corriera después, el
    // recálculo del día usaría la evaluación de ayer y una cuenta que acaba de
    // alcanzar su meta seguiría cobrando tasa reducida 24 horas más.
    const anio = new Date().getUTCFullYear();
    const ev = await evaluarRenovaciones(anio).catch(e => ({ anio, evaluadas: 0, error: String(e?.message || e) }));

    const r = await recalcularComisiones(desde, hasta);

    // Un pago cobrado que no le cuenta a nadie es plata que se está perdiendo
    // en el reporte, así que se avisa. Una sola notificación al día y solo si
    // hay algo que atender: una campana que suena en vacío se deja de mirar.
    const pendientes = r.sin_atribuir + r.sin_regla + r.ajustes_pendientes.length + (r.truncado ? 1 : 0);
    if (pendientes > 0) {
      const partes: string[] = [];
      if (r.sin_atribuir) partes.push(`${r.sin_atribuir} pago(s) sin consultor asignado`);
      if (r.sin_regla) partes.push(`${r.sin_regla} sin tarifa para su SKU`);
      if (r.fuera_de_tiempo) partes.push(`${r.fuera_de_tiempo} renovación(es) cobradas fuera del margen`);
      if (r.ajustes_pendientes.length) partes.push(`${r.ajustes_pendientes.length} ajuste(s) por comisión ya pagada que se revirtió`);
      // Si se topó el límite de lectura, el cálculo está incompleto y eso pesa
      // más que cualquier otro pendiente: se dice primero.
      if (r.truncado) partes.unshift('EL CÁLCULO QUEDÓ INCOMPLETO: se alcanzó el tope de lectura');
      // `clave` tiene índice único: una notificación por día. Reintentar el
      // cron no vuelve a sonar la campana, y no hace falta llevar registro.
      await supabase.from('crm_notificaciones').insert({
        clave: `comisiones-${hasta}`,
        tipo: 'comisiones_pendientes',
        nivel: 'alerta',
        titulo: 'Comisiones: hay algo que revisar',
        detalle: partes.join(' \u00b7 '),
      }).then(() => {}, () => {}); // el aviso es cortesía: si falla, el cron no
    }

    return json({ ok: true, evaluaciones: ev, ...r });
  } catch (e: any) {
    return json({ error: e?.message || String(e), desde, hasta }, 500);
  }
};
