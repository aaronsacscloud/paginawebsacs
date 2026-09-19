/* POR QUÉ NO HUBO CIERRE, EN UNA PALABRA.
 *
 * Vive en su propio archivo —y no dentro de `cierre.ts`— porque lo necesitan
 * los dos lados: `cierre.ts` al guardar el fallo, y `marcador.ts` al listar las
 * llamadas para decidir a cuáles ofrecer «volver a leer». Y `marcador.ts` carga
 * `cierre.ts` de forma perezosa (`import('./cierre')`), así que no puede llamar
 * a nada suyo desde una función síncrona.
 *
 * La alternativa era copiar estas cuatro expresiones en los dos sitios, que es
 * exactamente cómo nacen las listas que se desincronizan: ya pasó este mes con
 * los campos de las plantillas —la pantalla ofrecía doce y el motor entendía
 * once— y el síntoma fue mensajes que no salían, sin error a la vista.
 */
export type FalloCierre = 'tiempo' | 'saldo' | 'sin_transcripcion' | 'sin_llave' | 'otro';

export function claseDeFallo(motivo: string): FalloCierre {
  const m = String(motivo || '').toLowerCase();
  if (/timed out|timeout|aborted/.test(m)) return 'tiempo';
  if (/credit balance|sin saldo|quota|insufficient/.test(m)) return 'saldo';
  if (/transcripción no alcanzó/.test(m)) return 'sin_transcripcion';
  if (/sin llave/.test(m)) return 'sin_llave';
  return 'otro';
}
