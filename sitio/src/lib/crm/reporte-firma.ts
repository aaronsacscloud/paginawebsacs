// La firma del cliente en los reportes: qué documento se firma y qué dice.
//
// Vive aparte para que la página que la PINTA y el API que la GUARDA digan
// exactamente lo mismo: lo que se guarda con la firma es la frase que el
// cliente leyó al firmar, no otra.

/** Qué documentos se firman, y la frase que el cliente acepta al firmar. */
export const LEYENDA_FIRMA: Record<string, { titulo: string; frase: string }> = {
  entregas: {
    titulo: 'Conformidad de recepción',
    frase: 'Recibí las entregas de este reporte y las revisé.',
  },
  curso: {
    titulo: 'Enterado del trabajo en curso',
    frase: 'Estoy enterado del trabajo en curso de mi cuenta y de sus fechas comprometidas.',
  },
  // El ejecutivo (dueño, 27-sep-2026): «que está consciente del trabajo que se ha realizado».
  trabajo: {
    titulo: 'Firma de conformidad',
    frase: 'Estoy consciente del trabajo que se ha realizado en mi cuenta durante este periodo.',
  },
};

/** Los que además se revisan punto por punto. El ejecutivo se firma entero. */
export const CON_REVISADO = ['entregas', 'curso'];

/** La llave de un renglón. Estable porque la foto del reporte no cambia. */
export const llaveEntrega = (indice: number) => `e:${indice}`;
export const llaveTrabajo = (t: any, indice: number) => `c:${t?.folio || `n${indice}`}`;
