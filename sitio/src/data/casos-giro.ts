// Casos de éxito por GIRO para las cotizaciones — resultados TÍPICOS del giro
// con SACS, redactados de forma honesta (sin inventar clientes con nombre).
// Se muestran en la cotización pública cuando el partner elige el giro del
// prospecto (meta.giro). Mantener alineado con los giros de src/data/navigation.ts.

export interface CasoGiro {
  id: string;
  label: string; // como se muestra en el selector del editor
  dolor: string; // el problema típico del giro
  solucion: string; // qué resuelve SACS ahí
  stat: string; // métrica destacada
  statLabel: string;
}

export const CASOS_GIRO: CasoGiro[] = [
  {
    id: 'zapateria',
    label: 'Zapatería / Calzado',
    dolor: 'Controlar tallas y modelos a mano provoca faltantes de las tallas que sí se venden y bodegas llenas de las que no.',
    solucion: 'Con variantes por talla/color y sugerencias de resurtido, las zapaterías con SACS saben exactamente qué talla pedir y cuál ya no.',
    stat: '−30%',
    statLabel: 'menos capital atorado en tallas que no rotan',
  },
  {
    id: 'marcas-de-ropa',
    label: 'Ropa / Boutique',
    dolor: 'Mermas invisibles y cambios de temporada sin datos: se compra por corazonada y se remata por urgencia.',
    solucion: 'Kardex por prenda, reportes de rotación y promociones dirigidas: las boutiques con SACS compran con datos y rematan menos.',
    stat: '+20%',
    statLabel: 'de margen recuperado al comprar con datos de rotación',
  },
  {
    id: 'farmacias',
    label: 'Farmacia',
    dolor: 'Caducidades que se pierden en el anaquel y sustancias controladas sin trazabilidad son dinero y riesgo regulatorio.',
    solucion: 'Control de lotes y caducidades con alertas: las farmacias con SACS rotan antes de caducar y auditan sin sustos.',
    stat: '−90%',
    statLabel: 'de producto caducado en anaquel',
  },
  {
    id: 'joyeria',
    label: 'Joyería',
    dolor: 'Piezas únicas de alto valor con inventario en libreta: un error de conteo cuesta lo que un mes de ventas.',
    solucion: 'Inventario pieza por pieza con fotos, certificados y apartados: las joyerías con SACS saben dónde está cada gramo.',
    stat: '100%',
    statLabel: 'de trazabilidad pieza por pieza',
  },
  {
    id: 'ferreterias',
    label: 'Ferretería',
    dolor: 'Miles de SKUs, ventas por kilo/metro/pieza y mostrador lleno: cobrar rápido sin perder el control es la batalla diaria.',
    solucion: 'Búsqueda instantánea, unidades por granel y punto de venta ágil: las ferreterías con SACS despachan más rápido sin descuadres.',
    stat: '2×',
    statLabel: 'más rápido el despacho en mostrador',
  },
  {
    id: 'minisupers',
    label: 'Minisuper / Abarrotes',
    dolor: 'Margen chico y merma alta: cada descuadre de caja o robo hormiga se come la utilidad del día.',
    solucion: 'Cortes de caja ciegos, control por turno y alertas de inventario: los minisupers con SACS cierran el día cuadrado.',
    stat: '−50%',
    statLabel: 'de descuadres de caja al mes',
  },
  {
    id: 'electronica',
    label: 'Electrónica / Celulares',
    dolor: 'Números de serie, garantías y equipos en reparación dispersos entre notas y chats.',
    solucion: 'Series por unidad, apartados y órdenes de servicio: los negocios de electrónica con SACS responden garantías en segundos.',
    stat: '100%',
    statLabel: 'de equipos rastreables por número de serie',
  },
  {
    id: 'papeleria-y-arte',
    label: 'Papelería',
    dolor: 'Temporada de listas escolares: filas largas, precios a mano y faltantes justo en las semanas que hacen el año.',
    solucion: 'Listas escolares digitales, cobro ágil y resurtido con datos: las papelerías con SACS venden la temporada completa sin caos.',
    stat: '+35%',
    statLabel: 'más ventas en temporada escolar sin aumentar personal',
  },
  {
    id: 'vinos-y-licores',
    label: 'Vinos y Licores',
    dolor: 'Producto de alto valor con robo hormiga y compras de pánico antes del fin de semana.',
    solucion: 'Inventario en tiempo real por sucursal y máximos/mínimos: las licorerías con SACS llegan al viernes surtidas y cuadradas.',
    stat: '−40%',
    statLabel: 'de faltantes en fin de semana',
  },
  {
    id: 'mascotas',
    label: 'Mascotas / Veterinaria',
    dolor: 'Alimento por kilo, servicios y productos mezclados en una libreta que no cuadra con la caja.',
    solucion: 'Venta por granel, servicios y recordatorios de recompra: los pet shops con SACS fidelizan al dueño y a la mascota.',
    stat: '+25%',
    statLabel: 'de recompra con recordatorios automáticos',
  },
  {
    id: 'belleza-y-cosmetica',
    label: 'Belleza / Cosmética',
    dolor: 'Cientos de tonos y presentaciones: sin control por variante, el tono estrella se agota y nadie se entera.',
    solucion: 'Variantes por tono/tamaño y alertas de quiebre: los negocios de belleza con SACS nunca pierden la venta del tono de moda.',
    stat: '−60%',
    statLabel: 'de quiebres de stock en los productos estrella',
  },
  {
    id: 'jugueterias',
    label: 'Juguetería',
    dolor: 'El 40% de la venta cae en diciembre: sin datos del año pasado, la compra navideña es una apuesta.',
    solucion: 'Histórico por temporada y sugerencia de compra: las jugueterías con SACS le atinan a la Navidad.',
    stat: '+30%',
    statLabel: 'de acierto en la compra de temporada alta',
  },
  {
    id: 'restaurantes',
    label: 'Restaurante / Alimentos',
    dolor: 'Insumos que se esfuman, recetas sin costear y comandas en papelitos entre cocina y caja.',
    solucion: 'Recetas costeadas, comandas a cocina y control de insumos: los restaurantes con SACS saben cuánto gana cada platillo.',
    stat: '−25%',
    statLabel: 'de merma de insumos en cocina',
  },
  {
    id: 'otro',
    label: 'Otro giro (retail general)',
    dolor: 'Inventario en Excel, ventas en libreta y decisiones a ciegas: el negocio crece pero el control no.',
    solucion: 'Punto de venta, inventarios y reportes en un solo lugar: los negocios con SACS dejan de administrar a ciegas.',
    stat: '8 hrs',
    statLabel: 'a la semana recuperadas en tareas administrativas',
  },
];

export function getCasoGiro(id: string | null | undefined): CasoGiro | null {
  if (!id) return null;
  return CASOS_GIRO.find((c) => c.id === id) || null;
}
