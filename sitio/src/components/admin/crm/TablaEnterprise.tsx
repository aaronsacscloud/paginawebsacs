import { cloneElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useIsMobile } from '../../../lib/ui/mobile';
import Sheet from './ui/Sheet';

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
  fija?: boolean;                   // se queda pegada al desplazar a lo ancho
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

/* Estilos del estándar (tokens del spec UI/UX: bordes #e2e4e9, radios 10,
 * sombras suaves, primario negro #1a1a1a, acento azul #4B7BE5 solo en focus). */
const E = {
  input: { padding: '8px 12px', border: '1px solid #e2e4e9', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, outline: 'none', background: '#fff', color: '#333', height: 36, boxSizing: 'border-box' as const } as const,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 36, border: '1px solid #e2e4e9', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  btnDark: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 36, border: 'none', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff', boxShadow: '0 1px 2px rgba(16,24,40,0.18)' } as const,
  th: { textAlign: 'left' as const, padding: '10px 14px', fontSize: '0.64rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e9eaee', whiteSpace: 'nowrap' as const, background: '#f9fafb', position: 'sticky' as const, top: 0, zIndex: 1, cursor: 'default' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eef2fe', color: '#3764c4', borderRadius: 99, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700 } as const,
  tab: (act: boolean) => ({ padding: '9px 13px', border: 'none', borderBottom: act ? '2px solid #1a1a1a' : '2px solid transparent', background: 'none', cursor: 'pointer', fontWeight: act ? 700 : 600, fontSize: '0.8rem', color: act ? '#16181d' : '#6b7078', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 6 }) as const,
};


/* ─── Filtro desplegable ─────────────────────────────────────────────────────
   Un <select> nativo NO se puede pintar: el panel de opciones lo dibuja el
   sistema operativo, y en macOS sale negro con el color de acento del usuario
   —de ahí el recuadro oscuro con rosa—. Para que siga la gama del módulo hay
   que dibujarlo nosotros.

   Panel lila translúcido con desenfoque detrás, y la opción elegida en rosa
   claro: el rosa marca la selección sin competir con el morado de la interfaz. */
function FiltroDesplegable({ qd, valor, onElegir, isMobile }: { qd: QuickDef; valor: string; onElegir: (v: string) => void; isMobile: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('mousedown', fuera);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc); };
  }, [abierto]);

  const activo = !!valor;
  const elegido = qd.options.find(o => o.v === valor);
  return (
    <div ref={caja} style={{ position: 'relative', width: isMobile ? '100%' : undefined }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, width: isMobile ? '100%' : undefined,
          height: isMobile ? 44 : 36, padding: '0 12px', borderRadius: 9, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: activo ? 700 : 600,
          border: '1px solid', borderColor: activo || abierto ? '#c9bcf7' : '#e2e4e9',
          background: activo || abierto ? '#f7f4ff' : '#fff', color: activo ? '#5B4BD6' : '#555',
        }}>
        <span>{qd.label}</span>
        {elegido && <span style={{ color: '#7a6fc9', fontWeight: 600 }}>{elegido.l}</span>}
        <span style={{ color: activo ? '#9B8CFA' : '#b3afbd', fontSize: '0.6rem', marginLeft: 'auto' }}>▾</span>
      </button>
      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 'max(100%, 190px)', zIndex: 60,
          background: 'rgba(250,248,255,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid #e6ddfa', borderRadius: 12, boxShadow: '0 14px 34px rgba(91,75,214,0.16)', padding: 5,
        }}>
          {[{ v: '', l: 'Todos' }, ...qd.options].map(o => {
            const sel = (valor || '') === o.v;
            return (
              <button key={o.v || '_'} type="button" onClick={() => { onElegir(o.v); setAbierto(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  border: 'none', cursor: 'pointer', borderRadius: 8, padding: '8px 10px',
                  fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: sel ? 800 : 500,
                  background: sel ? 'rgba(244,168,205,0.34)' : 'transparent',
                  color: sel ? '#9c3d70' : '#3f3b4d',
                }}>
                <span style={{ width: 12, color: '#9c3d70' }}>{sel ? '✓' : ''}</span>
                {o.l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TablaEnterprise({
  tabla, data, cols, quick = [], vistasBase, searchText, searchPlaceholder = 'Buscar…',
  actions, onRowClick, rowKey = (r: any) => r.id, customBody, mobileCard, minWidth = 1080, emptyMsg = 'Sin resultados con esos filtros.',
  sinVistas = false, headerTint = false, quickExtra,
}: {
  tabla: string;
  data: any[];
  cols: ColDef[];
  quick?: QuickDef[];
  vistasBase: VistaDef[];
  /** Oculta la tira de pestañas. La lista abre en vistasBase[0] y todo se
   *  maneja con filtros: unas pestañas que esconden filas sin decirlo hacen que
   *  se lea una lista corta creyendo que es completa. */
  sinVistas?: boolean;
  /** Encabezado con el lila del buscador. El gris sobre gris hace que con la
   *  tabla a media pantalla no se distinga dónde termina el encabezado —y este
   *  se queda pegado arriba al desplazar. */
  headerTint?: boolean;
  /** Filtro propio de la pantalla, al lado de los rápidos (p. ej. un rango de
   *  fechas, que un <select> de una sola opción no puede expresar). */
  quickExtra?: ReactNode;
  searchText: (row: any) => string;
  searchPlaceholder?: string;
  actions?: any;
  onRowClick?: (row: any) => void;
  rowKey?: (row: any) => string;
  customBody?: ((rows: any[]) => any) | null;   // p.ej. kanban: reemplaza la tabla pero respeta filtros
  mobileCard?: ((row: any) => ReactNode) | null; // en mobile: renderiza la fila como card (mismo pipeline)
  minWidth?: number;
  emptyMsg?: string;
}) {
  const isMobile = useIsMobile();
  // La tabla ABRE en vistasBase[0], así que el estado inicial tiene que salir
  // COMPLETO de esa vista — no solo la pestaña y el orden. Antes `conds`,
  // `search` y `quick` arrancaban vacíos: si la vista por defecto filtraba algo,
  // la pestaña se veía seleccionada pero la tabla mostraba TODO (y encima se
  // marcaba como "modificada", ofreciendo guardar un cambio que nadie hizo).
  // No se notaba porque la primera vista de todas las tablas no filtraba nada.
  const [vistaKey, setVistaKey] = useState(vistasBase[0]?.key || 'todos');
  const [vistasCustom, setVistasCustom] = useState<VistaDef[]>([]);
  const [sinMigracion, setSinMigracion] = useState(false);
  const [search, setSearch] = useState(vistasBase[0]?.config.search || '');
  const [quickVals, setQuickVals] = useState<Record<string, string>>(vistasBase[0]?.config.quick || {});
  const [conds, setConds] = useState<Cond[]>(vistasBase[0]?.config.conds || []);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(vistasBase[0]?.config.sort || null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [showFiltros, setShowFiltros] = useState(false);
  const [showFiltrosSheet, setShowFiltrosSheet] = useState(false); // móvil: hoja de filtros
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
  // Borrado con confirmación de 2 toques (sin window.confirm, malo en touch):
  // 1er tap arma (la ✕ se vuelve "✕?"), 2º tap dentro de 2.6s ejecuta.
  const [confirmVista, setConfirmVista] = useState<string | null>(null);
  async function borrarVista(v: VistaDef, e: any) {
    e.stopPropagation();
    if (confirmVista !== v.key) { setConfirmVista(v.key); setTimeout(() => setConfirmVista(c => c === v.key ? null : c), 2600); return; }
    setConfirmVista(null);
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

  const activeFiltros = conds.length + Object.values(quickVals).filter(Boolean).length;
  const quickSelects = quick.map(qd => (
    <FiltroDesplegable key={qd.key} qd={qd} valor={quickVals[qd.key] || ''} onElegir={(v: string) => setQuickV(qd.key, v)} isMobile={isMobile} />
  ));
  const condsPanel = (
    <div style={{ background: '#fafbfd', border: '1px solid #e8eaee', borderRadius: 10, padding: 14 }}>
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
  );

  return (
    <div>
      {/* ① FILTROS PRINCIPALES + acciones */}
      {isMobile ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button style={{ ...E.btn, height: 44, flexShrink: 0, fontWeight: 700, borderColor: activeFiltros ? '#1a1a1a' : '#e2e4e9' }} onClick={() => setShowFiltrosSheet(true)}>
            <SlidersHorizontal size={16} strokeWidth={2} /> Filtros
            {activeFiltros > 0 && <span style={{ background: '#1a1a1a', color: '#fff', borderRadius: 99, padding: '0 7px', fontSize: '0.68rem', fontWeight: 800, lineHeight: '18px' }}>{activeFiltros}</span>}
          </button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>{actions}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            {quickSelects}
            {quickExtra}
            <button style={{ ...E.btn, fontWeight: 700, borderColor: conds.length ? '#1a1a1a' : '#e2e4e9' }} onClick={() => setShowFiltros(!showFiltros)}>
              <SlidersHorizontal size={15} strokeWidth={2} />
              Más filtros
              {conds.length > 0 && <span style={{ background: '#1a1a1a', color: '#fff', borderRadius: 99, padding: '0 7px', fontSize: '0.68rem', fontWeight: 800, lineHeight: '17px' }}>{conds.length}</span>}
            </button>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>{actions}</div>
          </div>
          {showFiltros && <div style={{ marginBottom: 12 }}>{condsPanel}</div>}
        </>
      )}

      {/* Hoja de filtros (móvil): quick selects + condiciones avanzadas en un Sheet */}
      {isMobile && (
        <Sheet open={showFiltrosSheet} onClose={() => setShowFiltrosSheet(false)} title="Filtros"
          headerActions={activeFiltros > 0 ? <button style={{ ...E.btn, height: 36 }} onClick={() => { setQuickVals({}); setConds([]); setPage(0); }}>Limpiar</button> : undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quickSelects}
            {quickExtra}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Condiciones avanzadas</div>
            {condsPanel}
            <button style={{ ...E.btnDark, height: 48, justifyContent: 'center', marginTop: 4 }} onClick={() => setShowFiltrosSheet(false)}>Ver {filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</button>
          </div>
        </Sheet>
      )}

      {/* ② BUSCADOR (icono + focus ring vía clase te-search) */}
      <style>{`
        .te-search:focus { border-color: #4B7BE5 !important; box-shadow: 0 0 0 3px rgba(75,123,229,0.12); }
        .te-item:hover { background: #f4f6f9 !important; }
        /* Indicador de ordenamiento: tenue en reposo (se ve que SE PUEDE, sin
           gritar), marcado al pasar el mouse y a color cuando está ordenando. */
        .te-sort { margin-left: 5px; font-size: 0.85em; color: #c6cad2; transition: color .12s ease; }
        .te-th-sort:hover .te-sort { color: #6b7078; }
        .te-sort-on { color: #1a1a1a !important; font-size: 0.95em; }
        .te-th-sort:hover { background: #f4f6f9; }
      `}</style>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} strokeWidth={2} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9aa0a8', pointerEvents: 'none' }} />
        <input className="te-search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder={searchPlaceholder}
          style={{ ...E.input, width: '100%', height: 40, fontWeight: 500, padding: '0 14px 0 38px' }} />
      </div>

      {/* ③ TABS DE VISTAS + guardar */}
      {!sinVistas && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e8eaee', marginBottom: 0, overflowX: 'auto', flexWrap: 'nowrap' }}>
        {vistas.map(v => (
          <button key={v.key} style={E.tab(v.key === vistaKey)} onClick={() => aplicarVista(v)} title={v.fija ? 'Vista predefinida' : 'Vista guardada'}>
            {v.nombre}
            {!v.fija && v.key === vistaKey && <span onClick={e => borrarVista(v, e)} title="Eliminar vista" style={{ color: '#b93333', fontWeight: 800, marginLeft: 4, padding: isMobile ? '10px 10px' : '2px 6px', minWidth: isMobile ? 40 : 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{confirmVista === v.key ? '✕?' : '✕'}</span>}
          </button>
        ))}
        {/* En DESKTOP los controles de guardar viven en la tira; en mobile bajan
            a una píldora full-width (criterio: alcanzables sin scroll horizontal). */}
        {dirty && !isMobile && (
          <span style={{ display: 'inline-flex', gap: 6, marginLeft: 10, alignItems: 'center', flexShrink: 0 }}>
            {vistaActiva && !vistaActiva.fija && <button style={{ ...E.btn, padding: '4px 10px', fontSize: '0.72rem' }} disabled={savingVista} onClick={() => guardarVista(false)}>💾 Guardar cambios</button>}
            <button style={{ ...E.btnDark, padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => setShowGuardar(true)}>+ Guardar como vista</button>
          </span>
        )}
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.72rem', color: '#9aa0a8', padding: '0 6px' }}>{filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</span>
      </div>
      )}
      {dirty && isMobile && !sinVistas && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0 0' }}>
          <span style={{ fontSize: '0.78rem', color: '#a06600', fontWeight: 700, flex: 1 }}>Vista modificada</span>
          {vistaActiva && !vistaActiva.fija && <button style={{ ...E.btn, padding: '8px 12px' }} disabled={savingVista} onClick={() => guardarVista(false)}>💾 Guardar</button>}
          <button style={{ ...E.btnDark, padding: '8px 12px' }} onClick={() => setShowGuardar(true)}>+ Guardar como vista</button>
        </div>
      )}

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

      {/* ④ TABLA · CARDS (mobile) · o cuerpo custom (kanban) — todos respetan los filtros */}
      {customBody ? (
        <div style={{ paddingTop: 14 }}>{customBody(filtrados)}</div>
      ) : (isMobile && mobileCard) ? (
        <>
          {/* MOBILE: lista de cards con la MISMA página filtrada/ordenada/paginada */}
          <div style={{ paddingTop: 12 }}>
            {pagina.map(r => (
              <div key={rowKey(r)} className="crm-row" onClick={() => onRowClick?.(r)}
                style={{ padding: '14px 4px', borderBottom: '1px solid #f0f1f5', cursor: onRowClick ? 'pointer' : 'default' }}>
                {mobileCard(r)}
              </div>
            ))}
            {!filtrados.length && <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>{emptyMsg}</div>}
          </div>
          {filtrados.length > pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 2px 0', fontSize: '0.82rem', color: '#666' }}>
              <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtrados.length)} de {filtrados.length}</span>
              <button style={{ ...E.btn, width: 40, height: 40, padding: 0, borderRadius: 10, justifyContent: 'center' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
              <button style={{ ...E.btn, width: 40, height: 40, padding: 0, borderRadius: 10, justifyContent: 'center' }} disabled={page >= totalPag - 1} onClick={() => setPage(p => p + 1)}>›</button>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} style={{ ...E.input, height: 40, padding: '0 8px', marginLeft: 'auto' }}>
                {[25, 50, 100].map(n => <option key={n} value={n}>{n}/pág</option>)}
              </select>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="ct360" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>{visibles.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
              <thead><tr>
                {visibles.map(c => {
                  // Antes SOLO la columna ordenada mostraba flecha, así que no
                  // había forma de saber que las demás se podían ordenar sin ir
                  // clic por clic. Ahora toda columna ordenable trae un ⇅ tenue
                  // que se marca al pasar el mouse y se vuelve ▾/▴ al ordenar.
                  const ordenable = !!c.val && c.sortable !== false;
                  const activa = sort?.key === c.key;
                  return (
                  <th key={c.key} onClick={() => toggleSort(c)}
                    className={ordenable ? 'te-th-sort' : undefined}
                    title={ordenable ? (activa && sort?.dir === -1 ? 'Ordenado de mayor a menor — clic para invertir' : activa ? 'Ordenado de menor a mayor — clic para invertir' : 'Clic para ordenar por ' + c.label) : undefined}
                    style={{ ...E.th, ...(c.num ? { textAlign: 'right' as const } : {}), cursor: ordenable ? 'pointer' : 'default', userSelect: 'none',
                      ...(headerTint ? { background: '#faf8ff', color: '#6b5fa8', borderBottomColor: '#e6ddfa' } : {}),
                      ...(c.fija ? { position: 'sticky' as const, left: 0, zIndex: 3, background: headerTint ? '#faf8ff' : '#fafafe', boxShadow: '1px 0 0 #eeedf1' } : {}) }}>
                    {c.label}
                    {ordenable && (
                      <span className={activa ? 'te-sort te-sort-on' : 'te-sort'} aria-hidden="true">
                        {activa ? (sort!.dir === -1 ? '▾' : '▴') : '⇅'}
                      </span>
                    )}
                  </th>
                  );
                })}
              </tr></thead>
              <tbody>
                {pagina.map(r => (
                  <tr key={rowKey(r)} style={{ cursor: onRowClick ? 'pointer' : 'default' }} onClick={() => onRowClick?.(r)}>
                    {visibles.map(c => {
                      const celda = c.render!(r);
                      if (!c.fija) return cloneElement(celda, { key: c.key });
                      // El fondo tiene que ser opaco: si no, al desplazar se ve
                      // el contenido de las otras columnas pasando por debajo.
                      return cloneElement(celda, {
                        key: c.key,
                        style: { ...(celda.props?.style || {}), position: 'sticky', left: 0, zIndex: 2, background: '#fff', boxShadow: '1px 0 0 #f1f1f5' },
                      });
                    })}
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
              <button style={{ ...E.btn, width: 30, height: 30, padding: 0, borderRadius: 8, justifyContent: 'center' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
              <button style={{ ...E.btn, width: 30, height: 30, padding: 0, borderRadius: 8, justifyContent: 'center' }} disabled={page >= totalPag - 1} onClick={() => setPage(p => p + 1)}>›</button>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} style={{ ...E.input, height: 30, padding: '0 8px', marginLeft: 'auto' }}>
                {[25, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
