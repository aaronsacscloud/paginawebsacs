// MasScreen — la pantalla "Más" del CRM móvil (destino 5 del BottomNav).
//
// Antes era un ActionSheet con 19 renglones planos ("Grupo · Item"): una lista
// sin jerarquía donde había que leer todo para encontrar algo. Ahora es una
// PANTALLA con los mismos grupos del sidebar de escritorio (patrón Ajustes de
// iOS): encabezados de grupo + filas de 52px con chevron. El ojo salta por
// grupos, no por renglones.
//
// Diseño v5 (presupuesto del referee): sin buscador (las filas se escanean
// solas; la lupa global vive en la app bar), filas de texto sin iconos
// decorativos, acento morado SOLO en el ítem activo.
//
// ── v6: DOS NIVELES ─────────────────────────────────────────────────────────
// La v5 seguía enseñando TODO abierto: cinco encabezados y diecinueve filas
// de 64 px, o sea cuatro pantallas de scroll para nueve destinos reales. Con
// todo desplegado no hay jerarquía, solo una lista larga con títulos en medio.
//
// Ahora se ven las SECCIONES y punto; al entrar en una, sus destinos. Y arriba
// van las últimas que se visitaron, porque en la práctica se vuelve a tres o
// cuatro sitios todo el tiempo y no tiene sentido navegar el árbol cada vez
// para llegar a los mismos. Las recientes son un ATAJO, no una sección: se
// dibujan distinto y no reemplazan al índice.
import { useEffect, useMemo, useState } from 'react';
import { useDrawerHistory } from '../../../../lib/ui/mobile';
import { marcarReciente, leerRecientes } from '../../../../lib/crm/recientes';
import AvisosPush from './AvisosPush';

export type MasGrupo = {
  label: string;
  items: { id: string; label: string }[];
};

