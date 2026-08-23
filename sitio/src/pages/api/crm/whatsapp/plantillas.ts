// WHATSAPP · Plantillas de Meta, creadas y consultadas desde el CRM vía Kapso.
//
// GET  → sincroniza el catálogo desde Meta (upsert por nombre+idioma; los
//        PENDING se refrescan a APPROVED/REJECTED con su motivo) y lo devuelve.
// POST {nombre, idioma, categoria, cuerpo, header?, footer?} → crea en Meta.
// POST {accion:'probar', nombre, idioma, telefono, params[]} → envío real.
//
// ── Reglas de Meta (aprendidas a golpes en el sacs_inbox viejo) ──
// - Las variables son {{1}},{{2}}… POSICIONALES y ASCENDENTES en el texto:
//   {{2}} sin {{1}} antes = rechazo al crear.
// - Un parámetro VACÍO al enviar es 400: se sustituye por "—".
// - Saltos de línea, tabs o >4 espacios en un parámetro también son 400.
// - Una plantilla aprobada NO se edita ("already exists"): se versiona el
//   nombre (_v2) y la vieja se deja morir sola.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { listarPlantillasMeta, crearPlantillaMeta, borrarPlantillaMeta, ingestarHandle, enviarPlantilla, sanearParam, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { notificar } from '../../../../lib/crm/notificaciones';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { explicarError } from '../../../../lib/whatsapp/errores';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** ¿Los {{n}} del cuerpo son 1..N, ascendentes por primera aparición? */
function validarVariables(cuerpo: string): { ok: boolean; n: number; error?: string } {
  const vistos: number[] = [];
  for (const m of cuerpo.matchAll(/\{\{(\d+)\}\}/g)) {
    const n = Number(m[1]);
    if (!vistos.includes(n)) vistos.push(n);
  }
  for (let i = 0; i < vistos.length; i++) {
    if (vistos[i] !== i + 1) {
      return { ok: false, n: vistos.length, error: `Las variables deben ser {{1}}, {{2}}… en orden: encontré {{${vistos[i]}}} donde tocaba {{${i + 1}}}` };
    }
  }
  return { ok: true, n: vistos.length };
}

const textoDe = (componentes: any[], tipo: string) =>
  (componentes || []).find((c: any) => String(c.type).toUpperCase() === tipo)?.text || null;

const MOTIVO_RECHAZO: Record<string, string> = {
  INVALID_FORMAT: 'Formato inválido: faltan ejemplos de las variables, hay variables mal numeradas o saltos/espacios raros.',
  ABUSIVE_CONTENT: 'Contenido abusivo o engañoso según las políticas de Meta.',
  INCORRECT_CATEGORY: 'La categoría no corresponde al contenido (p. ej. marketing marcado como utilidad).',
  SCAM: 'Meta lo consideró posible fraude o phishing.',
  TAG_CONTENT_MISMATCH: 'El contenido no coincide con la categoría elegida.',
  NONE: '',
};
export const motivoRechazoLegible = (m?: string | null) => (m && MOTIVO_RECHAZO[m] !== undefined) ? MOTIVO_RECHAZO[m] : (m || '');

