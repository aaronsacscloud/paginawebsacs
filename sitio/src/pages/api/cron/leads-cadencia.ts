// CRON · La CADENCIA de seguimiento (cada hora, en horario humano).
//
// Correos diarios los primeros días y WhatsApps espaciados, HASTA QUE EL
// LEAD RESPONDA — y ahí se detiene sola, porque el candidato se define por
// el estatus VIVO: en cuanto pasa a "respondió" (o agenda, o pide pausa, o
// se descarta) deja de ser candidato en el mismo instante.
//
// Los pasos viven en crm_cadencia_pasos (día + canal + plantilla) y se
// editan desde WhatsApp ▸ ⚙ Automatización — sin tocar código.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { resolverTenant } from '../../../lib/email/tenant';
import { enviarCorreo } from '../../../lib/email/pipeline';
import { compilar, compilarTexto, interpolar } from '../../../lib/email/plantillas';
import { enviarPlantilla } from '../../../lib/whatsapp/kapso-api';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const dry = url.searchParams.get('dry') === '1';
  const { data: cfg } = await supabase.from('wa_config').select('cadencia_activa, cadencia_corte_dias').eq('id', 1).maybeSingle();
  if (!cfg?.cadencia_activa && !dry) return json({ ok: true, apagada: true });

  // Horario humano: 10:00-18:00 CDMX, lunes a viernes.
  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const hora = cdmx.getUTCHours(), dia = cdmx.getUTCDay();
  if (!dry && (hora < 10 || hora >= 18 || dia === 0 || dia === 6)) return json({ ok: true, fuera_de_horario: true });

  const corte = Number(cfg?.cadencia_corte_dias) || 14;
  const { data: pasos } = await supabase.from('crm_cadencia_pasos').select('*').eq('activo', true).order('orden');
  if (!pasos?.length) return json({ ok: true, sin_pasos: true });

  // Candidatos: tocados que NO han respondido. El estatus vivo ES el freno.
  const { data: leads } = await supabase.from('contacts')
    .select('id, nombre, apellido, email, whatsapp, campana, estatus_lead_at, propiedades, retenido_hasta, wa_optout')
    .in('lifecycle_stage', ['lead', 'lead_calificado'])
    .in('estatus_lead', ['contactado', 'sin_respuesta'])
    .is('archived_at', null)
    .limit(40);

  const t = await resolverTenant();
  const ahora = new Date();
  const res: any[] = [];
  for (const c of leads || []) {
    if (c.wa_optout) continue;
    if (c.retenido_hasta && new Date(c.retenido_hasta) > ahora) continue;   // pidió tiempo
    const props: any = c.propiedades || {};
    const cad: any = props.cadencia || {};
    if (cad.detenida) continue;
    // El reloj arranca cuando entró a la cadencia (primer toque sin respuesta).
    if (!cad.inicio) { cad.inicio = c.estatus_lead_at || ahora.toISOString(); }
    const diaActual = Math.floor((ahora.getTime() - Date.parse(cad.inicio)) / 86400000) + 1;
    if (diaActual > corte) {
      if (!dry) await supabase.from('contacts').update({ propiedades: { ...props, cadencia: { ...cad, detenida: true, motivo: 'corte' } } }).eq('id', c.id);
      continue;
    }
    const enviados: Record<string, string> = cad.enviados || {};
    let correoHecho = false, waHecho = false;
    for (const p of pasos) {
      if (p.dia > diaActual || enviados[p.id]) continue;
      if (p.canal === 'correo' && (correoHecho || !c.email || !p.email_template_id)) continue;
      if (p.canal === 'wa' && (waHecho || !c.whatsapp || !p.wa_plantilla)) continue;
      if (dry) { res.push({ lead: c.id, dia: diaActual, paso: p.orden, canal: p.canal }); if (p.canal === 'correo') correoHecho = true; else waHecho = true; continue; }
      const primerNombre = String(c.nombre || '').trim().split(/\s+/)[0] || null;
      const ctx = { nombre: primerNombre, campana: c.campana || null };
      try {
        if (p.canal === 'correo') {
          const { data: pl } = await supabase.from('email_templates').select('asunto, preview_text, bloques').eq('id', p.email_template_id).maybeSingle();
          if (!pl?.bloques || !t) continue;
          const r = await enviarCorreo({ tenantId: t.id, para: c.email, asunto: interpolar(pl.asunto || '', ctx),
            html: compilar(pl.bloques, ctx, t, pl.preview_text ? interpolar(pl.preview_text, ctx) : null),
            texto: compilarTexto(pl.bloques, ctx), categoria: 'relacion', contactId: c.id } as any);
          if (!(r as any)?.enviado) continue;
          correoHecho = true;
        } else {
          await enviarPlantilla(c.whatsapp, p.wa_plantilla, 'es_MX', [primerNombre || '👋']);
          waHecho = true;
        }
        enviados[p.id] = ahora.toISOString();
        await supabase.from('activities').insert({ contact_id: c.id, tipo: `cadencia_${p.canal}`, automatico: true,
          titulo: `Cadencia día ${p.dia}: ${p.canal === 'correo' ? 'correo' : 'WhatsApp'} de seguimiento`, metadata: { paso: p.orden, plantilla: p.email_template_id || p.wa_plantilla } });
        res.push({ lead: c.id, dia: diaActual, paso: p.orden, canal: p.canal });
      } catch (e: any) { console.warn('[cadencia]', c.id, p.canal, e?.message || e); }
    }
    if (!dry) await supabase.from('contacts').update({ propiedades: { ...props, cadencia: { ...cad, enviados } } }).eq('id', c.id);
  }
  return json({ ok: true, dry, enviados: res.length, detalle: res.slice(0, 20) });
};
