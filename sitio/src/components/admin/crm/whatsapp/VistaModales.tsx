// WHATSAPP · Modales de secciones y vistas del sidebar (portados de
// sacs_inbox): CreateSection (emoji + nombre) y CreateView a DOS columnas con
// builder de condiciones AND/OR y PREVIEW EN VIVO de coincidencias.
import { useEffect, useMemo, useRef, useState } from 'react';
import { C, label, spinner } from './estilo';
import { catalogoCampos, type CampoFiltro, type Condicion, type ConfigVista } from '../../../../lib/whatsapp/filtros';
import { Avatar } from './ListaConversaciones';
import { lifecycleDe } from '../../../../lib/crm/lifecycle';

export const EMOJIS = ['📁', '⭐', '🔥', '💎', '🎯', '💼', '🛍️', '👑', '🚀', '💰', '📈', '🧲', '🫶', '🕐', '📌', '🏷️', '🧊', '🌱', '🏆', '⚡'];

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8,
  padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fff',
};
const btn = (primario?: boolean): React.CSSProperties => ({
  border: primario ? 'none' : `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 16px',
  background: primario ? C.morado : '#fff', color: primario ? '#fff' : C.g700,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
});
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 960,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};

function EmojiGrid({ valor, onElegir }: { valor: string; onElegir: (e: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => onElegir(e)}
          style={{
            fontSize: 18, padding: 4, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            border: 'none', background: valor === e ? C.moradoAgua : 'transparent',
            boxShadow: valor === e ? `0 0 0 2px ${C.morado}` : 'none',
          }}>{e}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
export function CrearSeccionModal({ seccion, onGuardar, onClose }: {
  seccion?: any; onGuardar: (s: { id?: string; emoji: string; nombre: string; descripcion: string }) => Promise<void>; onClose: () => void;
}) {
  const [emoji, setEmoji] = useState(seccion?.emoji || '📁');
  const [nombre, setNombre] = useState(seccion?.nombre || '');
  const [descripcion, setDescripcion] = useState(seccion?.descripcion || '');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: 'min(384px, 94vw)', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <b style={{ fontSize: 15 }}>{seccion ? 'Editar grupo' : 'Nuevo grupo de vistas'}</b>
        <div style={{ marginTop: 14 }}><EmojiGrid valor={emoji} onElegir={setEmoji} /></div>
        <label style={{ ...label(), display: 'block', margin: '12px 0 4px' }}>Nombre</label>
        <input autoFocus style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Clientes VIP" />
        <label style={{ ...label(), display: 'block', margin: '10px 0 4px' }}>Descripción (opcional)</label>
        <input style={inp} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={btn()} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn(true), opacity: nombre.trim() ? 1 : .4 }} disabled={!nombre.trim() || ocupado}
            onClick={async () => { setOcupado(true); await onGuardar({ id: seccion?.id, emoji, nombre: nombre.trim(), descripcion }); setOcupado(false); }}>
            {seccion ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
/** El builder de condiciones (compartido: modal de vista y filtros avanzados). */
export function BuilderCondiciones({ campos, condiciones, logica, onCambio }: {
  campos: CampoFiltro[]; condiciones: Condicion[]; logica: 'AND' | 'OR';
  onCambio: (conds: Condicion[], logica: 'AND' | 'OR') => void;
}) {
  const grupos = useMemo(() => {
    const m = new Map<string, CampoFiltro[]>();
    for (const c of campos) { const a = m.get(c.grupo) || []; a.push(c); m.set(c.grupo, a); }
    return [...m.entries()];
  }, [campos]);
  const set = (i: number, cambio: Partial<Condicion>) => {
    const nueva = condiciones.map((c, j) => j === i ? { ...c, ...cambio } : c);
    onCambio(nueva, logica);
  };
  const campoDe = (id: string) => campos.find(c => c.id === id);
  const sel: React.CSSProperties = { ...inp, width: 'auto', padding: '7px 8px', fontSize: 12 };

  return (
    <div>
      {condiciones.map((c, i) => {
        const campo = campoDe(c.campo);
        return (
          <div key={i}>
            {i > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                <button onClick={() => onCambio(condiciones, logica === 'AND' ? 'OR' : 'AND')}
                  style={{
                    fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '3px 12px', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${logica === 'AND' ? '#c9bcf7' : C.ambar200}`,
                    background: logica === 'AND' ? C.moradoSuave : C.ambar50,
                    color: logica === 'AND' ? C.moradoTinta : C.ambar700,
                  }}>{logica === 'AND' ? 'Y' : 'O'}</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <select style={{ ...sel, flex: 1, minWidth: 0 }} value={c.campo}
                onChange={e => {
                  const nuevo = campoDe(e.target.value)!;
                  set(i, { campo: nuevo.id, op: nuevo.ops[0].id, valor: nuevo.valores?.[0]?.v || '' });
                }}>
                {grupos.map(([g, cs]) => (
                  <optgroup key={g} label={g}>
                    {cs.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <select style={{ ...sel, width: 118 }} value={c.op} onChange={e => set(i, { op: e.target.value })}>
                {(campo?.ops || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              {campo?.valores?.length ? (
                <select style={{ ...sel, width: 150 }} value={c.valor} onChange={e => set(i, { valor: e.target.value })}>
                  {campo.valores.map(v => <option key={v.v} value={v.v}>{v.l}</option>)}
                </select>
              ) : (
                <input style={{ ...sel, width: 150 }} value={c.valor} placeholder='Ej. "3h", "2 días", 5000'
                  onChange={e => set(i, { valor: e.target.value })} />
              )}
              <button onClick={() => onCambio(condiciones.filter((_, j) => j !== i), logica)}
                style={{
                  border: 'none', background: 'none', cursor: condiciones.length > 1 ? 'pointer' : 'default',
                  color: C.g300, fontSize: 14, padding: 4, fontFamily: 'inherit',
                  opacity: condiciones.length > 1 ? 1 : .3, pointerEvents: condiciones.length > 1 ? 'auto' : 'none',
                }}>✕</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => onCambio([...condiciones, { campo: campos[0].id, op: campos[0].ops[0].id, valor: campos[0].valores?.[0]?.v || '' }], logica)}
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.moradoTinta, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: '4px 0' }}>
        + Agregar condición
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
function PreviewVista({ config }: { config: ConfigVista }) {
  const [datos, setDatos] = useState<{ total: number; filas: any[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const deb = useRef<any>(null);
  const tiene = (config.condiciones || []).some(c => c.campo && (c.valor || c.op.startsWith('hace')));

  useEffect(() => {
    if (!tiene) { setDatos(null); return; }
    clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      setCargando(true);
      const j = await fetch(`/api/crm/whatsapp/inbox?vista=${encodeURIComponent(JSON.stringify(config))}&limit=6`)
        .then(r => r.json()).catch(() => null);
      setCargando(false);
      if (j?.conversaciones) setDatos({ total: j.total_filtrado ?? j.conversaciones.length, filas: j.conversaciones.slice(0, 5) });
    }, 450);
    return () => clearTimeout(deb.current);
  }, [JSON.stringify(config)]);

  if (!tiene) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ width: 48, height: 48, borderRadius: 999, background: C.g100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
        <p style={{ fontSize: 12, color: C.g400, lineHeight: 1.5, marginTop: 10 }}>Agrega filtros para ver<br />contactos que coinciden</p>
      </div>
    );
  }
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: C.morado, animation: 'pulso 1.4s ease infinite' }} />
        <b style={{ fontSize: 13 }}>{cargando && !datos ? '…' : `${datos?.total ?? 0} contactos`}</b>
        {cargando && datos && <span style={spinner(12, C.g300)} />}
      </div>
      {(datos?.filas || []).map(f => {
        const etapa = lifecycleDe(f.contacto?.lifecycle_stage);
        return (
          <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
            <Avatar nombre={f.contacto?.nombre} telefono={String(f.telefono || '?')} size={28} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <b style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.contacto?.nombre || f.telefono}</b>
                {etapa && <span style={{ fontSize: 9, fontWeight: 800, background: etapa.bg, color: etapa.fg, borderRadius: 999, padding: '1px 6px' }}>{etapa.label}</span>}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: C.g400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[f.empresa?.nombre, f.empresa?.mrr ? `$${Number(f.empresa.mrr).toLocaleString('es-MX')} MRR` : null].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
          </div>
        );
      })}
      {datos && datos.total > 5 && <p style={{ fontSize: 10, color: C.g400, marginTop: 6 }}>y {datos.total - 5} contactos más…</p>}
    </div>
  );
}

