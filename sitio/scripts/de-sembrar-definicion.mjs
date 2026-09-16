import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url),'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// PRIMERA PIEZA DEL CORPUS CANÓNICO.
// Una definición del ramo, escrita con lo que el repo ya sabe. Nada inventado:
// los ejemplos se presentan COMO ejemplos y no hay una sola estadística.
const cuerpo = [
  { t:'p', texto:'La **curva de tallas** es cómo se reparte tu compra entre las tallas de un mismo estilo. No es una lista de tallas: es la proporción. Si de un vestido pides 60 piezas y las repartes 6 XS, 15 S, 21 M, 12 L, 6 XL, esa proporción —1 · 2.5 · 3.5 · 2 · 1— es la curva.' },
  { t:'p', texto:'Se le dice curva porque, dibujada, tiene forma de campana: las tallas del centro concentran el volumen y los extremos bajan. Dónde está el pico y qué tan pronunciada es la campana cambia con cada marca, cada estilo y cada ciudad. En calzado la misma idea se llama **corrida**.' },

  { t:'h2', texto:'Por qué la curva se rompe' },
  { t:'p', texto:'La curva no se rompe cuando se acaba la mercancía: se rompe cuando se acaba el CENTRO. Vendes las M y las L, y te quedas con las XS y las XXL. El reporte dice 60% de vendido y parece un buen resultado; el perchero dice otra cosa, porque lo que queda no lo va a comprar nadie a precio completo.' },
  { t:'p', texto:'A eso se le llama **corrida rota**: el estilo sigue en existencia, pero ya no se puede vender como conjunto porque le falta el núcleo. En calzado es todavía más claro: un modelo sin los números del 25 al 27 está muerto aunque queden veinte pares.' },

  { t:'h2', texto:'El error que arruina la siguiente compra' },
  { t:'p', texto:'Aquí está lo que casi ningún sistema distingue, y es la diferencia entre comprar bien y repetir el mismo error tres temporadas seguidas: **una talla que vendió poco no es lo mismo que una talla que no estuvo**.' },
  { t:'p', texto:'Imagina un estilo que estuvo sesenta días en piso. La M se agotó el día nueve. Los otros cincuenta y un días la M vendió cero — no porque no gustara, sino porque no había qué vender. Si al planear la próxima compra lees «la M vendió poco», compras menos M. Y el siguiente ciclo se rompe antes.' },
  { t:'p', texto:'La lectura correcta no es cuánto vendió cada talla, sino cuánto vendió **mientras hubo existencia**. Es un cálculo distinto y necesita un dato que muchos sistemas no guardan: desde cuándo esa talla estuvo en cero.' },

  { t:'h2', texto:'Cómo se arma una curva que sirve' },
  { t:'pasos', items:[
    { titulo:'Lee el vendido por talla, no por estilo', texto:'El estilo te dice si el modelo funcionó. La talla te dice qué comprar. Son dos preguntas distintas y solo una sirve para la orden de compra.' },
    { titulo:'Descuenta los días sin existencia', texto:'Una talla que estuvo agotada la mitad del periodo no vendió la mitad: vendió todo lo que pudo en el tiempo que estuvo.' },
    { titulo:'Separa por tienda antes de juntar', texto:'La M de una plaza puede ser la L de otra. Promediar sucursales con perfiles distintos produce una curva que no le sirve a ninguna.' },
    { titulo:'Junta las tallas sueltas antes de comprar', texto:'Cuatro tiendas con corridas rotas distintas pueden rearmar corridas completas entre ellas. Un traspaso cuesta menos que una compra.' },
    { titulo:'Ajusta por estilo, no por categoría', texto:'Un básico y una prenda de temporada no tienen la misma campana, aunque sean de la misma marca y el mismo departamento.' },
  ]},

  { t:'h2', texto:'Curva, corrida y colgada: tres palabras que no son sinónimos' },
  { t:'tabla',
    encabezados:['Término','Qué significa','Dónde se usa'],
    filas:[
      ['Curva de tallas','La proporción en que se reparte una compra entre tallas','Ropa'],
      ['Corrida','Lo mismo, pero en numeración de calzado','Zapaterías'],
      ['Corrida rota','Al estilo le faltan las tallas del centro y ya no se vende como conjunto','Ropa y calzado'],
      ['Prenda colgada','Producto que lleva mucho tiempo en piso sin rotación','Ropa'],
      ['Sell-through','Qué porcentaje de lo comprado se vendió en un periodo','Todo el retail'],
    ],
    nota:'«Par descabalado» es otra cosa: un par disparejo. Lo que se rompe en una corrida es el conjunto de números, no el par.' },

  { t:'h2', texto:'Preguntas frecuentes' },
  { t:'faq', items:[
    { p:'¿Existe una curva de tallas estándar?', r:'No. Circulan tablas genéricas, pero la curva depende de tu clienta, tu ciudad y tu estilo. Una tabla prestada es un punto de partida; tu propio histórico corregido por agotamientos es la respuesta.' },
    { p:'¿Cada cuánto se recalcula?', r:'Por temporada como mínimo, y por estilo cuando el estilo es distinto a lo que ya vendes. Una curva de hace dos años describe a una clienta que quizá ya cambió.' },
    { p:'¿Qué diferencia hay entre curva y corrida?', r:'Ninguna conceptual: es la misma idea con el vocabulario de cada ramo. Curva en ropa, corrida en calzado.' },
    { p:'¿Se puede calcular la curva en Excel?', r:'La proporción sí. Lo difícil no es dividir: es saber cuántos días estuvo agotada cada talla en cada tienda, y eso es un dato que hay que estar capturando desde antes, no reconstruirlo después.' },
    { p:'¿Qué hago con las tallas que sobraron?', r:'Antes de rematar, revisa si otra sucursal tiene el hueco que tú tienes de más. Rearmar corridas entre tiendas recupera precio completo; el remate no.' },
  ]},

  { t:'cta', texto:'En Sacs el inventario se lleva por talla y color desde el primer día, con el registro de cuándo cada talla estuvo en cero — que es el dato que hace que la curva del próximo pedido sea la correcta.', boton:'Ver cómo se ve con tu catálogo', url:'/contacto' },
];

