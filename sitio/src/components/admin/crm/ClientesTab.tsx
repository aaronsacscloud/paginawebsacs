import { useEffect, useMemo, useState } from 'react';
import { Users, TrendingUp, Wallet, AlertTriangle, Plus, ChevronDown, Link2, MessageCircle, Download, Settings2, LayoutGrid, Table2, Infinity as InfinityIcon } from 'lucide-react';
import { S } from './SubscriptionsTab';
import ClienteDrawer360 from './ClienteDrawer360';
import NuevoClienteModal from './NuevoClienteModal';
import PipelineKanban from './PipelineKanban';
import TablaEnterprise, { type ColDef, type QuickDef, type VistaDef } from './TablaEnterprise';
import { useToast, Toast, logStageChange } from './crmHelpers';
import EnriquecerWhatsApp from './EnriquecerWhatsApp';
import RevisarRelaciones from './RevisarRelaciones';
import { SENAL_LABEL } from '../../../lib/crm/senales';
import { useIsMobile } from '../../../lib/ui/mobile';
import HealthScoreBadge from './HealthScoreBadge';

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
  /* Stat-cards del spec UI/UX: chip de icono pastel + valor grande + dual-value con dots. */
  kpiCard: { background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)', display: 'flex', flexDirection: 'column' as const, gap: 10 } as const,
  kpiChip: (bg: string) => ({ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }) as const,
  kLabel: { fontSize: '0.68rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const,
  kValue: { fontSize: '1.55rem', fontWeight: 800, color: '#16181d', letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as const } as const,
  dot: (c: string) => ({ width: 7, height: 7, borderRadius: 99, background: c, flexShrink: 0 }) as const,
  dualNum: { fontSize: '0.82rem', fontWeight: 700, color: '#16181d', fontVariantNumeric: 'tabular-nums' as const } as const,
  dualLbl: { fontSize: '0.62rem', fontWeight: 600, color: '#9aa0a8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as const,
  menuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 'none', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#333', textAlign: 'left' as const, textDecoration: 'none', boxSizing: 'border-box' as const } as const,
};

/* Tarjeta KPI reutilizable (fila: chip+label · valor · dual-value). */
function KpiCard({ icon, chipBg, label, value, duals, style }: { icon: any; chipBg: string; label: string; value: any; duals: { dot: string; num: any; lbl: string }[]; style?: any }) {
  return (
    <div style={{ ...T.kpiCard, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={T.kpiChip(chipBg)}>{icon}</div>
        <span style={T.kLabel}>{label}</span>
      </div>
      <div style={T.kValue}>{value}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {duals.map((d, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={T.dot(d.dot)} />
            <span style={T.dualNum}>{d.num}</span>
            <span style={T.dualLbl}>{d.lbl}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ClientesTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [data, setData] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [modo, setModo] = useState<'tabla' | 'kanban'>('tabla');
  const [stages, setStages] = useState<{ key: string; label: string; color: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast, show } = useToast();

  // Cierra "Más acciones" con click fuera o Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onClick = () => setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick); };
  }, [menuOpen]);

  // KPIs con dual-value (spec UI/UX): riesgo/vencidas/pagado se derivan de data.
  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const pagado = data.reduce((a, c) => a + Number(c.total_pagado || 0), 0);
    const pagos = data.reduce((a, c) => a + Number(c.pagos_realizados || 0), 0);
    const arrPend = data.reduce((a, c) => a + Number(c.arr_pendiente || 0), 0);
    return {
      pagado, pagos,
      promedio: pagos > 0 ? pagado / pagos : 0,
      arrPend,
      riesgo: data.filter(c => c.dias_sin_venta != null && c.dias_sin_venta >= 3 && c.subs_activas > 0).length,
      vencidas: data.filter(c => c.proxima_factura && c.proxima_factura < hoy).length,
    };
  }, [data]);
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
      key: 'cliente', label: 'Cliente', width: '17%', ftype: 'text',
      val: c => (c.contacto?.nombre || c.nombre || '').toLowerCase(),
      render: c => (
        <td style={{ ...T.td, ...T.ell, fontWeight: 700 }}>
          {c.contacto?.nombre || c.nombre}
          {(() => { const cuenta = c.sacs_account || c.nombre; return cuenta && cuenta !== (c.contacto?.nombre || c.nombre) ? <div style={{ ...T.sub, ...T.ell }}>{cuenta}</div> : null; })()}
        </td>
      ),
    },
    {
      key: 'contacto', label: 'Contacto', width: '18%', ftype: 'text',
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
      key: 'plan', label: 'Plan', width: 104, ftype: 'select',
      options: Object.entries(PLAN_BADGE).map(([v, b]) => ({ v, l: b.label })),
      val: c => c.plan || '',
      render: c => { const b = PLAN_BADGE[c.plan] || null; return <td style={{ ...T.td, ...T.ell }}>{b ? <span style={{ ...T.badge, background: b.bg, color: b.color }}>{b.label}</span> : <span style={{ color: '#c4c8cf' }}>—</span>}</td>; },
    },
    {
      key: 'arr', label: 'ARR', width: 112, num: true, ftype: 'number', val: c => Number(c.arr || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num, fontWeight: 800 }}>
          {money(c.arr)}
          <div style={{ ...T.sub, fontWeight: 600 }}>
            {c.vitalicia
              ? <span style={{ ...T.badge, background: '#f1effd', color: '#6C5CE7', fontWeight: 700 }}>Vitalicia</span>
              : <>{c.subs_activas} sub{c.subs_activas === 1 ? '' : 's'}{c.arr_pendiente > 0 ? <span style={{ color: '#a06600' }}> +{money(c.arr_pendiente)}</span> : ''}</>}
          </div>
        </td>
      ),
    },
    {
      key: 'pagado', label: 'Pagado', width: 104, num: true, ftype: 'number', val: c => Number(c.total_pagado || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num }}>
          <span style={{ fontWeight: 700 }}>{money(c.total_pagado)}</span>
          <div style={{ ...T.sub, fontWeight: 600 }}>{c.pagos_realizados} pago{c.pagos_realizados === 1 ? '' : 's'}</div>
        </td>
      ),
    },
    {
      key: 'renovacion', label: 'Renovación', width: 108, ftype: 'date', val: c => c.proxima_factura || '',
      render: c => { const venc = c.proxima_factura && c.proxima_factura < new Date().toISOString().slice(0, 10); return <td style={{ ...T.td, ...T.muted, color: venc ? '#b93333' : T.muted.color, fontWeight: venc ? 700 : 400 }}>{fmtDate(c.proxima_factura)}</td>; },
    },
    {
      key: 'salud', label: 'Actividad', width: 138, ftype: 'number', val: c => c.health_score == null ? null : Number(c.health_score),
      render: c => { const dias = c.dias_sin_venta; const st = c.pipeline_stage && stageBy[c.pipeline_stage]; return (
        <td style={T.td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {c.health_score != null && <span style={{ ...T.badge, background: c.health_score >= 70 ? '#e6f6f2' : c.health_score >= 40 ? '#fdf3e0' : '#fdecea', color: c.health_score >= 70 ? '#1A8F7A' : c.health_score >= 40 ? '#a06600' : '#b93333' }}>{c.health_score}</span>}
            <span style={{ ...T.ell, ...T.muted, fontSize: '0.72rem', color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#9aa0a8' }}>
              {c.ultima_venta_at ? <>{fmtDate(c.ultima_venta_at)}{dias != null ? ` · ${dias}d` : ''}</> : (c.sacs_account ? 'sin datos' : 'sin cuenta')}
            </span>
          </div>
          <div style={{ ...T.sub, marginTop: 3, ...T.ell, color: st ? st.color : '#c4c8cf', fontWeight: st ? 700 : 400 }}>
            {st ? st.label : 'sin etapa'}
          </div>
        </td>
      ); },
    },
    {
      key: 'ventas30', label: 'Ventas 30d', width: 116, num: true, ftype: 'number', val: c => Number(c.total_30d || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num }}>
          {c.total_30d != null || c.ventas_30d != null ? (
            <>
              <span style={{ fontWeight: 700 }}>{money(c.total_30d || 0)}</span>
              <div style={{ ...T.sub, fontWeight: 600 }}>{c.ventas_30d || 0} venta{c.ventas_30d === 1 ? '' : 's'}</div>
            </>
          ) : <span style={{ color: '#c4c8cf' }}>—</span>}
        </td>
      ),
    },
    {
      key: 'senal', label: 'Señal', width: 118, ftype: 'select',
      options: Object.keys(SENAL_LABEL).map(t => ({ v: t, l: SENAL_LABEL[t] })),
      val: c => c.senal_peso || 0,     // ordena por urgencia/valor
      render: c => (
        <td style={T.td}>
          {c.senal_tipo ? (
            <span title={c.senal_titulo || ''} style={{ ...T.badge, display: 'inline-flex', alignItems: 'center', background: c.senal_nivel === 'riesgo' ? '#fdecea' : '#e6f6f2', color: c.senal_nivel === 'riesgo' ? '#b93333' : '#1A8F7A', maxWidth: '100%', overflow: 'hidden' }}>
              <span style={{ ...T.ell }}>{SENAL_LABEL[c.senal_tipo] || c.senal_tipo}</span>
            </span>
          ) : <span style={{ color: '#c4c8cf' }}>—</span>}
        </td>
      ),
    },
    /* Campos SOLO para "Más filtros" (sin columna visible). */
    { key: 'etapa', label: 'Etapa', ftype: 'select', options: stages.map(s => ({ v: s.key, l: s.label })), val: c => c.pipeline_stage || '' },
    { key: 'vitalicia', label: 'Licencia', ftype: 'select', options: [{ v: 'si', l: 'Vitalicia' }, { v: 'no', l: 'Recurrente' }], val: c => c.vitalicia ? 'si' : 'no' },
    { key: 'senal_nivel', label: 'Señal (nivel)', ftype: 'select', options: [{ v: 'oportunidad', l: 'Oportunidad' }, { v: 'riesgo', l: 'Riesgo' }, { v: '', l: 'Sin señal' }], val: c => c.senal_nivel || '' },
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
    { key: 'senal', label: 'Cualquier señal', options: [{ v: 'oportunidad', l: 'Con oportunidad' }, { v: 'riesgo', l: 'En riesgo' }], apply: (c, v) => c.senal_nivel === v },
    { key: 'licencia', label: 'Tipo de licencia', options: [{ v: 'si', l: 'Vitalicia' }, { v: 'no', l: 'Recurrente' }], apply: (c, v) => (v === 'si') === !!c.vitalicia },
  ];

  const vistasBase: VistaDef[] = [
    { key: 'todos', nombre: 'Todos', config: { sort: { key: 'arr', dir: -1 } } },
    { key: 'arr_activo', nombre: 'Con ARR activo', config: { conds: [{ campo: 'subs_activas', op: 'mayor', v1: '0' }], sort: { key: 'arr', dir: -1 } } },
    { key: 'pendientes', nombre: 'Pendientes de pago', config: { conds: [{ campo: 'subs_pendientes', op: 'mayor', v1: '0' }], sort: { key: 'arr', dir: -1 } } },
    { key: 'riesgo', nombre: 'En riesgo', config: { conds: [{ campo: 'dias_sin_venta', op: 'mayor', v1: '2' }, { campo: 'subs_activas', op: 'mayor', v1: '0' }], sort: { key: 'salud', dir: 1 } } },
    { key: 'sin_contacto', nombre: 'Sin contacto', config: { conds: [{ campo: 'sin_contacto', op: 'es', v1: 'si' }] } },
    { key: 'vencidas', nombre: 'Renovación vencida', config: { conds: [{ campo: 'renovacion', op: 'antes_hoy' }], sort: { key: 'renovacion', dir: 1 } } },
    { key: 'oportunidad', nombre: 'Con oportunidad', config: { conds: [{ campo: 'senal_nivel', op: 'es', v1: 'oportunidad' }], sort: { key: 'senal', dir: -1 } } },
    { key: 'vitalicias', nombre: 'Licencias vitalicias', config: { conds: [{ campo: 'vitalicia', op: 'es', v1: 'si' }], sort: { key: 'pagado', dir: -1 } } },
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

      {/* KPIs: en móvil carrusel scroll-snap (1 visible + peek → no gasta pantalla
          y se ve claro que se desliza); en desktop, grid multi-columna. */}
      <div style={isMobile
        ? { display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', marginBottom: 16, paddingBottom: 4, marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }
        : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14, marginBottom: 18 }}>
        {(() => { const kStyle = isMobile ? { minWidth: '82vw', scrollSnapAlign: 'start' as const, flexShrink: 0 } : undefined; return (<>
        <KpiCard style={kStyle} icon={<Users size={18} strokeWidth={2} color="#4B7BE5" />} chipBg="#eef2fe" label="Clientes" value={tot?.clientes ?? '—'}
          duals={[{ dot: '#1A8F7A', num: tot?.activos ?? 0, lbl: 'con ARR activo' }, { dot: '#c6cad2', num: Math.max(0, (tot?.clientes || 0) - (tot?.activos || 0)), lbl: 'sin ARR' }]} />
        <KpiCard style={kStyle} icon={<TrendingUp size={18} strokeWidth={2} color="#1A8F7A" />} chipBg="#e6f6f2" label="ARR" value={money(tot?.arr)}
          duals={[{ dot: '#1A8F7A', num: money(tot?.arr), lbl: 'activo' }, { dot: '#E8A838', num: money(kpis.arrPend), lbl: 'pendiente' }]} />
        <KpiCard style={kStyle} icon={<AlertTriangle size={18} strokeWidth={2} color="#d9534a" />} chipBg="#fdf0ee" label="Atención" value={kpis.riesgo}
          duals={[{ dot: '#d9534a', num: kpis.riesgo, lbl: '≥3 días sin vender' }, { dot: '#E8A838', num: kpis.vencidas, lbl: 'renov. vencida' }]} />
        <KpiCard style={kStyle} icon={<InfinityIcon size={18} strokeWidth={2} color="#6C5CE7" />} chipBg="#f1effd" label="Licencias vitalicias" value={tot?.vitalicias ?? 0}
          duals={[{ dot: '#6C5CE7', num: money(tot?.vitalicias_pagado), lbl: 'pagado (ingreso único)' }, { dot: '#c6cad2', num: 'fuera del ARR', lbl: 'no recurrente' }]} />
        </>); })()}
      </div>

      <div style={{ ...S.card, padding: '20px 22px', borderRadius: 14, border: '1px solid #e9eaee', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' }}>
        <TablaEnterprise
          tabla="clientes"
          data={data}
          cols={cols}
          quick={quick}
          vistasBase={vistasBase}
          searchText={c => [c.nombre, c.sacs_account, c.contacto?.nombre, c.contacto?.email, c.contacto?.whatsapp].filter(Boolean).join(' ')}
          searchPlaceholder="Buscar cliente, cuenta o contacto…"
          minWidth={1100}
          onRowClick={c => { if (editId !== c.id) setDetailId(c.id); }}
          mobileCard={(c: any) => (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contacto?.nombre || c.nombre}</div>
                  {(c.sacs_account || c.nombre) && <div style={{ fontSize: '0.74rem', color: '#8a8f98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sacs_account || c.nombre}</div>}
                </div>
                {c.health_score != null && <HealthScoreBadge score={c.health_score} factors={c.health_factors} size="sm" />}
                <span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{c.vitalicia ? <span style={{ ...T.badge, background: '#f1effd', color: '#6C5CE7' }}>Vitalicia</span> : `${money(c.arr)} ARR`}</span>
                {c.plan && PLAN_BADGE[c.plan] && <span style={{ ...T.badge, background: PLAN_BADGE[c.plan].bg, color: PLAN_BADGE[c.plan].color }}>{PLAN_BADGE[c.plan].label}</span>}
                {c.proxima_factura && <span style={{ fontSize: '0.72rem', color: c.proxima_factura < new Date().toISOString().slice(0, 10) ? '#b93333' : '#9aa0a8' }}>renov {fmtDate(c.proxima_factura)}</span>}
                {c.senal_tipo && <span style={{ ...T.badge, background: c.senal_nivel === 'riesgo' ? '#fdecea' : '#e6f6f2', color: c.senal_nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{SENAL_LABEL[c.senal_tipo] || c.senal_tipo}</span>}
              </div>
              {/* Contacto + edición inline (targets ≥44px) */}
              <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                {editId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="correo@…" style={{ ...S.input, height: 44 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={eWa} onChange={e => setEWa(e.target.value)} placeholder="+52…" style={{ ...S.input, height: 44, flex: 1, minWidth: 0 }} />
                      <button disabled={saving} onClick={() => saveEdit(c)} style={{ ...S.btnSmall, minWidth: 44, height: 44, color: '#1A8F7A', fontWeight: 800 }}>{saving ? '…' : '✓'}</button>
                      <button onClick={() => setEditId(null)} style={{ ...S.btnSmall, minWidth: 44, height: 44 }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.76rem', color: c.contacto?.email ? '#666' : '#c62828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.contacto?.email || c.contacto?.whatsapp || (c.contacto ? '—' : 'sin contacto')}
                    </span>
                    {c.contacto?.whatsapp && (
                      <a href={`https://wa.me/${String(c.contacto.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="WhatsApp"
                        style={{ ...S.btnSmall, minWidth: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#1A8F7A', borderColor: '#bfe8df' }}>💬</a>
                    )}
                    {c.contacto?.whatsapp && (
                      <a href={`tel:${String(c.contacto.whatsapp).replace(/[^\d+]/g, '')}`} onClick={e => e.stopPropagation()} title="Llamar"
                        style={{ ...S.btnSmall, minWidth: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>📞</a>
                    )}
                    <button onClick={e => { e.stopPropagation(); startEdit(c); }} title="Editar contacto" style={{ ...S.btnSmall, minWidth: 44, height: 44 }}>✏️</button>
                  </div>
                )}
              </div>
            </div>
          )}
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
            <button onClick={() => setShowNuevo(true)} title="Alta completa: cliente + contacto + cuenta SACS + suscripción"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: isMobile ? 44 : 36, flex: isMobile ? 1 : undefined, minWidth: 0, padding: '0 16px', border: 'none', borderRadius: 10, background: '#1a1a1a', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,0.18)', whiteSpace: 'nowrap' }}>
              <Plus size={15} strokeWidth={2.5} /> Nuevo cliente
            </button>
            <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setMenuOpen(o => !o)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: isMobile ? 44 : 36, padding: isMobile ? '0 12px' : '0 14px', border: '1px solid #e2e4e9', borderRadius: 10, background: menuOpen ? '#f7f8fa' : '#fff', color: '#333', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {isMobile ? 'Más' : 'Más acciones'} <ChevronDown size={14} strokeWidth={2} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {menuOpen && isMobile && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 949 }} />}
              {menuOpen && (
                <div style={isMobile
                  ? { position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,0.18)', padding: '8px 8px calc(12px + env(safe-area-inset-bottom))', zIndex: 950 }
                  : { position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 236, background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, boxShadow: '0 4px 6px -2px rgba(16,24,40,0.05), 0 12px 24px -4px rgba(16,24,40,0.12)', padding: 6, zIndex: 50 }}>
                  <RevisarRelaciones onDone={() => { setMenuOpen(false); load(); }} trigger={open => (
                    <button className="te-item" style={T.menuItem} onClick={open}><Link2 size={15} color="#8a8f98" /> Revisar relaciones</button>
                  )} />
                  <EnriquecerWhatsApp onDone={() => { setMenuOpen(false); load(); }} trigger={open => (
                    <button className="te-item" style={T.menuItem} onClick={open}><MessageCircle size={15} color="#8a8f98" /> Enriquecer WhatsApp</button>
                  )} />
                  <div style={{ height: 1, background: '#f1f2f5', margin: '6px 4px' }} />
                  <a className="te-item" style={T.menuItem} href="/api/crm/arr/export-clientes" onClick={() => setMenuOpen(false)}><Download size={15} color="#8a8f98" /> Exportar clientes</a>
                  <div style={{ height: 1, background: '#f1f2f5', margin: '6px 4px' }} />
                  <button className="te-item" style={T.menuItem} onClick={() => { setMenuOpen(false); onConfig?.(); }}><Settings2 size={15} color="#8a8f98" /> Configurar etapas</button>
                  <button className="te-item" style={T.menuItem} onClick={() => { setMenuOpen(false); setModo(m => m === 'tabla' ? 'kanban' : 'tabla'); }}>
                    {modo === 'tabla' ? <LayoutGrid size={15} color="#8a8f98" /> : <Table2 size={15} color="#8a8f98" />}
                    {modo === 'tabla' ? 'Ver como Kanban' : 'Ver como Tabla'}
                  </button>
                </div>
              )}
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
