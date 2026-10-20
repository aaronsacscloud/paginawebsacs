// Sirve los PDF adjuntos al checklist de entrega (resumen y checklist de la
// migración). Solo con una liga de sesión válida —la del orquestador (?s=) o
// la del cliente (?c=)—, porque traen cifras del cliente.
//
// GET ?d=resumen|checklist&s=<codigo>  |  &c=<codigo_cliente>  → application/pdf
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { DOCS_VTC } from '../../../lib/entrega/docs-vtc';

export const prerender = false;
const CODIGO = /^[a-z0-9]{12,40}$/;
const texto = (t: string, s: number) => new Response(t, { status: s, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const doc = DOCS_VTC[String(url.searchParams.get('d') || '')];
  if (!doc) return texto('Documento no encontrado.', 404);
  const s = String(url.searchParams.get('s') || ''), c = String(url.searchParams.get('c') || '');
  if (!CODIGO.test(s) && !CODIGO.test(c)) return texto('Abre el documento desde la liga de la sesión.', 403);
  const q = supabase.from('entregas_checklist').select('codigo');
  const { data, error } = await (CODIGO.test(s) ? q.eq('codigo', s) : q.eq('codigo_cliente', c)).maybeSingle();
  if (error) return texto('No se pudo abrir el documento. Intenta de nuevo.', 503);
  if (!data) return texto('Esta liga ya no existe.', 404);
  return new Response(Buffer.from(doc.b64, 'base64'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="' + doc.nombre + '"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
};
