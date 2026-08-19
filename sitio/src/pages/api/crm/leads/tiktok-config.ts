// GET /api/crm/leads/tiktok-config — estado de la conexión con la hoja.
//
// Existe para que el setup no dependa de que alguien entre a Vercel a leer un
// JSON en base64. Las dos cosas que se necesitan para conectar la hoja —con
// QUÉ correo compartirla y si el id ya está configurado— se ven desde el panel.
//
// No devuelve ningún secreto: el correo de la cuenta de servicio es público por
// diseño (es a quien se le comparte el documento), y del id de la hoja solo se
// dice si existe.
import type { APIRoute } from 'astro';
import { correoDeServicio } from '../../../../lib/google-sheets';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  const sheetId = (import.meta.env.TIKTOK_LEADS_SHEET_ID || '').trim();

  // Cuándo entró el último lead por la vía automática: es la prueba de que la
  // cadena completa está viva, no solo de que las variables están puestas.
  const { data: ultimo } = await supabase
    .from('contacts')
    .select('created_at, nombre, utm_campaign, propiedades')
    .eq('fuente', 'tiktok-lead-form')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('fuente', 'tiktok-lead-form');

  return new Response(JSON.stringify({
    correo_servicio: correoDeServicio(),
    hoja_configurada: !!sheetId,
    credencial_google: !!(import.meta.env.GOOGLE_SERVICE_ACCOUNT_B64 || '').trim(),
    total_leads_tiktok: count || 0,
    ultimo: ultimo ? {
      cuando: ultimo.created_at,
      nombre: ultimo.nombre,
      campana: ultimo.utm_campaign,
      via: (ultimo.propiedades as any)?.tiktok?.via || null,
    } : null,
  }), { headers: { 'Content-Type': 'application/json' } });
};
