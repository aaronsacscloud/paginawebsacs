// WHATSAPP · La lista de conversaciones: avatar, nombre o teléfono, snippet,
// hora relativa, badge de no-leídos y chip de etapa. En móvil incluye los
// filtros del rail como chips horizontales (no hay rail).
import { useEffect, useRef, useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { lifecycleDe } from '../../../../lib/crm/lifecycle';
import type { Filtros } from './InboxPro';

const AVATAR_COLORES = ['#9B8CFA', '#7DA6F5', '#4FBF95', '#E8A838', '#D9538E'];

function horaRelativa(iso: string): string {
  const d = new Date(iso); const ms = Date.now() - d.getTime();
  if (ms < 60_000) return 'ahora';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`;
  const hoy = new Date(); const esHoy = d.toDateString() === hoy.toDateString();
  if (esHoy) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === ayer.toDateString()) return 'ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function Avatar({ nombre, telefono, size = 38 }: { nombre?: string | null; telefono: string; size?: number }) {
  const base = (nombre || telefono).trim();
  const iniciales = nombre
    ? nombre.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
    : telefono.slice(-2);
  let h = 0; for (const ch of base) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_COLORES.length;
  return (
    <span style={{
      width: size, height: size, borderRadius: 99, background: AVATAR_COLORES[h], color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 800, flexShrink: 0,
    }}>{iniciales}</span>
  );
}

const FILTROS_MOBILE = [
  { id: 'todas', label: 'Todas' }, { id: 'mias', label: 'Mías' },
  { id: 'sin_asignar', label: 'Sin asignar' }, { id: 'no_leidas', label: 'No leídas' },
];

export default function ListaConversaciones({ lista, counts, filtros, setFiltros, activaId, onAbrir, mobile, equipo, yo, onNuevo }: {
  lista: any[]; counts: any; filtros: Filtros; setFiltros: (f: Filtros) => void;
  activaId: string | null; onAbrir: (id: string) => void; mobile?: boolean; equipo: any[]; yo: any; onNuevo?: () => void;
}) {
  // Búsqueda con debounce: el estado local escribe fluido, el filtro llega 300 ms después.
  const [q, setQ] = useState(filtros.search);
  const deb = useRef<any>(null);
  useEffect(() => { setQ(filtros.search); }, [filtros.search]);
  const buscar = (v: string) => {
    setQ(v);
    clearTimeout(deb.current);
    deb.current = setTimeout(() => setFiltros({ ...filtros, search: v }), 300);
  };

  return (
    <div style={{ borderRight: mobile ? 'none' : '1px solid #f0eff3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f0eff3' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <input value={q} onChange={e => buscar(e.target.value)} placeholder="Buscar nombre, teléfono o texto…"
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', background: '#fdfcff', fontFamily: 'inherit' }} />
          {onNuevo && (
            <button onClick={onNuevo} title="Nuevo chat"
              style={{ border: 'none', borderRadius: 9, width: 36, background: '#9B8CFA', color: '#fff', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>+</button>
          )}
        </div>
        {mobile && (
          <div className="crm-scroll-x" style={{ display: 'flex', gap: 6, marginTop: 8, paddingBottom: 2 }}>
            {FILTROS_MOBILE.map(f => (
              <button key={f.id} onClick={() => setFiltros({ ...filtros, filtro: f.id })}
                style={{
                  border: '1px solid', borderColor: filtros.filtro === f.id ? '#c9bcf7' : '#e2e4e9',
                  background: filtros.filtro === f.id ? '#f7f4ff' : '#fff',
                  color: filtros.filtro === f.id ? '#5B4BD6' : '#555',
                  borderRadius: 20, padding: '5px 11px', fontSize: '0.72rem', fontWeight: 700,
                  whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {!lista.length && (
          <div style={{ padding: 22, fontSize: '0.78rem', color: '#a5a2af', lineHeight: 1.6, textAlign: 'center' }}>
            Nada por aquí con estos filtros.
          </div>
        )}
        {lista.map(c => {
          const etapa = lifecycleDe(c.contacto?.lifecycle_stage);
          const activa = c.id === activaId;
          const asignado = equipo.find((m: any) => m.id === c.asignado_a);
          return (
            <button key={c.id} onClick={() => onAbrir(c.id)}
              style={{
                display: 'flex', gap: 10, width: '100%', textAlign: 'left', border: 'none',
                borderBottom: '1px solid #f7f6fa', cursor: 'pointer', fontFamily: 'inherit',
                padding: '12px 14px', background: activa ? '#f7f4ff' : '#fff', alignItems: 'flex-start',
                borderLeft: activa ? '3px solid #9B8CFA' : '3px solid transparent',
              }}>
              <Avatar nombre={c.contacto?.nombre} telefono={c.telefono} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <b style={{ fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.contacto?.nombre || telefonoLegible(c.telefono)}
                  </b>
                  <span style={{ marginLeft: 'auto', fontSize: '0.64rem', color: c.no_leidos ? '#5B4BD6' : '#a5a2af', fontWeight: c.no_leidos ? 800 : 500, flexShrink: 0 }}>
                    {horaRelativa(c.ultimo_mensaje_at)}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: '0.76rem', color: c.no_leidos ? '#333' : '#8a8a92',
                    fontWeight: c.no_leidos ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.ultima_direccion === 'saliente' ? 'Tú: ' : ''}{c.ultimo_mensaje_texto || '—'}
                  </span>
                  {c.no_leidos > 0 && (
                    <span style={{ background: '#9B8CFA', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 800, flexShrink: 0 }}>
                      {c.no_leidos}
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  {etapa && (
                    <span style={{ fontSize: '0.58rem', fontWeight: 800, background: etapa.bg, color: etapa.fg, borderRadius: 20, padding: '2px 8px' }}>
                      {etapa.label}
                    </span>
                  )}
                  {c.empresa?.nombre && <span style={{ fontSize: '0.62rem', color: '#a5a2af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{c.empresa.nombre}</span>}
                  {asignado && yo && c.asignado_a !== yo.id && (
                    <span style={{ fontSize: '0.6rem', color: '#8a8a92', marginLeft: 'auto' }}>{asignado.nombre.split(' ')[0]}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