export default function MasScreen({
  open, grupos, activeId, onSelect, onClose, extras,
}: {
  open: boolean;
  grupos: MasGrupo[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Filas del pie (Notificaciones, contraseña, salir) — sin grupo. */
  extras: { label: string; danger?: boolean; onClick: () => void }[];
}) {
  // El botón atrás del teléfono cierra la pantalla (mismo contrato que drawers).
  useDrawerHistory(open, onClose);
  /* La sección abierta. `null` = el índice. El botón atrás del sistema cierra
     la pantalla entera; dentro de una sección se sale con su propio ←, que es
     lo que se espera de un menú de dos niveles. */
  const [seccion, setSeccion] = useState<string | null>(null);
  /* Al ABRIR se vuelve siempre al índice. Conservar la última sección sonaba
     cómodo y en la práctica es lo contrario: se toca «Más» esperando el menú y
     aparece un submenú, con los atajos recientes escondidos justo cuando más
     sirven. Un menú siempre abre en su portada. */
  useEffect(() => { if (open) setSeccion(null); }, [open]);

  const porId = useMemo(() => {
    const m = new Map<string, { label: string; grupo: string }>();
    for (const g of grupos) for (const it of g.items) m.set(it.id, { label: it.label, grupo: g.label });
    return m;
  }, [grupos]);

  /* Se leen al abrir, no en cada pintada: toca localStorage. Se filtran contra
     los destinos que existen HOY, para que un ítem retirado no deje un atajo
     muerto arriba de todo. */
  const recientes = useMemo(
    () => (open ? leerRecientes('mas-crm').filter((id: string) => porId.has(id)).slice(0, 4) : []),
    [open, porId],
  );

  const elegir = (id: string) => { marcarReciente('mas-crm', id, 6); onSelect(id); };

  if (!open) return null;
  const abierta = seccion ? grupos.find(g => g.label === seccion) : null;

  return (
    <div className="mas-screen" style={{
      position: 'fixed', left: 0, right: 0, top: 0,
      bottom: 'var(--crm-bottomnav-h, 64px)', zIndex: 395,
      background: '#fff', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '16px 24px 6px' }}>
        {abierta && (
          <button onClick={() => setSeccion(null)} aria-label="Atrás"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#1a1a1a',
              width: 40, height: 40, marginLeft: -10, display: 'flex', alignItems: 'center' }}>←</button>
        )}
        <div style={{ fontSize: '2.125rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
          {abierta ? abierta.label.charAt(0) + abierta.label.slice(1).toLowerCase() : 'Más'}
        </div>
      </div>

      {/* ── DENTRO DE UNA SECCIÓN ─────────────────────────────────────── */}
      {abierta && abierta.items.map(it => {
        const activo = it.id === activeId;
        return (
          <button key={it.id} onClick={() => elegir(it.id)} className="crm-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            minHeight: 64, padding: '18px 24px', border: 'none', cursor: 'pointer',
            background: 'none', borderBottom: '1px solid #efeef2',
            fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left',
            fontWeight: activo ? 700 : 500, color: activo ? '#5B4BD6' : '#1a1a1a',
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
            <span style={{ color: activo ? '#5B4BD6' : '#c9c7d0', fontSize: '1rem' }}>›</span>
          </button>
        );
      })}

      {/* ── EL ÍNDICE ─────────────────────────────────────────────────── */}
      {!abierta && <AvisosPush />}

      {!abierta && recientes.length > 0 && (
        <>
          <div style={{ padding: '22px 24px 8px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8f8d98' }}>
            Lo último que abriste
          </div>
          {/* Fila compacta y en horizontal: es un atajo, no una sección, y no
              debe competir en peso con el índice que va debajo. */}
          <div className="crm-scroll-x" style={{ display: 'flex', gap: 8, padding: '0 24px 4px', overflowX: 'auto' }}>
            {recientes.map((id: string) => (
              <button key={id} onClick={() => elegir(id)}
                style={{ flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${id === activeId ? '#5B4BD6' : '#e2e0ea'}`, background: id === activeId ? '#5B4BD6' : '#fff',
                  color: id === activeId ? '#fff' : '#3d3a4d', fontFamily: 'inherit', fontSize: '0.86rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {porId.get(id)?.label}
              </button>
            ))}
          </div>
        </>
      )}

      {!abierta && grupos.filter(g => g.label).map(g => {
        const tieneActivo = g.items.some(it => it.id === activeId);
        return (
          <button key={g.label} onClick={() => setSeccion(g.label)} className="crm-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            minHeight: 64, padding: '18px 24px', border: 'none', cursor: 'pointer',
            background: 'none', borderBottom: '1px solid #efeef2',
            fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left',
            fontWeight: tieneActivo ? 700 : 500, color: tieneActivo ? '#5B4BD6' : '#1a1a1a',
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {g.label.charAt(0) + g.label.slice(1).toLowerCase()}
              {/* Cuántos hay dentro: dice si vale la pena entrar. */}
              <span style={{ color: '#a5a2af', fontWeight: 400, marginLeft: 7, fontSize: '0.86rem' }}>{g.items.length}</span>
            </span>
            <span style={{ color: tieneActivo ? '#5B4BD6' : '#c9c7d0', fontSize: '1rem' }}>›</span>
          </button>
        );
      })}

      {/* Los grupos SIN nombre no son una sección: son destinos sueltos y se
          quedan a la vista, que es donde ya estaban. */}
      {!abierta && grupos.filter(g => !g.label).map(g => (
        <div key={g.label || 'sin'}>
          {g.label && (
            <div style={{
              padding: '22px 24px 8px', fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8f8d98',
            }}>{g.label}</div>
          )}
          {g.items.map(it => {
            const activo = it.id === activeId;
            return (
              <button key={it.id} onClick={() => elegir(it.id)} className="crm-row" style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                minHeight: 64, padding: '18px 24px', border: 'none', cursor: 'pointer',
                background: 'none', borderBottom: '1px solid #efeef2',
                fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left',
                fontWeight: activo ? 700 : 500,
                color: activo ? '#5B4BD6' : '#1a1a1a',
              }}>
                <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                <span style={{ color: activo ? '#5B4BD6' : '#c9c7d0', fontSize: '1rem' }}>›</span>
              </button>
            );
          })}
        </div>
      ))}
      {!abierta && <div style={{ height: 1, background: '#efeef2', margin: '18px 0 0' }} />}
      {!abierta && extras.map(x => (
        <button key={x.label} onClick={x.onClick} className="crm-row" style={{
          display: 'flex', alignItems: 'center', width: '100%',
          minHeight: 64, padding: '18px 24px', border: 'none', cursor: 'pointer',
          background: 'none', borderBottom: '1px solid #efeef2',
          fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left',
          fontWeight: 500, color: x.danger ? '#C0554E' : '#1a1a1a',
        }}>{x.label}</button>
      ))}
      <div style={{ height: 28 }} />
    </div>
  );
}
