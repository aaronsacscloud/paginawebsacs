import { useEffect, useState } from 'react';

/* ═══ Inteligencia ARR — un solo tablero que consolida las métricas de un
 * sistema de suscripciones de clase mundial, en lenguaje claro para el dueño.
 * Todo sale de /api/crm/arr/intelligence (ledger + datos reales). ═══ */

const S = {
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  h: { fontSize: '0.95rem', fontWeight: 800, margin: '0 0 4px' } as const,
  sub: { fontSize: '0.72rem', color: '#999', margin: '0 0 12px' } as const,
  kpi: { flex: 1, minWidth: 130, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: '12px 14px' } as const,
  kLabel: { fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.4px' },
  kVal: { fontSize: '1.35rem', fontWeight: 800, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' as const },
  th: { textAlign: 'left' as const, padding: '7px 9px', fontSize: '0.64rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, borderBottom: '1px solid #f0f0f0' },
  td: { padding: '7px 9px', fontSize: '0.78rem', color: '#333', borderBottom: '1px solid #f7f7f7' },
  btn: { padding: '7px 14px', border: '1px solid #ddd', background: '#fff', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' } as const,
};
const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtMes = (m: string) => { const [y, mo] = m.split('-'); return `${MESES[+mo - 1]} ${String(y).slice(2)}`; };
const fmtDate = (d?: string | null) => d ? (() => { const [y, m, dd] = d.split('-'); return `${+dd} ${MESES[+m - 1]}`; })() : '—';

export default function InteligenciaView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const j = await fetch('/api/crm/arr/intelligence').then(r => r.json());
      if (j.error) throw new Error(j.error);
      setD(j);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Calculando inteligencia del negocio…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btn} onClick={load}>Reintentar</button></div>;

  const w = d.waterfall, ret = d.retencion, rev = d.revenue;
  const maxForecast = Math.max(1, ...d.forecast.map((f: any) => f.esperado));
  const exportUrl = '/api/crm/arr/export-contable';

  return (
    <div>
      {/* Encabezado y export contable */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={S.kpi}><div style={S.kLabel}>MRR activo</div><div style={S.kVal}>{money(d.mrr_activo)}</div></div>
        <div style={S.kpi}><div style={S.kLabel}>ARR activo</div><div style={S.kVal}>{money(d.arr_activo)}</div></div>
        <div style={S.kpi}><div style={S.kLabel}>Clientes activos</div><div style={S.kVal}>{d.clientes_activos}</div></div>
        <div style={{ flex: 1 }} />
        <a href={exportUrl} style={{ ...S.btn, textDecoration: 'none', color: '#1a1a1a' }} download>⬇ Exportar pagos (contador)</a>
        <button style={S.btn} onClick={load}>↻</button>
      </div>

      {!d.con_ledger && (
        <div style={{ ...S.card, background: '#FFFBEB', borderColor: '#FDE68A', fontSize: '0.8rem', color: '#92400E' }}>
          📖 El <strong>ledger de movimientos MRR</strong> apenas empieza a acumular historia. NRR/GRR y el waterfall se calculan de aquí en adelante conforme cambien las suscripciones; el resto de métricas ya usa tus datos reales.
        </div>
      )}

      {/* 1 · Waterfall MRR del mes */}
      <div style={S.card}>
        <h3 style={S.h}>Movimiento de MRR este mes</h3>
        <p style={S.sub}>De dónde crece o se encoge tu ingreso recurrente. Verde suma, rojo resta.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[['Nuevo', w.new, '#1A8F7A'], ['Expansión', w.expansion, '#2AB5A0'], ['Reactivación', w.reactivation, '#4B7BE5'], ['Contracción', w.contraction, '#E8A838'], ['Churn', w.churn, '#E54B4B']].map(([l, v, c]: any) => (
            <div key={l} style={{ ...S.kpi, borderLeft: `3px solid ${c}` }}>
              <div style={S.kLabel}>{l}</div>
              <div style={{ ...S.kVal, fontSize: '1.05rem', color: v < 0 ? '#b93333' : v > 0 ? '#137a67' : '#999' }}>{v > 0 ? '+' : ''}{money(v)}</div>
            </div>
          ))}
          <div style={{ ...S.kpi, background: '#1a1a1a' }}>
            <div style={{ ...S.kLabel, color: '#bbb' }}>Neto del mes</div>
            <div style={{ ...S.kVal, color: '#fff', fontSize: '1.05rem' }}>{(w.new + w.expansion + w.reactivation + w.contraction + w.churn) >= 0 ? '+' : ''}{money(w.new + w.expansion + w.reactivation + w.contraction + w.churn)}</div>
          </div>
        </div>
      </div>

      {/* 2 · Retención: NRR / GRR / logo churn */}
      <div style={S.card}>
        <h3 style={S.h}>Retención de ingreso</h3>
        <p style={S.sub}>NRR &gt; 100% = tu base crece sola aunque no vendas nada nuevo. GRR mide cuánto conservas sin contar expansión.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={S.kpi}><div style={S.kLabel}>NRR (neto)</div><div style={{ ...S.kVal, color: ret.nrr == null ? '#bbb' : ret.nrr >= 100 ? '#137a67' : '#b93333' }}>{ret.nrr == null ? 'acumulando' : ret.nrr + '%'}</div></div>
          <div style={S.kpi}><div style={S.kLabel}>GRR (bruto)</div><div style={{ ...S.kVal, color: ret.grr == null ? '#bbb' : '#1a1a1a' }}>{ret.grr == null ? 'acumulando' : ret.grr + '%'}</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Logo churn 30d</div><div style={{ ...S.kVal, color: ret.logo_churn_pct > 5 ? '#b93333' : '#1a1a1a' }}>{ret.logo_churn_pct}%</div><div style={{ fontSize: '0.66rem', color: '#999' }}>{ret.churn_30d} se fueron</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Save-rate 90d</div><div style={{ ...S.kVal, color: ret.save_rate == null ? '#bbb' : ret.save_rate >= 30 ? '#137a67' : '#a06600' }}>{ret.save_rate == null ? '—' : ret.save_rate + '%'}</div><div style={{ fontSize: '0.66rem', color: '#999' }}>{ret.saves_90d || 0} retenidos</div></div>
        </div>
        {Object.keys(ret.razones || {}).length > 0 && (
          <div style={{ marginTop: 10, fontSize: '0.74rem', color: '#666' }}>
            <strong>Por qué se van (90d):</strong> {Object.entries(ret.razones).sort((a: any, b: any) => b[1] - a[1]).map(([r, n]: any) => `${r} (${n})`).join(' · ')}
          </div>
        )}
      </div>

      {/* 3 · Forecast de cobranza vs cobrado + ingreso reconocido/diferido */}
      <div style={S.card}>
        <h3 style={S.h}>Forecast de cobranza (12 meses)</h3>
        <p style={S.sub}>Lo que deberías cobrar mes a mes. Este mes llevas cobrado {money(d.cobrado_mes)} de {money(d.forecast[0]?.esperado)} esperado.</p>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, marginBottom: 6 }}>
          {d.forecast.map((f: any, i: number) => (
            <div key={f.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div title={money(f.esperado)} style={{ width: '100%', height: Math.max(2, Math.round(96 * f.esperado / maxForecast)), background: i === 0 ? '#1A8F7A' : '#2AB5A0', borderRadius: '3px 3px 0 0' }} />
              <div style={{ fontSize: '0.58rem', color: '#999' }}>{fmtMes(f.mes)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={S.kpi}><div style={S.kLabel}>Ingreso reconocido / mes</div><div style={S.kVal}>{money(rev.reconocido_mes)}</div><div style={{ fontSize: '0.64rem', color: '#999' }}>lo que "ganas" cada mes (un anual reconoce 1/12)</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Ingreso diferido</div><div style={S.kVal}>{money(rev.diferido)}</div><div style={{ fontSize: '0.64rem', color: '#999' }}>anuales ya cobrados aún por reconocer</div></div>
        </div>
      </div>

      {/* 4 · Pipeline de renovaciones */}
      <div style={S.card}>
        <h3 style={S.h}>Renovaciones próximas (90 días) · {d.renovaciones.total} · {money(d.renovaciones.monto)}</h3>
        <p style={S.sub}>Trátalas como ventas: cada renovación grande merece seguimiento. Ordenadas por fecha.</p>
        <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Fecha', 'Cliente', 'Plan', 'Monto', 'Salud'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{d.renovaciones.proximas.map((r: any) => (
              <tr key={r.subscription_id}>
                <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{fmtDate(r.fecha)}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{r.cliente || r.empresa}{r.cuenta && r.cuenta !== (r.cliente || r.empresa) ? <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.72rem' }}> · {r.cuenta}</span> : null}</td>
                <td style={S.td}>{r.plan}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{money(r.monto)}</td>
                <td style={S.td}>{r.salud == null ? '—' : <span style={{ fontWeight: 700, color: r.salud >= 70 ? '#1A8F7A' : r.salud >= 40 ? '#a06600' : '#b93333' }}>{r.salud}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
          {!d.renovaciones.proximas.length && <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Sin renovaciones en los próximos 90 días.</div>}
        </div>
      </div>

      {/* 5 · Riesgo de churn (cola de trabajo de CS) */}
      <div style={S.card}>
        <h3 style={S.h}>Clientes en riesgo · {d.riesgo.total} · {money(d.riesgo.arr)} de ARR</h3>
        <p style={S.sub}>Score combina uso real en SACS (días sin vender), salud y cercanía de renovación. Ataca de arriba hacia abajo.</p>
        <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Riesgo', 'Cliente', 'Plan', 'ARR', 'Sin vender', 'Salud', 'Renueva en'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{d.riesgo.lista.map((r: any) => (
              <tr key={r.subscription_id}>
                <td style={S.td}><span style={{ display: 'inline-block', minWidth: 34, textAlign: 'center', padding: '2px 6px', borderRadius: 6, fontWeight: 800, fontSize: '0.7rem', background: r.score >= 60 ? '#FEE2E2' : r.score >= 35 ? '#FEF3C7' : '#F3F4F6', color: r.score >= 60 ? '#B91C1C' : r.score >= 35 ? '#92400E' : '#6B7280' }}>{r.score}</span></td>
                <td style={{ ...S.td, fontWeight: 700 }}>{r.cliente || r.empresa}{r.cuenta && r.cuenta !== (r.cliente || r.empresa) ? <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.72rem' }}> · {r.cuenta}</span> : null}</td>
                <td style={S.td}>{r.plan}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{money(r.arr)}</td>
                <td style={{ ...S.td, color: r.dias_sin_venta > 15 ? '#b93333' : r.dias_sin_venta >= 3 ? '#a06600' : '#333' }}>{r.dias_sin_venta == null ? '—' : r.dias_sin_venta + 'd'}</td>
                <td style={S.td}>{r.salud == null ? '—' : r.salud}</td>
                <td style={S.td}>{r.renueva_en == null ? '—' : r.renueva_en + 'd'}</td>
              </tr>
            ))}</tbody>
          </table>
          {!d.riesgo.lista.length && <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Ningún cliente activo en riesgo. 🎉</div>}
        </div>
      </div>

      {/* 6 · Cohortes de retención */}
      <div style={S.card}>
        <h3 style={S.h}>Cohortes de retención (por mes de alta)</h3>
        <p style={S.sub}>De las suscripciones que iniciaron cada mes, cuántas siguen activas hoy. Revela si un mes/canal retiene mejor.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Alta', 'Entraron', 'Siguen', 'Retención', 'MRR vivo'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{d.cohortes.map((c: any) => (
              <tr key={c.mes}>
                <td style={{ ...S.td, fontWeight: 700 }}>{fmtMes(c.mes)}</td>
                <td style={S.td}>{c.total}</td>
                <td style={S.td}>{c.activas}</td>
                <td style={S.td}>
                  <span style={{ display: 'inline-block', width: 46, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', verticalAlign: 'middle', marginRight: 6 }}>
                    <span style={{ display: 'block', height: '100%', width: c.retencion + '%', background: c.retencion >= 70 ? '#1A8F7A' : c.retencion >= 40 ? '#E8A838' : '#E54B4B' }} />
                  </span>{c.retencion}%
                </td>
                <td style={{ ...S.td, fontWeight: 700 }}>{money(c.mrr)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* 7 · Precio vs. valor entregado */}
      <Repricing />

      {/* 8 · Giro del cliente (IA) */}
      <Giros />
    </div>
  );
}

/* ── Precio vs. valor entregado ────────────────────────────────────────────
 * Por cada $10,000 que el cliente transacciona en SACS, ¿cuánto nos paga? Entre
 * clientes hay diferencias de 3× por el mismo producto, y eso no se arregla
 * vendiendo un módulo: se arregla en la renovación. */
function Repricing() {
  const [d, setD] = useState<any>(null);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { if (abierto && !d) fetch('/api/crm/arr/repricing').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' })); }, [abierto]);
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={S.h}>Precio vs. valor entregado</h3>
          <p style={{ ...S.sub, margin: 0 }}>Cuánto nos paga al año por cada $10,000 que mueve en SACS. Los de hasta arriba están subvaluados.</p>
        </div>
        <button style={S.btn} onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Ver ranking'}</button>
      </div>
      {abierto && !d && <div style={{ padding: 16, color: '#999', fontSize: '0.8rem' }}>Calculando…</div>}
      {abierto && d?.error && <div style={{ padding: 16, color: '#b93333', fontSize: '0.8rem' }}>{d.error}</div>}
      {abierto && d?.data && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
            <div style={S.kpi}><div style={S.kLabel}>Mediana</div><div style={S.kVal}>${d.mediana_pesos_por_10k}</div><div style={{ fontSize: '0.66rem', color: '#999' }}>por cada $10k movidos</div></div>
            <div style={S.kpi}><div style={S.kLabel}>Clientes medidos</div><div style={S.kVal}>{d.clientes}</div></div>
            <div style={S.kpi}><div style={S.kLabel}>Brecha total a la mediana</div><div style={{ ...S.kVal, color: '#1A8F7A' }}>{money(d.oportunidad_total)}</div><div style={{ fontSize: '0.66rem', color: '#999' }}>referencia para negociar, no precio</div></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Cuenta', 'Plan', 'ARR', 'Transacciona 30d', 'Suc.', '$ por cada $10k', 'Brecha'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{d.data.slice(0, 20).map((f: any) => (
                <tr key={f.company_id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{f.sacs_account || f.nombre}</td>
                  <td style={S.td}>{f.plan || '—'}</td>
                  <td style={S.td}>{money(f.arr)}</td>
                  <td style={S.td}>{money(f.transacciona_30d)}<div style={{ fontSize: '0.66rem', color: '#aaa' }}>{f.ventas_30d.toLocaleString()} ventas</div></td>
                  <td style={S.td}>{f.sucursales || '—'}</td>
                  <td style={{ ...S.td, fontWeight: 800, color: d.mediana_pesos_por_10k && f.pesos_por_10k < d.mediana_pesos_por_10k * 0.6 ? '#b93333' : '#333' }}>${f.pesos_por_10k}</td>
                  <td style={{ ...S.td, color: '#1A8F7A', fontWeight: 700 }}>{f.arr_a_la_mediana > 0 ? '+' + money(f.arr_a_la_mediana) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Giro del cliente, deducido con IA ─────────────────────────────────────
 * Sin giro no se puede comparar contra pares, que es el argumento de venta más
 * persuasivo. Se PROPONE primero: nada se guarda hasta que se aprueba. */
function Giros() {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState('');
  async function correr(aplicar: boolean) {
    setCargando(true); setErr('');
    try {
      const j = await fetch('/api/crm/arr/clasificar-giro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limite: 15, aplicar }),
      }).then(r => r.json());
      if (j.error) setErr(j.error); else setD(j);
    } catch (e: any) { setErr(e?.message || String(e)); }
    setCargando(false);
  }
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={S.h}>Giro del cliente · deducido con IA 🤖</h3>
          <p style={{ ...S.sub, margin: 0 }}>Lee el catálogo real de cada cuenta y deduce a qué se dedica. Sirve para comparar contra pares del mismo giro, que es lo que convence al vender.</p>
        </div>
        <button style={S.btn} disabled={cargando} onClick={() => correr(false)}>{cargando ? 'Analizando…' : 'Proponer (no guarda)'}</button>
        {d?.data?.length > 0 && <button style={{ ...S.btn, background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' }} disabled={cargando} onClick={() => correr(true)}>Guardar los propuestos</button>}
      </div>
      {err && <div style={{ marginTop: 10, color: '#b93333', fontSize: '0.8rem', fontWeight: 600 }}>{err}</div>}
      {d?.data && (
        <>
          <div style={{ fontSize: '0.72rem', color: '#999', margin: '10px 0' }}>
            {d.clasificadas} clasificadas · {d.alta_confianza} con confianza alta{d.costo_usd != null ? ` · costó $${d.costo_usd.toFixed(4)} USD` : ''}
            {d.aplicado ? ' · GUARDADO' : ' · solo propuesta'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Cuenta', 'Giro propuesto', 'Confianza', 'Por qué'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{d.data.map((f: any) => (
                <tr key={f.company_id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{f.cuenta}</td>
                  <td style={S.td}>{f.giro}</td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 800, color: f.confianza >= 0.85 ? '#1A8F7A' : f.confianza >= 0.7 ? '#a06600' : '#b93333' }}>{Math.round(f.confianza * 100)}%</span>
                    {f.confianza < 0.85 && <span style={{ fontSize: '0.66rem', color: '#a06600' }}> · revisar</span>}
                  </td>
                  <td style={{ ...S.td, color: '#666' }}>{f.evidencia}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
