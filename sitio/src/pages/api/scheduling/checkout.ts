import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const STRIPE_KEY = import.meta.env.STRIPE_SECRET_KEY || '';

export const POST: APIRoute = async ({ request }) => {
  const { booking_id, amount, currency = 'MXN', success_url, cancel_url } = await request.json();

  if (!booking_id || !amount) {
    return new Response(
      JSON.stringify({ error: 'booking_id and amount required' }),
      { status: 400 },
    );
  }

  // Load booking with event type
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, event_types(nombre, slug)')
    .eq('id', booking_id)
    .single();

  if (!booking) {
    return new Response(
      JSON.stringify({ error: 'Booking not found' }),
      { status: 404 },
    );
  }

  // Create Stripe Checkout session
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('payment_method_types[]', 'card');
  params.append('line_items[0][price_data][currency]', currency.toLowerCase());
  params.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
  params.append('line_items[0][price_data][product_data][name]', booking.event_types?.nombre || 'Sesion SACS');
  params.append('line_items[0][quantity]', '1');
  params.append(
    'success_url',
    success_url || `https://www.sacscloud.com/agendar/confirmado?booking=${booking_id}`,
  );
  params.append(
    'cancel_url',
    cancel_url || `https://www.sacscloud.com/agendar/${booking.event_types?.slug || 'demo'}`,
  );
  params.append('metadata[booking_id]', booking_id);
  params.append('customer_email', booking.email_invitado);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await res.json();

  if (session.error) {
    return new Response(
      JSON.stringify({ error: session.error.message }),
      { status: 400 },
    );
  }

  // Update booking with payment session info
  await supabase
    .from('bookings')
    .update({
      notas: `${booking.notas || ''}\n[Stripe checkout: ${session.id}]`.trim(),
    })
    .eq('id', booking_id);

  return new Response(
    JSON.stringify({ url: session.url, session_id: session.id }),
  );
};
