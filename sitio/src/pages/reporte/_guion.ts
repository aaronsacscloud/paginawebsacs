// El guion del reporte público: pestañas, acordeones, contadores y el rastreo de
// apertura. `REP` lo inyecta la página con define:vars.
export default `
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const lento = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* pestañas — solo el reporte de TRABAJO las tiene. El de entregas es un
   documento de corrido, y aquí reventaba con «addEventListener of null»,
   matando de paso el rastreo de apertura que va más abajo. */
$('#tabs')?.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.panel').forEach(p => p.classList.toggle('on', p.dataset.p === b.dataset.t));
  animar(b.dataset.t);
  window.scrollTo({ top: $('#tabs').offsetTop - 4, behavior: lento ? 'auto' : 'smooth' });
});

/* acordeones */
$$('.cab').forEach(c => c.addEventListener('click', () => c.parentElement.classList.toggle('ab')));

/* conteo de los números ancla */
function subir(el, hasta, ms) {
  if (lento) { el.textContent = hasta.toLocaleString('es-MX'); return; }
  const t0 = performance.now();
  (function paso(t) {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(hasta * (1 - Math.pow(1 - k, 3))).toLocaleString('es-MX');
    if (k < 1) requestAnimationFrame(paso);
  })(t0);
}
$$('.ancla .n').forEach((el, i) => setTimeout(() => subir(el, Number(el.dataset.n), 900), 120 * i));

/* barras: se llenan al entrar a su pestaña */
const hechas = new Set();
function animar(tab) {
  if (hechas.has(tab)) return; hechas.add(tab);
  if (tab === 'soporte') $$('#temas i').forEach((i, k) => setTimeout(() => i.style.width = i.dataset.w + '%', 60 * k));
  if (tab === 'oportunidades') {
    $$('.barra i').forEach(i => i.style.width = i.dataset.w + '%');
    if ($('#usa')) subir($('#usa'), 15, 800);
  }
}

/* reacción: se guarda de verdad */
$$('.rb').forEach(b => b.addEventListener('click', async () => {
  $$('.rb').forEach(x => x.classList.toggle('on', x === b));
  if ($('#gr')) $('#gr').style.display = 'block';
  try {
    await fetch('/api/reportes/reaccion', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporte_id: REP, reaccion: b.dataset.r }) });
  } catch { /* la reacción es un extra: si falla, el reporte se sigue leyendo */ }
}));

/* ── Rastreo de apertura ──
   El visitor_id vive en localStorage para que una recarga no cuente como otra
   apertura. Los segundos se mandan al salir con sendBeacon: un fetch normal se
   cancela cuando la pestaña se cierra, que es justo cuando hay que mandarlo. */
const KV = 'sacs_visitor';
let visitor = null;
try { visitor = localStorage.getItem(KV); if (!visitor) { visitor = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(KV, visitor); } } catch {}
const t0 = Date.now();
fetch('/api/reportes/vista', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reporte_id: REP, visitor_id: visitor }) }).catch(() => {});
let cerrado = false;
function cerrar() {
  if (cerrado) return; cerrado = true;
  const seg = Math.round((Date.now() - t0) / 1000);
  if (seg < 3) return;
  try {
    navigator.sendBeacon('/api/reportes/vista',
      new Blob([JSON.stringify({ reporte_id: REP, visitor_id: visitor, segundos: seg })], { type: 'application/json' }));
  } catch {}
}
addEventListener('pagehide', cerrar);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cerrar(); });

/* Al imprimir se abre todo: un PDF con acordeones cerrados pierde el detalle. */
addEventListener('beforeprint', () => {
  $$('.fila').forEach(f => f.classList.add('ab'));
  $$('.ent details').forEach(d => d.open = true);
  $$('.barra i,#temas i').forEach(i => i.style.width = i.dataset.w + '%');
});
`;
