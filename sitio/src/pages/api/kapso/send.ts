import type { APIRoute } from 'astro';

export const prerender = false;

const KAPSO_API_KEY = (import.meta.env.KAPSO_API_KEY || '').trim();

export const POST: APIRoute = async ({ request }) => {
  const { to, message, template_name, template_params } = await request.json();

  if (!to || (!message && !template_name)) {
    return new Response(JSON.stringify({ error: 'to and (message or template_name) required' }), { status: 400 });
  }

  if (!KAPSO_API_KEY) {
    return new Response(JSON.stringify({ status: 'queued', message: 'Kapso not configured' }));
  }

  try {
    // Normalize Mexican number
    let phone = to.replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) phone = phone.startsWith('52') ? '+' + phone : '+52' + phone;
    if (phone.startsWith('+521') && phone.length === 14) phone = '+52' + phone.slice(4);

    const body: any = {
      phone,
      apikey: KAPSO_API_KEY,
    };

    if (template_name) {
      body.template_name = template_name;
      body.template_params = template_params || [];
    } else {
      body.message = message;
    }

    const res = await fetch('https://api.kapso.ai/v1/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await res.json();
    return new Response(JSON.stringify({ status: 'sent', result }));
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
