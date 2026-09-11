// TELEFONÍA · Caller ID: qué número ve el cliente (Configuración → Telefonía).
//
// GET  → { actual, twilio, verificados[] }
// POST { accion: 'verificar', telefono }  → Twilio llama a ese número y aquí
//                                            se devuelve el código a teclear.
// POST { accion: 'usar', telefono | null } → guarda el remitente (debe estar
//                                            verificado o ser el de Twilio).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { NUMERO, telefoniaConfigurada } from '../../../../lib/telefonia/twilio';
import { callerIdSaliente, callerIdsVerificados, pedirVerificacion, olvidarCallerId } from '../../../../lib/telefonia/caller-id';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (!telefoniaConfigurada()) return json({ actual: null, twilio: NUMERO || null, verificados: [], error: 'Telefonía sin configurar' });
  let verificados: any[] = [];
  try { verificados = await callerIdsVerificados(); } catch { /* sin permiso */ }
  return json({ actual: await callerIdSaliente(), twilio: NUMERO, verificados });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  if (user.role !== 'founder') return json({ error: 'Solo el dueño puede cambiar el número que ve el cliente' }, 403);
  if (!telefoniaConfigurada()) return json({ error: 'Telefonía sin configurar' }, 503);
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b.accion || '');
  try {
    if (accion === 'verificar') {
      const tel = telefonoWhatsApp(String(b.telefono || ''));
      if (!tel) return json({ error: 'Ese teléfono no es válido' }, 400);
      const r = await pedirVerificacion(tel, String(b.nombre || 'Sacscloud ventas').slice(0, 60));
      return json({ ok: true, ...r });
    }
    if (accion === 'usar') {
      const tel = b.telefono ? telefonoWhatsApp(String(b.telefono)) : null;
      if (tel && tel !== NUMERO) {
        const lista = await callerIdsVerificados();
        if (!lista.some(v => v.telefono === tel)) return json({ error: 'Ese número todavía no está verificado en Twilio' }, 409);
      }
      await supabase.from('wa_config').upsert({ id: 1, tel_caller_id: tel });
      olvidarCallerId();
      return json({ ok: true, actual: tel || NUMERO });
    }
    return json({ error: 'Acción desconocida' }, 400);
  } catch (e: any) {
    return json({ error: e?.message || 'Twilio no respondió' }, 502);
  }
};
