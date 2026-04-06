import type { APIRoute } from 'astro';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Create Stripe customer via REST API directly (no SDK version issues)
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

    const res = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await res.json();

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
