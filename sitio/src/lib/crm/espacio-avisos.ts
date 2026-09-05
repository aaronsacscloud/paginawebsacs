// ══ Equipo · los avisos a una persona ═══════════════════════════════════════
//
// Cuando te mencionan, te responden o te asignan un acuerdo, pasan dos cosas:
// entra a la campana del CRM (crm_notificaciones con `para` = tú) y, si tienes
// la PWA con avisos, te llega un push. Nunca al equipo entero: el chat ya está
// a la vista de todos; el aviso es para quien no lo está mirando.
import { supabase } from '../supabase';
import { pushA } from './push-crm';
import { puedeEmpujar, tagDe, ENFRIAMIENTO_MIN } from './push-reglas';

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
  /* El push, con ENFRIAMIENTO por canal (5-sep-2026).
     Sin él, una plática de veinte mensajes en un canal son veinte vibraciones
     —y esa era la queja—. Con él, el primero avisa y los siguientes 15 minutos
     callan: el aviso sigue haciendo su trabajo (te enteras de que hay
     conversación) sin volverse ruido.
     Los directos y las menciones NO se enfrían: ahí alguien te habló A TI, y
     hacerte esperar un cuarto de hora es justo el aviso que no debe faltar. */
  const directo = a.tipo === 'espacio_mencion' || a.tipo === 'espacio_directo' || a.tipo === 'espacio_respuesta' || a.tipo === 'espacio_acuerdo';
  if (puedeEmpujar('chat_canal')) try {
    if (!directo && await enfriando(a.para, a.canal_id)) return;
    await pushA(a.para, {
      title: a.titulo,
      body: (a.detalle || '').slice(0, 140) || 'Toca para verlo',
      tag: tagDe.canal(a.canal_id),
      url: `/admin/crm?${params.toString()}`,
      requireInteraction: a.nivel === 'alerta',
      data: { canal_id: a.canal_id, mensaje_id: a.mensaje_id || null, clase: 'chat_canal' },
    });
  } catch { /* idem */ }
}


/** ¿Ya se avisó de este canal a esta persona hace poco?
 *  Se mira la propia campana en vez de llevar una tabla aparte: la
 *  notificación YA quedó escrita ahí, así que es la misma verdad y no hay dos
 *  registros que se puedan desincronizar. */
async function enfriando(para: string, canalId: string): Promise<boolean> {
  const desde = new Date(Date.now() - ENFRIAMIENTO_MIN * 60_000).toISOString();
  const { data } = await supabase.from('crm_notificaciones')
    .select('id').eq('para', para).eq('metadata->>canal_id', canalId)
    .gte('created_at', desde).limit(2);
  // 2 porque la de ESTE aviso ya se insertó unas líneas arriba: si hay otra
  // además de la propia, es que ya se avisó hace poco.
  return (data?.length || 0) > 1;
}
