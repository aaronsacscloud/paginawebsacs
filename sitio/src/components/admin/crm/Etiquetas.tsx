import { useEffect, useState } from 'react';

/* ═══ Etiquetas ═══
 *
 * El mismo catálogo para clientes, oportunidades y suscripciones: "Joyería" es
 * la misma etiqueta la mire quien la mire, y por eso el filtro cruza secciones.
 *
 * Dos piezas:
 *   <Etiquetas entidad="company" id={…} />  → chips + agregar/quitar
 *   <FiltroEtiquetas …/>                    → el filtro de cada sección
 *
 * Se puede etiquetar escribiendo un nombre nuevo: obligar a pasar por un
 * catálogo antes de poder etiquetar es lo que hace que nadie etiquete.
 */

export type Etiqueta = { id: string; nombre: string; color: string; descripcion?: string | null; uso?: any };

const chip = (color: string, activo = true): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
  background: activo ? color + '18' : '#f4f4f4', color: activo ? color : '#888',
  border: '1px solid ' + (activo ? color + '44' : '#e8e8e8'), whiteSpace: 'nowrap',
});

/** Catálogo compartido: se pide una vez por pantalla, no una por chip. */
export function useCatalogoEtiquetas() {
  const [cat, setCat] = useState<Etiqueta[]>([]);
  const cargar = () => fetch('/api/crm/etiquetas').then(r => r.json()).then(j => setCat(j.data || [])).catch(() => {});
  useEffect(() => { cargar(); }, []);
  return { cat, recargar: cargar };
}

/** Mapa entidad_id → etiquetas, para pintar una lista entera sin N consultas. */
export function useMapaEtiquetas(entidad: 'company' | 'deal' | 'subscription' | 'contact') {
  const [mapa, setMapa] = useState<Record<string, Etiqueta[]>>({});
  const cargar = () => fetch(`/api/crm/etiquetas?entidad=${entidad}&mapa=1`).then(r => r.json()).then(j => setMapa(j.mapa || {})).catch(() => {});
  useEffect(() => { cargar(); }, [entidad]);
  return { mapa, recargar: cargar };
}

export function ChipsEtiquetas({ etiquetas, max }: { etiquetas?: Etiqueta[] | null; max?: number }) {
  const list = etiquetas || [];
  if (!list.length) return null;
  const ver = max ? list.slice(0, max) : list;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', verticalAlign: 'middle' }}>
      {ver.map(e => <span key={e.id} style={chip(e.color)}>{e.nombre}</span>)}
      {max && list.length > max && <span style={{ ...chip('#888'), background: '#f4f4f4' }}>+{list.length - max}</span>}
    </span>
  );
}

export default function Etiquetas({ entidad, id, compacto, onCambio }: {
  entidad: 'company' | 'deal' | 'subscription' | 'contact';
  id: string;
  compacto?: boolean;
  onCambio?: () => void;
}) {
  const [mias, setMias] = useState<Etiqueta[]>([]);
  const [cat, setCat] = useState<Etiqueta[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [nueva, setNueva] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = async () => {
    const [a, b] = await Promise.all([
      fetch(`/api/crm/etiquetas?entidad=${entidad}&entidad_id=${id}`).then(r => r.json()).catch(() => ({})),
      fetch('/api/crm/etiquetas').then(r => r.json()).catch(() => ({})),
    ]);
    setMias(a?.data || []); setCat(b?.data || []);
  };
  useEffect(() => { if (id) cargar(); }, [entidad, id]);

  async function toggle(e: Etiqueta, quitar: boolean) {
    setBusy(true);
    // Optimista: etiquetar tiene que sentirse instantáneo o se deja de hacer.
    setMias(prev => quitar ? prev.filter(x => x.id !== e.id) : [...prev, e]);
    await fetch('/api/crm/etiquetas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etiqueta_id: e.id, entidad, entidad_id: id, ...(quitar ? { quitar: true } : {}) }),
    }).catch(() => {});
    setBusy(false); onCambio?.();
  }

  async function crearYAsignar() {
    const nombre = nueva.trim();
    if (!nombre) return;
    setBusy(true);
    const j = await fetch('/api/crm/etiquetas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, entidad, entidad_id: id }),
    }).then(r => r.json()).catch(() => ({}));
    setNueva(''); setBusy(false);
    if (!j?.error) { await cargar(); onCambio?.(); }
  }

  const disponibles = cat.filter(c => !mias.some(m => m.id === c.id));

  return (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
      {mias.map(e => (
        <span key={e.id} style={chip(e.color)}>
          {e.nombre}
          <button onClick={() => toggle(e, true)} disabled={busy} title="Quitar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '0.7rem', opacity: 0.6 }}>✕</button>
        </span>
      ))}
      <button onClick={() => setAbierto(a => !a)} style={{ ...chip('#888', false), cursor: 'pointer' }}>
        {compacto && mias.length ? '+' : '+ Etiqueta'}
      </button>

      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 401, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, boxShadow: '0 8px 26px rgba(0,0,0,0.14)', padding: 10, minWidth: 230, maxHeight: 280, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
              <input value={nueva} onChange={ev => setNueva(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') crearYAsignar(); }}
                placeholder="nueva etiqueta…" style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 7, fontSize: '0.78rem', outline: 'none' }} />
              <button onClick={crearYAsignar} disabled={busy || !nueva.trim()} style={{ ...chip('#1A8F7A'), cursor: 'pointer' }}>Crear</button>
            </div>
            {disponibles.length === 0 ? (
              <div style={{ fontSize: '0.74rem', color: '#999' }}>Ya tiene todas las del catálogo.</div>
            ) : disponibles.map(e => (
              <div key={e.id} onClick={() => { toggle(e, false); setAbierto(false); }}
                style={{ padding: '5px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: e.color }} />
                <span style={{ fontSize: '0.8rem' }}>{e.nombre}</span>
                {e.uso?.total ? <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#bbb' }}>{e.uso.total}</span> : null}
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

/** El filtro de cada sección. Multi-selección con Y implícita: elegir dos
 *  etiquetas deja lo que tiene LAS DOS (así se acota, que es para lo que se
 *  filtra; con O el filtro amplía y nadie lo usaría). */
export function FiltroEtiquetas({ cat, sel, onChange }: { cat: Etiqueta[]; sel: string[]; onChange: (ids: string[]) => void }) {
  if (!cat.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {cat.map(e => {
        const on = sel.includes(e.id);
        return (
          <button key={e.id} onClick={() => onChange(on ? sel.filter(x => x !== e.id) : [...sel, e.id])}
            title={e.descripcion || undefined}
            style={{ ...chip(e.color, true), cursor: 'pointer', background: on ? e.color : e.color + '14', color: on ? '#fff' : e.color, borderColor: e.color + (on ? '' : '44') }}>
            {e.nombre}
          </button>
        );
      })}
      {sel.length > 0 && <button onClick={() => onChange([])} style={{ ...chip('#888', false), cursor: 'pointer' }}>limpiar</button>}
    </span>
  );
}
