// Genera imágenes ejemplo para los nuevos tipos de "Apoyo" y "Filantropía"
// del programa de partners. Usa OpenAI gpt-image-2 (fallback gpt-image-1).
//
// Uso: node scripts/generate-partner-images.mjs [--only ID]
//
// Salida: sitio/public/images/content-examples/<file>.webp

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/content-examples');

// ── Cargar .env.local ────────────────────────────────────────
const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const envMap = Object.fromEntries(
  envText.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || envMap.OPENAI_API_KEY;
if (!process.env.OPENAI_API_KEY) { console.error('Falta OPENAI_API_KEY'); process.exit(1); }

const STYLE = 'Wide environmental photo, photorealistic, documentary photojournalism style, real Latin American (Mexican) people with natural skin texture and varied ages 25-60, natural lighting, slight film grain, no logos, no brand names, no readable text on any surface, no AI gloss, candid expressions, 16:9 framing.';

const ITEMS = [
  // ─── APOYO ───────────────────────────────────────────────
  { id: 'demo_evento_sector', file: 'demo-evento-sector',
    prompt: 'A 30s Mexican woman standing at a sleek modern trade-show booth showing a tablet (screen angled away from camera) to two interested small-business owners. Busy retail expo floor in Mexico City, other booths blurred behind. Daytime convention hall lighting.' },
  { id: 'resena_publica', file: 'resena-publica',
    prompt: 'A 35-year-old Mexican shopkeeper at the counter of her small boutique in Guadalajara, looking thoughtfully at a laptop while typing. Warm late-afternoon light through the front window. Plants and clothing inventory visible behind her.' },
  { id: 'activacion_sucursal', file: 'activacion-sucursal',
    prompt: 'A Saturday afternoon inside a small Mexican boutique. The 40s woman owner gesturing at a tablet (screen pointed away from camera) while three other small-business owners (mixed gender, 30-50) look on with interest. Clothing racks, warm pendant lights, real space.' },
  { id: 'speaking_panel', file: 'speaking-panel',
    prompt: 'Conference panel scene in Mexico — four panelists seated on stools in front of a deep-blue backdrop with abstract geometric pattern (no text). Center panelist is a 35-year-old Latin woman, microphone in hand, mid-sentence with confident gesture. Soft warm stage lighting, audience silhouettes in foreground.' },
  { id: 'intro_calificada', file: 'intro-calificada',
    prompt: 'Two Mexican professionals (man 40s, woman 30s) shaking hands across a small café table in Mexico City. Phones and notebooks on the wooden table, two coffees, warm filtered light through a window. Casual but professional dress.' },
  { id: 'meetup_local', file: 'meetup-local',
    prompt: 'Interior of a small specialty café / boutique in Mexico hosting an evening meetup. About 12 people sitting on bentwood chairs in a semicircle, a 40s woman standing presenting with hands mid-gesture. Plants, exposed brick, soft warm pendant lights. Diverse Latin American attendees ages 25-55.' },
  { id: 'co_marketing', file: 'co-marketing',
    prompt: 'Two business owners (Latin man 30s and Latin woman 40s) collaborating to shoot an Instagram reel together in a sunlit courtyard full of plants. Phone on a small tripod, both laughing naturally during a take. Real candid moment.' },
  { id: 'beta_feedback', file: 'beta-feedback',
    prompt: 'A 30s Latin American man at a wooden home-office desk, laptop open, one hand on a coffee mug, looking thoughtfully off-frame. A notebook beside the laptop with hand-written squiggles (no readable text). Plant on the desk, warm window light from the left.' },
  { id: 'material_local', file: 'material-local',
    prompt: 'Tight environmental shot of the counter of a small Mexican retail store: a printed card and a small QR-code stand on the counter (the QR pattern is abstract pixels with no readable text). A woman behind the counter slightly blurry in the background. Soft daylight from the right.' },
  { id: 'stand_feria', file: 'stand-feria',
    prompt: 'Wide shot of a Mexican convention center floor — a clean modern square booth with a young Mexican woman (early 30s) greeting two visitors. Tablet on a small podium, abstract banner backdrop with geometric shapes (no readable text). Crowd blurred behind.' },

  // ─── FILANTROPÍA ─────────────────────────────────────────
  { id: 'voluntariado_animales', file: 'voluntariado-animales',
    prompt: 'Inside a Latin American dog rescue shelter (perrera) in late-afternoon natural light. A 30s Latin volunteer kneeling on a clean concrete floor gently petting a mid-sized brown rescue dog. Other dogs visible in clean kennels behind. Real, slightly worn architecture, dignified portrayal.' },
  { id: 'jornada_adopcion', file: 'jornada-adopcion',
    prompt: 'Daytime outdoor adoption fair in a Mexican plaza pública. A safe playpen with three small rescue puppies, two Latin volunteers in plain colored t-shirts (no logos) speaking with a family of three. Trees, weekend afternoon light, kids smiling at the puppies.' },
  { id: 'banco_alimentos', file: 'banco-alimentos',
    prompt: 'Inside a Mexican food-bank warehouse — six Latin volunteers of mixed ages packing cardboard boxes with dry goods (rice, beans, oil). Wooden pallets and stacked boxes behind. One woman in the foreground sealing a box with tape. Mixed fluorescent and natural daylight, dignified working scene.' },
  { id: 'comedor_comunitario', file: 'comedor-comunitario',
    prompt: 'Inside a small Mexican community kitchen / comedor comunitario. A 50s Latin woman in a clean apron serving rice and beans onto a plate held by an elderly man. Other people seated at simple metal tables in the background. Warm overhead light, dignified.' },
  { id: 'distribucion_despensas', file: 'distribucion-despensas',
    prompt: 'Outdoor scene in a rural Mexican village (sierra background). Three Latin volunteers handing bags of staples (frijol, arroz) to local families lined up calmly. Dusty afternoon light, mountains in the distance, dignified non-staged moment.' },
  { id: 'albergue_personas', file: 'albergue-personas',
    prompt: 'Indoor scene of a Mexican asilo de adultos mayores (senior home). A 30s Latin woman volunteer sitting on a chair next to an 80-year-old woman, holding her hand, both smiling softly. Soft window light, modest interior with plants and a simple painted wall.' },
  { id: 'limpieza_publica', file: 'limpieza-publica',
    prompt: 'Wide shot of a beach cleanup on the Mexican Pacific coast. Eight Latin volunteers in caps and reusable gloves picking up trash into reusable bags. Morning sun, light ocean haze in the background, candid action poses, not posed.' },
  { id: 'mentoria_emprendedor', file: 'mentoria-emprendedor',
    prompt: 'Inside a small produce stall in a Mexican mercado popular. A young consultant (early 20s, casual jeans) sitting on a low plastic stool talking with a 50s woman vendor behind her stand. Both leaning over a notebook with sketched plans (illegible squiggles). Warm market light, fruits and vegetables visible.' },
  { id: 'conferencia_escuela', file: 'conferencia-escuela',
    prompt: 'Wide shot of a Mexican public-school auditorium. A 35s Latin woman speaker on a low stage with a microphone, mid-sentence with a warm gesture. High-school students seated, back of heads visible, listening attentively. Banners on the wall with abstract patterns (no readable text).' },
  { id: 'beca_patrocinio', file: 'beca-patrocinio',
    prompt: 'Close-environmental documentary photo: a 14-year-old Mexican student in a clean school uniform receiving a backpack with school supplies from an adult\'s hands (only the adult\'s torso and hands visible). Modest Mexican home interior in background, warm afternoon light, small genuine smile. Dignified.' },
];

// ── Filtro CLI ──
const onlyId = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const work = onlyId ? ITEMS.filter(i => i.id === onlyId) : ITEMS;

await fs.mkdir(OUT_DIR, { recursive: true });

const openai = new OpenAI();

async function pngToWebp(pngBuffer, outPath) {
  const sharp = (await import('sharp')).default;
  await sharp(pngBuffer)
    .resize(1280, 720, { fit: 'cover' })
    .webp({ quality: 85 })
    .toFile(outPath);
}

const MODEL = 'gpt-image-2';
const QUALITY = 'medium'; // suficiente para mockups web, ~3x más rápido que high
const SIZE = '1536x1024';
const CONCURRENCY = 4;

async function genOne(item) {
  const outPath = path.join(OUT_DIR, `${item.file}.webp`);
  try { await fs.access(outPath); console.log(`✓ skip ${item.file}`); return; } catch {}
  const fullPrompt = `${item.prompt}\n\n${STYLE}`;
  console.log(`→ ${item.file}…`);
  try {
    const resp = await openai.images.generate({ model: MODEL, prompt: fullPrompt, size: SIZE, quality: QUALITY });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64 en respuesta');
    const png = Buffer.from(b64, 'base64');
    await pngToWebp(png, outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.file}.webp · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.file}:`, e?.message || e);
  }
}

// Paralelo en batches de CONCURRENCY
for (let i = 0; i < work.length; i += CONCURRENCY) {
  const batch = work.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(genOne));
}

console.log('\nDone.');
