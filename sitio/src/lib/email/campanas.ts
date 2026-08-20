// MOTOR DE CAMPAÑAS — envío masivo reanudable.
//
// ── El problema que resuelve ──
// Vercel mata una función a los 300 s. Una campaña de miles de correos no cabe
// en una invocación, y el navegador que la disparó puede cerrarse. Por eso el
// envío NUNCA ocurre en el request: se MATERIALIZA la audiencia (una fila por
// destinatario) y un cron va vaciando la cola. Si el proceso muere, el
// siguiente tick continúa exactamente donde quedó.
//
// ── El claim atómico ──
// Dos procesos pueden leer el mismo lote de pendientes (el cron en una
// instancia y "enviar ahora" en otra). Si ambos envían, el destinatario recibe
// dos veces. La defensa es un compare-and-swap real:
//     UPDATE ... SET estado='enviando' WHERE id=? AND estado='pendiente'
// Solo un proceso obtiene la fila; el otro recibe 0 filas y sigue de largo, en
// silencio. El índice único (campaign_id, lower(email)) es la segunda red.
//
// ── Materialización congelada ──
// La audiencia se resuelve UNA vez, al arrancar. Si se resolviera en cada
// tick, un contacto que entra a mitad de la campaña recibiría el correo y uno
// que cambia de etapa dejaría de recibirlo — la campaña nunca terminaría de
// definirse y el reporte no cuadraría nunca.
import { supabase } from '../supabase';
import { resolverTenant, type Tenant } from './tenant';
import { resolverMiembros, miembrosDeLista, type Definicion, type Miembro } from './segmentos';
import { compilar, compilarTexto, pesoKb, type Bloque, type Contexto } from './plantillas';
import { enviarCorreo, evaluarDestinatario } from './pipeline';

export interface Campana {
  id: string; tenant_id: string; nombre: string; estado: string;
  template_id: string | null; asunto: string | null; asunto_b: string | null;
  preview_text: string | null; categoria: 'marketing' | 'relacion';
  origen_tipo: 'segmento' | 'lista' | 'contactos' | null; origen_id: string | null;
  contact_ids: string[] | null; programada_para: string | null;
  materializada_at: string | null; resumen: any; utm_campaign: string | null;
}

/** Cuánto tiempo se le da a una invocación antes de dejar el resto al siguiente tick. */
const PRESUPUESTO_MS = 240_000;
const LOTE = 50;

/** La audiencia de una campaña, resuelta desde su origen. */
export async function audiencia(t: Tenant, c: Campana): Promise<Miembro[]> {
  // El inquilino se pasa siempre: la audiencia de una campaña no puede
  // apuntar a una lista o un segmento de otro dueño.
  if (c.origen_tipo === 'lista' && c.origen_id) return miembrosDeLista(c.origen_id, t.id);
  if (c.origen_tipo === 'segmento' && c.origen_id) {
    const { data } = await supabase.from('email_segments').select('definicion')
      .eq('id', c.origen_id).eq('tenant_id', t.id).maybeSingle();
    return data ? resolverMiembros(t, data.definicion as Definicion, 50000) : [];
  }
  if (c.origen_tipo === 'contactos' && c.contact_ids?.length) {
    const out: Miembro[] = [];
    for (let i = 0; i < c.contact_ids.length; i += 500) {
      let q = supabase.from('contacts')
        .select('id, nombre, apellido, email, company_id, companies(nombre)')
        .in('id', c.contact_ids.slice(i, i + 500));
      if (t.owner_team_member_id) q = q.eq('referrer_partner_id', t.owner_team_member_id);
      const { data } = await q;
      for (const x of (data || []) as any[]) if (x.email) out.push({
        id: x.id, contact_id: x.id, nombre: [x.nombre, x.apellido].filter(Boolean).join(' ') || 'Sin nombre',
        email: x.email, empresa: x.companies?.nombre || null, company_id: x.company_id || null,
      });
    }
    return out;
  }
  return [];
}

/**
 * Vista previa de a quién le llegaría y a quién NO — con el motivo.
 * Es lo que el paso de Revisión enseña ANTES de enviar: un candado invisible
 * se siente como un bug ("mandé a 143 y llegaron 117 ¿por qué?").
 */
