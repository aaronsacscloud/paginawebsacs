// POST /api/auth/logout — destroys session + clears cookie.

import type { APIRoute } from 'astro';
import { destroySession, buildClearSessionCookie, getSessionCookieName } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${getSessionCookieName()}=([^;]+)`));
  if (match) {
    try {
      await destroySession(decodeURIComponent(match[1]));
    } catch {/* swallow */}
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildClearSessionCookie(),
    },
  });
};
