/**
 * TACTO — el golpecito que confirma que algo pasó.
 *
 * En el teléfono, media confirmación llega por el dedo antes que por el ojo:
 * mandar un mensaje, armar un deslizamiento, elegir un snippet. Sin eso hay que
 * MIRAR la pantalla para saber si el toque entró, que es justo lo que uno no
 * quiere hacer mientras camina o tiene al cliente enfrente.
 *
 * Estaba en un solo lugar de todo el CRM (`navigator.vibrate?.(30)` suelto en
 * la lista del inbox). Aquí se vuelve vocabulario, con tres intensidades y un
 * significado fijo para cada una, porque un tic que significa cosas distintas
 * en cada pantalla no informa nada:
 *
 *   tic()     algo se seleccionó o se armó — reversible, sin consecuencia.
 *   ticListo()  algo SALIÓ: se envió, se guardó, se ejecutó.
 *   ticError()  algo falló y hay que mirar.
 *
 * Reglas:
 *  · Nunca vibra por navegar ni por abrir un panel. Un teléfono que vibra a
 *    cada toque se vuelve ruido y la gente lo apaga en los ajustes; entonces se
 *    pierde también el aviso que sí importaba.
 *  · Silencioso si el aparato no puede (escritorio, iOS en Safari) o si el
 *    usuario pidió menos movimiento. Nunca revienta ni pide permisos.
 */

const puede = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function' &&
  !(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

const vibrar = (patron: number | number[]) => {
  if (!puede()) return;
  try { navigator.vibrate(patron); } catch { /* da igual: es un adorno útil, no un requisito */ }
};

/** Selección: elegí algo, armé un gesto, cambié de pestaña dentro de una vista. */
export const tic = () => vibrar(10);

/** Hecho: se envió, se guardó, se ejecutó. Un poco más largo para que se note. */
export const ticListo = () => vibrar(24);

/** Falló. Dos golpes: se distingue del "hecho" sin tener que ver la pantalla. */
export const ticError = () => vibrar([14, 60, 14]);
