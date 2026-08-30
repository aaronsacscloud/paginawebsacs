/**
 * CHURN · la sección de rescate.
 *
 * Vive debajo de Clientes y trabaja a los que ya cancelaron. La anatomía es la
 * misma de Leads a propósito —KPIs arriba, pestañas por etapa, tabla con las
 * columnas que esa pestaña necesita— porque quien usa una ya sabe usar la otra.
 *
 * Lo que la hace distinta es el dato que manda: aquí no importa tanto cuándo
 * entró como si ESTÁ USANDO EL SISTEMA. Una gracia de 30 días con el sistema
 * en cero ya fracasó, y eso se tiene que ver desde la lista, sin abrir nada.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CSS_TABLA, T } from '../../../lib/crm/tabla.estilo';
import { ETAPAS, ETAPA, MOTIVOS, MOTIVO, diasDeGracia, saludDeGracia, type Etapa } from '../../../lib/crm/churn.reglas';
import { useIsMobile } from '../../../lib/ui/mobile';
import ChurnCaso from './ChurnCaso';

const dinero = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const diasDesde = (iso?: string | null) => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;
const fechaCorta = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso), h = new Date();
  if (d.toDateString() === h.toDateString()) return 'hoy';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '');
};

const PESTANAS: { id: string; l: string }[] = [
  { id: 'detectado', l: 'Detectados' },
  { id: 'conciliacion', l: 'En conciliación' },
  { id: 'gracia', l: 'En gracia' },
  { id: 'recuperado', l: 'Recuperados' },
  { id: 'irrecuperable', l: 'Irrecuperables' },
  { id: 'todos', l: 'Todos' },
];

/* El semáforo del uso real. Es la columna que justifica el módulo: sale del
   sync nocturno que ya existía y contesta «¿le sirvió que le devolviéramos el
   acceso?» sin abrir el caso. */
const TONOS: Record<string, { fg: string; bg: string }> = {
  bien: { fg: '#1E8A63', bg: '#EAF8F2' },
  ojo: { fg: '#a06600', bg: '#FFF8EC' },
  mal: { fg: '#C0554E', bg: '#FDF6F5' },
  nd: { fg: '#74727F', bg: '#f4f4f6' },
};

