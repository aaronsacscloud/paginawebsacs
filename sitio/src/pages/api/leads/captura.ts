// LEADS · Webhook GENÉRICO de captura: conecta cualquier formulario nuevo
// (Meta Ads, typeform, landing de terceros) SIN tocar código.
//
//   POST /api/leads/captura?fuente=<slug>
//   Header: x-captura-token: <LEADS_CAPTURA_TOKEN>
//   Body JSON: { nombre, apellido?, email?, whatsapp?, telefono?, empresa?,
//               campana?, giro?, sucursales?, ...extra }
//
// Anti-duplicado por teléfono/correo: si ya existe, NO crea otra ficha — le
// firma una actividad ("volvió a llenar un formulario") y avisa igual.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { avisarNuevoLead } from '../../../lib/crm/aviso-lead';
import { notificar } from '../../../lib/crm/notificaciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const tel10 = (t?: string | null) => String(t || '').replace(/\D/g, '').slice(-10);

export const POST: APIRoute = async ({ request, url }) => {
  const token = request.headers.get('x-captura-token') || url.searchParams.get('token') || '';
  const esperado = import.meta.env.LEADS_CAPTURA_TOKEN;
  if (!esperado || token !== esperado) return json({ error: 'token inválido' }, 401);

  const fuente = (url.searchParams.get('fuente') || 'externo').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'body JSON requerido' }, 400); }

  const email = String(b.email || '').trim().toLowerCase() || null;
  const telRaw = String(b.whatsapp || b.telefono || '').replace(/[^\d+]/g, '') || null;
  const tel = telRaw && tel10(telRaw).length === 10 ? (telRaw.startsWith('+') ? telRaw : '+52' + tel10(telRaw)) : telRaw;
  if (!email && !tel) return json({ error: 'se necesita email o teléfono' }, 400);

  // ── anti-duplicado ──
  let existente: any = null;
  if (email) ({ data: existente } = await supabase.from('contacts').select('id, nombre').eq('email', email).is('archived_at', null).limit(1).maybeSingle());
  if (!existente && tel) {
    const { data } = await supabase.from('contacts').select('id, nombre, whatsapp, telefono').is('archived_at', null)
      .or(`whatsapp.ilike.%${tel10(tel)},telefono.ilike.%${tel10(tel)}`).limit(1).maybeSingle();
    existente = data;
  }
  if (existente) {
    await supabase.from('activities').insert({ contact_id: existente.id, tipo: 'formulario', titulo: `Volvió a llenar un formulario (${fuente})`, automatico: true, metadata: { fuente, body: b } });
    avisarNuevoLead({ id: existente.id, nombre: existente.nombre, email, whatsapp: tel, fuente: `Formulario ${fuente}` }, 'Ya estaba en el CRM: volvió a levantar la mano.').catch(() => {});
    return json({ ok: true, contact_id: existente.id, duplicado: true });
  }

  const conocidos = ['nombre', 'apellido', 'email', 'whatsapp', 'telefono', 'empresa', 'campana', 'giro', 'sucursales'];
  const extra: Record<string, any> = {};
  for (const [k, v] of Object.entries(b)) if (!conocidos.includes(k) && v != null && String(v).length < 500) extra[k] = v;

  const { data: nuevo, error } = await supabase.from('contacts').insert({
    nombre: String(b.nombre || '').trim() || null, apellido: String(b.apellido || '').trim() || null,
    email, whatsapp: tel, tipo: 'lead', lifecycle_stage: 'lead',
    fuente: `form-${fuente}`, origen_alta: 'webhook_form',
    campana: String(b.campana || '').trim() || null,
    giro: String(b.giro || '').trim() || null,
    sucursales_interes: Number(b.sucursales) || null,
    estatus_lead: 'nuevo', estatus_lead_at: new Date().toISOString(),
    propiedades: Object.keys(extra).length ? { form: extra } : {},
  }).select('id').single();
  if (error) return json({ error: error.message }, 500);

  await notificar({ clave: `lead_form_${nuevo.id}`, tipo: 'lead_nuevo', titulo: `Lead nuevo por formulario (${fuente}): ${b.nombre || email || tel}`, metadata: { contact_id: nuevo.id } }).catch(() => {});
  avisarNuevoLead({ id: nuevo.id, nombre: b.nombre, apellido: b.apellido, email, whatsapp: tel, campana: b.campana, fuente: `Formulario ${fuente}` }).catch(() => {});
  return json({ ok: true, contact_id: nuevo.id });
};
