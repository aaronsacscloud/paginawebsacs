import { supabase } from './supabase';

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function fireSchedulingWebhooks(event: string, payload: any) {
  try {
    const { data: configRow } = await supabase
      .from('event_types')
      .select('descripcion')
      .eq('slug', '_branding')
      .single();

    if (!configRow?.descripcion) return;
    const config = JSON.parse(configRow.descripcion);
    const webhooks = config.webhooks || [];

    for (const wh of webhooks) {
      if (!wh.activo || !wh.url) continue;
      if (wh.events && !wh.events.includes(event)) continue;

      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      // Fire and forget
      fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SACS-Event': event,
          'X-SACS-Signature': wh.secret
            ? await hmacSign(body, wh.secret)
            : '',
        },
        body,
      }).catch(() => {});
    }
  } catch {}
}
