// GET /api/gifts/status?account=<padrino_account> — estado del regalo del padrino.
//
// Lo consulta sacs3 (admin) para pintar el panel "Regalo Buddy" del cliente.
// Respuesta: { exists, code, link, status, redeemed_by, redeemed_at, expires_at }

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import {
  expireGiftIfNeeded,
  giftCorsHeaders,
  giftLink,
  giftOptionsResponse,
  type GiftRow,
} from '../../../lib/gifts';

export const prerender = false;

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const GET: APIRoute = async ({ request, url }) => {
  const headers = giftCorsHeaders(request);
  try {
    const account = (url.searchParams.get('account') || '').trim().toLowerCase();
    if (!account) {
      return new Response(JSON.stringify({ error: 'account requerido' }), { status: 400, headers });
    }

    const { data } = await supabase
      .from('gifts')
      .select('*')
      .eq('padrino_account', account)
      .maybeSingle();

    if (!data) {
      return new Response(JSON.stringify({ exists: false }), { status: 200, headers });
    }

    const gift = await expireGiftIfNeeded(data as GiftRow);

    // Nombre/empresa del contact que redimió (si aplica)
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

    return new Response(
      JSON.stringify({
        exists: true,
        code: gift.code,
        link: giftLink(gift.code),
        status: gift.status,
        redeemed_by: redeemedBy,
        redeemed_at: gift.redeemed_at,
        expires_at: gift.expires_at,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('[gifts/status] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
