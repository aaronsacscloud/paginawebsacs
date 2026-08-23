// WHATSAPP · Lista de conversaciones PRO (portada de sacs_inbox):
// controles Mostrar/Ordenar con radios custom, chips de estado con activo
// NEGRO, lupa desplegable, filtros avanzados con el builder, y la fila con
// avatar+badge de canal, 3 líneas y border-l de selección.
import { useEffect, useMemo, useRef, useState } from 'react';
import { C, L, horaRelativa } from './estilo';
import { IcoBuscar, IcoChevronAbajo, IcoUsuarioMas, IcoPuntos, IcoMegafono } from './Iconos';
import { BadgeWhatsApp, BadgeCorreo } from './Iconos';
import EstadoEntrega from './EstadoEntrega';
import { lifecycleDe } from '../../../../lib/crm/lifecycle';
import { BuilderCondiciones } from './VistaModales';
import type { CampoFiltro, Condicion } from '../../../../lib/whatsapp/filtros';
import type { Filtros } from './InboxPro';

const AVATAR_EMOJIS = ['🦊', '🐨', '🦁', '🐯', '🐸', '🐙', '🦄', '🐳', '🦉', '🐝'];
const AVATAR_COLORES = [['#EEECFE', '#5B4BD6'], ['#E3EDFD', '#2C5FC4'], ['#ECFDF5', '#047857'], ['#FEF3C7', '#B45309'], ['#FCE7F3', '#BE185D']];

