import type { APIRoute } from 'astro';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';

export const GET: APIRoute = async () => {
  try {
    const res = await fetch('https://api.stripe.com/v1/customers?limit=100', {
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
    });

    const data = await res.json();

    const leads = (data.data || [])
      .filter((c: any) => c.metadata?.source === 'website-lead')
      .map((c: any) => ({
        id: c.id,
        timestamp: c.metadata?.fecha || new Date(c.created * 1000).toISOString(),
        nombre: c.name || '',
        empresa: c.metadata?.empresa || '',
        giro: c.metadata?.giro || '',
        sucursales: c.metadata?.sucursales || '',
        whatsapp: c.phone || '',
        email: c.email || '',
        paso: c.metadata?.paso || '',
        plan: c.metadata?.plan || '',
        score: parseInt(c.metadata?.score || '0'),
        totalTime: parseInt(c.metadata?.totalTime || '0'),
        pagesVisited: c.metadata?.pagesVisited || '',
        pageCount: parseInt(c.metadata?.pageCount || '0'),
      }))
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
