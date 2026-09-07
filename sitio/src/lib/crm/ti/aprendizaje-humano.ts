/**
 * LO QUE ESCRIBE UN HUMANO TAMBIÉN ENSEÑA (decisión del dueño, 2026-09-07).
 *
 * Hasta hoy el agente aprendía de sus propias sugerencias (enviar / modificar / rechazar) y de las respuestas humanas
 * SOLO cuando existía una sugerencia con la cual compararlas. Lo que el consultor manda por su cuenta en el día, desde
 * el inbox o desde el teléfono, sin sugerencia de por medio, no dejaba lección. Ahora:
 *
 *   1. Cada mensaje saliente escrito por una persona (no el agente, no el sistema) a un LEAD se convierte en ejemplo:
 *      con lo último que dijo el lead, la etapa, si era respuesta o seguimiento, y quién lo escribió.
 *   2. Si lo escribió el dueño o un admin (o salió del teléfono del negocio), entra APROBADO: es el estándar. Si lo
 *      escribió un partner, entra «dudoso» y el ciclo nocturno lo cura como los demás.
 *   3. Con eso pesa de inmediato en las redacciones (ejemplos por parecido) y de noche en las propuestas de regla.
 *
 * Idempotente: cada mensaje se registra una sola vez (por_que lleva «wa:<id>»).
 */
import { supabase } from '../../supabase';

const AUTORES_SISTEMA = /^(agente sacs|sistema|agenda|secuencias|equipo \(respond\.io\))$/i;

export async function aprenderDeHumanos(opts: { horas?: number; max?: number } = {}): Promise<{ aprendidos: number; aprobados: number; dudosos: number; saltados: number }> {
  const res = { aprendidos: 0, aprobados: 0, dudosos: 0, saltados: 0 };
  const desde = new Date(Date.now() - (opts.horas ?? 26) * 3600e3).toISOString();
  const { data: msjs } = await supabase.from('wa_mensajes')
    .select('id, conversation_id, cuerpo, autor, autor_id, tipo, metadata, created_at, wa_conversaciones!inner(contact_id, interna)')
    .eq('direccion', 'saliente').in('tipo', ['text', 'template']).gt('created_at', desde).is('borrado_at', null)
    .order('created_at', { ascending: true }).limit(opts.max ?? 40);
  if (!(msjs || []).length) return res;

  const { data: equipo } = await supabase.from('team_members').select('id, nombre, rol');
  const rolDe = (id?: string | null) => (equipo || []).find(t => t.id === id)?.rol || null;

  for (const m of msjs || []) {
    const conv: any = (m as any).wa_conversaciones || {};
    const md: any = m.metadata || {};
    const texto = String(m.cuerpo || '').trim();
    if (!conv.contact_id || conv.interna || md.origen === 'agente' || md.sistema || AUTORES_SISTEMA.test(String(m.autor || '')) || texto.length < 12 || /^\[plantilla /i.test(texto)) { res.saltados++; continue; }
    // Ya registrado (por este barrido, o por la comparación con una sugerencia del agente).
    const { data: ya } = await supabase.from('ia_ejemplos').select('id').ilike('por_que', `%wa:${m.id}%`).limit(1);
    if ((ya || []).length) { res.saltados++; continue; }
    const { data: par } = await supabase.from('ti_envios').select('id').eq('contact_id', conv.contact_id).eq('estado', 'humano_respondio').gte('humano_at', new Date(Date.parse(m.created_at) - 3 * 60e3).toISOString()).lte('humano_at', new Date(Date.parse(m.created_at) + 3 * 60e3).toISOString()).limit(1);
    if ((par || []).length) { res.saltados++; continue; }

    const { data: c } = await supabase.from('contacts').select('id, nombre, lifecycle_stage, giro').eq('id', conv.contact_id).maybeSingle();
    if (!c || ['cliente', 'churned', 'evangelista'].includes(String(c.lifecycle_stage || ''))) { res.saltados++; continue; }

    // Contexto: lo anterior en el hilo.
    const { data: antes } = await supabase.from('wa_mensajes').select('direccion, cuerpo, transcript, tipo, created_at').eq('conversation_id', m.conversation_id).lt('created_at', m.created_at).is('borrado_at', null).order('created_at', { ascending: false }).limit(6);
    const ultLead = (antes || []).find(x => x.direccion === 'entrante');
    const mensajeLead = ultLead ? String(ultLead.cuerpo || ultLead.transcript || `[${ultLead.tipo}]`).slice(0, 400) : null;
    const horasDesdeLead = ultLead ? (Date.parse(m.created_at) - Date.parse(ultLead.created_at)) / 3600e3 : null;
    const esSeguimiento = horasDesdeLead === null || horasDesdeLead > 20;
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', c.id).maybeSingle();
    const estado = esSeguimiento ? 'silencio' : String((pf?.agente_estado as any)?.estado_guion || 'descubriendo');
    const rol = rolDe(m.autor_id);
    const autor = String(m.autor || (m.autor_id ? 'consultor' : 'teléfono del negocio'));
    const aprobado = !m.autor_id || rol === 'founder' || rol === 'admin';
    const situacion = `El consultor (${autor}) escribió por su cuenta en el inbox: ${esSeguimiento ? `seguimiento sin respuesta del lead${horasDesdeLead !== null ? ` (${Math.round(horasDesdeLead)} h después de su último mensaje)` : ''}` : 'respuesta al lead'}, etapa ${estado}${c.giro ? `, giro ${c.giro}` : ''}. ${mensajeLead ? `Lo último que dijo el lead: «${mensajeLead.slice(0, 220)}»` : 'El lead no había escrito antes.'}`;
    const { error } = await supabase.from('ia_ejemplos').insert({
      estado, situacion, mensaje_lead: mensajeLead, respuesta: texto, pulida: texto,
      por_que: `HUMANO EN EL INBOX · wa:${m.id} · autor: ${autor}${rol ? ` (${rol})` : ''} · ${esSeguimiento ? 'seguimiento' : 'respuesta'}`,
      fuente: 'humano_inbox', contact_id: c.id, conversation_id: m.conversation_id,
      estado_rev: aprobado ? 'aprobado' : 'dudoso', revisado_at: aprobado ? new Date().toISOString() : null,
    });
    if (error) { res.saltados++; continue; }
    res.aprendidos++; if (aprobado) res.aprobados++; else res.dudosos++;
    await supabase.from('ia_log').insert({ accion: 'humano_aprendido', contact_id: c.id, razon: `${autor} · ${esSeguimiento ? 'seguimiento' : 'respuesta'} · ${aprobado ? 'aprobado' : 'dudoso'}`, contenido: texto.slice(0, 400), detalle: { wa_id: m.id, estado } }).then(() => {}, () => {});
  }
  return res;
}
