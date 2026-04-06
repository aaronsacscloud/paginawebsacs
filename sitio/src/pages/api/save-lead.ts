import type { APIRoute } from 'astro';
import { put, list } from '@vercel/blob';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const lead = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      nombre: data.nombre || '',
      empresa: data.empresa || '',
      giro: data.giro || '',
      sucursales: data.sucursales || '',
      whatsapp: data.whatsapp || '',
      email: data.email || '',
      paso: data.paso || '',
      plan: data.plan || '',
    };

    // Store each lead as individual blob
    await put(`leads/${lead.id}.json`, JSON.stringify(lead), {
      access: 'public',
      contentType: 'application/json',
    });

    console.log('LEAD SAVED:', JSON.stringify(lead));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.log('LEAD ERROR:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
