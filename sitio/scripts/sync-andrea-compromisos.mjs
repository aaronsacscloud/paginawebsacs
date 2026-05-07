// One-off: sincroniza los compromisos del row de Andrea (PA-003) con la lista
// "limpia" actual del programa. Hace UPDATE sobre la columna compromisos JSON.
//
// Ejecutar: node scripts/sync-andrea-compromisos.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
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

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('Falta SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const ANDREA_ID = '1262da1f-7bac-415e-8f36-90b488b65e28';

const COMPROMISOS = [
  { title: 'Cuota mínima anual de 10 sucursales',          detail: 'Mínimo 10 sucursales activas vendidas en cualquier plan durante los primeros 12 meses. Pueden ser 10 clientes con 1 sucursal cada uno, 1 cliente con 10 sucursales, o cualquier combinación. Esto es lo que hace al programa sustentable para ambos lados.', frequency: 'Anual' },
  { title: 'Generar 100 puntos al mes con contenido o acciones', detail: 'Cada mes acumulas mínimo 100 puntos en tres formas posibles: contenido publicado, acciones de promoción (demos, eventos, reseñas, intros) o actividades filantrópicas (refugios, comedores, mentorías, voluntariado). No tienes que ser sólo creador — apoyar también suma. Cada acción la subes desde tu panel de partner; sin reporte no se acreditan puntos. Si haces más de 100, el excedente se acumula al siguiente mes.', frequency: 'Mensual · 100 pts', ctaLabel: 'Ver el catálogo completo de puntos →', ctaTab: 'contenido' },
  { title: 'Reportar tu actividad en el portal',           detail: 'Subir el link, foto o evidencia de cada acción (contenido, apoyo o filantropía) desde el tab "Reportar actividad" de tu panel. Admin SACS valida y otorga los puntos.', frequency: 'Por acción' },
  { title: 'Difusión: en tus redes o las del canal SACS',  detail: 'Hay dos formas de hacer difusión y ambas suman. Publicas el contenido en tus propias redes (Instagram, TikTok, YouTube o LinkedIn) o nos envías los archivos originales para que lo publiquemos desde el canal SACS y multipliquemos el alcance. Lo importante es que se difunda — y la difusión te genera más visitas a tu link, más demos agendadas y más comisión.', frequency: 'Continuo' },
  { title: 'Cuidar la marca SACS',                         detail: 'Lo que publicas como embajador suma o resta a la marca. Producción cuidada, mensajes alineados al manual, sin polémicas innecesarias, respeto a competidores, clientes y comunidad. Si dudas, lo revisamos juntos antes de publicar.', frequency: 'Continuo' },
  { title: 'Uso correcto del logotipo y tipografías',      detail: 'Aplicar el logotipo SACS solo en su versión oficial. Respetar tipografías, paleta y guidelines del manual de marca.', frequency: 'Continuo' },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const { data: before, error: errSel } = await supabase
  .from('partner_invitations')
  .select('id, numero, nombre, compromisos')
  .eq('id', ANDREA_ID)
  .single();
if (errSel) { console.error('select error:', errSel); process.exit(1); }
console.log(`Antes: ${before.numero} · ${before.nombre} · ${before.compromisos?.length ?? 0} compromisos`);

const { error: errUpd } = await supabase
  .from('partner_invitations')
  .update({ compromisos: COMPROMISOS })
  .eq('id', ANDREA_ID);
if (errUpd) { console.error('update error:', errUpd); process.exit(1); }

const { data: after } = await supabase
  .from('partner_invitations')
  .select('compromisos')
  .eq('id', ANDREA_ID)
  .single();
console.log(`Después: ${after.compromisos.length} compromisos`);
console.log('✓ Andrea sincronizada con la lista limpia');
