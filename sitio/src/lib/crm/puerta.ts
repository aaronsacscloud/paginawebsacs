/* LA PUERTA · el único sitio que dice a quién NO se le escribe solo.
 *
 * Pedido del dueño (17-sep-2026): «un solo sitio que diga a estos no se les
 * toca: winback, ABM, secuencias y el agente lo consultan. Hoy cada uno decide
 * por su cuenta».
 *
 * POR QUÉ HACÍA FALTA, con nombre y apellido. Ezequiel Cruz Román apretó
 * «Ahorita no» el 15-sep a las 19:01 y el winback le mandó otro correo el
 * 16-sep a las 19:00. No fue un descuido: el agente —que es quien sabe leer un
 * «no»— lo salta porque `churned` está fuera de su alcance de SDR, y la
 * secuencia sigue porque su condición de entrada es `lifecycle: ['churned']` y
 * nadie le dijo que ese churned ya había contestado. Cuatro canales, cuatro
 * criterios, ninguno enterado de los otros.
 *
 * LA DISTINCIÓN QUE HACE ESTE ARCHIVO: cierra lo AUTOMÁTICO, no la relación.
 * Si el vendedor le quiere escribir a mano a alguien de esta lista, puede y
 * debe poder —a veces eso es justo lo que recupera una cuenta—. Lo que no
 * puede pasar es que una máquina insista con quien ya dijo que no.
 */

/** Las etapas en las que ya no se escribe solo, y por qué cada una. */
export const ETAPAS_CERRADAS: Record<string, string> = {
  /* Dijo que no a volver. Es el final del camino de un perdido: la puerta se
     cierra por decisión SUYA, no por cansancio nuestro. */
  perdido_definitivo: 'dijo que no a la propuesta de volver',
  /* Alguien de la casa lo revisó y lo descartó. Volver a meterlo en una
     cadencia es contradecir a quien ya decidió. */
  descalificado: 'lo descartamos nosotros',
  /* Está negociando con una persona. Una cadencia automática encima de una
     negociación viva la estorba. */
  en_conciliacion: 'lo lleva una persona ahora mismo',
};

/** `true` si a esta etapa NO se le manda nada automático. */
export const etapaCerrada = (etapa: any) => Object.hasOwn(ETAPAS_CERRADAS, String(etapa || ''));

/** Por qué está cerrada, para poder decirlo en la bitácora en vez de callar. */
export const motivoCierre = (etapa: any) => ETAPAS_CERRADAS[String(etapa || '')] || null;

/** Para los `.not('lifecycle_stage','in',…)` de Supabase. */
export const ETAPAS_CERRADAS_SQL = `(${Object.keys(ETAPAS_CERRADAS).join(',')})`;

/* A DÓNDE VA UN «NO» SEGÚN DE DÓNDE VIENE.
 *
 * El mismo botón —«Ahorita no»— significa dos cosas distintas y por eso no
 * puede llevar al mismo sitio. De un lead que nunca compró significa «no
 * califica»: `descalificado`. De alguien que YA FUE CLIENTE y le estamos
 * ofreciendo volver, significa «no regreso»: `perdido_definitivo`. Mandar al
 * segundo a `descalificado` borraría de los informes que un día pagó, que es
 * justo lo que hay que saber para medir cuánto se recupera y cuánto no. */
export function etapaTrasRechazo(actual: any): 'descalificado' | 'perdido_definitivo' | null {
  const e = String(actual || '');
  if (['lead', 'lead_calificado', 'rezagado', 'suscriptor'].includes(e)) return 'descalificado';
  if (['churned', 'en_conciliacion'].includes(e)) return 'perdido_definitivo';
  /* Cliente, oportunidad, prueba: aquí un «ahorita no» NO es una baja —es una
     respuesta dentro de una conversación viva que lleva una persona—. Se deja
     como está a propósito: mover a un cliente a `descalificado` porque contestó
     «ahorita no» a un mensaje sería lo peor que podría hacer este código. */
  return null;
}
