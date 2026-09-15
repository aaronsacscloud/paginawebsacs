/**
 * QA · «Interacción» y «Desde tu último mensaje» cuentan TODOS los canales.
 *
 * El caso que lo destapó (15-sep-2026): la ficha de Lily Contreras decía
 * «67 mensajes · hace 124 d» y «Desde tu último mensaje · hace 124 d» con un
 * correo de ESE MISMO DÍA abierto en el hilo. Los 124 días eran ciertos para el
 * WhatsApp —callado desde el 13 de mayo— y falsos para la relación, que siguió
 * por correo. Los dos renglones leían solo la fila de WhatsApp.
 *
 * Se prueba contra la base real: la fecha que sale tiene que ser la del último
 * mensaje de CUALQUIER canal, y los renglones de «desde tu último mensaje» se
 * cuentan desde ahí (con la fecha vieja listaban como nuevo un pago de meses).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE = process.env.BASE || 'http://localhost:4334';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
const dias = t => Math.round((Date.now() - Date.parse(t)) / 86400e3);

const { data: ct } = await sb.from('contacts').select('id').eq('email', 'lilibethkd84@gmail.com').maybeSingle();
const { data: wa } = await sb.from('wa_conversaciones').select('id, ultimo_mensaje_at, ultimo_saliente_at').eq('contact_id', ct.id).maybeSingle();
const { data: ec } = await sb.from('email_conversations').select('id').eq('contact_id', ct.id);
const { data: em } = await sb.from('email_messages').select('created_at, direccion')
  .in('conversation_id', (ec || []).map(c => c.id)).order('created_at', { ascending: false });
const ultimoCorreo = (em || [])[0]?.created_at;
const ultimoCorreoSal = (em || []).find(m => m.direccion === 'saliente')?.created_at;
paso('El caso sigue siendo el caso: WhatsApp viejo, correo de hoy', dias(wa.ultimo_mensaje_at) > 30 && dias(ultimoCorreo) <= 1,
  `WhatsApp hace ${dias(wa.ultimo_mensaje_at)} d · correo hace ${dias(ultimoCorreo)} d`);

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }) });
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');

// 1 · El servidor: la base del bloque «desde tu último mensaje».
const panel = await fetch(`${BASE}/api/crm/whatsapp/panel?wa_id=${wa.id}`, { headers: { cookie } }).then(r => r.json());
paso('«Desde tu último mensaje» arranca del correo, no del WhatsApp',
  panel.desde_ultimo && Math.abs(Date.parse(panel.desde_ultimo.desde) - Date.parse(ultimoCorreoSal)) < 2000,
  `dice ${panel.desde_ultimo?.desde} · el último saliente real es ${ultimoCorreoSal}`);
paso('Y por lo tanto ya no cuenta como «nuevo» lo de hace meses',
  (panel.desde_ultimo?.pagos?.n || 0) === 0, `${panel.desde_ultimo?.pagos?.n} pago(s) después de esa fecha`);
/* «Te escribió por correo» miraba la CONVERSACIÓN, y la conversación también se
   toca cuando el que escribe eres tú: el renglón salía justo después de mandarle
   un correo. Aquí el último correo es NUESTRO, así que no debe salir. */
const entrantesDespues = (em || []).filter(m => m.direccion === 'entrante' && Date.parse(m.created_at) > Date.parse(panel.desde_ultimo?.desde || 0)).length;
paso('«Te escribió por correo» solo si de verdad escribió ÉL después',
  (panel.desde_ultimo?.correos_recibidos || 0) === entrantesDespues,
  `dice ${panel.desde_ultimo?.correos_recibidos} · entrantes reales después: ${entrantesDespues}`);

// 2 · El hilo trae los dos carriles, que es lo que suma «Interacción».
const hilo = await fetch(`${BASE}/api/crm/whatsapp/hilo?id=${wa.id}`, { headers: { cookie } }).then(r => r.json());
const msjsEmail = (hilo.correos || []).flatMap(c => c.mensajes || []);
const fechas = [hilo.conversacion?.ultimo_mensaje_at, ...msjsEmail.map(m => m.created_at)]
  .filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b));
paso('El hilo trae los correos junto a los WhatsApp', msjsEmail.length > 0,
  `${hilo.mensajes?.length || 0} de WhatsApp + ${msjsEmail.length} correos`);
paso('La fecha de «Interacción» es la del mensaje más reciente de cualquier canal',
  dias(fechas[fechas.length - 1]) <= 1, `hace ${dias(fechas[fechas.length - 1])} d (antes decía ${dias(wa.ultimo_mensaje_at)})`);
