// La liga pública del QR: el visitante se registra solo desde su teléfono.
//
// POST /api/eventos/registro { token, nombre, empresa, whatsapp, email?, giro?, sucursales?, quiere_demo, consentimiento }
// Sin sesión. El token es el de la edición (largo y aleatorio); el resto se limpia y se limita.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { registrar } from '../../../lib/crm/eventos.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

// Freno: un stand recibe decenas por hora, no cientos por minuto. Se cuenta en la
// base y no en memoria porque en Vercel cada invocación puede ser otra instancia —
// un Map en memoria era un freno que no frenaba nada. Y cada registro dispara una
// plantilla de WhatsApp que pagamos, así que el tope es por edición y por hora.
async function permitido(edicionId: string) {
  const desde = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await supabase.from('ev_registros').select('id', { count: 'exact', head: true }).eq('edicion_id', edicionId).eq('modo', 'qr').gte('capturado_at', desde);
  return (count || 0) < 150;
}
/** Versión del aviso que ve la persona en /e/[token]. Súbela si cambia el texto. */
export const AVISO_VERSION = 'qr-2026-09';

export const POST: APIRoute = async ({ request }) => {
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const token = String(b.token || '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  if (token.length < 8) return json({ error: 'liga inválida' }, 400);
  const { data: ed } = await supabase.from('ev_ediciones').select('id, inicio, fin').eq('token_publico', token).maybeSingle();
  if (!ed) return json({ error: 'esta liga ya no está activa' }, 404);
  // La liga vive desde 30 días antes hasta 30 días después del evento: un QR impreso circula.
  const hoy = Date.now(); const ini = Date.parse(ed.inicio); const fin = Date.parse(ed.fin || ed.inicio);
  if (hoy < ini - 45 * 864e5 || hoy > fin + 30 * 864e5) return json({ error: 'el registro de este evento ya cerró' }, 410);
  if (!b.consentimiento) return json({ error: 'necesitamos tu autorización para escribirte' }, 400);
  // Un bot llena el campo escondido; una persona no lo ve. Se contesta «ok» para que no
  // aprenda a saltárselo — pero no se guarda nada.
  if (String(b.sitio_web || '').trim()) return json({ ok: true });
  const dig = String(b.whatsapp || '').replace(/\D/g, '');
  if (dig.length < 10 || dig.length > 13) return json({ error: 'Revisa el WhatsApp: son 10 dígitos.' }, 400);
  if (!String(b.nombre || '').trim()) return json({ error: 'Falta tu nombre.' }, 400);
  if (!(await permitido(ed.id))) return json({ error: 'demasiados registros seguidos; intenta en unos minutos' }, 429);
  const r = await registrar({
    edicion_id: ed.id, modo: 'qr',
    nombre: b.nombre, empresa: b.empresa, whatsapp: b.whatsapp, email: b.email, giro: b.giro, sucursales: b.sucursales,
    ciudad: b.ciudad, instagram: b.instagram, quiere_demo: !!b.quiere_demo, interes: b.interes,
    temperatura: b.quiere_demo ? 'caliente' : 'tibio', consentimiento: true, consentimiento_version: AVISO_VERSION,
    cliente_local_id: String(b.cliente_local_id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || undefined,
  });
  if (!r.ok) return json({ error: r.motivo || 'no se pudo registrar' }, 400);
  return json({ ok: true });
};
