/**
 * QA · «No contestadas» es TODO lo que espera respuesta, no solo WhatsApp.
 *
 * Un correo del cliente sin responder y una llamada entrante que nadie tomó
 * tienen que estar ahí: son exactamente eso — te buscaron y no contestaste.
 */
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4332';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }),
});
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
paso('Sesión', !!cookie);

const j = await fetch(`${BASE}/api/crm/whatsapp/inbox?filtro=no_leidas&limit=200`, { headers: { cookie } }).then(r => r.json());
const filas = j.conversaciones || [];
paso('La bandeja responde', Array.isArray(filas), `${filas.length} filas · contador ${j.counts?.no_leidas}`);

const correos = filas.filter(c => c.ultimo_canal === 'email' || (c.canales || []).includes('email'));
paso('Hay correos esperando respuesta', correos.length > 0,
  correos.slice(0, 3).map(c => `${c.contacto?.nombre || c.telefono}: ${String(c.ultimo_mensaje_texto || '').slice(0, 40)}`).join(' · ') || 'ninguno');
paso('Y entraron por ser del CLIENTE, no por casualidad', correos.every(c => c.ultima_direccion === 'entrante'),
  [...new Set(correos.map(c => c.ultima_direccion))].join(', '));

const perdidas = filas.filter(c => /Llamada perdida/i.test(String(c.ultimo_mensaje_texto || '')));
paso('Las llamadas perdidas también están', perdidas.length > 0,
  perdidas.map(c => c.telefono).join(' · ') || 'ninguna');

/* Y lo contrario, que es lo que protege la bandeja de llenarse de ruido: una
   llamada que SÍ se atendió —o tras la que hubo conversación— no aparece. */
const atendidas = filas.filter(c => String(c.telefono || '').includes('4442048563'));
paso('Una llamada ya atendida NO aparece', atendidas.length === 0);
