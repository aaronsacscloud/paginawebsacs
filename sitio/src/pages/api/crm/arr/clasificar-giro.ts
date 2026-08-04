// POST /api/crm/arr/clasificar-giro — deduce a qué se dedica cada cliente
// leyendo su catálogo de productos, con IA.
//
// Body: { company_ids?: string[], limite?: number, aplicar?: boolean }
//   · sin company_ids  → toma las que no tienen giro (las más grandes primero)
//   · aplicar: false   → PROPONE y no guarda (default). true → escribe el giro.
//
// POR QUÉ AQUÍ SÍ IA, cuando el resto del sistema es determinista: clasificar un
// negocio leyendo "Blusa dama manga larga", "Jeans skinny", "Vestido casual" es
// un problema difuso, con datos sucios y sin lista cerrada de entradas — justo
// donde un modelo gana y una regla de keywords pierde (media docena de reglas
// clasificarían "Playera CLUB AMERICA" como deportes en vez de ropa).
//
// Lo que NO se le delega: la decisión final. Toda clasificación se guarda con su
// confianza y su evidencia, y las de baja confianza quedan `giro_confirmado=false`
// para que un humano las valide antes de que nadie venda sobre ellas.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { anthropic, MODELS, calculateCost } from '../../../../lib/ai/client';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();

