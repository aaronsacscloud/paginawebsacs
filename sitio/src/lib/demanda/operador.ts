// DEMAND ENGINE · el puente al operador de código.
//
// El motor encuentra 105 cosas mal en el sitio y **no puede arreglar ninguna**:
// están en archivos `.astro` del repositorio, y el motor corre en Vercel, donde
// el código fuente no existe. Ese hueco es el que este archivo cierra.
//
// El reparto de conocimiento es la decisión central, y es lo que evita que las
// órdenes de trabajo salgan inútiles:
//
//   · **El motor sabe QUÉ está mal** — qué URLs, qué regla, con qué gravedad.
//     Eso lo midió rastreando el sitio de verdad.
//   · **El operador sabe DÓNDE están los archivos** — corre dentro del repo,
//     puede mirar el disco y comprobar que el archivo existe.
//
// Si el motor intentara adivinar rutas de archivo desde Vercel, produciría
// órdenes que apuntan a archivos que no existen — y una orden así no cuesta
// cero: cuesta el rato de quien la lee antes de descubrir que estaba mal.
//
// Y una segunda separación que importa igual: **no todo hallazgo es código**.
// Una meta descripción corta en `/recursos/algo` la arregla el propio motor
// regenerando contenido; en `/producto/algo` hay que editar un `.astro`.
// Mandar la primera al operador es mandarlo a editar un archivo inexistente.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { encolar } from './cola';
import { traerTodo } from './paginar';
import type { ResultadoHandler } from './tipos';

/** Cómo se explica cada regla a quien la va a arreglar.
 *
 *  El `por_que` no es adorno: un operador que sabe POR QUÉ importa toma mejores
 *  decisiones cuando el caso concreto no encaja con la regla — y siempre hay
 *  casos que no encajan. Sin el porqué, o lo aplica a ciegas o lo ignora. */
const REGLAS: Record<string, { titulo: string; por_que: string; hecho_cuando: string }> = {
  sin_meta: {
    titulo: 'Páginas sin meta descripción',
    por_que: 'Sin meta, el buscador inventa el resumen tomando el primer texto que encuentra — y en estas páginas ese texto suele ser el menú. Un modelo que cita la página también lee la meta primero.',
    hecho_cuando: 'Cada página tiene `description` en su BaseLayout, entre 120 y 158 caracteres, escrita para esa página y no copiada de otra.',
  },
  meta_corta: {
    titulo: 'Meta descripciones demasiado cortas',
    por_que: 'Debajo de 120 caracteres se desperdicia el espacio que el buscador sí iba a enseñar, y casi siempre significa que la frase no llega a decir qué se hace ahí.',
    hecho_cuando: 'Cada `description` llega a 120-158 caracteres diciendo algo que no esté ya en el título.',
  },
  meta_larga: {
    titulo: 'Meta descripciones demasiado largas',
    por_que: 'Pasadas ~158 caracteres el buscador corta a media frase. Lo que se pierde suele ser el final, que es donde estaba la razón para hacer clic.',
    hecho_cuando: 'Cada `description` baja de 158 caracteres SIN perder lo que la hacía útil: se recorta el relleno, no el argumento.',
  },
  sin_h1: {
    titulo: 'Páginas sin H1',
    por_que: 'El H1 es lo que un modelo usa para decidir de qué trata la página cuando la cita. Sin él tiene que inferirlo del `<title>`, que está escrito para otra cosa.',
    hecho_cuando: 'Cada página tiene exactamente un `<h1>` que dice de qué trata en lenguaje del ramo.',
  },
  titulo_corto: {
    titulo: 'Títulos demasiado cortos',
    por_que: 'Un título de tres palabras compite contra otros que dicen de qué van. No es cuestión de largo: es que le falta el qué o el para quién.',
    hecho_cuando: 'El `title` llega a 30-60 caracteres e incluye qué es y para quién.',
  },
  titulo_largo: {
    titulo: 'Títulos demasiado largos',
    por_que: 'Pasados ~60 caracteres el buscador corta, y lo que se corta es el final — donde suele estar «| Sacs» o la parte diferenciadora.',
    hecho_cuando: 'El `title` baja de 60 caracteres conservando lo que distingue la página.',
  },
  subdominio_indexado: {
    titulo: 'Subdominios rankeando que nadie gestiona',
    por_que: 'Aparecen en Search Console bajo nuestro dominio y no son contenido del sitio. Dos casos que ya salieron: `dev.sacscloud.com` responde 200 sin noindex ni robots.txt —un entorno de desarrollo abierto a Google, que además puede enseñar estado interno— y `ww.sacscloud.com`, con una w de menos, sirve contenido y se lleva clics que eran del sitio bueno.',
    hecho_cuando: 'Cada subdominio tiene una decisión tomada y escrita: se le pone `noindex` y `robots.txt`, se redirige al dominio bueno, o se deja indexado a propósito y se anota por qué. Ojo: los subdominios de clientes son decisión comercial, no técnica — puede que el cliente SÍ quiera aparecer.',
  },
  decaimiento: {
    titulo: 'Páginas que pierden visibilidad más rápido que el sitio',
    por_que: 'Una página que traía gente y dejó de traerla es la oportunidad más barata que hay: ya está escrita, indexada y enlazada. Y no tiene síntoma — simplemente deja de aparecer. La comparación es contra el movimiento del PROPIO sitio, así que una caída aquí no es la temporada: es esa página.',
    hecho_cuando: 'Para cada página: se actualiza con lo que hoy busca la gente, o se decide que su consulta ya no existe y se retira. Mirar primero qué consultas perdió en Search Console, no reescribir a ciegas.',
  },
  contenido_delgado: {
    titulo: 'Páginas con muy poco texto',
    por_que: 'Una página de 200 palabras no responde nada completo, así que ni se posiciona ni se cita. Ojo: el arreglo NO es rellenar — es que la página conteste de verdad lo que promete, o que deje de estar en el índice.',
    hecho_cuando: 'Para cada página, UNA de tres cosas: (1) pasa de 600 palabras útiles porque de verdad tiene algo que decir; (2) se le pone `noindex` porque nunca fue una página de contenido —una pantalla de la aplicación, un formulario, un acuse—; o (3) se retira y se anota por qué. Rellenar para pasar el número es hacer el problema invisible sin resolverlo.',
  },
};

