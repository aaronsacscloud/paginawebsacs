// Resuelve los imports SIN extensión del repo cuando el código se corre desde
// node en vez de Astro.
//
// En el proyecto los imports se escriben `../supabase`, porque Vite los
// resuelve solo. Node exige la extensión. Sin este puente, probar una librería
// del CRM desde la terminal es imposible, y la alternativa —probar el motor
// solo en producción— es estrenar los frenos en la carretera.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANDIDATOS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.mjs', '.js'];

export async function resolve(especificador, contexto, siguiente) {
  try {
    return await siguiente(especificador, contexto);
  } catch (e) {
    if (!especificador.startsWith('.') && !especificador.startsWith('/')) throw e;
    const base = new URL(especificador, contexto.parentURL);
    for (const c of CANDIDATOS) {
      const u = new URL(base.href + c);
      if (existsSync(fileURLToPath(u))) return siguiente(u.href, contexto);
    }
    throw e;
  }
}

/**
 * Además de resolver, TRADUCE `import.meta.env` a `process.env` al vuelo.
 *
 * En Astro, `import.meta.env` son las variables del build; en node no existe y
 * leerlo revienta. Se reescribe aquí, en el cargador, y no en los archivos:
 * son decenas de módulos del CRM y ninguno tiene por qué cambiar para que se
 * puedan probar. El script ya cargó `.env` en `process.env`, así que la
 * traducción apunta exactamente a los mismos valores.
 */
export async function load(url, contexto, siguiente) {
  const r = await siguiente(url, contexto);
  if (!/\.tsx?$/.test(url) || !r.source) return r;
  const src = r.source.toString();
  if (!src.includes('import.meta.env')) return r;
  return { ...r, source: src.replace(/import\.meta\.env/g, 'process.env') };
}
