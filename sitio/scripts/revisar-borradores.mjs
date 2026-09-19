#!/usr/bin/env node
/**
 * Revisa los borradores que escribió el motor ANTES de que nadie los lea.
 *
 * No sustituye la lectura del dueño: la prepara. Lo que comprueba aquí es lo
 * que una persona no puede verificar a ojo sin abrir la base — precios exactos,
 * enlaces que existen, que la advertencia del brief se haya respetado — para
 * que quien lea pueda concentrarse en lo único que una máquina no sabe juzgar:
 * si la página de verdad contesta lo que alguien preguntaría.
 *
 * UNA LECCIÓN QUE YA COSTÓ UN FALSO POSITIVO
 * La primera versión buscaba la frase «se conecta con Instagram» para detectar
 * promesas falsas. La encontró… dentro de «No te voy a decir que "se conecta
 * con Instagram" cuando no es cierto», que es exactamente lo que queríamos que
 * dijera. Buscar la frase prohibida no sirve: hay que comprobar que la NEGACIÓN
 * esté presente, que es lo que el brief pidió.
 *
 *   node scripts/revisar-borradores.mjs
 *   node scripts/revisar-borradores.mjs --aprobar   ← los limpios pasan a «aprobado»
 */
const { supabase } = await import('../src/lib/supabase.ts');
const { PRECIOS, GUIAS, HERRAMIENTAS } = await import('../src/lib/demanda/capacidades.ts');

const PRECIOS_OK = new Set(Object.values(PRECIOS).filter(v => typeof v === 'number').map(String));
const RUTAS_OK = new Set([
  ...Object.keys(GUIAS).map(s => `/recursos/${s}/`),
  ...Object.keys(HERRAMIENTAS).map(s => `/herramientas/${s}`),
  '/contacto', '/planes', '/producto/', '/giros/', '/herramientas/', '/recursos/', '/comparar/',
]);

/* Frases de folleto. No son un error de hecho, pero son la señal más fiable de
   que el párrafo no dice nada: si una frase podría estar en el sitio de
   cualquier software, sobra. */
const RELLENO = /potencia tu negocio|solución integral|revoluciona|en el mundo actual|hoy en día más que nunca|lleva tu negocio al siguiente nivel|de la mano de la tecnología/i;

const { data: piezas } = await supabase.from('de_contenido')
  .select('id, slug, seccion, titulo, meta_desc, cuerpo, brief')
  .eq('estado', 'borrador').order('slug');

if (!piezas?.length) { console.log('  No hay borradores que revisar.'); process.exit(0); }

const limpios = [], conDudas = [];

for (const p of piezas) {
  const problemas = [];
  const txt = JSON.stringify(p.cuerpo);
  const plano = (p.cuerpo || []).map(b => b.texto || JSON.stringify(b.items || b.filas || '')).join(' ');

  // ── forma ──────────────────────────────────────────────────────────────
  if (p.titulo.length > 53) problemas.push(`título ${p.titulo.length} > 53 (la plantilla agrega « | Sacs»)`);
  if ((p.meta_desc || '').length > 160) problemas.push(`meta ${p.meta_desc.length} > 160`);
  if (/[\s,;:]$/.test(p.meta_desc || '')) problemas.push('la meta termina cortada a media frase');

  // ── precios: solo los nuestros, y solo los de verdad ───────────────────
  for (const m of txt.matchAll(/\$\s?([\d,]{3,7})/g)) {
    const n = m[1].replace(/,/g, '');
    /* Un precio que no es de Sacs suele ser un ejemplo legítimo y necesario —«una
       blusa de $450 en mostrador y $270 a revendedora»—, así que marcarlos todos
       llena la revisión de ruido: la primera versión sacó cuatro avisos de una
       página cuyos cuatro precios eran el mismo ejemplo.
       Solo importa cuando el precio se presenta como EL PRECIO DE SACS, y eso se
       reconoce porque cerca aparece la marca o el nombre de un plan. */
    const ctx = txt.slice(Math.max(0, m.index - 110), m.index + 110);
    const comoNuestro = /\bsacs\b/i.test(ctx) && /\bplan(es)?\b|vende|controla|fideliza|automatiza|mensualidad|al mes por tienda/i.test(ctx);
    if (!PRECIOS_OK.has(n) && comoNuestro) {
      problemas.push(`parece un precio DE SACS que no está en la lista: $${m[1]}`);
    }
  }

  // ── enlaces: que existan ───────────────────────────────────────────────
  for (const m of txt.matchAll(/\]\((\/[a-z0-9\/-]+)\)/g)) {
    const r = m[1];
    if (![...RUTAS_OK].some(ok => r === ok || r.startsWith(ok))) problemas.push(`enlace a una ruta que no conozco: ${r}`);
  }
  for (const b of (p.cuerpo || [])) {
    if (b.t === 'cta' && b.url && ![...RUTAS_OK].some(ok => b.url === ok || b.url.startsWith(ok))) {
      problemas.push(`la cta apunta a ${b.url}, que no está en la lista de rutas`);
    }
  }

  /* ── la advertencia del brief ──────────────────────────────────────────
     Si el brief dijo «no podemos afirmar X», la página tiene que DECIRLO, no
     solo callarlo. Callarlo deja al lector suponiendo que sí. */
  const nota = p.brief?.nota_honestidad;
  if (nota) {
    const niega = /\bno (tiene|tenemos|hay|existe|cuenta con|ofrece)\b|\bno es cierto\b|\bno te voy a decir\b|\bno prometemos\b/i.test(plano);
    if (!niega) problemas.push('el brief avisó de algo que no podemos afirmar y la página no lo aclara en ningún lado');
  }

  // ── relleno ────────────────────────────────────────────────────────────
  const m = plano.match(RELLENO);
  if (m) problemas.push(`frase de folleto: «${m[0]}»`);

  // ── que contesta algo ──────────────────────────────────────────────────
  const tiposBloque = new Set((p.cuerpo || []).map(b => b.t));
  if (!tiposBloque.has('faq')) problemas.push('sin bloque faq: es lo que más pesa para que una IA pueda citarla');
  if (!tiposBloque.has('cta')) problemas.push('sin cta al final');

  const palabras = plano.split(/\s+/).length;
  if (palabras < 600) problemas.push(`muy corta: ${palabras} palabras`);

  const linea = `${p.slug.padEnd(40)} ${String(palabras).padStart(4)}p · ${p.cuerpo.length} bloques`;
  if (problemas.length) { conDudas.push(p); console.log(`  DUDA  ${linea}`); problemas.forEach(x => console.log(`          ${x}`)); }
  else { limpios.push(p); console.log(`  ok    ${linea}`); }
}

console.log(`\n  ${limpios.length} limpios · ${conDudas.length} con dudas`);
console.log('  Lo limpio sigue necesitando que alguien lo LEA: esto comprueba hechos, no si la página sirve.');

if (process.argv.includes('--aprobar') && limpios.length) {
  for (const p of limpios) {
    const { error } = await supabase.from('de_contenido')
      .update({ estado: 'aprobado', auditorias: { automatica: { score: 10, nota: 'Precios, enlaces, honestidad y estructura comprobados. Falta lectura humana.' } } })
      .eq('id', p.id);
    console.log(`  ${error ? 'FALLÓ' : 'a «aprobado»'}: ${p.slug}`);
  }
}
process.exit(0);
