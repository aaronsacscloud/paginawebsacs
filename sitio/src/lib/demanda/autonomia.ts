// DEMAND ENGINE · la rampa de autonomía.
//
// La pregunta de esta etapa no es técnica: **¿cómo se gana un sistema el
// derecho a hacer más cosas solo?**
//
// La respuesta de aquí tiene una asimetría deliberada, y es lo único importante
// de este archivo:
//
//   · **BAJAR es automático.** Si el dueño rechaza dos cosas del mismo tipo en
//     catorce días, ese tipo pierde autonomía al instante y sin preguntar.
//   · **SUBIR solo se PROPONE.** El motor reúne la evidencia y la enseña; la
//     concede una persona con un clic.
//
// Un sistema que se otorga permisos a sí mismo no es autónomo, es un sistema
// sin frenos con buena prensa. Y la asimetría no es timidez, es aritmética de
// costos: equivocarse bajando cuesta unas cuantas aprobaciones de más;
// equivocarse subiendo cuesta que el motor publique en un sitio real algo que
// nadie quería, y eso se paga en confianza, que es lo que más tarda en volver.
//
// El criterio de contenido sale del plan (tarea 6.1) y no se inventa aquí:
// veinte publicaciones seguidas con auditoría ≥ 9 y ninguna retirada.
import { supabase } from '../supabase';
import { traerTodo } from './paginar';
import { registrar } from './handlers';
import { politicas } from './politicas';
import { notificar } from '../crm/notificaciones';
import type { ResultadoHandler } from './tipos';

/** Ventana en la que un rechazo del dueño todavía pesa. */
export const DIAS_VENTANA = 14;
/** Cuántos rechazos bastan para degradar. Dos y no uno: el primero puede ser
 *  un cambio de opinión; dos seguidos en dos semanas son un patrón. */
export const RECHAZOS_PARA_BAJAR = 2;

export type Criterio = {
  que: string;
  cumple: boolean;
  /** Lo medido, en palabras. Sin esto, un «no cumple» no dice qué falta. */
  medido: string;
};

export type Propuesta = {
  tipo_accion: string;
  nivel_actual: number;
  nivel_propuesto: number;
  criterios: Criterio[];
  /** Solo si TODOS los criterios se cumplen. */
  se_lo_gano: boolean;
  inmutable: boolean;
};

const hace = (dias: number) => new Date(Date.now() - dias * 864e5).toISOString();

/**
 * ¿Qué tipos de acción se ganaron el siguiente nivel?
 *
 * Se evalúa TIPO POR TIPO y no en bloque. Subir la autonomía global de golpe
 * mezcla lo que el motor ya hace bien —agrupar señales— con lo que apenas
 * empieza —publicar—, y el permiso acaba concedido por el promedio de dos cosas
 * que no se parecen.
 */
export async function evaluar(): Promise<Propuesta[]> {
  const mapa = await politicas(true);
  const desde = hace(DIAS_VENTANA);

  const [acciones, contenidos] = await Promise.all([
    traerTodo<any>('de_acciones', 'id, tipo, estado, created_at, aprobada_at',
      q => q.gte('created_at', hace(90))),
    traerTodo<any>('de_contenido', 'id, slug, estado, auditorias, publicado_at, retirado_at'),
  ]);

  const propuestas: Propuesta[] = [];

  for (const [tipo, p] of mapa) {
    // Los guardrails no se negocian. Una política inmutable es inmutable
    // también para esta rampa: si no, bastaría con portarse bien un rato para
    // que el motor se quitara los frenos que existen precisamente para cuando
    // se porta bien un rato.
    if (p.inmutable || p.riesgo === 'CRITICAL') continue;
    if (p.nivel <= 0) continue;   // ya corre solo en cualquier nivel

    const propias = acciones.filter(a => a.tipo === tipo);
    const rechazadas = propias.filter(a => a.estado === 'rechazada' && a.aprobada_at >= desde);
    const aprobadas = propias.filter(a => a.estado !== 'rechazada' && a.aprobada_at && a.aprobada_at >= desde);
    const hechas = propias.filter(a => a.estado === 'terminada');
    const muertas = propias.filter(a => a.estado === 'muerta');

    const criterios: Criterio[] = [];

    // 1 · El dueño no ha dicho que no. Es el criterio que más pesa: es el único
    //     que mide si el CRITERIO del motor coincide con el de la persona, y no
    //     solo si el código no truena.
    criterios.push({
      que: `Ningún rechazo del dueño en ${DIAS_VENTANA} días`,
      cumple: rechazadas.length === 0,
      medido: rechazadas.length ? `${rechazadas.length} rechazo(s)` : 'ninguno',
    });

    // 2 · Ha habido algo que juzgar. Sin aprobaciones no hay evidencia de que
    //     el dueño esté de acuerdo: hay evidencia de que no ha mirado. Cero
    //     rechazos sobre cero decisiones no es un buen historial, es un historial
    //     vacío, y confundir las dos cosas es cómo un sistema se sube solo.
    criterios.push({
      que: 'El dueño ha aprobado al menos 5 de este tipo',
      cumple: aprobadas.length >= 5,
      medido: `${aprobadas.length} aprobada(s)`,
    });

    // 3 · Funciona. Menos del 10% muertas sobre lo intentado.
    const intentadas = hechas.length + muertas.length;
    const pctMuertas = intentadas ? (muertas.length / intentadas) * 100 : 0;
    criterios.push({
      que: 'Menos del 10% de las corridas se rinden',
      cumple: intentadas >= 10 && pctMuertas < 10,
      medido: intentadas < 10 ? `solo ${intentadas} corrida(s): hacen falta 10` : `${Math.round(pctMuertas)}% muertas de ${intentadas}`,
    });

    // 4 · Lo específico de publicar, tal como lo fijó el plan.
    if (tipo.startsWith('contenido.')) {
      const publicadas = contenidos
        .filter(c => c.publicado_at)
        .sort((a, b) => String(b.publicado_at).localeCompare(String(a.publicado_at)))
        .slice(0, 20);
      const notas = publicadas.map(c => {
        const vals = Object.values(c.auditorias || {}).map((x: any) => Number(x?.score)).filter(Number.isFinite);
        return vals.length ? Math.min(...vals) : 0;   // la PEOR nota, no el promedio
      });
      const todasBuenas = publicadas.length >= 20 && notas.every(n => n >= 9);
      const retiradas = contenidos.filter(c => c.retirado_at).length;

      criterios.push({
        que: '20 publicaciones seguidas con auditoría ≥ 9',
        cumple: todasBuenas,
        medido: publicadas.length < 20
          ? `solo ${publicadas.length} publicada(s)`
          : `la peor nota de las últimas 20 es ${Math.min(...notas)}`,
      });
      criterios.push({
        que: 'Ninguna publicación retirada',
        cumple: retiradas === 0,
        medido: retiradas ? `${retiradas} retirada(s)` : 'ninguna',
      });
    }

    propuestas.push({
      tipo_accion: tipo,
      nivel_actual: p.nivel,
      nivel_propuesto: Math.max(0, p.nivel - 1),   // menos nivel requerido = más autonomía
      criterios,
      se_lo_gano: criterios.every(c => c.cumple),
      inmutable: p.inmutable,
    });
  }

  return propuestas.sort((a, b) => Number(b.se_lo_gano) - Number(a.se_lo_gano) || a.tipo_accion.localeCompare(b.tipo_accion));
}

