import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';
const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();
const NOTEXT = 'HARD RULE: every garment in frame (worn or displayed) is PLAIN SOLID COLOR with absolutely no print, no graphic, no lettering, no distressed logo, no illustration — think blank Gildan tees. No paper tags with writing. Violating this ruins the image.';
const STYLE = 'Photorealistic documentary photo, real Mexican people, night venue light, slight film grain, no logos, no readable text anywhere, candid, editorial concert-merch photography. Any tablet screen shows a clean modern point-of-sale app: grid of t-shirt thumbnails (plain colored tees) with blue accent buttons.';
const JEFE = 'a 38-year-old sturdy Mexican man, wide face, voluminous curly medium-length dark hair, sparse short beard, small earring in his left ear, plain black tee, staff lanyard';
const JOBS = [
  ['hero-merch', `Concert merch booth glowing in a dark Mexican arena concourse: back wall COVERED ONLY with plain solid-color t-shirts (black, white, gray, navy — zero prints) hung on a grid, hoodies plain, an orderly line of concert-goers, two cashiers charging on tablets. ${NOTEXT}`],
  ['suite-merch-hoy', `${JEFE}, holding a walkie-talkie and a paper clipboard among stacked cardboard boxes and road cases in a venue back area, stressed, harsh work light. NO tablet, NO phone — radio and paper only. ${NOTEXT}`],
  ['caso-merch-pico', `Peak hour at the merch booth: a cashier handing a folded plain black tee across the counter to a paying customer while charging on a tablet, two more staff mid-transaction beside her, dense moving line, night energy. ${NOTEXT}`],
  ['caso-merch-reabasto', `A staff member in a plain black tee carrying a cardboard box across a night venue concourse toward the merch booth, crowd blurred, urgency without chaos. ${NOTEXT}`],
  ['caso-merch-corte', `After the show, house lights on: the merch manager at the quiet booth reviewing a tablet whose screen shows a clean cash-closing summary (rows of figures layout, blue accents, out of focus), a colleague counting MEXICAN PESO banknotes (colorful bills: blue, red, green tones — NOT green US dollars) into a cash drawer, sealed boxes behind. ${NOTEXT}`],
  ['plano-merch-produccion', `Backstage production table at night, NO people, NO customers, NOT a sales booth: two laptops, walkie-talkies in a charging row, a tablet propped showing a dashboard-like app out of focus, cable runs, black road cases with metal corners, work lamp. ${NOTEXT}`],
  ['plano-merch-linea', `Packing table backstage at night, completely EMPTY of people, no hands: kraft boxes, folded plain solid-color t-shirts, blank labels, tape gun, warm work light. ${NOTEXT}`],
];
for (const [file, prompt] of JOBS) {
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${prompt}\n\n${STYLE}`, size: '1536x1024', quality: 'medium' });
    await sharp(Buffer.from(r.data[0].b64_json, 'base64')).resize(1400, 933, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(IMG, `${file}.webp`));
    console.log('ok', file);
  } catch (e) { console.error('FALLO', file, e?.message || e); }
}
console.log('LISTO');
