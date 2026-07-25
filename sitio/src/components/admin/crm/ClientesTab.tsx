import { useEffect, useMemo, useState } from 'react';
import { S } from './SubscriptionsTab';
import ClienteDrawer360 from './ClienteDrawer360';
import NuevoClienteModal from './NuevoClienteModal';
import PipelineKanban from './PipelineKanban';
import TablaEnterprise, { type ColDef, type QuickDef, type VistaDef } from './TablaEnterprise';
import { useToast, Toast, logStageChange } from './crmHelpers';
import EnriquecerWhatsApp from './EnriquecerWhatsApp';
import RevisarRelaciones from './RevisarRelaciones';

/* ═══ Clientes REALES — primer datatable sobre el estándar TablaEnterprise ═══
 * (proyecto "Datatables Enterprise", estilo HubSpot: filtros → buscador → tabs
 * de vistas guardadas → tabla ordenable con paginación). */

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

/* Densidad enterprise de las celdas (estilos propios del tab). */
const T = {
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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [modo, setModo] = useState<'tabla' | 'kanban'>('tabla');
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

  /* ── Definición del datatable estándar ── */
  const cols: ColDef[] = [
    {
      key: 'cliente', label: 'Cliente', width: '19%', ftype: 'text',
      val: c => (c.contacto?.nombre || c.nombre || '').toLowerCase(),
      render: c => (
        <td style={{ ...T.td, ...T.ell, fontWeight: 700 }}>
          {c.contacto?.nombre || c.nombre}
          {(() => { const cuenta = c.sacs_account || c.nombre; return cuenta && cuenta !== (c.contacto?.nombre || c.nombre) ? <div style={{ ...T.sub, ...T.ell }}>{cuenta}</div> : null; })()}
        </td>
      ),
    },
    {
      key: 'contacto', label: 'Contacto', width: '20%', ftype: 'text',
      val: c => [c.contacto?.email, c.contacto?.whatsapp, c.contacto?.telefono].filter(Boolean).join(' '),
      render: c => (
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
      ),
    },
    {
      key: 'plan', label: 'Plan', width: 112, ftype: 'select',
      options: Object.entries(PLAN_BADGE).map(([v, b]) => ({ v, l: b.label })),
      val: c => c.plan || '',
      render: c => { const b = PLAN_BADGE[c.plan] || null; return <td style={{ ...T.td, ...T.ell }}>{b ? <span style={{ ...T.badge, background: b.bg, color: b.color }}>{b.label}</span> : <span style={{ color: '#c4c8cf' }}>—</span>}</td>; },
    },
    {
      key: 'etapa', label: 'Etapa', width: 120, ftype: 'select',
      options: stages.map(s => ({ v: s.key, l: s.label })),
      val: c => c.pipeline_stage || '',
      render: c => (
        <td style={T.td} onClick={e => e.stopPropagation()}>
          {stages.length === 0 ? <span style={{ color: '#c4c8cf' }}>—</span> : (
            <select value={c.pipeline_stage || ''} onChange={e => setStage(c.id, e.target.value)}
              style={{ ...S.input, padding: '3px 6px', fontSize: '0.72rem', width: '100%', borderColor: c.pipeline_stage && stageBy[c.pipeline_stage] ? stageBy[c.pipeline_stage].color : '#e3e5e9', color: c.pipeline_stage && stageBy[c.pipeline_stage] ? stageBy[c.pipeline_stage].color : '#999', fontWeight: 700 }}>
              <option value="">— etapa —</option>
              {stages.map(s => <option key={s.key} value={s.key} style={{ color: '#333' }}>{s.label}</option>)}
            </select>
          )}
        </td>
      ),
    },
    {
      key: 'arr', label: 'ARR', width: 118, num: true, ftype: 'number', val: c => Number(c.arr || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num, fontWeight: 800 }}>
          {money(c.arr)}
          <div style={{ ...T.sub, fontWeight: 600 }}>{c.subs_activas} sub{c.subs_activas === 1 ? '' : 's'}{c.arr_pendiente > 0 ? <span style={{ color: '#a06600' }}> +{money(c.arr_pendiente)}</span> : ''}</div>
        </td>
      ),
    },
    {
      key: 'pagado', label: 'Pagado', width: 112, num: true, ftype: 'number', val: c => Number(c.total_pagado || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num }}>
          <span style={{ fontWeight: 700 }}>{money(c.total_pagado)}</span>
          <div style={{ ...T.sub, fontWeight: 600 }}>{c.pagos_realizados} pago{c.pagos_realizados === 1 ? '' : 's'}</div>
        </td>
      ),
    },
    {
      key: 'renovacion', label: 'Renovación', width: 118, ftype: 'date', val: c => c.proxima_factura || '',
      render: c => { const venc = c.proxima_factura && c.proxima_factura < new Date().toISOString().slice(0, 10); return <td style={{ ...T.td, ...T.muted, color: venc ? '#b93333' : T.muted.color, fontWeight: venc ? 700 : 400 }}>{fmtDate(c.proxima_factura)}</td>; },
    },
    {
      key: 'salud', label: 'Actividad', width: 128, ftype: 'number', val: c => c.health_score == null ? null : Number(c.health_score),
      render: c => { const dias = c.dias_sin_venta; return (
        <td style={T.td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {c.health_score != null && <span style={{ ...T.badge, background: c.health_score >= 70 ? '#e6f6f2' : c.health_score >= 40 ? '#fdf3e0' : '#fdecea', color: c.health_score >= 70 ? '#1A8F7A' : c.health_score >= 40 ? '#a06600' : '#b93333' }}>{c.health_score}</span>}
            <span style={{ ...T.ell, ...T.muted, fontSize: '0.72rem', color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#9aa0a8' }}>
              {c.ultima_venta_at ? <>{fmtDate(c.ultima_venta_at)}{dias != null ? ` · ${dias}d` : ''}</> : (c.sacs_account ? 'sin datos' : 'sin cuenta')}
            </span>
          </div>
        </td>
      ); },
    },
    /* Campos SOLO para "Más filtros" (sin columna visible). */
    { key: 'cuenta', label: 'Cuenta SACS', ftype: 'text', val: c => c.sacs_account || '' },
    { key: 'correo', label: 'Correo', ftype: 'text', val: c => c.contacto?.email || '' },
    { key: 'telefono', label: 'Teléfono/WhatsApp', ftype: 'text', val: c => c.contacto?.whatsapp || c.contacto?.telefono || '' },
    { key: 'sin_contacto', label: 'Sin contacto', ftype: 'select', options: [{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }], val: c => c.contacto ? 'no' : 'si' },
    { key: 'subs_activas', label: 'Subs activas', ftype: 'number', val: c => Number(c.subs_activas || 0) },
    { key: 'subs_pendientes', label: 'Subs pendientes', ftype: 'number', val: c => Number(c.subs_pendientes || 0) },
    { key: 'arr_pendiente', label: 'ARR pendiente', ftype: 'number', val: c => Number(c.arr_pendiente || 0) },
    { key: 'pagos_realizados', label: 'Núm. de pagos', ftype: 'number', val: c => Number(c.pagos_realizados || 0) },
    { key: 'dias_sin_venta', label: 'Días sin vender', ftype: 'number', val: c => c.dias_sin_venta == null ? null : Number(c.dias_sin_venta) },
    { key: 'ultima_venta', label: 'Última venta SACS', ftype: 'date', val: c => c.ultima_venta_at || '' },
  ];

  const quick: QuickDef[] = [
    { key: 'plan', label: 'Todos los planes', options: Object.entries(PLAN_BADGE).map(([v, b]) => ({ v, l: b.label })), apply: (c, v) => c.plan === v },
    {
      key: 'estado', label: 'Todos', options: [
        { v: 'activos', l: 'Con ARR activo' }, { v: 'pendientes', l: 'Con pendientes de pago' }, { v: 'riesgo', l: 'En riesgo (≥3 días sin vender)' },
      ],
      apply: (c, v) => v === 'activos' ? c.subs_activas > 0 : v === 'pendientes' ? c.subs_pendientes > 0 : (c.dias_sin_venta != null && c.dias_sin_venta >= 3 && c.subs_activas > 0),
    },
  ];

  const vistasBase: VistaDef[] = [
    { key: 'todos', nombre: 'Todos', config: { sort: { key: 'arr', dir: -1 } } },
    { key: 'arr_activo', nombre: 'Con ARR activo', config: { conds: [{ campo: 'subs_activas', op: 'mayor', v1: '0' }], sort: { key: 'arr', dir: -1 } } },
    { key: 'pendientes', nombre: 'Pendientes de pago', config: { conds: [{ campo: 'subs_pendientes', op: 'mayor', v1: '0' }], sort: { key: 'arr', dir: -1 } } },
    { key: 'riesgo', nombre: 'En riesgo', config: { conds: [{ campo: 'dias_sin_venta', op: 'mayor', v1: '2' }, { campo: 'subs_activas', op: 'mayor', v1: '0' }], sort: { key: 'salud', dir: 1 } } },
    { key: 'sin_contacto', nombre: 'Sin contacto', config: { conds: [{ campo: 'sin_contacto', op: 'es', v1: 'si' }] } },
    { key: 'vencidas', nombre: 'Renovación vencida', config: { conds: [{ campo: 'renovacion', op: 'antes_hoy' }], sort: { key: 'renovacion', dir: 1 } } },
  ];

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando clientes reales…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div style={{ padding: '4px 12px 28px' }}>
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
        <TablaEnterprise
          tabla="clientes"
          data={data}
          cols={cols}
          quick={quick}
          vistasBase={vistasBase}
          searchText={c => [c.nombre, c.sacs_account, c.contacto?.nombre, c.contacto?.email, c.contacto?.whatsapp].filter(Boolean).join(' ')}
          searchPlaceholder="Buscar cliente, cuenta o contacto…"
          onRowClick={c => setDetailId(c.id)}
          customBody={modo === 'kanban' ? ((rows: any[]) => (
            stages.length === 0
              ? <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Configura las etapas del pipeline de Clientes en <b>Configuración → Pipelines</b>.</div>
              : <PipelineKanban
                  stages={stages}
                  items={rows}
                  getId={(c: any) => c.id}
                  getStage={(c: any) => c.pipeline_stage || stages[0]?.key}
                  colValue={(its: any[]) => money(its.reduce((s, c) => s + Number(c.arr || 0), 0)) + ' ARR'}
                  onMove={(id, key) => setStage(id, key)}
                  renderCard={(c: any) => (
                    <div onClick={() => setDetailId(c.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{c.sacs_account || c.nombre}</div>
                      {c.contacto?.nombre ? <div style={{ fontSize: '0.72rem', color: '#999' }}>{c.contacto.nombre}</div> : null}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{money(c.arr)}</span>
                        {c.plan && PLAN_BADGE[c.plan] ? <span style={{ ...T.badge, background: PLAN_BADGE[c.plan].bg, color: PLAN_BADGE[c.plan].color }}>{PLAN_BADGE[c.plan].label}</span> : null}
                      </div>
                    </div>
                  )}
                />
          )) : null}
          actions={<>
            <button onClick={() => setShowNuevo(true)} title="Alta completa: cliente + contacto + cuenta SACS + suscripción" style={{ ...S.btnSmall, background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 700 }}>+ Nuevo cliente</button>
            <RevisarRelaciones onDone={load} />
            <EnriquecerWhatsApp onDone={load} />
            <button onClick={() => onConfig?.()} title="Configurar etapas del pipeline de Clientes" style={S.btnSmall}>⚙️ Etapas</button>
            <div style={{ display: 'flex', gap: 0, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
              {(['tabla', 'kanban'] as const).map(v => (
                <button key={v} onClick={() => setModo(v)} style={{ ...S.btnSmall, border: 'none', borderRadius: 0, background: modo === v ? '#1a1a1a' : '#fff', color: modo === v ? '#fff' : '#555', textTransform: 'capitalize' }}>{v === 'kanban' ? 'Kanban' : 'Tabla'}</button>
              ))}
            </div>
          </>}
        />
      </div>

      {detailId && <ClienteDrawer360 companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      {showNuevo && <NuevoClienteModal onClose={() => setShowNuevo(false)} onCreated={(id) => { setShowNuevo(false); load(); if (id) setDetailId(id); }} />}
      <Toast toast={toast} />
    </div>
  );
}
