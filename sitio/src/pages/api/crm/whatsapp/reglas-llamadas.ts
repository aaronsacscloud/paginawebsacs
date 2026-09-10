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
const CAMPOS = 'llamadas_regla_activa, llamadas_regla_cuando, llamadas_regla_texto, llamadas_regla_plantilla, llamadas_regla_una_vez, llamadas_regla_horario, horario, minuta_envio_activa, minuta_envio_plantilla_doc, minuta_envio_plantilla_aviso, minuta_envio_caduca_dias, minuta_envio_texto';

export const GET: APIRoute = async () => {
  const [{ data: cfg }, { data: plantillas }, { data: maestro }] = await Promise.all([
    supabase.from('wa_config').select(CAMPOS).eq('id', 1).maybeSingle(),
    // Solo UTILITY aprobadas: fuera de la ventana de 24 h Meta rechaza las de
    // marketing, y ofrecer una que va a fallar es peor que no ofrecer ninguna.
    supabase.from('wa_plantillas').select('nombre, cuerpo, variables, categoria, header_tipo').eq('status', 'APPROVED').order('nombre'),
    supabase.from('wa_automatizaciones').select('clave, activa').in('clave', ['llamada_sin_contacto', 'minuta_llamada']),
  ]);
  const aprobadas = (plantillas || []) as any[];
  return json({
    regla: cfg || {},
    // Para la regla de «no logré contacto» solo sirven las UTILITY.
    plantillas: aprobadas.filter(p => p.categoria === 'UTILITY'),
    /* Para mandar el PDF fuera de la ventana de 24 h hace falta una plantilla
       con encabezado de DOCUMENTO. Hoy no hay ninguna aprobada, y por eso la
       pantalla tiene que decirlo en vez de ofrecer una lista vacía sin
       explicación. */
    plantillasDoc: aprobadas.filter(p => String(p.header_tipo || '').toUpperCase() === 'DOCUMENT'),
    numero: NUMERO || null,
    // El interruptor maestro vive en Automatizaciones. Se devuelve para poder
    // avisar si alguien pausó la telefonía desde allá.
    permitida: ((maestro as any[]) || []).find(m => m.clave === 'llamada_sin_contacto')?.activa === true,
    permitidaMinuta: ((maestro as any[]) || []).find(m => m.clave === 'minuta_llamada')?.activa === true,
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

  if ('minuta_envio_activa' in b) cambios.minuta_envio_activa = !!b.minuta_envio_activa;
  if ('minuta_envio_plantilla_doc' in b) cambios.minuta_envio_plantilla_doc = String(b.minuta_envio_plantilla_doc || '').trim() || null;
  if ('minuta_envio_plantilla_aviso' in b) cambios.minuta_envio_plantilla_aviso = String(b.minuta_envio_plantilla_aviso || '').trim() || null;
  if ('minuta_envio_caduca_dias' in b) cambios.minuta_envio_caduca_dias = Math.min(60, Math.max(1, parseInt(b.minuta_envio_caduca_dias, 10) || 7));
  if ('minuta_envio_texto' in b) cambios.minuta_envio_texto = String(b.minuta_envio_texto || '').slice(0, 900) || null;

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
  if ('minuta_envio_activa' in b) {
    await supabase.from('wa_automatizaciones')
      .update({ activa: !!b.minuta_envio_activa, updated_at: new Date().toISOString() })
      .eq('clave', 'minuta_llamada');
  }
  return json({ ok: true });
};
