import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { csv, skip_header = true } = await request.json();

  if (!csv) return new Response(JSON.stringify({ error: 'csv required' }), { status: 400 });

  const lines = csv.split('\n').filter((l: string) => l.trim());
  const dataLines = skip_header ? lines.slice(1) : lines;

  let created = 0;
  let skipped = 0;
  let errors: string[] = [];

  for (const line of dataLines) {
    const cols = line.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
    // Expected: nombre, email, whatsapp, empresa, giro, sucursales, plan_interes
    const [nombre, email, whatsapp, empresa, giro, sucursales, plan_interes] = cols;

    if (!nombre) { skipped++; continue; }

    // Check duplicate by email
    if (email) {
      const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).limit(1).single();
      if (existing) { skipped++; continue; }
    }

    // Create company if needed
    let company_id = null;
    if (empresa) {
      const { data: existingCo } = await supabase.from('companies').select('id').eq('nombre', empresa).limit(1).single();
      if (existingCo) {
        company_id = existingCo.id;
      } else {
        const { data: newCo } = await supabase.from('companies').insert({ nombre: empresa, giro: giro || null, sucursales: parseInt(sucursales) || 1 }).select('id').single();
        if (newCo) company_id = newCo.id;
      }
    }

    const { error } = await supabase.from('contacts').insert({
      nombre,
      email: email || null,
      whatsapp: whatsapp || null,
      company_id,
      giro: giro || null,
      sucursales_interes: parseInt(sucursales) || null,
      plan_interes: plan_interes || null,
      tipo: 'lead',
      lifecycle_stage: 'lead',
      fuente: 'csv-import',
    });

    if (error) { errors.push(`${nombre}: ${error.message}`); }
    else { created++; }
  }

  return new Response(JSON.stringify({ created, skipped, errors, total: dataLines.length }));
};
