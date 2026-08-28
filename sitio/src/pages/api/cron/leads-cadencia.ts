// CRON · MOTOR DE SECUENCIAS (cada hora). La ruta conserva su nombre viejo
// para no tocar vercel.json; el concepto ahora es multi-secuencia.
//
// Por cada secuencia ACTIVA, tres movimientos:
//   1. ENROLAR: leads que cumplen las reglas de entrada y no están dentro.
//   2. GRADUAR: salida TOTAL con motivo (agendó, cliente, descarte, corte,
//      archivado) — eso alimenta las métricas de rendimiento.
//      RESPONDER no saca de la secuencia: detiene SOLO el canal por el que
//      respondió (respondió por WhatsApp → paran los WhatsApps automáticos,
//      los correos siguen; y al revés). Si respondió por ambos, ahí sí sale.
//   3. ENVIAR: a los miembros vigentes, los pasos del día (máx 1 correo y
//      1 WhatsApp por corrida), en la ventana y días de ESTA secuencia.
// La pausa ("pidió tiempo") NO es salida: se salta el envío y al vencer sigue.
// Cada correo enviado y cada cambio de canal dejan NOTA en el hilo del inbox
// para que el vendedor sepa qué recibió el lead sin salir de la conversación.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { resolverTenant } from '../../../lib/email/tenant';
import { enviarCorreo } from '../../../lib/email/pipeline';
import { compilar, compilarTexto, interpolar } from '../../../lib/email/plantillas';
import { enviarPlantilla } from '../../../lib/whatsapp/kapso-api';

export const prerender = false;
const json = (o: any) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

// Estados que significan "el vendedor ya está negociando": salida total.
const NEGOCIANDO = ['cotizado', 'negociando'];
function motivoSalida(c: any): string | null {
  if (c.archived_at) return 'archivado';
  if (c.estatus_lead === 'descartado' || c.calificacion === 'no_califica') return 'descartado';
  if (['cliente', 'oportunidad'].includes(c.lifecycle_stage)) return c.lifecycle_stage === 'cliente' ? 'convertido' : 'agendo';
  if (['agendado', 'demo_hecha'].includes(c.estatus_lead)) return 'agendo';
  if (NEGOCIANDO.includes(c.estatus_lead)) return 'respondio';
  return null;
}

// Nota interna en el hilo del inbox (si el contacto tiene conversación de WA).
async function notaInbox(contactId: string, texto: string) {
  const { data: conv } = await supabase.from('wa_conversaciones').select('id')
    .eq('contact_id', contactId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!conv) return;
  await supabase.from('wa_notas').insert({ conversation_id: conv.id, contact_id: contactId, autor: 'Secuencias', texto });
}

