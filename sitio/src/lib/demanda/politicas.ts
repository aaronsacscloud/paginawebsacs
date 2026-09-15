// DEMAND ENGINE · la matriz de autonomía.
//
// Aquí se decide lo único que de verdad importa para soltar un sistema así:
// qué puede hacer solo y qué tiene que esperar a una persona. Es una tabla y
// no código a propósito — el dueño la mueve desde Ajustes sin desplegar— pero
// las filas marcadas `inmutable` no las cambia nadie desde la aplicación.
import { supabase } from '../supabase';
import type { Config, Politica, Riesgo } from './tipos';

const PORDEFECTO: Politica = {
  tipo_accion: '?', nivel: 4, riesgo: 'LOW', requiere_aprobacion: false,
  tope_dia: null, max_intentos: 3, inmutable: false, notas: null,
};

let cache: { at: number; mapa: Map<string, Politica> } | null = null;

export async function politicas(forzar = false): Promise<Map<string, Politica>> {
  if (!forzar && cache && Date.now() - cache.at < 60_000) return cache.mapa;
  const { data } = await supabase.from('de_politicas').select('*');
  const mapa = new Map<string, Politica>();
  for (const p of data || []) mapa.set(p.tipo_accion, p as Politica);
  cache = { at: Date.now(), mapa };
  return mapa;
}

export async function politicaDe(tipo: string): Promise<Politica> {
  const m = await politicas();
  // Un tipo sin política declarada NO hereda permisos: hereda el default más
  // conservador que tenga sentido, y se ve en la pantalla como tipo huérfano.
  return m.get(tipo) || { ...PORDEFECTO, tipo_accion: tipo, nivel: 2, riesgo: 'MEDIUM' };
}

export type Veredicto = {
  estado: 'lista' | 'necesita_aprobacion' | 'para_operador';
  riesgo: Riesgo;
  nivel: number;
  max_intentos: number;
  motivo: string | null;
};

/**
 * En qué estado NACE una acción.
 *
 * Tres reglas, en este orden:
 *  1. CRITICAL nunca corre solo, aunque la autonomía esté al máximo.
 *  2. Si la política pide aprobación, o exige más autonomía de la que hay
 *     configurada, espera al dueño.
 *  3. El trabajo de código no lo ejecuta el worker: lo toma el operador en el
 *     repositorio, y el push del dueño es su aprobación real.
 */
export async function veredicto(tipo: string, cfg: Config): Promise<Veredicto> {
  const p = await politicaDe(tipo);
  const base = { riesgo: p.riesgo, nivel: p.nivel, max_intentos: p.max_intentos };

  if (p.riesgo === 'CRITICAL')
    return { ...base, estado: 'necesita_aprobacion', motivo: 'Acción crítica: nunca se ejecuta sin una persona.' };

  if (p.requiere_aprobacion || p.nivel > cfg.autonomia_global)
    return {
      ...base, estado: 'necesita_aprobacion',
      motivo: p.requiere_aprobacion
        ? 'La política de este tipo pide aprobación.'
        : `Exige autonomía ${p.nivel} y el motor está en ${cfg.autonomia_global}.`,
    };

  if (tipo.startsWith('codigo.'))
    return { ...base, estado: 'para_operador', motivo: 'Trabajo de repositorio: lo toma el operador.' };

  return { ...base, estado: 'lista', motivo: null };
}

/** Cuántas veces corrió hoy este tipo (para el tope diario). */
export async function corridasHoy(tipo: string): Promise<number> {
  const desde = new Date(); desde.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('de_acciones')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', tipo)
    .in('estado', ['corriendo', 'terminada'])
    .gte('created_at', desde.toISOString());
  return count || 0;
}
