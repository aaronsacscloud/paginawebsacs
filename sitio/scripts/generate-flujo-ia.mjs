// El flujo insignia: de la foto que TÚ tomas, a tus variantes, a la modelo,
// al reel. Es la misma prenda en los cuatro pasos — la continuidad ES el
// argumento, así que el vestido se describe idéntico en los cuatro prompts.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images/flujo');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const PRENDA = 'a sleeveless V-neck midi slip dress in deep terracotta rust satin with a subtle side slit';
const BASE = 'Photorealistic, no logos, no brand names, no readable text anywhere, dark neutral background #0B0B12 tones, single warm key light, editorial fashion photography, slight film grain.';

const PASOS = [
  ['01-tu-foto', `${PRENDA} hanging on a simple wooden hanger against a plain wall inside a small Mexican boutique — an ordinary phone snapshot taken by the shop owner: slightly uneven framing, ambient store light, a rack edge visible. Honest and unglamorous, NOT a studio shot. ${BASE}`],
  ['02-variantes', `A clean horizontal row of FIVE identical ${PRENDA}, each in a different solid color — rust, sage green, black, cream, lilac — all photographed identically on invisible mannequins, evenly spaced on a seamless dark backdrop. Catalog grid feeling, perfectly consistent lighting across all five. ${BASE}`],
  ['03-modelo', `A striking Mexican female model wearing ${PRENDA}, full-length editorial pose, confident stance, dramatic single key light carving her silhouette from a deep dark background. High fashion campaign quality. ${BASE}`],
  ['04-reel', `Vertical 9:16 fashion campaign frame: a professionally dressed Mexican woman wearing ${PRENDA}, standing and walking forward toward the camera in a well-lit studio, full-length, modest and elegant posture, arms relaxed. Composed like a frame from a short brand video. ${BASE}`],
  // 05 · publicar en todos lados. SIN logos ni interfaz: falsificar la marca de
  // TikTok o Instagram en el home sería inventar un aval que no tenemos. La
  // idea se cuenta con los formatos —cuadrado, vertical, historia—, que es lo
  // que de verdad cambia al publicar en cada canal.
  ['05-canales', `A printed campaign contact sheet: NINE photographic prints of ${PRENDA} on an invisible mannequin, each print a different size and shape — square, tall, wide — arranged edge to edge in a neat grid on a dark surface, like proofs laid out on a studio table before publishing. The garment alone in every print, identical lighting. No people, no phones, no screens, no icons. ${BASE}`],
  // 06 · le llega directo al cliente. En la pantalla va la FOTO, nunca la
  // interfaz de WhatsApp ni de ninguna app: falsificar la pantalla de otra
  // marca sería inventar un aval que no tenemos.
  ['06-clientes', `A young Mexican woman sitting at a sunlit café table, clearly a CUSTOMER and not a shop worker — casual clothes, coffee cup beside her — smiling as she holds her phone up in both hands, the screen angled toward the camera. On the screen, one clean photograph of ${PRENDA} fills the upper two thirds against a very light warm background, and the lower third of the screen is left as an EMPTY flat light surface with no icons and no text. Warm natural daylight, shallow depth of field, editorial lifestyle photography. ${BASE}`],
  // 07 · se vende y se descuenta en todas las sucursales. Tres tiendas
  // DISTINTAS con la misma prenda: así se ve que es multisucursal sin tener
  // que explicarlo con texto.
  ['07-sucursales', `One wide editorial photograph of THREE adjacent boutique bays under matching arches, each bay a different store with its own warm light. In the LEFT and CENTRE bays, the same ${PRENDA} hangs on a slim black rack. In the RIGHT bay the identical rack holds only a bare wooden hanger — empty, nothing on it — and a wrapped paper shopping bag rests on the floor beneath: that piece has just been sold. Identical framing and lighting across the three bays so the difference reads instantly. Real Mexican retail spaces, cinematic. No screens, no text. ${BASE}`],
];

await fs.mkdir(IMG, { recursive: true });
for (const [file, prompt] of PASOS) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log('skip', file); continue; } catch {}
  try {
    const vertical = file.startsWith('04');
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size: vertical ? '1024x1536' : '1536x1024', quality: 'high' });
    const im = sharp(Buffer.from(r.data[0].b64_json, 'base64'));
    await (vertical ? im.resize(1000, 1500, { fit: 'cover' }) : im.resize(1500, 1000, { fit: 'cover' }))
      .webp({ quality: 88 }).toFile(out);
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
