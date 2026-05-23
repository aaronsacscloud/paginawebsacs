import type { APIRoute } from 'astro';
import { exchangeCode } from '../../../../lib/google-calendar';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

/**
 * GET /api/scheduling/google/callback?code=xxx&state=team_member_id
 * Google OAuth callback — exchanges code for tokens and stores them.
 */
// Parsea el state: "team_member_id|return_url". Tolera state legacy sin pipe.
function parseState(raw: string | null): { teamMemberId: string | null; returnUrl: string } {
  if (!raw) return { teamMemberId: null, returnUrl: '/admin/crm?tab=agenda' };
  const idx = raw.indexOf('|');
  if (idx === -1) return { teamMemberId: raw, returnUrl: '/admin/crm?tab=agenda' };
  const tid = raw.slice(0, idx);
  const ret = raw.slice(idx + 1);
  // Sanea — solo paths relativos del mismo origen.
  const safe = (ret.startsWith('/') && !ret.startsWith('//') && !/[\s\x00-\x1f]/.test(ret))
    ? ret
    : '/admin/crm?tab=agenda';
  return { teamMemberId: tid, returnUrl: safe };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code');
  const { teamMemberId, returnUrl } = parseState(url.searchParams.get('state'));
  const error = url.searchParams.get('error');
  const returnUrlSafe = escapeHtml(returnUrl);

  if (error) {
    return new Response(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f6f8;">
        <div style="text-align:center;background:#fff;padding:48px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <h2 style="color:#E54B4B;">Error de autorización</h2>
          <p>${escapeHtml(error)}</p>
          <a href="${returnUrlSafe}" style="color:#4B7BE5;">Volver</a>
        </div>
      </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }

  if (!code || !teamMemberId) {
    return new Response(JSON.stringify({ error: 'Missing code or state' }), { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);

    // Get user email from the ID token (no extra API call needed)
    let email = '';
    try {
      if (tokens.id_token) {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        email = payload.email || '';
      }
    } catch {}
    // Fallback: get from team member record
    if (!email) {
      const { data: tm } = await supabase.from('team_members').select('email').eq('id', teamMemberId).single();
      email = tm?.email || 'calendar@sacscloud.com';
    }

    // Upsert calendar connection
    await supabase.from('calendar_connections').upsert({
      team_member_id: teamMemberId,
      provider: 'google',
      email,
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      token_expires_at: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
      calendar_id: 'primary',
      activo: true,
    }, { onConflict: 'team_member_id,provider' });

    // Success page — auto-redirect tras 1.2s para mejor UX
    return new Response(`
      <html><head><meta http-equiv="refresh" content="1;url=${returnUrlSafe}"></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f6f8;">
        <div style="text-align:center;background:#fff;padding:48px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <div style="width:48px;height:48px;background:#e8f5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.5rem;">✓</div>
          <h2 style="margin:0 0 8px;">Google Calendar conectado</h2>
          <p style="color:#888;">${escapeHtml(email)}</p>
          <a href="${returnUrlSafe}" style="display:inline-block;margin-top:16px;padding:12px 32px;background:#4B7BE5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Volver</a>
        </div>
      </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (err) {
    return new Response(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f6f8;">
        <div style="text-align:center;background:#fff;padding:48px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <h2 style="color:#E54B4B;">Error</h2>
          <p style="color:#888;">${escapeHtml(String(err))}</p>
          <a href="${returnUrlSafe}" style="color:#4B7BE5;">Volver</a>
        </div>
      </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
};
