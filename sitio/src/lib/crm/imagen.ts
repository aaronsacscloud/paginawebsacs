// CRM · Optimización de imágenes EN EL NAVEGADOR (nuestro "Filestack" propio).
//
// Cada contexto declara un preset con el tamaño que de verdad necesita; la
// imagen se recorta/escala en canvas y se comprime bajando calidad hasta caber
// en el presupuesto de bytes. Nada sale del navegador sin optimizar: lo que se
// sube a Storage ya pesa lo que debe.
export type PresetImagen = {
  ancho: number; alto: number;
  modo: 'cover' | 'contain';        // cover: recorta al aspecto exacto · contain: cabe completo
  mime: 'image/jpeg' | 'image/webp' | 'image/png';
  maxKB: number;                    // presupuesto: se baja calidad hasta caber
  fondo?: string;                   // contain con jpg: color de relleno
};

export const PRESETS: Record<string, PresetImagen> = {
  perfil: { ancho: 640, alto: 640, modo: 'cover', mime: 'image/jpeg', maxKB: 300 },              // foto de perfil de WhatsApp (cuadrada)
  plantilla_header: { ancho: 1200, alto: 628, modo: 'cover', mime: 'image/jpeg', maxKB: 500 },   // encabezado de plantilla (1.91:1, como og:image)
  carrusel: { ancho: 1080, alto: 566, modo: 'cover', mime: 'image/jpeg', maxKB: 400 },           // tarjeta de carrusel
  sticker: { ancho: 512, alto: 512, modo: 'contain', mime: 'image/webp', maxKB: 95 },            // sticker de WhatsApp (webp ≤100 KB)
  libre: { ancho: 1600, alto: 1600, modo: 'contain', mime: 'image/jpeg', maxKB: 800 },           // uso general: lado largo ≤1600
};

export type ImagenOptimizada = { blob: Blob; mime: string; nombre: string; ancho: number; alto: number; original_kb: number; final_kb: number };

export async function optimizarImagen(file: File, presetId: keyof typeof PRESETS | PresetImagen): Promise<ImagenOptimizada> {
  const p: PresetImagen = typeof presetId === 'string' ? PRESETS[presetId] : presetId;
  if (!p) throw new Error(`Preset desconocido: ${presetId}`);
  if (!/^image\//.test(file.type)) throw new Error('El archivo no es una imagen');

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('No se pudo leer la imagen (¿formato raro o archivo dañado?)');

  // Dimensiones destino: cover recorta al aspecto exacto; contain escala sin recortar.
  let dw = p.ancho, dh = p.alto, sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (p.modo === 'cover') {
    const escala = Math.max(p.ancho / bitmap.width, p.alto / bitmap.height);
    sw = Math.round(p.ancho / escala); sh = Math.round(p.alto / escala);
    sx = Math.round((bitmap.width - sw) / 2); sy = Math.round((bitmap.height - sh) / 2);
  } else {
    const escala = Math.min(p.ancho / bitmap.width, p.alto / bitmap.height, 1);   // nunca agrandar
    dw = Math.round(bitmap.width * escala); dh = Math.round(bitmap.height * escala);
  }

  const canvas = document.createElement('canvas');
  canvas.width = p.modo === 'contain' && p.mime === 'image/webp' ? p.ancho : dw;
  canvas.height = p.modo === 'contain' && p.mime === 'image/webp' ? p.alto : dh;
  const ctx = canvas.getContext('2d')!;
  if (p.mime === 'image/jpeg') { ctx.fillStyle = p.fondo || '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.imageSmoothingEnabled = true; (ctx as any).imageSmoothingQuality = 'high';
  const ox = Math.round((canvas.width - dw) / 2), oy = Math.round((canvas.height - dh) / 2);
  ctx.drawImage(bitmap, sx, sy, sw, sh, ox, oy, dw, dh);
  bitmap.close();

  // Comprimir bajando calidad hasta caber en maxKB (png no tiene calidad: se convierte).
  const mime = p.mime === 'image/png' ? 'image/png' : p.mime;
  let blob: Blob | null = null;
  for (const q of [0.86, 0.78, 0.68, 0.58, 0.48, 0.38]) {
    blob = await new Promise<Blob | null>(res => canvas.toBlob(res, mime, q));
    if (!blob) throw new Error('El navegador no pudo codificar la imagen');
    if (blob.size <= p.maxKB * 1024) break;
  }
  if (!blob) throw new Error('No se pudo codificar la imagen');
  if (blob.size > p.maxKB * 1024 * 1.5) throw new Error(`La imagen quedó en ${Math.round(blob.size / 1024)} KB y el máximo es ${p.maxKB} KB: usa una imagen más sencilla`);

  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const base = (file.name || 'imagen').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 40) || 'imagen';
  return { blob, mime, nombre: `${base}.${ext}`, ancho: canvas.width, alto: canvas.height, original_kb: Math.round(file.size / 1024), final_kb: Math.round(blob.size / 1024) };
}

/** Sube (imagen ya optimizada o archivo tal cual) vía URL firmada y devuelve la URL pública. */
export async function subirAStorage(blob: Blob, nombre: string, mime: string, carpeta = 'general'): Promise<string> {
  const firma = await fetch('/api/crm/subir-imagen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, mime, carpeta }),
  }).then(r => r.json());
  if (firma?.error || !firma?.signed_url) throw new Error(firma?.error || 'No se pudo preparar la subida');
  const up = await fetch(firma.signed_url, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
  if (!up.ok) throw new Error(`La subida falló (HTTP ${up.status})`);
  return firma.public_url as string;
}
