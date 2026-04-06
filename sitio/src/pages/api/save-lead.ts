import type { APIRoute } from 'astro';

export const prerender = false;

const SHEET_ID = '1U18XIO2w39t3lOqI3NElwxEwcljmKGMZnnn6xl7k620';

// Uses Google Sheets API v4 with a service account or API key
// For now, we'll append to a simple JSON file and also try the Apps Script webhook
const APPS_SCRIPT_URL = import.meta.env.GOOGLE_SHEET_WEBHOOK || '';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Try Apps Script webhook (fire and forget)
    if (APPS_SCRIPT_URL) {
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data),
      }).catch(() => {});
    }

    // Also send email notification via a simple fetch to a mail service
    // For now, log to Vercel function logs (visible in Vercel dashboard)
    console.log('NEW LEAD:', JSON.stringify({
      timestamp: new Date().toISOString(),
      nombre: data.nombre,
      empresa: data.empresa,
      giro: data.giro,
      sucursales: data.sucursales,
      whatsapp: data.whatsapp,
      email: data.email,
      paso: data.paso,
      plan: data.plan,
    }));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
