/* Las palabras que Whisper nunca acierta — y, más importante, las que NO se
 * deben tocar. La mitad de esta prueba existe para que nadie ensanche la tabla
 * hasta que empiece a corregir palabras que sí se dijeron.
 *
 * Correr: node --experimental-strip-types src/lib/telefonia/terminos.test.ts
 */
import { corregirTerminos } from './terminos.ts';

let fallos = 0;
const caso = (entra: string, sale: string, porque: string) => {
  const r = corregirTerminos(entra);
  if (r !== sale) { fallos++; console.error(`  ✗ ${porque}\n     entra: ${entra}\n     sale:  ${r}\n     debía: ${sale}`); }
};

/* ── Lo que de verdad pasó en la llamada con Maela Sport ──────────────────── */
caso('**Participante Sax:** Fernando', '**Participante Sacs:** Fernando', 'el caso que lo originó');
caso('yo todo esto lo lo coticé también con odo', 'yo todo esto lo lo coticé también con Odoo', 'Odoo sin la segunda o');

/* ── La marca, en sus formas ──────────────────────────────────────────────── */
caso('me llamaron de Sax Cloud', 'me llamaron de Sacscloud', 'el dominio dicho completo');
caso('entré a saxcloud.com', 'entré a Sacscloud.com', 'junto y en minúsculas');
caso('soy Aaron de sacs', 'soy Aaron de Sacs', 'bien escrito, pero en minúsculas');
caso('con Saks y con Sacks', 'con Sacs y con Sacs', 'las dos formas que más salen');

/* ── Las otras de cada llamada ────────────────────────────────────────────── */
caso('cobro con mercado pago', 'cobro con Mercado Pago', 'Mercado Pago en minúsculas');
caso('mi página de shopify', 'mi página de Shopify', 'Shopify en minúsculas');
caso('te mando whats app', 'te mando WhatsApp', 'WhatsApp partido en dos');
caso('llegué por tik tok', 'llegué por TikTok', 'TikTok partido en dos');

/* ── LO QUE NO SE TOCA ────────────────────────────────────────────────────
   Si alguna de estas empieza a fallar, es que la tabla se ensanchó de más. */
caso('vendo saxofones y trompetas', 'vendo saxofones y trompetas', 'saxofón NO es la marca');
caso('el saxo de mi hijo', 'el saxo de mi hijo', '«saxo» es un instrumento: fuera de la tabla a propósito');
caso('todo bien, gracias', 'todo bien, gracias', 'una frase normal sale intacta');
caso('', '', 'vacío');
caso('la talla y el color', 'la talla y el color', 'no toca el resto del texto');

if (fallos) { console.error(`\n✗ términos: ${fallos} caso(s) mal`); process.exit(1); }
console.log('✓ términos de la llamada: 15 casos');
