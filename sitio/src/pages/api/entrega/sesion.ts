// Guarda y lee una sesión de CHECKLIST DE ENTREGA (19-oct-2026).
// La usa la página pública /entrega/<guia>: el consultor la llena en la
// tableta junto al cliente y cada cambio se guarda aquí. Sin sesión de CRM a
// propósito —la liga se abre en la tableta del consultor o del cliente—: la
// llave es el código largo y aleatorio de la URL, igual que una minuta.
//
// Dos ligas por sesión:
//  · ?s=<codigo>          la del CONSULTOR: lee y escribe todo.
//  · ?c=<codigo_cliente>  la del CLIENTE: solo lee y firma.
//
// GET  ?s= | ?c=                                 → { ok, sesion|null, rol }
// POST { codigo, guia, cliente, data, base? }    → guarda (consultor)
//      base = el updated_at sobre el que se editó. Si otra tableta guardó
//      después, responde 409 { conflicto, sesion } y la página fusiona sus
//      cambios con los de la otra antes de reintentar: nadie pisa a nadie.
// POST { accion:'firmar', codigo|cc, id, firma } → firma una etapa ('__cierre' = el cierre)
//
// Las firmas viven en su propia columna y solo las escribe «firmar»: así el
// guardado automático del consultor (último que guarda gana) nunca pisa una
// firma que el cliente acaba de hacer desde su teléfono.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const CODIGO = /^[a-z0-9]{12,40}$/;
const ID_SEC = /^[a-z0-9_-]{1,60}$/i;
const GUIAS = new Set(['consignacion-suite-v2', 'consignacion-suite', 'consignacion-dashboard-reportes']);
// Las firmas se guardan como trazo SVG (~2–10 KB cada una) en su columna; las
// fotos van a Storage y aquí solo viaja su URL. El tope deja holgura.
const MAX_BYTES = 3_000_000;
const COLS = 'codigo, codigo_cliente, guia, cliente, data, firmas, updated_at';

function nuevoCodigo() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return Array.from(a, b => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
}

async function porCodigo(codigo: string) {
  return supabase.from('entregas_checklist').select(COLS).eq('codigo', codigo).maybeSingle();
}
async function porCliente(cc: string) {
  return supabase.from('entregas_checklist').select(COLS).eq('codigo_cliente', cc).maybeSingle();
}

export const GET: APIRoute = async ({ url }) => {
  const s = String(url.searchParams.get('s') || '');
  const c = String(url.searchParams.get('c') || '');
  if (CODIGO.test(s)) {
    const { data, error } = await porCodigo(s);
    if (error) return json({ ok: false, error: 'No se pudo leer la sesión.' }, 503);
    return json({ ok: true, rol: 'consultor', sesion: data || null });
  }
  if (CODIGO.test(c)) {
    const { data, error } = await porCliente(c);
    if (error) return json({ ok: false, error: 'No se pudo leer la sesión.' }, 503);
    if (!data) return json({ ok: false, error: 'Esta liga ya no existe.' }, 404);
    // El cliente no recibe el código del consultor: con él podría editar.
    const { codigo: _c, ...resto } = data as any;
    return json({ ok: true, rol: 'cliente', sesion: resto });
  }
  return json({ ok: false, error: 'Código inválido.' }, 400);
};