export const GET: APIRoute = async ({ url }) => {
  const dry = url.searchParams.get('dry') === '1';
  const { data: secuencias } = await supabase.from('crm_secuencias').select('*').eq('activa', true);
  const lista = dry && !secuencias?.length
    ? (await supabase.from('crm_secuencias').select('*').limit(3)).data || []
    : secuencias || [];
  if (!lista.length) return json({ ok: true, sin_secuencias_activas: true });

  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const hora = cdmx.getUTCHours();
  const diaIso = cdmx.getUTCDay() === 0 ? 7 : cdmx.getUTCDay();   // 1=lun … 7=dom
  const t = await resolverTenant();
  const ahora = new Date();
  const res: any = { enrolados: 0, graduados: 0, canales_detenidos: 0, envios: [] };

  for (const sec of lista) {
    const entrada = sec.entrada || {};
    const estatusIn = entrada.estatus?.length ? entrada.estatus : ['contactado', 'sin_respuesta'];
    const lifecycleIn = entrada.lifecycle?.length ? entrada.lifecycle : ['lead', 'lead_calificado'];

    // 1) ENROLAR — solo leads vigentes (no más viejos que el corte).
    const { data: nuevos } = await supabase.from('contacts')
      .select('id, estatus_lead_at, propiedades')
      .in('lifecycle_stage', lifecycleIn).in('estatus_lead', estatusIn)
      .is('archived_at', null).eq('wa_optout', false)
      .limit(60);
    for (const c of nuevos || []) {
      const llego = (c.propiedades as any)?.tiktok?.creado || c.estatus_lead_at;
      if (llego && (ahora.getTime() - Date.parse(llego)) / 86400000 > sec.corte_dias) continue;
      if (dry) { res.enrolados++; res.entrarian = [...(res.entrarian || []), c.id].slice(0, 12); continue; }
      const { error } = await supabase.from('crm_secuencia_miembros')
        .insert({ secuencia_id: sec.id, contact_id: c.id });
      if (!error) {
        res.enrolados++;
        await notaInbox(c.id, `Entró a la secuencia "${sec.nombre}" (día 1 hoy).`);
      }
    }

    // 2) GRADUAR + canales — miembros vigentes: salida total con motivo, o
    //    detención del canal por el que respondió.
    const { data: miembros } = await supabase.from('crm_secuencia_miembros')
      .select('id, contact_id, inicio, enviados, canales_detenidos, contacts(id, nombre, apellido, email, whatsapp, campana, estatus_lead, lifecycle_stage, calificacion, retenido_hasta, wa_optout, archived_at)')
      .eq('secuencia_id', sec.id).is('detenida_at', null).limit(300);

    // Detección de respuesta POR CANAL, en lote (solo si alguien respondió).
    const idsRespondieron = (miembros || [])
      .filter((m: any) => ['respondio', 'descubrimiento'].includes(m.contacts?.estatus_lead))
      .map((m: any) => m.contact_id);
    const waEntrante: Record<string, string> = {};
    const correoEntrante: Record<string, string> = {};
    if (idsRespondieron.length) {
      const { data: convs } = await supabase.from('wa_conversaciones')
        .select('contact_id, ultimo_entrante_at').in('contact_id', idsRespondieron)
        .not('ultimo_entrante_at', 'is', null);
      for (const v of convs || []) {
        if (!waEntrante[v.contact_id] || v.ultimo_entrante_at > waEntrante[v.contact_id]) waEntrante[v.contact_id] = v.ultimo_entrante_at;
      }
      const { data: econvs } = await supabase.from('email_conversations')
        .select('id, contact_id').in('contact_id', idsRespondieron);
      if (econvs?.length) {
        const porConv: Record<string, string> = {};
        for (const e of econvs) porConv[e.id] = e.contact_id;
        const { data: emsgs } = await supabase.from('email_messages')
          .select('conversation_id, created_at').in('conversation_id', econvs.map(e => e.id))
          .eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(300);
        for (const e of emsgs || []) {
          const cid = porConv[e.conversation_id];
          if (cid && (!correoEntrante[cid] || e.created_at > correoEntrante[cid])) correoEntrante[cid] = e.created_at;
        }
      }
    }

    const vigentes: any[] = [];
    for (const m of miembros || []) {
      const c: any = m.contacts;
      if (!c) continue;
      const dias = Math.floor((ahora.getTime() - Date.parse(m.inicio)) / 86400000) + 1;
      const cd: Record<string, any> = { ...(m.canales_detenidos || {}) };
      let cdCambio = false;

      // Canal WhatsApp: optout o respuesta entrante después de entrar.
      if (!cd.wa && c.wa_optout) { cd.wa = { motivo: 'optout', at: ahora.toISOString() }; cdCambio = true; }
      if (!cd.wa && waEntrante[c.id] && waEntrante[c.id] > m.inicio) {
        cd.wa = { motivo: 'respondio', at: ahora.toISOString() }; cdCambio = true;
        if (!dry) await notaInbox(c.id, `Secuencia "${sec.nombre}": respondió por WhatsApp — se detienen los WhatsApps automáticos; los correos siguen.`);
      }
      // Canal correo: respuesta entrante después de entrar.
      if (!cd.correo && correoEntrante[c.id] && correoEntrante[c.id] > m.inicio) {
        cd.correo = { motivo: 'respondio', at: ahora.toISOString() }; cdCambio = true;
        if (!dry) await notaInbox(c.id, `Secuencia "${sec.nombre}": respondió por correo — se detienen los correos automáticos; los WhatsApps siguen.`);
      }
      if (cdCambio) {
        res.canales_detenidos++;
        if (!dry) {
          await supabase.from('crm_secuencia_miembros').update({ canales_detenidos: cd }).eq('id', m.id);
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_canal', automatico: true,
            titulo: `Secuencia "${sec.nombre}": canal detenido (${Object.keys(cd).join(' + ')})`, metadata: { secuencia_id: sec.id, canales: cd } });
        }
      }

      // Salida total: motivo duro, corte, o respondió por AMBOS canales.
      const ambos = cd.wa?.motivo === 'respondio' && cd.correo?.motivo === 'respondio';
      const motivo = motivoSalida(c) || (dias > sec.corte_dias ? 'corte' : null) || (ambos ? 'respondio' : null);
      if (motivo) {
        if (!dry) {
          await supabase.from('crm_secuencia_miembros').update({ detenida_at: ahora.toISOString(), motivo, canales_detenidos: cd }).eq('id', m.id);
          await supabase.from('activities').insert({ contact_id: c.id, tipo: 'secuencia_salida', automatico: true,
            titulo: `Salió de la secuencia "${sec.nombre}": ${motivo}`, metadata: { secuencia_id: sec.id, motivo, dia: dias } });
          await notaInbox(c.id, `Salió de la secuencia "${sec.nombre}" (día ${dias}): ${motivo}.`);
        }
        res.graduados++;
        continue;
      }
      vigentes.push({ m, c, dias, cd });
    }

    // 3) ENVIAR — ventana y días de ESTA secuencia (dry los ignora para simular).
    const diasEnvio: number[] = Array.isArray(sec.dias_envio) && sec.dias_envio.length ? sec.dias_envio : [1, 2, 3, 4, 5];
    if (!dry && (hora < sec.hora_inicio || hora >= sec.hora_fin || !diasEnvio.includes(diaIso))) continue;
    const { data: pasos } = await supabase.from('crm_secuencia_pasos')
      .select('*').eq('secuencia_id', sec.id).eq('activo', true).order('orden');
    for (const { m, c, dias, cd } of vigentes) {
      if (c.retenido_hasta && new Date(c.retenido_hasta) > ahora) continue;   // pausa: se salta, no sale
      const enviados: Record<string, string> = m.enviados || {};
      let correoHecho = false, waHecho = false, cambio = false;
      for (const p of pasos || []) {
        if (p.dia > dias || enviados[p.id]) continue;
        if (p.canal === 'correo' && (cd.correo || correoHecho || !c.email || !p.email_template_id)) continue;
        if (p.canal === 'wa' && (cd.wa || waHecho || !c.whatsapp || !p.wa_plantilla)) continue;
        if (dry) { res.envios.push({ sec: sec.nombre, lead: c.id, dia: dias, paso: p.orden, canal: p.canal }); if (p.canal === 'correo') correoHecho = true; else waHecho = true; continue; }
        const primerNombre = String(c.nombre || '').trim().split(/\s+/)[0] || null;
        const ctx = { nombre: primerNombre, campana: c.campana || null };
        try {
          if (p.canal === 'correo') {
            const { data: pl } = await supabase.from('email_templates').select('nombre, asunto, preview_text, bloques').eq('id', p.email_template_id).maybeSingle();
            if (!pl?.bloques || !t) continue;
            const asunto = interpolar(pl.asunto || '', ctx);
            const r = await enviarCorreo({ tenantId: t.id, para: c.email, asunto,
              html: compilar(pl.bloques, ctx, t, pl.preview_text ? interpolar(pl.preview_text, ctx) : null),
              texto: compilarTexto(pl.bloques, ctx), categoria: 'relacion', contactId: c.id } as any);
            if (!(r as any)?.enviado) continue;
            correoHecho = true;
            await notaInbox(c.id, `Secuencia "${sec.nombre}" · día ${p.dia}: correo "${asunto}" enviado a ${c.email}.`);
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
