#!/usr/bin/env node
/**
 * EL REPORTE SEMANAL A DISCORD.
 *
 * Lee la bitácora, compara la corrida de esta semana contra la anterior y
 * publica en el canal de ventas qué se movió. La comparación es el punto: un
 * número suelto no dice si lo que publicamos sirvió.
 *
 * El webhook sale de DISCORD_SEO_URL. Si no está, cae al canal general — pero
 * avisa, porque publicar esto entre los errores del servidor es la forma más
 * rápida de que nadie lo lea.
 *
 *   node scripts/seo-reportar.mjs                      # compara últimas dos corridas
 *   node scripts/seo-reportar.mjs --extra=archivo.md   # añade el parte del agente
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BITACORA = path.join(RAIZ, 'datos', 'seo-bitacora.jsonl');
const ARGS = process.argv.slice(2);
const arg = (k) => { const a = ARGS.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };

const URL_SEO = process.env.DISCORD_SEO_URL || '';
const URL_FALLBACK = process.env.DISCORD_WEBHOOK_URL || '';

function flecha(hoy, antes) {
  if (antes === null || antes === undefined) return '';
  const d = +(hoy - antes).toFixed(1);
  if (Math.abs(d) < 0.05) return ' (=)';
  return d > 0 ? ` (▲ +${d})` : ` (▼ ${d})`;
}

async function main() {
  if (!fs.existsSync(BITACORA)) { console.error('No hay bitácora todavía.'); process.exit(1); }
  const lineas = fs.readFileSync(BITACORA, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const hoy = lineas[lineas.length - 1];
  const antes = lineas.length > 1 ? lineas[lineas.length - 2] : null;
  const r = hoy.resumen || {};
  const ra = antes?.resumen || null;

  /* Qué preguntas GANAMOS y cuáles PERDIMOS respecto a la corrida anterior.
     Es lo único que contesta «¿sirvió lo que publicamos?». */
  const clave = (x) => `${x.id}|${x.modelo}`;
  const mapaAntes = new Map((antes?.resultados || []).map((x) => [clave(x), x.aparece]));
  const ganadas = hoy.resultados.filter((x) => x.aparece && mapaAntes.get(clave(x)) === false);
  const perdidas = hoy.resultados.filter((x) => !x.aparece && mapaAntes.get(clave(x)) === true);

  const L = [];
  L.push(`## 🎯 Radar de recomendación · ${hoy.semana}`);
  L.push('');
  L.push(`**Tasa de aparición:** ${r.tasa}% — ${r.con_sacs} de ${r.respuestas} respuestas${flecha(r.tasa, ra?.tasa)}`);
  L.push(`**Modelos medidos:** ${(hoy.modelos || []).join(', ')}`);
  L.push('');
  if (ganadas.length) L.push(`🟢 **Ganamos ${ganadas.length}:** preguntas ${[...new Set(ganadas.map((x) => x.id))].join(', ')}`);
  if (perdidas.length) L.push(`🔴 **Perdimos ${perdidas.length}:** preguntas ${[...new Set(perdidas.map((x) => x.id))].join(', ')}`);
  if (!ganadas.length && !perdidas.length && antes) L.push('⚪ Sin cambios respecto a la semana pasada.');
  L.push('');
  L.push(`**Quién ocupa esas respuestas:** ${(r.top_citados || []).slice(0, 8).map(([m, n]) => `${m} (${n})`).join(' · ') || '—'}`);
  const nuevos = (r.descubiertos || []).slice(0, 6).map(([m]) => m);
  if (nuevos.length) L.push(`**Nombres nuevos detectados:** ${nuevos.join(', ')}`);

  const extra = arg('extra');
  if (extra && fs.existsSync(extra)) { L.push(''); L.push(fs.readFileSync(extra, 'utf8').trim()); }

  const cuerpo = L.join('\n');
  console.log(cuerpo);

  const url = URL_SEO || URL_FALLBACK;
  if (!url) { console.error('\n⚠️  Sin DISCORD_SEO_URL ni DISCORD_WEBHOOK_URL: no se publicó.'); process.exit(2); }
  if (!URL_SEO) console.warn('\n⚠️  DISCORD_SEO_URL no está puesta: se publica en el canal general.');

  /* Discord corta en 2000 caracteres y RECHAZA el mensaje entero si se pasa —
     no lo trunca. Se parte en trozos por renglón para no perder el reporte. */
  const trozos = [];
  let buf = '';
  for (const linea of cuerpo.split('\n')) {
    if ((buf + '\n' + linea).length > 1900) { trozos.push(buf); buf = linea; }
    else buf = buf ? buf + '\n' + linea : linea;
  }
  if (buf) trozos.push(buf);

  for (const t of trozos) {
    const resp = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: t, username: 'Radar de recomendación' }),
    });
    if (!resp.ok) { console.error(`Discord ${resp.status}: ${(await resp.text()).slice(0, 200)}`); process.exit(1); }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log('\n✓ publicado en Discord');
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
