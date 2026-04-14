import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';

// Map old stage to lifecycle_stage
function mapStage(stage: string): string {
  switch (stage) {
    case 'nuevo': return 'lead';
    case 'contactado': return 'lead_calificado';
    case 'demo': return 'oportunidad';
    case 'oportunidad': return 'oportunidad';
    case 'cliente': return 'cliente';
    case 'perdido': return 'churned';
    default: return 'lead';
  }
}

function mapTipo(stage: string): string {
  if (stage === 'cliente') return 'cliente';
  if (stage === 'perdido') return 'churned';
  return 'lead';
}

export const GET: APIRoute = async ({ url }) => {
  // Simple auth check
  if (url.searchParams.get('key') !== 'sacs-migrate-2026') {
    return new Response('Forbidden', { status: 403 });
  }
  const results = { stripe_leads: 0, clients_migrated: 0, companies_created: 0, activities_created: 0, errors: [] as string[] };

  try {
    // ═══ PART 1: Migrate Stripe leads ═══
    let hasMore = true;
    let startingAfter: string | undefined;
    const allStripeLeads: any[] = [];

    while (hasMore) {
      const params = new URLSearchParams({ limit: '100' });
      if (startingAfter) params.set('starting_after', startingAfter);

      const res = await fetch(`https://api.stripe.com/v1/customers?${params}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
      });
      const data = await res.json();
      const leads = (data.data || []).filter((c: any) => c.metadata?.source === 'website-lead');
      allStripeLeads.push(...leads);
      hasMore = data.has_more;
      if (data.data?.length > 0) startingAfter = data.data[data.data.length - 1].id;
    }

    for (const c of allStripeLeads) {
      try {
        const email = c.email || '';
        const stage = c.metadata?.stage || 'nuevo';

        // Skip if already migrated
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('stripe_customer_id', c.id)
          .limit(1)
          .single();

        if (existing) continue;

        // Also check by email
        const { data: byEmail } = email
          ? await supabase.from('contacts').select('id').eq('email', email).limit(1).single()
          : { data: null };

        if (byEmail) {
          // Update existing with stripe_customer_id
          await supabase.from('contacts').update({ stripe_customer_id: c.id }).eq('id', byEmail.id);
          continue;
        }

        // Find or create company
        let company_id: string | null = null;
        const empresa = c.metadata?.empresa || '';
        if (empresa) {
          const { data: existingCo } = await supabase
            .from('companies')
            .select('id')
            .eq('nombre', empresa)
            .limit(1)
            .single();

          if (existingCo) {
            company_id = existingCo.id;
          } else {
            const { data: newCo } = await supabase
              .from('companies')
              .insert({
                nombre: empresa,
                giro: c.metadata?.giro || null,
                sucursales: parseInt(c.metadata?.sucursales) || 1,
                estado_cuenta: stage === 'cliente' ? 'activo' : 'prospecto',
              })
              .select('id')
              .single();
            if (newCo) {
              company_id = newCo.id;
              results.companies_created++;
            }
          }
        }

        // Create contact
        const score = parseInt(c.metadata?.score || '0');
        const { data: contact, error: contactErr } = await supabase
          .from('contacts')
          .insert({
            nombre: c.name || 'Sin nombre',
            email: email || null,
            whatsapp: c.phone || null,
            tipo: mapTipo(stage),
            lifecycle_stage: mapStage(stage),
            fuente: 'website-form',
            lead_score: score,
            total_time_on_site: parseInt(c.metadata?.totalTime || '0'),
            pages_visited: c.metadata?.pagesVisited || null,
            page_count: parseInt(c.metadata?.pageCount || '0'),
            visitor_id: c.metadata?.visitorId || null,
            company_id,
            plan_interes: c.metadata?.plan || null,
            giro: c.metadata?.giro || null,
            sucursales_interes: parseInt(c.metadata?.sucursales) || null,
            stripe_customer_id: c.id,
            next_followup: c.metadata?.nextFollowup || null,
            last_contact_at: c.metadata?.lastContact || null,
          })
          .select('id')
          .single();

        if (contactErr) {
          results.errors.push(`Lead ${c.id}: ${contactErr.message}`);
          continue;
        }

        results.stripe_leads++;

        // Migrate notes
        const noteCount = parseInt(c.metadata?.note_count || '0');
        for (let i = 1; i <= noteCount; i++) {
          const raw = c.metadata?.[`note_${i}`] || '';
          const [date, ...rest] = raw.split('|');
          if (date && rest.length) {
            await supabase.from('activities').insert({
              contact_id: contact!.id,
              company_id,
              tipo: 'nota',
              titulo: 'Nota migrada',
              descripcion: rest.join('|'),
              metadata: { migrated_from: 'stripe', original_date: date },
              created_at: new Date(date).toISOString() || new Date().toISOString(),
              automatico: true,
            });
            results.activities_created++;
          }
        }

        // Migrate stage history
        const stageHistory = c.metadata?.stageHistory || '';
        if (stageHistory) {
          const entries = stageHistory.split(',').filter(Boolean);
          for (const entry of entries) {
            const [s, d] = entry.split(':');
            if (s && d) {
              await supabase.from('activities').insert({
                contact_id: contact!.id,
                company_id,
                tipo: 'stage_change',
                titulo: `Stage: → ${s}`,
                metadata: { new_stage: s, date: d, migrated_from: 'stripe' },
                created_at: new Date(d).toISOString() || new Date().toISOString(),
                automatico: true,
              });
              results.activities_created++;
            }
          }
        }

        // Log migration activity
        await supabase.from('activities').insert({
          contact_id: contact!.id,
          company_id,
          tipo: 'sistema',
          titulo: 'Contacto migrado desde Stripe',
          metadata: { stripe_id: c.id, original_stage: stage },
          automatico: true,
        });
        results.activities_created++;
      } catch (e) {
        results.errors.push(`Lead ${c.id}: ${String(e)}`);
      }
    }

    // ═══ PART 2: Migrate existing Supabase clients ═══
    const { data: oldClients } = await supabase
      .from('clients')
      .select('*');

    for (const cl of (oldClients || [])) {
      try {
        // Check if already migrated
        const { data: existing } = cl.email
          ? await supabase.from('contacts').select('id, company_id').eq('email', cl.email).limit(1).single()
          : { data: null };

        let company_id: string | null = null;
        let contact_id: string | null = null;

        if (existing) {
          // Contact exists (was a lead), update to cliente
          contact_id = existing.id;
          company_id = existing.company_id;

          await supabase.from('contacts').update({
            tipo: cl.estado === 'cancelado' ? 'churned' : 'cliente',
            lifecycle_stage: cl.estado === 'cancelado' ? 'churned' : 'cliente',
            legacy_client_id: cl.id,
          }).eq('id', contact_id);

          // Update company with subscription info
          if (company_id) {
            const precio = cl.precio_mensual || 0;
            const suc = cl.sucursales || 1;
            await supabase.from('companies').update({
              plan: cl.plan || null,
              sucursales: suc,
              precio_por_sucursal: precio,
              mrr: precio * suc,
              arr: precio * suc * 12,
              metodo_pago: cl.metodo_pago || null,
              fecha_inicio: cl.fecha_inicio || null,
              fecha_renovacion: cl.fecha_renovacion || null,
              estado_cuenta: cl.estado === 'cancelado' ? 'cancelado' : 'activo',
            }).eq('id', company_id);
          }
        } else {
          // Create new company
          const precio = cl.precio_mensual || 0;
          const suc = cl.sucursales || 1;
          const { data: newCo } = await supabase.from('companies').insert({
            nombre: cl.empresa || 'Sin empresa',
            plan: cl.plan || null,
            sucursales: suc,
            precio_por_sucursal: precio,
            mrr: precio * suc,
            arr: precio * suc * 12,
            metodo_pago: cl.metodo_pago || null,
            fecha_inicio: cl.fecha_inicio || null,
            fecha_renovacion: cl.fecha_renovacion || null,
            estado_cuenta: cl.estado === 'cancelado' ? 'cancelado' : 'activo',
          }).select('id').single();

          if (newCo) {
            company_id = newCo.id;
            results.companies_created++;
          }

          // Create contact
          const { data: newContact } = await supabase.from('contacts').insert({
            nombre: cl.contacto || cl.empresa || 'Sin nombre',
            email: cl.email || null,
            whatsapp: cl.whatsapp || null,
            tipo: cl.estado === 'cancelado' ? 'churned' : 'cliente',
            lifecycle_stage: cl.estado === 'cancelado' ? 'churned' : 'cliente',
            company_id,
            legacy_client_id: cl.id,
          }).select('id').single();

          if (newContact) contact_id = newContact.id;
        }

        if (contact_id) {
          results.clients_migrated++;

          // Log migration
          await supabase.from('activities').insert({
            contact_id,
            company_id,
            tipo: 'sistema',
            titulo: `Cliente migrado: ${cl.empresa}`,
            metadata: { legacy_client_id: cl.id, plan: cl.plan, estado: cl.estado },
            automatico: true,
          });
          results.activities_created++;
        }

        // Link existing quotes by email
        if (contact_id && cl.email) {
          await supabase.from('quotes')
            .update({ contact_id, company_id })
            .eq('email', cl.email)
            .is('contact_id', null);
        }

        // Link existing payments
        if (contact_id && cl.id) {
          await supabase.from('payments')
            .update({ contact_id, company_id })
            .eq('client_id', cl.id)
            .is('contact_id', null);
        }
      } catch (e) {
        results.errors.push(`Client ${cl.id}: ${String(e)}`);
      }
    }
  } catch (e) {
    results.errors.push(`Global: ${String(e)}`);
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
