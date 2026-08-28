// ══ Borradores del inbox ══════════════════════════════════════════════════
// Lo que dejaste a medio escribir se guardaba, pero solo lo sabía el hilo: al
// volver a la lista desaparecía de la vista y se olvidaba. Vive aquí para que
// la lista también pueda decir «tienes algo sin enviar».
const BORRADORES = new Map<string, string>();

export const leerBorrador = (id: string) => BORRADORES.get(id) || '';
export const guardarBorrador = (id: string, texto: string) => {
  if (texto && texto.trim()) BORRADORES.set(id, texto);
  else BORRADORES.delete(id);
};
export const hayBorrador = (id: string) => !!BORRADORES.get(id);
