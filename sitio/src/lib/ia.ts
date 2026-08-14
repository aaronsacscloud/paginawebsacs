// Una sola puerta para pedirle JSON a un modelo.
//
// Existe por un error real en producción: el endpoint pedía `gpt-4o-mini` a
// pelo y el proyecto de OpenAI no tenía permiso sobre ese modelo, así que
// "Acomodar con IA" moría con un 403 que hablaba de proyectos y permisos —algo
// que quien está capturando una minuta no puede resolver—. La minuta de las
// cotizaciones fallaba igual y por eso nunca se estructuraba.
//
// Aquí no se apuesta a un modelo: se intentan varios, en orden, y el primero
// que contesta gana. Si el proyecto de OpenAI no da acceso a ninguno, se pasa a
// Anthropic. Un permiso que cambia en un tablero externo no debería tumbar una
// pantalla del CRM.

type Msg = { system: string; user: string };

// El que funcionó se recuerda mientras viva la instancia: si no, cada llamada
// volvería a pagar los intentos fallidos.
let elegido: { proveedor: 'openai' | 'anthropic'; modelo: string } | null = null;

const OPENAI = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4.1', 'gpt-3.5-turbo'];
const ANTHROPIC = ['claude-sonnet-4-5', 'claude-haiku-4-5-20251001', 'claude-3-5-haiku-latest'];

/** Quita los ```json … ``` con los que algunos modelos envuelven la respuesta. */
function limpiaJSON(t: string): string {
  const s = String(t || '').trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : s).trim();
}

async function pedirOpenAI(modelo: string, { system, user }: Msg, key: string): Promise<any> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelo, temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI respondió ${r.status}`);
  return JSON.parse(limpiaJSON(j?.choices?.[0]?.message?.content || '{}'));
}

async function pedirAnthropic(modelo: string, { system, user }: Msg, key: string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: modelo, max_tokens: 4096, temperature: 0.2, system,
      // Se le pone en la boca el inicio del JSON para que no arranque con
      // "Claro, aquí tienes:" y reviente el parseo.
      messages: [{ role: 'user', content: user }, { role: 'assistant', content: '{' }],
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `Anthropic respondió ${r.status}`);
  const txt = (j?.content || []).map((c: any) => c?.text || '').join('');
  return JSON.parse(limpiaJSON('{' + txt));
}

/**
 * Pide una respuesta en JSON. Devuelve el objeto ya parseado.
 * Lanza con un mensaje en español si ningún modelo de ningún proveedor contestó.
 */
export async function pedirJSON(msg: Msg): Promise<any> {
  const ok = import.meta.env.OPENAI_API_KEY;
  const ak = import.meta.env.ANTHROPIC_API_KEY;
  if (!ok && !ak) throw new Error('No hay ninguna llave de IA configurada en el servidor.');

  if (elegido) {
    try {
      return elegido.proveedor === 'openai'
        ? await pedirOpenAI(elegido.modelo, msg, ok!)
        : await pedirAnthropic(elegido.modelo, msg, ak!);
    } catch {
      // El que servía dejó de servir (cuota, permiso revocado): se vuelve a
      // buscar desde cero en vez de fallar para siempre.
      elegido = null;
    }
  }

  const fallos: string[] = [];
  if (ok) {
    for (const m of OPENAI) {
      try { const r = await pedirOpenAI(m, msg, ok); elegido = { proveedor: 'openai', modelo: m }; return r; }
      catch (e: any) { fallos.push(`${m}: ${String(e?.message || e).slice(0, 90)}`); }
    }
  }
  if (ak) {
    for (const m of ANTHROPIC) {
      try { const r = await pedirAnthropic(m, msg, ak); elegido = { proveedor: 'anthropic', modelo: m }; return r; }
      catch (e: any) { fallos.push(`${m}: ${String(e?.message || e).slice(0, 90)}`); }
    }
  }
  // Se dice QUÉ se intentó: un "falló la IA" a secas no deja arreglar nada.
  throw new Error('Ningún modelo de IA contestó. ' + fallos.join(' · '));
}

/** Qué proveedor y modelo quedaron funcionando (para diagnóstico). */
export const modeloEnUso = () => elegido;
