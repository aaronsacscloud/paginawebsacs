// OUTBOUND · Resultados de una campaña: embudo, clics por botón, interés y lift.
//
// GET ?id=<campana_id>
// Todo se calcula desde inapp_eventos / inapp_conversiones (la verdad ingerida
// por el cron), nunca desde acumuladores — patrón refrescarResumen del módulo
// de email: un contador que se desincroniza no se nota; un recálculo, sí.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const { data: c, error } = await supabase.from('inapp_campanas').select('*').eq('id', id).single();
  if (error || !c) return json({ error: 'Campaña no encontrada' }, 404);

  const { data: eventos } = await supabase.from('inapp_eventos')
    .select('evento, boton, valor, uid, cuenta, dia')
    .eq('campana_id', id).limit(100000);

  const evs = eventos || [];
  const usuariosVieron = new Set<string>();
  const usuariosClic = new Set<string>();
  const cuentasVieron = new Set<string>();
  let impresiones = 0, cierres = 0, descartes = 0, chats = 0;
  const porBoton: Record<string, number> = {};
  const encuesta: number[] = [];
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
    if (e.evento === 'respuesta_encuesta' && e.valor != null) { encuesta.push(Number(e.valor)); interesados.add(e.uid); }
  }
  // Interés = clic/chat/encuesta O ≥2 impresiones (lo vio dos veces y no lo descartó).
  for (const [u, n] of Object.entries(vistasPorUsuario)) if (n >= 2) interesados.add(u);

  const { data: convs } = await supabase.from('inapp_conversiones')
    .select('cuenta, brazo, convirtio_at').eq('campana_id', id).limit(10000);
  const expuestas = (convs || []).filter(x => x.brazo === 'expuesto').length;
  const control = (convs || []).filter(x => x.brazo === 'control').length;

  const cuentasObjetivo = c.materializada?.cuentas || 0;
  const tasaExp = cuentasVieron.size ? expuestas / cuentasVieron.size : 0;
  const cuentasSinVer = Math.max(0, cuentasObjetivo - cuentasVieron.size);
  const tasaCtrl = cuentasSinVer ? control / cuentasSinVer : 0;

  return json({
    campana: { id: c.id, nombre: c.nombre, estado: c.estado, formato: c.formato, meta: c.meta, materializada: c.materializada, pausa_motivo: c.pausa_motivo },
    resumen: {
      cuentas_objetivo: cuentasObjetivo,
      cuentas_vieron: cuentasVieron.size,
      usuarios_vieron: usuariosVieron.size,
      impresiones,
      usuarios_clic: usuariosClic.size,
      ctr: impresiones ? +(usuariosClic.size / usuariosVieron.size * 100).toFixed(1) : 0,
      cierres, descartes, chats_abiertos: chats,
      interes: interesados.size,
      encuesta: encuesta.length ? { respuestas: encuesta.length, promedio: +(encuesta.reduce((a, b) => a + b, 0) / encuesta.length).toFixed(1) } : null,
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
