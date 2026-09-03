// El widget flotante de Equipo: una esfera abajo a la derecha que vive en TODO
// el CRM. Cerrada, es donde se ve que pasó algo —cuántos mensajes sin leer,
// quién está en línea, y el último mensaje que llegó como burbuja— sin dejar
// de trabajar en lo que uno estaba. Un clic la abre a pantalla completa (el
// chat entero encima del CRM, sin cambiar de pestaña) y otro clic o Esc la
// cierra y uno sigue exactamente donde estaba.
//
// Por qué no es un tab: el chat se abre veinte veces al día y cada vez que era
// pestaña uno perdía la pantalla en la que estaba. Encima de todo, no se pierde.
//
// Cerrada, el widget tiene su propio oído (useRealtime + árbol cada 2 min);
// abierta, el oído es el del chat y este se calla, para no tener dos sockets
// ni dos presencias del mismo usuario.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Arbol as A, Canal as C, Mensaje as M } from './api';
import { api, hace } from './api';
import { useRealtime, type Senal } from './useRealtime';
import { Avatar, textoPlano, useCss } from './ui';
import { P } from '../../../../lib/crm/paleta';
import { lazySeguro } from '../../../../lib/ui/lazySeguro';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';

const Equipo = lazySeguro(() => import('./Equipo'));

type Burbuja = { id: string; canal: C; msg: M; importante: boolean; mencion: boolean };

