// EQUIPO · LA AGENDA DE MAÑANA. Cada tarde a las 18:00 CDMX (00:00 UTC) mira
// qué salas tienen reunión mañana (regla_reunion.dia_iso) y avisa a cada
// persona del equipo por la campana: cuántos puntos hay y cuántos vienen
// arrastrados de la vez pasada. Si no hay reunión mañana, no hace nada.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { equipo, AGENTE_IA_ID } from '../../../lib/crm/espacio.lib';
import { pushA } from '../../../lib/crm/push-crm';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const manana = new Date(cdmx.getTime() + 86400e3);
  const isoManana = manana.getUTCDay() === 0 ? 7 : manana.getUTCDay();
  const { data: salas } = await supabase.from('espacio_canales').select('id, nombre, regla_reunion').eq('tipo', 'sala').is('archivado_at', null);
  const mananaSalas = (salas || []).filter((s: any) => Number(s.regla_reunion?.dia_iso) === isoManana);
  if (!mananaSalas.length) return json({ ok: true, avisos: 0, motivo: 'mañana no hay reunión' });

  const gente = (await equipo()).filter(p => p.id !== AGENTE_IA_ID);
  let avisos = 0;
  for (const s of mananaSalas) {
    const { data: puntos } = await supabase.from('espacio_reunion_puntos').select('id, arrastres').eq('canal_id', s.id).eq('estado', 'propuesto').is('sesion_id', null);
    const n = (puntos || []).length, arr = (puntos || []).filter((p: any) => p.arrastres > 0).length;
    const hora = String(s.regla_reunion?.hora || '').slice(0, 5);
    const titulo = `Mañana ${hora ? `a las ${hora} ` : ''}· #${s.nombre}`;
    const detalle = n ? `${n} punto${n === 1 ? '' : 's'} en la agenda${arr ? `, ${arr} arrastrado${arr === 1 ? '' : 's'} de la vez pasada` : ''}.` : 'La agenda está vacía: propón lo que haya que ver.';
    const dia = manana.toISOString().slice(0, 10);
    for (const p of gente) {
      const { error } = await supabase.from('crm_notificaciones').upsert({
        clave: `espacio_agenda:${s.id}:${dia}:${p.id}`, tipo: 'espacio_agenda', nivel: 'info', titulo, detalle,
        destino: `equipo?canal=${s.id}`, para: p.id, metadata: { canal_id: s.id, fecha: dia, puntos: n, arrastrados: arr },
      }, { onConflict: 'clave', ignoreDuplicates: true });
      if (!error) { avisos++; pushA(p.id, { title: titulo, body: detalle, url: `/admin/crm?tab=equipo&canal=${s.id}`, tag: `agenda-${s.id}` }).catch(() => null); }
    }
  }
  return json({ ok: true, salas: mananaSalas.map((s: any) => s.nombre), avisos });
};
