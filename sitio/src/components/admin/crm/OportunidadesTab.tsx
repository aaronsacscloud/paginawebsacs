import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, AlertTriangle, Target, DollarSign } from 'lucide-react';
import TablaEnterprise, { type ColDef, type QuickDef, type VistaDef } from './TablaEnterprise';
import ClienteDrawer360 from './ClienteDrawer360';
import HealthScoreBadge from './HealthScoreBadge';
import { SENAL_LABEL } from '../../../lib/crm/senales';
import { useIsMobile } from '../../../lib/ui/mobile';

/* ═══ Oportunidades — todos los clientes con una señal de venta o riesgo ═══
 * (datos reales de SACS vía companies.actividad; qué venderle / a quién atender). */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const T = {
  td: { padding: '12px 14px', fontSize: '0.79rem', color: '#333', borderBottom: '1px solid #f1f2f5', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
  num: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
  ell: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as const,
  sub: { fontSize: '0.67rem', color: '#a7abb3', marginTop: 2 } as const,
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
};

export default function OportunidadesTab() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<any[]>([]);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const j = await fetch('/api/crm/arr/oportunidades').then(r => r.json());
      if (j.error) setError(j.error); else { setData(j.data || []); setRes(j.resumen || null); }
    } catch (e: any) { setError(e?.message || 'Error'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const tipoOptions = useMemo(() => Array.from(new Set(data.map(d => d.top_tipo))).map(t => ({ v: t, l: SENAL_LABEL[t] || t })), [data]);

  const cols: ColDef[] = [
    {
      key: 'cliente', label: 'Cliente', width: '20%', ftype: 'text',
      val: c => (c.nombre || '') + ' ' + (c.sacs_account || ''),
      render: c => <td style={{ ...T.td, ...T.ell, fontWeight: 700 }}>{c.nombre}{c.sacs_account && c.sacs_account !== c.nombre ? <div style={{ ...T.sub, ...T.ell }}>{c.sacs_account}</div> : null}</td>,
    },
    {
      key: 'senal', label: 'Señal principal', width: '38%', ftype: 'text',
      val: c => c.top_titulo || '',
      render: c => (
        <td style={T.td}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.95rem', lineHeight: 1.2 }}>{c.top_nivel === 'riesgo' ? '⚠️' : '📈'}</span>
            <div style={{ minWidth: 0, whiteSpace: 'normal' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: c.top_nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{c.top_titulo}</div>
              <div style={{ fontSize: '0.74rem', color: '#666' }}>{c.top_accion}</div>
            </div>
          </div>
        </td>
      ),
    },
    {
      key: 'tipo', label: 'Tipo', width: 150, ftype: 'select', options: Object.keys(SENAL_LABEL).map(t => ({ v: t, l: SENAL_LABEL[t] })),
      val: c => c.top_tipo,
      render: c => <td style={T.td}><span style={{ ...T.badge, background: c.top_nivel === 'riesgo' ? '#fdecea' : '#e6f6f2', color: c.top_nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{SENAL_LABEL[c.top_tipo] || c.top_tipo}</span></td>,
    },
    {
      key: 'mrr', label: 'MRR', width: 110, num: true, ftype: 'number', val: c => Number(c.mrr || 0),
      render: c => <td style={{ ...T.td, ...T.num, fontWeight: 700 }}>{money(c.mrr)}</td>,
    },
    {
      key: 'salud', label: 'Salud', width: 90, num: true, ftype: 'number', val: c => c.health_score == null ? null : Number(c.health_score),
      render: c => <td style={{ ...T.td, ...T.num }}>{c.health_score == null ? <span style={{ color: '#c4c8cf' }}>—</span> : <span style={{ fontWeight: 800, color: c.health_score >= 70 ? '#1A8F7A' : c.health_score >= 40 ? '#a06600' : '#b93333' }}>{c.health_score}</span>}</td>,
    },
    // filtro-only
    { key: 'nivel', label: 'Nivel', ftype: 'select', options: [{ v: 'oportunidad', l: 'Oportunidad' }, { v: 'riesgo', l: 'Riesgo' }], val: c => c.top_nivel },
    { key: 'dias', label: 'Días sin vender', ftype: 'number', val: c => c.dias_sin_venta == null ? null : Number(c.dias_sin_venta) },
  ];

  const quick: QuickDef[] = [
    { key: 'nivel', label: 'Todo', options: [{ v: 'oportunidad', l: 'Solo oportunidades' }, { v: 'riesgo', l: 'Solo riesgos' }], apply: (c, v) => c.top_nivel === v },
    { key: 'tipo', label: 'Todos los tipos', options: tipoOptions, apply: (c, v) => c.top_tipo === v },
  ];
  const vistasBase: VistaDef[] = [
    { key: 'todas', nombre: 'Todas', config: {} },
    { key: 'oport', nombre: 'Oportunidades', config: { conds: [{ campo: 'nivel', op: 'es', v1: 'oportunidad' }] } },
    { key: 'riesgos', nombre: 'Riesgos', config: { conds: [{ campo: 'nivel', op: 'es', v1: 'riesgo' }] } },
    { key: 'sucursales', nombre: 'Ampliar sucursales', config: { conds: [{ campo: 'tipo', op: 'es', v1: 'sucursales' }] } },
    { key: 'creciendo', nombre: 'Creciendo', config: { conds: [{ campo: 'tipo', op: 'es', v1: 'creciendo' }] } },
    { key: 'churn', nombre: 'En riesgo de irse', config: { conds: [{ campo: 'tipo', op: 'es', v1: 'riesgo_churn' }], sort: { key: 'salud', dir: 1 } } },
  ];

  const kpis = [
    { icon: <Target size={18} color="#4B7BE5" />, bg: '#eef2fe', label: 'Clientes con señal', v: res?.total ?? 0 },
    { icon: <TrendingUp size={18} color="#1A8F7A" />, bg: '#e6f6f2', label: 'Con oportunidad', v: res?.oportunidades ?? 0 },
    { icon: <AlertTriangle size={18} color="#d9534a" />, bg: '#fdf0ee', label: 'En riesgo', v: res?.riesgos ?? 0 },
    { icon: <DollarSign size={18} color="#a06600" />, bg: '#fdf6e8', label: 'ARR en riesgo', v: money(res?.arr_en_riesgo) },
  ];

  return (
    <div style={{ padding: '4px 12px 28px' }}>
      <style>{`.ct360 tbody tr:hover td { background: #f7f9fc; } @media (hover: none) { .ct360 tbody tr:active td { background: #f7f9fc; } }`}</style>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16181d' }}>Radar de ventas</div>
        <div style={{ fontSize: '0.8rem', color: '#8a8f98' }}>Clientes con una señal real de venta (upsell/cross-sell) o de riesgo — para saber a quién ofrecerle qué.</div>
      </div>

      <div style={isMobile
        ? { display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', marginBottom: 16, paddingBottom: 4, marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }
        : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)', display: 'flex', alignItems: 'center', gap: 12, ...(isMobile ? { minWidth: '72vw', scrollSnapAlign: 'start' as const, flexShrink: 0 } : {}) }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16181d', fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' }}>
        {error && <div style={{ background: '#fdecea', color: '#b93333', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem' }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Analizando oportunidades…</div>
        ) : (
          <TablaEnterprise
            tabla="oportunidades"
            data={data}
            cols={cols}
            quick={quick}
            vistasBase={vistasBase}
            searchText={c => [c.nombre, c.sacs_account, c.top_titulo].filter(Boolean).join(' ')}
            searchPlaceholder="Buscar cliente o señal…"
            onRowClick={c => setDetailId(c.company_id)}
            minWidth={980}
            mobileCard={(c: any) => (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                    {c.sacs_account && c.sacs_account !== c.nombre && <div style={{ fontSize: '0.74rem', color: '#8a8f98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sacs_account}</div>}
                  </div>
                  {c.health_score != null && <HealthScoreBadge score={c.health_score} factors={c.health_factors} size="sm" />}
                  <span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>
                </div>
                {/* Señal principal: la columna clave — texto COMPLETO, sin truncar */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: '10px 12px', borderRadius: 10, background: c.top_nivel === 'riesgo' ? '#fdf0ee' : '#eefaf6' }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1.2, flexShrink: 0 }}>{c.top_nivel === 'riesgo' ? '⚠️' : '📈'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: c.top_nivel === 'riesgo' ? '#b93333' : '#1A8F7A', whiteSpace: 'normal' }}>{c.top_titulo}</div>
                    {c.top_accion && <div style={{ fontSize: '0.76rem', color: '#5b616e', whiteSpace: 'normal', marginTop: 2 }}>{c.top_accion}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ ...T.badge, background: c.top_nivel === 'riesgo' ? '#fdecea' : '#e6f6f2', color: c.top_nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{SENAL_LABEL[c.top_tipo] || c.top_tipo}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', marginLeft: 'auto' }}>{money(c.mrr)} <span style={{ fontSize: '0.7rem', color: '#9aa0a8', fontWeight: 600 }}>MRR</span></span>
                </div>
              </div>
            )}
            emptyMsg="Sin señales por ahora — o falta sincronizar la actividad de SACS."
          />
        )}
      </div>

      {detailId && <ClienteDrawer360 companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}