/** Sincroniza Meta → espejo; avisa por la campana cuando una plantilla cambia de estado o la pausan. */
export async function sincronizarPlantillas(): Promise<{ cambios: { nombre: string; de: string | null; a: string }[] }> {
  const enMeta = await listarPlantillasMeta();
  const { data: previas } = await supabase.from('wa_plantillas').select('nombre, idioma, status, calidad');
  const cambios: { nombre: string; de: string | null; a: string }[] = [];
  for (const t of enMeta) {
    const prev = (previas || []).find(p => p.nombre === t.name && p.idioma === t.language);
    const calidad = t.quality_score?.score || null;
    const header = (t.components || []).find((c: any) => String(c.type).toUpperCase() === 'HEADER');
    const botones = (t.components || []).find((c: any) => String(c.type).toUpperCase() === 'BUTTONS')?.buttons || null;
    await supabase.from('wa_plantillas').upsert({
      meta_template_id: t.id ? String(t.id) : null,
      nombre: t.name, idioma: t.language,
      categoria: t.category || 'UTILITY',
      cuerpo: textoDe(t.components, 'BODY') || (t.category === 'AUTHENTICATION' ? '{{1}} es tu código de verificación.' : ''),
      header: header?.format === 'TEXT' ? header.text : null,
      header_tipo: header?.format || 'TEXT',
      footer: textoDe(t.components, 'FOOTER'),
      botones: botones ? botones.map((b: any) => ({ tipo: b.type, texto: b.text || '', url: b.url || null, telefono: b.phone_number || null })) : null,
      variables: t.category === 'AUTHENTICATION' ? 1 : validarVariables(textoDe(t.components, 'BODY') || '').n,
      status: t.status || 'PENDING',
      rechazo_motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
      calidad, calidad_at: t.quality_score?.date ? new Date(t.quality_score.date * 1000).toISOString() : null,
      ...(prev && prev.status !== t.status ? { status_at: new Date().toISOString() } : {}),
      tipo_especial: t.category === 'AUTHENTICATION' ? 'otp' : null,
    }, { onConflict: 'nombre,idioma' });
    if (prev && prev.status !== t.status) {
      cambios.push({ nombre: t.name, de: prev.status, a: t.status });
      const motivo = t.status === 'REJECTED' ? ` — ${motivoRechazoLegible(t.rejected_reason) || 'sin motivo de Meta'}` : '';
      await notificar({
        clave: `wa_tpl_${t.name}_${t.language}_${t.status}`, tipo: 'wa_plantilla', destino: 'wa-plantillas',
        titulo: `Plantilla "${t.name}": ${t.status === 'APPROVED' ? 'aprobada por Meta' : t.status === 'REJECTED' ? 'RECHAZADA por Meta' : t.status === 'PAUSED' ? 'PAUSADA por baja calidad' : t.status}${motivo}`,
        metadata: { plantilla: t.name, idioma: t.language, status: t.status, motivo: t.rejected_reason || null },
      });
    }
    if (prev && calidad && prev.calidad !== calidad && (calidad === 'RED' || calidad === 'YELLOW')) {
      await notificar({ clave: `wa_tpl_calidad_${t.name}_${calidad}_${new Date().toISOString().slice(0, 10)}`, tipo: 'wa_plantilla', destino: 'wa-plantillas',
        titulo: `Calidad de la plantilla "${t.name}" bajó a ${calidad === 'RED' ? 'ROJA (riesgo de pausa)' : 'amarilla'}`, metadata: { plantilla: t.name, calidad } });
    }
  }
  return { cambios };
}

