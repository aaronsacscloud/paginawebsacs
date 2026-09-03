import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const PRENDA = 'a sleeveless V-neck midi slip dress in deep terracotta rust satin with a subtle side slit';
const BASE = 'Photorealistic, no logos, no brand names, no readable text anywhere, editorial retail photography, warm natural light, slight film grain.';
const VACIA = 'The phone screen is completely BLANK — a flat, evenly lit light grey surface with absolutely no interface, no icons, no windows and no text.';

const IDEAS = [
  // 05 nuevo: la tienda del negocio detrás y el teléfono del cliente delante,
  // como la referencia que aprobó el dueño.
  ['b05-tienda', `Interior of a bright modern fashion boutique seen from the customer's point of view: racks of clothes and two dressed mannequins in the middle ground, ${PRENDA} clearly visible hanging on the nearest rack. In the foreground, close to the camera and slightly off-centre to the right, a hand holds a phone upright facing the camera. ${VACIA} Shallow depth of field so the shop falls softly out of focus behind the phone. ${BASE}`],
  // 07: el empaque, con la tablet vacía para la matriz
  ['b07-empaque', `Close-up over a boutique counter, shallow depth of field: two hands carefully folding ${PRENDA} into cream tissue paper, a kraft paper shopping bag waiting beside them. In the background, out of focus, a tablet stands propped on a small stand facing the camera. The tablet screen is completely BLANK — a flat, evenly lit light grey surface with no interface, no icons and no text. Warm light from a window on the left. ${BASE}`],
];
for (const [file, prompt] of IDEAS) {
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'high' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1500, 1000, { fit: 'cover' })
      .webp({ quality: 90 }).toFile(`/tmp/${file}.webp`);
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
