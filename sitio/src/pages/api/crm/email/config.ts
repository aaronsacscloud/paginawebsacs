// GET/PUT /api/crm/email/config — la configuración del inquilino.
//
// TODO lo que un remitente necesita hacer suyo vive aquí: nombre y correo del
// remitente, logo, color, firma, dirección física, aviso de privacidad, el
// motivo de recepción y las políticas de cadencia. Cuando un partner use la
// herramienta, esta misma pantalla será la suya — por eso nada de esto está
// en el código.
//
// Bajo el middleware admin (founder/cs). El GET devuelve además qué FALTA
// para poder enviar, calculado con la MISMA función que usa el pipeline: si
// fueran dos listas distintas, el panel diría "listo" mientras el envío falla.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant, faltantesDeConfiguracion } from '../../../../lib/email/tenant';
import { proveedorListo } from '../../../../lib/email/proveedor';
import { tokensListos } from '../../../../lib/email/token';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/** Solo estos campos se pueden editar desde el panel. */
const EDITABLES = [
  'nombre', 'from_nombre', 'from_email', 'reply_to', 'logo_url', 'color_acento', 'firma_html',
  'direccion_fisica', 'aviso_privacidad_url', 'motivo_recepcion', 'footer_extra',
  'presion_max_semana', 'presion_por_empresa', 'limite_diario',
  'ventana_inicio', 'ventana_fin', 'timezone', 'enviar_fines_semana', 'activo',
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'No existe la configuración de correo.' }, 404);

  // El dominio del remitente: lo que decide si el correo se ve legítimo.
  const dominio = String(t.from_email || '').split('@')[1] || null;

  return json({
    tenant: t,
    faltantes: faltantesDeConfiguracion(t),
    entorno: {
      proveedor_listo: proveedorListo(),
      tokens_listos: tokensListos(),
      dominio_remitente: dominio,
    },
  });
};

export const PUT: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'No existe la configuración de correo.' }, 404);

  const body = await request.json().catch(() => ({} as any));
  const updates: Record<string, any> = {};
  for (const k of EDITABLES) if (k in body) updates[k] = body[k];

  // Validaciones que evitan un correo roto en producción:
  if ('from_email' in updates && !EMAIL_RE.test(String(updates.from_email || ''))) {
    return json({ error: 'El correo del remitente no es válido.' }, 400);
  }
  if ('reply_to' in updates && updates.reply_to && !EMAIL_RE.test(String(updates.reply_to))) {
    return json({ error: 'El correo de respuesta no es válido.' }, 400);
  }
  if ('presion_max_semana' in updates) {
    const n = Number(updates.presion_max_semana);
    if (!Number.isInteger(n) || n < 1 || n > 14) return json({ error: 'El máximo por semana debe estar entre 1 y 14.' }, 400);
  }
  // Encender el envío exige tener todo lo obligatorio: si no, el gate del
  // panel diría "activo" y cada envío se rechazaría sin explicación.
  if (updates.activo === true) {
    const faltan = faltantesDeConfiguracion({ ...t, ...updates, activo: true } as any);
    if (faltan.length) return json({ error: 'Falta configurar: ' + faltan.join(' · '), faltantes: faltan }, 400);
  }

  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('email_tenants').update(updates).eq('id', t.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ tenant: data, faltantes: faltantesDeConfiguracion(data as any) });
};
