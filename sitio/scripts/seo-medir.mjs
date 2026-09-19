#!/usr/bin/env node
/**
 * MEDIDOR DE VISIBILIDAD EN AGENTES
 *
 * Le hace las preguntas objetivo a varios modelos y registra tres cosas por
 * pregunta y por modelo: ¿aparece Sacs?, ¿en qué posición de la respuesta?, y
 * —la más útil— ¿a quién cita? Esa tercera columna es la que dice dónde hay
 * que estar, y es la única que convierte esto en un plan y no en una corazonada.
 *
 * Por qué se mide y no se supone: el 19-sep-2026 medimos «mejor punto de venta
 * para boutique de ropa en México» y salieron nueve competidores con página
 * dedicada al giro. Sacs, cero menciones. Sin ese número, cualquier plan de
 * contenido es opinión.
 *
 * El resultado se APILA en `datos/seo-bitacora.jsonl` — una línea por corrida.
 * Nunca se sobrescribe: la gracia es poder comparar la semana 40 contra la 38 y
 * ver si lo que publicamos movió algo. Un medidor que solo guarda el último
 * estado no puede contestar «¿sirvió?».
 *
 *   node scripts/seo-medir.mjs                  # todas las preguntas
 *   node scripts/seo-medir.mjs --solo=13,16     # unas cuantas
 *   node scripts/seo-medir.mjs --modelo=claude  # un solo modelo
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PREGUNTAS_JSON = path.join(RAIZ, 'datos', 'seo-preguntas.json');
const BITACORA = path.join(RAIZ, 'datos', 'seo-bitacora.jsonl');

const ARGS = process.argv.slice(2);
const arg = (k) => { const a = ARGS.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };

/* Las marcas que contamos como «nosotros». Sacs aparece escrito de varias
   formas en el mundo real y buscar solo «Sacs» a secas daría falsos negativos
   con «SACS Cloud» y falsos positivos con cualquier palabra que lo contenga. */
const NOSOTROS = [/\bsacscloud\b/i, /\bsacs\s*cloud\b/i, /\bsacs\b(?!\w)/i];

/* Competidores conocidos, medidos el 19-sep-2026. La lista NO es para
   vigilarlos: es para saber quién ocupa cada respuesta y con qué contenido, que
   es lo que dice dónde hay hueco. Se amplía sola con `descubiertos`. */
const RIVALES = ['SICAR', 'SIFO', 'Multicomercio', 'Syska', 'Pulpos', 'Clip', 'Alegra',
    'Bsale', 'CORE', 'Kordata', 'UpSeller', 'Sizes and Colors', 'Profitar', 'MeliSync',
    'Mecalux', 'Sage', 'Clavei', 'ClickBalance', 'MrPeasy', 'Shopify', 'Odoo', 'Zoho'];

const MODELOS = {
    claude: {
        env: 'ANTHROPIC_API_KEY',
        async preguntar(q, key) {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: 1200, messages: [{ role: 'user', content: q }] }),
            });
            if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
            const j = await r.json();
            return (j.content || []).map((c) => c.text || '').join('\n');
        },
    },
    gpt: {
        env: 'OPENAI_API_KEY',
        async preguntar(q, key) {
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
                body: JSON.stringify({ model: 'gpt-4o', max_tokens: 1200, messages: [{ role: 'user', content: q }] }),
            });
            if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
            const j = await r.json();
            return j.choices?.[0]?.message?.content || '';
        },
    },
    gemini: {
        env: 'GEMINI_API_KEY',
        async preguntar(q, key) {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: q }] }] }),
            });
            if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
            const j = await r.json();
            return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
        },
    },
};

/** ¿Aparecemos, y qué tan arriba? La posición importa: que te mencionen en el
 *  último párrafo no es lo mismo que abrir la respuesta. */
