// Revisa las comparativas generadas ANTES de publicar.
//
// Lo que puede hacer daño en una comparativa pública es un dato inventado sobre
// un tercero. Tres comprobaciones automáticas, y lo que pasa las tres se
// publica; lo que no, se enseña.
const { supabase } = await import('/opt/sacs/paginawebsacs/sitio/src/lib/supabase.ts');

const { data: piezas } = await supabase.from('de_contenido')
  .select('id,slug,titulo,meta_desc,cuerpo,estado').eq('seccion', 'comparar').eq('estado', 'aprobado').order('slug');

// Todo lo que las IAs dijeron de verdad: es contra lo que se valida cada «cita».
const { data: muestras } = await supabase.from('de_ia_muestras').select('resumen_razon').eq('estado', 'ok').not('resumen_razon', 'is', null);
const dicho = (muestras || []).map(m => m.resumen_razon).join('\n');
/* El extractor de la medición a veces guarda un SALTO DE LÍNEA donde iba un
   acento («f\ncil» por «fácil»): pasa en ~12 de 95 filas al día y viene del
   modelo que resume, no de las plataformas —el texto crudo llega bien—. Para
   comparar citas hay que quitar acentos y espacios de los dos lados, o el
   revisor acusa de inventadas citas que son textuales. */
const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  /* Toda la puntuación fuera, no solo las comillas: la base guarda comillas
     CURVAS («solicitud») donde el modelo escribe rectas, y comparar con una
     lista corta de símbolos hacía fallar citas que eran textuales. Lo que se
     compara es la secuencia de letras y números; el resto es ruido tipográfico. */
  .replace(/[^a-z0-9]+/g, ' ').trim();

const PRECIOS_SACS = /\$\s?(810|1,?215|1,?890|3,?780)\b/;
const listos = [], dudosos = [];

for (const p of piezas || []) {
  const problemas = [];
  if (p.titulo.length > 53) problemas.push(`título ${p.titulo.length} > 53`);
  if ((p.meta_desc || '').length > 160) problemas.push(`meta ${p.meta_desc.length} > 160`);

  /* 1) cada «cita» tiene que existir en lo que las IAs dijeron.
     Comparar el texto completo no sirve: cuando el extractor rompe un acento no
     lo sustituye, LO PIERDE («fácil» queda como «f\ncil»), así que normalizar
     acentos tampoco alcanza — falta la letra. Se compara el TRAMO MÁS LARGO SIN
     ACENTOS de la cita, que sobrevive intacto a esa corrupción. Veinte
     caracteres seguidos de texto literal ya son prueba suficiente de que la
     cita salió de ahí y no de la imaginación del modelo. */
  const dichoN = norm(dicho);
  for (const b of p.cuerpo.filter(b => b.t === 'cita')) {
    const tramos = String(b.texto || '').split(/[áéíóúñÁÉÍÓÚÑ®©]/).map(t => norm(t)).filter(t => t.length >= 20);
    const masLargo = tramos.sort((a, c) => c.length - a.length)[0];
    if (!masLargo) { problemas.push(`cita sin tramo comprobable (demasiados acentos): «${b.texto.slice(0, 60)}…»`); continue; }
    if (!dichoN.includes(masLargo)) problemas.push(`cita NO encontrada en la base: «${b.texto.slice(0, 70)}…»`);
  }
  // 2) ningún precio que no sea de Sacs
  const texto = JSON.stringify(p.cuerpo);
  for (const m of texto.matchAll(/\$\s?[\d.,]{2,}/g)) {
    if (!PRECIOS_SACS.test(m[0])) problemas.push(`precio ajeno a Sacs: ${m[0]}`);
  }
  // 3) señal de honestidad: cuántos «Pregúntalo» hay en la tabla
  const pregunt = (texto.match(/Pregúntalo/g) || []).length;
  const palabras = texto.split(/\s+/).length;

  const linea = `${p.slug.padEnd(30)} ${String(palabras).padStart(4)}p · ${(p.cuerpo.filter(b => b.t === 'cita')).length} citas · ${pregunt} «Pregúntalo»`;
  if (problemas.length) { dudosos.push(p); console.log(`  DUDA  ${linea}\n${problemas.map(x => '          ' + x).join('\n')}`); }
  else { listos.push(p); console.log(`  ok    ${linea}`); }
}

console.log(`\n  ${listos.length} listas para publicar · ${dudosos.length} con dudas`);
if (process.argv.includes('--publicar') && listos.length) {
  const { publicar } = await import('/opt/sacs/paginawebsacs/sitio/src/lib/demanda/publicar.ts');
  for (const p of listos) {
    try { const r = await publicar(p.id, 'comparativas generadas, revisadas'); console.log(`  publicada: ${r.url}`); }
    catch (e) { console.log(`  no se pudo publicar ${p.slug}: ${e.message}`); }
  }
}
process.exit(0);
