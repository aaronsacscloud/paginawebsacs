// ENVIAR LA MINUTA PARA FIRMA (dueño, 12-oct-2026): «quiero enviar el link para
// que puedan firmar la minuta a los clientes».
//
// GET  ?id=<booking>            → si se firma, quién firmó y cuándo, los envíos.
// POST { id, canal, para }      → deja el envío en la bitácora de la cuenta.
//
// El envío vive en `activities` (como la firma y los «de acuerdo», ver
// minuta-revision.ts): sale en la Actividad del cliente y no pide columnas
// nuevas. Lo que se manda es la liga pública /minuta/<id>; el mensaje lo abre
// el navegador del consultor (WhatsApp o su correo), aquí no se envía nada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { esConsultoria } from '../../../lib/crm/reuniones';
import { leerRevisionMinuta, registrarMinuta } from '../../../lib/crm/minuta-revision';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const CANALES = ['whatsapp', 'correo', 'liga'];

async function reunion(id: string) {
  const { data } = await supabase.from('bookings')
    .select('id, company_id, minuta, event_types(categoria)').eq('id', id).maybeSingle();
  return data as any;
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await getCurrentUser(request))) return json({ error: 'Sin sesión' }, 401);
  const id = String(url.searchParams.get('id') || '');
  if (!UUID.test(id)) return json({ error: 'id inválido' }, 400);
  const b = await reunion(id);
  if (!b) return json({ error: 'No existe la reunión' }, 404);
  const firmable = esConsultoria(b.event_types?.categoria) && b.minuta?.firma !== false;
  const rv = firmable ? await leerRevisionMinuta(id) : null;
  const { data: env } = await supabase.from('activities').select('created_at, metadata')
    .eq('tipo', 'minuta_enviada').eq('metadata->>booking_id', id).order('created_at', { ascending: false }).limit(20);
  return json({
    firmable,
    revisados: rv ? Object.keys(rv.revisados || {}).length : 0,
    firma: rv?.firma ? { nombre: rv.firma.nombre, at: rv.firma.at } : null,
    envios: (env || []).map((e: any) => ({ at: e.created_at, canal: e.metadata?.canal, para: e.metadata?.para || null, por: e.metadata?.por || null })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user: any = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const body = await request.json().catch(() => ({} as any));
  const id = String(body?.id || '');
  const canal = String(body?.canal || '');
  const para = String(body?.para || '').trim().slice(0, 160) || null;
  if (!UUID.test(id) || !CANALES.includes(canal)) return json({ error: 'Petición inválida' }, 400);
  const b = await reunion(id);
  if (!b) return json({ error: 'No existe la reunión' }, 404);
  const por = user.nombre || user.name || user.email || null;
  const como = canal === 'whatsapp' ? 'por WhatsApp' : canal === 'correo' ? 'por correo' : '(liga copiada)';
  const { error } = await registrarMinuta({
    tipo: 'minuta_enviada', bookingId: id, companyId: b.company_id || null,
    titulo: `Minuta enviada para firma ${como}${para ? ` a ${para}` : ''}`,
    metadata: { canal, para, por },
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
