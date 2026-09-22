// /d/<envío> — la liga con la que un documento de la biblioteca sale en un
// correo. Marca que se abrió y manda al documento.
//
// Es pública a propósito: la abre el cliente desde su correo. No expone nada:
// con un id que no existe (o mal formado) se va a la portada, y la dirección
// del documento es la misma que ya viaja en el correo.
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const prerender = false;
const UUID = /^[0-9a-f-]{36}$/i;

export const GET: APIRoute = async ({ params, request }) => {
  const id = String(params.id || '');
  const fuera = (u: string) => new Response(null, { status: 302, headers: { Location: u, 'Cache-Control': 'no-store' } });
  if (!UUID.test(id)) return fuera('https://www.sacscloud.com/');

  const { data: env } = await supabase.from('crm_documento_envios')
    .select('id, aperturas, abierto_at, company_id, crm_documentos(url, titulo)').eq('id', id).maybeSingle();
  const destino = (env as any)?.crm_documentos?.url;
  if (!env || !destino) return fuera('https://www.sacscloud.com/');

  /* Los antivirus de correo abren las ligas antes que la persona. No se puede
     distinguir del todo, pero un agente sin navegador no manda Accept de HTML;
     esos no cuentan como apertura. */
  const acepta = request.headers.get('accept') || '';
  if (/text\/html/.test(acepta)) {
    await supabase.from('crm_documento_envios').update({
      aperturas: Number(env.aperturas || 0) + 1,
      abierto_at: env.abierto_at || new Date().toISOString(),
    }).eq('id', id);
    if (!env.abierto_at && env.company_id) {
      await supabase.from('activities').insert({
        company_id: env.company_id, tipo: 'documento_abierto', automatico: true,
        titulo: 'Abrió «' + String((env as any).crm_documentos?.titulo || 'un documento') + '»',
      }).then(() => {}, () => {});
    }
  }
  return fuera(destino);
};