export async function revisarAudiencia(t: Tenant, c: Campana) {
  const miembros = await audiencia(t, c);
  const fuera: Record<string, number> = {};
  let alcanzables = 0;
  const vistosEmpresa = new Set<string>();

  for (const m of miembros) {
    let motivo = await evaluarDestinatario(t, m.email!, c.categoria, m.company_id);
    // El cap por empresa se simula aquí también: si ya se contó un contacto
    // de esa empresa en ESTA campaña, el siguiente queda fuera.
    if (!motivo && t.presion_por_empresa && m.company_id) {
      if (vistosEmpresa.has(m.company_id)) motivo = 'presion_empresa';
      else vistosEmpresa.add(m.company_id);
    }
    if (motivo) fuera[motivo] = (fuera[motivo] || 0) + 1;
    else alcanzables++;
  }
  return { total: miembros.length, alcanzables, fuera };
}

/** Congela la audiencia en filas: una por destinatario. Idempotente. */
export async function materializar(t: Tenant, c: Campana): Promise<number> {
  // CLAIM: `materializar` se llama desde el request ("enviar") y desde el cron.
  // Sin este compare-and-swap, los dos veían `materializada_at` en null, los
  // dos materializaban, el segundo chocaba contra el índice único y terminaba
  // escribiendo `destinatarios: 0` en el resumen de una campaña que sí salió.
  const { data: ganado } = await supabase.from('email_campaigns')
    .update({ materializada_at: new Date().toISOString() })
    .eq('id', c.id).is('materializada_at', null).select('id');
  if (!ganado?.length) {
    // Otro proceso está materializando AHORA. Devolver su conteo parcial
    // (probablemente 0, porque apenas va insertando) hacía que este siguiera
    // de largo, no encontrara pendientes y cerrara la campaña como completada
    // sin haber mandado nada. Se avisa con -1 y el llamador se retira.
    const { count } = await supabase.from('email_campaign_recipients')
      .select('id', { count: 'exact', head: true }).eq('campaign_id', c.id);
    return c.materializada_at ? (count || 0) : -1;
  }
  if (c.materializada_at) {
    const { count } = await supabase.from('email_campaign_recipients')
      .select('id', { count: 'exact', head: true }).eq('campaign_id', c.id);
    return count || 0;
  }
  const miembros = await audiencia(t, c);
  const vistos = new Set<string>();
  const filas = miembros
    .filter(m => m.email && !vistos.has(m.email.toLowerCase()) && vistos.add(m.email.toLowerCase()))
    .map(m => ({
      campaign_id: c.id,
      contact_id: m.contact_id,   // explícito: nunca deducido del `id`
      email: m.email!.toLowerCase(),
      // A/B por hash estable del correo: la misma persona cae siempre en la
      // misma variante, aunque la campaña se reanude en otra instancia.
      variante: c.asunto_b ? (hash(m.email!) % 2 === 0 ? 'a' : 'b') : 'a',
    }));

  // Un insert por lotes falla ENTERO si una sola fila es inválida, y hasta
  // aquí eso pasaba en silencio: la campaña se marcaba materializada con cero
  // destinatarios y "terminaba" sin mandar nada. Ahora, si el lote falla, se
  // reintenta fila por fila para aislar a la culpable y dejar constancia.
  let insertadas = 0;
  const fallidas: Array<{ email: string; error: string }> = [];
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const { error } = await supabase.from('email_campaign_recipients').insert(lote);
    if (!error) { insertadas += lote.length; continue; }
    for (const f of lote) {
      const { error: e1 } = await supabase.from('email_campaign_recipients').insert(f);
      if (e1) fallidas.push({ email: f.email, error: e1.message.slice(0, 200) });
      else insertadas++;
    }
  }

  await supabase.from('email_campaigns').update({
    resumen: { ...(c.resumen || {}), destinatarios: insertadas, no_materializados: fallidas },
  }).eq('id', c.id);
  return insertadas;
}

