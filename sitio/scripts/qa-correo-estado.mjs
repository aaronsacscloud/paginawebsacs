/**
 * QA · el estado del correo, visible en el hilo.
 *
 * El dueño preguntó si un correo se había mandado dos veces: veía «lo abrió y
 * dio clic» y, tres renglones abajo, «enviado, sin abrir». Eran DOS correos
 * distintos con el mismo asunto —el segundo es nuestra respuesta, que empieza
 * con «Re:»—. Lo que faltaba era la hora.
 */
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4332';
const CONV = 'e688c9f3-6de3-468b-b63e-3040638afee5';   // Lily
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }) });
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
const j = await fetch(`${BASE}/api/crm/whatsapp/hilo?id=${CONV}`, { headers: { cookie } }).then(r => r.json());
const correos = (j.eventos || []).filter(e => e.tipo === 'campana');
paso('El hilo trae los correos', correos.length >= 2, `${correos.length} correos`);
correos.slice(0, 4).forEach(e => console.log('     ·', e.detalle));
paso('Cada uno dice su hora', correos.every(e => /a las \d/.test(e.detalle)),
  correos.filter(e => !/a las \d/.test(e.detalle)).map(e => e.detalle).join(' | ') || 'todos');
paso('Se distingue el que abrió del que no', correos.some(e => /dio clic|lo abrió/.test(e.detalle)) && correos.some(e => /sin abrir/.test(e.detalle)));
paso('«Sin abrir» se lee como pendiente, no como fallo', correos.every(e => !/sin abrir/.test(e.detalle) || /todavía sin abrir/.test(e.detalle)));
