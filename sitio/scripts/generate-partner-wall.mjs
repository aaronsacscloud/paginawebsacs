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

const NOMAD = [
  'A 28-year-old Latin man working on his laptop at a small wooden kitchen table in his Mexican apartment, plant on table, morning light from window.',
  'A 34-year-old Latin woman on her laptop at a small specialty café in CDMX Roma neighborhood, ceramic latte cup beside her, soft afternoon light.',
  'A 30-year-old Latin man in a casual home office in his Guadalajara apartment, exposed brick wall, plant, MacBook open angled away from camera.',
  'A 42-year-old Latin woman working remotely at a sunlit coworking space, large window behind her with greenery, headphones around her neck.',
  'A 26-year-old Latin man typing on his laptop at a colorful Tulum-style Airbnb dining table, wooden walls, palm leaf shadows on the wall.',
  'A 38-year-old Latin woman sipping coffee at her bedroom desk turned home office in Mexico City, neat shelves with books behind, soft warm light.',
  'A 31-year-old Latin man on a video call (laptop screen angled away) at a CDMX café terrace, plants around, golden hour.',
  'A 29-year-old Latin woman editing on her tablet on a couch in her sunny Mérida apartment, small dog beside her, plants.',
  'A 45-year-old Latin man at a community library / public reading room in Mexico, working on a laptop with notebook open, quiet midday light.',
  'A 33-year-old Latin woman in a cozy Mexican apartment with eclectic decor, working on her laptop on a vintage rug on the floor.',
  'A 27-year-old Latin man at a beach café in Quintana Roo with his laptop open on a wooden table, salt-air light, palm leaves.',
  'A 36-year-old Latin woman at a hotel lobby in CDMX with her laptop on a coffee table, modern minimalist interior, natural light.',
  'A 40-year-old Latin man working from a small balcony of his apartment, laptop on a metal café table, plants, late afternoon golden light.',
  'A 25-year-old Latin woman at a university campus café in Monterrey, laptop and books, casual student style, daylight through tall windows.',
  'A 32-year-old Latin man in a converted garage home studio in Mexico, sitting at a wooden desk with two pendant lights, casual hoodie.',
  'A 37-year-old Latin woman working on her laptop at a kitchen island in her modern Mexican home, granite counter, morning sunlight, coffee.',
  'A 29-year-old Latin man at a farm-to-table café in San Miguel de Allende, leather notebook beside laptop, warm interior with stone walls.',
  'A 31-year-old Latin woman in a CDMX co-living space dining area, laptop open angled away, casual roommates blurred in background.',
  'A 44-year-old Latin man at a wood meeting nook in his suburban Mexican home, plants, bookshelf, warm pendant light, focused expression.',
  'A 26-year-old Latin woman working from a couch in her studio apartment in Mexico, laptop on lap, blanket, cup of tea on side table.',
  'A 35-year-old Latin man at a cafetería in Oaxaca with traditional Mexican tile floors, working on his MacBook, mezcal glass beside him.',
  'A 28-year-old Latin woman writing in a notebook beside her laptop at a sunny Mexican café terrace, bicycles parked outside softly visible.',
  'A 39-year-old Latin man in a converted attic home office in Mexico, window with city view behind him, modern desk setup, focused.',
  'A 30-year-old Latin woman on a porch swing of a Mexican country house with her laptop and a hot drink, lush plants surrounding.',
  'A 33-year-old Latin man at a CDMX rooftop café with city skyline behind him, laptop open, sunset light.',
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
