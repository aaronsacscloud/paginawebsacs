// Avisa a Bing (y a quienes comparten IndexNow: Yandex, Seznam, Naver) de TODAS
// las páginas fijas del sitio.
//
// Por qué hace falta: `avisarIndexNow` solo se dispara cuando el motor de
// demanda publica algo en /recursos, /comparar o /software-para. Las páginas
// que viven en el repo —los 24 giros, las 28 de producto, las 6 en inglés, las
// herramientas— nunca se le avisaron a nadie: se descubren cuando el buscador
// pasa solo, que tarda de días a semanas. Y esto importa más de lo que parece
// porque ChatGPT busca en Bing: mientras Bing no tenga la página, ChatGPT no
// la puede citar.
//
// Correr:  node --env-file=.env scripts/indexnow-paginas-fijas.mjs
// Repetirlo no hace daño: IndexNow acepta el mismo aviso varias veces.
const SITIO = 'https://www.sacscloud.com';
const llave = (process.env.INDEXNOW_KEY || '').trim();
if (!llave) { console.error('Falta INDEXNOW_KEY en el entorno'); process.exit(1); }

const comprobacion = await fetch(`${SITIO}/${llave}.txt`);
if (!comprobacion.ok || (await comprobacion.text()).trim() !== llave) {
  console.error('El archivo de la llave no coincide con INDEXNOW_KEY: Bing rechazaría el aviso.');
  process.exit(1);
}

const xml = await (await fetch(`${SITIO}/sitemap-0.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
console.log(`${urls.length} URLs en el sitemap del build`);

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'www.sacscloud.com', key: llave, keyLocation: `${SITIO}/${llave}.txt`, urlList: urls }),
});
console.log('IndexNow respondió', r.status, r.status === 200 || r.status === 202 ? '(aceptado)' : await r.text());
