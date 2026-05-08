// Genera 50 fotos para el muro de partners en la invitación.
// Distribución: 25 nómadas/casa/café · 15 influencers · 5 comerciantes · 5 empresarios.
// Output: sitio/public/images/partner-wall/<NN>-<cat>-<id>.webp
// El prefijo numérico hace que readdirSync().sort() produzca mosaico mezclado.

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/partner-wall');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return [l.slice(0, i).trim(), v];
}));
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light only, slight film grain, accurate Latin American skin tones, no AI smoothing or gloss. Real Mexican / Latin American person, square 1:1 framing for a wall mosaic. Subject mostly centered. No legible text, no logos, no brand names anywhere.';

// Mezcla realista: 7 con laptop · 12 con teléfono · 6 con tablet
// Varied locations LATAM y mundo. NO todos en la misma postura.
const NOMAD = [
  // ── 7 LAPTOP (variedad de locaciones) ──
  'A 28-year-old Latin man working on his laptop at a sunlit suburban Mexican kitchen counter in the morning, ceramic mug beside him, plant on counter, casual home clothes.',
  'A 34-year-old Latin woman at a coworking space lounge in Guadalajara, headphones around neck, laptop on a low coffee table, sunken couch, focused expression.',
  'A 26-year-old Latin man at a beach café in Quintana Roo with laptop, palm-leaf shadows on his table, ceramic cup of cold brew, ocean blurred.',
  'A 38-year-old Latin woman at her bedroom desk-turned-home-office in Mexico City, books on shelf behind, late-afternoon warm light, leaning slightly into the screen.',
  'A 33-year-old Latin man at a CDMX rooftop café with city skyline behind him at sunset, laptop on a metal café table.',
  'A 41-year-old Latin woman at a country house porch swing in Mexico, laptop beside her, lush plants, two dogs at her feet, late-day light.',
  'A 30-year-old Latin man at a converted attic home office, window with city view, modern desk setup, soft morning light.',

  // ── 12 PHONE (en distintos lugares trabajando) ──
  'A 27-year-old Latin woman walking through a colorful cobblestone street in San Miguel de Allende, holding her phone close to her face mid-message, casual stylish clothes, plants spilling from balconies.',
  'A 32-year-old Latin man checking his phone at a busy Mexico City mercado público, fresh produce stalls blurred behind, holding a paper coffee cup.',
  'A 30-year-old Latin woman on a park bench in Parque México (CDMX) with her phone in hand mid-thought, jacaranda trees, soft afternoon light.',
  'A 38-year-old Latin man at an airport gate seated on a modern bench, phone in hand, small carry-on at his feet, gate window with planes blurred behind.',
  'A 25-year-old Latin man at a Tulum beach with phone in hand at golden hour, palm leaves, barefoot in sand near a hammock café.',
  'A 35-year-old Latin woman on a hotel balcony in CDMX overlooking the city, phone in hand mid-call, casual robe over pajamas, morning light.',
  'A 29-year-old Latin man in the back of a Mexican Uber/taxi looking at his phone, city street blurred outside the window.',
  'A 42-year-old Latin woman at an outdoor café terrace in CDMX Roma, phone in one hand and pen in the other, notebook on the table, plants around.',
  'A 26-year-old Latin man on a public transit platform (CDMX metrobús) with phone in hand mid-message, soft natural light from the open station.',
  'A 36-year-old Latin woman at a small specialty cafe counter in Oaxaca, phone in hand resting on the wooden counter, ceramic mug of mezcal-coffee beside her.',
  'A 31-year-old Latin man at the airport boarding hall, leaning against a column with phone in hand, casual blazer and small backpack.',
  'A 44-year-old Latin man on a hotel rooftop pool deck in Cartagena Colombia, phone in hand reading, palms and ocean blurred behind.',

  // ── 6 TABLET ──
  'A 30-year-old Latin man on a hotel lobby couch in Mexico City, iPad on his lap with Apple Pencil in hand, sketching, modern minimalist interior.',
  'A 39-year-old Latin woman at a sunny café terrace in Buenos Aires-style neighborhood, tablet propped against a coffee cup, leaning forward to read, plants around.',
  'A 34-year-old Latin man on a Mexican beach lounge chair (Quintana Roo) with a tablet in his lap, palm leaves overhead, ocean visible.',
  'A 47-year-old Latin woman in a plaza pública seated on a stone bench with tablet on her knees, fountain blurred behind.',
  'A 28-year-old Latin man on the roof terrace of a CDMX coworking space holding a tablet upright while standing, golden hour, casual shirt.',
  'A 36-year-old Latin woman at a small home dining table with iPad propped on a stand, surrounded by plants and a coffee carafe, soft window light.',
];

