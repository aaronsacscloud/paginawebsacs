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
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
.eqf.movil{right:14px;bottom:calc(var(--crm-bottomnav-h,64px) + 56px)}
.eqf-fila{display:flex;align-items:flex-end;gap:10px}
.eqf-orbe{position:relative;width:64px;height:64px;border-radius:50%;border:0;cursor:pointer;padding:0;overflow:visible;
  background:none;display:inline-flex;align-items:center;justify-content:center;
  transition:transform .18s cubic-bezier(.2,.8,.2,1.2),filter .18s}
.eqf-orbe:hover{transform:translateY(-2px) scale(1.06)}
.eqf-orbe:active{transform:scale(.96)}
.eqf-orbe:focus-visible{outline:3px solid ${P.violeta};outline-offset:2px}
/* La cara de Axo con lo mínimo para que sea él (pidió el dueño: los ojos y "los otros
   rasgos, sin usar todos los elementos"): la esfera hace de cabeza EN SU PIEL ROSITA; ojos con iris ciruela
   oscuro y aro violeta, pupila azul noche y sus dos brillos; tres branquias durazno por lado, hacia arriba, que asoman
   por FUERA de la esfera (una máscara esconde lo de adentro, así parecen salir de atrás
   de la cabeza); cachetes rosas y la sonrisa suave de la mascota (no de gato). Sin cuerpo, gota ni hojita.
   La pupila sigue al puntero (--ox/--oy); parpadeo y "atento" son transforms sobre cada
   ojo; las branquias se abren un poco con hover/atento (transform en el grupo interno,
   porque el externo trae rotate en el atributo y CSS lo pisaría). */
.eqf-axo{width:64px;height:64px;display:block;pointer-events:none;overflow:visible;
  filter:drop-shadow(0 4px 10px rgba(226,120,160,.42))}
