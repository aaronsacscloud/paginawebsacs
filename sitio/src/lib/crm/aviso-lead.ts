// LEADS · Aviso por WhatsApp al equipo de ventas cuando entra un lead.
//
// Manda un texto al WhatsApp de cada team_member activo con número (dedupe
// por teléfono: tres cuentas del founder no son tres mensajes). Fuera de la
// ventana de 24 h Kapso devuelve 422: se registra y no truena el alta — el
// vendedor debe escribirle "hola" al número del CRM de vez en cuando para
// mantener su ventana abierta (o después migramos a plantilla UTILITY).
import { supabase } from '../supabase';
import { enviarTexto } from '../whatsapp/kapso-api';

const URL_LEAD = (id: string) => `https://www.sacscloud.com/admin/crm?tab=pipeline&lead=${id}`;

async function destinos(): Promise<string[]> {
  const { data } = await supabase.from('team_members')
    .select('whatsapp').eq('activo', true).not('whatsapp', 'is', null);
  return [...new Set((data || []).map((m: any) => String(m.whatsapp).trim()).filter(Boolean))];
}

async function mandar(texto: string): Promise<{ tel: string; ok: boolean; error?: string }[]> {
  const tels = await destinos();
  const res: { tel: string; ok: boolean; error?: string }[] = [];
  for (const t of tels) {
    try { await enviarTexto(t, texto); res.push({ tel: t, ok: true }); }
    catch (e: any) {
      console.warn('[aviso-lead] no se pudo avisar a', t, e?.message || e);
      res.push({ tel: t, ok: false, error: String(e?.message || e).slice(0, 300) });
    }
  }
  return res;
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
  return mandar(lineas.join('\n'));
}

/** Aviso agrupado (imports por lote): uno por lead sería spam. */
export async function avisarLoteLeads(n: number, nombres: string[], origen: string) {
  if (n <= 0) return;
  const lista = nombres.slice(0, 6).join(', ') + (n > 6 ? ` y ${n - 6} más` : '');
  await mandar(`🔔 ${n} lead${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'} de ${origen}: ${lista}\nVerlos: https://www.sacscloud.com/admin/crm?tab=pipeline`);
}

/** SLA: leads sin primer toque, agrupados en un solo mensaje. */
export async function avisarSLA(leads: { id: string; nombre: string; mins: number }[]) {
  if (!leads.length) return;
  const filas = leads.slice(0, 8).map(l => `· ${l.nombre} — ${l.mins} min sin toque`).join('\n');
  await mandar(`⏰ *Leads esperando el primer contacto:*\n${filas}${leads.length > 8 ? `\n…y ${leads.length - 8} más` : ''}\nAtiéndelos: https://www.sacscloud.com/admin/crm?tab=pipeline`);
}
