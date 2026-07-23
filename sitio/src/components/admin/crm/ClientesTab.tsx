import { useEffect, useMemo, useState } from 'react';
import { ClienteDrawer, S } from './SubscriptionsTab';
import PipelineKanban from './PipelineKanban';
import { useToast, Toast, logStageChange } from './crmHelpers';

/* ═══ Clientes REALES — companies con suscripciones, KPIs y actividad SACS ═══
 * Reemplaza la vista legacy (tabla `clients` con datos de demo). Cada fila es
 * un cliente real; clic → 360 (subs, pagos, actividad, notas). */

const PLAN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  vende:           { bg: 'rgba(75,123,229,0.12)',  color: '#3764c4', label: 'Vende' },
  controla:        { bg: 'rgba(42,181,160,0.14)',  color: '#1A8F7A', label: 'Controla' },
  fideliza:        { bg: 'rgba(108,92,231,0.12)',  color: '#6C5CE7', label: 'Fideliza' },
  automatiza:      { bg: 'rgba(232,168,56,0.16)',  color: '#a06600', label: 'Automatiza' },
  personalizada:   { bg: 'rgba(26,26,26,0.08)',    color: '#1a1a1a', label: 'Personalizada' },
  soporte_premium: { bg: 'rgba(229,75,75,0.10)',   color: '#b93333', label: 'Soporte premium' },
};

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

