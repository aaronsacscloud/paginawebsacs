// Motor de importación de leads de TikTok → contactos del CRM.
//
// Vive aparte de las rutas porque tiene DOS entradas y una sola verdad:
//   · el cron que lee la hoja de Google (automático, cada 15 min),
//   · el pegado manual de CSV en el panel (para el histórico y por si la
//     automatización se cae).
// Si cada entrada tuviera su propia lógica de deduplicado, tarde o temprano
// una crearía el contacto que la otra ya había creado.
//
// Anti-duplicado, en este orden:
//   1) lead_id de TikTok (propiedades.tiktok.lead_id) — respaldado además por
//      el índice único uq_contacts_tiktok_lead en la base.
//   2) correo exacto.
//   3) WhatsApp por últimos 10 dígitos (para no fallar por el "1" de móvil).
//
// Sobre un contacto que YA existía solo se rellenan huecos. La atribución
// previa NO se pisa: si alguien llegó primero por Google y hoy llenó un
// formulario de TikTok, el canal que lo trajo sigue siendo Google — pisarlo le
// regalaría a TikTok un lead que no pagó.
import { supabase } from '../supabase';
import { enviarBienvenidaTikTok } from './bienvenida-lead';
import { atribucionDeLead, type LeadTikTok } from './tiktok-leads';
import { notificar } from './notificaciones';

const ult10 = (p?: string | null) => String(p || '').replace(/\D/g, '').slice(-10);

/** Resumen legible del anuncio, para el detalle del lead y la campana. */
export const resumenAnuncio = (l: LeadTikTok) =>
  ['TikTok Ads', l.campana, l.anuncio].filter(Boolean).join(' · ');

export type AccionLead = 'creado' | 'actualizado' | 'duplicado' | 'error';

export interface FilaReporte {
  fila?: number;
  lead: string;
  nombre: string;
  campana: string | null;
  anuncio: string | null;
  accion: AccionLead;
  motivo?: string;
  contact_id?: string;
  error?: string;
}

export interface Resultado {
  leidos: number;
  creados: number;
  actualizados: number;
  duplicados: number;
  errores: number;
  sin_campana: number;
  reporte: FilaReporte[];
}

const COLS = 'id, nombre, apellido, email, whatsapp, telefono, company_id, giro, sucursales_interes, lifecycle_stage, fuente, fuente_detalle, utm_source, utm_medium, utm_campaign, campana, propiedades';

/**
 * Importa una tanda de leads ya normalizados.
 *
 * @param dry_run  true = no escribe nada, solo devuelve el cruce.
 * @param via      'hoja' | 'csv' — queda en la actividad para poder auditar
 *                 por dónde entró cada lead cuando algo no cuadre.
 */
