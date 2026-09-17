// DEMAND ENGINE · las reglas técnicas.
//
// Razona sobre lo que el rastreo ya trajo; no sale a la red. Esa separación es
// lo que permite estrenar una regla nueva sobre las 120 páginas sin volver a
// pedirle nada al servidor, y es también lo que hace que este archivo sea
// barato de correr todos los días.
//
// Cada hallazgo entra a `de_issues` con una clave determinista, así que una
// página que lleva tres semanas sin meta descripción es UN problema abierto, no
// veintiún avisos repetidos. Y lo que se arregla se cierra solo: si en la
// siguiente corrida la regla ya no lo detecta, el problema pasa a resuelto sin
// que nadie tenga que acordarse.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import type { ResultadoHandler } from './tipos';

export type Hallazgo = {
  tipo: string;
  severidad: 'critica' | 'alta' | 'media' | 'baja';
  url: string;
  detalle: Record<string, any>;
};

/** Los límites son los que Google recorta en la práctica, no los del manual. */
const TITULO_MAX = 60, TITULO_MIN = 15, META_MAX = 160, META_MIN = 70, DELGADA = 300;

export function reglas(paginas: any[]): Hallazgo[] {
  const h: Hallazgo[] = [];
  const porTitulo = new Map<string, string[]>();
  const porMeta = new Map<string, string[]>();

  for (const p of paginas) {
    const url = p.url;

    // ── Lo que impide que la página exista para un buscador ────────────────
    if (p.estado_http && p.estado_http >= 400)
      h.push({ tipo: 'estado_http', severidad: 'critica', url, detalle: { estado: p.estado_http } });

    // Estar en el sitemap y pedir que no te indexen es contradecirse: el
    // sitemap dice «mírame» y la etiqueta dice «ignórame».
    // Solo es contradicción si la página SIGUE en el sitemap. Una que salió y
    // además pide noindex es simplemente coherente.
    if (p.indexable === false && p.en_sitemap !== false)
      h.push({ tipo: 'noindex_en_sitemap', severidad: 'alta', url, detalle: { robots: 'noindex' } });

    /* A partir de aquí, TODO son reglas sobre cómo se ve la página en un
       buscador. Si la página pide no ser indexada, ninguna aplica: el título,
       la meta y el H1 existen para el resultado de búsqueda, y esa página no va
       a tener resultado de búsqueda.

       Sin este corte, la lista se llenaba de trabajo imposible: cuatro de los
       siete hallazgos de severidad media eran `/app/dashboard` y `/app/inbox`
       —pantallas de la aplicación que acababan de ponerse en `noindex`
       precisamente porque no son contenido— pidiendo un H1 y una meta
       descripción que no sirven para nada.

       Mandar a alguien a escribirle una meta descripción al inbox de la
       aplicación es gastarle el rato en algo que, si lo hace bien, no cambia
       nada. Y una lista con trabajo inútil deja de leerse entera. */
    // Fuera del sitemap o con noindex: ninguna regla de buscador aplica.
    if (p.indexable === false || p.en_sitemap === false) continue;

    // ── Título ─────────────────────────────────────────────────────────────
    if (!p.titulo) h.push({ tipo: 'sin_titulo', severidad: 'alta', url, detalle: {} });
    else {
      if (p.titulo.length > TITULO_MAX)
        h.push({ tipo: 'titulo_largo', severidad: 'baja', url, detalle: { largo: p.titulo.length, titulo: p.titulo } });
      if (p.titulo.length < TITULO_MIN)
        h.push({ tipo: 'titulo_corto', severidad: 'media', url, detalle: { largo: p.titulo.length, titulo: p.titulo } });
      const k = p.titulo.trim().toLowerCase();
      porTitulo.set(k, [...(porTitulo.get(k) || []), url]);
    }

    // ── Meta descripción ───────────────────────────────────────────────────
    // Sin meta, Google inventa el resumen con lo que encuentre en la página.
    // No es un error técnico: es ceder el texto que decide si te dan clic.
    if (!p.meta_desc) h.push({ tipo: 'sin_meta', severidad: 'media', url, detalle: {} });
    else {
      if (p.meta_desc.length > META_MAX)
        h.push({ tipo: 'meta_larga', severidad: 'baja', url, detalle: { largo: p.meta_desc.length } });
      if (p.meta_desc.length < META_MIN)
        h.push({ tipo: 'meta_corta', severidad: 'baja', url, detalle: { largo: p.meta_desc.length } });
      const k = p.meta_desc.trim().toLowerCase();
      porMeta.set(k, [...(porMeta.get(k) || []), url]);
    }

    // ── Estructura ─────────────────────────────────────────────────────────
    if (!p.h1) h.push({ tipo: 'sin_h1', severidad: 'media', url, detalle: {} });

    if (p.palabras != null && p.palabras < DELGADA && p.indexable !== false)
      h.push({ tipo: 'contenido_delgado', severidad: 'media', url, detalle: { palabras: p.palabras } });

    // Una página indexable a la que nadie enlaza le dice a Google que ni
    // nosotros la consideramos importante.
    if (p.huerfana && p.indexable !== false)
      h.push({ tipo: 'huerfana', severidad: 'alta', url, detalle: {} });

    if (!p.enlaces_out)
      h.push({ tipo: 'sin_enlaces_salientes', severidad: 'baja', url, detalle: {} });

    // ── Canónica y datos estructurados ─────────────────────────────────────
    if (!p.canonical)
      h.push({ tipo: 'sin_canonical', severidad: 'baja', url, detalle: {} });
    else if (normaliza(p.canonical) !== normaliza(url))
      h.push({ tipo: 'canonical_distinta', severidad: 'alta', url, detalle: { apunta_a: p.canonical } });

    // Sin datos estructurados una IA tiene que adivinar qué es esta página.
    // Para el objetivo de ser citados, eso pesa más que en SEO clásico.
    if (!p.schema_tipos?.length && p.indexable !== false)
      h.push({ tipo: 'sin_schema', severidad: 'media', url, detalle: {} });
  }

  // ── Duplicados: se reportan UNA vez, en el grupo ─────────────────────────
  for (const [titulo, urls] of porTitulo) {
    if (urls.length > 1)
      h.push({ tipo: 'titulo_duplicado', severidad: 'alta', url: urls[0], detalle: { titulo, paginas: urls } });
  }
  for (const [meta, urls] of porMeta) {
    if (urls.length > 1)
      h.push({ tipo: 'meta_duplicada', severidad: 'media', url: urls[0], detalle: { paginas: urls } });
  }

  return h;
}

