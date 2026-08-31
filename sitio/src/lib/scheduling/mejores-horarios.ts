// ══ Qué horarios convierten ════════════════════════════════════════════════
//
// Sale de la historia real: a qué horas y qué días la gente SÍ llegó. Vivía
// solo dentro de /api/scheduling/suggest-times, que no tenía ninguna pantalla
// ni la usaba nadie — o sea, medido y guardado en un cajón.
//
// Se usa para ordenar los horarios que se le ofrecen al cliente por WhatsApp:
// antes se mandaban los TRES PRIMEROS LIBRES, que es ordenar por la comodidad
// del calendario y no por la probabilidad de que la reunión ocurra.
import { supabase } from '../supabase';

export type Puntajes = { horas: Record<string, number>; dias: Record<number, number>; base: number };

/** Tasa de asistencia por hora y por día de la semana, de los últimos 90 días. */
export async function puntajesHistoricos(): Promise<Puntajes> {
  const desde = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase.from('bookings')
    .select('fecha, hora_inicio, estado').gte('fecha', desde)
    .in('estado', ['asistio', 'no_asistio']).limit(2000);

  const porHora: Record<string, { n: number; ok: number }> = {};
  const porDia: Record<number, { n: number; ok: number }> = {};
  for (const b of data || []) {
    const h = String(b.hora_inicio || '09').slice(0, 2);
    const d = new Date(String(b.fecha) + 'T12:00:00').getDay();
    porHora[h] = porHora[h] || { n: 0, ok: 0 };
    porDia[d] = porDia[d] || { n: 0, ok: 0 };
    porHora[h].n++; porDia[d].n++;
    if (b.estado === 'asistio') { porHora[h].ok++; porDia[d].ok++; }
  }
  const tasa = (x: { n: number; ok: number }) => x.n >= 3 ? x.ok / x.n : 0.5;   // menos de 3 no es evidencia
  return {
    horas: Object.fromEntries(Object.entries(porHora).map(([k, v]) => [k, tasa(v)])),
    dias: Object.fromEntries(Object.entries(porDia).map(([k, v]) => [Number(k), tasa(v)])),
    base: (data || []).length,
  };
}

/**
 * Puntúa un hueco. Más alto = más probable que la reunión de verdad ocurra.
 * Con poca historia todo empata en 0.5 y el orden se lo queda la cercanía,
 * que es el criterio de antes — degradar a lo anterior es lo correcto cuando
 * no hay de dónde sacar una opinión.
 */
export function puntuar(p: Puntajes, fecha: string, hora: string): number {
  const h = String(hora).slice(0, 2);
  const d = new Date(fecha + 'T12:00:00').getDay();
  return (p.horas[h] ?? 0.5) * 2 + (p.dias[d] ?? 0.5);
}
