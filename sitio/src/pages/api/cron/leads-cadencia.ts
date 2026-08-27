// CRON · MOTOR DE SECUENCIAS (cada hora). La ruta conserva su nombre viejo
// para no tocar vercel.json; el concepto ahora es multi-secuencia.
//
// Por cada secuencia ACTIVA, tres movimientos:
//   1. ENROLAR: leads que cumplen las reglas de entrada y no están dentro.
//   2. GRADUAR: miembros cuyo lead YA NO cumple (respondió, agendó, se
//      descartó, convirtió, optout) → salida con MOTIVO — eso es lo que
//      alimenta las métricas de rendimiento.
//   3. ENVIAR: a los miembros vigentes, los pasos del día (máx 1 correo y
//      1 WhatsApp por corrida), en la ventana de horario de la secuencia.
// La pausa ("pidió tiempo") NO es salida: se salta el envío y al vencer sigue.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { resolverTenant } from '../../../lib/email/tenant';
import { enviarCorreo } from '../../../lib/email/pipeline';
import { compilar, compilarTexto, interpolar } from '../../../lib/email/plantillas';
import { enviarPlantilla } from '../../../lib/whatsapp/kapso-api';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

const AVANZADOS = ['respondio', 'descubrimiento', 'agendado', 'demo_hecha', 'cotizado', 'negociando'];
function motivoSalida(c: any): string | null {
  if (c.archived_at) return 'archivado';
  if (c.wa_optout) return 'optout';
  if (c.estatus_lead === 'descartado' || c.calificacion === 'no_califica') return 'descartado';
  if (['cliente', 'oportunidad'].includes(c.lifecycle_stage)) return c.lifecycle_stage === 'cliente' ? 'convertido' : 'agendo';
  if (['agendado', 'demo_hecha'].includes(c.estatus_lead)) return 'agendo';
  if (AVANZADOS.includes(c.estatus_lead)) return 'respondio';
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  const dry = url.searchParams.get('dry') === '1';
  const { data: secuencias } = await supabase.from('crm_secuencias').select('*').eq('activa', true);
  const lista = dry && !secuencias?.length
    ? (await supabase.from('crm_secuencias').select('*').limit(3)).data || []
    : secuencias || [];
  if (!lista.length) return json({ ok: true, sin_secuencias_activas: true });

  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const hora = cdmx.getUTCHours(), diaSem = cdmx.getUTCDay();
  const t = await resolverTenant();
  const ahora = new Date();
  const res: any = { enrolados: 0, graduados: 0, envios: [] };

  for (const sec of lista) {
    const entrada = sec.entrada || {};
    const estatusIn = entrada.estatus || ['contactado', 'sin_respuesta'];
    const lifecycleIn = entrada.lifecycle || ['lead', 'lead_calificado'];

    // 1) ENROLAR — solo leads vigentes (no más viejos que el corte).
    const { data: nuevos } = await supabase.from('contacts')
      .select('id, estatus_lead_at, propiedades')
      .in('lifecycle_stage', lifecycleIn).in('estatus_lead', estatusIn)
      .is('archived_at', null).eq('wa_optout', false)
      .limit(60);
    for (const c of nuevos || []) {
      const llego = (c.propiedades as any)?.tiktok?.creado || c.estatus_lead_at;
      if (llego && (ahora.getTime() - Date.parse(llego)) / 86400000 > sec.corte_dias) continue;
      if (dry) continue;
      const { error } = await supabase.from('crm_secuencia_miembros')
        .insert({ secuencia_id: sec.id, contact_id: c.id });
      if (!error) res.enrolados++;
    }

    // 2) GRADUAR — miembros vigentes cuyo lead ya no cumple: salida con motivo.
    const { data: miembros } = await supabase.from('crm_secuencia_miembros')
      .select('id, contact_id, inicio, enviados, contacts(id, nombre, apellido, email, whatsapp, campana, estatus_lead, lifecycle_stage, calificacion, retenido_hasta, wa_optout, archived_at)')
      .eq('secuencia_id', sec.id).is('detenida_at', null).limit(300);
    const vigentes: any[] = [];
    for (const m of miembros || []) {
      const c: any = m.contacts;
      if (!c) continue;
      const dias = Math.floor((ahora.getTime() - Date.parse(m.inicio)) / 86400000) + 1;
      const motivo = motivoSalida(c) || (dias > sec.corte_dias ? 'corte' : null);
      if (motivo) {
        if (!dry) {
          await supabase.from('crm_secuencia_miembros').update({ detenida_at: ahora.toISOString(), motivo }).eq('id', m.id);
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_salida', automatico: true,
            titulo: `Salió de la secuencia "${sec.nombre}": ${motivo}`, metadata: { secuencia_id: sec.id, motivo, dia: dias } });
        }
        res.graduados++;
        continue;
      }
      vigentes.push({ m, c, dias });
    }

    // 3) ENVIAR — en la ventana de ESTA secuencia (dry la ignora para simular).
    if (!dry && (hora < sec.hora_inicio || hora >= sec.hora_fin || diaSem === 0 || diaSem === 6)) continue;
    const { data: pasos } = await supabase.from('crm_secuencia_pasos')
      .select('*').eq('secuencia_id', sec.id).eq('activo', true).order('orden');
    for (const { m, c, dias } of vigentes) {
      if (c.retenido_hasta && new Date(c.retenido_hasta) > ahora) continue;   // pausa: se salta, no sale
      const enviados: Record<string, string> = m.enviados || {};
      let correoHecho = false, waHecho = false, cambio = false;
      for (const p of pasos || []) {
        if (p.dia > dias || enviados[p.id]) continue;
        if (p.canal === 'correo' && (correoHecho || !c.email || !p.email_template_id)) continue;
        if (p.canal === 'wa' && (waHecho || !c.whatsapp || !p.wa_plantilla)) continue;
        if (dry) { res.envios.push({ sec: sec.nombre, lead: c.id, dia: dias, paso: p.orden, canal: p.canal }); if (p.canal === 'correo') correoHecho = true; else waHecho = true; continue; }
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
          enviados[p.id] = ahora.toISOString(); cambio = true;
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_envio', automatico: true,
            titulo: `Secuencia "${sec.nombre}" día ${p.dia}: ${p.canal === 'correo' ? 'correo' : 'WhatsApp'}`,
            metadata: { secuencia_id: sec.id, paso: p.orden, canal: p.canal, plantilla: p.email_template_id || p.wa_plantilla } });
          res.envios.push({ sec: sec.nombre, lead: c.id, dia: dias, paso: p.orden, canal: p.canal });
        } catch (e: any) { console.warn('[secuencias]', c.id, p.canal, e?.message || e); }
      }
      if (cambio) await supabase.from('crm_secuencia_miembros').update({ enviados }).eq('id', m.id);
    }
  }
  return json({ ok: true, dry, ...res, envios: res.envios.length, muestra: res.envios.slice(0, 12) });
};
