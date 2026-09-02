// CONOCIMIENTO DEL AGENTE · CASOS DE ÉXITO (las landings del sitio).
// Por ahora, el único «material» que el agente manda son estas páginas y las
// de giro (decisión del dueño 2026-09-02). Cifras tal como están publicadas.

export type Caso = { id: string; nombre: string; giro: string; url: string; linea: string; datos: string[]; leHablaA: string[] };

export const CASOS: Caso[] = [
  {
    id: 'casa-maca', nombre: 'Casa Maca', giro: 'Boutique de moda consciente (Guadalajara)',
    url: 'https://www.sacscloud.com/casos-de-exito/casa-maca',
    linea: 'Pasó de operar entre Excel y chats a una operación sincronizada entre sus dos boutiques y su tienda en línea, en menos de 30 días.',
    datos: ['2 boutiques físicas + tienda en línea con un solo inventario', 'Apartados y promociones que se llevaban en papel, ahora en el sistema', 'Implementación en menos de 30 días'],
    leHablaA: ['ropa', 'multimarca'],
  },
  {
    id: 'la-bella-pandita', nombre: 'La Bella Pandita', giro: 'Cadena de tiendas de novedades y calzado',
    url: 'https://www.sacscloud.com/casos-de-exito/la-bella-pandita',
    linea: 'Escaló a 42 sucursales en todo México con la operación automatizada; venía de un sistema a la medida sin soporte más Excel.',
    datos: ['42 sucursales', 'Migración completa en menos de 2 semanas', 'Cambios y devoluciones que tomaban 12–15 minutos, resueltos en el mostrador'],
    leHablaA: ['zapateria', 'ropa'],
  },
  {
    id: 'sandmade', nombre: 'Sandmade Swimwear', giro: 'Swimwear premium (Tulum, Playa del Carmen, Holbox, Los Cabos)',
    url: 'https://www.sacscloud.com/casos-de-exito/sandmade',
    linea: '8 boutiques, Shopify, Instagram y WhatsApp con un solo inventario en tiempo real: 98 % de precisión de inventario y 20 segundos por transacción.',
    datos: ['8 boutiques + Shopify + Instagram Shopping + WhatsApp', 'Recepción de mercancía de 8 horas a 45 minutos', 'Compra en línea y recoge en cualquier boutique; devoluciones en menos de 2 minutos'],
    leHablaA: ['activewear', 'ropa'],
  },
  {
    id: 'liveshow', nombre: 'Liveshow Merchandising', giro: 'Mercancía oficial de conciertos y festivales',
    url: 'https://www.sacscloud.com/casos-de-exito/liveshow',
    linea: 'De perder el 20 % de las ventas en dos horas por una caída del sistema a procesar 150,000 transacciones sin errores en una temporada.',
    datos: ['100+ puntos de venta simultáneos en festivales de 75,000 asistentes', 'Cobro sin internet', 'Auditorías manuales de 12 horas eliminadas'],
    leHablaA: ['merch'],
  },
];

export const casoPorId = (id: string | null | undefined) => CASOS.find(c => c.id === id) || null;
export const casosParaGiro = (giroId: string) => CASOS.filter(c => c.leHablaA.includes(giroId));
export const casoTexto = (c: Caso) => `CASO REAL QUE LE HABLA: ${c.nombre} (${c.giro}) — ${c.linea} Datos: ${c.datos.join('; ')}. Página: ${c.url}`;
