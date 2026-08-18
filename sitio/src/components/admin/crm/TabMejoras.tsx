// Mejoras e ideas de la cuenta.
//
// Una sola lista con dos momentos: arriba lo que ya se entregó, abajo lo que
// todavía es idea. Es el mismo renglón avanzando —la idea de agosto es la
// mejora de octubre—, por eso "Marcar entregada" no copia nada a ningún lado,
// solo cambia el estado y conserva de qué junta salió y en qué cotización se
// cobró. Ese hilo es lo que se le enseña al cliente.
import { useEffect, useState } from 'react';
import ReporteMejoras from './ReporteMejoras';
import { MODULOS_SACS, MODOS, modoDe, etiquetaCap } from '../../../lib/crm/modulos-sacs';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '';

const ESTADOS: Record<string, { label: string; punto: string; tag?: string; tagBg?: string; tagTx?: string }> = {
  idea:       { label: 'Idea',        punto: '#7DA6F5' },
  cotizada:   { label: 'Cotizada',    punto: '#9B8CFA', tag: 'cotizada', tagBg: '#EEECFE', tagTx: '#5B4BD6' },
  en_proceso: { label: 'En proceso',  punto: '#F0B84E', tag: 'en proceso', tagBg: '#FEF6E7', tagTx: '#9a6a10' },
  entregada:  { label: 'Entregada',   punto: '#4FBF95' },
  descartada: { label: 'Descartada',  punto: '#C9C7D0' },
};
// Un color por tipo, igual que en la vista de todas las cuentas: la lista se
// recorre de un vistazo sin leer palabra por palabra.
const CATS_COLOR: Record<string, { label: string; bg: string; fg: string }> = {
  capacitacion:    { label: 'capacitación',    bg: '#FEF6E7', fg: '#9a6a10' },
  pendiente:       { label: 'pendiente',       bg: '#f4f4f6', fg: '#6B7280' },
  personalizacion: { label: 'personalización', bg: '#EEECFE', fg: '#5B4BD6' },
  plugin:          { label: 'plugin',          bg: '#E3EDFD', fg: '#2C5FC4' },
  modulo:          { label: 'módulo',          bg: '#EAF8F2', fg: '#1E8A63' },
  ajuste:          { label: 'ajuste',          bg: '#F4F4F6', fg: '#6B7280' },
  otro:            { label: 'otro',            bg: '#F4F4F6', fg: '#6B7280' },
};
const cat = (k: string) => CATS_COLOR[k] || CATS_COLOR.otro;
const CATS: Record<string, string> = Object.fromEntries(Object.entries(CATS_COLOR).map(([k, v]) => [k, v.label]));

