// Las 8 imágenes de los correos ABM del giro «marcas» (expositores de
// Intermoda, Guadalajara). Van a /images/mail/ a 600×300, el mismo tamaño que
// las de novias, mayoristas y calzado, porque el armador de HTML
// (lib/crm/abm-correo.ts) las pinta a 600 de ancho.
//   node scripts/generate-mail-marcas.mjs            (las que faltan)
//   node scripts/generate-mail-marcas.mjs 3-foto     (fuerza una)
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(SITIO, 'public/images/mail');
if (!process.env.OPENAI_API_KEY) {
  for (const f of [path.join(process.env.HOME, '.openai-images.key'), '/opt/sacs/sacs_api/.env', path.join(SITIO, '.env')]) {
    try {
      const t = await fs.readFile(f, 'utf8');
      const m = f.endsWith('.key') ? [null, t.trim()] : t.match(/^OPENAI_API_KEY=["']?([^"'\n]+)/m);
      if (m?.[1]) { process.env.OPENAI_API_KEY = m[1]; break; }
    } catch { /* no está */ }
  }
}

// Mismo estilo documental de las de novias, mayoristas y calzado; aquí el
// mundo es la MARCA de moda que expone en feria: el stand con la colección en
// racks, el showroom de la marca, la bodega de producto terminado con prendas
// embolsadas por talla, la boutique que le compra. Cualquier pantalla enseña
// una interfaz de Sacs, nunca vacía.
const ESTILO = `Photorealistic documentary photograph, real Mexican people with natural skin texture, soft bright natural light mixed with warm tungsten, slight film grain, candid gesture caught mid-action, editorial trade photography. A Mexican FASHION BRAND that sells to boutiques and multi-brand stores: a trade-show stand at a large fashion expo (white walls, racks of the new collection sorted by color, a small table for taking orders), the brand's showroom with garments on rails, a finished-goods warehouse with garments folded in clear poly bags on metal shelves sorted by size, a boutique receiving cartons. Any screen shows a clean purple-accented retail software interface called Sacs (a size-by-color grid of a garment, a price list with three tiers, an orders list) rendered soft and NOT legible; no other text, no logos, no readable words anywhere. Hands anatomically correct with five separated fingers. Keep the subject in the vertical center: the image will be cropped to a 2:1 banner.`;

const FOTOS = {
  '1-presentacion': `The owner of a women's clothing brand (Mexican woman, 45, linen blouse) at her trade-show stand, showing a garment on a hanger to a boutique buyer (woman, 38) who holds a tablet glowing with Sacs; racks of the collection sorted by color behind them, the expo hall softly blurred in the background.`,
  '2-feria': `Close-up at a trade-show stand table: a sales rep (man, 34) writing an order on a paper order pad while the buyer (woman, 42) points at a sample dress; a tablet beside the pad glows with a Sacs size-by-color grid; racks of the collection and a curtain behind; busy expo aisle blurred.`,
  '3-foto': `A young employee (woman, 26) in the brand's showroom photographing a linen blouse on a dress form with her phone; the phone screen glows purple with a product card forming in Sacs; the same blouse in three colors hanging on a rail beside her.`,
  '4-reposicion': `Finished-goods warehouse of a clothing brand: a worker (man, 30) picking folded garments in clear poly bags from metal shelves labeled by size and packing them into a carton for a boutique; a tablet propped on the shelf glows with a Sacs orders list; a printed packing slip on the carton, not legible.`,
  '5-precios': `At the showroom desk, a vendor's hands (woman, 33) holding a tablet glowing with a Sacs price list of three tiers, beside a stack of folded garments with hang tags and a buyer's hand touching the fabric; shallow depth of field.`,
  '6-credito': `At the showroom desk, the owner (man, 50) showing a boutique client (woman, 44) an account statement on a tablet glowing purple; she holds colorful Mexican peso banknotes (blue 500 and red 100 tones), her order packed in cartons beside her; both relaxed and friendly.`,
  '7-caso': `In the finished-goods warehouse between shelves of bagged garments, the owner (woman, 47) and a consultant (man, 35) looking together at a laptop on a stack of cartons, the laptop glowing with Sacs bar charts; she points at the screen with a thoughtful expression.`,
  '8-cierre': `A fashion brand's showroom at dusk seen from the street door, the glass door half open, warm light inside over rails of the collection and cartons ready for the next day, the owner (woman, 43) inside tidying the desk; quiet, end-of-day.`,
};

const openai = new OpenAI();
await fs.mkdir(OUT, { recursive: true });
const pedidas = process.argv.slice(2);

async function una(nombre) {
  const salida = path.join(OUT, `marcas-${nombre}.jpg`);
  if (!pedidas.length) { try { await fs.access(salida); console.log(`✓ ya está ${nombre}`); return; } catch { /* falta */ } }
  console.log(`→ ${nombre}…`);
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${FOTOS[nombre]}\n\n${ESTILO}`, size: '1536x1024', quality: 'high' });
    const b64 = r.data?.[0]?.b64_json; if (!b64) throw new Error('sin b64');
    await sharp(Buffer.from(b64, 'base64')).resize(600, 300, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80, mozjpeg: true }).toFile(salida);
    console.log(`  ✓ marcas-${nombre}.jpg · ${((await fs.stat(salida)).size / 1024).toFixed(0)} KB`);
  } catch (e) { console.error(`  ✗ ${nombre}:`, e?.message || e); }
}
const lista = pedidas.length ? pedidas : Object.keys(FOTOS);
for (let i = 0; i < lista.length; i += 4) await Promise.all(lista.slice(i, i + 4).map(una));
console.log('listo');
