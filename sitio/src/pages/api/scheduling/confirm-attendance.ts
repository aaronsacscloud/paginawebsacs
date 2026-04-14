import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) return new Response('Token required', { status: 400 });

  // Find booking by cancel token (reuse as confirmation token)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, estado, contact_id, invitee_nombre, fecha, hora_inicio, event_types(nombre)')
    .eq('token_cancelar', token)
    .eq('estado', 'confirmada')
    .single();

  if (!booking) {
    return new Response(`
      <html><head><meta charset="utf-8"><title>SACS</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FAFAF8;">
        <div style="background:#fff;border-radius:16px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <p style="color:#888;">Esta reunion ya fue confirmada o no se encontro.</p>
          <a href="/" style="color:#4B7BE5;text-decoration:none;">Ir a sacscloud.com</a>
        </div>
      </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }

  // Log activity
  if (booking.contact_id) {
    await supabase.from('activities').insert({
      contact_id: booking.contact_id,
      tipo: 'sistema',
      titulo: 'Asistencia confirmada por el invitado',
      metadata: { booking_id: booking.id, confirmed_at: new Date().toISOString() },
      automatico: false,
    });
  }

  // Return success page
  const eventName = (booking.event_types as any)?.nombre || 'Demo';
  return new Response(`
    <html><head><meta charset="utf-8"><title>Asistencia confirmada — SACS</title></head>
    <body style="font-family:'Plus Jakarta Sans',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FAFAF8;">
      <div style="background:#fff;border-radius:16px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="width:48px;height:48px;background:#ECFDF5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Asistencia confirmada</h2>
        <p style="color:#888;font-size:0.875rem;margin:0 0 16px;">
          Gracias ${booking.invitee_nombre}. Te esperamos en tu ${eventName} el ${booking.fecha}.
        </p>
        <p style="color:#bbb;font-size:0.75rem;">Puedes cerrar esta pagina.</p>
      </div>
    </body></html>
  `, { status: 200, headers: { 'Content-Type': 'text/html' } });
};
