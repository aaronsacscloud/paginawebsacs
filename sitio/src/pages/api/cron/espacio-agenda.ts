// EQUIPO · LA AGENDA DE MAÑANA. Cada tarde a las 18:00 CDMX (00:00 UTC) mira
// qué salas tienen reunión mañana (regla_reunion.dia_iso) y avisa a cada
// persona del equipo por la campana: cuántos puntos hay y cuántos vienen
// arrastrados de la vez pasada. Si no hay reunión mañana, no hace nada.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { equipo, AGENTE_IA_ID } from '../../../lib/crm/espacio.lib';
import { pushA } from '../../../lib/crm/push-crm';
import { puedeEmpujar } from '../../../lib/crm/push-reglas';
import { asegurarOcurrencias } from '../crm/espacio/sala';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const manana = new Date(cdmx.getTime() + 86400e3);
  const { data: salas } = await supabase.from('espacio_canales').select('id, nombre, regla_reunion').eq('tipo', 'sala').is('archivado_at', null);

  /* De paso, materializar y barrer las ocurrencias de TODAS las salas. El panel
     ya lo hace al abrirse, pero si nadie entra en toda la semana una junta
     saltada seguiría figurando como pendiente. Aquí la verdad no depende de que
     alguien mire. */
  let saltadas = 0;
  for (const s of salas || []) { try { saltadas += await asegurarOcurrencias(s as any); } catch { /* una sala mal configurada no tumba el cron */ } }
  /* ⚠️ EL AVISO SALE DE LA OCURRENCIA, NO DE LA REGLA.
     Filtraba por `regla_reunion.dia_iso`, y con eso mover una junta no servía
     de nada: si la del lunes se pasaba al miércoles, el domingo en la noche
     todo el equipo recibía "mañana a las 10" de una junta que ya no existía, y
     el martes en la noche no recibía nada. La regla dice cuándo TOCA; la
     ocurrencia dice cuándo ES, que es lo único que le importa a quien va.
     Solo las `pendiente`: una junta ya iniciada o saltada no se recuerda. */
  const fechaManana = manana.toISOString().slice(0, 10);
  const porId = new Map((salas || []).map((s: any) => [s.id, s]));
  const { data: occs } = await supabase.from('espacio_reunion_ocurrencias')
    .select('id, canal_id, inicio_at, programada_at')
    .eq('fecha', fechaManana).eq('estado', 'pendiente');
  const juntas = (occs || []).map((o: any) => ({ o, s: porId.get(o.canal_id) })).filter(x => x.s);
  if (!juntas.length) return json({ ok: true, avisos: 0, saltadas, motivo: 'mañana no hay reunión' });

  const gente = (await equipo()).filter(p => p.id !== AGENTE_IA_ID);
  let avisos = 0;
  for (const { o, s } of juntas) {
    /* Los puntos de MAÑANA: los de siempre (sin junta apartada) más los que
       alguien apartó para esta junta en concreto. Contar todos daría un número
       inflado con temas que ni siquiera se van a ver. */
    const { data: puntos } = await supabase.from('espacio_reunion_puntos')
      .select('id, arrastres').eq('canal_id', s.id).eq('estado', 'propuesto').is('sesion_id', null)
      .or(`para_ocurrencia_id.is.null,para_ocurrencia_id.eq.${o.id}`);
    const n = (puntos || []).length, arr = (puntos || []).filter((p: any) => p.arrastres > 0).length;
    // La hora sale de la ocurrencia y se lee en hora de México.
    const hora = new Date(o.inicio_at).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false });
    const movida = o.inicio_at !== o.programada_at;
    const titulo = `Mañana a las ${hora} · #${s.nombre}`;
    const base = n ? `${n} punto${n === 1 ? '' : 's'} en la agenda${arr ? `, ${arr} arrastrado${arr === 1 ? '' : 's'} de la vez pasada` : ''}.` : 'La agenda está vacía: propón lo que haya que ver.';
    // Si la junta se movió, eso es LO PRIMERO que hay que decir: quien no abrió
    // la sala sigue con el horario viejo en la cabeza.
    const detalle = movida ? `Se movió de las ${new Date(o.programada_at).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false })}. ${base}` : base;
    const dia = fechaManana;
    for (const p of gente) {
      const { error } = await supabase.from('crm_notificaciones').upsert({
        clave: `espacio_agenda:${o.id}:${p.id}`, tipo: 'espacio_agenda', nivel: 'info', titulo, detalle,
        destino: `equipo?canal=${s.id}`, para: p.id, metadata: { canal_id: s.id, ocurrencia_id: o.id, fecha: dia, puntos: n, arrastrados: arr, movida },
      }, { onConflict: 'clave', ignoreDuplicates: true });
      // El push pasa por la lista de push-reglas como todos los demás: si un día
      // se decide que sobra, se apaga desde ahí y no hay que venir a buscarlo.
      if (!error) { avisos++; if (puedeEmpujar('reunion_manana')) pushA(p.id, { title: titulo, body: detalle, url: `/admin/crm?tab=equipo&canal=${s.id}`, tag: `agenda-${s.id}`, data: { clase: 'reunion_manana' } }).catch(() => null); }
    }
  }
  return json({ ok: true, salas: juntas.map(x => x.s.nombre), avisos, saltadas });
};
