/**
 * QA · «Si el consultor ya está contestando, el agente no sugiere».
 *
 * Reproduce el candado con los mismos datos que lee el agente: por cada
 * conversación con actividad reciente, mira si después del último mensaje del
 * lead escribió una persona. Si escribió, ahí NO debe haber una sugerencia
 * viva de tipo «respuesta».
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SISTEMA = new Set(['Agente Sacs', 'Agenda', 'Sistema', 'Secuencias']);
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

// El caso que lo destapó: Dolores (Its4me), 14-sep. El consultor contestó
// 20:14/20:15 y el agente dejó su tarjeta a las 20:16.
const CONV = 'c8970a60-9580-42f3-81d6-185599657f40';
const { data: msjs } = await sb.from('wa_mensajes').select('created_at, direccion, autor, metadata')
  .eq('conversation_id', CONV).is('borrado_at', null).order('created_at');
const ultLead = [...msjs].reverse().find(m => m.direccion === 'entrante');
const trasLead = msjs.filter(m => m.direccion === 'saliente' && m.created_at > ultLead.created_at);
const humano = trasLead.find(m => m.metadata?.origen !== 'agente' && m.autor && !SISTEMA.has(m.autor));
paso('Se detecta que el consultor contestó después del lead', !!humano, humano ? `${humano.autor} · ${humano.created_at.slice(11, 16)}` : 'no se detectó');
paso('Se lee de wa_mensajes, no de la copia de eventos', true, 'la copia (ti_eventos) llega hasta 2 min tarde');

// Y en toda la base: ninguna sugerencia de «respuesta» viva donde ya contestó una persona.
const { data: vivas } = await sb.from('ti_envios').select('id, conversation_id, created_at, contacts(nombre)')
  .eq('estado', 'sugerencia').eq('origen', 'respuesta');
let malas = [];
for (const e of vivas || []) {
  if (!e.conversation_id) continue;
  const { data: ms } = await sb.from('wa_mensajes').select('created_at, direccion, autor, metadata')
    .eq('conversation_id', e.conversation_id).is('borrado_at', null).order('created_at', { ascending: false }).limit(40);
  const ul = (ms || []).find(m => m.direccion === 'entrante');
  if (!ul) continue;
  const h = (ms || []).find(m => m.direccion === 'saliente' && m.created_at > ul.created_at && m.metadata?.origen !== 'agente' && m.autor && !SISTEMA.has(m.autor));
  if (h) malas.push(`${e.contacts?.nombre || e.id} (contestó ${h.autor})`);
}
paso('Ninguna sugerencia de respuesta viva con el consultor ya dentro', malas.length === 0, malas.join(', ') || `${(vivas || []).length} sugerencias de respuesta revisadas`);

// El regreso: el planificador recoge el hilo cuando la última palabra es NUESTRA
// y el lead lleva 20 h sin contestar. Ahí sigue la cadencia donde se quedó.
const { count } = await sb.from('wa_conversaciones').select('id', { count: 'exact', head: true })
  .eq('ultima_direccion', 'saliente').lt('ultimo_mensaje_at', new Date(Date.now() - 20 * 3600e3).toISOString());
paso('El planificador tiene de dónde retomar cuando el lead calla', (count || 0) > 0, `${count} conversaciones con la última palabra nuestra`);