const CSS = `
.eqf{position:fixed;right:22px;bottom:22px;z-index:899;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:inherit;
  --eq-tinta:#1e1a33;--eq-gris:#6f6a86;--eq-linea:#ebe8f5;--eq-panel:#fff;--eq-lila:${P.violetaAgua};--eq-morado:${P.violeta};--eq-morado-tinta:${P.violetaTinta}}
.eqf *{box-sizing:border-box}
.eqf.movil{right:14px;bottom:calc(var(--crm-bottomnav-h,64px) + 14px)}
.eqf-fila{display:flex;align-items:flex-end;gap:10px}
.eqf-orbe{position:relative;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;color:#fff;padding:0;
  background:linear-gradient(135deg,#7C6BF0 0%,${P.violeta} 48%,${P.rosa} 120%);
  box-shadow:0 10px 30px rgba(124,107,240,.42),0 2px 6px rgba(60,30,140,.18),inset 0 1px 0 rgba(255,255,255,.35);
  display:inline-flex;align-items:center;justify-content:center;transition:transform .18s cubic-bezier(.2,.8,.2,1.2),box-shadow .18s}
.eqf-orbe:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 14px 36px rgba(124,107,240,.5),0 3px 8px rgba(60,30,140,.2),inset 0 1px 0 rgba(255,255,255,.35)}
.eqf-orbe:active{transform:scale(.96)}
.eqf-orbe:focus-visible{outline:3px solid ${P.violetaAgua};outline-offset:2px}
.eqf-orbe svg{filter:drop-shadow(0 1px 1px rgba(40,20,100,.25))}
.eqf-orbe .brillo{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.38),transparent 55%);pointer-events:none}
.eqf-orbe .anillo{position:absolute;inset:-3px;border-radius:50%;border:2.5px solid ${P.violeta};opacity:0;pointer-events:none;background:transparent}
.eqf-orbe.pulsa .anillo{animation:eqf-pulso 1.4s ease-out 3}
@keyframes eqf-pulso{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.55);opacity:0}}
.eqf-orbe.latido{animation:eqf-latido .5s ease-out}
@keyframes eqf-latido{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}
.eqf-n{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:${P.violetaTinta};color:#fff;
  font-size:.75rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.18);letter-spacing:-.01em}
.eqf-n.men{background:${P.rosa}}
.eqf-gente{display:flex;align-items:center;gap:6px;padding:6px 10px 6px 6px;border-radius:999px;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border:1px solid rgba(155,140,250,.28);box-shadow:0 6px 20px rgba(60,30,140,.12);font-size:.75rem;font-weight:700;color:#3d3560;white-space:nowrap;
  transform-origin:right center;animation:eqf-entra .25s ease-out}
.eqf-gente .eq-av .pt{border-color:#fff}
.eqf-gente .pila{display:flex}
.eqf-gente .pila .eq-av{margin-left:-7px;border:2px solid #fff}
.eqf-gente .pila .eq-av:first-child{margin-left:0}
.eqf-gente .st{color:${P.verdeTinta}}
.eqf-gente .st.au{color:${P.ambarTinta}}
.eqf-gente .st.fu{color:#8b86a3;font-weight:600}
@keyframes eqf-entra{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
.eqf-burbujas{display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:min(360px,calc(100vw - 28px))}
.eqf-bur{position:relative;width:min(360px,calc(100vw - 28px));text-align:left;border:1px solid rgba(155,140,250,.3);border-radius:16px;background:#fff;padding:11px 36px 11px 12px;cursor:pointer;
  box-shadow:0 14px 40px rgba(60,30,140,.18),0 2px 6px rgba(0,0,0,.06);display:flex;gap:10px;align-items:flex-start;animation:eqf-entra .28s cubic-bezier(.2,.8,.2,1);color:#1e1a33;font:inherit}
.eqf-bur:hover{border-color:${P.violeta}}
.eqf-bur.imp{border-color:${P.ambar};box-shadow:0 14px 40px rgba(232,168,56,.22),0 2px 6px rgba(0,0,0,.06)}
.eqf-bur.men{border-color:${P.rosa}}
.eqf-bur .q{font-size:.75rem;color:#6f6a86;display:flex;gap:5px;align-items:center;margin-bottom:3px;min-width:0;white-space:nowrap}
.eqf-bur .q>*{flex:0 0 auto}
.eqf-bur .q b{color:#1e1a33;font-weight:800;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis}
.eqf-bur .q .imp{color:${P.ambarTinta};font-weight:800;text-transform:uppercase;font-size:.625rem;letter-spacing:.06em;background:${P.ambarAgua};padding:1px 6px;border-radius:6px}
.eqf-bur .q .men{color:${P.rosaTinta};font-weight:800;text-transform:uppercase;font-size:.625rem;letter-spacing:.06em;background:${P.rosaAgua};padding:1px 6px;border-radius:6px}
.eqf-bur .t{font-size:.8125rem;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}
.eqf-bur .cuerpo{flex:1;min-width:0}
.eqf-bur .x{position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:8px;border:0;background:none;color:#8b86a3;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.eqf-bur .x:hover{background:${P.violetaAgua};color:${P.violetaTinta}}
.eqf-bur .barra{position:absolute;left:14px;right:14px;bottom:0;height:2px;border-radius:2px;background:${P.violeta};transform-origin:left;animation:eqf-barra 9s linear forwards}
@keyframes eqf-barra{from{transform:scaleX(1)}to{transform:scaleX(0)}}
/* Abierto: el chat entero encima del CRM. */
.eqf-fondo{position:fixed;inset:0;z-index:960;background:rgba(20,14,44,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:eqf-fade .2s ease-out}
@keyframes eqf-fade{from{opacity:0}to{opacity:1}}
.eqf-panel{position:fixed;inset:12px;z-index:961;border-radius:18px;overflow:hidden;background:#fff;--eq-top:24px;
  box-shadow:0 30px 90px rgba(20,14,44,.45),0 0 0 1px rgba(255,255,255,.4);animation:eqf-sube .26s cubic-bezier(.2,.8,.2,1)}
@keyframes eqf-sube{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
.eqf-panel .eq{height:calc(100dvh - 24px);min-height:0;border:0;border-radius:0}
.eqf-panel:not(.movil) .eq-canal>.eq-cab:first-child{padding-right:52px}
.eqf-x{position:fixed;top:2px;right:2px;z-index:962;width:40px;height:40px;border-radius:50%;border:2px solid #fff;cursor:pointer;color:#fff;
  background:linear-gradient(135deg,#7C6BF0,${P.rosa});box-shadow:0 6px 18px rgba(60,30,140,.35);display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}
.eqf-x:hover{transform:scale(1.08) rotate(90deg)}
.eqf-panel.movil{inset:0;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top)}
.eqf-panel.movil .eq{height:calc(100dvh - env(safe-area-inset-top))}
@media (prefers-reduced-motion:reduce){.eqf *,.eqf-panel,.eqf-fondo{animation:none!important;transition:none!important}}
`;

