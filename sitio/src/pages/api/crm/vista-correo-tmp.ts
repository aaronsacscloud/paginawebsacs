// TEMPORAL (16-sep-2026): devuelve el HTML EXACTO del correo que saldría para
// una cuenta, armado igual que el cron (armarCorreo + pie del pipeline).
// Genera la cadencia con IA, toma el toque pedido, y borra los borradores.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { armarCorreo } from '../../../lib/crm/abm-correo';
import { footerHtml } from '../../../lib/email/footer';
import { tenantPorId } from '../../../lib/email/tenant';
import { json, quien } from '../../../lib/crm/abm.lib';
import { generarCadencia } from '../../../lib/crm/abm-generar';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const { data: c } = await supabase.from('abm_cuentas').select('*').eq('nombre', b.nombre).maybeSingle();
  if (!c) return json({ error: 'no existe esa cuenta' }, 404);
  const r: any = await generarCadencia(c.id, { autor: yo.nombre, con_ia: true });
  const { data: toques } = await supabase.from('abm_toques')
    .select('id, asunto, cuerpo, imagen, boton_texto, boton_url, canal, programado_at')
    .eq('cuenta_id', c.id).eq('canal', 'email').order('programado_at');
  const t = (toques || [])[Number(b.n || 1) - 1];
  if (!t) return json({ error: 'no se generó', detalle: r?.error || r?.ia_error }, 500);
  const { data: ti } = await supabase.from('email_tenants').select('id').eq('slug', 'sacs-intl').maybeSingle();
  const tenant = ti ? await tenantPorId(ti.id) : null;
  const cierre = { giro: c.giro, nombre: c.nombre, pais: c.pais, ruta: c.ruta };
  const html = armarCorreo({ cuerpo: t.cuerpo || '', imagen: (t as any).imagen, imagenAlt: t.asunto || '',
                             botonTexto: (t as any).boton_texto, botonUrl: (t as any).boton_url, cierre })
    + (tenant ? footerHtml(tenant as any, 'https://www.sacscloud.com', 'TOKEN-DE-EJEMPLO', 'abm') : '');
  await supabase.from('abm_toques').delete().eq('cuenta_id', c.id).eq('estado', 'borrador');
  return new Response(JSON.stringify({ asunto: t.asunto, con_ia: r?.con_ia, ia_error: r?.ia_error || null, html }), { headers: { 'Content-Type': 'application/json' } });
};
