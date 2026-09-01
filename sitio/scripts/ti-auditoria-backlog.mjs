// TRABAJO INTELIGENTE · La auditoría del backlog — el arranque aprobado:
// «la IA audita TODO el backlog y propone por lotes; el dueño aprueba por
// lote y el día 1 arranca limpio».
//
// Corre LOCAL (no en Vercel: leer 52 conversaciones + 52 llamadas a Claude
// no cabe en una función). Lee el CRM, arma el expediente de cada lead
// (conversación de WhatsApp completa + actividades), le pide veredicto a
// Claude y guarda la propuesta en ti_backlog. NO toca a los leads: solo
// propone — la ejecución viene después de la aprobación por lote.
//
//   cd sitio && node scripts/ti-auditoria-backlog.mjs           # audita
//   node scripts/ti-auditoria-backlog.mjs --solo-reporte        # reimprime
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

// .env de sitio/ (el script corre fuera de Vite: se lee a mano)
for (const linea of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
// La ANTHROPIC_API_KEY no vive en el .env de este repo: se lee de su casa
// (sacs_api/.env) al vuelo, sin crear copias nuevas del secreto.
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const m = readFileSync('/opt/sacs/sacs_api/.env', 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].trim();
  } catch { /* sin acceso: el constructor de Anthropic avisará */ }
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODELO = 'claude-opus-5';
const soloReporte = process.argv.includes('--solo-reporte');
const reparar = process.argv.includes('--reparar');

const dias = iso => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;

async function expediente(c) {
  const [conv, acts] = await Promise.all([
    supabase.from('wa_conversaciones').select('id').eq('contact_id', c.id).limit(3),
    supabase.from('activities').select('tipo, titulo, descripcion, created_at')
      .eq('contact_id', c.id).order('created_at', { ascending: false }).limit(12),
  ]);
  let mensajes = [];
  for (const cv of conv.data || []) {
    const { data: msjs } = await supabase.from('wa_mensajes')
      .select('direccion, cuerpo, created_at').eq('conversation_id', cv.id)
      .order('created_at', { ascending: true }).limit(40);
    mensajes = mensajes.concat(msjs || []);
  }
  return { mensajes, actividades: acts.data || [] };
}

function armarPrompt(c, exp) {
  const attr = c.propiedades?.atribucion?.primer_toque || {};
  const charla = exp.mensajes.map(m =>
    `[${String(m.created_at).slice(0, 10)}] ${m.direccion === 'in' ? 'LEAD' : 'nosotros'}: ${String(m.cuerpo || '(media)').slice(0, 300)}`).join('\n') || '(sin conversación de WhatsApp)';
  const acts = exp.actividades.map(a =>
    `[${String(a.created_at).slice(0, 10)}] ${a.tipo}: ${a.titulo || ''} ${String(a.descripcion || '').slice(0, 150)}`).join('\n') || '(sin actividades)';
  return `Eres el analista comercial de Sacscloud (software de punto de venta e inventario para comercios en México). Audita este lead viejo del CRM y decide su destino para el arranque del nuevo sistema de seguimiento.

LEAD: ${c.nombre || ''} ${c.apellido || ''}
- Estatus: ${c.estatus_lead} · etapa: ${c.lifecycle_stage} · entró hace ${dias(c.created_at)} días
- Último toque nuestro: ${c.last_contact_at ? `hace ${dias(c.last_contact_at)} días` : 'NUNCA'}
- Canales: ${c.whatsapp ? 'WhatsApp' : ''} ${c.email ? 'correo' : ''}
- Vino de: ${attr.fuente || '?'} · ${attr.campana || ''} ${attr.contenido || ''}
- Reuniones: ${c.reuniones_total || 0}

CONVERSACIÓN DE WHATSAPP (completa, en orden):
${charla}

ACTIVIDADES RECIENTES:
${acts}

Responde ÚNICAMENTE el objeto JSON, sin una sola palabra antes ni después, con esta forma exacta:
{"propuesta":"revivir|nutricion|descartar","razon":"una frase con la evidencia","angulo":"si revivir: el ángulo concreto del primer mensaje (qué le dolía, qué preguntó); si no, null"}

Criterios:
- REVIVIR: hay señal real (respondió con interés, preguntó precio, pidió demo, dejó conversación a medias, cotizado). Vale la pena un toque humano con ángulo.
- NUTRICION: datos válidos y sin negativa, pero nunca mostró señal — que lo trabaje la secuencia automática de largo plazo.
- DESCARTAR: pidió que no lo contacten, datos falsos/rotos, no es prospecto (busca empleo, spam, ya es cliente, número equivocado).
Sé estricto con REVIVIR: revivir a todos es no priorizar a nadie.`;
}

