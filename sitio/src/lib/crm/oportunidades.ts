// Registro de oportunidades detectadas: convierte una SEÑAL en algo que alguien
// puede trabajar y cerrar.
//
// Antes las alertas del cron solo caían en el timeline del cliente. Servían para
// enterarse una vez y para nada más: sin estado no se sabe si alguien la atendió,
// y sin saber cuáles se cerraron no hay forma de afinar un umbral — no se
// distingue la señal que vende de la que es ruido.
import { supabase } from '../supabase';

export type EstadoOportunidad = 'nueva' | 'contactado' | 'ganada' | 'descartada';

/** Días que una oportunidad cerrada silencia a su gemela antes de poder volver.
 *  Sin esto, descartar algo que el dato sigue viendo lo reabre en la siguiente
 *  corrida —6 horas después— y la bandeja se vuelve inservible. */
const SILENCIO_DIAS = 30;

export type NuevaOportunidad = {
  company_id: string;
  tipo: string;               // signal_type: modulo_fuera_de_plan, cancelada_pero_usando…
  titulo: string;
  detalle?: string | null;
  accion?: string | null;
  peso?: number | null;
  valor?: number | null;      // ARR anual que está en juego, si se puede estimar
  metadata?: any;
};

/**
 * Crea la oportunidad si no existe una viva, y si ya existe solo la RECONFIRMA
 * (toca visto_at y refresca el valor). Devuelve qué hizo, para poder reportarlo.
 */
export async function registrarOportunidad(o: NuevaOportunidad): Promise<'creada' | 'reconfirmada' | 'silenciada' | 'error'> {
  if (!o.company_id || !o.tipo) return 'error';
  const ahora = new Date().toISOString();
  try {
    // ¿Ya hay una viva? → reconfirmar.
    const { data: viva } = await supabase.from('expansion_signals')
      .select('id').eq('company_id', o.company_id).eq('signal_type', o.tipo)
      .in('estado', ['nueva', 'contactado']).limit(1).maybeSingle();
    if (viva) {
      await supabase.from('expansion_signals').update({
        visto_at: ahora, updated_at: ahora,
        titulo: o.titulo, detalle: o.detalle ?? null, accion: o.accion ?? null,
        opportunity_value: o.valor ?? null, peso: o.peso ?? null,
      }).eq('id', viva.id);
      return 'reconfirmada';
    }
    // ¿Se cerró hace poco? → respetar la decisión de quien la cerró.
    const desde = new Date(Date.now() - SILENCIO_DIAS * 86400000).toISOString();
    const { data: cerrada } = await supabase.from('expansion_signals')
      .select('id').eq('company_id', o.company_id).eq('signal_type', o.tipo)
      .in('estado', ['ganada', 'descartada']).gte('cerrada_at', desde).limit(1).maybeSingle();
    if (cerrada) return 'silenciada';

    const { error } = await supabase.from('expansion_signals').insert({
      company_id: o.company_id, signal_type: o.tipo,
      titulo: o.titulo, detalle: o.detalle ?? null, accion: o.accion ?? null,
      peso: o.peso ?? null, opportunity_value: o.valor ?? null,
      metadata: o.metadata ?? null,
      estado: 'nueva', detected_at: ahora, visto_at: ahora, updated_at: ahora,
    });
    return error ? 'error' : 'creada';
  } catch { return 'error'; }
}
