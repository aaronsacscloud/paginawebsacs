/**
 * FOTOS DEL LEAD (decisión del dueño, 2026-09-05): cuando el lead manda una foto de su tienda, su producto, su
 * pantalla o su lista de precios, el agente la MIRA. Antes la ignoraba (veía «[image]»). Lo que se ve se guarda en
 * wa_mensajes.transcript, igual que las notas de voz: se paga una sola vez y el hilo lo recuerda siempre.
 * Con eso el agente le da contexto de lo que está viendo y pregunta más de su negocio: buscamos conectar.
 *
 * Había 227 fotos entrantes en 90 días que el agente nunca vio.
 */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';

const PROMPT = `Eres asesora comercial de Sacs (sistema para tiendas de moda, calzado, joyería y retail en México). Un prospecto te mandó esto por WhatsApp (imagen o PDF).
SI ES UN COMPROBANTE DE PAGO (transferencia SPEI, depósito, recibo de banco, captura de app bancaria, pago de Mercado Pago): empieza EXACTAMENTE con «COMPROBANTE DE PAGO:» y en una línea di monto, fecha, banco emisor, beneficiario o cuenta destino si se lee, referencia o clave de rastreo si se lee, y si el estatus dice aplicado/enviado/pendiente. Nada más.
SI NO: describe en español, en 2 o 3 líneas y sin inventar, lo que se ve y lo que le dice a una asesora sobre SU negocio: tipo de tienda o producto, marca o letrero si se lee, cómo exhibe, si es la pantalla de otro sistema o de Excel (cuál), si es una lista de precios, un ticket, una etiqueta, un local, un catálogo. Cierra con UN detalle concreto que valga la pena comentarle (algo que note que la viste de verdad). Si es un meme, un sticker, una captura ajena o algo sin relación con un negocio, dilo en una línea. Sin viñetas ni encabezados.`;

const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
/** Los tipos de mensaje que se miran: fotos y documentos (PDF). */
export const TIPOS_MIRABLES = ['image', 'document', 'file'];

async function bajar(url: string, mimeGuardado?: string | null): Promise<{ b64: string; mime: string; pdf: boolean } | null> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > 4.5e6) return null;
  const ct = String(r.headers.get('content-type') || '').split(';')[0].trim();
  const esPdf = ct === 'application/pdf' || String(mimeGuardado || '') === 'application/pdf' || buf.subarray(0, 5).toString() === '%PDF-';
  if (esPdf) return { b64: buf.toString('base64'), mime: 'application/pdf', pdf: true };
  const mime = MIME_OK.has(ct) ? ct : MIME_OK.has(String(mimeGuardado || '')) ? String(mimeGuardado) : 'image/jpeg';
  return { b64: buf.toString('base64'), mime, pdf: false };
}

/** Una foto o un PDF → lo que se ve, en 2-3 líneas (o «COMPROBANTE DE PAGO: …»). Sonnet: barato y ve bien. */
export async function describirFoto(url: string, mime?: string | null): Promise<{ texto: string | null; costo: number }> {
  if (!hasApiKey() || !url) return { texto: null, costo: 0 };
  const img = await bajar(url, mime);
  if (!img) return { texto: null, costo: 0 };
  // Un documento que no es PDF (Word, Excel) no se puede mirar: se deja como está.
  if (!img.pdf && !MIME_OK.has(img.mime)) return { texto: null, costo: 0 };
  const bloque: any = img.pdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: img.b64 } }
    : { type: 'image', source: { type: 'base64', media_type: img.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: img.b64 } };
  const r: any = await anthropic.messages.create({
    model: MODELS.sonnet, max_tokens: 260,
    messages: [{ role: 'user', content: [bloque, { type: 'text', text: PROMPT }] }],
  });
  const texto = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  return { texto: texto || null, costo: calculateCost(MODELS.sonnet, r.usage as any).cost_usd };
}

/** Describe (y guarda) las fotos entrantes de un hilo que todavía no se han mirado. Muta `msjs` para que el
 *  turno que viene las vea ya descritas. Máximo `max`, las más recientes. */
export async function describirFotosDe(msjs: any[], max = 3): Promise<{ descritas: number; costo: number }> {
  const res = { descritas: 0, costo: 0 };
  const pend = msjs.filter(m => m.direccion === 'entrante' && TIPOS_MIRABLES.includes(m.tipo) && m.media_url && m.id && (m.transcript == null || m.transcript === '')).slice(-max);
  for (const m of pend) {
    try {
      const d = await describirFoto(m.media_url, m.mime);
      m.transcript = d.texto || '';
      res.costo += d.costo;
      if (d.texto) res.descritas++;
      await supabase.from('wa_mensajes').update({ transcript: d.texto || '' }).eq('id', m.id);   // '' = intentado, sin resultado
    } catch { /* la foto se queda como «[foto]»; no bloquea el turno */ }
  }
  return res;
}

/** Barrido (observador): fotos entrantes de los últimos `dias` sin describir, para que el hilo ya las tenga
 *  cuando el agente o el consultor lo abran. */
export async function describirFotosPendientes(opts: { dias?: number; max?: number } = {}): Promise<any> {
  const res: any = { descritas: 0, sin_media: 0, errores: 0, costo: 0 };
  if (!hasApiKey()) return { fotos: 'sin_api_key' };
  const desde = new Date(Date.now() - (opts.dias ?? 3) * 86400e3).toISOString();
  const { data: fotos } = await supabase.from('wa_mensajes').select('id, media_url, mime, created_at')
    .in('tipo', TIPOS_MIRABLES).eq('direccion', 'entrante').is('transcript', null).is('borrado_at', null)
    .gte('created_at', desde).order('created_at', { ascending: false }).limit(opts.max ?? 6);
  for (const f of fotos || []) {
    try {
      if (!f.media_url) { res.sin_media++; await supabase.from('wa_mensajes').update({ transcript: '' }).eq('id', f.id); continue; }
      const d = await describirFoto(f.media_url, f.mime);
      await supabase.from('wa_mensajes').update({ transcript: d.texto || '' }).eq('id', f.id);
      res.costo += d.costo; if (d.texto) res.descritas++;
    } catch (e: any) { res.errores++; res.ultimo_error = String(e?.message || e).slice(0, 120); }
  }
  return res;
}
