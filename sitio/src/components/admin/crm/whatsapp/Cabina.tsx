// LLAMADAS INTELIGENTES · La cabina.
//
// Vive dentro del inbox, en el lugar de la lista + el hilo. El vendedor arma
// la lista con los filtros que ya tiene puestos, escribe cómo se presenta,
// se pone los audífonos y la central marca por él. Él solo habla cuando del
// otro lado hay una persona.
//
// El servidor manda (src/lib/telefonia/marcador.ts). Esta pantalla:
//   1. arma la lista paginando el inbox con el MISMO query string de la lista,
//   2. pide al Telefonia.tsx que entre a la sala (evento `tel-sala`),
//   3. pregunta cada segundo cómo va (`GET ?id=`) y pinta el item actual,
//   4. cuando el item pasa a `en_linea`, suena un aviso y abre el micrófono
//      (`tel-mute {mute:false}`); al cerrarse, lo vuelve a cerrar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from './estilo';
import AccionesLlamada from './AccionesLlamada';
import { confirmar } from '../../../../lib/ui/confirmar';
import { S } from '../email/ui';
import Cargando from '../ui/Cargando';
import { IcoTelefono, IcoMic, IcoReloj, IcoUsuario, IcoX, IcoChevronAbajo } from './Iconos';
import SelectorHorarios, { diaCorto, horaBonita } from './SelectorHorarios';
import ResumenLista from './ResumenLista';
import { telefonoLegible } from '../../../../lib/telefono';

type Props = {
  /** El query string de la lista tal como la ve el vendedor (armarQS). */
  qs: string;
  /** Cómo se llama lo que tiene filtrado: «Vista Leads calientes», «Míos · etapa lead»… */
  descripcion: string;
  /** Cuántas filas tiene la lista según el inbox (para avisar antes de armar). */
  total: number;
  yo?: any;
  /** Abrir directo en una jornada ya existente, sin pasar por elegir lista.
      Lo usa la pantalla propia de Llamadas inteligentes, donde las sesiones
      anteriores se ven ANTES de entrar: sin esto había que elegir una lista
      cualquiera sólo para llegar al botón de «Abrir» de la jornada de ayer. */
  sesionInicial?: string | null;
  onAbrirConversacion?: (conversationId: string) => void;
  onCerrar: () => void;
  movil?: boolean;
};

const post = (body: any) => fetch('/api/crm/telefonia/marcador', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json()).catch(() => ({ error: 'Sin conexión' }));

const ETIQUETA_ITEM: Record<string, string> = {
  pendiente: 'En espera', marcando: 'Marcando', timbrando: 'Timbrando', escuchando: 'Escuchando quién contesta',
  portero: 'Pasando la contestadora', en_linea: 'En línea', cierre: 'Cierre', hecho: 'Hecha', saltado: 'Saltada', excluido: 'Fuera de la lista',
};
/* Las etapas que se pueden poner al colgar. NO es el catálogo entero: `cliente`
   pide cuenta ligada y `evangelista` se gana con el tiempo — ninguna de las dos
   se decide en una llamada de prospección. Éstas sí. */
const ETAPAS_CIERRE: { id: string; l: string }[] = [
  { id: 'lead_calificado', l: 'Calificado — encaja y sigue' },
  { id: 'oportunidad', l: 'Oportunidad — hay trato en camino' },
  { id: 'rezagado', l: 'Rezagado — no ahora, más adelante' },
  { id: 'descalificado', l: 'Descalificado — no encaja' },
  { id: 'perdido_definitivo', l: 'Perdido definitivo — dijo que no vuelve' },
];

const ETIQUETA_RESULTADO: Record<string, string> = {
  contesto: 'Contestó', buzon: 'Buzón de voz', portero: 'Contestadora', no_contesto: 'No contestó', ocupado: 'Ocupado', invalido: 'Número inválido',
  volver_llamar: 'Volver a llamar', no_interesa: 'No le interesa', dieron_datos: 'Dio datos', saltado: 'Saltada', cancelado: 'Cancelada',
  colgo_rapido: 'Colgó sin que hablaras',
};
const TONO_RESULTADO: Record<string, { bg: string; fg: string }> = {
  contesto: { bg: '#EAF8F2', fg: '#1E8A63' }, dieron_datos: { bg: '#EAF8F2', fg: '#1E8A63' }, volver_llamar: { bg: '#FFF4E5', fg: '#9a6a10' },
  no_interesa: { bg: '#FEF0EF', fg: '#C0554E' }, invalido: { bg: '#FEF0EF', fg: '#C0554E' },
  colgo_rapido: { bg: '#FFF4E5', fg: '#9a6a10' },
};
const tono = (r?: string | null) => TONO_RESULTADO[r || ''] || { bg: C.g100, fg: '#4B5563' };

