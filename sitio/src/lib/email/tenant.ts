// El INQUILINO del sistema de email marketing.
//
// Multi-tenant desde el día 1 aunque hoy el único sea SACS: cuando un partner
// use la herramienta para sus leads, su remitente, su logo, su dirección
// física y su footer legal serán suyos — no los nuestros. Nada de eso puede
// vivir en una constante del código, porque el día que exista el segundo
// inquilino habría que reescribir el compilador de plantillas y el pipeline.
//
// La regla de ALCANCE es una sola y ya funciona con los datos de hoy:
//   sin `owner_team_member_id` → es SACS → ve todos los contactos del CRM.
//   con `owner_team_member_id` → es un partner → ve solo los contactos que él
//                                refirió (`contacts.referrer_partner_id`).
import { supabase } from '../supabase';

export interface Tenant {
  id: string;
  slug: string;
  nombre: string;
  from_nombre: string;
  from_email: string;
  reply_to: string | null;
  logo_url: string | null;
  color_acento: string;
  firma_html: string | null;
  direccion_fisica: string | null;
  aviso_privacidad_url: string | null;
  motivo_recepcion: string | null;
  footer_extra: string | null;
  sendgrid_domain_id: string | null;
  sendgrid_asm_group_id: number | null;
  presion_max_semana: number;
  presion_por_empresa: boolean;
  limite_diario: number | null;
  ventana_inicio: string;
  ventana_fin: string;
  timezone: string;
  enviar_fines_semana: boolean;
  activo: boolean;
  owner_team_member_id: string | null;
}

/** El inquilino de casa. Es el default de todo el CRM mientras no haya partners. */
export async function tenantDeCasa(): Promise<Tenant | null> {
  const { data } = await supabase.from('email_tenants').select('*').eq('slug', 'sacs').maybeSingle();
  return (data as Tenant) || null;
}

export async function tenantPorId(id: string): Promise<Tenant | null> {
  const { data } = await supabase.from('email_tenants').select('*').eq('id', id).maybeSingle();
  return (data as Tenant) || null;
}

/** Resuelve el inquilino de una petición: el explícito, o el de casa. */
export async function resolverTenant(tenantId?: string | null): Promise<Tenant | null> {
  return tenantId ? tenantPorId(tenantId) : tenantDeCasa();
}

/**
 * Qué le falta a este inquilino para poder enviar. Lista vacía = listo.
 *
 * Se usa en DOS lugares y por eso vive aquí: el gate visual del panel (que
 * explica qué falta) y el pipeline de envío (que rechaza). Si fueran dos
 * listas distintas, el panel diría "todo listo" mientras el pipeline rechaza.
 */
export function faltantesDeConfiguracion(t: Tenant | null): string[] {
  if (!t) return ['No existe la configuración de correo.'];
  const faltan: string[] = [];
  if (!t.from_email?.trim()) faltan.push('Correo del remitente');
  if (!t.from_nombre?.trim()) faltan.push('Nombre del remitente');
  // Sin dirección física un correo de marketing no sale: es estándar
  // CAN-SPAM y es lo que distingue un remitente serio de un spammer.
  if (!t.direccion_fisica?.trim()) faltan.push('Dirección física del negocio (obligatoria por ley)');
  if (!t.sendgrid_domain_id) faltan.push('Dominio de envío verificado');
  if (!t.activo) faltan.push('Activar el envío de correos');
  return faltan;
}

export const puedeEnviar = (t: Tenant | null): boolean => faltantesDeConfiguracion(t).length === 0;

/**
 * Los contactos que este inquilino puede ver. Devuelve un filtro aplicable a
 * cualquier consulta sobre `contacts`, para que ninguna audiencia pueda
 * alcanzar a un contacto de otro dueño.
 */
export function filtroDeAlcance(t: Tenant) {
  return (q: any) => (t.owner_team_member_id ? q.eq('referrer_partner_id', t.owner_team_member_id) : q);
}