// Taxonomía CERRADA. Sin ella el modelo inventa una etiqueta distinta por
// cliente ("boutique", "ropa de dama", "moda femenina") y no se puede agrupar
// para comparar contra pares, que es justo para lo que sirve el giro.
const GIROS = [
  'Ropa y accesorios', 'Calzado', 'Joyería y relojería', 'Belleza y cuidado personal',
  'Farmacia y salud', 'Abarrotes y minisúper', 'Alimentos preparados y restaurante',
  'Panadería y tortillería', 'Carnicería y pescadería', 'Ferretería y construcción',
  'Papelería y librería', 'Muebles y decoración', 'Electrónica y cómputo',
  'Deportes', 'Juguetería', 'Mascotas y veterinaria', 'Refacciones y automotriz',
  'Agropecuario', 'Textil y mercería', 'Regalos y novedades', 'Servicios y taller',
  'Merchandising y eventos', 'Otro',
];

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const aplicar = !!body?.aplicar;
  const limite = Math.min(40, Number(body?.limite) || 15);

  // A quién clasificar: lo pedido, o las que no tienen giro y más facturan
  // (donde el dato rinde más pronto).
  let q = supabase.from('companies')
    .select('id, nombre, sacs_account, giro, actividad')
    .is('archived_at', null).not('sacs_account', 'is', null);
  if (Array.isArray(body?.company_ids) && body.company_ids.length) q = q.in('id', body.company_ids);
  else q = q.or('giro.is.null,giro.eq.');
  const { data: empresas, error } = await q.range(0, 999);
  if (error) return json({ error: error.message }, 500);

  const objetivo = (empresas || [])
    .sort((a: any, b: any) => Number(b.actividad?.total_30d || 0) - Number(a.actividad?.total_30d || 0))
    .slice(0, limite);
  if (!objetivo.length) return json({ ok: true, mensaje: 'No hay empresas por clasificar.', data: [] });

  // 1 · Evidencia: una muestra del catálogo real de cada cuenta.
  const cuentas = objetivo.map((c: any) => String(c.sacs_account).trim().toLowerCase());
  let muestras: Record<string, any> = {};
  try {
    const res = await fetch(SACS_API + '/interno/crm/muestra-catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ accounts: cuentas, limite: 40 }),
    });
    if (!res.ok) return json({ error: 'SACS respondió ' + res.status + ' al pedir el catálogo.' }, 502);
    muestras = (await res.json()).data || {};
  } catch (e: any) { return json({ error: 'No se pudo leer el catálogo: ' + (e?.message || e) }, 502); }

  // 2 · Una sola llamada al modelo con todas las cuentas: clasificar 15 negocios
  //     en una pasada cuesta una fracción de 15 llamadas y el resultado es más
  //     consistente (ve los casos juntos y no se contradice entre ellos).
  const entradas = objetivo.map((c: any) => {
    const m = muestras[String(c.sacs_account).trim().toLowerCase()] || {};
    return {
      cuenta: c.sacs_account,
      nombre_negocio: c.nombre,
      total_productos: m.total_productos ?? null,
      categorias: (m.categorias || []).slice(0, 10),
      marcas: (m.marcas || []).slice(0, 8),
      productos: (m.productos || []).slice(0, 30),
    };
  }).filter(e => (e.productos || []).length || (e.categorias || []).length);

  if (!entradas.length) return json({ ok: true, mensaje: 'Ninguna cuenta devolvió catálogo.', data: [] });

  const prompt = `Eres analista de un ERP para comercios en México. Para cada cuenta te doy una MUESTRA de su catálogo de productos (nombres, categorías y marcas). Deduce a qué se dedica el negocio.

Elige el giro ÚNICAMENTE de esta lista:
${GIROS.map(g => '- ' + g).join('\n')}

Reglas:
- Clasifica por lo que VENDE, no por cómo se llama el negocio. Un nombre puede mentir; el catálogo no.
- Si el catálogo es ambiguo o mezcla giros sin uno dominante, usa "Otro" y baja la confianza.
- confianza: 0 a 1. Menos de 0.7 significa "que lo revise un humano".
- evidencia: 3 a 6 palabras citando lo que te hizo decidir (productos o categorías reales de la muestra).

Devuelve SOLO un arreglo JSON, sin texto alrededor:
[{"cuenta":"...","giro":"...","confianza":0.0,"evidencia":"..."}]

Cuentas:
${JSON.stringify(entradas, null, 1)}`;

  let propuestas: any[] = [];
  let uso: any = null;
  try {
    const r = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const txt = r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = txt.match(/\[[\s\S]*\]/);           // el modelo a veces envuelve en ```json
    propuestas = m ? JSON.parse(m[0]) : [];
    uso = calculateCost(MODELS.sonnet, r.usage as any);
  } catch (e: any) {
    return json({ error: 'La clasificación falló: ' + (e?.message || e) }, 502);
  }

  // 3 · Cruzar con las empresas y (opcionalmente) guardar.
  const porCuenta: Record<string, any> = {};
  for (const c of objetivo) porCuenta[String(c.sacs_account).trim().toLowerCase()] = c;

  const salida: any[] = [];
  for (const p of propuestas) {
    const c = porCuenta[String(p?.cuenta || '').trim().toLowerCase()];
    if (!c) continue;
    const giro = GIROS.includes(p.giro) ? p.giro : 'Otro';   // el modelo no inventa etiquetas
    const conf = Math.max(0, Math.min(1, Number(p.confianza) || 0));
    const fila = { company_id: c.id, cuenta: c.sacs_account, nombre: c.nombre, giro, confianza: conf, evidencia: String(p.evidencia || '').slice(0, 200), guardado: false };
    if (aplicar) {
      const { error: ue } = await supabase.from('companies').update({
        giro,
        giro_confianza: conf,
        giro_evidencia: fila.evidencia,
        // Solo se da por buena sola cuando el modelo está seguro; lo demás espera
        // confirmación humana antes de que alguien venda sobre ese dato.
        giro_confirmado: conf >= 0.85,
        giro_at: new Date().toISOString(),
      }).eq('id', c.id);
      fila.guardado = !ue;
    }
    salida.push(fila);
  }

  return json({
    ok: true, aplicado: aplicar, modelo: MODELS.sonnet,
    costo_usd: uso?.cost_usd ?? null, tokens: uso ? { in: uso.input_tokens, out: uso.output_tokens } : null,
    clasificadas: salida.length,
    alta_confianza: salida.filter(s => s.confianza >= 0.85).length,
    data: salida.sort((a, b) => b.confianza - a.confianza),
  });
};