const btnS: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: `1.5px solid #9B8CFA`, borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' };
const btnT: React.CSSProperties = { ...S.btnG, display: 'inline-flex', alignItems: 'center', gap: 5 };
const btnD: React.CSSProperties = { border: '1px solid #f0c4bd', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#C0554E', cursor: 'pointer', fontFamily: 'inherit' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: C.g900 };
const etiqueta: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: C.g500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 };
const tarjeta = (franja: string): React.CSSProperties => ({ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px' });

/** «hoy», «ayer» o «23 sep 2026», en la hora del centro: la fecha ISO no es como se lee. */
const fechaCorta = (v: any) => {
  const d = new Date(v); if (isNaN(d.getTime())) return String(v || '').slice(0, 10);
  const dia = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(x);
  if (dia(d) === dia(new Date())) return 'hoy';
  if (dia(d) === dia(new Date(Date.now() - 864e5))) return 'ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }).replace(/\./g, '').replace(/ de /g, ' ');
};
/** «viernes 25 sep, 4:00 pm»: una cita se lee como se dice, no «2026-09-25 16:00». */
const fechaHablada = (f: string, h?: string) => {
  const d = new Date(`${f}T12:00:00`); if (isNaN(d.getTime())) return `${f}${h ? ` ${h}` : ''}`;
  const dia = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(/,/g, '').replace(/ de /g, ' ');
  return h ? `${dia}, ${horaBonita(h)}` : dia;
};
/* El texto de la IA trae la hora en 24 h («el jueves a las 16:00»); en el
   teléfono se dice como la cita de abajo («4:00 pm»), para que no se lean dos
   formatos uno encima del otro (ronda 6). */
const horasDichas = (t: string) => String(t).replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_m, h, m) => horaBonita(`${h}:${m}`));
/* Si el texto nombra un día de la semana distinto al de la cita que se va a
   agendar, se avisa: «jueves» arriba y «viernes 25 sep» abajo confunde. */
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaNoCoincide = (texto: string, fecha?: string) => {
  if (!fecha) return false;
  const d = new Date(`${fecha}T12:00:00`); if (isNaN(d.getTime())) return false;
  const t = String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nombrado = DIAS_SEMANA.findIndex(n => new RegExp(`\\b${n.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}\\b`).test(t));
  return nombrado >= 0 && nombrado !== d.getDay();
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/* ══ LA CABINA, A LA MEDIDA DEL PULGAR (23-sep-2026) ════════════════════════
   Pedido del dueño: «desde que generas la lista debe ser un diseño móvil
   primero… debe ser fácil apretar cualquier botón en ese proceso».
   Medido a 390: casi todo lo tocable salía de 36 px con 6 px entre sí, y en
   plena llamada eso es fallar el dedo. Las reglas viven aquí, colgadas de
   `.cab-m` (la raíz de la cabina SÓLO en el teléfono), para que el escritorio
   no cambie ni un píxel:
     · todo lo que se toca mide al menos 44 × 44 y los campos van a 16 px
       (menos de eso y iOS hace zoom al enfocarlos). El piso general del CRM
       móvil (M5, `.m-tabin button … 36px !important`) pesa (0,3,1): la clase
       triple es para ganarle sin tocar ese archivo, y como él, respeta al
       botón que declara su propio `minHeight`;
     · las casillas crecen a 22 px y su renglón entero es el blanco;
     · las filas de botones que venían a 4-6 px se separan a 8 — se ataja por
       el `gap` que escribe React en línea para no tocar cada fila a mano.
   Y el «modo llamada»: con la jornada viva, la barra de pestañas del CRM, la
   burbuja de Equipo y la tarjeta negra de «En la sala» se van — tapaban la
   barra del pulgar (Colgar, Confirmar y seguir). Lo que decía esa tarjeta ya
   lo dice la pastilla del encabezado de la cabina. */
const CSS_MOVIL = `
.cab-m.cab-m.cab-m button:not([style*="min-height"]), .cab-m.cab-m.cab-m select, .cab-m.cab-m.cab-m input:not([type=checkbox]):not([type=radio]) { min-height: 44px !important; }
.cab-m button { min-width: 44px; touch-action: manipulation; }
.cab-m input, .cab-m select, .cab-m textarea { font-size: 16px !important; }
.cab-m input[type=checkbox] { width: 22px; height: 22px; flex-shrink: 0; margin: 0; accent-color: #5B4BD6; }
.cab-m label:has(> input[type=checkbox]) { min-height: 44px; align-items: center; }
.cab-m [style*="gap: 4px"], .cab-m [style*="gap: 5px"], .cab-m [style*="gap: 6px"] { gap: 8px !important; }
/* Piso de letra en el teléfono: nada por debajo de 12 px. Rótulos, avisos y
   pastillas se escribieron a 10.5-11.5 para el escritorio; aquí se suben todos
   de una vez por el \`font-size\` que React escribe en línea, sin tocar cada uno. */
.cab-m :is([style*="font-size: 9"], [style*="font-size: 10"], [style*="font-size: 11"]):not(input, select, textarea) { font-size: 12px !important; }
/* Los botones de contorno de escritorio (\`btnS\`, \`btnD\`) van a 0.77rem:
   en el teléfono, a la letra de los demás botones de la cabina. */
.cab-m button[style*="font-size: 0.77rem"] { font-size: 14px !important; }
.cab-m .cab-col-res { white-space: normal !important; max-width: 60% !important; text-align: right; }
/* El nombre de la plantilla es lo que se elige: entero, aunque ocupe dos renglones. */
.cab-m .cab-pl-nombre { white-space: normal !important; overflow-wrap: anywhere; flex-basis: 100% !important; }
/* La fecha y la hora van en una rejilla de dos columnas a todo lo ancho
   (a 16 px no cabían en 140 y 110: «04:00 PI»). */
.cab-m input[type=date], .cab-m input[type=time] { width: 100% !important; min-width: 0; }
html[data-cabina-m] .eqf { display: none !important; }
/* La cabina en el teléfono es una pantalla completa (ver \`raizEstilo\`): la
   barra de pestañas del CRM queda debajo y no se debe poder alcanzar. */
html[data-cabina-m] nav[aria-label="Navegación principal"] { display: none !important; }
/* global.css pone \`scroll-behavior: smooth\` al html: en la cabina cada salto
   (al siguiente contacto, al abrir un bloque) debe ser inmediato. */
html[data-cabina-m] { scroll-behavior: auto !important; }
@keyframes cab-late{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
/* Los campos que se escriben (motivo, dato de plantilla) crecen con su texto. */
.cab-m textarea.cab-auto { field-sizing: content; min-height: 72px; resize: none; line-height: 1.4; }
html[data-cabina-m="viva"] [data-tel-panel]:has(button[title="Salir de la sala"]) { display: none !important; }
/* A menos de 380 px el día y la hora no caben lado a lado a 16 px: el reloj
   nativo tapaba la «M» («04:00 PN»). Uno arriba del otro. */
@media (max-width: 379px) { .cab-m .cab-fh { grid-template-columns: minmax(0, 1fr) !important; } }
/* El «¿Por qué?» de las reglas de la lista: el triángulo nativo sobra. */
.cab-m summary::-webkit-details-marker { display: none; }
`;
/* ══ EN EL TELÉFONO, LA CABINA ES UNA PANTALLA COMPLETA (23-sep-2026) ══════
   Antes vivía dentro del marco de la página: título «Llamadas» arriba, otra
   vez «Llamadas inteligentes» en la cabina, dos bordes con su margen (el
   contenido quedaba en ~300 px de 390) y la barra de pestañas del CRM debajo
   de la barra del pulgar, tapando el final de cada pantalla. Una jornada de
   llamadas es una tarea de principio a fin —como el hilo del inbox— y se sale
   con la ✕ del encabezado. En escritorio no cambia nada. */
const raizEstiloEscritorio: React.CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` };
const raizEstiloMovil: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 450, display: 'flex', flexDirection: 'column', minWidth: 0,
  /* La safe-area de arriba la pone el encabezado (guía de continuidad §1),
     así su fondo blanco llega hasta la muesca y no se cuenta dos veces. */
  background: C.g50, overflow: 'hidden',
};
/* Lo que se deja libre al final de cada scroll: la barra del pulgar (≈74 px),
   su franja de 44 que se come el toque, la safe-area del iPhone y aire para
   que lo último quede entero y a más de 8 px de la franja. */
const PIE_MOVIL = 'calc(136px + env(safe-area-inset-bottom))';
/* ══ LA FRANJA MUERTA ENCIMA DE LA BARRA DEL PULGAR ════════════════════════
   El contenido pasa por debajo de la barra al hacer scroll, y un chip
   («Hablamos») podía quedar a 7 px de «Colgar»: se pica uno por el otro con el
   teléfono recién quitado de la oreja. La barra lleva encima 24 px que
   desvanecen lo que pasa por debajo y SE COMEN el toque: nada tocable queda a
   menos de ~30 px de sus botones.
   44 px y no 24 (23-sep-2026): con 24, un «Quitar» de 44 cuyo centro quedaba
   justo encima de la franja asomaba pegado a la barra (medido a 0-3 px). Con
   la franja del alto de un botón, lo que se alcanza a picar queda siempre a
   más de 20 px de la barra. */
const bandaPie = (
  <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: -45, height: 44, background: `linear-gradient(to bottom, rgba(249,250,251,0), rgba(249,250,251,.92))` }} />
);
/* La barra fija de abajo en las fases de antes y después de marcar, con la
   acción principal a todo lo ancho. */
const barraPie: React.CSSProperties = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 390,
  /* Blanco opaco hasta el borde (safe-area incluida) y una línea arriba: con
     el 97 % y el desenfoque se transparentaba el renglón que pasaba debajo
     («Alejandra Villaseñor» asomaba bajo el botón). */
  background: '#fff', borderTop: `1px solid ${C.g200}`, boxShadow: '0 -4px 14px rgba(12,11,18,.06)',
  /* La misma en todo el flujo (guía §2): 10 arriba, 16 a los lados y abajo
     12 o la safe-area — 75 px sin muesca, igual que el armador y la sala. */
  padding: '10px 16px max(12px, calc(10px + env(safe-area-inset-bottom)))', display: 'flex', gap: 8, alignItems: 'center',
};
const ctaMovil: React.CSSProperties = { ...S.btnP, flex: 1, minHeight: 52, fontSize: 16, fontWeight: 800, borderRadius: 12, border: 'none', background: '#5B4BD6', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 };
/* Deshabilitado con su color, no con opacidad: al 60 % el morado parecía
   «cargando» y el texto blanco bajaba de 4.5:1. El mismo del armador. */
const ctaMovilOff: React.CSSProperties = { background: '#E0DFE6', color: '#6B7280', cursor: 'default' };
/* Secundario de la barra (guía §3.2): blanco, línea gris, 15/800. */
const secMovil: React.CSSProperties = { flexShrink: 0, minHeight: 52, border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 12, padding: '0 14px', fontSize: 15, fontWeight: 800, color: '#374151', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
/* El mismo secundario dentro del contenido: 44 px en vez de 52 (guía §3.2). */
const secContenido: React.CSSProperties = { ...secMovil, minHeight: 44 };
/* «Quitar» es UNA sola pieza en todo el flujo (ronda 3): destructivo de
   contorno (guía §3.5), en la fila de la lista, en la hoja de la jornada, en
   las acciones del cierre y en «Mandarle también». Antes era gris en la
   lista y rojo en el cierre: la misma palabra con dos pesos. */
const quitarMovil: React.CSSProperties = { ...secContenido, border: '1px solid #f0c4bd', color: '#C0554E' };
/* «Cancelar» de la línea que timbra (ronda 3): la misma pieza en la tarjeta de
   la cabina y en la hoja de la lista — antes radio 10/800 en una y 9/600 en la
   otra. Es el destructivo de contorno de «Quitar», con su ✕ delante. */
const cancelarMovil: React.CSSProperties = { ...quitarMovil, padding: '0 12px', gap: 5, fontSize: 14 };
/* En la hoja de la lista, «Cancelar» (timbrando) y «Quitar» (en espera) son
   la MISMA pieza: destructivo de contorno, mismo ancho mínimo y sin ícono. */
const destructivoFila: React.CSSProperties = { ...quitarMovil, minWidth: 104, padding: '0 12px', fontSize: 14 };
/* Verde para TEXTO (ronda 3): #1E8A63 da 4.31:1 sobre blanco y no llega al
   4.5:1 del texto normal; se queda para los puntos y las franjas. */
const verdeTexto = '#17775A';
/* Lo mismo con el ámbar: #9a6a10 sobre su agua #FFF4E5 da 4.35:1. Sobre ese
   fondo, en el teléfono, el texto va un tono más oscuro (5.3:1). */
const ambarTextoAgua = '#8a5d0c';
/* Los huecos de 80 px de la botonera de la llamada (guía §4): ícono de 20
   arriba y la palabra en 13/800 abajo. La misma forma que en la sala. */
/* Opción de contenido en el teléfono (guía §3.3), UNA sola forma en toda la
   cabina (ronda 1): contorno lila de 1.5, texto morado, radio 12 como
   «Cómo quedó»; la elegida se rellena de agua. Las píldoras (radio 999) y los
   rellenos morado o ámbar eran otras tantas familias para el mismo control. */
const opcionMovil = (elegida: boolean): React.CSSProperties => ({ border: '1.5px solid #9B8CFA', background: elegida ? '#EEECFE' : '#fff', color: '#5B4BD6', borderRadius: 12, padding: '0 14px', minHeight: 44, fontSize: 14, fontWeight: elegida ? 800 : 700, cursor: 'pointer', fontFamily: 'inherit' });
const huecoLlamada: React.CSSProperties = { flexShrink: 0, width: 80, minHeight: 52, border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 12, padding: '4px 2px', fontFamily: 'inherit', cursor: 'pointer', color: '#374151', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, lineHeight: 1.1 };
/* El auricular caído y el micrófono de la sala (SalaLlamada.tsx): Colgar y
   Silenciar se reconocen por su forma al pasar de una pantalla a la otra. */
const IcoColgar = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: 'rotate(135deg)', flexShrink: 0 }}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" fill="currentColor" />
  </svg>
);
const IcoMicLlamada = ({ apagado }: { apagado?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
    <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    {apagado && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
  </svg>
);

/** Un timbre corto, dos veces: «ya hay una persona, habla». Sin archivos. */
function avisar() {
  try {
    const A = (window as any).AudioContext || (window as any).webkitAudioContext; if (!A) return;
    const ctx = new A();
    [0, 0.22].forEach(t => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* sin audio */ }
}

const guardarLocal = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privado */ } };
const leerLocal = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardarSesion = (k: string, v: string) => { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch { /* privado */ } };
const leerSesion = (k: string, d: string): string => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } };

/* AGENDAR SIN SALIR DEL CIERRE. Los mismos huecos que enseña la sala de la
   llamada manual (`available-slots`, que cruza la agenda con Google y devuelve
   los libres de verdad). Se piden al TOCAR el botón y no al abrir el cierre:
   la mayoría de las llamadas no acaban en cita, y pedirlos siempre sería pagar
   una consulta por cada una que no lleva a nada. */
function AgendarEnCierre({ contactId, nombre, telefono, tipos, movil }: { contactId?: string | null; nombre?: string | null; telefono?: string | null; tipos?: any[]; movil?: boolean }) {
  const [slots, setSlots] = useState<any[] | null>(null);
  const [puesto, setPuesto] = useState('');
  const [yendo, setYendo] = useState(false);
  const [err, setErr] = useState('');
  // De qué tipo es la cita: antes siempre «demo», aunque en la llamada se acordara otra cosa.
  const [tipo, setTipo] = useState<string>(() => leerLocal('cabina.tipocita', 'demo'));
  const traer = async (slug = tipo) => {
    setSlots([]);
    const hoy = new Date().toISOString().slice(0, 10);
    const hasta = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const j = await fetch(`/api/scheduling/available-slots?slug=${encodeURIComponent(slug)}&from=${hoy}&to=${hasta}`).then(r => r.json()).catch(() => null);
    const l = Object.entries(j?.dates || {}).sort(([a], [b]) => a.localeCompare(b)).flatMap(([fecha, horas]: any) => (horas || []).map((hora: string) => ({ fecha, hora: String(hora).slice(0, 5) })));
    setSlots(l);
  };
  const agendar = async (h: any) => {
    setYendo(true);
    /* `/api/scheduling/book` y NO `agenda-oferta`: el segundo le MANDA los
       horarios al cliente para que elija, y aquí el cliente ya está al
       teléfono diciendo cuál quiere. Reservar directo es lo que cierra la
       cita; mandarle una lista a alguien que te está hablando es devolverle
       la pelota. Y `book` corre la cadena entera —Google Calendar, correo de
       confirmación, recordatorios— igual que si hubiera agendado él. */
    const r = await fetch('/api/scheduling/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type_slug: tipo, fecha: h.fecha, hora_inicio: h.hora,
        nombre: nombre || 'Contacto', whatsapp: telefono || undefined,
        notas: 'Quedó en la llamada', timezone: 'America/Mexico_City',
      }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo agendar' }));
    setYendo(false);
    if (r?.error) { setErr(r.error); return; }
    setPuesto(`${h.fecha} ${h.hora}`);
  };
  if (puesto) return (
    <div style={{ marginTop: 12, background: '#EAF8F2', color: '#1E8A63', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, fontWeight: 700 }}>
      Cita puesta para el {puesto}. Queda en la agenda y en el calendario.
    </div>
  );
  return (
    <div style={{ marginTop: 12, background: '#FFF8EC', border: '1px solid #f3d9a4', borderRadius: 10, padding: '10px 13px' }}>
      <div style={{ fontSize: 12.5, color: '#9a6a10', fontWeight: 700, marginBottom: slots ? 8 : 0 }}>
        No quedó ninguna cita ni compromiso de esta llamada.
      </div>
      {err && <div style={{ fontSize: 12, color: '#C0554E', fontWeight: 700, marginBottom: 7 }}>{err}</div>}
      {slots === null ? (
        <button onClick={() => traer()} style={{ border: '1px solid #e0c99a', background: '#fff', color: '#9a6a10', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
          Ponerle una ahora
        </button>
      ) : !slots.length ? (
        <div style={{ fontSize: 12, color: '#9a6a10' }}>No tienes huecos libres esta semana.</div>
      ) : (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {slots.map((h, i) => (
            <button key={i} disabled={yendo} onClick={() => agendar(h)}
              style={{ border: '1px solid #e0c99a', background: '#fff', color: '#9a6a10', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: yendo ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {new Date(`${h.fecha}T${h.hora}:00`).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ══ «MANDARLE TAMBIÉN» Y «ASÍ LE VAN A LLEGAR» (22-sep-2026) ═══════════════
   Pedido del dueño: «sobre lo que ya decides que vas a enviar, poder agregar
   algo extra —el PDF, una plantilla relacionada al caso— y que se vea cómo el
   sistema va a enviar los mensajes una vez que acepte». Lo agregado se guarda
   en la propuesta (`cierre_editar`) y sale al aplicar el cierre, después de lo
   que decidió la IA. La vista previa es la MISMA lógica que el envío: ventana
   abierta → directo; cerrada → plantilla (y un PDF sin plantilla espera). */
const PARAM_CASO: Record<string, string> = {
  info: 'como quedamos en la llamada, aquí tienes la información de Sacs.',
  precios: 'como quedamos en la llamada, aquí tienes los planes y precios.',
  cambio: 'como quedamos en la llamada, aquí tienes cómo te cambias a Sacs.',
  demo: 'como quedamos en la llamada, aquí tienes cómo es la demo.',
};
const paramDe = (n: string) => PARAM_CASO[(/^ti_(info|precios|cambio|demo)_/.exec(n) || [])[1] || ''] || '';
const armarPlantilla = (cuerpo: string, primer: string, params: string[]) =>
  String(cuerpo || '').replace(/\{\{(\d+)\}\}/g, (_m, n) => Number(n) === 1 ? (primer || 'qué tal') : (params[Number(n) - 2] || `[dato ${n}]`));
/* El nombre de una plantilla de Meta («ti_cambio_marketing_v2») no es lenguaje
   del vendedor: en el teléfono se enseña lo que dice («Cómo te cambias a Sacs»). */
const TEMA_PLANTILLA: Record<string, string> = { info: 'Información de Sacs', precios: 'Planes y precios', cambio: 'Cómo te cambias a Sacs', demo: 'Cómo es la demo' };
const nombrePlantilla = (n: string) => {
  const caso = (/^ti_(info|precios|cambio|demo)_/.exec(n) || [])[1];
  if (caso) return TEMA_PLANTILLA[caso];
  const t = String(n || '').replace(/^ti_/, '').replace(/_v\d+$/, '').replace(/_(utility|marketing)$/, '').replace(/_/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : n;
};
function ExtrasCierre({ propuesta, item, opc, cargar, abierto, setAbierto, params, setParams, editar, ocupado, movil }: any) {
  const np = (n: string) => movil ? nombrePlantilla(n) : n;
  // En el teléfono la vista previa de los mensajes empieza plegada: el conteo ya está arriba.
  const [verPasos, setVerPasos] = useState(false);
  // En el teléfono, la plantilla cuyo dato se revisa antes de agregarla.
  const [abriendo, setAbriendo] = useState<string | null>(null);
  useEffect(() => { if (propuesta) cargar(); }, [item?.id, !!propuesta]);
  if (!propuesta) return null;
  const primer = opc?.primer_nombre || String(item?.nombre || '').split(' ')[0] || '';
  const extras: { nombre: string; params: string[] }[] = propuesta.extras || [];
  const pl = (n: string) => (opc?.plantillas || []).find((x: any) => x.nombre === n);
  const envios = (propuesta.envios || []).filter((e: any) => ['listo', 'pendiente_ventana'].includes(String(e.estado)));
  // Cada contenido con PDF propio (info, precios, cambio, demo) trae su plantilla y su liga.
  const kDe = (id: string) => (opc?.conocimientos || []).find((k: any) => k.id === id);
  // Vista previa: un renglón por mensaje, en el orden en que salen.
  const pasos: { que: string; como: string; texto?: string; quitar?: string }[] = [];
  for (const cp of propuesta.compromisos || []) {
    if (cp.tipo === 'reunion') pasos.push({ que: `Confirmación de la reunión (${cp.reunion_tipo || 'reunión'}) · ${movil ? fechaHablada(cp.fecha, cp.hora) : `${cp.fecha} ${cp.hora}`}`, como: 'WhatsApp con la liga de Meet + invitación de calendario por correo' });
  }
  const vistos = new Set<string>();
  for (const e of envios) {
    const clave = e.conocimiento_id || e.id;
    if (vistos.has(clave)) continue; vistos.add(clave);
    const k = kDe(e.conocimiento_id);
    if (opc?.ventana_abierta) pasos.push({ que: `PDF «${e.tema}»`, como: 'por WhatsApp, directo (la ventana de 24 h está abierta)', texto: k?.param ? `Hola ${primer}, como quedamos en la llamada, aquí te dejo ${k.tema}. Todo a detalle en ${k.liga} — cualquier duda, con gusto.` : `Hola ${primer}, como quedamos en la llamada, aquí te dejo ${String(e.tema).toLowerCase()}. Cualquier duda, con gusto.` });
    else if (k?.plantilla) pasos.push({ que: `PDF «${e.tema}»`, como: movil ? `con plantilla de WhatsApp «${np(k.plantilla.nombre)}» (la ventana de 24 h está cerrada); el PDF va adjunto` : `con la plantilla ${k.plantilla.nombre} (ventana cerrada), el PDF va adjunto`, texto: armarPlantilla(k.plantilla.cuerpo, primer, [k.param]) });
    else pasos.push({ que: `PDF «${e.tema}»`, como: 'espera: sale en cuanto conteste (ventana cerrada y sin plantilla para este contenido)' });
  }
  for (const x of extras) { const p0 = pl(x.nombre); pasos.push({ que: movil ? `Plantilla «${np(x.nombre)}»` : `Plantilla ${x.nombre}`, como: p0?.con_documento ? 'plantilla con su archivo' : 'plantilla', texto: p0 ? armarPlantilla(p0.cuerpo, primer, x.params) : undefined, quitar: x.nombre }); }
  const hayLlamada = (propuesta.compromisos || []).some((c: any) => c.tipo === 'llamada');

  const ponerExtras = (lista: { nombre: string; params: string[] }[]) => editar({ extras: lista });
  const agregarPlantilla = (n: string) => {
    const p0 = pl(n); const nv = Math.max(0, (p0?.variables || 1) - 1);
    const vals = Array.from({ length: nv }, (_, i) => params[`${n}:${i}`] || paramDe(n));
    ponerExtras([...extras.filter(x => x.nombre !== n), { nombre: n, params: vals }].slice(0, 3));
  };
  const chip: any = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 999, padding: movil ? '0 14px' : '5px 10px', fontSize: movil ? 14 : 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: C.g700 };
  /* En el teléfono, la jerarquía de la guía de continuidad §3: «Agregar» y
     los PDF son opción de contenido (contorno lila, radio 12) y «Quitar» es
     destructivo de contorno, el mismo de los «Cancelar» de la jornada. Las
     píldoras grises no eran de ningún nivel. */
  const chipOpc: any = movil ? { ...chip, border: '1.5px solid #9B8CFA', borderRadius: 12, color: '#5B4BD6', background: '#fff' } : chip;
  const chipQuitar: any = movil ? quitarMovil : { ...chip, color: '#C0554E' };

  /* En el teléfono esta caja deja de ser tarjeta dentro de la tarjeta lavanda:
     sin borde y con 10 px de aire, las burbujas ganan el ancho que les faltaba. */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: movil ? 10 : 8, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 10, padding: movil ? '0 12px 12px' : '10px 12px' }}>
      {/* En el teléfono el botón va debajo del título y a lo ancho: al lado,
          el título se partía en tres renglones. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(movil ? { flexDirection: 'column', alignItems: 'stretch' } : null) }}>
        {movil ? (
          /* La misma cabecera que sus hermanas «¿Cómo quedó?» y «En qué etapa
             queda» (`Colapsable`): 11 px arriba, chevron de la familia. */
          <button onClick={() => setVerPasos(v => !v)} aria-expanded={verPasos} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, background: 'none', border: 'none', padding: '11px 0 0', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <IcoChevronAbajo size={18} style={{ flexShrink: 0, color: C.g500, transform: verPasos ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: C.g900 }}>Así le llegan los mensajes</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 999, padding: '3px 10px' }}>{pasos.length}</span>
          </button>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.g500, flex: 1 }}>Así le van a llegar los mensajes</span>
        )}
        {/* En el teléfono es secundario de contenido (guía §3.2), no opción:
            abre una hoja, no elige nada. Con el contorno lila se leía como el
            cierre de la pantalla, pegado a la barra (ronda 1 cabina). */}
        <button onClick={() => setAbierto(!abierto)} disabled={ocupado} style={movil ? { width: '100%', minHeight: 44, border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 12, padding: '0 14px', fontSize: 15, fontWeight: 800, color: '#374151', fontFamily: 'inherit', cursor: 'pointer' } : { ...chip, background: abierto ? C.moradoAgua : '#fff', color: C.moradoTinta, borderColor: '#ddd6fb' }}>{abierto && !movil ? 'Listo' : '＋ Mandarle también'}</button>
      </div>
      {!opc && <div style={{ fontSize: movil ? 14 : 11.5, color: movil ? C.g500 : C.g400 }}>Revisando la ventana de WhatsApp…</div>}
      {opc && !pasos.length && (
        <div style={{ fontSize: movil ? 14 : 12, color: C.g500 }}>{hayLlamada ? 'Con esto no le llega ningún mensaje: la llamada de vuelta queda en tu agenda y en la lista de ese día.' : 'Con esto no le llega ningún mensaje.'}</div>
      )}
      {(!movil || verPasos) && pasos.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: movil ? '22px minmax(0, 1fr)' : '22px 1fr', gap: 8, alignItems: 'start' }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, background: C.moradoAgua, color: C.moradoTinta, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: movil ? 14 : 12.5, fontWeight: 700, color: C.g900, lineHeight: 1.35 }}>{p.que}</div>
            <div style={{ fontSize: movil ? 13 : 11, color: C.g500, lineHeight: 1.4 }}>{p.como}</div>
            {p.texto && <div style={{ marginTop: 4, fontSize: movil ? 14 : 12, color: C.g700, background: '#E7F6EE', borderRadius: '10px 10px 10px 2px', padding: '7px 10px', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{p.texto}</div>}
            {/* En el teléfono «Quitar» va junto al mensaje que quita (ronda 5):
                suelto debajo de «Mandarle también», quitaba algo que no se veía. */}
            {movil && p.quitar && <button onClick={() => ponerExtras(extras.filter(y => y.nombre !== p.quitar))} disabled={ocupado} style={{ ...chipQuitar, marginTop: 8 }}>Quitar este mensaje</button>}
          </div>
        </div>
      ))}
      {hayLlamada && pasos.length > 0 && (!movil || verPasos) && <div style={{ fontSize: movil ? 14 : 11, color: movil ? C.g500 : C.g400 }}>La llamada de vuelta no le manda mensaje: queda en tu agenda y en la lista de ese día.</div>}
      {/* En el teléfono, con «Así le llegan…» plegado, cada extra agregado
          conserva su «Quitar» a la vista (desplegado, va junto a su mensaje). */}
      {extras.length > 0 && movil && !verPasos && (
        <div style={{ display: 'grid', gap: 8 }}>
          {extras.map(x => <button key={x.nombre} onClick={() => ponerExtras(extras.filter(y => y.nombre !== x.nombre))} disabled={ocupado} aria-label={`Quitar la plantilla ${np(x.nombre)}`} style={{ ...chipQuitar, width: '100%', justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.3, padding: '6px 14px' }}>Quitar «{np(x.nombre)}»</button>)}
        </div>
      )}
      {extras.length > 0 && !movil && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {extras.map(x => <button key={x.nombre} onClick={() => ponerExtras(extras.filter(y => y.nombre !== x.nombre))} disabled={ocupado} style={{ ...chip, color: '#C0554E' }}>Quitar {movil ? `«${np(x.nombre)}»` : x.nombre}</button>)}
        </div>
      )}
      {abierto && opc && (() => { const catalogo = (
        <div style={movil ? { display: 'grid', gap: 14 } : { display: 'grid', gap: 8, borderTop: `1px solid ${C.g100}`, paddingTop: 8 }}>
          {(opc.conocimientos || []).length > 0 && (
            <div>
              <div style={movil ? { ...etiqueta, fontSize: 12, marginBottom: 8 } : { fontSize: 11, fontWeight: 800, color: C.g500, marginBottom: 5 }}>Contenido con PDF</div>
              {/* En el teléfono, la misma rejilla de dos columnas iguales que el
                  resto de opciones del flujo. */}
              <div style={movil ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 } : { display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {opc.conocimientos.map((k: any) => {
                  const ya = envios.some((e: any) => e.conocimiento_id === k.id);
                  /* En el teléfono lo ya agregado se pinta como elegido (morado
                     tinta sobre lavanda), no a media opacidad: a 2.7:1 parecía
                     deshabilitado y no se leía. */
                  return <button key={k.id} disabled={ya || ocupado} onClick={() => editar({ agregar_envio: k.id })} style={movil ? { ...chipOpc, minWidth: 0, minHeight: 44, width: '100%', justifyContent: 'center', textAlign: 'center', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, padding: '6px 8px', ...(ya ? { background: '#EEECFE', cursor: 'default' } : null) } : { ...chip, opacity: ya ? .5 : 1 }}>{ya ? '✓ ' : '＋ '}{k.tema}</button>;
                })}
              </div>
            </div>
          )}
          <div>
            <div style={movil ? { ...etiqueta, fontSize: 12, marginBottom: 8 } : { fontSize: 11, fontWeight: 800, color: C.g500, marginBottom: 5 }}>Plantillas del caso (máximo 3)</div>
            {/* En el teléfono sin scroll propio: un scroll dentro del scroll de
                la cabina atrapa el pulgar. */}
            <div style={{ display: 'grid', gap: movil ? 10 : 6, ...(movil ? null : { maxHeight: 320, overflowY: 'auto' as const }) }}>
              {(opc.plantillas || []).map((t: any) => {
                const ya = extras.some(x => x.nombre === t.nombre);
                const nv = Math.max(0, t.variables - 1);
                return (
                  <div key={t.nombre} style={{ border: `1px solid ${ya ? '#c9bcf7' : C.g200}`, background: ya ? '#F6F4FF' : '#fff', borderRadius: 9, padding: movil ? '10px' : '7px 9px' }}>
                    {/* En el teléfono (ronda 5): el título en tinta (en gris
                        parecía deshabilitado) y el botón SIEMPRE arriba a la
                        derecha, en el mismo sitio en cada tarjeta; el dato
                        editable sólo sale al tocar «Agregar», para que no
                        parezca que ya se va a mandar. */}
                    {movil ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ display: 'block', fontSize: 15, color: C.g900, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{np(t.nombre)}</b>
                          <span style={{ fontSize: 13, color: ya ? '#4B5563' : C.g500 }}>{t.categoria === 'UTILITY' ? 'utilidad' : 'marketing'}{t.con_documento ? ' · con archivo' : ''}{ya ? ' · agregada' : ''}</span>
                        </div>
                        <button disabled={ocupado || (!ya && extras.length >= 3)}
                          onClick={() => { if (ya) ponerExtras(extras.filter(x => x.nombre !== t.nombre)); else if (nv > 0 && abriendo !== t.nombre) setAbriendo(t.nombre); else { agregarPlantilla(t.nombre); setAbriendo(null); } }}
                          style={{ ...(ya ? chipQuitar : chipOpc), flexShrink: 0, width: 108, ...(!ya && abriendo === t.nombre ? { background: '#EEECFE' } : null) }}>
                          {ya ? 'Quitar' : abriendo === t.nombre ? 'Confirmar' : 'Agregar'}
                        </button>
                      </div>
                    ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <b className="cab-pl-nombre" style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{np(t.nombre)}</b>
                      <span style={{ fontSize: 10, color: movil ? C.g500 : C.g400 }}>{t.categoria === 'UTILITY' ? 'utilidad' : 'marketing'}{t.con_documento ? ' · con archivo' : ''}</span>
                      <button disabled={ocupado || (!ya && extras.length >= 3)} onClick={() => ya ? ponerExtras(extras.filter(x => x.nombre !== t.nombre)) : agregarPlantilla(t.nombre)} style={{ ...chip, padding: '3px 9px', color: ya ? '#C0554E' : C.moradoTinta }}>{ya ? 'Quitar' : 'Agregar'}</button>
                    </div>
                    )}
                    <div style={{ fontSize: movil ? 14 : 11.5, color: movil ? C.g700 : C.g500, marginTop: movil ? 6 : 3, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{armarPlantilla(t.cuerpo, primer, Array.from({ length: nv }, (_, i) => params[`${t.nombre}:${i}`] || paramDe(t.nombre)))}</div>
                    {nv > 0 && !ya && (!movil || abriendo === t.nombre) && Array.from({ length: nv }, (_, i) => movil ? (
                      /* En el teléfono, de varios renglones: en uno se cortaba el dato. */
                      <textarea key={i} className="cab-auto" rows={2} value={params[`${t.nombre}:${i}`] ?? paramDe(t.nombre)} placeholder={`Dato ${i + 2} de la plantilla`} aria-label={`Dato ${i + 2} de la plantilla`}
                        onChange={e => setParams((v: any) => ({ ...v, [`${t.nombre}:${i}`]: e.target.value }))}
                        style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 10px', fontFamily: 'inherit' }} />
                    ) : (
                      <input key={i} value={params[`${t.nombre}:${i}`] ?? paramDe(t.nombre)} placeholder={`Dato ${i + 2} de la plantilla`}
                        onChange={e => setParams((v: any) => ({ ...v, [`${t.nombre}:${i}`]: e.target.value }))}
                        style={{ marginTop: 5, width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 7, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit' }} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
      if (!movil) return catalogo;
      /* ══ EN EL TELÉFONO, EL CATÁLOGO ES UNA HOJA (23-sep-2026) ════════════
         Abierto dentro de la cabina la estiraba a ~2,900 px y el único
         «Listo» quedaba arriba, lejos de donde se termina de elegir. Aquí es
         una hoja propia, como la lista de la jornada: título y ✕ de 44 arriba,
         el catálogo con su scroll y «Listo» fijo abajo, al alcance del pulgar. */
      return (
        <div onClick={e => { if (e.target === e.currentTarget) setAbierto(false); }} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(12,11,18,.45)' }}>
          <div role="dialog" aria-modal="true" aria-label="Mandarle también" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, boxShadow: '0 -10px 40px rgba(12,11,18,.22)' }}>
            <div style={{ flexShrink: 0, padding: '6px 16px 8px', borderBottom: `1px solid ${C.g200}` }}>
              <span aria-hidden style={{ display: 'block', width: 36, height: 4, borderRadius: 999, background: C.g200, margin: '2px auto 4px' }} />
              {/* La ✕ alineada con el título, no a media altura de los dos
                  renglones (ronda 6). */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 11 }}>
                  <b style={{ display: 'block', fontSize: 16, color: C.g900, lineHeight: 1.4 }}>Mandarle también</b>
                  <span style={{ fontSize: 14, color: C.g500 }}>{extras.length ? `${extras.length} de 3 plantillas agregadas` : 'Sale después de lo que decidió la IA'}</span>
                </div>
                <button onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ width: 44, height: 44, flexShrink: 0, border: 'none', background: 'none', color: C.g500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoX size={20} /></button>
              </div>
            </div>
            <div className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 60px' }}>{catalogo}</div>
            <div style={{ flexShrink: 0, position: 'relative', borderTop: `1px solid ${C.g200}`, padding: '10px 16px max(12px, calc(10px + env(safe-area-inset-bottom)))', background: '#fff', boxShadow: '0 -4px 14px rgba(12,11,18,.06)' }}>
              {/* La misma franja de las otras barras del pulgar (ronda 5): una
                  tarjeta que pasa por debajo no deja su «Agregar» pegado a «Listo». */}
              <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: -45, height: 44, background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,.92))' }} />
              <button onClick={() => setAbierto(false)} style={{ width: '100%', minHeight: 52, border: 'none', borderRadius: 12, background: C.moradoTinta, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Listo</button>
            </div>
          </div>
        </div>
      );
      })()}
    </div>
  );
}

export default function Cabina({ qs, descripcion, total, yo, sesionInicial, onAbrirConversacion, onCerrar, movil }: Props) {
  /* 🔴 BUG (22-sep-2026, reportado por el dueño): armaba una lista nueva con
     filtros, le daba «Llamar a estos 82» y la cabina abría OTRA jornada — la
     última que había usado («Vista Nuevo lead · segunda vuelta…»), guardada en
     este navegador. La cabina siempre llega con una lista nueva (`qs`), así que
     la jornada guardada sólo se retoma sola si está MARCANDO ahora mismo
     (`activa`: una recarga a media jornada no puede tirar la sala). Una
     pausada, lista o terminada queda en «Sesiones anteriores», con su botón. */
  const [sesionId, setSesionId] = useState<string | null>(() => sesionInicial || null);
  useEffect(() => {
    if (sesionInicial) return;
    const guardada = leerLocal<string | null>('cabina.sesion', null);
    if (!guardada) return;
    let vivo = true;
    fetch(`/api/crm/telefonia/marcador?id=${guardada}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (vivo && j?.sesion?.estado === 'activa') setSesionId(id => id || guardada); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  const [est, setEst] = useState<any>(null);           // { sesion, actual, pendientes, ahora }
  const [items, setItems] = useState<any[]>([]);
  const [previas, setPrevias] = useState<any[]>([]);
  const [telefonia, setTelefonia] = useState<{ ok: boolean; faltantes: string[]; fernanda: boolean } | null>(null);
  const [enSala, setEnSala] = useState(false);
  const [micAbierto, setMicAbierto] = useState(false);
  const [recienAbierto, setRecienAbierto] = useState(false);
  /* El nivel lo mide `Telefonia.tsx`, que es quien tiene el stream; aquí sólo
     se escucha. Duplicar el AnalyserNode sería abrir el micrófono dos veces. */
  const [nivelVoz, setNivelVoz] = useState(0);
  useEffect(() => {
    const h = (e: any) => setNivelVoz(Number(e?.detail?.nivel || 0));
    document.addEventListener('tel-nivel', h);
    return () => document.removeEventListener('tel-nivel', h);
  }, []);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [armando, setArmando] = useState<{ leidas: number; total: number } | null>(null);
  // La presentación se recuerda entre sesiones: es la misma casi siempre.
  const [pres, setPres] = useState(() => leerLocal('cabina.presentacion', {
    nombre: yo?.nombre ? `${String(yo.nombre).split(' ')[0]} de Sacscloud` : '', motivo: 'le llamo para dar seguimiento a su solicitud de información', buzon: false, auto: true, wrapup: 8, modo: 'manual', lineas: 1, reintentos: 0,
  }));
  /* Al abrir una sesión que ya existe, el control del buzón adopta lo que esa
     sesión tenga guardado (una vez, no en cada latido: si no, pisaría el clic
     que acabas de dar mientras el servidor todavía contesta). */
  const buzonAdoptado = useRef<string | null>(null);
  useEffect(() => {
    const cfg = est?.sesion?.config;
    if (!sesionId || !cfg || buzonAdoptado.current === sesionId) return;
    buzonAdoptado.current = sesionId;
    if (cfg.reintentos_buzon != null) setPres((x: any) => ({ ...x, reintentos: Number(cfg.reintentos_buzon) || 0 }));
  }, [sesionId, est?.sesion?.config]);

  /* ══ LOS HORARIOS, A LA VISTA, MIENTRAS HABLAS (19-sep-2026) ═════════════
     Pedido del dueño: «en la pantalla central debo poder ver los horarios de
     las reuniones rápido, para decidir cuál elegir con IA o sin IA, pero debo
     visualizarlo para decirle al prospecto cuál puede ser».

     Se cargan al descolgar y no al abrir la sesión: son los huecos de HOY, y
     entre la primera llamada y la número cuarenta pueden haber cambiado —una
     cita agendada por la web, un hueco que se llenó en Google Calendar—. Leerle
     al prospecto una hora que ya no existe es peor que no leerle ninguna. */
  const [tipoCita, setTipoCita] = useState<string>(() => leerLocal('cabina.tipocita', 'demo'));
  const [tiposCita, setTiposCita] = useState<any[]>([]);
  const [huecos, setHuecos] = useState<any[]>([]);
  const [cargandoHuecos, setCargandoHuecos] = useState(false);
  const traerHuecos = useCallback(async (tipo: string) => {
    if (!sesionId) return;
    setCargandoHuecos(true);
    const r = await post({ accion: 'huecos', id: sesionId, tipo });
    setCargandoHuecos(false);
    if (r?.ok) { setHuecos(r.huecos || []); setTiposCita(r.tipos || []); }
  }, [sesionId]);

  /* ══ LA JORNADA DE LLAMADAS, EN UN TELÉFONO (19-sep-2026) ════════════════
     Pedido del dueño: que todo lo de esta sesión funcione bien en móvil «con la
     mejor experiencia y diseño posible». Marcar cien números desde el teléfono
     no es la versión chica del escritorio: es otra postura —una mano, el
     aparato pegado a la oreja, la pantalla apagándose sola— y pide tres cosas
     que en escritorio no hacen falta. */
  const [listaAbierta, setListaAbierta] = useState(false);
  /* La hoja cerrada no pinta su contenido: sólo se sostiene lo que dura la
     animación de bajada, para que no se vacíe mientras se va. */
  const [hojaViva, setHojaViva] = useState(false);
  useEffect(() => {
    if (listaAbierta) { setHojaViva(true); return; }
    const t = setTimeout(() => setHojaViva(false), 260);
    return () => clearTimeout(t);
  }, [listaAbierta]);


  const [nota, setNota] = useState('');
  const [noLlamar, setNoLlamar] = useState(false);
  // La etapa que se tocó en ESTE cierre; se limpia al pasar al siguiente.
  const [etapaTocada, setEtapaTocada] = useState('');
  const notaItem = useRef<string | null>(null);
  const [tab, setTab] = useState<'lista' | 'hechas' | 'compromisos' | 'quitados'>('lista');
  /* ══ LOS COMPROMISOS DE LA JORNADA ══════════════════════════════════════
     Pedido del dueño (18-sep-2026): «una pestaña específica que diga
     compromisos, con las agendas que se generaron al hablar… que sea fácil ver
     fecha y hora en que se quedó, y si ya está en Google Calendar o no».
     Se piden aparte y sólo al abrir la pestaña: una consulta que cruza citas y
     contactos no puede ir en el pulso de cada segundo. */
  const [compromisos, setCompromisos] = useState<any[]>([]);
  const [compCargados, setCompCargados] = useState(false);

  const sesion = est?.sesion;
  const actual = est?.actual;
  // La etapa tocada es de ESTA llamada: al pasar al siguiente se limpia, o el
  // «Listo: quedó en…» del anterior se leería como si fuera del nuevo.
  useEffect(() => { setEtapaTocada(''); }, [actual?.id]);
  // Quién habla en esta sesión: 'manual' (yo), 'ia' (Fernanda sola) o 'asistido' (Fernanda abre, yo puedo tomar la llamada).
  const modo: 'manual' | 'ia' | 'asistido' = sesion?.modo && sesion.modo !== 'manual' ? sesion.modo : 'manual';
  const fernanda = modo !== 'manual';
  const sola = modo === 'ia';
  const fase: 'armar' | 'lista' | 'viva' | 'fin' = !sesionId || !sesion ? 'armar'
    : ['borrador', 'lista'].includes(sesion.estado) ? 'lista'
    : ['activa', 'pausada'].includes(sesion.estado) ? 'viva' : 'fin';

  /* 1 · LA PANTALLA NO SE APAGA MIENTRAS MARCAS. Con la sesión viva, el
     teléfono se bloqueaba a los treinta segundos: volvías a desbloquear, la
     pestaña se había dormido y el pulso se había parado justo cuando alguien
     contestaba. Wake Lock se pide sólo con la sesión activa y se suelta al
     terminar — retenerlo de más se come la batería de quien no está llamando.
     Safari sólo lo soporta desde iOS 16.4: donde no hay, no pasa nada. */
  const candado = useRef<any>(null);
  useEffect(() => {
    if (!movil) return;
    const nav: any = navigator;
    const pedir = async () => {
      if (fase !== 'viva' || document.visibilityState !== 'visible' || candado.current) return;
      try { candado.current = await nav.wakeLock?.request('screen'); candado.current?.addEventListener?.('release', () => { candado.current = null; }); } catch { /* sin permiso: se sigue igual */ }
    };
    const soltar = () => { try { candado.current?.release?.(); } catch { /* ya se fue */ } candado.current = null; };
    if (fase === 'viva') pedir(); else soltar();
    // Al volver de otra app hay que volver a pedirlo: el sistema lo suelta solo.
    const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); soltar(); };
  }, [movil, fase]);

  /* 2 · MODO LLAMADA EN EL TELÉFONO. La raíz del documento dice en qué fase
     está la cabina (ver CSS_MOVIL). Como la cabina es pantalla completa en
     TODAS sus fases, la barra de pestañas del CRM se esconde y su alto pasa a
     0 desde que se abre, igual que hace el hilo del inbox. */
  useEffect(() => {
    if (!movil) return;
    const raiz = document.documentElement;
    raiz.dataset.cabinaM = fase;
    const antes = raiz.style.getPropertyValue('--crm-bottomnav-h');
    raiz.style.setProperty('--crm-bottomnav-h', '0px');
    return () => {
      delete raiz.dataset.cabinaM;
      if (antes) raiz.style.setProperty('--crm-bottomnav-h', antes); else raiz.style.removeProperty('--crm-bottomnav-h');
    };
  }, [movil, fase]);

  useEffect(() => { guardarLocal('cabina.presentacion', pres); }, [pres]);
  useEffect(() => { guardarLocal('cabina.sesion', sesionId); }, [sesionId]);

  const cargarPrevias = useCallback(() => {
    fetch('/api/crm/telefonia/marcador?lista=1', { cache: 'no-store' }).then(r => r.json()).then(j => {
      setPrevias(j.sesiones || []);
      setTelefonia({ ok: !!j.telefonia, faltantes: j.faltantes || [], fernanda: !!j.fernanda });
    }).catch(() => {});
  }, []);
  useEffect(() => { cargarPrevias(); }, [cargarPrevias]);

  /* ══ EL PULSO: POR QUÉ LA TARJETA DEL CENTRO SE CONGELABA ═══════════════
     REPORTE DEL DUEÑO (17-sep-2026): «no me aparece en pantalla realmente a
     quién está marcando; mandan a buzón, pasa al siguiente, pero no se
     actualiza el contacto que aparece en medio… y le doy clic en pausar y
     parece que no hace nada».

     Los tres síntomas eran UN bug, y estaba en estas cuatro líneas. El guard
     anti-desorden comparaba contra la última petición LANZADA
     (`n !== seqEst.current`), no contra la última APLICADA. Con el pulso a
     400 ms mientras la central decide —y un `latir` de servidor que hace
     trabajo de verdad: cuelga items vencidos, cobra llamadas, rescata
     cierres— casi ninguna respuesta vuelve en menos de 400 ms. Y entonces,
     cuando llega, ya se lanzó otra: `n !== seqEst.current` y se tira.

     O sea que NINGUNA respuesta se aplicaba justo mientras más rápido latía,
     que es exactamente cuando está marcando. El centro se quedaba clavado en
     el contacto de hace cuatro, la lista de la derecha —que late cada 5 s y
     sí alcanzaba a aplicarse— iba adelantada, y «Pausar» parecía no hacer
     nada porque la acción SÍ salía pero el estado ya no se repintaba.

     Dos arreglos, y los dos hacen falta:
      · se aplica si la respuesta es MÁS NUEVA que la última aplicada
        (`n > aplicadoEst.current`), que es lo que de verdad evita el
        desorden sin tirar lo bueno;
      · y no se lanza otra mientras una sigue en vuelo, para no encolar
        peticiones contra un servidor que tarda más que el intervalo. */
  const seqEst = useRef(0), seqItems = useRef(0);
  const aplicadoEst = useRef(0), aplicadoItems = useRef(0);
  const enVueloEst = useRef(false), enVueloItems = useRef(false);
  const latir = useCallback(async () => {
    if (!sesionId || enVueloEst.current) return;
    const n = ++seqEst.current;
    enVueloEst.current = true;
    const j = await fetch(`/api/crm/telefonia/marcador?id=${sesionId}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => null)
      .finally(() => { enVueloEst.current = false; });
    if (!j || n <= aplicadoEst.current) return;
    aplicadoEst.current = n;
    if (j.error) { setSesionId(null); setEst(null); return; }
    setEst(j);
  }, [sesionId]);
  const cargarItems = useCallback(async () => {
    if (!sesionId || enVueloItems.current) return;
    const n = ++seqItems.current;
    enVueloItems.current = true;
    const j = await fetch(`/api/crm/telefonia/marcador?id=${sesionId}&items=1`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => null)
      .finally(() => { enVueloItems.current = false; });
    if (j?.items && n > aplicadoItems.current) { aplicadoItems.current = n; setItems(j.items); }
  }, [sesionId]);

  // El pulso: cada 400 ms mientras la central decide quién contestó (ahí cada
  // décima cuenta para el «Hola»), cada segundo el resto de la sesión viva,
  // cada 6 s si está parada.
  const decidiendo = ['marcando', 'timbrando', 'escuchando', 'portero'].includes(String(est?.actual?.estado || ''));
  useEffect(() => {
    if (!sesionId) return;
    let vivo = true;
    latir(); cargarItems();
    const t = setInterval(() => { if (vivo && document.visibilityState === 'visible') latir(); }, fase === 'viva' ? (decidiendo ? 400 : 1000) : 6000);
    const t2 = setInterval(() => { if (vivo && document.visibilityState === 'visible') cargarItems(); }, fase === 'viva' ? 5000 : 15000);
    return () => { vivo = false; clearInterval(t); clearInterval(t2); };
  }, [sesionId, fase, decidiendo, latir, cargarItems]);

  // Lo que dice el teléfono (Telefonia.tsx): si estoy en la sala y con el mic abierto.
  useEffect(() => {
    const h = (ev: any) => {
      const d = ev.detail || {};
      if (d.sesion_id && sesionId && d.sesion_id !== sesionId) return;
      setEnSala(!!d.en_sala);
      if (d.mute !== undefined) setMicAbierto(!d.mute);
      if (d.error) setError(d.error);
    };
    document.addEventListener('tel-sala-estado', h);
    document.dispatchEvent(new CustomEvent('tel-sala-consulta'));
    return () => document.removeEventListener('tel-sala-estado', h);
  }, [sesionId]);

  // EL MOMENTO: el item pasa a en_linea → timbre + micrófono abierto. Al
  // salir de en_linea → micrófono cerrado. Se decide por el id del item para
  // no abrir dos veces si el polling repite el estado.
  const abiertoPara = useRef<string | null>(null);
  useEffect(() => {
    /* ══ 🔴 EL AVISO VA EN EL DESCUELGUE, NO EN EL VEREDICTO (18-sep-2026) ══
       Medido en la llamada de Kike: contestó a las 17:04:52.6 y el item no pasó
       a `en_linea` hasta las 17:04:54.3. El pitido y el destello verde —lo
       único que de verdad se nota— sólo miraban `en_linea`, así que durante
       1.7 s el micrófono ya estaba abierto y en la pantalla no pasaba nada.
       Él dijo «bueno» a los 3.2 s y colgó a los 5.5 s sin oír una palabra
       nuestra: en toda la llamada no se transcribió ni una sílaba del vendedor.

       `escuchando` ES el momento en que descolgaron —lo que sigue es sólo la
       IA decidiendo si era persona o grabadora—, y el micrófono ya se abre ahí
       desde el arreglo del 17-sep. Que el aviso llegara después era la última
       pieza que faltaba: ahora suena en cuanto hay alguien del otro lado.

       Si resulta ser una contestadora se habrán dicho dos palabras a una
       máquina. El error contrario cuesta el contacto entero. */
    const id = ['en_linea', 'escuchando', 'portero'].includes(String(actual?.estado)) ? actual.id : null;
    if (id && abiertoPara.current !== id) {
      abiertoPara.current = id;
      avisar();
      /* El pitido no sirve con el teléfono en silencio —que es como anda casi
         siempre— y menos con el aparato en la oreja. La vibración sí llega:
         dos toques cortos, el patrón de «te están esperando». */
      try { (navigator as any).vibrate?.([60, 45, 60]); } catch { /* sin motor */ }
      document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: false } }));
      setMicAbierto(true);
      /* ══ «YA TE OYEN, HABLA» ════════════════════════════════════════════
         El micrófono se abría en silencio y la única señal era una pastilla
         gris arriba a la derecha. Fernando contestó, tú hablaste al aire y
         colgó a los cuatro segundos — el caso está medido en la base: una
         línea en lo oído, suya, y ninguna tuya.
         Medio segundo de verde en toda la tarjeta no se puede no ver, y es el
         medio segundo que decide si la primera frase llega. */
      setRecienAbierto(true);
      setTimeout(() => setRecienAbierto(false), 2500);
    } else if (!id && abiertoPara.current) {
      abiertoPara.current = null;
      document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: true } }));
      setMicAbierto(false);
    }
  }, [actual?.id, actual?.estado]);

  /* ══ EL MICRÓFONO SE ABRE SOLO EN CUANTO CONTESTAN ═══════════════════════
     REPORTE DEL DUEÑO (17-sep-2026): «por más que hablaba, el usuario no me
     escuchaba; quita lo de la barra espaciadora, que yo me escuche automático
     al momento que me pases la llamada».

     Qué pasaba: al contestar, el item entra en `escuchando` mientras el
     detector decide si es persona o contestadora. En ese rato el vendedor OÍA
     pero seguía MUDO, y solo la barra espaciadora lo abría. Si no la apretabas
     —o no sabías que existía— hablabas al vacío durante los primeros segundos,
     que son justo los que deciden la llamada.

     Ahora, en cuanto alguien descuelga (`escuchando` o `portero`), se toma la
     llamada sola: micrófono abierto y aviso a la central. El costo de
     equivocarse es asimétrico y por eso se prefiere abrir: si resultó ser una
     contestadora, se habló solo unos segundos a una máquina; si era una
     persona, se salvó la llamada.

     Se quitó el atajo de la barra espaciadora: con la apertura automática ya no
     hace falta, y dos mecanismos para lo mismo es justo lo que produjo el
     malentendido — creer que estabas al aire cuando no lo estabas. */
  const actualRef = useRef<any>(null);
  useEffect(() => { actualRef.current = actual; }, [actual]);
  const tomadoPara = useRef<string | null>(null);
  useEffect(() => {
    if (fase !== 'viva') return;
    const it = actual;
    if (!it || !['escuchando', 'portero'].includes(it.estado)) return;
    if (tomadoPara.current === it.id) return;      // ya se tomó para este item
    tomadoPara.current = it.id;
    document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: false } }));
    setMicAbierto(true);
    post({ accion: 'tomar', id: sesionId }).then(r => {
      if (r?.ok) { abiertoPara.current = it.id; }   // el efecto de `en_linea` ya no lo reabre
      else { document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: true } })); setMicAbierto(false); tomadoPara.current = null; }
      latir();
    });
  }, [fase, actual?.id, actual?.estado, sesionId, latir]);

  // SALA QUE NO SE CAE: si la sesión está activa y el teléfono se salió de la
  // sala (se cayó la red, se durmió la pestaña), se vuelve a entrar solo, con
  // pausas crecientes. Si tras varios intentos no entra, queda el botón.
  const [reintentos, setReintentos] = useState(0);
  useEffect(() => { if (enSala) setReintentos(0); }, [enSala]);
  useEffect(() => {
    if (fase !== 'viva' || enSala || sesion?.estado !== 'activa' || !sesionId) return;
    if (reintentos >= 4) return;
    const espera = [3000, 5000, 9000, 15000][reintentos] || 15000;   // 3 s: si saliste tú, el servidor alcanza a pausar antes
    const t = setTimeout(() => {
      setReintentos(n => n + 1);   // en estado, no en ref: así el siguiente intento se programa aunque nada más cambie
      document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId, silencioso: true } }));
    }, espera);
    return () => clearTimeout(t);
  }, [fase, enSala, sesion?.estado, sesionId, reintentos]);

  // El apunte sigue al item: cambia de item, se guarda lo escrito y se limpia.
  useEffect(() => {
    const id = actual?.id || null;
    if (notaItem.current && notaItem.current !== id) {
      const texto = nota.trim();
      if (texto) post({ accion: 'nota', id: sesionId, item: notaItem.current, nota: texto });
      setNota(''); setNoLlamar(false);
    }
    notaItem.current = id;
    if (id && actual?.nota && !nota) setNota(actual.nota);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id]);

  // ── Armar la lista con los filtros del inbox ──────────────────────────
  const armar = async () => {
    setError(''); setOcupado('armar');
    try {
      const filas: any[] = [];
      let offset = 0; let hayMas = true; let tot = total;
      while (hayMas && filas.length < 500) {
        /* DE DÓNDE SE LEE LA LISTA. El inbox sólo conoce conversaciones; las
           listas que trae el armador nuevo pueden venir del ABM, que no tiene
           ninguna. El query dice cuál es su origen (`fuente=`), y ése es el
           único lugar donde hay que mirarlo: las dos rutas contestan con la
           misma forma, así que el resto de esta función no se entera. */
        const fuente = /(^|&)fuente=/.test(qs) ? '/api/crm/telefonia/candidatos' : '/api/crm/whatsapp/inbox';
        const j = await fetch(`${fuente}?${qs}&limit=200&offset=${offset}`, { cache: 'no-store' }).then(r => r.json());
        const lote: any[] = j?.conversaciones || [];
        /* El cursor lo manda el servidor cuando lo manda: con dos fuentes
           (CRM + prospección) el avance no es «cuántas filas me diste», porque
           cada fuente lleva su propia ventana. Ver `candidatos.ts`. */
        filas.push(...lote); offset = Number(j?.siguiente_offset ?? (offset + lote.length)); hayMas = !!j?.hay_mas && lote.length > 0;
        tot = Number(j?.total_filtrado ?? tot);
        setArmando({ leidas: filas.length, total: tot });
      }
      const items = filas.map(c => ({
        contact_id: c.contact_id || null, company_id: c.company_id || null,
        conversation_id: c.virtual ? null : (c.wa_id || null),
        nombre: c.contacto?.nombre || null, empresa: c.empresa?.nombre || null,
        telefono: c.telefono || '',
      })).filter(i => i.telefono && !/@/.test(i.telefono));
      if (!items.length) { setError('Ninguna fila de esta lista tiene teléfono.'); return; }
      const r = await post({
        accion: 'crear', items, nombre: descripcion.slice(0, 120),
        origen: { qs, descripcion, filas: filas.length, total: tot },
        presentacion_nombre: pres.nombre, presentacion_motivo: pres.motivo, buzon_dejar_mensaje: pres.buzon,
        config: { auto_continuar: pres.auto, wrapup_seg: Number(pres.wrapup) || 8, lineas: Number(pres.lineas) || 1, reintentos_buzon: Number(pres.reintentos) || 0 }, modo: pres.modo,
      });
      if (r?.error) { setError(r.error); return; }
      setSesionId(r.id); setTab('lista');
      cargarPrevias();
    } catch (e: any) { setError(e?.message || 'No se pudo armar la lista'); }
    finally { setOcupado(''); setArmando(null); }
  };

  const accion = async (a: string, extra: any = {}) => {
    if (!sesionId) return;
    setError(''); setOcupado(a);
    const desde = Date.now();
    const r = await post({ accion: a, id: sesionId, ...extra });
    // 600 ms mínimo «trabajando»: una respuesta instantánea no se ve, y lo que
    // no se ve se vuelve a picar.
    const falta = 600 - (Date.now() - desde);
    if (falta > 0) await new Promise(res => setTimeout(res, falta));
    setOcupado('');
    if (r?.error) { setError(r.error + (r.faltantes?.length ? ` (faltan: ${r.faltantes.join(', ')})` : '')); return null; }
    /* LA RESPUESTA DEL BOTÓN NO ESPERA AL SIGUIENTE LATIDO. Si el servidor ya
       contestó cómo quedó la sesión, se pinta YA: «Pausar» tiene que cambiar
       la pantalla en el momento en que se aprieta. Con el pulso congelado eso
       tardaba segundos o no llegaba, y parecía que el botón no hacía nada —que
       es justo lo que reportó el dueño—. El latido sigue detrás para lo demás.

       Se salta el guard de secuencia a propósito: esto no es una carrera entre
       sondeos, es la respuesta directa a lo que acabas de pedir. */
    if (r?.sesion) setEst((prev: any) => ({ ...(prev || {}), ...r }));
    latir(); cargarItems();
    return r;
  };

  const empezar = async () => {
    // Guardar la presentación por si la editó, luego arrancar y entrar a la sala.
    const ok1 = await accion('presentacion', { presentacion_nombre: pres.nombre, presentacion_motivo: pres.motivo, buzon_dejar_mensaje: pres.buzon, config: { auto_continuar: pres.auto, wrapup_seg: Number(pres.wrapup) || 8, lineas: Number(pres.lineas) || 1, reintentos_buzon: Number(pres.reintentos) || 0 }, modo: pres.modo });
    if (!ok1) return;
    const r = await accion(sesion?.estado === 'pausada' ? 'reanudar' : 'iniciar');
    // Con Fernanda sola no hay sala que abrir: la central marca y ella habla.
    if (r && pres.modo !== 'ia') document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId } }));
  };
  const entrarSala = () => { setError(''); setReintentos(0); document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId } })); };
  const terminar = async () => {
    await accion('terminar');
    document.dispatchEvent(new CustomEvent('tel-colgar-sala'));
  };
  const guardarResultado = async (resultado: string) => {
    if (!actual) return;
    await accion('resultado', { item: actual.id, resultado, no_llamar: resultado === 'no_interesa' && noLlamar });
  };
  const guardarNota = async () => {
    // Sin `ocupado`: se dispara al salir del textarea y no debe desactivar el botón que el vendedor va a picar.
    if (!actual || !nota.trim()) return;
    const r = await post({ accion: 'nota', id: sesionId, item: actual.id, nota: nota.trim() });
    if (r?.error) setError(r.error);
  };
  const relanzar = async (id: string) => {
    setError(''); setOcupado('relanzar');
    const r = await post({ accion: 'relanzar', id });
    setOcupado('');
    if (r?.error) { setError(r.error); return; }
    if (!r?.total) { setError('No quedó nadie a quien volver a llamar.'); return; }
    setSesionId(r.id); setTab('lista'); cargarPrevias();
  };
  const salirDeSesion = () => {
    // Los contadores se reinician con la sesión: si no, la primera respuesta de
    // la sesión nueva llega con n=1 contra un `aplicado` de 800 y se tira.
    seqEst.current = 0; aplicadoEst.current = 0; seqItems.current = 0; aplicadoItems.current = 0;
    setSesionId(null); setEst(null); setItems([]); cargarPrevias();
  };

  // ── Cálculos de pantalla ──────────────────────────────────────────────
  const hechos = useMemo(() => items.filter(i => ['hecho', 'saltado'].includes(i.estado)), [items]);
  /* Los que salieron de la lista: los que quitaste tú (o cancelaste mientras
     timbraban) primero, y luego los que el sistema quitó solo. Antes no se
     veían en ningún lado: «Por marcar» los esconde y «Hechas» no los cuenta. */
  const quitados = useMemo(() => {
    const porTi = (i: any) => /cancelaste|quitaste/i.test(String(i.motivo_exclusion || ''));
    return items.filter(i => i.estado === 'excluido').sort((a, b) => Number(porTi(b)) - Number(porTi(a)) || a.orden - b.orden);
  }, [items]);
  const pendientes = useMemo(() => items.filter(i => i.estado === 'pendiente'), [items]);
  const excluidos = useMemo(() => items.filter(i => i.estado === 'excluido'), [items]);
  const segCierre = actual?.estado === 'cierre' && actual.terminado_at && est?.ahora
    ? Math.max(0, Number(sesion?.config?.wrapup_seg ?? 8) - Math.round((new Date(est.ahora).getTime() - new Date(actual.terminado_at).getTime()) / 1000)) : null;
  const propuesta = actual?.estado === 'cierre' ? actual?.cierre_ia?.propuesta : null;
  /* Cuánto hace el cierre: lo dicen el título de la propuesta y el botón de
     la barra en el teléfono («Confirmar las 5»), que así no se confirma a
     ciegas lo que queda debajo del pliegue. */
  const cuentaCierre = propuesta ? (() => {
    const envVivos = (propuesta.envios || []).filter((e: any) => ['listo', 'pendiente_ventana'].includes(String(e.estado)));
    const cosas = (propuesta.compromisos || []).length + (propuesta.datos || []).length + (['lead_calificado', 'descalificado'].includes(propuesta.etapa) ? 1 : 0) + envVivos.length;
    const mensajes = (propuesta.compromisos || []).filter((c: any) => c.tipo === 'reunion').length + new Set(envVivos.map((e: any) => e.conocimiento_id || e.id)).size + (propuesta.extras || []).length;
    return { cosas, mensajes };
  })() : null;
  const [notaEntera, setNotaEntera] = useState(false);
  useEffect(() => { setNotaEntera(false); }, [actual?.id]);
  /* ══ CONTESTÓ UNA PERSONA: LA LISTA TE ESPERA ══════════════════════════
     Pedido del dueño (17-sep-2026): «hablé con ella, me pidió que le marcara
     más tarde… ahí ya no debe seguir a la siguiente: ahí debe aparecerme la
     interfaz con las decisiones, y ya al tomar la decisión me pasa a la otra».
     El motor hace su parte (no avanza ni aplica nada); aquí se DICE, porque un
     proceso que se para sin avisar se siente igual que uno atorado. */
  /* Qué decirle cuando la IA no dejó propuesta. La clase del fallo la escribe
     el servidor (`cierre_ia.fallo`); aquí sólo se traduce a algo que se pueda
     leer sin saber qué es un timeout. `sin_transcripcion` no aparece: ése es el
     caso de la llamada de quince segundos, donde no hay nada que arreglar. */
  const falloCierre = (() => {
    const ia = actual?.cierre_ia;
    if (!ia || actual?.cierre_estado !== 'sin_datos') return null;
    const fallo = String(ia.fallo || 'otro');
    const min = Number(actual?.duracion_seg || 0) > 60 ? `${Math.round(Number(actual.duracion_seg) / 60)} min de llamada` : 'esta llamada';
    const dicho = fallo === 'tiempo' ? `No alcanzó a leer ${min} antes de que se acabara el tiempo. Lo que se dijo NO se perdió: sigue guardado, sólo hay que volver a leerlo.`
      : fallo === 'saldo' ? 'La cuenta de IA se quedó sin saldo, así que no se leyó la llamada. Recarga y dale a «Volver a leer»: la transcripción sigue guardada.'
      : fallo === 'sin_llave' ? 'La IA no está configurada en el servidor, así que nadie leyó la llamada.'
      : `No se pudo leer la llamada (${String(ia.motivo || 'sin detalle').slice(0, 90)}). La transcripción sigue guardada.`;
    return { fallo, dicho };
  })();

  useEffect(() => { guardarLocal('cabina.tipocita', tipoCita); }, [tipoCita]);
  useEffect(() => {
    if (fase !== 'viva' || !['escuchando', 'portero', 'en_linea', 'cierre'].includes(String(actual?.estado))) return;
    traerHuecos(tipoCita);
  }, [fase, actual?.id, tipoCita, traerHuecos]);

  /* Agendar lo que acabas de acordar de viva voz, sin esperar a la IA. */
  const agendarHueco = async (h: { fecha: string; hora: string }) => {
    if (!actual) return;
    const r = await accion('agendar', { item: actual.id, fecha: h.fecha, hora: h.hora, tipo: tipoCita, motivo: nota.slice(0, 160) || undefined });
    if (r?.ok) { traerHuecos(tipoCita); cargarItems(); }
  };

  /* La marca de «buena» es de la LLAMADA, no del item: vive junto al audio,
     que es lo que se va a usar para entrenar. Se pinta al instante. */
  const [ejemploMarcado, setEjemploMarcado] = useState(false);
  useEffect(() => { setEjemploMarcado(false); }, [actual?.id]);
  const marcarEjemplo = async () => {
    if (!actual?.call_sid) { setError('Esta llamada todavía no tiene grabación'); return; }
    const v = !ejemploMarcado;
    setEjemploMarcado(v);
    const r = await fetch('/api/crm/telefonia/grabaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: actual.call_sid, ejemplo: v }),
    }).then(x => x.json()).catch(() => null);
    if (!r?.ok) { setEjemploMarcado(!v); setError(r?.error || 'No se pudo guardar la marca'); }
  };

  const regenerarCierre = async () => {
    if (!actual) return;
    const r = await accion('cierre_regenerar', { item: actual.id });
    if (r?.ok) { latir(); cargarItems(); }
  };

  const esperaTuDecision = actual?.estado === 'cierre' && ['persona', 'duda'].includes(String(actual?.veredicto || '')) && !sola;
  const enviosAbiertos: any[] = (propuesta?.envios || []).filter((e: any) => e.estado === 'falta');
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  useEffect(() => {
    /* También al TERMINAR, no sólo dentro de su pestaña: el repaso del final
       necesita saber cuáles no entraron a Google Calendar, y si sólo se cargan
       al abrir la pestaña, el repaso diría «cero» hasta que alguien la abra. */
    /* Y al abrir la hoja en el teléfono: su pestaña enseña cuántos hay, como
       las otras tres, y sin cargarlos diría un número falso. */
    if ((tab !== 'compromisos' && fase !== 'fin' && !(movil && listaAbierta)) || !sesionId) return;
    let vivo = true;
    const traer = () => fetch(`/api/crm/telefonia/marcador?id=${sesionId}&compromisos=1`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (vivo) { setCompromisos(j.compromisos || []); setCompCargados(true); } }).catch(() => {});
    traer();
    const t = setInterval(traer, 15000);   // se llena conforme cuelgas: no hace falta más seguido
    return () => { vivo = false; clearInterval(t); };
  }, [tab, fase, sesionId, hechos.length, movil, listaAbierta]);
  /* ══ LO QUE HACE FALTA PARA DECIDIR RÁPIDO Y BIEN (17-sep-2026) ══════════
     Las diez mejoras del momento de colgar viven aquí: corregir la propuesta,
     rechazarla, leer lo que se dijo, saber por qué la IA no pudo, las salidas
     en un clic, la hora de la llamada de vuelta, deshacer, quién sigue, el
     teclado y la grabación. */
  const [editando, setEditando] = useState<Record<number, { fecha: string; hora: string }>>({});
  const [deshacer, setDeshacer] = useState<{ item: string; hasta: number } | null>(null);
  const [deshecho, setDeshecho] = useState<string[] | null>(null);
  const [verDicho, setVerDicho] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [cuando, setCuando] = useState<{ fecha: string; hora: string }>({ fecha: '', hora: '' });
  const responderEnvio = async (envioId: string) => {
    const texto = (respuestas[envioId] || '').trim();
    if (texto.length < 10) { setError('Escribe al menos una línea de lo que se le manda.'); return; }
    const r = await accion('cierre_respuesta', { envio: envioId, texto });
    if (r && !r.ok) setError(r.motivo || 'No se pudo mandar');
  };
  const [cancelando, setCancelando] = useState<string | null>(null);
  const cancelarLinea = async (itemId: string) => {
    setCancelando(itemId);
    const r = await accion('cancelar', { item: itemId });
    setCancelando(null);
    if (r?.error) setError(r.error);
  };
  /* ══ LAS LÍNEAS QUE ESTÁN MARCANDO ═══════════════════════════════════════
     Se pinta en DOS sitios y por eso vive aquí: dentro de la tarjeta de la
     llamada cuando ya hay alguien, y en el hueco del centro mientras nadie ha
     contestado todavía —que con varias líneas es la mayor parte del tiempo, y
     antes era un «Marcando al siguiente…» que no decía a quién—.

     «Yo vería a quiénes se les está marcando.» Una columna, renglones grandes:
     igual en la compu y en el teléfono. */
  const bloqueLineas = (est?.vivos || []).length > 1 && !actual?.veredicto ? (
    /* `minmax(0, 1fr)`: sin él la rejilla crecía al ancho del nombre más
       largo y en el teléfono los renglones —con su ✕— se salían por la
       derecha (medido a 390: 455 px). */
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: movil ? 8 : 6 }}>
      <span style={etiqueta}>Marcando a {est.vivos.length} a la vez</span>
      {est.vivos.map((v: any) => (
        <div key={v.id} style={{
          display: 'flex', alignItems: 'center', gap: movil ? 10 : 9, padding: movil ? '10px 10px 10px 14px' : '9px 11px', borderRadius: 10, minWidth: 0,
          border: `1px solid ${v.veredicto === 'persona' || v.estado === 'en_linea' ? '#9fdcc2' : C.g200}`,
          background: v.veredicto === 'persona' || v.estado === 'en_linea' ? '#EAF8F2' : '#fff',
        }}>
          {/* En el teléfono el punto va en línea con «Timbrando · 14s» (ronda 6):
              solo, a la izquierda, sangraba el nombre ~32 px que a 360 faltaban. */}
          {!movil && <span className={['marcando', 'timbrando'].includes(v.estado) ? 'wa-pulso' : undefined} style={{
            width: 9, height: 9, borderRadius: 999, flexShrink: 0,
            background: v.estado === 'en_linea' ? '#1E8A63' : v.veredicto === 'buzon' ? '#9a6a10' : '#9B8CFA',
          }} />}
          {/* En el teléfono el nombre va entero y el estado debajo: en un
              renglón de 300 px no caben nombre, empresa, estado y la ✕. */}
          {/* En el teléfono (ronda 5): el nombre a todo lo ancho, en tinta
              (en gris parecía apagado y es el dato clave), y «Cancelar» baja al
              renglón del estado. Al lado del nombre le quitaba ~110 px y a 360
              lo partía en dos («Mariana López / Treviño»). */}
          {movil ? (
            <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 2 }}>
              <b style={{ display: 'block', fontSize: 15, lineHeight: 1.3, color: C.g900, overflowWrap: 'anywhere' }}>{v.nombre || telefonoLegible(v.telefono)}</b>
              {v.empresa && <div style={{ fontSize: 13, color: C.g500, overflowWrap: 'anywhere' }}>{v.empresa}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* A quién le está sonando, sin abrir la lista. */}
                  {v.nombre && v.telefono && <div style={{ fontSize: 14, color: C.g700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{telefonoLegible(v.telefono)}</div>}
                  <div style={{ fontSize: 13, color: v.estado === 'en_linea' ? (movil ? verdeTexto : '#1E8A63') : C.moradoTinta, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={['marcando', 'timbrando'].includes(v.estado) ? 'wa-pulso' : undefined} style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: v.estado === 'en_linea' ? '#1E8A63' : v.veredicto === 'buzon' ? '#9a6a10' : '#9B8CFA' }} />
                    {v.veredicto === 'buzon' ? 'Buzón' : ETIQUETA_ITEM[v.estado] || v.estado}
                    {['marcando', 'timbrando'].includes(v.estado) && v.segundos > 0 ? ` · ${v.segundos}s` : ''}
                  </div>
                </div>
              {/* ✕ = cancelar ESTA llamada y sacarla de la lista (22-sep-2026).
                  Queda en la pestaña «Quitados», con por qué había entrado, y se
                  puede volver a meter. Con alguien ya en línea no sale: se cuelga. */}
              {['marcando', 'timbrando', 'escuchando', 'portero'].includes(v.estado) && (
                <button onClick={() => cancelarLinea(v.id)} disabled={cancelando === v.id}
                  title="Cancelar esta llamada y quitarla de la lista" aria-label={`Cancelar la llamada a ${v.nombre || 'este contacto'}`}
                  /* En el teléfono con palabra: en plena marcación una ✕ roja sola
                     no dice si cuelga, quita o cierra algo. */
                  style={movil ? { ...cancelarMovil, opacity: cancelando === v.id ? 0.5 : 1 } : { flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.g200}`, background: '#fff', color: '#C0554E', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: cancelando === v.id ? 0.5 : 1 }}>
                  <IcoX size={movil ? 15 : 14} />{movil && 'Cancelar'}
                </button>
              )}
              </div>
            </div>
          ) : (<>
            <b style={{ fontSize: 13, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.nombre || telefonoLegible(v.telefono)}
              {v.empresa && <span style={{ fontWeight: 500, color: C.g500 }}> · {v.empresa}</span>}
            </b>
            <span style={{ fontSize: 11.5, color: v.estado === 'en_linea' ? '#1E8A63' : C.g500, fontWeight: 700, flexShrink: 0 }}>
              {v.veredicto === 'buzon' ? 'Buzón' : ETIQUETA_ITEM[v.estado] || v.estado}
              {['marcando', 'timbrando'].includes(v.estado) && v.segundos > 0 ? ` · ${v.segundos}s` : ''}
            </span>
          </>)}
          {!movil && ['marcando', 'timbrando', 'escuchando', 'portero'].includes(v.estado) && (
            <button onClick={() => cancelarLinea(v.id)} disabled={cancelando === v.id}
              title="Cancelar esta llamada y quitarla de la lista" aria-label={`Cancelar la llamada a ${v.nombre || 'este contacto'}`}
              style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.g200}`, background: '#fff', color: '#C0554E', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: cancelando === v.id ? 0.5 : 1 }}>
              <IcoX size={14} />
            </button>
          )}
        </div>
      ))}
      {/* En el teléfono la ayuda en una frase corta (ronda 6): larga empujaba
          «Siguen: … Ver ›» bajo el degradado a 360. */}
      <span style={{ fontSize: movil ? 13 : 11, color: C.g500, lineHeight: 1.45 }}>
        {movil ? 'Te pasamos con el primero que conteste; a los demás se les cuelga.' : 'Te pasamos con el primero que conteste; a los demás se les cuelga mientras todavía timbran.'}
        {est.abandonadas > 0 && (movil ? ` · ${est.abandonadas} contest${est.abandonadas === 1 ? 'ó' : 'aron'} tarde (se ${est.abandonadas === 1 ? 'le' : 'les'} vuelve a marcar).` : est.abandonadas === 1
          ? ' · 1 contestó cuando ya estabas en otra llamada (se le vuelve a marcar).'
          : ` · ${est.abandonadas} contestaron cuando ya estabas en otra llamada (se les vuelve a marcar).`)}
      </span>
    </div>
  ) : null;

  const confirmarYSeguir = async () => {
    if (!actual) return;
    const item = actual.id;
    // Primero el cierre con lo que el vendedor ajustó (chip y apunte), luego el siguiente. Si el cierre falla, no se avanza a ciegas.
    if (propuesta) { const r = await accion('cierre', { item, nota: nota.trim() || undefined }); if (!r) return; }
    /* DOS MINUTOS PARA DESHACER. Es lo que tarda uno en darse cuenta de que
       confirmó de más — y para entonces el siguiente ya está timbrando, que es
       justo cuando no se puede ir a cancelar una cita a mano. */
    if (propuesta) { setDeshacer({ item, hasta: Date.now() + 120000 }); setDeshecho(null); }
    await accion('siguiente');
  };
  /* Una salida en un clic: se anota y se ejecuta en el mismo viaje, por el
     motor de acciones (el mismo que atiende lo que el cliente pidió). */
  const rapida = async (cual: string, params: any = {}) => {
    if (!actual?.call_sid) { setError('Esta llamada no tiene con qué: no se registró en el espejo.'); return; }
    setOcupado(cual);
    const r = await fetch('/api/crm/telefonia/sala', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: actual.call_sid, accion: 'rapida', cual, params }),
    }).then(x => x.json()).catch(() => ({ error: 'Sin red' }));
    setOcupado('');
    if (r?.error) setError(r.error);
    else if (r?.ok === false && r?.dicho) setError(r.dicho);
    else { setError(''); latir(); }
  };
  /** «Márcame más tarde», con hora de verdad. Sin hora la promesa se agenda a
   *  las 10 por omisión, y ésa es justo la que se rompe. */
  const volverA = (horas: number | null, dia?: 'manana' | 'lunes') => {
    const d = new Date();
    // En MINUTOS, para que «en 5 min» sea en cinco minutos y no en cinco horas:
    // los atajos cortos son fracciones (5/60) y `setHours` las tiraba al suelo.
    if (horas) d.setTime(d.getTime() + Math.round(horas * 60) * 60000);
    if (dia === 'manana') { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); }
    if (dia === 'lunes') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(10, 0, 0, 0); }
    const fecha = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return rapida('volver_a_llamar', { fecha, hora });
  };
  const editarCierre = (cambios: any) => accion('cierre_editar', { item: actual?.id, cambios });
  /* «Mandarle también» + «Así le van a llegar» (22-sep-2026). El catálogo se
     pide una vez por llamada, cuando ya hay propuesta que ampliar. */
  const [opcCierre, setOpcCierre] = useState<{ item: string; conocimientos: any[]; plantillas: any[]; ventana_abierta: boolean; primer_nombre: string } | null>(null);
  const [extrasAbierto, setExtrasAbierto] = useState(false);
  const [paramsExtra, setParamsExtra] = useState<Record<string, string>>({});
  const descartarPropuesta = async () => {
    if (!(await confirmar('¿Tirar lo que propuso la IA? Se cierra la llamada con lo que tú digas.'))) return;
    await accion('cierre_descartar', { item: actual?.id });
  };
  const pedirGrabacion = async () => {
    setOcupado('audio');
    const r = await post({ accion: 'grabacion', id: sesionId, item: actual?.id });
    setOcupado('');
    if (r?.url) setAudio(r.url); else setError(r?.motivo || r?.error || 'No hay grabación todavía');
  };
  const deshacerCierre = async () => {
    if (!deshacer) return;
    setOcupado('deshacer');
    const r = await post({ accion: 'cierre_deshacer', id: sesionId, item: deshacer.item });
    setOcupado('');
    if (r?.error) { setError(r.error); return; }
    setDeshecho(r.deshecho || []); setDeshacer(null);
  };

  /* ══ EL TECLADO, EN EL MOMENTO DE DECIDIR ════════════════════════════════
     1-5 eligen cómo quedó, Enter confirma y pasa al siguiente. En una jornada
     de cincuenta llamadas, ir al ratón para cada chip es lo que convierte diez
     minutos de trabajo en una hora. Nunca secuestra el teclado mientras se
     escribe: si el foco está en un campo, las teclas son del campo. */
  const RES_TECLA = ['contesto', 'volver_llamar', 'dieron_datos', 'no_interesa', 'buzon'];
  useEffect(() => {
    if (!esperaTuDecision) return;
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const r = RES_TECLA[Number(e.key) - 1];
        if (r && actual) post({ accion: 'resultado', id: sesionId, item: actual.id, resultado: r }).then(() => latir());
      } else if (e.key === 'Enter') {
        e.preventDefault(); confirmarYSeguir();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [esperaTuDecision, actual?.id, propuesta, nota]);

  // Lo que se está escribiendo para un envío sobrevive al recargar (por id de envío) y le avisa a la central que espere.
  useEffect(() => {
    if (!enviosAbiertos.length) return;
    setRespuestas(r => {
      const n = { ...r };
      for (const e of enviosAbiertos) if (!n[e.id]) { const v = leerSesion(`cabina.envio.${e.id}`, ''); if (v) n[e.id] = v; }
      return n;
    });
  }, [enviosAbiertos.map((e: any) => e.id).join(',')]);
  useEffect(() => { for (const [id, v] of Object.entries(respuestas)) guardarSesion(`cabina.envio.${id}`, v); }, [respuestas]);
  const escribiendo = enviosAbiertos.some((e: any) => (respuestas[e.id] || '').trim().length > 0);
  useEffect(() => {
    if (!escribiendo || !actual?.id || actual.estado !== 'cierre') return;
    const tick = () => post({ accion: 'cierre_escribiendo', id: sesionId, item: actual.id });
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, [escribiendo, actual?.id, actual?.estado, sesionId]);
  const conversaciones = Number(sesion?.contestadas || 0);
  const costoSesion = Number(sesion?.costo_usd || 0);

  const estiloMovil = movil ? <style>{CSS_MOVIL}</style> : null;
  const raizEstilo = movil ? raizEstiloMovil : raizEstiloEscritorio;

  /* EL ENCABEZADO EN EL TELÉFONO, EN DOS RENGLONES. En uno solo, el marcador
     y la pastilla de la sala dejaban el nombre de la jornada en «Lead…» y la ✕
     de salir en 24 px. Arriba el nombre entero y la salida; abajo, cuando la
     jornada está viva, cómo va y si te oyen. */
  /* Con «Cambiar lista» a la derecha, un nombre largo («Mis leads · Ropa
     para dama · WhatsApp verificado») subía a 3 renglones y el encabezado
     medía 84 px contra los 56 del armador (guía §1: hasta 2). El nombre sigue
     entero: su primer pedazo es el título y el resto baja al segundo renglón
     gris, como metadato. En la jornada viva no hay botón y cabe en dos. */
  /* Antes de armar no hay lista que cambiar: la ✕ ya vuelve a los filtros, y
     «Armar la lista» es el título del armador que queda detrás (ronda 3). */
  const conCambiar = fase !== 'viva' && !!sesionId;
  const nombreCab = sesion?.nombre || (fase === 'armar' ? 'Nueva jornada' : 'Llamadas inteligentes');
  const partesCab = String(nombreCab).split(' · ');
  const partirCab = movil && conCambiar && partesCab.length > 1 && String(nombreCab).length > 24;
  const cab = movil ? (
    /* EL ENCABEZADO COMÚN DEL FLUJO (guía de continuidad §1, 24-sep-2026).
       Igual que el armador, la lista y la sala: la salida SIEMPRE a la
       izquierda (✕ de 44 sin fondo), el título negro de 17 px en hasta dos
       renglones —el nombre de la lista, entero— y a la derecha, sólo antes y
       después de marcar, «Cambiar lista» como botón de texto. Debajo, con la
       jornada viva, cómo va y si te oyen, en texto con punto: son estados, no
       botones, y no llevan fondo. */
    <div style={{ padding: 'max(6px, env(safe-area-inset-top)) 12px 6px 4px', borderBottom: `1px solid ${C.g200}`, flexShrink: 0, background: '#fff', display: 'grid', gap: 0 }}>
      {/* Sin `gap` en la fila: la regla de `.cab-m` sube cualquier «gap: 4px» a
          8 y el título quedaba en x=56 contra x=52 del armador. El aire de 4
          px lo pone el margen de la ✕. */}
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
        <button onClick={onCerrar} title="Salir de la cabina" aria-label="Salir de la cabina" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g500, width: 44, height: 44, minHeight: 44, flexShrink: 0, padding: 0, marginRight: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoX size={20} /></button>
        <b style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', flex: 1, minWidth: 0, lineHeight: 1.25, color: C.g900, overflowWrap: 'anywhere', padding: '4px 0' }}>
          {partirCab ? partesCab[0] : nombreCab}
        </b>
        {/* «Cambiar lista» vive SÓLO aquí (guía §5). Antes de armar la lista
            vuelve a los filtros; con una lista abierta, a elegir otra. */}
        {conCambiar && (
          <button onClick={sesionId ? salirDeSesion : onCerrar} style={{ flexShrink: 0, minHeight: 44, padding: '0 4px 0 12px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cambiar lista</button>
        )}
      </div>
      {partirCab && (
        <div style={{ padding: '0 0 4px 48px', fontSize: 13, color: C.g500, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{partesCab.slice(1).join(' · ')}</div>
      )}
      {fase === 'viva' && sesion && (
        /* Un solo renglón a la altura de la ✕ + 12: los metadatos a la
           izquierda y el estado a la derecha. */
        /* 4 px a la derecha (ronda 1 cabina): con los 12 del encabezado, el
           estado termina en el mismo canal de 16 px que el contenido. */
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px 12px', flexWrap: 'wrap', padding: '0 4px 4px 48px', minHeight: 24 }}>
          <span title={`${fmt(sesion.segundos_hablados || 0)} al teléfono`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.g500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            <span><b style={{ color: verdeTexto, fontSize: 14 }}>{conversaciones}</b> {conversaciones === 1 ? 'habló' : 'hablaron'}</span>
            <span aria-hidden>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IcoReloj size={13} />{Math.round(Number(sesion.segundos_hablados || 0) / 60)} min</span>
          </span>
          <span style={{ flex: 1 }} />
          {fernanda && (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5B4BD6', whiteSpace: 'nowrap' }}>{sola ? 'Habla Fernanda' : 'Fernanda y tú'}</span>
          )}
          {/* Si te oyen o no, a la vista SIN scroll (guía §6): punto de 8 px
              y texto, sin fondo ni borde — con pastilla parecía un botón de
              quitar el mudo. Se queda también en plena llamada (ronda 3): es
              justo cuando más importa saber si te oyen, y el encabezado dice
              lo mismo en marcando, en la llamada y en el cierre. */}
          {!sola && (
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: enSala ? (micAbierto ? verdeTexto : C.g500) : '#9a6a10', whiteSpace: 'nowrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: enSala ? (micAbierto ? '#1E8A63' : '#9CA3AF') : '#E8A838', ...(enSala && micAbierto ? { animation: 'cab-late 1.25s ease-in-out infinite' } : null) }} />
              {enSala ? (micAbierto ? 'Te oyen' : 'En mudo') : 'Fuera de la sala'}
            </span>
          )}
        </div>
      )}
    </div>
  ) : (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: `1px solid ${C.g200}`, flexShrink: 0, background: '#fff' }}>
      <IcoTelefono size={16} style={{ color: C.moradoTinta }} />
      {/* En el teléfono sobra «Llamadas inteligentes»: la pantalla ya se llama
          «Llamadas» dos centímetros más arriba. Repetirlo dejaba el título en
          «Llam…» y escondía lo único que distingue una jornada de otra, que es
          su nombre. */}
      <b style={{ fontSize: 14, letterSpacing: '-0.01em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {movil
          ? (sesion?.nombre || 'Llamadas inteligentes')
          : <>Llamadas inteligentes{sesion?.nombre ? <span style={{ fontWeight: 500, color: C.g500 }}> · {sesion.nombre}</span> : null}</>}
      </b>
      {/* El marcador del partido, de reojo: conversaciones · costo · sin
          contacto. Sin tarjetas, sin etiquetas largas, sin robarle sitio a la
          llamada. Se esconde en el teléfono, donde el header ya va lleno. */}
      {/* En el teléfono, con la píldora de «Fuera de la sala» puesta, los KPIs
          dejan el nombre de la jornada en «Vista …». Cuando hay un aviso que
          resolver, el marcador del partido puede esperar: se esconde y el
          título recupera su sitio. */}
      {fase === 'viva' && sesion && !(movil && !enSala && !sola) && (
        /* En el teléfono se quedaban FUERA —el header iba lleno— y con eso
           desaparecía el marcador del partido justo en la pantalla donde más
           se trabaja hoy. Caben los dos que se miran de reojo entre llamada y
           llamada: cuántas conversaciones llevas y cuánto has hablado. El
           costo y el detalle del «sin contacto» son para estudiarlos al final,
           y al final ya salen en tarjetas. */
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: movil ? 7 : 10, fontSize: 11, color: C.g500, fontVariantNumeric: 'tabular-nums' }}>
          <span title="Conversaciones de verdad"><b style={{ color: '#1E8A63', fontSize: 12.5 }}>{conversaciones}</b> conv</span>
          <span title="Lo que llevas hablado">{fmt(sesion.segundos_hablados || 0)}</span>
          {!movil && <span title="Costo de la jornada"><b style={{ color: C.moradoTinta, fontSize: 12.5 }}>US$ {costoSesion.toFixed(2)}</b></span>}
          {!movil && <span title="Buzón · sin contestar · contestadora">{Number(sesion.buzon || 0) + Number(sesion.sin_contestar || 0) + Number(sesion.porteros || 0)} sin contacto</span>}
        </span>
      )}
      {fase === 'viva' && fernanda && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 999, padding: '3px 9px' }}>
          {sola ? 'Habla Fernanda' : 'Fernanda y tú'}
        </span>
      )}
      {fase === 'viva' && !sola && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: enSala ? (micAbierto ? '#1E8A63' : C.moradoTinta) : '#9a6a10', background: enSala ? (micAbierto ? '#EAF8F2' : C.moradoAgua) : '#FFF4E5', borderRadius: 999, padding: '3px 9px' }}>
          <IcoMic size={12} />{enSala ? (micAbierto ? 'Te oyen' : 'En la sala, mudo') : 'Fuera de la sala'}
        </span>
      )}
      {sesionId && fase !== 'viva' && <button onClick={salirDeSesion} style={{ ...btnT, padding: '5px 10px' }}>Otra lista</button>}
      <button onClick={onCerrar} title="Volver al inbox" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 4 }}><IcoX size={16} /></button>
    </div>
  );

  const errorBox = error ? (
    <div role="alert" style={{ margin: '0 0 12px', background: '#FEF0EF', border: '1px solid #f0c4bd', color: '#C0554E', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, display: 'flex', gap: 8 }}>
      <span style={{ flex: 1 }}>{error}</span>
      <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C0554E', fontFamily: 'inherit', fontWeight: 700 }}>x</button>
    </div>
  ) : null;

  /* Una jornada anterior. En el teléfono en tres renglones a todo lo ancho
     —nombre, números, y estado con sus botones—: compartiendo fila, las
     métricas se partían en cuatro líneas dentro de 170 px. */
  const previasVivas = previas.filter(p => ['activa', 'pausada'].includes(p.estado));
  const previasResto = previas.filter(p => !['activa', 'pausada'].includes(p.estado));
  const estadoMovil = (punto: string, fg: string, texto: React.ReactNode, pulso?: boolean) => (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: fg === '#1E8A63' ? verdeTexto : fg, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
      <span aria-hidden className={pulso ? 'wa-pulso' : undefined} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: punto }} />{texto}
    </span>
  );
  const tarjetaPrevia = (p: any) => {
    const viva = ['activa', 'pausada'].includes(p.estado);
    /* En el teléfono, estado con punto y sin fondo (guía §6). */
    const pastilla = movil ? estadoMovil(viva ? '#1E8A63' : '#9CA3AF', viva ? '#1E8A63' : C.g500, p.estado) : <span style={{ fontSize: movil ? 12.5 : 11, fontWeight: 700, borderRadius: 999, padding: movil ? '4px 10px' : '2px 8px', background: viva ? '#EAF8F2' : C.g100, color: viva ? '#1E8A63' : '#4B5563' }}>{p.estado}</span>;
    const botones = (<>
      <button onClick={() => { setSesionId(p.id); setTab(p.estado === 'terminada' ? 'hechas' : 'lista'); }} style={movil ? { ...btnT, fontSize: 14, padding: '0 18px', justifyContent: 'center' } : btnS}>{['terminada', 'cancelada'].includes(p.estado) ? 'Ver' : 'Abrir'}</button>
      {['terminada', 'cancelada'].includes(p.estado) && (p.sin_contestar + p.buzon + p.porteros) > 0 && (
        <button onClick={() => relanzar(p.id)} disabled={ocupado === 'relanzar'} style={btnT}>Relanzar</button>
      )}
    </>);
    const numeros = `${movil ? fechaCorta(p.created_at) : String(p.created_at).slice(0, 10)} · ${p.total} en lista · ${p.contestadas} contestaron · ${p.buzon} buzón · ${p.sin_contestar} sin contestar${p.porteros ? ` · ${p.porteros} contestadora` : ''}`;
    if (movil) return (
      <div key={p.id} style={{ background: '#fff', border: `1px solid ${viva ? '#9fdcc2' : '#ececec'}`, borderLeft: viva ? '3px solid #4FBF95' : '1px solid #ececec', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.g900, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{p.nombre || 'Sesión'}</div>
        <div style={{ fontSize: 13, color: C.g500, lineHeight: 1.45 }}>{numeros}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {pastilla}
          <span style={{ flex: 1 }} />
          {botones}
        </div>
      </div>
    );
    return (
      <div key={p.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.g900 }}>{p.nombre || 'Sesión'}</div>
          <div style={{ fontSize: 11.5, color: C.g500 }}>{numeros}</div>
        </div>
        {pastilla}
        {botones}
      </div>
    );
  };

  const formPresentacion = (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        {/* En el teléfono la etiqueta en mayúsculas era un renglón entero que
            casi tocaba el borde: se acorta y la aclaración va debajo. */}
        <label style={etiqueta}>{movil ? 'Quién llama' : 'Quién llama (lo que oye la contestadora)'}</label>
        <input value={pres.nombre} onChange={e => setPres((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Aarón de Sacscloud" aria-label="Quién llama" style={campo} />
        {movil && <span style={{ fontSize: 14, color: C.g500, display: 'block', marginTop: 4, lineHeight: 1.4 }}>Es lo que oye la contestadora.</span>}
      </div>
      <div>
        <label style={etiqueta}>Motivo de la llamada</label>
        {/* En el teléfono, de varios renglones: en uno solo la frase se cortaba
            («…a su solic») y no se podía releer lo que se va a decir. */}
        {movil
          ? <textarea className="cab-auto" rows={3} value={pres.motivo} onChange={e => setPres((p: any) => ({ ...p, motivo: e.target.value }))} placeholder="le llamo para dar seguimiento a su solicitud" style={campo} />
          : <input value={pres.motivo} onChange={e => setPres((p: any) => ({ ...p, motivo: e.target.value }))} placeholder="le llamo para dar seguimiento a su solicitud" style={campo} />}
        <span style={{ fontSize: movil ? 14 : 11, color: movil ? C.g500 : C.g400, display: 'block', marginTop: 4, lineHeight: 1.45 }}>Se dice así: «Soy {pres.nombre || '…'}, {pres.motivo || '…'}. Busco a {'{nombre}'}. Gracias.»</span>
      </div>
      {telefonia?.fernanda && (
        <div>
          <label style={etiqueta}>Quién habla</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([['manual', 'Yo', 'Marco y hablo yo; la IA solo escucha y cierra.'], ['ia', 'Fernanda', 'La voz de la IA hace toda la llamada y agenda sola. No hace falta que estés en la sala.'], ['asistido', 'Fernanda y yo', 'Fernanda abre y conversa; yo escucho y puedo tomar la llamada cuando quiera.']] as const).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => setPres((p: any) => ({ ...p, modo: v }))} title={d} disabled={!!sesionId && !['borrador', 'lista', 'pausada'].includes(sesion?.estado)} aria-pressed={movil ? pres.modo === v : undefined} style={movil ? opcionMovil(pres.modo === v) : {
                /* En el teléfono el elegido va en el morado tinta del botón
                   principal: blanco sobre #9B8CFA daba 2.8:1 y no se leía. */
                border: `1.5px solid ${pres.modo === v ? (movil ? C.moradoTinta : '#9B8CFA') : C.g200}`, background: pres.modo === v ? (movil ? C.moradoTinta : '#9B8CFA') : '#fff', color: pres.modo === v ? '#fff' : C.g700,
                borderRadius: 999, padding: movil ? '0 16px' : '5px 12px', fontSize: movil ? 14 : 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
            ))}
          </div>
          <span style={{ fontSize: movil ? 14 : 11, color: movil ? C.g500 : C.g400, display: 'block', marginTop: 4, lineHeight: 1.45 }}>
            {pres.modo === 'ia' ? 'Fernanda se presenta, entiende el negocio, agenda la reunión y sigue con el siguiente. Tú ves la transcripción en vivo.' : pres.modo === 'asistido' ? 'Fernanda habla primero; tú estás en la sala mudo y puedes tomar la llamada con «Hablar yo».' : 'Tú hablas. La IA escucha, detecta buzones y contestadoras, y hace el cierre.'}
          </span>
        </div>
      )}
      {/* ══ CUÁNTAS LLAMADAS A LA VEZ ══════════════════════════════════════
          El tiempo de una jornada no se va hablando: se va TIMBRANDO. Contesta
          uno de cada cinco y cada intento cuesta media vuelta de reloj. Con dos
          o tres líneas sólo oyes a los que contestaron.
          Lo que se paga a cambio está escrito abajo sin adornos: con una línea
          oyes el timbre y el buzón; con varias, no — y de vez en cuando alguien
          contesta cuando ya estás hablando con otro. */}
      {pres.modo === 'manual' && (
        <div>
          <label style={etiqueta}>Cuántas llamadas a la vez</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([[1, 'Una'], [2, 'Dos'], [3, 'Tres']] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={() => setPres((p: any) => ({ ...p, lineas: v }))}
                disabled={!!sesionId && !['borrador', 'lista', 'pausada'].includes(sesion?.estado)}
                aria-pressed={movil ? Number(pres.lineas || 1) === v : undefined}
                style={movil ? opcionMovil(Number(pres.lineas || 1) === v) : {
                  border: `1.5px solid ${Number(pres.lineas || 1) === v ? (movil ? C.moradoTinta : '#9B8CFA') : C.g200}`, background: Number(pres.lineas || 1) === v ? (movil ? C.moradoTinta : '#9B8CFA') : '#fff',
                  color: Number(pres.lineas || 1) === v ? '#fff' : C.g700, borderRadius: 999, padding: movil ? '0 18px' : '5px 14px', fontSize: movil ? 14 : 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
            ))}
          </div>
          <span style={{ fontSize: movil ? 14 : 11, color: movil ? C.g500 : C.g400, display: 'block', marginTop: 4, lineHeight: 1.5 }}>
            {Number(pres.lineas || 1) === 1
              ? 'Una por una: oyes el timbre, el buzón y todo lo que pasa. Es lo más tranquilo y lo más lento.'
              : `Se marca a ${pres.lineas} a la vez y te pasamos al PRIMERO que conteste; a los demás se les cuelga mientras todavía timbra. No oyes el timbre —serían ${pres.lineas} audios encimados— y, muy de vez en cuando, alguien contesta justo cuando ya estás con otro: a ése se le dice que le marcamos en un momento y vuelve a la lista.`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: movil ? 14 : 12.5, color: C.g700 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!pres.buzon} onChange={e => setPres((p: any) => ({ ...p, buzon: e.target.checked }))} /> Dejar recado en el buzón de voz</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!pres.auto} onChange={e => setPres((p: any) => ({ ...p, auto: e.target.checked }))} /> Seguir solo con el siguiente</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Pausa entre llamadas <input type="number" min={3} max={60} value={pres.wrapup} onChange={e => setPres((p: any) => ({ ...p, wrapup: e.target.value }))} style={{ ...campo, width: 62, padding: '4px 6px' }} /> s</label>
      </div>
    </div>
  );

  /* El control del buzón: en escritorio va en su tarjeta; en el teléfono,
     dentro del plegable de la configuración. */
  const buzonEl = (<>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {/* ══ 🔴 ERA UN BOTÓN MUERTO (18-sep-2026) ═══════════════════
                    Reporte del dueño: «intento escoger "1 vez más" y no me lo
                    selecciona». No era el pintado: es que este control era el
                    ÚNICO de esta pantalla que guardaba con `accion()`, y
                    `accion()` empieza con `if (!sesionId) return` — aquí la
                    sesión todavía no existe, se crea al armar la lista. El clic
                    se iba al vacío, sin error y sin cambiar nada.

                    Ahora vive en `pres`, como el resto de lo que se decide
                    antes de arrancar (auto-continuar, wrap-up, líneas, quién
                    habla): se pinta al instante, se recuerda en el navegador y
                    viaja en el `config` al crear o al empezar. Si la sesión YA
                    existe —se entró a cambiarlo a media jornada— además se
                    guarda en el momento, que era la intención original. */}
                {[0, 1, 2, 3].map(v => {
                  /* Se pinta desde `pres` y NO desde la sesión, aunque haya
                     sesión: el clic tiene que verse en el momento, y la sesión
                     no se refresca hasta el siguiente latido (hasta 6 s). El
                     efecto de abajo adopta el valor guardado al abrir una
                     sesión, así que las dos cosas no se pelean. */
                  const elegido = Number(pres.reintentos || 0) === v;
                  return (
                  <button key={v} onClick={() => {
                    setPres((x: any) => { const n = { ...x, reintentos: v }; guardarLocal('cabina.presentacion', n); return n; });
                    if (sesionId) accion('presentacion', { config: { reintentos_buzon: v } });
                  }}
                    aria-pressed={movil ? elegido : undefined}
                    style={movil ? opcionMovil(elegido) : { border: `1px solid ${elegido ? '#E8A838' : C.g200}`,
                      background: elegido ? '#FFF8EC' : '#fff',
                      color: elegido ? '#9a6a10' : C.g500,
                      borderRadius: 999, padding: movil ? '0 14px' : '5px 13px', fontSize: movil ? 14 : 12.5,
                      fontWeight: elegido ? 800 : 600,
                      cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v === 0 ? 'No reintentar' : `${v} ${v === 1 ? 'vez' : 'veces'} más`}
                  </button>
                  );
                })}
              </div>
              <div style={{ fontSize: movil ? 14 : 11.5, color: C.g500, marginTop: 7, lineHeight: 1.5 }}>
                Se reintenta a los 25 minutos. Al que va DIRECTO al buzón no se le
                reintenta nunca: ese teléfono está apagado.
              </div>
  </>);
  const resumenConfig = `${pres.modo === 'ia' ? 'habla Fernanda' : pres.modo === 'asistido' ? 'Fernanda y tú' : 'hablas tú'} · ${Number(pres.lineas || 1) === 1 ? 'una a la vez' : `${pres.lineas} a la vez`} · ${Number(pres.reintentos || 0) ? `reintentar ${pres.reintentos} ${Number(pres.reintentos) === 1 ? 'vez' : 'veces'}` : 'no reintentar'}`;

  // ── 1 · ARMAR ─────────────────────────────────────────────────────────
  /* Cada fase monta su propio CUERPO (`key={fase}` en el contenedor con
     scroll, no en la raíz): si React reusara los nodos de la anterior, una
     tarjeta con franja pasaba a ser la fila de KPIs y avisaba de estilos en
     conflicto (border + borderLeft), y el scroll de la fase anterior se
     heredaba. La raíz y el encabezado ya no se remontan al cambiar de fase. */
  if (fase === 'armar') {
    return (
      <div className={movil ? 'cab-m' : undefined} style={raizEstilo}>
        {estiloMovil}{cab}
        <div key={fase} className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? `12px 16px ${PIE_MOVIL}` : 22 }}>
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            {telefonia && !telefonia.ok && (
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: movil ? ambarTextoAgua : '#9a6a10', borderRadius: 9, padding: '8px 12px', fontSize: 12.5 }}>
                La telefonía no está configurada (faltan {telefonia.faltantes.length} datos). Puedes armar la lista, pero no marcar.
              </div>
            )}
            {/* En el teléfono, tarjeta lisa (ronda 1 cabina): la franja morada era
                un acento que ninguna otra tarjeta equivalente del flujo repite. */}
            <div style={movil ? { background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, padding: '13px 16px' } : tarjeta('#9B8CFA')}>
              <span style={etiqueta}>La lista</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.g900 }}>{descripcion}</div>
              {/* En el teléfono, una línea y el detalle plegado: seis renglones
                  grises antes de lo accionable no dejaban ver qué hacer aquí. */}
              {movil ? (<>
                <div style={{ fontSize: 14, color: C.g700, marginTop: 2, lineHeight: 1.45 }}>
                  {total > 0 ? `${total} ${total === 1 ? 'contacto' : 'contactos'}` : 'Sin filas con los filtros de ahora'}{total > 500 ? ' · se toman los primeros 500' : ''} · se quitan solos los que no se pueden llamar
                </div>
                {/* «Cambiar filtros» a la vista (ronda 5): el botón de abajo
                    dice «con estos filtros» y nada en la tarjeta dejaba
                    volver a cambiarlos. Vuelve al armador, que es de donde se
                    vino (la ✕ del encabezado hace lo mismo, pero no lo dice). */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <details style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <summary style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 14, fontWeight: 700, color: C.moradoTinta, cursor: 'pointer', listStyle: 'none' }}>¿Por qué se quitan?</summary>
                    <div style={{ fontSize: 13, color: C.g500, lineHeight: 1.5 }}>
                      No entran los que no tienen teléfono, los marcados «no llamar», los que se descalificaron alguna vez, los que ya tuvieron una acción (salvo que lo quites en el armador) y los que ya se intentaron 3 veces esta semana.
                    </div>
                  </details>
                  {/* «Cambiar filtros» sube al encabezado como «Cambiar lista»
                      (guía §5): la misma intención en un solo lugar. */}
                </div>
              </>) : (
              <div style={{ fontSize: 12.5, color: C.g500, marginTop: 2 }}>
                {total > 0 ? `${total} ${total === 1 ? 'contacto' : 'contactos'} con los filtros de ahora` : 'Sin filas con los filtros de ahora'}{total > 500 ? ' · se toman los primeros 500' : ''}.
                Se quitan solos los que no tienen teléfono, los marcados «no llamar», los que se descalificaron alguna vez, los que ya tuvieron una acción (salvo que lo quites en el armador) y los que ya se intentaron 3 veces esta semana.
              </div>
              )}
              {armando && <div style={{ marginTop: 8, fontSize: 12, color: C.moradoTinta, fontWeight: 600 }}>Leyendo la lista… {armando.leidas}{armando.total ? ` de ${armando.total}` : ''}</div>}
            </div>
            {/* RETOMAR, ARRIBA. Quien abre la cabina con una jornada a medias
                muchas veces viene a seguirla: en el teléfono quedaba al fondo,
                a cuatro pantallas de scroll, debajo del formulario entero. Va
                justo debajo de la lista nueva —que es a lo que se entró— en
                renglones compactos: nombre, cómo va y «Abrir». */}
            {movil && previasVivas.length > 0 && (
              <div style={{ background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, overflow: 'hidden' }}>
                {/* Rótulo como «La lista» de arriba: mismo peso, sin acento verde. */}
                <div style={{ ...etiqueta, padding: '12px 16px 4px', marginBottom: 0 }}>
                  {previasVivas.length === 1 ? 'Tienes una jornada a medias' : `Tienes ${previasVivas.length} jornadas a medias`}
                </div>
                {previasVivas.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderTop: `1px solid ${C.g100}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.g900, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{p.nombre || 'Sesión'}</div>
                      <div style={{ fontSize: 13, color: C.g500 }}>{p.estado} · {p.contestadas} contestaron de {p.total}</div>
                    </div>
                    <button onClick={() => { setSesionId(p.id); setTab('lista'); }} style={{ ...btnT, fontSize: 14, padding: '0 16px', flexShrink: 0, justifyContent: 'center' }}>Abrir</button>
                  </div>
                ))}
              </div>
            )}
            {/* EN EL TELÉFONO, LA CONFIGURACIÓN PLEGADA (ronda 5). Cómo te
                presentas, quién habla, cuántas a la vez y el buzón son lo mismo
                casi siempre (se recuerdan entre jornadas): abiertos, empujaban
                «Sesiones anteriores» a ~1,750 px de scroll. Plegados, el título
                dice lo elegido («hablas tú · una a la vez · no reintentar») y
                se abre sólo para cambiarlo. */}
            {movil ? (
              <Colapsable movil titulo="Cómo vas a llamar" resumen={resumenConfig}>
                <div style={{ display: 'grid', gap: 16 }}>
                  {formPresentacion}
                  <div>
                    <span style={etiqueta}>Si suena y se va al buzón</span>
                    {buzonEl}
                  </div>
                </div>
              </Colapsable>
            ) : (<>
            <div style={tarjeta('#7DA6F5')}>
              <span style={etiqueta}>Cómo te presentas</span>
              {formPresentacion}
            </div>
            {/* SI SUENA Y SE VA AL BUZÓN, ¿SE VUELVE A INTENTAR?
                Un teléfono que SUENA está encendido y con alguien cerca: no
                contestó ahora, puede contestar en veinte minutos. Uno que va
                derecho al buzón está apagado, y reintentarlo es quemar llamadas
                contra una grabadora. Por eso la opción sólo aplica al primero —
                el motor los distingue por cuánto tardó en «contestar». */}
            <div style={tarjeta('#E8A838')}>
              <span style={etiqueta}>Si suena y se va al buzón</span>
              {buzonEl}
            </div>
            </>)}
            {/* En el teléfono el botón vive en la barra de abajo (ver el final
                de esta fase): aquí quedaba a 1,100 px de altura, tres
                pantallas de scroll después de abrir. */}
            {movil ? (
              <span style={{ fontSize: 14, color: C.g500, lineHeight: 1.45 }}>Al armarla la revisas antes de marcar: nadie recibe una llamada todavía.</span>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={armar} disabled={!!ocupado || total === 0} style={{ ...S.btnP, opacity: !!ocupado || total === 0 ? 0.6 : 1 }}>
                  {ocupado === 'armar' ? 'Armando…' : 'Armar la lista con los filtros actuales'}
                </button>
                <span style={{ fontSize: 11.5, color: movil ? C.g500 : C.g400 }}>Después la revisas antes de marcar.</span>
              </div>
            )}

            {(movil ? previasResto : previas).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={etiqueta}>Sesiones anteriores</span>
                <div style={{ display: 'grid', gap: movil ? 10 : 6 }}>
                  {(movil ? previasResto : previas).map(tarjetaPrevia)}
                </div>
              </div>
            )}
          </div>
        </div>
        {movil && (
          <div style={barraPie}>{bandaPie}
            <button onClick={armar} disabled={!!ocupado || total === 0} style={{ ...ctaMovil, ...(total === 0 ? ctaMovilOff : null), opacity: ocupado ? 0.85 : 1 }}>
              {ocupado === 'armar' ? <><Cargador />{armando ? `Leyendo ${armando.leidas}…` : 'Armando…'}</> : 'Armar la lista con los filtros actuales'}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* Volver a leer una llamada YA pasada, desde la lista. El botón del panel de
     cierre sólo alcanza a la llamada que tienes delante; cuando la jornada
     siguió, la que se quedó sin leer es justo la que se pierde de vista. */
  const releer = async (itemId: string) => {
    setError(''); setOcupado(`releer-${itemId}`);
    const r = await post({ accion: 'cierre_regenerar', id: sesionId, item: itemId });
    setOcupado('');
    if (r?.error) { setError(r.error); return; }
    latir(); cargarItems();
  };

  /* Lo que va debajo del nombre: el apunte, qué quedó hecho y si la IA no
     pudo cerrarla. Lo comparten la fila del escritorio y la del teléfono. */
  const detalleItem = (i: any) => (<>
      {i.nota && <div style={{ fontSize: movil ? 13 : 11.5, color: '#4B5563', marginTop: 2, fontStyle: 'italic' }}>{i.nota}</div>}
      {/* ══ QUÉ QUEDÓ HECHO EN ESTA LLAMADA ══════════════════════════════
          Pedido del dueño (18-sep-2026): «en el resumen de las terminadas
          debe decirme si se hizo corrección de datos, si se agendó demo, si
          se agendó discovery y así, para que yo pueda ver si todo se agendó
          en orden y bien».

          Antes sólo había una píldora con el desenlace («Hablamos») y había
          que abrir la conversación para saber si de verdad quedó la cita, si
          el PDF salió y si los datos se guardaron. Ahora está en la fila,
          con la misma frase que dejó el cierre al ejecutarlo — incluida la
          confirmación por WhatsApp de la reunión, que es lo que faltaba. */}
      {(i.hecho || []).length > 0 && (
        <div style={{ marginTop: 3, display: 'grid', gap: 1 }}>
          {i.hecho.map((h: string, n: number) => (
            <div key={n} style={{ fontSize: movil ? 13 : 11, lineHeight: 1.45, color: /no se pudo|no salió|no se le pudo|sin fecha|tarea:/i.test(h) ? '#9a6a10' : movil ? verdeTexto : '#1E8A63' }}>
              {/no se pudo|no salió|no se le pudo/i.test(h) ? '⚠️' : '✓'} {h}
            </div>
          ))}
        </div>
      )}
      {/* Y si la IA no pudo cerrarla, se dice aquí mismo: una llamada sin
          nada hecho y sin explicación se lee como que el sistema falló. */}
      {i.estado === 'hecho' && !(i.hecho || []).length && i.cierre_motivo && (
        <div style={{ fontSize: movil ? 13 : 11, color: '#9a6a10', marginTop: 3, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span>{i.cierre_fallo === 'tiempo' ? 'No alcanzó a leerla: se acabó el tiempo'
            : i.cierre_fallo === 'saldo' ? 'No la leyó: la cuenta de IA se quedó sin saldo'
            : i.cierre_fallo === 'sin_transcripcion' ? 'Sin transcripción que leer'
            : `La IA no la cerró: ${i.cierre_motivo}`}</span>
          {/* La llamada ya pasó y la lista siguió, pero lo que se dijo SIGUE
              guardado: aquí se rescata sin tener que volver a la tarjeta.
              Sólo donde hay algo que releer — con `sin_transcripcion` no lo
              hay, y ofrecerlo sería prometer algo que no va a pasar. */}
          {i.cierre_estado === 'sin_datos' && i.cierre_fallo && i.cierre_fallo !== 'sin_transcripcion' && (
            <button onClick={() => releer(i.id)} disabled={!!ocupado}
              style={{ border: '1px solid #E8A838', background: '#fff', color: '#9a6a10', borderRadius: movil ? 12 : 999, padding: movil ? '0 14px' : '2px 9px', fontSize: movil ? 14 : 10.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              {ocupado === `releer-${i.id}` ? 'Leyendo…' : 'Volver a leer'}
            </button>
          )}
        </div>
      )}
  </>);
  /* En el teléfono el estado es una pastilla con color, como las de «Contestó»
     o «Buzón de voz»: en gris de 12 px, «Timbrando» no se distinguía de «En
     espera» y lo que está pasando AHORA se perdía en la lista. */
  /* Guía de continuidad §6 (24-sep-2026): el estado es un punto de 8 px y
     texto de 13 px, SIN fondo ni borde. En pastilla lila sobre «Cancelar»
     parecía otro botón. Colores sólo de la paleta del flujo. */
  const TONO_ITEM: Record<string, { punto: string; fg: string }> = {
    marcando: { punto: '#9B8CFA', fg: C.moradoTinta }, timbrando: { punto: '#9B8CFA', fg: C.moradoTinta },
    escuchando: { punto: '#1E8A63', fg: '#1E8A63' }, portero: { punto: '#E8A838', fg: '#9a6a10' }, en_linea: { punto: '#1E8A63', fg: '#1E8A63' },
    cierre: { punto: '#5B4BD6', fg: C.moradoTinta }, excluido: { punto: '#9CA3AF', fg: '#4B5563' },
  };
  const estadoItem = (i: any) => movil && !(i.estado === 'hecho' || i.estado === 'saltado') ? (() => {
    const t = i.estado === 'pendiente' && i.volver_at ? { punto: '#9B8CFA', fg: C.moradoTinta } : TONO_ITEM[i.estado] || { punto: '#9CA3AF', fg: C.g500 };
    return estadoMovil(t.punto, t.fg, <>{i.estado === 'pendiente' && fase === 'fin' ? 'Sin marcar' : i.estado === 'pendiente' && i.volver_at ? `A las ${new Date(i.volver_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}` : (ETIQUETA_ITEM[i.estado] || i.estado)}</>, ['marcando', 'timbrando'].includes(i.estado));
  })() : movil ? estadoMovil(tono(i.resultado).fg, tono(i.resultado).fg, ETIQUETA_RESULTADO[i.resultado] || ETIQUETA_ITEM[i.estado]) : (
    <>
      {i.estado === 'hecho' || i.estado === 'saltado'
        ? <span style={{ fontSize: movil ? 13 : 11, fontWeight: 700, borderRadius: 999, padding: movil ? '3px 10px' : '2px 8px', whiteSpace: 'nowrap', ...tono(i.resultado), background: tono(i.resultado).bg, color: tono(i.resultado).fg }}>{ETIQUETA_RESULTADO[i.resultado] || ETIQUETA_ITEM[i.estado]}</span>
        : <span style={{ fontSize: 11, color: i.volver_at ? C.moradoTinta : C.g500, fontWeight: i.volver_at ? 700 : 400 }}>{i.estado === 'pendiente' && fase === 'fin' ? 'Sin marcar' : i.estado === 'pendiente' && i.volver_at ? `A las ${new Date(i.volver_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}` : (ETIQUETA_ITEM[i.estado] || i.estado)}</span>}
    </>
  );

  /* LA FILA EN EL TELÉFONO. En un renglón de 360 px no caben número, nombre,
     teléfono, estado y tres botones: el nombre y el teléfono salían cortados
     —justo lo que se viene a leer— y la ✕ de quitar medía 18 px. Aquí el
     nombre y el teléfono van enteros, el estado a su derecha, y los botones
     en su propio renglón, de pulgar y con palabra («Quitar», no una ✕). */
  const filaItemMovil = (i: any, conAcciones: boolean, compacto: boolean) => {
    const acciones: React.ReactNode[] = [];
    if (!compacto && i.telefono) acciones.push(
      <button key="ll" onClick={() => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: i.telefono, nombre: i.nombre || null } }))}
        title={`Llamar a ${i.nombre || telefonoLegible(i.telefono)} ahora`}
        style={{ ...secContenido, gridColumn: '1' }}>
        <IcoTelefono size={14} /> Llamar
      </button>);
    /* «Chat» sale de la botonera (ronda 3 cabina): en la rejilla de tres, las
       filas sin WhatsApp dejaban el hueco del medio vacío y los botones
       cambiaban de sitio de una fila a otra. Ahora es botón de texto (guía
       §3.6) arriba a la derecha, junto al nombre, y la botonera es siempre
       Llamar | Quitar, en las mismas dos columnas. */
    const chat = !compacto && i.conversation_id && onAbrirConversacion ? (
      <button key="ch" onClick={() => onAbrirConversacion(i.conversation_id)} title="Ver la conversación"
        style={{ border: 'none', background: 'none', color: '#5B4BD6', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 4px 0 12px', margin: '-11px -4px 0 0', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}>Ver chat ›</button>
    ) : null;
    if (conAcciones && i.estado === 'pendiente') acciones.push(
      <button key="q" onClick={() => accion('excluir', { item: i.id })} title="Quitar de la lista" aria-label={`Quitar a ${i.nombre || telefonoLegible(i.telefono)} de la lista`}
        /* Sin la ✕ (ronda 1 cabina): con ella se leía como el «Cancelar» de
           la línea que timbra. Quitar es sacar de la lista, no colgar. */
        style={compacto ? destructivoFila : { ...quitarMovil, gridColumn: '2' }}>Quitar</button>);
    /* En la hoja, los que están timbrando llevan la MISMA ✕ de la vista
       principal: si no, parecía que desde la lista no se podían cancelar. */
    if (['marcando', 'timbrando', 'escuchando', 'portero'].includes(i.estado) && fase === 'viva') acciones.push(
      <button key="cx" onClick={() => cancelarLinea(i.id)} disabled={cancelando === i.id}
        aria-label={`Cancelar la llamada a ${i.nombre || 'este contacto'}`}
        style={compacto ? { ...destructivoFila, opacity: cancelando === i.id ? 0.5 : 1 } : { ...cancelarMovil, opacity: cancelando === i.id ? 0.5 : 1 }}>{!compacto && <IcoX size={15} />}Cancelar</button>);
    if (conAcciones && !compacto && i.estado === 'excluido') acciones.push(
      <button key="vm" onClick={() => accion('incluir', { item: i.id })} style={secContenido}>Volver a meter</button>);
    return (
      <div key={i.id} style={{ padding: '11px 16px', borderBottom: `1px solid ${C.g100}`, background: i.id === actual?.id ? C.moradoSuave : i.estado === 'excluido' ? C.g50 : '#fff', display: 'grid', gap: 8 }}>
        {/* Al que quedó fuera lo distinguen el fondo gris y su pastilla, no la
            opacidad: con toda la fila al 60 % el texto bajaba a 2.9:1 y
            «Volver a meter» parecía deshabilitado aunque funcionaba. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* El número de orden va en línea con el nombre: en su propia columna
              se comía 40 px que a 360 le faltaban al nombre y a los botones. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.g900, lineHeight: 1.3, overflowWrap: 'anywhere' }}><span style={{ fontSize: 13, fontWeight: 600, color: C.g500, fontVariantNumeric: 'tabular-nums' }}>{i.orden + 1}.</span> {i.nombre || telefonoLegible(i.telefono)}</div>
            {i.empresa && <div style={{ fontSize: 13, color: C.g500, overflowWrap: 'anywhere' }}>{i.empresa}</div>}
            <div style={{ fontSize: 13, color: C.g700, fontVariantNumeric: 'tabular-nums' }}>{telefonoLegible(i.telefono)}{i.intentos ? ` · ${i.intentos} ${i.intentos === 1 ? 'intento' : 'intentos'}` : ''}{i.duracion_seg ? ` · ${fmt(i.duracion_seg)}` : ''}</div>
            {i.motivo_exclusion && <div style={{ fontSize: 13, color: C.g500 }}>{i.motivo_exclusion}</div>}
            {detalleItem(i)}
          </div>
          {/* Antes de marcar, «En espera» en las veinte filas no decía nada
              (ronda 5): se quita y el nombre gana el ancho. En la hoja de la
              jornada, el único botón de la fila (Quitar o Cancelar) va debajo
              del estado, en la misma columna: la fila baja de ~136 a ~100 px. */}
          {(!(fase === 'lista' && i.estado === 'pendiente' && !i.volver_at) || (compacto && acciones.length === 1) || chat) && (
            <span style={{ flexShrink: 0, paddingTop: 2, display: 'grid', justifyItems: 'end', gap: 8 }}>
              {chat}
              {!(fase === 'lista' && i.estado === 'pendiente' && !i.volver_at) && estadoItem(i)}
              {compacto && acciones.length === 1 && acciones}
            </span>
          )}
        </div>
        {/* Rejilla fija de dos huecos iguales: Llamar y Quitar siempre en la
            misma columna y del mismo ancho en todas las filas. */}
        {acciones.length > 0 && !(compacto && acciones.length === 1) && (
          <div style={!compacto && i.estado === 'pendiente' && i.telefono ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 } : { display: 'flex', gap: 8, flexWrap: 'wrap' }}>{acciones}</div>
        )}
      </div>
    );
  };

  const filaItem = (i: any, conAcciones: boolean, compacto = false) => movil ? filaItemMovil(i, conAcciones, compacto) : (
    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.g100}`, background: i.id === actual?.id ? C.moradoSuave : '#fff', opacity: i.estado === 'excluido' ? 0.55 : 1 }}>
      <span style={{ width: 22, fontSize: 11, color: C.g400, textAlign: 'right', flexShrink: 0 }}>{i.orden + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.g900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nombre || telefonoLegible(i.telefono)}{i.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {i.empresa}</span> : null}</div>
        <div style={{ fontSize: 11.5, color: C.g500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{telefonoLegible(i.telefono)}{i.intentos ? ` · ${i.intentos} ${i.intentos === 1 ? 'intento' : 'intentos'}` : ''}{i.duracion_seg ? ` · ${fmt(i.duracion_seg)}` : ''}{i.motivo_exclusion ? ` · ${i.motivo_exclusion}` : ''}</div>
        {detalleItem(i)}
      </div>
      {estadoItem(i)}
      {/* LLAMAR A ESTE, YA. Pedido del dueño (17-sep-2026): la lista sabe a
          quién hay que marcar, pero para llamarle a UNO en concreto —el que te
          interesa, el que te devolvió la llamada— había que esperar a que la
          corrida llegara a él o buscarlo en el inbox. Reusa el evento
          `tel-llamar` que ya escucha Telefonia.tsx: es el mismo camino que un
          enlace `tel:` del hilo, así que la barra de llamada, la grabación y la
          minuta funcionan igual sin código nuevo. */}
      {!compacto && i.telefono && (
        <button onClick={() => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: i.telefono, nombre: i.nombre || null } }))}
          title={`Llamar a ${i.nombre || telefonoLegible(i.telefono)} ahora`}
          style={{ ...btnT, padding: '3px 8px', fontSize: 11, borderColor: '#c9bcf7', color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcoTelefono size={11} /> Llamar
        </button>
      )}
      {!compacto && i.conversation_id && onAbrirConversacion && <button onClick={() => onAbrirConversacion(i.conversation_id)} title="Ver la conversación" style={{ ...btnT, padding: '3px 8px', fontSize: 11 }}>Chat</button>}
      {conAcciones && i.estado === 'pendiente' && <button onClick={() => accion('excluir', { item: i.id })} title="Quitar de la lista" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2 }}><IcoX size={14} /></button>}
      {conAcciones && !compacto && i.estado === 'excluido' && <button onClick={() => accion('incluir', { item: i.id })} style={{ ...btnT, padding: '3px 8px', fontSize: 11 }}>Volver a meter</button>}
    </div>
  );

  // ── 2 · LA LISTA, ANTES DE MARCAR ─────────────────────────────────────
  if (fase === 'lista') {
    return (
      <div className={movil ? 'cab-m' : undefined} style={raizEstilo}>
        {estiloMovil}{cab}
        <div key={fase} className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? `12px 16px ${PIE_MOVIL}` : 22 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            {errorBox}
            {/* En el teléfono, una sola fila compacta: dos tarjetas estiradas a
                la altura de la más alta dejaban 125 px con la mitad vacía. */}
            {movil ? (
              <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Número y etiqueta en un renglón: apilados, a 360 «en la lista»
                    se partía en tres y la columna salía más alta que la otra. */}
                <div style={{ display: 'grid', flexShrink: 0, minWidth: 96 }}>
                  <b style={{ fontSize: 22, fontWeight: 800, color: C.moradoTinta, lineHeight: 1.1 }}>{pendientes.length}</b>
                  <span style={{ fontSize: 13, color: C.g700, fontWeight: 700, whiteSpace: 'nowrap' }}>en la lista</span>
                </div>
                <span style={{ width: 1, alignSelf: 'stretch', background: C.g200 }} />
                <div style={{ display: 'grid', minWidth: 0 }}>
                  <b style={{ fontSize: 22, fontWeight: 800, color: '#9a6a10', lineHeight: 1.1 }}>{excluidos.length}</b>
                  <span style={{ fontSize: 13, color: C.g500, lineHeight: 1.3 }}>fuera: sin teléfono, no llamar o repetidos</span>
                </div>
              </div>
            ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ ...tarjeta('#9B8CFA'), flex: 1, minWidth: 140 }}><span style={etiqueta}>En la lista</span><div style={{ fontSize: 22, fontWeight: 800, color: C.moradoTinta }}>{pendientes.length}</div></div>
              <div style={{ ...tarjeta('#E8A838'), flex: 1, minWidth: 140 }}><span style={etiqueta}>Fuera</span><div style={{ fontSize: 22, fontWeight: 800, color: '#9a6a10' }}>{excluidos.length}</div><div style={{ fontSize: 11, color: C.g500 }}>sin teléfono, no llamar o repetidos</div></div>
            </div>
            )}
            {/* EN EL TELÉFONO, PRIMERO A QUIÉN VAS A LLAMAR. La presentación ya
                se decidió al armar la lista; aquí se revisa la gente, así que
                la lista sube y la presentación queda plegada debajo, con lo
                elegido en el título. «Empezar a marcar» vive en la barra de
                abajo, al alcance del pulgar. */}
            {movil ? (<>
              <span style={{ fontSize: 14, color: C.g500, lineHeight: 1.5 }}>{pres.modo === 'ia' ? 'Fernanda marca y habla sola; puedes cerrar esta ventana y volver cuando quieras.' : pres.modo === 'asistido' ? 'Ponte los audífonos: entras mudo, Fernanda habla y tú tomas la llamada cuando quieras.' : 'Ponte los audífonos: entras mudo y solo hablas cuando conteste una persona.'}</span>
              <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
                {items.length === 0 ? <Cargando texto="Leyendo la lista…" alto={120} /> : items.map(i => filaItem(i, true))}
              </div>
              <Colapsable movil={movil} titulo="Cómo vas a llamar" resumen={resumenConfig}>
                <div style={{ display: 'grid', gap: 16 }}>
                  {formPresentacion}
                  <div>
                    <span style={etiqueta}>Si suena y se va al buzón</span>
                    {buzonEl}
                  </div>
                </div>
              </Colapsable>
              <button onClick={() => accion('terminar')} style={{ ...btnD, justifySelf: 'start' }}>Descartar lista</button>
            </>) : (<>
              <div style={tarjeta('#7DA6F5')}>
                <span style={etiqueta}>Cómo te presentas</span>
                {formPresentacion}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={empezar} disabled={!!ocupado || pendientes.length === 0 || (telefonia ? !telefonia.ok : false)} style={{ ...S.btnP, opacity: !!ocupado || pendientes.length === 0 ? 0.6 : 1 }}>
                  {ocupado ? (pres.modo === 'ia' ? 'Arrancando…' : 'Abriendo la sala…') : pres.modo === 'ia' ? 'Que Fernanda empiece a marcar' : 'Empezar a marcar'}
                </button>
                <span style={{ fontSize: 11.5, color: movil ? C.g500 : C.g400 }}>{pres.modo === 'ia' ? 'Fernanda marca y habla sola; puedes cerrar esta ventana y volver cuando quieras.' : pres.modo === 'asistido' ? 'Ponte los audífonos: entras mudo, Fernanda habla y tú tomas la llamada cuando quieras.' : 'Ponte los audífonos: entras mudo y solo hablas cuando conteste una persona.'}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => accion('terminar')} style={btnD}>Descartar lista</button>
              </div>
              <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
                {items.length === 0 ? <Cargando texto="Leyendo la lista…" alto={120} /> : items.map(i => filaItem(i, true))}
              </div>
            </>)}
          </div>
        </div>
        {movil && (
          <div style={barraPie}>{bandaPie}
            <button onClick={empezar} disabled={!!ocupado || pendientes.length === 0 || (telefonia ? !telefonia.ok : false)} style={{ ...ctaMovil, ...(pendientes.length === 0 || (telefonia ? !telefonia.ok : false) ? ctaMovilOff : null), opacity: ocupado ? 0.85 : 1 }}>
              {ocupado ? <><Cargador />{pres.modo === 'ia' ? 'Arrancando…' : 'Abriendo la sala…'}</> : pres.modo === 'ia' ? `Que Fernanda empiece · ${pendientes.length}` : `Empezar a marcar · ${pendientes.length}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 4 · TERMINADA ─────────────────────────────────────────────────────
  if (fase === 'fin') {
    const s = sesion;
    const kpi = (franja: string, et: string, v: any, color: string, sub?: string) => (
      <div style={{ ...tarjeta(franja), flex: 1, minWidth: 120 }}><span style={etiqueta}>{et}</span><div style={{ fontSize: 22, fontWeight: 800, color }}>{v}</div>{sub && <div style={{ fontSize: 11, color: C.g500 }}>{sub}</div>}</div>
    );
    // La misma lista que usa el servidor en `relanzar`: si aquí falta alguno,
    // el botón dice un número y se relanzan otros.
    const relanzables = items.filter(i => ['no_contesto', 'ocupado', 'buzon', 'portero', 'volver_llamar', 'colgo_rapido'].includes(i.resultado) || i.estado === 'pendiente').length;
    /* Lo que quedó suelto: en el teléfono va ARRIBA, junto al resumen y a
       quién llamar — es lo que se decide al terminar. */
            /* ══ QUÉ QUEDÓ SUELTO (19-sep-2026) ═══════════════════════════════
                Una jornada no termina cuando se acaba la lista: termina cuando
                no queda nada colgando. Y lo que queda colgando estaba repartido
                por tres sitios —la llamada que la IA no alcanzó a leer, el PDF
                que prometiste y nadie sabe cuál es, la cita que no entró al
                calendario—, así que en la práctica no lo revisaba nadie.
                Justo lo que pasó con Maela: su cierre se perdió y sólo se supo
                un día después, porque nada lo estaba esperando.

                Aquí está todo junto, y sólo aparece si hay algo: una tarjeta
                vacía que sale siempre se deja de leer a los dos días. */
    /* Los números de la jornada (intentos) y el embudo: en el teléfono van plegados. */
    const numerosEl = (<>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {kpi('#4FBF95', 'Contestaron', s.contestadas, '#1E8A63', `${fmt(s.segundos_hablados || 0)} hablados`)}
              {kpi('#E8A838', 'Buzón', s.buzon, '#9a6a10')}
              {kpi('#9B8CFA', 'Sin contestar', s.sin_contestar, C.moradoTinta)}
              {kpi('#7DA6F5', 'Contestadora', s.porteros, '#2C5FC4')}
              {kpi('#EF7A72', 'Inválidos', s.invalidos, '#C0554E')}
              {kpi('#D1D5DB', 'Sin marcar', items.filter(i => i.estado === 'pendiente').length, '#4B5563')}
              {kpi('#9B8CFA', 'Costo', `US$ ${Number(s.costo_usd || 0).toFixed(2)}`, C.moradoTinta, s.contestadas ? `US$ ${(Number(s.costo_usd || 0) / s.contestadas).toFixed(2)} por conversación` : 'solo llamadas')}
              {/* En rojo y sólo si hay alguno: cada uno es alguien que SÍ
                  descolgó y colgó sin oír una palabra nuestra. Es el número más
                  caro de la jornada. Ya se les vuelve a marcar solos. */}
              {Number(est?.colgaron_en_silencio || 0) > 0 && kpi('#C0554E', 'Colgaron sin que hablaras', Number(est.colgaron_en_silencio), '#C0554E', 'se les marca de nuevo en 10 min')}
            </div>
            {/* ══ EL EMBUDO DE VERDAD (19-sep-2026) ═══════════════════════════
                «30 conversaciones» contaba las de cuatro segundos, así que el
                número grande y verde decía que la jornada había ido bien justo
                los días que había ido mal. Un embudo no es un contador: es
                dónde se cae la gente, y cada escalón dice qué arreglar.

                  descolgaron → hablaron (>30 s) → quedó algo → demo

                Debajo de 30 s no cabe una presentación y una respuesta: eso no
                fue una conversación, fue un «ahorita no puedo». Y lo agendado
                sale de la agenda de verdad, no de lo que la IA propuso. */}
            {est?.embudo && Number(est.embudo.contestaron) > 0 && (
              <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 15px', marginBottom: 10 }}>
                <span style={etiqueta}>Dónde se te fue la gente</span>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[
                    ['Descolgaron', est.embudo.contestaron, '#4FBF95', null],
                    ['Hablaron de verdad', est.embudo.hablaron, '#5B4BD6', 'más de 30 s'],
                    ['Quedó algo', est.embudo.con_cita, '#9B8CFA', 'cita o compromiso'],
                    ['Demos', est.embudo.demos, '#E8A838', null],
                  ].map(([et, v, color, sub]: any, i: number, todo: any[]) => {
                    const previo = i > 0 ? Number(todo[i - 1][1]) : 0;
                    const pct = i > 0 && previo > 0 ? Math.round((Number(v) / previo) * 100) : null;
                    return (
                      <div key={et} style={{ flex: '1 1 110px', minWidth: 96, borderLeft: `3px solid ${color}`, paddingLeft: 9 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>{v}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.g900 }}>{et}</div>
                        <div style={{ fontSize: 10.5, color: C.g500 }}>
                          {sub || ''}{sub && pct != null ? ' · ' : ''}{pct != null ? `${pct}% de los de antes` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* ══ EL HUECO, CON NÚMERO ═══════════════════════════════════
                    El embudo dice cuánta gente descuelga y no llega a los 30
                    segundos; esto dice por qué. Se mide desde SU primera palabra
                    y no desde el descuelgue: la transcripción tarda un par de
                    segundos en entregar cada frase y ese retraso lo llevan las
                    dos pistas, así que restándolas queda lo que pasó en la línea.
                    Lo que no entra en ninguna media —las llamadas donde no se te
                    oyó nunca— va aparte, porque son las que más cuestan. */}
                {(est.embudo.saludo_seg != null || Number(est.embudo.sin_voz_tuya) > 0) && (
                  <div style={{ marginTop: 9, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: C.g500 }}>
                    {est.embudo.saludo_seg != null && (
                      <span>
                        Tardaste <b style={{ color: est.embudo.saludo_seg > 4 ? '#C0554E' : '#1E8A63', fontSize: 12.5 }}>{est.embudo.saludo_seg} s</b> de media
                        en contestarle al «bueno»
                      </span>
                    )}
                    {Number(est.embudo.sin_voz_tuya) > 0 && (
                      <span>
                        En <b style={{ color: '#C0554E', fontSize: 12.5 }}>{est.embudo.sin_voz_tuya}</b> no se te oyó nunca
                      </span>
                    )}
                  </div>
                )}
                {Number(est.embudo.contestaron) > 0 && Number(est.embudo.hablaron) / Number(est.embudo.contestaron) < 0.5 && (
                  <div style={{ marginTop: 9, fontSize: 11.5, color: '#9a6a10', lineHeight: 1.5 }}>
                    Más de la mitad de los que descolgaron colgaron antes de los 30 segundos. Eso casi
                    nunca es la lista: es el hueco entre que contestan y tu primera frase.
                  </div>
                )}
              </div>
            )}
    </>);
    const sinLeerF = items.filter(i => i.cierre_estado === 'sin_datos' && i.cierre_fallo && i.cierre_fallo !== 'sin_transcripcion').length;
    const fueraF = compromisos.filter((c: any) => c.tipo === 'reunion' && !c.en_google).length;
    const mudosF = items.filter(i => i.resultado === 'colgo_rapido').length;
    const sueltoResumen = [sinLeerF && `${sinLeerF} sin leer por la IA`, fueraF && `${fueraF} ${fueraF === 1 ? 'cita' : 'citas'} fuera de Google`, mudosF && `${mudosF} ${mudosF === 1 ? 'colgó' : 'colgaron'} sin hablar`].filter(Boolean).join(' · ');
    const sueltoEl = (() => {
              const sinLeer = items.filter(i => i.cierre_estado === 'sin_datos' && i.cierre_fallo && i.cierre_fallo !== 'sin_transcripcion');
              const fueraDeGoogle = compromisos.filter((c: any) => c.tipo === 'reunion' && !c.en_google);
              const mudos = items.filter(i => i.resultado === 'colgo_rapido');
              if (!sinLeer.length && !fueraDeGoogle.length && !mudos.length) return null;
              return (
                <div style={movil ? { display: 'grid', gap: 12 } : { background: '#FFF8EC', border: '1px solid #F0D8AC', borderRadius: 12, padding: '13px 15px', display: 'grid', gap: 10 }}>
                  <div>
                    {!movil && <span style={{ ...etiqueta, color: '#9a6a10' }}>Qué quedó suelto</span>}
                    <div style={{ fontSize: movil ? 14 : 12, color: '#9a6a10' }}>Nada de esto se pierde solo, pero tampoco se arregla solo.</div>
                  </div>
                  {sinLeer.length > 0 && (
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ flex: '1 1 240px', fontSize: movil ? 14 : 12.5, color: C.g900, lineHeight: 1.45 }}>
                        <b>{sinLeer.length}</b> {sinLeer.length === 1 ? 'llamada que la IA no alcanzó a leer' : 'llamadas que la IA no alcanzó a leer'}.
                        Lo que se dijo sigue guardado: releerlas recupera el apunte, los datos y lo que se prometió.
                      </span>
                      <button onClick={async () => {
                        /* De una en una y no todas a la vez: cada relectura es
                           una llamada a la IA de hasta minuto y medio, y diez en
                           paralelo es la forma más rápida de que Anthropic nos
                           corte por ráfaga. */
                        for (const i of sinLeer) await releer(i.id);
                      }} disabled={!!ocupado} style={{ ...btnS, borderColor: '#E8A838', color: '#9a6a10' }}>
                        {String(ocupado).startsWith('releer') ? <><Cargador chico />Releyendo…</> : `Volver a leer ${sinLeer.length === 1 ? 'la llamada' : `las ${sinLeer.length}`}`}
                      </button>
                    </div>
                  )}
                  {fueraDeGoogle.length > 0 && (
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ flex: '1 1 240px', fontSize: movil ? 14 : 12.5, color: C.g900, lineHeight: 1.45 }}>
                        <b>{fueraDeGoogle.length}</b> {fueraDeGoogle.length === 1 ? 'cita quedó fuera de Google Calendar' : 'citas quedaron fuera de Google Calendar'}.
                        Están en el CRM, pero a esa hora no te va a sonar nada.
                      </span>
                      <button onClick={() => setTab('compromisos')} style={btnS}>Ver los compromisos</button>
                    </div>
                  )}
                  {mudos.length > 0 && (
                    <div style={{ fontSize: movil ? 14 : 12.5, color: C.g900, lineHeight: 1.45 }}>
                      <b>{mudos.length}</b> {mudos.length === 1 ? 'persona descolgó y colgó' : 'personas descolgaron y colgaron'} sin que alcanzaras a hablar.
                      Ya están de vuelta en la lista para marcarles en diez minutos — no hay que hacer nada,
                      pero si se repite a diario, el problema es el arranque de la llamada, no la lista.
                    </div>
                  )}
                </div>
              );
    })();
    return (
      <div className={movil ? 'cab-m' : undefined} style={raizEstilo}>
        {estiloMovil}{cab}
        <div key={fase} className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? `12px 16px ${PIE_MOVIL}` : 22 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            {errorBox}
            {/* La lista como tablero (22-sep-2026): quién sigue sin contestar a
                través de las rondas, «Ejecutar ronda N+1» y acciones masivas. */}
            {/* EL CIERRE DE LA JORNADA, PRIMERO. En el teléfono la pantalla
                empezaba de golpe en el tablero de la lista, sin decir cómo te
                fue: una línea con lo que se mira al terminar. */}
            {movil && (
              <div style={{ background: '#fff', border: '1px solid #ececec', borderLeft: '3px solid #1E8A63', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.g900, lineHeight: 1.3 }}>
                  Terminaste: {s.contestadas} {Number(s.contestadas) === 1 ? 'conversación' : 'conversaciones'} · {Math.round(Number(s.segundos_hablados || 0) / 60)} min al teléfono
                </div>
                {/* «Llamadas»: son intentos. El tablero de abajo cuenta PERSONAS
                    (5 en buzón pueden ser 14 llamadas a buzón en dos rondas). */}
                {/* Cada dato en un pedazo que no se parte (ronda 5): el renglón
                    corría suelto y a 360 se partía a mitad de «3 / contestadora». */}
                <div style={{ fontSize: 13, color: C.g500, marginTop: 3, lineHeight: 1.45 }}>
                  {[`Llamadas: ${s.buzon} a buzón`, `${s.sin_contestar} sin contestar`, s.porteros ? `${s.porteros} contestadora` : '', `US$ ${Number(s.costo_usd || 0).toFixed(2)}`].filter(Boolean).map((t, n, todo) => (
                    <span key={n}><span style={{ whiteSpace: 'nowrap' }}>{t}{n < todo.length - 1 ? ' ·' : ''}</span>{n < todo.length - 1 ? ' ' : ''}</span>
                  ))}
                </div>
                {/* La misma salida que en escritorio (`relanzar`), como
                    secundaria: la principal de la barra es la del tablero. Si
                    el tablero no carga, este mismo botón ya es la barra. */}
                {sesionId && (
                  <button onClick={() => relanzar(s.id)} disabled={!relanzables || ocupado === 'relanzar'}
                    style={{ ...secContenido, width: '100%', marginTop: 10, whiteSpace: 'normal', lineHeight: 1.25, ...(relanzables ? null : { opacity: 0.6, cursor: 'default' }) }}>
                    {ocupado === 'relanzar' ? <><Cargador chico />Armando…</> : `Volver a llamar a los ${relanzables} que faltan`}
                  </button>
                )}
              </div>
            )}
            {/* Lo suelto, plegado y en rojo con cuántas cosas son: abierto, sus
                dos párrafos se comían la primera vista y el tablero de la
                ronda siguiente —lo que decide el botón de abajo— empezaba
                a una pantalla de scroll. */}
            {movil && sueltoEl && (
              /* Con su botón de resolver a la vista (ronda 5): es lo único
                 urgente de la pantalla y plegado no se hacía. */
              <Colapsable movil alerta titulo="Qué quedó suelto" resumen={sueltoResumen}
                accion={sinLeerF > 0 ? (
                  <button onClick={async () => { for (const i of items.filter(x => x.cierre_estado === 'sin_datos' && x.cierre_fallo && x.cierre_fallo !== 'sin_transcripcion')) await releer(i.id); }}
                    disabled={!!ocupado} style={{ ...secMovil, minHeight: 44, width: '100%' }}>
                    {String(ocupado).startsWith('releer') ? <><Cargador chico />Releyendo…</> : sinLeerF === 1 ? 'Resolver: volver a leer la llamada' : `Resolver: volver a leer las ${sinLeerF}`}
                  </button>
                ) : undefined}>{sueltoEl}</Colapsable>
            )}
            {sesionId && <ResumenLista sesionId={sesionId} post={post} movil={movil} confirmar={confirmar}
              onRondaCreada={(id: string) => { setSesionId(id); setTab('lista'); cargarPrevias(); }}
              /* En el teléfono la barra del pulgar es UNA y la pone el tablero
                 (ronda N+1 con los grupos marcados, o las acciones de lo que
                 seleccionaste). Si el tablero no carga, queda la de siempre. */
              respaldo={movil ? (
                <div style={barraPie}>{bandaPie}
                  <button onClick={() => relanzar(s.id)} disabled={!relanzables || ocupado === 'relanzar'} style={{ ...ctaMovil, ...(relanzables ? null : ctaMovilOff) }}>
                    {ocupado === 'relanzar' ? <><Cargador />Armando…</> : `Volver a llamar a los ${relanzables} que faltan`}
                  </button>
                </div>
              ) : null} />}
            {/* En el teléfono los números y el embudo se pliegan: no sirven para
                decidir la ronda siguiente y hacían la pantalla de ~5,900 px. Son
                LLAMADAS (intentos), no personas: el tablero de arriba cuenta personas. */}
            {movil ? (
              <Colapsable movil titulo="Las llamadas de la jornada" resumen="contadas por llamada: buzón, sin contestar, costo y embudo">
                <div style={{ display: 'grid', gap: 12 }}>
                  {numerosEl}
                </div>
              </Colapsable>
            ) : numerosEl}

            {!movil && sueltoEl}
            {!movil && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => relanzar(s.id)} disabled={!relanzables || ocupado === 'relanzar'} style={{ ...S.btnP, opacity: relanzables ? 1 : 0.6 }}>Volver a llamar a los {relanzables} que faltan</button>
                <button onClick={salirDeSesion} style={btnS}>Armar otra lista</button>
              </div>
            )}
            {movil ? (
              <Colapsable movil titulo={`Todas las llamadas (${items.length})`} resumen="quién fue, qué pasó y qué quedó hecho">
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
              {items.map(i => filaItem(i, false))}
            </div>
              </Colapsable>
            ) : (
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
              {items.map(i => filaItem(i, false))}
            </div>
            )}
          </div>
        </div>
        {/* Al terminar, lo que sigue es volver a marcarle a los que faltan: en
            el teléfono ese botón quedaba a casi 3,000 px, debajo del resumen,
            el embudo y la lista entera. «Otra lista» ya está en el encabezado. */}
        {movil && !sesionId && (
          <div style={barraPie}>{bandaPie}
            <button onClick={() => relanzar(s.id)} disabled={!relanzables || ocupado === 'relanzar'} style={{ ...ctaMovil, ...(relanzables ? null : ctaMovilOff) }}>
              {ocupado === 'relanzar' ? <><Cargador />Armando…</> : `Volver a llamar a los ${relanzables} que faltan`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 3 · LA CABINA VIVA ────────────────────────────────────────────────
  /* QUIÉNES SIGUEN, mientras timbran (23-sep-2026). Debajo de las líneas
     quedaban 150 px vacíos y la única forma de saber quién venía era abrir la
     hoja. Los tres siguientes y el acceso a la lista entera. */
  const siguientes = pendientes.slice(0, 3);
  /* En UNA línea que abre la hoja (ronda 5): tres renglones con nombre y
     negocio duplicaban la hoja «Lista» y quedaban a medias bajo la barra. */
  const siguenBloque = siguientes.length > 0 ? (() => {
    const nom = (i: any) => String(i.nombre || telefonoLegible(i.telefono)).split(' ')[0];
    const resto = pendientes.length - Math.min(2, siguientes.length);
    const texto = `${siguientes.slice(0, 2).map(nom).join(', ')}${resto > 0 ? ` y ${resto} más` : ''}`;
    return (
      <button onClick={() => { setTab('lista'); setListaAbierta(true); }} aria-label={`Ver los ${pendientes.length} por marcar`}
        style={{ marginTop: 12, width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.g700, lineHeight: 1.35 }}><b style={{ color: C.g900 }}>Siguen:</b> {texto}</span>
        <span aria-hidden style={{ fontSize: 14, color: C.moradoTinta, fontWeight: 800 }}>Ver ›</span>
      </button>
    );
  })() : null;
  const pausada = sesion.estado === 'pausada';
  const aviso = sesion.config?.aviso;
  const estadoActual = actual?.estado;
  // La barra del pulgar ofrece «Pausar» sólo cuando nadie está en la línea.
  const barraConPausa = !!movil && (enSala || sola) && !pausada && estadoActual !== 'en_linea' && !esperaTuDecision
    && !['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual);
  /* En el teléfono, sólo colores de la paleta del flujo (guía §0): el verde
     del punto es el mismo #1E8A63 del texto «En línea» y el cierre deja el
     azul por el morado principal. */
  const colorEstado = estadoActual === 'en_linea' ? (movil ? '#1E8A63' : '#4FBF95') : estadoActual === 'cierre' ? (movil ? '#5B4BD6' : '#7DA6F5') : estadoActual === 'portero' ? '#E8A838' : '#9B8CFA';
  const chipRes = (r: string, texto: string, ancho = false) => (
    /* En el teléfono es «opción de contenido» (guía §3.3): contorno lila y
       texto morado, rellena de agua al elegirla — la misma forma que
       «Mándale mientras hablan», para que no parezcan dos familias. */
    <button key={r} onClick={() => guardarResultado(r)} aria-pressed={movil ? actual?.resultado === r : undefined} style={movil ? {
      border: '1.5px solid #9B8CFA', background: actual?.resultado === r ? C.moradoAgua : '#fff',
      color: '#5B4BD6', borderRadius: 12, padding: '0 8px', minHeight: 44, minWidth: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.2, cursor: 'pointer', fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', ...(ancho ? { gridColumn: '1 / -1' } : null),
    } : {
      border: `1.5px solid ${actual?.resultado === r ? '#9B8CFA' : C.g200}`, background: actual?.resultado === r ? C.moradoAgua : '#fff',
      color: actual?.resultado === r ? C.moradoTinta : C.g700, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    }}>{texto}</button>
  );

  /* ══ LOS HORARIOS QUE PUEDES OFRECERLE ══════════════════════════════════
     Aquí, en la tarjeta, no en el cierre: la hora se acuerda HABLANDO, no
     después de colgar. Cada botón es un hueco real del flujo elegido —mismo
     motor que la agenda pública, con Google Calendar incluido—, así que lo que
     lees en voz alta es exactamente lo que se puede agendar. En el teléfono,
     ya colgado, se pliegan debajo de lo que propuso la IA. */
  const horariosCaja = !actual ? null : (
                  <div style={{ marginTop: 12, border: `1px solid ${C.g200}`, borderRadius: 10, padding: movil ? '10px 10px' : '10px 12px', ...(movil ? { marginTop: 0, border: 'none', padding: '8px 0 0' } : null) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: movil ? 10 : 7 }}>
                      {/* En el teléfono el título ya lo dice el plegable que la envuelve. */}
                      {!movil && <span style={etiqueta}>Horarios que le puedes ofrecer</span>}
                      <select aria-label="Tipo de reunión" value={tipoCita} onChange={e => setTipoCita(e.target.value)}
                        style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '3px 8px', fontSize: 11.5, fontFamily: 'inherit', fontWeight: 700, color: C.moradoTinta, ...(movil ? { flex: '1 1 100%', minWidth: 0, maxWidth: '100%', background: '#fff', padding: '0 10px' } : null) }}>
                        {(tiposCita.length ? tiposCita : [{ slug: 'demo', nombre: 'Demo personalizada', minutos: 30 }]).map((t: any) => (
                          <option key={t.slug} value={t.slug}>{t.nombre} · {t.minutos} min</option>
                        ))}
                      </select>
                    </div>
                    {cargandoHuecos && !huecos.length ? (
                      <div style={{ fontSize: movil ? 14 : 11.5, color: C.g500 }}>Mirando la agenda…</div>
                    ) : huecos.length ? (
                      <>
                        {/* Día → hora, hasta 7 días (22-sep-2026). En el teléfono
                            las dos filas se deslizan de lado: envueltas empujaban
                            el resto de la tarjeta fuera de la pantalla. */}
                        <SelectorHorarios huecos={huecos} onElegir={agendarHueco} movil={movil} deshabilitado={!!ocupado} texto={ocupado === 'agendar' ? '…' : undefined} />
                        <div style={{ fontSize: movil ? 13 : 10.5, color: C.g500, marginTop: 6, lineHeight: 1.45 }}>
                          Léelos tal cual: son los huecos reales de tu agenda. Al picar uno queda agendado con su invitación y su recordatorio.
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: movil ? 14 : 11.5, color: '#9a6a10', lineHeight: 1.45 }}>
                        No hay huecos de «{(tiposCita.find((t: any) => t.slug === tipoCita)?.nombre) || tipoCita}» en las próximas dos semanas. Prueba otro tipo de reunión o abre tu disponibilidad en Agenda.
                      </div>
                    )}
                  </div>
  );
  /* Cada cosa que la IA propone hacer, en el teléfono: un renglón a todo lo
     ancho con «Quitar» a la derecha (antes un «No» rojo de 24 px que no se
     sabía si quitaba la propuesta o era su estado). En escritorio, igual. */
  const extrasEl = propuesta ? (
    <ExtrasCierre propuesta={propuesta} item={actual} opc={opcCierre?.item === actual?.id ? opcCierre : null}
      cargar={async () => { if (opcCierre?.item === actual?.id) return; const r = await post({ accion: 'cierre_opciones', id: sesionId, item: actual?.id }); if (r?.ok) setOpcCierre({ item: actual.id, ...r }); }}
      abierto={extrasAbierto} setAbierto={setExtrasAbierto} params={paramsExtra} setParams={setParamsExtra}
      editar={editarCierre} ocupado={!!ocupado} movil={movil} />
  ) : null;
  const filaPropuesta: React.CSSProperties = movil
    ? { display: 'flex', gap: 10, alignItems: 'center', background: '#fff', borderRadius: 10, padding: '4px 10px 4px 12px', minHeight: 52 }
    : { display: 'flex', gap: 6, alignItems: 'center' };
  const textoPropuesta: React.CSSProperties = movil ? { flex: 1, minWidth: 0, lineHeight: 1.4, overflowWrap: 'anywhere' } : {};
  /* El mismo ancho para todos los «Quitar» (reunión, datos, etapa, PDF): en
     la misma columna se leen como una sola decisión. */
  const btnQuitarPropuesta: React.CSSProperties = movil
    ? { ...quitarMovil, width: 92, padding: '0 8px' }
    : { ...btnT, padding: '2px 7px', fontSize: 10.5, color: '#C0554E' };
  // Terminar se confirma en el teléfono: se pica con el pulgar y no tiene vuelta.
  const terminarConfirmado = async () => {
    if (movil && !(await confirmar('¿Terminar la jornada? Se cuelga lo que esté timbrando y la lista queda cerrada; los que faltan se pueden volver a llamar después.'))) return;
    await terminar();
  };
  /* «¿Cómo quedó?» y «En qué etapa queda» como piezas (ronda 6): en el
     teléfono, con propuesta de la IA, suben justo debajo de «La IA
     entendió» —el rótulo dice «te toca decidir» y quedaban a 2.5 pantallas,
     después de cinco «Quitar»—; en escritorio siguen donde estaban. */
  const colQuedo = !actual ? null : (
    <Colapsable movil={movil} titulo="¿Cómo quedó?" resumen={ETIQUETA_RESULTADO[actual.resultado] || (propuesta ? `la IA dice: ${ETIQUETA_RESULTADO[propuesta.resultado] || propuesta.resultado}` : 'sin decidir')}
      alerta={!actual.resultado && !propuesta} abiertoDefecto={!actual.resultado && !propuesta}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chipRes('contesto', 'Hablamos')}
        {chipRes('volver_llamar', 'Volver a llamar')}
        {chipRes('dieron_datos', 'Dio datos')}
        {chipRes('no_interesa', 'No le interesa')}
        {chipRes('buzon', 'Era buzón')}
      </div>
      <textarea value={nota} onChange={e => setNota(e.target.value)} onBlur={guardarNota} placeholder={movil ? 'Apunte de la llamada' : 'Apunte de la llamada (se guarda en la conversación)'} aria-label="Apunte de la llamada (se guarda en la conversación)" rows={2} style={{ ...campo, resize: 'vertical', marginTop: 8, ...(movil ? { minHeight: 72, lineHeight: 1.4 } : null) }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setVerDicho(v => !v)} style={{ ...btnT, padding: movil ? '0 12px' : '4px 10px', fontSize: movil ? 14 : 11.5 }}>{verDicho ? 'Ocultar lo que se dijo' : 'Ver lo que se dijo'}</button>
        {!audio && <button onClick={pedirGrabacion} disabled={!!ocupado} style={{ ...btnT, padding: movil ? '0 12px' : '4px 10px', fontSize: movil ? 14 : 11.5 }}>Oír la llamada</button>}
        {audio && <audio controls src={audio} style={{ height: 30, maxWidth: 240 }} />}
        {/* ══ «ESTA ESTUVO BUENA» (20-sep-2026) ══════════════
            Pedido del dueño, para entrenar el modelo: «veinte
            llamadas que tú marcaste valen más que doscientas
            sin filtrar». Va AQUÍ y no sólo en Grabaciones
            porque el único momento en que sabes si estuvo
            buena es al colgar, con la conversación todavía en
            la cabeza. Dos días después son todas iguales. */}
        <button onClick={marcarEjemplo} disabled={!!ocupado}
          title="Guardarla como ejemplo para entrenar el guion y la voz"
          style={{ ...btnT, padding: movil ? '0 12px' : '4px 10px', fontSize: movil ? 14 : 11.5, ...(ejemploMarcado ? { border: '1px solid #4FBF95', color: '#1E8A63' } : null) }}>
          {ejemploMarcado ? '★ Guardada como ejemplo' : '☆ Esta estuvo buena'}
        </button>
      </div>
      {verDicho && String(actual.dialogo || '').trim() && (
        <div className="wa-scroll" style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 5, fontSize: 12.5, lineHeight: 1.5 }}>
          {String(actual.dialogo).split('\n').map((l: string, i: number) => {
            const mia = l.startsWith('Vendedor:');
            return <div key={i} style={{ justifySelf: mia ? 'end' : 'start', maxWidth: '88%', background: mia ? C.moradoAgua : '#fff', border: mia ? 'none' : `1px solid ${C.g200}`, color: mia ? C.moradoTinta : C.g700, borderRadius: 10, padding: '6px 10px' }}>{l.replace(/^(Vendedor|Cliente):\s*/, '')}</div>;
          })}
        </div>
      )}
    </Colapsable>
  );
  const colEtapa = !actual?.contact_id ? null : (
    <Colapsable movil={movil} titulo="En qué etapa queda" resumen={ETAPAS_CIERRE.find(x => x.id === etapaTocada)?.l || (propuesta?.etapa ? `la IA dice: ${propuesta.etapa.replace(/_/g, ' ')}` : 'se queda como está')}>
                        <select value={etapaTocada || ''} disabled={!!ocupado}
                          onChange={async e => {
                            const v = e.target.value; if (!v) return;
                            setEtapaTocada(v); setOcupado('etapa');
                            const r = await fetch('/api/crm/whatsapp/etapa', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ accion: 'etapa', contact_id: actual.contact_id, etapa: v }),
                            }).then(x => x.json()).catch(() => ({ error: 'No se pudo' }));
                            setOcupado('');
                            if (r?.error) { setError(r.error); setEtapaTocada(''); return; }
                          }}
                          style={{ ...campo, cursor: 'pointer' }}>
                          <option value="">Déjala como está</option>
                          {ETAPAS_CIERRE.map(e => <option key={e.id} value={e.id}>{e.l}</option>)}
                        </select>
                        {etapaTocada && <span style={{ fontSize: movil ? 13 : 11.5, color: movil ? verdeTexto : '#1E8A63', fontWeight: 700 }}>Listo: quedó en «{ETAPAS_CIERRE.find(x => x.id === etapaTocada)?.l}».</span>}
                      </Colapsable>
  );
  const saberCaja = actual?.resumen ? (
    <div style={{ marginTop: movil ? 12 : 10 }}>
      <span style={etiqueta}>Lo que hay que saber</span>
      <div style={{ fontSize: movil ? 14 : 12.5, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{actual.resumen}</div>
    </div>
  ) : null;

  return (
    <div className={movil ? 'cab-m' : undefined} style={raizEstilo}>
      {estiloMovil}{cab}
      <div key={fase} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: movil ? 'column' : 'row' }}>
        {/* Izquierda: el item actual */}
        <div className="wa-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: movil ? `12px 16px ${PIE_MOVIL}` : 22 }}>
          {/* ══ 🔴 `minmax(0, 1fr)`: LA REJILLA NO PUEDE ESTIRARSE (19-sep-2026)
              Medido a 390 px: esta rejilla se dibujaba de 618 px y las tarjetas
              salían cortadas por la derecha. No era el padre —ya estaba en
              342— sino la regla de CSS que más muerde en móvil: una columna de
              grid vale `auto`, y `auto` significa «tan ancha como el hijo más
              ancho que no sepa encogerse». Basta una fila con dos textos que no
              envuelven para que la rejilla entera crezca, y `maxWidth` no lo
              impide: sólo pone el techo en 640.

              `minmax(0, 1fr)` dice lo contrario: el mínimo es CERO, o sea que
              la columna cede y los hijos se apañan. Es el arreglo canónico y no
              cambia nada en escritorio, donde nunca falta sitio. */}
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {errorBox}
            {!enSala && !sola && (
              /* `minWidth: 0` en la caja y en su texto: sin eso, el botón
                 «Reanudar y entrar a la sala» —que no envuelve— estiraba el
                 aviso a 618 px dentro de una columna de 247, y en el teléfono
                 se salía por la derecha con todo y tarjeta. Medido a 390. */
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: movil ? ambarTextoAgua : '#9a6a10', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ flex: '1 1 160px', minWidth: 0 }}>
                  {pausada && sesion.pausa_motivo === 'caida' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se cortó tu conexión</b>}
                  {pausada && sesion.pausa_motivo === 'disyuntor' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se detuvo sola</b>}
                  {pausada && sesion.pausa_motivo === 'horario' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fuera de horario</b>}
                  {aviso || (reintentos > 0 && reintentos < 4 && sesion.estado === 'activa' ? 'Se cortó la sala: volviendo a entrar…' : 'No estás en la sala: la central no marca hasta que entres.')}
                </span>
                <button onClick={pausada ? empezar : entrarSala} disabled={!!ocupado} style={S.btnP}>{pausada ? 'Reanudar y entrar a la sala' : 'Entrar a la sala'}</button>
              </div>
            )}
            {(enSala || sola) && pausada && (
              <div style={{ background: sesion.pausa_motivo === 'disyuntor' ? '#FEF0EF' : '#FFF4E5', border: `1px solid ${sesion.pausa_motivo === 'disyuntor' ? '#f0c4bd' : '#f3d9a4'}`, color: sesion.pausa_motivo === 'disyuntor' ? '#C0554E' : '#9a6a10', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>
                  {sesion.pausa_motivo === 'horario' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fuera de horario</b>}
                  {sesion.pausa_motivo === 'disyuntor' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se detuvo sola</b>}
                  {sesion.pausa_motivo === 'caida' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se cortó tu conexión</b>}
                  {aviso || 'Sesión en pausa.'}
                </span>
                {sesion.pausa_motivo !== 'horario' && <button onClick={() => accion('reanudar')} disabled={!!ocupado} style={S.btnP}>{sesion.pausa_motivo === 'disyuntor' ? 'Ya lo revisé, seguir' : 'Reanudar'}</button>}
              </div>
            )}
{/* ── MEJORA 5 · LA PROMESA QUE ESTÁ POR CAER, MIENTRAS HABLAS ──
                El aviso de abajo sólo salía ENTRE llamadas (`!actual`), que es
                justo cuando no hace falta: si no estás hablando, el marcador se
                encarga solo. Donde sirve es a media conversación — saber que en
                seis minutos te toca la llamada que alguien te pidió cambia cómo
                cierras ésta. A menos de 15 minutos y en ámbar, para que se vea
                sin robarle la pantalla al contacto que tienes delante. */}
            {est?.proximo && actual && (() => {
              const min = Math.round((new Date(est.proximo.volver_at).getTime() - Date.now()) / 60000);
              if (min < 0 || min > 15) return null;
              return (
                <div style={{ background: C.ambar50, border: `1px solid ${C.ambar200}`, borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12.5, color: C.ambar700, fontWeight: 700 }}>
                  ⏱ En {min <= 1 ? 'menos de 1 min' : `${min} min`} te toca el seguimiento de <b>{est.proximo.nombre || telefonoLegible(est.proximo.telefono)}</b> — él pidió esa llamada.
                </div>
              );
            })()}
            {est?.proximo && !actual && (
              <div style={{ background: C.moradoAgua, color: C.moradoTinta, borderRadius: 9, padding: '9px 12px', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', ...(movil ? { color: C.g700, borderRadius: 12, padding: '10px 14px', fontSize: 14 } : null) }}>
                {/* En el teléfono el texto va en gris y el nombre en negro: en morado
                    negrita parecería un botón de texto y no se toca (guía §6). */}
                <span style={{ display: 'inline-flex', flexShrink: 0, color: C.moradoTinta }}><IcoReloj size={movil ? 15 : 13} /></span>
                <span>Compromiso: <b style={movil ? { color: C.g900 } : undefined}>{est.proximo.nombre || telefonoLegible(est.proximo.telefono)}</b> a las {new Date(est.proximo.volver_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).replace(/\.$/, '')}{new Date(est.proximo.volver_at).toDateString() !== new Date().toDateString() ? ` del ${new Date(est.proximo.volver_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })}` : ''}. Se marca sola a esa hora.</span>
              </div>
            )}

            {/* ══ LOS TRES NÚMEROS, ARRIBA ══════════════════════════════════
                Pedido del dueño (17-sep-2026): «estos igual que aparezcan
                arriba por favor».

                Vivían debajo de la tarjeta del contacto, y la tarjeta crece
                —contexto, transcripción, cierre— así que en media jornada los
                números quedaban fuera de pantalla: para saber cuántas
                conversaciones llevabas había que bajar. Son el marcador del
                partido; van donde se ven sin buscarlos. */}
            {/* ══ Y DE AHÍ AL HEADER, EN CHICO (18-sep-2026) ════════════════
                «Estos KPIs en cuadros vas a ponerlos en el header hasta arriba
                y en muy chico, para que no estorben mientras estoy en la sala.»

                Tenía razón: tres tarjetas de 140 px empujaban la llamada —lo
                único que importa mientras hablas— media pantalla hacia abajo.
                Son el marcador del partido: se miran de reojo, no se leen.
                Arriba y chiquitos mientras la jornada está viva; en tamaño
                normal cuando termina, que es cuando sí se estudian. */}
            {/* ══ 🔴 ESTO NO SE PINTABA NUNCA (19-sep-2026) ════════════════
                Las tarjetas grandes del resumen colgaban de `fase !== 'viva'`
                estando DENTRO del bloque que sólo se dibuja cuando la fase ES
                'viva' —las otras tres fases salen por un `return` de más
                arriba—. Condición imposible: código muerto desde que se
                movieron los KPIs al header, y ahí se me fue también el contador
                de «colgaron sin que hablaras», que por eso no aparecía.
                El sitio donde sí se estudian los números es el resumen del
                final, y ahí ya están sus propias tarjetas. */}
            {actual ? (
              /* Ya colgado, en el teléfono la tarjeta de afuera se aplana: eran
                 tres cajas anidadas (tarjeta › lila › cada acción), cada una
                 con su margen, y a 360 le dejaban ~270 px al texto. */
              <div style={{ ...tarjeta(colorEstado), padding: movil ? '14px 12px' : '16px 18px', position: 'relative',
                ...(movil && esperaTuDecision ? { background: 'transparent', border: 'none', borderLeft: 'none', borderRadius: 0, padding: '2px 0 0' } : null),
                ...(recienAbierto ? { boxShadow: '0 0 0 3px #4FBF95', transition: 'box-shadow .15s' } : null) }}>
                {recienAbierto && (
                  <div style={{ position: 'absolute', top: -13, left: 16, background: '#1E8A63', color: '#fff', borderRadius: 999, padding: '3px 12px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.02em' }}>
                    Ya te oyen — habla
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className={['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) ? 'wa-pulso' : undefined} style={{ width: 10, height: 10, borderRadius: 999, background: colorEstado, flexShrink: 0 }} />
                  {/* EL MEDIDOR DE TU PROPIA VOZ, en la línea que sí se mira.
                      Si no se mueve mientras hablas, estás mudo — y esa es la
                      comprobación que ningún aviso sustituye. Vivía en el
                      widget chico de la esquina, que es justo donde no miras
                      cuando estás hablando. */}
                  {/* En el teléfono no: sin leyenda, en gris, se leía como «sin señal». */}
                  {estadoActual === 'en_linea' && !movil && (
                    <span title={micAbierto ? 'Así te están oyendo' : 'Tu micrófono está cerrado'} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14, flexShrink: 0 }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <span key={i} style={{ width: 3, borderRadius: 2, height: 4 + i * 2.5,
                          background: micAbierto && nivelVoz * 5 > i ? '#1E8A63' : '#dcdce2', transition: 'background .08s' }} />
                      ))}
                    </span>
                  )}
                  <b style={{ fontSize: movil ? 13 : 12, textTransform: 'uppercase', letterSpacing: '.05em', color: estadoActual === 'en_linea' ? '#1E8A63' : '#4B5563',
                    /* Estado y reloj como en la sala (guía §4): 15 px, sin mayúsculas,
                       verde en línea y gris mientras timbra. */
                    ...(movil ? { fontSize: 15, fontWeight: 800, textTransform: 'none', letterSpacing: 0, fontVariantNumeric: 'tabular-nums', color: estadoActual === 'en_linea' ? verdeTexto : C.g500, lineHeight: 1.3, minWidth: 0 } : null) }}>
                    {/* ══ QUÉ ESTÁ PASANDO, DICHO ENTERO ══════════════════
                        Pedido del dueño (17-sep-2026): «en vez de que diga
                        micrófono mudo, pon en el centro qué está pasando: que
                        diga marcando, cuántas veces ya marcó, cuando entre a
                        buzón que lo diga, y de ahí lo que va a pasar después —
                        pero todo automático, sin que yo haga clics».

                        Antes decía sólo «TIMBRANDO» y el resto había que
                        deducirlo de la lista de la derecha. Ahora la misma
                        línea lleva el intento y, cuando cae en buzón, lo dice
                        con todas sus letras y anuncia el salto: la certeza de
                        que la máquina sigue sola es lo que deja al vendedor
                        mirar en vez de vigilar. */}
                    {ETIQUETA_ITEM[estadoActual] || estadoActual}
                    {['marcando', 'timbrando'].includes(estadoActual) && actual.intentos > 1 ? ` · intento ${actual.intentos}` : ''}
                    {estadoActual === 'en_linea' && actual.segundos_en_linea > 0 ? ` · ${fmt(actual.segundos_en_linea)}` : ''}
                    {estadoActual === 'cierre' && (
                      esperaTuDecision ? ' · te toca decidir'
                      : sesion.config?.auto_continuar !== false && segCierre !== null
                        ? (enviosAbiertos.length ? ' · esperando tu respuesta' : !actual.cierre_estado || actual.cierre_estado === 'proponiendo' ? ' · la IA está cerrando' : ` · siguiente en ${segCierre} s`)
                        : '')}
                  </b>
                  <span style={{ flex: 1 }} />
                  {/* En el teléfono el «1 de 82 · 8 por marcar» partía el renglón
                      en dos y confundía (¿82 u 8?): cuántos faltan ya lo dice
                      «Lista · 8» en la barra de abajo. */}
                  {!movil && <span style={{ fontSize: 11, color: C.g400 }}>{actual.orden + 1} de {sesion.total}{est?.pendientes ? ` · ${est.pendientes} por marcar` : ''}</span>}
                </div>

                {/* CAYÓ EN BUZÓN: se dice, y se dice qué sigue. El salto ya era
                    automático —lo hace el servidor— pero en pantalla no se veía
                    nada y parecía que se había atorado. Un proceso que avanza
                    solo sin decirlo se siente igual que uno roto. */}
                {/* ══ «QUIERO OÍR QUÉ PASA» ════════════════════════════════
                    Pedido del dueño: «otra opción que con un clic puedas
                    escuchar la parte si timbra o qué está pasando, para que
                    sepas cómo manejarlo».

                    Y resulta que YA SE PUEDE: estando en la sala oyes la
                    llamada entera —el tono, el buzón, el «bueno»— sin que te
                    oigan. Lo que faltaba no era la función, era decirlo: la
                    etiqueta vivía arriba a la derecha, lejos de donde miras
                    mientras marca, y nadie relaciona «En la sala, mudo» con
                    «esto que oigo es esta llamada». Se dice aquí, en la línea
                    de lo que está pasando, y si NO estás dentro se ofrece
                    entrar de un clic en vez de explicarlo. */}
                {['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) && (
                  <div style={{ fontSize: 12, color: enSala ? '#1E8A63' : C.moradoTinta, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {enSala ? 'Lo estás oyendo en vivo — te oyen sólo si abres el micrófono.' : (
                      <>
                        <span>No estás en la sala: no oyes lo que pasa.</span>
                        <button onClick={entrarSala} style={{ ...btnT, padding: '4px 10px' }}>Entrar a escuchar</button>
                      </>
                    )}
                  </div>
                )}

                {/* EL BUZÓN SE CUENTA SOLO. «No hay nada que hacer»: se le
                    avisa por WhatsApp y se sigue. Lo que cambia es que ahora se
                    VE en qué va ese aviso, sin abrir la conversación. */}
                {actual.veredicto === 'buzon' && (
                  <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: movil ? ambarTextoAgua : '#9a6a10', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
                    Cayó en el buzón{actual.veredicto_fuente ? ` (${actual.veredicto_fuente})` : ''}.
                    {sesion.buzon_dejar_mensaje ? ' Se le está dejando el mensaje y' : ''} pasamos solos al siguiente — no tienes que tocar nada.
                    {String(actual.nota || '').startsWith('Buzón') && (
                      <div style={{ fontWeight: 600, marginTop: 4, color: /enviado/.test(String(actual.nota)) ? '#1E8A63' : '#9a6a10' }}>
                        {/enviado/.test(String(actual.nota)) ? '✓ ' : '⏳ '}{String(actual.nota).replace(/^Buzón · /, '')}
                      </div>
                    )}
                  </div>
                )}
                {/* En el teléfono el avatar se va y el nombre usa el ancho
                    entero: con 44 px de foto y el botón «Ver chat» a la
                    derecha, «Manuela vidal gonzalez» se partía en dos renglones
                    alrededor del círculo. El nombre de a quién le hablas es lo
                    más grande de la pantalla por algo. «Ver chat» baja debajo,
                    donde además se alcanza con el pulgar. */}
{/* ══ ÉL PIDIÓ ESTA LLAMADA ═══════════════════════════════════════
                    Pedido del dueño (21-sep-2026): «al momento de llamar a ese
                    prospecto que ya tiene un seguimiento previo debe aparecer
                    en grande: llamando por seguimiento previo de X».

                    Va ARRIBA del nombre y no como una pastilla al lado: cambia
                    la primera frase de la llamada entera. No es lo mismo abrir
                    con «le hablo de Sacs» que con «le llamo como quedamos» — y
                    esa frase se dice en el primer segundo, cuando no da tiempo
                    de leer letra chica. */}
                {actual.compromiso_tarea_id && (
                  <div style={{
                    background: C.moradoAgua, border: `1px solid #d6d0fb`, borderLeft: `4px solid ${C.moradoTinta}`,
                    borderRadius: 12, padding: movil ? '10px 12px' : '12px 15px', marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: C.moradoTinta, opacity: movil ? 1 : .75 }}>Él pidió esta llamada</div>
                    <div style={{ fontSize: movil ? 17 : 18, fontWeight: 800, letterSpacing: '-0.02em', color: C.moradoTinta, lineHeight: 1.25, marginTop: 2 }}>
                      Llamando por seguimiento previo de {actual.nombre || 'este contacto'}
                    </div>
                    {/* La nota trae la hora que él pidió: decírsela —«te marco a
                        las 4 como quedamos»— es lo que separa esta llamada de
                        una insistencia. */}
                    {actual.nota && <div style={{ fontSize: 12.5, color: C.moradoTinta, opacity: movil ? 1 : .85, marginTop: 3 }}>{String(actual.nota).replace(/^Volver a llamar:\s*/, '')}</div>}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {!movil && <span style={{ width: 44, height: 44, borderRadius: 999, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcoUsuario size={22} /></span>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: movil ? 20 : 19, fontWeight: 800, letterSpacing: '-0.02em', color: C.g900, lineHeight: 1.2 }}>{actual.nombre || 'Sin nombre'}</div>
                    {/* En el teléfono a 14 px y el número en tinta (ronda 6): es el
                        dato que se confirma con la otra persona. */}
                    {movil ? (
                      <div style={{ fontSize: 14, color: C.g500, lineHeight: 1.4 }}>
                        {actual.empresa && <>{actual.empresa} · </>}
                        <span style={{ color: C.g700, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{telefonoLegible(actual.telefono)}</span>
                        {actual.hora_local && <> · allá son las {actual.hora_local}</>}
                      </div>
                    ) : <div style={{ fontSize: 12.5, color: C.g500 }}>{[actual.empresa, telefonoLegible(actual.telefono), actual.hora_local ? `allá son las ${actual.hora_local}` : null].filter(Boolean).join(' · ')}</div>}
                    {/* El dato técnico de quién contestó, pegado a quién es (ronda 1
                        cabina): al fondo de la ficha quedaba siempre bajo la
                        franja que desvanece lo que pasa por la barra, y se leía
                        a ~2:1. Aquí va en el gris secundario, a 4.8:1. */}
                    {movil && actual.veredicto && estadoActual === 'en_linea' && (
                      <div style={{ fontSize: 13, color: C.g500, lineHeight: 1.4, marginTop: 1 }}>Contestó {actual.veredicto === 'persona' ? 'una persona' : actual.veredicto} · lo dijo {actual.veredicto_fuente === 'reglas' ? 'la voz' : actual.veredicto_fuente}{actual.veredicto_ms ? ` a los ${(actual.veredicto_ms / 1000).toFixed(1)} s` : ''}</div>
                    )}
                    {movil && actual.conversation_id && onAbrirConversacion && (
                      <button onClick={() => onAbrirConversacion(actual.conversation_id)} style={{ ...btnT, marginTop: 7 }}>Ver chat</button>
                    )}
                  </div>
                  {!movil && actual.conversation_id && onAbrirConversacion && <button onClick={() => onAbrirConversacion(actual.conversation_id)} style={btnT}>Ver chat</button>}
                </div>

                {/* ══ ¿Y ESTO MORADO QUÉ ES? (18-sep-2026) ════════════════════
                    Lo preguntó el dueño viendo la tarjeta de Gabriela, y la
                    pregunta ES el defecto: era una frase suelta en morado, sin
                    rótulo, en medio de la ficha. Es tu primera frase —la que se
                    arma con el nombre y el motivo que pusiste al crear la
                    sesión— y hay que reconocerla de un vistazo mientras el otro
                    ya está diciendo «bueno». Dos palabras encima lo resuelven. */}
                {/* Ya colgado, en el teléfono la frase de entrada sobra: ocupaba la
                    primera pantalla y empujaba lo que la IA entendió —lo que hay
                    que decidir— debajo del pliegue. */}
                {/* Y ya pasados 20 s de conversación tampoco (ronda 5): la frase se
                    dijo, y sus ~125 px empujaban «Cómo quedó» bajo la barra. */}
                {actual.apertura && ['escuchando', 'portero', 'en_linea', 'cierre'].includes(estadoActual) && !(movil && estadoActual === 'cierre') && !(movil && estadoActual === 'en_linea' && Number(actual.segundos_en_linea || 0) > 20) && (
                  <div style={{ marginTop: 12, background: C.moradoSuave, borderRadius: 9, padding: '9px 12px' }}>
                    <div style={{ ...etiqueta, color: C.morado, marginBottom: 3 }}>Lo que dices al contestar</div>
                    {/* En el teléfono en color de texto y peso normal: en morado y
                        negritas eran tres renglones que le peleaban al nombre. */}
                    <div style={movil ? { fontSize: 15, color: C.g900, fontWeight: 500, lineHeight: 1.45 } : { fontSize: 13.5, color: C.moradoTinta, fontWeight: 600 }}>{actual.apertura}</div>
                  </div>
                )}
                {/* ══ LOS HORARIOS QUE PUEDES OFRECERLE ══════════════════════
                    Aquí, en la tarjeta, no en el cierre: la hora se acuerda
                    HABLANDO, no después de colgar. Cada botón es un hueco real
                    del flujo elegido —mismo motor que la agenda pública, con
                    Google Calendar incluido—, así que lo que lees en voz alta
                    es exactamente lo que se puede agendar. Un clic lo agenda
                    con su correo, su invitación y sus recordatorios. */}
                {/* En el teléfono, lo que hay que saber va ANTES que los horarios:
                    es contexto para hablar, y se lee en cuanto contesta. */}
                {/* «CÓMO QUEDÓ», JUSTO DEBAJO DEL NOMBRE (ronda 5). Durante la
                    llamada es lo que más se toca después de Colgar, y a 360
                    quedaba en y≈680, detrás de la barra. El apunte sigue abajo:
                    se escribe cuando hay calma, los chips se pican al vuelo. */}
                {movil && estadoActual === 'en_linea' && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    <span style={{ ...etiqueta, marginBottom: 0 }}>Cómo quedó</span>
                    {/* La misma rejilla de dos columnas iguales que «Mándale
                        mientras hablan» (ronda 1 cabina): en fila suelta salían
                        2+3 de anchos distintos y parecían otra familia. El
                        quinto, sin pareja, toma el renglón entero. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      {chipRes('contesto', 'Hablamos')}
                      {chipRes('volver_llamar', 'Volver a llamar')}
                      {chipRes('dieron_datos', 'Dio datos')}
                      {chipRes('no_interesa', 'No le interesa')}
                      {chipRes('buzon', 'Era buzón', true)}
                    </div>
                  </div>
                )}
                {/* Ya colgado, en el teléfono sobra (ronda 5): lo que la IA
                    entendió lo dice mejor, y estos ~90 px dejaban lo que se
                    confirma bajo la barra a 360. */}
                {movil && !(esperaTuDecision && propuesta) && saberCaja}
                {/* Lo que puedes mandarle mientras hablas, sin esperar al
                    cierre: antes vivía sólo en «Seguimiento», al colgar. */}
                {movil && estadoActual === 'en_linea' && (
                  <div style={{ marginTop: 12 }}>
                    <span style={etiqueta}>Mándale mientras hablan</span>
                    {/* Los cuatro casos que salen hablando: «¿de dónde?», «mándame
                        la info», «ya tengo sistema» y «¿cómo funciona?». En
                        rejilla de dos, cada uno a medio ancho y de pulgar. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      {([['quien_soy', 'Quién soy', 'Le llega tu nombre, Sacs, la liga y por qué le llamas'], ['mandar_info', 'La info de Sacs', 'La información de Sacs en PDF'], ['mandar_cambio', 'Cómo te cambias', '«Ya tengo sistema»: cómo se pasa a Sacs sin empezar de cero'], ['mandar_demo', 'Cómo es la demo', '«¿Cómo funciona?»: qué verá en la demo y cómo arranca']] as const).map(([id, t, d]) => (
                        <button key={id} onClick={() => rapida(id)} disabled={!!ocupado} title={d} style={{ ...btnS, minHeight: 44, minWidth: 0, fontSize: 14, borderRadius: 12, justifyContent: 'center', padding: '0 8px', textAlign: 'center', lineHeight: 1.2 }}>{ocupado === id ? <><Cargador chico />Mandando…</> : t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {['escuchando', 'portero', 'en_linea', 'cierre'].includes(estadoActual) && !movil && horariosCaja}
                {!movil && saberCaja}
                {actual.oido_texto && !fernanda && !['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.g500, fontStyle: 'italic' }}>Se oye: «{String(actual.oido_texto).slice(-160)}»</div>
                )}
                {fernanda && ['escuchando', 'portero', 'en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 12 }}>
                    <span style={etiqueta}>La llamada, en vivo</span>
                    <div className="wa-scroll" style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 5, fontSize: 12.5, lineHeight: 1.5 }}>
                      {actual.dialogo
                        ? String(actual.dialogo).split('\n').map((l: string, i: number) => {
                            const mia = l.startsWith('Vendedor:');
                            return <div key={i} style={{ justifySelf: mia ? 'end' : 'start', maxWidth: '88%', background: mia ? C.moradoAgua : '#fff', border: mia ? 'none' : `1px solid ${C.g200}`, color: mia ? C.moradoTinta : C.g700, borderRadius: 10, padding: '6px 10px' }}>{l.replace(/^(Vendedor|Cliente):\s*/, '')}</div>;
                          })
                        : <div style={{ fontSize: 12, color: movil ? C.g500 : C.g400, fontStyle: 'italic' }}>{estadoActual === 'en_linea' || estadoActual === 'cierre' ? 'Sin transcripción todavía.' : 'Fernanda está escuchando quién contesta…'}</div>}
                    </div>
                  </div>
                )}
                {actual.veredicto && ['en_linea', 'cierre'].includes(estadoActual) && !movil && (
                  <div style={{ marginTop: 6, fontSize: movil ? 13 : 11, color: movil ? C.g500 : C.g400 }}>Contestó {actual.veredicto === 'persona' ? 'una persona' : actual.veredicto} · lo dijo {actual.veredicto_fuente === 'reglas' ? 'la voz' : actual.veredicto_fuente}{actual.veredicto_ms ? ` a los ${(actual.veredicto_ms / 1000).toFixed(1)} s` : ''}</div>
                )}

                {/* Acciones del item según su momento */}
                {/* ══ ¿ESTOY AL AIRE? ══════════════════════════════════════
                    Reporte del dueño: «la pantalla debe ser más clara, mostrarme
                    un punto verde o algo que muestre que está activo». Antes la
                    única pista de que el micrófono estaba abierto era el texto
                    del botón de silenciar —al final de una fila de botones—, así
                    que se hablaba sin saber si salía o no.
                    Dos estados y nada más: verde con punto latiendo = te oyen;
                    gris = no. Es la primera cosa que hay que poder contestar sin
                    leer. */}
                {/* En el teléfono esto ya lo dice la pastilla del encabezado
                    («Al aire · te oyen»), que se ve SIN scroll; aquí abajo
                    quedaba escondido bajo la barra de Colgar. */}
                {['escuchando', 'portero', 'en_linea'].includes(estadoActual) && !movil && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginTop: 14,
                    padding: '9px 13px', borderRadius: 10,
                    background: micAbierto ? '#EAF8F2' : C.g50,
                    border: `1px solid ${micAbierto ? '#9fdcc2' : C.g200}`,
                  }}>
                    <span style={{
                      width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
                      background: micAbierto ? '#1E8A63' : C.g400,
                      animation: micAbierto ? 'cab-late 1.25s ease-in-out infinite' : undefined,
                    }} />
                    <b style={{ fontSize: 13, color: micAbierto ? '#1E8A63' : C.g500, letterSpacing: '-0.01em' }}>
                      {micAbierto ? 'Estás al aire — te escuchan' : 'Micrófono cerrado — no te escuchan'}
                    </b>
                    {micAbierto && estadoActual !== 'en_linea' && (
                      <span style={{ fontSize: 11, color: '#1E8A63', opacity: .8 }}>· tu micrófono se abrió solo al contestar</span>
                    )}
                  </div>
                )}
                <style>{`@keyframes cab-late{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}@keyframes cab-gira{to{transform:rotate(360deg)}}`}</style>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) && !sola && (
                    <>
                      <button onClick={() => accion('tomar')} disabled={!!ocupado} style={btnS}>{ocupado === 'tomar' ? <><Cargador chico />Abriendo el micrófono…</> : <><IcoMic size={13} />Hablar yo</>}</button>
                      {!(movil && (enSala || sola) && !pausada) && <button onClick={() => accion('saltar')} disabled={!!ocupado} style={btnT}>{ocupado === 'saltar' ? <><Cargador chico />Saltando…</> : 'Saltar'}</button>}
                    </>
                  )}
                  {/* En el teléfono, con la barra del pulgar puesta, colgar y el
                      micrófono viven SÓLO allá: dos «Colgar» a 40 px uno del
                      otro es invitar a picar el que no era. */}
                  {estadoActual === 'en_linea' && !(movil && (enSala || sola) && !pausada) && (
                    <>
                      {fernanda && !sola && enSala && !actual.voz?.handoff && <button onClick={() => accion('tomar')} disabled={!!ocupado} style={S.btnP}><IcoMic size={13} />Tomar la llamada</button>}
                      <button onClick={() => accion('colgar')} disabled={!!ocupado} style={{ ...btnD, background: '#C0554E', color: '#fff', border: 'none', opacity: ocupado === 'colgar' ? .85 : 1, ...(movil ? { minWidth: 110, fontSize: 15 } : null) }}>
                        {ocupado === 'colgar' ? <><Cargador chico />Colgando…</> : 'Colgar'}
                      </button>
                      {(!fernanda || actual.voz?.handoff) && <button onClick={() => document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: micAbierto } }))} style={btnT}>{micAbierto ? 'Silenciarme' : 'Abrir micrófono'}</button>}
                    </>
                  )}
                  {/* Cuando te toca decidir, el botón NO va aquí arriba: va al
                      final, después de lo que la IA propone. Confirmar algo que
                      todavía no leíste es exactamente lo que se quería evitar. */}
                  {estadoActual === 'cierre' && !esperaTuDecision && (
                    <button onClick={confirmarYSeguir} disabled={!!ocupado} style={propuesta ? S.btnP : btnS}>
                      {propuesta ? 'Confirmar lo de la IA y seguir' : 'Siguiente ahora'}
                    </button>
                  )}
                </div>

                {/* ══ MIENTRAS HABLAS: lo mínimo, para no estorbar ══════════
                    Los chips y el apunte sirven DURANTE la llamada (se pica al
                    vuelo). Todo lo demás —etapa, seguimiento, solicitudes— se
                    decide al colgar, y vive abajo en colapsables. */}
                {/* En el teléfono los horarios van plegados y ARRIBA de «Cómo
                    quedó» (23-sep-2026): la cita se ofrece hablando, y al fondo
                    de la ficha había que hacer scroll en plena llamada para
                    encontrarlos. Plegados, con el primer hueco en el título, no
                    empujan los chips: un toque y se leen. */}
                {/* También ya colgado cuando no hay pantalla de decidir (Fernanda
                    sola): como en escritorio, los horarios siguen a la mano. */}
                {movil && (['escuchando', 'portero', 'en_linea'].includes(estadoActual) || (estadoActual === 'cierre' && !esperaTuDecision)) && (
                  <div style={{ marginTop: 14 }}>
                    <Colapsable movil titulo="Horarios que le puedes ofrecer" resumen={huecos.length ? `${huecos.length} libres · el primero ${diaCorto(huecos[0].fecha).toLowerCase()} a las ${horaBonita(huecos[0].hora).replace(/ /g, '\u00a0')}` : cargandoHuecos ? 'mirando la agenda…' : 'mirar la agenda'}>
                      {horariosCaja}
                    </Colapsable>
                  </div>
                )}
                {estadoActual === 'en_linea' && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    <span style={etiqueta}>{movil ? 'Apunte de la llamada' : 'Cómo quedó'}</span>
                    {!movil && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {chipRes('contesto', 'Hablamos')}
                      {chipRes('volver_llamar', 'Volver a llamar')}
                      {chipRes('dieron_datos', 'Dio datos')}
                      {chipRes('no_interesa', 'No le interesa')}
                      {chipRes('buzon', 'Era buzón')}
                    </div>}
                    {/* En el teléfono, dos renglones de alto y el texto corto: el
                        largo se partía en un campo de uno y el tirador lo tapaba. */}
                    <textarea value={nota} onChange={e => setNota(e.target.value)} onBlur={guardarNota} placeholder={movil ? 'Apunte de la llamada' : 'Apunte de la llamada (se guarda en la conversación)'} aria-label="Apunte de la llamada (se guarda en la conversación)" rows={2} style={{ ...campo, resize: 'vertical', ...(movil ? { minHeight: 72, lineHeight: 1.4 } : null) }} />
                  </div>
                )}


                {bloqueLineas}

                {/* ══ DESHACER, DOS MINUTOS ═════════════════════════════════
                    Confirmaste y el siguiente ya está timbrando: ir a cancelar
                    una cita a mano en ese momento no pasa. Aquí sí. */}
                {deshacer && Date.now() < deshacer.hasta && !deshecho && (
                  <div style={{ marginTop: 12, background: '#FFF4E5', border: '1px solid #f3d9a4', borderRadius: 10, padding: '9px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: '#9a6a10', fontWeight: 700, flex: 1, minWidth: 180 }}>Se aplicó el cierre de la llamada anterior.</span>
                    <button onClick={deshacerCierre} disabled={!!ocupado} style={{ ...btnT, padding: '5px 11px', fontSize: 12 }}>Deshacer</button>
                  </div>
                )}
                {deshecho && (
                  <div style={{ marginTop: 12, background: '#EAF8F2', border: '1px solid #9fdcc2', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#1E8A63', lineHeight: 1.6 }}>
                    {deshecho.length ? deshecho.map((d, i) => <div key={i}>✓ {d}</div>) : <div>No había nada que deshacer.</div>}
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    AL COLGAR: LA PANTALLA DE DECIDIR (18-sep-2026)

                    Rediseñada entera con lo que pidió el dueño, y el principio
                    que lo ordena todo es suyo: «dando prioridad a la
                    información que la IA ya obtuvo, para que sea más rápido el
                    proceso».

                     1. Lo que la IA entendió va ARRIBA y primero. Si entendió,
                        el 90% de las veces basta con confirmar.
                     2. Lo demás son COLAPSABLES cerrados: «¿Cómo quedó?»,
                        «Etapa», «Seguimiento», «Solicitudes extras». Cada uno
                        enseña en el título lo que ya está decidido, así que se
                        abre sólo lo que se quiere cambiar. Antes eran cuatro
                        bloques abiertos, dos campos de texto y tres avisos de
                        colores compitiendo por la misma mirada.
                     3. Los avisos de «no quedó ninguna cita» y «la IA no
                        alcanzó a leer» se fueron: el primero al final de la
                        sesión, el segundo a la basura. Si la IA no entendió, no
                        hay nada que explicar — se decide y ya.
                     4. Y abajo, en grande, la única salida: pasar a la
                        siguiente. */}
                {esperaTuDecision && (
                  /* `minmax(0, 1fr)`, como la rejilla de arriba: sin él una fila
                     que no envuelve (una plantilla, una fecha) estiraba toda la
                     pantalla de decidir más allá de la tarjeta en el teléfono. */
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                    {/* ══ 🔴 UNA LECTURA QUE FALLA TIENE QUE DECIRLO (18-sep-2026) ══
                        Reporte del dueño sobre la reunión con Maela, de 19
                        minutos: «no veo las referencias ni las solicitudes de la
                        IA… en dado caso de que algo no suceda, me tiene que
                        marcar el error o entender el error; o, si está
                        transcribiendo en ese momento y se está tardando porque
                        fue una llamada muy grande, también lo debería decir».

                        Tenía toda la razón y el silencio era mío: el aviso de «la
                        IA no alcanzó a leer» se había quitado hace unas horas —a
                        petición suya— porque en llamadas de veinte segundos era
                        puro ruido. Pero quitarlo del todo dejó el caso opuesto sin
                        voz: la llamada de diecinueve minutos, la valiosa, se
                        quedaba muda y parecía que la IA simplemente no tenía nada
                        que decir. No es lo mismo «no había nada que leer» que «no
                        me dio tiempo de leerlo»: lo primero se decide y ya, lo
                        segundo SE ARREGLA volviendo a leer.

                        Así que el ruido no vuelve —una llamada corta sin
                        transcripción sigue sin decir nada— pero un fallo de tiempo,
                        de saldo o cualquier otro se dice con su nombre y con el
                        botón que lo resuelve. */}
                    {actual.cierre_estado === 'proponiendo' && (
                      <Cargando texto={Number(actual.duracion_seg || 0) > 240
                        ? `Leyendo la llamada… fueron ${Math.round(Number(actual.duracion_seg) / 60)} min, esto tarda un poco más`
                        : 'Leyendo la llamada…'} alto={48} />
                    )}
                    {actual.cierre_estado === 'sin_datos' && falloCierre && falloCierre.fallo !== 'sin_transcripcion' && (
                      <div style={{ background: '#FFF8EC', border: '1px solid #F0D8AC', borderRadius: 10, padding: '10px 13px', display: 'grid', gap: 7 }}>
                        <div style={{ fontSize: 12.5, color: '#9a6a10', fontWeight: 700, lineHeight: 1.45 }}>{falloCierre.dicho}</div>
                        <div>
                          <button onClick={regenerarCierre} disabled={!!ocupado}
                            style={{ ...btnS, borderColor: '#E8A838', color: '#9a6a10' }}>
                            {ocupado === 'cierre_regenerar' ? <><Cargador chico />Volviendo a leer…</> : 'Volver a leer la llamada'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 1 · LO QUE LA IA ENTENDIÓ — primero, porque es lo que
                           permite cerrar en un clic. */}
                    {/* En el teléfono «¿Cómo quedó?» y «En qué etapa queda» van entre lo que
                       la IA entendió y lo que se deja hecho (ronda 6), SIEMPRE en el mismo
                       lugar del árbol, haya propuesta o no: si se movían al llegar la
                       propuesta, se remontaban y se perdía el foco del apunte. Por eso la
                       caja lavanda se parte en dos en el teléfono. */}
                    {(() => {
                      const cajaIA: React.CSSProperties = { background: C.moradoAgua, borderRadius: movil ? 12 : 10, padding: movil ? '12px' : '12px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: movil ? 10 : 9 };
                      const cuerpoIA = propuesta ? (<>
                        {/* En el teléfono «Así le llegan los mensajes» sube antes de
                            la lista de lo que se deja hecho: con cinco cosas y sus
                            «Quitar» en columna, había que bajar dos pantallas para
                            saber qué le iba a llegar al cliente. */}
                        {movil && extrasEl}
                        {(propuesta.compromisos?.length > 0 || propuesta.datos?.length > 0 || propuesta.envios?.length > 0 || propuesta.etapa) && (
                          <div style={{ display: 'grid', gap: movil ? 8 : 4, fontSize: movil ? 14 : 12, color: C.g700 }}>
                            {/* Sobre el agua #EEECFE el gris #6B7280 da 4.16:1: en el teléfono va un tono más oscuro (6.6:1). */}
                            <span style={{ ...etiqueta, marginBottom: 0, ...(movil ? { fontSize: 12, color: '#4B5563' } : null) }}>Al seguir se deja hecho</span>
                            {(propuesta.compromisos || []).map((cp: any, i: number) => {
                              const fechaIn = <input type="date" aria-label="Día" value={editando[i]?.fecha ?? cp.fecha} min={new Date().toISOString().slice(0, 10)}
                                onChange={e => setEditando(v => ({ ...v, [i]: { fecha: e.target.value, hora: v[i]?.hora ?? cp.hora } }))}
                                style={{ ...campo, width: 140, padding: '4px 7px', fontSize: 12 }} />;
                              const horaIn = <input type="time" aria-label="Hora" value={editando[i]?.hora ?? cp.hora}
                                onChange={e => setEditando(v => ({ ...v, [i]: { fecha: v[i]?.fecha ?? cp.fecha, hora: e.target.value } }))}
                                style={{ ...campo, width: 110, padding: '4px 7px', fontSize: 12 }} />;
                              const cambiado = editando[i] && (editando[i].fecha !== cp.fecha || editando[i].hora !== cp.hora);
                              const cambiar = cambiado && (
                                <button disabled={!!ocupado} onClick={() => { editarCierre({ compromisos: [{ i, ...editando[i] }] }); setEditando(v => { const n = { ...v }; delete n[i]; return n; }); }}
                                  style={{ ...btnS, padding: '4px 9px', fontSize: movil ? 14 : 11.5 }}>Cambiar la hora</button>
                              );
                              const quitar = <button disabled={!!ocupado} onClick={() => editarCierre({ compromisos: [{ i, quitar: true }] })}
                                style={movil ? btnQuitarPropuesta : { ...btnT, padding: '3px 8px', fontSize: 11, color: '#C0554E' }}>Quitar</button>;
                              const que = `${cp.tipo === 'reunion' ? `Reunión (${cp.reunion_tipo})` : 'Llamada'}${cp.motivo ? `: ${cp.motivo}` : ''}`;
                              /* En el teléfono: qué es, a todo lo ancho; día y hora
                                 en dos columnas iguales; y los botones abajo. */
                              /* En el teléfono la fecha se lee dicha («viernes 25 sep,
                                 4:00 pm») y los campos sólo salen al tocar «Cambiar»:
                                 abiertos siempre, cada compromiso medía ~150 px. */
                              if (movil) return (
                                <div key={`c${i}`} style={{ display: 'grid', gap: 8, background: '#fff', borderRadius: 10, padding: '10px 10px 8px 12px' }}>
                                  <span style={{ fontSize: 14, color: C.g900, fontWeight: 600, lineHeight: 1.4 }}>{que}</span>
                                  {/* La fecha, dato clave de la cita, en su renglón y sin
                                      partir la hora (ronda 6: «pm» quedaba sola). */}
                                  {!editando[i] && <span style={{ fontSize: 15, fontWeight: 800, color: C.moradoTinta, lineHeight: 1.35 }}>{(() => { const t = fechaHablada(cp.fecha, cp.hora); const k = t.lastIndexOf(', '); return k > 0 ? <>{t.slice(0, k + 2)}<span style={{ whiteSpace: 'nowrap' }}>{t.slice(k + 2)}</span></> : t; })()}</span>}
                                  {editando[i] ? (
                                    <div className="cab-fh" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 8 }}>{fechaIn}{horaIn}</div>
                                  ) : null}
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    {!editando[i] && <button disabled={!!ocupado} onClick={() => setEditando(v => ({ ...v, [i]: { fecha: cp.fecha, hora: cp.hora } }))} style={{ ...btnT, flexShrink: 0, padding: '0 12px', fontSize: 14 }}>Cambiar</button>}
                                    {editando[i] && !cambiado && <button onClick={() => setEditando(v => { const n = { ...v }; delete n[i]; return n; })} style={{ ...btnT, flexShrink: 0, padding: '0 12px', fontSize: 14 }}>Cancelar</button>}
                                    {cambiar}{quitar}
                                  </div>
                                </div>
                              );
                              return (
                              <div key={`c${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span>· {que} →</span>
                                {fechaIn}{horaIn}{cambiar}{quitar}
                              </div>
                              );
                            })}
                            {(propuesta.datos || []).map((d: any, i: number) => (
                              <div key={`d${i}`} style={filaPropuesta}>
                                <span style={textoPropuesta}>{movil ? '' : '· '}{d.corrige ? 'Corregir' : 'Llenar'} <b>{d.campo}</b>: {String(d.valor)}</span>
                                <button disabled={!!ocupado} onClick={() => editarCierre({ quitar_datos: [i] })}
                                  style={btnQuitarPropuesta}>Quitar</button>
                              </div>
                            ))}
                            {propuesta.etapa === 'lead_calificado' && (
                              <div style={filaPropuesta}>
                                <span style={textoPropuesta}>{movil ? '' : '· '}Pasa a lead calificado</span>
                                <button disabled={!!ocupado} onClick={() => editarCierre({ etapa: null })} style={btnQuitarPropuesta}>Quitar</button>
                              </div>
                            )}
                            {propuesta.etapa === 'descalificado' && (
                              <div style={{ ...filaPropuesta, color: '#C0554E', fontWeight: 700 }}>
                                <span style={textoPropuesta}>{movil ? '' : '· '}Se descalifica, sale de la cadencia del agente y de todas las secuencias</span>
                                <button disabled={!!ocupado} onClick={() => editarCierre({ etapa: null })} style={movil ? { ...btnQuitarPropuesta, ...secContenido, width: 92, padding: '0 8px' } : { ...btnQuitarPropuesta, color: C.g700 }}>No lo bajes</button>
                              </div>
                            )}
                            {(propuesta.envios || []).filter((e: any) => e.estado !== 'falta').map((e: any) => (
                              <div key={e.id} style={filaPropuesta}>
                                <span style={textoPropuesta}>{movil ? '' : '· '}Mandarle <b>{e.tema}</b> en PDF por WhatsApp{e.estado === 'enviado' ? ' — ya salió' : e.estado === 'pendiente_ventana' ? ' — sale cuando conteste' : e.estado === 'omitido' ? ' — no' : e.estado === 'sin_via' || e.estado === 'fallo' ? ' — quedó como tarea' : ''}</span>
                                {['listo', 'pendiente_ventana'].includes(String(e.estado)) && (
                                  <button disabled={!!ocupado} onClick={() => editarCierre({ quitar_envios: [e.id] })} style={btnQuitarPropuesta}>Quitar</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!movil && extrasEl}
                        {enviosAbiertos.map((e: any) => (
                          <div key={e.id} style={{ background: '#fff', border: '1px solid #f3d9a4', borderRadius: 9, padding: '10px 12px', display: 'grid', gap: 6 }}>
                            <b style={{ fontSize: 12.5, color: '#9a6a10' }}>Quedaste de mandarle {e.tema}. ¿Qué le mandamos?</b>
                            {e.detalle && <span style={{ fontSize: 11.5, color: C.g500 }}>Pidió: {e.detalle}</span>}
                            <textarea value={respuestas[e.id] || ''} onChange={ev => setRespuestas(r => ({ ...r, [e.id]: ev.target.value }))} rows={3} placeholder="Escribe el contenido: se arma en PDF con la marca, se le manda por WhatsApp y queda guardado para la próxima vez que alguien pida lo mismo." style={{ ...campo, resize: 'vertical' }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => responderEnvio(e.id)} disabled={!!ocupado} style={S.btnP}>Mandar en PDF</button>
                              <button onClick={() => accion('cierre_omitir', { envio: e.id })} disabled={!!ocupado} style={btnT}>No mandar</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: movil ? 13 : 10.5, color: movil ? C.g700 : C.g400, flex: 1, minWidth: 160, lineHeight: 1.4 }}>Lo que piques abajo manda sobre lo que entendió la IA.</span>
                          <button disabled={!!ocupado} onClick={descartarPropuesta} style={{ ...btnT, padding: movil ? '0 14px' : '4px 10px', fontSize: movil ? 14 : 11.5, color: '#C0554E', ...(movil ? { border: '1px solid #f0c4bd', background: '#fff' } : null) }}>No fue eso: descartar</button>
                        </div>
                      </>) : null;
                      return (<>
                        {propuesta && (
                          <div style={cajaIA}>
                        {/* En el teléfono rótulo corto y la pastilla en su mismo
                            renglón (ronda 5): a 360 la pastilla bajaba sola a otro.
                            «Aún no hace nada» ya lo dice el «Al confirmar» de abajo. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* El mismo rótulo que el cierre de la sala (ronda 1
                              cabina): morado tinta 12/800 sobre el agua. El gris
                              daba 4.3:1 sobre #EEECFE y no pasaba. */}
                          <span style={{ ...etiqueta, ...(movil ? { marginBottom: 0, lineHeight: 1.4, flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: C.moradoTinta } : null) }}>{movil ? 'La IA entendió' : 'La IA entendió · no ha hecho nada todavía'}</span>
                          {!movil && <span style={{ flex: 1 }} />}
                          {movil ? (
                            /* Estado, no botón (guía §6): punto y texto, sin pastilla. */
                            /* Texto en gris oscuro y el color sólo en el punto,
                               como la sala: el verde sobre el agua daba 4.2:1. */
                            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0, color: C.g700 }}>
                              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: tono(propuesta.resultado).fg }} />
                              {ETIQUETA_RESULTADO[propuesta.resultado] || propuesta.resultado}
                            </span>
                          ) : <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', flexShrink: 0, borderRadius: 999, background: tono(propuesta.resultado).bg, color: tono(propuesta.resultado).fg }}>{ETIQUETA_RESULTADO[propuesta.resultado] || propuesta.resultado}</span>}
                        </div>
                        {/* EN EL TELÉFONO, CUÁNTO SE VA A HACER, ARRIBA. La pantalla de
                            decidir medía tres pantallas; con el conteo se sabe de un
                            vistazo qué pesa lo que vas a confirmar. */}
                        {/* Dos renglones con intención (ronda 5): lo que queda
                            hecho, y debajo lo que le llega al cliente. En uno se
                            partía a la mitad («3 / mensajes»). */}
                        {movil && cuentaCierre && (
                          <div style={{ display: 'grid', gap: 2 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: C.g900, lineHeight: 1.3 }}>
                              {cuentaCierre.cosas ? `${cuentaCierre.cosas} ${cuentaCierre.cosas === 1 ? 'cosa queda hecha' : 'cosas quedan hechas'} al confirmar` : 'Al confirmar no se hace nada más'}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.g700, lineHeight: 1.35 }}>
                              {cuentaCierre.mensajes ? `${cuentaCierre.mensajes} ${cuentaCierre.mensajes === 1 ? 'mensaje' : 'mensajes'} a ${String(actual.nombre || 'el cliente').split(' ')[0]}` : `Ningún mensaje a ${String(actual.nombre || 'el cliente').split(' ')[0]}`}
                            </div>
                          </div>
                        )}
                        {/* En el teléfono el resumen de la IA en dos renglones con
                            «Ver más» (ronda 5): entero eran 4-5 renglones y lo que
                            se deja hecho quedaba bajo la barra de «Confirmar». */}
                        {propuesta.nota && (movil ? (
                          <div>
                            {/* Tres renglones (guía §7): en dos cortaba a media frase. «Ver
                                más» es botón de texto de 44 px que se come su propio aire
                                con márgenes negativos: ~14 px hasta «Siguiente paso». */}
                            <div style={{ fontSize: 14, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...(notaEntera || String(propuesta.nota).length <= 160 ? null : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{propuesta.nota}</div>
                            {String(propuesta.nota).length > 160 && <button onClick={() => setNotaEntera(v => !v)} aria-expanded={notaEntera} style={{ display: 'block', minHeight: 44, margin: '-6px 0 -10px', border: 'none', background: 'none', padding: 0, textAlign: 'left', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#5B4BD6', cursor: 'pointer' }}>{notaEntera ? 'Ver menos' : 'Ver más'}</button>}
                          </div>
                        ) : <div style={{ fontSize: 12.5, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{propuesta.nota}</div>)}
                        {propuesta.siguiente_paso && (movil
                          /* En el teléfono no va en morado negrita: así se ven los botones
                             de texto («Ver más» justo encima) y esto no se toca (guía §6). */
                          ? <div style={{ fontSize: 14, color: C.g900, fontWeight: 600, lineHeight: 1.45 }}><span style={{ color: C.g700, fontWeight: 600 }}>Siguiente paso: </span>{horasDichas(propuesta.siguiente_paso)}</div>
                          : <div style={{ fontSize: 12.5, color: C.moradoTinta, fontWeight: 700, lineHeight: 1.45 }}>Siguiente paso: {propuesta.siguiente_paso}</div>)}
                        {movil && propuesta.siguiente_paso && diaNoCoincide(propuesta.siguiente_paso, propuesta.compromisos?.[0]?.fecha) && (
                          <div role="note" style={{ fontSize: 14, color: ambarTextoAgua, background: '#FFF4E5', borderRadius: 8, padding: '8px 10px', lineHeight: 1.4 }}>
                            Ojo: la cita que se agenda es el <b>{fechaHablada(propuesta.compromisos[0].fecha, propuesta.compromisos[0].hora)}</b>. Si no es ese día, tócale «Cambiar».
                          </div>
                        )}
                            {!movil && cuerpoIA}
                          </div>
                        )}
                        {movil && colQuedo}
                        {movil && colEtapa}
                        {movil && propuesta && <div style={cajaIA}>{cuerpoIA}</div>}
                      </>);
                    })()}

                    {/* 2 · LOS COLAPSABLES. Cerrados, con lo decidido en el
                           título: se abre sólo lo que se quiere cambiar. */}
                    {/* En el teléfono van arriba, entre las dos cajas de la IA. */}
                    {!movil && colQuedo}
                    {!movil && colEtapa}

                    {/* SEGUIMIENTO · las cinco salidas que de verdad existen
                        después de una llamada, dichas como se dicen en voz
                        alta. Pedido del dueño (18-sep): demo, discovery, meter
                        otra llamada a la cola en 5/10/15 minutos, y no llamarle
                        más sacándolo de la lista. */}
                    {/* En el teléfono los horarios, ya colgado, van aquí plegados:
                        arriba del todo empujaban lo que la IA propuso bajo el pliegue. */}
                    {movil && (
                      <Colapsable movil titulo="Horarios para ofrecerle" resumen={huecos.length ? `${huecos.length} huecos libres` : 'mirar la agenda'}>
                        {horariosCaja}
                      </Colapsable>
                    )}
                    <Colapsable movil={movil} titulo="Seguimiento" resumen={(propuesta?.compromisos || []).length ? 'la IA ya puso una fecha' : 'qué sigue con esta persona'}
                      abiertoDefecto={!propuesta}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div>
                          <span style={{ ...etiqueta, marginBottom: 4 }}>Volver a marcarle</span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => volverA(5 / 60)} disabled={!!ocupado} style={btnS}>En 5 min</button>
                            <button onClick={() => volverA(10 / 60)} disabled={!!ocupado} style={btnS}>10 min</button>
                            <button onClick={() => volverA(15 / 60)} disabled={!!ocupado} style={btnS}>15 min</button>
                            <button onClick={() => volverA(1)} disabled={!!ocupado} style={btnS}>1 h</button>
                            <button onClick={() => volverA(null, 'manana')} disabled={!!ocupado} style={btnS}>Mañana 10:00</button>
                            <button onClick={() => volverA(null, 'lunes')} disabled={!!ocupado} style={btnS}>El lunes</button>
                          </div>
                        </div>
                        <div>
                          <span style={{ ...etiqueta, marginBottom: 4 }}>Agendar reunión</span>
                          {/* En el teléfono día y hora van en dos columnas a todo lo
                              ancho, con su rótulo legible (12 px, no 10.5). */}
                          <div className={movil ? 'cab-fh' : undefined} style={movil ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 8 } : { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <label style={{ fontSize: movil ? 12.5 : 10.5, color: movil ? C.g500 : C.g400, fontWeight: 700, minWidth: 0 }}>
                              <span style={{ display: 'block', marginBottom: 2 }}>Día</span>
                              <input type="date" value={cuando.fecha} min={new Date().toISOString().slice(0, 10)}
                                onChange={e => setCuando(c => ({ ...c, fecha: e.target.value }))} style={{ ...campo, width: 148 }} />
                            </label>
                            <label style={{ fontSize: movil ? 12.5 : 10.5, color: movil ? C.g500 : C.g400, fontWeight: 700, minWidth: 0 }}>
                              <span style={{ display: 'block', marginBottom: 2 }}>Hora</span>
                              <input type="time" value={cuando.hora} onChange={e => setCuando(c => ({ ...c, hora: e.target.value }))} style={{ ...campo, width: 118 }} />
                            </label>
                            <div style={movil ? { gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' } : { display: 'contents' }}>
                            <button disabled={!!ocupado || !cuando.fecha || !cuando.hora} onClick={() => rapida('agendar_demo', { ...cuando, reunion_tipo: 'demo' })}
                              style={{ ...btnS, opacity: cuando.fecha && cuando.hora ? 1 : .5 }}>Demo</button>
                            <button disabled={!!ocupado || !cuando.fecha || !cuando.hora} onClick={() => rapida('agendar_demo', { ...cuando, reunion_tipo: 'llamada-discovery' })}
                              style={{ ...btnS, opacity: cuando.fecha && cuando.hora ? 1 : .5 }}>Discovery</button>
                            <button disabled={!!ocupado || !cuando.fecha || !cuando.hora} onClick={() => rapida('volver_a_llamar', cuando)}
                              style={{ ...btnT, opacity: cuando.fecha && cuando.hora ? 1 : .5 }}>Sólo llamarle</button>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => rapida('quien_soy')} disabled={!!ocupado} title="Le llega tu nombre, Sacs, la liga y por qué le llamas (con la fecha en que nos escribió)" style={btnS}>Mandarle quién soy</button>
                          <button onClick={() => rapida('mandar_info')} disabled={!!ocupado} style={btnS}>Mandarle la info</button>
                          <button onClick={() => rapida('soporte')} disabled={!!ocupado} style={btnS}>Es cliente: soporte</button>
                          {/* Sale de la lista Y no se le vuelve a llamar: las dos
                              cosas juntas, porque quien dice «no me llamen» no
                              quiere que mañana le marque otra jornada. */}
                          <button onClick={async () => { if (await confirmar('¿Sacarlo de la lista y no volver a llamarle nunca?')) { await rapida('no_llamar'); await accion('excluir', { item: actual.id }); } }}
                            disabled={!!ocupado} style={{ ...btnT, color: '#C0554E', borderColor: '#f0c4bd' }}>No llamarle más</button>
                        </div>
                      </div>
                    </Colapsable>

                    <Colapsable movil={movil} titulo="Solicitudes extras · lo que la IA no leyó"
                      resumen={`${((est?.acciones_abiertas ?? 0) || 0) > 0 ? `${est.acciones_abiertas} sin hacer` : 'agrega lo que te pidió'}`}>
                      {actual.call_sid && <AccionesLlamada callId={actual.call_sid} compacto fraseCliente={String(actual.oido_texto || '').slice(-200) || null} />}
                    </Colapsable>

                    {/* 3 · LA SALIDA, EN GRANDE. En el teléfono es la de la barra
                        del pulgar: dos «Confirmar» en la misma pantalla es
                        preguntarse cuál de los dos es el bueno. */}
                    {!movil && <button onClick={confirmarYSeguir} disabled={!!ocupado}
                      style={{ ...S.btnP, width: '100%', padding: '13px 18px', fontSize: 14.5, fontWeight: 800, justifyContent: 'center', opacity: ocupado ? .85 : 1 }}>
                      {ocupado ? <><Cargador />{ocupado === 'cierre' ? 'Aplicando lo que decidiste…' : 'Marcando al siguiente…'}</> : (propuesta ? 'Confirmar y seguir con la siguiente' : 'Ya decidí · pasar a la siguiente')}
                    </button>}
                    {est?.siguiente_item && (
                      <div style={{ fontSize: movil ? 13 : 11.5, color: C.g500, textAlign: 'center', lineHeight: 1.45 }}>
                        Sigue <b style={{ color: C.g700 }}>{est.siguiente_item.nombre || telefonoLegible(est.siguiente_item.telefono)}</b>
                        {est.siguiente_item.empresa ? ` · ${est.siguiente_item.empresa}` : ''}{movil ? '' : ' · teclas 1-5 y Enter'}
                      </div>
                    )}
                  </div>
                )}

                {/* Con Fernanda sola no hay nadie decidiendo: el cierre se
                    aplica solo y aquí sólo se enseña lo que hizo. */}
                {estadoActual === 'cierre' && !esperaTuDecision && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={confirmarYSeguir} disabled={!!ocupado} style={propuesta ? S.btnP : btnS}>
                      {propuesta ? 'Confirmar lo de la IA y seguir' : 'Siguiente ahora'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...tarjeta('#9B8CFA'), textAlign: 'center', padding: movil ? '4px 12px 14px' : '28px 18px' }}>
                {pausada ? <div style={{ fontSize: 14, color: '#4B5563' }}>En pausa. {est?.pendientes || 0} por marcar.</div>
                  : (est?.vivos || []).length > 0 ? <div style={{ textAlign: 'left' }}>{bloqueLineas}{movil && siguenBloque}</div>
                  : enSala ? <><Cargando texto={est?.pendientes ? 'Marcando al siguiente…' : 'Cerrando la lista…'} alto={80} /></>
                  : <div style={{ fontSize: 14, color: '#4B5563' }}>Entra a la sala para que la central empiece a marcar.</div>}
              </div>
            )}

            {/* En el teléfono, con la barra del pulgar puesta, «Pausar» y
                «Terminar la sesión» viven en la hoja de la Lista: aquí flotaban
                solos en medio de la pantalla, a 5 px de «Pausar» de la barra, y
                terminar es lo último que se quiere picar por error. */}
            {!(movil && (enSala || sola) && !pausada) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', ...(movil ? { marginTop: 4 } : null) }}>
              {!pausada && !barraConPausa
                ? <button onClick={() => accion('pausar')} disabled={!!ocupado} style={btnT}><IcoReloj size={13} />Pausar</button>
                : null}
              <span style={{ flex: 1 }} />
              <button onClick={terminarConfirmado} disabled={!!ocupado} style={btnD}>Terminar la sesión</button>
            </div>
            )}
          </div>
        </div>

        {/* ══ LA BARRA DEL PULGAR (19-sep-2026) ═══════════════════════════════
            En escritorio las acciones viven en la tarjeta y se alcanzan con el
            ratón esté donde esté. En un teléfono esa misma tarjeta es un scroll
            de pantalla y media —ficha, apertura, horarios, colapsables— y la
            decisión que cierra la llamada quedaba hasta el fondo. Cien llamadas
            al día × un scroll cada una es media hora de pulgar.

            Lo que se puede hacer AHORA vive fijo abajo, en la zona que alcanza
            el pulgar sin recolocar la mano, y cambia con el momento:
              · timbrando  → Saltar
              · hablando   → Colgar (rojo, lo más grande) y Hablar yo
              · cierre     → «Ya decidí, siguiente», que es la salida
            Y siempre el acceso a la lista, con cuántos faltan. */}
        {movil && (enSala || sola) && !pausada && (() => {
          /* «Lista · N»: fuera de llamada a la izquierda, con cómo va la
             jornada debajo; en llamada pasa al tercer hueco de la botonera. */
          const botonLista = (
            <button onClick={() => setListaAbierta(v => !v)} aria-expanded={listaAbierta}
              style={{ flexShrink: 0, minHeight: 52, border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 12, padding: '0 12px', fontSize: 14, fontWeight: 800, color: C.g700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-grid', justifyItems: 'start', alignContent: 'center', lineHeight: 1.2 }}>
              <span>Lista · {pendientes.length}</span>
              {!esperaTuDecision && !['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) && (
                <span style={{ fontSize: 13, fontWeight: 600, color: C.g500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}><b style={{ color: C.g900 }}>{hechos.length}/{sesion.total || items.length}</b> hechas</span>
              )}
            </button>
          );
          const vivosN = (est?.vivos || []).length;
          return (
          <div style={{ ...barraPie, zIndex: 55 }}>
            {bandaPie}
            {estadoActual === 'en_linea' ? (<>
              {/* ══ LA BOTONERA DE LA LLAMADA (guía §4) ══════════════════════
                  La misma que la sala clara y la sala manual: [80] [Colgar]
                  [80], Colgar siempre al centro y con su auricular. A la
                  izquierda Silenciar (o «Hablar yo» si habla Fernanda), a la
                  derecha la lista. */}
              {fernanda && !sola && enSala && !actual.voz?.handoff ? (
                <button onClick={() => accion('tomar')} disabled={!!ocupado} style={huecoLlamada}>
                  {ocupado === 'tomar' ? <Cargador /> : <IcoUsuario size={20} />}
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Hablar yo</span>
                </button>
              ) : (!fernanda || actual.voz?.handoff) ? (
                /* Mudo en ámbar, como la sala: el botón ES el estado. */
                <button onClick={() => document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: micAbierto } }))} aria-pressed={!micAbierto}
                  aria-label={micAbierto ? 'Te oyen. Silenciar el micrófono' : 'Estás en mudo. Abrir el micrófono'}
                  style={{ ...huecoLlamada, ...(micAbierto ? null : { background: '#FFF4E5', border: '1px solid #E8A838', color: '#9a6a10' }) }}>
                  <IcoMicLlamada apagado={!micAbierto} />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{micAbierto ? 'Silenciar' : 'En mudo'}</span>
                </button>
              ) : <span aria-hidden style={{ width: 80, flexShrink: 0 }} />}
              <button onClick={() => accion('colgar')} disabled={!!ocupado}
                style={{ flex: 1, minWidth: 0, minHeight: 52, border: 'none', background: '#C0554E', color: '#fff', borderRadius: 12, padding: '0 10px', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {ocupado === 'colgar' ? <><Cargador />Colgando…</> : <><IcoColgar size={20} />Colgar</>}
              </button>
              <button onClick={() => setListaAbierta(v => !v)} aria-expanded={listaAbierta} aria-label={`La lista: ${pendientes.length} por marcar`} style={huecoLlamada}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.g900, fontVariantNumeric: 'tabular-nums' }}>{pendientes.length}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>Lista</span>
              </button>
            </>) : esperaTuDecision ? (<>
              {botonLista}
              <button onClick={confirmarYSeguir} disabled={!!ocupado} style={{ ...ctaMovil, minWidth: 0, padding: '0 12px' }}>
                {ocupado ? <><Cargador />{ocupado === 'cierre' ? 'Aplicando…' : 'Marcando…'}</> : (propuesta ? (cuentaCierre && cuentaCierre.cosas > 1 ? `Confirmar y seguir · ${cuentaCierre.cosas}` : 'Confirmar y seguir') : 'Ya decidí · siguiente')}
              </button>
            </>) : ['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) ? (<>
              {/* Una línea timbrando: no hay acción principal. Qué pasa, en
                  texto, y «Saltar» como secundario. */}
              {botonLista}
              <span role="status" style={{ flex: 1, fontSize: 14, color: C.g500, minWidth: 0, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                {ETIQUETA_ITEM[estadoActual] || estadoActual}{actual?.nombre ? <> · <b style={{ color: C.g700 }}>{String(actual.nombre).split(' ')[0]}</b></> : ''}
              </span>
              <button onClick={() => accion('saltar')} disabled={!!ocupado} style={secMovil}>
                {ocupado === 'saltar' ? '…' : 'Saltar'}
              </button>
            </>) : (<>
              {/* Varias timbrando, o entre una y otra: el mismo patrón —texto
                  de estado y un secundario—. «Pausar» ya no mide todo el
                  ancho: no es la acción principal (guía §2). */}
              {botonLista}
              <span role="status" style={{ flex: 1, fontSize: 14, color: C.g500, minWidth: 0, lineHeight: 1.3 }}>
                {/* «Marcando a 3 a la vez» (guía §2), partido A PROPÓSITO en dos
                    renglones como el «Lista · 10 / 3/82 hechas» de al lado
                    (ronda 3): a 360 se partía solo en «Marcando a 3 a / la vez»
                    y se veía apretado; así se lee igual a 360, 390 y 414. */}
                {vivosN > 1
                  ? <><b style={{ display: 'block', color: C.g700, fontWeight: 700 }}>Marcando a {vivosN}</b><span style={{ display: 'block', fontSize: 13 }}>a la vez</span></>
                  : est?.pendientes ? 'Marcando al siguiente…' : 'Cerrando la lista…'}
              </span>
              <button onClick={() => accion('pausar')} disabled={!!ocupado} style={secMovil}>
                {ocupado === 'pausar' ? <Cargador /> : <IcoReloj size={15} />}Pausar
              </button>
            </>)}
          </div>
          );
        })()}

        {/* ══ EN EL TELÉFONO, LA LISTA ES UNA HOJA (19-sep-2026) ══════════════
            Ocupaba 260 px fijos debajo de la llamada: en una pantalla de 844
            eso es un tercio, permanente, para algo que se mira entre llamada y
            llamada y no durante. Lo que importa mientras hablas es quién es y
            qué decides; la lista se abre cuando la quieres, desde el botón de
            la barra de abajo, y se va con un toque fuera. */}
        {/* La hoja vive DENTRO de su velo (23-sep-2026): como hermanos, el
            velo quedaba encima de todo en el mismo nivel y lo que había en la
            hoja no se podía medir (el arnés contaba 0 tocables). Dentro, el
            toque fuera de la hoja sigue cerrándola. */}
        {(() => { const hojaLista = (
        <div className="wa-scroll" {...(movil && listaAbierta ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'La lista de la jornada' } : null)} style={movil ? {
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
          maxHeight: '72vh', background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
          boxShadow: '0 -10px 40px rgba(12,11,18,.22)', overflowY: 'auto',
          transform: listaAbierta ? 'translateY(0)' : 'translateY(101%)',
          /* Cerrada también se esconde: si no, sus botones seguían vivos
             debajo de la pantalla (el tabulador y el lector los encontraban). */
          visibility: listaAbierta ? 'visible' : 'hidden',
          transition: 'transform .22s cubic-bezier(.2,.7,.3,1), visibility .22s',
          paddingBottom: 'env(safe-area-inset-bottom)',
        } : { width: 340, flexShrink: 0, borderLeft: `1px solid ${C.g200}`, background: '#fff', overflowY: 'auto' }}>
          {(!movil || hojaViva) && (<>
          {/* En el teléfono la hoja lleva su título y un «Cerrar» de pulgar
              (la rayita de arriba era el único cierre y medía 4 px), y las
              cuatro pestañas van en dos renglones: en uno se pegaban a 0 px y
              «Compromisos» no cabía. */}
          <div style={movil
            ? { position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: `1px solid ${C.g200}`, padding: '6px 16px 10px' }
            : { display: 'flex', gap: 0, borderBottom: `1px solid ${C.g200}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            {/* Como el resto de hojas del CRM: el asa de arriba dice «esto se
                baja» y la ✕ de 44 px la cierra. */}
            {movil && (<>
              <span aria-hidden style={{ display: 'block', width: 36, height: 4, borderRadius: 999, background: C.g200, margin: '2px auto 4px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <b style={{ flex: 1, fontSize: 16, color: C.g900 }}>La lista de la jornada</b>
                <button onClick={() => setListaAbierta(false)} aria-label="Cerrar la lista" style={{ width: 44, height: 44, flexShrink: 0, border: 'none', background: 'none', color: C.g500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoX size={20} /></button>
              </div>
            </>)}
            {/* Rejilla de 2×2 (23-sep-2026): en una fila que se deslizaba,
                «Compromisos» quedaba fuera de pantalla a 360 y 390 sin nada
                que dijera que había más. Así las cuatro se ven siempre. */}
            <div role={movil ? 'tablist' : undefined} style={movil ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 } : { display: 'contents' }}>
            {(['lista', 'hechas', 'quitados', 'compromisos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} aria-selected={movil ? tab === t : undefined} style={movil ? {
                /* La opción de contenido de todo el flujo (ronda 3 cabina): el
                   contorno gris y el lila #C9BCF7 eran una tercera forma de chip. */
                ...opcionMovil(tab === t), minWidth: 0, whiteSpace: 'nowrap', padding: '0 8px',
              } : {
                flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 10px', fontSize: 12.5,
                background: tab === t ? C.moradoAgua : 'transparent', color: tab === t ? C.moradoTinta : '#4B5563', fontWeight: tab === t ? 800 : 500,
                borderBottom: tab === t ? '2px solid #9B8CFA' : '2px solid transparent',
              }}>{t === 'lista' ? `Por marcar (${pendientes.length})` : t === 'hechas' ? `Hechas (${hechos.length})` : t === 'quitados' ? `Quitados (${quitados.length})` : `Compromisos${compromisos.length || (movil && compCargados) ? ` (${compromisos.length})` : ''}`}</button>
            ))}
            </div>
          </div>
          {(tab === 'lista' || tab === 'hechas') && (tab === 'lista' ? items.filter(i => !['hecho', 'saltado', 'excluido'].includes(i.estado)) : hechos).map(i => filaItem(i, tab === 'lista', true))}
          {/* ══ QUITADOS (22-sep-2026) ════════════════════════════════════════
              «Si cancelo a alguien, ponme una tab o algo que yo vea a quién
              cancelé, para ver por qué aparecieron en primera instancia.»
              Cada renglón dice quién lo quitó (tú o el sistema, y por qué) y
              POR QUÉ HABÍA ENTRADO: la lista de la que salió y lo que el CRM
              sabía de él al armarla (etapa, giro, último mensaje, última
              llamada). Se puede volver a meter. */}
          {tab === 'quitados' && (
            <>
              {quitados.length > 0 && (
                <div style={{ padding: movil ? '10px 16px' : '10px 12px', fontSize: movil ? 13 : 11.5, color: C.g500, lineHeight: 1.5, borderBottom: `1px solid ${C.g100}` }}>
                  Entraron por la lista <b style={{ color: C.g700 }}>{sesion?.origen?.descripcion || sesion?.nombre || descripcion}</b>.
                </div>
              )}
              {quitados.length === 0 && <div style={{ padding: movil ? '18px 16px' : 18, fontSize: movil ? 14 : 12, color: movil ? C.g500 : C.g400 }}>No has quitado a nadie de esta lista.</div>}
              {quitados.map(i => {
                const porTi = /cancelaste|quitaste/i.test(String(i.motivo_exclusion || ''));
                // La primera línea de la ficha es «nombre · empresa»: ya está arriba en negritas.
                const quien = [i.nombre, i.empresa].filter(Boolean).join(' · ');
                const porQue = [i.nota, ...String(i.resumen || '').split('\n').filter(l => l.trim() && l.trim() !== quien && l.trim() !== i.nombre)].filter(Boolean).join('\n')
                  || 'La trajo el filtro de la lista; el CRM no tenía más historial de este número.';
                // El canal de 16 px de la pestaña «Por marcar» (ronda 3): al cambiar de pestaña ya no brinca.
                return (
                  <div key={i.id} style={{ padding: movil ? '11px 16px' : '9px 12px', borderBottom: `1px solid ${C.g100}` }}>
                    <div style={{ display: 'flex', alignItems: movil ? 'flex-start' : 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: movil ? 15 : 13, fontWeight: 600, color: C.g900, ...(movil ? { overflowWrap: 'anywhere', lineHeight: 1.3 } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>
                        {i.nombre || telefonoLegible(i.telefono)}{i.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {i.empresa}</span> : null}
                      </div>
                      {!movil && <button onClick={() => accion('incluir', { item: i.id })} style={{ ...btnT, padding: '3px 8px', fontSize: 11, flexShrink: 0 }}>Volver a meter</button>}
                    </div>
                    <div style={{ fontSize: movil ? 13 : 11.5, marginTop: 2, fontWeight: 700, color: porTi ? '#C0554E' : C.g500 }}>
                      {porTi ? 'Tú: ' : 'Solo: '}{i.motivo_exclusion || 'quitado'}
                    </div>
                    <div style={{ fontSize: movil ? 13 : 11.5, color: movil ? C.g700 : C.g500, marginTop: 2 }}>{telefonoLegible(i.telefono)}</div>
                    <div style={{ fontSize: movil ? 13 : 11.5, color: '#4B5563', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap', background: C.g50, borderRadius: 8, padding: '6px 8px' }}>
                      <span style={{ fontWeight: 700 }}>Por qué estaba: </span>{porQue}
                    </div>
                    {/* En el teléfono el botón baja a su propio renglón: al lado
                        del nombre lo partía («Claudia Tallas / Extra»). */}
                    {movil && (
                      <div style={{ display: 'grid', marginTop: 8 }}>
                        <button onClick={() => accion('incluir', { item: i.id })} style={secContenido}>Volver a meter</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {tab === 'hechas' && hechos.length === 0 && <div style={{ padding: 18, fontSize: movil ? 14 : 12, color: movil ? C.g500 : C.g400 }}>Aún no hay llamadas hechas.</div>}

          {/* ══ COMPROMISOS ══════════════════════════════════════════════════
              Lo que prometiste al hablar, en un solo sitio y en orden de cuándo
              toca: las reuniones que se agendaron y las llamadas de vuelta.
              Con la fecha y la hora grandes —es lo que se viene a buscar— y
              diciendo si YA está en Google Calendar, que es la diferencia entre
              una cita que le va a sonar al cliente y una que sólo existe aquí. */}
          {tab === 'compromisos' && compromisos.length === 0 && (
            <div style={{ padding: 18, fontSize: movil ? 14 : 12, color: movil ? C.g500 : C.g400 }}>Todavía no hay compromisos. Aparecen aquí en cuanto quedas de algo en una llamada.</div>
          )}
          {tab === 'compromisos' && compromisos.map((c: any) => {
            const cuando = new Date(`${c.fecha}T${c.hora || '10:00'}:00`);
            /* Hoy y mañana EN LA HORA DEL CENTRO. Con `toISOString` (que es
               UTC) toda la tarde mexicana ya es «mañana» en Greenwich, y la
               etiqueta mentía justo en las horas en que más se llama. */
            const enCdmx = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
            const hoy = enCdmx(new Date());
            const dia = c.fecha === hoy ? 'hoy'
              : c.fecha === enCdmx(new Date(Date.now() + 86400e3)) ? 'mañana'
              : cuando.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
            const paso = c.fecha < hoy;
            return (
              <div key={`${c.tipo}-${c.id}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderBottom: `1px solid ${C.g100}`, opacity: paso ? .6 : 1 }}>
                <span style={{
                  flexShrink: 0, width: 62, textAlign: 'center', borderRadius: 10, padding: '6px 4px',
                  background: c.tipo === 'reunion' ? C.moradoAgua : '#FFF4E5', color: c.tipo === 'reunion' ? C.moradoTinta : '#9a6a10',
                }}>
                  <b style={{ display: 'block', fontSize: 14, lineHeight: 1.1 }}>{c.hora}</b>
                  <span style={{ fontSize: movil ? 12 : 10.5, fontWeight: 700 }}>{dia}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: movil ? 15 : 13, fontWeight: 700, color: C.g900, ...(movil ? { overflowWrap: 'anywhere', lineHeight: 1.3 } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>
                    {c.nombre || telefonoLegible(c.telefono)}{c.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {c.empresa}</span> : null}
                  </div>
                  <div style={{ fontSize: movil ? 13 : 11.5, color: C.g500 }}>{c.titulo}{c.motivo ? ` · ${c.motivo}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                    {movil ? (c.tipo === 'reunion'
                      ? estadoMovil(c.en_google ? '#1E8A63' : '#E8A838', c.en_google ? '#1E8A63' : '#9a6a10', c.en_google ? 'En Google Calendar' : 'No está en Google Calendar')
                      : estadoMovil('#9B8CFA', C.moradoTinta, 'La marca sola a esa hora')
                    ) : c.tipo === 'reunion' ? (
                      <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: c.en_google ? '#EAF8F2' : '#FFF4E5', color: c.en_google ? '#1E8A63' : '#9a6a10' }}>
                        {c.en_google ? 'En Google Calendar' : 'No está en Google Calendar'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: C.moradoAgua, color: C.moradoTinta }}>La marca sola a esa hora</span>
                    )}
                    {c.meet && <a href={c.meet} target="_blank" rel="noreferrer" style={{ fontSize: movil ? 14 : 11, color: C.moradoTinta, fontWeight: 700, ...(movil ? { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 8px' } : null) }}>Meet</a>}
                    {paso && <span style={{ fontSize: 10.5, color: '#C0554E', fontWeight: 700 }}>ya pasó</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {/* LO QUE PARA LA JORNADA, AL FONDO DE LA HOJA. Fuera del camino del
              pulgar mientras se llama, y «Terminar» pide confirmación. */}
          {/* «Salir de la sala» vivía en la tarjeta flotante de Telefonia, que
              en el teléfono se esconde con la jornada viva (CSS_MOVIL): aquí
              queda su misma salida, con el mismo evento. */}
          {movil && (enSala || ((sola) && !pausada)) && (
            <div style={{ display: 'grid', gap: 8, padding: '14px 12px 16px', borderTop: `1px solid ${C.g100}`, marginTop: 4 }}>
              {(enSala || sola) && !pausada && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {!barraConPausa && <button onClick={() => { setListaAbierta(false); accion('pausar'); }} disabled={!!ocupado} style={{ ...btnT, flex: 1, justifyContent: 'center', fontSize: 14 }}><IcoReloj size={14} />Pausar la jornada</button>}
                  <button onClick={terminarConfirmado} disabled={!!ocupado} style={{ ...btnD, flex: 1, fontSize: 14 }}>Terminar la sesión</button>
                </div>
              )}
              {enSala && (
                <button onClick={() => { setListaAbierta(false); document.dispatchEvent(new CustomEvent('tel-colgar-sala')); }} title="Salir de la sala"
                  style={{ ...btnT, width: '100%', justifyContent: 'center', fontSize: 14 }}>Salir de la sala</button>
              )}
            </div>
          )}
          </>)}
        </div>
        ); return movil ? (
          <div onClick={e => { if (e.target === e.currentTarget) setListaAbierta(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: listaAbierta ? 'rgba(12,11,18,.45)' : 'rgba(12,11,18,0)', visibility: listaAbierta ? 'visible' : 'hidden', transition: 'background .22s, visibility .22s' }}>
            {hojaLista}
          </div>
        ) : hojaLista; })()}
      </div>
    </div>
  );
}


/* ══ NINGÚN BOTÓN SE QUEDA MUDO ══════════════════════════════════════════════
   Pedido del dueño (18-sep-2026): «al darle clic en colgar que me muestre un
   loader o algo, que se quede como trabajando y de ahí haga la acción; siempre
   el botón debe tener interacción».

   Y es más que estética: colgar, confirmar el cierre o agendar tardan entre
   medio segundo y tres —van a Twilio, a Google, a Meta—. Un botón que no cambia
   en ese rato se lee como que no registró el clic, y la reacción natural es
   volver a picarle: dos cierres, dos citas, dos WhatsApps. El spinner no es
   adorno, es lo que evita el doble clic.

   `minimo` existe porque una respuesta instantánea tampoco se ve: el estado de
   «trabajando» se sostiene 600 ms aunque el servidor conteste antes. */
function Cargador({ chico }: { chico?: boolean }) {
  const d = chico ? 11 : 13;
  return (
    <span aria-hidden style={{
      width: d, height: d, borderRadius: 999, flexShrink: 0, display: 'inline-block',
      border: '2px solid currentColor', borderTopColor: 'transparent', opacity: .85,
      animation: 'cab-gira .7s linear infinite',
    }} />
  );
}

/* ══ UN COLAPSABLE QUE DICE LO QUE ESCONDE ═══════════════════════════════════
   Pedido del dueño (18-sep-2026): «en vez de tantos botones y tantos campos
   abiertos… un título "¿Cómo quedó?" y, al darle clic, ya yo decido».

   La diferencia con un acordeón cualquiera está en `resumen`: el título dice lo
   que YA está decidido («Hablamos», «la IA dice: volver a llamar»), así que se
   abre sólo lo que se quiere cambiar. Un colapsable que no dice qué hay dentro
   obliga a abrirlos todos, y entonces no sirvió de nada. */
function Colapsable({ titulo, resumen, alerta, abiertoDefecto, movil, accion, children }: { titulo: string; resumen?: string; alerta?: boolean; abiertoDefecto?: boolean; movil?: boolean; accion?: React.ReactNode; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(!!abiertoDefecto);
  /* Al abrirlo con el dedo, lo que trae se acomoda a la vista (ronda 6): los
     horarios abrían con las horas bajo la barra del pulgar y había que
     buscarlas. El margen de abajo deja libre la barra fija. */
  const caja = useRef<HTMLDivElement>(null);
  const tocado = useRef(false);
  useEffect(() => {
    if (!movil || !abierto || !tocado.current) return;
    const t = setTimeout(() => caja.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    return () => clearTimeout(t);
  }, [abierto, movil]);
  /* En el teléfono el resumen va DEBAJO del título, a todo lo ancho: lado a
     lado, título y resumen se partían en dos renglones cada uno. */
  /* En el teléfono lo pendiente va en ámbar (guía §0), no en rojo: el rojo
     es sólo de Colgar y de lo que se destruye (ronda 1 cabina). */
  if (movil) return (
    <div ref={caja} style={{ border: `1px solid ${alerta && !abierto ? '#E8A838' : C.g200}`, borderRadius: 10, background: '#fff', overflow: 'hidden', scrollMarginBottom: 'calc(96px + env(safe-area-inset-bottom))', scrollMarginTop: 12 }}>
      <button onClick={() => { tocado.current = true; setAbierto(a => !a); }} aria-expanded={abierto} style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px', minHeight: 52,
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <IcoChevronAbajo size={18} style={{ flexShrink: 0, color: C.g500, marginTop: 1, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
        <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
          <b style={{ fontSize: 15, color: C.g900, lineHeight: 1.3 }}>{titulo}</b>
          {resumen && <span style={{ fontSize: 13, color: alerta ? '#9a6a10' : C.g500, fontWeight: alerta ? 700 : 500, lineHeight: 1.35 }}>{resumen}</span>}
        </span>
      </button>
      {/* Lo que se puede resolver sin abrirlo, a la vista con el plegable cerrado. */}
      {accion && !abierto && <div style={{ padding: '8px 12px 12px' }}>{accion}</div>}
      {abierto && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
  );
  return (
    <div style={{ border: `1px solid ${alerta && !abierto ? '#f0c4bd' : C.g200}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <button onClick={() => setAbierto(a => !a)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ fontSize: 11, color: C.g400, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▶</span>
        <b style={{ fontSize: 12.5, color: C.g900 }}>{titulo}</b>
        <span style={{ flex: 1 }} />
        {resumen && <span className="cab-col-res" style={{ fontSize: 11.5, color: alerta ? '#C0554E' : C.g500, fontWeight: alerta ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{resumen}</span>}
      </button>
      {abierto && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
  );
}
