import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url: reqUrl }) => {
  const sid = reqUrl.searchParams.get('sid');
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url', { status: 400 });
  }

  if (sid) {
    try {
      const now = new Date().toISOString();
      const { data: send } = await supabase
        .from('email_sends')
        .select('id, contact_id, click_count, clicked_links')
        .eq('id', sid)
        .single();

      if (send) {
        const links = Array.isArray(send.clicked_links) ? send.clicked_links : [];
        links.push({ url: targetUrl, clicked_at: now });

        await supabase.from('email_sends').update({
          estado: 'clicked',
          clicked_at: now,
          click_count: (send.click_count || 0) + 1,
          clicked_links: links,
        }).eq('id', sid);

        // Log activity on first click only
        if (send.click_count === 0) {
          await supabase.from('activities').insert({
            contact_id: send.contact_id,
            tipo: 'email_clicked',
            titulo: 'Click en email',
            metadata: { email_send_id: sid, url: targetUrl },
            automatico: true,
          });
        }
      }
    } catch {}
  }

  // 302 redirect to the original URL
  return new Response(null, {
    status: 302,
    headers: { 'Location': targetUrl },
  });
};
