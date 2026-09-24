/* ARMAR LA LISTA DE HOY · los filtros de verdad.
 *
 * PEDIDO DEL DUEÑO (21-sep-2026): «al crear la llamada inteligente debes darme
 * más opciones de filtros: que pueda seleccionar un giro de las ABM y llamarle
 * a las que ya están verificadas que sí tienen WhatsApp, o las que tienen
 * teléfono sin WhatsApp, o ambas; que pueda seleccionar por sucursales, que de
 * forma general pueda decidir más de X sucursales; que pueda seleccionar uno o
 * varios giros, sea de ABM o de leads normales; que pueda excluir los que he
 * llamado más de X veces y nunca han contestado, y otros 10 filtros que
 * consideres importantes, para que pueda meter varios a la vez y sea muy
 * flexible y así mi lista funcione en orden».
 *
 * DE QUÉ TAMAÑO ES EL CAMBIO. Antes se elegía entre tres desplegables sobre el
 * inbox: bandeja, etapa y estado de la conversación. Eso alcanzaba mientras
 * llamar significara «marcarle a una conversación». Ahora el universo son
 * también las 29,770 cuentas del ABM, que no tienen conversación ninguna, y lo
 * que separa una lista buena de una mala no es la bandeja: es el giro, cuántas
 * tiendas tiene, si su WhatsApp está verificado y a cuántos ya les marqué sin
 * que contestaran.
 *
 * CÓMO SE ORDENÓ LA PANTALLA, que es la mitad del pedido («que sea fácil de
 * entender»): tres bloques en el orden en que se piensa una lista.
 *   1. A QUIÉN     — de dónde salen y por dónde se les puede hablar.
 *   2. CÓMO SON    — giro, tamaño, dónde están, qué tan buenos se ven.
 *   3. A QUIÉN NO  — todo lo que se quita, junto y en un solo sitio.
 * Los filtros que no aplican a la fuente elegida no se desactivan: DESAPARECEN.
 * Un campo gris que no hace nada se intenta usar igual.
 *
 * Y el número grande de la derecha es el número REAL —sale de preguntar con el
 * filtro puesto, no de estimar—, con los primeros nombres debajo. Ver a quién
 * vas a llamar antes de que suene el primer timbre es lo que evita descubrir a
 * media jornada que la lista no era la que creías.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import { useIsMobile } from '../../../lib/ui/mobile';
import { telefonoLegible } from '../../../lib/telefono';
import { IcoX } from './whatsapp/Iconos';

type Cat = { giros_abm: { giro: string; n: number; con_wa: number }[]; giros_crm: { giro: string; n: number }[]; estados: { estado: string; n: number }[] };

export type Filtros = {
  fuente: 'crm' | 'abm' | 'ambas';
  canal: '' | 'wa_verificado' | 'wa' | 'solo_tel';
  giros: string[];
  etapas: string[];
  suc_min: string; suc_max: string;
  estado_geo: string[]; ciudad: string;
  rating_min: string; resenas_min: string; puntaje_min: string;
  quemados: string; sin_tocar_dias: string;
  nunca_llamados: boolean; excluir_clientes: boolean;
  excluir_en_cadencia: boolean; excluir_con_reunion: boolean;
  excluir_con_accion: boolean;
  owner: '' | 'mias' | 'sin_asignar';
  orden: 'puntaje' | 'sucursales' | 'rating';
};

export const FILTROS_INICIALES: Filtros = {
  fuente: 'crm', canal: '', giros: [], etapas: [],
  suc_min: '', suc_max: '', estado_geo: [], ciudad: '',
  rating_min: '', resenas_min: '', puntaje_min: '',
  /* Los tres que vienen puestos de fábrica son los que casi siempre se quieren
     y casi nunca se acuerda uno de marcar: no volver a marcarle a quien ya
     ignoró tres llamadas, no llamarle a un cliente y no llamarle a alguien con
     quien ya tienes cita. Se pueden quitar, pero de entrada protegen. */
  quemados: '3', sin_tocar_dias: '',
  nunca_llamados: false, excluir_clientes: true,
  excluir_en_cadencia: false, excluir_con_reunion: true,
  /* 22-sep: los que ya tuvieron una acción (reunión, seguimiento, oportunidad,
     descalificado) no se vuelven a marcar. De fábrica, puesta. */
  excluir_con_accion: true,
  owner: '', orden: 'puntaje',
};

/** Los filtros → el query string que entiende `/api/crm/telefonia/candidatos`. */
export function qsDeFiltros(f: Filtros): string {
  const p = new URLSearchParams();
  p.set('fuente', f.fuente);
  if (f.canal) p.set('canal', f.canal);
  if (f.giros.length) p.set('giros', f.giros.join(','));
  if (f.etapas.length) p.set('etapa', f.etapas.join(','));
  if (f.suc_min) p.set('suc_min', f.suc_min);
  if (f.suc_max) p.set('suc_max', f.suc_max);
  if (f.estado_geo.length) p.set('estado_geo', f.estado_geo.join(','));
  if (f.ciudad.trim()) p.set('ciudad', f.ciudad.trim());
  if (f.rating_min) p.set('rating_min', f.rating_min);
  if (f.resenas_min) p.set('resenas_min', f.resenas_min);
  if (f.puntaje_min) p.set('puntaje_min', f.puntaje_min);
  if (f.quemados) p.set('quemados', f.quemados);
  if (f.sin_tocar_dias) p.set('sin_tocar_dias', f.sin_tocar_dias);
  if (f.nunca_llamados) p.set('nunca_llamados', '1');
  if (f.excluir_clientes) p.set('excluir_clientes', '1');
  if (f.excluir_en_cadencia) p.set('excluir_en_cadencia', '1');
  if (f.excluir_con_reunion) p.set('excluir_con_reunion', '1');
  // Al revés que las demás: excluirlos es lo de siempre (también en el servidor); sólo se avisa cuando se QUIEREN incluir.
  if (!f.excluir_con_accion) p.set('incluir_con_accion', '1');
  if (f.owner) p.set('owner', f.owner);
  if (f.orden) p.set('orden', f.orden);
  return p.toString();
}

/** El nombre de la jornada, armado solo con lo que el usuario sí eligió. */
export function tituloDeFiltros(f: Filtros): string {
  const t: string[] = [];
  t.push(f.fuente === 'abm' ? 'Prospección' : f.fuente === 'ambas' ? 'CRM + prospección' : 'Mis leads');
  if (f.giros.length) t.push(f.giros.slice(0, 2).join(' y ') + (f.giros.length > 2 ? ` +${f.giros.length - 2}` : ''));
  if (f.canal === 'wa_verificado') t.push('WhatsApp verificado');
  else if (f.canal === 'wa') t.push('con WhatsApp');
  else if (f.canal === 'solo_tel') t.push('solo teléfono');
  if (f.suc_min) t.push(`${f.suc_min}+ tiendas`);
  if (f.estado_geo.length === 1) t.push(f.estado_geo[0]);
  return t.join(' · ');
}

