// El CRM es el que sabe: arma el prompt, ejecuta las herramientas y guarda
// la llamada. La central solo habla con él por HTTP con el secreto compartido.
import crypto from 'node:crypto';

const BASE = (process.env.CRM_BASE || 'https://www.sacscloud.com').replace(/\/$/, '');
const SECRET = (process.env.VOZ_SECRET || '').trim();

export const hayCrm = () => !!SECRET;

/** El token que viaja en el TwiML (<Parameter>): prueba que la llamada la armó nuestro CRM. */
export const tokenDe = (item) => crypto.createHmac('sha256', SECRET).update(`voz:${item}`).digest('hex').slice(0, 32);
export const tokenValido = (item, token) => {
  if (!item || !token) return false;
  try { return crypto.timingSafeEqual(Buffer.from(tokenDe(item)), Buffer.from(String(token))); } catch { return false; }
};

async function llamar(cuerpo, { timeoutMs = 12000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/api/telefonia/voz/central`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify(cuerpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`CRM ${r.status}: ${j?.error || JSON.stringify(j).slice(0, 200)}`);
    return j;
  } finally { clearTimeout(t); }
}

/** Todo lo que Fernanda necesita saber antes de hablar: system (por capas), herramientas, nombre, zona. */
export const contexto = (item, extra = {}) => llamar({ accion: 'contexto', item, ...extra });
/** Un turno dicho (del contacto o de Fernanda). Para el contacto devuelve `veredicto` (persona/buzon/portero) según las reglas del marcador. */
export const turno = (item, datos) => llamar({ accion: 'turno', item, ...datos }, { timeoutMs: 6000 });
/** Ejecuta una herramienta (consultar_horarios, agendar, guardar_dato, prometer_envio, pasar_a_humano, no_llamar). */
export const herramienta = (item, nombre, args) => llamar({ accion: 'herramienta', item, nombre, args }, { timeoutMs: 20000 });
/** Fin de la llamada desde la central: métricas de latencia, tokens, motivo. */
export const fin = (item, datos) => llamar({ accion: 'fin', item, ...datos });
/** Empuja la sesión del marcador (cierre con IA → siguiente llamada). Se llama unas veces después del fin. */
export const latir = (item) => llamar({ accion: 'latir', item }, { timeoutMs: 25000 });
