// GET /api/gifts/list?padrino_account=<account> — todos los regalos de un padrino.
//
// Hoy es 1 regalo por cuenta (UNIQUE), pero este endpoint devuelve un ARRAY
// pensando en multi-regalo futuro. Lo consume el panel admin de sacs3.
// Respuesta: { gifts: [{ code, link, status, shared_at, redeemed_by,
//             redeemed_at, expires_at, created_at }] } ordenado por created_at desc.
//
// Exige x-gift-secret (server-to-server): expone codes/links de cupones de $6,000.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import {
  expireGiftIfNeeded,
  giftCorsHeaders,
  giftLink,
  giftOptionsResponse,
  requireGiftSecret,
  type GiftRow,
} from '../../../lib/gifts';

export const prerender = false;

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const GET: APIRoute = async ({ request, url }) => {
  const headers = giftCorsHeaders(request);
  const unauthorized = requireGiftSecret(request, headers);
  if (unauthorized) return unauthorized;
  try {
    const account = (url.searchParams.get('padrino_account') || '').trim().toLowerCase();
    if (!account) {
      return new Response(JSON.stringify({ error: 'padrino_account requerido' }), { status: 400, headers });
    }

    const { data } = await supabase
      .from('gifts')
      .select('*')
      .eq('padrino_account', account)
      .order('created_at', { ascending: false });

    const rows = (data || []) as GiftRow[];

    const gifts = await Promise.all(
      rows.map(async (row) => {
        // Mantenimiento perezoso del status (pending vencido → expired, etc.)
        const gift = await expireGiftIfNeeded(row);

        // Resolver quién redimió (nombre/empresa) si aplica
        let redeemedBy: { nombre: string | null; empresa: string | null } | null = null;
        if (gift.status === 'redeemed' && gift.redeemed_by_contact) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('nombre, company_id')
            .eq('id', gift.redeemed_by_contact)
            .maybeSingle();
          if (contact) {
            let empresa: string | null = null;
            if (contact.company_id) {
              const { data: co } = await supabase
                .from('companies')
                .select('nombre')
                .eq('id', contact.company_id)
                .maybeSingle();
              empresa = co?.nombre || null;
            }
            redeemedBy = { nombre: contact.nombre || null, empresa };
          }
        }

        return {
          code: gift.code,
          link: giftLink(gift.code),
          status: gift.status,
          shared_at: gift.shared_at || null,
          redeemed_by: redeemedBy,
          redeemed_at: gift.redeemed_at,
          expires_at: gift.expires_at,
          created_at: gift.created_at,
        };
      }),
    );

    return new Response(JSON.stringify({ gifts }), { status: 200, headers });
  } catch (err) {
    console.error('[gifts/list] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
