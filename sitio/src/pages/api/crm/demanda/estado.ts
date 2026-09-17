// GET /api/crm/demanda/estado — todo lo que la pantalla Sistema necesita de un
// solo viaje: config, presupuesto, cola, último ciclo, salud, conectores y qué
// le falta al motor para poder trabajar.
//
// Un solo viaje a propósito: la pantalla se abre para saber «¿está vivo?», y
// seis peticiones en cascada convierten esa pregunta en tres segundos de spinner.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { leerConfig, presupuesto } from '../../../../lib/demanda/config';
import { resumenCola } from '../../../../lib/demanda/cola';
import { tiposRegistrados } from '../../../../lib/demanda/registro';
import { refrescarDisponibilidad } from '../../../../lib/demanda/conectores';
import '../../../../lib/demanda/registro';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  try {
    const cfg = await leerConfig(true);
    // Se repasa ANTES de leer: si alguien puso una llave hace cinco minutos, la
    // pantalla tiene que decirlo hoy y no la semana que viene.
    await refrescarDisponibilidad();
    const [pres, cola, ciclos, salud, conectores, politicas, pendientes] = await Promise.all([
      presupuesto(cfg),
      resumenCola(),
      supabase.from('de_ciclos').select('id, tipo, inicio, fin, estado, acciones_ok, acciones_fallidas, costo_usd, resumen, top5').order('inicio', { ascending: false }).limit(5),
      supabase.from('de_salud').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('de_conectores').select('*').order('orden'),
      supabase.from('de_politicas').select('*').order('riesgo').order('tipo_accion'),
      supabase.from('de_acciones').select('id, tipo, estado, riesgo, motivo, payload, created_at').eq('estado', 'necesita_aprobacion').order('created_at', { ascending: false }).limit(50),
    ]);

    const registrados = tiposRegistrados();
    const ks = conectores.data || [];
    // «Lo que me falta»: el motor tiene que poder PEDIR lo que necesita, con el
    // costo de no tenerlo. Si no, el hueco solo se nota meses después, por el
    // dato que nunca llegó.
    const falta = ks
      .filter(k => !k.disponible || !k.activo)
      .map(k => ({
        id: k.id, nombre: k.nombre, grupo: k.grupo,
        que_falta: !k.disponible ? (k.falta || 'falta credencial o permiso') : 'está apagado en Ajustes',
        impacto: k.impacto, construido: registrados.includes(`ingerir.${k.id}`),
      }));

    /* La rampa entra en el mismo viaje que todo lo demás.
       Que la pantalla Sistema enseñe la autonomía sin enseñar qué falta para
       la siguiente deja al dueño con un número —«nivel 2»— y sin la pregunta
       útil, que es: ¿qué tendría que pasar para que sea 3? */
    /* El latido va en el mismo viaje. La pantalla Sistema se abre para saber
       «¿está vivo?», y ese es literalmente el nombre de esto: enseñar la salud
       (un 85/100) sin enseñar qué signo falla deja al dueño con una nota y sin
       la frase. */
    const { tomar, diagnosticar } = await import('../../../../lib/demanda/latido');
    const latido = await tomar().catch(e => {
      console.error(`[estado] el latido no se pudo tomar: ${e?.message}`);
      return null;
    });
    const pistas = latido && !latido.vivo ? await diagnosticar(latido).catch(() => []) : [];

    const { evaluar } = await import('../../../../lib/demanda/autonomia');
    const rampa = await evaluar().catch(e => {
      // Que la rampa falle no puede dejar sin pantalla al dueño: Sistema es
      // donde se mira si el motor está vivo, y también donde está el apagador.
      console.error(`[estado] la rampa de autonomía no se pudo evaluar: ${e?.message}`);
      return [];
    });

    return json({
      ok: true,
      config: cfg,
      rampa,
      latido: latido ? { ...latido, pistas } : null,
      presupuesto: pres,
      cola,
      ciclos: ciclos.data || [],
      salud: salud.data || null,
      conectores: ks,
      politicas: politicas.data || [],
      aprobaciones: pendientes.data || [],
      handlers: registrados,
      falta,
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
