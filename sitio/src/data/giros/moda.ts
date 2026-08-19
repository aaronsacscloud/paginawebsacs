/**
 * Contenido de la Suite para Tiendas de Ropa.
 *
 * Todo el texto, los ejemplos y las imágenes de la página viven aquí. La página
 * (src/pages/giros/marcas-de-ropa.astro) solo compone bloques. Es lo que hace
 * que un giro nuevo sea un archivo de datos y no una copia del código.
 *
 * Regla de contenido: NADA genérico. Cada ejemplo se escribe con prendas,
 * tallas y colores reales — "playera oversize negra M" y no "producto A".
 */
import type { RackPieza } from '../../components/suite/SuiteRack.astro';

export const rackModa: RackPieza[] = [
  { n: 'Vestido midi', img: '/images/rack-vestido.webp', tallas: 5, colores: 3 },
  { n: 'Blusa satinada', img: '/images/rack-blusa.webp', tallas: 6, colores: 4 },
  { n: 'Saco lino', img: '/images/rack-saco.webp', tallas: 4, colores: 2 },
  { n: 'Jean recto', img: '/images/rack-jean.webp', tallas: 6, colores: 3 },
  { n: 'Playera oversize', img: '/images/rack-playera.webp', tallas: 5, colores: 6 },
  { n: 'Falda plisada', img: '/images/rack-falda.webp', tallas: 4, colores: 3 },
];

export const cortinaModa = {
  fotoAntes: '/images/suite-moda-hoy.webp',
  fotoDespues: '/images/suite-moda-resuelto.webp',
  altAntes: 'Vendedora buscando en su libreta si queda una talla',
  altDespues: 'Vendedora atendiendo tranquila con el sistema en pantalla',
  libreta: ['Blusa negra M — ¿quedan?', 'Vestido S … ¿en Satélite?'],
  filas: [
    { que: 'Blusa satinada negra · M', donde: 'Centro', dato: '4' },
    { que: 'Vestido midi verde · S', donde: 'Satélite', dato: '3' },
    { que: 'Vestido cruzado · M', donde: 'Liverpool', dato: '31 vend.' },
  ],
};

export const sucursalesModa = [
  { nombre: 'Polanco', venta: '$521,400', llena: 100, ticket: '$2,050', margen: '58%', delta: '+9%' },
  { nombre: 'Centro', venta: '$412,800', llena: 79, ticket: '$1,340', margen: '54%', delta: '+4%' },
  { nombre: 'Satélite', venta: '$386,200', llena: 74, ticket: '$1,180', margen: '51%', delta: '+1%' },
  {
    nombre: 'León', venta: '$198,600', llena: 38, ticket: '$890', margen: '43%', delta: '−12%',
    alerta: true,
    nota: 'Tres semanas cayendo. El margen bajó 6 puntos: está saliendo demasiada prenda con descuento.',
  },
];

export const reglasModa = [
  { si: 'El descuento pasa de 15%', entonces: 'pide tu autorización', detalle: 'Llega a tu teléfono con nombre, hora y motivo. La vendedora no decide sola cuánto regalar.' },
  { si: 'Se cancela una venta ya cobrada', entonces: 'queda firmada', detalle: 'Quién, cuándo y por qué. Es la fuga más común y la más silenciosa de todas.' },
  { si: 'El corte de caja no cuadra', entonces: 'no cierra', detalle: 'El faltante se registra a nombre de quien cerró, y tú lo ves el mismo día — no a fin de mes.' },
];

export const diasModa = [
  { dia: 'Día 1', titulo: 'Tu catálogo, cargado', detalle: 'Nos das tu archivo —o tu base actual— y lo subimos nosotros con tallas, colores y existencias.' },
  { dia: 'Día 2', titulo: 'Tu operación, configurada', detalle: 'Sucursales, cajas, usuarios, permisos, impuestos y formas de pago quedan como ya trabajas.' },
  { dia: 'Día 3', titulo: 'Capacitación', detalle: 'Dos horas con tu equipo. Cobrar se aprende en veinte minutos: hay rotación y el sistema lo asume.' },
  { dia: 'Día 4', titulo: 'Arranca una tienda', detalle: 'La primera sucursal vende con SACS. El sistema viejo sigue en pie por si acaso.' },
  { dia: 'Día 5', titulo: 'Arrancan las demás', detalle: 'Con la primera resuelta, las otras entran el mismo día. Tu histórico se conserva y se consulta.' },
];

export const cajaModa = {
  lineas: [
    { n: 'Blusa satinada · Negro · M', p: '$899.00' },
    { n: 'Falda plisada · Vino · S', p: '$1,190.00' },
  ],
  total: '$2,089.00',
};
