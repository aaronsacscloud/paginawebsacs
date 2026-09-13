// Portadas (1200×540) para los correos de las cadencias Leads, Demo, Crecimiento y Winback.
// Mismo estilo que las 22 de /email/portadas/: cinematográfico, gente real operando, color
// de acento fuerte, y si sale una pantalla enseña una interfaz de Sacs (nunca en blanco).
//   node scripts/generate-portadas-cadencias.mjs            (genera las que falten)
//   node scripts/generate-portadas-cadencias.mjs consultora  (fuerza una)
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(SITIO, 'public/email/portadas');
if (!process.env.OPENAI_API_KEY) {
  for (const f of ['/opt/sacs/sacs_api/.env', path.join(SITIO, '.env')]) {
    try {
      const m = (await fs.readFile(f, 'utf8')).match(/^OPENAI_API_KEY=["']?([^"'\n]+)/m);
      if (m) { process.env.OPENAI_API_KEY = m[1]; break; }
    } catch { /* no está */ }
  }
}

const ESTILO = `Cinematic editorial photograph, 35mm full-frame, f/2 with shallow depth of field and soft falloff, mixed warm tungsten light with one strong color accent (magenta, cobalt or amber), slight film grain, real skin texture, a gesture caught mid-action, no AI gloss. Contemporary Mexican fashion retail with a subtle retro-futurist mood: glossy surfaces, glowing screens, saturated color. Subjects are real Mexican / Latin American people, 25-45. Any screen shows a clean purple-accented retail software interface called Sacs (size-and-color inventory grid, point of sale ticket, simple bar charts) rendered soft and NOT legible; no other text, no logos. Keep the main subject in the vertical center of the frame: the image will be cropped to a wide 20:9 banner.`;

const PORTADAS = {
  consultora: `A 32-year-old Latin woman consultant in a boutique, smiling mid-sentence at the camera side, holding a tablet that glows with a Sacs inventory grid; racks of colorful garments behind her, warm light with a magenta neon edge.`,
  'ia-inventario': `Inside a stockroom at night, a shop owner (woman, 38) looks at a wall-mounted screen that glows violet with a Sacs alert list and small bar charts; boxes and hanging garments around her, cobalt light spill, a sense of the system warning her before she asks.`,
  'clienta-regresa': `At a boutique counter, a young saleswoman hands a wrapped purchase to a returning customer (woman, 30s) who shows her phone; a small screen on the counter glows with a Sacs customer card and loyalty points; both laughing, amber warm light, pink accent wall.`,
  liveshow: `Backstage of a concert venue, a merchandise stand with stacks of band t-shirts and a row of five tablets running the Sacs point of sale, glowing purple in the dark; a crew member (man, 28) scanning a shirt tag, crowd lights blurred magenta and blue in the background.`,
  'live-selling': `A boutique owner (woman, 35) hosting a live sale from her shop: phone on a ring light, she holds up a red dress toward the camera phone, a laptop beside her shows Sacs orders coming in; racks and mirrors behind, magenta and warm tungsten light.`,
  'sesion-video': `A boutique owner (man, 40) at his shop's small desk on a video call on a laptop; on the laptop, a friendly consultant and a Sacs screen shared beside her; garments and a mannequin softly out of focus, late-afternoon amber light, cobalt accent.`,
  'consultora-prepara': `A consultant (woman, 30) at a clean desk preparing a session: a notebook with handwritten notes, a coffee, and a large monitor with a Sacs size-and-color grid glowing violet; morning light, plants, focused and calm.`,
  'axo-asistente': `A shop owner (woman, 42) on the shop floor talking to her phone held up like a voice note; the phone screen glows with a purple chat assistant bubble; behind her a clerk carries a stack of folded jeans; magenta accent light, warm tungsten.`,
  'equipo-rh': `Morning in a fashion store before opening: three staff members in the stockroom, one checking in on a wall tablet that glows with a Sacs attendance list; lockers, folded garments, a coffee; cobalt and amber light, relaxed team energy.`,
  finanzas: `A boutique owner (man, 45) at the back office late in the evening, a desk lamp, receipts and invoices in a neat pile, a monitor with a Sacs expenses dashboard with simple bars and a purple accent; the shop floor lit magenta through the office window.`,
  automatizacion: `A consultant (man, 33) and a boutique owner (woman, 40) at a glass table, looking at a large screen where a Sacs workflow diagram with connected nodes glows violet; sticky notes on the glass, a rack of garments out of focus, cobalt accent, warm light.`,
  'renta-gala': `A gown rental salon: a customer (woman, 28) tries an emerald evening gown in front of a tall mirror while the attendant checks a tablet glowing with a Sacs calendar of reservations; rows of gala dresses in garment bags, magenta and gold light.`,
  // ── Winback · un año sin costo (10 correos + 5 WhatsApp) ──
  'wb-director': `A company director (Mexican man, mid-40s, open-collar shirt, no tie) in a bright glass office, leaning toward a laptop on a video call with a boutique owner; behind him a large monitor glows softly with Sacs charts; morning light, cobalt accent, an attentive, listening expression.`,
  'wb-reunion': `A small round table with two chairs, a laptop open on a Sacs screen, a coffee and a notebook; a boutique owner (woman, 38) listening and nodding across the table, hands folded; calm, unhurried conversation, warm tungsten light with a magenta edge, garments blurred far behind.`,
  'wb-servicio': `A support consultant (woman, 30) with a headset at a clean desk, answering a WhatsApp conversation on a large screen that glows purple with a Sacs chat; a small name plate on the desk, a plant, a wall clock; focused and kind, magenta accent light.`,
  'wb-mejoras': `A product team of two (woman 34, man 29) in front of a large wall screen tiled with dozens of small Sacs module cards glowing violet and cobalt, one of them pointing at a tile; sticky notes on the glass wall, late-evening office light with amber spill.`,
  'wb-siete-dias': `In a boutique stockroom, a consultant (woman, 32) scans garment tags with a handheld scanner while the owner (man, 40) watches a tablet where a Sacs size-and-color grid fills up; a paper calendar on the wall with a week marked; amber light, cobalt accent, energetic teamwork.`,
  'wb-ano': `A shop owner (woman, 35) lifting the metal shutter of her boutique at sunrise, keys in one hand and her phone glowing with a Sacs sales screen in the other; the street still quiet, golden light, a long year ahead feeling, magenta shop sign glow.`,
  'wb-atencion': `A Sacs consultant (man, 33) standing beside a boutique owner (woman, 45) at her counter, both pointing at the point-of-sale screen glowing purple; real in-person presence, racks of clothes around, warm tungsten light with cobalt accent.`,
  'wb-datos': `A tidy stockroom with neatly labeled boxes and hanging garments sorted by size; a tablet resting on a shelf glows with a Sacs inventory list; nobody in a hurry, everything where it was left; cobalt light through a window, a quiet, intact feeling.`,
  'wb-preguntas': `Two women (owner 40, consultant 30) at a café table with a laptop showing Sacs, the owner asking a question with her hands mid-gesture, the consultant answering with a smile; a notebook with a handwritten checklist, magenta accent, warm afternoon light.`,
  'wb-puerta': `A boutique doorway at dusk, the door left open with warm light spilling onto the sidewalk; inside, the owner (woman, 38) arranging a rack of colorful garments, seen through the door; magenta neon edge on the window, an open-door, no-pressure feeling.`,
  'wb-wa-invitacion': `Close-up of a phone lying on a boutique counter showing a purple calendar invitation card (not legible), next to keys, a coffee and a folded sweater; a hand reaching in to pick it up; warm light, magenta accent.`,
  'wb-wa-servicio': `Three support consultants at neighboring desks with headsets, each screen glowing purple with Sacs conversations; one of them laughing mid-call; a bright office, plants, cobalt and amber light, a team that actually answers.`,
  'wb-wa-plan': `A whiteboard with seven hand-drawn columns and colorful sticky notes (no legible text), a consultant (man, 30) pointing at the last column while a boutique owner (woman, 42) nods with arms crossed and a smile; a laptop with Sacs on the table, warm light.`,
  'wb-wa-agenda': `A director's desk in the morning: an open paper planner, a fountain pen, a coffee and a laptop with a Sacs calendar glowing softly; a hand about to write; clean light, cobalt accent, a free slot waiting.`,
  'wb-wa-puerta': `Evening on a boutique street: the shop window glowing warm with mannequins and colorful garments, the door slightly open, the owner (man, 40) inside turning off the last lamp; magenta neon reflection on wet pavement, gentle and final.`,
};

const openai = new OpenAI();
await fs.mkdir(OUT, { recursive: true });
const pedidas = process.argv.slice(2);

async function una(nombre) {
  const salida = path.join(OUT, `${nombre}.jpg`);
  if (!pedidas.length) { try { await fs.access(salida); console.log(`✓ ya está ${nombre}`); return; } catch { /* falta */ } }
  console.log(`→ ${nombre}…`);
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${PORTADAS[nombre]}\n\n${ESTILO}`, size: '1536x1024', quality: 'high' });
    const b64 = r.data?.[0]?.b64_json; if (!b64) throw new Error('sin b64');
    await sharp(Buffer.from(b64, 'base64')).resize(1200, 540, { fit: 'cover', position: 'centre' }).jpeg({ quality: 78, mozjpeg: true }).toFile(salida);
    console.log(`  ✓ ${nombre}.jpg · ${((await fs.stat(salida)).size / 1024).toFixed(0)} KB`);
  } catch (e) { console.error(`  ✗ ${nombre}:`, e?.message || e); }
}
const lista = pedidas.length ? pedidas : Object.keys(PORTADAS);
for (let i = 0; i < lista.length; i += 4) await Promise.all(lista.slice(i, i + 4).map(una));
console.log('listo');
