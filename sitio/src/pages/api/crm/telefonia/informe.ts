// LLAMADAS · ¿ESTO ESTÁ SIRVIENDO? El informe de las llamadas del CRM.
//
// Pedido del dueño (18-sep-2026), al pedir que el marcador sea «lo más
// efectivo a nivel global para hacer llamadas rápido y DAR SEGUIMIENTO».
// Llamar rápido ya se ve en la cabina; si sirve, no se veía en ningún lado.
//
// Las seis preguntas que contesta, y ninguna más — un tablero de quince cifras
// no se mira; seis que se mueven, sí:
//   1. ¿Cuántas llamadas y cuántas CONVERSACIONES de verdad? (contactabilidad)
//   2. ¿A qué hora contestan? (para armar la jornada donde sí abren)
//   3. ¿Cuántas citas salieron de esas llamadas, y cuántas se cumplieron?
//   4. ¿Qué promesas se están cayendo? (lo que se prometió y venció)
//   5. ¿Quién está llamando? (por vendedor)
//   6. ¿Cuánto costó cada conversación?
//
// GET ?dias=30
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Una llamada cuenta como conversación si habló más de 20 s y no fue una
 *  grabadora. Es el mismo criterio que usa la cabina, a propósito: dos
 *  definiciones de «contestó» darían dos números que se desmienten. */
const esConversacion = (l: any) => !/^machine_/.test(String(l.payload?.answered_by || '')) && Number(l.duracion_seg || 0) > 20;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const dias = Math.max(1, Math.min(180, Number(url.searchParams.get('dias') || 30)));
  const desde = new Date(Date.now() - dias * 86400e3).toISOString();

  const [{ data: llamadas }, { data: citas }, { data: tareas }, { data: sesiones }, { data: equipo }] = await Promise.all([
    supabase.from('wa_llamadas').select('call_id, started_at, duracion_seg, estado, payload, atendida_por, direccion, resultado')
      .eq('canal', 'telefono').gte('started_at', desde).limit(4000),
    // Las citas que NACIERON de una llamada: es la conversión que importa.
    supabase.from('bookings').select('id, fecha, estado, created_at, host_id')
      .eq('origen', 'llamada').gte('created_at', desde).limit(1000),
    // Lo prometido que ya venció y sigue pendiente: las promesas que se caen.
    supabase.from('ti_tareas').select('id, tipo, estado, vence_at, owner_id')
      .in('tipo', ['llamada', 'responder']).eq('estado', 'pendiente')
      .lt('vence_at', new Date().toISOString()).gte('vence_at', desde).limit(500),
    supabase.from('tel_sesiones').select('id, costo_usd, segundos_hablados, contestadas, total, iniciada_at, owner_id')
      .gte('created_at', desde).limit(200),
    supabase.from('team_members').select('id, nombre').limit(60),
  ]);

  const ll = (llamadas || []).filter(l => l.direccion === 'saliente');
  const conversaciones = ll.filter(esConversacion);
  const nombre = (id: string | null) => (equipo || []).find(e => e.id === id)?.nombre || 'Sin asignar';

  // ── 2 · A qué hora contestan (franjas de dos horas, hora del centro) ──────
  const franjas: Record<string, { t: number; ok: number }> = {};
  for (const l of ll) {
    if (!l.started_at) continue;
    const h = Number(new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false }).format(new Date(l.started_at)));
    const f = h < 11 ? '9-11' : h < 13 ? '11-13' : h < 15 ? '13-15' : h < 17 ? '15-17' : h < 19 ? '17-19' : null;
    if (!f) continue;
    franjas[f] = franjas[f] || { t: 0, ok: 0 };
    franjas[f].t++; if (esConversacion(l)) franjas[f].ok++;
  }
  const horas = Object.entries(franjas).filter(([, v]) => v.t >= 5)
    .map(([franja, v]) => ({ franja, total: v.t, contestadas: v.ok, tasa: Math.round((v.ok / v.t) * 100) }))
    .sort((a, b) => b.tasa - a.tasa);

  // ── 5 · Por vendedor ─────────────────────────────────────────────────────
  const porVendedor: Record<string, { llamadas: number; conversaciones: number; citas: number }> = {};
  for (const l of ll) {
    const k = String(l.atendida_por || '');
    porVendedor[k] = porVendedor[k] || { llamadas: 0, conversaciones: 0, citas: 0 };
    porVendedor[k].llamadas++; if (esConversacion(l)) porVendedor[k].conversaciones++;
  }
  for (const c of citas || []) {
    const k = String(c.host_id || '');
    porVendedor[k] = porVendedor[k] || { llamadas: 0, conversaciones: 0, citas: 0 };
    porVendedor[k].citas++;
  }

  // ── 3 · Citas: las que ya pasaron, ¿se cumplieron? ───────────────────────
  const hoy = new Date().toISOString().slice(0, 10);
  const pasadas = (citas || []).filter(c => String(c.fecha) < hoy);
  /* Los estados son los de la agenda del CRM, medidos: agendada, confirmada,
     asistio, no_asistio, cancelada, reagendada. «Agendada» que ya pasó no es
     ninguna de las dos: es una cita que nadie cerró, y por eso se cuenta
     aparte — es justo el trabajo pendiente que se escapa. */
  const asistieron = pasadas.filter(c => String(c.estado) === 'asistio');
  const noAsistieron = pasadas.filter(c => ['no_asistio', 'cancelada'].includes(String(c.estado)));
  const sinCerrar = pasadas.filter(c => ['agendada', 'confirmada'].includes(String(c.estado)));

  const costo = (sesiones || []).reduce((a, s) => a + Number(s.costo_usd || 0), 0);

  return json({
    dias,
    llamadas: ll.length,
    conversaciones: conversaciones.length,
    contactabilidad: ll.length ? Math.round((conversaciones.length / ll.length) * 100) : 0,
    minutos_hablados: Math.round(conversaciones.reduce((a, l) => a + Number(l.duracion_seg || 0), 0) / 60),
    horas,
    citas: (citas || []).length,
    // De cada cien conversaciones, cuántas acabaron en cita. Lo demás son
    // porcentajes sobre llamadas marcadas, que engordan solos marcando más.
    cita_por_conversacion: conversaciones.length ? Math.round(((citas || []).length / conversaciones.length) * 100) : 0,
    citas_pasadas: pasadas.length,
    citas_asistieron: asistieron.length,
    citas_no_asistieron: noAsistieron.length,
    citas_sin_cerrar: sinCerrar.length,
    promesas_vencidas: (tareas || []).length,
    costo_usd: Math.round(costo * 100) / 100,
    costo_por_conversacion: conversaciones.length ? Math.round((costo / conversaciones.length) * 100) / 100 : 0,
    vendedores: Object.entries(porVendedor)
      .filter(([, v]) => v.llamadas + v.citas > 0)
      .map(([id, v]) => ({ id, nombre: nombre(id || null), ...v }))
      .sort((a, b) => b.conversaciones - a.conversaciones).slice(0, 8),
  });
};
