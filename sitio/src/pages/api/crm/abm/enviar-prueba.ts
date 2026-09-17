// Cuentas objetivo · MÁNDAMELA A MÍ: la cadencia entera al buzón de quien la
// pide, para leerla antes de que salga a nadie.
//
// Nació de «me mandas los correos a mi correo para poder revisarlos primero».
// Va por el pipeline real —misma plantilla, misma firma, mismo pie, mismo
// remitente que le tocaría a ese país— pero con categoría `prueba`: no gasta
// cupo del cartero, no cuenta como toque de ninguna cuenta y no arranca
// ninguna cadencia.
//
// Solo a un correo DEL EQUIPO: el de quien lo pide, o el de otro miembro si
// lo indica (revisar en el buzón de pruebas es lo normal). Una ruta que manda
// a donde le digan es una ruta para mandar correo ajeno con nuestro dominio.
//
// `remitente` permite forzar el dominio de salida. Sirve para lo que pasó el
// 17-sep: la primera tanda salió por el dominio recién autenticado —día 1 de
// calentamiento— y Gmail la aceptó pero pudo dejarla en Spam. Reenviar por el
// dominio caliente dice si el problema era el texto o la reputación.
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
  const pedido = limpiar(b.para, 120).toLowerCase();
  const { data: mi } = await supabase.from('team_members').select('email').eq('id', yo.id).maybeSingle();
  let para = String(mi?.email || '').trim();
  if (pedido && pedido !== para.toLowerCase()) {
    const { data: otro } = await supabase.from('team_members').select('email').ilike('email', pedido).maybeSingle();
    if (!otro) return json({ error: 'ese correo no es de nadie del equipo: la revisión solo se manda a los nuestros' }, 403);
    para = otro.email;
  }
  const giro = limpiar(b.giro, 40) || 'novias';
  const pp = paisDe(String(b.pais || 'es'));
  if (!para) return json({ error: 'tu usuario no tiene correo: no sé a dónde mandarla' }, 409);

  // Una cuenta real de ese país para rellenar las variables: así se lee como
  // le va a llegar a un negocio, no con marcadores.
  const { data: c } = await supabase.from('abm_cuentas').select('*')
    .eq('giro', giro).eq('pais', pp.nombre).not('ciudad', 'is', null)
    .order('puntaje', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (!c) return json({ error: 'no hay cuentas de ese país' }, 404);

  const { data: cfg } = await supabase.from('abm_config').select('clave, valor').in('clave', ['tenant_slug', 'tenant_slug_intl']);
  const conf: Record<string, string> = Object.fromEntries((cfg || []).map((r: any) => [r.clave, r.valor]));
  const slug = limpiar(b.remitente, 40) || ((pp.region !== 'mexico' && conf.tenant_slug_intl) ? conf.tenant_slug_intl : conf.tenant_slug);
  const { data: ti } = await supabase.from('email_tenants').select('id').eq('slug', slug).maybeSingle();
  const tenant = ti ? await tenantPorId(ti.id) : null;
  if (!tenant) return json({ error: 'no hay remitente configurado' }, 409);

  const { data: pls } = await supabase.from('abm_plantillas')
    .select('orden, asunto, cuerpo, imagen').eq('giro', giro).eq('canal', 'email').eq('activa', true)
    .eq('region', pp.region).eq('ruta', b.ruta || 'demo').order('orden');
  // Los pasos DE ESA CADENCIA: sin filtrar, cogía los de otra y el asunto de
  // la revisión decía «día 3» donde la cadencia dice día 4.
  const { data: cad } = await supabase.from('abm_cadencias').select('id')
    .eq('giro', giro).eq('region', pp.region).eq('ruta', b.ruta || 'demo').eq('activa', true).maybeSingle();
  const { data: pasos } = await supabase.from('abm_pasos').select('dia, orden, canal')
    .eq('canal', 'email').eq('cadencia_id', cad?.id || '').order('orden');

  const vars = variablesDe(c, null);
  const fotos: Record<string, string> = b.fotos || {};
  const salida: any[] = [];
  for (const p of pls || []) {
    const dia = (pasos || []).find((x: any) => x.orden === Number(p.orden) + 1)?.dia ?? null;
    const cuerpo = rellenar(String(p.cuerpo || ''), vars);
    let html = armarCorreo({
      modo: b.modo === 'tarjeta' ? 'tarjeta' : 'carta',
      preheader: `${dia ? `Día ${dia} · ` : ''}${cuerpo.replace(/\s+/g, ' ').trim().slice(0, 100)}`,
      cuerpo, imagen: b.modo === 'tarjeta' ? p.imagen : null, imagenAlt: p.asunto || '',
      firma: { nombre: (tenant as any).firma_nombre, puesto: (tenant as any).firma_puesto, foto: (tenant as any).firma_foto_url },
      cierre: { giro: c.giro, nombre: c.nombre, pais: c.pais, ruta: c.ruta },
    });
    // Las imágenes todavía no están desplegadas: para la revisión se apunta a
    // la copia pública de cada una.
    for (const [archivo, url] of Object.entries(fotos)) html = html.split(`/images/mail/${archivo}`).join(url);
    /* El asunto va LIMPIO, como saldrá de verdad: el «[día 4]» que le puse a
       la primera revisión se leía como una prueba mal hecha. El día se marca
       en el preheader, que solo se ve en la lista. */
    const asunto = asuntoPais(c.pais, rellenar(String(p.asunto || ''), vars));
    const r = await enviarCorreo({ tenantId: tenant.id, para, categoria: 'prueba', asunto, html, texto: rellenar(String(p.cuerpo || ''), vars), sinRastreo: true });
    salida.push({ orden: p.orden, dia, asunto, enviado: r.enviado, motivo: r.motivo || null });
  }
  return json({ cuenta: c.nombre, ciudad: c.ciudad, remitente: (tenant as any).from_email, correos: salida });
};
