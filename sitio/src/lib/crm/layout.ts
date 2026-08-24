/**
 * El margen del CRM. Uno solo, para todas las pantallas.
 *
 * Estaba escrito a mano en cada módulo y con tres valores distintos: `1280
 * centrado + 24` en casi todos, `1200 sin aire` dentro de Suscripciones y
 * `sin tope + 24` en Reuniones. Medido en una ventana de 1600, el título de
 * Clientes empezaba a 74 px del menú y el de Reuniones a 24: la misma app con
 * dos aires distintos según en qué pestaña estuvieras.
 *
 * Pero el problema de fondo era otro. Con la caja fija en 1280:
 *
 *   menú abierto  → espacio 1380, caja 1280 → sobran  50 px por lado
 *   menú plegado  → espacio 1536, caja 1280 → sobran 128 px por lado
 *
 * Plegar el menú liberaba 156 px y ni una columna más aparecía: todo se iba a
 * margen. La caja tiene que CRECER con el espacio, no quedarse quieta.
 *
 * Por eso el tope es alto (1560) en vez de 1280: en cualquier laptop la caja
 * es fluida —margen 24 fijo, se compacta sola cuando el menú está abierto y se
 * abre cuando lo pliegas— y el tope solo entra en monitores muy anchos, donde
 * una tabla de nueve columnas estirada a 2500 px se vuelve imposible de leer
 * de corrido.
 *
 * Se importa, no se copia. Un módulo con su propio ancho vuelve a partir la
 * regla y eso es lo que había.
 */
export const WRAP = {
  maxWidth: 1560,
  margin: '0 auto',
  /* Más aire a los lados que arriba, a propósito: el margen lateral es el que
     se ve y el que separa del menú, y el vertical solo empuja el contenido
     fuera de la primera pantalla. 32 y 24 en vez de 24 parejo. */
  padding: '24px 32px',
  width: '100%',
  boxSizing: 'border-box',
} as const;

/** El mismo margen para bloques que solo necesitan alinearse con el resto,
 *  sin el aire vertical (una barra de pestañas pegada al contenido). */
export const WRAP_SIN_AIRE = {
  maxWidth: 1560,
  margin: '0 auto',
  padding: '0 32px',
  width: '100%',
  boxSizing: 'border-box',
} as const;
