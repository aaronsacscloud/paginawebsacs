// Las 8 imágenes de los correos ABM del giro «mayoristas» (Villa Hidalgo).
// Van a /images/mail/ a 600×300, el mismo tamaño que las de novias, porque el
// armador de HTML (lib/crm/abm-correo.ts) las pinta a 600 de ancho.
//   node scripts/generate-mail-mayoristas.mjs            (las que falten)
//   node scripts/generate-mail-mayoristas.mjs 3-foto     (fuerza una)
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

// Mismo estilo documental de las de novias; aquí el mundo es la bodega de
// mayoreo: paquetes de doce en bolsa, corridas colgadas, clientes de fuera con
// bolsas grandes. Cualquier pantalla enseña una interfaz de Sacs, nunca vacía.
const ESTILO = `Photorealistic documentary photograph, real Mexican people with natural skin texture, soft bright natural light mixed with warm tungsten, slight film grain, candid gesture caught mid-action, editorial retail photography. A busy clothing WHOLESALE business in Villa Hidalgo, Jalisco: dense racks of colorful garments, stacks of twelve-piece packs folded in clear plastic bags, cardboard boxes, price tags. Any screen shows a clean purple-accented retail software interface called Sacs (a price list with three tiers, a size-and-color grid, an orders list) rendered soft and NOT legible; no other text, no logos, no readable words anywhere. Hands anatomically correct with five separated fingers. Keep the subject in the vertical center: the image will be cropped to a 2:1 banner.`;

const FOTOS = {
  '1-presentacion': `The owner of a wholesale clothing store (Mexican man, 45, polo shirt) behind a long counter loaded with packs of folded blouses in clear bags, handing a big plastic bag to a customer who came from another city; racks packed with colorful garments behind, a tablet on the counter glowing with Sacs.`,
  '2-listas': `Close-up at the counter: a vendor's hands (woman, 30) holding a tablet glowing with a Sacs price list of three tiers next to a stack of a dozen folded blouses in a clear pack with a price tag; a customer's hand pointing at the pack; shallow depth of field.`,
  '3-foto': `A young employee (man, 24) in the stockroom photographing a colorful blouse on a hanger against a white wall with his phone; the phone screen glows purple with a product card forming in Sacs; packs of the same blouse in every color stacked beside him.`,
  '4-pedidos': `Warehouse worker (woman, 28) preparing an outgoing wholesale order: packs of garments going into a large cardboard box, a printed packing slip on top (not legible), a tablet propped on a shelf glowing with a Sacs orders list; boxes labeled with shipping tape around her.`,
  '5-sueltas': `A shelf of loose garments left over from opened packs, sorted into small piles by size, a worker (man, 35) holding up one blouse and checking a tablet glowing with a Sacs size-and-color grid; full packs still bagged on the shelf above; natural side light.`,
  '6-credito': `At the wholesale counter, a store owner customer (woman, 42) handing colorful Mexican peso banknotes (blue 500 and red 100 tones) to the vendor, who shows her an account statement on a tablet glowing purple; her purchased packs bagged beside her, both relaxed and friendly.`,
  '7-caso': `In a warehouse aisle between tall shelves of bagged garment packs, the owner (man, 50) and a consultant (woman, 32) looking together at a laptop on a stack of boxes, the laptop glowing with Sacs bar charts; he points at the screen with a thoughtful expression.`,
  '8-cierre': `A wholesale clothing shop at dusk from the street, the metal shutter halfway down, warm light inside over racks of colorful garments and packs ready for the next day, the owner (woman, 40) inside tidying the counter; quiet, end-of-day, the door still open.`,
};

const openai = new OpenAI();
await fs.mkdir(OUT, { recursive: true });
const pedidas = process.argv.slice(2);

async function una(nombre) {
  const salida = path.join(OUT, `mayoristas-${nombre}.jpg`);
  if (!pedidas.length) { try { await fs.access(salida); console.log(`✓ ya está ${nombre}`); return; } catch { /* falta */ } }
  console.log(`→ ${nombre}…`);
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${FOTOS[nombre]}\n\n${ESTILO}`, size: '1536x1024', quality: 'high' });
    const b64 = r.data?.[0]?.b64_json; if (!b64) throw new Error('sin b64');
    await sharp(Buffer.from(b64, 'base64')).resize(600, 300, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80, mozjpeg: true }).toFile(salida);
    console.log(`  ✓ mayoristas-${nombre}.jpg · ${((await fs.stat(salida)).size / 1024).toFixed(0)} KB`);
  } catch (e) { console.error(`  ✗ ${nombre}:`, e?.message || e); }
}
const lista = pedidas.length ? pedidas : Object.keys(FOTOS);
for (let i = 0; i < lista.length; i += 4) await Promise.all(lista.slice(i, i + 4).map(una));
console.log('listo');
