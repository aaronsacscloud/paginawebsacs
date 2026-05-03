import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { supabase } from '../../lib/supabase';
import { getReferrerFromRequest } from '../../lib/attribution';
import { createPruebaGratisBonus } from '../../lib/commissions/calculate';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';
const SHEET_ID = (import.meta.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();

function getGoogleAuth() {
  const b64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';
  if (!b64) return null;
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function parseUserAgent(ua: string): { device: string; browser: string } {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? 'Tablet' : isMobile ? 'Móvil' : 'Computadora';

  let browser = 'Otro';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return { device, browser };
}

async function appendToSheet(data: Record<string, string>, userAgent: string) {
  if (!SHEET_ID) return;
  const auth = getGoogleAuth();
  if (!auth) return;

  const sheets = google.sheets({ version: 'v4', auth });

  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hora = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

  const { device, browser } = parseUserAgent(userAgent);

  const row = [
    fecha,
    hora,
    data.nombre || '',
    data.empresa || '',
    data.email || '',
    data.whatsapp || '',
    data.giro || '',
    data.sucursales || '',
    data.plan || '',
    data.paso || '',
    device,
    browser,
    data.score || '0',
    data.totalTime || '0',
    data.pageCount || '0',
    data.pagesVisited || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Leads!A:P',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Save to Stripe
    const params = new URLSearchParams();
    params.append('email', data.email || `lead-${Date.now()}@noemail.com`);
    params.append('name', data.nombre || '');
    params.append('phone', data.whatsapp || '');
    params.append('metadata[empresa]', data.empresa || '');
    params.append('metadata[giro]', data.giro || '');
    params.append('metadata[sucursales]', data.sucursales || '');
    params.append('metadata[paso]', data.paso || '');
    params.append('metadata[plan]', data.plan || '');
    params.append('metadata[source]', 'website-lead');
    params.append('metadata[fecha]', new Date().toISOString());
    params.append('metadata[score]', data.score || '0');
    params.append('metadata[totalTime]', data.totalTime || '0');
    params.append('metadata[pagesVisited]', (data.pagesVisited || '').substring(0, 500));
    params.append('metadata[pageCount]', data.pageCount || '0');
    params.append('metadata[visitorId]', data.visitorId || '');

    const res = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await res.json();

    // Save to Supabase CRM (primary)
    try {
      // Find or create company
      let company_id: string | null = null;
      if (data.empresa) {
        const { data: existingCo } = await supabase
          .from('companies')
          .select('id')
          .eq('nombre', data.empresa)
          .limit(1)
          .single();

        if (existingCo) {
          company_id = existingCo.id;
        } else {
          const { data: newCo } = await supabase
            .from('companies')
            .insert({ nombre: data.empresa, giro: data.giro || null, sucursales: parseInt(data.sucursales) || 1 })
            .select('id')
            .single();
          if (newCo) company_id = newCo.id;
        }
      }

      // Determine lifecycle stage from score
      const score = parseInt(data.score) || 0;
      const lifecycle_stage = score >= 40 ? 'lead_calificado' : 'lead';

      // Resolve partner attribution (cookie sacs_ref or ?ref query)
      const referrerPartnerId = await getReferrerFromRequest(request);

      // Check if contact already exists (by email)
      const email = data.email || `lead-${Date.now()}@noemail.com`;
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, referrer_partner_id')
        .eq('email', email)
        .limit(1)
        .single();

      let contactId: string | null = null;
      let isNewContact = false;
      if (existingContact) {
        // Update existing
        contactId = existingContact.id;
        const updates: Record<string, any> = {
          lead_score: score,
          total_time_on_site: parseInt(data.totalTime) || 0,
          pages_visited: data.pagesVisited || null,
          page_count: parseInt(data.pageCount) || 0,
          lifecycle_stage,
          plan_interes: data.plan || null,
        };
        // Solo settear partner_id si no existe ya (no sobreescribir atribución previa)
        if (referrerPartnerId && !existingContact.referrer_partner_id) {
          updates.referrer_partner_id = referrerPartnerId;
        }
        await supabase.from('contacts').update(updates).eq('id', contactId);
      } else {
        // Create new
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            nombre: data.nombre || 'Sin nombre',
            email,
            whatsapp: data.whatsapp || null,
            tipo: 'lead',
            lifecycle_stage,
            fuente: referrerPartnerId ? 'partner-link' : 'website-form',
            lead_score: score,
            total_time_on_site: parseInt(data.totalTime) || 0,
            pages_visited: data.pagesVisited || null,
            page_count: parseInt(data.pageCount) || 0,
            visitor_id: data.visitorId || null,
            company_id,
            plan_interes: data.plan || null,
            giro: data.giro || null,
            sucursales_interes: parseInt(data.sucursales) || null,
            stripe_customer_id: result.id || null,
            referrer_partner_id: referrerPartnerId,
          })
          .select('id')
          .single();
        if (newContact) {
          contactId = newContact.id;
          isNewContact = true;
        }
      }

      // Si vino por partner link y es lead nuevo → generar bono pendiente $500
      // (status=pending, admin verifica y marca como earned)
      if (isNewContact && referrerPartnerId && contactId) {
        try {
          await createPruebaGratisBonus({
            partnerId: referrerPartnerId,
            contactId,
            amount: 500,
          });
        } catch (e) {
          console.warn('[save-lead] createPruebaGratisBonus failed:', e);
        }
      }

      // Log activity
      if (contactId) {
        await supabase.from('activities').insert({
          contact_id: contactId,
          company_id,
          tipo: 'lead_created',
          titulo: `Lead desde formulario web: ${data.nombre || email}`,
          metadata: { score, plan: data.plan, giro: data.giro, sucursales: data.sucursales },
          automatico: true,
        });
      }
      // Auto-enroll new lead in welcome automation
      try {
        const { data: welcomeAutos } = await supabase
          .from('automations')
          .select('id, enrollment_triggers, suppression_stages')
          .eq('estado', 'activo');

        for (const auto of (welcomeAutos || [])) {
          const triggers = auto.enrollment_triggers || [];
          const shouldEnroll = triggers.some((t: any) =>
            t.type === 'lifecycle_stage_change' && (t.config?.new_stage === 'lead' || t.config?.new_stage === 'lead_calificado')
          );
          if (!shouldEnroll) continue;
          if (auto.suppression_stages?.includes(lifecycle_stage)) continue;

          const { data: firstStep } = await supabase
            .from('automation_steps')
            .select('id')
            .eq('automation_id', auto.id)
            .is('parent_step_id', null)
            .order('orden')
            .limit(1)
            .maybeSingle();

          if (firstStep && contactId) {
            await supabase.from('automation_enrollments').insert({
              automation_id: auto.id,
              contact_id: contactId,
              current_step_id: firstStep.id,
              next_action_at: new Date().toISOString(),
              enrollment_trigger: { type: 'lead_created', source: 'website-form' },
            }).catch(() => {}); // Ignore duplicates
          }
        }
      } catch {}
    } catch (crmErr) {
      console.error('CRM save error:', crmErr);
    }

    // Save to Google Sheets (backup)
    try {
      const userAgent = request.headers.get('user-agent') || '';
      await appendToSheet(data, userAgent);
    } catch (sheetErr) {
      console.error('Google Sheets error:', sheetErr);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
