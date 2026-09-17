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
// POST { pais, giro, cadencia_id }        → el correo 1 de esa cadencia, con una cuenta real de ese país
// POST { cuenta, asunto, cuerpo, imagen? } → un texto suelto contra esa cuenta
// El cuerpo puede traer {{variables}} y [[si …]]: se rellenan con los datos
// REALES de esa cuenta, que es como se va a mandar.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { armarCorreo } from '../../../../lib/crm/abm-correo';
import { footerHtml } from '../../../../lib/email/footer';
import { tenantPorId } from '../../../../lib/email/tenant';
import { json, quien, variablesDe, rellenar, limpiar } from '../../../../lib/crm/abm.lib';
import { paisDe, asuntoPais } from '../../../../lib/crm/abm-paises';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b = await request.json().catch(() => ({} as any));
  /* Dos formas de pedirlo: por CUENTA con un texto suelto (para probar una
     redacción antes de montarla) o por PAÍS, que toma la primera plantilla de
     su cadencia y la mejor cuenta real de ese país — que es lo que se quiere
     ver antes de lanzar. */
  const porPais = !b.cuenta && b.pais;
  const pp = porPais ? paisDe(String(b.pais)) : null;
  const q = supabase.from('abm_cuentas').select('*');
  const { data: c } = porPais
    ? await q.eq('giro', limpiar(b.giro, 40) || 'novias').eq('pais', pp!.nombre).not('ciudad', 'is', null)
        .order('puntaje', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    : await q.eq('nombre', b.cuenta).maybeSingle();
  if (!c) return json({ error: porPais ? 'no hay ninguna cuenta de ese país para la vista' : 'no existe esa cuenta' }, 404);

  if (porPais) {
    const { data: cad } = b.cadencia_id
      ? await supabase.from('abm_cadencias').select('id, ruta, region').eq('id', b.cadencia_id).maybeSingle()
      : await supabase.from('abm_cadencias').select('id, ruta, region').eq('giro', c.giro).eq('region', pp!.region).eq('ruta', c.ruta || 'demo').eq('activa', true).maybeSingle();
    const { data: pl } = await supabase.from('abm_plantillas')
      .select('asunto, cuerpo, imagen').eq('giro', c.giro).eq('canal', 'email').eq('activa', true)
      .eq('region', cad?.region || pp!.region).eq('ruta', cad?.ruta || 'demo').order('orden').limit(1).maybeSingle();
    if (!pl) return json({ error: `todavía no hay plantillas escritas para ${pp!.nombre}` }, 404);
    b = { ...b, asunto: pl.asunto, cuerpo: pl.cuerpo, imagen: pl.imagen };
  }
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
  return new Response(JSON.stringify({ asunto: asuntoPais(c.pais, rellenar(String(b.asunto || ''), vars)), html }), { headers: { 'Content-Type': 'application/json' } });
};
