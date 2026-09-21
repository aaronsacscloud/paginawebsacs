// DEMAND ENGINE · el cuerpo del contenido, como bloques tipados.
//
// El motor NO escribe HTML ni markdown: escribe una lista de bloques con
// forma conocida. Tres razones, y la tercera es la que decide:
//
//  1. Seguridad sin sanear. Nada de lo que produce un modelo se interpreta como
//     marcado: se escapa todo y el renderizador pone las etiquetas. No hay
//     forma de que un texto generado inyecte nada.
//  2. Un solo estilo. El HTML lo escribe este archivo, así que dos artículos
//     escritos con meses de diferencia se ven igual.
//  3. CITABILIDAD, que es el objetivo. Unas preguntas frecuentes en bloques se
//     convierten en `FAQPage`; unos pasos, en `HowTo`; un dato, en algo con su
//     fuente al lado. En markdown todo eso es texto plano indistinguible, y una
//     IA tiene que adivinar la estructura en vez de leerla.
export type Bloque =
  | { t: 'h2' | 'h3'; texto: string }
  | { t: 'p'; texto: string }
  | { t: 'lista'; ordenada?: boolean; items: string[] }
  | { t: 'tabla'; encabezados: string[]; filas: string[][]; nota?: string }
  | { t: 'cita'; texto: string; fuente: string; url?: string }
  | { t: 'faq'; items: { p: string; r: string }[] }
  | { t: 'pasos'; items: { titulo: string; texto: string }[] }
  | { t: 'dato'; valor: string; etiqueta: string; fuente: string }
  | { t: 'cta'; texto: string; boton: string; url: string }
  /* Una imagen con su pie. La URL viene de storage (la genera el motor), nunca
     del texto del modelo: el bloque lo agrega el pipeline, no el redactor. */
  /* `url` vacía = pendiente: el redactor pide la foto describiendo la escena y
     el pipeline la genera después de que la página pasó el referee. */
  | { t: 'imagen'; url: string; alt: string; pie?: string; ancho?: number; alto?: number; escena?: string }
  /* La respuesta corta arriba de todo: 3-5 líneas que una IA puede citar sin
     leer la página. Va a `speakable` en el schema. */
  | { t: 'resumen'; items: string[] }
  /* Los términos del ramo definidos como los dice la gente del giro. Se vuelve
     DefinedTermSet: una IA que busca «qué es una muestra de piso» encuentra la
     definición suelta. */
  | { t: 'glosario'; items: { termino: string; definicion: string }[] }
  /* La imagen de referencia CON el dato: una tabla que se dibuja como PNG
     (calendario de abonos, curva de tallas, ficha de medidas). Es lo que un AI
     Overview enseña al lado de la respuesta. Sin url se pinta como tabla. */
  | { t: 'diagrama'; titulo: string; encabezados: string[]; filas: string[][]; nota?: string; alt?: string; url?: string; ancho?: number; alto?: number }
  /* Un video del canal, con su ficha. VideoObject en el schema. */
  | { t: 'video'; youtube_id: string; titulo: string; descripcion?: string; duracion_seg?: number; subido_at?: string };

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Solo enlaces del propio sitio o https. Un `javascript:` o un `data:` en un
 *  texto generado no llega nunca a la página. */