.eqf-orbe:hover .eqf-axo{filter:drop-shadow(0 6px 14px rgba(217,83,142,.55))}
.eqf-axo .pupila{transform:translate(calc(var(--ox,0px)*.45),calc(var(--oy,0px)*.45));transition:transform .16s cubic-bezier(.2,.8,.2,1.1)}
.eqf-axo .ojo{transform-box:fill-box;transform-origin:50% 55%;transition:transform .09s ease}
.eqf-orbe:hover .eqf-axo .ojo{transform:scale(1.06)}
.eqf-orbe.atento .eqf-axo .ojo{transform:scale(1.14)}
.eqf-orbe.parpadea .eqf-axo .ojo{transform:scaleY(.06)}
.eqf-axo .gafas{transform-box:fill-box;transform-origin:50% 50%;transition:transform .2s cubic-bezier(.2,.8,.2,1.2)}
.eqf-orbe:hover .eqf-axo .gafas{transform:rotate(-3deg) translateY(-.5px)}
.eqf-orbe.atento .eqf-axo .gafas{transform:rotate(2deg) translateY(-1px)}
.eqf-axo .branquia{transform-box:fill-box;transform-origin:0 50%;transition:transform .22s cubic-bezier(.2,.8,.2,1.2)}
.eqf-orbe:hover .eqf-axo .branquia{transform:scale(1.08)}
.eqf-orbe.atento .eqf-axo .branquia{transform:scale(1.16)}
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
.eqf-panel{position:fixed;inset:12px;z-index:961;border-radius:18px;overflow:hidden;background:var(--eqf-panel-fondo,#fff);--eq-top:24px;
  box-shadow:0 30px 90px rgba(20,14,44,.45),0 0 0 1px rgba(255,255,255,.4);animation:eqf-sube .26s cubic-bezier(.2,.8,.2,1)}
@keyframes eqf-sube{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
.eqf-panel .eq{height:calc(100dvh - 24px);min-height:0;border:0;border-radius:0}
.eqf-panel:not(.movil) .eq-canal>.eq-cab:first-child{padding-right:52px}
.eqf-x{position:fixed;top:2px;right:2px;z-index:962;width:40px;height:40px;border-radius:50%;border:2px solid #fff;cursor:pointer;color:#fff;
  background:linear-gradient(135deg,#7C6BF0,${P.rosa});box-shadow:0 6px 18px rgba(60,30,140,.35);display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}
.eqf-x:hover{transform:scale(1.08) rotate(90deg)}
.eqf-panel.movil{inset:0;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top)}
.eqf-panel.movil .eq{height:calc(100dvh - env(safe-area-inset-top))}
/* El panel es el lienzo de atrás del chat: si se queda blanco, asoma por los
   bordes y por debajo de la caja de escribir aunque .eq ya esté oscuro. */
[data-crm-dark="1"] .eqf-panel{--eqf-panel-fondo:#1d1d24}
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

/** Los ojos del widget: siguen el puntero, parpadean y miran la burbuja cuando llega algo.
 *  Sin puntero (móvil) curiosean solos. Con prefers-reduced-motion se quedan quietos. */
function Ojos({ orbe, atento }: { orbe: RefObject<HTMLButtonElement | null>; atento: number }) {
  useEffect(() => {
    const el = orbe.current; if (!el) return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto) return;
    let raf = 0, ultimoMov = 0, mirando = 0;
    const mirar = (x: number, y: number) => { el.style.setProperty('--ox', `${x.toFixed(1)}px`); el.style.setProperty('--oy', `${y.toFixed(1)}px`); };
    // Sigue al puntero: la mirada apunta a donde está el mouse, con tope de 5 px.
    const mov = (e: MouseEvent) => {
      ultimoMov = Date.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 220) * 5;
        mirar(dx / d * k, dy / d * k);
      });
    };
    window.addEventListener('mousemove', mov, { passive: true });
    // Sin puntero un rato, curiosea: mira a un lado, luego a otro, y vuelve.
    const curioso = setInterval(() => {
      if (Date.now() - ultimoMov < 4000) return;
      mirando = (mirando + 1) % 4;
      const p = [[-4, -1], [0, 0], [3, -3], [0, 0]][mirando];
      mirar(p[0], p[1]);
    }, 2200);
    // Parpadeo: cada 2.5–6 s, a veces doble.
    let t1 = 0, t2 = 0, t3 = 0;
    const parpadear = () => {
      el.classList.add('parpadea');
      t2 = window.setTimeout(() => {
        el.classList.remove('parpadea');
        if (Math.random() < .25) { t3 = window.setTimeout(() => { el.classList.add('parpadea'); window.setTimeout(() => el.classList.remove('parpadea'), 130); }, 180); }
      }, 140);
      t1 = window.setTimeout(parpadear, 2500 + Math.random() * 3500);
    };
    t1 = window.setTimeout(parpadear, 1800);
    return () => { window.removeEventListener('mousemove', mov); cancelAnimationFrame(raf); clearInterval(curioso); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [orbe]);
  // Llega una burbuja: mira hacia arriba, donde sale (los ojos bien abiertos los pone la clase `atento` del orbe).
  useEffect(() => {
    const el = orbe.current; if (!el || !atento) return;
    el.style.setProperty('--ox', '-3px'); el.style.setProperty('--oy', '-5px');
    const t = window.setTimeout(() => { el.style.setProperty('--ox', '0px'); el.style.setProperty('--oy', '0px'); }, 2600);
    return () => clearTimeout(t);
  }, [orbe, atento]);
  /* ══ LA CHISPA, versión «con aura» ══
      El ajolote se retiró: el personaje del CRM es ahora la chispa del logo
      con cara, que es la misma figura que ya está en el menú, en el cargador
      y dibujada en el cielo de la entrada. No se parece a la marca: ES la
      marca. La cara vive DENTRO del cuerpo —la cintura de la chispa deja 39
      px útiles de 92 y por eso los ojos son chicos—, nunca encima de una
      punta.
      Conserva las clases `ojo` y `pupila`: son las que hacen que siga el
      mouse y que parpadee, y eso es lo que separa una mascota de un sticker. */
  return (
    <svg className="eqf-axo" viewBox="0 0 200 200" aria-hidden="true"><defs>
  <radialGradient id="eqa-rosa" cx="44%" cy="34%" r="72%">
    <stop offset="0" stopColor="#FFE4F0"/><stop offset=".45" stopColor="#FBB6D3"/>
    <stop offset=".82" stopColor="#F58FBE"/><stop offset="1" stopColor="#ED66A4"/></radialGradient>
  <radialGradient id="eqa-noche" cx="42%" cy="32%" r="78%">
    <stop offset="0" stopColor="#4E3C8C"/><stop offset=".45" stopColor="#2A1F52"/>
    <stop offset="1" stopColor="#120C24"/></radialGradient>
  <linearGradient id="eqa-marca" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#9B8CFA"/><stop offset=".5" stopColor="#C062A0"/>
    <stop offset="1" stopColor="#D9538E"/></linearGradient>
  <radialGradient id="eqa-iris" cx="50%" cy="34%" r="66%">
    <stop offset="0" stopColor="#5B4BD6"/><stop offset=".5" stopColor="#2B1F4E"/>
    <stop offset="1" stopColor="#130D26"/></radialGradient>
  <linearGradient id="eqa-oro" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#FFEDB6"/><stop offset=".5" stopColor="#F2C14E"/>
    <stop offset="1" stopColor="#DE9F22"/></linearGradient>
  <filter id="eqa-glow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="2.6"/></filter>
  <filter id="eqa-suave" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2"/></filter>
</defs><path d="M100 2.4799999999999898 C129.256 70.744 129.256 70.744 197.52 100 C129.256 129.256 129.256 129.256 100 197.52 C70.744 129.256 70.744 129.256 2.4799999999999898 100 C70.744 70.744 70.744 70.744 100 2.4799999999999898 Z" fill="url(#eqa-marca)" opacity=".22" filter="url(#eqa-glow)"/><path d="M100 8 C127.6 72.4 127.6 72.4 192 100 C127.6 127.6 127.6 127.6 100 192 C72.4 127.6 72.4 127.6 8 100 C72.4 72.4 72.4 72.4 100 8 Z" fill="url(#eqa-rosa)" stroke="#F0568F" strokeWidth="3.2" strokeLinejoin="round"/><g className="ojo"><ellipse cx="82.87783355763646" cy="96.57556671152729" rx="11.985516509654474" ry="13.423778490813012" fill="#fff"/><g className="pupila"><ellipse cx="82.87783355763646" cy="96.57556671152729" rx="10.307544198302848" ry="11.745806179461384" fill="url(#eqa-iris)"/><circle cx="86.4734885105328" cy="92.97991175863095" r="3.595654952896342" fill="#fff"/><circle cx="78.80275794435394" cy="100.65064232480981" r="1.797827476448171" fill="#fff" opacity=".85"/></g><ellipse cx="117.12216644236354" cy="96.57556671152729" rx="11.985516509654474" ry="13.423778490813012" fill="#fff"/><g className="pupila"><ellipse cx="117.12216644236354" cy="96.57556671152729" rx="10.307544198302848" ry="11.745806179461384" fill="url(#eqa-iris)"/><circle cx="113.5265114894672" cy="92.97991175863095" r="3.595654952896342" fill="#fff"/><circle cx="121.19724205564606" cy="100.65064232480981" r="1.797827476448171" fill="#fff" opacity=".85"/></g></g><path d="M90.58280845670006 121.40270805295441 q9.417191543299943 9.417191543299943 18.834383086599885 0" fill="none" stroke="#4A2436" strokeWidth="2.8" strokeLinecap="round"/><g opacity=".5"><ellipse cx="68.32399208162747" cy="117.12216644236354" rx="10.27329986541812" ry="5.650314925979966" fill="#F4719F" filter="url(#eqa-glow)"/><ellipse cx="131.67600791837253" cy="117.12216644236354" rx="10.27329986541812" ry="5.650314925979966" fill="#F4719F" filter="url(#eqa-glow)"/></g><path d="M172 36 C173.92 42.08 173.92 42.08 180 44 C173.92 45.92 173.92 45.92 172 52 C170.08 45.92 170.08 45.92 164 44 C170.08 42.08 170.08 42.08 172 36 Z" fill="url(#eqa-marca)" opacity=".8"/><path d="M30 151 C31.68 156.32 31.68 156.32 37 158 C31.68 159.68 31.68 159.68 30 165 C28.32 159.68 28.32 159.68 23 158 C28.32 156.32 28.32 156.32 30 151 Z" fill="url(#eqa-marca)" opacity=".8"/><path d="M168 154 C169.44 158.56 169.44 158.56 174 160 C169.44 161.44 169.44 161.44 168 166 C166.56 161.44 166.56 161.44 162 160 C166.56 158.56 166.56 158.56 168 154 Z" fill="url(#eqa-marca)" opacity=".8"/></svg>
  );
}

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
  const orbeRef = useRef<HTMLButtonElement | null>(null);
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

  /* En el INBOX y en teléfono, la esfera se esconde.
     Vive abajo a la derecha, que es exactamente donde el inbox pone su botón de
     enviar: en una pantalla de 390 px se encimaban y el dedo daba en la esfera.
     Un chat que impide contestar un WhatsApp no es un atajo, es un estorbo.
     Se esconde solo lo CERRADO —la esfera y las burbujas—. Si el chat ya está
     abierto se queda: lo abrió una persona, ocupa toda la pantalla y no tapa
     nada del inbox; cerrarlo de golpe por cambiar de pestaña sería quitarle
     algo que estaba usando.
     Y no deja a nadie sin chat: Equipo sigue en el menú. */
  const estorbaElComposer = movil && tabActual === 'whatsapp';

  const otros = arbol.personas.filter(x => x.id !== yo.id && x.id !== 'a7de2512-2bbc-4234-82e9-db4e6b706abf');
  const estadoDe = (x: typeof otros[number]) => enLinea.includes(x.id) ? 'activo' : (x.estado !== 'fuera' && x.visto_at && Date.now() - new Date(x.visto_at).getTime() < 15 * 60_000 ? 'ausente' : 'fuera');
  const presentes = otros.map(x => ({ p: x, e: estadoDe(x) })).filter(x => x.e !== 'fuera');
  const uno = otros.length === 1 ? { p: otros[0], e: estadoDe(otros[0]) } : null;

  return (
    <>
      {!abierto && !estorbaElComposer && (
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
            <button key={pulsa} ref={orbeRef} className={'eqf-orbe' + (pulsa ? ' pulsa latido' : '') + (burbujas.length ? ' atento' : '')} onClick={() => abrir()} aria-label={`Abrir Equipo${noLeidos ? `, ${noLeidos} sin leer` : ''}`} title="Equipo">
              <span className="anillo" />
              <Ojos orbe={orbeRef} atento={pulsa} />
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
