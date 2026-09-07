// La liga pública para apartar cita en el stand ANTES de la feria (punto 3).
//
// GET  /api/eventos/cita?token&dia=YYYY-MM-DD → { dias:[…], huecos:[{hora, libre}] }
// POST /api/eventos/cita { token, dia, hora, nombre, empresa, whatsapp, email?, giro?, nota? }
// Sin sesión: el token es el de la edición (el mismo de la liga del QR). Va en la
// invitación masiva y en redes; quien la abre elige hora y recibe la confirmación
// por WhatsApp. En el CRM aparece en Reuniones y en Citas de la edición.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { huecosDelStand, crearCita } from '../../../lib/crm/eventos-agenda.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

async function edicionPorToken(raw: any) {
  const token = String(raw || '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  if (token.length < 8) return null;
  const { data } = await supabase.from('ev_ediciones').select('id, inicio, fin, participacion, horario_stand').eq('token_publico', token).maybeSingle();
  if (!data || data.participacion !== 'vamos') return null;
  // Se aparta desde 120 días antes; el último día de la feria todavía se puede.
  if (Date.now() > Date.parse(data.fin || data.inicio) + 864e5 || Date.now() < Date.parse(data.inicio) - 120 * 864e5) return null;
  return data;
}
function diasDe(ed: any) {
  const out: string[] = [];
  for (let d = new Date(ed.inicio + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= (ed.fin || ed.inicio); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out.slice(0, 14);
}

export const GET: APIRoute = async ({ url }) => {
  const ed = await edicionPorToken(url.searchParams.get('token'));
  if (!ed) return json({ error: 'esta liga ya no está activa' }, 404);
  const dias = diasDe(ed);
  const dia = url.searchParams.get('dia') || dias[0];
  return json({ dias, dia, huecos: await huecosDelStand(ed.id, dia) });
};

export const POST: APIRoute = async ({ request }) => {
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const ed = await edicionPorToken(b.token);
  if (!ed) return json({ error: 'esta liga ya no está activa' }, 404);
  if (String(b.sitio_web || '').trim()) return json({ ok: true }); // honeypot
  // Freno por edición y por hora, en la base (cada invocación de Vercel puede ser otra instancia).
  const { count } = await supabase.from('ev_citas').select('id', { count: 'exact', head: true }).eq('edicion_id', ed.id).gte('created_at', new Date(Date.now() - 3600e3).toISOString());
  if ((count || 0) >= 60) return json({ error: 'demasiadas citas seguidas; intenta en unos minutos' }, 429);
  const r = await crearCita(ed.id, {
    dia: String(b.dia || ''), hora: String(b.hora || ''), nombre: b.nombre, empresa: b.empresa, whatsapp: b.whatsapp, email: b.email,
    giro: b.giro, nota: String(b.nota || '').slice(0, 300), origen: 'liga',
  }, 'liga', null);
  if (!r.ok) return json({ error: r.motivo || 'no se pudo apartar' }, 400);
  return json({ ok: true, dia: b.dia, hora: b.hora });
};
