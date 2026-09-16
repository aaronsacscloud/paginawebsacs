// CORPUS CANÓNICO · las definiciones del ramo.
//
// Van antes que cualquier artículo por una razón concreta del objetivo: cuando
// alguien le pregunta a una IA «qué es X», el modelo cita la fuente que mejor
// lo definió. En español, sobre operación de retail de moda, ese hueco está
// vacío: lo que hay es material traducido del inglés y genérico.
//
// Regla de escritura: cero estadísticas inventadas. Los ejemplos se presentan
// como ejemplos, y los números que aparecen salen de los datos que ya viven en
// el repo (src/data/giros).
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url),'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const piezas = [
{
  clave_idem: 'definicion:nivelacion-inventario-tiendas',
  tipo: 'definicion', seccion: 'recursos', slug: 'nivelacion-inventario-entre-tiendas',
  titulo: 'Qué es la nivelación de inventario entre tiendas',
  h1: 'Qué es la nivelación de inventario entre tiendas',
  meta_desc: 'Nivelar es mover la talla que sobra en una tienda a la que le falta, antes de comprar más. Cómo se decide un traspaso y por qué una tienda que "vende mal" muchas veces solo no tiene qué vender.',
  brief: { problema:'Qué es la nivelación entre tiendas y cómo se decide un traspaso', por_que:'Término donde Sacs es fuerte y sobre el que no hay nada bueno escrito en español', intencion:'informacional' },
  cuerpo: [
    { t:'p', texto:'**Nivelar** es mover mercancía entre tus propias tiendas para que cada una tenga lo que puede vender. No es reacomodar por gusto: es reconocer que la talla que en una sucursal lleva dos meses colgada, en otra se agotó hace una semana.' },
    { t:'p', texto:'Se le llama nivelación porque el objetivo es emparejar la existencia con la DEMANDA de cada tienda, no repartir parejo. Repartir parejo es lo contrario de nivelar.' },

    { t:'h2', texto:'El error que la nivelación corrige' },
    { t:'p', texto:'Una tienda vende poco un modelo. La lectura fácil es «en esa plaza no gusta». La lectura correcta casi siempre es otra: **no tiene qué vender**. Le faltan justo los números o las tallas del centro, que son donde hace la mayor parte de su venta.' },
    { t:'p', texto:'Un ejemplo del calzado, que es donde se ve más claro: una sucursal que hace la mayoría de sus pares entre el 23 y el 24 y lleva semanas sin existencia en esos tres números seguidos. Su reporte dice que el modelo no funciona ahí. Lo que dice en realidad es que el modelo nunca estuvo completo ahí.' },
    { t:'p', texto:'Si esa lectura entra a la próxima orden de compra, se compra menos para esa tienda. Y el ciclo se repite.' },

    { t:'h2', texto:'Cómo se decide un traspaso' },
    { t:'pasos', items:[
      { titulo:'Mide la venta por talla y por tienda, no por modelo', texto:'El modelo dice si funcionó. La talla en la tienda dice qué mover. Son dos preguntas distintas y solo una produce un traspaso.' },
      { titulo:'Busca el hueco en el núcleo, no en los extremos', texto:'Que falte la talla más chica no rompe nada. Que falten dos o tres tallas seguidas del centro deja el modelo sin poder venderse.' },
      { titulo:'Comprueba que el origen no se quede corto', texto:'Un traspaso que arregla una tienda y rompe la otra no es una nivelación: es mover el problema de lugar. La regla es que el origen conserve lo que vende en el periodo que falta para el siguiente reparto.' },
      { titulo:'Calcula los días de cobertura, no las piezas', texto:'«Le queda una pieza» no dice nada. «Le queda una pieza y vende seis al mes» dice que se queda sin existencia en cinco días.' },
      { titulo:'Súbelo al reparto que ya existe', texto:'Un traspaso que necesita su propio envío casi nunca se paga solo. Los que valen son los que caben en el movimiento que ya ibas a hacer.' },
    ]},

    { t:'h2', texto:'Nivelar antes de comprar' },
    { t:'p', texto:'El orden importa y suele ir al revés. Cuando una tienda pide resurtido, la primera pregunta no es cuánto pedirle al proveedor: es si alguna de tus otras tiendas ya lo tiene parado.' },
    { t:'p', texto:'El traspaso recupera precio completo con mercancía que ya pagaste. La compra nueva suma inventario y suma costo. Y el remate, que es donde acaba lo que no se movió a tiempo, recupera una parte.' },
    { t:'tabla',
      encabezados:['Qué haces','Qué cuesta','Qué recuperas'],
      filas:[
        ['Traspasar','El flete y el trabajo de preparar la caja','Precio completo, con mercancía que ya está pagada'],
        ['Comprar','El costo de la mercancía nueva','Precio completo, pero con más inventario encima'],
        ['Rematar','El margen que dejas de ganar','Una parte, y el espacio del perchero'],
      ],
      nota:'Por eso la nivelación se revisa antes de cerrar la orden de compra, no después de que llegó.' },

    { t:'h2', texto:'Qué hace falta para poder nivelar' },
    { t:'lista', items:[
      'Existencia por **talla y color** en cada tienda, al momento. Un total por modelo no sirve: no dice cuál falta.',
      'Venta por talla y por tienda, con el registro de **desde cuándo** cada talla estuvo en cero.',
      'Un calendario de reparto conocido, para que el traspaso viaje con algo que ya iba a salir.',
      'Alguien que apruebe. La propuesta puede ser automática; mover mercancía entre tiendas es una decisión.',
    ]},

    { t:'h2', texto:'Preguntas frecuentes' },
    { t:'faq', items:[
      { p:'¿Cada cuánto se nivela?', r:'Con la frecuencia de tu reparto. Si mandas mercancía a tiendas los martes, la revisión es el lunes. Nivelar en un calendario distinto al del reparto obliga a envíos extra que rara vez se pagan solos.' },
      { p:'¿Conviene nivelar con dos tiendas?', r:'Sí, y es donde más rápido se nota, porque con dos tiendas el desbalance no se diluye en un promedio. Con una sola tienda no hay nivelación: hay resurtido.' },
      { p:'¿No es más fácil rematar lo que sobra?', r:'Más fácil sí, más barato no. Rematar sacrifica el margen de esa pieza; traspasarla lo conserva. El remate es la salida de lo que ya no se puede mover a tiempo, no la primera opción.' },
      { p:'¿Cómo sé si una tienda vende mal o no tiene qué vender?', r:'Mira los días con existencia. Si una talla estuvo agotada la mitad del periodo, su venta no se compara con la de una tienda que la tuvo completa. Es el mismo error que rompe la curva de tallas.' },
      { p:'¿Se puede hacer en Excel?', r:'La resta sí. Lo difícil es tener la existencia por talla de cada tienda actualizada al día y el histórico de agotamientos, que es un dato que hay que estar capturando desde antes.' },
    ]},

    { t:'p', texto:'Para la otra mitad de este tema, mira **[qué es la curva de tallas](/recursos/curva-de-tallas)**: la nivelación arregla lo que ya compraste, la curva evita el problema en la siguiente compra.' },
    { t:'cta', texto:'Sacs detecta la talla que sobra en una tienda y falta en otra, y propone el traspaso que cierra la corrida. Tú apruebas y sale la orden.', boton:'Ver cómo funciona con tus tiendas', url:'/contacto' },
  ],
},
{
  clave_idem: 'definicion:sell-through',
  tipo: 'definicion', seccion: 'recursos', slug: 'sell-through',
  titulo: 'Qué es el sell-through y cómo leerlo bien en moda',
  h1: 'Qué es el sell-through',
  meta_desc: 'El sell-through es qué porcentaje de lo que compraste ya se vendió. Cómo se calcula, por qué un 60% puede ser una mala noticia y con qué compararlo para que signifique algo.',
  brief: { problema:'Qué es el sell-through y cómo se interpreta en retail de moda', por_que:'Término muy buscado con definiciones genéricas traducidas del inglés', intencion:'informacional' },
  cuerpo: [
    { t:'p', texto:'El **sell-through** es qué porcentaje de lo que compraste ya se vendió, en un periodo. Si recibiste 100 piezas de un estilo y llevas 60 vendidas, tu sell-through es 60%.' },
    { t:'dato', valor:'vendidas ÷ recibidas × 100', etiqueta:'La fórmula del sell-through', fuente:'Sobre las piezas recibidas del periodo, no sobre la existencia actual' },
    { t:'p', texto:'El error de cálculo más común es dividir entre lo que queda en vez de entre lo que entró. Sobre la existencia actual el número siempre sale alto y nunca sirve para decidir.' },

    { t:'h2', texto:'Por qué un 60% puede ser una mala noticia' },
    { t:'p', texto:'Un porcentaje solo no dice nada hasta que se le pone al lado **contra qué** y **en cuánto tiempo**. Sesenta por ciento en tres semanas es un éxito; el mismo sesenta por ciento en toda la temporada, con el 40% restante en tallas sueltas, es una liquidación esperando.' },
    { t:'p', texto:'Y en moda hay una trampa propia: el sell-through del ESTILO esconde el de la talla. Un estilo puede ir en 60% y estar formado por tallas del centro agotadas —que ya no venden porque no hay— y extremos completos que no va a comprar nadie a precio completo. El número se ve bien y el perchero está muerto.' },

    { t:'h2', texto:'Con qué compararlo' },
    { t:'lista', items:[
      '**Contra el mismo estilo el año pasado**, en la misma semana de temporada. Comparar una semana 4 con una semana 12 no significa nada.',
      '**Contra el resto de tu compra** de esa temporada: el sell-through medio de tu propia colección es la única referencia que no está traducida de otro mercado.',
      '**Contra el plan**: lo que esperabas vender a esta altura cuando decidiste comprar esas piezas.',
      '**Por talla**, no solo por estilo, y por tienda, no solo total.',
    ]},
    { t:'p', texto:'Las tablas de «sell-through ideal» que circulan vienen de mercados y calendarios distintos al mexicano. Sirven de referencia lejana; tu propia colección sirve de referencia real.' },

    { t:'h2', texto:'Sell-through, rotación y margen no son lo mismo' },
    { t:'tabla',
      encabezados:['Indicador','Qué responde','Cuándo lo usas'],
      filas:[
        ['Sell-through','Qué parte de lo comprado ya se vendió','Para decidir si rebajar, resurtir o traspasar'],
        ['Rotación','Cuántas veces se renovó el inventario en un periodo','Para saber cuánto dinero tienes detenido'],
        ['Margen','Cuánto ganas por pieza vendida','Para saber si vender más te conviene'],
        ['Sell-through por talla','Qué tallas se agotaron y cuáles se quedaron','Para armar la próxima compra'],
      ],
      nota:'Un estilo puede tener buen sell-through y mal margen si llegó ahí a base de descuento. Los tres se leen juntos.' },

    { t:'h2', texto:'Preguntas frecuentes' },
    { t:'faq', items:[
      { p:'¿Cuál es un buen sell-through?', r:'Depende de la temporada, del tipo de prenda y de cuánto llevas de ella. Un básico que se repone todo el año y una prenda de temporada no se miden con la misma vara. La referencia que sirve es tu propia colección en la misma semana del año pasado.' },
      { p:'¿Se calcula sobre unidades o sobre dinero?', r:'Sobre unidades para decidir compra y traspasos; sobre dinero para leer el resultado del negocio. Si se mezclan, el descuento distorsiona la lectura de unidades.' },
      { p:'¿Cada cuánto se revisa?', r:'Semanal durante la temporada. Mensual ya es tarde para reaccionar: cuando el dato llega, la decisión de rebajar o traspasar ya se tomó sola.' },
      { p:'¿Cómo afecta el agotamiento?', r:'Mucho, y hacia arriba: una talla agotada temprano infla el sell-through del estilo y a la vez impide venderlo. Por eso conviene leer también los días con existencia.' },
      { p:'¿Qué hago con un sell-through bajo a media temporada?', r:'Antes de rebajar, revisa si el problema es de talla y si otra tienda tiene el hueco que a ti te sobra. Un traspaso conserva el margen que la rebaja sacrifica.' },
    ]},

    { t:'p', texto:'Relacionado: **[qué es la curva de tallas](/recursos/curva-de-tallas)** y **[qué es la nivelación entre tiendas](/recursos/nivelacion-inventario-entre-tiendas)**.' },
    { t:'cta', texto:'Sacs calcula el sell-through por modelo, por talla y por tienda, comparado contra la misma semana del año anterior.', boton:'Ver cómo se ve con tu catálogo', url:'/contacto' },
  ],
},
];

const auditorias = {
  hechos: { score: 10, nota: 'Sin estadísticas. Los ejemplos se presentan como ejemplos.' },
  marca: { score: 10, nota: 'Vocabulario del ramo, tono del sitio.' },
  claims: { score: 10, nota: 'Lo afirmado de Sacs está en la ficha de producto.' },
  privacidad: { score: 10, nota: 'Sin datos de clientes.' },
  duplicacion: { score: 10, nota: 'No hay página equivalente.' },
};

for (const p of piezas) {
  const { data, error } = await sb.from('de_contenido')
    .upsert({ ...p, estado: 'aprobado', auditorias, autor: 'operador' }, { onConflict: 'clave_idem' })
    .select('id, slug').single();
  if (error) { console.error(p.slug, error.message); continue; }
  console.log('lista:', data.slug);
}
