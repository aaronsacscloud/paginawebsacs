import type { APIRoute } from 'astro';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { customerId, stage, arr, nextFollowup, plan, lastContact } = await request.json();

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'customerId required' }), { status: 400 });
    }

    const params = new URLSearchParams();
    if (stage) params.append('metadata[stage]', stage);
    if (arr !== undefined) params.append('metadata[arr]', String(arr));
    if (nextFollowup) params.append('metadata[nextFollowup]', nextFollowup);
    if (lastContact) params.append('metadata[lastContact]', lastContact);
    if (plan) params.append('metadata[plan]', plan);

    // Update stage history
    if (stage) {
      // Get current customer to append to history
      const getRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
      });
      const customer = await getRes.json();
      const history = customer.metadata?.stageHistory || '';
      const newEntry = `${stage}:${new Date().toISOString().slice(0, 10)}`;
      const updated = history ? `${history},${newEntry}` : newEntry;
      params.append('metadata[stageHistory]', updated.slice(-500));
    }

    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
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
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
