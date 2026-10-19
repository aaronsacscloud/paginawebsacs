// Fotos horizontales (16:10) de los plugins para el menú de Plataforma en escritorio y «Más plugins» (19-oct-2026).
// Las de menu-*.webp son verticales (360×440, para el menú del teléfono) y en la tarjeta horizontal se perdían las
// caras. Staff, AXO y Administración salen de fotos que ya tiene el sitio; MCP no tenía una ancha y se hace con
// gpt-image-2 (OPENAI_API_KEY). Salida: public/images/plugins/menu-<slug>-ancha.webp (800×500).
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IMG = path.join(SITIO, 'public/images');
const sharp = (await import('sharp')).default;
const recorta = (src, dst, pos) => sharp(path.join(IMG, src)).resize(800, 500, { fit: 'cover', position: pos }).webp({ quality: 84 }).toFile(path.join(IMG, 'plugins', dst));

await recorta('plugins/staff/portada-1280.webp', 'menu-staff-ancha.webp', 'top');   // con aire sobre la cabeza
await recorta('automatiza/axo-1280.webp', 'menu-axo-ancha.webp', 'centre');
await recorta('plugins/administracion/portada-1280.webp', 'menu-administracion-ancha.webp', 'right');

const mcp = path.join(IMG, 'plugins/menu-mcp-ancha.webp');
try { await fs.access(mcp); console.log('✓ skip mcp'); } catch (e) {
  const r = await new OpenAI().images.generate({
    model: 'gpt-image-2', size: '1536x1024', quality: 'high',
    prompt: 'Editorial fashion photograph, wide shot: a 35-year-old Mexican woman in a cobalt blue tailored suit and white top walks along a tree-lined boutique street in Mexico City (Polanco), holding a coffee cup in one hand and speaking to her smartphone held near her face (voice assistant), confident smile. Morning sun through the trees, soft shadows, shop windows with clothing softly out of focus. She is in the right third of the frame, head and body fully visible with space above her head. Shot on 35mm, shallow depth of field, natural skin texture, no AI gloss. No legible text, no logos, the phone screen is not visible.',
  });
  // la persona queda chica en el cuadro completo: se acerca el encuadre a ella (≈ x 38–100 %, y 12–77 %)
  const img = sharp(Buffer.from(r.data[0].b64_json, 'base64'));
  await img.extract({ left: 538, top: 146, width: 998, height: 624 }).resize(800, 500).webp({ quality: 84 }).toFile(mcp);
}
console.log('Listo.');
