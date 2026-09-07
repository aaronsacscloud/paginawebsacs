// Punto 10 · El calendario de ferias como suscripción iCal.
//
// GET /api/crm/eventos/ical?t=<token>  → text/calendar con las ediciones a las
//   que vamos, sus límites de registro y las tareas pendientes con fecha.
// GET /api/crm/eventos/ical (con sesión) → { url } la liga para suscribirse
//   (crea el token la primera vez; POST {accion:'rotar'} lo cambia).
//
// El token vive en abm_config (clave ev_ical_token). Google/Apple Calendar
// bajan el feed sin sesión, así que la liga ES la llave: por eso se puede rotar.
import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { supabase } from '../../../../lib/supabase';
import { json, quien } from '../../../../lib/crm/abm.lib';

export const prerender = false;
const CLAVE = 'ev_ical_token';

async function tokenActual(crear: boolean) {
  const { data } = await supabase.from('abm_config').select('valor').eq('clave', CLAVE).maybeSingle();
  let t = data?.valor ? String(typeof data.valor === 'string' ? data.valor : (data.valor as any)?.token || '') : '';
  if (!t && crear) t = await rotar();
  return t;
}
async function rotar() {
  const t = randomBytes(18).toString('base64url');
  await supabase.from('abm_config').upsert({ clave: CLAVE, valor: t, nota: 'Token de la suscripción iCal de Eventos', updated_at: new Date().toISOString() }, { onConflict: 'clave' });
  return t;
}

const esc = (s: any) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fechaIcs = (d: string) => String(d).slice(0, 10).replace(/-/g, '');
const masUno = (d: string) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
/** Líneas de máximo 75 octetos, como pide el RFC 5545 (Apple Calendar rechaza el feed si no). */
const plegar = (l: string) => { const out: string[] = []; let s = l; while (Buffer.byteLength(s) > 74) { let i = 74; while (Buffer.byteLength(s.slice(0, i)) > 74) i--; out.push(s.slice(0, i)); s = ' ' + s.slice(i); } out.push(s); return out.join('\r\n'); };

function evento(o: { uid: string; inicio: string; fin?: string | null; titulo: string; desc?: string; lugar?: string; url?: string }) {
  return [
    'BEGIN:VEVENT', `UID:${o.uid}@eventos.sacscloud.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${fechaIcs(o.inicio)}`, `DTEND;VALUE=DATE:${fechaIcs(masUno(o.fin || o.inicio))}`,
    `SUMMARY:${esc(o.titulo)}`, o.desc ? `DESCRIPTION:${esc(o.desc)}` : '', o.lugar ? `LOCATION:${esc(o.lugar)}` : '', o.url ? `URL:${o.url}` : '',
    'END:VEVENT',
  ].filter(Boolean).map(plegar).join('\r\n');
}

export const GET: APIRoute = async ({ request, url }) => {
  const t = url.searchParams.get('t');
  if (!t) {
    const yo = await quien(request);
    if (!yo) return json({ error: 'sin sesión' }, 401);
    const token = await tokenActual(true);
    return json({ url: `${url.origin}/api/crm/eventos/ical?t=${token}`, webcal: `webcal://${url.host}/api/crm/eventos/ical?t=${token}` });
  }
  const token = await tokenActual(false);
  if (!token || t !== token) return new Response('No encontrado', { status: 404 });

  const desde = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const { data: eds } = await supabase.from('ev_ediciones').select('id, nombre, inicio, fin, ciudad, sede, stand_numero, rol, limite_registro, participacion, url_registro, ev_eventos(nombre, slug, decision)')
    .gte('inicio', desde).in('participacion', ['vamos', 'fuimos', 'sin_decidir']).order('inicio').limit(300);
  const base = `${url.origin}/admin/crm?tab=eventos`;
  const partes: string[] = [];
  const vamosIds: string[] = [];
  for (const e of (eds || []) as any[]) {
    const ev = e.ev_eventos || {};
    const vamos = e.participacion === 'vamos' || e.participacion === 'fuimos';
    // Las que no decidimos entran solo si el evento ya está en "ir" (falta apartar la
    // fecha) — las de "evaluar" solo aportan su fecha límite para apartar, si la hay:
    // con 139 ediciones en el radar, meterlas todas convertía el calendario en ruido.
    if (!vamos && ev.decision === 'no_ir') continue;
    if (vamos) vamosIds.push(e.id);
    const rol = e.rol === 'stand' ? `Stand${e.stand_numero ? ' ' + e.stand_numero : ''}` : e.rol === 'recorrido' ? 'Recorrido' : e.rol === 'visitante' ? 'Visitante' : e.rol === 'patrocinio' ? 'Patrocinio' : '';
    if (vamos || ev.decision === 'ir') partes.push(evento({
      uid: `edicion-${e.id}`, inicio: e.inicio, fin: e.fin,
      titulo: `${vamos ? '' : '(por decidir) '}${ev.nombre || e.nombre}${rol ? ' · ' + rol : ''}`,
      desc: [e.nombre, rol, e.url_registro].filter(Boolean).join('\n'), lugar: [e.sede, e.ciudad].filter(Boolean).join(', '), url: `${base}&edicion=${e.id}`,
    }));
    if (e.limite_registro && e.limite_registro >= desde && e.participacion !== 'fuimos') partes.push(evento({
      uid: `limite-${e.id}`, inicio: e.limite_registro, titulo: `Límite para apartar: ${ev.nombre || e.nombre}`, desc: e.url_registro || '', url: `${base}&edicion=${e.id}`,
    }));
  }
  if (vamosIds.length) {
    const { data: tareas } = await supabase.from('ev_tareas').select('id, titulo, vence, edicion_id, ev_ediciones(nombre)').in('edicion_id', vamosIds).eq('hecha', false).not('vence', 'is', null).gte('vence', desde).limit(500);
    for (const t2 of (tareas || []) as any[]) partes.push(evento({ uid: `tarea-${t2.id}`, inicio: t2.vence, titulo: `${t2.titulo} · ${t2.ev_ediciones?.nombre || ''}`, url: `${base}&edicion=${t2.edicion_id}` }));
  }
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sacscloud//Eventos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ferias y eventos · Sacscloud', 'X-WR-TIMEZONE:America/Mexico_City', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', ...partes, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': 'inline; filename="ferias-sacscloud.ics"' } });
};

export const POST: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (b.accion === 'rotar') { const t = await rotar(); return json({ ok: true, url: `${url.origin}/api/crm/eventos/ical?t=${t}` }); }
  return json({ error: 'acción desconocida' }, 400);
};
