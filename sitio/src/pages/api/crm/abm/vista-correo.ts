// Cuentas objetivo · VER CÓMO LLEGA: el HTML exacto de un correo antes de
// mandarlo — la plantilla armada (imagen, cuerpo, bloque de cierre con su
// botón y su enlace, firma de quien escribe) más el pie legal del pipeline.
//
// Existe porque para enseñarle al dueño cómo se veía el primer correo de
// España hubo que montar una ruta a mano: se revisaba el TEXTO, nunca el
// correo. Y ahí aparecieron dos cosas que el texto no enseña: el pie decía
// «Demos en línea» cuando la cadencia ofrece media hora de consultoría, y la
// firma no salía por ningún lado.
//
// POST { cuenta, asunto, cuerpo, imagen? } → { asunto, html }
// El cuerpo puede traer {{variables}} y [[si …]]: se rellenan con los datos
// REALES de esa cuenta, que es como se va a mandar.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { armarCorreo } from '../../../../lib/crm/abm-correo';
import { footerHtml } from '../../../../lib/email/footer';
import { tenantPorId } from '../../../../lib/email/tenant';
import { json, quien, variablesDe, rellenar } from '../../../../lib/crm/abm.lib';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const { data: c } = await supabase.from('abm_cuentas').select('*').eq('nombre', b.cuenta).maybeSingle();
  if (!c) return json({ error: 'no existe esa cuenta' }, 404);
  const vars = variablesDe(c, null);
  const cuerpo = rellenar(String(b.cuerpo || ''), vars);
  // El remitente que le tocaría a esa cuenta: el internacional si no es de
  // México. Así la vista previa enseña la firma y el pie que va a llevar.
  const { data: cfg } = await supabase.from('abm_config').select('clave, valor').in('clave', ['tenant_slug', 'tenant_slug_intl']);
  const conf: Record<string, string> = Object.fromEntries((cfg || []).map((r: any) => [r.clave, r.valor]));
  const slug = (String(c.pais || 'México') !== 'México' && conf.tenant_slug_intl) ? conf.tenant_slug_intl : conf.tenant_slug;
  const { data: ti } = await supabase.from('email_tenants').select('id').eq('slug', slug).maybeSingle();
  const tenant = ti ? await tenantPorId(ti.id) : null;
  const html = armarCorreo({
    cuerpo, imagen: b.imagen, imagenAlt: b.asunto || '',
    firma: tenant ? { nombre: (tenant as any).firma_nombre, puesto: (tenant as any).firma_puesto, foto: (tenant as any).firma_foto_url } : null,
    cierre: { giro: c.giro, nombre: c.nombre, pais: c.pais, ruta: c.ruta },
  }) + (tenant ? footerHtml(tenant as any, 'https://www.sacscloud.com', 'TOKEN-DE-EJEMPLO', 'abm') : '');
  return new Response(JSON.stringify({ asunto: rellenar(String(b.asunto || ''), vars), html }), { headers: { 'Content-Type': 'application/json' } });
};