const INFLUENCER = [
  'A 27-year-old Latin woman influencer holding her phone vertically at chest level (screen angled away from camera) recording a vlog at home with plants and natural light.',
  'A 31-year-old Latin man content creator at a desk with a ring light and DSLR camera on tripod, mid-recording, modern home studio in Mexico.',
  'A 25-year-old Latin woman doing a IG-style live (phone on tripod, screen angled away, no UI visible) in her bedroom mirror setup, casual mid-laugh.',
  'A 33-year-old Latin man podcaster at a wooden home desk with a professional microphone in front of him, headphones on, focused listening.',
  'A 29-year-old Latin woman creator photographing a small product on a wooden table with natural side light, mirrorless camera in hand.',
  'A 35-year-old Latin man food creator filming a plate of Mexican food on his phone at a colorful kitchen counter, tripod, warm light.',
  'A 26-year-old Latin woman influencer adjusting a phone-tripod setup near a window with plants, mid-action setting up a recording.',
  'A 32-year-old Latin man editing video on a MacBook at a creator desk with two monitors angled away, home studio, focused.',
  'A 28-year-old Latin woman beauty creator at a vanity desk with a ring light, mid-application of a product, calm mid-shot expression.',
  'A 38-year-old Latin man fashion creator standing in front of a roller wardrobe of clothes with a camera around his neck, getting ready to shoot.',
  'A 30-year-old Latin woman content creator dancing softly to a phone recording in her colorful bedroom, mid-step, natural casual moment.',
  'A 27-year-old Latin man book/literature creator filming himself reviewing a stack of books at his bedroom desk, phone on tripod.',
  'A 34-year-old Latin woman lifestyle creator unboxing a small package on her kitchen island in front of her phone, mid-laugh.',
  'A 29-year-old Latin man fitness creator in a home gym with phone on tripod recording a quick tip, dumbbells visible.',
  'A 36-year-old Latin woman business creator at a desk with a teleprompter rig and camera, mid-take of a recorded message.',
];

const COMERCIANTE = [
  'A 50-year-old Latin man shop owner standing behind the counter of his small hardware store in Mexico, smiling warmly at a customer (only customer torso visible).',
  'A 45-year-old Latin woman shop owner at the cash register of her small abarrotes / bodega in a Mexican neighborhood, surrounded by stocked shelves.',
  'A 42-year-old Latin man café owner pouring espresso behind the counter of his small specialty café in CDMX, focused and proud.',
  'A 55-year-old Latin woman vendor at her stall in a Mexican mercado público (mercado de la Merced style), arranging fresh produce, warm dignified.',
  'A 48-year-old Latin man owner of a small Mexican restaurante / fonda standing in his kitchen doorway looking out at the dining area, apron on.',
];

const EMPRESARIO = [
  'A 50-year-old Latin man executive in a sharp casual blazer (no tie) seated at a large modern desk in a high-floor CDMX office with floor-to-ceiling windows, looking thoughtful.',
  'A 45-year-old Latin woman CEO standing in a glass-walled boardroom with a team behind her at a long meeting table, mid-presentation pose.',
  'A 52-year-old Latin man business owner walking through a large corporate warehouse / logistics center in Mexico with a tablet in hand, capable confident.',
  'A 38-year-old Latin woman director seated in a corner office with city skyline behind her, holding a coffee mug, focused on a laptop angled away.',
  'A 55-year-old Latin man entrepreneur giving a talk on a stage at a Mexican business conference, microphone in hand, soft stage lighting, audience silhouettes blurred.',
];

// Construir lista plana con prefijos ordinales para mosaico mezclado
function buildItems() {
  const items = [];
  // Intercalamos: nomad, nomad, infl, nomad, infl, nomad, comerciante/empresario...
  // Generamos prefijos numerados 01-50 alternando categorías
  const queue = [];
  // Tomamos 25 nomad, 15 infl, 5 comerciante, 5 empresario
  const buckets = [
    NOMAD.map((p, i) => ({ cat: 'nomad', n: i + 1, prompt: p })),
    INFLUENCER.map((p, i) => ({ cat: 'infl', n: i + 1, prompt: p })),
    COMERCIANTE.map((p, i) => ({ cat: 'tienda', n: i + 1, prompt: p })),
    EMPRESARIO.map((p, i) => ({ cat: 'emp', n: i + 1, prompt: p })),
  ];
  // Round-robin con peso aproximado a la proporción
  while (buckets.some(b => b.length > 0)) {
    for (let i = 0; i < buckets.length; i++) {
      // Saca proporcional: nomad cada 2 vueltas, infl cada 3, los chicos cada ~10
      const ratio = [2, 3, 10, 10][i];
      if (queue.length % ratio === 0 || queue.length < 1) {
        if (buckets[i].length > 0) queue.push(buckets[i].shift());
      }
    }
    // Si nada se agregó en esta vuelta (caso bordes), forzamos
    const before = queue.length;
    if (before === queue.length) {
      for (const b of buckets) {
        if (b.length > 0) { queue.push(b.shift()); break; }
      }
    }
  }
  return queue.map((it, i) => ({
    file: `${String(i + 1).padStart(3, '0')}-${it.cat}-${String(it.n).padStart(2, '0')}`,
    prompt: it.prompt,
  }));
}

const ITEMS = buildItems();
console.log(`Total items: ${ITEMS.length}`);

await fs.mkdir(OUT_DIR, { recursive: true });
const openai = new OpenAI();
const CONCURRENCY = 6;

async function genOne(item) {
  const outPath = path.join(OUT_DIR, `${item.file}.webp`);
  try { await fs.access(outPath); console.log(`✓ skip ${item.file}`); return; } catch {}
  const fullPrompt = `${item.prompt}\n\n${STYLE}`;
  console.log(`→ ${item.file}…`);
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: fullPrompt,
      size: '1024x1024',
      quality: 'medium',
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64');
    const png = Buffer.from(b64, 'base64');
    const sharp = (await import('sharp')).default;
    await sharp(png)
      .resize(640, 640, { fit: 'cover' })
      .webp({ quality: 86 })
      .toFile(outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.file} · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.file}:`, e?.message || e);
  }
}

for (let i = 0; i < ITEMS.length; i += CONCURRENCY) {
  const batch = ITEMS.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(genOne));
}
console.log('\nDone.');
