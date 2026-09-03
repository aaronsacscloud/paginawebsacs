import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { briefPorToken, etapasDe, json } from '../../../lib/proyecto/store';
import { ETAPAS } from '../../../lib/proyecto/etapas';
import { hilosDe, pendientesDelCliente } from '../../../lib/proyecto/hilos';

export const prerender = false;

// Estado completo del brief. Público a propósito: la llave es el token.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token') || '';
  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);

  const etapas = await etapasDe(brief.id);
  const hilos = await hilosDe(brief.id);

  // Contador de vistas: sirve para saber si el cliente ya lo abrió antes de
  // llamarle. No es analítica, es seguimiento.
  await supabase
    .from('proyecto_brief')
    .update({ vistas: (brief as any).vistas + 1 || 1, ultima_vista_at: new Date().toISOString() })
    .eq('id', brief.id);

  const { data: log } = await supabase
    .from('proyecto_bitacora')
    .select('etapa_clave, actor, accion, detalle, at')
    .eq('brief_id', brief.id)
    .order('at', { ascending: false })
    .limit(50);

  return json({
    brief: {
      cliente: brief.cliente,
      proyecto: brief.proyecto,
      contacto: brief.contacto,
      email: brief.email,
      quote_numero: brief.quote_numero,
      resumen: brief.resumen,
      firmado_por: brief.firmado_por,
      firmado_puesto: brief.firmado_puesto,
      firmado_at: brief.firmado_at,
      avisos_email: brief.avisos_email || [],
      created_at: brief.created_at,
    },
    etapas,
    hilos,
    pendientes: pendientesDelCliente(hilos).map((h) => ({ etapa: h.etapa_clave, campo: h.campo_id })),
    definicion: ETAPAS,
    bitacora: log || [],
  });
};
