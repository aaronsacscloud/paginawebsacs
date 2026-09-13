// CRM · REPORTE DE UNA SECUENCIA, CORREO POR CORREO.
//
// La pantalla de secuencias daba el total (enviados, abiertos, con clic) y con eso
// no se puede decidir nada: si el día 4 no lo abre nadie, el total lo esconde. Aquí
// el embudo se abre por paso —entregados, rebotes, abiertos, clics— y se puede
// bajar a la lista de contactos de UN correo para ver quién lo abrió, cuántas veces
// y qué tocó.
//
// GET ?id=<secuencia>                → el embudo por correo
// GET ?id=<secuencia>&paso=<templ>   → además, los contactos de ese correo
//
// Todo sale de `email_sends`, que ya guarda apertura, clics y rebote por envío; lo
// que faltaba era leerlo en el orden en que se toman las decisiones.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const url = new URL(request.url);
  const secuenciaId = String(url.searchParams.get('id') || '');
  const paso = String(url.searchParams.get('paso') || '');
  if (!secuenciaId) return json({ error: 'Falta la secuencia' }, 400);

  const [{ data: sec }, { data: pasos }, { data: miembros }] = await Promise.all([
    supabase.from('crm_secuencias').select('id, nombre, objetivo').eq('id', secuenciaId).maybeSingle(),
    supabase.from('crm_secuencia_pasos').select('dia, canal, email_template_id, wa_plantilla').eq('secuencia_id', secuenciaId).order('dia'),
    supabase.from('crm_secuencia_miembros').select('contact_id, inicio').eq('secuencia_id', secuenciaId),
  ]);
  if (!sec) return json({ error: 'No existe esa secuencia' }, 404);

  const ids = [...new Set((miembros || []).map(m => m.contact_id))];
  const desde = (miembros || []).reduce((min: string | null, m: any) => (!min || m.inicio < min ? m.inicio : min), null);
  if (!ids.length) return json({ secuencia: sec, miembros: 0, correos: [] });

  // Un solo viaje por todos los envíos de esos contactos desde que entraron.
  const { data: envios } = await supabase
    .from('email_sends')
    .select('template_id, contact_id, asunto, estado, sent_at, delivered_at, first_opened_at, opened_at, clicked_at, open_count, click_count, clicked_links, bounced_at, bounce_reason')
    .in('contact_id', ids)
    .gte('created_at', desde || '2000-01-01')
    .limit(5000);

  const plantillas = (pasos || []).filter(p => p.canal === 'correo' && p.email_template_id);
  const { data: tpls } = plantillas.length
    ? await supabase.from('email_templates').select('id, asunto, nombre').in('id', plantillas.map(p => p.email_template_id))
    : { data: [] as any[] };
  const asuntoDe = new Map((tpls || []).map((t: any) => [t.id, t.asunto || t.nombre]));

  const correos = plantillas.map(p => {
    const suyos = (envios || []).filter(e => e.template_id === p.email_template_id);
    const abiertos = suyos.filter(e => e.first_opened_at || e.opened_at);
    return {
      dia: p.dia,
      template_id: p.email_template_id,
      asunto: asuntoDe.get(p.email_template_id) || '(sin asunto)',
      enviados: suyos.length,
      entregados: suyos.filter(e => e.delivered_at).length,
      rebotes: suyos.filter(e => e.bounced_at).length,
      abiertos: abiertos.length,
      /* Las aperturas TOTALES, no solo cuántos abrieron: tres personas que lo abren
         cinco veces cada una es una señal distinta a quince personas que lo abren una. */
      aperturas: suyos.reduce((a, e) => a + (Number(e.open_count) || 0), 0),
      con_clic: suyos.filter(e => e.clicked_at).length,
      clics: suyos.reduce((a, e) => a + (Number(e.click_count) || 0), 0),
    };
  });

  let contactos: any[] = [];
  if (paso) {
    const suyos = (envios || []).filter(e => e.template_id === paso);
    const { data: cs } = suyos.length
      ? await supabase.from('contacts').select('id, nombre, apellido, email, companies(nombre_comercial)').in('id', [...new Set(suyos.map(e => e.contact_id))])
      : { data: [] as any[] };
    const quien = new Map((cs || []).map((c: any) => [c.id, c]));
    contactos = suyos.map(e => {
      const c: any = quien.get(e.contact_id);
      return {
        contact_id: e.contact_id,
        nombre: [c?.nombre, c?.apellido].filter(Boolean).join(' ') || c?.email || '(sin nombre)',
        empresa: c?.companies?.nombre_comercial || null,
        email: e.asunto ? c?.email : c?.email,
        /* El estado en una palabra, en el orden en que importa: un rebote manda sobre
           todo lo demás, y «entregado sin abrir» no es lo mismo que «no llegó». */
        estado: e.bounced_at ? 'rebotó' : e.clicked_at ? 'hizo clic' : (e.first_opened_at || e.opened_at) ? 'abrió' : e.delivered_at ? 'entregado' : 'enviado',
        aperturas: Number(e.open_count) || 0,
        clics: Number(e.click_count) || 0,
        ligas: Array.isArray(e.clicked_links) ? e.clicked_links.slice(0, 3) : [],
        motivo_rebote: e.bounce_reason || null,
        cuando: e.first_opened_at || e.delivered_at || e.sent_at,
      };
    }).sort((a, b) => (b.aperturas + b.clics * 5) - (a.aperturas + a.clics * 5));
  }

  return json({ secuencia: sec, miembros: ids.length, correos, contactos });
};
