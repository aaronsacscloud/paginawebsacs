// TELEFONÍA · Reglas automáticas de llamadas (Configuración ▸ WhatsApp ▸ Llamadas).
// GET  → la regla, las plantillas UTILITY que se pueden usar y el número.
// POST → guarda (lista blanca de campos).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { NUMERO } from '../../../../lib/telefonia/twilio';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const CAMPOS = 'llamadas_regla_activa, llamadas_regla_cuando, llamadas_regla_texto, llamadas_regla_plantilla, llamadas_regla_una_vez, llamadas_regla_horario, horario';

export const GET: APIRoute = async () => {
  const [{ data: cfg }, { data: plantillas }, { data: maestro }] = await Promise.all([
    supabase.from('wa_config').select(CAMPOS).eq('id', 1).maybeSingle(),
    // Solo UTILITY aprobadas: fuera de la ventana de 24 h Meta rechaza las de
    // marketing, y ofrecer una que va a fallar es peor que no ofrecer ninguna.
    supabase.from('wa_plantillas').select('nombre, cuerpo, variables').eq('categoria', 'UTILITY').eq('status', 'APPROVED').order('nombre'),
    supabase.from('wa_automatizaciones').select('activa').eq('clave', 'llamada_sin_contacto').maybeSingle(),
  ]);
  return json({
    regla: cfg || {},
    plantillas: plantillas || [],
    numero: NUMERO || null,
    // El interruptor maestro vive en Automatizaciones. Se devuelve para poder
    // avisar si alguien pausó la telefonía desde allá.
    permitida: (maestro as any)?.activa === true,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const cambios: any = { id: 1, updated_at: new Date().toISOString() };

  if ('llamadas_regla_activa' in b) cambios.llamadas_regla_activa = !!b.llamadas_regla_activa;
  if ('llamadas_regla_cuando' in b) cambios.llamadas_regla_cuando = ['buzon', 'sin_contestar', 'ambos'].includes(b.llamadas_regla_cuando) ? b.llamadas_regla_cuando : 'ambos';
  if ('llamadas_regla_texto' in b) cambios.llamadas_regla_texto = String(b.llamadas_regla_texto || '').slice(0, 900) || null;
  if ('llamadas_regla_plantilla' in b) cambios.llamadas_regla_plantilla = String(b.llamadas_regla_plantilla || '').trim() || null;
  if ('llamadas_regla_una_vez' in b) cambios.llamadas_regla_una_vez = !!b.llamadas_regla_una_vez;
  if ('llamadas_regla_horario' in b) cambios.llamadas_regla_horario = !!b.llamadas_regla_horario;

  const { error } = await supabase.from('wa_config').upsert(cambios);
  if (error) return json({ error: error.message }, 500);

  /* UN SOLO INTERRUPTOR EN PANTALLA. La lista de permitidos
     (`wa_automatizaciones`) es fail-closed y protege de que alguien encienda
     una automatización sin que el dueño se entere; pero pedirle DOS switches
     para una sola regla es una trampa: la prende aquí, no pasa nada, y no hay
     forma de adivinar por qué. El de la pantalla mueve los dos. */
  if ('llamadas_regla_activa' in b) {
    await supabase.from('wa_automatizaciones')
      .update({ activa: !!b.llamadas_regla_activa, updated_at: new Date().toISOString() })
      .eq('clave', 'llamada_sin_contacto');
  }
  return json({ ok: true });
};
