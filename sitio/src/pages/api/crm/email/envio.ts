/**
 * QUÉ CORREO ES ÉSTE — para el cajón del inbox.
 *
 * El cajón enseñaba el asunto, si lo abrió y las cuatro primeras líneas. Con
 * eso no se sabe lo que hace falta antes de contestar: QUÉ correo es, POR QUÉ
 * salió y cómo se ve completo. Y salir del inbox a buscarlo es el paso que
 * hace que no se mire.
 *
 * Devuelve el envío, de dónde salió (secuencia y su paso, campaña, o
 * transaccional) y el cuerpo para la vista previa.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const CANAL: Record<string, string> = { correo: 'Correo', wa: 'WhatsApp', inapp: 'Mensaje dentro de Sacs' };

/** Las variables de la plantilla con los datos de ESTE contacto. */
function rellenar(html: string, d: Record<string, string>): string {
  return String(html || '').replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi, (_m, k, def) => {
    const v = d[String(k).toLowerCase()];
    return (v && v.trim()) ? v : String(def || '').trim();
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta el envío.' }, 400);

  const { data: en } = await supabase.from('email_sends')
    .select('id, asunto, extracto, estado, categoria, sent_at, delivered_at, opened_at, first_opened_at, open_count, clicked_at, click_count, clicked_links, bounced_at, bounce_reason, email_to, template_id, automation_id, step_id, campaign_id, contact_id')
    .eq('id', id).maybeSingle();
  if (!en) return json({ error: 'Ese correo ya no está registrado.' }, 404);

  /* ── POR QUÉ SALIÓ ─────────────────────────────────────────────────────
     Es la mitad de la pregunta: un correo de una cadencia y uno que mandó una
     persona se leen distinto, y el asunto solo no lo distingue. */
  let porque: any = { tipo: 'transaccional', detalle: en.categoria || null };
  if (en.automation_id) {
    const { data: sec } = await supabase.from('crm_secuencias')
      .select('id, nombre, descripcion').eq('id', en.automation_id).maybeSingle();
    let paso: any = null;
    if (en.step_id) {
      const { data: p } = await supabase.from('crm_secuencia_pasos')
        .select('dia, orden, canal').eq('id', en.step_id).maybeSingle();
      if (p) paso = { dia: p.dia, orden: p.orden, canal: CANAL[p.canal] || p.canal };
    }
    porque = { tipo: 'secuencia', secuencia_id: sec?.id || en.automation_id, nombre: sec?.nombre || null, descripcion: sec?.descripcion || null, paso };
  } else if (en.campaign_id) {
    const { data: c } = await supabase.from('email_campaigns').select('id, nombre').eq('id', en.campaign_id).maybeSingle();
    porque = { tipo: 'campana', id: c?.id || en.campaign_id, nombre: c?.nombre || null };
  }

  /* ── EL CUERPO ─────────────────────────────────────────────────────────
     Sale de la plantilla compilada, con las variables de este contacto. NO es
     una copia byte a byte de lo que salió del servidor —eso no se guarda— y
     por eso el `exacto:false` viaja hasta la pantalla, que lo dice. Enseñar
     una reconstrucción como si fuera el original es la clase de mentira que
     hace que después nadie le crea al espejo. */
  let plantilla: any = null;
  let html: string | null = null;
  let exacto = false;
  if (en.template_id) {
    const { data: t } = await supabase.from('email_templates')
      .select('id, nombre, asunto, preview_text, categoria, html_compilado, texto_plano').eq('id', en.template_id).maybeSingle();
    if (t) {
      plantilla = { id: t.id, nombre: t.nombre, categoria: t.categoria, preview_text: t.preview_text || null };
      const { data: ct } = en.contact_id
        ? await supabase.from('contacts').select('nombre, apellido, companies(nombre, nombre_comercial)').eq('id', en.contact_id).maybeSingle()
        : { data: null as any };
      const emp = (ct as any)?.companies;
      html = rellenar(String(t.html_compilado || ''), {
        nombre: String((ct as any)?.nombre || '').trim(),
        apellido: String((ct as any)?.apellido || '').trim(),
        empresa: String(emp?.nombre_comercial || emp?.nombre || '').trim(),
      }) || null;
    }
  }

  return json({
    envio: {
      id: en.id, asunto: en.asunto, extracto: en.extracto, estado: en.estado,
      para: en.email_to, categoria: en.categoria,
      enviado_at: en.sent_at, entregado_at: en.delivered_at,
      abierto_at: en.first_opened_at || en.opened_at, aperturas: Number(en.open_count || 0),
      clic_at: en.clicked_at, clics: Number(en.click_count || 0), links: en.clicked_links || [],
      rebote_at: en.bounced_at, rebote_motivo: en.bounce_reason || null,
    },
    porque, plantilla, html, exacto,
  });
};