export async function importarLeadsTikTok(
  leads: LeadTikTok[],
  { dry_run = true, via = 'csv' }: { dry_run?: boolean; via?: 'hoja' | 'csv' } = {},
): Promise<Resultado> {
  const res: Resultado = {
    leidos: leads.length, creados: 0, actualizados: 0, duplicados: 0, errores: 0,
    sin_campana: leads.filter(l => !l.campana).length, reporte: [],
  };
  if (!leads.length) return res;

  // ── Lo que ya existe, en 3 consultas y no una por lead ──────────────────
  const emails = [...new Set(leads.map(l => l.email).filter(Boolean))] as string[];
  const hayTel = leads.some(l => l.whatsapp);

  const porLeadId = new Map<string, any>();   // indexado por clave (lead_id o derivada)
  const porEmail = new Map<string, any>();
  const porTel = new Map<string, any>();

  const { data: yaImportados } = await supabase
    .from('contacts').select(COLS).eq('fuente', 'tiktok-lead-form').limit(5000);
  for (const c of (yaImportados || [])) {
    const tk = (c as any)?.propiedades?.tiktok || {};
    for (const k of [tk.clave, tk.lead_id]) if (k) porLeadId.set(String(k), c);
  }
  if (emails.length) {
    const { data } = await supabase.from('contacts').select(COLS).in('email', emails).limit(5000);
    for (const c of (data || [])) if (c.email) porEmail.set(String(c.email).toLowerCase(), c);
  }
  if (hayTel) {
    // PostgREST no compara "últimos 10 dígitos": se traen los contactos con
    // WhatsApp y se cruza en memoria (el CRM cabe de sobra en una consulta).
    const { data } = await supabase.from('contacts').select(COLS).not('whatsapp', 'is', null).limit(5000);
    for (const c of (data || [])) { const k = ult10(c.whatsapp); if (k) porTel.set(k, c); }
  }

  for (const l of leads) {
    const existente =
      (l.clave && porLeadId.get(l.clave)) ||
      (l.email && porEmail.get(l.email)) ||
      (l.whatsapp && porTel.get(ult10(l.whatsapp))) || null;

    const base = {
      fila: (l as any)._fila,
      lead: l.email || l.whatsapp || l.lead_id,
      nombre: [l.nombre, l.apellido].filter(Boolean).join(' '),
      campana: l.campana, anuncio: l.anuncio,
    };

    // Ya importado con la MISMA clave: no se toca nada. Es lo que hace que el
    // cron pueda releer la hoja completa cada 15 min sin efectos secundarios.
    const previo = existente?.propiedades?.tiktok;
    const yaEstaba = !!previo && !!l.clave && (previo.clave === l.clave || previo.lead_id === l.clave);
    if (existente && yaEstaba) {
      res.duplicados++;
      res.reporte.push({ ...base, accion: 'duplicado', motivo: 'Ya se había importado este mismo lead', contact_id: existente.id });
      continue;
    }

    const bloqueTikTok = {
      lead_id: l.lead_id || null,
      clave: l.clave || null,
      campana: l.campana, campana_id: l.campana_id,
      grupo: l.grupo, grupo_id: l.grupo_id,
      anuncio: l.anuncio, anuncio_id: l.anuncio_id,
      formulario: l.formulario, formulario_id: l.formulario_id,
      creado: l.creado,
      respuestas: l.respuestas,
      via,
      importado_en: new Date().toISOString(),
    };

    if (existente) {
      const prev = existente.propiedades || {};
      const upd: Record<string, any> = {
        propiedades: {
          ...prev,
          tiktok: bloqueTikTok,
          origen_cuenta: prev.origen_cuenta || 'tiktok',
          atribucion: prev.atribucion || atribucionDeLead(l),
        },
      };
      if (!existente.email && l.email) upd.email = l.email;
      if (!existente.whatsapp && l.whatsapp) upd.whatsapp = l.whatsapp;
      if (!existente.apellido && l.apellido) upd.apellido = l.apellido;
      if (!existente.giro && l.giro) upd.giro = l.giro;
      if (!existente.sucursales_interes && l.sucursales) upd.sucursales_interes = l.sucursales;
      if (!existente.utm_source) { upd.utm_source = 'tiktok'; upd.utm_medium = 'paid_social'; upd.utm_campaign = l.campana; }
      if (l.campana && !(existente as any).campana) upd.campana = l.campana;
      if (!existente.fuente_detalle) upd.fuente_detalle = resumenAnuncio(l);

      res.reporte.push({ ...base, accion: 'actualizado', contact_id: existente.id });
      res.actualizados++;
      if (dry_run) continue;

      const { error } = await supabase.from('contacts').update(upd).eq('id', existente.id);
      if (error) { res.errores++; res.reporte[res.reporte.length - 1].error = error.message; continue; }
      // El contacto en memoria queda actualizado para que dos filas del mismo
      // lote con el mismo correo no se procesen dos veces como "nuevas".
      existente.propiedades = upd.propiedades;
      await supabase.from('activities').insert({
        contact_id: existente.id, company_id: existente.company_id || null,
        tipo: 'lead_created', automatico: true,
        titulo: `Volvió a dejar sus datos en un formulario de TikTok: ${resumenAnuncio(l)}`,
        metadata: { origen: 'tiktok-lead-form', ...bloqueTikTok },
      });
      continue;
    }

    // ── Nuevo ────────────────────────────────────────────────────────────
    res.reporte.push({ ...base, accion: 'creado' });
    res.creados++;
    if (dry_run) continue;

    let company_id: string | null = null;
    if (l.empresa) {
      const { data: co } = await supabase.from('companies').select('id').eq('nombre', l.empresa).limit(1).maybeSingle();
      if (co) company_id = co.id;
      else {
        const { data: nueva } = await supabase.from('companies')
          .insert({ nombre: l.empresa, giro: l.giro || null, sucursales: l.sucursales || 1, estado_cuenta: 'prospecto' })
          .select('id').single();
        company_id = nueva?.id || null;
      }
    }

    const { data: nuevo, error } = await supabase.from('contacts').insert({
      nombre: l.nombre || 'Sin nombre',
      apellido: l.apellido,
      email: l.email,
      whatsapp: l.whatsapp,
      tipo: 'lead',
      lifecycle_stage: 'lead',
      pipeline_stage: 'nuevo',
      fuente: 'tiktok-lead-form',
      fuente_detalle: resumenAnuncio(l),
      utm_source: 'tiktok',
      utm_medium: 'paid_social',
      utm_campaign: l.campana,
      campana: l.campana,
      company_id,
      giro: l.giro,
      sucursales_interes: l.sucursales,
      created_at: l.creado || undefined,   // la hora real del anuncio, no la del import
      propiedades: {
        origen_cuenta: 'tiktok',
        atribucion: atribucionDeLead(l),
        tiktok: bloqueTikTok,
      },
    }).select('id').single();

    if (error || !nuevo) {
      res.errores++; res.creados--;
      res.reporte[res.reporte.length - 1] = { ...base, accion: 'error', error: error?.message };
      continue;
    }

    // El nuevo entra a los índices en memoria: si la hoja trae la misma
    // persona dos veces en el mismo lote, la segunda ya lo encuentra.
    const enMemoria = { id: nuevo.id, email: l.email, whatsapp: l.whatsapp, company_id, propiedades: { tiktok: bloqueTikTok } };
    if (l.clave) porLeadId.set(l.clave, enMemoria);
    if (l.email) porEmail.set(l.email, enMemoria);
    if (l.whatsapp) porTel.set(ult10(l.whatsapp), enMemoria);

    await supabase.from('activities').insert({
      contact_id: nuevo.id, company_id,
      tipo: 'lead_created', automatico: true,
      titulo: `Lead de formulario instantáneo de TikTok: ${base.nombre || base.lead}`,
      metadata: { origen: 'tiktok-lead-form', ...bloqueTikTok },
    });

    // Bienvenida automática al LEAD (plantilla UTILITY): solo en el goteo del
    // pipeline vivo — un import masivo de la hoja vieja NO debe disparar
    // decenas de mensajes.
    if (l.whatsapp && leads.length <= 10) {
      enviarBienvenidaTikTok(nuevo.id, l.whatsapp, l.nombre).catch(e => console.warn('[bienvenida-tiktok]', e?.message || e));
    }
    // La campana: un lead pagado que nadie ve el mismo día es la fuga cara.
    await notificar({
      clave: `lead_tiktok:${l.clave}`,
      tipo: 'lead_nuevo', nivel: 'alerta',
      titulo: `Lead de TikTok Ads: ${base.nombre || base.lead}`,
      detalle: resumenAnuncio(l), destino: 'leads',
      metadata: { contact_id: nuevo.id, ...bloqueTikTok },
    });
    res.reporte[res.reporte.length - 1].contact_id = nuevo.id;
  }

  return res;
}
