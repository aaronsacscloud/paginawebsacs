// WHATSAPP · El inbox embebido de Kapso, listo para el iframe.
//
// GET [?force=1] → { embed_url, expires_at }
//
// El token y la embed_url SOLO vienen en la respuesta de CREACIÓN de Kapso
// (list/get no los devuelven): por eso se persisten en wa_config y se crean
// perezosamente. `force=1` descarta el guardado y crea otro — es el camino
// cuando el iframe regresa 401 (token revocado o vencido).
//
// La API key NUNCA sale de aquí: el navegador solo ve la embed_url.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { kapsoConfigurado, crearEmbed, KapsoError } from '../../../../lib/whatsapp/kapso-api';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Los orígenes desde los que el CRM sirve el iframe. Kapso los aplica por
// CORS y frame-ancestors; sin el wildcard de Vercel los previews salen vacíos.
const ORIGENES = [
  'https://www.sacscloud.com', 'https://sacscloud.com',
  'https://*.vercel.app', 'http://localhost:4321',
];

export const GET: APIRoute = async ({ url }) => {
  if (!kapsoConfigurado()) {
    return json({ error: 'Kapso sin configurar: faltan KAPSO_API_KEY / KAPSO_PHONE_NUMBER_ID' }, 400);
  }
  const force = url.searchParams.get('force') === '1';

  if (!force) {
    const { data: cfg } = await supabase.from('wa_config')
      .select('embed_url, embed_expires_at').eq('id', 1).maybeSingle();
    const vigente = cfg?.embed_url &&
      (!cfg.embed_expires_at || new Date(cfg.embed_expires_at).getTime() - Date.now() > 24 * 3600 * 1000);
    if (vigente) return json({ embed_url: cfg.embed_url, expires_at: cfg.embed_expires_at });
  }

  try {
    const creado = await crearEmbed({ allowedOrigins: ORIGENES, expiresAt: null });
    const embedUrl = creado?.embed_url || (creado?.token ? `https://inbox.kapso.ai/embed/${creado.token}` : null);
    if (!embedUrl) return json({ error: 'Kapso no devolvió embed_url' }, 502);

    await supabase.from('wa_config').upsert({
      id: 1, embed_token: creado?.token || null, embed_url: embedUrl,
      embed_expires_at: creado?.expires_at || null, updated_at: new Date().toISOString(),
    });
    return json({ embed_url: embedUrl, expires_at: creado?.expires_at || null });
  } catch (e: any) {
    return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
  }
};