export const GET: APIRoute = async () => {
  try {
    await sincronizarPlantillas();
  } catch (e: any) {
    // Sin Kapso configurado igual se enseña lo que hay en el espejo.
    const { data } = await supabase.from('wa_plantillas').select('*').order('created_at', { ascending: false });
    return json({ plantillas: data || [], sync_error: e instanceof KapsoError ? e.message : String(e) });
  }
  const { data } = await supabase.from('wa_plantillas').select('*').order('created_at', { ascending: false });
  return json({ plantillas: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));

  if (b.accion === 'probar') {
    const tel = telefonoWhatsApp(b.telefono);
    if (!tel) return json({ error: `Teléfono no utilizable para WhatsApp: ${b.telefono || '(vacío)'}` }, 400);
    try {
      const r = await enviarPlantilla(tel, String(b.nombre || ''), String(b.idioma || 'es_MX'),
        (Array.isArray(b.params) ? b.params : []).map(sanearParam));
      return json({ ok: true, message_id: r?.messages?.[0]?.id || null });
    } catch (e: any) {
      { const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined); return json({ error: `${x.titulo}. ${x.que_hacer}`, error_detalle: x }, 502); }
    }
  }

  // Crear
  const nombre = String(b.nombre || '').trim().toLowerCase();
  const idioma = String(b.idioma || 'es_MX').trim();
  const categoria = String(b.categoria || 'UTILITY').toUpperCase();
  const esAuth = categoria === 'AUTHENTICATION';
  const cuerpo = esAuth ? '{{1}} es tu código de verificación.' : String(b.cuerpo || '').trim();
  if (!/^[a-z0-9_]{1,512}$/.test(nombre)) return json({ error: 'El nombre solo admite minúsculas, números y guión bajo' }, 400);
  if (!cuerpo) return json({ error: 'Falta el cuerpo' }, 400);
  const headerTipo = String(b.header_tipo || 'TEXT').toUpperCase();
  if (!['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerTipo)) return json({ error: 'Tipo de encabezado inválido' }, 400);
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerTipo) && !b.header_media_url) return json({ error: 'El encabezado de media necesita una URL pública del archivo de muestra' }, 400);
  if (!['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(categoria)) return json({ error: 'Categoría inválida' }, 400);
  const vars = validarVariables(cuerpo);
  if (!vars.ok) return json({ error: vars.error }, 400);

  const { data: choque } = await supabase.from('wa_plantillas')
    .select('id, status').eq('nombre', nombre).eq('idioma', idioma).maybeSingle();
  if (choque) {
    return json({ error: `Ya existe "${nombre}" (${choque.status}). Meta no edita plantillas: crea una versión nueva, p. ej. "${nombre}_v2".` }, 409);
  }

  try {
    let headerHandle: string | null = null;
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerTipo)) headerHandle = await ingestarHandle(String(b.header_media_url), b.header_mime || null, b.header_filename || null);
    const ejemplos = Array.isArray(b.ejemplos) ? b.ejemplos.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
    const creada = await crearPlantillaMeta({
      nombre, idioma, categoria, cuerpo,
      header: headerTipo === 'TEXT' && b.header ? String(b.header).trim() : null,
      footer: b.footer ? String(b.footer).trim() : null,
      botones: Array.isArray(b.botones) ? b.botones : [],
      ejemplos, headerTipo: headerTipo as any, headerHandle,
      autenticacion: esAuth ? { expiraMin: Number(b.otp_expira_min) || 10, recomendacion: b.otp_recomendacion !== false } : null,
    });
    await supabase.from('wa_plantillas').insert({
      meta_template_id: creada?.id ? String(creada.id) : null,
      nombre, idioma, categoria, cuerpo,
      header: headerTipo === 'TEXT' ? (b.header || null) : null, header_tipo: headerTipo, header_media_url: b.header_media_url || null, header_handle: headerHandle,
      footer: b.footer || null,
      botones: Array.isArray(b.botones) && b.botones.length ? b.botones : null,
      variables: esAuth ? 1 : vars.n, status: creada?.status || 'PENDING', status_at: new Date().toISOString(),
      ejemplos: ejemplos.length ? ejemplos : null,
      variables_map: Array.isArray(b.variables_map) ? b.variables_map : null,
      tipo_especial: esAuth ? 'otp' : null,
    });
    return json({ ok: true, status: creada?.status || 'PENDING' });
  } catch (e: any) {
    { const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined); return json({ error: `${x.titulo}. ${x.que_hacer}`, error_detalle: x }, 502); }
  }
};

/** Campos locales editables sin tocar Meta: mapa de variables (prellenado) y URL del archivo del encabezado. */
export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const cambios: any = {};
  if ('variables_map' in b) cambios.variables_map = Array.isArray(b.variables_map) ? b.variables_map.slice(0, 20) : null;
  if ('header_media_url' in b) cambios.header_media_url = b.header_media_url ? String(b.header_media_url) : null;
  if (!Object.keys(cambios).length) return json({ error: 'Nada que cambiar' }, 400);
  const { error } = await supabase.from('wa_plantillas').update(cambios).eq('id', b.id);
  return error ? json({ error: error.message }, 500) : json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.nombre) return json({ error: 'Falta nombre' }, 400);
  try { await borrarPlantillaMeta(String(b.nombre)); } catch (e: any) {
    const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined);
    return json({ error: `${x.titulo}. ${x.que_hacer}`, error_detalle: x }, 502);
  }
  await supabase.from('wa_plantillas').delete().eq('nombre', String(b.nombre));
  return json({ ok: true });
};
