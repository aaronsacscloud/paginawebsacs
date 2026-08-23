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
import { listarPlantillasMeta, crearPlantillaMeta, enviarPlantilla, sanearParam, KapsoError } from '../../../../lib/whatsapp/kapso-api';
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

export const GET: APIRoute = async () => {
  try {
    const enMeta = await listarPlantillasMeta();
    for (const t of enMeta) {
      await supabase.from('wa_plantillas').upsert({
        meta_template_id: t.id ? String(t.id) : null,
        nombre: t.name, idioma: t.language,
        categoria: t.category || 'UTILITY',
        cuerpo: textoDe(t.components, 'BODY') || '',
        header: textoDe(t.components, 'HEADER'),
        footer: textoDe(t.components, 'FOOTER'),
        variables: validarVariables(textoDe(t.components, 'BODY') || '').n,
        status: t.status || 'PENDING',
        rechazo_motivo: t.rejected_reason || null,
      }, { onConflict: 'nombre,idioma' });
    }
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
  const cuerpo = String(b.cuerpo || '').trim();
  if (!/^[a-z0-9_]{1,512}$/.test(nombre)) return json({ error: 'El nombre solo admite minúsculas, números y guión bajo' }, 400);
  if (!cuerpo) return json({ error: 'Falta el cuerpo' }, 400);
  if (!['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(categoria)) return json({ error: 'Categoría inválida' }, 400);
  const vars = validarVariables(cuerpo);
  if (!vars.ok) return json({ error: vars.error }, 400);

  const { data: choque } = await supabase.from('wa_plantillas')
    .select('id, status').eq('nombre', nombre).eq('idioma', idioma).maybeSingle();
  if (choque) {
    return json({ error: `Ya existe "${nombre}" (${choque.status}). Meta no edita plantillas: crea una versión nueva, p. ej. "${nombre}_v2".` }, 409);
  }

  try {
    const creada = await crearPlantillaMeta({
      nombre, idioma, categoria, cuerpo,
      header: b.header ? String(b.header).trim() : null,
      footer: b.footer ? String(b.footer).trim() : null,
      botones: Array.isArray(b.botones) ? b.botones : [],
      ejemplos: Array.isArray(b.ejemplos) ? b.ejemplos.map((x: any) => String(x || '').trim()).filter(Boolean) : [],
    });
    await supabase.from('wa_plantillas').insert({
      meta_template_id: creada?.id ? String(creada.id) : null,
      nombre, idioma, categoria, cuerpo,
      header: b.header || null, footer: b.footer || null,
      botones: Array.isArray(b.botones) && b.botones.length ? b.botones : null,
      variables: vars.n, status: creada?.status || 'PENDING',
    });
    return json({ ok: true, status: creada?.status || 'PENDING' });
  } catch (e: any) {
    { const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined); return json({ error: `${x.titulo}. ${x.que_hacer}`, error_detalle: x }, 502); }
  }
};
