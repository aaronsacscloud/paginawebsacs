// Mejoras e ideas de TODAS las cuentas.
//
// Las mejoras viven dentro de cada ficha, así que el conjunto no se veía: ni
// cuánto dinero hay parado en ideas abiertas —un embudo entero de clientes que
// YA te pagan, el más barato de cerrar— ni qué se prometió y ya venció.
//
// Lo vencido va primero y en rojo. Una promesa que no llegó hace más daño que
// una que nunca se hizo, y es lo único de esta pantalla que se atiende hoy.
import { useEffect, useMemo, useRef, useState } from 'react';
import ClienteDrawer360 from './ClienteDrawer360';
import { MODOS, modoDe } from '../../../lib/crm/modulos-sacs';
import Cargando, { Corazones } from './ui/Cargando';
import KpiCard from './ui/KpiCard';

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

// ── Las vistas ──
// Separan por NATURALEZA del trabajo, no por estado interno: una capacitación
// no se cotiza ni se entrega como una personalización. "Pendientes" es la
// excepción a propósito —es el estado— porque es la pregunta con la que se abre
// la pantalla: qué le debo a mis clientes. La categoría `pendiente` existe pero
// solo la usa 1 de 40 renglones; si la vista fuera esa, nacería vacía.
const VISTAS: { id: string; l: string; f: (m: any) => boolean; agrupa?: boolean; urge?: boolean }[] = [
  { id: 'todo',       l: 'Todo',                        f: () => true, agrupa: true },
  { id: 'pend',       l: 'Pendientes',                  f: esPendiente, urge: true },
  { id: 'mejoras',    l: 'Mejoras y personalizaciones', f: m => ['personalizacion', 'plugin', 'modulo', 'ajuste'].includes(m.categoria) },
  { id: 'capacita',   l: 'Capacitaciones',              f: m => m.categoria === 'capacitacion' },
  { id: 'ideas',      l: 'Ideas',                       f: m => m.estado === 'idea' },
  { id: 'entregadas', l: 'Entregadas',                  f: m => m.estado === 'entregada' },
];

