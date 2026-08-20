// /api/crm/email/templates — plantillas por bloques.
//
// El HTML se compila en el SERVIDOR al guardar: así el correo que se manda es
// exactamente el que se validó, y nadie puede inyectar HTML arbitrario desde
// el panel. La vista previa usa el mismo compilador — no una aproximación.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { compilar, compilarTexto, variablesSinRespaldo, pesoKb, LIMITE_GMAIL_KB, VARIABLES, type Bloque } from '../../../../lib/email/plantillas';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/** Plantillas de arranque: mejor punto de partida que una hoja en blanco. */
function prediseñadas(): Array<{ nombre: string; asunto: string; bloques: Bloque[] }> {
  return [
    { nombre: 'Anuncio de novedad', asunto: 'Novedad en tu cuenta',
      bloques: [
        { id: 'a', tipo: 'hero', titulo: 'Algo nuevo para ti', subtitulo: 'Ya está disponible en tu cuenta' },
        { id: 'b', tipo: 'texto', texto: 'Hola {{nombre|}}, te contamos qué cambió y por qué te conviene.' },
        { id: 'c', tipo: 'lista', items: ['El primer beneficio', 'El segundo', 'El tercero'] },
        { id: 'd', tipo: 'boton', texto: 'Ver cómo funciona', href: 'https://www.sacscloud.com' },
        { id: 'e', tipo: 'firma', puesto: 'Equipo SACS Cloud' },
      ] },
    { nombre: 'Recordatorio de renovación', asunto: 'Tu plan se renueva pronto',
      bloques: [
        { id: 'a', tipo: 'encabezado', texto: 'Tu plan {{plan|actual}} se renueva pronto', nivel: 2 },
        { id: 'b', tipo: 'texto', texto: 'Hola {{nombre|}}, te escribimos con tiempo para que no te tome por sorpresa.' },
        { id: 'c', tipo: 'boton', texto: 'Ver mi suscripción', href: 'https://www.sacscloud.com' },
        { id: 'd', tipo: 'firma', puesto: 'Equipo SACS Cloud' },
      ] },
    { nombre: 'Invitación a demo', asunto: '¿15 minutos para verlo funcionando?',
      bloques: [
        { id: 'a', tipo: 'texto', texto: 'Hola {{nombre|}}, vi que te interesó SACS para {{empresa|tu negocio}}.' },
        { id: 'b', tipo: 'texto', texto: 'Te propongo 15 minutos: te lo enseño con tus propios números y decides.' },
        { id: 'c', tipo: 'boton', texto: 'Agendar 15 minutos', href: 'https://www.sacscloud.com/agendar/demo' },
        { id: 'd', tipo: 'cita', texto: 'En dos semanas dejamos de perder ventas por quedarnos sin stock.', autor: 'Un cliente real' },
        { id: 'e', tipo: 'firma', puesto: 'SACS Cloud' },
      ] },
  ];
}

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);

  if (url.searchParams.get('prediseñadas') === '1' || url.searchParams.get('predisenadas') === '1') {
    return json({ prediseñadas: prediseñadas(), variables: VARIABLES });
  }

  const id = url.searchParams.get('id');
  if (id) {
    const { data } = await supabase.from('email_templates').select('*').eq('id', id).eq('tenant_id', t.id).maybeSingle();
    if (!data) return json({ error: 'No existe esa plantilla.' }, 404);
    return json({ plantilla: data, variables: VARIABLES });
  }

  const { data } = await supabase.from('email_templates').select('id, nombre, asunto, categoria, updated_at')
    .eq('tenant_id', t.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(200);
  return json({ plantillas: data || [], variables: VARIABLES });
};

/** Compila y valida: una sola función para crear, actualizar y previsualizar. */
function preparar(bloques: Bloque[], t: any, ctxDemo = true) {
  const ctx = ctxDemo ? { nombre: 'Ana', apellido: 'Pérez', empresa: 'Boutique Ejemplo', plan: 'Plan Controla' } : {};
  const html = compilar(bloques, ctx, t);
  const texto = compilarTexto(bloques, ctx);
  const peso = pesoKb(html);
  const sinRespaldo = variablesSinRespaldo(bloques);
  const avisos: string[] = [];
  if (peso >= LIMITE_GMAIL_KB) avisos.push(`El correo pesa ${peso} KB. Gmail recorta arriba de ${LIMITE_GMAIL_KB} KB y se lleva el link de baja con él.`);
  if (sinRespaldo.length) avisos.push(`Estas variables no tienen respaldo: ${sinRespaldo.join(', ')}. A quien no tenga ese dato le llegará un hueco.`);
  if (!bloques.length) avisos.push('La plantilla está vacía.');
  return { html, texto, peso, sinRespaldo, avisos };
}

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  const bloques = (body.bloques || []) as Bloque[];

  // Vista previa: compila sin guardar.
  if (body.preview) return json(preparar(bloques, t));

  if (!body?.nombre?.trim()) return json({ error: 'Ponle nombre a la plantilla.' }, 400);
  const p = preparar(bloques, t);
  const { data, error } = await supabase.from('email_templates').insert({
    tenant_id: t.id, nombre: body.nombre.trim(), asunto: body.asunto || null,
    preview_text: body.preview_text || null, bloques,
    html_compilado: p.html, texto_plano: p.texto, categoria: body.categoria || null,
  }).select().single();
  if (error) {
    if (/duplicate|23505/i.test(error.message)) return json({ error: 'Ya tienes una plantilla con ese nombre.' }, 400);
    return json({ error: error.message }, 500);
  }
  return json({ plantilla: data, avisos: p.avisos }, 201);
};

export const PUT: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  if (!body?.id) return json({ error: 'Falta el id.' }, 400);

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of ['nombre', 'asunto', 'preview_text', 'categoria']) if (k in body) updates[k] = body[k];
  let avisos: string[] = [];
  if (body.bloques) {
    const p = preparar(body.bloques as Bloque[], t);
    updates.bloques = body.bloques; updates.html_compilado = p.html; updates.texto_plano = p.texto;
    avisos = p.avisos;
  }
  const { data, error } = await supabase.from('email_templates')
    .update(updates).eq('id', body.id).eq('tenant_id', t.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ plantilla: data, avisos });
};

export const DELETE: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  const id = url.searchParams.get('id');
  if (!t || !id) return json({ error: 'Falta el id.' }, 400);
  // Archivar: una campaña vieja la referencia y su reporte debe seguir vivo.
  await supabase.from('email_templates').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', t.id);
  return json({ ok: true });
};
