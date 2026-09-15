// DEMAND ENGINE · el día del negocio.
//
// Vive aparte (y no dentro del ciclo) para romper el círculo entre el ciclo y
// el registro de handlers: los dos necesitan la fecha y se necesitan entre sí.
//
// El día es el de MÉXICO, no el UTC del servidor. Ya costó caro en este repo:
// una clave calculada en UTC cambia de día a las 18:00 CDMX y parte en dos lo
// que para el negocio fue una sola jornada.
export function diaCdmx(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** Lunes de la semana en curso (CDMX), para claves semanales. */
export function semanaCdmx(d: Date = new Date()): string {
  const dia = diaCdmx(d);
  const f = new Date(`${dia}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  return f.toISOString().slice(0, 10);
}

export const mesCdmx = (d: Date = new Date()) => diaCdmx(d).slice(0, 7);
