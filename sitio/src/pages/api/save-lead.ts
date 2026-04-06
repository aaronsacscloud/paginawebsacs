import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Save lead as Stripe customer with metadata
    await stripe.customers.create({
      email: data.email || `lead-${Date.now()}@noemail.com`,
      name: data.nombre || '',
      phone: data.whatsapp || '',
      metadata: {
        empresa: data.empresa || '',
        giro: data.giro || '',
        sucursales: data.sucursales || '',
        paso: data.paso || '',
        plan: data.plan || '',
        source: 'website-lead',
        fecha: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.log('Lead save error:', err);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
