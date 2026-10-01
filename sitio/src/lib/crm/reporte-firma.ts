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
  // La minuta de reunión (dueño, 1-oct-2026): pasa al formato de los reportes y
  // el cliente acepta lo acordado, punto por punto y con su firma.
  minuta: {
    titulo: 'Conformidad de la minuta',
    frase: 'Estoy de acuerdo con lo que se revisó y acordó en esta sesión.',
  },
  // El ejecutivo (dueño, 27-sep-2026): «que está consciente del trabajo que se ha realizado».
  trabajo: {
    titulo: 'Firma de conformidad',
    frase: 'Estoy consciente del trabajo que se ha realizado en mi cuenta durante este periodo.',
  },
};

/** La frase que se firma EN ESTE reporte. Un reporte de entregas que trae
 *  trabajo del taller para revisión (dueño, 1-oct-2026) no se firma como
 *  «recibí»: se firma como aceptación, que es lo que se le está pidiendo. La
 *  usan la página que la pinta y el API que la guarda, para que lo firmado sea
 *  exactamente lo que se leyó. */
export function leyendaDe(rep: { tipo?: string; hechos?: any } | null | undefined) {
  if (!rep?.tipo) return null;
  if (rep.tipo === 'entregas' && Number(rep.hechos?.por_aceptar || 0) > 0) {
    return {
      titulo: 'Revisión y aceptación',
      frase: 'Recibí las entregas de este reporte, las revisé y las acepto.',
    };
  }
  return LEYENDA_FIRMA[rep.tipo] || null;
}

/** Los que además se revisan punto por punto. El ejecutivo se firma entero. */
export const CON_REVISADO = ['entregas', 'curso', 'minuta'];

/** La llave de un renglón. Estable porque la foto del reporte no cambia. */
export const llaveEntrega = (indice: number) => `e:${indice}`;
export const llaveTrabajo = (t: any, indice: number) => `c:${t?.folio || `n${indice}`}`;
/** En la minuta, la posición del acuerdo: la minuta firmada ya no se edita. */
export const llaveAcuerdo = (indice: number) => `a:${indice}`;
