// QUÉ puede mandar un push al teléfono. La lista completa, en un solo lugar.
//
// Decisión del dueño (5-sep-2026): «me llegan demasiadas notificaciones». El
// problema no era el volumen de trabajo sino que TODO empujaba — cada mensaje
// entrante, cada lead nuevo, cada mención— y un aviso que llega siempre deja de
// avisar: se apaga el teléfono y se pierden también los que sí importaban.
//
// Ahora son TRES, y son las tres que el dueño nombró:
//
//   1 · inbox_sin_respuesta — un lead escribió y NADIE le ha contestado.
//       No es «llegó un mensaje»: es «hay alguien esperando». Si ya
//       contestamos y el cliente sigue escribiendo, eso es una conversación en
//       curso y no necesita interrumpir a nadie.
//
//   2 · chat_canal — se está hablando en un canal del equipo.
//       Con enfriamiento: veinte mensajes seguidos son UN aviso, no veinte.
//
//   3 · reunion_punto — alguien agregó un punto a una reunión.
//       Es lo único de la sala que le cambia el día a otra persona: mañana hay
//       que llegar con eso preparado.
//
//   4 · reunion_manana — «mañana hay junta, van N puntos». Esta NO la pidió el
//       dueño: ya existía, sale UNA vez por reunión (cuatro a la semana) y
//       matarla por omisión habría sido quitar algo útil sin decidirlo. Queda
//       marcada para que él la quite si sobra.
//
// LO QUE YA NO EMPUJA, y es a propósito: lead nuevo. Sigue sonando en la
// campana y en su canal de Sistema —no se pierde—, pero no vibra el teléfono:
// llegan decenas al día y ninguno se atiende en el segundo en que entra.
//
// Cerrado por omisión: lo que no está aquí, no empuja. Agregar un push nuevo
// tiene que ser una decisión, no un descuido.

export type ClasePush = 'inbox_sin_respuesta' | 'chat_canal' | 'reunion_punto' | 'reunion_manana';

const PERMITIDAS: ReadonlySet<string> = new Set<ClasePush>([
  'inbox_sin_respuesta',
  'chat_canal',
  'reunion_punto',
  // La cuarta NO la pidió el dueño: la agrego y lo digo. Es el recordatorio de
  // la víspera —«mañana hay junta, van N puntos»— que ya existía y sale UNA vez
  // por reunión: cuatro a la semana. Matarlo por omisión habría sido quitar
  // algo útil sin que nadie lo decidiera, que es peor que preguntarlo.
  // Si sobra, se borra este renglón y deja de empujar.
  'reunion_manana',
]);

export const puedeEmpujar = (clase: string): clase is ClasePush => PERMITIDAS.has(clase);

/** Enfriamiento por canal: cuánto callar tras avisar de ese mismo hilo.
 *  Es lo que hace tolerable avisar de la conversación de un canal —sin esto,
 *  una plática de veinte mensajes son veinte vibraciones—. */
export const ENFRIAMIENTO_MIN = 15;

/**
 * El `tag` de la notificación. Manda más de lo que parece: dos avisos con el
 * mismo tag NO se apilan, el segundo reemplaza al primero. Por eso el tag es
 * SIEMPRE la cosa (la conversación, el canal), nunca el mensaje: cinco mensajes
 * del mismo cliente tienen que verse como un aviso que se actualiza.
 *
 * Y es la llave para apagarlo: al abrir esa conversación, la app cierra las
 * notificaciones con ese tag. Sin un tag estable, el aviso se queda en la
 * pantalla de bloqueo después de haberlo leído.
 */
export const tagDe = {
  conversacion: (id: string) => `wa-${id}`,
  canal: (id: string) => `equipo-${id}`,
  sala: (id: string) => `sala-${id}`,
};
