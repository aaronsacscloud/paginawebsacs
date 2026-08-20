// /api/crm/email/campaigns — campañas.
//
// GET             lista · GET ?id= detalle con resumen fresco
// POST            crea · PUT actualiza · POST ?accion=… opera
// acciones: revisar | programar | enviar | pausar | reanudar | cancelar | prueba
//
// "Enviar ahora" NO envía en este request: programa para dentro de 5 minutos y
// deja que el cron lo tome. Dos razones y las dos importan: la función
// serverless moriría a mitad de una campaña grande, y esos 5 minutos son la
// ventana para arrepentirse — el "deshacer" que ninguna herramienta da bien.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { revisarAudiencia, materializar, refrescarResumen, dentroDeVentana, type Campana } from '../../../../lib/email/campanas';
import { compilar, compilarTexto, variablesSinRespaldo, pesoKb, LIMITE_GMAIL_KB, type Bloque } from '../../../../lib/email/plantillas';
import { enviarCorreo } from '../../../../lib/email/pipeline';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/** Minutos de gracia antes de que salga una campaña "enviada ahora". */
const GRACIA_MIN = 5;

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const id = url.searchParams.get('id');

  if (id) {
    const { data: c } = await supabase.from('email_campaigns').select('*').eq('id', id).eq('tenant_id', t.id).maybeSingle();
    if (!c) return json({ error: 'No existe esa campaña.' }, 404);
    const resumen = await refrescarResumen(c.id);
    const { data: dest } = await supabase.from('email_campaign_recipients')
      .select('email, estado, motivo').eq('campaign_id', c.id).order('procesado_at', { ascending: false }).limit(200);
    return json({ campana: { ...c, resumen }, destinatarios: dest || [] });
  }

  const { data } = await supabase.from('email_campaigns').select('*')
    .eq('tenant_id', t.id).order('created_at', { ascending: false }).limit(100);
  return json({ campanas: data || [] });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  const accion = url.searchParams.get('accion') || body.accion;

  if (!accion) {
    if (!body?.nombre?.trim()) return json({ error: 'Ponle nombre a la campaña.' }, 400);
    const { data, error } = await supabase.from('email_campaigns').insert({
      tenant_id: t.id, nombre: body.nombre.trim(),
      categoria: body.categoria === 'relacion' ? 'relacion' : 'marketing',
    }).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ campana: data }, 201);
  }

  const { data: c } = await supabase.from('email_campaigns').select('*').eq('id', body.id).eq('tenant_id', t.id).maybeSingle();
  if (!c) return json({ error: 'No existe esa campaña.' }, 404);

  // ── revisar: el checklist previo al envío ──────────────────────────────
  if (accion === 'revisar') {
    const revision = await revisarAudiencia(t, c as Campana);
    const { data: tpl } = c.template_id
      ? await supabase.from('email_templates').select('bloques').eq('id', c.template_id).maybeSingle()
      : { data: null as any };
    const bloques = (tpl?.bloques || []) as Bloque[];
    const html = compilar(bloques, { nombre: 'Ejemplo', empresa: 'Empresa Ejemplo' }, t);
    const peso = pesoKb(html);
    const sinRespaldo = variablesSinRespaldo(bloques);

    const { count: pruebas } = await supabase.from('email_sends')
      .select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('categoria', 'prueba')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const checks = [
      { id: 'asunto', ok: !!c.asunto?.trim(), texto: 'Asunto escrito' },
      { id: 'preview', ok: !!c.preview_text?.trim(), texto: 'Texto de vista previa', aviso: true },
      { id: 'contenido', ok: bloques.length > 0, texto: 'Contenido del correo' },
      { id: 'audiencia', ok: revision.alcanzables > 0, texto: `${revision.alcanzables} personas lo recibirán` },
      { id: 'variables', ok: sinRespaldo.length === 0, texto: sinRespaldo.length ? `Variables sin respaldo: ${sinRespaldo.join(', ')} — dirían "Hola ," a quien no tenga ese dato` : 'Variables con respaldo' },
      { id: 'peso', ok: peso < LIMITE_GMAIL_KB, texto: `${peso} KB de ${LIMITE_GMAIL_KB} KB (Gmail recorta arriba de eso y se lleva el link de baja)` },
      { id: 'prueba', ok: (pruebas || 0) > 0, texto: 'Enviaste una prueba a tu correo', aviso: true },
      { id: 'ventana', ok: true, texto: dentroDeVentana(t) ? 'Estamos dentro de tu horario de envío' : `Fuera de horario (${t.ventana_inicio}–${t.ventana_fin}): saldrá cuando abra` },
    ];
    const bloqueantes = checks.filter(k => !k.ok && !k.aviso);
    return json({ revision, checks, listo: bloqueantes.length === 0, peso_kb: peso });
  }

  // ── prueba: a mi propio correo, sin candados de audiencia ──────────────
  if (accion === 'prueba') {
    const destino = String(body.para || '').trim();
    if (!destino) return json({ error: '¿A qué correo la mando?' }, 400);
    const { data: tpl } = c.template_id
      ? await supabase.from('email_templates').select('bloques').eq('id', c.template_id).maybeSingle()
      : { data: null as any };
    const bloques = (tpl?.bloques || []) as Bloque[];
    const ctx = { nombre: 'Ejemplo', empresa: 'Empresa Ejemplo', plan: 'Plan Ejemplo' };
    const r = await enviarCorreo({
      tenantId: t.id, para: destino, categoria: 'prueba',
      asunto: `[PRUEBA] ${c.asunto || c.nombre}`,
      html: compilar(bloques, ctx, t), texto: compilarTexto(bloques, ctx), templateId: c.template_id,
    });
    return json(r, r.enviado ? 200 : 400);
  }

  // ── programar / enviar ────────────────────────────────────────────────
  if (accion === 'programar' || accion === 'enviar') {
    if (!['borrador', 'programada', 'pausada'].includes(c.estado)) {
      return json({ error: `Una campaña ${c.estado} no se puede programar.` }, 400);
    }
    const revision = await revisarAudiencia(t, c as Campana);
    if (revision.alcanzables === 0) return json({ error: 'Nadie recibiría esta campaña. Revisa la audiencia.' }, 400);
    if (!c.asunto?.trim()) return json({ error: 'Falta el asunto.' }, 400);

    const cuando = accion === 'enviar'
      ? new Date(Date.now() + GRACIA_MIN * 60000).toISOString()
      : new Date(String(body.programada_para)).toISOString();
    if (accion === 'programar' && (!body.programada_para || isNaN(Date.parse(body.programada_para)))) {
      return json({ error: '¿Para cuándo la programo?' }, 400);
    }

    await materializar(t, c as Campana);
    const { data } = await supabase.from('email_campaigns')
      .update({ estado: 'programada', programada_para: cuando, pausa_motivo: null })
      .eq('id', c.id).select().single();
    return json({ campana: data, sale_en: cuando, gracia_min: accion === 'enviar' ? GRACIA_MIN : 0 });
  }

  if (accion === 'pausar') {
    const { data } = await supabase.from('email_campaigns')
      .update({ estado: 'pausada', pausa_motivo: body.motivo || 'Pausada a mano' })
      .eq('id', c.id).in('estado', ['programada', 'enviando']).select().maybeSingle();
    return json({ campana: data, ok: !!data });
  }
  if (accion === 'reanudar') {
    const { data } = await supabase.from('email_campaigns')
      .update({ estado: c.materializada_at ? 'enviando' : 'programada', pausa_motivo: null })
      .eq('id', c.id).eq('estado', 'pausada').select().maybeSingle();
    return json({ campana: data, ok: !!data });
  }
  if (accion === 'cancelar') {
    const { data } = await supabase.from('email_campaigns')
      .update({ estado: 'cancelada' }).eq('id', c.id)
      .in('estado', ['borrador', 'programada', 'pausada']).select().maybeSingle();
    if (data) {
      await supabase.from('email_campaign_recipients')
        .update({ estado: 'rechazado', motivo: 'campaña cancelada' })
        .eq('campaign_id', c.id).eq('estado', 'pendiente');
    }
    return json({ campana: data, ok: !!data });
  }

  return json({ error: 'Acción desconocida.' }, 400);
};

export const PUT: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  if (!body?.id) return json({ error: 'Falta el id.' }, 400);

  const { data: c } = await supabase.from('email_campaigns').select('estado').eq('id', body.id).eq('tenant_id', t.id).maybeSingle();
  if (!c) return json({ error: 'No existe esa campaña.' }, 404);
  // Una campaña que ya salió no se edita: su reporte dejaría de describir lo
  // que la gente recibió.
  if (['enviando', 'completada', 'cancelada'].includes(c.estado)) {
    return json({ error: `Una campaña ${c.estado} ya no se puede editar.` }, 400);
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of ['nombre', 'asunto', 'asunto_b', 'preview_text', 'template_id', 'categoria',
                   'origen_tipo', 'origen_id', 'contact_ids', 'utm_campaign']) {
    if (k in body) updates[k] = body[k];
  }
  // Cambiar la audiencia invalida la materialización previa.
  if ('origen_tipo' in body || 'origen_id' in body || 'contact_ids' in body) {
    updates.materializada_at = null;
    await supabase.from('email_campaign_recipients').delete().eq('campaign_id', body.id).eq('estado', 'pendiente');
  }
  const { data, error } = await supabase.from('email_campaigns').update(updates).eq('id', body.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ campana: data });
};
