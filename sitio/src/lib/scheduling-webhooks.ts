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
      // Skip webhooks legacy sin secret — antes mandábamos firma vacía y el
      // receiver no podía validar origen. Ahora obligamos a re-registrar
      // con un secret válido (mín 16 chars).
      if (!wh.secret || typeof wh.secret !== 'string' || wh.secret.length < 16) {
        console.warn('[scheduling-webhooks] skipping webhook sin secret válido (re-registrar):', wh.id);
        continue;
      }

      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const signature = await hmacSign(body, wh.secret);
      // Fire and forget
      fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SACS-Event': event,
          'X-SACS-Signature': signature,
        },
        body,
      }).catch(() => {});
    }
  } catch {}
}
