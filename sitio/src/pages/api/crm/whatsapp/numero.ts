// WHATSAPP · Etapa F: el número como activo (salud, calidad, nombre visible,
// username, perfil del negocio, diagnóstico de webhooks/API, varios números, setup links).
// GET ?salud=1 | ?perfil=1 | ?username=1 | ?display_name=1 | ?diagnostico=1 | ?numeros=1 | ?setup=1   (&pn=<phone_number_id>)
// POST { accion: 'perfil', ... } | { accion:'foto', url } | { accion:'username', username } | { accion:'username_borrar' }
//      | { accion:'display_name', nombre } | { accion:'numero', phone_number_id, activo, es_default } | { accion:'setup_link', nombre }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { saludNumero, infoNumero, perfilNegocio, guardarPerfil, handleDesdeUrl, usernameActual, sugerenciasUsername, reservarUsername, borrarUsername, solicitudesDisplayName, pedirDisplayName, entregasWebhook, logsApi, numerosKapso, clientesKapso, crearClienteKapso, crearSetupLink, setupLinks, resumirSalud, ErrorKapso } from '../../../../lib/whatsapp/kapso-numero';
import { registrarWebhook } from '../../../../lib/whatsapp/kapso-api';
import { explicarError } from '../../../../lib/whatsapp/errores';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fallo = (e: any) => { const x = explicarError(e instanceof ErrorKapso ? e.detalle : e, e instanceof ErrorKapso ? e.status : undefined); return json({ error: `${x.titulo}. ${x.que_hacer}`, error_detalle: x }, 502); };

