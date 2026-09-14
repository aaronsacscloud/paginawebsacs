/* A dónde va cada cosa que salió de una junta.
 *
 * De una minuta salen dos clases de trabajo y llevaban años revueltas en una
 * sola lista: lo que hay que VENDER (una idea, algo que se cotiza, un plugin
 * que quiere activar) y lo que hay que CONSTRUIR (una falla, una
 * personalización que ya se prometió). Son equipos distintos, tableros
 * distintos y preguntas distintas: «¿en cuánto se la dejo?» contra «¿para
 * cuándo la tengo?».
 *
 * La regla se decide AQUÍ y no en el modelo de IA a propósito: el destino es
 * una decisión de negocio que tiene que poder auditarse y ser la misma en la
 * minuta, en la ficha del cliente y en el taller. El modelo solo dice de qué
 * se habló; a dónde va lo dice esto.
 *
 * El destino es una PROPUESTA, nunca un candado: en la minuta se ve un
 * segmento Taller|Consultoría y cambiarlo es un clic. Proponer en vez de
 * preguntar es la diferencia entre llenar una minuta y no llenarla —son cinco
 * renglones por junta y preguntar cinco veces es lo que hace que nadie la
 * documente—.
 */

export type Destino = 'taller' | 'consultoria';

export type Reparto = { destino: Destino; razon: string };

/** A dónde cae un renglón de la minuta, y por qué. La razón se enseña en
 *  pantalla: un default que no explica por qué se ve como un capricho y se
 *  corrige a ciegas. */
export function repartoDe(m: { tipo?: string | null; categoria?: string | null; valor?: number | null }): Reparto {
  const categoria = String(m?.categoria || '');
  const valor = Number(m?.valor || 0);

  // Una falla no se vende: se arregla. Aunque traiga monto —lo que se cobra es
  // el tiempo de arreglarla, y eso se cotiza después de saber qué rompió—.
  if (m?.tipo === 'falla') return { destino: 'taller', razon: 'es una falla' };

  // Si se habló de dinero, primero se cotiza. Mandarlo a construir antes de
  // que el cliente diga que sí es trabajo regalado.
  if (valor > 0) return { destino: 'consultoria', razon: 'ya tiene monto: primero se cotiza' };

  // Un plugin o un módulo existen: se activan y se cobran, no se construyen.
  if (categoria === 'plugin' || categoria === 'modulo') return { destino: 'consultoria', razon: 'ya existe: se activa y se cobra' };

  // La capacitación la da el consultor, no desarrollo.
  if (categoria === 'capacitacion') return { destino: 'consultoria', razon: 'la da el consultor' };

  // Personalización y ajuste sin precio son lo prometido: alguien de Sacs lo
  // tiene que construir.
  if (categoria === 'personalizacion' || categoria === 'ajuste') return { destino: 'taller', razon: 'hay que construirlo' };

  return { destino: 'consultoria', razon: 'sin precio todavía' };
}

/** Lo que el taller necesita saber el día que recibe la orden. Pedirlo DESPUÉS
 *  —entrando al módulo, buscando el folio— es como se llega a órdenes sin
 *  fecha y sin criterio, que son las que rebotan. */
export const CAMPOS_TALLER = [
  { k: 'fecha_prometida', label: 'Fecha prometida', hint: 'Sin fecha el taller no la puede arrancar.' },
  { k: 'asignado_id',     label: 'Responsable',     hint: 'Quién la va a trabajar.' },
  { k: 'prioridad',       label: '¿Bloquea la operación?', hint: 'Alta es que hoy no puede vender.' },
  { k: 'criterios',       label: 'Cómo se sabe que quedó', hint: 'La prueba concreta con la que se da por buena.' },
] as const;
