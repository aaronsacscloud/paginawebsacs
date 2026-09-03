// ══ Equipo · los avisos a una persona ═══════════════════════════════════════
//
// Cuando te mencionan, te responden o te asignan un acuerdo, pasan dos cosas:
// entra a la campana del CRM (crm_notificaciones con `para` = tú) y, si tienes
// la PWA con avisos, te llega un push. Nunca al equipo entero: el chat ya está
// a la vista de todos; el aviso es para quien no lo está mirando.
import { supabase } from '../supabase';
import { pushA } from './push-crm';

export type Aviso = {
  para: string;
  tipo: 'espacio_mencion' | 'espacio_respuesta' | 'espacio_acuerdo' | 'espacio_importante' | 'espacio_directo' | 'espacio_publicacion';
  titulo: string;
  detalle?: string;
  canal_id: string;
  mensaje_id?: string;
  hilo_de?: string | null;
  nivel?: 'info' | 'alerta';
};

export async function avisar(a: Aviso): Promise<void> {
  const params = new URLSearchParams({ tab: 'equipo', canal: a.canal_id });
  if (a.mensaje_id) params.set('msg', a.mensaje_id);
  if (a.hilo_de) params.set('hilo', a.hilo_de);
  const destino = `equipo?${params.toString().replace(/^tab=equipo&?/, '')}`;
  try {
    await supabase.from('crm_notificaciones').insert({
      clave: `${a.tipo}:${a.mensaje_id || a.canal_id}:${a.para}`,
      tipo: a.tipo, nivel: a.nivel || 'info', titulo: a.titulo, detalle: (a.detalle || '').slice(0, 300) || null,
      destino, para: a.para,
      metadata: { canal_id: a.canal_id, mensaje_id: a.mensaje_id || null, hilo_de: a.hilo_de || null },
    });
  } catch { /* la campana no puede tumbar el envío del mensaje */ }
  try {
    await pushA(a.para, {
      title: a.titulo,
      body: (a.detalle || '').slice(0, 140) || 'Toca para verlo',
      tag: `equipo-${a.canal_id}`,
      url: `/admin/crm?${params.toString()}`,
      requireInteraction: a.nivel === 'alerta',
      data: { canal_id: a.canal_id, mensaje_id: a.mensaje_id || null },
    });
  } catch { /* idem */ }
}
