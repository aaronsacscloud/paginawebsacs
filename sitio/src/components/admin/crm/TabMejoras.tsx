// Mejoras e ideas de la cuenta.
//
// Una sola lista con dos momentos: arriba lo que ya se entregó, abajo lo que
// todavía es idea. Es el mismo renglón avanzando —la idea de agosto es la
// mejora de octubre—, por eso "Marcar entregada" no copia nada a ningún lado,
// solo cambia el estado y conserva de qué junta salió y en qué cotización se
// cobró. Ese hilo es lo que se le enseña al cliente.
import { useEffect, useState } from 'react';
import Cargando from './ui/Cargando';
import ReporteMejoras from './ReporteMejoras';
import { MODULOS_SACS, MODOS, modoDe, etiquetaCap } from '../../../lib/crm/modulos-sacs';
import { computarSenales } from '../../../lib/crm/senales';

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
// De dónde nació el compromiso. Mismo vocabulario que la vista global.
const ORIGENES_L: Record<string, string> = {
  junta: 'De una junta', whatsapp: 'De WhatsApp', soporte: 'De soporte',
  llamada: 'De una llamada', manual: 'Capturado a mano',
};
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

export default function TabMejoras({ companyId, cliente, flash, co, subs = [] }: any) {
  // `cliente` es el nombre que va al abrir la cotización desde una idea.
  // `co` y `subs` son para las SEÑALES: antes vivían en un bloque aparte arriba
  // de la pestaña y decían la misma venta que las ideas de abajo. Ahora entran
  // aquí, dentro de "Por vender", y la que ya tiene idea deja de ofrecerse.
  const [rows, setRows] = useState<any[] | null>(null);
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [reuniones, setReuniones] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);   // {} = nueva
  const [reporte, setReporte] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  // Las sugerencias se muestran de a una: son contexto para leer, no una
  // lista para recorrer, y con tres abiertas empujaban las ideas fuera.
  const [verSug, setVerSug] = useState(false);

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

  if (rows === null) return <Cargando texto="Cargando mejoras…" />;

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

  /* ── Sugerencias del sistema ──
     Salen del uso real de la cuenta. La que ya se capturó como idea NO se
     vuelve a ofrecer: se dice cuántas hay abajo y se acabó la duplicación.
     Se ordenan por peso, que es como el motor las prioriza. */
  const senales = computarSenales(co, (subs || []).find((s: any) => s.estado === 'activa'));
  // Cuenta CUALQUIER renglón con ese tipo, incluido el descartado: descartar una
  // sugerencia es un renglón 'descartada' con su senal_tipo —no aparece en
  // ninguna lista— y así "no aplica" también la calla, sin tabla nueva.
  const tiposYaIdea = new Set(rows.filter(m => m.senal_tipo).map(m => m.senal_tipo));
  const sugerencias = senales.filter(s => !tiposYaIdea.has(s.tipo));
  const sugYaEnLista = senales.length - sugerencias.length;

  /* Una sugerencia se vuelve idea con un clic: se guarda con su `senal_tipo`
     para que el motor deje de proponerla. La categoría se deduce de la acción
     —"ofrécele el plugin X" es un plugin— y si no se reconoce, queda como otro. */
  async function adoptarSenal(sn: any) {
    const t = (sn.accion + ' ' + sn.titulo).toLowerCase();
    const categoria = /plugin/.test(t) ? 'plugin'
      : /capacita|video|entrena/.test(t) ? 'capacitacion'
      : /plan|licencia|sucursal|fideliza|automatiza|controla/.test(t) ? 'modulo'
      : 'otro';
    // `guardar` ya avisa y recarga; aquí no se repite el mensaje.
    await guardar({
      titulo: sn.accion.replace(/^ofr[eé]cele\s+/i, '').replace(/\.$/, '').trim().slice(0, 200),
      descripcion: `${sn.titulo}. ${sn.detalle}`,
      estado: 'idea', categoria, senal_tipo: sn.tipo, visible_cliente: true, origen: 'manual',
    });
  }

  /** "No aplica" / "ya la tengo": se guarda un renglón DESCARTADO con el tipo
   *  de la señal. No sale en ninguna lista y el motor deja de proponerla. Es lo
   *  que resuelve las duplicadas viejas, que se capturaron a mano y por eso no
   *  traen `senal_tipo`. */
  async function descartarSenal(sn: any) {
    if (!confirm(`Dejar de sugerir "${sn.titulo}".\n\n¿Es porque ya la tienes en la lista o porque no aplica para este cliente?\n\nEn los dos casos se deja de ofrecer.`)) return;
    await guardar({
      titulo: sn.accion.replace(/^ofr[eé]cele\s+/i, '').replace(/\.$/, '').trim().slice(0, 200),
      descripcion: `Sugerencia descartada: ${sn.titulo}`,
      estado: 'descartada', categoria: 'otro', senal_tipo: sn.tipo, visible_cliente: false, origen: 'manual',
    });
  }

  const potencial = ideas.reduce((a, m) => a + Number(m.valor || 0), 0);
  const ideasSinMonto = ideas.filter(m => !(Number(m.valor) > 0)).length;
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

  /* ── El riel ──
     Tres hitos en el orden en que se trabaja la cuenta: lo que le debes, lo
     que le puedes vender y lo que ya quedó atrás. La línea vertical no es
     adorno: dice que es un recorrido, no tres listas sueltas que compiten.
     Antes eran cuatro bloques del mismo peso —incluido uno de señales que
     repetía lo de abajo— y no había forma de saber por dónde empezar. */
  const Hito = ({ n, titulo, color, resumen, accion, children }: any) => (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      <span style={{
        position: 'absolute', left: -24, top: 4, width: 14, height: 14, borderRadius: 99,
        background: '#fff', border: `3px solid ${color}`, boxSizing: 'border-box',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', color: '#1a1a1a' }}>
          {n} · {titulo}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#a5a2af', marginLeft: 'auto' }}>{resumen}</span>
        {accion}
      </div>
      <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div>
      {/* Lo prometido que ya venció va ARRIBA de todo, antes de las cifras: una
          promesa que no llegó hace más daño que una que nunca se hizo. */}
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

      {/* Las cifras siguen el mismo orden que los hitos. "Sobre la mesa" en $0
          se leía como "no hay nada que vender" cuando lo que falta es capturar
          el monto: si ninguna idea lo tiene, se dice eso en vez de un cero. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 11 }}>
        {[
          ['Por hacer', String(porHacer), estaSemana ? `${estaSemana} vencen esta semana` : 'nada urgente', porHacer ? '#9a6a10' : '#1a1a1a', '#E8A838', false],
          ['Sobre la mesa',
            potencial > 0 ? '~' + money(potencial) : '—',
            potencial > 0
              ? `${ideas.length} idea${ideas.length === 1 ? '' : 's'} sin cerrar`
              : ideas.length ? `${ideasSinMonto} idea${ideasSinMonto === 1 ? '' : 's'} sin monto · no se puede estimar` : 'sin ideas todavía',
            '#2C5FC4', '#7DA6F5', potencial === 0 && ideas.length > 0],
          ['Entregado este año', String(esteAnio), delAnio[0]?.fecha_entrega ? `último el ${fmtDate(delAnio[0].fecha_entrega)}` : 'sin entregas', '#1a1a1a', '#4FBF95', false],
          ['Cobrado', money(cobrado), `${entregadas.filter((m: any) => m.cortesia).length} fueron cortesía`, '#1E8A63', '#4FBF95', false],
        ].map(([l, v, sub, col, franja, ojo]: any) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #eeeef1', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 3, letterSpacing: '-.03em', color: col }}>{v}</div>
            <div style={{ fontSize: '0.66rem', marginTop: 2, lineHeight: 1.35, color: ojo ? '#9a6a10' : '#8a8a8a', fontWeight: ojo ? 600 : 400 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* El reporte sube junto a las cifras: es lo que se le enseña al cliente
          y estaba hasta el fondo, después de tres listas. Una tira, no una
          tarjeta que compita con los hitos. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: 'linear-gradient(135deg,#EEECFE,rgba(244,168,205,.16))',
        border: '1px solid #ddd6fb', borderRadius: 10, padding: '11px 15px', marginBottom: 18,
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#5B4BD6' }}>Reporte ejecutivo</div>
        <div style={{ fontSize: '0.73rem', color: '#6b7280', flex: 1, minWidth: 200, lineHeight: 1.45 }}>
          Junta entregas, capacitaciones y pendientes con lo que SACS sabe de la cuenta.
        </div>
        <button style={{ ...S.btn, flexShrink: 0 }} onClick={() => setReporte(true)}>Generar reporte</button>
      </div>

      <div style={{ position: 'relative', paddingLeft: 26 }}>
        {/* El hilo en el lila del sistema y no en gris: sobre el fondo de la
            ficha un #ececec desaparece y los tres puntos quedan sueltos. */}
        <span style={{ position: 'absolute', left: 7, top: 6, bottom: 24, width: 2, background: '#ddd6fb', borderRadius: 2 }} />

        {/* 1 · Lo que le debes */}
        <Hito n={1} titulo="Por hacer" color="#9B8CFA"
          resumen={porHacer ? `${porHacer} · lo más próximo primero` : 'nada comprometido'}
          accion={<button style={S.btn} onClick={() => setEditando({ estado: 'en_proceso', categoria: 'personalizacion', visible_cliente: true })}>+ Agregar</button>}>
          {porHacer === 0 && (
            <div style={{ color: '#999', fontSize: '0.82rem' }}>
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
        </Hito>

        {/* 2 · Lo que le puedes vender: las sugerencias del sistema y tus ideas
            en la MISMA lista. Eran dos bloques que decían lo mismo. */}
        <Hito n={2} titulo="Por vender" color="#7DA6F5"
          resumen={`${ideas.length} idea${ideas.length === 1 ? '' : 's'}${sugerencias.length ? ` · ${sugerencias.length} sugerencia${sugerencias.length === 1 ? '' : 's'}` : ''}`}
          accion={<button style={S.btn} onClick={() => setEditando({ estado: 'idea', categoria: 'personalizacion' })}>+ Agregar idea</button>}>

          {(sugerencias.length > 0 || sugYaEnLista > 0) && (
            <div style={{ border: '1px dashed #cfe0fa', background: '#E3EDFD', borderRadius: 10, padding: '11px 13px', marginBottom: 10 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#2C5FC4', display: 'flex', alignItems: 'center', gap: 8 }}>
                Sugerencias del sistema · {sugerencias.length}
                {sugerencias.length > 1 && (
                  <button onClick={() => setVerSug(v => !v)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.66rem', fontWeight: 700, color: '#2C5FC4', textDecoration: 'underline', textTransform: 'none', letterSpacing: 0 }}>
                    {verSug ? 'Ver menos' : `Ver ${sugerencias.length - 1} más`}
                  </button>
                )}
              </div>
              {(verSug ? sugerencias : sugerencias.slice(0, 1)).map((sn: any, i: number) => (
                <div key={sn.tipo} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingTop: 9, marginTop: i ? 9 : 0, borderTop: i ? '1px solid #cfe0fa' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.81rem', fontWeight: 700, color: sn.nivel === 'riesgo' ? '#C0554E' : '#241d43' }}>{sn.titulo}</div>
                    <div style={{ fontSize: '0.73rem', color: '#6b7280', marginTop: 2, lineHeight: 1.45 }}>{sn.detalle}</div>
                    <div style={{ fontSize: '0.73rem', color: '#241d43', marginTop: 3 }}><b>{sn.nivel === 'riesgo' ? 'Hacer:' : 'Ofrecerle:'}</b> {sn.accion}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    <button style={S.btnAzul} onClick={() => adoptarSenal(sn)}>Agregar a la lista</button>
                    <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => descartarSenal(sn)} title="Ya la tienes en la lista, o no aplica para este cliente">No sugerirla</button>
                  </div>
                </div>
              ))}
              {sugYaEnLista > 0 && (
                <div style={{ fontSize: '0.7rem', color: '#2C5FC4', paddingTop: 9, marginTop: 9, borderTop: '1px solid #cfe0fa' }}>
                  {sugYaEnLista} sugerencia{sugYaEnLista === 1 ? '' : 's'} más ya {sugYaEnLista === 1 ? 'está' : 'están'} en la lista · no se repite{sugYaEnLista === 1 ? '' : 'n'}
                </div>
              )}
            </div>
          )}

          {ideas.length === 0 && sugerencias.length === 0 && (
            <div style={{ color: '#999', fontSize: '0.82rem' }}>
              Lo que se te ocurra en una junta y le pueda interesar al cliente va aquí. De ahí sale la siguiente venta.
            </div>
          )}
          {ideas.map(m => <Renglon key={m.id} m={m} />)}
        </Hito>

        {/* 3 · Lo que ya quedó atrás. Solo la última: es historia, se consulta.
            La lista completa empujaba fuera de pantalla lo que sí hay que hacer. */}
        <Hito n={3} titulo="Ya entregado" color="#4FBF95"
          resumen={entregadas.length ? `${entregadas.length} en total` : 'sin entregas'}>
          {entregadas.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem' }}>Todavía no se le ha entregado nada a este cliente.</div>}
          {(verTodo ? entregadas : entregadas.slice(0, 1)).map(m => <Renglon key={m.id} m={m} />)}
          {entregadas.length > 1 && (
            <button onClick={() => setVerTodo(v => !v)}
              style={{ width: '100%', marginTop: 10, border: '1px dashed #ececec', background: '#f5f4f8', borderRadius: 10, padding: 9, fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
              {verTodo ? 'Ver solo la última' : `Ver las ${entregadas.length - 1} entregas anteriores`}
            </button>
          )}
        </Hito>
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
    modo: 'junta', url: '', modulo: '', origen: '', ...m,
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

          {/* ── De dónde salió ──
              Antes solo se podía decir "de esta junta" o nada. Lo que el cliente
              pide por WhatsApp entre junta y junta —que es la mitad de lo que se
              promete— no tenía dónde quedar, y por eso se perdía. Elegir una
              junta pone el origen en 'junta' solo. */}
          <div style={{ marginBottom: 10 }}><div style={S.lbl}>¿De dónde salió?</div>
            <select value={f.booking_id ? 'junta' : (f.origen || 'manual')}
              onChange={e => { const v = e.target.value; set('origen', v); if (v !== 'junta') set('booking_id', ''); }}
              style={S.input}>
              {Object.entries(ORIGENES_L).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          {(f.origen === 'junta' || f.booking_id) && (
            <div style={{ marginBottom: 10 }}><div style={S.lbl}>{esCap ? '¿En qué junta se dio?' : '¿De qué junta salió?'}</div>
              <select value={f.booking_id || ''} onChange={e => set('booking_id', e.target.value)} style={S.input}>
                <option value="">Elige la junta…</option>
                {reuniones.map((r: any) => (
                  <option key={r.id} value={r.id}>{fmtDate(r.fecha)} · {r.asunto || r.event_types?.nombre || 'Reunión'}</option>
                ))}
              </select>
            </div>
          )}

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
