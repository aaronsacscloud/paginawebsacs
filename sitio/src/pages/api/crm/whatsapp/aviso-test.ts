// QA · Prueba del aviso de lead al equipo: devuelve POR TELÉFONO si el envío
// salió o el error exacto de Kapso (p. ej. 422 fuera de ventana).
import type { APIRoute } from 'astro';
import { avisarNuevoLead } from '../../../../lib/crm/aviso-lead';

export const prerender = false;
export const GET: APIRoute = async () => {
  const r = await avisarNuevoLead({ id: 'test', nombre: 'Prueba de aviso', whatsapp: '+520000000000', fuente: 'QA del sistema' }, 'Esto es una prueba del aviso al equipo.');
  return new Response(JSON.stringify({ resultados: r }), { headers: { 'Content-Type': 'application/json' } });
};
