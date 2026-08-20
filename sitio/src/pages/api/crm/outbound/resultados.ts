// OUTBOUND · Resultados de una campaña: embudo, clics por botón, interés y lift.
//
// GET ?id=<campana_id>
// Todo se calcula desde inapp_eventos / inapp_conversiones (la verdad ingerida
// por el cron), nunca desde acumuladores — patrón refrescarResumen del módulo
// de email: un contador que se desincroniza no se nota; un recálculo, sí.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { leerPaginado } from '../../../../lib/outbound/motor';
import { cortesEscala } from '../../../../lib/outbound/catalogo';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const { data: c, error } = await supabase.from('inapp_campanas').select('*').eq('id', id).single();
  if (error || !c) return json({ error: 'Campaña no encontrada' }, 404);

  // Paginado: PostgREST capa a max_rows=1000 CUALQUIER select por grande que
  // sea el .limit() — sin esto, una campaña con tracción subcuenta en silencio.
  const evs = await leerPaginado((from, to) => supabase.from('inapp_eventos')
    .select('evento, boton, valor, comentario, driver, respuesta, uid, cuenta, dia')
    .eq('campana_id', id).order('id', { ascending: true }).range(from, to));
  const usuariosVieron = new Set<string>();
  const usuariosClic = new Set<string>();
  const cuentasVieron = new Set<string>();
  let impresiones = 0, cierres = 0, descartes = 0, chats = 0;
  const porBoton: Record<string, number> = {};
  const encuesta: number[] = [];
  const comentarios: Array<{ cuenta: string; valor: number; comentario: string; dia: string }> = [];
  const drivers: Record<string, number> = {};
  const respuestas: Record<string, number> = {};
  const interesados = new Set<string>();
  const vistasPorUsuario: Record<string, number> = {};

  for (const e of evs) {
    if (e.evento === 'impresion') {
      impresiones++; usuariosVieron.add(e.uid); cuentasVieron.add(e.cuenta);
      vistasPorUsuario[e.uid] = (vistasPorUsuario[e.uid] || 0) + 1;
    }
    if (e.evento === 'clic') { usuariosClic.add(e.uid); porBoton[e.boton || '(sin botón)'] = (porBoton[e.boton || '(sin botón)'] || 0) + 1; interesados.add(e.uid); }
    if (e.evento === 'cierre') cierres++;
    if (e.evento === 'descarte') descartes++;
    if (e.evento === 'chat_abierto') { chats++; interesados.add(e.uid); }
    if (e.evento === 'respuesta_encuesta') {
      interesados.add(e.uid);
      if (e.valor != null) {
        encuesta.push(Number(e.valor));
        if (e.comentario) comentarios.push({ cuenta: e.cuenta, valor: Number(e.valor), comentario: e.comentario, dia: e.dia });
      }
      if (e.driver) drivers[e.driver] = (drivers[e.driver] || 0) + 1;
      if (e.respuesta) respuestas[e.respuesta] = (respuestas[e.respuesta] || 0) + 1;
    }
    if (e.evento === 'cita_agendada') { interesados.add(e.uid); }
  }
  // Interés = clic/chat/encuesta O ≥2 impresiones (lo vio dos veces y no lo descartó).
  for (const [u, n] of Object.entries(vistasPorUsuario)) if (n >= 2) interesados.add(u);

  const convs = await leerPaginado((from, to) => supabase.from('inapp_conversiones')
    .select('cuenta, brazo, convirtio_at').eq('campana_id', id).order('id', { ascending: true }).range(from, to));
  const expuestas = (convs || []).filter(x => x.brazo === 'expuesto').length;
  const control = (convs || []).filter(x => x.brazo === 'control').length;

  const cuentasObjetivo = c.materializada?.cuentas || 0;
  const tasaExp = cuentasVieron.size ? expuestas / cuentasVieron.size : 0;
  const cuentasSinVer = Math.max(0, cuentasObjetivo - cuentasVieron.size);
  const tasaCtrl = cuentasSinVer ? control / cuentasSinVer : 0;

  const { data: historial } = await supabase.from('inapp_auditoria')
    .select('accion, quien, detalle, created_at').eq('campana_id', id)
    .order('created_at', { ascending: false }).limit(15);

  return json({
    historial: historial || [],
    campana: { id: c.id, nombre: c.nombre, estado: c.estado, formato: c.formato, meta: c.meta, materializada: c.materializada, pausa_motivo: c.pausa_motivo, vigencia_desde: c.vigencia_desde, vigencia_hasta: c.vigencia_hasta },
    resumen: {
      cuentas_objetivo: cuentasObjetivo,
      cuentas_vieron: cuentasVieron.size,
      usuarios_vieron: usuariosVieron.size,
      impresiones,
      usuarios_clic: usuariosClic.size,
      ctr: impresiones ? +(usuariosClic.size / usuariosVieron.size * 100).toFixed(1) : 0,
      cierres, descartes, chats_abiertos: chats,
      interes: interesados.size,
      encuesta: (encuesta.length || Object.keys(respuestas).length || Object.keys(drivers).length) ? (() => {
        const cx = cortesEscala(c.contenido?.encuesta?.escala);
        const prom = encuesta.filter(v => v >= cx.prom).length;
        const det = encuesta.filter(v => v <= cx.det).length;
        return {
          respuestas: encuesta.length,
          respondio_valor: encuesta.length,
          promedio: encuesta.length ? +(encuesta.reduce((a, b) => a + b, 0) / encuesta.length).toFixed(1) : null,
          promotores: prom, pasivos: encuesta.length - prom - det, detractores: det,
          score: (cx.esNps && encuesta.length) ? Math.round((prom - det) / encuesta.length * 100) : null,
          escala: c.contenido?.encuesta?.escala || 'nps',
          comentarios: comentarios.slice(0, 100),
          drivers, opciones: respuestas,
        };
      })() : null,
      citas: evs.filter(e => e.evento === 'cita_agendada').length,
      conversiones: {
        expuestas, control,
        tasa_expuestos_pct: +(tasaExp * 100).toFixed(1),
        tasa_control_pct: +(tasaCtrl * 100).toFixed(1),
        lift: tasaCtrl > 0 ? +(tasaExp / tasaCtrl).toFixed(1) : null,
      },
      clics_por_boton: porBoton,
    },
  });
};