export default function ClientesTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [data, setData] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fPlan, setFPlan] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [vista, setVista] = useState<'tabla' | 'kanban'>('tabla');
  const [stages, setStages] = useState<{ key: string; label: string; color: string }[]>([]);
  const { toast, show } = useToast();

  async function load() {
    setLoading(true); setError(null);
    try {
      const [j, pj] = await Promise.all([
        fetch('/api/crm/arr/clientes').then(r => r.json()),
        fetch('/api/crm/pipelines').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      if (j.error) throw new Error(j.error);
      setData(j.data || []); setTot(j.tot || null);
      const cli = (pj.data || []).find((p: any) => p.tipo === 'cliente');
      setStages(cli?.stages || []);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const stageBy = useMemo(() => { const m: Record<string, any> = {}; stages.forEach(s => m[s.key] = s); return m; }, [stages]);
  // Cambia la etapa del cliente (optimista) y persiste en companies.pipeline_stage.
  async function setStage(id: string, key: string) {
    const prev = data.find(c => c.id === id);
    setData(d => d.map(c => c.id === id ? { ...c, pipeline_stage: key } : c));
    try {
      const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, pipeline_stage: key }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); if (j.error) { alert(j.error + '\n¿Corriste migration-2026-07-pipelines.sql?'); load(); return; } }
      const toLabel = stageBy[key]?.label || key;
      logStageChange({ company_id: id, contact_id: prev?.contacto?.id || null, fromLabel: prev?.pipeline_stage ? stageBy[prev.pipeline_stage]?.label : undefined, toLabel });
      show(`Cliente movido a ${toLabel}`);
    } catch { load(); }
  }

  const filtered = useMemo(() => data.filter(c => {
    if (fPlan && c.plan !== fPlan) return false;
    if (fEstado === 'activos' && c.subs_activas === 0) return false;
    if (fEstado === 'pendientes' && c.subs_pendientes === 0) return false;
    if (fEstado === 'riesgo' && !(c.dias_sin_venta != null && c.dias_sin_venta >= 3 && c.subs_activas > 0)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [c.nombre, c.sacs_account, c.contacto?.nombre, c.contacto?.email].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [data, search, fPlan, fEstado]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando clientes reales…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['Clientes', tot?.clientes], ['Con ARR activo', tot?.activos], ['ARR total', money(tot?.arr)]].map(([l, v]) => (
          <div key={String(l)} style={S.kpi}>
            <div style={S.kLabel}>{l}</div>
            <div style={S.kValue}>{v ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, cuenta o contacto…" style={{ ...S.input, flex: 1, minWidth: 220 }} />
          <select value={fPlan} onChange={e => setFPlan(e.target.value)} style={S.input}>
            <option value="">Todos los planes</option>
            {Object.entries(PLAN_BADGE).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
          </select>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={S.input}>
            <option value="">Todos</option>
            <option value="activos">Con ARR activo</option>
            <option value="pendientes">Con pendientes de pago</option>
            <option value="riesgo">En riesgo (≥3 días sin vender)</option>
          </select>
          <button onClick={() => onConfig?.()} title="Configurar etapas del pipeline de Clientes" style={{ ...S.btnSmall, marginLeft: 'auto' }}>⚙️ Etapas</button>
          <div style={{ display: 'flex', gap: 0, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
            {(['tabla', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{ ...S.btnSmall, border: 'none', borderRadius: 0, background: vista === v ? '#1a1a1a' : '#fff', color: vista === v ? '#fff' : '#555', textTransform: 'capitalize' }}>{v === 'kanban' ? 'Kanban' : 'Tabla'}</button>
            ))}
          </div>
        </div>

        {vista === 'kanban' ? (
          stages.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Configura las etapas del pipeline de Clientes en <b>Configuración → Pipelines</b>.</div>
          ) : (
            <PipelineKanban
              stages={stages}
              items={filtered}
              getId={(c: any) => c.id}
              getStage={(c: any) => c.pipeline_stage}
              colValue={(its: any[]) => money(its.reduce((s, c) => s + Number(c.arr || 0), 0)) + ' ARR'}
              onMove={(id, key) => setStage(id, key)}
              renderCard={(c: any) => (
                <div onClick={() => setDetailId(c.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{c.sacs_account || c.nombre}</div>
                  {c.contacto?.nombre ? <div style={{ fontSize: '0.72rem', color: '#999' }}>{c.contacto.nombre}</div> : null}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{money(c.arr)}</span>
                    {c.plan && PLAN_BADGE[c.plan] ? <span style={{ ...S.badge, background: PLAN_BADGE[c.plan].bg, color: PLAN_BADGE[c.plan].color }}>{PLAN_BADGE[c.plan].label}</span> : null}
                    {c.dias_sin_venta != null && c.dias_sin_venta >= 3 ? <span style={{ fontSize: '0.68rem', color: c.dias_sin_venta > 15 ? '#b93333' : '#a06600' }}>{c.dias_sin_venta}d</span> : null}
                  </div>
                </div>
              )}
            />
          )
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Cliente', 'Contacto', 'Plan', 'Etapa', 'Subs', 'ARR', 'Pagos', 'Total pagado', 'Próx. factura', 'Últ. venta SACS', 'Salud'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => {
                const b = PLAN_BADGE[c.plan] || null;
                const dias = c.dias_sin_venta;
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(c.id)}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{c.contacto?.nombre || c.nombre}{(() => { const cuenta = c.sacs_account || c.nombre; return cuenta && cuenta !== (c.contacto?.nombre || c.nombre) ? <div style={{ color: '#aaa', fontWeight: 400, fontSize: '0.72rem' }}>{cuenta}</div> : null; })()}</td>
                    <td style={S.td}>{c.contacto ? (c.contacto.email || c.contacto.whatsapp || '—') : <span style={{ color: '#c62828' }}>sin contacto</span>}</td>
                    <td style={S.td}>{b ? <span style={{ ...S.badge, background: b.bg, color: b.color }}>{b.label}</span> : <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td style={S.td} onClick={e => e.stopPropagation()}>
                      {stages.length === 0 ? <span style={{ color: '#bbb' }}>—</span> : (
                        <select value={c.pipeline_stage || ''} onChange={e => setStage(c.id, e.target.value)}
                          style={{ ...S.input, padding: '3px 6px', fontSize: '0.75rem', maxWidth: 130, borderColor: c.pipeline_stage && stageBy[c.pipeline_stage] ? stageBy[c.pipeline_stage].color : '#ddd', color: c.pipeline_stage && stageBy[c.pipeline_stage] ? stageBy[c.pipeline_stage].color : '#999', fontWeight: 700 }}>
                          <option value="">— etapa —</option>
                          {stages.map(s => <option key={s.key} value={s.key} style={{ color: '#333' }}>{s.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={S.td}>{c.subs_activas}{c.subs_pendientes ? <span style={{ color: '#a06600' }}> +{c.subs_pendientes}⏳</span> : ''}</td>
                    <td style={{ ...S.td, fontWeight: 800 }}>{money(c.arr)}{c.arr_pendiente > 0 ? <div style={{ fontSize: '0.68rem', color: '#a06600' }}>+{money(c.arr_pendiente)} pend.</div> : null}</td>
                    <td style={S.td}>{c.pagos_realizados}</td>
                    <td style={S.td}>{money(c.total_pagado)}</td>
                    <td style={{ ...S.td, color: c.proxima_factura && c.proxima_factura < new Date().toISOString().slice(0, 10) ? '#b93333' : '#333' }}>{fmtDate(c.proxima_factura)}</td>
                    <td style={{ ...S.td, color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#333' }}>
                      {c.ultima_venta_at ? fmtDate(c.ultima_venta_at) + (dias != null ? ` (${dias}d)` : '') : (c.sacs_account ? 'sin datos aún' : 'sin cuenta ligada')}
                    </td>
                    <td style={S.td}>{c.health_score == null ? '—' : <span style={{ fontWeight: 800, color: c.health_score >= 70 ? '#1A8F7A' : c.health_score >= 40 ? '#a06600' : '#b93333' }}>{c.health_score}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Sin clientes con esos filtros.</div>}
        </div>
        )}
      </div>

      {detailId && <ClienteDrawer companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      <Toast toast={toast} />
    </div>
  );
}
