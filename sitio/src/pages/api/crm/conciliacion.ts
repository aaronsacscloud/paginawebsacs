// CRM · Cartas de conciliación: crear, enviar y recibir la firma.
//
// POST { accion:'crear',   contact_id, titulo?, cuerpo, monto?, vigencia? } → { ok, id, url }
// POST { accion:'enviar',  id }                                            → { ok, url }
// (firmar / rechazar viven en /api/conciliacion-respuesta — ver nota abajo)
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getSessionFromRequest } from '../../../lib/auth/session';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const BASE = 'https://www.sacscloud.com';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let b: any; try { b = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  const accion = String(b.accion || '');

  /* Firmar y rechazar NO viven aquí: están en /api/conciliacion-respuesta,
     fuera de /api/crm/, porque este prefijo entero exige sesión de admin y
     quien firma es alguien que ya no es cliente. Medido: con las acciones
     públicas aquí dentro, el middleware contestaba «No autenticado» antes de
     llegar al handler y la carta no se podía firmar. */

  /* ══ LO QUE HACE EL EQUIPO ════════════════════════════════════════════════ */
  const user = await getSessionFromRequest(request).catch(() => null);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  if (accion === 'crear') {
    const cuerpo = String(b.cuerpo || '').trim();
    // El cuerpo no tiene plantilla a propósito: cada conciliación es un trato
    // distinto y codificar «la carta» obligaría a un deploy por cada acuerdo.
    if (cuerpo.length < 40) return json({ error: 'Escribe el acuerdo: qué se le ofrece y qué se espera de él' }, 400);
    const { data, error } = await supabase.from('conciliaciones').insert({
      contact_id: b.contact_id || null, company_id: b.company_id || null,
      titulo: String(b.titulo || 'Propuesta de conciliación').slice(0, 160),
      cuerpo, monto: b.monto != null ? Number(b.monto) : null,
      vigencia: /^\d{4}-\d{2}-\d{2}$/.test(String(b.vigencia || '')) ? b.vigencia : null,
      creado_por: (user as any)?.id || null,
    }).select('id, token').maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data!.id, url: `${BASE}/conciliacion/${data!.token}` });
  }

  if (accion === 'enviar') {
    const { data, error } = await supabase.from('conciliaciones')
      .update({ estado: 'enviada', enviada_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', String(b.id || '')).eq('estado', 'borrador').select('token').maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: 'Esa propuesta no está en borrador' }, 409);
    return json({ ok: true, url: `${BASE}/conciliacion/${data.token}` });
  }

  return json({ error: 'Acción desconocida' }, 400);
};