export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams; const pn = p.get('pn') || null;
  try {
    if (p.get('salud')) {
      const [salud, info] = await Promise.all([saludNumero(pn).catch((e: any) => ({ error: String(e?.message || e) })), infoNumero(pn).catch(() => null)]);
      const resumen = resumirSalud(salud, info);
      await supabase.from('wa_config').update({ salud: { ...resumen, info, checks: salud?.checks || null }, salud_at: new Date().toISOString() }).eq('id', 1);
      return json({ salud, info, resumen });
    }
    if (p.get('perfil')) return json({ perfil: await perfilNegocio(pn) });
    if (p.get('username')) { const [actual, sug] = await Promise.all([usernameActual(pn).catch(() => ({})), sugerenciasUsername(pn).catch(() => null)]); return json({ username: actual, sugerencias: sug?.[0]?.username_suggestions || sug?.username_suggestions || [] }); }
    if (p.get('display_name')) { const r = await solicitudesDisplayName(pn).catch(() => []); return json({ solicitudes: Array.isArray(r) ? r : (r?.data || []) }); }
    if (p.get('diagnostico')) {
      const [entregas, fallidas, logs] = await Promise.all([entregasWebhook().catch(() => []), entregasWebhook({ errors_only: 'true', period: '7d' }).catch(() => []), logsApi({ errors_only: 'true', period: '7d' }).catch(() => [])]);
      return json({ entregas: Array.isArray(entregas) ? entregas : [], fallidas: Array.isArray(fallidas) ? fallidas : [], logs: Array.isArray(logs) ? logs : [] });
    }
    if (p.get('numeros')) {
      const enKapso = await numerosKapso().catch(() => []);
      const { data: locales } = await supabase.from('wa_numeros').select('*');
      const lista = (Array.isArray(enKapso) ? enKapso : []).filter((n: any) => n.kind !== 'sandbox' && n.display_phone_number).map((n: any) => { const l = (locales || []).find(x => x.phone_number_id === n.phone_number_id); return { phone_number_id: n.phone_number_id, display_phone_number: n.display_phone_number, nombre: n.display_name || n.name, name_status: n.name_status, calls_enabled: n.calls_enabled, business_account_id: n.business_account_id, kind: n.kind, activo: l ? l.activo : n.phone_number_id === (import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim(), es_default: l ? l.es_default : n.phone_number_id === (import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim(), webhook_id: l?.webhook_id || null }; });
      return json({ numeros: lista, default_env: (import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim() });
    }
    if (p.get('setup')) {
      const { data: cfg } = await supabase.from('wa_config').select('kapso_customer_id').eq('id', 1).maybeSingle();
      const links = cfg?.kapso_customer_id ? await setupLinks(cfg.kapso_customer_id).catch(() => []) : [];
      return json({ customer_id: cfg?.kapso_customer_id || null, links: Array.isArray(links) ? links : (links?.data || []) });
    }
    return json({ error: 'Parámetro requerido' }, 400);
  } catch (e: any) { return fallo(e); }
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({})); const pn = b.pn || null;
  try {
    if (b.accion === 'perfil') {
      const p: any = {};
      for (const k of ['about', 'address', 'description', 'email', 'vertical']) if (k in b) p[k] = String(b[k] || '').trim() || undefined;
      if ('websites' in b) p.websites = (Array.isArray(b.websites) ? b.websites : String(b.websites || '').split(/[\n,]/)).map((w: string) => w.trim()).filter(Boolean).slice(0, 2);
      if (p.about && (p.about.length < 1 || p.about.length > 139)) return json({ error: 'El "about" debe tener entre 1 y 139 caracteres' }, 400);
      if (p.description && p.description.length > 512) return json({ error: 'La descripción no puede pasar de 512 caracteres' }, 400);
      return json({ ok: true, r: await guardarPerfil(p, pn) });
    }
    if (b.accion === 'foto') { const h = await handleDesdeUrl(String(b.url), pn); return json({ ok: true, r: await guardarPerfil({ profile_picture_handle: h }, pn) }); }
    if (b.accion === 'username') {
      const u = String(b.username || '').trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,30}$/.test(u)) return json({ error: 'El username admite minúsculas, números, punto y guión bajo (3 a 30).' }, 400);
      return json({ ok: true, r: await reservarUsername(u, pn) });
    }
    if (b.accion === 'username_borrar') return json({ ok: true, r: await borrarUsername(pn) });
    if (b.accion === 'display_name') {
      const nombre = String(b.nombre || '').trim(); if (nombre.length < 3) return json({ error: 'Escribe el nombre visible' }, 400);
      return json({ ok: true, r: await pedirDisplayName(nombre, pn) });
    }
    if (b.accion === 'numero') {
      if (!b.phone_number_id) return json({ error: 'Falta phone_number_id' }, 400);
      const { data: prev } = await supabase.from('wa_numeros').select('webhook_id').eq('phone_number_id', b.phone_number_id).maybeSingle();
      let webhook_id = prev?.webhook_id || null;
      // Activar un número = registrarle nuestro webhook (Kapso los maneja por número).
      if (b.activo && !webhook_id && b.phone_number_id !== (import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim()) {
        const secreto = (import.meta.env.KAPSO_WEBHOOK_SECRET || '').trim();
        const base = new URL(request.url).origin;
        const r = await registrarWebhook(`${base}/api/whatsapp/webhook?k=${secreto}`, secreto, b.phone_number_id).catch((e: any) => ({ error: String(e?.message || e) }));
        webhook_id = r?.id || r?.data?.id || null;
      }
      if (b.es_default) await supabase.from('wa_numeros').update({ es_default: false }).neq('phone_number_id', b.phone_number_id);
      await supabase.from('wa_numeros').upsert({ phone_number_id: String(b.phone_number_id), display_phone_number: b.display_phone_number || null, nombre: b.nombre || null, business_account_id: b.business_account_id || null, activo: !!b.activo, es_default: !!b.es_default, webhook_id }, { onConflict: 'phone_number_id' });
      return json({ ok: true, webhook_id });
    }
    if (b.accion === 'setup_link') {
      let { data: cfg } = await supabase.from('wa_config').select('kapso_customer_id').eq('id', 1).maybeSingle();
      let customerId = cfg?.kapso_customer_id || null;
      if (!customerId) { const c = await crearClienteKapso(String(b.nombre || 'Cliente Sacscloud'), b.external_id || undefined); customerId = c?.id || c?.data?.id; await supabase.from('wa_config').update({ kapso_customer_id: customerId }).eq('id', 1); }
      const l = await crearSetupLink(customerId, b.success_url || 'https://www.sacscloud.com/admin/crm?tab=wa-ajustes&conectado=1');
      const obj = l?.data || l; const link = obj?.url || obj?.setup_url || obj?.link || obj?.hosted_url || (obj?.token ? `https://app.kapso.ai/setup/${obj.token}` : null);
      return json({ ok: true, link: link || obj, expira: obj?.expires_at || null, customer_id: customerId });
    }
    return json({ error: 'Acción desconocida' }, 400);
  } catch (e: any) { return fallo(e); }
};