const S = {
  card: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  cardA: { background: '#fff', border: '1.5px solid #cfe0fa', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  h: { fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as const,
  nota: { marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  btn: { padding: '7px 13px', border: 'none', borderRadius: 9, fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff', fontFamily: 'inherit' } as const,
  btnAzul: { padding: '5px 11px', border: '1.5px solid #7DA6F5', borderRadius: 9, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#2C5FC4', fontFamily: 'inherit' } as const,
  btnG: { padding: '5px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
  input: { padding: '8px 11px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.79rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fdfcff', fontFamily: 'inherit' } as const,
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
};

export default function TabMejoras({ companyId, cliente, flash }: any) {
  // `cliente` es el nombre que va al abrir la cotización desde una idea.
  const [rows, setRows] = useState<any[] | null>(null);
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [reuniones, setReuniones] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);   // {} = nueva
  const [reporte, setReporte] = useState(false);
  const [verTodo, setVerTodo] = useState(false);

  const cargar = () => fetch('/api/crm/mejoras?company_id=' + companyId)
    .then(r => r.json()).then(j => { setRows(j.data || []); setVencidas(j.vencidas || []); }).catch(() => setRows([]));
  useEffect(() => {
    let alive = true; setRows(null);
    fetch('/api/crm/mejoras?company_id=' + companyId).then(r => r.json())
      .then(j => { if (alive) { setRows(j.data || []); setVencidas(j.vencidas || []); } }).catch(() => { if (alive) setRows([]); });
    fetch('/api/scheduling/reuniones?company_id=' + companyId).then(r => r.json())
      .then(j => { if (alive) setReuniones(j.data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  async function guardar(m: any) {
    const nueva = !m.id;
    const r = await fetch('/api/crm/mejoras', {
      method: nueva ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...m, company_id: companyId }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo guardar'); return false; }
    setEditando(null); cargar(); flash(nueva ? 'Agregada' : 'Guardada');
    return true;
  }
  async function cambiarEstado(m: any, estado: string) {
    const r = await fetch('/api/crm/mejoras', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, estado }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo actualizar'); return; }
    cargar(); flash(ESTADOS[estado]?.label || 'Actualizada');
  }
  async function archivar(m: any) {
    if (!confirm(`¿Quitar "${m.titulo}" de la lista?\n\nSe archiva: deja de verse aquí pero no se borra del historial.`)) return;
    await fetch('/api/crm/mejoras', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) }).catch(() => {});
    cargar();
  }

  if (rows === null) return <div style={{ ...S.card, color: '#999', fontSize: '0.82rem' }}>Cargando mejoras…</div>;

  // Se agrupa por lo que hay que HACER, no por qué tipo de cosa es: que un
  // video y una personalización sean distintos le importa al sistema, no a
  // quien tiene que cerrarlos hoy. El tipo se conserva adentro, con su color.
  const abierto = (m: any) => m.estado === 'cotizada' || m.estado === 'en_proceso';
  const porFecha = (a: any, b: any) => String(a.fecha_compromiso || '9999').localeCompare(String(b.fecha_compromiso || '9999'));

  const ideas = rows.filter(m => m.estado === 'idea');
  const entregadas = rows.filter(m => m.estado === 'entregada');
  const grupos = [
    { k: 'obra', l: 'Mejoras y personalizaciones', filas: rows.filter(m => abierto(m) && ['personalizacion', 'plugin', 'modulo', 'ajuste'].includes(m.categoria)).sort(porFecha) },
    { k: 'video', l: 'Videos por enviar', filas: rows.filter(m => abierto(m) && m.categoria === 'capacitacion' && modoDe(m) === 'video').sort(porFecha) },
    { k: 'cap', l: 'Capacitaciones programadas', filas: rows.filter(m => abierto(m) && m.categoria === 'capacitacion' && modoDe(m) !== 'video').sort(porFecha) },
    { k: 'pend', l: 'Otros pendientes', filas: rows.filter(m => abierto(m) && ['pendiente', 'otro'].includes(m.categoria)).sort(porFecha) },
  ].filter(g => g.filas.length);
  const porHacer = grupos.reduce((a, g) => a + g.filas.length, 0);

  const hoyISO = new Date().toISOString().slice(0, 10);
  const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const estaSemana = rows.filter(m => abierto(m) && m.fecha_compromiso && m.fecha_compromiso <= en7).length;

  const potencial = ideas.reduce((a, m) => a + Number(m.valor || 0), 0);
  const cobrado = entregadas.reduce((a, m) => a + (m.cortesia ? 0 : Number(m.valor || 0)), 0);
  const anio = new Date().getFullYear();
  const delAnio = entregadas.filter(m => String(m.fecha_entrega || '').startsWith(String(anio)));
  const esteAnio = delAnio.length;

  const Renglon = ({ m }: any) => {
    const e = ESTADOS[m.estado] || ESTADOS.idea;
    return (
      <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: '1px solid #f5f4f8', alignItems: 'flex-start' }}>
        <span style={{ flex: '0 0 8px', height: 8, borderRadius: 99, background: e.punto, marginTop: 6 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>
            {m.titulo}
            <span style={{ fontSize: '0.57rem', fontWeight: 800, background: cat(m.categoria).bg, color: cat(m.categoria).fg, borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>{cat(m.categoria).label}</span>
            {e.tag && <span style={{ fontSize: '0.57rem', fontWeight: 800, background: e.tagBg, color: e.tagTx, borderRadius: 20, padding: '2px 8px', marginLeft: 5 }}>{e.tag}</span>}
            {m.modulo && <span style={{ fontSize: '0.57rem', fontWeight: 800, background: '#f6f5f9', color: '#6b6b74', borderRadius: 20, padding: '2px 8px', marginLeft: 5 }}>{m.modulo}</span>}
            {m.visible_cliente === false && <span style={{ fontSize: '0.57rem', fontWeight: 800, background: '#F4F4F6', color: '#6B7280', borderRadius: 20, padding: '2px 8px', marginLeft: 5 }}>interna</span>}
          </div>
          {m.descripcion && <div style={{ fontSize: '0.74rem', color: '#71717a', lineHeight: 1.5, marginTop: 2 }}>{m.descripcion}</div>}
          <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 5 }}>
            {m.fecha_entrega && <>{m.categoria === 'capacitacion' ? (modoDe(m) === 'video' ? 'Enviado' : 'Impartida') : 'Entregada'} {fmtDate(m.fecha_entrega)}</>}
            {!m.fecha_entrega && m.fecha_compromiso && <>Comprometida para el {fmtDate(m.fecha_compromiso)}</>}
            {m.bookings?.fecha && <> · salió de la <b style={{ color: '#5B4BD6' }}>junta del {fmtDate(m.bookings.fecha)}</b></>}
            {m.quotes?.numero && <> · cobrada en <b style={{ color: '#5B4BD6' }}>{m.quotes.numero}</b></>}
            {!m.quotes?.numero && m.cortesia && <> · sin costo</>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
            {m.estado === 'idea' && <button style={S.btnAzul} onClick={() => cotizar(m)}>Cotizar esta idea</button>}
            {m.estado !== 'entregada' && (
              <button style={S.btnG} onClick={() => cambiarEstado(m, 'entregada')}>
                {m.categoria === 'capacitacion' ? (modoDe(m) === 'video' ? 'Marcar enviado' : 'Marcar impartida') : m.categoria === 'pendiente' ? 'Marcar hecho' : 'Marcar entregada'}
              </button>
            )}
            {m.estado === 'idea' && <button style={S.btnG} onClick={() => cambiarEstado(m, 'en_proceso')}>En proceso</button>}
            <button style={S.btnG} onClick={() => setEditando(m)}>Editar</button>
            <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => archivar(m)}>Quitar</button>
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, whiteSpace: 'nowrap', color: m.cortesia ? '#a5a2af' : m.estado === 'entregada' ? '#1E8A63' : '#2C5FC4' }}>
          {m.cortesia ? 'Cortesía' : Number(m.valor) > 0 ? (m.estado === 'idea' ? '~' : '') + money(m.valor) : '—'}
        </div>
      </div>
    );
  };

  // La idea se vuelve cobro sin capturarla dos veces: se abre el módulo de
  // cotizaciones con el concepto ya escrito.
  function cotizar(m: any) {
    const q = new URLSearchParams({ nueva: '1', company_id: companyId, empresa: cliente || '', concepto: m.titulo, detalle: m.descripcion || '', importe: String(Math.round(Number(m.valor || 0))) });
    window.open('/admin/revenue?' + q.toString(), '_blank', 'noopener');
  }

  return (
    <div>
      {/* Lo prometido que ya venció va ARRIBA de todo: una promesa que no llegó
          hace más daño que una que nunca se hizo. */}
      {vencidas.length > 0 && (
        <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '11px 13px', marginBottom: 12, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>⚠️</span>
          <div style={{ fontSize: '0.79rem', color: '#C0554E', lineHeight: 1.6 }}>
            <b style={{ color: '#8c2f28' }}>{vencidas.length} {vencidas.length === 1 ? 'cosa comprometida se pasó de fecha' : 'cosas comprometidas se pasaron de fecha'}.</b>
            {vencidas.map((v: any) => (
              <div key={v.id}>{v.titulo} · se prometió para el {fmtDate(v.fecha_compromiso)}, {v.dias} {v.dias === 1 ? 'día' : 'días'} tarde</div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          ['Por hacer', String(porHacer), estaSemana ? `${estaSemana} vencen esta semana` : 'nada urgente', porHacer ? '#9a6a10' : '#1a1a1a'],
          ['Entregado este año', String(esteAnio), delAnio[0]?.fecha_entrega ? `último el ${fmtDate(delAnio[0].fecha_entrega)}` : 'sin entregas', '#1a1a1a'],
          ['Cobrado', money(cobrado), `${entregadas.filter((m: any) => m.cortesia).length} fueron cortesía`, '#1E8A63'],
          ['Sobre la mesa', '~' + money(potencial), `${ideas.length} ideas sin cerrar`, '#2C5FC4'],
        ].map(([l, v, sub, col]: any) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '13px 15px', minWidth: 140, flex: 1 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: 4, letterSpacing: '-.02em', color: col }}>{v}</div>
            <div style={{ fontSize: '0.66rem', color: '#8a8a8a', marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Por hacer ── */}
      <div style={S.card}>
        <div style={S.h}>
          Por hacer
          <span style={S.nota}>{porHacer ? `${porHacer} · lo más próximo primero` : ''}</span>
          <button style={S.btn} onClick={() => setEditando({ estado: 'en_proceso', categoria: 'personalizacion', visible_cliente: true })}>+ Agregar</button>
        </div>
        {porHacer === 0 && (
          <div style={{ color: '#999', fontSize: '0.82rem', padding: '4px 0 8px' }}>
            Nada pendiente con este cliente. Lo que salga de la próxima junta aparece aquí.
          </div>
        )}
        {grupos.map(g => (
          <div key={g.k}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em', margin: '11px 0 4px' }}>
              {g.l} · {g.filas.length}
            </div>
            {g.filas.map((m: any) => <Renglon key={m.id} m={m} />)}
          </div>
        ))}
      </div>

      {/* Las ideas van aparte: no son trabajo comprometido, son dinero sobre la
          mesa. Mezclarlas con lo pendiente haría que la lista nunca se vacíe. */}
      <div style={S.cardA}>
        <div style={S.h}>
          Ideas por vender
          <span style={S.nota}>{ideas.length ? `${ideas.length} · ~${money(potencial)} potencial` : ''}</span>
          <button style={S.btn} onClick={() => setEditando({ estado: 'idea', categoria: 'personalizacion' })}>+ Agregar idea</button>
        </div>
        {ideas.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem', padding: '4px 0 8px' }}>Lo que se te ocurra en una junta y le pueda interesar al cliente va aquí. De ahí sale la siguiente venta.</div>}
        {ideas.map(m => <Renglon key={m.id} m={m} />)}
      </div>

      {/* Lo entregado se resume al año: el histórico completo se lee una vez y
          su lugar natural es el reporte. */}
      <div style={{ ...S.card, borderColor: '#eeeef1' }}>
        <div style={S.h}>
          Ya entregado
          <span style={S.nota}>{verTodo ? `${entregadas.length} en total` : `este año · ${esteAnio}`}</span>
          {entregadas.length > esteAnio && (
            <button style={S.btnG} onClick={() => setVerTodo(v => !v)}>{verTodo ? 'Solo este año' : `Ver todo (${entregadas.length})`}</button>
          )}
        </div>
        {entregadas.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem', padding: '4px 0 8px' }}>Todavía no se le ha entregado nada a este cliente.</div>}
        {(verTodo ? entregadas : delAnio).map(m => <Renglon key={m.id} m={m} />)}
      </div>

      <div style={{ ...S.card, background: '#faf8ff', borderColor: '#e6ddfa' }}>
        <div style={S.h}>Reporte ejecutivo del periodo</div>
        <div style={{ fontSize: '0.78rem', color: '#6b6b74', lineHeight: 1.55, marginBottom: 10 }}>
          Junta todo lo de arriba —entregas, capacitaciones, videos y pendientes— con lo que SACS ya sabe de la cuenta:
          qué módulos empezó a usar y cómo cambió su operación.
        </div>
        <button style={S.btn} onClick={() => setReporte(true)}>Generar reporte</button>
      </div>

      {editando && <EditorMejora m={editando} reuniones={reuniones} onCerrar={() => setEditando(null)} onGuardar={guardar} />}
      {reporte && <ReporteMejoras companyId={companyId} cliente={cliente} onCerrar={() => setReporte(false)} />}
    </div>
  );
}

function EditorMejora({ m, reuniones, onCerrar, onGuardar }: any) {
  const [f, setF] = useState<any>({
    titulo: '', descripcion: '', estado: 'idea', categoria: 'personalizacion',
    valor: 0, cortesia: false, visible_cliente: true, booking_id: '', fecha_entrega: '', fecha_compromiso: '',
    modo: 'junta', url: '', modulo: '', ...m,
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const esEntregada = f.estado === 'entregada';
  // Una capacitación no se cobra ni se "entrega": se imparte o se manda. El
  // formulario cambia de palabras para no pedir datos que no existen.
  const esCap = f.categoria === 'capacitacion';
  // Un pendiente suelto —"mándale el catálogo"— no tiene precio ni cotización:
  // pedirle un monto es preguntar algo que nunca se va a contestar.
  const esPend = f.categoria === 'pendiente';

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 460, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>{m.id ? 'Editar' : esCap ? 'Nueva capacitación' : esPend ? 'Nuevo pendiente' : f.estado === 'idea' ? 'Nueva idea' : 'Nueva mejora'}</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={{ marginBottom: 10 }}><div style={S.lbl}>{esCap ? 'Qué se le enseñó' : 'Qué es'}</div>
            <input value={f.titulo} onChange={e => set('titulo', e.target.value)}
              placeholder={esCap ? 'Cómo levantar un conteo físico' : 'Certificados digitales de pieza'} style={S.input} autoFocus /></div>
          <div style={{ marginBottom: 10 }}><div style={S.lbl}>{esCap ? 'Qué se cubrió' : 'En una línea que el cliente entienda'}</div>
            <textarea value={f.descripcion || ''} onChange={e => set('descripcion', e.target.value)} rows={2}
              placeholder={esCap ? 'Se vio el conteo por almacén y qué hacer con las diferencias.' : 'Cada pieza vendida genera su certificado con QR y liga pública.'}
              style={{ ...S.input, resize: 'vertical' }} /></div>

          {esCap && (<>
            <div style={{ marginBottom: 10 }}><div style={S.lbl}>Cómo se da</div>
              <select value={f.modo || 'junta'} onChange={e => set('modo', e.target.value)} style={S.input}>
                {Object.entries(MODOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4, lineHeight: 1.45 }}>{MODOS[(f.modo || 'junta') as keyof typeof MODOS].ayuda}</div>
            </div>
            {(f.modo || 'junta') === 'video' && (
              <div style={{ marginBottom: 10 }}><div style={S.lbl}>Liga del video</div>
                <input value={f.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://…" style={S.input} />
                <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4 }}>Déjala vacía si todavía no se lo mandas: queda en la lista de pendientes.</div>
              </div>
            )}
          </>)}

          {/* Dónde se trabajó. De catálogo, no escrito: es lo que permite
              después contar cuántas capacitaciones fueron de inventario y
              cruzarlas con los módulos que el cliente empezó a usar. */}
          <div style={{ marginBottom: 10 }}><div style={S.lbl}>Dónde se trabaja {esCap ? '' : '(opcional)'}</div>
            <select value={f.modulo || ''} onChange={e => set('modulo', e.target.value)} style={S.input}>
              <option value="">— sin definir —</option>
              {MODULOS_SACS.map(g => (
                <optgroup key={g.familia} label={g.familia}>
                  {g.modulos.map(mo => <option key={mo} value={mo}>{mo}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
            <div><div style={S.lbl}>Estado</div>
              <select value={f.estado} onChange={e => set('estado', e.target.value)} style={S.input}>
                {esPend
                  ? [['en_proceso', 'Pendiente'], ['entregada', 'Hecho'], ['descartada', 'Cancelado']].map(([k, v]) => <option key={k} value={k}>{v}</option>)
                  : esCap
                  ? [['entregada', (f.modo === 'video' ? 'Enviada' : 'Impartida')], ['en_proceso', (f.modo === 'video' ? 'Pendiente de enviar' : 'Pendiente')], ['descartada', 'Cancelada']].map(([k, v]) => <option key={k} value={k}>{v}</option>)
                  : Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div><div style={S.lbl}>Tipo</div>
              <select value={f.categoria} onChange={e => set('categoria', e.target.value)} style={S.input}>
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: (esCap || esPend) ? '1fr' : '1fr 1fr', gap: 9, marginBottom: 10 }}>
            {!esCap && !esPend && <div><div style={S.lbl}>{esEntregada ? 'Cuánto se cobró' : 'Cuánto podría valer'}</div>
              <input type="number" value={f.valor || ''} onChange={e => set('valor', e.target.value)} placeholder="0" style={S.input} disabled={f.cortesia} /></div>}
            <div><div style={S.lbl}>{esCap ? (esEntregada ? (f.modo === 'video' ? 'Cuándo se envió' : 'Cuándo se dio') : 'Para cuándo') : esPend ? (esEntregada ? 'Cuándo se hizo' : 'Para cuándo') : esEntregada ? 'Fecha de entrega' : 'Comprometida para'}</div>
              <input type="date" value={(esEntregada ? f.fecha_entrega : f.fecha_compromiso) || ''}
                onChange={e => set(esEntregada ? 'fecha_entrega' : 'fecha_compromiso', e.target.value)} style={S.input} /></div>
          </div>

          <div style={{ marginBottom: 10 }}><div style={S.lbl}>{esCap ? '¿En qué junta se dio?' : '¿De qué junta salió?'}</div>
            <select value={f.booking_id || ''} onChange={e => set('booking_id', e.target.value)} style={S.input}>
              <option value="">{esCap ? 'No fue en una junta' : 'No salió de una junta'}</option>
              {reuniones.map((r: any) => (
                <option key={r.id} value={r.id}>{fmtDate(r.fecha)} · {r.asunto || r.event_types?.nombre || 'Reunión'}</option>
              ))}
            </select>
          </div>

          {!esCap && !esPend && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.78rem', marginBottom: 7, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!f.cortesia} onChange={e => set('cortesia', e.target.checked)} />
              Fue sin costo (cortesía)
            </label>
          )}
          {/* Los ajustes internos no tienen por qué salir en el reporte que ve
              el cliente; lo que se le presume debe ser lo que le sirve. */}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.78rem', marginBottom: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.visible_cliente !== false} onChange={e => set('visible_cliente', e.target.checked)} />
            Se le puede mostrar al cliente en el reporte
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={guardando || !f.titulo.trim()} style={{ ...S.btn, padding: '8px 15px', opacity: guardando || !f.titulo.trim() ? .5 : 1 }}
              onClick={async () => { setGuardando(true); await onGuardar(f); setGuardando(false); }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button style={{ ...S.btnG, padding: '8px 14px' }} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