/** Los hallazgos que NO son trabajo de repositorio. */
async function esContenidoDelMotor(url: string): Promise<boolean> {
  const m = url.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/?#]+)/);
  if (!m) return false;
  const { data } = await supabase.from('de_contenido')
    .select('id').eq('seccion', m[1]).eq('slug', m[2]).eq('estado', 'publicado').maybeSingle();
  return !!data;
}

/* La regla cuenta palabras y no puede distinguir una página flaca de una que
   NUNCA debió indexarse. Esa distinción la tiene que hacer una persona, pero el
   motor sí puede SEÑALAR las sospechosas por su ruta, que es lo que evita que
   alguien se ponga a escribirle 600 palabras al inbox de la aplicación.

   Salió de un caso real: la primera tanda de órdenes mandaba a engordar
   `/app/dashboard` y `/app/inbox` —once palabras cada una, que son pantallas de
   producto— y `/bienvenida`, que es el acuse de «tu cuenta fue creada». */
const RUTAS_QUE_NO_SON_CONTENIDO: { patron: RegExp; porque: string }[] = [
  { patron: /^\/app(\/|$)/,        porque: 'pantalla de la aplicación' },
  { patron: /^\/registro(\/|$)/,   porque: 'formulario' },
  { patron: /^\/bienvenida(\/|$)/, porque: 'acuse transaccional' },
  { patron: /^\/(acuse|minuta|cotizacion|propuesta|reporte|estado-cuenta|pagar)(\/|$)/, porque: 'página transaccional con token' },
  { patron: /^\/(admin|partner)(\/|$)/, porque: 'aplicación interna' },
];

/* Los patrones van ANCLADOS al inicio de la ruta, y no es un detalle: la
   primera versión usaba `/\/bienvenida/` sin anclar y marcaba
   `/blog/bienvenida/` —un artículo del blog de 255 palabras— como acuse
   transaccional. Es decir, proponía sacar del índice un artículo.

   Un falso positivo aquí es peor que un falso negativo: lo segundo deja una
   página flaca sin arreglar, lo primero esconde contenido bueno. Se compara
   contra la RUTA y no contra la URL completa por lo mismo. */
function sospechaNoIndexar(url: string): string | null {
  let ruta: string;
  try { ruta = new URL(url).pathname; } catch { ruta = url; }
  return RUTAS_QUE_NO_SON_CONTENIDO.find(r => r.patron.test(ruta))?.porque ?? null;
}

export type Orden = {
  regla: string;
  /** Horas desde el último rastreo. Sin esto, una orden vieja se lee como
   *  nueva y manda a arreglar lo que ya está arreglado. */
  medido_hace_h?: number | null;
  titulo: string;
  por_que: string;
  hecho_cuando: string;
  severidad: string;
  urls: { url: string; detalle: any; quiza_noindex?: string | null }[];
};

/**
 * Agrupa los hallazgos abiertos en órdenes de trabajo.
 *
 * Una orden POR REGLA, no por página. Veinticinco metas cortas repartidas en
 * veinticinco páginas son UNA tarea —escribir veinticinco metas, con el mismo
 * criterio y de una sentada— y no veinticinco tareas de una línea. Partirlas
 * produce una cola que parece enorme y que en realidad es un rato de trabajo,
 * y eso desanima a quien la abre.
 */
