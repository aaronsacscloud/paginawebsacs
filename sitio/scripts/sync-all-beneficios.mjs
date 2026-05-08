// Sincroniza beneficios a la lista canónica (solo activos/herramientas, sin
// duplicar la compensación). Detecta items deprecados (que repiten % comisión
// o bonos) y los reemplaza con la lista limpia.

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
  { icon: 'gift',      title: 'Plan Fideliza gratis · sistema SACS completo', detail: 'Te activamos una cuenta SACS en plan Fideliza para usar en tu propio negocio: POS, inventario multi-sucursal, e-commerce, CRM, lealtad, marketing. Costo público: $14,000 MXN/año. Para ti: gratis durante toda tu participación.', value_label: 'Vale $14,000 MXN/año · Gratis' },
  { icon: 'link',      title: 'Landing personalizada con tu link único',     detail: 'Tu propia página dentro de SACS con tu nombre, foto y link único (sacscloud.com/p/tu-slug). Cada visita y registro queda atribuido automáticamente a ti — sin códigos, sin formularios extra.' },
  { icon: 'dashboard', title: 'Portal de partner con métricas en tiempo real', detail: 'Dashboard personal con visitas a tu landing, registros generados, prospectos calificados, conversiones, comisiones acumuladas y pagos liquidados — todo actualizado al instante.' },
  { icon: 'academy',   title: 'Acceso a Academia SACS y capacitaciones',     detail: 'Cursos en línea, playbooks por vertical, demos grabadas y certificación oficial de embajador. Te enviamos cada mes 3-5 palabras clave para enfocar el contenido.' },
  { icon: 'broadcast', title: 'Difusión en el canal SACS',                   detail: 'Republicamos tu contenido en nuestras redes sociales. El alcance es variable y orgánico — puede sumar miles de views adicionales según el contenido.' },
  { icon: 'calendar',  title: 'Reunión trimestral con el equipo SACS',       detail: 'Sesión cada 3 meses para compartir mejoras, casos de éxito y feedback directo con el equipo de producto y dirección.' },
  { icon: 'wallet',    title: 'Liquidación automática cada 30 días',         detail: 'Pagos de comisiones y bonos por transferencia cada 30 días con desglose detallado de cada concepto, cliente y referido — visible siempre desde tu portal.' },
];

// Títulos deprecados que sí o sí indican que el row está desactualizado.
const DEPRECATED = new Set([
  '50% de comisión por venta directa',
  'Comisión por venta',
  'Bono por prueba gratis activada',
  'Bono por demo completada',
  'Comisión por reunión agendada',
  'Comisión por reunión completada',
  'Plan Fideliza incluido',
  'Plan Fideliza gratis',
  'Pagos automáticos cada 30 días',
  'Landing page personalizada con tu link',
  'Acceso a Academia SACS y capacitaciones',
]);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const { data, error } = await supabase
  .from('partner_invitations')
  .select('id, numero, nombre, beneficios');
if (error) { console.error(error); process.exit(1); }

let synced = 0;
for (const r of data) {
  const titles = (r.beneficios || []).map(b => b.title);
  const hasDeprecated = titles.some(t => DEPRECATED.has(t));
  if (titles.length === 0) { console.log(`⏭  skip ${r.numero} (sin beneficios)`); continue; }
  if (!hasDeprecated && titles.length === CANONICAL.length) {
    console.log(`✓ skip ${r.numero} · ${r.nombre} (ya canónica)`);
    continue;
  }
  if (titles.length <= 3 && !hasDeprecated) {
    console.log(`⏭  skip ${r.numero} · ${r.nombre} (test ad-hoc)`);
    continue;
  }
  const { error: errUpd } = await supabase
    .from('partner_invitations')
    .update({ beneficios: CANONICAL })
    .eq('id', r.id);
  if (errUpd) { console.error(`✗ ${r.numero}:`, errUpd); continue; }
  console.log(`✓ sync ${r.numero} · ${r.nombre} (${titles.length} → ${CANONICAL.length} items)`);
  synced++;
}
console.log(`\nSincronizadas: ${synced}`);
