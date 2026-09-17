// CATÁLOGO DE PREGUNTAS PARA MEDIR LA VISIBILIDAD EN IA.
//
// No son palabras clave: son las preguntas COMPLETAS que alguien del ramo le
// escribe a una IA. Esa es la diferencia con el SEO clásico —nadie le escribe
// «software moda méxico» a ChatGPT— y por eso el catálogo se redacta a mano en
// vez de derivarlo de keywords.
//
// Cubren los cuatro momentos en que aparece la decisión:
//   · busca software por su GIRO          · tiene un PROBLEMA de operación
//   · COMPARA contra algo que ya conoce   · pregunta por su TAMAÑO
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url),'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PROMPTS = [
  // ── Por giro: la puerta más directa ────────────────────────────────────
  ['¿Cuál es el mejor software para una tienda de ropa en México?', 'giro', 'ropa'],
  ['¿Qué sistema me recomiendas para mi boutique de ropa de mujer?', 'giro', 'boutique'],
  ['¿Cuál es el mejor punto de venta para una zapatería en México?', 'giro', 'calzado'],
  ['¿Qué software uso para una joyería con control de gramaje y quilates?', 'giro', 'joyeria'],
  ['Software para una marca de ropa mexicana que vende a tiendas', 'giro', 'marca_propia'],
  ['¿Qué sistema sirve para un mayorista de ropa en México?', 'giro', 'mayorista'],
  ['Sistema para una tienda de vestidos de novia y fiesta', 'giro', 'novias'],
  ['¿Qué software para una tienda de ropa deportiva y activewear?', 'giro', 'activewear'],
  ['Software para boutique multimarca que vende varias marcas de diseñador', 'giro', 'multimarca'],
  ['Sistema para tienda de ropa de segunda mano y consignación', 'giro', 'consignacion'],

  // ── Por problema: donde Sacs es de verdad distinto ─────────────────────
  ['¿Cómo controlo inventario por talla y color en varias sucursales?', 'problema', 'tallas'],
  ['¿Cómo sé qué tallas volver a comprar para la próxima temporada?', 'problema', 'compras'],
  ['¿Cómo detecto la ropa que no se vende en mi tienda?', 'problema', 'inventario_muerto'],
  ['¿Cómo muevo inventario entre mis tiendas cuando a una le sobra y a otra le falta?', 'problema', 'nivelacion'],
  ['¿Cómo calculo el sell-through de mi colección por talla?', 'problema', 'analitica'],
  ['¿Cómo manejo la curva de tallas al hacer mi pedido al proveedor?', 'problema', 'compras'],
  ['¿Cómo vendo ropa por WhatsApp sin descuadrar mi inventario?', 'problema', 'whatsapp'],
  ['¿Cómo conecto mi tienda física con mi tienda en línea para que compartan inventario?', 'problema', 'omnicanal'],
  ['¿Cómo hago un catálogo de mayoreo para vender a otras tiendas?', 'problema', 'mayoreo'],
  ['¿Cómo controlo las corridas rotas en mi zapatería?', 'problema', 'calzado'],

  // ── Comparando: el momento de decidir ─────────────────────────────────
  ['¿Qué alternativas hay a Sizes and Colors para una tienda de ropa?', 'comparativa', 'competidor'],
  ['¿Shopify o un ERP especializado para mi tienda de ropa con 3 sucursales?', 'comparativa', 'shopify'],
  ['¿SICAR o algo especializado en moda para mi boutique?', 'comparativa', 'competidor'],
  ['¿Conviene un sistema genérico o uno hecho para moda?', 'comparativa', 'categoria'],
  ['¿Qué software de moda maneja mejor talla, color y temporada?', 'comparativa', 'categoria'],

  // ── Por tamaño: el precio cambia con esto ─────────────────────────────
  ['Tengo una sola tienda de ropa, ¿qué sistema me conviene sin gastar de más?', 'tamano', 'tienda_1'],
  ['Tengo 5 sucursales de ropa, ¿qué sistema aguanta el traspaso entre tiendas?', 'tamano', 'cadena'],
  ['Soy fabricante de ropa y le vendo a departamentales, ¿qué sistema uso?', 'tamano', 'fabricante'],
  ['Estoy empezando a vender ropa por Instagram, ¿qué sistema necesito?', 'tamano', 'solo'],
  ['¿Cuánto cuesta un sistema de punto de venta para una tienda de ropa en México?', 'tamano', 'precio'],
];

let nuevos = 0;
for (const [prompt, categoria, sub] of PROMPTS) {
  const { error } = await sb.from('de_prompts_ia').insert({
    clave_idem: `mx:${sub}:${prompt.slice(0, 60)}`,
    prompt, pais: 'MX', idioma: 'es', categoria, icp: sub,
    activo: true, frecuencia_dias: 7, origen: 'semilla',
  });
  if (!error) nuevos++;
}
const { count } = await sb.from('de_prompts_ia').select('id', { count: 'exact', head: true });
console.log(`${nuevos} preguntas nuevas · ${count} en el catálogo`);