export async function armarOrdenes(): Promise<Orden[]> {
  const issues = await traerTodo<any>('de_issues', 'id, tipo, severidad, url, detalle',
    q => q.eq('estado', 'abierto'));

  /* Cuándo se midió esto. Los hallazgos se cierran solos cuando la regla deja
     de detectarlos, pero eso pasa al RASTREAR, y el rastreo es semanal. Entre
     medias, una página ya arreglada sigue en la lista.

     Ya mordió: la primera orden de «páginas sin H1» incluía `/producto/`, que
     tenía H1 desde hacía horas. Alguien habría abierto el archivo, visto el H1
     y perdido el rato preguntándose qué se le escapaba.

     No se puede arreglar rastreando aquí —el motor no debe disparar un rastreo
     completo cada vez que agrupa hallazgos— así que se DICE, que es lo que
     permite al operador juzgar. */
  const { data: ultimoRastreo } = await supabase.from('de_paginas')
    .select('rastreada_at').order('rastreada_at', { ascending: false }).limit(1).maybeSingle();
  const medidoHace = ultimoRastreo?.rastreada_at
    ? Math.round((Date.now() - new Date(ultimoRastreo.rastreada_at).getTime()) / 3600e3)
    : null;

  const porRegla = new Map<string, Orden>();

  for (const i of issues) {
    if (!REGLAS[i.tipo]) continue;              // regla que no sabemos explicar: no se manda
    if (await esContenidoDelMotor(i.url)) continue;   // eso lo arregla el motor, no el operador

    const o: Orden = porRegla.get(i.tipo) || { regla: i.tipo, ...REGLAS[i.tipo], severidad: i.severidad, urls: [], medido_hace_h: medidoHace };
    o.urls.push({
      url: i.url, detalle: i.detalle,
      // Solo para «contenido delgado»: en las demás reglas, una pantalla de app
      // con la meta mal SÍ se arregla escribiendo la meta.
      quiza_noindex: i.tipo === 'contenido_delgado' ? sospechaNoIndexar(i.url) : null,
    });
    porRegla.set(i.tipo, o);
  }

  const peso: Record<string, number> = { alta: 3, media: 2, baja: 1 };
  return [...porRegla.values()].sort((a, b) =>
    (peso[b.severidad] ?? 0) - (peso[a.severidad] ?? 0) || b.urls.length - a.urls.length);
}

registrar('codigo.proponer', async (): Promise<ResultadoHandler> => {
  const ordenes = await armarOrdenes();
  if (!ordenes.length) return { ok: true, resumen: 'no hay trabajo de repositorio que proponer' };

  let nuevas = 0, repetidas = 0;
  for (const o of ordenes) {
    /* La clave lleva el CONTEO de URLs, no la fecha.
       Con la fecha se crearía una orden nueva cada día con el mismo trabajo
       dentro; con solo la regla, una orden vieja taparía para siempre los
       hallazgos nuevos del mismo tipo. Con el conteo, la orden se rehace
       exactamente cuando el alcance cambia — que es cuando de verdad es otra
       tarea. */
    const r = await encolar({
      tipo: 'codigo.tecnico',
      clave_idem: `codigo:${o.regla}:${o.urls.length}`,
      prioridad: o.severidad === 'alta' ? 70 : o.severidad === 'media' ? 55 : 40,
      motivo: `${o.titulo} · ${o.urls.length} página(s)`,
      payload: {
        regla: o.regla,
        titulo: o.titulo,
        por_que: o.por_que,
        hecho_cuando: o.hecho_cuando,
        severidad: o.severidad,
        medido_hace_h: o.medido_hace_h,
        // Las URLs, no rutas de archivo: el motor no puede ver el disco y una
        // ruta adivinada manda al operador a un archivo que no existe.
        urls: o.urls.map(u => u.url),
        detalle_por_url: Object.fromEntries(o.urls.map(u => [u.url, u.detalle])),
        // Las que probablemente no son contenido, con su motivo. Enseñarlas
        // aparte evita que alguien se ponga a escribirle párrafos a un
        // formulario porque la regla dijo «faltan palabras».
        quiza_noindex: Object.fromEntries(
          o.urls.filter(u => u.quiza_noindex).map(u => [u.url, u.quiza_noindex])),
      },
    });
    if (!r.id) continue;
    r.nueva ? nuevas++ : repetidas++;
  }

  return {
    ok: true,
    resumen: `${ordenes.length} orden(es) de trabajo · ${nuevas} nueva(s), ${repetidas} ya estaban`,
    datos: { ordenes: ordenes.map(o => ({ regla: o.regla, paginas: o.urls.length, severidad: o.severidad })) },
  };
});