let cssPuesto = false;
function usarCss() {
  useEffect(() => {
    if (cssPuesto || typeof document === 'undefined') return;
    const s = document.createElement('style'); s.id = 'eqf-css'; s.textContent = CSS;
    document.head.appendChild(s); cssPuesto = true;
  }, []);
}

const ICONO = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 5h11a2 2 0 012 2v7a2 2 0 01-2 2h-1v3l-4-3H12" fill="currentColor" opacity=".28" stroke="none" />
    <path d="M3 9a2 2 0 012-2h9a2 2 0 012 2v6a2 2 0 01-2 2H9l-4 3v-3H5a2 2 0 01-2-2z" />
  </svg>
);

/** Qué dice un mensaje en una línea, para la burbuja. */
function resumen(m: M): string {
  const t = textoPlano(m.texto || '').replace(/\*\*/g, '').trim();
  if (t) return t;
  const a = m.adjuntos[0];
  if (!a) return '';
  if (a.tipo === 'audio') return a.transcripcion ? `🎤 ${a.transcripcion}` : 'Mensaje de voz';
  if (a.tipo === 'imagen') return 'Envió una imagen';
  if (a.tipo === 'gif') return 'Envió un GIF';
  return a.nombre || 'Envió un archivo';
}

export default function EquipoFlotante({ tabActual }: { tabActual: string }) {
  useCss();   // el avatar y los colores son los del chat
  usarCss();
  const movil = useIsMobile();
  const [arbol, setArbol] = useState<A | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [pulsa, setPulsa] = useState(0);
  const contadores = useRef<Record<string, number>>({});
  const vistos = useRef<Set<string>>(new Set());
  const yo = arbol?.yo || null;

  const cargarArbol = useCallback(async () => {
    try { const a = await api.arbol(); setArbol(a); setSinAcceso(false); return a; }
    catch (e: any) { if (/401|403|sesión|permiso/i.test(String(e?.message))) setSinAcceso(true); return null; }
  }, []);

  // Los canales que cuentan: los silenciados (Sistema por defecto) no suman ni avisan.
  const { noLeidos, menciones } = useMemo(() => {
    let n = 0, m = 0;
    for (const c of arbol?.canales || []) { if (c.silenciado) continue; n += c.no_leidos; m += c.menciones; }
    return { noLeidos: n, menciones: m };
  }, [arbol]);

  const mostrarBurbuja = useCallback((canal: C, msg: M) => {
    if (vistos.current.has(msg.id)) return;
    vistos.current.add(msg.id);
    const mencion = !!yo && msg.menciones.some(x => x.id === yo.id);
    setBurbujas(b => [...b.filter(x => x.msg.id !== msg.id), { id: msg.id, canal, msg, importante: canal.importante, mencion }].slice(-3));
    setPulsa(p => p + 1);
    // Se va sola a los 9 s, salvo la de un canal importante: esa se queda hasta que uno la toque.
    if (!canal.importante) setTimeout(() => setBurbujas(b => b.filter(x => x.id !== msg.id)), 9000);
  }, [yo]);

  // Un árbol nuevo: si a un canal le crecieron los no leídos y no llegó la
  // señal del mensaje (modo sondeo), se trae el último para la burbuja.
  const compararArbol = useCallback(async (a: A) => {
    const prev = contadores.current;
    const nuevos: Record<string, number> = {};
    const crecieron: C[] = [];
    for (const c of a.canales) { nuevos[c.id] = c.no_leidos; if (prev[c.id] !== undefined && c.no_leidos > prev[c.id] && !c.silenciado) crecieron.push(c); }
    contadores.current = nuevos;
    for (const c of crecieron.slice(0, 3)) {
      try {
        const r = await api.mensajes({ canal_id: c.id });
        const ult = [...r.mensajes].reverse().find(m => m.autor.id !== a.yo.id && !m.borrado);
        if (ult) mostrarBurbuja(c, ult);
      } catch { /* la burbuja es cortesía */ }
    }
  }, [mostrarBurbuja]);

  useEffect(() => { cargarArbol().then(a => { if (a) contadores.current = Object.fromEntries(a.canales.map(c => [c.id, c.no_leidos])); }); }, [cargarArbol]);
  useEffect(() => {
    if (abierto) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') cargarArbol().then(a => a && compararArbol(a)); }, 120_000);
    return () => clearInterval(t);
  }, [abierto, cargarArbol, compararArbol]);

  const alSenal = useCallback((s: Senal) => {
    if (s.tipo === 'poll' || s.tipo === 'canal' || s.tipo === 'presencia' || s.tipo === 'reunion') { cargarArbol().then(a => a && compararArbol(a)); return; }
    if (s.tipo === 'msg' && s.autor_id !== yo?.id) {
      const c = arbol?.canales.find(x => x.id === s.canal_id);
      if (!c) { cargarArbol(); return; }
      setArbol(a => a ? { ...a, canales: a.canales.map(x => x.id === s.canal_id ? { ...x, no_leidos: x.no_leidos + 1, ultimo_at: new Date().toISOString() } : x) } : a);
      contadores.current[s.canal_id] = (contadores.current[s.canal_id] || 0) + 1;
      if (!c.silenciado) api.uno(s.id).then(r => mostrarBurbuja(c, r.mensaje)).catch(() => null);
    }
  }, [yo?.id, arbol, cargarArbol, compararArbol, mostrarBurbuja]);
  // Cerrado escucha el widget; abierto escucha el chat.
  const { enLinea } = useRealtime(!abierto && yo ? yo.id : null, alSenal);

  const abrir = useCallback((canalId?: string, msgId?: string, hiloDe?: string | null) => {
    const u = new URL(window.location.href);
    if (canalId) {
      u.searchParams.set('canal', canalId);
      if (msgId) u.searchParams.set('msg', msgId); else u.searchParams.delete('msg');
      if (hiloDe) u.searchParams.set('hilo', hiloDe); else u.searchParams.delete('hilo');
    }
    history.replaceState(null, '', u.toString());
    setBurbujas([]);
    setAbierto(true);
  }, []);
  const cerrar = useCallback(() => {
    setAbierto(false);
    // La URL vuelve a la pestaña en la que uno estaba: el chat no es un lugar.
    const u = new URL(window.location.href);
    u.searchParams.set('tab', tabActual === 'equipo' ? 'dashboard' : tabActual);
    for (const k of ['canal', 'msg', 'hilo']) u.searchParams.delete(k);
    history.replaceState(null, '', u.toString());
    cargarArbol().then(a => { if (a) contadores.current = Object.fromEntries(a.canales.map(c => [c.id, c.no_leidos])); });
  }, [tabActual, cargarArbol]);

  // Ligas: ?tab=equipo&canal= al cargar (push, campana, liga pegada), el evento
  // crm:equipo que manda irADestino, y crm:ir (una pastilla que sale del chat).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'equipo') setAbierto(true);
    const ab = () => { setBurbujas([]); setAbierto(true); };
    const ce = (e: Event) => { if (!String((e as CustomEvent).detail || '').startsWith('equipo')) setAbierto(false); };
    window.addEventListener('crm:equipo', ab);
    window.addEventListener('crm:ir', ce);
    return () => { window.removeEventListener('crm:equipo', ab); window.removeEventListener('crm:ir', ce); };
  }, []);
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest?.('.eq-lado, .eq-luz, .eq-modal, .eq-menu')) cerrar(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [abierto, cerrar]);

  // El título de la pestaña del navegador cuenta lo que espera.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = noLeidos > 0 && !abierto ? `(${noLeidos > 99 ? '99+' : noLeidos}) ${base}` : base;
  }, [noLeidos, abierto]);

  if (sinAcceso || !arbol || !yo) return null;

  const otros = arbol.personas.filter(x => x.id !== yo.id && x.id !== 'a7de2512-2bbc-4234-82e9-db4e6b706abf');
  const estadoDe = (x: typeof otros[number]) => enLinea.includes(x.id) ? 'activo' : (x.estado !== 'fuera' && x.visto_at && Date.now() - new Date(x.visto_at).getTime() < 15 * 60_000 ? 'ausente' : 'fuera');
  const presentes = otros.map(x => ({ p: x, e: estadoDe(x) })).filter(x => x.e !== 'fuera');
  const uno = otros.length === 1 ? { p: otros[0], e: estadoDe(otros[0]) } : null;

  return (
    <>
      {!abierto && (
        <div className={'eqf' + (movil ? ' movil' : '')}>
          {burbujas.length > 0 && (
            <div className="eqf-burbujas">
              {burbujas.map(b => (
                <div key={b.id} role="button" tabIndex={0} className={'eqf-bur' + (b.importante ? ' imp' : b.mencion ? ' men' : '')}
                  onClick={() => abrir(b.canal.id, b.msg.id, b.msg.hilo_de)} onKeyDown={e => { if (e.key === 'Enter') abrir(b.canal.id, b.msg.id, b.msg.hilo_de); }}>
                  <Avatar p={b.msg.autor} size={34} />
                  <div className="cuerpo">
                    <div className="q"><b>{b.msg.autor.nombre}</b><span>· {b.canal.tipo === 'directo' ? 'directo' : `#${b.canal.nombre}`}</span><span>· {hace(b.msg.created_at)}</span>{b.importante && <span className="imp">Importante</span>}{!b.importante && b.mencion && <span className="men">Mención</span>}</div>
                    <div className="t">{resumen(b.msg)}</div>
                  </div>
                  <button className="x" aria-label="Descartar" onClick={e => { e.stopPropagation(); setBurbujas(x => x.filter(y => y.id !== b.id)); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                  {!b.importante && <span className="barra" />}
                </div>
              ))}
            </div>
          )}
          <div className="eqf-fila">
            {/* Quién está: con una sola persona enfrente (Aaron ↔ Andrea) se dice
                con nombre; con varias, la pila de los presentes. */}
            {!movil && (uno ? (
              <div className="eqf-gente" title={uno.p.visto_at ? `Visto ${hace(uno.p.visto_at)}` : undefined}>
                <Avatar p={uno.p} size={24} estado={uno.e} />
                <span>{uno.p.nombre.split(' ')[0]}</span>
                <span className={'st' + (uno.e === 'ausente' ? ' au' : uno.e === 'fuera' ? ' fu' : '')}>{uno.e === 'activo' ? 'en línea' : uno.e === 'ausente' ? 'ausente' : uno.p.visto_at ? hace(uno.p.visto_at) : 'sin conectar'}</span>
              </div>
            ) : presentes.length > 0 ? (
              <div className="eqf-gente" title={presentes.map(x => x.p.nombre).join(', ')}>
                <span className="pila">{presentes.slice(0, 4).map(x => <Avatar key={x.p.id} p={x.p} size={24} estado={x.e} />)}</span>
                <span className="st">{presentes.length === 1 ? 'en línea' : `${presentes.length} en línea`}</span>
              </div>
            ) : null)}
            <button key={pulsa} className={'eqf-orbe' + (pulsa ? ' pulsa latido' : '')} onClick={() => abrir()} aria-label={`Abrir Equipo${noLeidos ? `, ${noLeidos} sin leer` : ''}`} title="Equipo">
              <span className="brillo" /><span className="anillo" />
              {ICONO}
              {noLeidos > 0 && <span className={'eqf-n' + (menciones > 0 ? ' men' : '')}>{noLeidos > 99 ? '99+' : noLeidos}</span>}
            </button>
          </div>
        </div>
      )}
      {abierto && (
        <>
          <div className="eqf-fondo" onClick={cerrar} />
          <div className={'eqf-panel' + (movil ? ' movil' : '')} role="dialog" aria-label="Equipo">
            <Suspense fallback={<div className="eq"><Cargando texto="Abriendo Equipo…" /></div>}>
              <Equipo onCerrar={cerrar} />
            </Suspense>
          </div>
          {!movil && <button className="eqf-x" onClick={cerrar} aria-label="Cerrar Equipo (Esc)" title="Cerrar (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>}
        </>
      )}
    </>
  );
}
