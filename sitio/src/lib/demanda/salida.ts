// DEMAND ENGINE · el guardián de lo que sale hacia afuera.
//
// Existe porque encontré que el interruptor «Modo simulación (decide y muestra,
// sin publicar)» de la pantalla **no hacía nada**. Marcaba la fila del ciclo
// como simulada y cambiaba su clave de idempotencia; ninguna función que
// publica, revierte, retira o edita una página consultaba esa bandera. Quien lo
// encendiera para ir con cuidado habría publicado igual.
//
// Un control de seguridad que no controla nada es peor que no tenerlo: el que
// no existe se nota, y el que miente da permiso para confiarse.
//
// Lo mismo pasaba con el apagador. `encolar()` lo respeta, así que no entra
// trabajo nuevo — pero una publicación disparada desde la API no pasa por la
// cola, y ahí el apagador no estaba. El dueño que aprieta «Apagar el motor»
// espera que deje de escribir, no que deje de encolar.
//
// Por eso los dos viven aquí, en UNA pregunta: ¿puedo afectar al mundo de
// afuera ahora mismo? Repartir esa comprobación por cada función que escribe es
// garantizar que la próxima se olvide.
import { leerConfig } from './config';
import type { Config } from './tipos';

export type Freno = { frenado: true; motivo: string; que: string } | null;

/**
 * ¿Se puede escribir hacia afuera?
 *
 * @param que  qué se iba a hacer, en lenguaje llano. Va al mensaje: «habría
 *             publicado recursos/curva-de-tallas» dice algo; «acción bloqueada»
 *             no dice nada, y el punto de la simulación es justamente VER lo
 *             que habría pasado.
 */
export async function frenoDeSalida(que: string, cfg?: Config): Promise<Freno> {
  const c = cfg || await leerConfig();

  if (c.kill_switch)
    return { frenado: true, que, motivo: `El motor está apagado. No se hizo nada: ${que}.` };

  if (c.modo === 'simulacion')
    return { frenado: true, que, motivo: `Simulación: habría ${que}. No se tocó nada.` };

  return null;
}

/** Envoltorio para el caso simple: o corre, o devuelve el motivo. */
export async function siPuedeSalir<T>(
  que: string,
  hacer: () => Promise<T>,
  cfg?: Config,
): Promise<{ hecho: true; datos: T } | { hecho: false; motivo: string }> {
  const f = await frenoDeSalida(que, cfg);
  if (f) return { hecho: false, motivo: f.motivo };
  return { hecho: true, datos: await hacer() };
}
