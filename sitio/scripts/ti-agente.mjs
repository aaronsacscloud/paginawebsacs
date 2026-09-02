// TRABAJO INTELIGENTE · el interruptor del AGENTE SDR (N2: auto con veto).
//   node scripts/ti-agente.mjs --estado
//   node scripts/ti-agente.mjs --on            # responde a leads reales (con ventana de veto)
//   node scripts/ti-agente.mjs --off           # kill-switch: nada nuevo se propone ni se despacha
//   node scripts/ti-agente.mjs --veto 10       # minutos de ventana antes de que salga solo
//   node scripts/ti-agente.mjs --modo sombra|vivo   # sombra (default): decide y registra, NO manda ni crea tareas
//   node scripts/ti-agente.mjs --prueba +5215512345678     # agrega un teléfono al carril de pruebas (recibe el flujo completo aunque esté en sombra)
//   node scripts/ti-agente.mjs --quitar-prueba +52...      # lo quita
//   node scripts/ti-agente.mjs --factor 60                 # reloj de silencio acelerado para pruebas (60 = horas→minutos)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data } = await sb.from('ti_config').select('valor').eq('id', 1).maybeSingle();
const v = data?.valor || {};
const i = process.argv.indexOf('--veto');
if (process.argv.includes('--on')) v.agente_activo = true;
if (process.argv.includes('--off')) v.agente_activo = false;
if (i > 0) v.agente_veto_min = Math.max(0, Number(process.argv[i + 1]) || 10);
const pr = process.argv.indexOf('--prueba'); if (pr > 0 && process.argv[pr + 1]) { v.agente_prueba_telefonos = [...new Set([...(v.agente_prueba_telefonos || []), process.argv[pr + 1].replace(/[^\d+]/g, '')])]; }
const qp = process.argv.indexOf('--quitar-prueba'); if (qp > 0 && process.argv[qp + 1]) { const d = process.argv[qp + 1].replace(/\D/g, ''); v.agente_prueba_telefonos = (v.agente_prueba_telefonos || []).filter(x => x.replace(/\D/g, '') !== d); }
const fc = process.argv.indexOf('--factor'); if (fc > 0) v.agente_prueba_factor = Math.max(1, Number(process.argv[fc + 1]) || 60);
const j = process.argv.indexOf('--modo'); if (j > 0 && ['sombra', 'vivo'].includes(process.argv[j + 1])) v.agente_modo = process.argv[j + 1];
if (process.argv.includes('--on') || process.argv.includes('--off') || i > 0 || j > 0 || pr > 0 || qp > 0 || fc > 0) await sb.from('ti_config').update({ valor: v }).eq('id', 1);
// El interruptor de la pantalla de automatizaciones (wa_automatizaciones.agente_sdr) va sincronizado: activa = encendido Y modo vivo.
if (process.argv.includes('--on') || process.argv.includes('--off') || j > 0) await sb.from('wa_automatizaciones').upsert({ clave: 'agente_sdr', nombre: 'Agente SDR (Trabajo Inteligente)', categoria: 'leads', activa: v.agente_activo === true && v.agente_modo === 'vivo' }, { onConflict: 'clave' });
const [{ count: pend }, { count: env }, { count: vet }] = await Promise.all([
  sb.from('ti_envios').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
  sb.from('ti_envios').select('id', { count: 'exact', head: true }).eq('estado', 'enviado'),
  sb.from('ti_envios').select('id', { count: 'exact', head: true }).eq('estado', 'vetado'),
]);
console.log(`pruebas: ${(v.agente_prueba_telefonos || []).join(', ') || 'ninguno'} · factor ${v.agente_prueba_factor || 60}×`);
console.log(`agente: ${v.agente_activo ? 'ENCENDIDO' : 'APAGADO'} · modo ${v.agente_modo || 'sombra'} · ventana de veto: ${v.agente_veto_min ?? 10} min · envíos pendientes ${pend} · enviados ${env} · vetados ${vet}`);
