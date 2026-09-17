// TEMPORAL (17-sep-2026): manda la cadencia completa a un buzón de revisión.
// El dueño quiere leer los once correos en su propio Gmail antes de que salga
// ninguno de verdad. Va por el pipeline real —misma plantilla, misma firma,
// mismo pie— pero con categoría `prueba`: no gasta cupo del cartero, no cuenta
// como toque de ninguna cuenta y no toca la cadencia de nadie.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { armarCorreo } from '../../../../lib/crm/abm-correo';
import { tenantPorId } from '../../../../lib/email/tenant';
import { enviarCorreo } from '../../../../lib/email/pipeline';
import { json, quien, variablesDe, rellenar, limpiar } from '../../../../lib/crm/abm.lib';
import { paisDe, asuntoPais } from '../../../../lib/crm/abm-paises';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const para = limpiar(b.para, 120);
  const giro = limpiar(b.giro, 40) || 'novias';
  const pp = paisDe(String(b.pais || 'es'));
  if (!para) return json({ error: 'falta el correo' }, 400);

  // Una cuenta real de ese país para rellenar las variables: así se lee como
  // le va a llegar a un negocio, no con marcadores.
  const { data: c } = await supabase.from('abm_cuentas').select('*')
    .eq('giro', giro).eq('pais', pp.nombre).not('ciudad', 'is', null)
    .order('puntaje', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (!c) return json({ error: 'no hay cuentas de ese país' }, 404);

  const { data: cfg } = await supabase.from('abm_config').select('clave, valor').in('clave', ['tenant_slug', 'tenant_slug_intl']);
  const conf: Record<string, string> = Object.fromEntries((cfg || []).map((r: any) => [r.clave, r.valor]));
  const slug = (pp.region !== 'mexico' && conf.tenant_slug_intl) ? conf.tenant_slug_intl : conf.tenant_slug;
  const { data: ti } = await supabase.from('email_tenants').select('id').eq('slug', slug).maybeSingle();
  const tenant = ti ? await tenantPorId(ti.id) : null;
  if (!tenant) return json({ error: 'no hay remitente configurado' }, 409);

  const { data: pls } = await supabase.from('abm_plantillas')
    .select('orden, asunto, cuerpo, imagen').eq('giro', giro).eq('canal', 'email').eq('activa', true)
    .eq('region', pp.region).eq('ruta', b.ruta || 'demo').order('orden');
  const { data: pasos } = await supabase.from('abm_pasos').select('dia, orden, canal').eq('canal', 'email').order('orden');

  const vars = variablesDe(c, null);
  const fotos: Record<string, string> = b.fotos || {};
  const salida: any[] = [];
  for (const p of pls || []) {
    const dia = (pasos || []).find((x: any) => x.orden === Number(p.orden) + 1)?.dia ?? null;
    let html = armarCorreo({
      cuerpo: rellenar(String(p.cuerpo || ''), vars), imagen: p.imagen, imagenAlt: p.asunto || '',
      firma: { nombre: (tenant as any).firma_nombre, puesto: (tenant as any).firma_puesto, foto: (tenant as any).firma_foto_url },
      cierre: { giro: c.giro, nombre: c.nombre, pais: c.pais, ruta: c.ruta },
    });
    // Las imágenes todavía no están desplegadas: para la revisión se apunta a
    // la copia pública de cada una.
    for (const [archivo, url] of Object.entries(fotos)) html = html.split(`/images/mail/${archivo}`).join(url);
    const asunto = `[${dia ? `día ${dia}` : `correo ${Number(p.orden) + 1}`}] ${asuntoPais(c.pais, rellenar(String(p.asunto || ''), vars))}`;
    const r = await enviarCorreo({ tenantId: tenant.id, para, categoria: 'prueba', asunto, html, texto: rellenar(String(p.cuerpo || ''), vars), sinRastreo: true });
    salida.push({ orden: p.orden, dia, asunto, enviado: r.enviado, motivo: r.motivo || null });
  }
  return json({ cuenta: c.nombre, ciudad: c.ciudad, remitente: (tenant as any).from_email, correos: salida });
};
