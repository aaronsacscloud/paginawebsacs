/**
 * El CSS del chat no puede llevar acentos graves.
 *
 * El CSS del módulo vive dentro de un template literal (const CSS = ...), así
 * que UN acento grave suelto en un comentario cierra la cadena y parte el
 * archivo entero. Ya pasó CUATRO veces, en tres sesiones distintas. El síntoma
 * es un error de compilación críptico —"Invalid assignment target", "Expected
 * ;"— que señala una línea sin nada raro a la vista, porque el problema está
 * decenas de líneas más arriba.
 *
 * Escribir nombres de clase entre acentos graves es el reflejo de cualquiera
 * acostumbrado a Markdown, y por eso vuelve a pasar. Esto lo convierte en un
 * fallo inmediato y con nombre en vez de una tarde de bisect. Dentro del CSS
 * se usan comillas dobles.
 *
 * Correr:  node --experimental-strip-types src/components/admin/crm/equipo/css-sin-backticks.test.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** Los archivos del módulo que llevan su CSS en un template literal. */
const CON_CSS = ['ui.tsx', 'EquipoFlotante.tsx'];

let ok = 0; const fallas: string[] = [];

for (const archivo of CON_CSS) {
  const fuente = readFileSync(join(AQUI, archivo), 'utf8');
  const marca = 'const CSS = `';
  const i = fuente.indexOf(marca);
  if (i < 0) { fallas.push(`${archivo}: no encontré el bloque de CSS`); continue; }
  const ini = i + marca.length;
  const fin = fuente.indexOf('`;', ini);
  if (fin < 0) { fallas.push(`${archivo}: el bloque de CSS no cierra`); continue; }
  const n = fuente.slice(ini, fin).split('`').length - 1;
  if (n === 0) { ok++; continue; }
  fallas.push(`${archivo}: hay ${n} acento(s) grave(s) DENTRO del CSS. Cierran el template literal y parten el archivo. Usa comillas dobles en los comentarios.`);
}

if (fallas.length) { console.error(`\n✗ ${fallas.length} falla(s):\n  ` + fallas.join('\n  ') + '\n'); process.exit(1); }
console.log(`✓ CSS sin acentos graves — ${ok} archivo(s) revisado(s)`);
