// WHATSAPP · Setup y diagnóstico del Inbox (solo panel, gateado por middleware).
//
// GET  → radiografía: envs presentes, webhook registrado, embed vigente.
// POST → registra (idempotente) el webhook de Kapso apuntando a
//        https://www.sacscloud.com/api/whatsapp/webhook?k=<KAPSO_WEBHOOK_SECRET>
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { kapsoConfigurado, listarWebhooks, registrarWebhook, listarNumeros, KapsoError } from '../../../../lib/whatsapp/kapso-api';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const urlWebhook = () => {
  const secreto = (import.meta.env.KAPSO_WEBHOOK_SECRET || '').trim();
  const base = (import.meta.env.PUBLIC_SITE_URL || 'https://www.sacscloud.com').replace(/\/$/, '');
  return secreto ? `${base}/api/whatsapp/webhook?k=${secreto}` : null;
};

export const GET: APIRoute = async () => {
  const envs = {
    KAPSO_API_KEY: !!(import.meta.env.KAPSO_API_KEY || '').trim(),
    KAPSO_PHONE_NUMBER_ID: !!(import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim(),
    KAPSO_BUSINESS_ACCOUNT_ID: !!(import.meta.env.KAPSO_BUSINESS_ACCOUNT_ID || '').trim(),
    KAPSO_WEBHOOK_SECRET: !!(import.meta.env.KAPSO_WEBHOOK_SECRET || '').trim(),
  };
  const faltantes = Object.entries(envs).filter(([, v]) => !v).map(([k]) => k);

  const { data: cfg } = await supabase.from('wa_config').select('*').eq('id', 1).maybeSingle();

  let webhook: any = null;
  if (kapsoConfigurado()) {
    try {
      const lista = await listarWebhooks();
      const objetivo = urlWebhook()?.split('?')[0];
      const items = Array.isArray(lista) ? lista : (lista?.webhooks ?? []);
      webhook = items.find((w: any) => String(w.url || '').startsWith(objetivo || '∅')) || null;
    } catch (e: any) {
      webhook = { error: e instanceof KapsoError ? e.message : String(e) };
    }
  }

  // Descubrimiento: si faltan los IDs pero la API key sí está, se listan los
  // números del proyecto para copiarlos a env sin ir al dashboard de Kapso.
  let numeros: any[] | null = null;
  if (envs.KAPSO_API_KEY && (!envs.KAPSO_PHONE_NUMBER_ID || !envs.KAPSO_BUSINESS_ACCOUNT_ID)) {
    try {
      const r = await listarNumeros();
      const items = Array.isArray(r) ? r : (r?.phone_numbers ?? []);
      numeros = items.map((n: any) => ({
        id: n.id, numero: n.phone_number || n.display_phone_number || null,
        business_account_id: n.whatsapp_business_account_id || n.business_account_id || null,
        nombre: n.name || n.verified_name || null,
      }));
    } catch (e: any) {
      numeros = [{ error: e instanceof KapsoError ? e.message : String(e) }];
    }
  }

  return json({
    faltantes,
    numeros,
    webhook_registrado: !!(webhook && !webhook.error),
    webhook,
    embed: cfg ? {
      vigente: !!cfg.embed_url && (!cfg.embed_expires_at || new Date(cfg.embed_expires_at) > new Date()),
      expira: cfg.embed_expires_at,
    } : { vigente: false },
  });
};

export const POST: APIRoute = async () => {
  if (!kapsoConfigurado()) return json({ error: 'Faltan KAPSO_API_KEY / KAPSO_PHONE_NUMBER_ID' }, 400);
  const destino = urlWebhook();
  if (!destino) return json({ error: 'Falta KAPSO_WEBHOOK_SECRET' }, 400);

  try {
    // Idempotente: si ya hay un webhook a nuestra URL, no se duplica.
    const lista = await listarWebhooks().catch(() => []);
    const items = Array.isArray(lista) ? lista : (lista?.webhooks ?? []);
    const yaEsta = items.find((w: any) => String(w.url || '').startsWith(destino.split('?')[0]));
    if (!yaEsta) await registrarWebhook(destino);

    await supabase.from('wa_config').upsert({
      id: 1, webhook_registrado_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    return json({ ok: true, ya_estaba: !!yaEsta });
  } catch (e: any) {
    return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
  }
};