/** Hash estable de una cadena (no criptográfico: solo reparto determinista). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

/** ¿Estamos dentro de la ventana horaria del inquilino? */
export function dentroDeVentana(t: Tenant, ahora = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: t.timezone, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const partes = Object.fromEntries(fmt.formatToParts(ahora).map(p => [p.type, p.value]));
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  const aMin = (hhmm: string) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
  if (!t.enviar_fines_semana) {
    const dia = String(partes.weekday || '').toLowerCase();
    if (dia.startsWith('sáb') || dia.startsWith('sab') || dia.startsWith('dom')) return false;
  }
  return minutos >= aMin(t.ventana_inicio) && minutos < aMin(t.ventana_fin);
}

/** Cuerpo del correo para un destinatario concreto. */
async function armarCorreo(t: Tenant, c: Campana, m: { email: string; contact_id: string | null }) {
  const { data: tpl } = c.template_id
    ? await supabase.from('email_templates').select('bloques, asunto').eq('id', c.template_id).maybeSingle()
    : { data: null as any };

  let ctx: Contexto = {};
  if (m.contact_id) {
    const { data: ct } = await supabase.from('contacts')
      .select('nombre, apellido, giro, plan_interes, sucursales_interes, companies(nombre)')
      .eq('id', m.contact_id).maybeSingle();
    if (ct) ctx = {
      nombre: (ct as any).nombre, apellido: (ct as any).apellido,
      empresa: (ct as any).companies?.nombre || null, giro: (ct as any).giro,
      plan: (ct as any).plan_interes, sucursales: (ct as any).sucursales_interes,
    };
  }
  const bloques = (tpl?.bloques || []) as Bloque[];
  return { html: compilar(bloques, ctx, t), texto: compilarTexto(bloques, ctx), ctx };
}

export interface Avance { procesados: number; enviados: number; rechazados: number; errores: number; quedan: number; terminada: boolean; motivo?: string }

/**
 * Procesa lo que quepa en esta invocación. Reanudable: se llama tantas veces
 * como haga falta y siempre continúa donde quedó.
 */
/**
 * Rescata destinatarios que quedaron reclamados y sin resolver.
 *
 * El claim escribe estado='enviando' y `claimed_at`, pero nadie volvía a leer
 * `claimed_at`: si el proceso moría entre el claim y el cierre (timeout,
 * redeploy, OOM), esa fila quedaba en 'enviando' PARA SIEMPRE. Con el cierre
 * honesto, eso deja la campaña eternamente en 'enviando': el cron la re-toma
 * cada 5 minutos sin hacer nada y esas personas nunca reciben el correo.
 *
 * Se devuelven a 'pendiente' para reintentar. Es seguro porque el envío real
 * tiene su propia red: `email_sends` registra ANTES de llamar al proveedor, así
 * que un envío que sí salió deja rastro y el índice único impide duplicarlo.
 */
async function rescatarAtorados(campaignId: string, minutos = 15): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60000).toISOString();
  const { data } = await supabase.from('email_campaign_recipients')
    .update({ estado: 'pendiente', claimed_at: null })
    .eq('campaign_id', campaignId).eq('estado', 'enviando')
    .lt('claimed_at', limite).select('id');
  return (data || []).length;
}

