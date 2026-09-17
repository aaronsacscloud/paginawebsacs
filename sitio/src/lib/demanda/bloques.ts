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
  | { t: 'cta'; texto: string; boton: string; url: string };

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
  }
  return p.join(' ').replace(/\s+/g, ' ').trim();
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
