import { cloneElement, useEffect, useMemo, useState } from 'react';

/* ═══ TablaEnterprise — el datatable ESTÁNDAR del CRM (estilo HubSpot) ═══
 * Layout: filtros principales arriba (+acciones) → buscador → tabs de VISTAS
 * (precreadas + guardadas en Supabase) → tabla ordenable → paginación.
 * Reutilizable: cada tab del CRM le pasa sus columnas/filtros/vistas base y
 * obtiene el mismo comportamiento (proyecto "Datatables Enterprise").
 *
 * Vistas guardadas: /api/crm/vistas (tabla crm_vistas). Una vista = nombre +
 * config { search, quick, conds, sort }. Las base (fijas) se definen por código.
 */

export type Opcion = { v: string; l: string };
export type ColDef = {
  key: string;
  label: string;
  render?: (row: any) => any;      // sin render ⇒ columna oculta (solo para filtros)
  val?: (row: any) => any;          // valor para ordenar/filtrar
  ftype?: 'text' | 'select' | 'number' | 'date';
  options?: Opcion[];
  num?: boolean;                    // alineado a la derecha
  width?: number | string;
  sortable?: boolean;               // default true si hay val
};
export type QuickDef = { key: string; label: string; options: Opcion[]; apply: (row: any, v: string) => boolean };
export type Cond = { campo: string; op: string; v1?: string; v2?: string };
export type VistaConfig = { search?: string; quick?: Record<string, string>; conds?: Cond[]; sort?: { key: string; dir: 1 | -1 } | null };
export type VistaDef = { key: string; nombre: string; config: VistaConfig; fija?: boolean; id?: string };

const OPS: Record<string, Opcion[]> = {
  text: [
    { v: 'contiene', l: 'contiene' }, { v: 'no_contiene', l: 'no contiene' },
    { v: 'es', l: 'es exactamente' }, { v: 'vacio', l: 'está vacío' }, { v: 'no_vacio', l: 'no está vacío' },
  ],
  select: [{ v: 'es', l: 'es' }, { v: 'no_es', l: 'no es' }],
  number: [
    { v: 'mayor', l: 'mayor que' }, { v: 'menor', l: 'menor que' },
    { v: 'igual', l: 'igual a' }, { v: 'entre', l: 'entre' },
  ],
  date: [
    { v: 'antes', l: 'antes de' }, { v: 'despues', l: 'después de' },
    { v: 'entre', l: 'entre' }, { v: 'antes_hoy', l: 'ya venció (antes de hoy)' }, { v: 'vacio', l: 'sin fecha' },
  ],
};

function evalCond(col: ColDef, row: any, c: Cond): boolean {
  const raw = col.val ? col.val(row) : (row as any)[col.key];
  const t = col.ftype || 'text';
  if (t === 'text' || t === 'select') {
    const s = String(raw == null ? '' : raw).toLowerCase().trim();
    const q = String(c.v1 == null ? '' : c.v1).toLowerCase().trim();
    if (c.op === 'contiene') return s.includes(q);
    if (c.op === 'no_contiene') return !s.includes(q);
    if (c.op === 'es') return s === q;
    if (c.op === 'no_es') return s !== q;
    if (c.op === 'vacio') return s === '';
    if (c.op === 'no_vacio') return s !== '';
    return true;
  }
  if (t === 'number') {
    const n = Number(raw);
    const a = Number(c.v1), b = Number(c.v2);
    if (Number.isNaN(n)) return false;
    if (c.op === 'mayor') return n > a;
    if (c.op === 'menor') return n < a;
    if (c.op === 'igual') return n === a;
    if (c.op === 'entre') return n >= Math.min(a, b) && n <= Math.max(a, b);
    return true;
  }
  // date: strings YYYY-MM-DD comparables lexicográficamente
  const d = String(raw || '').slice(0, 10);
  if (c.op === 'vacio') return !d;
  if (!d) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  if (c.op === 'antes_hoy') return d < hoy;
  if (c.op === 'antes') return !!c.v1 && d < c.v1;
  if (c.op === 'despues') return !!c.v1 && d > c.v1;
  if (c.op === 'entre') return !!c.v1 && !!c.v2 && d >= c.v1 && d <= c.v2;
  return true;
}