const rot: any = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: 6 };
const sel: any = { width: '100%', border: '1px solid #e0dfe6', borderRadius: 10, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' };
const inp: any = { ...sel, cursor: 'text' };

/* ══ EN EL TELÉFONO SE ARMA CON EL PULGAR (23-sep-2026) ═══════════════════
   Pedido del dueño: «desde que generas la lista debe ser un diseño móvil
   primero… debe ser fácil apretar cualquier botón». Medido a 390: los chips
   eran de 36 px con 6 px entre sí, las palomitas de 15 px y los textos de
   ayuda de 11 px. En el teléfono todo lo que se toca mide 44 px o más, con 8
   de aire, y los campos van a 16 px para que iOS no haga zoom al tocarlos.
   El escritorio se queda exactamente como estaba. */
const inpMovil: any = { ...inp, fontSize: 16, minHeight: 48, padding: '11px 13px' };
/* Los rótulos y los conteos de los chips en #6b7280 (4.8:1 sobre blanco): el
   #999 y el #a5a2af de escritorio se quedaban en 2.5–2.8:1 y en el teléfono,
   a pleno sol, el número que decide qué giro elegir casi no se leía. */
/* 23-sep, ronda 5: los rótulos de sección suben a 13 px en #4b5563 (7.6:1) y
   se aprietan un poco: a 12 px, grises y tan espaciados, «1 · DE DÓNDE SALEN»
   pesaba menos que los chips y los bloques no se distinguían de un vistazo. */
/* 24-sep, ronda 3 de continuidad: el rótulo de sección es el mismo gris
   secundario (#6B7280, 4.8:1) que en la cabina, el cierre y la sala: un solo
   gris para el mismo rol en todo el flujo. */
const rotMovil: any = { ...rot, fontSize: 13, letterSpacing: '.05em', marginBottom: 10, color: '#6B7280' };
/** Chip/opción: el mismo estilo en las cinco familias de botones de la pantalla. */
/* 24-sep, continuidad ronda 1: en el teléfono hay UNA sola forma de chip de
   opción en todo el flujo de llamadas, la «opción de contenido» de la guía
   (§3.3) que ya usan «Cómo quedó» y «Mándale mientras hablan» en la cabina:
   rectángulo de radio 12, contorno 1.5 px #9B8CFA, texto #5B4BD6 de 14/700 y
   fondo #EEECFE al elegirla. Giro y Dónde están dejan la píldora redonda. */
function estiloChip(on: boolean, movil: boolean, redondo: boolean, compacto = false, rejilla = false): any {
  if (movil) return {
    fontFamily: 'inherit', cursor: 'pointer', borderRadius: 12, padding: '0 14px', fontSize: 14, fontWeight: 700,
    minHeight: 44, maxWidth: '100%', textAlign: 'left', lineHeight: 1.25,
    border: '1.5px solid #9B8CFA', background: on ? '#EEECFE' : '#fff', color: '#5B4BD6',
    ...(rejilla ? { width: '100%', textAlign: 'center', padding: '4px 6px' } : null),
  };
  return {
    fontFamily: 'inherit', cursor: 'pointer', borderRadius: redondo ? 999 : 9,
    padding: movil ? '0 14px' : compacto ? (redondo ? '4px 10px' : '6px 10px') : (redondo ? '5px 11px' : '7px 11px'),
    fontSize: movil ? 14 : compacto ? (redondo ? 11.5 : 12) : (redondo ? 12 : 12.5),
    minHeight: movil ? 44 : undefined, maxWidth: '100%', textAlign: movil ? 'left' : undefined, lineHeight: movil ? 1.25 : undefined,
    fontWeight: on ? 800 : 600, border: `1px solid ${on ? P.violeta : '#e6e4ec'}`,
    background: on ? '#EEECFE' : '#fff', color: on ? P.violetaTinta : movil ? '#374151' : '#4B5563',
    ...(rejilla ? { width: '100%', textAlign: 'center', padding: '4px 6px' } : null),
  };
}

/* En el teléfono las familias de opciones cortas van en rejilla a lo ancho
   (2, 3 o 4 columnas iguales): cada bloque se lee de un vistazo, ningún botón
   queda huérfano en su renglón y el formulario se acorta cientos de px. */
function rejilla(cols: number): any {
  return { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 };
}

/** Un giro largo, en corto: lo de antes de « y », «,» o « de » (y si aun así no
    cabe, sus dos primeras palabras). «Uniformes escolares y empresariales…» →
    «Uniformes escolares». */
function giroCorto(g: string): string {
  if (g.length <= 24) return g;
  const a = g.split(/ y |, | de | para /)[0].trim();
  return a.length <= 24 ? a : a.split(' ').slice(0, 2).join(' ');
}

/** Lo que dice cada filtro puesto, en palabras, para el resumen del pie. */
function filtrosEnPalabras(f: Filtros, etapas: { id: string; label: string }[]): string {
  const t = [tituloDeFiltros(f)];
  if (f.etapas.length) t.push(f.etapas.length === 1 ? (etapas.find(e => e.id === f.etapas[0])?.label || f.etapas[0]) : `${f.etapas.length} etapas`);
  if (f.estado_geo.length > 1) t.push(`${f.estado_geo.length} estados`);
  if (f.ciudad.trim()) t.push(f.ciudad.trim());
  if (f.rating_min) t.push(`${f.rating_min}★ o más`);
  if (f.owner === 'mias') t.push('míos'); else if (f.owner === 'sin_asignar') t.push('sin dueño');
  if (f.nunca_llamados) t.push('nunca tocados');
  if (f.sin_tocar_dias) t.push(`sin contacto ${Number(f.sin_tocar_dias) >= 30 ? `${Math.round(Number(f.sin_tocar_dias) / 30)} ${Number(f.sin_tocar_dias) >= 60 ? 'meses' : 'mes'}` : `${f.sin_tocar_dias} días`}`);
  return t.join(' · ');
}

function Bloque({ titulo, children, movil }: { titulo: string; children: any; movil?: boolean }) {
  return (
    <div style={{ marginBottom: movil ? 26 : 20 }}>
      {/* En el teléfono sin número: sólo tres de los nueve bloques lo llevaban
          y la cuenta salteada parecía que faltaban pasos. */}
      <span style={movil ? rotMovil : rot}>{movil ? titulo.replace(/^\d+ · /, '') : titulo}</span>
      {children}
    </div>
  );
}

/** Botones que se quedan marcados. Para elegir de una lista corta y conocida. */
function Opciones({ valor, onCambio, opts, movil = false, cols = 2 }: { valor: string; onCambio: (v: any) => void; opts: { v: string; l: string; sub?: string }[]; movil?: boolean; cols?: number }) {
  return (
    <div style={movil ? rejilla(cols) : { display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opts.map(o => {
        const on = valor === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onCambio(o.v)} title={o.sub} aria-pressed={on}
            style={estiloChip(on, movil, false, false, movil)}>{o.l}</button>
        );
      })}
    </div>
  );
}

