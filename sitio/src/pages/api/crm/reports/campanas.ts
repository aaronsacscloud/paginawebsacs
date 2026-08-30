// GET /api/crm/reports/campanas?dias=30 — quién entró por campaña y no agendó.
//
// La pregunta que contesta: «de todo lo que trajo la pauta, ¿a quién le falta
// seguimiento?». Medido hoy sobre 30 días reales: entraron 73 leads por el
// formulario de TikTok y 71 no han agendado nada. Eso no se veía en ningún
// lado — el CRM sabía cuántos entraron y sabía quién agendó, pero nadie había
// cruzado las dos cosas, que es justo donde está el trabajo pendiente.
//
// Tres decisiones que hacen que el número sirva:
//
//  · SE MIDE POR FUENTE, no «campañas» en abstracto. La fuente es lo que el
//    CRM sí sabe con certeza (`contacts.fuente`), y es como el vendedor piensa:
//    «los de TikTok», «los del formulario».
//  · SOLO LOS QUE SIGUEN VIVOS. Un descalificado o un churned que no agendó no
//    es trabajo pendiente, es un caso cerrado; contarlo infla el pendiente con
//    gente a la que nadie va a llamar.
//  · AGENDAR ES HABER AGENDADO ALGUNA VEZ, no tener una cita futura. Quien ya
//    tuvo su demo no necesita que le insistan para agendar: necesita otra cosa,
//    y esta lista no es sobre eso.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conMicroCache } from '../../../../lib/crm/micro-cache';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/* Etapas vivas: se trabaja lo que todavía se puede cerrar. */
const VIVAS = ['lead', 'lead_calificado', 'oportunidad', 'rezagado'];

/** «tiktok-lead-form» → «TikTok». Lo que se lee tiene que ser lo que se dice. */
function bonito(f: string): string {
  const s = (f || '').toLowerCase();
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('meta') || s.includes('facebook')) return 'Facebook';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('google')) return 'Google';
  if (s.startsWith('respond.io')) return 'WhatsApp · ' + f.replace(/^respond\.io\s*·?\s*/i, '');
  if (s === 'booking-page') return 'Página de agenda';
  if (s === 'captura_manual') return 'Captura manual';
  if (s === 'widget' || s.includes('web')) return 'Sitio web';
  return f || 'Sin fuente';
}

const _GET: APIRoute = async ({ url }) => {
  const dias = Math.min(180, Math.max(1, Number(url.searchParams.get('dias') || 30)));
  const desde = new Date(Date.now() - dias * 864e5).toISOString();

  const { data: leads, error } = await supabase
    .from('contacts')
    .select('id, nombre, whatsapp, fuente, created_at, lifecycle_stage, sucursales_interes, company_id, companies(nombre, sucursales)')
    .gte('created_at', desde)
    .in('lifecycle_stage', VIVAS)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return json({ error: error.message }, 500);
  if (!leads?.length) return json({ dias, fuentes: [], total: 0, sin_agendar: 0 });

  const ids = leads.map(l => l.id);
  /* Una cita ALGUNA VEZ, no una cita futura: quien ya tuvo su demo no está
     pendiente de agendar. */
  const { data: citas } = await supabase.from('bookings').select('contact_id').in('contact_id', ids);
  const agendaron = new Set((citas || []).map((b: any) => b.contact_id));

  /* Si ya hubo conversación por WhatsApp, «sin agendar» significa otra cosa:
     ya se le habló y no cerró. Se dice aparte para no mandar a alguien a
     escribirle a quien ya está en conversación. */
  const { data: convs } = await supabase.from('wa_conversaciones').select('contact_id, id').in('contact_id', ids);
  const convPorContacto = new Map((convs || []).filter((c: any) => c.contact_id).map((c: any) => [c.contact_id, c.id]));

  const porFuente = new Map<string, any>();
  for (const l of leads as any[]) {
    const clave = l.fuente || 'sin_fuente';
    let f = porFuente.get(clave);
    if (!f) { f = { fuente: clave, etiqueta: bonito(clave), entraron: 0, sin_agendar: 0, sin_tocar: 0, leads: [] as any[] }; porFuente.set(clave, f); }
    f.entraron++;
    if (agendaron.has(l.id)) continue;
    f.sin_agendar++;
    const conv = convPorContacto.get(l.id) || null;
    if (!conv) f.sin_tocar++;
    if (f.leads.length < 60) {
      f.leads.push({
        id: l.id, nombre: l.nombre || 'Sin nombre',
        empresa: l.companies?.nombre || null,
        sucursales: l.companies?.sucursales ?? l.sucursales_interes ?? null,
        whatsapp: l.whatsapp || null,
        ciclo: l.lifecycle_stage || null,
        wa_conversation_id: conv,
        dias: Math.round((Date.now() - new Date(l.created_at).getTime()) / 864e5),
      });
    }
  }

  const fuentes = [...porFuente.values()].filter(f => f.sin_agendar > 0).sort((a, b) => b.sin_agendar - a.sin_agendar);
  return json({
    dias,
    total: leads.length,
    sin_agendar: fuentes.reduce((n, f) => n + f.sin_agendar, 0),
    fuentes,
  });
};

/* 60 s: esto se mira al arrancar el día y cambia con cada lead que entra, pero
   no tan rápido como para pagar la consulta en cada pintada. */
export const GET = conMicroCache('reports/campanas', 60000, _GET as any);
