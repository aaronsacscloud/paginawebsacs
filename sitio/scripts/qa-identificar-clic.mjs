/**
 * QA · reconocer a quien llega desde el botón de WhatsApp de un correo.
 *
 * Se prueba la regla que decide, con los textos REALES del caso que la motivó:
 * el enlace que Matin Vera Vera tenía en el correo del año sin costo y el
 * mensaje que llegó un minuto después desde un número que no teníamos.
 */
import { coincideTexto, textoDelEnlace } from '../src/lib/whatsapp/identificar-por-clic.ts';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const ENLACE = 'https://wa.me/525593027234?text=Hola%20Andrea%2C%20me%20interesa%20la%20reuni%C3%B3n%20con%20Aar%C3%B3n%20por%20el%20a%C3%B1o%20sin%20costo.%20%C2%BFMe%20llamas%3F';
const LLEGO = 'Hola Andrea, me interesa la reunión con Aarón por el año sin costo. ¿Me llamas?';

const t = textoDelEnlace(ENLACE);
paso('Se lee el texto que llevaba el enlace', t === LLEGO, t || 'no se leyó');
paso('El mensaje real coincide', coincideTexto(LLEGO, t));
paso('Aunque le agregue algo al final', coincideTexto(LLEGO + ' Gracias!', t));
paso('Aunque WhatsApp lo recorte', coincideTexto(LLEGO.slice(0, 55), t));
paso('Aunque cambien acentos y signos', coincideTexto('hola andrea me interesa la reunion con aaron por el ano sin costo me llamas', t));
paso('Otro mensaje NO coincide', !coincideTexto('Hola, quiero información de precios', t));
paso('Un saludo suelto tampoco', !coincideTexto('Hola', t));
paso('Un enlace que no es de WhatsApp se ignora', textoDelEnlace('https://sacscloud.com/planes?text=hola') === null);
paso('Un wa.me sin texto no sirve para reconocer', textoDelEnlace('https://wa.me/525593027234') === null);