export async function procesar(campaignId: string, presupuestoMs = PRESUPUESTO_MS): Promise<Avance> {
  const inicio = Date.now();
  const vacio: Avance = { procesados: 0, enviados: 0, rechazados: 0, errores: 0, quedan: 0, terminada: false };

  const { data: c } = await supabase.from('email_campaigns').select('*').eq('id', campaignId).maybeSingle();
  if (!c) return { ...vacio, terminada: true, motivo: 'no_existe' };
  if (!['enviando', 'programada'].includes(c.estado)) return { ...vacio, terminada: true, motivo: c.estado };

  const t = await resolverTenant(c.tenant_id);
  if (!t) return { ...vacio, terminada: true, motivo: 'sin_inquilino' };

  if (c.programada_para && new Date(c.programada_para).getTime() > Date.now()) {
    return { ...vacio, motivo: 'aun_no_toca' };
  }
  if (!dentroDeVentana(t)) return { ...vacio, motivo: 'fuera_de_ventana' };

  if (!c.materializada_at) {
    const n = await materializar(t, c as Campana);
    if (n < 0) return { ...vacio, motivo: 'materializando' };   // otro proceso la tiene
  }
  await rescatarAtorados(c.id);
  if (c.estado !== 'enviando') {
    await supabase.from('email_campaigns').update({ estado: 'enviando', iniciada_at: new Date().toISOString() }).eq('id', c.id);
  }

  const av: Avance = { ...vacio };
  const empresasHoy = new Set<string>();

  while (Date.now() - inicio < presupuestoMs) {
    const { data: lote } = await supabase.from('email_campaign_recipients')
      .select('id, email, contact_id, variante').eq('campaign_id', c.id).eq('estado', 'pendiente').limit(LOTE);
    if (!lote?.length) { av.terminada = true; break; }

    // Releer el estado en CADA vuelta: `pausaSalud` y el botón "Pausar" del
    // panel escriben en la BD, pero el bucle trabajaba con la copia leída al
    // entrar. El freno de reputación marcaba "pausada" y seguían saliendo los
    // otros 2,950 correos de una lista que ya estaba rebotando.
    const { data: vivo } = await supabase.from('email_campaigns').select('estado').eq('id', c.id).maybeSingle();
    if (vivo && vivo.estado !== 'enviando' && vivo.estado !== 'programada') {
      av.motivo = vivo.estado; break;
    }

    for (const r of lote) {
      if (Date.now() - inicio >= presupuestoMs) break;

      // CLAIM ATÓMICO — ver la nota de la cabecera.
      const { data: ganado } = await supabase.from('email_campaign_recipients')
        .update({ estado: 'enviando', claimed_at: new Date().toISOString() })
        .eq('id', r.id).eq('estado', 'pendiente').select('id');
      if (!ganado?.length) continue;   // otro proceso lo tomó: seguir en silencio

      av.procesados++;
      try {
      const { html, texto } = await armarCorreo(t, c as Campana, r as any);
      const asunto = (r.variante === 'b' && c.asunto_b) ? c.asunto_b : (c.asunto || '(sin asunto)');

      let companyId: string | null = null;
      if (r.contact_id) {
        const { data: ct } = await supabase.from('contacts').select('company_id').eq('id', r.contact_id).maybeSingle();
        companyId = ct?.company_id || null;
      }
      if (companyId && t.presion_por_empresa && empresasHoy.has(companyId)) {
        await supabase.from('email_campaign_recipients')
          .update({ estado: 'rechazado', motivo: 'presion_empresa', procesado_at: new Date().toISOString() }).eq('id', r.id);
        av.rechazados++;
        continue;
      }

      const res = await enviarCorreo({
        tenantId: t.id, para: r.email, asunto, html, texto,
        categoria: c.categoria, contactId: r.contact_id, companyId,
        campaignId: c.id, templateId: c.template_id, variante: r.variante,
      });

      if (res.enviado) {
        if (companyId) empresasHoy.add(companyId);
        await supabase.from('email_campaign_recipients')
          .update({ estado: 'enviado', send_id: res.sendId, procesado_at: new Date().toISOString() }).eq('id', r.id);
        av.enviados++;
      } else if (res.motivo === 'error' || res.motivo === 'error_proveedor') {
        await supabase.from('email_campaign_recipients')
          .update({ estado: 'error', motivo: res.detalle?.slice(0, 300) || res.motivo, procesado_at: new Date().toISOString() }).eq('id', r.id);
        av.errores++;
      } else {
        await supabase.from('email_campaign_recipients')
          .update({ estado: 'rechazado', motivo: res.motivo, procesado_at: new Date().toISOString() }).eq('id', r.id);
        av.rechazados++;
      }
      } catch (err: any) {
        // Sin este try, una excepción en cualquiera de las consultas por
        // destinatario salía del cron y dejaba la fila reclamada para siempre.
        await supabase.from('email_campaign_recipients')
          .update({ estado: 'error', motivo: String(err?.message || err).slice(0, 300), procesado_at: new Date().toISOString() })
          .eq('id', r.id);
        av.errores++;
      }
    }
    await pausaSalud(c.id);
  }

  // "Quedan" incluye los atorados en 'enviando': una función que murió a media
  // llamada deja filas ahí, y contarlas como cero hacía que la campaña se
  // declarara completada con gente que nunca recibió nada.
  const { count } = await supabase.from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', c.id).in('estado', ['pendiente', 'enviando']);
  av.quedan = count || 0;
  // Los DOS sentidos. Antes solo se ponía en true: una campaña con filas
  // atoradas en 'enviando' (otra instancia, o una función muerta) entraba aquí
  // con terminada=true de más arriba y se cerraba como completada dejando
  // gente sin recibir — y ya no se reanudaba nunca.
  av.terminada = av.quedan === 0;

  await refrescarResumen(c.id);
  if (av.terminada) {
    // Condicionado a 'enviando': sin esto, el cierre pisaba una pausa
    // automática por rebotes y borraba su motivo — la campaña "terminaba"
    // como si nada hubiera pasado.
    await supabase.from('email_campaigns')
      .update({ estado: 'completada', completada_at: new Date().toISOString() })
      .eq('id', c.id).eq('estado', 'enviando');
  }
  return av;
}

