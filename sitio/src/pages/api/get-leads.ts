import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

export const GET: APIRoute = async () => {
  try {
    // Get all customers with source=website-lead
    const customers = await stripe.customers.list({ limit: 100 });

    const leads = customers.data
      .filter((c) => c.metadata?.source === 'website-lead')
      .map((c) => ({
        id: c.id,
        timestamp: c.metadata?.fecha || c.created ? new Date((c.created || 0) * 1000).toISOString() : '',
        nombre: c.name || '',
        empresa: c.metadata?.empresa || '',
        giro: c.metadata?.giro || '',
        sucursales: c.metadata?.sucursales || '',
        whatsapp: c.phone || '',
        email: c.email || '',
        paso: c.metadata?.paso || '',
        plan: c.metadata?.plan || '',
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return new Response(JSON.stringify({ leads, total: leads.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), leads: [], total: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
