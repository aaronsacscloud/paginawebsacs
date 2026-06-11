// GET /api/register-check?account_id=<slug>[&email=<email>]
// Pre-check de disponibilidad para el form de registro (UX "auto + editable +
// check"). Corre server-side y reenvía a sacs_api /v1/register/check con el
// secreto de caller confiable (para que también pueda chequear email).

import type { APIRoute } from 'astro';
import { checkAvailability, isValidAccountId } from '../../lib/register';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const accountId = (url.searchParams.get('account_id') || '').trim().toLowerCase();
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!accountId) return json({ error: 'account_id requerido' }, 400);

  // Validación de formato local (rápida, sin pegarle al backend si es inválido).
  if (!isValidAccountId(accountId)) {
    return json({ account_id: accountId, account_format_ok: false, account_available: false });
  }
  const av = await checkAvailability(accountId, email || undefined);
  return json({ account_id: accountId, account_format_ok: true, ...av });
};
