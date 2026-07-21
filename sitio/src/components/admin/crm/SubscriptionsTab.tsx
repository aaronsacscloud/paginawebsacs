import { useEffect, useMemo, useState } from 'react';
import InteligenciaView from './InteligenciaView';

/* ═══════════════ Suscripciones & ARR — hub del negocio recurrente ═══════════════
 * KPIs + meta · lista de suscripciones (mensual/anual separados) · riesgo por
 * inactividad (3-15 / +15 días) · calendario de cobros + proyección 12 meses ·
 * registrar pago (activa el ARR) · cliente 360 (subs, pagos, actividad, notas). */

type Sub = {
  id: string; company_id: string | null; contact_id: string | null;
  nombre_plan: string; ciclo: 'mensual' | 'anual'; estado: string;
  precio: number; mrr: number; arr: number;
  fecha_inicio: string | null; proxima_factura: string | null; monto_proximo: number | null;
  pagos_realizados: number; total_pagado: number; razon_cancelacion: string | null; notas: string | null;
  companies?: { id: string; nombre: string; sacs_account: string | null; ultima_venta_at: string | null; dias_sin_venta: number | null; estado_cuenta: string } | null;
  contacts?: { id: string; nombre: string; email: string | null } | null;
};

const ESTADOS: Record<string, { label: string; bg: string; color: string }> = {
  activa:         { label: 'Activa',          bg: 'rgba(42,181,160,0.14)', color: '#1A8F7A' },
  pendiente_pago: { label: 'Pendiente',       bg: 'rgba(232,168,56,0.16)', color: '#a06600' },
  programada:     { label: 'Programada',      bg: 'rgba(75,123,229,0.12)', color: '#3764c4' },
  pausada:        { label: 'Pausada',         bg: 'rgba(150,150,150,0.15)', color: '#666' },
  cancelada:      { label: 'Cancelada',       bg: 'rgba(229,75,75,0.10)', color: '#b93333' },
};

const fmt = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';
const MES_NOM = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtMes = (m: string) => { const [y, mm] = m.split('-'); return MES_NOM[Number(mm) - 1] + ' ' + y.slice(2); };

export const S = {
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 18, marginBottom: 16 } as const,
  kpi: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 150 } as const,
  kLabel: { fontSize: '0.7rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  kValue: { fontSize: '1.45rem', fontWeight: 800, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' as const },
  kSub: { fontSize: '0.72rem', color: '#999' },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none' } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' } as const,
  btnSmall: { padding: '4px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' } as const,
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: '0.68rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.4px', borderBottom: '1px solid #eee' },
  td: { padding: '9px 10px', fontSize: '0.83rem', color: '#333', borderBottom: '1px solid #f4f4f4', fontVariantNumeric: 'tabular-nums' as const },
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' as const },
  drawer: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 'min(560px, 96vw)', background: '#fff', zIndex: 95, boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto' as const, padding: 22 },
  label: { fontSize: '0.72rem', fontWeight: 700, color: '#777', display: 'block', marginBottom: 3 } as const,
};

