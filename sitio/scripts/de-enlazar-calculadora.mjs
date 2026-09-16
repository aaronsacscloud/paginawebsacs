// Enlaza la definición de curva de tallas con la calculadora que ya existía.
//
// Es el bucle que describe el plan: la definición captura la búsqueda («qué es
// la curva de tallas»), y la herramienta —que hasta hoy estaba en noindex y no
// podía rankear por nada— convierte a quien llega. Ninguna de las dos servía
// sola: la definición sin herramienta se lee y se va, y la herramienta sin
// definición no la encuentra nadie.
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url),'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data } = await sb.from('de_contenido').select('id, cuerpo, version').eq('clave_idem','definicion:curva-de-tallas').single();
const cuerpo = data.cuerpo;

// Se mete después del apartado de cómo armar la curva, que es donde la persona
// acaba de entender el cálculo y le falta hacerlo con sus números.
const i = cuerpo.findIndex(b => b.t === 'h2' && b.texto.startsWith('Curva, corrida'));
if (cuerpo.some(b => b.t === 'cta' && String(b.url).includes('curva-de-tallas'))) {
  console.log('ya estaba enlazada'); process.exit(0);
}
cuerpo.splice(i, 0,
  { t:'p', texto:'Si quieres verlo con tus propios números, hicimos una **[calculadora de curva de tallas](/campana/curva-de-tallas)**: metes tu venta por talla, marcas cuáles se te agotaron, y enseña cuánto cambia la sugerencia de compra según cómo se lea el dato.' },
);

await sb.from('de_contenido').update({ cuerpo, actualizado_at: new Date().toISOString() }).eq('id', data.id);
await sb.from('de_contenido_versiones').insert({ contenido_id: data.id, version: data.version, cuerpo: data.cuerpo, motivo: 'enlace a la calculadora', creada_por: 'operador' });
await sb.from('de_contenido').update({ version: data.version + 1 }).eq('id', data.id);
console.log('enlazada · versión', data.version + 1);
