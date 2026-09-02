// TRABAJO INTELIGENTE · PROMOCIONES VIGENTES (decisión del dueño, 2026-09-02, S6).
// El 35 % en el anual + implementación y migración sin costo (valor $9,500) se maneja SIEMPRE como algo
// especial y por tiempo limitado (7 a 10 días); la ventana va rotando sola al vencer. El agente la
// menciona como plus al dar precio, sin sonar vendedor, y se guarda por lead QUÉ oferta se le dijo y
// hasta cuándo, para que el consultor lo vea y el agente no prometa lo vencido.
import { supabase } from '../../supabase';

export type Promo = { id: string; nombre: string; texto: string; valor?: string | null; dias_ventana: number; vence: string; rotar: boolean; activa: boolean; palabras?: string[] };
export type OfertaDicha = { promo_id: string; nombre: string; texto: string; dicho_at: string; vence: string };

const DEFAULT: Promo = {
  id: 'promo-35-implementacion', nombre: '35 % en anual + implementación y migración sin costo',
  texto: '35 % de descuento en el plan anual, y la implementación y migración de tu Excel o sistema (que normalmente vale $9,500) sin costo',
  valor: '$9,500', dias_ventana: 10, vence: '', rotar: true, activa: true, palabras: ['35 %', '35%', 'migraci', 'implementaci'],
};

async function cfg() { const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle(); return (data?.valor as any) || {}; }
async function guardarCfg(parche: any) { const v = await cfg(); await supabase.from('ti_config').update({ valor: { ...v, ...parche } }).eq('id', 1); }

/** La promoción vigente (rotando la ventana si venció y así está configurado). */
export async function promoVigente(): Promise<Promo | null> {
  const v = await cfg();
  let lista: Promo[] = Array.isArray(v.promociones) ? v.promociones : [];
  if (!lista.length) { lista = [{ ...DEFAULT, vence: new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10) }]; await guardarCfg({ promociones: lista }); }
  let cambio = false;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const p of lista) {
    if (!p.activa) continue;
    if (!p.vence || p.vence < hoy) {
      if (p.rotar) {
        // La ventana rota: alterna entre 7 y 10 días para que no se vea fija.
        const dias = p.dias_ventana === 10 ? 7 : 10;
        p.dias_ventana = dias; p.vence = new Date(Date.now() + dias * 86400e3).toISOString().slice(0, 10); cambio = true;
      } else { p.activa = false; cambio = true; }
    }
  }
  if (cambio) await guardarCfg({ promociones: lista });
  return lista.find(p => p.activa) || null;
}

export async function listarPromos(): Promise<Promo[]> { const v = await cfg(); return Array.isArray(v.promociones) ? v.promociones : []; }
export async function guardarPromos(lista: Promo[]) { await guardarCfg({ promociones: lista }); }

const fechaLarga = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }); };
const diasHasta = (iso: string) => Math.max(0, Math.round((Date.parse(iso + 'T23:59:59-06:00') - Date.now()) / 86400e3));

/** Bloque para el prompt: la promoción vigente y, si ya se le dijo a este lead, cuándo y hasta cuándo. */
export function promoTexto(p: Promo | null, dicha?: OfertaDicha | null): string {
  if (!p) return dicha ? `OFERTA YA DICHA A ESTE LEAD: «${dicha.texto}» (vencía el ${fechaLarga(dicha.vence)}, ya NO está vigente: no la repitas ni la prometas).` : '';
  const base = `PROMOCIÓN VIGENTE: ${p.texto}. Vigente hasta el ${fechaLarga(p.vence)} (${diasHasta(p.vence)} días). Se dice UNA vez, como plus al hablar de precio, con naturalidad y sin sonar vendedor.`;
  if (dicha && dicha.promo_id === p.id) return `${base}\nOFERTA YA DICHA A ESTE LEAD el ${new Date(dicha.dicho_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}, con vencimiento ${fechaLarga(dicha.vence)}: no la repitas como novedad; úsala solo para dar contexto de tiempo si él decide.`;
  return base;
}

/** Si el mensaje que salió menciona la promoción, queda registrado en el contacto (qué se le dijo y hasta cuándo). */
export async function registrarOfertaDicha(contactId: string | null | undefined, mensaje: string, p: Promo | null): Promise<boolean> {
  if (!contactId || !p) return false;
  const pal = (p.palabras && p.palabras.length ? p.palabras : ['35 %', '35%', 'migraci', 'implementaci']).map(x => x.toLowerCase());
  const m = String(mensaje || '').toLowerCase();
  const menciona = pal.some(x => m.includes(x)) && /35\s?%|sin costo|gratis|promo/i.test(mensaje);
  if (!menciona) return false;
  const { data: c } = await supabase.from('contacts').select('propiedades').eq('id', contactId).maybeSingle();
  const props: any = (c?.propiedades && typeof c.propiedades === 'object') ? { ...(c.propiedades as any) } : {};
  const ofertas: OfertaDicha[] = Array.isArray(props.ofertas) ? props.ofertas : [];
  if (ofertas.some(o => o.promo_id === p.id && o.vence === p.vence)) return false;
  ofertas.push({ promo_id: p.id, nombre: p.nombre, texto: p.texto, dicho_at: new Date().toISOString(), vence: p.vence });
  props.ofertas = ofertas.slice(-10);
  await supabase.from('contacts').update({ propiedades: props, updated_at: new Date().toISOString() }).eq('id', contactId);
  await supabase.from('activities').insert({ contact_id: contactId, tipo: 'oferta_dicha', titulo: `Se le ofreció: ${p.nombre} (vence ${p.vence})`, descripcion: p.texto, automatico: true, metadata: { promo_id: p.id, vence: p.vence } }).then(() => {}, () => {});
  return true;
}

export const ultimaOferta = (propiedades: any): OfertaDicha | null => { const l: OfertaDicha[] = Array.isArray(propiedades?.ofertas) ? propiedades.ofertas : []; return l.length ? l[l.length - 1] : null; };
