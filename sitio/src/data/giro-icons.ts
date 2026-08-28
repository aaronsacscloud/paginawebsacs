// Íconos de los giros de negocio — FUENTE ÚNICA.
//
// Cada llave corresponde al `iconId` de un giro en `businessSectors`
// (src/data/navigation.ts). Los consumen el mega-menú (Nav.astro), el índice
// /giros y las páginas de cada giro, así que un giro nuevo solo necesita su
// ícono AQUÍ para quedar homologado en los tres lugares.
//
// Formato: SVG 24×24, trazo 1.5, sin `fill` — heredan `currentColor` del
// contenedor. NO poner width/height en el markup: los define el CSS de cada
// consumidor (18px en la lista del menú, 24px en el panel, 22px en las tarjetas).

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const giroIcons: Record<string, string> = {
  bridal: svg('<path d="M12 3a2 2 0 100 .01"/><path d="M9.5 5.5h5L16 9l-4 2-4-2 1.5-3.5z"/><path d="M12 11v2"/><path d="M7 21c0-5 2-7 5-8 3 1 5 3 5 8H7z"/>'),
  eventmerch: svg('<path d="M3 21h18"/><path d="M5 21V10l7-6 7 6v11"/><path d="M9 21v-6h6v6"/><path d="M2 10h20"/><path d="M8 6.5h.01M12 4.5h.01M16 6.5h.01"/>'),
  consignment: svg('<path d="M12 3.5a1.5 1.5 0 011.5 1.5c0 .8-.7 1.2-1.5 1.7"/><path d="M12 6.7L4.5 12v1h15v-1L12 6.7z"/><path d="M6 16.5a6 6 0 0011.6 1.6M18 21.5a6 6 0 00-11.6-1.6"/><path d="M6 16.5v-2.3M6 16.5h2.3M18 21.5v2.3M18 21.5h-2.3"/>'),
  multibrand: svg('<path d="M4 4h16"/><path d="M6 4v3M12 4v3M18 4v3"/><path d="M4.2 10.5L6 7l1.8 3.5M7.8 10.5c0 4 -3.6 4.5 -3.6 8v2.5h3.6"/><path d="M10.2 10.5L12 7l1.8 3.5M13.8 10.5c0 4-3.6 4.5-3.6 8v2.5h3.6"/><path d="M16.2 10.5L18 7l1.8 3.5M19.8 10.5c0 4-3.6 4.5-3.6 8v2.5h3.6"/>'),
  clothing: svg('<path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10a2 2 0 002 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>'),
  shoes: svg('<path d="M3 18.5v-2.3c0-.6.4-1 1-1h1.7c.4 0 .8-.2 1-.6L9.4 9c.3-.5.9-.7 1.4-.5l1.6.7c.4.2.6.6.6 1l.1 1.5c0 .5.4.9.9 1l4.6 1.1c1.4.3 2.4 1.5 2.4 2.9v1.8a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M8.3 12.9l2.4 1"/><path d="M7.5 19.5v-2M13 19.5v-2"/>'),
  jewelry: svg('<path d="M6 3h12l4 6-10 13L2 9l4-6z"/><path d="M2 9h20"/><path d="M12 22l4-13M12 22L8 9"/>'),
  novelty: svg('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'),
  wine: svg('<path d="M8 2h8l1 7c0 3-2.24 5-5 5s-5-2-5-5l1-7z"/><path d="M12 14v8"/><path d="M8 22h8"/><path d="M7.5 8h9"/>'),
  grocery: svg('<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/>'),
  events: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'),
  supermarket: svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.96-1.61L23 6H6"/>'),
  electronics: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  bikes: svg('<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l2 11.5M5.5 17.5L9 6h5.5l2 6"/>'),
  franchise: svg('<path d="M3 9l2-6h14l2 6"/><rect x="3" y="9" width="18" height="12" rx="1"/><rect x="9" y="14" width="6" height="7"/>'),
  themepark: svg('<circle cx="12" cy="9" r="7"/><circle cx="12" cy="9" r="1.6"/><path d="M12 2v14M5 9h14M7 4l10 10M17 4L7 14"/><path d="M8.5 21l3.5-5.5 3.5 5.5z"/>'),
  entertainment: svg('<path d="M20.2 6L3 11l-.9-2.4a2 2 0 011.3-2.5l13.5-4a2 2 0 012.5 1.3L20.2 6z"/><path d="M6.2 5.3l3.1 3.9"/><path d="M12.4 3.4l3.1 4"/><path d="M3 11h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"/>'),
  stationery: svg('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
  phonecase: svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M9 5h6"/><circle cx="12" cy="18" r="0.5"/>'),
  // — Agregados 2026-08-18: estos giros ya estaban en el menú pero sin ícono —
  minisuper: svg('<path d="M2 10h20"/><path d="M3.6 10l1.6 8.4a2 2 0 002 1.6h9.6a2 2 0 002-1.6l1.6-8.4"/><path d="M4.6 15h14.8"/><path d="M8.5 3.5L6 10"/><path d="M15.5 3.5L18 10"/><path d="M9.5 14l.7 6"/><path d="M14.5 14l-.7 6"/>'),
  pharmacy: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>'),
  pet: svg('<circle cx="7" cy="8.5" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="8.5" r="2"/><circle cx="19.5" cy="13.5" r="1.8"/><path d="M12 12c2 0 3.4 1.5 4.3 3.2.9 1.7.2 3.8-1.7 4.2a12 12 0 01-5.2 0c-1.9-.4-2.6-2.5-1.7-4.2C8.6 13.5 10 12 12 12z"/>'),
  beauty: svg('<rect x="9" y="12.5" width="6" height="8.5" rx="1"/><path d="M10 12.5V7.2c0-.3.15-.6.4-.8l2.6-2c.4-.3 1 0 1 .5v7.6"/><path d="M8 21h8"/>'),
  hardware: svg('<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>'),
  toys: svg('<circle cx="12" cy="14.5" r="6.3"/><circle cx="6.3" cy="7.6" r="2.7"/><circle cx="17.7" cy="7.6" r="2.7"/><path d="M10 13.5h.01M14 13.5h.01"/><path d="M10.2 17a3 3 0 003.6 0"/>'),
  florist: svg('<circle cx="12" cy="9" r="2.6"/><path d="M12 12.9A3.9 3.9 0 118.1 9 3.9 3.9 0 1112 5.1 3.9 3.9 0 1115.9 9a3.9 3.9 0 11-3.9 3.9z"/><path d="M12 13v8"/><path d="M12 17c-1.6 0-3-1-3.6-2.4M12 19c1.6 0 3-1 3.6-2.4"/>'),
};

/** Ícono del giro; cadena vacía si el `iconId` no está catalogado. */
export function giroIcon(iconId: string): string {
  return giroIcons[iconId] ?? '';
}
