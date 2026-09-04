// COMISIONES · el aviso del lunes en #pago-de-comisiones.
//
// Corre los lunes a las 9:00 am CDMX (15:00 UTC), CUATRO HORAS DESPUÉS de que
// el corte se arma (5:00 am). Ese hueco es a propósito: el aviso llega con el
// cálculo terminado, no con uno a medias. Publicarlos juntos habría hecho que
// un corte que tarda —una semana con muchos pagos rezagados— saliera anunciado
// antes de existir, y el enlace daría 404 justo en el mensaje que pide abrirlo.
//
// Qué publica: un renglón por consultor con su monto y su enlace, el total, y
// lo que quedó por revisar. Nada más. Este mensaje se lee de pie con el
// teléfono en la mano: si trae tres párrafos, no se lee.
//
// NO paga ni envía nada. Deja el corte a la vista y pide la revisión de Andy.
// Que el dinero salga sigue siendo una decisión de una persona — el cron nunca
// la toma.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { leerCiclo, semanaCerrada, pagosNoReconocidos } from '../../../lib/crm/comisiones.cortes';
import { publicarEnCanal } from '../../../lib/crm/espacio-publicar';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const CANAL = 'pago-de-comisiones';
const SITIO = 'https://www.sacscloud.com';

/** «lun 8 de septiembre» — la fecha como la diría una persona. */
const fechaLarga = (f: string) => new Date(String(f).slice(0, 10) + 'T12:00:00')
  .toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long' });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  const ciclo = await leerCiclo();
  const { desde, hasta, paga_el } = semanaCerrada(new Date(), ciclo);

  const { data: cortes, error } = await supabase.from('comision_cortes')
    .select('id, total, estado, paga_el, desde, hasta, pagado_at, team_members:owner_id(nombre)')
    .eq('desde', desde).eq('hasta', hasta).order('total', { ascending: false });
  if (error) return json({ error: error.message }, 500);

  /* Sin cortes NO se publica un «no hubo nada». Una semana sin ventas no
     necesita un mensaje; lo que necesita es que el canal siga siendo creíble
     el día que sí traiga algo. */
  if (!cortes?.length) return json({ ok: true, publicado: false, motivo: 'no hay cortes esta semana', desde, hasta });

  const total = cortes.reduce((a, c) => a + Number(c.total || 0), 0);
  const sueltos = await pagosNoReconocidos(desde, hasta);

  const filas = cortes.map(c => {
    const quien = (c as any).team_members?.nombre || 'Sin asignar';
    // El enlace ES el mensaje: es lo que el dueño pidió que llegara solo.
    return `· **${quien}** — ${pesos(Number(c.total || 0))} → ${SITIO}/comisiones/${c.id}`;
  });

  const pendientes: string[] = [];
  if (sueltos.length) pendientes.push(`${sueltos.length} pago(s) cobrados que **no** generaron comisión: hay que revisarlos antes de aprobar.`);
  const yaPagado = cortes.filter(c => c.pagado_at).length;
  if (yaPagado) pendientes.push(`${yaPagado} corte(s) ya aparecen como pagados.`);

  const texto = [
    `**Cierre de comisiones · semana ${desde} → ${hasta}**`,
    ``,
    ...filas,
    ``,
    `**Total a pagar: ${pesos(total)}** · se liquida el ${fechaLarga(paga_el)}.`,
    ``,
    ...(pendientes.length ? [...pendientes.map(p => `⚠️ ${p}`), ``] : []),
    `Andy: revisa cada estado de cuenta y confirma en este hilo. En cuanto confirmes se manda a pago y mañana queda liquidado el total.`,
  ].join('\n');

  const r = await publicarEnCanal({
    canal: CANAL,
    // Una clave por semana: si el cron se reintenta —Vercel lo hace— no queda
    // el mismo aviso dos veces en el canal.
    clave: `comisiones-lunes-${hasta}`,
    texto,
    metadata: { comisiones: { desde, hasta, paga_el, total: Math.round(total), cortes: cortes.length, sin_comisionar: sueltos.length } },
  });

  /* Si el canal no existe o el insert falló, el aviso NO salió y alguien tiene
     que enterarse: se manda por la campana, que es el camino que sí se lee.
     Un aviso que se pierde en silencio es exactamente lo que este cron vino a
     resolver. */
  if (!r.id) {
    await supabase.from('crm_notificaciones').insert({
      clave: `comisiones-lunes-falla-${hasta}`,
      tipo: 'sistema_comisiones_aviso',
      nivel: 'alerta',
      titulo: 'El aviso de comisiones del lunes no se publicó',
      detalle: `${r.motivo || 'motivo desconocido'} · ${cortes.length} corte(s) por ${pesos(total)} esperando revisión`,
    }).then(() => {}, () => {});
  }

  return json({ ok: true, publicado: !!r.id, motivo: r.motivo || null, mensaje_id: r.id, desde, hasta, paga_el, cortes: cortes.length, total: Math.round(total), sin_comisionar: sueltos.length });
};
