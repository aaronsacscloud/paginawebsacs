// Mejoras e ideas de TODAS las cuentas.
//
// Las mejoras viven dentro de cada ficha, así que el conjunto no se veía: ni
// cuánto dinero hay parado en ideas abiertas —un embudo entero de clientes que
// YA te pagan, el más barato de cerrar— ni qué se prometió y ya venció.
//
// Lo vencido va primero y en rojo. Una promesa que no llegó hace más daño que
// una que nunca se hizo, y es lo único de esta pantalla que se atiende hoy.
import { useEffect, useMemo, useState } from 'react';
import ClienteDrawer360 from './ClienteDrawer360';
import { MODOS, modoDe } from '../../../lib/crm/modulos-sacs';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '';
const mesDe = (d?: string | null) => String(d || '').slice(0, 7);

const CATS: Record<string, string> = {
  personalizacion: 'personalización', plugin: 'plugin', ajuste: 'ajuste',
  modulo: 'módulo', capacitacion: 'capacitación', otro: 'otro',
};
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

export default function MejorasTab() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<'todo' | 'pendientes' | 'idea' | 'comprometidas' | 'entregada'>('pendientes');
  const [busca, setBusca] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = () => fetch('/api/crm/mejoras').then(r => r.json())
    .then(j => { setRows(j.data || []); setVencidas(j.vencidas || []); }).catch(() => setRows([]));
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

  const lista = useMemo(() => {
    let r = rows || [];
    if (filtro === 'pendientes') r = r.filter(m => m.estado === 'cotizada' || m.estado === 'en_proceso');
    else if (filtro === 'idea') r = r.filter(m => m.estado === 'idea');
    else if (filtro === 'comprometidas') r = r.filter(m => m.estado === 'cotizada' || m.estado === 'en_proceso');
    else if (filtro === 'entregada') r = r.filter(m => m.estado === 'entregada');
    const t = busca.trim().toLowerCase();
    if (t) r = r.filter(m => `${m.titulo} ${m.descripcion || ''} ${m.companies?.nombre_comercial || m.companies?.nombre || ''}`.toLowerCase().includes(t));
    // Las ideas se ordenan por monto: lo primero que quieres ver es dónde está
    // el dinero más grande sin cerrar.
    if (filtro === 'idea') r = r.slice().sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    return r;
  }, [rows, filtro, busca]);

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

  if (rows === null) return <div style={{ ...S.wrap, color: '#999', fontSize: '0.85rem' }}>Cargando mejoras…</div>;

  return (
    <div style={S.wrap}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Mejoras e ideas</h2>
        <div style={{ fontSize: '0.79rem', color: '#8a8a8a', marginTop: 2 }}>
          Lo que se ha entregado en todas las cuentas y lo que está sobre la mesa sin cerrar.
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

      {(videosPorEnviar.length > 0 || capsAgendadas.length > 0) && (
        <div style={{ ...S.card, borderColor: '#f5e2b8', background: '#fffdf7' }}>
          <div style={S.h}>
            Capacitaciones pendientes
            <span style={S.nota}>{videosPorEnviar.length ? `${videosPorEnviar.length} video(s) por enviar` : ''}{videosPorEnviar.length && capsAgendadas.length ? ' · ' : ''}{capsAgendadas.length ? `${capsAgendadas.length} agendada(s)` : ''}</span>
          </div>
          {[...videosPorEnviar, ...capsAgendadas].map(m => (
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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={S.kpi}><div style={S.kl}>Entregadas este mes</div><div style={S.kv}>{k.entregadasMes}</div></div>
        <div style={S.kpi}><div style={S.kl}>Cobrado este año</div><div style={{ ...S.kv, color: '#1E8A63' }}>{money(k.cobradoAnio)}</div></div>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {([['pendientes', 'Por hacer'], ['idea', 'Ideas abiertas'], ['entregada', 'Entregadas'], ['todo', 'Todas']] as const).map(([id, l]) => (
            <button key={id} onClick={() => setFiltro(id as any)} style={S.chip(filtro === id)}>{l}</button>
          ))}
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cuenta o mejora…"
            style={{ marginLeft: 'auto', minWidth: 240, padding: '7px 11px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.78rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' }} />
        </div>

        {lista.length === 0 && (
          <div style={{ color: '#999', fontSize: '0.83rem', padding: '14px 0' }}>
            {rows.length === 0
              ? 'Todavía no hay mejoras capturadas. Se agregan desde la ficha de cada cliente, en la pestaña Mejoras.'
              : 'Nada con ese filtro.'}
          </div>
        )}

        {lista.map(m => (
          <div key={m.id} onClick={() => setAbierto(m.company_id)}
            style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: '1px solid #f5f4f8', alignItems: 'flex-start', cursor: 'pointer' }}>
            <span style={{ flex: '0 0 8px', height: 8, borderRadius: 99, background: PUNTO[m.estado] || '#C9C7D0', marginTop: 6 }} />
            <div style={{ flex: '0 0 190px', fontSize: '0.79rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.companies?.nombre_comercial || m.companies?.nombre || '—'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                {m.titulo}
                <span style={{ fontSize: '0.57rem', fontWeight: 800, background: '#EEECFE', color: '#5B4BD6', borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>{CATS[m.categoria] || m.categoria}</span>
              </div>
              {m.descripcion && <div style={{ fontSize: '0.73rem', color: '#71717a', lineHeight: 1.45, marginTop: 2 }}>{m.descripcion}</div>}
              <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4 }}>
                {m.fecha_entrega ? `Entregada ${fmtDate(m.fecha_entrega)}` : m.fecha_compromiso ? `Comprometida para el ${fmtDate(m.fecha_compromiso)}` : 'Sin fecha'}
                {m.quotes?.numero && ` · ${m.quotes.numero}`}
              </div>
            </div>
            <div style={{ fontSize: '0.79rem', fontWeight: 800, whiteSpace: 'nowrap', color: m.cortesia ? '#a5a2af' : m.estado === 'entregada' ? '#1E8A63' : '#2C5FC4' }}>
              {m.cortesia ? 'Cortesía' : Number(m.valor) > 0 ? (m.estado === 'idea' ? '~' : '') + money(m.valor) : '—'}
            </div>
          </div>
        ))}
      </div>

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}
