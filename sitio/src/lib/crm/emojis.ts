/**
 * EL CATÁLOGO DE EMOJI DEL COMPOSER.
 *
 * Antes vivían dentro de `Composer.tsx`: diez categorías de veinte, sin
 * nombres. Buscar «cara» o «dinero» no encontraba nada porque no había con qué
 * buscar —el «buscador» solo aplanaba las mismas listas— y a 18 px, en
 * cuadritos de 30, cuesta distinguir un 😅 de un 😂.
 *
 * Aquí están con su NOMBRE en español, que es lo que hace que la búsqueda
 * sirva. No es la tabla Unicode completa a propósito: son los que se usan al
 * hablarle a un cliente de una tienda de moda, que son los que hay que
 * encontrar rápido. Meter 1 800 emoji costaría bundle y haría el scroll más
 * largo sin que nadie encuentre mejor su 👍.
 */
export type Emoji = { e: string; n: string };
export type CatEmoji = { id: string; icono: string; nombre: string; lista: Emoji[] };

export const CATS_EMOJI: CatEmoji[] = [
  {
    id: 'caras', icono: '😀', nombre: 'Caras y gente',
    lista: [
      { e: '😀', n: 'sonrisa feliz' }, { e: '😃', n: 'sonrisa grande alegre' }, { e: '😄', n: 'risa feliz ojos' },
      { e: '😁', n: 'sonrisa dientes' }, { e: '😆', n: 'carcajada risa' }, { e: '😅', n: 'risa nervioso sudor' },
      { e: '😂', n: 'llorar de risa' }, { e: '🤣', n: 'muerto de risa suelo' }, { e: '🙂', n: 'sonrisa leve' },
      { e: '🙃', n: 'al reves ironia' }, { e: '😉', n: 'guiño complice' }, { e: '😊', n: 'sonrojo amable' },
      { e: '😇', n: 'angel inocente' }, { e: '🥰', n: 'enamorado corazones' }, { e: '😍', n: 'ojos de corazon amor' },
      { e: '🤩', n: 'estrellas asombro wow' }, { e: '😘', n: 'beso' }, { e: '😗', n: 'beso suave' },
      { e: '😋', n: 'delicioso rico lengua' }, { e: '😛', n: 'lengua burla' }, { e: '🤪', n: 'loco chistoso' },
      { e: '🤗', n: 'abrazo bienvenida' }, { e: '🤭', n: 'ups pena tapar boca' }, { e: '🤫', n: 'silencio secreto' },
      { e: '🤔', n: 'pensando duda' }, { e: '🤨', n: 'ceja sospecha' }, { e: '😐', n: 'neutral sin expresion' },
      { e: '😑', n: 'sin gracia' }, { e: '🙄', n: 'ojos en blanco fastidio' }, { e: '😏', n: 'picaro' },
      { e: '😴', n: 'dormido sueño' }, { e: '🥱', n: 'bostezo cansado' }, { e: '😔', n: 'triste decepcion' },
      { e: '😢', n: 'llorar triste' }, { e: '😭', n: 'llanto mucho' }, { e: '😤', n: 'enojo vapor' },
      { e: '😡', n: 'enojado furioso' }, { e: '🥺', n: 'suplica ojitos por favor' }, { e: '😬', n: 'incomodo mueca' },
      { e: '🤯', n: 'cabeza explota impresion' }, { e: '😳', n: 'sorpresa sonrojo' }, { e: '🥵', n: 'calor' },
      { e: '🥶', n: 'frio' }, { e: '😱', n: 'grito susto' }, { e: '😨', n: 'miedo' },
      { e: '😌', n: 'aliviado tranquilo' }, { e: '🤒', n: 'enfermo' }, { e: '🤝', n: 'trato acuerdo manos' },
      { e: '🥳', n: 'fiesta celebracion' }, { e: '😎', n: 'lentes cool' }, { e: '🤓', n: 'nerd' },
      { e: '🫶', n: 'corazon con manos cariño' }, { e: '🙋', n: 'levantar la mano pregunta' },
      { e: '🙇', n: 'reverencia gracias disculpa' }, { e: '💁', n: 'informacion aqui' },
      { e: '🧑‍💻', n: 'trabajando computadora' }, { e: '👩‍💼', n: 'ejecutiva oficina' }, { e: '👨‍💼', n: 'ejecutivo oficina' },
    ],
  },
  {
    id: 'manos', icono: '👍', nombre: 'Manos y gestos',
    lista: [
      { e: '👍', n: 'pulgar arriba ok bien de acuerdo' }, { e: '👎', n: 'pulgar abajo mal' },
      { e: '👌', n: 'perfecto ok' }, { e: '🤌', n: 'gesto italiano' }, { e: '🤏', n: 'poquito' },
      { e: '✌️', n: 'paz victoria' }, { e: '🤞', n: 'dedos cruzados suerte' }, { e: '🤙', n: 'llamame' },
      { e: '👏', n: 'aplauso felicidades bravo' }, { e: '🙌', n: 'manos arriba celebracion' },
      { e: '🙏', n: 'gracias por favor rezar' }, { e: '💪', n: 'fuerza musculo vamos' },
      { e: '👋', n: 'hola adios saludo' }, { e: '🤝', n: 'trato acuerdo cerrado' },
      { e: '👆', n: 'arriba señalar' }, { e: '👇', n: 'abajo señalar' }, { e: '👉', n: 'derecha señalar aqui' },
      { e: '👈', n: 'izquierda señalar' }, { e: '✋', n: 'alto mano' }, { e: '🫰', n: 'dinero dedos' },
      { e: '✍️', n: 'escribir firmar' }, { e: '🫱', n: 'dar la mano' },
    ],
  },
  {
    id: 'corazones', icono: '❤️', nombre: 'Corazones',
    lista: [
      { e: '❤️', n: 'corazon rojo amor' }, { e: '🧡', n: 'corazon naranja' }, { e: '💛', n: 'corazon amarillo' },
      { e: '💚', n: 'corazon verde' }, { e: '💙', n: 'corazon azul' }, { e: '💜', n: 'corazon morado' },
      { e: '🖤', n: 'corazon negro' }, { e: '🤍', n: 'corazon blanco' }, { e: '💕', n: 'dos corazones' },
      { e: '💖', n: 'corazon brillante' }, { e: '💗', n: 'corazon creciendo' }, { e: '💝', n: 'corazon regalo' },
      { e: '💔', n: 'corazon roto' }, { e: '✨', n: 'brillos magia nuevo' }, { e: '💫', n: 'estrella mareo' },
    ],
  },
  {
    id: 'moda', icono: '👗', nombre: 'Moda y tienda',
    lista: [
      { e: '👗', n: 'vestido' }, { e: '👚', n: 'blusa top' }, { e: '👕', n: 'playera camiseta' },
      { e: '👖', n: 'jeans pantalon' }, { e: '🧥', n: 'abrigo chamarra' }, { e: '🧦', n: 'calcetines' },
      { e: '👘', n: 'kimono' }, { e: '👙', n: 'traje de baño bikini' }, { e: '👠', n: 'tacon zapato' },
      { e: '👟', n: 'tenis sneaker' }, { e: '👜', n: 'bolsa' }, { e: '🎒', n: 'mochila' },
      { e: '👒', n: 'sombrero' }, { e: '🧢', n: 'gorra' }, { e: '💍', n: 'anillo joyeria' },
      { e: '👓', n: 'lentes' }, { e: '🕶️', n: 'lentes de sol' }, { e: '🧵', n: 'hilo costura' },
      { e: '🪡', n: 'aguja costura' }, { e: '🛍️', n: 'bolsas de compras' }, { e: '🏪', n: 'tienda sucursal' },
      { e: '🏬', n: 'departamental plaza' }, { e: '🧺', n: 'canasta inventario' }, { e: '📦', n: 'caja paquete envio' },
      { e: '🚚', n: 'camion entrega envio' }, { e: '🏷️', n: 'etiqueta precio' },
    ],
  },
  {
    id: 'negocio', icono: '💰', nombre: 'Negocio y dinero',
    lista: [
      { e: '💰', n: 'dinero bolsa' }, { e: '💵', n: 'billetes efectivo' }, { e: '💳', n: 'tarjeta pago' },
      { e: '🧾', n: 'ticket recibo nota' }, { e: '📈', n: 'subir crecimiento ventas' },
      { e: '📉', n: 'bajar caida' }, { e: '📊', n: 'grafica reporte datos' }, { e: '🎯', n: 'meta objetivo' },
      { e: '🏆', n: 'trofeo ganador' }, { e: '🥇', n: 'primer lugar oro' }, { e: '🚀', n: 'despegue crecer rapido' },
      { e: '🔥', n: 'fuego exito top' }, { e: '💡', n: 'idea foco' }, { e: '⚡', n: 'rapido energia' },
      { e: '🤑', n: 'signos de dinero' }, { e: '🏦', n: 'banco' }, { e: '💼', n: 'maletin negocio' },
      { e: '🤖', n: 'robot automatizacion ia' }, { e: '⏰', n: 'reloj alarma urgente' },
      { e: '📅', n: 'calendario fecha' }, { e: '🗓️', n: 'agenda calendario' }, { e: '📍', n: 'ubicacion sucursal' },
    ],
  },
  {
    id: 'simbolos', icono: '✅', nombre: 'Señales',
    lista: [
      { e: '✅', n: 'listo hecho correcto si' }, { e: '☑️', n: 'palomita casilla' }, { e: '❌', n: 'no error incorrecto' },
      { e: '⚠️', n: 'cuidado advertencia' }, { e: '❗', n: 'importante atencion' }, { e: '❓', n: 'pregunta duda' },
      { e: '💯', n: 'cien perfecto total' }, { e: '🔔', n: 'aviso notificacion' }, { e: '🔕', n: 'silencio sin aviso' },
      { e: '🔴', n: 'rojo punto' }, { e: '🟢', n: 'verde punto ok' }, { e: '🟡', n: 'amarillo punto' },
      { e: '⭐', n: 'estrella favorito' }, { e: '🆕', n: 'nuevo' }, { e: '🆓', n: 'gratis sin costo' },
      { e: '➡️', n: 'flecha derecha siguiente' }, { e: '⬅️', n: 'flecha izquierda' }, { e: '🔄', n: 'repetir actualizar' },
      { e: '📌', n: 'fijar importante' }, { e: '🔗', n: 'liga enlace link' }, { e: '📎', n: 'adjunto clip' },
      { e: '🔒', n: 'seguro candado' }, { e: '🎁', n: 'regalo promocion' }, { e: '🎉', n: 'celebrar felicidades' },
      { e: '🎊', n: 'confeti fiesta' },
    ],
  },
  {
    id: 'comida', icono: '☕', nombre: 'Comida',
    lista: [
      { e: '☕', n: 'cafe' }, { e: '🍵', n: 'te' }, { e: '🥤', n: 'refresco bebida' }, { e: '🍺', n: 'cerveza' },
      { e: '🍷', n: 'vino' }, { e: '🥂', n: 'brindis celebrar' }, { e: '🍕', n: 'pizza' }, { e: '🌮', n: 'taco' },
      { e: '🍔', n: 'hamburguesa' }, { e: '🥗', n: 'ensalada' }, { e: '🍰', n: 'pastel rebanada' },
      { e: '🎂', n: 'pastel cumpleaños' }, { e: '🍪', n: 'galleta' }, { e: '🍎', n: 'manzana' },
      { e: '🍓', n: 'fresa' }, { e: '🥑', n: 'aguacate' },
    ],
  },
  {
    id: 'otros', icono: '🌎', nombre: 'Otros',
    lista: [
      { e: '🌎', n: 'mundo america' }, { e: '☀️', n: 'sol dia' }, { e: '🌙', n: 'luna noche' },
      { e: '⛅', n: 'nublado' }, { e: '🌧️', n: 'lluvia' }, { e: '🏠', n: 'casa' }, { e: '🏢', n: 'oficina edificio' },
      { e: '📱', n: 'celular telefono' }, { e: '💻', n: 'computadora laptop' }, { e: '📷', n: 'camara foto' },
      { e: '🎥', n: 'video camara' }, { e: '🎤', n: 'microfono audio' }, { e: '🎧', n: 'audifonos' },
      { e: '✉️', n: 'correo email' }, { e: '📨', n: 'mensaje enviado' }, { e: '📝', n: 'nota escribir' },
      { e: '📄', n: 'documento hoja' }, { e: '🔍', n: 'buscar lupa' }, { e: '🐶', n: 'perro' },
      { e: '🐱', n: 'gato' }, { e: '🦄', n: 'unicornio' }, { e: '🌸', n: 'flor' }, { e: '🌟', n: 'estrella brillo' },
    ],
  },
];

/** Sin acentos y en minúsculas: se busca «corazon» y también «corazón». */
const plano = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Todos, sin repetir, para buscar. */
export const TODOS_EMOJI: Emoji[] = (() => {
  const vistos = new Set<string>();
  const out: Emoji[] = [];
  for (const c of CATS_EMOJI) for (const x of c.lista) if (!vistos.has(x.e)) { vistos.add(x.e); out.push(x); }
  return out;
})();

/** Busca por nombre. Sin texto devuelve vacío: quien llama decide qué enseñar. */
export function buscarEmoji(q: string): Emoji[] {
  const t = plano(String(q || '').trim());
  if (!t) return [];
  /* Los que EMPIEZAN con lo escrito van primero: quien teclea «cor» busca
     «corazon», no «mejor». */
  const empieza: Emoji[] = [], contiene: Emoji[] = [];
  for (const x of TODOS_EMOJI) {
    const n = plano(x.n);
    if (n.startsWith(t) || n.split(' ').some(p => p.startsWith(t))) empieza.push(x);
    else if (n.includes(t)) contiene.push(x);
  }
  return [...empieza, ...contiene].slice(0, 80);
}