/* Estilos del estándar (compactos, enterprise). */
const E = {
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.83rem', outline: 'none', background: '#fff' } as const,
  btn: { padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.79rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  btnDark: { padding: '7px 12px', border: 'none', borderRadius: 8, fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  th: { textAlign: 'left' as const, padding: '10px 14px', fontSize: '0.63rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e8eaee', whiteSpace: 'nowrap' as const, background: '#fafbfc', position: 'sticky' as const, top: 0, zIndex: 1, cursor: 'default' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eef2ff', color: '#3730a3', borderRadius: 99, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700 } as const,
  tab: (act: boolean) => ({ padding: '8px 13px', border: 'none', borderBottom: act ? '2.5px solid #1a1a1a' : '2.5px solid transparent', background: 'none', cursor: 'pointer', fontWeight: act ? 800 : 600, fontSize: '0.8rem', color: act ? '#1a1a1a' : '#777', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 6 }) as const,
};

export default function TablaEnterprise({
  tabla, data, cols, quick = [], vistasBase, searchText, searchPlaceholder = 'Buscar…',
  actions, onRowClick, rowKey = (r: any) => r.id, customBody, minWidth = 1080, emptyMsg = 'Sin resultados con esos filtros.',
}: {
  tabla: string;
  data: any[];
  cols: ColDef[];
  quick?: QuickDef[];
  vistasBase: VistaDef[];
  searchText: (row: any) => string;
  searchPlaceholder?: string;
  actions?: any;
  onRowClick?: (row: any) => void;
  rowKey?: (row: any) => string;
  customBody?: ((rows: any[]) => any) | null;   // p.ej. kanban: reemplaza la tabla pero respeta filtros
  minWidth?: number;
  emptyMsg?: string;
}) {
  const [vistaKey, setVistaKey] = useState(vistasBase[0]?.key || 'todos');
  const [vistasCustom, setVistasCustom] = useState<VistaDef[]>([]);
  const [sinMigracion, setSinMigracion] = useState(false);
  const [search, setSearch] = useState('');
  const [quickVals, setQuickVals] = useState<Record<string, string>>({});
  const [conds, setConds] = useState<Cond[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(vistasBase[0]?.config.sort || null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [showFiltros, setShowFiltros] = useState(false);
  const [savingVista, setSavingVista] = useState(false);
  const [nombreVista, setNombreVista] = useState('');
  const [showGuardar, setShowGuardar] = useState(false);

  const colBy = useMemo(() => { const m: Record<string, ColDef> = {}; cols.forEach(c => m[c.key] = c); return m; }, [cols]);
  const visibles = useMemo(() => cols.filter(c => c.render), [cols]);
  const filtrables = useMemo(() => cols.filter(c => c.ftype), [cols]);

  // ── Vistas guardadas
  async function loadVistas() {
    try {
      const j = await fetch('/api/crm/vistas?tabla=' + encodeURIComponent(tabla)).then(r => r.json());
      if (j.sin_migracion) setSinMigracion(true);
      setVistasCustom((j.data || []).map((v: any) => ({ key: 'v_' + v.id, id: v.id, nombre: v.nombre, config: v.config || {} })));
    } catch { /* sin vistas custom */ }
  }
  useEffect(() => { loadVistas(); }, [tabla]);

  const vistas: VistaDef[] = useMemo(() => [...vistasBase.map(v => ({ ...v, fija: true })), ...vistasCustom], [vistasBase, vistasCustom]);
  const vistaActiva = vistas.find(v => v.key === vistaKey) || vistas[0];

  function aplicarVista(v: VistaDef) {
    setVistaKey(v.key);
    setSearch(v.config.search || '');
    setQuickVals(v.config.quick || {});
    setConds(v.config.conds || []);
    setSort(v.config.sort || null);
    setPage(0);
  }

  // ¿La config actual difiere de la vista activa? (para ofrecer guardar)
  const configActual: VistaConfig = { search: search || undefined, quick: Object.keys(quickVals).some(k => quickVals[k]) ? quickVals : undefined, conds: conds.length ? conds : undefined, sort };
  const dirty = JSON.stringify(configActual) !== JSON.stringify({ search: vistaActiva?.config.search, quick: vistaActiva?.config.quick, conds: vistaActiva?.config.conds, sort: vistaActiva?.config.sort || null });

  async function guardarVista(comoNueva: boolean) {
    const nombre = comoNueva ? nombreVista.trim() : (vistaActiva?.nombre || '');
    if (comoNueva && !nombre) { alert('Ponle nombre a la vista.'); return; }
    setSavingVista(true);
    const body: any = { tabla, nombre, config: configActual };
    if (!comoNueva && vistaActiva && !vistaActiva.fija) body.id = vistaActiva.id;
    const r = await fetch('/api/crm/vistas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setSavingVista(false);
    if (j.error) { alert(j.error); return; }
    setShowGuardar(false); setNombreVista('');
    await loadVistas();
    if (j.data?.id) setVistaKey('v_' + j.data.id);
  }
  async function borrarVista(v: VistaDef, e: any) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la vista "${v.nombre}"?`)) return;
    await fetch('/api/crm/vistas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) });
    if (vistaKey === v.key) aplicarVista(vistas[0]);
    loadVistas();
  }

  // ── Pipeline de datos: search → quick → condiciones → orden → página
  const filtrados = useMemo(() => {
    let out = data;
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter(r => searchText(r).toLowerCase().includes(q)); }
    for (const qd of quick) { const v = quickVals[qd.key]; if (v) out = out.filter(r => qd.apply(r, v)); }
    for (const c of conds) { const col = colBy[c.campo]; if (col) out = out.filter(r => evalCond(col, r, c)); }
    if (sort && colBy[sort.key]?.val) {
      const col = colBy[sort.key];
      out = out.slice().sort((a, b) => {
        const va = col.val!(a), vb = col.val!(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1; if (vb == null) return -1;
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
    }
    return out;
  }, [data, search, quickVals, conds, sort, quick, colBy, searchText]);

  const totalPag = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const pagina = filtrados.slice(page * pageSize, (page + 1) * pageSize);
  useEffect(() => { if (page >= totalPag) setPage(0); }, [totalPag]);

  function toggleSort(col: ColDef) {
    if (!col.val || col.sortable === false) return;
    setSort(s => (s?.key === col.key ? (s.dir === -1 ? { key: col.key, dir: 1 } : null) : { key: col.key, dir: -1 }));
  }
  const setQuickV = (k: string, v: string) => { setQuickVals(p => ({ ...p, [k]: v })); setPage(0); };

  const condLabel = (c: Cond) => {
    const col = colBy[c.campo]; if (!col) return '';
    const op = (OPS[col.ftype || 'text'] || []).find(o => o.v === c.op)?.l || c.op;
    const val = col.ftype === 'select' ? (col.options?.find(o => o.v === c.v1)?.l || c.v1) : c.v1;
    return `${col.label} ${op}${val ? ` "${val}"` : ''}${c.op === 'entre' && c.v2 ? ` y "${c.v2}"` : ''}`;
  };

  return (
    <div>
      {/* ① FILTROS PRINCIPALES + acciones */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {quick.map(qd => (
          <select key={qd.key} value={quickVals[qd.key] || ''} onChange={e => setQuickV(qd.key, e.target.value)} style={E.input}>
            <option value="">{qd.label}</option>
            {qd.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
        <button style={{ ...E.btn, fontWeight: 700, borderColor: conds.length ? '#1a1a1a' : '#ddd' }} onClick={() => setShowFiltros(!showFiltros)}>
          ⚙ Más filtros{conds.length ? ` (${conds.length})` : ''}
        </button>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>{actions}</div>
      </div>

      {/* Panel de condiciones avanzadas */}
      {showFiltros && (
        <div style={{ background: '#fafbfd', border: '1px solid #e8eaee', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          {conds.map((c, i) => {
            const col = colBy[c.campo];
            const t = col?.ftype || 'text';
            const ops = OPS[t] || OPS.text;
            const needsVal = !['vacio', 'no_vacio', 'antes_hoy'].includes(c.op);
            const needsV2 = c.op === 'entre';
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <select value={c.campo} onChange={e => { const campo = e.target.value; const nt = colBy[campo]?.ftype || 'text'; setConds(cs => cs.map((x, j) => j === i ? { campo, op: OPS[nt][0].v, v1: '', v2: '' } : x)); }} style={{ ...E.input, minWidth: 150 }}>
                  {filtrables.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select value={c.op} onChange={e => setConds(cs => cs.map((x, j) => j === i ? { ...x, op: e.target.value } : x))} style={E.input}>
                  {ops.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                {needsVal && (t === 'select'
                  ? <select value={c.v1 || ''} onChange={e => setConds(cs => cs.map((x, j) => j === i ? { ...x, v1: e.target.value } : x))} style={{ ...E.input, minWidth: 140 }}>
                      <option value="">— valor —</option>
                      {(col?.options || []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  : <input type={t === 'number' ? 'number' : t === 'date' ? 'date' : 'text'} value={c.v1 || ''} onChange={e => setConds(cs => cs.map((x, j) => j === i ? { ...x, v1: e.target.value } : x))} style={{ ...E.input, width: t === 'text' ? 180 : 140 }} />)}
                {needsVal && needsV2 && <input type={t === 'number' ? 'number' : 'date'} value={c.v2 || ''} onChange={e => setConds(cs => cs.map((x, j) => j === i ? { ...x, v2: e.target.value } : x))} style={{ ...E.input, width: 140 }} />}
                <button style={{ ...E.btn, color: '#b93333', border: 'none', background: 'none' }} onClick={() => setConds(cs => cs.filter((_, j) => j !== i))}>✕</button>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={E.btn} onClick={() => setConds(cs => [...cs, { campo: filtrables[0]?.key || '', op: OPS[filtrables[0]?.ftype || 'text'][0].v, v1: '' }])}>+ Agregar condición</button>
            {conds.length > 0 && <button style={{ ...E.btn, color: '#b93333' }} onClick={() => setConds([])}>Limpiar todo</button>}
          </div>
        </div>
      )}

      {/* ② BUSCADOR */}
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder={searchPlaceholder}
        style={{ ...E.input, width: '100%', boxSizing: 'border-box', marginBottom: 12, padding: '10px 14px' }} />

      {/* ③ TABS DE VISTAS + guardar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e8eaee', marginBottom: 0, overflowX: 'auto', flexWrap: 'nowrap' }}>
        {vistas.map(v => (
          <button key={v.key} style={E.tab(v.key === vistaKey)} onClick={() => aplicarVista(v)} title={v.fija ? 'Vista predefinida' : 'Vista guardada'}>
            {v.nombre}
            {!v.fija && v.key === vistaKey && <span onClick={e => borrarVista(v, e)} title="Eliminar vista" style={{ color: '#b93333', fontWeight: 800, marginLeft: 2 }}>✕</span>}
          </button>
        ))}
        {dirty && (
          <span style={{ display: 'inline-flex', gap: 6, marginLeft: 10, alignItems: 'center', flexShrink: 0 }}>
            {vistaActiva && !vistaActiva.fija && <button style={{ ...E.btn, padding: '4px 10px', fontSize: '0.72rem' }} disabled={savingVista} onClick={() => guardarVista(false)}>💾 Guardar cambios</button>}
            <button style={{ ...E.btnDark, padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => setShowGuardar(true)}>+ Guardar como vista</button>
          </span>
        )}
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.72rem', color: '#9aa0a8', padding: '0 6px' }}>{filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</span>
      </div>

      {/* Chips de condiciones activas */}
      {conds.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 0 0' }}>
          {conds.map((c, i) => (
            <span key={i} style={E.chip}>{condLabel(c)}<span style={{ cursor: 'pointer' }} onClick={() => setConds(cs => cs.filter((_, j) => j !== i))}>✕</span></span>
          ))}
        </div>
      )}

      {/* Modal mínimo para nombrar la vista */}
      {showGuardar && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f4f6fb', border: '1px solid #e3e7f2', borderRadius: 10, padding: 10, marginTop: 10 }}>
          <input autoFocus value={nombreVista} onChange={e => setNombreVista(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') guardarVista(true); }} placeholder='Nombre de la vista (ej. "ARR alto sin contacto")' style={{ ...E.input, flex: 1 }} />
          <button style={E.btnDark} disabled={savingVista} onClick={() => guardarVista(true)}>{savingVista ? '…' : 'Guardar'}</button>
          <button style={E.btn} onClick={() => setShowGuardar(false)}>Cancelar</button>
          {sinMigracion && <span style={{ fontSize: '0.7rem', color: '#a06600' }}>⚠ corre migration-2026-07-crm-vistas.sql</span>}
        </div>
      )}

      {/* ④ TABLA (o cuerpo custom p.ej. kanban, respetando los filtros) */}
      {customBody ? (
        <div style={{ paddingTop: 14 }}>{customBody(filtrados)}</div>
      ) : (
        <>
          <div className="ct360" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>{visibles.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
              <thead><tr>
                {visibles.map(c => (
                  <th key={c.key} onClick={() => toggleSort(c)}
                    style={{ ...E.th, ...(c.num ? { textAlign: 'right' as const } : {}), cursor: c.val && c.sortable !== false ? 'pointer' : 'default' }}>
                    {c.label}{sort?.key === c.key ? (sort.dir === -1 ? ' ▾' : ' ▴') : ''}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {pagina.map(r => (
                  <tr key={rowKey(r)} style={{ cursor: onRowClick ? 'pointer' : 'default' }} onClick={() => onRowClick?.(r)}>
                    {visibles.map(c => cloneElement(c.render!(r), { key: c.key }))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtrados.length && <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>{emptyMsg}</div>}
          </div>
          {/* ⑤ PAGINACIÓN */}
          {filtrados.length > pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 2px 0', fontSize: '0.78rem', color: '#666' }}>
              <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtrados.length)} de {filtrados.length}</span>
              <button style={{ ...E.btn, padding: '4px 10px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
              <button style={{ ...E.btn, padding: '4px 10px' }} disabled={page >= totalPag - 1} onClick={() => setPage(p => p + 1)}>›</button>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} style={{ ...E.input, padding: '4px 8px', marginLeft: 'auto' }}>
                {[25, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
