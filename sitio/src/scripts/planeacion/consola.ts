/**
 * El motor de la consola de /planeacion-de-demanda (actos 1–4 de la temporada simulada).
 *
 * Cada acto tiene una línea de tiempo (beats) que se reproduce sola cuando el acto ocupa el centro de la pantalla;
 * solo corre uno a la vez. Se detiene con la pausa, al abrir una tarjeta, fuera de vista o con la pestaña oculta
 * (un solo requestAnimationFrame, nada de setInterval). «×2» acelera, «Saltar» deja el acto en su estado final y
 * «Otra vez» lo repite. Si el visitante no toca nada en 6 segundos, la tarjeta pendiente más nueva late («Ábreme»).
 * Con «reducir movimiento» no se anima nada: cada acto queda en su estado final (póster), pero las tarjetas se abren
 * y se envían igual. Sin JS, el HTML ya es el póster.
 */
import { estado, escucha, avisa, ph, phUnaVez, activa } from './estado';
import { PASOS, PLAN_27, REAL_27, TICKER, RUTINA } from '../../data/planeacion-demo';
import { serie, suave } from '../../lib/planeacion-graficas';

type Beat = { t: number; fn: () => void };
type Acto = {
  id: 'pre' | 'vivo' | 'cierre' | 'resultado';
  el: HTMLElement;
  dur: number;
  beats: Beat[];
  reset(): void;
  final(): void;
  tick?(t: number): void;
  envia?(id: string, como: Como): void;
  pendientes?(): HTMLElement[];
};
type Como = 'click' | 'auto' | 'rutina';

const pd = document.querySelector<HTMLElement>('.pd');
const consola = document.getElementById('pd-consola');
if (pd && consola) iniciar(pd, consola);

