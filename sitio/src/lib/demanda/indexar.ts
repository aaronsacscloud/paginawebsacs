// DEMAND ENGINE · avisarle a los buscadores en cuanto publicamos.
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE
// Una página publicada no existe para nadie hasta que un buscador la rastrea.
// Esperar a que pase solo son de días a semanas; avisar la baja a horas. Y en
// el caso de las IAs eso es todo el asunto: **ChatGPT busca en Bing**, así que
// el camino más corto para que ChatGPT pueda citarnos es que Bing tenga la
// página indexada.
//
// DOS CAMINOS, PORQUE LOS BUSCADORES NO SE PARECEN
//  · IndexNow (Bing, Yandex, Seznam, Naver): se les avisa URL por URL y lo
//    aceptan en el momento. Es el que sirve para ChatGPT.
//  · Google: NO tiene un «avísame de esta URL» abierto —su Indexing API solo
//    admite ofertas de empleo y transmisiones en vivo—. Lo que sí se puede es
//    reenviar el sitemap, que es una invitación a volver a mirarlo. Sirve, pero
//    es más lento y más indirecto: por eso el sitemap se reenvía UNA vez al día
//    y no en cada publicación.
//
// LA ASIMETRÍA ES EL DATO ÚTIL: en Bing podemos ser rápidos; en Google hay que
// ser pacientes. Conviene saberlo antes de sacar conclusiones de una medición.
import { supabase } from '../supabase';
import { token } from './google';
import { registrar } from './handlers';
import { frenoDeSalida } from './salida';
import type { ResultadoHandler } from './tipos';

const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

const SITIO = 'https://www.sacscloud.com';
const HOST = 'www.sacscloud.com';
const PROPIEDAD = 'sc-domain:sacscloud.com';
const SITEMAPS = [`${SITIO}/sitemap-index.xml`, `${SITIO}/sitemap-demanda.xml`];

/** Los buscadores que aceptan IndexNow. Se avisa a UNO: ellos se lo reparten
 *  entre sí, así que mandarlo a los cuatro sería el mismo aviso cuatro veces. */
const INDEXNOW = 'https://api.indexnow.org/indexnow';

export type Aviso = { ok: boolean; cuantas: number; detalle: string };

/**
 * Avisa a Bing (y a los que comparten IndexNow) de hasta 10,000 URLs.
 *
 * La llave vive en `.env` y su archivo gemelo en `public/<llave>.txt`: Bing
 * descarga ese archivo para comprobar que quien avisa es dueño del dominio. Si
 * la llave del `.env` y la del archivo dejan de coincidir, los avisos empiezan
 * a rechazarse en silencio — por eso el primer paso comprueba el archivo.
 */
export async function avisarIndexNow(urls: string[]): Promise<Aviso> {
  const llave = env('INDEXNOW_KEY');
  if (!llave) return { ok: false, cuantas: 0, detalle: 'falta INDEXNOW_KEY' };
  if (!urls.length) return { ok: true, cuantas: 0, detalle: 'nada que avisar' };

  const freno = await frenoDeSalida(`avisado a Bing de ${urls.length} URL(s)`);
  if (freno) return { ok: true, cuantas: 0, detalle: freno.motivo };

  /* Comprobar el archivo de la llave ANTES de avisar. Sin esto, el día que
     alguien rote la llave del `.env` sin subir el archivo, los avisos se
     rechazan y en la bitácora solo queda un 403 sin explicación. */
  const cmp = await fetch(`${SITIO}/${llave}.txt`).catch(() => null);
  const contenido = cmp?.ok ? (await cmp.text()).trim() : '';
  if (contenido !== llave) {
    return { ok: false, cuantas: 0, detalle: `la llave de .env no coincide con ${SITIO}/${llave}.txt (¿falta desplegar?)` };
  }

  // IndexNow admite 10,000 por petición; se parte por si acaso.
  let avisadas = 0;
  const errores: string[] = [];
  for (let i = 0; i < urls.length; i += 5000) {
    const lote = urls.slice(i, i + 5000);
    const r = await fetch(INDEXNOW, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: llave, keyLocation: `${SITIO}/${llave}.txt`, urlList: lote }),
    });
    // 200 y 202 son los dos «lo recibí». 429 es «vas muy rápido», y no es un error del que haya que alarmarse.
    if (r.ok || r.status === 202) avisadas += lote.length;
    else errores.push(`${r.status} ${(await r.text()).slice(0, 80)}`);
  }

  return {
    ok: errores.length === 0,
    cuantas: avisadas,
    detalle: errores.length ? `${avisadas} avisadas · errores: ${errores.join(' | ')}` : `${avisadas} avisadas a Bing`,
  };
}

