import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const DEFAULTS = {
  logo_url: '',
  primary_color: '#4B7BE5',
  welcome_message: '',
  confirmation_message: '',
  company_name: 'Sacs',
};

const CONFIG_SLUG = '_branding';

export const GET: APIRoute = async () => {
  try {
    const { data } = await supabase
      .from('event_types')
      .select('descripcion')
      .eq('slug', CONFIG_SLUG)
      .single();

    if (!data || !data.descripcion) {
      return new Response(JSON.stringify(DEFAULTS));
    }

    const config = { ...DEFAULTS, ...JSON.parse(data.descripcion) };
    return new Response(JSON.stringify(config));
  } catch {
    return new Response(JSON.stringify(DEFAULTS));
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const config = {
      logo_url: body.logo_url || '',
      primary_color: body.primary_color || '#4B7BE5',
      welcome_message: body.welcome_message || '',
      confirmation_message: body.confirmation_message || '',
      company_name: body.company_name || 'Sacs',
    };

    // Upsert the branding config row
    // We use a hidden event_type row with slug='_branding' and activo=false
    const { data: existing } = await supabase
      .from('event_types')
      .select('id')
      .eq('slug', CONFIG_SLUG)
      .single();

    if (existing) {
      await supabase
        .from('event_types')
        .update({ descripcion: JSON.stringify(config) })
        .eq('id', existing.id);
    } else {
      // Insert a new hidden config row
      await supabase.from('event_types').insert({
        slug: CONFIG_SLUG,
        nombre: '_branding',
        descripcion: JSON.stringify(config),
        activo: false,
        duracion_minutos: 0,
        color: '#000000',
        ubicacion_tipo: 'none',
      });
    }

    return new Response(JSON.stringify(config));
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to save config' }),
      { status: 500 },
    );
  }
};
