// Qué es un PAGO ÚNICO y qué no.
//
// El ARR de una cuenta son sus licencias vivas. Todo lo demás que cobramos
// —plugins, personalizaciones, implementaciones, el programa de partners— entra
// una sola vez y NO se repite el año que viene. Meterlo al ARR haría que el
// número prometa dinero que no va a volver; dejarlo fuera sin contarlo en
// ninguna parte fue peor: ARTIK pagó $119,764 en julio de 2026 y su ficha
// reportaba $0 de ingreso.
//
// La regla, medida contra los 7 cobros que hoy no cuelgan de una licencia:
// un cobro es ÚNICO si NINGUNA de las partidas de su cotización es una licencia.
// En cuanto una lo sea, el cobro entero se trata como recurrente — porque eso
// es lo que va a volver a pasar. Los dos casos que obligan a esta regla son
// elenaboutique ("Renovación Plan Controla · Licencia Extra", $17,550) y
// Okulany ("controla", $5,850): sin ella, renovar se vería como crecer.

/** Nombres del catálogo `plans` con categoria='plan', más las formas sueltas
 *  con que se escriben a mano en las cotizaciones. */
const ES_LICENCIA = /licencia|renovaci[oó]n|\bplan\b|controla|fideliza|automatiza|\bvende\b|soporte premium/i;

export type PartidaCot = { nombre?: string; tipo?: string; monto?: number | string };

/** Una partida es licencia por su `tipo` del catálogo o por cómo se llama. */
export function partidaEsLicencia(i: PartidaCot): boolean {
  if (String(i?.tipo || '').toLowerCase() === 'plan') return true;
  return ES_LICENCIA.test(String(i?.nombre || ''));
}

/**
 * ¿El cobro de esta cotización es un pago único?
 * Sin partidas legibles se cae del lado prudente: se trata como licencia, para
 * no inflar el crecimiento con algo que no se pudo verificar.
 */
export function cotizacionEsUnico(items: PartidaCot[] | null | undefined): boolean {
  const arr = Array.isArray(items) ? items : [];
  const conNombre = arr.filter(i => String(i?.nombre || '').trim());
  if (!conNombre.length) return false;
  return !conNombre.some(partidaEsLicencia);
}

/** La categoría con que la partida debe contar como expansión. */
export function categoriaDePartida(nombre: string): string {
  const n = String(nombre || '');
  if (/^pers[.:\s]|personaliza/i.test(n)) return 'personalizacion';
  if (/implementaci|capacitaci|migraci|configuraci/i.test(n)) return 'servicio';
  if (/partner/i.test(n)) return 'partner';
  if (ES_LICENCIA.test(n)) return 'plan';
  return 'plugin';
}

/** El descuento global de la cotización aplicado a una partida de lista. */
export function netoDePartida(monto: number, descuento: number, tipo?: string | null): number {
  const d = Number(descuento || 0);
  if (!d) return Math.round(Number(monto) || 0);
  if (String(tipo || 'pct') === 'pct') return Math.round((Number(monto) || 0) * (1 - d / 100));
  return Math.round(Number(monto) || 0); // descuento de monto fijo: se reparte fuera
}