/** Varios a la vez, con su número al lado: «joyería (2,321)». */
function Chips({ valores, onCambio, opts, vacio, movil = false }: { valores: string[]; onCambio: (v: string[]) => void; opts: { v: string; l: string; n?: number }[]; vacio: string; movil?: boolean }) {
  const [ver, setVer] = useState(false);
  const mostrar = ver ? opts : opts.slice(0, 12);
  if (!opts.length) return vacio ? <p style={{ fontSize: movil ? 14 : 12, color: '#a5a2af', margin: 0 }}>{vacio}</p> : null;
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: movil ? 8 : 6 }}>
        {mostrar.map(o => {
          const on = valores.includes(o.v);
          return (
            <button key={o.v} type="button" aria-pressed={on}
              onClick={() => onCambio(on ? valores.filter(x => x !== o.v) : [...valores, o.v])} title={o.l !== o.v ? o.v : undefined}
              style={estiloChip(on, movil, true)}>
              {o.l}{o.n != null && <span style={{ fontWeight: 600, color: movil ? (on ? '#5B4BD6' : '#6B7280') : on ? P.violeta : '#a5a2af' }}> {o.n.toLocaleString('es-MX')}</span>}
            </button>
          );
        })}
      </div>
      {opts.length > 12 && (
        <button type="button" onClick={() => setVer(v => !v)}
          style={{ marginTop: movil ? 8 : 7, border: 'none', background: 'none', color: P.violetaTinta, fontFamily: 'inherit', fontSize: movil ? 14 : 12, fontWeight: 700, cursor: 'pointer', padding: movil ? '0 4px' : 0, minHeight: movil ? 44 : undefined, minWidth: movil ? 44 : undefined }}>
          {ver ? 'Ver menos' : `Ver los ${opts.length}`}
        </button>
      )}
    </>
  );
}

function Palomita({ on, onCambio, texto, porque, movil = false }: { on: boolean; onCambio: (v: boolean) => void; texto: string; porque?: string; movil?: boolean }) {
  /* En el teléfono el renglón ENTERO es el blanco (≥ 48 px de alto) y la
     palomita crece a 22 px: nadie atina a un cuadrito de 15. */
  return (
    <label style={{ display: 'flex', gap: movil ? 12 : 9, alignItems: movil ? 'center' : 'flex-start', cursor: 'pointer', marginBottom: movil ? 8 : 9, minHeight: movil ? 48 : undefined, padding: movil ? '4px 0' : undefined }}>
      <input type="checkbox" checked={on} onChange={e => onCambio(e.target.checked)} style={{ marginTop: movil ? 0 : 2, accentColor: P.violetaTinta, width: movil ? 22 : 15, height: movil ? 22 : 15, flexShrink: 0, cursor: 'pointer' }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: movil ? 15 : 12.5, fontWeight: 600, color: movil ? '#374151' : '#3a3a44' }}>{texto}</span>
        {porque && <span style={{ display: 'block', fontSize: movil ? 14 : 11, color: movil ? '#6b7280' : '#a5a2af', lineHeight: 1.45, marginTop: movil ? 2 : 0 }}>{porque}</span>}
      </span>
    </label>
  );
}

