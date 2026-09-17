// DEMAND ENGINE · preguntarle a las IAs como le preguntaría un comprador.
//
// Cada plataforma se consulta CON BÚSQUEDA WEB ENCENDIDA. Es la diferencia
// entre medir lo que el modelo recuerda de su entrenamiento y medir lo que le
// contesta hoy a una persona real — que es lo único que importa para el
// objetivo. Sin búsqueda, un modelo entrenado hace un año diría lo de hace un
// año y el número sería una foto vieja disfrazada de medición.
//
// La interfaz es común a propósito: agregar una plataforma nueva es escribir
// una función, no tocar el motor.
const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

export type Plataforma = 'chatgpt' | 'gemini' | 'claude' | 'perplexity' | 'grok';

export type Respuesta = {
  plataforma: Plataforma;
  estado: 'ok' | 'no_disponible' | 'error';
  modelo?: string;
  texto: string;
  /** Las URLs que la plataforma dijo haber usado. Es la mitad del valor: dice
   *  en QUIÉN confía la IA para esta pregunta, que es dónde hay que estar. */
  citas: string[];
  motivo?: string;
  ms: number;
};

const LLAVE: Record<Plataforma, string> = {
  chatgpt: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY', grok: 'XAI_API_KEY',
};

export const plataformasDisponibles = (): Plataforma[] =>
  (Object.keys(LLAVE) as Plataforma[]).filter(p => env(LLAVE[p]).length > 0);

const sinDuplicar = (u: (string | undefined)[]) => [...new Set(u.filter((x): x is string => !!x))];

async function conTiempo<T>(f: () => Promise<T>, ms: number): Promise<T> {
  return await Promise.race([f(), new Promise<T>((_, r) => setTimeout(() => r(new Error(`sin respuesta en ${ms / 1000}s`)), ms))]);
}

/** Pregunta tal cual. Nada de instrucciones de sistema ni de contexto: se mide
 *  lo que recibe un comprador que escribe eso y nada más. Cualquier añadido
 *  nuestro contaminaría la medición. */
export async function preguntarA(plataforma: Plataforma, pregunta: string, pais = 'MX'): Promise<Respuesta> {
  const t0 = Date.now();
  const llave = env(LLAVE[plataforma]);
  if (!llave) return { plataforma, estado: 'no_disponible', texto: '', citas: [], motivo: `falta ${LLAVE[plataforma]}`, ms: 0 };

  try {
    const r = await conTiempo(() => consultar(plataforma, pregunta, llave, pais), 180_000);
    return { plataforma, estado: 'ok', ...r, ms: Date.now() - t0 };
  } catch (e: any) {
    return { plataforma, estado: 'error', texto: '', citas: [], motivo: String(e?.message || e).slice(0, 300), ms: Date.now() - t0 };
  }
}

async function consultar(p: Plataforma, q: string, llave: string, pais: string): Promise<{ texto: string; citas: string[]; modelo: string }> {
  if (p === 'chatgpt') {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5', input: q, tools: [{ type: 'web_search' }] }),
    });
    const j: any = await r.json();
    if (j.error) throw new Error(j.error.message);
    return {
      modelo: j.model || 'gpt-5',
      texto: (j.output || []).flatMap((o: any) => (o.content || []).map((c: any) => c.text || '')).join(''),
      citas: sinDuplicar((j.output || []).flatMap((o: any) => (o.content || []).flatMap((c: any) => (c.annotations || []).map((a: any) => a.url)))),
    };
  }

  if (p === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${llave}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: q }] }], tools: [{ google_search: {} }] }),
    });
    const j: any = await r.json();
    if (j.error) throw new Error(j.error.message);
    const c = j.candidates?.[0];
    return {
      modelo: 'gemini-2.5-flash',
      texto: (c?.content?.parts || []).map((x: any) => x.text || '').join(''),
      // Gemini devuelve el dominio en `title` y un redirector en `uri`; el
      // dominio es lo que sirve para saber a quién está citando.
      citas: sinDuplicar((c?.groundingMetadata?.groundingChunks || []).map((x: any) => x.web?.title || x.web?.uri)),
    };
  }

  if (p === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': llave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 2000,
        messages: [{ role: 'user', content: q }],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
      }),
    });
    const j: any = await r.json();
    if (j.error) throw new Error(j.error.message);
    return {
      modelo: j.model || 'claude-sonnet-5',
      texto: (j.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''),
      citas: sinDuplicar((j.content || []).flatMap((b: any) => (b.citations || []).map((x: any) => x.url))),
    };
  }

  if (p === 'perplexity') {
    /* ⚠️ La API cambió: `sonar` en /chat/completions ya no existe, ahora es
       `perplexity/sonar` en /v1/responses. La documentación vieja sigue
       circulando; si responde «model not supported», es esto. */
    const r = await fetch('https://api.perplexity.ai/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'perplexity/sonar', input: q }),
    });
    const j: any = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const texto = (j.output || []).flatMap((o: any) => (o.content || []).map((c: any) => c.text || '')).join('') || j.output_text || '';
    return {
      modelo: j.model || 'perplexity/sonar', texto,
      citas: sinDuplicar([
        ...(j.output || []).flatMap((o: any) => (o.content || []).flatMap((c: any) => (c.annotations || []).map((a: any) => a.url || a.uri))),
        ...(j.citations || []),
        ...(j.search_results || []).map((s: any) => s.url),
      ]),
    };
  }

  // Grok habla el dialecto de OpenAI.
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-4', messages: [{ role: 'user', content: q }],
      search_parameters: { mode: 'auto', return_citations: true, sources: [{ type: 'web', country: pais }] },
    }),
  });
  const j: any = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return { modelo: j.model || 'grok-4', texto: j.choices?.[0]?.message?.content || '', citas: sinDuplicar(j.citations || []) };
}
