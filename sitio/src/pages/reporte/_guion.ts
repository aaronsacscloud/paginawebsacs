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
/* La COPIA que recibe quien mandó el correo trae ?copia=1: abrirla no cuenta
   como apertura del cliente, o el «lo leyó» del CRM mentiría. */
const INTERNO = new URLSearchParams(location.search).has('copia');
if (!INTERNO) fetch('/api/reportes/vista', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reporte_id: REP, visitor_id: visitor }) }).catch(() => {});
let cerrado = INTERNO;
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

/* ── «Revisado» por punto (entregas y curso) ──
   Se pinta al instante y se guarda detrás; si no se guardó, se regresa y se
   dice. Firmado el documento, los botones llegan deshabilitados del servidor. */
function aviso(t) {
  const a = $('#aviso'); if (!a) return;
  a.textContent = t; a.classList.add('on');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('on'), 3200);
}
function pintarRev(bt, si) {
  bt.setAttribute('aria-pressed', si ? 'true' : 'false');
  bt.classList.toggle('on', si);
  const t = bt.querySelector('.rt'); if (t) t.textContent = si ? 'Revisado' : 'Marcar como revisado';
  const it = bt.closest('.it'); if (it) it.classList.toggle('revisada', si);
  if ($('#nrev')) $('#nrev').textContent = $$('.rev[aria-pressed="true"]').length;
}
$$('.rev').forEach(bt => bt.addEventListener('click', async () => {
  if (bt.disabled || bt.dataset.enviando) return;
  const si = bt.getAttribute('aria-pressed') !== 'true';
  pintarRev(bt, si);
  bt.dataset.enviando = '1';
  try {
    const r = await fetch('/api/reportes/revisado', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporte_id: REP, llave: bt.dataset.k, revisado: si }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { pintarRev(bt, !si); aviso(j.error || 'No se pudo guardar. Intenta de nuevo.'); }
  } catch { pintarRev(bt, !si); aviso('Sin conexión: no se guardó.'); }
  delete bt.dataset.enviando;
}));

/* ── La firma ──
   Un trazo con el dedo o el mouse sobre un canvas. Se dibuja a la densidad de
   la pantalla para que no salga pixeleado, y el recuadro no hace scroll
   mientras se firma (touch-action:none en el CSS). */
const pad = $('#fpad');
if (pad) {
  const ctx = pad.getContext('2d');
  let trazado = false, dibujando = false, ultimo = null;
  function preparar() {
    const r = pad.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const previo = trazado ? pad.toDataURL('image/png') : null;
    pad.width = Math.max(1, Math.round(r.width * dpr)); pad.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1e1a33'; ctx.fillStyle = '#1e1a33';
    if (previo) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height); im.src = previo; }
  }
  preparar();
  let tr = 0;
  addEventListener('resize', () => { cancelAnimationFrame(tr); tr = requestAnimationFrame(preparar); }, { passive: true });
  const punto = e => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  pad.addEventListener('pointerdown', e => {
    dibujando = true; ultimo = punto(e);
    try { pad.setPointerCapture(e.pointerId); } catch {}
    ctx.beginPath(); ctx.arc(ultimo[0], ultimo[1], 1.2, 0, Math.PI * 2); ctx.fill();
    if (!trazado) { trazado = true; if ($('#fhint')) $('#fhint').style.display = 'none'; }
    e.preventDefault();
  });
  pad.addEventListener('pointermove', e => {
    if (!dibujando) return;
    const p = punto(e);
    ctx.beginPath(); ctx.moveTo(ultimo[0], ultimo[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    ultimo = p; e.preventDefault();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { dibujando = false; }));
  $('#fborra').addEventListener('click', () => {
    ctx.clearRect(0, 0, pad.width, pad.height); trazado = false;
    if ($('#fhint')) $('#fhint').style.display = '';
  });

  $('#fform').addEventListener('submit', async e => {
    e.preventDefault();
    const err = t => { $('#ferr').textContent = t; };
    const nombre = $('#fnombre').value.replace(/\\s+/g, ' ').trim();
    if (nombre.length < 3) { err('Escribe tu nombre completo.'); $('#fnombre').focus(); return; }
    if (!trazado) { err('Dibuja tu firma en el recuadro.'); return; }
    if (!$('#facepto').checked) { err('Marca la casilla para confirmar.'); return; }
    err('');
    const bt = $('#fbtn'); bt.disabled = true; bt.textContent = 'Firmando…';
    const trazo = pad.toDataURL('image/png');
    try {
      const r = await fetch('/api/reportes/firma', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporte_id: REP, nombre: nombre, trazo: trazo, acepto: true }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { err(j.error || 'No se pudo guardar la firma.'); bt.disabled = false; bt.textContent = 'Firmar'; return; }
      firmado(j.firma, trazo);
    } catch { err('Sin conexión: no se guardó la firma.'); bt.disabled = false; bt.textContent = 'Firmar'; }
  });

  /* Firmado: se pinta aquí mismo, sin recargar —recargar contaría otra
     apertura en el CRM—. Con textContent: el nombre lo escribió el cliente. */
  function firmado(f, trazo) {
    const caja = document.createElement('div'); caja.className = 'fhecha';
    const img = document.createElement('img'); img.className = 'ftrazo'; img.src = trazo; img.alt = 'Firma de ' + f.nombre;
    const ln = document.createElement('div'); ln.className = 'flinea';
    const nom = document.createElement('div'); nom.className = 'fnom'; nom.textContent = f.nombre;
    const ley = document.createElement('div'); ley.className = 'fley'; ley.textContent = '«' + f.leyenda + '»';
    const cu = document.createElement('div'); cu.className = 'fcuando';
    cu.textContent = 'Firmado electrónicamente el ' + new Date(f.at).toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    caja.append(img, ln, nom, ley, cu);
    $('#fform').replaceWith(caja);
    const imp = $('.fimpresa'); if (imp) imp.remove();
    $$('.rev').forEach(b => { b.disabled = true; });
    const fr = $('.frev'); if (fr) fr.firstChild.textContent = 'Revisó ';
    aviso('¡Listo! Tu firma quedó guardada.');
  }
}

/* Al imprimir se abre todo: un PDF con acordeones cerrados pierde el detalle. */
addEventListener('beforeprint', () => {
  $$('.fila').forEach(f => f.classList.add('ab'));
  $$('.ent details').forEach(d => d.open = true);
  $$('.barra i,#temas i').forEach(i => i.style.width = i.dataset.w + '%');
});
`;
