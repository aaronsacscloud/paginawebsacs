// Imágenes cover para los 6 módulos de la Academia SACS.
// Output: sitio/public/images/aprende-sacs/modulo-N.webp (1600×900 ~ 16:9)
//
// Cada imagen muestra el momento característico que vive un cliente real
// en ese módulo del proceso — para que el partner entienda el journey
// completo y pueda venderlo desde el contexto del cliente.

import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(SITIO, 'public/images/aprende-sacs');

const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;

const STYLE = 'Photographic quality: shot on a 35mm full-frame camera with shallow depth of field, natural light, slight film grain, accurate skin tones, no AI smoothing or gloss. Mexican / Latin American retail context, real ages 25-50. NO legible text or numbers anywhere — any screens visible show only soft abstract shapes/colors. No brand logos. 16:9 framing, environmental shot (wide, not close-up portrait).';

const ITEMS = [
  {
    file: 'modulo-1',
    label: 'M1 Configuración',
    prompt: `Inside a small Mexican boutique on its first day of setup. A 35-year-old female store owner stands behind the counter, mid-conversation with a younger female employee (28). On the counter: a clean tablet (screen angled away from camera), a brand-new receipt printer, a small cash drawer. Behind them: half-empty shelves being arranged with folded clothing. Warm morning light streaming through the glass storefront. The mood is "we are setting up the foundation of this business together". Calm, organized, slightly excited.`,
  },
  {
    file: 'modulo-2',
    label: 'M2 Catálogo',
    prompt: `A clean wooden table inside a Mexican retail backroom. A 30-year-old female shop owner is photographing a single product (a folded sweater) on a small white photography backdrop with her smartphone on a tripod. Beside her: a laptop turned slightly away from camera, a few neatly arranged products waiting to be photographed (a bag, a candle, a t-shirt). Soft window light. The mood is "I'm building my catalog one product at a time, with care". Focused, creative, methodical.`,
  },
  {
    file: 'modulo-3',
    label: 'M3 Punto de Venta',
    prompt: `Wide shot of a real moment at a small Mexican boutique counter: a 40-year-old female customer is paying for a purchase with her credit card on a card reader, while a 28-year-old male cashier scans a product with a barcode scanner. On the counter: a tablet POS (screen tilted away from camera showing only soft color blocks), a folded bag with the customer's purchase. Behind: visible clothing displays softly out of focus. Late afternoon warm light. The mood is "every sale flows smoothly, the team knows what they're doing". Confident, professional, alive.`,
  },
  {
    file: 'modulo-4',
    label: 'M4 Puesta en Marcha',
    prompt: `Inside a Mexican retail backroom that is mid-transformation. A 38-year-old male owner sits at a desk with an open laptop (screen angled away), a stack of paper inventory sheets beside him, and a coffee cup. He is mid-import: looking from a paper list to the laptop screen, pen in hand checking off items. Behind him: shelves stocked with boxes being organized. Late afternoon light. The mood is "I'm moving my entire business into this system, today is launch day". Determined, focused, slightly intense.`,
  },
  {
    file: 'modulo-5',
    label: 'M5 Operación',
    prompt: `End of the workday at a Mexican boutique. A 42-year-old female owner is doing the daily cash count at the counter: counting bills in stacks by denomination, a small printed receipt beside her, a tablet showing soft abstract dashboard shapes (no readable numbers, angled away). The store lights are on but the storefront shows the dusk outside through the glass. The mood is "I close every day knowing exactly what happened". Calm, in control, ritual.`,
  },
  {
    file: 'modulo-6',
    label: 'M6 Online',
    prompt: `A 33-year-old female Mexican retail owner sitting at a small kitchen table at home in the evening, packing two cardboard shipping boxes with folded clothing. Beside her: a smartphone with a chat conversation visible (screen angled away, only color bubbles visible, no readable text), a tape gun, printed shipping labels stacked. Soft warm lamp light, a glass of water, a notebook. The mood is "my store is now open 24/7 — these are the orders that came in while I slept". Tired but satisfied, modern entrepreneur.`,
  },
];

await fs.mkdir(OUT_DIR, { recursive: true });
const openai = new OpenAI();

async function genOne(item) {
  const outPath = path.join(OUT_DIR, `${item.file}.webp`);
  try { await fs.access(outPath); console.log(`✓ skip ${item.label}`); return; } catch {}
  const fullPrompt = `${item.prompt}\n\n${STYLE}`;
  console.log(`→ ${item.label}…`);
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: fullPrompt,
      size: '1536x1024',
      quality: 'high',
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('sin b64');
    const png = Buffer.from(b64, 'base64');
    const sharp = (await import('sharp')).default;
    await sharp(png)
      .resize(1600, 900, { fit: 'cover' })
      .webp({ quality: 86 })
      .toFile(outPath);
    const stat = await fs.stat(outPath);
    console.log(`  ✓ ${item.file}.webp · ${(stat.size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`  ✗ ${item.label}:`, e?.message || e);
  }
}

// Secuencial para no exceder rate limit
for (const item of ITEMS) {
  await genOne(item);
}
console.log('\nDone.');