async function auditar() {
  const { data: leads } = await supabase.from('contacts')
    .select('id, nombre, apellido, estatus_lead, lifecycle_stage, created_at, last_contact_at, whatsapp, email, propiedades, reuniones_total')
    .in('lifecycle_stage', ['lead', 'lead_calificado']).is('archived_at', null)
    .order('created_at', { ascending: true });
  console.log(`Leads vivos: ${leads.length}`);

  // --reparar: solo re-audita las filas que salieron rotas (JSON inválido o
  // razón vacía) — típicamente por truncado de max_tokens en la 1ª corrida.
  let soloIds = null;
  if (reparar) {
    const { data: malas } = await supabase.from('ti_backlog').select('contact_id, razon')
      .or('razon.eq.,razon.like.*JSON válido*');
    soloIds = new Set((malas || []).map(x => x.contact_id));
    console.log(`Reparando ${soloIds.size} filas rotas…`);
  }
  let n = 0;
  for (const c of leads) {
    if (soloIds && !soloIds.has(c.id)) continue;
    // Los frescos (nuevos <7 días) no se auditan: van al flujo normal.
    if (c.estatus_lead === 'nuevo' && dias(c.created_at) < 7) {
      await supabase.from('ti_backlog').upsert({ contact_id: c.id, propuesta: 'fresco', razon: `Entró hace ${dias(c.created_at)} días — va al flujo normal, no al arranque.` });
      continue;
    }
    const exp = await expediente(c);
    const r = await anthropic.messages.create({
      model: MODELO, max_tokens: 900,
      messages: [{ role: 'user', content: armarPrompt(c, exp) }],
    });
    const texto = r.content.find(b => b.type === 'text')?.text || '{}';
    let v;
    try { v = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)); }
    catch { v = { propuesta: 'nutricion', razon: 'La IA no dio JSON válido — revisar a mano.', angulo: null }; }
    if (!['revivir', 'nutricion', 'descartar'].includes(v.propuesta)) v.propuesta = 'nutricion';
    await supabase.from('ti_backlog').upsert({
      contact_id: c.id, propuesta: v.propuesta, razon: String(v.razon || '').slice(0, 500),
      angulo: v.angulo ? String(v.angulo).slice(0, 500) : null,
      evidencia: { mensajes: exp.mensajes.length, actividades: exp.actividades.length, estatus: c.estatus_lead, dias: dias(c.created_at), modelo: MODELO },
    });
    n++;
    process.stdout.write(`\r${n} auditados…`);
  }
  console.log('\nlisto.');
}

async function reporte() {
  const { data } = await supabase.from('ti_backlog')
    .select('propuesta, razon, angulo, contact_id, contacts(nombre, apellido, estatus_lead)')
    .order('propuesta');
  const por = {};
  for (const x of data || []) (por[x.propuesta] = por[x.propuesta] || []).push(x);
  for (const [lote, filas] of Object.entries(por)) {
    console.log(`\n══ ${lote.toUpperCase()} · ${filas.length} ══`);
    for (const f of filas) {
      const c = f.contacts || {};
      console.log(`· ${(c.nombre || '') + ' ' + (c.apellido || '')} [${c.estatus_lead}] — ${f.razon}${f.angulo ? `\n    ángulo: ${f.angulo}` : ''}`);
    }
  }
}

if (!soloReporte) await auditar();
await reporte();
