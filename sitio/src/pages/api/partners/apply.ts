// POST /api/partners/apply
// Endpoint público — se llama desde la landing /partners cuando alguien se postula.
// Crea un partner_invitations en estado=draft con sus datos, listo para que
// el admin lo revise y lo envíe (estado=sent) o lo descarte.
//
// Side-effects:
// - INSERT partner_invitations (estado=draft, tipo=embajador|distribuidor|...)
// - Email a sales inbox: "Nueva aplicación de partner"
// - Activity log

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify, getSalesInbox } from '../../../lib/notify';

export const prerender = false;

const ALLOWED_TIPOS = ['embajador', 'distribuidor', 'integrador', 'reseller', 'consultor'];

const NOTAS_SEP = '\n---META---\n';
function buildNotas(plain: string, meta: Record<string, any>): string {
  return `${plain || ''}${NOTAS_SEP}${JSON.stringify(meta)}`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json() as {
      nombre?: string; email?: string; whatsapp?: string;
      empresa?: string; tipo?: string; ciudad?: string; motivo?: string;
    };

    const nombre = (body.nombre || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const whatsapp = (body.whatsapp || '').trim();
    const tipo = ALLOWED_TIPOS.includes(body.tipo || '') ? body.tipo : 'embajador';
    const empresa = (body.empresa || '').trim() || null;
    const ciudad = (body.ciudad || '').trim() || null;
    const motivo = (body.motivo || '').trim() || null;

    if (!nombre || !email || !whatsapp) {
      return j({ error: 'nombre, email y whatsapp son requeridos' }, 400);
    }

    // Check duplicate by email (avoid spam) — if there's already a draft/sent
    // invitation for this email, return ok=true silently.
    const { data: existing } = await supabase
      .from('partner_invitations')
      .select('id, estado')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (existing && ['draft', 'sent', 'viewed', 'submitted_for_review', 'accepted'].includes(existing.estado)) {
      return j({ ok: true, already_exists: true });
    }

    // Generate folio: PA-XXXX (max 4 digits, sequential per day)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const numero = `PA-${today.slice(2)}-${Math.floor(Math.random() * 900 + 100)}`;

    // Defaults para Embajador (50% / $500 / $300). Otros tipos usan defaults
    // del PartnersTab admin, pero aquí preferimos mantener simples y dejar
    // que el admin ajuste antes de enviar.
    const defaults: Record<string, any> = {
      embajador:    { comision_pct: 50, costo_unico: 0, costo_mensual: 0, tabulador: { prueba_gratis: 500, demo_completada: 300, venta_directa_pct: 50, moneda: 'MXN' } },
      distribuidor: { comision_pct: 30, tabulador: { prueba_gratis: 0, demo_completada: 300, venta_directa_pct: 30, moneda: 'MXN' } },
      integrador:   { comision_pct: 25, tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 25, moneda: 'MXN' } },
      reseller:     { comision_pct: 20, tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 20, moneda: 'MXN' } },
      consultor:    { comision_pct: 15, tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 15, moneda: 'MXN' } },
    };
    const def = defaults[tipo as string] || defaults.embajador;

    const meta = {
      origen: 'apply-form',
      ciudad,
      motivo,
      ip: clientAddress || null,
      submitted_at: new Date().toISOString(),
    };

    // Vigencia: 30 días por default
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
        costo_unico: def.costo_unico ?? 0,
        costo_mensual: def.costo_mensual ?? 0,
        moneda: 'MXN',
        vigencia: vigencia.toISOString().slice(0, 10),
        estado: 'draft',
        template: 'modern',
        tabulador: def.tabulador,
        notas: buildNotas('', meta),
      })
      .select()
      .single();

    if (error) {
      console.error('[apply] insert failed:', error);
      return j({ error: error.message }, 500);
    }

    // Notify ventas inbox
    try {
      await notify({
        channel: 'email',
        to: getSalesInbox(),
        template: 'partner_application_admin',
        data: {
          nombre,
          email,
          whatsapp,
          empresa: empresa || '—',
          ciudad: ciudad || '—',
          tipo,
          motivo: motivo || '—',
          adminUrl: `https://www.sacscloud.com/admin/crm?tab=partners`,
          numero,
        },
      });
    } catch (e) {
      console.warn('[apply] notify admin failed:', e);
    }

    // Activity log
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Nueva aplicación a partners: ${nombre} (${tipo})`,
        metadata: { partner_invitation_id: invitation.id, partner_invitation_numero: numero, email, motivo },
        automatico: true,
      });
    } catch (e) { console.warn('[apply] activity insert failed:', e); }

    return j({ ok: true, numero });
  } catch (err: any) {
    return j({ error: err?.message || String(err) }, 500);
  }
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