export const POST: APIRoute = async ({ request }) => {
  const texto = await request.text().catch(() => '');
  if (!texto || texto.length > MAX_BYTES) return json({ ok: false, error: 'La sesión es demasiado grande.' }, 413);
  let b: any;
  try { b = JSON.parse(texto); } catch (e) { return json({ ok: false, error: 'Petición inválida.' }, 400); }

  if (b?.accion === 'firmar') return firmar(b);

  const codigo = String(b?.codigo || '');
  const guia = String(b?.guia || '');
  if (!CODIGO.test(codigo) || !GUIAS.has(guia)) return json({ ok: false, error: 'Petición inválida.' }, 400);
  if (!b?.data || typeof b.data !== 'object' || Array.isArray(b.data)) return json({ ok: false, error: 'Faltan los datos.' }, 400);
  const cliente = String(b?.cliente || '').replace(/\s+/g, ' ').trim().slice(0, 160) || null;
  const data = { ...b.data };
  delete data.firmas;

  const { data: previa, error: eLee } = await supabase.from('entregas_checklist')
    .select('guia, codigo_cliente').eq('codigo', codigo).maybeSingle();
  if (eLee) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
  if (previa && previa.guia !== guia) return json({ ok: false, error: 'Ese código es de otra guía.' }, 409);

  const updated_at = new Date().toISOString();
  const codigo_cliente = previa?.codigo_cliente || nuevoCodigo();
  const base = String(b?.base || '');
  if (previa && base) {
    // Escritura condicionada: solo si nadie guardó desde «base». Atómica en la
    // base de datos, así dos tabletas que guardan al mismo segundo no se pisan.
    const { data: filas, error } = await supabase.from('entregas_checklist')
      .update({ cliente, data, updated_at }).eq('codigo', codigo).eq('updated_at', base).select('codigo');
    if (error) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
    if (!filas || !filas.length) {
      const { data: actual, error: eA } = await porCodigo(codigo);
      if (eA || !actual) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
      return json({ ok: false, conflicto: true, sesion: actual }, 409);
    }
    return json({ ok: true, updated_at, codigo_cliente });
  }
  const { error } = await supabase.from('entregas_checklist')
    .upsert({ codigo, guia, cliente, data, updated_at, codigo_cliente }, { onConflict: 'codigo' });
  if (error) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
  return json({ ok: true, updated_at, codigo_cliente });
};

// Firma (o quita la firma de) una etapa. El cliente solo puede firmar lo que
// aún no está firmado; quitar una firma es cosa del consultor.
async function firmar(b: any) {
  const codigo = String(b?.codigo || ''), cc = String(b?.cc || '');
  const id = String(b?.id || '');
  if ((!CODIGO.test(codigo) && !CODIGO.test(cc)) || !ID_SEC.test(id)) return json({ ok: false, error: 'Petición inválida.' }, 400);
  const esCliente = !CODIGO.test(codigo);
  const { data: fila, error } = esCliente ? await porCliente(cc) : await porCodigo(codigo);
  if (error) return json({ ok: false, error: 'No se pudo firmar.' }, 503);
  if (!fila) return json({ ok: false, error: 'Esa sesión ya no existe.' }, 404);

  const firmas: Record<string, any> = { ...((fila as any).firmas || {}) };
  const f = b?.firma;
  if (f === null) {
    if (esCliente) return json({ ok: false, error: 'Solo el consultor puede quitar una firma.' }, 403);
    delete firmas[id];
  } else {
    const nombre = String(f?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const d = String(f?.d || '');
    if (nombre.length < 3) return json({ ok: false, error: 'Escribe el nombre de quien firma.' }, 400);
    if (!/^[ML0-9 .-]+$/.test(d) || d.length < 10 || d.length > 40_000) return json({ ok: false, error: 'Dibuja la firma en el recuadro.' }, 400);
    if (esCliente && firmas[id]) return json({ ok: false, error: 'Esta etapa ya está firmada.' }, 409);
    firmas[id] = {
      nombre, d,
      puesto: String(f?.puesto || '').trim().slice(0, 80),
      h: String(f?.h || '').slice(0, 20),
      at: new Date().toISOString(),
      desde: esCliente ? 'cliente' : 'consultor',
    };
  }
  const { error: eW } = await supabase.from('entregas_checklist').update({ firmas }).eq('codigo', (fila as any).codigo);
  if (eW) return json({ ok: false, error: 'No se pudo guardar la firma.' }, 503);
  return json({ ok: true, firmas });
}