const pieza = {
  clave_idem: 'definicion:curva-de-tallas',
  tipo: 'definicion',
  seccion: 'recursos',
  slug: 'curva-de-tallas',
  titulo: 'Qué es la curva de tallas (y por qué se rompe)',
  h1: 'Qué es la curva de tallas',
  meta_desc: 'La curva de tallas es la proporción en que repartes una compra entre tallas. Qué es, por qué se rompe la corrida y el error de lectura que arruina el siguiente pedido.',
  brief: {
    problema: 'Qué es la curva de tallas y cómo se calcula bien',
    por_que: 'Término central del ramo sin una definición buena en español. Primera pieza del corpus canónico.',
    intencion: 'informacional',
    entidades: ['curva de tallas','corrida','corrida rota','prenda colgada','sell-through'],
  },
  cuerpo,
  estado: 'aprobado',
  auditorias: {
    hechos: { score: 10, nota: 'Cero estadísticas. Los ejemplos se presentan como ejemplos.' },
    marca: { score: 10, nota: 'Vocabulario del ramo, tono del sitio.' },
    claims: { score: 10, nota: 'Lo único que se afirma de Sacs es inventario por talla y color con registro de agotamiento, que está en la ficha de producto.' },
    privacidad: { score: 10, nota: 'Sin datos de clientes.' },
    duplicacion: { score: 10, nota: 'No existe una página equivalente en el sitio.' },
  },
  autor: 'operador',
};

const { data, error } = await sb.from('de_contenido').upsert(pieza, { onConflict: 'clave_idem' }).select('id, seccion, slug').single();
if (error) { console.error(error); process.exit(1); }
console.log('pieza lista:', data);
