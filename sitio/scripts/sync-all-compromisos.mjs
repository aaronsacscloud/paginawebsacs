// Sincroniza compromisos a la lista canónica de 6 items para todas las
// invitaciones que aún tengan items deprecados (kick-off, archivos originales,
// reporte mensual, leads 24h, sesión mensual de actualizaciones, etc.).
//
// Solo modifica rows que contengan AL MENOS UNO de los títulos deprecados —
// no toca invitaciones de prueba con copy ad-hoc.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const envText = await fs.readFile(path.join(SITIO, '.env.local'), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
  const i = l.indexOf('='); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return [l.slice(0, i).trim(), v];
}));

const CANONICAL = [
  { title: 'Cuota mínima anual de 10 sucursales',          detail: 'Mínimo 10 sucursales activas vendidas en cualquier plan durante los primeros 12 meses. Pueden ser 10 clientes con 1 sucursal cada uno, 1 cliente con 10 sucursales, o cualquier combinación. Esto es lo que hace al programa sustentable para ambos lados.', frequency: 'Anual' },
  { title: 'Generar 100 puntos al mes con contenido o acciones', detail: 'Cada mes acumulas mínimo 100 puntos en tres formas posibles: contenido publicado, acciones de promoción (demos, eventos, reseñas, intros) o actividades filantrópicas (refugios, comedores, mentorías, voluntariado). No tienes que ser sólo creador — apoyar también suma. Cada acción la subes desde tu panel de partner; sin reporte no se acreditan puntos. Si haces más de 100, el excedente se acumula al siguiente mes.', frequency: 'Mensual · 100 pts', ctaLabel: 'Ver el catálogo completo de puntos →', ctaTab: 'contenido' },
  { title: 'Reportar tu actividad en el portal',           detail: 'Subir el link, foto o evidencia de cada acción (contenido, apoyo o filantropía) desde el tab "Reportar actividad" de tu panel. Admin SACS valida y otorga los puntos.', frequency: 'Por acción' },
  { title: 'Difusión: en tus redes o las del canal SACS',  detail: 'Hay dos formas de hacer difusión y ambas suman. Publicas el contenido en tus propias redes (Instagram, TikTok, YouTube o LinkedIn) o nos envías los archivos originales para que lo publiquemos desde el canal SACS y multipliquemos el alcance. Lo importante es que se difunda — y la difusión te genera más visitas a tu link, más demos agendadas y más comisión.', frequency: 'Continuo' },
  { title: 'Cuidar la marca SACS',                         detail: 'Lo que publicas como embajador suma o resta a la marca. Producción cuidada, mensajes alineados al manual, sin polémicas innecesarias, respeto a competidores, clientes y comunidad. Si dudas, lo revisamos juntos antes de publicar.', frequency: 'Continuo' },
  { title: 'Uso correcto del logotipo y tipografías',      detail: 'Aplicar el logotipo SACS solo en su versión oficial. Respetar tipografías, paleta y guidelines del manual de marca.', frequency: 'Continuo' },
];

// Títulos que ya NO existen en la lista canónica — si una invitación tiene
// alguno de estos, está desactualizada y la sincronizamos.
const DEPRECATED = new Set([
  'Compartir archivos originales con SACS',
  'Enviarnos los archivos originales',
  'Responder a leads asignados en menos de 24 h',
  'Reporte mensual de actividad',
  'Asistir al kick-off de embajadores',
  'Sesión mensual de actualizaciones SACS',
  'Cuidar la marca SACS y construir reputación',
  'Uso correcto del logotipo',
  'Uso correcto de tipografías y guidelines',
  'Representar bien la marca SACS',
  'Generar 100 puntos al mes en contenido',
  'Reportar tus links en el portal',
  'Publicar en tus redes sociales',
]);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const { data, error } = await supabase
  .from('partner_invitations')
  .select('id, numero, nombre, compromisos');
if (error) { console.error(error); process.exit(1); }

let synced = 0;
for (const r of data) {
  const titles = (r.compromisos || []).map(c => c.title);
  const hasDeprecated = titles.some(t => DEPRECATED.has(t));
  // skip invitaciones de prueba con copy completamente ad-hoc (3 items o menos
  // y sin overlap con deprecados)
  if (titles.length === 0) continue;
  if (!hasDeprecated && titles.length === 6) {
    console.log(`✓ skip ${r.numero} · ${r.nombre} (ya canónica)`);
    continue;
  }
  if (titles.length <= 3 && !hasDeprecated) {
    console.log(`⏭  skip ${r.numero} · ${r.nombre} (test data, ${titles.length} items ad-hoc)`);
    continue;
  }
  const { error: errUpd } = await supabase
    .from('partner_invitations')
    .update({ compromisos: CANONICAL })
    .eq('id', r.id);
  if (errUpd) { console.error(`✗ ${r.numero}:`, errUpd); continue; }
  console.log(`✓ sync ${r.numero} · ${r.nombre} (${titles.length} → 6 items)`);
  synced++;
}
console.log(`\nSincronizadas: ${synced}`);