export function Estado({ e }: { e: string }) {
  const cfg = ESTADOS[e] || ESTADOS.programada;
  return <span style={{ ...S.badge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}

export default function SubscriptionsTab() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'subs' | 'riesgo' | 'cobranza' | 'conciliacion' | 'inteligencia'>('subs');
  const [editSub, setEditSub] = useState<Sub | null>(null);
  const [pagoPrefill, setPagoPrefill] = useState<{ subscription_id?: string; fecha?: string } | null>(null);
  const [fCiclo, setFCiclo] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fPlan, setFPlan] = useState('');
  const [fCliente, setFCliente] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [mesAbierto, setMesAbierto] = useState<string | null>(null);
  const [showPago, setShowPago] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [sRes, sumRes, pRes] = await Promise.all([
        fetch('/api/crm/arr/subscriptions').then(r => r.json()),
        fetch('/api/crm/arr/summary').then(r => r.json()),
        fetch('/api/crm/arr/plans').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      if (sRes.error) throw new Error(sRes.error);
      setSubs(sRes.data || []);
      setSummary(sumRes.error ? null : sumRes);
      setPlans(pRes?.data || []);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => subs.filter(s => {
    if (fCiclo && s.ciclo !== fCiclo) return false;
    if (fEstado && s.estado !== fEstado) return false;
    // Plan filtra por CATÁLOGO (plan_id) — agrupa todas las variantes de texto
    // libre bajo el plan canónico. '__none__' = subs sin plan de catálogo.
    if (fPlan) { if (fPlan === '__none__') { if ((s as any).plan_id) return false; } else if ((s as any).plan_id !== fPlan) return false; }
    if (fCliente && s.company_id !== fCliente) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [s.nombre_plan, s.companies?.nombre, s.companies?.sacs_account, s.contacts?.nombre, s.contacts?.email].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [subs, fCiclo, fEstado, fPlan, fCliente, search]);

  // Clientes para el filtro: distintos por empresa, ordenados por cuenta.
  const clientesOpts = useMemo(() => {
    const m = new Map<string, string>();
    subs.forEach(s => { if (s.company_id) m.set(s.company_id, s.companies?.sacs_account || s.companies?.nombre || s.company_id); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [subs]);
  const nSinPlan = useMemo(() => subs.filter(s => !(s as any).plan_id).length, [subs]);

  const k = summary?.kpis;
  const meta = summary?.meta;
  const riesgo = summary?.riesgo;
  const meses = summary?.meses || [];
  const vencidas = summary?.vencidas || [];
  const maxMes = Math.max(1, ...meses.map((m: any) => m.contratado + m.pendiente));

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando suscripciones…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── KPIs + meta ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={S.kpi}>
          <div style={S.kLabel}>ARR activo</div>
          <div style={S.kValue}>{fmt(k?.arr_activo)}</div>
          <div style={S.kSub}>{k?.subs_activas || 0} suscripciones · {k?.clientes_activos || 0} clientes</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kLabel}>Anuales</div>
          <div style={S.kValue}>{fmt(k?.anuales?.arr)}</div>
          <div style={S.kSub}>{k?.anuales?.n || 0} suscripciones · renuevan cada año</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kLabel}>Mensuales</div>
          <div style={S.kValue}>{fmt(k?.mensuales?.arr)}</div>
          <div style={S.kSub}>{k?.mensuales?.n || 0} suscripciones · cobran cada mes</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kLabel}>ARR en riesgo</div>
          <div style={{ ...S.kValue, color: (riesgo?.arr_en_riesgo || 0) > 0 ? '#b93333' : '#1A8F7A' }}>{fmt(riesgo?.arr_en_riesgo)}</div>
          <div style={S.kSub}>{(riesgo?.banda_3_15?.length || 0) + (riesgo?.banda_15_mas?.length || 0)} clientes sin vender ≥3 días</div>
        </div>
        <div style={{ ...S.kpi, minWidth: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={S.kLabel}>Meta ARR {meta?.anio}</span>
            <button style={{ ...S.btnSmall, padding: '1px 8px' }} onClick={() => setShowMeta(true)}>⚙</button>
          </div>
          {meta?.monto ? (<>
            <div style={S.kValue}>{meta.progreso_pct}%</div>
            <div style={{ height: 7, background: '#f0f0f0', borderRadius: 99, margin: '4px 0' }}>
              <div style={{ height: '100%', width: Math.min(100, meta.progreso_pct || 0) + '%', background: (meta.progreso_pct || 0) >= 100 ? '#1A8F7A' : '#4B7BE5', borderRadius: 99 }} />
            </div>
            <div style={S.kSub}>{fmt(k?.arr_activo)} de {fmt(meta.monto)}</div>
          </>) : <div style={{ ...S.kSub, marginTop: 8 }}>Sin meta configurada — da clic en ⚙</div>}
        </div>
      </div>

      {/* ── Barra de acciones + sub-vistas ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {(['subs', 'riesgo', 'cobranza', 'conciliacion', 'inteligencia'] as const).map(v => (
          <button key={v} onClick={() => setVista(v)}
            style={{ ...S.btn, background: vista === v ? '#1a1a1a' : '#f2f2f2', color: vista === v ? '#fff' : '#555' }}>
            {v === 'subs' ? 'Suscripciones' : v === 'riesgo' ? `Riesgo (${(riesgo?.banda_3_15?.length || 0) + (riesgo?.banda_15_mas?.length || 0)})` : v === 'cobranza' ? 'Cobranza y proyección' : v === 'conciliacion' ? 'Conciliación' : '★ Inteligencia ARR'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ ...S.btn, background: '#1A8F7A', color: '#fff' }} onClick={() => setShowPago(true)}>+ Registrar pago</button>
      </div>

      {/* ═══ VISTA SUSCRIPCIONES ═══ */}
      {vista === 'subs' && (
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, cuenta o plan…" style={{ ...S.input, flex: 1, minWidth: 180 }} />
            <select value={fCliente} onChange={e => setFCliente(e.target.value)} style={{ ...S.input, maxWidth: 200 }} title="Ver todas las suscripciones de un cliente">
              <option value="">Todos los clientes</option>
              {clientesOpts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <select value={fPlan} onChange={e => setFPlan(e.target.value)} style={S.input} title="Filtra por plan del catálogo">
              <option value="">Todos los planes</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              {nSinPlan > 0 && <option value="__none__">Sin plan de catálogo ({nSinPlan})</option>}
            </select>
            <select value={fCiclo} onChange={e => setFCiclo(e.target.value)} style={S.input}>
              <option value="">Todos los ciclos</option><option value="anual">Anuales</option><option value="mensual">Mensuales</option>
            </select>
            <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={S.input}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            {(fCliente || fPlan || fCiclo || fEstado || search) && (
              <button onClick={() => { setFCliente(''); setFPlan(''); setFCiclo(''); setFEstado(''); setSearch(''); }} style={{ ...S.btnSmall, alignSelf: 'center' }} title="Limpiar filtros">✕ Limpiar</button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Cliente', 'Plan', 'Ciclo', 'Estado', 'Precio', 'ARR', 'Próx. factura', 'Pagos', 'Total pagado', 'Últ. venta SACS', 'Salud', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(s => {
                  const dias = s.companies?.dias_sin_venta;
                  return (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => s.company_id && setDetailId(s.company_id)}>
                      <td style={S.td}>{(() => {
                        const cuenta = s.companies?.sacs_account || s.companies?.nombre || '';
                        // Nombre de la persona primero (para identificarlo rápido); la cuenta abajo.
                        const cliente = s.contacts?.nombre || (s.companies?.nombre !== cuenta ? s.companies?.nombre : '') || cuenta || '—';
                        return (<>
                          <div style={{ fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{cliente}</div>
                          {cuenta && cuenta !== cliente ? <div style={{ fontSize: '0.72rem', color: '#999', whiteSpace: 'nowrap' }}>{cuenta}</div> : null}
                        </>);
                      })()}</td>
                      <td style={S.td}>{s.nombre_plan}</td>
                      <td style={S.td}><span style={{ ...S.badge, background: s.ciclo === 'anual' ? 'rgba(108,92,231,0.12)' : 'rgba(75,123,229,0.12)', color: s.ciclo === 'anual' ? '#6C5CE7' : '#3764c4' }}>{s.ciclo}</span></td>
                      <td style={S.td}><Estado e={s.estado} /></td>
                      <td style={S.td}>{fmt(s.precio)}<span style={{ color: '#aaa' }}>/{s.ciclo === 'anual' ? 'año' : 'mes'}</span></td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmt(s.arr)}</td>
                      <td style={{ ...S.td, color: s.proxima_factura && s.proxima_factura < new Date().toISOString().slice(0, 10) && (s.estado === 'activa' || s.estado === 'pendiente_pago') ? '#b93333' : '#333' }}>{fmtDate(s.proxima_factura)}</td>
                      <td style={S.td}>{s.pagos_realizados}</td>
                      <td style={S.td}>{fmt(s.total_pagado)}</td>
                      <td style={{ ...S.td, color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#333' }}>
                        {s.companies?.ultima_venta_at ? fmtDate(s.companies.ultima_venta_at) + (dias != null ? ` (${dias}d)` : '') : '—'}
                      </td>
                      <td style={S.td}>{(() => { const h = (s.companies as any)?.health_score; if (h == null) return '—'; const c = h >= 70 ? '#1A8F7A' : h >= 40 ? '#a06600' : '#b93333'; return <span style={{ fontWeight: 800, color: c }}>{h}</span>; })()}</td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <button style={S.btnSmall} onClick={() => setEditSub(s)}>Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Sin suscripciones con esos filtros.</div>}
          </div>
        </div>
      )}

      {/* ═══ VISTA RIESGO ═══ */}
      {vista === 'riesgo' && (
        <div>
          {[{ titulo: '🔴 Más de 15 días sin vender — churn probable', items: riesgo?.banda_15_mas || [] },
            { titulo: '🟠 De 3 a 15 días sin vender — atender ya', items: riesgo?.banda_3_15 || [] }].map(sec => (
            <div key={sec.titulo} style={S.card}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>{sec.titulo} <span style={{ color: '#999', fontWeight: 400 }}>· {sec.items.length} cliente(s) · {fmt(sec.items.reduce((a: number, x: any) => a + x.arr, 0))} ARR</span></div>
              {sec.items.length ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Cliente', 'Cuenta SACS', 'Última venta', 'Días sin vender', 'ARR en juego', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>{sec.items.map((x: any) => (
                    <tr key={x.company_id}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{x.nombre}</td>
                      <td style={S.td}>{x.sacs_account}</td>
                      <td style={S.td}>{fmtDate(x.ultima_venta)}</td>
                      <td style={{ ...S.td, fontWeight: 800, color: x.dias_sin_venta > 15 ? '#b93333' : '#a06600' }}>{x.dias_sin_venta} días</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmt(x.arr)}</td>
                      <td style={S.td}><button style={S.btnSmall} onClick={() => setDetailId(x.company_id)}>Ver cliente</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div style={{ color: '#1A8F7A', fontSize: '0.85rem' }}>Nadie en esta banda. 🎉</div>}
            </div>
          ))}
          {riesgo?.sin_liga > 0 && <div style={{ ...S.card, color: '#999', fontSize: '0.8rem' }}>ℹ️ {riesgo.sin_liga} cliente(s) con cuenta ligada aún sin datos de actividad — corre el sync o espera al cron (cada 6 h).</div>}
        </div>
      )}

      {/* ═══ VISTA COBRANZA Y PROYECCIÓN ═══ */}
      {vista === 'cobranza' && (
        <div>
          {vencidas.length > 0 && (
            <div style={{ ...S.card, borderLeft: '4px solid #E54B4B' }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>⚠️ Facturas vencidas <span style={{ color: '#999', fontWeight: 400 }}>· {vencidas.length} · {fmt(vencidas.reduce((a: number, v: any) => a + v.monto, 0))}</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Cliente', 'Plan', 'Ciclo', 'Vencida desde', 'Días', 'Monto', 'Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{vencidas.map((v: any) => (
                  <tr key={v.subscription_id}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{v.empresa}{v.cuenta && v.cuenta !== v.empresa ? <div style={{ fontSize: '0.7rem', color: '#999', fontWeight: 400 }}>{v.cuenta}</div> : null}</td>
                    <td style={S.td}>{v.plan}</td>
                    <td style={S.td}>{v.ciclo}</td>
                    <td style={S.td}>{fmtDate(v.vencida_desde)}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: '#b93333' }}>{v.dias_vencida}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{fmt(v.monto)}</td>
                    <td style={S.td}>
                      <button style={{ ...S.btnSmall, background: '#e8f5e9', color: '#2e7d32', marginRight: 4 }} title="¿Ya se pagó? Regístralo con su fecha real"
                        onClick={() => { setPagoPrefill({ subscription_id: v.subscription_id }); setShowPago(true); }}>Registrar pago</button>
                      <StripeLinkBtn subId={v.subscription_id} />
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Proyección de cobros — próximos 12 meses</div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 14 }}>Verde = contratado (activas) · Ámbar = pendientes/programadas · La franja roja del contratado es de clientes hoy en riesgo. Da clic en un mes para ver sus cobros.</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 150, marginBottom: 8 }}>
              {meses.map((m: any) => (
                <div key={m.mes} onClick={() => setMesAbierto(mesAbierto === m.mes ? null : m.mes)} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: 'pointer', height: '100%' }} title={fmt(m.contratado + m.pendiente)}>
                  <div style={{ height: Math.round(140 * m.pendiente / maxMes), background: '#E8A838', borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                  <div style={{ height: Math.max(2, Math.round(140 * (m.contratado - m.enRiesgo) / maxMes)), background: mesAbierto === m.mes ? '#137a67' : '#2AB5A0' }} />
                  {m.enRiesgo > 0 && <div style={{ height: Math.round(140 * m.enRiesgo / maxMes), background: '#E54B4B' }} />}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {meses.map((m: any) => <div key={m.mes} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: mesAbierto === m.mes ? '#1a1a1a' : '#999', fontWeight: mesAbierto === m.mes ? 800 : 400 }}>{fmtMes(m.mes)}</div>)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
              <thead><tr>{['Mes', 'Contratado', 'Pendiente/programado', 'De clientes en riesgo', 'Total posible'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{meses.map((m: any) => (
                <tr key={m.mes} onClick={() => setMesAbierto(mesAbierto === m.mes ? null : m.mes)} style={{ cursor: 'pointer', background: mesAbierto === m.mes ? '#fafafa' : undefined }}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmtMes(m.mes)}</td>
                  <td style={{ ...S.td, color: '#1A8F7A', fontWeight: 700 }}>{fmt(m.contratado)}</td>
                  <td style={{ ...S.td, color: '#a06600' }}>{fmt(m.pendiente)}</td>
                  <td style={{ ...S.td, color: m.enRiesgo > 0 ? '#b93333' : '#999' }}>{fmt(m.enRiesgo)}</td>
                  <td style={{ ...S.td, fontWeight: 800 }}>{fmt(m.contratado + m.pendiente)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {mesAbierto && (() => {
            const m = meses.find((x: any) => x.mes === mesAbierto);
            if (!m) return null;
            return (
              <div style={S.card}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Cobros de {fmtMes(m.mes)} <span style={{ color: '#999', fontWeight: 400 }}>· {m.cobros.length} cobro(s)</span></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Fecha', 'Cliente', 'Plan', 'Ciclo', 'Estado', 'Monto'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>{m.cobros.map((c: any, i: number) => (
                    <tr key={i}>
                      <td style={S.td}>{fmtDate(c.fecha)}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{c.empresa}</td>
                      <td style={S.td}>{c.plan}</td>
                      <td style={S.td}>{c.ciclo}</td>
                      <td style={S.td}><Estado e={c.estado} /></td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.monto)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {vista === 'conciliacion' && <ConciliacionView onChanged={load} />}

      {vista === 'inteligencia' && <InteligenciaView />}

      {showPago && <RegistrarPagoModal subs={subs} prefill={pagoPrefill} onClose={() => { setShowPago(false); setPagoPrefill(null); }} onDone={() => { setShowPago(false); setPagoPrefill(null); load(); }} />}
      {editSub && <EditarSubModal sub={editSub} onClose={() => setEditSub(null)} onDone={() => { setEditSub(null); load(); }} />}
      {showMeta && <MetaModal meta={meta} onClose={() => setShowMeta(false)} onDone={() => { setShowMeta(false); load(); }} />}
      {detailId && <ClienteDrawer companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

/* ═══════════════ Modal: registrar pago (activa el ARR) ═══════════════ */
export function RegistrarPagoModal({ subs, prefill, onClose, onDone }: { subs: Sub[]; prefill?: { subscription_id?: string } | null; onClose: () => void; onDone: () => void }) {
  const [modo, setModo] = useState<'existente' | 'nuevo'>('existente');
  const [subId, setSubId] = useState(prefill?.subscription_id || '');
  const [form, setForm] = useState<any>({ ciclo: 'anual', metodo: 'transferencia', fecha: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cobrables = subs.filter(s => s.estado !== 'cancelada');
  const sel = cobrables.find(s => s.id === subId);

  async function guardar() {
    setErr(null);
    const monto = Number(form.monto);
    if (!isFinite(monto) || monto <= 0) { setErr('Ingresa el monto del pago.'); return; }
    if (modo === 'existente' && !subId) { setErr('Elige la suscripción que está pagando.'); return; }
    if (modo === 'nuevo' && !String(form.empresa || '').trim()) { setErr('Ingresa el nombre de la empresa (o su cuenta SACS).'); return; }
    setSaving(true);
    try {
      const body: any = { monto, fecha: form.fecha, metodo: form.metodo, referencia: form.referencia || null, notas: form.notas || null };
      if (modo === 'existente') body.subscription_id = subId;
      else Object.assign(body, {
        empresa: form.empresa, sacs_account: form.sacs_account || null,
        contacto_nombre: form.contacto_nombre || null, email: form.email || null,
        nombre_plan: form.nombre_plan || 'Licencia SACS', ciclo: form.ciclo, precio: Number(form.precio) || monto,
      });
      const res = await fetch('/api/crm/arr/register-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'No se pudo registrar');
      onDone();
    } catch (e: any) { setErr(e?.message || String(e)); setSaving(false); }
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Registrar pago</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setModo('existente')} style={{ ...S.btn, flex: 1, background: modo === 'existente' ? '#1a1a1a' : '#f2f2f2', color: modo === 'existente' ? '#fff' : '#555' }}>Cliente existente</button>
          <button onClick={() => setModo('nuevo')} style={{ ...S.btn, flex: 1, background: modo === 'nuevo' ? '#1a1a1a' : '#f2f2f2', color: modo === 'nuevo' ? '#fff' : '#555' }}>Cliente nuevo</button>
        </div>

        {modo === 'existente' ? (
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Suscripción que paga</label>
            <select value={subId} onChange={e => { setSubId(e.target.value); const s = cobrables.find(x => x.id === e.target.value); if (s) setForm((f: any) => ({ ...f, monto: s.monto_proximo ?? s.precio })); }} style={{ ...S.input, width: '100%' }}>
              <option value="">— elegir —</option>
              {cobrables.map(s => <option key={s.id} value={s.id}>{(s.companies?.nombre || '—') + ' · ' + s.nombre_plan + ' (' + s.ciclo + ') · próx ' + (s.proxima_factura || 's/f')}</option>)}
            </select>
            {sel && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>Al registrar: pasa a ACTIVA y su próxima factura se recorre un {sel.ciclo === 'anual' ? 'año' : 'mes'}.</div>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={S.label}>Empresa *</label><input value={form.empresa || ''} onChange={e => setForm({ ...form, empresa: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
            <div><label style={S.label}>Cuenta SACS (subdominio)</label><input value={form.sacs_account || ''} onChange={e => setForm({ ...form, sacs_account: e.target.value })} style={{ ...S.input, width: '100%' }} placeholder="ej. capstown" /></div>
            <div><label style={S.label}>Contacto</label><input value={form.contacto_nombre || ''} onChange={e => setForm({ ...form, contacto_nombre: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
            <div><label style={S.label}>Email</label><input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
            <div><label style={S.label}>Plan</label><input value={form.nombre_plan || ''} onChange={e => setForm({ ...form, nombre_plan: e.target.value })} style={{ ...S.input, width: '100%' }} placeholder="Licencia Controla Anual" /></div>
            <div><label style={S.label}>Ciclo</label><select value={form.ciclo} onChange={e => setForm({ ...form, ciclo: e.target.value })} style={{ ...S.input, width: '100%' }}><option value="anual">Anual</option><option value="mensual">Mensual</option></select></div>
            <div><label style={S.label}>Precio por {form.ciclo === 'anual' ? 'año' : 'mes'}</label><input type="number" value={form.precio || ''} onChange={e => setForm({ ...form, precio: e.target.value })} style={{ ...S.input, width: '100%' }} placeholder="= monto si vacío" /></div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={S.label}>Monto pagado (MXN) *</label><input type="number" value={form.monto || ''} onChange={e => setForm({ ...form, monto: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Método</label><select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} style={{ ...S.input, width: '100%' }}><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta / Stripe</option><option value="oxxo">OXXO</option><option value="otro">Otro</option></select></div>
          <div><label style={S.label}>Referencia</label><input value={form.referencia || ''} onChange={e => setForm({ ...form, referencia: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
        </div>
        <div style={{ marginTop: 10 }}><label style={S.label}>Notas</label><textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ ...S.input, width: '100%', height: 54, resize: 'vertical' }} /></div>

        {err && <div style={{ color: '#b93333', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
        <button onClick={guardar} disabled={saving} style={{ ...S.btn, width: '100%', marginTop: 14, background: '#1A8F7A', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Registrando…' : 'Registrar pago y activar ARR'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════ Modal: metas ═══════════════ */
function MetaModal({ meta, onClose, onDone }: { meta: any; onClose: () => void; onDone: () => void }) {
  const [anio, setAnio] = useState<number>(meta?.anio || new Date().getFullYear());
  const [monto, setMonto] = useState<string>(meta?.monto ? String(meta.monto) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    const m = Number(monto);
    if (!isFinite(m) || m <= 0) { setErr('Ingresa el monto de la meta.'); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch('/api/crm/arr/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'arr', anio, monto: m }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'No se pudo guardar');
      onDone();
    } catch (e: any) { setErr(e?.message || String(e)); setSaving(false); }
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...S.modal, maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Meta de ARR</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div><label style={S.label}>Año</label><input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Meta ARR (MXN)</label><input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={{ ...S.input, width: '100%' }} placeholder="3000000" /></div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 8 }}>El progreso se llena solo con cada suscripción activa.</div>
        {err && <div style={{ color: '#b93333', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
        <button onClick={guardar} disabled={saving} style={{ ...S.btn, width: '100%', marginTop: 14, background: '#1a1a1a', color: '#fff', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando…' : 'Guardar meta'}</button>
      </div>
    </div>
  );
}

/* ═══════════════ Drawer: cliente 360 ═══════════════ */
export function ClienteDrawer({ companyId, onClose, onChanged }: { companyId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/crm/arr/company360?id=' + companyId);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'No se pudo cargar');
      setData(j);
    } catch (e: any) { setErr(e?.message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [companyId]);

  async function agregarNota() {
    if (!nota.trim()) return;
    setSavingNota(true);
    try {
      await fetch('/api/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'nota', titulo: nota.trim().slice(0, 140), descripcion: nota.trim(), company_id: companyId }) });
      setNota(''); await load(); onChanged();
    } catch { /* la nota es reintentar-able */ }
    setSavingNota(false);
  }

  const co = data?.company;
  const act = co?.actividad;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 94 }} onClick={onClose} />
      <div style={S.drawer}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando cliente…</div> :
        err ? <div style={{ padding: 40, textAlign: 'center', color: '#E54B4B' }}>{err} <button style={S.btnSmall} onClick={load}>Reintentar</button></div> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800 }}>{data?.contacts?.[0]?.nombre || co?.nombre}{data?.contacts?.[0]?.email ? <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 400 }}> {'<' + data.contacts[0].email + '>'}</span> : null}</h3>
                <div style={{ fontSize: '0.78rem', color: '#999' }}>
                  {co?.sacs_account ? 'Cuenta SACS: ' + co.sacs_account : (co?.nombre && co.nombre !== data?.contacts?.[0]?.nombre ? co.nombre : 'Sin cuenta SACS ligada')}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '12px 0' }}>
              {[['Suscripciones activas', String(data.resumen.subs_activas)],
                ['ARR del cliente', fmt(data.resumen.arr)],
                ['Próxima factura', fmtDate(data.resumen.proxima_factura)],
                ['Veces que ha pagado', String(data.resumen.pagos_totales)],
                ['Total pagado histórico', fmt(data.resumen.total_pagado)],
                ['Salud', co?.dias_sin_venta != null ? (co.dias_sin_venta >= 3 ? co.dias_sin_venta + ' días sin vender' : 'Vendiendo ✓') : '—'],
              ].map(([l, v]) => (
                <div key={l} style={{ background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Actividad SACS */}
            <div style={{ fontWeight: 800, fontSize: '0.9rem', margin: '14px 0 6px' }}>Actividad real en SACS</div>
            {act ? (
              <div style={{ background: '#fafafa', borderRadius: 10, padding: 12, fontSize: '0.8rem' }}>
                <div>Última venta: <b>{fmtDate(act.ultima_venta)}</b> · Ventas 7d: <b>{act.ventas_7d}</b> · 30d: <b>{act.ventas_30d}</b> ({fmt(act.total_30d)})</div>
                <div style={{ margin: '6px 0' }}>Usuarios: <b>{act.usuarios}</b> (último creado {fmtDate(act.ultimo_usuario_at)}) · Sucursales: <b>{act.sucursales}</b></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {(act.modulos || []).length ? act.modulos.map((m: string) => <span key={m} style={{ ...S.badge, background: 'rgba(75,123,229,0.10)', color: '#3764c4' }}>{m}</span>) : <span style={{ color: '#b93333' }}>Sin módulos activos en 30 días</span>}
                </div>
              </div>
            ) : <div style={{ color: '#999', fontSize: '0.8rem' }}>{co?.sacs_account ? 'Aún sin datos del sync (corre cada 6 h).' : 'Liga la cuenta SACS para ver su actividad real.'}</div>}

            {/* Suscripciones */}
            <div style={{ fontWeight: 800, fontSize: '0.9rem', margin: '14px 0 6px' }}>Suscripciones</div>
            {(data.subscriptions || []).map((s: any) => (
              <div key={s.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.nombre_plan} <span style={{ color: '#999', fontWeight: 400 }}>· {s.ciclo}</span></div>
                  <div style={{ fontSize: '0.72rem', color: '#999' }}>{fmt(s.precio)}/{s.ciclo === 'anual' ? 'año' : 'mes'} · próx. {fmtDate(s.proxima_factura)} · {s.pagos_realizados} pago(s) · {fmt(s.total_pagado)} acumulado</div>
                </div>
                <Estado e={s.estado} />
              </div>
            ))}

            {/* Pagos */}
            <div style={{ fontWeight: 800, fontSize: '0.9rem', margin: '14px 0 6px' }}>Pagos ({(data.payments || []).length})</div>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{(data.payments || []).map((p: any) => {
                  const negativo = Number(p.monto) < 0 || p.es_ajuste;
                  return (
                  <tr key={p.id} style={{ opacity: p.reembolsado ? 0.5 : 1 }}>
                    <td style={{ ...S.td, fontSize: '0.78rem' }}>{fmtDate(p.fecha)}</td>
                    <td style={{ ...S.td, fontSize: '0.78rem' }}>{p.metodo}{p.migrado ? ' · histórico' : ''}{p.reembolsado ? ' · reembolsado' : ''}{negativo ? ' · ajuste' : ''}</td>
                    <td style={{ ...S.td, fontSize: '0.78rem', fontWeight: 700, textAlign: 'right', color: negativo ? '#b93333' : '#333' }}>{fmt(p.monto)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      {!p.reembolsado && !negativo && !p.migrado && (
                        <button style={{ ...S.btnSmall, padding: '2px 8px', color: '#b93333', fontSize: '0.7rem' }}
                          onClick={async () => { const m = prompt('Motivo del reembolso (opcional):', ''); if (m === null) return; const r = await fetch('/api/crm/arr/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_id: p.id, motivo: m }) }); const j = await r.json(); if (j.error) alert(j.error); else { load(); onChanged(); } }}>
                          Reembolsar
                        </button>
                      )}
                    </td>
                  </tr>
                ); })}</tbody>
              </table>
              {!(data.payments || []).length && <div style={{ padding: 14, color: '#999', fontSize: '0.8rem', textAlign: 'center' }}>Sin pagos registrados.</div>}
            </div>

            {/* Notas / timeline */}
            <div style={{ fontWeight: 800, fontSize: '0.9rem', margin: '14px 0 6px' }}>Notas y actividad</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={nota} onChange={e => setNota(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarNota(); }} placeholder="Escribe una nota de lo hablado con el cliente…" style={{ ...S.input, flex: 1 }} />
              <button onClick={agregarNota} disabled={savingNota || !nota.trim()} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', opacity: savingNota || !nota.trim() ? 0.5 : 1 }}>{savingNota ? '…' : 'Agregar'}</button>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {(data.activities || []).map((a: any) => (
                <div key={a.id} style={{ borderLeft: '3px solid ' + (a.tipo === 'nota' ? '#4B7BE5' : a.tipo === 'pago_recibido' ? '#1A8F7A' : '#ddd'), padding: '6px 10px', marginBottom: 6, background: '#fafafa', borderRadius: '0 8px 8px 0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{a.titulo || a.tipo}</div>
                  {a.descripcion && a.descripcion !== a.titulo && <div style={{ fontSize: '0.75rem', color: '#666' }}>{a.descripcion}</div>}
                  <div style={{ fontSize: '0.68rem', color: '#aaa' }}>{new Date(a.created_at).toLocaleString('es-MX')}</div>
                </div>
              ))}
              {!(data.activities || []).length && <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin notas todavía — la primera conversación se registra aquí.</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ═══════════════ Botón: link de pago Stripe ═══════════════ */
function StripeLinkBtn({ subId }: { subId: string }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  async function generar() {
    setBusy(true);
    try {
      const res = await fetch('/api/crm/arr/stripe-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: subId }) });
      const j = await res.json();
      if (j.url) { setUrl(j.url); try { await navigator.clipboard.writeText(j.url); } catch { /* igual se muestra */ } }
      else alert(j.error || 'No se pudo generar el link');
    } catch (e: any) { alert(e?.message || 'Error'); }
    setBusy(false);
  }
  if (url) return <a href={url} target="_blank" rel="noreferrer" style={{ ...S.btnSmall, background: '#EEF2FB', color: '#3764c4', textDecoration: 'none' }} title="Link copiado al portapapeles">Link listo ✓</a>;
  return <button style={S.btnSmall} disabled={busy} onClick={generar} title="Genera un link de pago Stripe; al pagarse se activa sola">{busy ? '…' : '💳 Link Stripe'}</button>;
}

/* ═══════════════ Modal: editar / cancelar suscripción ═══════════════ */
// Catálogo canónico de razones de churn (valor guardado → etiqueta ES). Único
// para todo el CRM; medir churn por causa exige un set cerrado, no texto libre.
const RAZONES_CANCEL: [string, string][] = [
  ['precio', 'Precio / presupuesto'],
  ['no_implemento', 'No lo implementó'],
  ['no_uso', 'Dejó de usarlo'],
  ['cerro_negocio', 'Cerró el negocio'],
  ['competencia', 'Se fue con la competencia'],
  ['mal_servicio', 'Mal servicio / soporte'],
  ['feature_falta', 'Le faltó una función'],
  ['otro', 'Otro'],
];

// Qué significa cada estado y qué dispara (leyenda para el dueño).
const ESTADO_INFO: Record<string, string> = {
  programada: 'Cerrada pero aún no paga su primer cobro. Se activa sola al registrar el pago.',
  activa: 'Al corriente. Suma al ARR y se le recuerda su renovación.',
  pendiente_pago: 'Su factura venció y no ha pagado. Dunning corriendo (email/WhatsApp/tarea). No suma ARR hasta pagar.',
  pausada: 'Congelada de común acuerdo. No se le cobra ni se le manda dunning, no suma ARR. Requiere fecha de reanudación.',
  cancelada: 'Terminó la relación. Guarda la razón para atacar el churn.',
};
// Transiciones permitidas desde cada estado (refleja el guard del servidor).
const TRANSICIONES_UI: Record<string, string[]> = {
  programada: ['programada', 'activa', 'pendiente_pago', 'cancelada'],
  activa: ['activa', 'pendiente_pago', 'pausada', 'cancelada'],
  pendiente_pago: ['pendiente_pago', 'activa', 'pausada', 'cancelada'],
  pausada: ['pausada', 'activa', 'cancelada'],
  cancelada: ['cancelada', 'activa'],
};

function EditarSubModal({ sub, onClose, onDone }: { sub: Sub; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<any>({
    id: sub.id, nombre_plan: sub.nombre_plan, ciclo: sub.ciclo, estado: sub.estado,
    precio: sub.precio, plan_id: (sub as any).plan_id || '', precio_lista: (sub as any).precio_lista ?? null,
    fecha_inicio: sub.fecha_inicio, proxima_factura: sub.proxima_factura,
    monto_proximo: sub.monto_proximo, razon_cancelacion: sub.razon_cancelacion || '', notas: sub.notas || '',
    stripe_subscription_id: (sub as any).stripe_subscription_id || '',
    aplicar_ciclo: 'al_renovar', cancela_al_vencer: true, cancelar_stripe: !!(sub as any).stripe_subscription_id, detalle_cancel: '',
    pausada_hasta: (sub as any).pausada_hasta || '',
    es_trial: !!(sub as any).es_trial, trial_fin: (sub as any).trial_fin || '',
    plazo_meses: (sub as any).plazo_meses || '', incremento_anual_pct: (sub as any).incremento_anual_pct || '',
    reten_pct: 20, reten_meses: 3,
  });
  const [plans, setPlans] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [addons, setAddons] = useState<any[]>([]);
  const [descs, setDescs] = useState<any[]>([]);
  const [nuevoAddon, setNuevoAddon] = useState<any>({ nombre: '', precio: '' });
  const [nuevoDesc, setNuevoDesc] = useState<any>({ tipo: 'porcentaje', valor: '', motivo: '' });

  useEffect(() => { fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlans(j.data || [])).catch(() => {}); }, []);
  const loadExtras = () => {
    fetch(`/api/crm/arr/addons?subscription_id=${sub.id}`).then(r => r.json()).then(j => setAddons(j.data || [])).catch(() => {});
    fetch(`/api/crm/arr/discounts?subscription_id=${sub.id}`).then(r => r.json()).then(j => setDescs(j.data || [])).catch(() => {});
  };
  useEffect(() => { if (showExtras) loadExtras(); }, [showExtras]);

  // add-ons y descuentos cambian monto_proximo en el server; reflejarlo en el
  // form para que "Guardar cambios" no lo pise con el valor viejo.
  const aplicarMonto = (j: any) => { if (j && j.monto_proximo != null) setForm((f: any) => ({ ...f, monto_proximo: j.monto_proximo })); };
  async function addAddon() {
    if (!nuevoAddon.nombre || !(Number(nuevoAddon.precio) >= 0)) return;
    const r = await fetch('/api/crm/arr/addons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: sub.id, ...nuevoAddon, precio: Number(nuevoAddon.precio) }) });
    const j = await r.json(); if (j.error) { setErr(j.error); return; }
    aplicarMonto(j); setNuevoAddon({ nombre: '', precio: '' }); loadExtras();
  }
  async function delAddon(id: string) { const j = await fetch(`/api/crm/arr/addons?id=${id}`, { method: 'DELETE' }).then(r => r.json()).catch(() => null); aplicarMonto(j); loadExtras(); }
  async function addDesc() {
    if (!(Number(nuevoDesc.valor) > 0)) return;
    const r = await fetch('/api/crm/arr/discounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: sub.id, ...nuevoDesc, valor: Number(nuevoDesc.valor) }) });
    const j = await r.json(); if (j.error) { setErr(j.error); return; }
    aplicarMonto(j); setNuevoDesc({ tipo: 'porcentaje', valor: '', motivo: '' }); loadExtras();
  }
  async function delDesc(id: string) { const j = await fetch(`/api/crm/arr/discounts?id=${id}`, { method: 'DELETE' }).then(r => r.json()).catch(() => null); aplicarMonto(j); loadExtras(); }

  async function retener() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch('/api/crm/arr/retencion', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: sub.id, reason: form.razon_cancelacion || null, pct: Number(form.reten_pct) || 20, meses: Number(form.reten_meses) || 3 }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'No se pudo aplicar la retención');
      onDone();
    } catch (e: any) { setErr(e?.message || String(e)); setSaving(false); }
  }

  const planSel = plans.find(p => p.id === form.plan_id) || plans.find(p => p.slug && form.nombre_plan?.toLowerCase().includes(p.slug));
  const precioLista = planSel && !planSel.a_la_medida ? (form.ciclo === 'anual' ? planSel.precio_anual : planSel.precio_mensual) : null;
  const cicloCambio = form.ciclo !== sub.ciclo;
  const estadoCambio = form.estado !== sub.estado;
  const esCancelar = form.estado === 'cancelada' && sub.estado !== 'cancelada';
  const esPausar = form.estado === 'pausada' && sub.estado !== 'pausada';
  const descuento = precioLista && Number(form.precio) > 0 && Number(form.precio) < precioLista
    ? Math.round((1 - Number(form.precio) / precioLista) * 100) : 0;

  function elegirPlan(planId: string) {
    const p = plans.find(x => x.id === planId);
    if (!p) { setForm({ ...form, plan_id: '' }); return; }
    const lista = p.a_la_medida ? null : (form.ciclo === 'anual' ? p.precio_anual : p.precio_mensual);
    // Solo autollenar el precio si el actual coincidía con la lista (no pisar un pactado)
    const pisarPrecio = !form.precio || Number(form.precio) === Number(form.precio_lista || 0);
    setForm({ ...form, plan_id: planId, nombre_plan: p.nombre + (form.ciclo === 'anual' ? ' Anual' : ' Mensual'),
      precio_lista: lista, ...(pisarPrecio && lista ? { precio: lista, monto_proximo: lista } : {}) });
  }
  function cambiarCiclo(nuevo: string) {
    const p = plans.find(x => x.id === form.plan_id);
    const lista = p && !p.a_la_medida ? (nuevo === 'anual' ? p.precio_anual : p.precio_mensual) : null;
    const pisarPrecio = !form.precio || Number(form.precio) === Number(form.precio_lista || 0);
    setForm({ ...form, ciclo: nuevo, precio_lista: lista, ...(pisarPrecio && lista ? { precio: lista, monto_proximo: lista } : {}) });
  }

  async function guardar() {
    if (esCancelar && !form.razon_cancelacion) { setErr('Elige la razón de cancelación — sirve para atacar la causa del churn.'); return; }
    if (esCancelar && (form.razon_cancelacion === 'otro' || form.razon_cancelacion === 'competencia') && !form.detalle_cancel.trim()) { setErr('Agrega el detalle de la cancelación.'); return; }
    if (esPausar && !form.pausada_hasta) { setErr('Elige hasta cuándo se pausa (fecha de reanudación).'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form, razon_cancelacion: esCancelar ? form.razon_cancelacion : (form.estado === 'cancelada' ? form.razon_cancelacion : undefined),
        notas: form.detalle_cancel ? `${form.notas}${form.notas ? ' · ' : ''}[cancelación] ${form.detalle_cancel}` : form.notas };
      const res = await fetch('/api/crm/arr/subscriptions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'No se pudo guardar');
      if (j.advertencia) alert(j.advertencia);
      onDone();
    } catch (e: any) { setErr(e?.message || String(e)); setSaving(false); }
  }

  const estadosPermitidos = TRANSICIONES_UI[sub.estado] || [sub.estado];

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Editar suscripción</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: 10 }}>{sub.contacts?.nombre || sub.companies?.nombre || '—'}{sub.companies?.sacs_account ? ' · ' + sub.companies.sacs_account : ''}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Plan desde catálogo */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Plan</label>
            <select value={form.plan_id} onChange={e => elegirPlan(e.target.value)} style={{ ...S.input, width: '100%' }}>
              <option value="">— {form.nombre_plan || 'personalizado'} (sin catálogo) —</option>
              {plans.map(p => <option key={p.id || p.slug} value={p.id || ''}>{p.nombre}{p.a_la_medida ? ' (a la medida)' : ''}</option>)}
            </select>
            <input value={form.nombre_plan} onChange={e => setForm({ ...form, nombre_plan: e.target.value })} style={{ ...S.input, width: '100%', marginTop: 6, fontSize: '0.78rem' }} placeholder="Etiqueta del plan" />
          </div>

          {/* Ciclo con leyenda */}
          <div>
            <label style={S.label}>Ciclo</label>
            <select value={form.ciclo} onChange={e => cambiarCiclo(e.target.value)} style={{ ...S.input, width: '100%' }}><option value="anual">Anual</option><option value="mensual">Mensual</option></select>
          </div>
          {/* Estado con transiciones válidas */}
          <div>
            <label style={S.label}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={{ ...S.input, width: '100%' }}>
              {Object.entries(ESTADOS).map(([v, c]) => <option key={v} value={v} disabled={!estadosPermitidos.includes(v)}>{c.label}{!estadosPermitidos.includes(v) ? ' (no aplica)' : ''}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#888', marginTop: -4 }}>
            {form.ciclo === 'anual' ? 'Anual: se cobra una vez al año; el precio es por año (suele traer 2 meses de regalo).' : 'Mensual: se cobra cada mes; el precio es por mes.'}
            {' · '}<span style={{ color: ESTADOS[form.estado]?.color }}>{ESTADO_INFO[form.estado]}</span>
          </div>

          {/* Precio con sugerencia de lista y badge de descuento */}
          <div>
            <label style={S.label}>Precio por {form.ciclo === 'anual' ? 'año' : 'mes'}</label>
            <input type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} style={{ ...S.input, width: '100%' }} />
            {precioLista != null && Number(form.precio) !== precioLista && (
              <div style={{ fontSize: '0.7rem', marginTop: 3 }}>
                <button type="button" onClick={() => setForm({ ...form, precio: precioLista, monto_proximo: precioLista })} style={{ ...S.btnSmall, padding: '2px 8px', fontSize: '0.7rem' }}>Usar ${Number(precioLista).toLocaleString('es-MX')} (lista)</button>
                {descuento > 0 && <span style={{ color: '#a06600', marginLeft: 6 }}>Pactado −{descuento}%</span>}
              </div>
            )}
          </div>
          <div><label style={S.label}>Monto próximo</label><input type="number" value={form.monto_proximo ?? ''} onChange={e => setForm({ ...form, monto_proximo: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Fecha inicio</label><input type="date" value={form.fecha_inicio || ''} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Próxima factura</label><input type="date" value={form.proxima_factura || ''} onChange={e => setForm({ ...form, proxima_factura: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={S.label}>Stripe subscription ID <span style={{ color: '#bbb', fontWeight: 400 }}>(sub_… — al cobrarse en Stripe se registra y renueva sola)</span></label><input value={form.stripe_subscription_id} onChange={e => setForm({ ...form, stripe_subscription_id: e.target.value })} style={{ ...S.input, width: '100%' }} placeholder="sub_1Abc…" /></div>
        </div>

        {/* Panel: cambio de ciclo */}
        {cicloCambio && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#F5F8FF', border: '1px solid #D6E4FF' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6 }}>Cambio de ciclo: {sub.ciclo} → {form.ciclo}</div>
            <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: 8 }}>
              Hoy: ${Number(sub.precio).toLocaleString('es-MX')} {sub.ciclo === 'anual' ? 'al año' : 'al mes'}. Pasará a: ${Number(form.precio).toLocaleString('es-MX')} {form.ciclo === 'anual' ? 'al año' : 'al mes'}.
            </div>
            <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: 4 }}><input type="radio" checked={form.aplicar_ciclo === 'al_renovar'} onChange={() => setForm({ ...form, aplicar_ciclo: 'al_renovar' })} /> Al renovar ({sub.proxima_factura || 'próxima factura'}) — el periodo pagado se respeta; el ciclo nuevo aplica al siguiente cobro.</label>
            <label style={{ display: 'block', fontSize: '0.78rem' }}><input type="radio" checked={form.aplicar_ciclo === 'ahora'} onChange={() => setForm({ ...form, aplicar_ciclo: 'ahora' })} /> Ahora mismo — solo para corregir una captura; revisa la próxima factura.</label>
          </div>
        )}

        {/* Panel: cancelación */}
        {esCancelar && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#FFF5F5', border: '1px solid #FED7D7' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#b93333', marginBottom: 8 }}>Cancelar suscripción — se pierden ${Number(sub.arr).toLocaleString('es-MX')} de ARR</div>
            <label style={S.label}>Razón *</label>
            <select value={form.razon_cancelacion} onChange={e => setForm({ ...form, razon_cancelacion: e.target.value })} style={{ ...S.input, width: '100%', marginBottom: 8 }}>
              <option value="">— elegir —</option>
              {RAZONES_CANCEL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {(form.razon_cancelacion === 'otro' || form.razon_cancelacion === 'competencia') && (
              <input value={form.detalle_cancel} onChange={e => setForm({ ...form, detalle_cancel: e.target.value })} placeholder={form.razon_cancelacion === 'competencia' ? '¿A qué competidor se fue?' : 'Detalle…'} style={{ ...S.input, width: '100%', marginBottom: 8 }} />
            )}

            {/* Intento de retención ANTES de cancelar */}
            <div style={{ padding: 10, margin: '4px 0 10px', borderRadius: 8, background: '#F0FBF7', border: '1px solid #B7EBD9' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#137a67', marginBottom: 6 }}>💚 Antes de perderlo, intenta retenerlo</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="number" value={form.reten_pct} onChange={e => setForm({ ...form, reten_pct: e.target.value })} style={{ ...S.input, width: 60 }} /> <span style={{ fontSize: '0.76rem' }}>% off ×</span>
                <input type="number" value={form.reten_meses} onChange={e => setForm({ ...form, reten_meses: e.target.value })} style={{ ...S.input, width: 55 }} /> <span style={{ fontSize: '0.76rem' }}>meses</span>
                <button type="button" disabled={saving} onClick={retener} style={{ ...S.btnSmall, background: '#1A8F7A', color: '#fff', border: 'none' }}>Aplicar y mantener activo</button>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#888', marginTop: 4 }}>Aplica el descuento, mantiene la suscripción y cuenta como cliente retenido (sube el save-rate). Si no acepta, sigue abajo para cancelar.</div>
            </div>

            <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: 4 }}><input type="radio" checked={form.cancela_al_vencer} onChange={() => setForm({ ...form, cancela_al_vencer: true })} /> Al terminar lo pagado ({sub.proxima_factura || 'fin del periodo'}) — sigue activa hasta ahí.</label>
            <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: 8 }}><input type="radio" checked={!form.cancela_al_vencer} onChange={() => setForm({ ...form, cancela_al_vencer: false })} /> Hoy — corta ya.</label>
            {form.stripe_subscription_id && (
              <label style={{ display: 'block', fontSize: '0.78rem' }}><input type="checkbox" checked={form.cancelar_stripe} onChange={e => setForm({ ...form, cancelar_stripe: e.target.checked })} /> Cancelar también en Stripe {!form.cancelar_stripe && <span style={{ color: '#b93333' }}>⚠️ Stripe seguirá cobrando</span>}</label>
            )}
          </div>
        )}

        {/* Panel: pausa */}
        {esPausar && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#FAFAFA', border: '1px solid #E5E5E5' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6 }}>Pausar — sin cobro ni dunning mientras esté pausada</div>
            <label style={S.label}>Reanudar el *</label>
            <input type="date" value={form.pausada_hasta} onChange={e => setForm({ ...form, pausada_hasta: e.target.value })} style={{ ...S.input, width: '100%' }} />
          </div>
        )}

        {/* Panel: Extras (trial, multi-año, add-ons, descuentos) */}
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setShowExtras(!showExtras)} style={{ ...S.btnSmall, width: '100%', textAlign: 'left', background: '#fafafa' }}>
            {showExtras ? '▾' : '▸'} Extras: prueba, plazo, add-ons y descuentos
          </button>
          {showExtras && (
            <div style={{ padding: 12, border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
              {/* Trial */}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', marginBottom: 8 }}>
                <input type="checkbox" checked={form.es_trial} onChange={e => setForm({ ...form, es_trial: e.target.checked })} /> Es prueba (trial)
                {form.es_trial && <input type="date" value={form.trial_fin} onChange={e => setForm({ ...form, trial_fin: e.target.value })} style={{ ...S.input, padding: '4px 8px' }} title="Fin del trial" />}
              </label>
              {/* Multi-año */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}><label style={S.label}>Plazo (meses)</label><input type="number" value={form.plazo_meses} onChange={e => setForm({ ...form, plazo_meses: e.target.value })} placeholder="12 / 24 / 36" style={{ ...S.input, width: '100%' }} /></div>
                <div style={{ flex: 1, minWidth: 120 }}><label style={S.label}>Escalador anual %</label><input type="number" value={form.incremento_anual_pct} onChange={e => setForm({ ...form, incremento_anual_pct: e.target.value })} placeholder="8" style={{ ...S.input, width: '100%' }} /></div>
              </div>
              {/* Add-ons */}
              <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: 6 }}>Add-ons (suman al MRR)</div>
              {addons.map((a: any) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span>{a.nombre} · {fmt(a.precio)}{a.cantidad > 1 ? ` ×${a.cantidad}` : ''}</span>
                  <button type="button" onClick={() => delAddon(a.id)} style={{ ...S.btnSmall, color: '#b93333', padding: '2px 8px' }}>Quitar</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 12 }}>
                <input value={nuevoAddon.nombre} onChange={e => setNuevoAddon({ ...nuevoAddon, nombre: e.target.value })} placeholder="Sucursal extra / Soporte premium…" style={{ ...S.input, flex: 2 }} />
                <input type="number" value={nuevoAddon.precio} onChange={e => setNuevoAddon({ ...nuevoAddon, precio: e.target.value })} placeholder="$/ciclo" style={{ ...S.input, flex: 1 }} />
                <button type="button" onClick={addAddon} style={{ ...S.btnSmall, background: '#1A8F7A', color: '#fff', border: 'none' }}>+</button>
              </div>
              {/* Descuentos */}
              <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: 6 }}>Descuentos (reducen lo que se cobra)</div>
              {descs.map((dd: any) => (
                <div key={dd.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span>{dd.tipo === 'porcentaje' ? `${dd.valor}%` : fmt(dd.valor)}{dd.motivo ? ` · ${dd.motivo}` : ''}{dd.vigente_hasta ? ` · hasta ${dd.vigente_hasta}` : ''}</span>
                  <button type="button" onClick={() => delDesc(dd.id)} style={{ ...S.btnSmall, color: '#b93333', padding: '2px 8px' }}>Quitar</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <select value={nuevoDesc.tipo} onChange={e => setNuevoDesc({ ...nuevoDesc, tipo: e.target.value })} style={{ ...S.input, flex: 1 }}><option value="porcentaje">%</option><option value="monto">$</option></select>
                <input type="number" value={nuevoDesc.valor} onChange={e => setNuevoDesc({ ...nuevoDesc, valor: e.target.value })} placeholder="valor" style={{ ...S.input, flex: 1 }} />
                <input value={nuevoDesc.motivo} onChange={e => setNuevoDesc({ ...nuevoDesc, motivo: e.target.value })} placeholder="motivo" style={{ ...S.input, flex: 2 }} />
                <button type="button" onClick={addDesc} style={{ ...S.btnSmall, background: '#1A8F7A', color: '#fff', border: 'none' }}>+</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10 }}><label style={S.label}>Notas</label><textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ ...S.input, width: '100%', height: 50, resize: 'vertical' }} /></div>
        {err && <div style={{ color: '#b93333', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
        <button onClick={guardar} disabled={saving} style={{ ...S.btn, width: '100%', marginTop: 14, background: esCancelar ? '#b93333' : '#1a1a1a', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando…' : esCancelar ? `Confirmar cancelación` : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════ Vista: Conciliación (cuentas activas sin suscripción) ═══════════════ */
const TIPOS_CUENTA: Record<string, string> = { cliente: 'Cliente', cortesia: 'Cortesía', prueba: 'Prueba', interna: 'Interna', socio: 'Socio', sin_clasificar: 'Sin clasificar' };
function ConciliacionView({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [ciegas, setCiegas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [crearPara, setCrearPara] = useState<any>(null);
  const [busyCuenta, setBusyCuenta] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [c, l] = await Promise.all([
        fetch('/api/crm/arr/conciliacion').then(r => r.json()),
        fetch('/api/crm/arr/link-suggestions').then(r => r.json()),
      ]);
      if (c.error) throw new Error(c.error);
      setData(c); setCiegas(l.error ? null : l);
    } catch (e: any) { setErr(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function clasificar(cuenta: string, tipo: string) {
    setBusyCuenta(cuenta);
    const res = await fetch('/api/crm/arr/conciliacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cuenta, accion: 'clasificar', tipo }) });
    const j = await res.json();
    if (j.error) alert(j.error);
    setBusyCuenta(null); load();
  }

  async function ligar(companyId: string, cuenta: string) {
    const res = await fetch('/api/crm/arr/link-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, sacs_account: cuenta }) });
    const j = await res.json();
    if (j.error) alert(j.error);
    load(); onChanged();
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cruzando cuentas SACS contra suscripciones… (tarda ~1 min)</div>;
  if (err) return <div style={{ padding: 40, textAlign: 'center', color: '#E54B4B' }}>{err} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div>
      {/* subs ciegas: ligar cuenta */}
      {ciegas && ciegas.ciegas > 0 && (
        <div style={{ ...S.card, borderLeft: '4px solid #E8A838' }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>🔗 Suscripciones sin cuenta SACS ligada <span style={{ color: '#999', fontWeight: 400 }}>· {ciegas.ciegas} · {fmt(ciegas.arr_ciego)} ARR sin monitoreo</span></div>
          <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 10 }}>Sin la liga no podemos ver su actividad ni avisarte si dejan de usar el sistema. Sugerencias por el email del contacto.</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Cliente', 'Plan', 'ARR', 'Contacto', 'Sugerencia', 'Ligar'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{ciegas.data.map((c: any) => (
              <tr key={c.subscription_id}>
                <td style={{ ...S.td, fontWeight: 700 }}>{c.empresa}</td>
                <td style={S.td}>{c.nombre_plan}</td>
                <td style={S.td}>{fmt(c.arr)}</td>
                <td style={S.td}>{c.email || c.contacto || '—'}</td>
                <td style={S.td}>{c.sugerencias.length ? c.sugerencias.join(', ') : <span style={{ color: '#bbb' }}>sin match</span>}</td>
                <td style={S.td}>
                  {c.sugerencias.length === 1 ? (
                    <button style={{ ...S.btnSmall, background: '#e8f5e9', color: '#2e7d32' }} onClick={() => ligar(c.company_id, c.sugerencias[0])}>Ligar a {c.sugerencias[0]}</button>
                  ) : (
                    <button style={S.btnSmall} onClick={() => { const v = prompt('Cuenta SACS (subdominio) para ' + c.empresa + ':', c.sugerencias[0] || ''); if (v) ligar(c.company_id, v.trim().toLowerCase()); }}>Ligar…</button>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* cuentas activas sin suscripción */}
      <div style={{ ...S.card, borderLeft: '4px solid #E54B4B' }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>💸 Cuentas USANDO SACS sin suscripción registrada <span style={{ color: '#999', fontWeight: 400 }}>· {data.sin_suscripcion} de {data.cuentas_activas} activas · {data.sin_clasificar} sin clasificar</span></div>
        <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 10 }}>Vendieron en los últimos 30 días y no aparecen en tus ingresos. Clasifícalas: las "Cliente" deberían tener suscripción (usa Crear sub).</div>
        <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Cuenta', 'Ventas 30d', 'Volumen 30d', 'Últ. venta', 'Clasificación', 'Acción'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{data.data.map((c: any) => (
              <tr key={c.cuenta} style={{ opacity: c.tipo_cuenta !== 'sin_clasificar' && c.tipo_cuenta !== 'cliente' ? 0.55 : 1 }}>
                <td style={{ ...S.td, fontWeight: 700 }}>{c.cuenta}</td>
                <td style={S.td}>{c.ventas_30d}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.total_30d)}</td>
                <td style={S.td}>{fmtDate(c.ultima_venta)}</td>
                <td style={S.td}>
                  <select value={c.tipo_cuenta || 'sin_clasificar'} disabled={busyCuenta === c.cuenta}
                    onChange={e => clasificar(c.cuenta, e.target.value)} style={{ ...S.input, padding: '4px 8px', fontSize: '0.78rem' }}>
                    {Object.entries(TIPOS_CUENTA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td style={S.td}><button style={{ ...S.btnSmall, background: '#1A8F7A', color: '#fff', border: 'none' }} onClick={() => setCrearPara(c)}>+ Crear sub</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {crearPara && <CrearSubModal cuenta={crearPara} onClose={() => setCrearPara(null)} onDone={() => { setCrearPara(null); load(); onChanged(); }} />}
    </div>
  );
}

function CrearSubModal({ cuenta, onClose, onDone }: { cuenta: any; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<any>({ ciclo: 'anual', plan_id: '' });
  const [plans, setPlans] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlans(j.data || [])).catch(() => {}); }, []);
  function elegirPlan(planId: string) {
    const p = plans.find(x => x.id === planId);
    if (!p) { setForm({ ...form, plan_id: '' }); return; }
    const lista = p.a_la_medida ? null : (form.ciclo === 'anual' ? p.precio_anual : p.precio_mensual);
    setForm({ ...form, plan_id: planId, nombre_plan: p.nombre + (form.ciclo === 'anual' ? ' Anual' : ' Mensual'), precio_lista: lista, ...(lista ? { precio: lista } : {}) });
  }
  async function crear() {
    if (!form.nombre_plan || !Number(form.precio)) { setErr('Plan y precio requeridos.'); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch('/api/crm/arr/conciliacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuenta: cuenta.cuenta, accion: 'crear_sub', ...form, precio: Number(form.precio) }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'No se pudo crear');
      onDone();
    } catch (e: any) { setErr(e?.message || String(e)); setSaving(false); }
  }
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...S.modal, maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Suscripción para {cuenta.cuenta}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#999', marginBottom: 10 }}>Vende {fmt(cuenta.total_30d)}/30d en SACS. Queda PROGRAMADA; al registrar su primer pago se activa.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Plan *</label>
            <select value={form.plan_id} onChange={e => elegirPlan(e.target.value)} style={{ ...S.input, width: '100%' }}>
              <option value="">— elegir del catálogo —</option>
              {plans.map(p => <option key={p.id || p.slug} value={p.id || ''}>{p.nombre}{p.a_la_medida ? ' (a la medida)' : ''}</option>)}
            </select>
            <input value={form.nombre_plan || ''} onChange={e => setForm({ ...form, nombre_plan: e.target.value })} style={{ ...S.input, width: '100%', marginTop: 6, fontSize: '0.78rem' }} placeholder="Licencia Controla Anual" />
          </div>
          <div><label style={S.label}>Ciclo</label><select value={form.ciclo} onChange={e => { const c = e.target.value; const p = plans.find(x => x.id === form.plan_id); const lista = p && !p.a_la_medida ? (c === 'anual' ? p.precio_anual : p.precio_mensual) : null; setForm({ ...form, ciclo: c, precio_lista: lista, ...(lista ? { precio: lista } : {}) }); }} style={{ ...S.input, width: '100%' }}><option value="anual">Anual</option><option value="mensual">Mensual</option></select></div>
          <div><label style={S.label}>Precio por {form.ciclo === 'anual' ? 'año' : 'mes'} *</label><input type="number" value={form.precio || ''} onChange={e => setForm({ ...form, precio: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Contacto</label><input value={form.contacto_nombre || ''} onChange={e => setForm({ ...form, contacto_nombre: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
          <div><label style={S.label}>Email</label><input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} style={{ ...S.input, width: '100%' }} /></div>
        </div>
        {err && <div style={{ color: '#b93333', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
        <button onClick={crear} disabled={saving} style={{ ...S.btn, width: '100%', marginTop: 14, background: '#1A8F7A', color: '#fff', opacity: saving ? 0.6 : 1 }}>{saving ? 'Creando…' : 'Crear suscripción'}</button>
      </div>
    </div>
  );
}