function hashDe(s: string): number { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

export function Avatar({ nombre, telefono, size = 44, canal }: {
  nombre?: string | null; telefono: string; size?: number; canal?: 'wa' | 'email' | 'crm' | null;
}) {
  const base = (nombre || telefono || '?').trim();
  const h = hashDe(base);
  const [bg, fg] = AVATAR_COLORES[h % AVATAR_COLORES.length];
  const contenido = nombre
    ? nombre.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
    : AVATAR_EMOJIS[h % AVATAR_EMOJIS.length];
  return (
    <span style={{ position: 'relative', flexShrink: 0, display: 'inline-block' }}>
      <span style={{
        width: size, height: size, borderRadius: 999, background: bg, color: fg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: nombre ? size * 0.34 : size * 0.5, fontWeight: 700,
      }}>{contenido}</span>
      {canal && (
        <span style={{ position: 'absolute', bottom: -1, right: -1, background: '#fff', borderRadius: 999, padding: 1, display: 'inline-flex' }}>
          {canal === 'wa' ? <BadgeWhatsApp size={12} /> : canal === 'email' ? <BadgeCorreo size={12} /> : (
            <span style={{ width: 12, height: 12, borderRadius: 999, background: C.g300, color: '#fff', fontSize: 8, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>C</span>
          )}
        </span>
      )}
    </span>
  );
}

// Compat: iconito de canal suelto (lo usa el Hilo en burbujas de correo).
export const IconoCanal = ({ canal, size = 12 }: { canal: string; size?: number }) =>
  canal === 'email' ? <BadgeCorreo size={size} /> : <BadgeWhatsApp size={size} />;

const MOSTRAR = [
  { v: 'todas', l: 'Todas + contactos' },
  { v: 'solo_contactos', l: 'Solo contactos sin conversación' },
  { v: 'div', l: '' },
  { v: 'conversaciones', l: 'Todas las conversaciones' },
  { v: 'abiertas', l: 'Abiertas' },
  { v: 'resueltas', l: 'Resueltas' },
  { v: 'pospuestas', l: 'Pospuestas' },
];
const ORDEN = [
  { v: 'recientes', l: 'Más recientes' }, { v: 'antiguas', l: 'Más antiguas' },
  { v: 'az', l: 'Nombre A-Z' }, { v: 'za', l: 'Nombre Z-A' },
];

function RadioFila({ activo, label, onClick }: { activo: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 4px', fontSize: 12, color: activo ? C.g900 : C.g500, fontWeight: activo ? 600 : 400 }}>
      <span style={{ width: 14, height: 14, borderRadius: 999, border: `1.5px solid ${activo ? C.morado : C.g300}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {activo && <span style={{ width: 6, height: 6, borderRadius: 999, background: C.morado }} />}
      </span>
      {label}
    </button>
  );
}

export default function ListaConversaciones({ lista, filtros, setFiltros, activaId, onAbrir, mobile, equipo, yo, onNuevo, onFiltros, orden, setOrden, mostrar, setMostrar, campos, filtrosAdHoc, setFiltrosAdHoc, onMasivo }: {
  lista: any[]; filtros: Filtros; setFiltros: (f: Filtros) => void;
  activaId: string | null; onAbrir: (c: any) => void; mobile?: boolean; equipo: any[]; yo: any;
  onNuevo?: () => void; onFiltros?: () => void;
  orden: string; setOrden: (o: string) => void;
  mostrar: string; setMostrar: (m: string) => void;
  campos: CampoFiltro[];
  filtrosAdHoc: { logica: 'AND' | 'OR'; condiciones: Condicion[] } | null;
  setFiltrosAdHoc: (f: { logica: 'AND' | 'OR'; condiciones: Condicion[] } | null) => void;
  onMasivo?: () => void;
  counts?: any;
}) {
  const [popover, setPopover] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [modalFiltros, setModalFiltros] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState(filtros.search);
  const deb = useRef<any>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setQ(filtros.search); }, [filtros.search]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as any)) setPopover(false); };
    document.addEventListener('mousedown', fuera); return () => document.removeEventListener('mousedown', fuera);
  }, []);
  const buscar = (v: string) => {
    setQ(v); clearTimeout(deb.current);
    deb.current = setTimeout(() => setFiltros({ ...filtros, search: v }), 300);
  };

  const chips = [
    { v: 'conversaciones', l: 'Todas' }, { v: 'abiertas', l: 'Abiertas' }, { v: 'resueltas', l: 'Resueltas' },
  ];
  const chipActivo = ['todas', 'solo_contactos', 'pospuestas'].includes(mostrar) ? 'conversaciones' : mostrar;
  const mostrarLabel = MOSTRAR.find(m => m.v === mostrar)?.l || 'Todas';
  const ordenLabel = ORDEN.find(o => o.v === orden)?.l || '';
  const nCond = filtrosAdHoc?.condiciones?.length || 0;

  const ordenada = useMemo(() => {
    const arr = [...lista];
    if (orden === 'antiguas') arr.reverse();
    if (orden === 'az' || orden === 'za') {
      arr.sort((a, b) => String(a.contacto?.nombre || a.telefono).localeCompare(String(b.contacto?.nombre || b.telefono), 'es'));
      if (orden === 'za') arr.reverse();
    }
    return arr;
  }, [lista, orden]);

  return (
    <div style={{ width: mobile ? '100%' : L.lista, flexShrink: 0, minHeight: 0, borderRight: mobile ? 'none' : `1px solid ${C.g200}`, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Cabecera h-44 */}
      <div style={{ height: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 4, borderBottom: `1px solid ${C.g100}` }}>
        <b style={{ fontSize: 13, flex: 1 }}>Conversaciones</b>
        {onFiltros && (
          <button onClick={onFiltros} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700, color: C.moradoTinta, cursor: 'pointer', fontFamily: 'inherit' }}>Vistas</button>
        )}
        {onNuevo && (
          <button onClick={onNuevo} title="Nuevo chat"
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: C.g400 }}
            onMouseEnter={e => { (e.currentTarget.style.color = C.emerald600); (e.currentTarget.style.background = C.emerald50); }}
            onMouseLeave={e => { (e.currentTarget.style.color = C.g400); (e.currentTarget.style.background = 'none'); }}>
            <IcoUsuarioMas size={17} />
          </button>
        )}
        <span style={{ position: 'relative' }}>
          <button onClick={() => setMenu(m => !m)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, color: C.g400 }}><IcoPuntos size={16} /></button>
          {menu && (<>
            <span onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 940 }} />
            <span style={{ position: 'absolute', right: 0, top: '110%', zIndex: 941, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.12)', minWidth: 200, display: 'block', overflow: 'hidden' }}>
              <button onClick={() => { setMenu(false); onMasivo?.(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 12px', fontSize: 12, color: C.emerald700, fontWeight: 600 }}>
                <IcoMegafono size={15} /> Masivo a esta lista
              </button>
            </span>
          </>)}
        </span>
      </div>

      {/* Fila de controles */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', gap: 6, position: 'relative' }} ref={popRef}>
        <button onClick={() => setPopover(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: C.g500, padding: 0, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mostrarLabel}, {ordenLabel}</span>
          <span style={{ transform: popover ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'inline-flex' }}><IcoChevronAbajo size={12} /></span>
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={() => setBuscando(b => !b)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: buscando || q ? C.moradoTinta : C.g400 }}><IcoBuscar size={15} /></button>
        <button onClick={() => setModalFiltros(true)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: nCond ? C.moradoTinta : C.g500, padding: 0 }}>
          Filtros{nCond ? ` (${nCond})` : ''}
        </button>
        {popover && (
          <div style={{ position: 'absolute', top: '100%', left: 8, zIndex: 945, width: 240, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.12)', padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Mostrar</div>
            {MOSTRAR.map((m, i) => m.v === 'div'
              ? <div key={i} style={{ height: 1, background: C.g100, margin: '5px 0' }} />
              : <RadioFila key={m.v} activo={mostrar === m.v} label={m.l} onClick={() => { setMostrar(m.v); setPopover(false); }} />)}
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 4px' }}>Ordenar por</div>
            {ORDEN.map(o => <RadioFila key={o.v} activo={orden === o.v} label={o.l} onClick={() => { setOrden(o.v); setPopover(false); }} />)}
          </div>
        )}
        {buscando && (
          <div style={{ position: 'absolute', top: '100%', right: 8, zIndex: 945, width: 256 }}>
            <input autoFocus value={q} onChange={e => buscar(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { buscar(''); setBuscando(false); } }}
              placeholder="Buscar nombre, teléfono o texto…"
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 10, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit', background: '#fff', boxShadow: '0 12px 30px rgba(0,0,0,.12)' }} />
          </div>
        )}
      </div>

      {/* Chips de estado: activo NEGRO */}
      <div style={{ display: 'flex', gap: 6, padding: '2px 12px 8px' }}>
        {chips.map(c => (
          <button key={c.v} onClick={() => setMostrar(c.v)}
            style={{
              flex: 1, border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              background: chipActivo === c.v ? C.g900 : C.g100,
              color: chipActivo === c.v ? '#fff' : C.g500,
            }}>{c.l}</button>
        ))}
      </div>

      {/* Filas */}
      <div className="wa-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {!ordenada.length && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: C.g100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💬</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.g700, margin: '10px 0 2px' }}>No hay conversaciones</p>
            <p style={{ fontSize: 11, color: C.g400 }}>Ajusta los filtros o espera un mensaje nuevo.</p>
          </div>
        )}
        {ordenada.map(c => {
          const etapa = lifecycleDe(c.contacto?.lifecycle_stage);
          const activa = c.id === activaId;
          const asignado = equipo.find((m: any) => m.id === c.asignado_a);
          const canal = c.virtual ? 'crm' : (c.ultimo_canal === 'email' ? 'email' : 'wa');
          const resuelta = c.estado_crm === 'resuelta';
          return (
            <button key={c.id} onClick={() => onAbrir(c)} className="wa-fila-hover"
              style={{
                display: 'flex', gap: 10, width: '100%', textAlign: 'left', border: 'none',
                borderBottom: `1px solid ${C.g50}`, cursor: 'pointer', fontFamily: 'inherit',
                padding: '11px 12px', alignItems: 'flex-start',
                background: activa ? 'rgba(238,236,254,.6)' : resuelta ? 'rgba(249,250,251,.4)' : '#fff',
                borderLeft: activa ? `3px solid ${C.morado}` : '3px solid transparent',
              }}>
              <Avatar nombre={c.contacto?.nombre} telefono={String(c.telefono || '?')} canal={canal as any} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <b style={{ fontSize: 13, color: resuelta ? C.g400 : C.g900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                    {c.contacto?.nombre || c.telefono}
                  </b>
                  {c.estado_crm === 'pendiente' && <span style={{ fontSize: 9, fontWeight: 700, background: C.ambar100, color: C.ambar700, borderRadius: 999, padding: '1px 6px' }}>Pendiente</span>}
                  {resuelta && <span style={{ fontSize: 9, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '1px 6px', textTransform: 'uppercase' }}>Resuelta</span>}
                  {asignado && (!yo || c.asignado_a !== yo.id) && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: C.azulAgua, color: C.azulTinta, borderRadius: 999, padding: '1px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>→ {asignado.nombre.split(' ')[0]}</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: c.no_leidos ? C.moradoTinta : C.g400, fontWeight: c.no_leidos ? 700 : 400, flexShrink: 0 }}>
                    {c.virtual ? <span style={{ fontSize: 9, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '1px 6px' }}>CRM</span> : horaRelativa(c.ultimo_mensaje_at)}
                  </span>
                </span>
                {etapa && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: etapa.fg, opacity: .6 }} />
                    <span style={{ fontSize: 11, color: C.g400 }}>{etapa.label}{c.empresa?.nombre ? ` · ${c.empresa.nombre}` : ''}</span>
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12, color: c.no_leidos ? C.g700 : C.g500,
                    fontWeight: c.no_leidos ? 600 : 400, fontStyle: c.virtual ? 'italic' : 'normal',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
                  }}>
                    {c.virtual ? 'Sin conversación' : `${c.ultima_direccion === 'saliente' ? 'Tú: ' : ''}${c.ultimo_mensaje_texto || '—'}`}
                  </span>
                  {c.no_leidos > 0 && (
                    <span style={{ background: C.morado, color: '#fff', fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                      {c.no_leidos}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros avanzados */}
      {modalFiltros && (
        <div onClick={() => setModalFiltros(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(672px, 94vw)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.g100}` }}><b style={{ fontSize: 15 }}>Filtros avanzados</b></div>
            <div className="wa-scroll" style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <FiltrosAdHocEditor campos={campos} inicial={filtrosAdHoc} onListo={(f) => { setFiltrosAdHoc(f); setModalFiltros(false); }} onLimpiar={() => { setFiltrosAdHoc(null); setModalFiltros(false); }} onCancelar={() => setModalFiltros(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FiltrosAdHocEditor({ campos, inicial, onListo, onLimpiar, onCancelar }: {
  campos: CampoFiltro[]; inicial: { logica: 'AND' | 'OR'; condiciones: Condicion[] } | null;
  onListo: (f: { logica: 'AND' | 'OR'; condiciones: Condicion[] }) => void; onLimpiar: () => void; onCancelar: () => void;
}) {
  const [logica, setLogica] = useState<'AND' | 'OR'>(inicial?.logica || 'AND');
  const [condiciones, setCondiciones] = useState<Condicion[]>(
    inicial?.condiciones?.length ? inicial.condiciones : [{ campo: campos[0].id, op: campos[0].ops[0].id, valor: campos[0].valores?.[0]?.v || '' }]);
  return (
    <div>
      <BuilderCondiciones campos={campos} condiciones={condiciones} logica={logica} onCambio={(c, l) => { setCondiciones(c); setLogica(l); }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button onClick={onLimpiar} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: C.g400, fontWeight: 600 }}>Limpiar filtros</button>
        <span style={{ flex: 1 }} />
        <button onClick={onCancelar} style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 16px', background: '#fff', fontSize: 13, fontWeight: 600, color: C.g700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button onClick={() => onListo({ logica, condiciones })} style={{ border: 'none', borderRadius: 8, padding: '8px 16px', background: C.morado, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Aplicar</button>
      </div>
    </div>
  );
}
