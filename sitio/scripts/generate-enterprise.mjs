// Fotos de la sección Enterprise de /planes (18-oct-2026, dueño: «hazlo más visual… usa ChatGPT Image 2»).
// Output: sitio/public/images/enterprise/<file>-{960,1536}.webp
// Llave: OPENAI_API_KEY del entorno o de sitio/.env.local. Las que ya existen se saltan.
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/enterprise');
if (!process.env.OPENAI_API_KEY) {
  try {
    const t = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
    const m = t.match(/^OPENAI_API_KEY=(.*)$/m);
    if (m) process.env.OPENAI_API_KEY = m[1].trim().replace(/^['"]|['"]$/g, '');
  } catch (e) { /* sin .env.local */ }
}

const STYLE = 'Editorial fashion photography, shot on a 35mm full-frame camera, shallow depth of field, natural light, slight film grain, real skin texture, no AI gloss. Mexican / Latin American fashion retail, people aged 28-55. Wardrobe and decor in warm neutrals with one accent of cobalt blue (#2F5BEA). NO legible text, numbers or logos anywhere; screens only show soft abstract color blocks and are angled away.';

const ITEMS = [
  { file: 'ent-hero', size: '1536x1024', prompt: 'Wide shot at dusk inside the glass-walled headquarters of a Mexican fashion group with many stores. A 45-year-old woman director in a cobalt blue tailored suit stands at a long table, leaning on it with both hands, looking at a large wall of screens showing soft abstract maps and colored blocks (the network of stores). Around the table, two team members (a man with rolled sleeves and a younger woman holding a tablet) review garment samples on a rolling rack. City lights outside. Mood: one brain running a whole fashion empire, calm and powerful.' },
  { file: 'ent-ejecutivo', size: '1024x1024', prompt: 'A 40-year-old male account executive in a navy blazer sits across from the owner of a fashion brand (a 50-year-old woman with silver hair) in her showroom, both smiling mid-conversation over coffee; he points at a laptop angled away from camera; fabric swatches and a mood board between them. Mood: a dedicated senior partner who knows your business.' },
  { file: 'ent-medida', size: '1024x1024', prompt: 'Close, over-the-shoulder shot of a young woman developer and a fashion merchandiser side by side in a bright studio: on a large monitor (angled, only soft colored UI blocks) a custom screen is being designed; on the desk, sketches of a store layout and a garment tag prototype. Mood: software tailored like a bespoke suit.' },
  { file: 'ent-integra', size: '1024x1024', prompt: 'A modern fashion distribution center (CEDIS) in Mexico: tall racks of folded garments and boxes, a woman supervisor with a handheld scanner checks a bin while a conveyor carries parcels behind her; a tablet on a stand angled away. Cobalt blue crates as accent. Mood: every system connected, merchandise flowing.' },
  { file: 'ent-volumen', size: '1024x1024', prompt: 'Aerial-ish view from a mezzanine of a busy flagship fashion store in Mexico City on a weekend: several cashiers serving lines of shoppers, racks full, warm light. Mood: scale — many stores, many registers, one platform.' },
];

await fs.mkdir(OUT_DIR, { recursive: true });
const openai = new OpenAI();
const sharp = (await import('sharp')).default;

async function genOne(item) {
  const fin = path.join(OUT_DIR, `${item.file}-960.webp`);
  try { await fs.access(fin); console.log(`✓ skip ${item.file}`); return; } catch (e) { /* hay que generarla */ }
  console.log(`→ ${item.file}…`);
  const resp = await openai.images.generate({ model: 'gpt-image-2', prompt: `${item.prompt}\n\n${STYLE}`, size: item.size, quality: 'high' });
  const b64 = resp.data && resp.data[0] && resp.data[0].b64_json;
  if (!b64) throw new Error('sin b64');
  const png = Buffer.from(b64, 'base64');
  for (const w of [960, 1536]) {
    await sharp(png).resize({ width: w, withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(OUT_DIR, `${item.file}-${w}.webp`));
  }
  console.log(`  ✓ ${item.file}`);
}

await Promise.all(ITEMS.map((it) => genOne(it).catch((e) => console.error(`  ✗ ${it.file}:`, e && e.message || e))));
console.log('Listo.');
