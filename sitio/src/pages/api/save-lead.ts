import type { APIRoute } from 'astro';

export const prerender = false;

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJZ6VLnjKeIJ8Jh3H4vDoUicD59cEUQFxMhpEYFzQSmWHVToLYC0t2xHtRqhNlEUxp/exec';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Log to Vercel (always works)
    console.log('NEW LEAD:', JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data,
    }));

    // Forward to Google Sheet via Apps Script (server-side, follow redirects)
    try {
      const params = new URLSearchParams({
        nombre: data.nombre || '',
        empresa: data.empresa || '',
        giro: data.giro || '',
        sucursales: data.sucursales || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        paso: data.paso || '',
        plan: data.plan || '',
      });

      // Try GET with query params (most reliable for Apps Script)
      await fetch(APPS_SCRIPT_URL + '?' + params.toString(), {
        method: 'GET',
        redirect: 'follow',
      });
    } catch (sheetErr) {
      console.log('Sheet webhook error:', sheetErr);
    }

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
