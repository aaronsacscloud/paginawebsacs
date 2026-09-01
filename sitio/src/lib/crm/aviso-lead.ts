// LEADS · Aviso por WhatsApp al equipo de ventas cuando entra un lead.
//
// Manda un texto al WhatsApp de cada team_member activo con número (dedupe
// por teléfono: tres cuentas del founder no son tres mensajes). Fuera de la
// ventana de 24 h Kapso devuelve 422: se registra y no truena el alta — el
// vendedor debe escribirle "hola" al número del CRM de vez en cuando para
// mantener su ventana abierta (o después migramos a plantilla UTILITY).
import { supabase } from '../supabase';
import { pushLeadNuevo } from './push-crm';
import { enviarTexto, enviarPlantilla } from '../whatsapp/kapso-api';

const URL_LEAD = (id: string) => `https://www.sacscloud.com/admin/crm?tab=pipeline&lead=${id}`;

async function destinos(): Promise<string[]> {
  const { data } = await supabase.from('team_members')
    .select('whatsapp').eq('activo', true).not('whatsapp', 'is', null);
  return [...new Set((data || []).map((m: any) => String(m.whatsapp).trim()).filter(Boolean))];
}

// SIEMPRE por plantilla UTILITY (nuevo_lead_aviso): el texto libre fuera de
// ventana se "aceptaba" pero WhatsApp lo tiraba en silencio — no llegaba.
// La plantilla entrega garantizado y no la bloquean. El texto libre queda
// solo como respaldo si la plantilla fallara. Params sin saltos de línea.
async function mandar(texto: string, vars?: [string, string, string]): Promise<{ tel: string; ok: boolean; via?: string; error?: string }[]> {
  const tels = await destinos();
  const res: { tel: string; ok: boolean; via?: string; error?: string }[] = [];
  for (const t of tels) {
    if (vars) {
      // aviso_pendiente_crm es la UTILITY nueva (tono operativo, sin lenguaje
      // de ventas): Meta recategorizó nuevo_lead_aviso a MARKETING y empezó a
      // limitarla — los avisos morían. La vieja queda de respaldo mientras
      // la nueva está en revisión.
      const params = vars.map(v => String(v || '—').replace(/\s+/g, ' ').slice(0, 300));
      let mandado = false;
      for (const plantilla of ['aviso_pendiente_crm', 'nuevo_lead_aviso']) {
        try {
          await enviarPlantilla(t, plantilla, 'es_MX', params);
          res.push({ tel: t, ok: true, via: `plantilla:${plantilla}` }); mandado = true; break;
        } catch (e: any) { console.warn('[aviso-lead]', plantilla, 'falló para', t, e?.message || e); }
      }
      if (mandado) continue;
    }
    try { await enviarTexto(t, texto); res.push({ tel: t, ok: true, via: 'texto' }); }
    catch (e: any) {
      console.warn('[aviso-lead] no se pudo avisar a', t, e?.message || e);
      res.push({ tel: t, ok: false, error: String(e?.message || e).slice(0, 300) });
      /* UN aviso al día por número. Medido el 1-sep: de 65 avisos internos a
         un mismo teléfono del equipo, 31 fallaron — y el único rastro era un
         console.warn que nadie lee. Un canal de avisos roto a la mitad es
         peor que no tenerlo: se cree que el equipo está enterado. */
      await avisarCanalRoto(t, String(e?.message || e));
    }
  }
  return res;
}

/** Que un canal de avisos internos esté fallando TIENE que verse. */
async function avisarCanalRoto(telefono: string, motivo: string) {
  try {
    const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { data: ya } = await supabase.from('crm_notificaciones')
      .select('id').eq('tipo', 'aviso_interno_falla').gte('created_at', desde)
      .contains('metadata', { telefono }).limit(1);
    if (ya?.length) return;
    const { data: quien } = await supabase.from('team_members')
      .select('nombre').eq('whatsapp', telefono).maybeSingle();
    await supabase.from('crm_notificaciones').insert({
      tipo: 'aviso_interno_falla', nivel: 'alerta', destino: 'config',
      titulo: `No le están llegando los avisos a ${quien?.nombre || telefono}`,
      detalle: `WhatsApp rechazó el aviso interno: ${motivo.slice(0, 180)}. Mientras esto siga así, esa persona NO se está enterando de los leads nuevos.`,
      metadata: { telefono },
    });
  } catch { /* avisar del fallo no puede provocar otro */ }
}

