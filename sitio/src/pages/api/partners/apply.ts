// POST /api/partners/apply
// Endpoint público — flujo end-to-end de aplicación de partner.
// El usuario llena form (3 pasos), firma contrato, y queda en
// estado='submitted_for_review' listo para que admin apruebe.
//
// No hay paso intermedio "draft → sent" — la aplicación pública
// ES la firma. Admin solo aprueba o rechaza.
//
// Side-effects:
// - INSERT partner_invitations (estado=submitted_for_review)
// - Email confirmación al aplicante con folio + timeline
// - Email a sales inbox: "Nueva solicitud por revisar"
// - Activity log

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify, getSalesInbox } from '../../../lib/notify';

export const prerender = false;

const ALLOWED_TIPOS = ['embajador', 'distribuidor', 'integrador', 'reseller', 'consultor'];

// Folio sequence: empieza en 578 para que se vea como si ya hubiera 577 partners.
// Se computa con max(numero existente) + 1, garantizado mín 578.
const FOLIO_OFFSET = 578;

const NOTAS_SEP = '\n---META---\n';
function buildNotas(plain: string, meta: Record<string, any>): string {
  return `${plain || ''}${NOTAS_SEP}${JSON.stringify(meta)}`;
}

// Rate limit (in-memory, per IP, per hour)
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function isValidEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isValidUrl(s: string) {
  if (!s) return true;
  try { const u = new URL(s.startsWith('http') ? s : `https://${s}`); return !!u.hostname; } catch { return false; }
}
function isLikelySpam(s: string) {
  const urlCount = (s.match(/https?:\/\//gi) || []).length;
  if (urlCount > 3) return true;
  if (s.length > 30 && s === s.toUpperCase()) return true;
  if (/(.)\1{8,}/.test(s)) return true;
  return false;
}

async function nextFolio(): Promise<string> {
  // Find max existing PA-NNN folio number, return next (with FOLIO_OFFSET min)
  const { data } = await supabase
    .from('partner_invitations')
    .select('numero')
    .like('numero', 'PA-%')
    .order('numero', { ascending: false })
    .limit(50);

  let maxN = FOLIO_OFFSET - 1; // so first one becomes 578
  for (const row of data || []) {
    // Match plain "PA-NNN" (without date suffix). Ignore old "PA-YYMMDD-XXX" formats.
    const m = (row.numero || '').match(/^PA-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }
  const next = maxN + 1;
  return `PA-${next}`;
}

interface SocialHandle { platform: string; handle?: string; followers?: number; }

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return j({ error: 'Demasiadas solicitudes. Intenta de nuevo en 1 hora.' }, 429);
    }

    const body = await request.json() as {
      // Step 1: Datos básicos
      nombre?: string; email?: string; whatsapp?: string;
      empresa?: string; ciudad?: string; estado?: string;
      // Step 2: Audiencia
      website?: string;
      social?: SocialHandle[];
      audiencia_total?: number;
      experiencia_retail?: string;
      como_supo?: string;
      tipo?: string;
      // Step 3: Motivo + firma
      motivo?: string;
      firma_base64?: string;
      acepta_terminos?: boolean;
      // Anti-spam honeypot
      _bot_field?: string;
    };

    // Honeypot: invisible field — if filled, silently succeed (bot)
    if (body._bot_field && body._bot_field.length > 0) {
      console.warn('[apply] honeypot triggered from', ip);
      return j({ ok: true, numero: 'PA-BOT' });
    }

    const nombre = (body.nombre || '').trim().slice(0, 120);
    const email = (body.email || '').trim().toLowerCase().slice(0, 200);
    const whatsapp = (body.whatsapp || '').trim().slice(0, 30);
    const tipo = ALLOWED_TIPOS.includes(body.tipo || '') ? body.tipo : 'embajador';
    const empresa = (body.empresa || '').trim().slice(0, 120) || null;
    const ciudad = (body.ciudad || '').trim().slice(0, 80) || null;
    const estadoMx = (body.estado || '').trim().slice(0, 80) || null;
    const website = (body.website || '').trim().slice(0, 200) || null;
    const motivo = (body.motivo || '').trim().slice(0, 1500) || null;
    const experiencia_retail = (body.experiencia_retail || '').trim().slice(0, 30) || null;
    const como_supo = (body.como_supo || '').trim().slice(0, 50) || null;
    const audiencia_total = Number(body.audiencia_total) || 0;
    const acepta_terminos = !!body.acepta_terminos;
    const firma_base64 = body.firma_base64 || null;
    const social = Array.isArray(body.social) ? body.social.slice(0, 6).map(s => ({
      platform: String(s.platform || '').slice(0, 30),
      handle: String(s.handle || '').slice(0, 60) || undefined,
      followers: Number(s.followers) || 0,
    })) : [];

    // Validations
    if (!nombre || !email || !whatsapp) return j({ error: 'Nombre, email y WhatsApp son requeridos' }, 400);
    if (!isValidEmail(email)) return j({ error: 'Email inválido' }, 400);
    if (website && !isValidUrl(website)) return j({ error: 'URL de website inválida' }, 400);
    if (!motivo || motivo.length < 30) return j({ error: 'Cuéntanos por qué te interesa SACS (mínimo 30 caracteres)' }, 400);
    if (motivo && isLikelySpam(motivo)) {
      console.warn('[apply] spam-like motivo from', ip);
      return j({ ok: true });
    }
    if (!acepta_terminos) return j({ error: 'Debes aceptar los términos del programa' }, 400);
    if (!firma_base64 || !firma_base64.startsWith('data:image/')) {
      return j({ error: 'Firma requerida — dibuja con tu dedo o mouse' }, 400);
    }

    // Duplicate check (silent ok)
    const { data: existing } = await supabase
      .from('partner_invitations')
      .select('id, estado, numero')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (existing && ['draft', 'sent', 'viewed', 'submitted_for_review', 'accepted'].includes(existing.estado)) {
      return j({ ok: true, already_exists: true, numero: existing.numero });
    }

    const numero = await nextFolio();

    // Defaults por tipo (Embajador es el principal)
    const defaults: Record<string, any> = {
      embajador:    { comision_pct: 50, tabulador: { prueba_gratis: 250, demo_completada: 300, venta_directa_pct: 50, moneda: 'MXN' } },
      distribuidor: { comision_pct: 30, tabulador: { prueba_gratis: 0, demo_completada: 300, venta_directa_pct: 30, moneda: 'MXN' } },
      integrador:   { comision_pct: 25, tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 25, moneda: 'MXN' } },
      reseller:     { comision_pct: 20, tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 20, moneda: 'MXN' } },
      consultor:    { comision_pct: 15, tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 15, moneda: 'MXN' } },
    };
    const def = defaults[tipo as string] || defaults.embajador;

    const meta = {
      origen: 'apply-form-v2',
      ciudad,
      estadoMx,
      website,
      social,
      audiencia_total,
      experiencia_retail,
      como_supo,
      motivo,
      firma_base64,
      signed_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      ip,
      user_agent: request.headers.get('user-agent') || null,
    };

    const vigencia = new Date();
    vigencia.setDate(vigencia.getDate() + 30);

    const { data: invitation, error } = await supabase
      .from('partner_invitations')
      .insert({
        numero,
        tipo,
        nombre,
        email,
        whatsapp,
        empresa,
        comision_pct: def.comision_pct,
        costo_unico: 0,
        costo_mensual: 0,
        moneda: 'MXN',
        vigencia: vigencia.toISOString().slice(0, 10),
        estado: 'submitted_for_review',
        template: 'modern',
        tabulador: def.tabulador,
        notas: buildNotas('', meta),
        aceptado_por: nombre,
        aceptado_fecha: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[apply] insert failed:', error);
      return j({ error: error.message }, 500);
    }

    // Email a ventas inbox (revisión)
    try {
      const programaLabels: Record<string, string> = {
        embajador: 'Embajador SACS', distribuidor: 'Distribuidor', integrador: 'Integrador',
        reseller: 'Reseller', consultor: 'Consultor',
      };
      const totalFollowers = social.reduce((s, h) => s + (h.followers || 0), 0);
      await notify({
        channel: 'email',
        to: getSalesInbox(),
        template: 'partner_application_admin',
        data: {
          nombre, email, whatsapp,
          empresa: empresa || '—',
          ciudad: [ciudad, estadoMx].filter(Boolean).join(', ') || '—',
          tipo: programaLabels[tipo as string] || tipo,
          motivo,
          website: website || '—',
          social_summary: social.length
            ? social.filter(s => s.handle).map(s => `${s.platform}: ${s.handle} (${(s.followers || 0).toLocaleString('es-MX')} seguidores)`).join(' · ')
            : '—',
          followers_total: totalFollowers,
          experiencia_retail: experiencia_retail || '—',
          como_supo: como_supo || '—',
          adminUrl: `https://www.sacscloud.com/admin/crm?tab=partners`,
          numero,
        },
      });
    } catch (e) { console.warn('[apply] notify admin failed:', e); }

    // Confirmación al aplicante
    try {
      await notify({
        channel: 'email', to: email,
        template: 'partner_application_user',
        data: { nombre, tipo, numero },
      });
    } catch (e) { console.warn('[apply] notify applicant failed:', e); }

    // Activity log
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Nueva solicitud firmada: ${nombre} (${tipo}) — ${numero}`,
        metadata: { partner_invitation_id: invitation.id, numero, email, audiencia_total },
        automatico: true,
      });
    } catch (e) { console.warn('[apply] activity insert failed:', e); }

    return j({ ok: true, numero });
  } catch (err: any) {
    console.error('[apply] handler error:', err);
    return j({ error: err?.message || String(err) }, 500);
  }
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
