// Mejoras e ideas de TODAS las cuentas.
//
// Las mejoras viven dentro de cada ficha, así que el conjunto no se veía: ni
// cuánto dinero hay parado en ideas abiertas —un embudo entero de clientes que
// YA te pagan, el más barato de cerrar— ni qué se prometió y ya venció.
//
// Lo vencido va primero y en rojo. Una promesa que no llegó hace más daño que
// una que nunca se hizo, y es lo único de esta pantalla que se atiende hoy.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import { useIsMobile } from '../../../lib/ui/mobile';
import ClienteDrawer360 from './ClienteDrawer360';
// La bandeja de soporte ya tenía su pantalla: se reusa tal cual en vez de
// escribir otra lista de aceptar/descartar que se separaría con el tiempo.
import Hallazgos from './soporte/Hallazgos';
import { MODOS, modoDe } from '../../../lib/crm/modulos-sacs';
import Cargando, { Corazones } from './ui/Cargando';
import KpiCard from './ui/KpiCard';
import { confirmar } from '../../../lib/ui/confirmar';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '';
const mesDe = (d?: string | null) => String(d || '').slice(0, 7);

// Un color por tipo. Todas en lila se leían igual y había que ir palabra por
// palabra para saber qué era cada renglón; con color, la lista se recorre de
// un vistazo y se distingue una capacitación de una personalización sin leer.
const CATS: Record<string, { label: string; bg: string; fg: string }> = {
  capacitacion:    { label: 'capacitación',    bg: '#FEF6E7', fg: '#9a6a10' },
  pendiente:       { label: 'pendiente',       bg: '#f4f4f6', fg: '#6B7280' },
  personalizacion: { label: 'personalización', bg: '#EEECFE', fg: '#5B4BD6' },
  plugin:          { label: 'plugin',          bg: '#E3EDFD', fg: '#2C5FC4' },
  modulo:          { label: 'módulo',          bg: '#EAF8F2', fg: '#1E8A63' },
  ajuste:          { label: 'ajuste',          bg: '#F4F4F6', fg: '#6B7280' },
  otro:            { label: 'otro',            bg: '#F4F4F6', fg: '#6B7280' },
};
const cat = (k: string) => CATS[k] || CATS.otro;
const PUNTO: Record<string, string> = {
  idea: '#7DA6F5', cotizada: '#9B8CFA', en_proceso: '#F0B84E', entregada: '#4FBF95', descartada: '#C9C7D0',
};

// ── El camino de un compromiso ──
// Los mismos cuatro pasos siempre, en el mismo orden. Se avanza haciendo clic
// en el paso: un desplegable esconde en qué punto está justo lo que se viene a
// ver, y obliga a abrirlo para saberlo.
const PASOS = ['idea', 'cotizada', 'en_proceso', 'entregada'] as const;
const PASO_L: Record<string, string> = { idea: 'Idea', cotizada: 'Cotizada', en_proceso: 'En proceso', entregada: 'Entregada', descartada: 'Descartada' };

const esPendiente = (m: any) => m.estado === 'cotizada' || m.estado === 'en_proceso';

// Por qué se movió una fecha. Lista cerrada a propósito: en texto libre acaban
// veinte formas de escribir lo mismo y no se puede contar cuál se repite.
const MOTIVOS_REAGENDA = [
  'El cliente pidió más tiempo',
  'Falta información del cliente',
  'Se repriorizó',
  'Depende de otro desarrollo',
  'Se subestimó el trabajo',
];

// ── Las vistas son el TIPO de trabajo, no el estado ──
// Una capacitación no se cotiza, no se entrega ni se mide como una
// personalización: son oficios distintos y por eso separan bien. El estado
// —idea, en proceso, entregada— es transversal a los tres, así que va de
// FILTRO: si fuera vista, cada cosa aparecería repetida en dos pestañas y no se
// sabría cuál es la buena.
const VISTAS: { id: string; l: string; f: (m: any) => boolean; agrupa?: boolean }[] = [
  { id: 'todo',     l: 'Todo',             f: () => true, agrupa: true },
  { id: 'mejoras',  l: 'Mejoras',          f: m => ['personalizacion', 'plugin', 'modulo', 'ajuste'].includes(m.categoria) },
  { id: 'capacita', l: 'Capacitaciones',   f: m => m.categoria === 'capacitacion' },
  // Lo que todavía no es trabajo definido: la idea que salió en una junta y el
  // pendiente suelto que pidieron por WhatsApp. La categoría `pendiente` casi no
  // se usa (1 de 40) porque hasta ahora no había dónde capturarla suelta.
  { id: 'ideas',    l: 'Ideas pendientes', f: m => m.estado === 'idea' || ['pendiente', 'otro'].includes(m.categoria) },
  /* Lo que salió de leer el chat de soporte y espera que lo aceptes o lo
     descartes. Era un aviso morado ENCIMA del título y de las cuatro cifras:
     una bandeja de entrada pesando más que la página entera, y saliendo hasta
     en Capacitaciones, donde no tiene nada que ver. Aquí tiene su pantalla y
     el resto de las vistas se quedan limpias. `f` no se usa —la lista la pinta
     el componente de Soporte, no las mejoras—, pero se declara para no romper
     el tipo de VISTAS. */
  { id: 'revisar',  l: 'Por revisar',      f: () => false },
];

// ── El estado, ahora como filtro ──
// Con dos cortes que no son estados sino MEDIDAS: se entregó dentro de la
// fecha o después. Es lo único que dice si las fechas que pactas en la junta
// son realistas o son un deseo.
const entregadaATiempo = (m: any) => m.estado === 'entregada' && m.fecha_compromiso && m.fecha_entrega && m.fecha_entrega <= m.fecha_compromiso;
const entregadaTarde   = (m: any) => m.estado === 'entregada' && m.fecha_compromiso && m.fecha_entrega && m.fecha_entrega > m.fecha_compromiso;

const FILTROS_ESTADO: { v: string; l: string; f: (m: any) => boolean }[] = [
  { v: 'todo',       l: 'Cualquier estado', f: () => true },
  { v: 'pendientes', l: 'Por entregar',     f: esPendiente },
  { v: 'idea',       l: 'Idea',             f: m => m.estado === 'idea' },
  { v: 'cotizada',   l: 'Cotizada',         f: m => m.estado === 'cotizada' },
  { v: 'en_proceso', l: 'En proceso',       f: m => m.estado === 'en_proceso' },
  { v: 'entregada',  l: 'Entregada',        f: m => m.estado === 'entregada' },
  { v: 'a_tiempo',   l: 'Entregada a tiempo', f: entregadaATiempo },
  { v: 'tarde',      l: 'Entregada tarde',    f: entregadaTarde },
  { v: 'descartada', l: 'Descartada',       f: m => m.estado === 'descartada' },
];

