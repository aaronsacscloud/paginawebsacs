import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export const GET: APIRoute = async ({ url }) => {
  const sid = url.searchParams.get('sid');

  if (sid) {
    try {
      // Update email_sends
      const now = new Date().toISOString();
      const { data: send } = await supabase
        .from('email_sends')
        .select('id, contact_id, open_count, first_opened_at')
        .eq('id', sid)
        .single();

      if (send) {
        await supabase.from('email_sends').update({
          estado: 'opened',
          opened_at: now,
          first_opened_at: send.first_opened_at || now,
          open_count: (send.open_count || 0) + 1,
        }).eq('id', sid);

        // Log activity on first open only
        if (!send.first_opened_at) {
          await supabase.from('activities').insert({
            contact_id: send.contact_id,
            tipo: 'email_opened',
            titulo: 'Email abierto',
            metadata: { email_send_id: sid },
            automatico: true,
          });
        }
      }
    } catch {}
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
};
