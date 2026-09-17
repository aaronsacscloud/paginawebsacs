// DEMAND ENGINE · ajustar los pesos del score con lo que de verdad pasó.
//
// El score que decide QUÉ escribe el motor sale de ocho factores con un peso
// cada uno. Esos pesos los puso una persona al principio, con criterio pero sin
// datos. Esto los corrige con la evidencia.
//
// LA REGLA QUE LO HACE SEGURO, y es la única que importa aquí:
//
//   **Sin evidencia suficiente NO se recalibra.** Un ajuste sobre cuatro casos
//   no aprende nada: mueve los pesos al azar y lo llama aprendizaje. Y como el
//   score decide el trabajo del motor, un movimiento al azar aquí se convierte
//   en semanas escribiendo sobre lo que no importa.
//
// Por eso esta acción es de las pocas que pide aprobación aunque el motor esté
// en autonomía alta: cambiar cómo se prioriza es cambiar qué hace el sistema,
// y eso se mira antes de que ocurra.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { traerTodo } from './paginar';
import type { ResultadoHandler } from './tipos';

/** Mínimo de predicciones evaluadas para que un ajuste signifique algo.
 *
 *  Treinta no es un número mágico de estadística: es el punto en que una
 *  correlación deja de poder explicarse por dos o tres casos raros. Debajo de
 *  eso, lo honesto es decir «todavía no sé». */
export const MINIMO_EVIDENCIA = 30;

/** Cuánto se permite mover un peso de una vez, en proporción.
 *
 *  Un tope del 20% por ronda. Sin él, una racha de suerte en un mes puede dar
 *  la vuelta al criterio entero, y el mes siguiente lo devuelve — un sistema
 *  que oscila no está aprendiendo, está persiguiendo ruido. */
const MOVIMIENTO_MAX = 0.2;

export type Ajuste = {
  factor: string;
  peso_actual: number;
  peso_propuesto: number;
  correlacion: number;
  por_que: string;
};

export async function proponerPesos(): Promise<{ suficiente: boolean; n: number; ajustes: Ajuste[]; nota: string }> {
  const evaluadas = await traerTodo<any>('de_predicciones',
    'oportunidad_id, esperado, real, error_relativo, veredicto',
    q => q.not('evaluada_at', 'is', null));

  const { data: vigente } = await supabase.from('de_pesos')
    .select('version, pesos').eq('vigente', true).maybeSingle();
  const pesos = (vigente?.pesos || {}) as Record<string, number>;

  if (evaluadas.length < MINIMO_EVIDENCIA) {
    return {
      suficiente: false, n: evaluadas.length, ajustes: [],
      nota: `${evaluadas.length} predicciones evaluadas de las ${MINIMO_EVIDENCIA} que hacen falta. `
          + `Recalibrar con menos no es aprender: es mover los pesos al azar, y como el score decide `
          + `qué escribe el motor, eso se convierte en semanas trabajando en lo que no importa.`,
    };
  }

  /* Con evidencia suficiente: para cada factor se mira si predijo bien.
     La correlación se calcula entre el valor del factor y el acierto real, y el
     peso se mueve HACIA esa correlación, nunca de golpe. */
  const ids = [...new Set(evaluadas.map(e => e.oportunidad_id).filter(Boolean))];
  const clusters = await traerTodo<any>('de_clusters',
    'id, relevancia_sacs, potencial_conversion, potencial_herramienta, potencial_red, valor_dato, potencial_distribucion_ia, dificultad',
    q => q.in('id', ids.slice(0, 900)));   // tandas: `.in()` con miles revienta la URL

  const porId = new Map(clusters.map(c => [c.id, c]));
  const ajustes: Ajuste[] = [];

  for (const factor of Object.keys(pesos)) {
    const pares = evaluadas
      .map(e => ({ x: Number(porId.get(e.oportunidad_id)?.[factor] ?? NaN), y: e.veredicto === 'acerto' ? 1 : 0 }))
      .filter(p => Number.isFinite(p.x));
    if (pares.length < MINIMO_EVIDENCIA) continue;

    const mx = pares.reduce((s, p) => s + p.x, 0) / pares.length;
    const my = pares.reduce((s, p) => s + p.y, 0) / pares.length;
    const num = pares.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const den = Math.sqrt(pares.reduce((s, p) => s + (p.x - mx) ** 2, 0) * pares.reduce((s, p) => s + (p.y - my) ** 2, 0));
    const r = den > 0 ? num / den : 0;

    const actual = Number(pesos[factor] || 0);
    // El peso se mueve hacia la correlación, con tope.
    const deseado = actual * (1 + r);
    const propuesto = Math.max(
      actual * (1 - MOVIMIENTO_MAX),
      Math.min(actual * (1 + MOVIMIENTO_MAX), deseado));

    if (Math.abs(propuesto - actual) < 0.01) continue;
    ajustes.push({
      factor, peso_actual: actual,
      peso_propuesto: Math.round(propuesto * 100) / 100,
      correlacion: Math.round(r * 100) / 100,
      por_que: r > 0
        ? `predijo bien ${pares.length} veces: sube`
        : `no predijo: baja`,
    });
  }

  return { suficiente: true, n: evaluadas.length, ajustes, nota: `sobre ${evaluadas.length} predicciones evaluadas` };
}

registrar('aprender.recalibrar', async (): Promise<ResultadoHandler> => {
  const r = await proponerPesos();

  if (!r.suficiente) {
    // No es un fallo: es el sistema diciendo que todavía no sabe. Un handler
    // que devolviera `ok: false` aquí llenaría la cola de muertas por un motivo
    // que no tiene nada de malo.
    return { ok: true, resumen: `sin recalibrar · ${r.nota}`, datos: r };
  }
  if (!r.ajustes.length) {
    return { ok: true, resumen: `los pesos ya están bien ${r.nota}`, datos: r };
  }

  /* La versión nueva se guarda SIN activar. `vigente` sigue en la anterior
     hasta que una persona la aprueba: cambiar cómo se prioriza es cambiar qué
     hace el motor, y eso se mira antes, no después. */
  const { data: ult } = await supabase.from('de_pesos')
    .select('version').order('version', { ascending: false }).limit(1).maybeSingle();
  const version = Number(ult?.version || 0) + 1;

  const nuevos = Object.fromEntries(r.ajustes.map(a => [a.factor, a.peso_propuesto]));
  const { error } = await supabase.from('de_pesos').insert({
    version, pesos: nuevos, vigente: false,
    motivo: `Recalibración automática ${r.nota}`,
    evidencia: { n: r.n, ajustes: r.ajustes },
    creada_por: 'motor',
  });
  if (error) return { ok: false, resumen: `no se pudo guardar la versión ${version}: ${error.message}` };

  return {
    ok: true,
    resumen: `pesos v${version} propuestos (${r.ajustes.length} cambios) · esperan tu OK para entrar en vigor`,
    datos: { version, ...r },
  };
});