export default function ArmadorLista({ etapas, onListo, onCerrar }: {
  etapas: { id: string; label: string }[];
  onListo: (l: { titulo: string; qs: string; total?: number }) => void;
  onCerrar: () => void;
}) {
  const esMovil = useIsMobile();
  const [f, setF] = useState<Filtros>(FILTROS_INICIALES);
  const [cat, setCat] = useState<Cat | null>(null);
  const [previa, setPrevia] = useState<{ filas: any[]; total: number; descartados: any } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  /* «Reintentar» del error: sube el contador y vuelve a pedir el conteo con
     los mismos filtros, sin tener que ir a «Ajustar filtros» a mover algo. */
  const [intento, setIntento] = useState(0);
  const previaRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF(x => ({ ...x, [k]: v }));
  const qs = useMemo(() => qsDeFiltros(f), [f]);
  const titulo = useMemo(() => tituloDeFiltros(f), [f]);
  const conAbm = f.fuente === 'abm' || f.fuente === 'ambas';
  const conCrm = f.fuente === 'crm' || f.fuente === 'ambas';

  useEffect(() => {
    fetch('/api/crm/telefonia/candidatos?catalogo=1', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j?.ok) setCat(j); }).catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true); setError('');
    const t = setTimeout(() => {
      fetch(`/api/crm/telefonia/candidatos?${qs}&limit=40`, { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (!vivo) return;
          if (!j?.ok) { setError(j?.error || 'No se pudo contar'); setPrevia({ filas: [], total: 0, descartados: {} }); return; }
          setPrevia({ filas: j.conversaciones || [], total: Number(j.total_filtrado || 0), descartados: j.descartados || {} });
        })
        .catch(e => { if (vivo) setError(String(e?.message || e)); })
        .finally(() => { if (vivo) setCargando(false); });
    }, 380);   // el debounce evita una consulta por cada tecla del campo de ciudad
    return () => { vivo = false; clearTimeout(t); };
  }, [qs, intento]);

  const n = previa?.total ?? 0;
  const girosOpts = conAbm
    ? (cat?.giros_abm || []).map(g => ({ v: g.giro, l: g.giro, n: f.canal === 'wa' || f.canal === 'wa_verificado' ? g.con_wa : g.n }))
    /* En el teléfono un giro larguísimo («Uniformes escolares y empresariales
       de temporada») partía el chip en dos renglones a todo lo ancho. Se queda
       con su primera parte —la que ya dice qué es— sin puntos suspensivos, y el
       nombre completo va en el `title`. */
    : (cat?.giros_crm || []).map(g => ({ v: g.giro, l: esMovil ? giroCorto(g.giro) : g.giro.length > 26 ? g.giro.slice(0, 26) + '…' : g.giro, n: g.n }));

  const m = esMovil;
  // Atajos de tamaño: en el teléfono la ayuda es texto de cuerpo (14 px) y las etiquetas no bajan de 13.
  const tAyuda = m ? 14 : 11;
  const tEtiq = m ? 13 : 11.5;
  const tEtiqColor = m ? '#374151' : '#6b7280';
  const tSub = m ? 15 : 12.5;
  const inpX = m ? inpMovil : inp;
  const resumen = useMemo(() => filtrosEnPalabras(f, etapas), [f, etapas]);
  /* «Ver la lista» deja el bloque de los nombres PEGADO arriba de la columna
     que scrollea (no a media pantalla, que es lo que hacía scrollIntoView con
     el diálogo fijo alrededor), y una vez ahí el mismo botón se vuelve
     «Ajustar filtros» para regresar arriba sin subir 2,000 px a mano. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [enLista, setEnLista] = useState(false);
  const irALista = () => {
    const c = scrollRef.current, pv = previaRef.current; if (!c || !pv) return;
    c.scrollTo({ top: c.scrollTop + pv.getBoundingClientRect().top - c.getBoundingClientRect().top, behavior: 'smooth' });
  };
  /* ¿Ya estás viendo la lista? = el bloque de los nombres ocupa la mitad de
     arriba de la columna. Se mide con la posición REAL del bloque y no sólo al
     hacer scroll: cambiar la fuente o abrir/cerrar bloques (Etapa, Dónde están…)
     cambia el alto de los filtros sin que haya scroll, y la cabecera se quedaba
     diciendo «A quién vas a llamar» con el bloque 1 a la vista.
     Ya no se acomoda sola al soltar: brincaba a media lectura el párrafo de
     «Siempre se quitan solos…». Bajar a la lista es «Ver la lista». */
  const medirLista = () => {
    const c = scrollRef.current, pv = previaRef.current; if (!c || !pv) return;
    const y = pv.getBoundingClientRect().top - c.getBoundingClientRect().top;
    setEnLista(y < c.clientHeight * 0.5);
  };
  useEffect(() => { if (m) medirLista(); }, [m, f, previa, cat, cargando, error]);
  useEffect(() => {
    const c = scrollRef.current; if (!m || !c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => medirLista());
    ro.observe(c); for (const h of Array.from(c.children)) ro.observe(h);
    return () => ro.disconnect();
  }, [m]);
  const irAFiltros = () => { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };
  /* ══ BAJANDO, LA LISTA SE ACOMODA ARRIBA (23-sep, ronda 5) ══════════════
     Quien baja a mano hasta los nombres se quedaba con la lista a media
     pantalla: la mitad de arriba eran los últimos filtros y sólo cabían tres
     candidatos y medio. Ahora, si al soltar BAJANDO el bloque de los nombres
     quedó en la mitad de arriba, se sube solo hasta el «82 para llamar».
     Sólo bajando: subir para revisar un filtro nunca se pelea contigo. Y el
     párrafo de «Siempre se quitan solos…», que era lo que brincaba a media
     lectura cuando esto existía antes, ya vive al pie de la lista. */
  const ultimoTop = useRef(0);
  const bajando = useRef(false);
  const dedo = useRef(false);
  const tAcomodo = useRef<any>(null);
  useEffect(() => () => { clearTimeout(tAcomodo.current); }, []);
  const acomodar = () => {
    const c = scrollRef.current, pv = previaRef.current; if (!c || !pv || dedo.current || !bajando.current) return;
    const y = pv.getBoundingClientRect().top - c.getBoundingClientRect().top;
    if (!(y > 2 && y < c.clientHeight * 0.5)) return;
    /* Animación propia de 220 ms y no `behavior: 'smooth'`: la del navegador
       tarda distinto en cada teléfono (hasta medio segundo) y se sentía como
       si la pantalla siguiera sola. Si el dedo vuelve a tocar, se suelta. */
    const desde = c.scrollTop, t0 = performance.now();
    const paso = (t: number) => {
      if (dedo.current) return;
      const k = Math.min(1, (t - t0) / 220);
      c.scrollTop = desde + y * (1 - Math.pow(1 - k, 3));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const alScroll = () => {
    const c = scrollRef.current; if (!c) return;
    bajando.current = c.scrollTop > ultimoTop.current + 0.5 ? true : c.scrollTop < ultimoTop.current - 0.5 ? false : bajando.current;
    ultimoTop.current = c.scrollTop;
    medirLista();
    clearTimeout(tAcomodo.current);
    tAcomodo.current = setTimeout(acomodar, 120);   // «soltó»: 120 ms sin moverse
  };

  /* «Empezar de cero» en el teléfono queda junto al título y se toca sin
     querer: borra todo, pero durante 5 s la barra del pulgar ofrece «Deshacer». */
  const hayFiltros = useMemo(() => JSON.stringify(f) !== JSON.stringify(FILTROS_INICIALES), [f]);
  const [antes, setAntes] = useState<Filtros | null>(null);
  const tDeshacer = useRef<any>(null);
  useEffect(() => () => { clearTimeout(tDeshacer.current); }, []);
  const empezarDeCero = () => {
    if (m && hayFiltros) {
      setAntes(f); clearTimeout(tDeshacer.current);
      tDeshacer.current = setTimeout(() => setAntes(null), 5000);
    }
    setF(FILTROS_INICIALES);
  };
  /* Cuál versión del renglón de estado cabe en un renglón (0 = completa). */
  const estadoRef = useRef<HTMLDivElement>(null);
  const [nivel, setNivel] = useState(0);
  const medirEstado = () => {
    const c = estadoRef.current; if (!c) return;
    const ancho = c.clientWidth;
    const ms = Array.from(c.querySelectorAll<HTMLElement>('[data-medida]'));
    const i = ms.findIndex(el => el.scrollWidth <= ancho + 0.5);
    setNivel(i < 0 ? ms.length - 1 : i);
  };
  useLayoutEffect(() => { if (m) medirEstado(); }, [m, resumen, n, cargando, antes, enLista]);
  useEffect(() => {
    const c = estadoRef.current; if (!m || !c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => medirEstado());
    ro.observe(c);
    return () => ro.disconnect();
  }, [m, antes, enLista]);
  const deshacer = () => { if (antes) setF(antes); setAntes(null); clearTimeout(tDeshacer.current); };

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(12,11,18,.5)', zIndex: 960 }} />
      <div role="dialog" aria-label="Nueva llamada inteligente" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: m ? '100%' : 'min(1060px, 95vw)', height: m ? '100%' : undefined, maxHeight: m ? '100%' : '92vh',
        display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: m ? 0 : 20,
        zIndex: 961, boxShadow: '0 24px 70px rgba(12,11,18,.34)', overflow: 'hidden',
      }}>
        {/* En el teléfono: el encabezado común del flujo de llamadas (guía de
            continuidad, 24-sep-2026) — el mismo que la cabina y la sala. Fila
            de 56 px, salir SIEMPRE a la izquierda (✕ de 20 px en 44×44), título
            negro de 17 px que nunca se corta y, a la derecha, un solo botón de
            texto morado: «Empezar de cero» en los filtros (si hay algo que
            borrar) o «Cambiar lista» ya en la lista. La fila lleva 4 px por
            lado y los botones 12 de padding: la ✕ y el texto de la derecha
            caen los dos en el canal de 16 px. */}
        <div style={m
          ? { padding: 'max(6px, env(safe-area-inset-top)) 4px 6px 4px', background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 4, minHeight: 56, boxSizing: 'border-box', flexShrink: 0 }
          : { padding: '18px 24px', borderBottom: '1px solid #f0eff3', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {m && (
            <button type="button" onClick={onCerrar} aria-label="Cerrar"
              style={{ width: 44, height: 44, border: 'none', background: 'none', padding: 0, color: '#6B7280', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoX size={20} />
            </button>
          )}
          {/* Ya en la lista, la cabecera dice que estás revisando a quién vas a
              llamar, no que sigues armándola. El cuántos ya lo dice el número grande. */}
          <b style={m
            ? { fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: '#111827', flex: 1, minWidth: 0, lineHeight: 1.25, overflowWrap: 'anywhere', minHeight: 44, display: 'flex', alignItems: 'center' }
            : { fontSize: 18, letterSpacing: '-0.02em', flex: 1, minWidth: 0 }}>
            {!m ? 'Nueva llamada inteligente' : enLista ? 'A quién vas a llamar' : 'Armar la lista'}
          </b>
          {/* En el teléfono sólo aparece cuando hay algo que borrar: deshabilitado
              quedaba a 1.9:1 de contraste y parecía roto. */}
          {(!m || (!enLista && hayFiltros)) && (
            <button type="button" onClick={empezarDeCero}
              style={m
                ? { border: 'none', background: 'none', color: P.violetaTinta, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44, padding: '0 12px', flexShrink: 0 }
                : { border: 'none', background: 'none', color: '#6b7280', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Empezar de cero
            </button>
          )}
          {/* «Cambiar lista» vive aquí arriba en todo el flujo (armador, cabina):
              la misma intención en un solo lugar, nunca en la barra del pulgar. */}
          {m && enLista && (
            <button type="button" onClick={irAFiltros}
              style={{ border: 'none', background: 'none', color: P.violetaTinta, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44, padding: '0 12px', flexShrink: 0 }}>
              Cambiar lista
            </button>
          )}
        </div>

        {/* En el teléfono es UNA sola columna que scrollea completa: filtros y
            después a quién vas a llamar. Partida en dos, la vista previa se
            quedaba en una rendija de 30 px abajo de los filtros. */}
        {/* scroll-padding-bottom de 56: un chip o campo que se lleva a la vista
            (scrollIntoView, foco) queda con aire arriba de la barra del pulgar
            y nunca pegado a «Ver la lista». Con 120 lo empujaba hasta la
            cabecera, pegado a «Cerrar». */}
        <div ref={scrollRef} onScroll={m ? alScroll : undefined}
          onTouchStart={m ? () => { dedo.current = true; clearTimeout(tAcomodo.current); } : undefined}
          onTouchEnd={m ? () => { dedo.current = false; clearTimeout(tAcomodo.current); tAcomodo.current = setTimeout(acomodar, 120); } : undefined}
          onTouchCancel={m ? () => { dedo.current = false; } : undefined} style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: m ? 'column' : 'row', overflowY: m ? 'auto' : undefined, WebkitOverflowScrolling: 'touch' as any, scrollPaddingTop: m ? 24 : undefined, scrollPaddingBottom: m ? 56 : undefined, overscrollBehavior: m ? 'contain' : undefined }}>
          {/* Orilla de arriba: 24 px (eran 10) que se desvanecen y no se pueden tocar. Un
              chip a medias bajo la cabecera ya no queda pegado a «Cerrar» o
              «Empezar de cero»: el dedo que apunta a la barra cae aquí. */}
          {m && <div aria-hidden style={{ position: 'sticky', top: 0, height: 24, marginBottom: -24, flexShrink: 0, zIndex: 2, background: enLista ? 'linear-gradient(#fafafb, rgba(250,250,251,0))' : 'linear-gradient(#fff, rgba(255,255,255,0))' }} />}
          {/* ── Los filtros ── */}
          <div style={{ flex: m ? 'none' : '0 0 420px', padding: m ? '18px 16px 8px' : 22, borderRight: m ? 'none' : '1px solid #f0eff3', overflowY: m ? 'visible' : 'auto' }}>

            <Bloque movil={m} titulo="1 · De dónde salen">
              <Opciones movil={m} cols={3} valor={f.fuente} onCambio={v => set('fuente', v)} opts={[
                { v: 'crm', l: 'Mis leads', sub: 'Los contactos del CRM' },
                { v: 'abm', l: 'Prospección en frío', sub: 'Las cuentas del ABM' },
                { v: 'ambas', l: 'Las dos' },
              ]} />
            </Bloque>

            <Bloque movil={m} titulo="Por dónde se les puede hablar">
              <Opciones movil={m} valor={f.canal} onCambio={v => set('canal', v)} opts={[
                { v: '', l: 'Como sea' },
                { v: 'wa_verificado', l: 'WhatsApp verificado', sub: 'Ya comprobamos que ese número recibe WhatsApp' },
                { v: 'wa', l: 'Tienen WhatsApp' },
                { v: 'solo_tel', l: 'Teléfono sin WhatsApp' },
              ]} />
              {f.canal === 'wa_verificado' && (
                <p style={{ fontSize: m ? 14 : 11.5, color: '#6b7280', margin: '7px 0 0', lineHeight: 1.5 }}>
                  Si no contesta, el seguimiento le llega por WhatsApp al mismo número — no se pierde el intento.
                </p>
              )}
            </Bloque>

            <Bloque movil={m} titulo={`2 · Giro${f.giros.length ? ` · ${f.giros.length} ${f.giros.length === 1 ? 'elegido' : 'elegidos'}` : ''}`}>
              <Chips movil={m} valores={f.giros} onCambio={v => set('giros', v)} opts={girosOpts}
                vacio={conAbm ? 'Cargando los giros…' : 'Tus contactos todavía no tienen giro capturado.'} />
            </Bloque>

            <Bloque movil={m} titulo="Tamaño del negocio">
              <div style={{ display: 'flex', gap: m ? 10 : 8 }}>
                <label style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: tEtiq, color: tEtiqColor, display: 'block', marginBottom: 4 }}>Desde</span>
                  <input type="number" inputMode="numeric" min={0} placeholder="tiendas" value={f.suc_min} onChange={e => set('suc_min', e.target.value)} style={inpX} />
                </label>
                <label style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: tEtiq, color: tEtiqColor, display: 'block', marginBottom: 4 }}>Hasta</span>
                  <input type="number" inputMode="numeric" min={0} placeholder="sin tope" value={f.suc_max} onChange={e => set('suc_max', e.target.value)} style={inpX} />
                </label>
              </div>
              {/* «Desde 3» y el atajo dicen lo mismo: 3 cuenta. Por eso «3 o más»
                  y no «Más de 3», que prendía encendido con 3 escrito a mano. */}
              <div style={m ? { ...rejilla(3), marginTop: 10 } : { display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                {[['3', '3 o más'], ['5', '5 o más'], ['10', '10 o más']].map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={f.suc_min === v} onClick={() => set('suc_min', f.suc_min === v ? '' : v)}
                    style={estiloChip(f.suc_min === v, m, true, true, m)}>{l}</button>
                ))}
              </div>
            </Bloque>

            {conCrm && etapas.length > 0 && (
              <Bloque movil={m} titulo="Etapa del ciclo de vida">
                <Chips movil={m} valores={f.etapas} onCambio={v => set('etapas', v)}
                  opts={etapas.map(e => ({ v: e.id, l: e.label }))} vacio="" />
              </Bloque>
            )}

            {conAbm && (
              <>
                <Bloque movil={m} titulo="Dónde están">
                  <Chips movil={m} valores={f.estado_geo} onCambio={v => set('estado_geo', v)}
                    opts={(cat?.estados || []).map(e => ({ v: e.estado, l: e.estado, n: e.n }))} vacio="Cargando…" />
                  <input placeholder="o escribe una ciudad" value={f.ciudad} onChange={e => set('ciudad', e.target.value)} style={{ ...inpX, marginTop: m ? 10 : 8 }} />
                </Bloque>

                <Bloque movil={m} titulo="Qué tan bien se ven">
                  <div style={{ display: 'flex', gap: m ? 10 : 8 }}>
                    <label style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: tEtiq, color: tEtiqColor, display: 'block', marginBottom: 4 }}>Estrellas mín.</span>
                      <input type="number" inputMode="decimal" step="0.1" min={0} max={5} placeholder={m ? 'ej. 4.0' : '4.0'} value={f.rating_min} onChange={e => set('rating_min', e.target.value)} style={inpX} />
                    </label>
                    <label style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: tEtiq, color: tEtiqColor, display: 'block', marginBottom: 4 }}>Reseñas mín.</span>
                      <input type="number" inputMode="numeric" min={0} placeholder={m ? 'ej. 20' : '20'} value={f.resenas_min} onChange={e => set('resenas_min', e.target.value)} style={inpX} />
                    </label>
                  </div>
                  {/* Una tienda de 5.0 con dos reseñas no es una buena tienda:
                      es una tienda sin reseñas. Por eso las dos juntas. */}
                  <p style={{ fontSize: tAyuda, color: m ? '#6b7280' : '#a5a2af', margin: '6px 0 0', lineHeight: 1.45 }}>
                    Un 5.0 con dos reseñas no dice nada. Las dos cosas juntas sí.
                  </p>
                </Bloque>
              </>
            )}

            {conCrm && (
              <Bloque movil={m} titulo="De quién son">
                <Opciones movil={m} cols={3} valor={f.owner} onCambio={v => set('owner', v)} opts={[
                  { v: '', l: 'De cualquiera' }, { v: 'mias', l: 'Míos' }, { v: 'sin_asignar', l: 'Sin dueño' },
                ]} />
              </Bloque>
            )}

            <Bloque movil={m} titulo="3 · A quién NO llamar">
              <div style={{ marginBottom: m ? 14 : 11 }}>
                <span style={{ fontSize: tSub, fontWeight: 600, color: m ? '#374151' : '#3a3a44', display: 'block' }}>Ya les marqué sin que contesten</span>
                <div style={m ? { ...rejilla(2), marginTop: 8 } : { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[['', 'No los quites'], ['2', '2 veces o más'], ['3', '3 veces o más'], ['5', '5 veces o más']].map(([v, l]) => (
                    <button key={v || 'no'} type="button" aria-pressed={f.quemados === v} onClick={() => set('quemados', v)}
                      style={estiloChip(f.quemados === v, m, false, true, m)}>{l}</button>
                  ))}
                </div>
                {previa?.descartados?.quemados > 0 && f.quemados && (
                  <span style={{ fontSize: tAyuda, color: '#9a6a10', display: 'block', marginTop: 5 }}>
                    Se quitan {previa?.descartados?.quemados} números por esta regla.
                  </span>
                )}
              </div>
              <Palomita movil={m} on={f.excluir_con_accion} onCambio={v => set('excluir_con_accion', v)}
                texto="Los que ya tuvieron una acción" porque="Reunión, seguimiento, oportunidad o descalificado: con ellos ya hay un proceso en marcha." />
              {previa?.descartados?.con_accion > 0 && f.excluir_con_accion && (
                <span style={{ fontSize: tAyuda, color: '#9a6a10', display: 'block', margin: m ? '-2px 0 10px 34px' : '-4px 0 8px' }}>
                  Se quitan {previa?.descartados?.con_accion} por esta regla.
                </span>
              )}
              <Palomita movil={m} on={f.excluir_clientes} onCambio={v => set('excluir_clientes', v)}
                texto="Los que ya son clientes" porque="Venderle otra vez a quien ya compró se hace por otro camino." />
              <Palomita movil={m} on={f.excluir_con_reunion} onCambio={v => set('excluir_con_reunion', v)}
                texto="Los que ya tienen cita próxima" porque="Llamarle a quien vas a ver el martes gasta el contacto." />
              {conAbm && (
                <Palomita movil={m} on={f.excluir_en_cadencia} onCambio={v => set('excluir_en_cadencia', v)}
                  texto="Los que están en cadencia del ABM" porque="Ya les está escribiendo el correo automático hoy." />
              )}
              <Palomita movil={m} on={f.nunca_llamados} onCambio={v => set('nunca_llamados', v)}
                texto="Solo los que nunca he tocado" porque="Para estrenar una lista sin repetir a nadie." />
              <div style={{ marginTop: m ? 10 : 4 }}>
                <span style={{ fontSize: tSub, fontWeight: 600, color: m ? '#374151' : '#3a3a44', display: 'block' }}>Sin contacto desde hace</span>
                <div style={m ? { ...rejilla(4), marginTop: 8 } : { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[['', 'Da igual'], ['15', '15 días'], ['30', '1 mes'], ['90', '3 meses']].map(([v, l]) => (
                    <button key={v || 'no'} type="button" aria-pressed={f.sin_tocar_dias === v} onClick={() => set('sin_tocar_dias', v)}
                      style={estiloChip(f.sin_tocar_dias === v, m, false, true, m)}>{l}</button>
                  ))}
                </div>
              </div>
            </Bloque>

            {conAbm && (
              <Bloque movil={m} titulo="Por dónde empezar">
                {/* En el teléfono, una opción por renglón: con 3 en rejilla de
                    2, «Los mejor calificados» quedaba sola en su renglón. */}
                <Opciones movil={m} cols={1} valor={f.orden} onCambio={v => set('orden', v)} opts={[
                  { v: 'puntaje', l: 'Los que mejor encajan' },
                  { v: 'sucursales', l: 'Los más grandes' },
                  { v: 'rating', l: 'Los mejor calificados' },
                ]} />
                <p style={{ fontSize: tAyuda, color: m ? '#6b7280' : '#a5a2af', margin: '6px 0 0', lineHeight: 1.45 }}>
                  La jornada marca en este orden, así que si no da tiempo de terminarla, los primeros son los que más valían.
                </p>
              </Bloque>
            )}

            {/* En el teléfono esta nota vive al pie de la lista (ronda 5): aquí
                salía justo antes del conteo y se leía dos veces en el recorrido. */}
            {!m && (
              <p style={{ fontSize: 11.5, color: '#a5a2af', lineHeight: 1.55, margin: 0 }}>
                Siempre se quitan solos, elijas lo que elijas: los que no tienen teléfono,
                los marcados «no llamar», los que se descalificaron alguna vez y los que
                están en la lista de bloqueo.
              </p>
            )}
          </div>

          {/* ── A quién vas a llamar ── */}
          {/* En el teléfono mide al menos el alto de la columna: así «Ver la
              lista» siempre puede dejarla arriba aunque vengan pocos nombres. */}
          <div ref={previaRef} style={{ flex: m ? 'none' : 1, minWidth: 0, minHeight: m ? '100%' : undefined, padding: m ? '24px 16px 24px' : 22, overflowY: m ? 'visible' : 'auto', background: '#fafafb', borderTop: m ? '1px solid #f0eff3' : undefined, scrollMarginTop: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 4 }}>
              <b style={{ fontSize: 34, letterSpacing: '-0.03em', color: n ? P.violetaTinta : '#a5a2af', fontVariantNumeric: 'tabular-nums' }}>
                {cargando ? '…' : m && error ? '—' : n.toLocaleString('es-MX')}
              </b>
              <span style={{ fontSize: m ? 15 : 13, color: '#6b7280' }}>{n === 1 ? 'para llamar' : 'para llamar'}</span>
            </div>
            {/* En el teléfono dice TODOS los filtros puestos, no sólo la fuente:
                es el resumen de qué incluye la lista antes de marcar. */}
            {/* Lo que tranquiliza antes de apretar «Llamar a estos N» va pegado
                al número, no al fondo donde casi nadie llega. */}
            {/* Si la vista previa es sólo una parte, se dice aquí arriba («ves 24
                de 82») y no hasta el final, para que no parezca que se cortó. */}
            {m && n > 0 && !cargando && (previa?.filas || []).length > 0 && (
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.45, marginBottom: 2 }}>
                {n > (previa?.filas || []).length
                  ? <><b>Los primeros {(previa?.filas || []).length} de {n.toLocaleString('es-MX')}</b>, en el orden en que se marcan.</>
                  : <>En el orden en que se marcan.</>}
              </div>
            )}
            {titulo && <div style={{ fontSize: m ? 14 : 12.5, color: '#6b7280', marginBottom: m ? 12 : 12, lineHeight: 1.45 }}>{m ? resumen : titulo}</div>}

            {error && (
              <div role="alert" style={{ background: '#FDF0EE', border: '1px solid #f0c4bd', color: '#C0554E', borderRadius: 9, padding: '9px 12px', fontSize: m ? 14 : 12.5, marginBottom: 12, display: 'flex', flexDirection: m ? 'column' : 'row', alignItems: m ? 'stretch' : 'center', gap: m ? 10 : 10 }}>
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>{error}</span>
                {/* Vuelve a pedir el conteo con los mismos filtros. */}
                <button type="button" onClick={() => setIntento(x => x + 1)} disabled={cargando}
                  style={{ border: '1.5px solid #C0554E', background: '#fff', color: '#C0554E', borderRadius: m ? 12 : 9, minHeight: m ? 44 : undefined, padding: m ? '0 16px' : '5px 12px', fontSize: m ? 15 : 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: cargando ? 'default' : 'pointer', flexShrink: 0 }}>
                  {cargando ? 'Contando…' : 'Reintentar'}
                </button>
              </div>
            )}
            {!cargando && !n && !error && (
              <div style={{ fontSize: m ? 14 : 13, color: '#6b7280', lineHeight: 1.6 }}>
                Con esos filtros no queda nadie. Prueba quitando el giro o bajando el número de tiendas.
              </div>
            )}
            {n > 500 && (
              /* El tope real de una jornada. Decirlo aquí y no al crear la sesión
                 evita armar una lista de nueve mil y descubrir el corte después. */
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '9px 12px', fontSize: m ? 14 : 12, marginBottom: 12, lineHeight: 1.5 }}>
                Una jornada marca hasta <b>500</b>. Se van a tomar los primeros 500 en el orden que elegiste; el resto queda para la siguiente.
              </div>
            )}

            <div style={m
              /* En el teléfono es una LISTA, no una pila de botones: renglones
                 con línea divisoria dentro de una sola hoja. Con borde y fondo
                 blanco cada uno se veía igual que los chips y se tocaba
                 esperando algo que no pasa. */
              ? { display: (previa?.filas || []).length ? 'block' : 'none', background: '#fff', border: '1px solid #f0eff3', borderRadius: 12, padding: '0 14px', minWidth: 0 }
              : { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
              {(previa?.filas || []).map((c: any, i: number) => m ? (
                /* Tres renglones: el nombre completo (sin cortar), a qué número
                   y a qué zona se va a marcar, y tiendas · giro · WhatsApp. */
                <div key={c.id} style={{ padding: '11px 0', borderTop: i ? '1px solid #f0eff3' : 'none', minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                    {c.contacto?.nombre || telefonoLegible(c.telefono)}
                  </div>
                  {(c.telefono || c.ciudad || c.estado_geo) && (
                    <div style={{ marginTop: 3, fontSize: 14, color: '#374151', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                      {c.telefono && <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{telefonoLegible(c.telefono)}</span>}
                      {(c.ciudad || c.estado_geo) && <span style={{ color: '#6b7280' }}>{c.telefono ? ' · ' : ''}{[c.ciudad, c.estado_geo].filter(Boolean).join(', ')}</span>}
                    </div>
                  )}
                  {/* «WhatsApp» es un dato, no un botón: texto verde en el mismo
                      renglón, separado con «·», sin pastilla (guía §6). El verde
                      de texto es #17775A (5.4:1 sobre blanco); #1E8A63 queda
                      sólo para los puntos, porque como texto da 4.31:1. */}
                  <div style={{ marginTop: 3, fontSize: 14, color: '#6B7280', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                    {(() => {
                      const datos = [c.sucursales ? `${c.sucursales} ${c.sucursales === 1 ? 'tienda' : 'tiendas'}` : '', c.giro || c.contacto?.lifecycle_stage || ''].filter(Boolean).join(' · ');
                      return <>
                        {datos}
                        {c.tiene_wa && <>{datos ? ' · ' : ''}<span style={{ fontSize: 13, fontWeight: 700, color: '#17775A', whiteSpace: 'nowrap' }}>WhatsApp</span></>}
                      </>;
                    })()}
                  </div>
                </div>
              ) : (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 9, padding: '8px 11px', display: 'flex', gap: 9, alignItems: 'center', minWidth: 0 }}>
                  <b style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.contacto?.nombre || c.telefono}
                    {c.sucursales ? <span style={{ fontWeight: 500, color: '#999' }}> · {c.sucursales} {c.sucursales === 1 ? 'tienda' : 'tiendas'}</span> : null}
                  </b>
                  {c.tiene_wa && <span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 999, padding: '2px 7px', background: '#EAF8F2', color: '#1E8A63' }}>WA</span>}
                  <span style={{ fontSize: 11, color: '#999', flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.giro || c.contacto?.lifecycle_stage || ''}</span>
                </div>
              ))}
              {/* El último renglón de la misma hoja, que no es botón: cuántos
                  faltan y dónde se ven todos. Quitar a alguien vive en la
                  cabina, que es la que tiene la lista completa. */}
              {m && n > (previa?.filas || []).length && (
                <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.5, padding: '14px 0', borderTop: '1px solid #f0eff3' }}>
                  <b style={{ color: '#374151' }}>+ {(n - (previa?.filas || []).length).toLocaleString('es-MX')} más.</b> En la siguiente pantalla ves a los {n.toLocaleString('es-MX')} y quitas a quien no quieras antes del primer timbre.
                </div>
              )}
            </div>
            {!m && n > (previa?.filas || []).length && (
              <div style={{ fontSize: 11.5, color: '#a5a2af', marginTop: 9, lineHeight: 1.5 }}>
                y {(n - (previa?.filas || []).length).toLocaleString('es-MX')} más. Vas a poder revisarlos todos antes de marcar.
              </div>
            )}
            {/* Una sola nota corta, al pie, junto a «Y N más». */}
            {m && (
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5, margin: '12px 0 0' }}>
                Siempre se quitan solos: los que no tienen teléfono, los «no llamar», los descalificados y los bloqueados.
              </p>
            )}
          </div>
          {/* Orilla de abajo: 24 px que se desvanecen y no se pueden tocar. Un
              chip medio escondido bajo el borde ya no queda pegado a «Ver la
              lista» ni a «Llamar a estos N»: el dedo que apunta abajo cae aquí. */}
          {m && <div aria-hidden style={{ position: 'sticky', bottom: 0, height: 24, marginTop: -24, flexShrink: 0, zIndex: 2, background: enLista ? 'linear-gradient(rgba(250,250,251,0), #fafafb)' : 'linear-gradient(rgba(255,255,255,0), #fff)' }} />}
        </div>

        {/* La barra del pulgar. En el teléfono: arriba un renglón con CUÁNTOS
            quedan y con qué filtros —cambia (y parpadea) en cuanto tocas un
            chip, sin tener que bajar 2,800 px a ver el número grande—; abajo
            «Ver la lista» (o «Ajustar filtros» si ya estás en ella) y «Llamar a
            estos N» a lo ancho, a 48 px. Cancelar ya vive en la × de arriba. */}
        {/* Abajo, 16 px mínimo (eran 10): en los Android sin muesca los botones
            quedaban casi en la orilla curva de la pantalla. Con muesca manda
            el safe-area, como antes. */}
        {/* 24-sep: la barra común del flujo (guía §2): 52 px, radio 12, 75 px
            de alto sin muesca, igual que la de la cabina y la de la sala. */}
        <div style={m
          ? { padding: '10px 16px max(12px, calc(10px + env(safe-area-inset-bottom)))', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, flexShrink: 0, background: '#fff', boxShadow: '0 -4px 14px rgba(12,11,18,.06)' }
          : { padding: '14px 22px', borderTop: '1px solid #f0eff3', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, background: '#fff' }}>
          {/* Recién borrados los filtros: 5 s para deshacerlo, en el mismo
              lugar donde el pulgar ya está. */}
          {m && antes && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, minHeight: 44, margin: '-8px 0 0', fontSize: 14, color: '#6B7280' }}>
              <span style={{ flex: 1, minWidth: 0 }}>Quitaste todos los filtros.</span>
              <button type="button" onClick={deshacer}
                style={{ border: 'none', background: 'none', color: P.violetaTinta, minHeight: 44, padding: '0 12px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                Deshacer
              </button>
            </div>
          )}
          {/* Sin tope de renglones: el número va primero y nunca se corta, y los
              filtros caben completos —el último que tocaste era justo el que se
              iba al «…» en 360 y 390—; con muchos filtros, salta de renglón.
              Ya en la lista no se repite: el número grande está a la vista. */}
          {/* 24-sep, continuidad: el renglón de estado es UNO solo, en todos los
              anchos y con cualquier filtro, para que la barra no cambie de alto
              (107 px con «Mis leads», 126 px a 360 con tres filtros). Nada se
              corta con «…»: si el resumen completo no cabe, pasa a «Prospección
              y 3 filtros más» y, si tampoco, a «4 filtros». El resumen entero
              sigue arriba de la lista. El número va primero y nunca se corta. */}
          {m && !antes && !enLista && (() => {
            const piezas = resumen.split(' · ');
            const extra = piezas.length - 1;
            const opciones = [
              piezas,
              extra > 0 ? [piezas[0], `${extra === 1 ? '1 filtro más' : `${extra} filtros más`}`] : piezas,
              [piezas.length === 1 ? '1 filtro' : `${piezas.length} filtros`],
            ];
            const renglon = (pz: string[], medir = false) => (
              <>
                <b key={medir ? undefined : (cargando ? 'c' : n)} style={{ fontSize: 17, fontWeight: 800, color: cargando || !n ? '#6b7280' : '#111827', fontVariantNumeric: 'tabular-nums', display: 'inline-block', transformOrigin: 'left center', animation: cargando || medir ? undefined : 'armadorLatido .45s ease-out' }}>
                  {cargando ? 'Contando…' : n.toLocaleString('es-MX')}
                </b>
                {!cargando && <>&nbsp;para llamar</>}
                {pz.map((x, i) => <span key={i}> · {x}</span>)}
              </>
            );
            return (
              /* 44 px con el texto centrado y -8 arriba: el mismo renglón que el
                 «1 pendiente de lo que pidió» del cierre de la sala, así las
                 dos barras miden lo mismo. */
              <div ref={estadoRef} aria-live="polite" style={{ position: 'relative', minWidth: 0, height: 44, margin: '-8px 0 0', fontSize: 14, color: '#6b7280', lineHeight: '44px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <style>{'@keyframes armadorLatido{0%{transform:scale(1.18);color:#7C3AED}100%{transform:scale(1)}}'}</style>
                {renglon(opciones[nivel] || opciones[2])}
                {/* Las tres versiones, invisibles, para medir cuál cabe. */}
                {opciones.map((o, i) => (
                  <span key={i} data-medida={i} aria-hidden style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{renglon(o, true)}</span>
                ))}
              </div>
            );
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: m ? 8 : 10, flex: m ? undefined : 1 }}>
          {/* Ya en la lista no hay secundario: «Cambiar lista» se fue arriba a
              la derecha y el principal va a lo ancho. En los filtros, «Ver la
              lista» es el secundario común: blanco con línea gris. */}
          {m ? (!enLista && (
            <button type="button" onClick={irALista} disabled={!n}
              style={{ border: '1px solid #E5E7EB', borderRadius: 12, height: 52, padding: '0 14px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', background: '#fff', color: n ? '#374151' : '#6B7280', cursor: n ? 'pointer' : 'default', flexShrink: 0 }}>
              Ver la lista
            </button>
          )) : (
            <>
              <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#6b7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <div style={{ flex: 1 }} />
            </>
          )}
          {/* Mientras recalcula, el botón no presume el número viejo. */}
          <button onClick={() => onListo({ titulo: titulo || 'Lista a la medida', qs, total: n })} disabled={!n || cargando}
            style={{ border: 'none', borderRadius: m ? 12 : 11, padding: m ? '0 16px' : '11px 20px', height: m ? 52 : undefined, flex: m ? 1 : undefined, minWidth: 0, fontSize: m ? 16 : 14, fontWeight: 800, fontFamily: 'inherit',
              cursor: n && !cargando ? 'pointer' : 'default', background: n && !cargando ? P.violetaTinta : '#e0dfe6', color: m && (cargando || !n) ? '#6b7280' : '#fff' }}>
            {m && cargando ? 'Llamar a estos …' : n ? `Llamar a estos ${Math.min(n, 500).toLocaleString('es-MX')}` : 'Llamar a estos'}
          </button>
          </div>
        </div>
      </div>
    </>
  );
}