const MODOS = [
  { v: 'todas', l: '👥 Todos' },
  { v: 'con_conversacion', l: '💬 Con conversación' },
  { v: 'solo_contactos', l: '📋 Sin conversación' },
] as const;

export function CrearVistaModal({ vista, seccionId, campos, onGuardar, onClose }: {
  vista?: { id: string; nombre: string; config: ConfigVista } | null;
  seccionId?: string | null;
  campos: CampoFiltro[];
  onGuardar: (v: { id?: string; nombre: string; config: ConfigVista }) => Promise<void>;
  onClose: () => void;
}) {
  const base = vista?.config || {};
  const [emoji, setEmoji] = useState(base.emoji || '⭐');
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [nombre, setNombre] = useState(vista?.nombre || '');
  const [modo, setModo] = useState<ConfigVista['modo']>(base.modo || 'con_conversacion');
  const [logica, setLogica] = useState<'AND' | 'OR'>(base.logica || 'AND');
  const [condiciones, setCondiciones] = useState<Condicion[]>(
    base.condiciones?.length ? base.condiciones : [{ campo: campos[0].id, op: campos[0].ops[0].id, valor: campos[0].valores?.[0]?.v || '' }]);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const config: ConfigVista = { seccion_id: seccionId ?? base.seccion_id ?? null, emoji, modo, logica, condiciones };

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: 'min(896px, 96vw)', maxHeight: '85dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.g100}` }}>
          <b style={{ fontSize: 15 }}>{vista ? 'Editar vista' : 'Nueva vista'}</b>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* Izquierda */}
          <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
              <button onClick={() => setEmojiAbierto(a => !a)}
                style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.g200}`, background: '#fff', fontSize: 18, cursor: 'pointer' }}>{emoji}</button>
              {emojiAbierto && (
                <div style={{ position: 'absolute', top: 44, left: 0, zIndex: 5, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, padding: 10, width: 224, boxShadow: '0 12px 32px rgba(0,0,0,.12)' }}>
                  <EmojiGrid valor={emoji} onElegir={e => { setEmoji(e); setEmojiAbierto(false); }} />
                </div>
              )}
              <input autoFocus style={{ ...inp, flex: 1 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la vista" />
            </div>

            <label style={{ ...label(), display: 'block', margin: '16px 0 6px' }}>Mostrar contactos</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {MODOS.map(m => (
                <button key={m.v} onClick={() => setModo(m.v)}
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${modo === m.v ? '#c9bcf7' : C.g200}`,
                    background: modo === m.v ? C.moradoSuave : '#fff',
                    color: modo === m.v ? C.moradoTinta : C.g500,
                  }}>{m.l}</button>
              ))}
            </div>

            <label style={{ ...label(), display: 'block', margin: '16px 0 6px' }}>Filtros</label>
            <BuilderCondiciones campos={campos} condiciones={condiciones} logica={logica}
              onCambio={(c, l) => { setCondiciones(c); setLogica(l); }} />
          </div>
          {/* Derecha: preview en vivo */}
          <div className="wa-scroll" style={{ width: 288, borderLeft: `1px solid ${C.g100}`, background: 'rgba(249,250,251,.5)', overflowY: 'auto' }}>
            <PreviewVista config={config} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.g100}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={btn()} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn(true), opacity: nombre.trim() ? 1 : .4 }} disabled={!nombre.trim() || ocupado}
            onClick={async () => { setOcupado(true); await onGuardar({ id: vista?.id, nombre: nombre.trim(), config }); setOcupado(false); }}>
            {vista ? 'Guardar' : 'Crear vista'}
          </button>
        </div>
      </div>
    </div>
  );
}
