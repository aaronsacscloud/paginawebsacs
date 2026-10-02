/* Cómo se escriben nuestros grupos de plantillas cuando se enseñan.
   La clave es corta —cabe en el chip y se guarda en `wa_plantillas.grupo`— y el
   rótulo es la frase con la que el dueño la pidió. Un grupo sin entrada aquí
   se enseña con su clave tal cual: nada se esconde por no estar en la lista.
   Vive aparte para que el selector de envío y el editor de plantillas digan lo
   mismo. */
export const GRUPO_PL: Record<string, string> = {
  apertura: 'Apertura de conversación',
  seguimiento: 'Seguimiento de consultoría',
  llamada: 'Llamadas',
  promocion: 'Promociones',
};
