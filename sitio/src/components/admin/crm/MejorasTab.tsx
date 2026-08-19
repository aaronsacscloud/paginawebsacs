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

export default function MejorasTab() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<'todo' | 'pendientes' | 'idea' | 'comprometidas' | 'entregada'>('pendientes');
  const [tipo, setTipo] = useState<string>('todo');
  const [origen, setOrigen] = useState<string>('todo');   // salió de juntas recientes
  const [agrupado, setAgrupado] = useState(true);
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
    await fetch('/api/crm/mejoras', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, estado: 'entregada' }),
    }).catch(() => {});
    cargar();
  }
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

  const lista = useMemo(() => {
    let r = rows || [];
    if (filtro === 'pendientes') r = r.filter(m => m.estado === 'cotizada' || m.estado === 'en_proceso');
    else if (filtro === 'idea') r = r.filter(m => m.estado === 'idea');
    else if (filtro === 'comprometidas') r = r.filter(m => m.estado === 'cotizada' || m.estado === 'en_proceso');
    else if (filtro === 'entregada') r = r.filter(m => m.estado === 'entregada');
    if (tipo !== 'todo') r = r.filter(m => (m.categoria || 'otro') === tipo);
    // Lo que nació en juntas recientes: la lista de seguimiento de después de
    // las reuniones, que hoy había que armar a ojo.
    if (origen !== 'todo') {
      const desde = enDias(-Number(origen));
      r = r.filter(m => m.bookings?.fecha && m.bookings.fecha >= desde);
    }
    const t = busca.trim().toLowerCase();
    if (t) r = r.filter(m => `${m.titulo} ${m.descripcion || ''} ${m.companies?.nombre_comercial || m.companies?.nombre || ''}`.toLowerCase().includes(t));
    // En "por hacer" manda la fecha comprometida: lo que vence primero, primero.
    if (filtro === 'pendientes') r = r.slice().sort((a, b) =>
      String(a.fecha_compromiso || '9999').localeCompare(String(b.fecha_compromiso || '9999')));
    // Las ideas se ordenan por monto: lo primero que quieres ver es dónde está
    // el dinero más grande sin cerrar.
    if (filtro === 'idea') r = r.slice().sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    return r;
  }, [rows, filtro, tipo, origen, busca]);

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

  const renglon = (m: any, conCliente: boolean) => (
          <div key={m.id} onClick={() => setAbierto(m.company_id)}
            style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: '1px solid #f5f4f8', alignItems: 'flex-start', cursor: 'pointer' }}>
            {m.estado !== 'entregada' && m.estado !== 'descartada'
              ? <input type="checkbox" checked={sel.has(m.id)} onClick={e => alternarSel(e, m.id)} onChange={() => {}} style={{ marginTop: 4, cursor: 'pointer', flexShrink: 0 }} />
              : <span style={{ width: 13, flexShrink: 0 }} />}
            <span style={{ flex: '0 0 8px', height: 8, borderRadius: 99, background: PUNTO[m.estado] || '#C9C7D0', marginTop: 6 }} />
            {!conCliente ? null : (
              <div style={{ flex: '0 0 190px', fontSize: '0.79rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.companies?.nombre_comercial || m.companies?.nombre || '—'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                {m.titulo}
                <span style={{ fontSize: '0.57rem', fontWeight: 800, background: cat(m.categoria).bg, color: cat(m.categoria).fg, borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>{cat(m.categoria).label}</span>
              </div>
              {m.descripcion && <div style={{ fontSize: '0.73rem', color: '#71717a', lineHeight: 1.45, marginTop: 2 }}>{m.descripcion}</div>}
              <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4 }}>
                {m.fecha_entrega ? `Entregada ${fmtDate(m.fecha_entrega)}` : m.fecha_compromiso ? `Comprometida para el ${fmtDate(m.fecha_compromiso)}` : 'Sin fecha'}
                {m.quotes?.numero && ` · ${m.quotes.numero}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <div style={{ fontSize: '0.79rem', fontWeight: 800, whiteSpace: 'nowrap', color: m.cortesia ? '#a5a2af' : m.estado === 'entregada' ? '#1E8A63' : '#2C5FC4' }}>
                {m.cortesia ? 'Cortesía' : Number(m.valor) > 0 ? (m.estado === 'idea' ? '~' : '') + money(m.valor) : '—'}
              </div>
              {m.estado !== 'entregada' && m.estado !== 'descartada' && (
                <button onClick={e => marcarHecha(e, m)} title="Marcar hecha"
                  style={{ border: '1px solid #cdeadd', background: '#EAF8F2', color: '#1E8A63', borderRadius: 8, padding: '4px 9px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
              )}
            </div>
          </div>
  );

  return (
    <div style={S.wrap}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Consultoría</h2>
        <div style={{ fontSize: '0.79rem', color: '#8a8a8a', marginTop: 2 }}>
          Todo el trabajo con clientes: mejoras, capacitaciones, videos y pendientes.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={S.kpi}><div style={S.kl}>Entregadas este mes</div><div style={S.kv}>{k.entregadasMes}</div></div>
        <div style={S.kpi}><div style={S.kl}>Cobrado este año</div><div style={{ ...S.kv, color: '#1E8A63' }}>{money(k.cobradoAnio)}</div></div>
        <div style={S.kpi}>
          <div style={S.kl}>Capacitaciones</div>
          <div style={{ ...S.kv, color: (videosPorEnviar.length + capsAgendadas.length) ? '#9a6a10' : '#1a1a1a' }}>
            {videosPorEnviar.length + capsAgendadas.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 2 }}>
            pendientes · {k.capsDadas} dadas este año
          </div>
        </div>
        <div style={S.kpi}>
          <div style={S.kl}>Sobre la mesa</div>
          <div style={{ ...S.kv, color: '#2C5FC4' }}>{money(k.potencial)}</div>
          <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 2 }}>{k.ideas} ideas en {k.cuentasConIdeas} cuentas</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kl}>Por hacer</div>
          <div style={{ ...S.kv, color: vencidas.length ? '#C0554E' : '#1a1a1a' }}>{pendientes.length}</div>
          <div style={{ fontSize: '0.7rem', color: vencidas.length ? '#C0554E' : '#a5a2af', marginTop: 2 }}>
            {vencidas.length ? `${vencidas.length} ya vencidas` : 'ninguna vencida'}
          </div>
        </div>
      </div>

      {vencidas.length > 0 && (
        <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 12, padding: '13px 15px', marginBottom: 14 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#8c2f28', marginBottom: 7 }}>
            ⚠️ {vencidas.length} {vencidas.length === 1 ? 'compromiso vencido' : 'compromisos vencidos'}
          </div>
          {vencidas.map((v: any) => (
            <div key={v.id} onClick={() => setAbierto(v.company_id)}
              style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', fontSize: '0.79rem', color: '#C0554E', cursor: 'pointer' }}>
              <b style={{ color: '#8c2f28', minWidth: 170 }}>{v.cliente || 'Cuenta'}</b>
              <span style={{ flex: 1 }}>{v.titulo}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{v.dias} {v.dias === 1 ? 'día' : 'días'} tarde · prometido {fmtDate(v.fecha_compromiso)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Franja, no lista: el aviso crece a lo ANCHO y no a lo alto. En lista
          el nombre del cliente se repetía en cada renglón y la fecha se iba
          hasta el extremo derecho, así que cuatro pendientes ocupaban un tercio
          de la pantalla. Con quince sigue midiendo dos renglones. */}
      {estaSemana.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', background: '#fffdf7', border: '1px solid #f5e2b8', borderRadius: 11, padding: '9px 13px', marginBottom: 14 }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#9a6a10', whiteSpace: 'nowrap' }}>
            ⚠ Vence esta semana · {estaSemana.length}
          </span>
          {estaSemana.slice(0, verSemana ? estaSemana.length : 4).map((m: any) => (
            <button key={m.id} onClick={() => setAbierto(m.company_id)} title={m.companies?.nombre_comercial || m.companies?.nombre || ''}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #f2e6c8',
                borderRadius: 20, padding: '4px 11px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit',
                maxWidth: 300,
              }}>
              <b style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</b>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9a6a10', whiteSpace: 'nowrap' }}>
                {fmtDate(m.fecha_compromiso).replace(/ \d{4}$/, '')}
              </span>
            </button>
          ))}
          {estaSemana.length > 4 && (
            <button onClick={() => setVerSemana(v => !v)}
              style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: '0.7rem', fontWeight: 800, color: '#9a6a10', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {verSemana ? 'Ver menos' : `Ver todos (${estaSemana.length}) ›`}
            </button>
          )}
        </div>
      )}

      {(videosPorEnviar.filter(m => !idsSemana.has(m.id)).length > 0 || capsAgendadas.filter(m => !idsSemana.has(m.id)).length > 0) && (
        <div style={{ ...S.card, borderColor: '#f5e2b8', background: '#fffdf7' }}>
          <div style={S.h}>
            Capacitaciones pendientes
            <span style={S.nota}>{videosPorEnviar.length ? `${videosPorEnviar.length} video(s) por enviar` : ''}{videosPorEnviar.length && capsAgendadas.length ? ' · ' : ''}{capsAgendadas.length ? `${capsAgendadas.length} agendada(s)` : ''}</span>
          </div>
          {[...videosPorEnviar, ...capsAgendadas].filter(m => !idsSemana.has(m.id)).map(m => (
            <div key={m.id} onClick={() => setAbierto(m.company_id)}
              style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 0', borderTop: '1px solid #f7f1e4', fontSize: '0.8rem', cursor: 'pointer' }}>
              <b style={{ minWidth: 170, flexShrink: 0 }}>{m.companies?.nombre_comercial || m.companies?.nombre || 'Cuenta'}</b>
              <span style={{ flex: 1 }}>
                {m.titulo}
                {m.modulo && <span style={{ color: '#a5a2af' }}> · {m.modulo}</span>}
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9a6a10', whiteSpace: 'nowrap' }}>
                {MODOS[modoDe(m)].pendiente}{m.fecha_compromiso ? ` · ${fmtDate(m.fecha_compromiso)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {repetidas.length > 0 && (
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
          <Desplegable etiqueta="Estado" valor={filtro} onCambio={v => setFiltro(v as any)}
            opciones={[
              { v: 'pendientes', l: 'Por hacer' },
              { v: 'idea', l: 'Ideas abiertas' },
              { v: 'entregada', l: 'Entregadas' },
              { v: 'todo', l: 'Todas' },
            ]} />
          <Desplegable etiqueta="Tipo" valor={tipo} onCambio={setTipo}
            opciones={[{ v: 'todo', l: 'Todos' }, ...Object.entries(CATS).map(([k, v]) => ({ v: k, l: v.label }))]} />
          <Desplegable etiqueta="Salió de" valor={origen} onCambio={setOrigen}
            opciones={[{ v: 'todo', l: 'Cualquier junta' }, { v: '7', l: 'Juntas de 7 días' }, { v: '30', l: 'Juntas de 30 días' }]} />
          <button onClick={() => setAgrupado(a => !a)} style={S.chip(agrupado)}>{agrupado ? 'Agrupado por cliente' : 'Lista corrida'}</button>
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

        {/* Agrupado, el nombre del cliente va en el encabezado del grupo y no
            se repite en cada renglón: repetirlo veinte veces es ruido. */}
        {agrupado
          ? grupos.map(g => (
            <div key={g.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 0 4px', borderTop: '1px solid #f0eff3' }}>
                <b onClick={() => setAbierto(g.id)} style={{ fontSize: '0.85rem', cursor: 'pointer' }}>{g.nombre}</b>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#f1f0f5', color: '#8a8a92', borderRadius: 20, padding: '2px 8px' }}>{g.items.length}</span>
                <button onClick={() => copiarGrupo(g)}
                  style={{ marginLeft: 'auto', border: '1px solid #e2e4e9', background: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#5a5a63', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Copiar lista
                </button>
              </div>
              {g.items.map((m: any) => renglon(m, false))}
            </div>
          ))
          : lista.map(m => renglon(m, true))}
      </div>

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}
