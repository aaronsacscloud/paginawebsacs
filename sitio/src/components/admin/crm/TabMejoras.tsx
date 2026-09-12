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
import ReporteEntregas from './ReporteEntregas';
import { MODULOS_SACS, MODOS, modoDe, etiquetaCap } from '../../../lib/crm/modulos-sacs';
import { computarSenales } from '../../../lib/crm/senales';
import { confirmar } from '../../../lib/ui/confirmar';

// Cómo se lee el estado de una cotización dentro de la ficha. En inglés crudo
// ("paid", "sent") el menú obliga a traducir mentalmente cada renglón.
const ESTADO_COT_L: Record<string, string> = {
  draft: 'borrador', sent: 'enviada', accepted: 'aceptada',
  paid: 'pagada', rejected: 'rechazada', expired: 'vencida',
};
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
/* Cómo se lee la etapa del taller desde la ficha del cliente. */
const ETAPAS_TALLER: Record<string, string> = {
  recibida: 'recibida', analisis: 'en análisis', desarrollo: 'en desarrollo', pruebas: 'en pruebas',
  lista: 'lista, esperando tu OK', entregada: 'entregada', devuelta: 'devuelta', espera: 'esperando al cliente', trabada: 'trabada',
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
  // Las cotizaciones de la cuenta, con sus partidas y su monto YA con descuento.
  // Es lo que permite decir "esto se cobró en tal partida" en vez de teclear
  // una cifra que nadie puede verificar después.
  const [cots, setCots] = useState<any[]>([]);
  /* Los reportes que ya se le mandaron, con su seguimiento. Van en la pestaña y
     no dentro del modal a propósito: "se lo mandé el martes y no lo ha abierto"
     es algo que hay que ver AL ENTRAR, no algo que se busca. */
  const [reportes, setReportes] = useState<any[]>([]);
  /* Qué renglones ya están en el taller y cómo van. La ficha del cliente NO se
     llena de campos de ingeniería: solo dice dónde está y para cuándo. */
  const [ligas, setLigas] = useState<Record<string, any>>({});
  const cargarLigas = () => fetch('/api/crm/taller')
    .then(r => r.json()).then(j => setLigas(j.ligas || {})).catch(() => {});
  const cargarReportes = () => fetch('/api/crm/reportes?company_id=' + companyId)
    .then(r => r.json()).then(j => setReportes(j.reportes || [])).catch(() => {});
  const [editando, setEditando] = useState<any>(null);   // {} = nueva
  const [reporte, setReporte] = useState(false);
  const [entregas, setEntregas] = useState(false);
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
    fetch('/api/crm/mejoras/cotizaciones?company_id=' + companyId).then(r => r.json())
      .then(j => { if (alive) setCots(j.cotizaciones || []); }).catch(() => {});
    fetch('/api/crm/reportes?company_id=' + companyId).then(r => r.json())
      .then(j => { if (alive) setReportes(j.reportes || []); }).catch(() => {});
    fetch('/api/crm/taller').then(r => r.json())
      .then(j => { if (alive) setLigas(j.ligas || {}); }).catch(() => {});
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
  /* Mandar al taller: la orden nace con el título, la cuenta, el módulo y el
     cobro del renglón. No se recaptura nada, y de ahí en adelante el renglón
     vive en los dos lados: aquí es lo que el cliente ve, allá es cómo se
     trabaja. */
  async function alTaller(m: any) {
    const r = await fetch('/api/crm/taller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'crear', mejora_id: m.id }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo mandar al taller'); return; }
    await cargarLigas();
    flash('En el taller: ' + (r.ordenes?.[0]?.folio || 'orden creada'));
  }

  async function archivar(m: any) {
    if (!await confirmar(`¿Quitar "${m.titulo}" de la lista?`, { accion: 'Quitar', detalle: 'Se archiva: deja de verse aquí pero no se borra del historial.' })) return;
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
    if (!await confirmar(`Dejar de sugerir "${sn.titulo}".\n\n¿Es porque ya la tienes en la lista o porque no aplica para este cliente?\n\nEn los dos casos se deja de ofrecer.`)) return;
    await guardar({
      titulo: sn.accion.replace(/^ofr[eé]cele\s+/i, '').replace(/\.$/, '').trim().slice(0, 200),
      descripcion: `Sugerencia descartada: ${sn.titulo}`,
      estado: 'descartada', categoria: 'otro', senal_tipo: sn.tipo, visible_cliente: false, origen: 'manual',
    });
  }

  const potencial = ideas.reduce((a, m) => a + Number(m.valor || 0), 0);
  const ideasSinMonto = ideas.filter(m => !(Number(m.valor) > 0)).length;
  const cobrado = entregadas.reduce((a, m) => a + (m.cortesia ? 0 : Number(m.valor || 0)), 0);
  /* ── El dinero de verdad, no el de lo entregado ──
     «Cobrado» sumaba el valor de las mejoras ENTREGADAS. En una cotización que
     se paga en cinco partes mientras el trabajo está en proceso, eso da CERO:
     Ruben's tiene $150,000 cotizados y $30,000 ya en la cuenta, y esta tarjeta
     decía $0. Lo entregado y lo cobrado son dos cosas y hacía falta la
     segunda, que es la que se responde cuando preguntan «¿ya pagó?».
     Se cuentan solo las cotizaciones que cobran alguna mejora de esta cuenta:
     una licencia no es consultoría y aquí no pinta nada. */
  const cotsConMejora = cots.filter((c: any) => (c.partidas || []).some((p: any) => (p.tomada || []).length));
  const cotizado = cotsConMejora.reduce((a: number, c: any) => a + Number(c.total || 0), 0);
  const entrado = cotsConMejora.reduce((a: number, c: any) => a + Number(c.pagado || 0), 0);
  const porEntrar = Math.max(0, cotizado - entrado);
  const ultimoPago = cotsConMejora.map((c: any) => c.ultimo_pago).filter(Boolean).sort().pop() || null;
  /* El acuerdo de pago: lo que el cliente firmó que iba a pagar y cuándo.
     Estaba dentro de la cotización y no salía de ahí — ni en Consultoría, ni
     en Pagos—, así que al abrir la ficha no había forma de saber que ese
     trabajo se está cobrando en cinco partes ni cuándo toca la siguiente. */
  const conPlan = cotsConMejora.filter((c: any) => (c.plan || []).length > 1);
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
          {/* Dónde va en el taller. Es lo único del taller que se asoma aquí:
              ni rebotes, ni SLA, ni quién tardó — eso es interno. */}
          {ligas[m.id] && (
            <div style={{ fontSize: '0.68rem', color: '#5B4BD6', marginTop: 5, fontWeight: 700 }}>
              En el taller · {ligas[m.id].folio} · {ETAPAS_TALLER[ligas[m.id].etapa] || ligas[m.id].etapa}
              {ligas[m.id].fecha_prometida ? ` · para el ${fmtDate(ligas[m.id].fecha_prometida)}` : ' · sin fecha todavía'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
            {m.estado === 'idea' && <button style={S.btnAzul} onClick={() => cotizar(m)}>Cotizar esta idea</button>}
            {!ligas[m.id] && m.estado !== 'entregada' && m.categoria !== 'capacitacion' && (
              <button style={S.btnAzul} onClick={() => alTaller(m)}>Mandar al taller</button>
            )}
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
          ['Cobrado', money(entrado),
            cotizado > 0
              ? (porEntrar > 0
                  ? `de ${money(cotizado)} cotizados · faltan ${money(porEntrar)}`
                  : `${money(cotizado)} cotizados y liquidados`)
                + (ultimoPago ? ` · último el ${fmtDate(ultimoPago)}` : '')
              : `${entregadas.filter((m: any) => m.cortesia).length} fueron cortesía`,
            '#1E8A63', '#4FBF95', cotizado > 0 && entrado === 0],
        ].map(([l, v, sub, col, franja, ojo]: any) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #eeeef1', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 3, letterSpacing: '-.03em', color: col }}>{v}</div>
            <div style={{ fontSize: '0.66rem', marginTop: 2, lineHeight: 1.35, color: ojo ? '#9a6a10' : '#8a8a8a', fontWeight: ojo ? 600 : 400 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── El acuerdo de pago ──
          Una cotización que se paga en parcialidades tiene fechas pactadas.
          Vivían solo dentro del documento: aquí se leen sin abrirlo, y son las
          MISMAS que ve Cobranza —una sola función las calcula—. */}
      {conPlan.map((c: any) => {
        const pagadas = c.plan.filter((x: any) => x.estado === 'pagada').length;
        const prox = c.plan.find((x: any) => x.estado === 'pendiente');
        const vencida = prox?.vencida;
        return (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12,
            background: vencida ? '#FFF9EF' : '#fbfaff',
            border: `1px solid ${vencida ? '#f3dfae' : '#e6ddfa'}`, borderRadius: 10, padding: '11px 15px',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: vencida ? '#9a6a10' : '#6b5fa8' }}>
              Acuerdo de pago
            </div>
            <div style={{ fontSize: '0.79rem', color: '#3f3b4d', flex: 1, minWidth: 220, lineHeight: 1.5 }}>
              <b>{c.numero}</b> · {c.plan.length} parcialidades · {pagadas} pagada{pagadas === 1 ? '' : 's'}
              {prox
                ? <> · {vencida ? <b style={{ color: '#C0554E' }}>vencida</b> : 'la próxima'} <b>{money(prox.monto)}</b> el {fmtDate(prox.fecha)}</>
                : <> · <b style={{ color: '#1E8A63' }}>liquidada</b></>}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8a8590' }}>
              {money(c.pagado)} de {money(c.total)}
            </div>
          </div>
        );
      })}

      {/* Los reportes suben junto a las cifras: son lo que se le enseña al
          cliente y estaban hasta el fondo, después de tres listas.

          Son DOS documentos y no uno con más secciones, porque se mandan en
          momentos distintos: el ejecutivo cuando toca revisar la cuenta, el de
          entregas cuando el cliente pregunta «¿qué me han hecho?». Meterlos en
          el mismo documento obliga a mandar todo o nada. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 11, marginBottom: 18 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'linear-gradient(135deg,#EEECFE,rgba(244,168,205,.16))',
          border: '1px solid #ddd6fb', borderRadius: 10, padding: '11px 15px',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#5B4BD6' }}>Reporte ejecutivo</div>
          <button style={{ ...S.btn, flexShrink: 0, marginLeft: 'auto' }} onClick={() => setReporte(true)}>Generar</button>
          <div style={{ fontSize: '0.73rem', color: '#6b7280', flexBasis: '100%', lineHeight: 1.45 }}>
            Entregas, capacitaciones, soporte y pendientes con lo que SACS sabe de la cuenta.
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'linear-gradient(135deg,#EAF8F2,rgba(125,166,245,.14))',
          border: '1px solid #cfe9d9', borderRadius: 10, padding: '11px 15px',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1E8A63' }}>Reporte de entregas</div>
          <button style={{ ...S.btn, flexShrink: 0, marginLeft: 'auto', background: '#1E8A63' }} onClick={() => setEntregas(true)}>Generar</button>
          <div style={{ fontSize: '0.73rem', color: '#6b7280', flexBasis: '100%', lineHeight: 1.45 }}>
            Solo lo entregado, con el <b>video</b> de cada mejora. Para justificar el trabajo.
          </div>
        </div>
      </div>

      <SeguimientoReportes reportes={reportes} flash={flash} recargar={cargarReportes} />

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

      {editando && <EditorMejora m={editando} reuniones={reuniones} cots={cots} onCerrar={() => setEditando(null)} onGuardar={guardar} />}
      {reporte && <ReporteMejoras companyId={companyId} cliente={cliente}
        onCerrar={() => { setReporte(false); cargarReportes(); }} />}
      {entregas && <ReporteEntregas companyId={companyId} cliente={cliente}
        onCerrar={() => { setEntregas(false); cargarReportes(); }} />}
    </div>
  );
}

/* ─────────── Seguimiento de los reportes enviados ───────────
   La pregunta que contesta este bloque no es "qué le mandé" sino "¿lo leyó?".
   Por eso el estado manda sobre el folio: un reporte enviado hace seis días y
   sin abrir es una llamada pendiente, y eso tiene que verse sin abrir nada.

   Los tres estados que importan:
     · generado y sin mandar  → falta el paso que sirve
     · mandado y sin abrir    → con los días encima, porque a los 3 ya urge
     · abierto                → cuántas veces y cuánto tiempo le dedicó

   El tiempo es la diferencia entre "lo abrió" y "lo leyó": treinta segundos es
   un vistazo, cuatro minutos es que se lo tomó en serio y hay de qué hablar. */
function SeguimientoReportes({ reportes, flash, recargar }: any) {
  const [busy, setBusy] = useState('');
  if (!reportes?.length) return null;

  const dias = (d?: string | null) => d == null ? null
    : Math.floor((Date.now() - Date.parse(d)) / 86400000);
  const hace = (d?: string | null) => {
    const n = dias(d);
    if (n == null) return '';
    if (n === 0) return 'hoy';
    if (n === 1) return 'ayer';
    return `hace ${n} días`;
  };
  const tiempo = (seg: number) => {
    if (!seg) return null;
    if (seg < 60) return `${seg} s`;
    return `${Math.round(seg / 60)} min`;
  };

  async function reenviar(r: any) {
    setBusy(r.id);
    const j = await fetch('/api/crm/reportes/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!j || j.error) { flash(j?.error || 'No se pudo enviar'); return; }
    flash(`Enviado a ${j.para}`);
    recargar();
  }
  async function copiar(r: any) {
    const liga = `${window.location.origin}/reporte/${r.id}`;
    try { await navigator.clipboard.writeText(liga); flash('Liga copiada'); }
    catch { flash(liga); }
  }

  const REACC: Record<string, { t: string; bg: string; fg: string }> = {
    si: { t: 'Le sirvió', bg: '#EAF8F2', fg: '#1E8A63' },
    mas: { t: 'Quiere más detalle', bg: '#EEECFE', fg: '#5B4BD6' },
    dudas: { t: 'Tiene dudas', bg: '#FFF4E5', fg: '#9a6a10' },
  };

  return (
    <div style={{ border: '1px solid #ececec', borderRadius: 11, marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ padding: '9px 15px', background: '#faf9fd', borderBottom: '1px solid #f1eff7', fontSize: '0.63rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8f8d98' }}>
        Reportes que le mandaste
      </div>
      {reportes.map((r: any) => {
        const abierto = r.vistas > 0;
        const enviado = !!r.enviado_at;
        const sinAbrir = enviado && !abierto;
        const d = sinAbrir ? dias(r.enviado_at) : null;
        // A los 3 días sin abrir deja de ser dato y pasa a ser pendiente.
        const urge = sinAbrir && (d ?? 0) >= 3;
        const rc = r.reaccion ? REACC[r.reaccion] : null;
        return (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 15px', borderTop: '1px solid #f7f6fa', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap',
              background: abierto ? '#EAF8F2' : urge ? '#FEF0EF' : enviado ? '#FFF4E5' : '#f4f3f6',
              color: abierto ? '#1E8A63' : urge ? '#C0554E' : enviado ? '#9a6a10' : '#6b6b74',
            }}>
              {abierto ? 'Abierto' : urge ? `Sin abrir · ${d} días` : enviado ? 'Sin abrir' : 'Sin enviar'}
            </span>

            <span style={{ flex: 1, minWidth: 170, fontSize: '0.79rem' }}>
              <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: r.tipo === 'entregas' ? '#1E8A63' : '#5B4BD6' }}>{r.folio}</b>
              {/* Qué documento es. Con los dos tipos en la misma lista, un
                  folio suelto no dice si lo que se le mandó fue el reporte de
                  la cuenta o el de sus entregas — y se reenvía el equivocado. */}
              {r.tipo === 'entregas' && (
                <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '2px 7px', marginLeft: 5, background: '#EAF8F2', color: '#1E8A63' }}>entregas</span>
              )}
              <span style={{ color: '#8f8d98' }}> · {fmtDate(r.desde)} al {fmtDate(r.hasta)}</span>
              {/* Los tres estados NO son excluyentes: una liga se puede abrir
                  sin haberla mandado por correo —se pega en WhatsApp— y
                  entonces se pintaban las dos frases juntas y contradictorias
                  ("todavía no se lo mandas" y "lo abrió 2 veces"). Que lo haya
                  abierto manda sobre todo lo demás. */}
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#a5a2af', marginTop: 2 }}>
                {abierto ? <>
                  {r.vistas === 1 ? 'Lo abrió una vez' : `Lo abrió ${r.vistas} veces`}
                  {r.ultima_vista_at ? `, la última ${hace(r.ultima_vista_at)}` : ''}
                  {tiempo(r.segundos) ? ` · ${tiempo(r.segundos)} de lectura` : ''}
                  {!enviado && ' · por liga, no por correo'}
                </> : enviado
                  ? `Enviado ${hace(r.enviado_at)} a ${r.enviado_a}.`
                  : 'Generado, todavía no se lo mandas.'}
              </span>
            </span>

            {rc && <span style={{ fontSize: '0.62rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', background: rc.bg, color: rc.fg, whiteSpace: 'nowrap' }}>{rc.t}</span>}

            <button style={{ ...S.btnG, padding: '5px 10px', fontSize: '0.71rem' }} onClick={() => copiar(r)}>Copiar liga</button>
            <a style={{ ...S.btnG, padding: '5px 10px', fontSize: '0.71rem', textDecoration: 'none', display: 'inline-block' }}
               href={`/reporte/${r.id}`} target="_blank" rel="noreferrer">Ver</a>
            <button style={{ ...(urge ? S.btn : S.btnG), padding: '5px 10px', fontSize: '0.71rem' }}
                    disabled={busy === r.id} onClick={() => reenviar(r)}>
              {busy === r.id ? 'Enviando…' : enviado ? 'Reenviar' : 'Enviar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function EditorMejora({ m, reuniones, cots = [], onCerrar, onGuardar }: any) {
  const [f, setF] = useState<any>({
    titulo: '', descripcion: '', estado: 'idea', categoria: 'personalizacion',
    valor: 0, cortesia: false, visible_cliente: true, booking_id: '', fecha_entrega: '', fecha_compromiso: '',
    modo: 'junta', url: '', modulo: '', origen: '', quote_id: '', quote_item: '', ...m,
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

          {/* ── El video de la entrega ──
              Es lo que el cliente abre desde el REPORTE DE ENTREGAS para ver
              funcionando lo que pidió, y es lo que convierte ese documento en
              algo que se puede defender: sin video es una lista de frases.

              La columna `url` existía desde las capacitaciones, pero el campo
              solo se pintaba si el tipo era «capacitación» Y el modo era
              «video» — dos condiciones que casi nunca se daban juntas, y por
              eso de las 56 mejoras entregadas del CRM ninguna tenía liga.
              Ahora se pide en cualquier entrega, y en cualquier momento: al
              capturarla o después, volviendo a Editar. Sin liga, la entrega
              sale igual en el reporte, solo que sin video.

              En capacitaciones NO se repite: ahí arriba ya hay un campo de
              liga que además decide el estado («enviada» vs «pendiente de
              enviar»), y dos cajas para la misma columna es como acaban
              pisándose. */}
          {!esCap && (
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Video de la entrega (opcional)</div>
              <input value={f.url || ''} onChange={e => set('url', e.target.value)}
                placeholder="https://…  Loom, Drive, YouTube o el que uses" style={S.input} />
              <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4, lineHeight: 1.45 }}>
                {/^https?:\/\//i.test(String(f.url || '').trim())
                  ? 'Listo: el cliente lo va a poder abrir desde el reporte de entregas.'
                  : String(f.url || '').trim()
                    ? 'Tiene que empezar con https:// o el reporte no lo va a enseñar.'
                    : 'Se le enseña al cliente en el reporte de entregas. Puedes pegarlo después.'}
              </div>
            </div>
          )}

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

          {/* ── ¿Ya se cobró? ──
              El dinero de una entrega no se teclea: sale de la partida que se
              le cotizó. Elegirla llena el monto con lo que REALMENTE entró —el
              de lista menos el descuento global de la cotización— y deja el
              rastro de dónde salió, que es lo que se puede defender frente al
              cliente seis meses después. */}
          {!esCap && !esPend && cots.length > 0 && (
            <div style={{ border: '1px solid #ececec', borderRadius: 10, padding: '10px 11px', marginBottom: 10, background: '#faf9fd' }}>
              <div style={S.lbl}>¿Se cotizó?</div>
              <select value={f.quote_id || ''} style={S.input}
                onChange={e => { set('quote_id', e.target.value); set('quote_item', ''); }}>
                <option value="">— todavía no se cotiza —</option>
                {cots.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.numero || 'Cotización'} · {ESTADO_COT_L[c.estado] || c.estado}{c.pagado_fecha ? ` ${fmtDate(c.pagado_fecha)}` : ''} · {money(c.total)}
                  </option>
                ))}
              </select>
              {(() => {
                const cot = cots.find((c: any) => c.id === f.quote_id);
                if (!cot) return null;
                if (!cot.partidas.length) return <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 6 }}>Esta cotización no tiene partidas con monto; captura el importe abajo.</div>;
                const sel = cot.partidas.find((x: any) => x.clave === f.quote_item);
                // "Ya tomada" = otra entrega de ESTA cuenta cuelga de la misma
                // partida. Si las dos se llevan el monto completo, el cliente
                // aparece pagando el doble por un solo cobro.
                const otras = sel ? sel.tomada.filter((t: any) => t.id !== m.id) : [];
                return (<>
                  <div style={{ ...S.lbl, marginTop: 9 }}>¿Qué se le cobró de esta cotización?</div>
                  {cot.partidas.map((it: any) => {
                    const on = f.quote_item === it.clave;
                    const ocupada = it.tomada.filter((t: any) => t.id !== m.id);
                    return (
                      <button key={it.clave} type="button"
                        onClick={() => { set('quote_item', it.clave); set('valor', it.neto); set('cortesia', false); }}
                        style={{
                          width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer',
                          border: `1px solid ${on ? '#9B8CFA' : '#e6e3ef'}`, background: on ? '#f3f0ff' : '#fff',
                          borderRadius: 9, padding: '7px 10px', marginBottom: 5, display: 'flex', gap: 9, alignItems: 'center',
                          boxShadow: on ? '0 0 0 2px #EEECFE' : 'none',
                        }}>
                        <span style={{ width: 13, height: 13, borderRadius: '50%', flex: 'none', border: `1.5px solid ${on ? '#5B4BD6' : '#c8c1e4'}`, background: on ? '#5B4BD6' : 'transparent', boxShadow: on ? 'inset 0 0 0 2.5px #fff' : 'none' }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.79rem' }}>
                          {it.nombre}
                          {ocupada.length > 0 && <small style={{ display: 'block', fontSize: '0.66rem', color: '#9a6a10', fontWeight: 700 }}>ya la usa «{ocupada[0].titulo}»</small>}
                        </span>
                        <span style={{ textAlign: 'right', flex: 'none' }}>
                          <span style={{ display: 'block', fontWeight: 800, color: '#5B4BD6', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>{money(it.neto)}</span>
                          {it.neto !== it.lista && <span style={{ fontSize: '0.66rem', color: '#a5a2af', textDecoration: 'line-through' }}>{money(it.lista)}</span>}
                        </span>
                      </button>
                    );
                  })}
                  {cot.descuento > 0 && (
                    <div style={{ fontSize: '0.67rem', color: '#a5a2af', lineHeight: 1.45 }}>
                      Los montos ya traen el <b>{cot.descuento}% de descuento</b> de la cotización: es lo que realmente entró. Tachado, el precio de lista.
                    </div>
                  )}
                  {otras.length > 0 && (
                    <div style={{ borderLeft: '3px solid #E8A838', background: '#FFF4E5', borderRadius: '0 8px 8px 0', padding: '8px 10px', fontSize: '0.73rem', color: '#5b5570', marginTop: 7 }}>
                      <b>Esa partida ya está tomada.</b> «{otras[0].titulo}» también salió de ahí. Son dos entregas de un solo cobro de {money(sel.neto)}.
                      <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => set('valor', Math.round(sel.neto / (otras.length + 1)))}
                          style={{ fontFamily: 'inherit', fontSize: '0.71rem', fontWeight: 700, borderRadius: 7, padding: '5px 9px', cursor: 'pointer', border: '1px solid #E8A838', background: '#fff', color: '#9a6a10' }}>
                          Repartir {money(Math.round(sel.neto / (otras.length + 1)))} a cada una
                        </button>
                        <button type="button" onClick={() => set('valor', 0)}
                          style={{ fontFamily: 'inherit', fontSize: '0.71rem', fontWeight: 700, borderRadius: 7, padding: '5px 9px', cursor: 'pointer', border: '1px solid #E8A838', background: '#fff', color: '#9a6a10' }}>
                          Esta va incluida ($0)
                        </button>
                      </div>
                    </div>
                  )}
                </>);
              })()}
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