function iniciar(pd: HTMLElement, consola: HTMLElement) {
  const mqMov = window.matchMedia('(prefers-reduced-motion: no-preference)');
  let movimiento = mqMov.matches;
  pd.classList.add('pd-js');

  /* ───────── utilidades ───────── */
  const $ = <T extends HTMLElement = HTMLElement>(raiz: ParentNode, s: string) => raiz.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement = HTMLElement>(raiz: ParentNode, s: string) => Array.from(raiz.querySelectorAll<T>(s));
  const miles = (n: number, dec = 0) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const dinero = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} K` : `$${Math.round(n)}`);
  /** Cuenta de 0 al número de un texto como «$21.3 M», «93.6 %» o «26,600» (respeta prefijo, decimales y sufijo). */
  function cuenta(el: HTMLElement, textoFinal: string, ms = 1100) {
    const m = textoFinal.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m || !movimiento) { el.textContent = textoFinal; return; }
    const [, pre, num, suf] = m;
    const dec = (num.split('.')[1] || '').length;
    const fin = parseFloat(num.replace(/,/g, ''));
    const t0 = performance.now();
    const paso = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = fin * (1 - Math.pow(1 - p, 3));
      el.textContent = pre + (num.includes(',') || fin >= 1000 ? miles(v, dec) : v.toFixed(dec)) + suf;
      if (p < 1) requestAnimationFrame(paso); else el.textContent = textoFinal;
    };
    requestAnimationFrame(paso);
  }

  /* lo que se confirma fuera del diálogo (rutina, rebaja, aplicar) se anuncia aquí */
  const anuncio = consola.querySelector<HTMLElement>('[data-anuncio]');
  const anuncia = (t: string) => { if (anuncio) anuncio.textContent = t; };

  /* ───────── las tarjetas: estado visible ───────── */
  function marcaTarjeta(li: HTMLElement | undefined, como: Como | null) {
    if (!li) return;
    li.classList.toggle('is-hecho', !!como);
    li.classList.toggle('is-auto', como === 'auto');
    li.classList.remove('is-abreme');
    const est = li.querySelector<HTMLElement>('[data-estado]');
    if (est) est.textContent = !como ? 'Por revisar' : como === 'auto' ? '✓ Automático · 4 h para objetar' : '✓ Hecho';
    const id = li.dataset.tarjeta;
    document.getElementById(`det-${id}`)?.classList.toggle('is-enviada', !!como);
  }

  /* ───────── Acto 1 · Pretemporada ───────── */
  function actoPre(el: HTMLElement): Acto {
    const pasos = $$(el, '.pre-paso');
    const figs = new Map($$(el, '.pre-fig').map((f) => [f.dataset.fig!, f]));
    const final = $(el, '.pre-final');
    const reparto = $(el, '.pre-reparto');
    const lista = $(el, '.pre-lista');
    const tarjetas = $$(lista, '.pdt');
    const repCedis = $(el, '[data-rep-cedis]'), repSalen = $(el, '[data-rep-salen]'), repQuedan = $(el, '[data-rep-quedan]');
    const enviados = new Set<string>();
    let manual = false;
    const DUR = [4400, 3200, 2800, 2800, 3400, 3200, 2600, 3400, 3800];

    const omitido = (i: number) => { const c = pasos[i].dataset.clave; return !!c && !estado.analiza.has(c); };
    function selecciona(i: number) {
      const f = pasos[i].dataset.fig;
      if (!f) return;   // el paso de inventario va sin gráfica: se queda la que estaba
      figs.forEach((fig, k) => fig.classList.toggle('is-sel', k === f));
      pasos.forEach((p, k) => p.classList.toggle('is-sel', k === i));
    }
    /* escritorio: las gráficas se mudan al escenario pegado de la derecha; teléfono: vuelven debajo de su paso */
    const escenario = $(el, '.pre-escenario');
    const casaFig = new Map([...figs.values()].map((f) => [f, f.parentElement!]));
    const mqEscenario = window.matchMedia('(min-width: 1024px)');
    function ubica() {
      const en = mqEscenario.matches;
      el.classList.toggle('pd-escenario', en);
      figs.forEach((f) => { const destino = en ? escenario : casaFig.get(f)!; if (f.parentElement !== destino) destino.append(f); });
    }
    mqEscenario.addEventListener('change', ubica);
    ubica();
    selecciona(pasos.length - 1);   // el póster (antes de prepararse) muestra la compra en el escenario
    function estadoFig(i: number, ya = false) {
      const fig = figs.get(pasos[i].dataset.fig || '');
      if (!fig) return;
      const id = PASOS[i].id;
      if (fig.dataset.fig === 'curvas') {
        fig.classList.add('f-historia');
        if (id === 'picos' || id === 'alza') fig.classList.add('f-picos');
        if (id === 'alza') fig.classList.add('f-alza');
      } else fig.classList.add('f-on');
      if (ya) fig.classList.add('f-ya');
      if (id === 'compra') $$(fig, '[data-cuenta]').forEach((b) => (ya ? (b.textContent = miles(+b.dataset.cuenta!)) : cuenta(b, miles(+b.dataset.cuenta!))));
    }
    function omiteFiguras() {
      figs.forEach((fig, f) => {
        const usa = pasos.filter((p) => p.dataset.fig === f);
        fig.classList.toggle('is-omitida', usa.every((p, k) => p.classList.contains('is-omitida') || !p.classList.contains('is-on')) && usa.some((p) => p.classList.contains('is-omitida')));
      });
    }
    function muestra(i: number, ya = false) {
      const p = pasos[i];
      pasos.forEach((q, k) => q.classList.toggle('is-ahora', !ya && k === i));
      p.classList.add('is-on');
      const om = omitido(i);
      p.classList.toggle('is-omitida', om);
      if (!om) { estadoFig(i, ya); if (!manual) selecciona(i); }
      omiteFiguras();
    }
    function reparte(ya = false) {
      reparto.classList.add('is-reparte');
      if (ya) { repCedis.textContent = '12,100'; repSalen.textContent = '18,100'; repQuedan.textContent = '12,100'; return; }
      cuenta(repSalen, '18,100', 1600); cuenta(repQuedan, '12,100', 1600);
      const t0 = performance.now();
      const baja = (now: number) => { const p = Math.min(1, (now - t0) / 1600); repCedis.textContent = miles(Math.round(30200 - 18100 * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(baja); };
      requestAnimationFrame(baja);
    }
    function apareceTarjetas() {
      final.classList.add('is-on');
      tarjetas.forEach((li) => li.classList.add('is-on'));
      tocaAparicion();
    }

    const beats: Beat[] = [];
    let t = 500;
    pasos.forEach((_, i) => { const ti = t; beats.push({ t: ti, fn: () => muestra(i) }); t += DUR[i]; });
    beats.push({ t, fn: () => { el.classList.add('is-terminado'); pasos.forEach((q) => q.classList.remove('is-ahora')); } });
    beats.push({ t: t + 500, fn: apareceTarjetas });
    beats.push({ t: t + 2000, fn: () => reparte() });

    // clic en un paso ya hecho: su gráfica al escenario (escritorio)
    pasos.forEach((p, i) => p.querySelector('.pre-paso-b')?.addEventListener('click', () => {
      if (!p.classList.contains('is-on') || p.classList.contains('is-omitida')) return;
      manual = true; selecciona(i); ph('planeacion_paso', { id: PASOS[i].id });
    }));
    // las dos dudas del catálogo: un clic y queda guardado
    $$(el, '.pre-duda').forEach((d) => {
      const ok = $(d, '.pre-duda-ok');
      $$(d, '.pre-op').forEach((b) => b.addEventListener('click', () => {
        $$(d, '.pre-op').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        ok.textContent = `✓ Guardado: ${b.firstChild?.textContent?.trim()}. Queda con tu nombre y la fecha.`;
        ph('planeacion_duda', { duda: d.dataset.duda, op: b.dataset.op });
      }));
    });

    return {
      id: 'pre', el, dur: t + 4200, beats,
      reset() {
        manual = false; enviados.clear();
        el.classList.remove('is-terminado');
        pasos.forEach((p) => p.classList.remove('is-on', 'is-ahora', 'is-omitida', 'is-sel'));
        figs.forEach((f) => f.classList.remove('is-sel', 'is-omitida', 'f-on', 'f-ya', 'f-historia', 'f-picos', 'f-alza'));
        final.classList.remove('is-on'); reparto.classList.remove('is-reparte', 'is-enviado');
        repCedis.textContent = '30,200'; repSalen.textContent = '0'; repQuedan.textContent = '0';
        tarjetas.forEach((li) => { li.classList.remove('is-on'); marcaTarjeta(li, null); });
      },
      final() {
        pasos.forEach((_, i) => muestra(i, true));
        const ultimo = [...pasos.keys()].reverse().find((i) => !omitido(i) && !!pasos[i].dataset.fig);
        if (ultimo !== undefined && !manual) selecciona(ultimo);
        el.classList.add('is-terminado');
        final.classList.add('is-on'); tarjetas.forEach((li) => li.classList.add('is-on'));
        reparte(true);
      },
      envia(id, como) {
        if (enviados.has(id)) return;
        enviados.add(id);
        marcaTarjeta(tarjetas.find((li) => li.dataset.tarjeta === id), como);
        if (id === 'reparto') { reparto.classList.add('is-enviado'); if (!reparto.classList.contains('is-reparte')) reparte(!movimiento); }
      },
      pendientes: () => tarjetas.filter((li) => li.classList.contains('is-on') && !li.classList.contains('is-hecho')),
    };
  }

  /* ───────── Acto 2 · La temporada en vivo ───────── */
  function actoVivo(el: HTMLElement): Acto {
    const DIA = 820, T0 = 600, DIAS = 48;
    const cal = $$(el, '.vivo-cal li');
    const hoy = $(el, '.vivo-hoy'), hoyT = $(el, '[data-hoy]');
    const c = {
      hoy: el.querySelector<HTMLElement>('[data-cont="hoy"]'), hoyS: el.querySelector<HTMLElement>('[data-cont-s="hoy"]'),
      acum: $(el, '[data-cont="acum"]'), acumS: $(el, '[data-cont-s="acum"]'),
      vendido: $(el, '[data-cont="vendido"]'), agotados: $(el, '[data-cont="agotados"]'),
    };
    const pathReal = el.querySelector<SVGPathElement>('[data-real]')!, punta = el.querySelector<SVGCircleElement>('[data-punta]')!;
    const red = $(el, '[data-red]'), viajes = $(el, '.vivo-viajes');
    const celdas = $$(red, '.vivo-celdas li');
    const cedisNodo = $(red, '[data-nodo="CEDIS"]'), cedisT = $(red, '[data-cedis]'), prov = $(red, '[data-nodo="Proveedor"]');
    const resumen = $(red, '[data-resumen]');
    const ticker = $(el, '[data-ticker]');
    const lista = $(el, '.vivo-lista');
    const orden = $$(lista, '.pdt');
    const tarjeta = (id: string) => orden.find((li) => li.dataset.tarjeta === id);
    const rutinaBtn = $<HTMLButtonElement>(el, '[data-rutina-btn]'), rutinaT = $(el, '[data-rutina-t]');
    const radios = $$<HTMLInputElement>(el, 'input[name="modo-vivo"]');

    const pts = serie(REAL_27, { w: 640, h: 230, m: 12, max: 7000 }).pts;
    const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
    const FAC = [0.12, 0.12, 0.13, 0.13, 0.15, 0.17, 0.18];
    const fecha = (d: number) => { const dia = 3 + d; return dia <= 31 ? `${DOW[d % 7]} ${dia} may` : `${DOW[d % 7]} ${dia - 31} jun`; };
    const acumula = (v: number[], d: number) => { let s = 0; for (let k = 0; k < 7; k++) s += v[k] * Math.max(0, Math.min(1, (d - k * 7) / 7)); return s; };

    const porNombre = (n: string) => celdas.find((x) => x.dataset.t === n)!;
    const MTY = porNombre('Monterrey'), SAL = porNombre('Saltillo'), QRO = porNombre('Querétaro'), ZAP = porNombre('Zapopan'), GDLS = porNombre('Guadalajara Sur'), MER = porNombre('Mérida');
    const NORTE14 = new Set(celdas.filter((x) => x.closest('[data-reg="norte"]') && x !== MTY && x !== SAL).slice(0, 14));
    const hash = (x: number) => (Math.imul(x ^ 0x9e3779b9, 2654435761) >>> 0) % 100;

    const resueltos = new Set<string>();
    const autoCola: { id: string; t: number }[] = [];
    let d = 0, dEntero = -1, ultimoTk = 0, tk = 0, bonus = 0, rutinaHecha = false, tActual = 0, ultimaPintura = -1;
    // el estado que trae el HTML (póster) es el punto de partida, para que el script no deje dos colores en una celda
    const pintado: string[] = celdas.map((x) => (x.className.match(/\bis-(ok|pronto|falta|sobra|evento)\b/) || [])[1] || 'ok');

    function base(x: HTMLElement, dia: number) {
      const i = +x.dataset.i!, h = hash(i * 131 + Math.floor(dia / 3) * 977), ev = dia >= 41;
      if (h < (ev ? 14 : 6)) return 'pronto';
      if (h < (ev ? 18 : 8)) return 'falta';
      if (h < (ev ? 23 : 14)) return 'sobra';
      return 'ok';
    }
    function estadoCelda(x: HTMLElement, dia: number) {
      if (x === MTY) return resueltos.has('traspaso') ? 'ok' : dia >= 15 ? 'falta' : dia >= 12 ? 'pronto' : 'ok';
      if (x === SAL) return resueltos.has('traspaso') ? 'ok' : dia >= 10 ? 'sobra' : 'ok';
      if (NORTE14.has(x)) return resueltos.has('resurtido') ? 'ok' : dia >= 13 ? 'pronto' : base(x, dia);
      if (x === QRO) return dia >= 24 ? 'ok' : dia >= 20 ? 'pronto' : 'ok';
      if (x === ZAP) return resueltos.has('talla') ? 'ok' : dia >= 28 ? 'falta' : 'ok';
      if (x === GDLS) return resueltos.has('talla') ? 'ok' : dia >= 25 ? 'sobra' : 'ok';
      if (x === MER) return resueltos.has('evento') ? 'ok' : dia >= 34 && dia < 38 ? 'evento' : 'ok';
      return base(x, dia);
    }
    function pintaCeldas(dia: number) {
      const n = { ok: 0, pronto: 0, falta: 0, sobra: 0, evento: 0 } as Record<string, number>;
      celdas.forEach((x, i) => {
        const e = estadoCelda(x, dia);
        n[e]++;
        if (pintado[i] !== e) { x.classList.remove(`is-${pintado[i]}`); x.classList.add(`is-${e}`); pintado[i] = e; }
      });
      resumen.textContent = `${n.ok} van bien · ${n.pronto} se acaban pronto · ${n.falta} con una talla faltante · ${n.sobra} con sobrante${n.evento ? ' · 1 con un pico raro' : ''}.`;
    }
    function cedis(dia: number) {
      const v = 12100 - Math.round(dia * 118) - (resueltos.has('resurtido') ? 84 : 0) + (resueltos.has('compra') && dia >= 38 ? 360 : 0);
      cedisT.textContent = miles(v);
    }
    function contadores(dia: number) {
      const w = Math.min(6, Math.floor(dia / 7)), di = Math.min(DIAS, Math.floor(dia));
      const hoyPzs = REAL_27[w] * FAC[di % 7];
      if (c.hoy) c.hoy.textContent = dinero(hoyPzs * 731);
      if (c.hoyS) c.hoyS.textContent = di === DIAS ? 'domingo, Día del Padre' : `${Math.round(hoyPzs).toLocaleString('en-US')} piezas`;
      const fin = Math.min(49, Math.floor(dia) + 1);   // al cierre de cada día
      const real = acumula(REAL_27, fin), plan = acumula(PLAN_27, fin);
      c.acum.textContent = dinero(real * 731);
      const dif = plan ? Math.round(((real * 731) / (plan * 727) - 1) * 100) : 0;
      c.acumS.textContent = dia < 1 ? 'arranca la temporada' : `${dif >= 0 ? '+' : ''}${dif} % ${dif >= 0 ? 'arriba' : 'abajo'}`;
      c.vendido.textContent = `${((real / 31100) * 100).toFixed(1)} %`;
      c.agotados.textContent = String(Math.round(dia * 3.6) + bonus);
    }
    function curva(dia: number) {
      const f = Math.min(6, dia / 7);
      const k = Math.floor(f);
      const ps = pts.slice(0, k + 1).map((p) => [p[0], p[1]] as [number, number]);
      if (f > k && k < 6) { const a = pts[k], b = pts[k + 1], u = f - k; ps.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
      pathReal.setAttribute('d', ps.length > 1 ? suave(ps) : '');
      const last = ps[ps.length - 1];
      punta.setAttribute('cx', String(last[0])); punta.setAttribute('cy', String(last[1]));
    }
    function pintaDia(dia: number) {
      const di = Math.min(DIAS, Math.floor(dia));
      cal.forEach((li, k) => { li.classList.toggle('is-pasada', di >= (k + 1) * 7); li.classList.toggle('is-actual', di >= k * 7 && di < (k + 1) * 7); });
      hoyT.textContent = `hoy · ${fecha(di)}`;
      pintaCeldas(di);
      cedis(di);
    }
    function viaja(desde: HTMLElement, hacia: HTMLElement[]) {
      if (!movimiento) { hacia.forEach((x) => { x.classList.add('is-marca'); setTimeout(() => x.classList.remove('is-marca'), 900); }); return; }
      const base = red.getBoundingClientRect();
      const centro = (x: HTMLElement) => { const r = x.getBoundingClientRect(); return [r.left - base.left + r.width / 2, r.top - base.top + r.height / 2]; };
      const [x0, y0] = centro(desde);
      hacia.forEach((h, k) => {
        const [x1, y1] = centro(h);
        const p = document.createElement('i');
        p.style.transform = `translate(${x0}px, ${y0}px)`;
        p.style.transitionDelay = `${k * 45}ms`;
        viajes.append(p);
        requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transform = `translate(${x1}px, ${y1}px)`; }));
        setTimeout(() => { p.style.opacity = '0'; h.classList.add('is-marca'); setTimeout(() => h.classList.remove('is-marca'), 700); }, 950 + k * 45);
        setTimeout(() => p.remove(), 1400 + k * 45);
      });
    }
    function etiquetaRutina() {
      if (rutinaHecha) return;
      rutinaT.textContent = estado.modo === 'auto' ? `Mandar los ${RUTINA.traspasos} traspasos de rutina` : `Mandar las ${RUTINA.total} de rutina`;
    }
    function aparece(id: string) {
      const li = tarjeta(id);
      if (!li || li.classList.contains('is-on')) return;
      li.classList.add('is-on', 'is-nueva');
      lista.prepend(li);
      setTimeout(() => li.classList.remove('is-nueva'), 700);
      tocaAparicion();
      if (estado.modo === 'auto' && li.dataset.auto) autoCola.push({ id, t: tActual + 1600 });
    }
    function autoPendientes() {
      if (estado.modo !== 'auto') return;
      orden.forEach((li) => { if (li.classList.contains('is-on') && li.dataset.auto && !resueltos.has(li.dataset.tarjeta!)) autoCola.push({ id: li.dataset.tarjeta!, t: tActual + 600 }); });
    }

    const acto: Acto = {
      id: 'vivo', el, dur: T0 + DIAS * DIA + 1400,
      beats: [
        { t: T0 + 15 * DIA, fn: () => aparece('traspaso') },
        { t: T0 + 16 * DIA, fn: () => aparece('resurtido') },
        { t: T0 + 17 * DIA, fn: () => aparece('compra') },
        { t: T0 + 21 * DIA, fn: () => aparece('esperar') },
        { t: T0 + 29 * DIA, fn: () => aparece('talla') },
        { t: T0 + 35 * DIA, fn: () => aparece('evento') },
        { t: T0 + 41 * DIA, fn: () => el.classList.add('is-aviso') },
      ],
      reset() {
        resueltos.clear(); autoCola.length = 0; bonus = 0; rutinaHecha = false; d = 0; dEntero = -1; tActual = 0; ultimaPintura = -1;
        rutinaBtn.disabled = false; etiquetaRutina();
        el.classList.remove('is-aviso'); prov.classList.remove('is-activo');
        orden.forEach((li) => { li.classList.remove('is-on', 'is-nueva'); marcaTarjeta(li, null); lista.append(li); });
        viajes.textContent = '';
        hoy.style.setProperty('--p', '0.01');
        pathReal.setAttribute('d', ''); punta.setAttribute('cx', String(pts[0][0])); punta.setAttribute('cy', String(pts[0][1]));
        pintaDia(0); contadores(0);
        ticker.textContent = TICKER[0];
      },
      final() {
        tActual = acto.dur; d = DIAS;
        ['traspaso', 'resurtido', 'compra', 'esperar', 'talla', 'evento'].forEach((id) => { const li = tarjeta(id); if (li && !li.classList.contains('is-on')) { li.classList.add('is-on'); lista.prepend(li); } });
        el.classList.add('is-aviso');
        hoy.style.setProperty('--p', String((DIAS + 0.5) / 49));
        curva(DIAS); pintaDia(DIAS); contadores(DIAS);
        autoPendientes(); autoCola.forEach((x) => acto.envia!(x.id, 'auto')); autoCola.length = 0;
      },
      tick(t) {
        tActual = t;
        d = Math.max(0, Math.min(DIAS, (t - T0) / DIA));
        hoy.style.setProperty('--p', ((d + 0.5) / 49).toFixed(4));
        const di = Math.floor(d);
        if (di !== dEntero) { dEntero = di; pintaDia(di); contadores(d); }
        if (Math.abs(d - ultimaPintura) > 0.04) { ultimaPintura = d; curva(d); contadores(d); }
        if (t - ultimoTk > 700) { ultimoTk = t; tk = (tk + 5) % TICKER.length; ticker.textContent = TICKER[tk]; if (movimiento) { ticker.classList.remove('is-entra'); requestAnimationFrame(() => requestAnimationFrame(() => ticker.classList.add('is-entra'))); } }
        while (autoCola.length && autoCola[0].t <= t) acto.envia!(autoCola.shift()!.id, 'auto');
      },
      envia(id, como) {
        if (resueltos.has(id)) return;
        resueltos.add(id);
        marcaTarjeta(tarjeta(id), como);
        const di = Math.floor(d);
        if (id === 'traspaso') { viaja(SAL, [MTY]); bonus += 2; }
        if (id === 'resurtido') { viaja(cedisNodo, [...NORTE14]); bonus += 28; }
        if (id === 'compra') { prov.classList.add('is-activo'); viaja(prov, [cedisNodo]); bonus += 1; }
        if (id === 'talla') { viaja(GDLS, [ZAP]); bonus += 1; }
        if (id === 'evento') { MER.classList.add('is-marca'); setTimeout(() => MER.classList.remove('is-marca'), 800); }
        setTimeout(() => { pintaCeldas(di); cedis(di); contadores(d); }, movimiento ? 1000 : 0);
      },
      pendientes: () => orden.filter((li) => li.classList.contains('is-on') && !li.classList.contains('is-hecho')),
    };

    rutinaBtn.addEventListener('click', () => {
      if (rutinaHecha) return;
      orden.filter((li) => li.dataset.rutina && li.classList.contains('is-on')).forEach((li) => acto.envia!(li.dataset.tarjeta!, 'rutina'));
      bonus += 24; rutinaHecha = true; rutinaBtn.disabled = true;
      rutinaT.textContent = estado.modo === 'auto' ? `✓ ${RUTINA.traspasos} traspasos de rutina enviados` : `✓ ${RUTINA.total} de rutina enviadas`;
      anuncia(rutinaT.textContent);
      contadores(d);
      ph('planeacion_rutina', { modo: estado.modo });
    });
    radios.forEach((r) => r.addEventListener('change', () => {
      if (!r.checked) return;
      estado.modo = r.value as typeof estado.modo;
      avisa(); document.dispatchEvent(new Event('pd:modo'));
      ph('planeacion_modo', { modo: r.value, desde: 'consola' });
    }));
    escucha(() => {
      radios.forEach((r) => { r.checked = r.value === estado.modo; });
      etiquetaRutina();
      autoPendientes();
      if (!movimiento || estadoActo.get('vivo')?.terminado) { autoCola.forEach((x) => acto.envia!(x.id, 'auto')); autoCola.length = 0; }
    });
    return acto;
  }

  /* ───────── Acto 3 · Después del evento ───────── */
  function actoCierre(el: HTMLElement): Acto {
    const pasos = $$(el, '[data-paso]');
    const consol = $(el, '.cie-consol');
    const total = $(el, '.cie-quedo [data-cuenta]');
    const btn = $<HTMLButtonElement>(el, '[data-rebaja]');
    const T = [400, 2900, 5300, 8900, 12300, 15400];
    function arma(como: Como) {
      if (el.classList.contains('is-rebaja')) return;
      el.classList.add('is-rebaja');
      btn.disabled = true; btn.textContent = como === 'auto' ? '✓ Rebaja armada sola' : '✓ Rebaja armada';
      anuncia(el.querySelector('[data-rebaja-hecho]')?.textContent?.replace('Al armarla: ', '') || '✓ Rebaja armada');
      ph('planeacion_rebaja', { como });
    }
    btn.addEventListener('click', () => arma('click'));
    const muestra = (i: number) => { pasos[i].classList.add('is-on'); if (i === 3) cuenta(total, miles(+total.dataset.cuenta!)); };
    return {
      id: 'cierre', el, dur: 17200,
      beats: [
        ...T.map((t, i) => ({ t, fn: () => muestra(i) })),
        { t: 7000, fn: () => consol.classList.add('is-junta') },
        { t: 16800, fn: () => { if (estado.modo === 'auto') arma('auto'); } },
      ],
      reset() { pasos.forEach((p) => p.classList.remove('is-on')); consol.classList.remove('is-junta'); el.classList.remove('is-rebaja'); btn.disabled = false; btn.textContent = 'Armar la rebaja'; },
      final() { pasos.forEach((p) => p.classList.add('is-on')); consol.classList.add('is-junta'); total.textContent = miles(+total.dataset.cuenta!); },
    };
  }

  /* ───────── Acto 4 · Resultado ───────── */
  function actoResultado(el: HTMLElement): Acto {
    const pasos = $$(el, '[data-paso]');
    const kpis = $$(el, '.res-kpis [data-kpi]');
    const exacta = el.querySelector<HTMLElement>('.res-exact [data-kpi]');
    const btn = $<HTMLButtonElement>(el, '[data-aplicar]');
    btn.addEventListener('click', () => {
      if (el.classList.contains('is-aplicado')) return;
      el.classList.add('is-aplicado'); btn.disabled = true; btn.textContent = '✓ Aplicado a Navidad 2027';
      anuncia(el.querySelector('[data-aplicar-hecho]')?.textContent?.replace('Al aplicarlo: ', '') || '✓ Aplicado');
      ph('planeacion_aplicar');
    });
    // 0 indicadores · 1 aciertos · 2 errores · 3 lo que aprendió · 4 el ciclo
    const T = [400, 3600, 5600, 7800, 10400];
    return {
      id: 'resultado', el, dur: 12400,
      beats: [
        ...T.map((t, i) => ({ t, fn: () => {
          pasos[i].classList.add('is-on');
          if (i === 0) kpis.forEach((k, j) => setTimeout(() => cuenta(k, k.dataset.kpi!), j * 110));
          if (i === 3 && exacta) cuenta(exacta, exacta.dataset.kpi!);
        } })),
        { t: 12200, fn: () => phUnaVez('planeacion_final') },
      ],
      reset() { pasos.forEach((p) => p.classList.remove('is-on')); el.classList.remove('is-aplicado'); btn.disabled = false; btn.textContent = 'Aplicar a Navidad 2027'; [...kpis, exacta].forEach((k) => { if (k) k.textContent = k.dataset.kpi!; }); },
      final() { pasos.forEach((p) => p.classList.add('is-on')); [...kpis, exacta].forEach((k) => { if (k) k.textContent = k.dataset.kpi!; }); },
    };
  }

  /* ───────── el reproductor ───────── */
  const actos: Acto[] = [
    actoPre($(consola, '#pd-pre')), actoVivo($(consola, '#pd-vivo')),
    actoCierre($(consola, '#pd-cierre')), actoResultado($(consola, '#pd-resultado')),
  ];
  const estadoActo = new Map(actos.map((a) => [a.id, { t: 0, sig: 0, iniciado: false, terminado: false, preparado: false }]));
  const fases = new Map($$(consola, '.pdc-fases li').map((li) => [li.dataset.fase!, li]));
  const btnPausa = $(consola, '[data-ctl="pausa"]'), btnVel = $(consola, '[data-ctl="vel"]');
  let actual: Acto | null = null, vel = 1, pausa = false, dialogo = false, oculto = document.hidden, enVista = false;
  let raf = 0, ultimo = 0, ultimoToque = performance.now(), ultimaAparicion = 0, ultimoAbreme = 0;

  function tocaAparicion() { ultimaAparicion = performance.now(); }
  const detenido = () => !movimiento || pausa || dialogo || oculto || !enVista || !actual || estadoActo.get(actual.id)!.terminado;

  function corre(now: number) {
    raf = 0;
    if (!actual || detenido()) { ultimo = 0; return; }
    const e = estadoActo.get(actual.id)!;
    const dt = ultimo ? Math.min(100, now - ultimo) : 16;
    ultimo = now;
    e.t += dt * vel;
    while (e.sig < actual.beats.length && actual.beats[e.sig].t <= e.t) { actual.beats[e.sig].fn(); e.sig++; }
    actual.tick?.(e.t);
    avance(actual.id, e.t / actual.dur);
    abreme(now);
    if (e.t >= actual.dur) { termina(actual); return; }
    raf = requestAnimationFrame(corre);
  }
  function arranca() { if (!raf && !detenido()) { ultimo = 0; raf = requestAnimationFrame(corre); } }
  function para() { if (raf) { cancelAnimationFrame(raf); raf = 0; } ultimo = 0; }

  function avance(id: string, a: number) { fases.get(id)?.querySelector<HTMLElement>('.pdc-avance i')?.style.setProperty('--a', Math.min(1, a).toFixed(3)); }
  function termina(a: Acto) {
    const e = estadoActo.get(a.id)!;
    e.terminado = true;
    fases.get(a.id)?.classList.add('is-hecha');
    avance(a.id, 1);
    phUnaVez(`planeacion_fase_fin_${a.id}`);
  }
  /* Un acto se «prepara» (se esconde lo que todavía no pasa) justo antes de entrar por abajo; mientras tanto se
     queda como póster completo: nada se ve vacío ni se esconde frente al visitante. */
  function prepara(a: Acto) {
    const e = estadoActo.get(a.id)!;
    if (e.preparado) return;
    e.preparado = true;
    a.el.classList.add('is-js');
    a.reset();
  }
  function empieza(a: Acto) {
    const e = estadoActo.get(a.id)!;
    if (e.iniciado) return;
    prepara(a);
    e.iniciado = true; e.t = 0; e.sig = 0; e.terminado = false;
    phUnaVez(`planeacion_fase_${a.id}`);
  }
  function cambiaActual(a: Acto) {
    if (actual === a) return;
    para();
    actual = a;
    fases.forEach((li, id) => li.classList.toggle('is-actual', id === a.id));
    fases.get('instruccion')?.classList.add('is-hecha');
    if (movimiento) empieza(a);
    arranca();
  }
  /* «Ábreme»: si nadie toca nada en 6 s, la tarjeta pendiente más nueva late (y la simulación sigue) */
  function abreme(now: number) {
    if (!actual?.pendientes || now - Math.max(ultimoToque, ultimaAparicion) < 6000 || now - ultimoAbreme < 9000) return;
    const p = actual.pendientes();
    if (!p.length) return;
    ultimoAbreme = now;
    const li = actual.id === 'vivo' ? p[0] : p[p.length - 1];
    li.classList.add('is-abreme');
    setTimeout(() => li.classList.remove('is-abreme'), 4200);
  }

  /* ───────── controles ───────── */
  btnPausa.addEventListener('click', () => {
    pausa = !pausa;
    btnPausa.setAttribute('aria-pressed', String(pausa));
    btnPausa.setAttribute('aria-label', pausa ? 'Continuar' : 'Pausa');
    if (pausa) para(); else arranca();
    ph('planeacion_pausa', { pausa });
  });
  btnVel.addEventListener('click', () => {
    vel = vel === 1 ? 2 : 1;
    btnVel.setAttribute('aria-pressed', String(vel === 2));
    ph('planeacion_velocidad', { vel });
  });
  $(consola, '[data-ctl="saltar"]').addEventListener('click', () => {
    if (!actual) return;
    para();
    const e = estadoActo.get(actual.id)!;
    e.iniciado = true; e.sig = actual.beats.length; e.t = actual.dur;
    actual.final();
    termina(actual);
    ph('planeacion_saltar', { acto: actual.id });
  });
  $(consola, '[data-ctl="otra"]').addEventListener('click', () => {
    if (!actual) return;
    para();
    const e = estadoActo.get(actual.id)!;
    e.iniciado = false; e.preparado = false;
    fases.get(actual.id)?.classList.remove('is-hecha');
    avance(actual.id, 0);
    if (movimiento) { empieza(actual); pausa = false; btnPausa.setAttribute('aria-pressed', 'false'); arranca(); }
    ph('planeacion_otra_vez', { acto: actual.id });
  });
  consola.querySelectorAll<HTMLAnchorElement>('.pdc-fases a').forEach((a) => a.addEventListener('click', () => ph(a.dataset.evento || 'planeacion_fase_click')));

  /* ───────── el diálogo del detalle ───────── */
  const dlg = document.getElementById('pd-dialogo') as HTMLDialogElement;
  const cuerpo = $(dlg, '.pdd-cuerpo'), vivoAria = $(dlg, '.pdd-vivo');
  let abierto: HTMLElement | null = null, casa: HTMLElement | null = null, cierreT = 0;
  const actoDe = (id: string) => actos.find((a) => a.el.querySelector(`[data-tarjeta="${id}"]`));
  function abre(id: string) {
    const art = document.getElementById(`det-${id}`);
    if (!art) return;
    casa = art.parentElement; abierto = art;
    cuerpo.append(art);
    dlg.setAttribute('aria-labelledby', `det-${id}-h`);
    vivoAria.textContent = '';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dialogo = true; para();
    consola.querySelectorAll('.pdt.is-abreme').forEach((x) => x.classList.remove('is-abreme'));
    ph('planeacion_tarjeta_abrir', { id });
  }
  dlg.addEventListener('close', () => {
    if (cierreT) { clearTimeout(cierreT); cierreT = 0; }
    if (abierto && casa) casa.append(abierto);
    abierto = null; dialogo = false; arranca();
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $(dlg, '.pdd-cierra').addEventListener('click', () => dlg.close());
  cuerpo.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-envia]');
    if (!b) return;
    const id = b.dataset.envia!;
    actoDe(id)?.envia?.(id, 'click');
    vivoAria.textContent = abierto?.querySelector('.pdd-hecho')?.textContent || '✓ Enviado';
    ph('planeacion_enviar', { id, modo: estado.modo });
    cierreT = window.setTimeout(() => { if (dlg.open) dlg.close(); }, 1600);
  });
  consola.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-abre]');
    if (!a) return;
    e.preventDefault();
    abre(a.dataset.abre!);
  });

  /* ───────── vista, pestaña y toques ───────── */
  const porEl = new Map(actos.map((a) => [a.el, a]));
  const ioActo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) cambiaActual(porEl.get(e.target as HTMLElement)!); }), { rootMargin: '-40% 0px -55% 0px' });
  actos.forEach((a) => ioActo.observe(a.el));
  // se prepara al acercarse por abajo; si se llega desde arriba (o ya estaba a medias en pantalla), se queda como póster
  const ioPrepara = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting || !movimiento) return;
    const a = porEl.get(en.target as HTMLElement)!, e = estadoActo.get(a.id)!;
    if (e.preparado || e.iniciado) return;
    if (en.boundingClientRect.top > 0) prepara(a);
    else { a.final(); e.iniciado = true; e.terminado = true; fases.get(a.id)?.classList.add('is-hecha'); }
  }), { rootMargin: '0px 0px 35% 0px' });
  actos.forEach((a) => ioPrepara.observe(a.el));
  const ioConsola = new IntersectionObserver((es) => {
    enVista = es[0].isIntersecting;
    activa('consola', enVista);
    if (enVista) arranca(); else para();
  }, { threshold: 0 });
  ioConsola.observe(consola);
  document.addEventListener('visibilitychange', () => { oculto = document.hidden; if (oculto) para(); else arranca(); });
  const toque = () => { ultimoToque = performance.now(); };
  document.addEventListener('pointerdown', toque, { passive: true });
  document.addEventListener('keydown', toque);

  function aplicaMovimiento() {
    movimiento = mqMov.matches;
    consola.classList.toggle('is-js', true);
    consola.classList.toggle('is-quieta', !movimiento);
    actos.forEach((a) => {
      const e = estadoActo.get(a.id)!;
      a.el.classList.toggle('is-js', movimiento && e.preparado);
      if (!movimiento) { a.final(); e.iniciado = true; e.terminado = true; fases.get(a.id)?.classList.add('is-hecha'); }
    });
    if (movimiento) arranca(); else para();
  }
  mqMov.addEventListener('change', aplicaMovimiento);
  aplicaMovimiento();
}
