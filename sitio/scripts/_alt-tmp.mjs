import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const IMG = 'public/images/flujo/alt';
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const PRENDA = 'a sleeveless V-neck midi slip dress in deep terracotta rust satin with a subtle side slit';
const BASE = 'Photorealistic, no logos, no brand names, no readable text anywhere, editorial fashion photography, slight film grain.';

const IDEAS = [
  // 05 · A — cenital de teléfonos: "muchos canales" se ve porque son muchos
  // aparatos distintos, no la misma foto repetida.
  ['05a-telefonos', `Overhead flat-lay, shot straight down: FIVE different phones of different models and cases scattered on a pale marble table, each screen showing the same ${PRENDA} in a different crop — one vertical full-length, one square, one close-up of the fabric. Warm morning daylight, a coffee cup and a linen swatch at the edges, two hands entering the frame from below. No interface, no icons, no text on the screens. ${BASE}`],
  // 05 · B — escaparates: la prenda aparece en varios sitios a la vez, contado
  // con reflejos en lugar de repetir la misma imagen.
  ['05b-escaparates', `Street-level night photograph of a boutique window: ${PRENDA} on a mannequin behind the glass, warmly lit. The glass reflects the shop windows across the street, and the SAME dress appears again in two of those reflections, smaller and deeper. Wet pavement, city bokeh, cinematic blue night against the warm window light. ${BASE}`],
  // 07 · C — la venta saliendo por la puerta, con el hueco en el riel en primer
  // plano: cuenta la venta Y el descuento del inventario en un solo cuadro.
  ['07c-salida', `Interior of a boutique shot from deep inside toward the open doorway, strong backlight: a customer walks out carrying a paper shopping bag, seen as a silhouette against the bright street. In the sharp foreground, a clothing rail holds three of ${PRENDA} and ONE EMPTY WOODEN HANGER where a fourth used to be. Shallow depth of field, cinematic contre-jour. ${BASE}`],
  // 07 · D — cenital del riel: gráfico y limpio, el hueco se lee al instante.
  ['07d-riel', `Shot straight down onto a clothing rail from directly above: a neat row of SEVEN hangers seen from the top, six of them holding ${PRENDA} fanned out below, and ONE hanger completely bare in the middle of the row, lit by a single spotlight. Graphic, symmetrical, deep shadow around, premium and minimal. ${BASE}`],
];

await fs.mkdir(IMG, { recursive: true });
for (const [file, prompt] of IDEAS) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log('skip', file); continue; } catch {}
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'high' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1500, 1000, { fit: 'cover' })
      .webp({ quality: 88 }).toFile(out);
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
