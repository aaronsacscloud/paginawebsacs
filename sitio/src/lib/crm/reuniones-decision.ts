// Qué pasa DESPUÉS de la minuta (decisión del dueño 2026-09-03): la minuta le dice al sistema y al agente qué sigue.
//  cotizar          → el agente se retira (ya lo hace por «asistió»); la cadena espera cotización en 48 h.
//  segunda_reunion  → no se exige cotización; tarea de agendar la siguiente si no existe una cita futura.
//  retomar          → el agente se pausa hasta la fecha y retoma solo con lo que dijo el lead.
//  sin_interes      → lead descalificado con motivo, oportunidad perdida, agente cerrado.
import { supabase } from '../supabase';

export type DecisionMinuta = { tipo: 'cotizar' | 'segunda_reunion' | 'retomar' | 'sin_interes'; fecha?: string | null; motivo?: string | null; at?: string };

export async function aplicarDecisionMinuta(bookingId: string, decision: DecisionMinuta, quien?: string | null) {
  const { data: b } = await supabase.from('bookings').select('id, contact_id, deal_id, consultor_id, fecha, invitee_nombre, contacts(id, nombre, owner_id, company_id)').eq('id', bookingId).maybeSingle();
  if (!b?.contact_id) return;
  const c: any = (b as any).contacts || {}; const cid = b.contact_id; const ahora = new Date().toISOString();
  const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', cid).maybeSingle();
  const st: any = (pf as any)?.agente_estado || {};
  const guardarSt = (extra: any) => supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...st, ...extra, minuta_decision: { ...decision, booking_id: bookingId } }, updated_at: ahora }, { onConflict: 'contact_id' });
  const n = String(c.nombre || b.invitee_nombre || 'el lead').split(/\s+/)[0];
  const nota = (titulo: string, descripcion: string) => supabase.from('activities').insert({ contact_id: cid, company_id: c.company_id || null, deal_id: b.deal_id || null, tipo: 'nota', titulo, descripcion, metadata: { booking_id: bookingId, decision: decision.tipo, por: quien || null } }).then(() => {}, () => {});

  if (decision.tipo === 'cotizar') {
    await guardarSt({ cerrado: undefined });
    await supabase.from('contacts').update({ estatus_lead: 'demo_hecha', estatus_lead_at: ahora }).eq('id', cid).not('estatus_lead', 'in', '("cotizado","descartado")');
    await nota('Minuta: cotizar', 'La reunión terminó con interés: se espera la cotización en 48 h.');
  } else if (decision.tipo === 'segunda_reunion') {
    await guardarSt({ cerrado: undefined });
    if (decision.fecha) await supabase.from('contacts').update({ next_followup: decision.fecha, proximo_paso: `Segunda reunión${decision.motivo ? `: ${decision.motivo}` : ''}` }).eq('id', cid);
    const { data: fut } = await supabase.from('bookings').select('id').eq('contact_id', cid).in('estado', ['agendada', 'confirmada', 'reagendada']).gte('fecha', new Date().toISOString().slice(0, 10)).limit(1);
    if (!(fut || []).length) {
      const { data: ya } = await supabase.from('ti_tareas').select('id').eq('contact_id', cid).eq('estado', 'pendiente').filter('payload->>reloj', 'eq', 'segunda_reunion').limit(1);
      if (!(ya || []).length) await supabase.from('ti_tareas').insert({ contact_id: cid, company_id: c.company_id || null, owner_id: b.consultor_id || c.owner_id || null, familia: 'avanzar', tipo: 'llamada', prioridad: 3, vence_at: ahora, origen: 'reloj', payload: { instruccion: `Agenda la segunda reunión con ${n}${decision.fecha ? ` (habló de ${decision.fecha})` : ''}`, porque: `La minuta dice que falta otra junta${decision.motivo ? `: ${decision.motivo}` : ''}. Sin cita en el calendario, se enfría.`, nombre: c.nombre, reloj: 'segunda_reunion', sujeto: bookingId, tipo_llamada: 'Agendar segunda reunión', resultados: { agendada: 'Quedó agendada', despues: 'Lo veo después', cayo: 'Ya no quiere' } } });
    }
    await nota('Minuta: segunda reunión', `Queda pendiente otra junta${decision.fecha ? ` para ${decision.fecha}` : ''}${decision.motivo ? `: ${decision.motivo}` : ''}.`);
  } else if (decision.tipo === 'retomar') {
    const hasta = decision.fecha ? new Date(`${decision.fecha}T16:00:00.000Z`).toISOString() : new Date(Date.now() + 90 * 86400e3).toISOString();
    await guardarSt({ pausa_hasta: hasta, base_at: hasta, toque: 0, tarjeta_id: null, tarjeta_at: null, llamada_at: null, cerrado: undefined, retomar: { fecha: decision.fecha, motivo: decision.motivo || '', desde: ahora }, angulo_sugerido: `retomar lo que dijo en la demo: ${decision.motivo || 'no era el momento'}` });
    await supabase.from('contacts').update({ next_followup: decision.fecha || null, proximo_paso: `Retomar${decision.fecha ? ` el ${decision.fecha}` : ''}${decision.motivo ? `: ${decision.motivo}` : ''}`, lifecycle_stage: 'rezagado' }).eq('id', cid).not('lifecycle_stage', 'in', '("cliente","oportunidad")');
    await nota('Minuta: retomar después', `No era el momento${decision.motivo ? ` (${decision.motivo})` : ''}. El agente retoma solo el ${decision.fecha || 'en 90 días'}.`);
  } else if (decision.tipo === 'sin_interes') {
    await guardarSt({ cerrado: 'sin_interes' });
    await supabase.from('contacts').update({ lifecycle_stage: 'descalificado', descarte_categoria: 'sin_interes_post_demo', estatus_lead: 'descartado', estatus_lead_at: ahora }).eq('id', cid).neq('lifecycle_stage', 'cliente');
    await supabase.from('deals').update({ stage: 'cerrada_perdida', motivo_perdida: decision.motivo || 'sin interés tras la demo', closed_at: ahora, stage_changed_at: ahora }).eq('contact_id', cid).not('stage', 'in', '("cerrada_ganada","cerrada_perdida")');
    await supabase.from('ti_tareas').update({ estado: 'retirada', retirada_causa: 'lead_sin_interes' }).eq('contact_id', cid).eq('estado', 'pendiente').filter('payload->>campo_clave', 'in', '("reunion_interes","reunion_minuta")');
    await nota('Minuta: sin interés', decision.motivo || 'Quedó claro que no.');
  }
}
