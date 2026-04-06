import type { APIRoute } from 'astro';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { customerId, note } = await request.json();

    if (!customerId || !note) {
      return new Response(JSON.stringify({ error: 'customerId and note required' }), { status: 400 });
    }

    // Get current note count
    const getRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
    });
    const customer = await getRes.json();
    const count = parseInt(customer.metadata?.note_count || '0') + 1;

    const dateStr = new Date().toISOString().slice(0, 10);
    const noteValue = `${dateStr}|${note.substring(0, 450)}`;

    const params = new URLSearchParams();
    params.append('metadata[note_count]', String(count));
    params.append(`metadata[note_${count}]`, noteValue);
    params.append('metadata[lastContact]', new Date().toISOString().slice(0, 10));

    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    await res.json();

    return new Response(JSON.stringify({ success: true, noteNumber: count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