const S = {
  wrap: { maxWidth: 1280, margin: '0 auto', padding: 24 } as const,
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
function AvisoHallazgos() {
  const [r, setR] = useState<any>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/crm/soporte/hallazgos?estado=pendiente')
      .then(x => x.json()).then(j => { if (vivo && !j.error) setR(j.resumen || null); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  const n = r?.pendientes || 0;
  if (!n) return null;
  const t = r?.por_tipo || {};
  // El desglose tiene que sumar el total o el aviso se contradice solo: decía
  // "85 revisiones" y enumeraba 31 porque las dudas no estaban en la lista.
  const partes = [
    t.duda ? `${t.duda} ${t.duda === 1 ? 'duda de capacitación' : 'dudas de capacitación'}` : '',
    t.mejora ? `${t.mejora} ${t.mejora === 1 ? 'mejora' : 'mejoras'}` : '',
    t.oportunidad ? `${t.oportunidad} ${t.oportunidad === 1 ? 'oportunidad' : 'oportunidades'}` : '',
    t.riesgo ? `${t.riesgo} de riesgo` : '',
    t.testimonio ? `${t.testimonio} ${t.testimonio === 1 ? 'testimonio' : 'testimonios'}` : '',
  ].filter(Boolean);
  return (
    <div style={{ background: '#EEECFE', border: '1px solid #cdbdf7', borderRadius: 11, padding: '12px 15px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240, fontSize: '0.8rem', color: '#5B4BD6', lineHeight: 1.55 }}>
        <b>Tienes {n} {n === 1 ? 'revisión pendiente' : 'revisiones pendientes'} de lo que los clientes pidieron por soporte</b>
        {partes.length > 0 && <> — {partes.join(', ')}.</>}
        <div style={{ fontSize: '0.72rem', color: '#6d4bc7', opacity: 0.85, marginTop: 2 }}>
          Salieron de leer el chat de Intercom anoche. Acepta las que apliquen y se crean aquí o en la bandeja de oportunidades.
        </div>
      </div>
      <button onClick={() => window.dispatchEvent(new CustomEvent('sacs-ir-tab', { detail: 'soporte' }))}
        style={{ border: 'none', borderRadius: 9, padding: '8px 16px', background: '#5B4BD6', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        Revisarlas
      </button>
    </div>
  );
}

export default function MejorasTab() {
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
  const [tipo, setTipo] = useState<string>('todo');
  const [origen, setOrigen] = useState<string>('todo');   // salió de juntas recientes
  const [verSemana, setVerSemana] = useState(false);
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

  const lista = useMemo(() => {
    let r = rows || [];
    const v = VISTAS.find(x => x.id === vista) || VISTAS[0];
    r = r.filter(v.f);
    const al = ALERTAS.find(a => a.id === alerta);
    if (al) r = r.filter(al.f);
    if (tipo !== 'todo') r = r.filter(m => (m.categoria || 'otro') === tipo);
    // Lo que nació en juntas recientes: la lista de seguimiento de después de
    // las reuniones, que hoy había que armar a ojo.
    if (origen !== 'todo') {
      const desde = enDias(-Number(origen));
      r = r.filter(m => m.bookings?.fecha && m.bookings.fecha >= desde);
    }
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
  }, [rows, vista, alerta, tipo, origen, busca, idsVencidas, idsSemana]);

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
    if (!confirm(`¿Marcar ${ids.length} como hechas?`)) return;
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
    const c = cat(m.categoria);
    const iAct = PASOS.indexOf(m.estado);
    const fechaTxt = m.fecha_entrega ? `Entregada ${fmtDate(m.fecha_entrega)}`
      : m.fecha_compromiso ? `${venc ? '⚠ ' : ''}Para el ${fmtDate(m.fecha_compromiso)}`
      : 'Sin fecha';

    return (
      <div key={m.id} style={{ borderTop: '1px solid #f5f4f8' }}>
        <div onClick={() => alterna(expandidos, setExpandidos, m.id)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alterna(expandidos, setExpandidos, m.id); } }}
          style={{ display: 'flex', gap: 11, padding: '11px 0', alignItems: 'flex-start', cursor: 'pointer' }}>
          {m.estado !== 'entregada' && m.estado !== 'descartada'
            ? <input type="checkbox" checked={sel.has(m.id)} onClick={e => alternarSel(e, m.id)} onChange={() => {}} style={{ marginTop: 4, cursor: 'pointer', flexShrink: 0 }} />
            : <span style={{ width: 13, flexShrink: 0 }} />}
          <span style={{ flex: '0 0 8px', height: 8, borderRadius: 99, background: PUNTO[m.estado] || '#C9C7D0', marginTop: 6 }} />
          {conCliente && (
            <div style={{ flex: '0 0 170px', fontSize: '0.79rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.companies?.nombre_comercial || m.companies?.nombre || '—'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {m.titulo}
              <span style={{ fontSize: '0.57rem', fontWeight: 800, background: c.bg, color: c.fg, borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span>{PASO_L[m.estado] || m.estado}</span>
              {m.bookings?.fecha && <><span>·</span><span>de la junta del {fmtDate(m.bookings.fecha)}</span></>}
              {m.quotes?.numero && <><span>·</span><span>{m.quotes.numero}</span></>}
              {nReag > 0 && <><span>·</span><span style={{ color: '#C0554E', fontWeight: 700 }}>reagendada {nReag} {nReag === 1 ? 'vez' : 'veces'}</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <button
              onClick={e => {
                e.stopPropagation();
                if (m.estado === 'entregada') return;
                setExpandidos(x => new Set(x).add(m.id));
                setEditFecha({ id: m.id, fecha: m.fecha_compromiso || '', motivo: '' });
              }}
              title={m.estado === 'entregada' ? 'Ya entregada' : 'Cambiar la fecha de entrega'}
              style={{
                fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 8, padding: '3px 9px',
                border: '1px solid', fontFamily: 'inherit', cursor: m.estado === 'entregada' ? 'default' : 'pointer',
                ...(venc ? { borderColor: '#EF7A72', background: '#FEF0EF', color: '#C0554E' }
                  : m.estado === 'entregada' ? { borderColor: '#cdeadd', background: '#EAF8F2', color: '#1E8A63' }
                  : { borderColor: '#eceaf3', background: '#fff', color: '#8a8a92' }),
              }}>{fechaTxt}{m.estado !== 'entregada' ? ' ✎' : ''}</button>
            <div style={{ fontSize: '0.79rem', fontWeight: 800, whiteSpace: 'nowrap', color: m.cortesia ? '#a5a2af' : m.estado === 'entregada' ? '#1E8A63' : '#2C5FC4' }}>
              {m.cortesia ? 'Cortesía' : Number(m.valor) > 0 ? (m.estado === 'idea' ? '~' : '') + money(m.valor) : '—'}
            </div>
          </div>
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
            {editFecha?.id === m.id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, padding: '11px 13px' }}>
                <span style={{ width: '100%', fontSize: '0.58rem', letterSpacing: '.11em', textTransform: 'uppercase', color: '#b0aec0', fontWeight: 700 }}>
                  {m.fecha_compromiso ? 'Mover la fecha de entrega' : 'Poner fecha de entrega'}
                </span>
                <input type="date" autoFocus value={editFecha.fecha}
                  onChange={e => setEditFecha(f => (f ? { ...f, fecha: e.target.value } : f))}
                  style={{ border: '1.5px solid #e4dffb', borderRadius: 8, padding: '6px 9px', fontSize: '0.78rem', fontFamily: 'inherit', background: '#fdfcff' }} />
                {m.fecha_compromiso && (
                  <select value={editFecha.motivo} onChange={e => setEditFecha(f => (f ? { ...f, motivo: e.target.value } : f))}
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
            {editLiga?.id === m.id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, padding: '11px 13px' }}>
                <span style={{ width: '100%', fontSize: '0.58rem', letterSpacing: '.11em', textTransform: 'uppercase', color: '#b0aec0', fontWeight: 700 }}>Liga de lo entregado</span>
                <input autoFocus value={editLiga.url} onChange={e => setEditLiga(l => (l ? { ...l, url: e.target.value } : l))}
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
                ['Entregado como', m.estado === 'entregada' ? (m.url ? (m.modo || 'con liga') : '⚠️ sin liga de entrega') : (m.modo || '—')],
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
        @media (max-width: 620px)  { .cons-alertas { grid-template-columns:1fr; } }
      `}</style>
      <AvisoHallazgos />
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Consultoría</h2>
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
        <KpiCard label="Sobre la mesa" franja="#7DA6F5" color="#2C5FC4"
          valor={money(k.potencial)} sub={`${k.ideas} ideas en ${k.cuentasConIdeas} cuentas`}
          onClick={() => { setVista('ideas'); setAlerta(''); }} />
      </div>

      {/* ── Las vistas ── */}
      <div className="crm-scroll-x" style={{ display: 'flex', gap: 2, borderBottom: '1px solid #ececf2', marginBottom: 16 }}>
        {VISTAS.map(v => {
          const n = (rows || []).filter(v.f).length;
          const on = vista === v.id;
          const urge = v.urge && vencidas.length > 0;
          return (
            <button key={v.id} onClick={() => { setVista(v.id); setAlerta(''); }}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                padding: '9px 13px', marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: '0.85rem', fontWeight: on ? 800 : 600, color: on ? '#5B4BD6' : '#83808e',
                borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent', whiteSpace: 'nowrap',
              }}>
              {v.l}
              <span style={{
                background: urge && !on ? '#FEF0EF' : on ? '#EEECFE' : '#f4f4f6',
                color: urge && !on ? '#C0554E' : on ? '#5B4BD6' : '#8a8a92',
                borderRadius: 20, padding: '1px 8px', fontSize: '0.67rem', fontWeight: 800,
              }}>{n}</span>
            </button>
          );
        })}
      </div>

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente o mejora…"
            style={{ minWidth: 260, padding: '8px 12px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.78rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' }} />
          <Desplegable etiqueta="Tipo" valor={tipo} onCambio={setTipo}
            opciones={[{ v: 'todo', l: 'Todos' }, ...Object.entries(CATS).map(([k, v]) => ({ v: k, l: v.label }))]} />
          <Desplegable etiqueta="Salió de" valor={origen} onCambio={setOrigen}
            opciones={[{ v: 'todo', l: 'Cualquier junta' }, { v: '7', l: 'Juntas de 7 días' }, { v: '30', l: 'Juntas de 30 días' }]} />
          {alerta && (
            <button onClick={() => setAlerta('')} style={S.chip(true)}>
              {ALERTAS.find(a => a.id === alerta)?.k} ✕
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
                <div onClick={() => alterna(plegados, setPlegados, g.id)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alterna(plegados, setPlegados, g.id); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 0 6px', borderTop: '1px solid #f0eff3', cursor: 'pointer', flexWrap: 'wrap' }}>
                  <span style={{ color: '#b0aec0', fontSize: '0.7rem', transform: plegado ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                  <b style={{ fontSize: '0.85rem' }}>{g.nombre}</b>
                  {vencG > 0 && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FEF0EF', color: '#C0554E', borderRadius: 20, padding: '2px 8px' }}>
                      {vencG} vencida{vencG === 1 ? '' : 's'}
                    </span>
                  )}
                  {pendG > 0 && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#f1f0f5', color: '#8a8a92', borderRadius: 20, padding: '2px 8px' }}>
                      {pendG} por entregar
                    </span>
                  )}
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#f1f0f5', color: '#8a8a92', borderRadius: 20, padding: '2px 8px' }}>{g.items.length} en total</span>
                  <button onClick={e => { e.stopPropagation(); copiarGrupo(g); }}
                    style={{ marginLeft: 'auto', border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Copiar lista
                  </button>
                </div>
                {!plegado && g.items.map((m: any) => renglon(m, false))}
              </div>
            );
          })
          : lista.map(m => renglon(m, true))}
      </div>

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
      {aviso && (
        <div className="crm-toast-bottom" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>{aviso}</div>
      )}
    </div>
  );
}
