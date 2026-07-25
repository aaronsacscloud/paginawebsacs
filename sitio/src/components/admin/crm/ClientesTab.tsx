import { useEffect, useMemo, useState } from 'react';
import { S } from './SubscriptionsTab';
import ClienteDrawer360 from './ClienteDrawer360';
import NuevoClienteModal from './NuevoClienteModal';
import PipelineKanban from './PipelineKanban';
import { useToast, Toast, logStageChange } from './crmHelpers';
import EnriquecerWhatsApp from './EnriquecerWhatsApp';
import RevisarRelaciones from './RevisarRelaciones';

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

/* Densidad "enterprise" del datatable: tipografía compacta, filas de ~44px,
 * números tabulares alineados a la derecha, cabecera sticky y hover sutil.
 * (Estilos propios — no tocar S, que es compartido con otros tabs.) */
const T = {
  th: { textAlign: 'left' as const, padding: '10px 14px', fontSize: '0.63rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e8eaee', whiteSpace: 'nowrap' as const, background: '#fafbfc', position: 'sticky' as const, top: 0, zIndex: 1 },
  td: { padding: '12px 14px', fontSize: '0.79rem', color: '#333', borderBottom: '1px solid #f1f2f5', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
  num: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
  ell: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as const,
  sub: { fontSize: '0.67rem', color: '#a7abb3', fontWeight: 400, marginTop: 2 } as const,
  muted: { fontSize: '0.74rem', color: '#6b7078' } as const,
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
  kpi: { background: '#fff', border: '1px solid #ececf0', borderRadius: 12, padding: '14px 22px', flex: '0 1 220px', minWidth: 170 } as const,
  kLabel: { fontSize: '0.63rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase' as const, letterSpacing: '0.06em' } as const,
  kValue: { fontSize: '1.3rem', fontWeight: 800, color: '#16181d', marginTop: 4, fontVariantNumeric: 'tabular-nums' as const } as const,
};

export default function ClientesTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [data, setData] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fPlan, setFPlan] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [vista, setVista] = useState<'tabla' | 'kanban'>('tabla');
  const [stages, setStages] = useState<{ key: string; label: string; color: string }[]>([]);
  const { toast, show } = useToast();
  // Edición inline de correo/WhatsApp del contacto.
  const [editId, setEditId] = useState<string | null>(null);
  const [eEmail, setEEmail] = useState('');
  const [eWa, setEWa] = useState('');
  const [saving, setSaving] = useState(false);

  // Formato WhatsApp Meta (+52…, sin el "1" de móvil), igual que lib/kapso.ts.
  function metaWa(p: string): string {
    let c = String(p || '').replace(/[^\d+]/g, '');
    if (!c) return '';
    if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
    if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
    return c;
  }
  function startEdit(c: any) {
    setEditId(c.id);
    setEEmail(c.contacto?.email || '');
    setEWa(c.contacto?.whatsapp || c.contacto?.telefono || '');
  }
  async function saveEdit(c: any) {
    setSaving(true);
    const email = eEmail.trim() || null;
    const whatsapp = eWa.trim() ? metaWa(eWa.trim()) : null;
    try {
      let r: Response;
      if (c.contacto?.id) {
        r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.contacto.id, email, whatsapp }) });
      } else {
        // Cliente sin contacto → crea uno ligado a la empresa.
        r = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: c.id, nombre: c.contacto?.nombre || c.nombre || 'Contacto', email, whatsapp, tipo: 'cliente', lifecycle_stage: 'cliente' }) });
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { alert(j.error || 'No se pudo guardar.'); }
      else { setEditId(null); show('Contacto actualizado'); load(); }
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setSaving(false);
  }

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
    <div style={{ padding: '4px 12px 28px' }}>
      {/* Hover sutil de filas + lápiz visible solo al pasar el mouse (aire visual). */}
      <style>{`
        .ct360 tbody tr { transition: background .12s ease; }
        .ct360 tbody tr:hover td { background: #f7f9fc; }
        .ct360 .ct-pencil { opacity: 0; transition: opacity .15s ease; }
        .ct360 tbody tr:hover .ct-pencil, .ct360 .ct-pencil:focus { opacity: .65; }
      `}</style>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        {[['Clientes', tot?.clientes], ['Con ARR activo', tot?.activos], ['ARR total', money(tot?.arr)]].map(([l, v]) => (
          <div key={String(l)} style={T.kpi}>
            <div style={T.kLabel}>{l}</div>
            <div style={T.kValue}>{v ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, padding: '20px 22px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button onClick={() => setShowNuevo(true)} title="Alta completa: cliente + contacto + cuenta SACS + suscripción" style={{ ...S.btnSmall, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 700 }}>+ Nuevo cliente</button>
            <RevisarRelaciones onDone={load} />
            <EnriquecerWhatsApp onDone={load} />
            <button onClick={() => onConfig?.()} title="Configurar etapas del pipeline de Clientes" style={S.btnSmall}>⚙️ Etapas</button>
          </div>
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
              // Clientes sin etapa (pipeline_stage NULL) caen en la primera etapa.
              getStage={(c: any) => c.pipeline_stage || stages[0]?.key}
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
        <div className="ct360" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '19%' }} /><col style={{ width: '20%' }} /><col style={{ width: 112 }} />
              <col style={{ width: 120 }} /><col style={{ width: 118 }} /><col style={{ width: 112 }} />
              <col style={{ width: 118 }} /><col style={{ width: 128 }} />
            </colgroup>
            <thead><tr>
              {([['Cliente', false], ['Contacto', false], ['Plan', false], ['Etapa', false],
                ['ARR', true], ['Pagado', true], ['Renovación', false], ['Actividad', false]] as [string, boolean][])
                .map(([h, num]) => <th key={h} style={{ ...T.th, ...(num ? T.num : {}) }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => {
                const b = PLAN_BADGE[c.plan] || null;
                const dias = c.dias_sin_venta;
                const venc = c.proxima_factura && c.proxima_factura < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(c.id)}>
                    <td style={{ ...T.td, ...T.ell, fontWeight: 700 }}>
                      {c.contacto?.nombre || c.nombre}
                      {(() => { const cuenta = c.sacs_account || c.nombre; return cuenta && cuenta !== (c.contacto?.nombre || c.nombre) ? <div style={{ ...T.sub, ...T.ell }}>{cuenta}</div> : null; })()}
                    </td>
                    <td style={T.td} onClick={e => e.stopPropagation()}>
                      {editId === c.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <input value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="correo@…" style={{ ...S.input, padding: '4px 6px', fontSize: '0.74rem' }} />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input value={eWa} onChange={e => setEWa(e.target.value)} placeholder="+52…" style={{ ...S.input, padding: '4px 6px', fontSize: '0.74rem', flex: 1, minWidth: 0 }} />
                            <button title="Guardar" disabled={saving} onClick={() => saveEdit(c)} style={{ ...S.btnSmall, padding: '3px 7px', color: '#1A8F7A', fontWeight: 800 }}>{saving ? '…' : '✓'}</button>
                            <button title="Cancelar" onClick={() => setEditId(null)} style={{ ...S.btnSmall, padding: '3px 7px' }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ ...T.ell, color: c.contacto?.email ? '#444' : (c.contacto ? '#c4c8cf' : '#c62828'), fontSize: '0.78rem' }}>
                              {c.contacto?.email || (c.contacto ? '—' : 'sin contacto')}
                            </div>
                            <div style={{ ...T.ell, ...T.sub, marginTop: 1 }}>{c.contacto?.whatsapp || c.contacto?.telefono || ''}</div>
                          </div>
                          <button className="ct-pencil" title={c.contacto ? 'Editar correo/WhatsApp' : 'Agregar contacto'} onClick={() => startEdit(c)} style={{ ...S.btnSmall, padding: '2px 7px', border: 'none', background: 'none', flexShrink: 0 }}>✏️</button>
                        </div>
                      )}
                    </td>
                    <td style={{ ...T.td, ...T.ell }}>{b ? <span style={{ ...T.badge, background: b.bg, color: b.color }}>{b.label}</span> : <span style={{ color: '#c4c8cf' }}>—</span>}</td>
                    <td style={T.td} onClick={e => e.stopPropagation()}>
                      {stages.length === 0 ? <span style={{ color: '#c4c8cf' }}>—</span> : (
                        <select value={c.pipeline_stage || ''} onChange={e => setStage(c.id, e.target.value)}
                          style={{ ...S.input, padding: '3px 6px', fontSize: '0.72rem', width: '100%', borderColor: c.pipeline_stage && stageBy[c.pipeline_stage] ? stageBy[c.pipeline_stage].color : '#e3e5e9', color: c.pipeline_stage && stageBy[c.pipeline_stage] ? stageBy[c.pipeline_stage].color : '#999', fontWeight: 700 }}>
                          <option value="">— etapa —</option>
                          {stages.map(s => <option key={s.key} value={s.key} style={{ color: '#333' }}>{s.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ ...T.td, ...T.num, fontWeight: 800 }}>
                      {money(c.arr)}
                      <div style={{ ...T.sub, fontWeight: 600 }}>{c.subs_activas} sub{c.subs_activas === 1 ? '' : 's'}{c.arr_pendiente > 0 ? <span style={{ color: '#a06600' }}> +{money(c.arr_pendiente)}</span> : ''}</div>
                    </td>
                    <td style={{ ...T.td, ...T.num }}>
                      <span style={{ fontWeight: 700 }}>{money(c.total_pagado)}</span>
                      <div style={{ ...T.sub, fontWeight: 600 }}>{c.pagos_realizados} pago{c.pagos_realizados === 1 ? '' : 's'}</div>
                    </td>
                    <td style={{ ...T.td, ...T.muted, color: venc ? '#b93333' : T.muted.color, fontWeight: venc ? 700 : 400 }}>{fmtDate(c.proxima_factura)}</td>
                    <td style={T.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {c.health_score != null && <span style={{ ...T.badge, background: c.health_score >= 70 ? '#e6f6f2' : c.health_score >= 40 ? '#fdf3e0' : '#fdecea', color: c.health_score >= 70 ? '#1A8F7A' : c.health_score >= 40 ? '#a06600' : '#b93333' }}>{c.health_score}</span>}
                        <span style={{ ...T.ell, ...T.muted, fontSize: '0.72rem', color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#9aa0a8' }}>
                          {c.ultima_venta_at ? <>{fmtDate(c.ultima_venta_at)}{dias != null ? ` · ${dias}d` : ''}</> : (c.sacs_account ? 'sin datos' : 'sin cuenta')}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>Sin clientes con esos filtros.</div>}
        </div>
        )}
      </div>

      {detailId && <ClienteDrawer360 companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      {showNuevo && <NuevoClienteModal onClose={() => setShowNuevo(false)} onCreated={(id) => { setShowNuevo(false); load(); if (id) setDetailId(id); }} />}
      <Toast toast={toast} />
    </div>
  );
}
