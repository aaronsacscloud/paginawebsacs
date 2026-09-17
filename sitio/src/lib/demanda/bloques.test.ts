/**
 * El generador de HTML del motor.
 *
 * Es la frontera de seguridad del proyecto: aquí es donde texto que escribió un
 * MODELO se convierte en HTML que se sirve en www.sacscloud.com. Todo lo demás
 * del motor puede equivocarse y costar dinero; esto puede costar el dominio.
 *
 * La defensa es de diseño —se escapa primero y se aplica el formato después,
 * sobre texto ya inocuo— pero una defensa de diseño sin prueba es una
 * suposición: basta que alguien «mejore» el formateo para que deje de ser
 * cierta y nada lo avise.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/bloques.test.ts
 */
import { aHtml, aTexto, anclaDe, indice } from './bloques.ts';

let ok = 0; const fallas: string[] = [];
const si = (c: boolean, q: string) => { c ? ok++ : fallas.push(q); };
const noContiene = (html: string, trozo: string, q: string) => {
  if (!html.includes(trozo)) { ok++; return; }
  fallas.push(`${q}\n      salió: ${html.slice(0, 200)}`);
};

// ── Nada de lo que escriba un modelo puede volverse marcado ─────────────────
{
  const veneno = '<script>alert(1)</script> y <img src=x onerror=alert(2)>';
  for (const b of [
    { t: 'p', texto: veneno },
    { t: 'h2', texto: veneno },
    { t: 'lista', items: [veneno] },
    { t: 'faq', items: [{ p: veneno, r: veneno }] },
    { t: 'pasos', items: [{ titulo: veneno, texto: veneno }] },
    { t: 'dato', valor: veneno, etiqueta: veneno, fuente: veneno },
    { t: 'cita', texto: veneno, fuente: veneno },
    { t: 'tabla', encabezados: [veneno], filas: [[veneno]] },
    { t: 'cta', texto: veneno, boton: veneno, url: '/x' },
  ] as any[]) {
    const html = aHtml([b]);
    /* Se comprueba la ETIQUETA, no la palabra. `onerror` aparece en la salida
       —dentro de `&lt;img src=x onerror=…&gt;`— y ahí es texto inerte: buscar
       la palabra suelta marca como falla lo que en realidad está bien
       escapado, y una prueba que grita cuando todo está correcto acaba
       ignorada. Lo que no puede aparecer es un `<` abriendo etiqueta. */
    noContiene(html, '<script', `«${b.t}» dejó pasar una etiqueta <script>`);
    noContiene(html, '<img', `«${b.t}» dejó pasar una etiqueta <img>`);
    si(html.includes('&lt;script&gt;'), `«${b.t}» tiene que escapar el < como &lt;`);
  }
}

// ── Enlaces: solo interno o https ──────────────────────────────────────────
{
  const liga = (u: string) => aHtml([{ t: 'p', texto: `mira [esto](${u})` } as any]);

  for (const malo of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
                      'vbscript:msgbox(1)', 'http://sin-tls.example.com', 'file:///etc/passwd']) {
    const h = liga(malo);
    noContiene(h, '<a ', `«${malo}» no debe convertirse en enlace`);
    si(h.includes('esto'), `«${malo}»: el texto se conserva aunque el enlace se descarte`);
  }

  /* El caso que este archivo existe para que no vuelva:
     `//otrositio.com` EMPIEZA con `/`, así que la comprobación ingenua lo daba
     por interno. El navegador lo manda al otro dominio. */
  for (const disfrazado of ['//sitio-ajeno.com', '//sitio-ajeno.com/ruta', '/\\sitio-ajeno.com']) {
    noContiene(liga(disfrazado), '<a ', `«${disfrazado}» es externo disfrazado de interno`);
  }

  si(liga('/planes').includes('href="/planes"'), 'un enlace interno de verdad sí pasa');
  si(liga('https://www.sacscloud.com/planes').includes('href="https://www.sacscloud.com/planes"'),
    'https propio pasa');

  const fuera = liga('https://ejemplo.com/x');
  si(fuera.includes('rel="nofollow noopener"') && fuera.includes('target="_blank"'),
    'un enlace externo sale con nofollow y noopener');
  si(!liga('/planes').includes('nofollow'), 'un enlace interno NO lleva nofollow');
}

// ── El formato permitido funciona, y solo ese ──────────────────────────────
{
  const h = aHtml([{ t: 'p', texto: 'esto es **fuerte** y esto `código`' } as any]);
  si(h.includes('<strong>fuerte</strong>'), 'las negritas funcionan');
  si(h.includes('<code>código</code>'), 'el código en línea funciona');

  // Un `<b>` escrito por el modelo NO es formato: es texto.
  noContiene(aHtml([{ t: 'p', texto: 'esto es <b>crudo</b>' } as any]), '<b>',
    'el HTML crudo del modelo se enseña como texto, no se interpreta');
}

// ── Anclas: lo que hace citable un APARTADO y no solo la página ────────────
{
  si(anclaDe('¿Qué es la curva de tallas?') === 'que-es-la-curva-de-tallas',
    'el ancla quita acentos, signos y mayúsculas');
  si(anclaDe('') === '', 'un título vacío da ancla vacía, no revienta');
  si(anclaDe('a'.repeat(200)).length <= 60, 'el ancla se recorta');

  const tres = [{ t: 'h2', texto: 'Uno' }, { t: 'h2', texto: 'Dos' }, { t: 'h2', texto: 'Tres' }] as any[];
  si(indice(tres).length === 3, 'con tres apartados hay índice');
  si(indice(tres.slice(0, 2)).length === 0, 'con dos apartados el índice estorba y no se pone');
}

// ── Entradas rotas no pueden tirar la página ───────────────────────────────
{
  for (const basura of [null, undefined, {}, { t: 'inventado' }, { t: 'p' }, { t: 'lista' },
                        { t: 'tabla' }, { t: 'faq' }, { t: 'pasos' }] as any[]) {
    try { aHtml([basura]); aTexto([basura]); ok++; }
    catch (e: any) { fallas.push(`un bloque ${JSON.stringify(basura)} tira el render: ${e.message}`); }
  }
  si(aHtml(null as any) === '', 'sin bloques devuelve cadena vacía');
}

console.log(fallas.length
  ? `\n✗ bloques: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ bloques (frontera de seguridad): ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