export default function ChurnTab() {
  const esMovil = useIsMobile();
  const [etapa, setEtapa] = useState<string>('detectado');
  const [filas, setFilas] = useState<any[] | null>(null);
  const [cuenta, setCuenta] = useState<any>({});
  const [kpis, setKpis] = useState<any>({});
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const rejaRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const cargar = () => {
    fetch(`/api/crm/churn?etapa=${etapa}`)
      .then(r => r.json())
      .then(j => { setFilas(j.data || []); setCuenta(j.cuenta || {}); setKpis(j.kpis || {}); })
      .catch(() => setFilas([]));
  };
  useEffect(() => { cargar(); }, [etapa]);
  // La selección no sobrevive a un cambio de vista: actuar en bloque sobre
  // gente que ya no se ve es el bug que costó caro en Leads.
  useEffect(() => { setSel(new Set()); }, [etapa, busca]);

  // Deep-link de la campana: ?caso=<id> abre el caso exacto.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('caso');
    if (id && id.length > 20) setAbierto(id);
  }, []);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return filas || [];
    return (filas || []).filter((c: any) =>
      `${c.companies?.nombre || ''} ${c.motivo_detalle || ''} ${c.gracia_acuerdo || ''}`.toLowerCase().includes(t));
  }, [filas, busca]);

  /* Columnas que solo existen donde significan algo: en «Detectados» la etapa
     es siempre la misma y la columna sería el nombre de la pestaña repetido. */
  const verEtapa = etapa === 'todos';
  const verGracia = etapa === 'gracia' || etapa === 'todos';
  const verCierre = etapa === 'recuperado' || etapa === 'irrecuperable';
  const nCols = 7 + (verEtapa ? 1 : 0) + (verGracia ? 1 : 0) + (verCierre ? 1 : 0);
  const ancho = 890 + (verEtapa ? 120 : 0) + (verGracia ? 190 : 0) + (verCierre ? 200 : 0);

  // El alto se mide contra el borde real, no con un número inventado.
  useEffect(() => {
    const el = scrollRef.current, reja = rejaRef.current;
    if (!el || !reja) return;
    const medir = () => {
      reja.setAttribute('data-mas', el.scrollWidth - el.clientWidth - el.scrollLeft > 8 ? '1' : '0');
      reja.style.setProperty('--crm-tabla-alto', `${Math.max(280, Math.round(window.innerHeight - reja.getBoundingClientRect().top - 24))}px`);
    };
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', medir); window.removeEventListener('resize', medir); ro?.disconnect(); };
  }, [etapa, lista.length]);

  const K = ({ v, l, tono }: { v: any; l: string; tono?: 'rojo' | 'verde' }) => (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: '13px 16px', minWidth: 150, flex: '1 1 150px' }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums',
        color: tono === 'rojo' ? '#C0554E' : tono === 'verde' ? '#1E8A63' : '#241d43' }}>{v}</div>
      <div style={{ fontSize: '0.72rem', color: '#71707C', marginTop: 2, lineHeight: 1.35 }}>{l}</div>
    </div>
  );

  if (esMovil) return <ChurnMovil lista={lista} etapa={etapa} setEtapa={setEtapa} cuenta={cuenta} kpis={kpis}
    abierto={abierto} setAbierto={setAbierto} recargar={cargar} />;

  return (
    <div style={{ padding: '18px 22px 40px' }}>
      <style>{`
        ${CSS_TABLA}
        .churn-chip { border:1px solid #e8e5f0; background:#fff; color:#5a5a63; border-radius:20px; padding:7px 14px;
          font-size:0.8rem; font-weight:600; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:7px; }
        .churn-chip.on { background:#EEECFE; border-color:#c9bcf7; color:#5B4BD6; font-weight:800; }
        .churn-chip .n { font-size:0.7rem; font-weight:700; opacity:.6; font-variant-numeric:tabular-nums; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', color: '#241d43', margin: 0 }}>Churn</h1>
        <span style={{ fontSize: '0.83rem', color: '#71707C' }}>Los que cancelaron y se están rescatando.</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0 18px' }}>
        <K v={dinero(kpis.mrr_en_rescate)} l="MRR en rescate (casos abiertos)" tono="rojo" />
        <K v={dinero(kpis.mrr_recuperado)} l="MRR recuperado" tono="verde" />
        <K v={kpis.tasa_recuperacion == null ? '—' : kpis.tasa_recuperacion + '%'} l="De los cerrados, cuántos volvieron" />
        <K v={kpis.gracia_vencida || 0} l="Gracias vencidas sin decidir" tono={kpis.gracia_vencida ? 'rojo' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {PESTANAS.map(p => (
          <button key={p.id} className={`churn-chip ${etapa === p.id ? 'on' : ''}`} onClick={() => setEtapa(p.id)}>
            {p.l}<span className="n">{cuenta[p.id] ?? 0}</span>
          </button>
        ))}
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente o acuerdo…"
          style={{ marginLeft: 'auto', minWidth: 240, border: '1px solid #e2e4e9', borderRadius: 10, padding: '8px 12px',
            fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }} />
      </div>

      {filas === null ? <div style={{ padding: 40, color: '#8e88a8' }}>Cargando…</div>
      : lista.length === 0 ? (
        <div style={{ padding: '46px 20px', textAlign: 'center', color: '#71707C', background: '#fff',
          border: '1px solid #eae7f2', borderRadius: 14 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#241d43' }}>
            {etapa === 'detectado' ? 'Nadie sin atender.' : 'Nada en esta etapa.'}
          </div>
          <div style={{ fontSize: '0.83rem', marginTop: 4 }}>{ETAPA(etapa as Etapa).d}</div>
        </div>
      ) : (
      <div className="crm-reja" ref={rejaRef}>
        <span className="crm-orilla" aria-hidden="true" />
        <div className="crm-scroll-tabla" ref={scrollRef}>
          <table className="crm-tabla" style={{ minWidth: ancho }}>
            <thead><tr>
              <th scope="col" className="fija0" style={{ ...T.th, width: 40 }}>
                <input type="checkbox" aria-label="Seleccionar todos los de esta vista"
                  checked={lista.length > 0 && sel.size === lista.length}
                  ref={el => { if (el) el.indeterminate = sel.size > 0 && sel.size < lista.length; }}
                  onChange={e => setSel(e.target.checked ? new Set(lista.map((c: any) => c.id)) : new Set())} />
              </th>
              <th scope="col" className="fija1" style={{ ...T.th, width: 104 }}>Canceló</th>
              <th scope="col" className="fija2" style={{ ...T.th, width: 210 }}>Cliente</th>
              <th scope="col" className="num" style={{ ...T.th, width: 104 }}>MRR</th>
              <th scope="col" style={{ ...T.th, width: 190 }}>Por qué se fue</th>
              {verGracia && <th scope="col" style={{ ...T.th, width: 190 }}>Gracia</th>}
              <th scope="col" style={{ ...T.th, width: 150 }}>Uso del sistema</th>
              {verEtapa && <th scope="col" style={{ ...T.th, width: 120 }}>Etapa</th>}
              {verCierre && <th scope="col" style={{ ...T.th, width: 200 }}>Cierre</th>}
              <th scope="col" style={{ ...T.th, width: 150 }}>Siguiente paso</th>
              <th scope="col" className="derecha" style={{ ...T.th, width: 92 }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Acciones</span>
              </th>
            </tr></thead>
            <tbody>
              {lista.map((c: any) => {
                const emp = c.companies || {};
                const salud = saludDeGracia(c, emp);
                const tono = TONOS[salud.tono];
                const quedan = diasDeGracia(c);
                const et = ETAPA(c.etapa);
                const tel = c._tel || null;
                return (
                  <Fragment key={c.id}>
                  <tr className={sel.has(c.id) ? 'sel' : undefined}>
                    <td className="fija0" style={T.td} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(c.id)}
                        aria-label={`Seleccionar a ${emp.nombre || 'este cliente'}`}
                        onChange={e => setSel(prev => { const n = new Set(prev); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
                    </td>
                    <td className="fija1" style={T.td}>
                      <span style={{ fontWeight: 600, color: '#4a4a52', fontSize: '0.76rem' }}>{fechaCorta(c.detectado_at)}</span>
                      {/* Los tiempos se calculan sobre fechas REALES: 22 de los
                          35 históricos vinieron de Excel sin fecha, y decirlo
                          es lo que evita que un promedio mienta. */}
                      <span style={{ ...T.sub, display: 'block' }} title={c.fecha_estimada ? 'Fecha estimada: el registro vino de Excel sin fecha de cancelación' : undefined}>
                        hace {diasDesde(c.detectado_at)} d{c.fecha_estimada ? ' ~' : ''}
                      </span>
                    </td>
                    <td className="fija2" style={T.td}>
                      <button type="button" className="crm-fila-nom" style={T.nombre} onClick={() => setAbierto(c.id)}
                        title={emp.nombre || undefined}>{emp.nombre || 'Sin nombre'}</button>
                      <span style={{ ...T.sub, display: 'block' }}>
                        {emp.sucursales ? `${emp.sucursales} ${emp.sucursales === 1 ? 'sucursal' : 'sucursales'}` : emp.plan || '—'}
                        {c.episodio > 1 && <b style={{ color: '#C0554E', marginLeft: 6 }}>·  {c.episodio}ª vez que se va</b>}
                      </span>
                    </td>
                    <td className="num" style={{ ...T.td, fontWeight: 700, color: '#241d43' }}>{dinero(c.mrr_perdido)}</td>
                    <td style={T.td}>
                      {c.motivo_categoria
                        ? <span style={T.tag('#f4f4f6', '#5D6470')}>{MOTIVO(c.motivo_categoria)}</span>
                        : <span style={T.vacio}>sin clasificar</span>}
                      {(c.motivo_detalle || c.motivo_original) && (
                        <span style={{ ...T.sub, display: 'block' }} title={c.motivo_detalle || c.motivo_original}>
                          {c.motivo_detalle || c.motivo_original}
                        </span>
                      )}
                    </td>
                    {verGracia && (
                      <td style={T.td}>
                        {c.etapa === 'gracia' && quedan != null ? (<>
                          <span style={{ fontWeight: 700, color: quedan < 0 ? '#C0554E' : quedan <= 7 ? '#a06600' : '#241d43' }}>
                            {quedan < 0 ? `venció hace ${Math.abs(quedan)} d` : `quedan ${quedan} d`}
                          </span>
                          <span style={{ ...T.sub, display: 'block' }} title={c.gracia_acuerdo}>{c.gracia_acuerdo}</span>
                        </>) : <span style={T.vacio}>—</span>}
                      </td>
                    )}
                    <td style={T.td}>
                      {/* La pregunta que de verdad decide: ¿lo está usando? */}
                      <span style={T.tag(tono.bg, tono.fg)}>{salud.texto}</span>
                    </td>
                    {verEtapa && <td style={T.td}><span style={T.tag(et.bg, et.fg)}>{et.l}</span></td>}
                    {verCierre && (
                      <td style={T.td}>
                        <span style={{ color: c.resultado === 'recuperado' ? '#1E8A63' : '#5D6470', fontWeight: 600 }}>
                          {c.resultado === 'recuperado' ? `Volvió a ${dinero(c.gracia_mrr || c.mrr_perdido)}` : 'Perdido'}
                        </span>
                        {c.resultado_motivo && <span style={{ ...T.sub, display: 'block' }} title={c.resultado_motivo}>{c.resultado_motivo}</span>}
                      </td>
                    )}
                    <td style={T.td}>
                      {c.proximo_paso
                        ? (<><span style={{ color: '#5c5870' }} title={c.proximo_paso}>{c.proximo_paso}</span>
                            <span style={{ ...T.sub, display: 'block', color: c.proximo_paso_at && c.proximo_paso_at < new Date().toISOString().slice(0, 10) ? '#C0554E' : undefined }}>
                              {c.proximo_paso_at || 'sin fecha'}</span></>)
                        : <span style={T.vacio}>sin definir</span>}
                    </td>
                    <td className="derecha" style={{ ...T.td, padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {tel && (
                        <a className="crm-fila-wa" href={'https://wa.me/' + String(tel).replace(/\D/g, '')} target="_blank" rel="noreferrer"
                          aria-label="Escribir por WhatsApp" onClick={e => e.stopPropagation()}
                          style={{ width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#1E8A63', verticalAlign: 'middle' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                            <path d="M21 11.5a8.5 8.5 0 01-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1121 11.5z" strokeLinejoin="round" /></svg>
                        </a>
                      )}
                      <button aria-label={`Abrir el caso de ${emp.nombre || 'este cliente'}`} onClick={() => setAbierto(c.id)}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid transparent', background: 'none',
                          color: '#6B6A76', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}>›</button>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {sel.size > 0 && (
          <div style={{ position: 'sticky', bottom: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', background: '#241d43', color: '#fff', borderRadius: '0 0 12px 12px', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '0.83rem' }}>{sel.size} {sel.size === 1 ? 'caso' : 'casos'}</b>
            <button onClick={() => setSel(new Set())} style={{ background: 'none', border: 'none', color: '#c9c2ec', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.76rem', fontWeight: 600 }}>Quitar la selección</button>
            <div style={{ flex: 1 }} />
            <button style={T.btnSel} onClick={() => exportar(lista.filter((c: any) => sel.has(c.id)))}>Exportar</button>
          </div>
        )}
      </div>
      )}

      {abierto && <ChurnCaso id={abierto} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
    </div>
  );
}

function exportar(filas: any[]) {
  const cols = ['Canceló', 'Cliente', 'MRR', 'Motivo', 'Detalle', 'Etapa', 'Acuerdo de gracia', 'Fin de gracia', 'Días sin vender'];
  const datos = filas.map((c: any) => [
    String(c.detectado_at || '').slice(0, 10), c.companies?.nombre || '', c.mrr_perdido,
    MOTIVO(c.motivo_categoria), c.motivo_detalle || c.motivo_original || '',
    ETAPA(c.etapa).l, c.gracia_acuerdo || '', c.gracia_fin || '', c.companies?.dias_sin_venta ?? '',
  ]);
  const csv = [cols, ...datos].map(f => f.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `churn-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

/* ── Móvil: la misma información con los estándares m-* ───────────────── */
function ChurnMovil({ lista, etapa, setEtapa, cuenta, kpis, abierto, setAbierto, recargar }: any) {
  return (
    <div>
      <div className="m-hdr"><div className="m-tt">Churn</div></div>
      <div style={{ padding: '0 20px 10px' }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#C0554E', letterSpacing: '-.02em' }}>{dinero(kpis.mrr_en_rescate)}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--m-soft)' }}>en rescate · {cuenta.todos || 0} casos abiertos</div>
      </div>
      <div className="crm-scroll-x" style={{ display: 'flex', gap: 6, padding: '4px 20px 12px', overflowX: 'auto' }}>
        {PESTANAS.map((p: any) => (
          <button key={p.id} onClick={() => setEtapa(p.id)} className={etapa === p.id ? 'seg-on' : undefined}
            style={{ flex: 'none', border: 'none', borderRadius: 20, padding: '0 14px', minHeight: 38, fontFamily: 'inherit',
              fontSize: 13, fontWeight: etapa === p.id ? 800 : 600, cursor: 'pointer',
              background: etapa === p.id ? '#EEECFE' : 'transparent', color: etapa === p.id ? '#5B4BD6' : 'var(--m-soft)' }}>
            {p.l} {cuenta[p.id] ?? 0}
          </button>
        ))}
      </div>
      {(lista || []).map((c: any) => {
        const emp = c.companies || {};
        const salud = saludDeGracia(c, emp);
        const quedan = diasDeGracia(c);
        return (
          <div key={c.id} className="m-row m-conv" onClick={() => setAbierto(c.id)}>
            <div className="m-tx">
              <div className="m-cab">
                <div className="m-n1">{emp.nombre || 'Sin nombre'}</div>
                <span className="m-hora" style={{ fontWeight: 700, color: '#C0554E' }}>{dinero(c.mrr_perdido)}</span>
              </div>
              <div className="m-emp">
                {MOTIVO(c.motivo_categoria)}
                <span className="m-sep"> · </span>
                <span className="m-ciclo">{ETAPA(c.etapa).l}</span>
              </div>
              <div className="m-n2">
                <span className="m-txt" style={{ color: TONOS[salud.tono].fg, fontWeight: 600 }}>
                  {c.etapa === 'gracia' && quedan != null ? `${quedan < 0 ? 'gracia vencida' : `quedan ${quedan} d`} · ` : ''}{salud.texto}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {abierto && <ChurnCaso id={abierto} onCerrar={() => setAbierto(null)} onCambio={recargar} />}
    </div>
  );
}