/**
 * Degradación automática. Esto SÍ se aplica solo.
 *
 * Devuelve los tipos que perdieron autonomía. Que corra dentro del ciclo diario
 * y no a petición es parte del diseño: un freno que hay que acordarse de pisar
 * no es un freno.
 */
export async function degradar(): Promise<{ tipo: string; de: number; a: number; rechazos: number }[]> {
  const mapa = await politicas(true);
  const desde = hace(DIAS_VENTANA);

  const rechazadas = await traerTodo<any>('de_acciones', 'tipo, aprobada_at',
    q => q.eq('estado', 'rechazada').gte('aprobada_at', desde));

  const porTipo = new Map<string, number>();
  for (const a of rechazadas) porTipo.set(a.tipo, (porTipo.get(a.tipo) || 0) + 1);

  const bajados: { tipo: string; de: number; a: number; rechazos: number }[] = [];

  for (const [tipo, n] of porTipo) {
    if (n < RECHAZOS_PARA_BAJAR) continue;
    const p = mapa.get(tipo);
    if (!p || p.inmutable) continue;

    // Sube el nivel REQUERIDO, que es como se pide más permiso. Tope en 4: por
    // encima de eso la acción no correría nunca ni con la autonomía al máximo,
    // y dejar algo permanentemente inalcanzable es romperlo, no frenarlo.
    const nuevo = Math.min(4, p.nivel + 1);
    if (nuevo === p.nivel) continue;

    const { error } = await supabase.from('de_politicas')
      .update({ nivel: nuevo, notas: `Bajó sola: ${n} rechazos en ${DIAS_VENTANA} días (${new Date().toISOString().slice(0, 10)}).` })
      .eq('tipo_accion', tipo).eq('inmutable', false);
    if (error) { console.error(`[autonomia] no se pudo degradar ${tipo}: ${error.message}`); continue; }

    bajados.push({ tipo, de: p.nivel, a: nuevo, rechazos: n });
  }

  if (bajados.length) {
    await notificar({
      clave: `de_autonomia_baja:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'demanda_autonomia', nivel: 'alerta',
      titulo: 'El motor se quitó autonomía solo',
      detalle: bajados.map(b => `${b.tipo}: ${b.rechazos} rechazos → ahora pide nivel ${b.a}`).join(' · '),
      destino: 'de-sistema',
    });
  }
  return bajados;
}

// ── el handler del ciclo ────────────────────────────────────────────────────
registrar('autonomia.revisar', async (): Promise<ResultadoHandler> => {
  const bajados = await degradar();
  const propuestas = await evaluar();
  const ganados = propuestas.filter(p => p.se_lo_gano);

  if (ganados.length) {
    // Se avisa, no se aplica. El clic es del dueño.
    await notificar({
      clave: `de_autonomia_propone:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'demanda_autonomia', nivel: 'info',
      titulo: `El motor se ganó más autonomía en ${ganados.length} ${ganados.length === 1 ? 'tipo' : 'tipos'}`,
      detalle: ganados.map(p => `${p.tipo_accion}: nivel ${p.nivel_actual} → ${p.nivel_propuesto}`).join(' · '),
      destino: 'de-sistema',
    });
  }

  return {
    ok: true,
    resumen: [
      bajados.length ? `${bajados.length} tipo(s) bajaron solos` : null,
      ganados.length ? `${ganados.length} tipo(s) se ganaron subir (esperan tu OK)` : 'ninguno se ganó subir todavía',
    ].filter(Boolean).join(' · '),
    datos: { bajados, propuestas },
  };
});