/** Reenvía los sitemaps a Google. Es lo único que Google acepta para páginas
 *  normales: su Indexing API está limitada a ofertas de empleo y transmisiones. */
export async function reenviarSitemaps(): Promise<Aviso> {
  const freno = await frenoDeSalida('reenviados los sitemaps a Google');
  if (freno) return { ok: true, cuantas: 0, detalle: freno.motivo };

  try {
    const t = await token('https://www.googleapis.com/auth/webmasters');
    const prop = encodeURIComponent(PROPIEDAD);
    let ok = 0;
    const errores: string[] = [];
    for (const sm of SITEMAPS) {
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${prop}/sitemaps/${encodeURIComponent(sm)}`,
        { method: 'PUT', headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) ok++; else errores.push(`${sm.split('/').pop()}: ${r.status}`);
    }
    return { ok: errores.length === 0, cuantas: ok, detalle: errores.length ? errores.join(' | ') : `${ok} sitemaps reenviados` };
  } catch (e: any) {
    /* El scope de escritura necesita que la cuenta de servicio sea «propietario
       o usuario completo» de la propiedad. Si alguien la baja a solo lectura,
       esto deja de funcionar y hay que decir por qué, no solo que falló. */
    return { ok: false, cuantas: 0, detalle: `Google no dejó reenviar (¿la cuenta de servicio perdió permiso de escritura en Search Console?): ${String(e?.message).slice(0, 120)}` };
  }
}

/** Cómo va la indexación según Google: cuántas URLs conoce de cada sitemap. */
export async function estadoSitemaps() {
  const t = await token('https://www.googleapis.com/auth/webmasters');
  const j: any = await (await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPIEDAD)}/sitemaps`,
    { headers: { Authorization: `Bearer ${t}` } })).json();
  return (j.sitemap || []).map((s: any) => ({
    sitemap: String(s.path || '').replace(SITIO, ''),
    urls: Number(s.contents?.[0]?.submitted || 0),
    indexadas: Number(s.contents?.[0]?.indexed || 0),
    errores: Number(s.errors || 0),
    avisos: Number(s.warnings || 0),
    descargado: s.lastDownloaded || null,
  }));
}

/**
 * Avisa de lo que el motor publicó y todavía no se ha avisado.
 *
 * Se apoya en `de_paginas.avisada_at`: así una página se avisa UNA vez, y si
 * se vuelve a publicar (cambió el texto) se avisa de nuevo. Sin esa marca, cada
 * corrida avisaría del catálogo entero y los buscadores acabarían ignorándonos
 * por ruidosos — que es la única forma de hacerse daño con esto.
 */
export async function avisarPendientes(limite = 500): Promise<Aviso> {
  const { data, error } = await supabase
    .from('de_paginas')
    .select('url, updated_at, avisada_at')
    .eq('indexable', true)
    .or('avisada_at.is.null,avisada_at.lt.updated_at')
    .limit(limite);
  if (error) return { ok: false, cuantas: 0, detalle: `no se pudo leer qué falta avisar: ${error.message}` };

  const urls = (data || []).map(p => p.url);
  if (!urls.length) return { ok: true, cuantas: 0, detalle: 'todo avisado' };

  const r = await avisarIndexNow(urls);
  if (r.cuantas > 0) {
    const ahora = new Date().toISOString();
    for (let i = 0; i < urls.length; i += 200) {
      const { error: e } = await supabase.from('de_paginas').update({ avisada_at: ahora }).in('url', urls.slice(i, i + 200));
      // Si no se marca, la próxima corrida vuelve a avisar de lo mismo. No es
      // grave una vez; es grave si pasa siempre, así que se dice.
      if (e) console.error(`[indexar] avisé pero no pude marcar: ${e.message}`);
    }
  }
  return r;
}

registrar('indexar.avisar', async (): Promise<ResultadoHandler> => {
  const bing = await avisarPendientes();
  const google = await reenviarSitemaps();
  const estado = await estadoSitemaps().catch(() => []);
  const conocidas = estado.reduce((n: number, s: any) => n + s.urls, 0);

  return {
    ok: bing.ok && google.ok,
    resumen: `Bing: ${bing.detalle} · Google: ${google.detalle}${conocidas ? ` · Google conoce ${conocidas} URLs de nuestros sitemaps` : ''}`,
    datos: { bing, google, sitemaps: estado },
  };
});