/** Un lead nuevo, con su info básica y el link directo a su ficha. */
export async function avisarNuevoLead(c: { id: string; nombre?: string | null; apellido?: string | null; whatsapp?: string | null; telefono?: string | null; email?: string | null; campana?: string | null; fuente?: string | null }, extra?: string) {
  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre';
  const lineas = [
    `🔔 Nuevo lead: *${nombre}*`,
    [c.whatsapp || c.telefono, c.email].filter(Boolean).join(' · '),
    c.campana ? `Campaña: ${c.campana}` : (c.fuente ? `Fuente: ${c.fuente}` : ''),
    extra || '',
    `Verlo: ${URL_LEAD(c.id)}`,
  ].filter(Boolean);
  // El push va junto al WhatsApp y desde el MISMO lugar: si un día cambia qué
  // cuenta como «lead nuevo», cambia en un solo sitio.
  pushLeadNuevo(c).catch(() => {});
  return mandar(lineas.join('\n'), [nombre, [c.whatsapp || c.telefono, c.email, c.campana || c.fuente].filter(Boolean).join(' · ') || 'sin datos', c.id]);
}

/** Aviso agrupado (imports por lote): uno por lead sería spam. */
export async function avisarLoteLeads(n: number, nombres: string[], origen: string) {
  if (n <= 0) return;
  const lista = nombres.slice(0, 6).join(', ') + (n > 6 ? ` y ${n - 6} más` : '');
  await mandar(`🔔 ${n} lead${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'} de ${origen}: ${lista}\nVerlos: https://www.sacscloud.com/admin/crm?tab=pipeline`,
    [`${n} leads de ${origen}`, lista, 'lista']);
}

/** SLA: leads sin primer toque, agrupados en un solo mensaje. */
// El lead canceló su sesión: ventas debe saberlo YA (es rescatable en caliente).
export async function avisarCancelacion(c: { id: string; nombre?: string | null; whatsapp?: string | null; email?: string | null }, fecha: string) {
  const nombre = c.nombre || c.whatsapp || c.email || 'Sin nombre';
  return mandar(
    `Cancelación de sesión: ${nombre} (${fecha}). Márcale para rescatarla.`,
    [`1 sesión cancelada (${fecha}) — rescatable si se le marca pronto`, String(nombre),
      URL_LEAD(c.id)],
  );
}

// Leads que abren correos de la secuencia pero no contestan: intención pura.
export async function avisarCalientes(leads: { id: string; nombre: string; abiertos: number }[]) {
  const nombres = leads.map(l => `${l.nombre} (${l.abiertos} correos abiertos)`).join(', ').slice(0, 250);
  return mandar(
    `Leads calientes en el CRM: ${nombres}. Buen momento para llamarles.`,
    [`${leads.length} lead(s) caliente(s): abren los correos y no responden`, nombres,
      'https://www.sacscloud.com/admin/crm?tab=pipeline&lead=lista'],
  );
}

export async function avisarSLA(leads: { id: string; nombre: string; mins: number }[]) {
  if (!leads.length) return;
  const filas = leads.slice(0, 8).map(l => `· ${l.nombre} — ${l.mins} min sin toque`).join('\n');
  await mandar(`⏰ *Leads esperando el primer contacto:*\n${filas}${leads.length > 8 ? `\n…y ${leads.length - 8} más` : ''}\nAtiéndelos: https://www.sacscloud.com/admin/crm?tab=pipeline`,
    [`${leads.length} lead${leads.length === 1 ? '' : 's'} sin primer toque`, leads.slice(0, 6).map(l => `${l.nombre} (${l.mins} min)`).join(' · '), 'lista']);
}
