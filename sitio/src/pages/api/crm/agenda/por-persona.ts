/* LA AGENDA DE CADA QUIEN, VISTA DESDE ARRIBA.
 *
 * PEDIDO DEL DUEÑO (20-sep-2026): «en el tema de calendario, como superadmin
 * que tengamos una sección donde podamos ver el calendario de cada usuario
 * para ver qué tipo de eventos tiene cada uno, pero que se manejen totalmente
 * separados, cada uno con su Google Calendar».
 *
 * Las dos mitades importan y tiran en direcciones opuestas:
 *
 *  · SEPARADOS de verdad. Cada persona conecta SU Google y sus eventos van a
 *    su calendario. Esto NO lee el Google de nadie —no hay tokens de terceros
 *    de por medio ni hace falta—: lee las reuniones del CRM, que es de donde
 *    salen, y dice con qué cuenta de Google está enganchada cada una.
 *  · PERO VISIBLES desde arriba, porque sin eso no se puede repartir el
 *    trabajo: quién tiene la semana llena, quién no ha conectado su calendario
 *    —y por tanto sus citas no le suenan en el teléfono— y qué tipo de evento
 *    lleva cada quien (demos contra seguimientos, que es justo la división que
 *    se acaba de hacer).
 *
 * Sólo para founder: es información de todo el equipo.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (user.role !== 'founder') return json({ error: 'Solo los founder ven la agenda de todo el equipo' }, 403);

  const hoy = new Date().toISOString().slice(0, 10);
  const fin = new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10);

  const [{ data: gente }, { data: conexiones }, { data: bks }] = await Promise.all([
    supabase.from('team_members').select('id, nombre, email, rol, foto_url, recibe_entrantes')
      .eq('activo', true).order('nombre'),
    supabase.from('calendar_connections').select('team_member_id, provider, email, activo'),
    /* Un mes hacia delante: es el horizonte con el que se reparte trabajo. Lo
       de más allá se consulta en la pestaña de siempre. */
    supabase.from('bookings')
      .select('id, host_id, fecha, hora_inicio, estado, asunto, invitee_nombre, origen, event_types(nombre, slug)')
      .gte('fecha', hoy).lte('fecha', fin)
      .order('fecha').order('hora_inicio').limit(1000),
  ]);

  const conexionDe = new Map<string, any>();
  for (const c of conexiones || []) if (c.provider === 'google') conexionDe.set(String(c.team_member_id), c);

  const filas = (gente || [])
    /* El Agente IA tiene cuenta para firmar sus mensajes, no agenda. Sale de
       aquí o la lista arranca con una fila que nunca va a tener nada. */
    .filter(m => m.rol !== 'soporte')
    .map(m => {
      const suyas = (bks || []).filter(b => String(b.host_id) === String(m.id) && b.estado !== 'cancelada');
      const porTipo: Record<string, number> = {};
      for (const b of suyas) {
        const t = (b as any).event_types?.nombre || b.asunto || 'Otro';
        porTipo[t] = (porTipo[t] || 0) + 1;
      }
      const cx = conexionDe.get(String(m.id));
      return {
        id: m.id, nombre: m.nombre, email: m.email, rol: m.rol, foto_url: m.foto_url,
        recibe_entrantes: m.recibe_entrantes !== false,
        google: cx ? { email: cx.email, activo: cx.activo !== false } : null,
        hoy: suyas.filter(b => b.fecha === hoy).length,
        proximas: suyas.length,
        /* De dónde salieron: las de una llamada son el seguimiento que se
           acordó hablando; las demás vienen de la página pública o del CRM. */
        de_llamada: suyas.filter(b => b.origen === 'llamada').length,
        por_tipo: Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 6),
        siguientes: suyas.slice(0, 5).map(b => ({
          fecha: b.fecha, hora: String(b.hora_inicio || '').slice(0, 5),
          titulo: (b as any).event_types?.nombre || b.asunto || 'Reunión',
          con: b.invitee_nombre || null, estado: b.estado,
        })),
      };
    });

  return json({ ok: true, desde: hoy, hasta: fin, personas: filas });
};