const ORIGENES: Record<string, string> = {
  junta: 'De una junta', whatsapp: 'De WhatsApp', soporte: 'De soporte',
  llamada: 'De una llamada', manual: 'Capturado a mano',
};

const S = {
  wrap: WRAP,
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  h: { fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as const,
  nota: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  kpi: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '13px 15px', flex: 1, minWidth: 150 } as const,
  kl: { fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' as const } as const,
  kv: { fontSize: '1.3rem', fontWeight: 800, marginTop: 3 } as const,
  chip: (on: boolean) => ({
    border: '1px solid', borderColor: on ? '#c9bcf7' : '#e2e4e9', background: on ? '#f7f4ff' : '#fff',
    color: on ? '#5B4BD6' : '#555', borderRadius: 9, padding: '6px 12px', fontSize: '0.77rem',
    fontWeight: on ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit',
  }) as const,
};

/* Filtro desplegable con la misma cara que los de Clientes: panel lila
   translúcido y la opción elegida en rosa. El <select> nativo no sirve —su
   panel lo dibuja el sistema operativo y no se puede teñir—, así que el color
   del módulo se rompía justo en el control que más se usa. */
function Desplegable({ etiqueta, valor, opciones, onCambio }: {
  etiqueta: string; valor: string; opciones: { v: string; l: string }[]; onCambio: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('mousedown', fuera); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc); };
  }, [abierto]);
  const elegido = opciones.find(o => o.v === valor);
  const puesto = valor !== 'todo';
  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 9,
          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: puesto ? 700 : 600,
          border: '1px solid', borderColor: puesto || abierto ? '#c9bcf7' : '#e2e4e9',
          background: puesto || abierto ? '#f7f4ff' : '#fff', color: puesto ? '#5B4BD6' : '#555',
        }}>
        <span>{etiqueta}</span>
        {elegido && <span style={{ color: '#7a6fc9', fontWeight: 600 }}>{elegido.l}</span>}
        <span style={{ color: puesto ? '#9B8CFA' : '#b3afbd', fontSize: '0.6rem' }}>▾</span>
      </button>
      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 190,
          background: 'rgba(250,248,255,0.96)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid #e6ddfa', borderRadius: 12, boxShadow: '0 14px 34px rgba(91,75,214,0.16)', padding: 6,
        }}>
          {opciones.map(o => {
            const sel = o.v === valor;
            return (
              <button key={o.v} type="button" onClick={() => { onCambio(o.v); setAbierto(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, width: '100%', textAlign: 'left', border: 'none',
                  borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: '0.78rem',
                  fontWeight: sel ? 800 : 500, cursor: 'pointer',
                  background: sel ? 'rgba(244,168,205,0.34)' : 'transparent', color: sel ? '#9c3d70' : '#3f3b4d',
                }}>
                <span style={{ width: 12, color: '#9c3d70' }}>{sel ? '✓' : ''}</span>{o.l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Aviso de lo que la lectura nocturna del chat de soporte dejó por revisar.
 *
 * Vive aquí porque Consultoría es donde se trabaja lo que pide el cliente, y
 * una petición que salió de un chat no sirve de nada si hay que acordarse de ir
 * a buscarla a otra pantalla. Solo aparece cuando hay algo: un aviso que está
 * siempre deja de leerse en una semana.
 */
export default function MejorasTab() {
  const esMovilCons = useIsMobile();
  const [rows, setRows] = useState<any[] | null>(null);
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [vista, setVista] = useState<string>('todo');
  const [alerta, setAlerta] = useState<'' | 'vencidas' | 'semana' | 'sinliga'>('');
  // Renglones expandidos y grupos plegados. Los grupos nacen ABIERTOS: la
  // pantalla se abre para ver qué falta, no para ir destapando cuentas.
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [plegados, setPlegados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  // Edición de la fecha de entrega: qué renglón, la fecha nueva y por qué.
  const [editFecha, setEditFecha] = useState<{ id: string; fecha: string; motivo: string } | null>(null);
  const [editLiga, setEditLiga] = useState<{ id: string; url: string } | null>(null);
  // El TIPO se volvió la vista; aquí quedan los dos cortes transversales.
  const [fEstado, setFEstado] = useState<string>('todo');
  const [fOrigen, setFOrigen] = useState<string>('todo');   // de dónde salió
  const [verSemana, setVerSemana] = useState(false);
  /* El resumen de la bandeja de soporte, solo para el contador de la pestaña.
     Cuenta lo que PIDE TU DECISIÓN —mejora, oportunidad, riesgo— y no el total:
     de 86 pendientes, 55 son dudas de clientes ("cómo cambio la contraseña"),
     que no se autorizan, se contestan con capacitación. El aviso viejo decía 86
     y te reclamaba atención sobre el triple de lo que de verdad resuelves. */
  const [hall, setHall] = useState<any>(null);
  const cargarHallazgos = useCallback(() => {
    fetch('/api/crm/soporte/hallazgos?estado=pendiente')
      .then(x => x.json()).then(j => { if (!j.error) setHall(j.resumen || null); })
      .catch(() => {});
  }, []);
  useEffect(() => { cargarHallazgos(); }, [cargarHallazgos]);
  const porTipo = hall?.por_tipo || {};
  const nDecidir = (porTipo.mejora || 0) + (porTipo.oportunidad || 0) + (porTipo.riesgo || 0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = () => fetch('/api/crm/mejoras').then(r => r.json())
    .then(j => { setRows(j.data || []); setVencidas(j.vencidas || []); }).catch(() => setRows([]));

  // Palomear desde aquí, sin abrir la ficha: después de una junta se cierran
  // cinco cosas de tres clientes distintos, y abrir y cerrar cinco fichas para
  // eso es el motivo por el que nadie actualiza nada.
  async function marcarHecha(e: any, m: any) {
    e.stopPropagation();
    await mueve(m, 'entregada');
  }

  /** Avanzar (o regresar) un compromiso de paso. El servidor pone la fecha de
   *  entrega solo cuando llega a 'entregada'. */
  async function mueve(m: any, estado: string) {
    if (m.estado === estado) return;
    setGuardando(m.id);
    const antes = PASO_L[m.estado] || m.estado;
    try {
      const r = await fetch('/api/crm/mejoras', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, estado }),
      });
      if (!r.ok) throw new Error();
      flash(`${m.titulo}: ${antes} → ${PASO_L[estado]}`);
      await cargar();
    } catch { flash('No se pudo mover. Intenta de nuevo.'); }
    setGuardando(null);
  }

  let tId: any;
  function flash(txt: string) { setAviso(txt); clearTimeout(tId); tId = setTimeout(() => setAviso(''), 3800); }

  /** Recorrer la fecha de entrega. El motivo es obligatorio: mover sin decir
   *  por qué es lo que hace que el rastro no sirva para nada después. */
  async function guardaFecha(m: any) {
    if (!editFecha || editFecha.id !== m.id) return;
    if (!editFecha.fecha) { flash('Ponle una fecha.'); return; }
    if (m.fecha_compromiso && !editFecha.motivo.trim()) { flash('Dinos por qué se mueve.'); return; }
    setGuardando(m.id);
    try {
      const r = await fetch('/api/crm/mejoras', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, fecha_compromiso: editFecha.fecha, motivo: editFecha.motivo }),
      });
      if (!r.ok) throw new Error();
      const n = (Array.isArray(m.reagendas) ? m.reagendas.length : 0) + (m.fecha_compromiso ? 1 : 0);
      flash(`Fecha guardada: ${fmtDate(editFecha.fecha)}${n > 0 ? ` · reagendada ${n} ${n === 1 ? 'vez' : 'veces'}` : ''}`);
      setEditFecha(null);
      await cargar();
    } catch { flash('No se pudo guardar la fecha.'); }
    setGuardando(null);
  }

  async function guardaLiga(m: any) {
    if (!editLiga || editLiga.id !== m.id) return;
    setGuardando(m.id);
    try {
      const r = await fetch('/api/crm/mejoras', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, url: editLiga.url.trim() }),
      });
      if (!r.ok) throw new Error();
      flash(editLiga.url.trim() ? 'Liga de entrega guardada.' : 'Liga quitada.');
      setEditLiga(null);
      await cargar();
    } catch { flash('No se pudo guardar la liga.'); }
    setGuardando(null);
  }

  const alterna = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n);
  };
  useEffect(() => { cargar(); }, []);

  const k = useMemo(() => {
    const r = rows || [];
    const mes = new Date().toISOString().slice(0, 7);
    const anio = String(new Date().getFullYear());
    const ideas = r.filter(m => m.estado === 'idea');
    return {
      entregadasMes: r.filter(m => m.estado === 'entregada' && mesDe(m.fecha_entrega) === mes).length,
      cobradoAnio: r.filter(m => m.estado === 'entregada' && !m.cortesia && String(m.fecha_entrega || '').startsWith(anio))
        .reduce((a, m) => a + Number(m.valor || 0), 0),
      ideas: ideas.length,
      potencial: ideas.reduce((a, m) => a + Number(m.valor || 0), 0),
      cuentasConIdeas: new Set(ideas.map(m => m.company_id)).size,
      capsDadas: r.filter(m => m.categoria === 'capacitacion' && m.estado === 'entregada' && String(m.fecha_entrega || '').startsWith(anio)).length,
    };
  }, [rows]);

  // Lo que falta por hacer: mejoras comprometidas y capacitaciones que no se
  // han dado. Es la razón de ser de esta pantalla —lo prometido y no cumplido
  // no se ve desde adentro de una sola ficha.
  const pendientes = useMemo(() => (rows || []).filter(m =>
    (m.estado === 'cotizada' || m.estado === 'en_proceso')), [rows]);
  const videosPorEnviar = useMemo(() => (rows || []).filter(m =>
    m.categoria === 'capacitacion' && m.estado !== 'entregada' && m.estado !== 'descartada' && modoDe(m) === 'video'), [rows]);
  const capsAgendadas = useMemo(() => (rows || []).filter(m =>
    m.categoria === 'capacitacion' && m.estado !== 'entregada' && m.estado !== 'descartada' && modoDe(m) === 'agendada'), [rows]);

  const hoyISO = new Date().toISOString().slice(0, 10);
  const enDias = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // Lo que vence en los próximos 7 días. Va en ámbar y aparte: llegar antes de
  // que se ponga rojo es todo el chiste: después ya es una promesa rota.
  const estaSemana = useMemo(() => (rows || []).filter(m =>
    (m.estado === 'cotizada' || m.estado === 'en_proceso')
    && m.fecha_compromiso && m.fecha_compromiso >= hoyISO && m.fecha_compromiso <= enDias(7)
  ).sort((a, b) => String(a.fecha_compromiso).localeCompare(String(b.fecha_compromiso))), [rows]);
  const idsSemana = useMemo(() => new Set(estaSemana.map(m => m.id)), [estaSemana]);

  // Las tres alertas, cada una un filtro. Menos de tres no dice nada y más de
  // tres deja de leerse: son las únicas que cambian lo que haces hoy.
  const sinLiga = useMemo(() => (rows || []).filter(m => m.estado === 'entregada' && !m.url), [rows]);
  const idsVencidas = useMemo(() => new Set(vencidas.map((v: any) => v.id)), [vencidas]);
  const ALERTAS = [
    { id: 'vencidas' as const, k: 'Prometido y vencido', franja: '#EF7A72', color: '#C0554E', n: vencidas.length,
      s: vencidas.length ? 'lo que más daña una cuenta' : 'nada tarde, todo al día',
      f: (m: any) => idsVencidas.has(m.id) },
    { id: 'semana' as const, k: 'Vence en 7 días', franja: '#E8A838', color: '#9a6a10', n: estaSemana.length,
      s: 'llegar antes de que se ponga rojo', f: (m: any) => idsSemana.has(m.id) },
    { id: 'sinliga' as const, k: 'Entregado sin liga', franja: '#9B8CFA', color: '#5B4BD6', n: sinLiga.length,
      s: 'trabajo hecho que no puedes enseñar', f: (m: any) => m.estado === 'entregada' && !m.url },
  ];

  // Puntualidad de entrega: solo cuenta lo entregado que SÍ tenía fecha
  // pactada. Meter en el promedio lo que nunca tuvo fecha inflaría el número
  // premiando justo lo que no se comprometió.
  const punt = useMemo(() => {
    const r = rows || [];
    const conFecha = r.filter(m => m.estado === 'entregada' && m.fecha_compromiso && m.fecha_entrega);
    const aTiempo = conFecha.filter(entregadaATiempo).length;
    const tarde = conFecha.filter(entregadaTarde).length;
    return { total: conFecha.length, aTiempo, tarde, pct: conFecha.length ? Math.round(100 * aTiempo / conFecha.length) : null };
  }, [rows]);

  const lista = useMemo(() => {
    let r = rows || [];
    const v = VISTAS.find(x => x.id === vista) || VISTAS[0];
    r = r.filter(v.f);
    const al = ALERTAS.find(a => a.id === alerta);
    if (al) r = r.filter(al.f);
    const fe = FILTROS_ESTADO.find(x => x.v === fEstado);
    if (fe && fEstado !== 'todo') r = r.filter(fe.f);
    // De dónde salió. Antes este filtro era "juntas de los últimos 7/30 días",
    // que contestaba una pregunta de tiempo, no de origen: lo que el cliente
    // pide por WhatsApp no salía por ningún lado.
    if (fOrigen !== 'todo') r = r.filter(m => (m.origen || (m.booking_id ? 'junta' : 'manual')) === fOrigen);
    const t = busca.trim().toLowerCase();
    if (t) r = r.filter(m => `${m.titulo} ${m.descripcion || ''} ${m.companies?.nombre_comercial || m.companies?.nombre || ''}`.toLowerCase().includes(t));
    // Las ideas se ordenan por monto: lo primero que quieres ver es dónde está
    // el dinero más grande sin cerrar. Todo lo demás, por lo que vence antes,
    // con lo vencido arriba — que es el orden en que se trabaja.
    if (vista === 'ideas') return r.slice().sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    return r.slice().sort((a, b) => {
      const va = idsVencidas.has(a.id) ? 0 : 1, vb = idsVencidas.has(b.id) ? 0 : 1;
      if (va !== vb) return va - vb;
      return String(a.fecha_compromiso || '9999').localeCompare(String(b.fecha_compromiso || '9999'));
    });
  }, [rows, vista, alerta, fEstado, fOrigen, busca, idsVencidas, idsSemana]);

  // Agrupado por cuenta: al salir de tres juntas seguidas lo que quieres ver es
  // "Live Shows: 4 pendientes", no cuatro renglones perdidos entre los de otros.
  const grupos = useMemo(() => {
    const g: Record<string, { id: string; nombre: string; items: any[] }> = {};
    for (const m of lista) {
      const id = m.company_id;
      g[id] = g[id] || { id, nombre: m.companies?.nombre_comercial || m.companies?.nombre || 'Cuenta', items: [] };
      g[id].items.push(m);
    }
    return Object.values(g).sort((a, b) => b.items.length - a.items.length || a.nombre.localeCompare(b.nombre));
  }, [lista]);

  /** La lista de una cuenta en texto plano, para pegarla en el chat del equipo. */
  function copiarGrupo(g: any) {
    const L = [`${g.nombre} — pendientes`, ''];
    for (const m of g.items) {
      L.push(`· ${m.titulo}${m.modulo ? ` (${m.modulo})` : ''}${m.fecha_compromiso ? ` — para el ${fmtDate(m.fecha_compromiso)}` : ''}`);
      if (m.descripcion) L.push(`  ${m.descripcion}`);
    }
    navigator.clipboard?.writeText(L.join('\n'));
  }

  // Cerrar varias de un golpe: tras una junta se cierran cinco cosas y hacerlo
  // una por una es el motivo por el que estas listas se dejan de actualizar.
  async function cerrarSeleccionadas() {
    const ids = Array.from(sel);
    if (!ids.length) return;
    if (!await confirmar(`¿Marcar ${ids.length} como hechas?`, { accion: 'Marcar hechas', peligro: false })) return;
    for (const id of ids) {
      await fetch('/api/crm/mejoras', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: 'entregada' }),
      }).catch(() => {});
    }
    setSel(new Set()); cargar();
  }
  const alternarSel = (e: any, id: string) => {
    e.stopPropagation();
    setSel(s2 => { const n = new Set(s2); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Lo mismo pedido por varias cuentas ya no es trabajo a la medida: es un
  // producto. Se agrupa por título normalizado.
  const repetidas = useMemo(() => {
    const g: Record<string, { titulo: string; cuentas: Set<string>; valor: number }> = {};
    for (const m of (rows || [])) {
      if (m.estado === 'descartada') continue;
      const k2 = String(m.titulo || '').toLowerCase().replace(/[^a-záéíóúñ0-9 ]/gi, '').trim();
      if (!k2) continue;
      g[k2] = g[k2] || { titulo: m.titulo, cuentas: new Set(), valor: 0 };
      g[k2].cuentas.add(m.company_id);
      g[k2].valor = Math.max(g[k2].valor, Number(m.valor || 0));
    }
    return Object.values(g).filter(x => x.cuentas.size >= 3).sort((a, b) => b.cuentas.size - a.cuentas.size);
  }, [rows]);

  if (rows === null) return <div style={S.wrap}><Cargando texto="Cargando consultoría…" /></div>;

  /**
   * Un compromiso. Cerrado se lee de un vistazo; abierto trae todo lo que hace
   * falta para moverlo sin salir de la pantalla. Antes el clic abría la ficha
   * completa del cliente: para palomear una cosa había que cargar un cajón con
   * su historia entera y volver.
   */
  const renglon = (m: any, conCliente: boolean) => {
    const abiertoAqui = expandidos.has(m.id);
    const venc = idsVencidas.has(m.id);
    const reag: any[] = Array.isArray(m.reagendas) ? m.reagendas : [];
    const nReag = reag.length;
    // Narrowing: dentro del panel se lee el editor de ESTE renglón o nada.
    const edF = editFecha && editFecha.id === m.id ? editFecha : null;
    const edL = editLiga && editLiga.id === m.id ? editLiga : null;
    const c = cat(m.categoria);
    const iAct = PASOS.indexOf(m.estado);
    const fechaTxt = m.fecha_entrega ? `Entregada ${fmtDate(m.fecha_entrega)}`
      : m.fecha_compromiso ? `Para el ${fmtDate(m.fecha_compromiso)}`
      : 'Sin fecha';

    return (
      <div key={m.id} style={{ borderTop: '1px solid #f5f4f8' }}>
        <div onClick={() => alterna(expandidos, setExpandidos, m.id)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alterna(expandidos, setExpandidos, m.id); } }}
          className="cons-fila"
          style={{ display: 'flex', gap: 11, padding: '11px 0', alignItems: 'flex-start', cursor: 'pointer' }}>
          {m.estado !== 'entregada' && m.estado !== 'descartada'
            ? (
              /* El checkbox nativo mide 13 px y esta fila TAMBIÉN responde al
                 tap (expande la mejora): con un blanco así de chico, el dedo
                 que quería seleccionar terminaba expandiendo. En el teléfono se
                 sube a 20 y el envoltorio le da un área de ~40 px con padding
                 compensado por margen negativo, así que la fila no se mueve ni
                 un pixel. En escritorio queda exactamente como estaba. */
              <span
                onClick={esMovilCons ? (e => alternarSel(e as any, m.id)) : undefined}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'flex-start',
                  ...(esMovilCons ? { padding: '10px 9px 10px 0', margin: '-10px -9px -10px 0' } : {}) }}>
                <input type="checkbox" checked={sel.has(m.id)} onClick={e => alternarSel(e, m.id)} onChange={() => {}}
                  style={{ marginTop: 4, cursor: 'pointer', flexShrink: 0,
                    ...(esMovilCons ? { width: 20, height: 20, marginTop: 1 } : {}) }} />
              </span>
            )
            : <span className="cons-hueco" style={{ width: 13, flexShrink: 0 }} />}
          {/* El punto vive PEGADO a la palabra que califica («● En proceso»),
              no en una canaleta aparte donde quedaba huérfano. */}
          <span className="cons-punto" style={{ flex: '0 0 6px', width: 6, height: 6, borderRadius: 99, background: PUNTO[m.estado] || '#C9C7D0', marginTop: 7 }} />
          {conCliente && (
            <div className="cons-cliente" style={{ flex: '0 0 170px', fontSize: '0.79rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.companies?.nombre_comercial || m.companies?.nombre || '—'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cons-tit" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {m.titulo}
            </div>
            <div className="cons-meta" style={{ fontSize: '0.75rem', color: '#8f8d98', marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Todo el contexto en UNA línea: categoría, estado, junta y
                  cotización. Cada uno en su renglón hacía filas de 155 px y
                  53 partidas se volvían doce pantallas de scroll. */}
              <span className="cons-cat" style={{ fontSize: '0.72rem', fontWeight: 700, background: '#f4f3f6', color: '#6b6b74', borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>{c.label}</span>
              <span>{PASO_L[m.estado] || m.estado}</span>
              {/* De qué junta salió y con qué cotización se cotizó son datos de
                  archivo: en el teléfono se ven al abrir la partida, no en la
                  lista, donde alargaban la fila a tres renglones. */}
              {m.bookings?.fecha && <span className="cons-extra"><span> · </span>de la junta del {fmtDate(m.bookings.fecha)}</span>}
              {m.quotes?.numero && <span className="cons-extra"><span> · </span>{m.quotes.numero}</span>}
              {nReag > 0 && <><span>·</span><span style={{ color: '#C0554E', fontWeight: 700 }}>reagendada {nReag} {nReag === 1 ? 'vez' : 'veces'}</span></>}
              {/* En el teléfono la fecha y el valor cierran ESTA línea: en
                  renglón aparte la fila crecía a 146 px y 53 partidas eran
                  doce pantallas de scroll. */}
              {esMovilCons && (
                <span className="cons-linea2" style={{ display: 'flex', alignItems: 'center', gap: 10, flexBasis: '100%', marginTop: 2 }}>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (m.estado === 'entregada') return;
                      setExpandidos(x => new Set(x).add(m.id));
                      setEditFecha({ id: m.id, fecha: m.fecha_compromiso || '', motivo: '' });
                    }}
                    className={venc ? 'cons-fecha' : undefined}
                    style={{
                      fontSize: '0.78rem', fontWeight: venc ? 700 : 500, whiteSpace: 'nowrap',
                      padding: 0, minHeight: 28, fontFamily: 'inherit', cursor: 'pointer',
                      border: 'none', background: 'none', color: venc ? '#C0554E' : '#8f8d98',
                    }}>{fechaTxt}</button>
                  {(m.cortesia || Number(m.valor) > 0) && (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: m.cortesia ? '#8f8d98' : '#1a1a1a' }}>
                      {m.cortesia ? 'Cortesía' : (m.estado === 'idea' ? '~' : '') + money(m.valor)}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          {!esMovilCons && <div className="cons-der" style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <button
              onClick={e => {
                e.stopPropagation();
                if (m.estado === 'entregada') return;
                setExpandidos(x => new Set(x).add(m.id));
                setEditFecha({ id: m.id, fecha: m.fecha_compromiso || '', motivo: '' });
              }}
              className={venc ? 'cons-fecha' : undefined}
              title={m.estado === 'entregada' ? 'Ya entregada' : 'Cambiar la fecha de entrega'}
              style={{
                fontSize: '0.78rem', fontWeight: venc ? 700 : 500, whiteSpace: 'nowrap', borderRadius: 8,
                padding: venc ? '6px 11px' : '6px 0', minHeight: 32,
                fontFamily: 'inherit', cursor: m.estado === 'entregada' ? 'default' : 'pointer',
                // Relleno SOLO para lo vencido: en todas las filas, el chip era
                // el objeto más pesado del renglón y competía con el título.
                ...(venc ? { border: '1px solid #EF7A72', background: '#FEF0EF', color: '#C0554E' }
                  : { border: 'none', background: 'none', color: '#8f8d98' }),
              }}>{fechaTxt}</button>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', color: m.cortesia || !(Number(m.valor) > 0) ? '#8f8d98' : '#1a1a1a' }}>
              {m.cortesia ? 'Cortesía' : Number(m.valor) > 0 ? (m.estado === 'idea' ? '~' : '') + money(m.valor) : '—'}
            </div>
          </div>}
        </div>

        {abiertoAqui && (
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#faf9fd', border: '1px solid #f0eff5', borderRadius: 10, padding: '13px 15px', margin: '0 0 12px 24px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {/* Los pasos: se avanza haciendo clic, no abriendo un menú. */}
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {PASOS.map((paso, i) => {
                const hecho = i < iAct, aqui = i === iAct;
                return (
                  <button key={paso} disabled={guardando === m.id}
                    onClick={() => mueve(m, paso)}
                    title={aqui ? 'Aquí está hoy' : `Mover a ${PASO_L[paso]}`}
                    style={{
                      fontFamily: 'inherit', fontSize: '0.61rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                      padding: '5px 11px', cursor: guardando === m.id ? 'wait' : 'pointer',
                      border: '1px solid', borderLeft: i ? 'none' : '1px solid',
                      borderRadius: i === 0 ? '7px 0 0 7px' : i === PASOS.length - 1 ? '0 7px 7px 0' : 0,
                      ...(aqui ? { background: '#9B8CFA', color: '#fff', borderColor: '#9B8CFA' }
                        : hecho ? { background: '#EEECFE', color: '#5B4BD6', borderColor: '#ddd6fb' }
                        : { background: '#fff', color: '#a5a2af', borderColor: '#e6e3ee' }),
                    }}>{PASO_L[paso]}</button>
                );
              })}
            </div>

            {/* Editor de la fecha. El motivo es obligatorio cuando ya había una:
                sin él, el rastro no explica nada tres meses después. */}
            {edF && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, padding: '11px 13px' }}>
                <span style={{ width: '100%', fontSize: '0.58rem', letterSpacing: '.11em', textTransform: 'uppercase', color: '#b0aec0', fontWeight: 700 }}>
                  {m.fecha_compromiso ? 'Mover la fecha de entrega' : 'Poner fecha de entrega'}
                </span>
                <input type="date" autoFocus value={edF.fecha}
                  onChange={e => setEditFecha(f => (f ? { ...f, fecha: e.target.value } : f))}
                  style={{ border: '1.5px solid #e4dffb', borderRadius: 8, padding: '6px 9px', fontSize: '0.78rem', fontFamily: 'inherit', background: '#fdfcff' }} />
                {m.fecha_compromiso && (
                  <select value={edF.motivo} onChange={e => setEditFecha(f => (f ? { ...f, motivo: e.target.value } : f))}
                    style={{ border: '1.5px solid #e4dffb', borderRadius: 8, padding: '6px 9px', fontSize: '0.78rem', fontFamily: 'inherit', background: '#fdfcff' }}>
                    <option value="">¿Por qué se mueve?</option>
                    {MOTIVOS_REAGENDA.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )}
                <button onClick={() => guardaFecha(m)} disabled={guardando === m.id}
                  style={{ border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {guardando === m.id ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setEditFecha(null)}
                  style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: '0.76rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
              </div>
            )}

            {/* La liga de lo entregado. Sin ella una entrega no se puede enseñar. */}
            {edL && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, padding: '11px 13px' }}>
                <span style={{ width: '100%', fontSize: '0.58rem', letterSpacing: '.11em', textTransform: 'uppercase', color: '#b0aec0', fontWeight: 700 }}>Liga de lo entregado</span>
                <input autoFocus value={edL.url} onChange={e => setEditLiga(l => (l ? { ...l, url: e.target.value } : l))}
                  placeholder="https://… el video, el módulo publicado, el documento"
                  style={{ flex: '1 1 260px', border: '1.5px solid #e4dffb', borderRadius: 8, padding: '6px 9px', fontSize: '0.78rem', fontFamily: 'inherit', background: '#fdfcff' }} />
                <button onClick={() => guardaLiga(m)} disabled={guardando === m.id}
                  style={{ border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {guardando === m.id ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setEditLiga(null)}
                  style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: '0.76rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
              </div>
            )}

            {m.descripcion && <div style={{ fontSize: '0.78rem', color: '#5a5a63', lineHeight: 1.55 }}>{m.descripcion}</div>}

            {/* La historia de la fecha: de dónde a dónde, por qué y quién. */}
            {nReag > 0 && (
              <div style={{ background: '#FEF0EF', border: '1px solid #f7d9d6', borderRadius: 9, padding: '9px 11px' }}>
                <div style={{ fontSize: '0.58rem', letterSpacing: '.11em', textTransform: 'uppercase', color: '#C0554E', fontWeight: 800, marginBottom: 4 }}>
                  Se movió {nReag} {nReag === 1 ? 'vez' : 'veces'}
                </div>
                {reag.slice().reverse().map((r: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.73rem', color: '#8c2f28', lineHeight: 1.5 }}>
                    {fmtDate(r.de)} → <b>{fmtDate(r.a)}</b> · {r.motivo}
                    {r.quien && <span style={{ color: '#b8837e' }}> · {r.quien}</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                ['Cliente', m.companies?.nombre_comercial || m.companies?.nombre || '—'],
                ['Salió de', m.bookings?.asunto || (m.bookings?.fecha ? `junta del ${fmtDate(m.bookings.fecha)}` : 'captura manual')],
                ['Módulo', m.modulo || '—'],
                ['Entregado como', m.estado === 'entregada' ? (m.url ? (m.modo || 'con liga') : 'sin liga de entrega') : (m.modo || '—')],
              ].map(([kk, vv]) => (
                <div key={kk as string} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.58rem', letterSpacing: '.11em', textTransform: 'uppercase', color: '#b0aec0', fontWeight: 700 }}>{kk}</span>
                  <span style={{ fontSize: '0.79rem', color: '#4a4558' }}>{vv}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {m.url && (
                <a href={m.url} target="_blank" rel="noreferrer"
                  style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '5px 11px', fontSize: '0.73rem', fontWeight: 700, color: '#2C5FC4', textDecoration: 'none' }}>
                  Ver lo entregado
                </a>
              )}
              {m.estado !== 'entregada' && (
                <button onClick={() => setEditFecha({ id: m.id, fecha: m.fecha_compromiso || '', motivo: '' })}
                  style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '5px 11px', fontSize: '0.73rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {m.fecha_compromiso ? 'Cambiar fecha' : 'Poner fecha'}
                </button>
              )}
              <button onClick={() => setEditLiga({ id: m.id, url: m.url || '' })}
                style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '5px 11px', fontSize: '0.73rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                {m.url ? 'Cambiar liga' : 'Agregar liga de entrega'}
              </button>
              <button onClick={() => setAbierto(m.company_id)}
                style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '5px 11px', fontSize: '0.73rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                Abrir ficha del cliente
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.wrap}>
      <style>{`
        .cons-alertas { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
        @media (max-width: 1100px) { .cons-alertas { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        /* En el teléfono son dos columnas, no una: cuatro tarjetas a ancho
           completo se comen la pantalla entera antes de llegar al trabajo. */
        @media (max-width: 620px)  { .cons-alertas { grid-template-columns:repeat(2, minmax(0,1fr)); gap:9px; } }
        /* El app bar ya dice "Consultoría": el H2 duplicado a 60px sobra en móvil */
        @media (max-width: 899px)  { .cons-titulo { display: none; } }
        /* ══ La fila de trabajo en el teléfono ══════════════════════════════
           En 390 px la fila de escritorio dejaba el título con 55 px de ancho
           —una palabra por renglón— y empujaba el chip de fecha encima, con el
           valor cortado contra el borde. Aquí se apila: punto y título arriba,
           y debajo una sola línea de contexto con estado, fecha y valor. */
        @media (max-width: 820px) {
          .cons-fila { display: grid !important; grid-template-columns: auto auto 1fr !important;
                       align-items: start !important; gap: 9px !important; padding: 13px 0 !important; }
          .cons-cliente { display: none !important; }   /* el cliente ya es el encabezado del grupo */
          /* El punto y el hueco del checkbox no piden columna propia: el punto
             se pega al texto y el hueco desaparece (45 px de canaleta vacía en
             casi todas las filas). */
          .cons-punto { width: 6px !important; height: 6px !important; flex: none !important; margin-top: 9px !important; }
          /* La canaleta de selección se reserva aunque la fila no tenga
             checkbox: sin ella el título arrancaba 21 px más a la izquierda en
             unas filas sí y en otras no, y el margen bailaba al hacer scroll. */
          .cons-hueco { display: block !important; width: 15px !important; flex: none !important; }
          .cons-fila { grid-template-columns: auto auto 1fr !important; }
          /* El encabezado del cliente acompaña el scroll: al quitar el cliente
             de cada fila, es lo único que dice de quién es este trabajo. */
          .cons-grupo { position: sticky; top: 0; z-index: 2; background: #fff; }
          .cons-tit { font-size: 0.95rem !important; font-weight: 650 !important; line-height: 1.35 !important; overflow-wrap: anywhere; }
          .cons-meta { font-size: 0.78rem !important; }
          .cons-extra { display: none !important; }
          /* La fecha y el valor cierran la misma línea de contexto: a la
             derecha se recortaban, y en renglón propio inflaban la fila. */
          .cons-der { grid-column: 3 !important; justify-content: flex-start !important;
                      flex-wrap: wrap !important; margin-top: 4px !important; gap: 10px !important; }
        }
      `}</style>
      <div style={{ marginBottom: 16 }}>
        <h2 className="cons-titulo" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Consultoría</h2>
        <div style={{ fontSize: '0.79rem', color: '#8a8a8a', marginTop: 2 }}>
          Todo el trabajo con clientes: mejoras, capacitaciones, videos y pendientes.
        </div>
      </div>

      {/* ── Tres alertas, y cada una es un filtro ──
          Antes había cinco cajas de KPI, un bloque rojo con la lista de
          vencidas y una franja ámbar con la de esta semana: la misma
          información contada tres veces, y media pantalla antes de llegar a lo
          que se viene a trabajar. Ahora son tres tarjetas; al hacer clic, la
          lista de abajo se queda solo con eso. */}
      <div className="cons-alertas" style={{ marginBottom: 16 }}>
        {ALERTAS.map(a => (
          <KpiCard key={a.id} label={a.k} valor={a.n} franja={a.franja}
            color={a.n ? a.color : '#1a1a1a'} sub={a.s}
            activo={alerta === a.id}
            onClick={a.n ? () => setAlerta(alerta === a.id ? '' : a.id) : undefined} />
        ))}
        {/* La medida que pediste: de lo que ya se entregó CON fecha pactada,
            cuánto llegó dentro. Es lo único que dice si las fechas que pactas
            en la junta son realistas o son un deseo. */}
        <KpiCard label="Entregado a tiempo" franja="#4FBF95"
          color={punt.pct == null ? '#1a1a1a' : punt.pct >= 80 ? '#1E8A63' : punt.pct >= 50 ? '#9a6a10' : '#C0554E'}
          valor={punt.pct == null ? '—' : `${punt.pct}%`}
          sub={punt.total ? `${punt.aTiempo} de ${punt.total} con fecha pactada${punt.tarde ? ` · ${punt.tarde} tarde` : ''}` : 'ninguna entrega tenía fecha pactada'}
          onClick={punt.tarde ? () => { setVista('todo'); setAlerta(''); setFEstado('tarde'); } : undefined} />
      </div>

      {/* ── Las vistas ── */}
      <div className="crm-scroll-x mod-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid #ececf2', marginBottom: 16 }}>
        {VISTAS.map(v => {
          const n = v.id === 'revisar' ? nDecidir : (rows || []).filter(v.f).length;
          const on = vista === v.id;
          // Cuántas de esta vista van tarde: el conteo en rojo dice dónde arde.
          const urge = (rows || []).filter(m => v.f(m) && idsVencidas.has(m.id)).length > 0;
          return (
            <button key={v.id} onClick={() => { setVista(v.id); setAlerta(''); }}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                padding: '9px 13px', marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: '0.85rem', fontWeight: on ? 800 : 600, color: on ? '#5B4BD6' : '#83808e',
                borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent', whiteSpace: 'nowrap',
              }}>
              {v.l}
              {/* Un solo tratamiento de pastilla para las tres pestañas: la
                  urgencia la dice el COLOR DEL NÚMERO, no una regla a sangre. */}
              <span style={{
                background: on ? '#EEECFE' : '#f4f4f6',
                color: urge && !on ? '#C0554E' : on ? '#5B4BD6' : '#8a8a92',
                borderRadius: 20, padding: '2px 9px', fontSize: '0.72rem', fontWeight: 800,
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* La bandeja de soporte, en su propia vista. Todo lo de abajo —filtros,
          agrupación por cuenta, la lista de mejoras— es de las mejoras y aquí
          no aplica, así que se sale antes. */}
      {vista === 'revisar' ? (
        <>
          <div style={{ fontSize: '0.79rem', color: '#6b7280', lineHeight: 1.55, marginBottom: 12 }}>
            Lo que salió de leer el chat de soporte anoche. <b style={{ color: '#241d43' }}>{nDecidir} piden tu decisión</b>
            {porTipo.duda ? <> · {porTipo.duda} son dudas de clientes, que no se autorizan: se contestan con capacitación</> : null}
            {porTipo.testimonio ? <> · {porTipo.testimonio} {porTipo.testimonio === 1 ? 'testimonio' : 'testimonios'}</> : null}.
            Al aceptar una, se crea aquí en Consultoría o en la bandeja de oportunidades.
          </div>
          <Hallazgos sinTope onAbrirCliente={(id: string) => setAbierto(id)} onCambio={() => { cargar(); cargarHallazgos(); }} />
        </>
      ) : (<>

      {vista === 'todo' && repetidas.length > 0 && (
        <div style={{ ...S.card, background: '#f6f9ff', borderColor: '#cfe0fa' }}>
          <div style={S.h}>Lo que piden varias cuentas<span style={S.nota}>Si tres o más lo pidieron, ya no es a la medida</span></div>
          {repetidas.map(r => (
            <div key={r.titulo} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 0', borderTop: '1px solid #e8eff9', fontSize: '0.82rem' }}>
              <b style={{ flex: 1 }}>{r.titulo}</b>
              <span style={{ color: '#2C5FC4', fontWeight: 700 }}>{r.cuentas.size} cuentas</span>
              {r.valor > 0 && <span style={{ color: '#a5a2af', fontSize: '0.75rem' }}>hasta {money(r.valor)} c/u</span>}
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        {/* El buscador va PRIMERO: lo que se busca aquí es un cliente, para ver
            de golpe todo lo suyo después de una junta. Los filtros vienen
            después, para acotar lo que ya se encontró. */}
        <div className="mod-filtros" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente o mejora…"
            style={{ minWidth: 260, padding: '8px 12px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.78rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' }} />
          {/* El estado es transversal a los tres tipos, así que es filtro y no
              vista. Las dos últimas opciones no son estados sino la MEDIDA de
              si la fecha que se pactó se cumplió. */}
          <Desplegable etiqueta="Estado" valor={fEstado} onCambio={setFEstado}
            opciones={FILTROS_ESTADO.map(f => ({ v: f.v, l: f.l }))} />
          <Desplegable etiqueta="Salió de" valor={fOrigen} onCambio={setFOrigen}
            opciones={[{ v: 'todo', l: 'Cualquier origen' }, ...Object.entries(ORIGENES).map(([k, l]) => ({ v: k, l }))]} />
          {alerta && (
            <button onClick={() => setAlerta('')} style={S.chip(true)}>
              {ALERTAS.find(a => a.id === alerta)?.k} ✕
            </button>
          )}
          {(fEstado !== 'todo' || fOrigen !== 'todo') && (
            <button onClick={() => { setFEstado('todo'); setFOrigen('todo'); }} style={S.chip(true)}>
              Quitar filtros ✕
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#a5a2af' }}>{lista.length} de {rows.length}</span>
        </div>

        {sel.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EEECFE', border: '1px solid #ddd6fb', borderRadius: 10, padding: '9px 12px', marginBottom: 10 }}>
            <b style={{ fontSize: '0.79rem', color: '#5B4BD6' }}>{sel.size} seleccionada{sel.size === 1 ? '' : 's'}</b>
            <button onClick={cerrarSeleccionadas}
              style={{ border: 'none', background: '#4FBF95', color: '#fff', borderRadius: 8, padding: '6px 13px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar hechas</button>
            <button onClick={() => setSel(new Set())}
              style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#7a6fc9', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar selección</button>
          </div>
        )}

        {lista.length === 0 && (
          <div style={{ color: '#999', fontSize: '0.83rem', padding: '14px 0' }}>
            {rows.length === 0
              ? 'Todavía no hay mejoras capturadas. Se agregan desde la ficha de cada cliente, en la pestaña Mejoras.'
              : 'Nada con ese filtro.'}
          </div>
        )}

        {/* La vista "Todo" agrupa por cliente —después de tres juntas seguidas
            lo que quieres ver es "Live Shows: 4 pendientes", no cuatro
            renglones perdidos entre los de otros— y ahí el nombre va en el
            encabezado, no repetido veinte veces. Las vistas específicas van en
            lista corrida, que es como se revisa una cosa a la vez. */}
        {VISTAS.find(v => v.id === vista)?.agrupa
          ? grupos.map(g => {
            const vencG = g.items.filter((m: any) => idsVencidas.has(m.id)).length;
            const pendG = g.items.filter(esPendiente).length;
            const plegado = plegados.has(g.id);
            return (
              <div key={g.id} style={{ marginBottom: 6 }}>
                {/* Rejilla FIJA de dos filas, con o sin vencidas: nombre arriba
                    y, abajo, contadores a la izquierda con «Copiar» anclado a la
                    derecha. Con flex envolvente cada grupo se veía distinto y la
                    misma acción cambiaba de sitio al bajar por la lista. */}
                <div className="cons-grupo" onClick={() => alterna(plegados, setPlegados, g.id)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alterna(plegados, setPlegados, g.id); } }}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '2px 10px', padding: '12px 0 8px', borderTop: '1px solid #f0eff3', cursor: 'pointer', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span style={{ color: '#b0aec0', fontSize: '0.7rem', flexShrink: 0, transform: plegado ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    <b style={{ fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{g.nombre}</b>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C0554E', whiteSpace: 'nowrap', justifySelf: 'end' }}>
                    {vencG > 0 ? `${vencG} vencida${vencG === 1 ? '' : 's'}` : ''}
                  </span>
                  {/* El separador se inserta ENTRE contadores, nunca al inicio. */}
                  <span style={{ fontSize: '0.75rem', color: '#8f8d98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, paddingLeft: 19 }}>
                    {[pendG > 0 ? `${pendG} por entregar` : null, `${g.items.length} en total`].filter(Boolean).join(' · ')}
                  </span>
                  <button onClick={e => { e.stopPropagation(); copiarGrupo(g); }}
                    title="Copiar la lista de este cliente"
                    style={{ border: 'none', background: 'none', padding: '4px 0 4px 10px', fontSize: '0.78rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', justifySelf: 'end' }}>
                    Copiar
                  </button>
                </div>
                {!plegado && g.items.map((m: any) => renglon(m, false))}
              </div>
            );
          })
          : lista.map(m => renglon(m, true))}
      </div>

      </>)}

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
      {aviso && (
        <div className="crm-toast-bottom" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>{aviso}</div>
      )}
    </div>
  );
}