function analizar(texto) {
    const t = String(texto || '');
    const idx = NOSOTROS.map((re) => t.search(re)).filter((i) => i >= 0);
    const aparece = idx.length > 0;
    const pos = aparece ? Math.min(...idx) : null;
    const citados = RIVALES.filter((m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t));
    /* Marcas que NO están en la lista pero aparecen con forma de nombre propio.
       Así la lista de rivales crece sola en vez de quedarse congelada el día que
       se escribió. */
    const descubiertos = [...new Set((t.match(/\b[A-Z][A-Za-z0-9]{3,}\b/g) || []))]
        .filter((w) => !RIVALES.some((r) => r.toLowerCase() === w.toLowerCase()))
        .filter((w) => !/^(México|Mexico|CFDI|POS|ERP|SAT|IVA|SKU|Para|Este|Estos|Puedes|También|Además|Como|Cuando|Sistema|Software|Punto|Venta|Inventario|Tienda|Ropa|Talla|Precio|Cliente|Producto|Control|Gestión|Negocio|Opciones|Características|Ventajas|Recomendación|Conclusión|Nota|Importante)$/i.test(w))
        .slice(0, 12);
    return { aparece, pos, citados, descubiertos, largo: t.length };
}

async function main() {
    if (!fs.existsSync(PREGUNTAS_JSON)) {
        console.error(`Falta ${PREGUNTAS_JSON}. Créalo con las preguntas objetivo.`);
        process.exit(1);
    }
    const catalogo = JSON.parse(fs.readFileSync(PREGUNTAS_JSON, 'utf8'));
    const solo = arg('solo') ? new Set(arg('solo').split(',').map((s) => s.trim())) : null;
    const preguntas = catalogo.preguntas.filter((p) => !solo || solo.has(String(p.id)));

    const soloModelo = arg('modelo');
    const activos = Object.entries(MODELOS)
        .filter(([nombre]) => !soloModelo || nombre === soloModelo)
        .filter(([, cfg]) => {
            if (process.env[cfg.env]) return true;
            console.warn(`  (sin ${cfg.env}: se salta ese modelo)`);
            return false;
        });

    if (!activos.length) { console.error('No hay ningún modelo con llave disponible.'); process.exit(1); }

    const corrida = {
        cuando: new Date().toISOString(),
        semana: semanaISO(new Date()),
        modelos: activos.map(([n]) => n),
        resultados: [],
    };

    for (const p of preguntas) {
        for (const [nombre, cfg] of activos) {
            let out = null, err = null;
            try { out = await cfg.preguntar(p.texto, process.env[cfg.env]); }
            catch (e) { err = String(e.message || e).slice(0, 180); }
            const a = out ? analizar(out) : { aparece: false, pos: null, citados: [], descubiertos: [], largo: 0 };
            corrida.resultados.push({ id: p.id, nivel: p.nivel, modelo: nombre, error: err, ...a });
            const marca = err ? '✗ ' + err.slice(0, 40) : (a.aparece ? `✓ pos ${a.pos}` : '—');
            console.log(`  ${String(p.id).padStart(2)} ${nombre.padEnd(7)} ${marca.padEnd(22)} citan: ${a.citados.slice(0, 5).join(', ') || '—'}`);
            await new Promise((r) => setTimeout(r, 700));   // no atropellar las APIs
        }
    }

    const total = corrida.resultados.length;
    const conNosotros = corrida.resultados.filter((r) => r.aparece).length;
    corrida.resumen = {
        respuestas: total,
        con_sacs: conNosotros,
        tasa: total ? +(conNosotros * 100 / total).toFixed(1) : 0,
        top_citados: contar(corrida.resultados.flatMap((r) => r.citados)).slice(0, 12),
        descubiertos: contar(corrida.resultados.flatMap((r) => r.descubiertos)).slice(0, 12),
    };

    fs.mkdirSync(path.dirname(BITACORA), { recursive: true });
    fs.appendFileSync(BITACORA, JSON.stringify(corrida) + '\n');

    console.log('\n══ resumen ══');
    console.log(`  respuestas medidas : ${total}`);
    console.log(`  con Sacs           : ${conNosotros}  (${corrida.resumen.tasa}%)`);
    console.log(`  más citados        : ${corrida.resumen.top_citados.map(([m, n]) => `${m}(${n})`).join('  ')}`);
    console.log(`\n  apilado en ${path.relative(RAIZ, BITACORA)}`);
    console.log(JSON.stringify({ __resumen: corrida.resumen, semana: corrida.semana }));
}

function contar(arr) {
    const m = {};
    for (const x of arr) m[x] = (m[x] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function semanaISO(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-S${String(Math.ceil(((t - a) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
