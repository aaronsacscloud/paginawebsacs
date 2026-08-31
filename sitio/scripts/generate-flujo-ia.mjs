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
  ['06-clientes', `A hand holding a phone at arm's length; the phone screen shows one clean photograph of ${PRENDA} filling the screen edge to edge, with absolutely no interface, no icons, no buttons and no text on the screen. Behind the hand, a warm boutique interior falls softly out of focus. Editorial, intimate, natural light. ${BASE}`],
  // 07 · se vende y se descuenta en todas las sucursales. Tres tiendas
  // DISTINTAS con la misma prenda: así se ve que es multisucursal sin tener
  // que explicarlo con texto.
  ['07-sucursales', `One wide editorial photograph showing THREE different boutique interiors side by side, separated by architecture, each store with its own character and warm ambient light — and the same ${PRENDA} hanging on a rack in each of the three. Real Mexican retail spaces, cinematic depth, calm and premium. No screens, no monitors, no text. ${BASE}`],
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
