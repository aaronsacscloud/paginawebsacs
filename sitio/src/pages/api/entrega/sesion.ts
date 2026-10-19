// Guarda y lee una sesión de CHECKLIST DE ENTREGA (19-oct-2026).
// La usa la página pública /entrega/<guia>: el consultor la llena en la
// tableta junto al cliente y cada cambio se guarda aquí. Sin sesión de CRM a
// propósito —la liga se abre en la tableta del consultor o del cliente—: la
// llave es el código largo y aleatorio de la URL, igual que una minuta.
//
// GET  ?s=<codigo>                      → { ok, sesion|null }
// POST { codigo, guia, cliente, data }  → { ok, updated_at }
// Último que guarda gana: una sesión la llena un solo consultor a la vez.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const CODIGO = /^[a-z0-9]{12,40}$/;
const GUIAS = new Set(['consignacion-suite', 'consignacion-dashboard-reportes']);
const MAX_BYTES = 600_000;

export const GET: APIRoute = async ({ url }) => {
  const codigo = String(url.searchParams.get('s') || '');
  if (!CODIGO.test(codigo)) return json({ ok: false, error: 'Código inválido.' }, 400);
  const { data, error } = await supabase.from('entregas_checklist')
    .select('codigo, guia, cliente, data, updated_at').eq('codigo', codigo).maybeSingle();
  if (error) return json({ ok: false, error: 'No se pudo leer la sesión.' }, 503);
  return json({ ok: true, sesion: data || null });
};

export const POST: APIRoute = async ({ request }) => {
  const texto = await request.text().catch(() => '');
  if (!texto || texto.length > MAX_BYTES) return json({ ok: false, error: 'La sesión es demasiado grande.' }, 413);
  let b: any;
  try { b = JSON.parse(texto); } catch (e) { return json({ ok: false, error: 'Petición inválida.' }, 400); }
  const codigo = String(b?.codigo || '');
  const guia = String(b?.guia || '');
  if (!CODIGO.test(codigo) || !GUIAS.has(guia)) return json({ ok: false, error: 'Petición inválida.' }, 400);
  if (!b?.data || typeof b.data !== 'object' || Array.isArray(b.data)) return json({ ok: false, error: 'Faltan los datos.' }, 400);
  const cliente = String(b?.cliente || '').replace(/\s+/g, ' ').trim().slice(0, 160) || null;

  const updated_at = new Date().toISOString();
  const { data: previa, error: eLee } = await supabase.from('entregas_checklist')
    .select('guia').eq('codigo', codigo).maybeSingle();
  if (eLee) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
  if (previa && previa.guia !== guia) return json({ ok: false, error: 'Ese código es de otra guía.' }, 409);

  const { error } = await supabase.from('entregas_checklist')
    .upsert({ codigo, guia, cliente, data: b.data, updated_at }, { onConflict: 'codigo' });
  if (error) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
  return json({ ok: true, updated_at });
};