const normaliza = (u: string) => String(u || '').replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '').toLowerCase();

export async function auditar(): Promise<{ abiertos: number; nuevos: number; resueltos: number; por_severidad: Record<string, number> }> {
  const { data: paginas } = await supabase.from('de_paginas')
    .select('url, titulo, h1, meta_desc, canonical, estado_http, indexable, en_sitemap, palabras, huerfana, enlaces_out, schema_tipos')
    .not('rastreada_at', 'is', null);

  const hallazgos = reglas(paginas || []);
  const vistas = new Set(hallazgos.map(x => `${x.tipo}:${x.url}`));
  const ahora = new Date().toISOString();

  // Lo que sigue apareciendo se refresca; lo nuevo se abre.
  let nuevos = 0;
  for (let i = 0; i < hallazgos.length; i += 300) {
    const bloque = hallazgos.slice(i, i + 300).map(x => ({
      clave_idem: `${x.tipo}:${x.url}`,
      tipo: x.tipo, severidad: x.severidad, url: x.url, detalle: x.detalle,
      estado: 'abierto', visto_ultima: ahora,
    }));
    const { data, error } = await supabase.from('de_issues')
      .upsert(bloque, { onConflict: 'clave_idem' }).select('id, detectado_at');
    if (error) throw new Error(`[tecnico] no se pudieron guardar los hallazgos: ${error.message}`);
    nuevos += (data || []).filter(d => d.detectado_at >= ahora).length;
  }

  /* Lo que YA NO aparece se cierra solo. Sin esto, un problema arreglado se
     queda abierto para siempre y la cola pierde el sentido: el día que tenga
     doscientas filas viejas nadie la va a volver a abrir.

     PERO SOLO LO SUYO. `de_issues` la comparten varios detectores —el técnico,
     el de Search Console, el de decaimiento, el de competidores— y esta función
     solo sabe reconocer lo que ella misma produce. Sin el filtro por tipo,
     cerraba todo lo demás por no encontrarlo en SUS hallazgos.

     Pasó de verdad y en el peor momento: los 15 huecos frente a competidores y
     los 3 subdominios indexados —incluido `dev.sacscloud.com`, un entorno de
     desarrollo abierto a Google— quedaron marcados como «resueltos» treinta
     segundos después de crearse. Sin error, sin aviso: el hallazgo más valioso
     del día, borrado por una limpieza que creía que la tabla era suya.

     La regla general: una función que limpia una tabla compartida tiene que
     declarar qué le pertenece. Si no, lo que limpia es el trabajo de los demás. */
  const MIOS = [
    'estado_http', 'sin_titulo', 'titulo_corto', 'titulo_largo', 'titulo_duplicado',
    'sin_meta', 'meta_corta', 'meta_larga', 'meta_duplicada',
    'sin_h1', 'contenido_delgado', 'huerfana', 'sin_enlaces_salientes',
    'sin_canonical', 'canonical_distinta', 'sin_schema', 'noindex_en_sitemap',
  ];
  const { data: abiertos } = await supabase.from('de_issues')
    .select('id, clave_idem').eq('estado', 'abierto').in('tipo', MIOS);
  const aCerrar = (abiertos || []).filter(i => !vistas.has(i.clave_idem)).map(i => i.id);
  if (aCerrar.length) {
    for (let i = 0; i < aCerrar.length; i += 300) {
      await supabase.from('de_issues')
        .update({ estado: 'resuelto', resuelto_at: ahora })
        .in('id', aCerrar.slice(i, i + 300));
    }
  }

  const por_severidad: Record<string, number> = {};
  for (const x of hallazgos) por_severidad[x.severidad] = (por_severidad[x.severidad] || 0) + 1;

  return { abiertos: hallazgos.length, nuevos, resueltos: aCerrar.length, por_severidad };
}

registrar('detectar.tecnico', async (): Promise<ResultadoHandler> => {
  const r = await auditar();
  const sev = Object.entries(r.por_severidad).map(([k, n]) => `${n} ${k}`).join(', ');
  return {
    ok: true,
    resumen: `${r.abiertos} problemas abiertos (${sev})${r.nuevos ? ` · ${r.nuevos} nuevos` : ''}${r.resueltos ? ` · ${r.resueltos} resueltos` : ''}`,
    datos: r,
  };
});
