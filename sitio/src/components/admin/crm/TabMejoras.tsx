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
const CATS: Record<string, string> = {
  personalizacion: 'personalización', plugin: 'plugin', ajuste: 'ajuste',
  modulo: 'módulo', capacitacion: 'capacitación', otro: 'otro',
};

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

  // Las capacitaciones se sacan de las dos listas de arriba y viven en la
  // suya: no son algo que se le "entregue" al sistema del cliente, son algo
  // que se le enseñó a su gente. Mezclarlas inflaba el conteo de mejoras.
  const capacitaciones = rows.filter(m => m.categoria === 'capacitacion');
  const otras = rows.filter(m => m.categoria !== 'capacitacion');
  const entregadas = otras.filter(m => m.estado === 'entregada');
  const enCurso = otras.filter(m => m.estado === 'cotizada' || m.estado === 'en_proceso');
  const ideas = otras.filter(m => m.estado === 'idea');
  const potencial = ideas.reduce((a, m) => a + Number(m.valor || 0), 0);
  const cobrado = entregadas.reduce((a, m) => a + (m.cortesia ? 0 : Number(m.valor || 0)), 0);
  const anio = new Date().getFullYear();
  const esteAnio = entregadas.filter(m => String(m.fecha_entrega || '').startsWith(String(anio))).length;

  const Renglon = ({ m }: any) => {
    const e = ESTADOS[m.estado] || ESTADOS.idea;
    return (
      <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: '1px solid #f5f4f8', alignItems: 'flex-start' }}>
        <span style={{ flex: '0 0 8px', height: 8, borderRadius: 99, background: e.punto, marginTop: 6 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>
            {m.titulo}
            <span style={{ fontSize: '0.57rem', fontWeight: 800, background: '#EEECFE', color: '#5B4BD6', borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>{CATS[m.categoria] || m.categoria}</span>
            {e.tag && <span style={{ fontSize: '0.57rem', fontWeight: 800, background: e.tagBg, color: e.tagTx, borderRadius: 20, padding: '2px 8px', marginLeft: 5 }}>{e.tag}</span>}
            {m.visible_cliente === false && <span style={{ fontSize: '0.57rem', fontWeight: 800, background: '#F4F4F6', color: '#6B7280', borderRadius: 20, padding: '2px 8px', marginLeft: 5 }}>interna</span>}
          </div>
          {m.descripcion && <div style={{ fontSize: '0.74rem', color: '#71717a', lineHeight: 1.5, marginTop: 2 }}>{m.descripcion}</div>}
          <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 5 }}>
            {m.fecha_entrega && <>Entregada {fmtDate(m.fecha_entrega)}</>}
            {!m.fecha_entrega && m.fecha_compromiso && <>Comprometida para el {fmtDate(m.fecha_compromiso)}</>}
            {m.bookings?.fecha && <> · salió de la <b style={{ color: '#5B4BD6' }}>junta del {fmtDate(m.bookings.fecha)}</b></>}
            {m.quotes?.numero && <> · cobrada en <b style={{ color: '#5B4BD6' }}>{m.quotes.numero}</b></>}
            {!m.quotes?.numero && m.cortesia && <> · sin costo</>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
            {m.estado === 'idea' && <button style={S.btnAzul} onClick={() => cotizar(m)}>Cotizar esta idea</button>}
            {m.estado !== 'entregada' && <button style={S.btnG} onClick={() => cambiarEstado(m, 'entregada')}>Marcar entregada</button>}
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
        {[['Entregadas este año', esteAnio], ['Cobrado en mejoras', money(cobrado)], ['Ideas abiertas', ideas.length], ['Potencial', '~' + money(potencial)]].map(([l, v]: any) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 14px', minWidth: 130, flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.h}>
          Entregadas
          <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={() => setEditando({ estado: 'entregada', categoria: 'personalizacion' })}>+ Agregar mejora</button>
        </div>
        {entregadas.length === 0 && enCurso.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem', padding: '4px 0 8px' }}>Todavía no hay mejoras registradas para esta cuenta.</div>}
        {entregadas.map(m => <Renglon key={m.id} m={m} />)}
        {enCurso.map(m => <Renglon key={m.id} m={m} />)}
      </div>

      <div style={S.cardA}>
        <div style={S.h}>
          Ideas por vender
          <span style={S.nota}>{ideas.length ? `${ideas.length} · ~${money(potencial)} potencial` : ''}</span>
          <button style={S.btn} onClick={() => setEditando({ estado: 'idea', categoria: 'personalizacion' })}>+ Agregar idea</button>
        </div>
        {ideas.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem', padding: '4px 0 8px' }}>Lo que se te ocurra en una junta y le pueda interesar al cliente va aquí. De ahí sale la siguiente venta.</div>}
        {ideas.map(m => <Renglon key={m.id} m={m} />)}
      </div>

      {/* Capacitaciones: lo que se le ENSEÑÓ a la gente del cliente, ya sea en
          una junta o mandándole el video de eso que preguntó. Va aquí y no en
          Reuniones porque lo que importa es el seguimiento del tema, no la
          sesión: un mismo tema puede tocarse en tres juntas. */}
      <div style={{ ...S.card, borderColor: '#f5e2b8' }}>
        <div style={S.h}>
          Capacitaciones
          <span style={S.nota}>{capacitaciones.length ? `${capacitaciones.filter(m => m.estado === 'entregada').length} impartidas de ${capacitaciones.length}` : ''}</span>
          <button style={S.btn} onClick={() => setEditando({ estado: 'entregada', categoria: 'capacitacion', visible_cliente: true })}>+ Agregar capacitación</button>
        </div>
        {capacitaciones.length === 0 && (
          <div style={{ color: '#999', fontSize: '0.82rem', padding: '4px 0 8px' }}>
            Lo que le enseñaste en una junta y los videos que le mandaste por lo que preguntó. Así se ve de un vistazo
            qué ya sabe usar y qué se le ha repetido.
          </div>
        )}
        {capacitaciones.map(m => {
          const { texto: etq, hecha: impartida } = etiquetaCap(m);
          const modo = MODOS[modoDe(m)];
          return (
            <div key={m.id} style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: '1px solid #f5f4f8', alignItems: 'flex-start' }}>
              <span style={{ flex: '0 0 8px', height: 8, borderRadius: 99, background: impartida ? '#4FBF95' : '#F0B84E', marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>
                  {m.titulo}
                  <span style={{ fontSize: '0.57rem', fontWeight: 800, background: impartida ? '#EAF8F2' : '#FEF6E7', color: impartida ? '#1E8A63' : '#9a6a10', borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>
                    {modo.label.replace(/^En una |^En la /, '')} · {etq}
                  </span>
                  {m.modulo && <span style={{ fontSize: '0.57rem', fontWeight: 800, background: '#EEECFE', color: '#5B4BD6', borderRadius: 20, padding: '2px 8px', marginLeft: 5 }}>{m.modulo}</span>}
                </div>
                {m.descripcion && <div style={{ fontSize: '0.74rem', color: '#71717a', lineHeight: 1.5, marginTop: 2 }}>{m.descripcion}</div>}
                <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 5 }}>
                  {m.fecha_entrega ? <>{modoDe(m) === 'video' ? 'Enviada' : 'Impartida'} {fmtDate(m.fecha_entrega)}</> : m.fecha_compromiso ? <>Para el {fmtDate(m.fecha_compromiso)}</> : 'Sin fecha'}
                  {m.bookings?.fecha && <> · <b style={{ color: '#5B4BD6' }}>junta del {fmtDate(m.bookings.fecha)}</b></>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                  {m.url && <a href={m.url} target="_blank" rel="noreferrer" style={{ ...S.btnAzul, textDecoration: 'none' }}>Ver el video</a>}
                  {!impartida && <button style={S.btnG} onClick={() => cambiarEstado(m, 'entregada')}>{modoDe(m) === 'video' ? 'Marcar enviada' : 'Marcar impartida'}</button>}
                  <button style={S.btnG} onClick={() => setEditando(m)}>Editar</button>
                  <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => archivar(m)}>Quitar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ ...S.card, background: '#faf8ff', borderColor: '#e6ddfa' }}>
        <div style={S.h}>Reporte ejecutivo del periodo</div>
        <div style={{ fontSize: '0.78rem', color: '#6b6b74', lineHeight: 1.55, marginBottom: 10 }}>
          Eliges el rango y sale qué se le entregó, qué módulos nuevos arrancó y qué se le capacitó. Lo redacta la IA
          con los datos reales de la cuenta.
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

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 460, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>{m.id ? 'Editar' : esCap ? 'Nueva capacitación' : esEntregada ? 'Nueva mejora' : 'Nueva idea'}</h3>
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
                {esCap
                  ? [['entregada', (f.modo === 'video' ? 'Enviada' : 'Impartida')], ['en_proceso', (f.modo === 'video' ? 'Pendiente de enviar' : 'Pendiente')], ['descartada', 'Cancelada']].map(([k, v]) => <option key={k} value={k}>{v}</option>)
                  : Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div><div style={S.lbl}>Tipo</div>
              <select value={f.categoria} onChange={e => set('categoria', e.target.value)} style={S.input}>
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: esCap ? '1fr' : '1fr 1fr', gap: 9, marginBottom: 10 }}>
            {!esCap && <div><div style={S.lbl}>{esEntregada ? 'Cuánto se cobró' : 'Cuánto podría valer'}</div>
              <input type="number" value={f.valor || ''} onChange={e => set('valor', e.target.value)} placeholder="0" style={S.input} disabled={f.cortesia} /></div>}
            <div><div style={S.lbl}>{esCap ? (esEntregada ? (f.modo === 'video' ? 'Cuándo se envió' : 'Cuándo se dio') : 'Para cuándo') : esEntregada ? 'Fecha de entrega' : 'Comprometida para'}</div>
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

          {!esCap && (
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
