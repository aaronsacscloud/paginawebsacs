// Fotos del giro Merch de Eventos — estándar de la casa + luz de venue nocturno
// donde la escena lo pide. Pantallas SIEMPRE con app POS creíble.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
process.env.OPENAI_API_KEY = (await fs.readFile(path.join(process.env.HOME, '.openai-images.key'), 'utf8')).trim();
const openai = new OpenAI();

const STYLE = 'Photorealistic documentary photo, real Mexican people with natural skin texture, ages 20-50, slight film grain, no logos, no brand names, no readable text anywhere (EVERY t-shirt, hoodie and cap in frame is either PLAIN solid color with no print, or carries ONLY simple abstract geometric shapes — circles, gradients, triangles. ABSOLUTELY NO letters, words, numbers, metal-band-style lettering, faces, characters, album-cover art or anything resembling real band merch. Crew staff wear PLAIN black tees with no prints), candid, editorial concert-merch photography. Any tablet or phone screen shows a clean modern retail point-of-sale app with product tiles and blue accents, never blank.';
const TABLET = 'tablet screen visible showing the point-of-sale app';
const MODULO = 'Concert merch booth inside a Mexican arena: back wall of folded t-shirts pinned by size, hoodies hanging, warm booth lighting against dark venue';

const SCENES = [
  ['verticales/merch-eventos', `Concert merch booth inside a Mexican arena at night: back wall of PLAIN solid-color folded t-shirts (black, white, gray — no prints at all), hoodies hanging, two staff in plain black tees selling to a short line, cashier charging on a tablet (${TABLET}), cool neutral booth light.`, 800, 534],
  ['hero-merch', `${MODULO}. Night scene: the lit booth glowing in the dark concourse, an orderly line of concert-goers, two cashiers charging on tablets (${TABLET}).`, 1400, 933],
  ['suite-merch-hoy', `A 38-year-old Mexican man, short beard, black crew tee and lanyard, holding a walkie-talkie and a paper clipboard among stacked cardboard boxes in a venue back area, stressed, harsh work light. NO tablet, NO phone screens — radio and paper only.`, 1400, 933],
  ['suite-merch-resuelto', `A 38-year-old Mexican man with a wide face, loose short wavy dark hair (NOT slicked back), sparse short beard, small earring in his left ear, plain black crew tee and lanyard, calm beside the lit merch booth checking a tablet (${TABLET}), line moving behind, night venue light.`, 1400, 933],
  ['suite-merch-venue', `Very wide night shot inside a full Mexican arena concourse: several lit merch booths along the perimeter with PLAIN solid-color garments only (no printed graphics visible at this distance), crowds flowing, dramatic but real lighting.`, 1400, 933],
  ['caso-merch-puertas', `Doors just opened: a line of concert-goers at the merch booth, cashier charging with a tablet (${TABLET}), no WiFi router anywhere, warm booth light against dark concourse.`, 1400, 933],
  ['caso-merch-pico', `Peak hour at the merch booth: three cashiers in plain black tees charging in parallel on tablets (${TABLET}), the line dense but moving, back wall of plain solid-color shirts, motion energy, night. No caps with monograms, no printed garments anywhere.`, 1400, 933],
  ['caso-merch-reabasto', `A staff member in a plain black tee with a lanyard carrying a cardboard box across the venue concourse toward a merch booth whose counter tablet shows a realistic point-of-sale app with product tiles, crowd blurred around, urgency without chaos, night.`, 1400, 933],
  ['caso-merch-corte', `After the show, house lights on: the merch manager at the quiet booth reviewing the night's numbers on a tablet (${TABLET}), a cash drawer open beside a small pile of bills being counted by a colleague, sealed boxes behind. No printed garments in frame.`, 1400, 933],
  ['proc-merch-1', `Production office weeks before the tour: the merch manager and a consultant with a laptop reviewing a printed product lineup, tour boxes behind.`, 1400, 933],
  ['proc-merch-2', `Merch booth being assembled in an empty venue: staff pinning PLAIN solid-color t-shirts (black, white, gray, no prints) to the back wall, boxes half-open, day work lights.`, 1400, 933],
  ['proc-merch-3', `Quick training before doors: four young staff around the booth counter watching a trainer hold a tablet (${TABLET}), hands anatomically correct, empty venue behind.`, 1400, 933],
  ['proc-merch-4', `Doors open, venue filling: the lit merch booth charging its first customers of the night, line forming, energy rising.`, 1400, 933],
  ['proc-merch-5', `The merch manager closing the night: tablet in hand (${TABLET}), sealed brown boxes stacked on a dolly ready for the truck, quiet dark venue. Any garment visible is plain solid color with no print.`, 1400, 933],
  ['plano-merch-modulo', `Empty merch booth ready before doors: back wall of folded t-shirts pinned by size, hoodies hanging, tablet on a stand (screen with POS app slightly out of focus), cash drawer, no people.`, 1400, 933],
  ['plano-merch-fila', `Orderly queue lane with stanchions in front of a merch booth in a venue concourse, a staff member scanning a customer's phone with her own phone, night.`, 1400, 933],
  ['plano-merch-camion', `Loading dock of a venue at night: a box truck with its gate open, labeled merch boxes stacked on dollies, no people.`, 1400, 933],
  ['plano-merch-produccion', `Production table backstage at night: two laptops, radios, a tablet propped up showing a dashboard-like app (slightly out of focus), cable runs, road cases, no people, no garments in frame.`, 1400, 933],
  ['plano-merch-linea', `Online-store packing table backstage at night, no people: kraft boxes, PLAIN solid-color folded t-shirts with no prints, blank shipping labels, tape gun, warm work light matching a night venue series.`, 1400, 933],
];
const PRODUCTS = [
  ['merch-negra', 'Black concert tour t-shirt with abstract geometric graphic (no letters), flat lay'],
  ['merch-blanca', 'White concert tour t-shirt with abstract geometric graphic (no letters), flat lay'],
  ['merch-tiedye', 'Tie-dye concert tour t-shirt in blue and purple tones with abstract graphic (no letters), flat lay'],
  ['merch-hoodie', 'Black concert tour hoodie with small abstract chest graphic (no letters), flat lay'],
];
const PSTYLE = 'Clean e-commerce product photo, soft even studio light, plain very light gray background, photorealistic fabric texture, no logos, no readable text, no person.';

async function gen(file, prompt, size, w, h) {
  const out = path.join(IMG, `${file}.webp`);
  try { await fs.access(out); console.log(`skip ${file}`); return; } catch {}
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt, size, quality: 'medium' });
    const png = Buffer.from(r.data[0].b64_json, 'base64');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(png).resize(w, h, { fit: 'cover' }).webp({ quality: 85 }).toFile(out);
    console.log(`ok ${file}`);
  } catch (e) { console.error(`FALLO ${file}: ${e?.message || e}`); }
}

const work = [
  ...SCENES.map(([f, p, w, h]) => () => gen(f, `${p}\n\n${STYLE}`, '1536x1024', w, h)),
  ...PRODUCTS.map(([f, p]) => () => gen(f, `${p}. ${PSTYLE}`, '1024x1536', 700, 1050)),
];
for (let i = 0; i < work.length; i += 4) await Promise.all(work.slice(i, i + 4).map(fn => fn()));
console.log('LISTO');