function urlSegura(u: string): string | null {
  const s = String(u || '').trim();

  /* Ojo con `//`: `//otrositio.com` EMPIEZA CON `/`, así que la comprobación
     ingenua lo daba por interno — y el navegador lo trata como enlace absoluto
     al otro dominio, heredando el protocolo. Un modelo que escriba
     `[nuestra guía](//sitio-ajeno.com)` habría publicado en nuestro sitio un
     enlace que se lee como nuestro y manda afuera, sin `nofollow` ni aviso.
     `/\` cuenta igual: varios navegadores lo normalizan a `//`. */
  if (/^\/[/\\]/.test(s)) return null;
  if (s.startsWith('/')) return s;

  try {
    const url = new URL(s);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}

/**
 * Formato dentro de un párrafo. Se escapa PRIMERO y se aplica el formato
 * DESPUÉS, sobre texto ya inocuo: negritas, código y enlaces, nada más. Es
 * deliberadamente pobre — cada cosa que se permite aquí es una cosa que hay que
 * volver a revisar si un modelo la usa mal.
 */
function enLinea(texto: string): string {
  let h = esc(texto);
  h = h.replace(/`([^`]{1,200})`/g, (_, c) => `<code>${c}</code>`);
  h = h.replace(/\*\*([^*]{1,300})\*\*/g, (_, c) => `<strong>${c}</strong>`);
  h = h.replace(/\[([^\]]{1,200})\]\(([^)]{1,500})\)/g, (m, t, u) => {
    const url = urlSegura(u.replace(/&amp;/g, '&'));
    if (!url) return t;
    const fuera = url.startsWith('http') && !url.includes('sacscloud.com');
    return `<a href="${esc(url)}"${fuera ? ' rel="nofollow noopener" target="_blank"' : ''}>${t}</a>`;
  });
  return h;
}

export function aHtml(bloques: Bloque[]): string {
  const out: string[] = [];
  for (const b of bloques || []) {
    switch (b?.t) {
      case 'h2': out.push(`<h2 id="${esc(anclaDe(b.texto))}">${esc(b.texto)}</h2>`); break;
      case 'h3': out.push(`<h3 id="${esc(anclaDe(b.texto))}">${esc(b.texto)}</h3>`); break;
      case 'p': out.push(`<p>${enLinea(b.texto)}</p>`); break;
      case 'lista':
        out.push(`<${b.ordenada ? 'ol' : 'ul'}>${(b.items || []).map(i => `<li>${enLinea(i)}</li>`).join('')}</${b.ordenada ? 'ol' : 'ul'}>`);
        break;
      case 'tabla':
        out.push(
          `<div class="de-tabla"><table><thead><tr>${(b.encabezados || []).map(e => `<th>${esc(e)}</th>`).join('')}</tr></thead>` +
          `<tbody>${(b.filas || []).map(f => `<tr>${f.map(c => `<td>${enLinea(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
          (b.nota ? `<p class="de-nota">${enLinea(b.nota)}</p>` : '') + `</div>`);
        break;
      case 'cita': {
        // La fuente NO es decoración: es lo que hace verificable la afirmación,
        // y lo verificable es lo que una IA se atreve a citar.
        const u = b.url ? urlSegura(b.url) : null;
        out.push(`<figure class="de-cita"><blockquote>${enLinea(b.texto)}</blockquote>` +
          `<figcaption>${u ? `<a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(b.fuente)}</a>` : esc(b.fuente)}</figcaption></figure>`);
        break;
      }
      case 'faq':
        out.push(`<div class="de-faq">${(b.items || []).map(i =>
          `<details><summary>${esc(i.p)}</summary><div>${enLinea(i.r)}</div></details>`).join('')}</div>`);
        break;
      case 'pasos':
        out.push(`<ol class="de-pasos">${(b.items || []).map(i =>
          `<li><strong>${esc(i.titulo)}</strong><span>${enLinea(i.texto)}</span></li>`).join('')}</ol>`);
        break;
      case 'dato':
        out.push(`<div class="de-dato"><span class="de-dato-v">${esc(b.valor)}</span>` +
          `<span class="de-dato-e">${esc(b.etiqueta)}</span><span class="de-dato-f">${esc(b.fuente)}</span></div>`);
        break;
      case 'cta': {
        const u = urlSegura(b.url) || '/contacto';
        out.push(`<div class="de-cta"><p>${enLinea(b.texto)}</p><a class="de-cta-b" href="${esc(u)}">${esc(b.boton)}</a></div>`);
        break;
      }
      case 'diagrama': {
        const u = b.url ? urlSegura(b.url) : null;
        if (u) {
          out.push(`<figure class="de-diagrama"><img src="${esc(u)}" alt="${esc(b.alt || b.titulo)}" loading="lazy" decoding="async" width="${b.ancho || 1200}" height="${b.alto || 800}"><figcaption>${esc(b.titulo)}${b.nota ? ` — ${enLinea(b.nota)}` : ''}</figcaption></figure>`);
        } else {
          out.push(`<div class="de-tabla de-diagrama-tabla"><p class="de-diagrama-t">${esc(b.titulo)}</p><table><thead><tr>${(b.encabezados || []).map(e => `<th>${esc(e)}</th>`).join('')}</tr></thead>` +
            `<tbody>${(b.filas || []).map(f => `<tr>${f.map(c => `<td>${enLinea(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` + (b.nota ? `<p class="de-nota">${enLinea(b.nota)}</p>` : '') + `</div>`);
        }
        break;
      }
      case 'resumen':
        out.push(`<div class="de-resumen"><p class="de-resumen-t">En corto</p><ul>${(b.items || []).map(i => `<li>${enLinea(i)}</li>`).join('')}</ul></div>`);
        break;
      case 'glosario':
        out.push(`<dl class="de-glosario">${(b.items || []).map(i => `<div><dt>${esc(i.termino)}</dt><dd>${enLinea(i.definicion)}</dd></div>`).join('')}</dl>`);
        break;
      case 'video': {
        const id = String(b.youtube_id || '').replace(/[^A-Za-z0-9_-]/g, '');
        if (!id) break;
        // youtube-nocookie y sin autoplay: no carga nada hasta que se pulsa.
        out.push(`<figure class="de-video"><div class="de-video-marco"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(b.titulo)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` +
          `<figcaption>${esc(b.titulo)}${b.descripcion ? ` — ${enLinea(b.descripcion)}` : ''}</figcaption></figure>`);
        break;
      }
      case 'imagen': {
        const u = urlSegura(b.url);
        if (!u) break; // pendiente de generar: no se pinta un hueco
        // width/height explícitos: sin ellos la página salta al cargar (CLS), y
        // eso Google lo mide. `loading="lazy"` porque la portada va aparte.
        out.push(`<figure class="de-imagen"><img src="${esc(u)}" alt="${esc(b.alt)}" loading="lazy" decoding="async" width="${b.ancho || 1200}" height="${b.alto || 630}">` +
          (b.pie ? `<figcaption>${enLinea(b.pie)}</figcaption>` : '') + `</figure>`);
        break;
      }
    }
  }
  return out.join('\n');
}

export const anclaDe = (t: string) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** El índice de la página. Solo si hay tres o más apartados: con dos, estorba. */
export function indice(bloques: Bloque[]): { texto: string; ancla: string }[] {
  const h = (bloques || []).filter(b => b?.t === 'h2') as { texto: string }[];
  return h.length >= 3 ? h.map(b => ({ texto: b.texto, ancla: anclaDe(b.texto) })) : [];
}

/** Texto plano, para contar palabras y para el resumen. */
export function aTexto(bloques: Bloque[]): string {
  const p: string[] = [];
  for (const b of bloques || []) {
    if (b?.t === 'h2' || b?.t === 'h3' || b?.t === 'p') p.push((b as any).texto);
    else if (b?.t === 'lista') p.push(...(b.items || []));
    else if (b?.t === 'faq') for (const i of b.items || []) p.push(i.p, i.r);
    else if (b?.t === 'pasos') for (const i of b.items || []) p.push(i.titulo, i.texto);
    else if (b?.t === 'cita') p.push(b.texto);
    else if (b?.t === 'tabla') for (const f of b.filas || []) p.push(...f);
    else if (b?.t === 'resumen') p.push(...(b.items || []));
    else if (b?.t === 'diagrama') { p.push(b.titulo); for (const f of b.filas || []) p.push(...f); }
    else if (b?.t === 'glosario') for (const i of b.items || []) p.push(i.termino, i.definicion);
    // 'imagen', 'video' y 'dato' no cuentan como texto: son apoyo, no prosa.
  }
  return p.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * La misma página en texto CON estructura (encabezados, tablas, pasos, faq
 * marcados). Es lo que se le da al referee: con `aTexto()` una tabla de
 * abonos se le presentaba como «03 ago Anticipo $7,200 $16,800 05 sep…» y la
 * marcaba como «texto corrido ilegible» — el defecto estaba en la vista, no en
 * la página, y costó una reescritura entera.
 */
export function aMarkdown(bloques: Bloque[]): string {
  const out: string[] = [];
  for (const b of bloques || []) {
    switch (b?.t) {
      case 'h2': out.push(`\n## ${b.texto}`); break;
      case 'h3': out.push(`\n### ${b.texto}`); break;
      case 'p': out.push(b.texto); break;
      case 'lista': out.push((b.items || []).map((i, n) => `${b.ordenada ? `${n + 1}.` : '-'} ${i}`).join('\n')); break;
      case 'tabla':
        out.push(`[TABLA]\n| ${(b.encabezados || []).join(' | ')} |\n| ${(b.encabezados || []).map(() => '---').join(' | ')} |\n` +
          (b.filas || []).map(f => `| ${f.join(' | ')} |`).join('\n') + (b.nota ? `\n_${b.nota}_` : ''));
        break;
      case 'cita': out.push(`> ${b.texto}\n> — ${b.fuente}`); break;
      case 'faq': out.push(`[FAQ]\n` + (b.items || []).map(i => `**P: ${i.p}**\nR: ${i.r}`).join('\n\n')); break;
      case 'pasos': out.push(`[PASOS]\n` + (b.items || []).map((i, n) => `${n + 1}. **${i.titulo}** ${i.texto}`).join('\n')); break;
      case 'dato': out.push(`[DATO] ${b.valor} — ${b.etiqueta} (${b.fuente})`); break;
      case 'cta': out.push(`[CTA] ${b.texto} → [${b.boton}](${b.url})`); break;
      case 'imagen': out.push(`[IMAGEN${b.url ? '' : ' pendiente de generar'}: ${b.alt}${b.escena ? ` · escena: ${b.escena}` : ''}]`); break;
      case 'diagrama': out.push(`[DIAGRAMA → imagen${b.url ? '' : ' pendiente'}: ${b.titulo}]\n| ${(b.encabezados || []).join(' | ')} |\n` + (b.filas || []).map(f => `| ${f.join(' | ')} |`).join('\n')); break;
      case 'resumen': out.push(`[RESUMEN «En corto»]\n` + (b.items || []).map(i => `- ${i}`).join('\n')); break;
      case 'glosario': out.push(`[GLOSARIO]\n` + (b.items || []).map(i => `**${i.termino}**: ${i.definicion}`).join('\n')); break;
      case 'video': out.push(`[VIDEO youtube:${b.youtube_id}] ${b.titulo}`); break;
    }
  }
  return out.join('\n\n').trim();
}

export const palabras = (bloques: Bloque[]) => aTexto(bloques).split(/\s+/).filter(Boolean).length;

/**
 * Los datos estructurados que salen del propio cuerpo.
 *
 * Aquí se paga el haber elegido bloques: las preguntas frecuentes ya están
 * separadas en pregunta y respuesta, así que se vuelven `FAQPage` sin adivinar
 * nada. Con markdown habría que inferir cuál línea es pregunta y cuál respuesta,
 * acertar el 90% de las veces, y publicar datos estructurados equivocados el
 * otro 10% — que es peor que no publicarlos.
 */
export function schemaDeCuerpo(bloques: Bloque[]): Record<string, any>[] {
  const out: Record<string, any>[] = [];

  const faqs = (bloques || []).filter(b => b?.t === 'faq') as Extract<Bloque, { t: 'faq' }>[];
  const items = faqs.flatMap(f => f.items || []);
  if (items.length) {
    out.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: items.map(i => ({
        '@type': 'Question', name: i.p,
        acceptedAnswer: { '@type': 'Answer', text: i.r },
      })),
    });
  }

  const glos = (bloques || []).find(b => b?.t === 'glosario') as Extract<Bloque, { t: 'glosario' }> | undefined;
  if (glos?.items?.length) {
    out.push({
      '@context': 'https://schema.org', '@type': 'DefinedTermSet',
      name: 'Términos del ramo',
      hasDefinedTerm: glos.items.map(i => ({ '@type': 'DefinedTerm', name: i.termino, description: i.definicion })),
    });
  }

  for (const d of (bloques || []).filter(b => b?.t === 'diagrama' && (b as any).url) as Extract<Bloque, { t: 'diagrama' }>[]) {
    out.push({ '@context': 'https://schema.org', '@type': 'ImageObject', contentUrl: d.url, url: d.url, name: d.titulo, caption: d.alt || d.titulo, width: d.ancho || 1200, height: d.alto || 800 });
  }

  for (const v of (bloques || []).filter(b => b?.t === 'video') as Extract<Bloque, { t: 'video' }>[]) {
    const id = String(v.youtube_id || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!id) continue;
    out.push({
      '@context': 'https://schema.org', '@type': 'VideoObject',
      name: v.titulo, description: v.descripcion || v.titulo,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      contentUrl: `https://www.youtube.com/watch?v=${id}`,
      ...(v.subido_at ? { uploadDate: v.subido_at } : {}),
      ...(v.duracion_seg ? { duration: `PT${Math.floor(v.duracion_seg / 60)}M${v.duracion_seg % 60}S` } : {}),
    });
  }

  const pasos = (bloques || []).find(b => b?.t === 'pasos') as Extract<Bloque, { t: 'pasos' }> | undefined;
  if (pasos?.items?.length) {
    out.push({
      '@context': 'https://schema.org', '@type': 'HowTo',
      step: pasos.items.map((s, i) => ({
        '@type': 'HowToStep', position: i + 1, name: s.titulo, text: s.texto,
      })),
    });
  }
  return out;
}