/**
 * Freno de mano por reputación: si los rebotes pasan del 2% con una muestra
 * suficiente, la campaña se pausa sola. Mandar los otros 3,000 correos de una
 * lista que rebota es la forma más rápida de quemar un dominio.
 */
async function pausaSalud(campaignId: string): Promise<void> {
  const { count: enviados } = await supabase.from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('estado', 'enviado');
  if ((enviados || 0) < 50) return;
  const { count: rebotes } = await supabase.from('email_sends')
    .select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('estado', 'bounced');
  const tasa = (rebotes || 0) / (enviados || 1);
  if (tasa > 0.02) {
    await supabase.from('email_campaigns').update({
      estado: 'pausada',
      pausa_motivo: `Pausada automáticamente: ${(tasa * 100).toFixed(1)}% de rebotes (límite 2%).`,
    }).eq('id', campaignId);
  }
}

/** Números de la campaña, recalculados desde la verdad (no acumuladores). */
export async function refrescarResumen(campaignId: string): Promise<any> {
  const conteo = async (tabla: string, filtro: (q: any) => any) => {
    const { count } = await filtro(supabase.from(tabla).select('id', { count: 'exact', head: true }));
    return count || 0;
  };
  const dest = await conteo('email_campaign_recipients', (q: any) => q.eq('campaign_id', campaignId));
  const enviados = await conteo('email_campaign_recipients', (q: any) => q.eq('campaign_id', campaignId).eq('estado', 'enviado'));
  const rechazados = await conteo('email_campaign_recipients', (q: any) => q.eq('campaign_id', campaignId).eq('estado', 'rechazado'));
  const errores = await conteo('email_campaign_recipients', (q: any) => q.eq('campaign_id', campaignId).eq('estado', 'error'));
  const pendientes = await conteo('email_campaign_recipients', (q: any) => q.eq('campaign_id', campaignId).eq('estado', 'pendiente'));
  const entregados = await conteo('email_sends', (q: any) => q.eq('campaign_id', campaignId).in('estado', ['delivered', 'opened', 'clicked']));
  const abiertos = await conteo('email_sends', (q: any) => q.eq('campaign_id', campaignId).not('first_opened_at', 'is', null));
  const clics = await conteo('email_sends', (q: any) => q.eq('campaign_id', campaignId).not('clicked_at', 'is', null));
  const rebotes = await conteo('email_sends', (q: any) => q.eq('campaign_id', campaignId).eq('estado', 'bounced'));
  const bajas = await conteo('email_sends', (q: any) => q.eq('campaign_id', campaignId).eq('estado', 'unsubscribed'));

  // Los motivos de rechazo, para que el reporte pueda decir POR QUÉ.
  const { data: motivos } = await supabase.from('email_campaign_recipients')
    .select('motivo').eq('campaign_id', campaignId).eq('estado', 'rechazado').limit(5000);
  const porMotivo: Record<string, number> = {};
  for (const m of motivos || []) porMotivo[m.motivo || 'otro'] = (porMotivo[m.motivo || 'otro'] || 0) + 1;

  const resumen = { destinatarios: dest, enviados, rechazados, errores, pendientes, entregados, abiertos, clics, rebotes, bajas, por_motivo: porMotivo, actualizado: new Date().toISOString() };
  await supabase.from('email_campaigns').update({ resumen }).eq('id', campaignId);
  return resumen;
}

export { pesoKb };
