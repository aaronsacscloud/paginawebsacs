// QA/UTILIDAD · Aviso de leads al equipo.
//   GET  ?              → prueba con un lead falso (devuelve error exacto por teléfono)
//   GET  ?leads=recientes → manda a los del equipo los leads REALES de hoy y
//                           ayer (uno por uno, con su link a la ficha)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { avisarNuevoLead } from '../../../../lib/crm/aviso-lead';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('leads') === 'tiktok') {
    // Solo los REALES de TikTok de hoy y ayer (el pipeline vivo), no el
    // import masivo de la hoja vieja.
    const ayerCdmx = new Date(Date.now() - 6 * 3600e3); ayerCdmx.setUTCDate(ayerCdmx.getUTCDate() - 1);
    const desde = new Date(ayerCdmx.toISOString().slice(0, 10) + 'T06:00:00Z').toISOString();
    const { data: leads } = await supabase.from('contacts')
      .select('id, nombre, apellido, whatsapp, telefono, email, campana, fuente, companies(nombre)')
      .eq('lifecycle_stage', 'lead').eq('fuente', 'tiktok-lead-form').is('archived_at', null)
      .gte('created_at', desde).order('created_at', { ascending: false }).limit(15);
    const out: any[] = [];
    for (const c of leads || []) {
      const r = await avisarNuevoLead({ ...c, fuente: 'TikTok' }).catch(e => [{ ok: false, error: String(e) }]);
      out.push({ lead: [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email, envio: r });
    }
    return json({ enviados: out.length, detalle: out });
  }
  if (url.searchParams.get('leads') === 'recientes') {
    // Hoy y ayer en hora de México (UTC-6): desde ayer 00:00 CDMX.
    const ayerCdmx = new Date(Date.now() - 6 * 3600e3); ayerCdmx.setUTCDate(ayerCdmx.getUTCDate() - 1);
    const desde = new Date(ayerCdmx.toISOString().slice(0, 10) + 'T06:00:00Z').toISOString();
    const { data: leads } = await supabase.from('contacts')
      .select('id, nombre, apellido, whatsapp, telefono, email, campana, fuente, companies(nombre)')
      .eq('lifecycle_stage', 'lead').is('archived_at', null)
      .gte('created_at', desde).order('created_at', { ascending: false }).limit(15);
    const out: any[] = [];
    for (const c of leads || []) {
      const r = await avisarNuevoLead({ ...c, fuente: (c as any).companies?.nombre ? `${(c as any).companies.nombre} · ${c.fuente || ''}` : c.fuente }).catch(e => [{ ok: false, error: String(e) }]);
      out.push({ lead: [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email, envio: r });
    }
    return json({ enviados: out.length, detalle: out });
  }
  const r = await avisarNuevoLead({ id: 'test', nombre: 'Prueba de aviso', whatsapp: '+520000000000', fuente: 'QA del sistema' }, 'Esto es una prueba del aviso al equipo.');
  return json({ resultados: r });
};
