// TRABAJO INTELIGENTE · Ejecutar el arranque APROBADO por el dueño (2026-09-01):
// los 9 REVIVIR reciben su tarea con el ángulo redactado y entran a cadencia
// (T2: si el ángulo no revive la charla, llamada a los 2 días); los 39 de
// NUTRICIÓN quedan aprobados sin acción. Nada se envía solo.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const MS_D = 86400e3, OFF = 6 * 3600e3;
const diaLocal = d => new Date(d.getTime() - OFF).getUTCDay();
// +2 días hábiles a las 16:00 CDMX
function llamadaEnDosDias() {
  const l = new Date(Date.now() - OFF + 2 * MS_D);
  l.setUTCHours(16, 0, 0, 0);
  let r = new Date(l.getTime() + OFF);
  while ([0, 6].includes(diaLocal(r))) r = new Date(r.getTime() + MS_D);
  return r.toISOString();
}
const ahora = new Date().toISOString();

const { data: lote } = await supabase.from('ti_backlog')
  .select('contact_id, propuesta, razon, angulo, contacts(id, nombre, apellido, whatsapp, email, owner_id, company_id)')
  .in('propuesta', ['revivir', 'nutricion']).eq('estado', 'propuesto');

let rev = 0, nut = 0;
for (const b of lote || []) {
  if (b.propuesta === 'nutricion') {
    await supabase.from('ti_backlog').update({ estado: 'aprobado' }).eq('contact_id', b.contact_id);
    nut++; continue;
  }
  const c = b.contacts;
  const nombre = String(c.nombre || 'el lead').trim().split(/\s+/)[0];
  // 1) La tarea del reenganche — el ángulo como borrador, dispara el humano.
  await supabase.from('ti_tareas').insert({
    contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id,
    familia: 'contactar', tipo: 'wa_libre', prioridad: 2, vence_at: ahora,
    origen: 'manual', payload: {
      instruccion: `Revive a ${nombre} — la conversación quedó a medias`,
      nombre: c.nombre, whatsapp: c.whatsapp, email: c.email,
      razon: b.razon, mensaje: b.angulo, reciclado: true,
    },
  });
  // 2) A cadencia en T2: si el ángulo no revive la charla, llamada en 2 días.
  await supabase.from('ti_cadencias').upsert({
    contact_id: c.id, paso: 'T2', estado: 'activa',
    siguiente_at: llamadaEnDosDias(), iniciada_at: ahora,
  }, { onConflict: 'contact_id', ignoreDuplicates: true });
  // 3) Sus secuencias automáticas se detienen (candado anti-doble-toque).
  await supabase.from('crm_secuencia_miembros')
    .update({ detenida_at: ahora, motivo: 'cadencia_humana' })
    .eq('contact_id', c.id).is('detenida_at', null);
  await supabase.from('ti_backlog').update({ estado: 'ejecutado' }).eq('contact_id', b.contact_id);
  rev++;
}
console.log(`revividos: ${rev} · nutrición aprobada: ${nut}`);
