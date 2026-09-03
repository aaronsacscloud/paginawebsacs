import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { briefPorToken, json } from '../../../lib/proyecto/store';

export const prerender = false;

// Subida de archivos del brief (logos, manual, fotos, catálogos).
//
// El bucket es público porque el cliente entra SIN sesión: una URL firmada
// caducaría a media captura. El candado real es el nombre del archivo, que
// lleva el id del brief y un sufijo aleatorio — no se adivina.
const MAX = 25 * 1024 * 1024;

// Ancho a propósito: un manual de identidad viene en PDF, un logo en .ai o
// .eps, y una tipografía en .otf. Rechazar por tipo MIME aquí es rechazar
// justo lo que pedimos, porque el navegador manda '' para casi todos ellos.
const EXT_OK = new Set([
  'ai','eps','svg','pdf','png','jpg','jpeg','webp','gif','psd','indd',
  'otf','ttf','woff','woff2','zip','rar',
  'xlsx','xls','csv','doc','docx','ppt','pptx','key','pages','numbers',
  'mp4','mov','webm','heic',
]);

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'Petición inválida' }, 400);

  const token = String(form.get('token') || '');
  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);
  if (!brief.firmado_at) return json({ error: 'Primero hay que firmar el brief' }, 403);

  const file = form.get('file') as File | null;
  if (!file) return json({ error: 'No llegó el archivo' }, 400);
  if (file.size > MAX) {
    return json(
      { error: 'El archivo pesa más de 25 MB. Súbelo a Drive o WeTransfer y pega el link.' },
      400,
    );
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!EXT_OK.has(ext)) return json({ error: `No admitimos archivos .${ext || '?'}` }, 400);

  const campo = String(form.get('campo') || 'otros').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const ruta = `${brief.id}/${campo}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  await supabase.storage.createBucket('proyectos', { public: true }).catch(() => {});

  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from('proyectos').upload(ruta, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) return json({ error: error.message }, 500);

  const { data } = supabase.storage.from('proyectos').getPublicUrl(ruta);
  return json({ url: data.publicUrl, nombre: file.name, peso: file.size });
};
