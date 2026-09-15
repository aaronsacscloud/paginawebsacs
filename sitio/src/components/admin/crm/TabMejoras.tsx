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
import OrdenDelTaller, { ETAPAS_TALLER } from './taller/OrdenDelTaller';

// Cómo se lee el estado de una cotización dentro de la ficha. En inglés crudo
// ("paid", "sent") el menú obliga a traducir mentalmente cada renglón.
const ESTADO_COT_L: Record<string, string> = {
  draft: 'borrador', sent: 'enviada', accepted: 'aceptada',
  paid: 'pagada', rejected: 'rechazada', expired: 'vencida',
};
const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '';

const ESTADOS: Record<string, { label: string; punto: string; tag?: string; tagBg?: string; tagTx?: string }> = {
  idea:       { label: 'Idea',        punto: '#EFA6CA' },
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
  plugin:          { label: 'plugin',          bg: 'rgba(244,168,205,.22)', fg: '#9c3d70' },
  modulo:          { label: 'módulo',          bg: '#EAF8F2', fg: '#1E8A63' },
  ajuste:          { label: 'ajuste',          bg: '#F4F4F6', fg: '#6B7280' },
  otro:            { label: 'otro',            bg: '#F4F4F6', fg: '#6B7280' },
};
const cat = (k: string) => CATS_COLOR[k] || CATS_COLOR.otro;

/* La categoría de una partida de cotización traducida a las de una entrega.
   Son dos vocabularios distintos —el de lo que se cobra y el de lo que se
   hace— y sin traducirlos el formulario abriría en «personalización» un
   plugin, que es justo el error que la captura a mano ya cometía. */
const catDePartida = (it: any): string => {
  if (/capacitaci/i.test(String(it?.nombre || ''))) return 'capacitacion';
  if (it?.categoria === 'plugin') return 'plugin';
  if (it?.categoria === 'partner') return 'otro';
  return 'personalizacion';
};
// De dónde nació el compromiso. Mismo vocabulario que la vista global.
const ORIGENES_L: Record<string, string> = {
  junta: 'De una junta', whatsapp: 'De WhatsApp', soporte: 'De soporte',
  llamada: 'De una llamada', manual: 'Capturado a mano',
};
const CATS: Record<string, string> = Object.fromEntries(Object.entries(CATS_COLOR).map(([k, v]) => [k, v.label]));

const S = {
  card: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  cardA: { background: '#fff', border: '1.5px solid #f3cadb', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  h: { fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as const,
  nota: { marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  btn: { padding: '7px 13px', border: 'none', borderRadius: 9, fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff', fontFamily: 'inherit' } as const,
  // Secundario del sistema: borde y letra MORADOS. Era azul, y el azul es un
  // color de dato —no un botón—: metía un tercer acento contra el morado.
  btnAzul: { padding: '5px 11px', border: '1.5px solid #9B8CFA', borderRadius: 9, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#5B4BD6', fontFamily: 'inherit' } as const,
  btnG: { padding: '5px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
  input: { padding: '8px 11px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.79rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fdfcff', fontFamily: 'inherit' } as const,
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  /* El mismo juego que usa el Taller de la cuenta. Lo que NO puede pasar es que
     los valores difieran: son dos pantallas hermanas y una anatomía. */
  kpi: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '14px 16px' } as const,
  kl: { fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.08em' } as const,
  kv: { fontSize: '1.375rem', fontWeight: 800, marginTop: 4, letterSpacing: '-.01em', lineHeight: 1.15 } as const,
  ks: { fontSize: '0.6875rem', color: '#888', marginTop: 2, lineHeight: 1.45 } as const,
  fila: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #f1f0f4', flexWrap: 'wrap' as const } as const,
  franja: { flex: '0 0 3px', alignSelf: 'stretch' as const, minHeight: 26, borderRadius: 99 } as const,
  grupo: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: '#999', margin: '16px 0 2px', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' as const } as const,
  grupoC: { color: '#c2bfcc', fontWeight: 600, letterSpacing: 0, textTransform: 'none' as const, fontSize: '0.7rem' } as const,
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums' as const } as const,
  mas: { width: '100%', marginTop: 10, border: '1px dashed #e6e4ec', background: '#fff', borderRadius: 10, padding: 9, fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' } as const,
  vacio: { color: '#999', fontSize: '0.82rem', padding: '14px 0', lineHeight: 1.55 } as const,
};

/* Ninguna lista pasa de tres renglones sin pedirlo. Es lo que hace que una
   cuenta con 58 ideas —Rubens— se lea igual que una con tres. */
const TOPE = 3;

export default function TabMejoras({ companyId, cliente, flash, co, subs = [], irATaller }: any) {
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
  /* Quién puede recibir una orden, para poder asignarla desde aquí. */
  const [equipoTaller, setEquipoTaller] = useState<any[]>([]);
  /* La orden que se está editando SIN salir de la ficha. Lo del taller vivía
     solo en el otro módulo: para mover una fecha había que salir, buscar el
     folio y volver — y por eso las fechas no se movían, se dejaban vencer. */
  const [orden, setOrden] = useState<any>(null);
  const cargarLigas = () => fetch('/api/crm/taller')
    .then(r => r.json()).then(j => { setLigas(j.ligas || {}); setEquipoTaller(j.equipo || []); }).catch(() => {});
  const cargarReportes = () => fetch('/api/crm/reportes?company_id=' + companyId)
    .then(r => r.json()).then(j => setReportes(j.reportes || [])).catch(() => {});
  const [editando, setEditando] = useState<any>(null);
  /* Qué renglón tiene abierto su menú de acciones secundarias, y cuál se está
     convirtiendo en oportunidad (con su monto a medio escribir). */
  const [menu, setMenu] = useState<string | null>(null);
  const [aOportunidad, setAOportunidad] = useState<any>(null);   // {} = nueva
  const [reporte, setReporte] = useState(false);
  const [entregas, setEntregas] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  // Las sugerencias se muestran de a una: son contexto para leer, no una
  // lista para recorrer, y con tres abiertas empujaban las ideas fuera.
  const [verSug, setVerSug] = useState(false);
  /* Qué carril se está viendo. Arranca en «por vender» porque es el único que
     crece solo; lo demás se atiende cuando su número lo pide, y ese número ya
     está en su tarjeta. */
  const [carril, setCarril] = useState<'vender' | 'tuyo' | 'taller' | 'entregado'>('vender');
  const [verTodoIdeas, setVerTodoIdeas] = useState(false);

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
      .then(j => { if (alive) { setLigas(j.ligas || {}); setEquipoTaller(j.equipo || []); } }).catch(() => {});
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
    // Y se abre de una vez para ponerle fecha y criterio. Dejarlo para después
    // es exactamente como nacen las órdenes sin fecha, que son las que rebotan.
    const nueva = r.ordenes?.[0];
    if (nueva) { setMenu(null); abrirOrden(nueva.id); }
  }

  /* La orden completa, para editarla desde aquí. La liga que ya se tiene solo
     trae folio, etapa y fecha: los criterios y el responsable hay que pedirlos. */
  async function abrirOrden(id: string) {
    setOrden({ cargando: true });
    const r = await fetch('/api/crm/taller?id=' + id).then(x => x.json()).catch(() => null);
    if (!r || r.error || !r.orden) { setOrden(null); flash(r?.error || 'No se pudo abrir la orden'); return; }
    setOrden(r.orden);
  }

  async function guardarOrden(cambios: any) {
    const r = await fetch('/api/crm/taller', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orden.id, ...cambios }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo guardar la orden'); return false; }
    setOrden(null);
    await cargarLigas();
    flash('Orden actualizada · el taller ya lo ve');
    return true;
  }

  /* ══ DE IDEA A OPORTUNIDAD ══
     La diferencia no es de palabra: una IDEA es «se puede vender algún día» y
     no entra al pronóstico; una OPORTUNIDAD es «lo quiere y cuesta tanto», con
     monto y fecha, y sí entra. Por eso convertir EXIGE monto: sin él, el
     pipeline mentiría. La fila no se duplica — nace un trato y la mejora se
     queda ligada a él. */
  async function volverOportunidad() {
    const o = aOportunidad; if (!o) return;
    const monto = Math.round(Number(o.valor) || 0);
    if (!monto) { flash('Ponle el monto estimado: sin monto es una idea, no una oportunidad'); return; }
    const d = await fetch('/api/crm/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: o.titulo, company_id: companyId, valor_total: monto, valor_unico: monto,
        stage: 'calificacion', origen: 'consultoria',
        fecha_cierre_esperada: o.fecha || null,
        descripcion: 'Salió de una idea de consultoría',
      }),
    }).then(x => x.json()).catch(() => null);
    if (!d || d.error || !d.deal?.id && !d.id) { flash(d?.error || 'No se pudo crear la oportunidad'); return; }
    const dealId = d.deal?.id || d.id;
    await fetch('/api/crm/mejoras', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, deal_id: dealId, valor: monto }),
    }).catch(() => {});
    setAOportunidad(null); setMenu(null); cargar();
    flash('Ahora es una oportunidad de ' + money(monto));
  }

  /* Descartar NO es borrar: la fila se queda con su motivo, y el motivo es lo
     que evita volver a proponer lo mismo dentro de tres meses. */
  async function descartar(m: any) {
    if (!await confirmar(`¿Descartar "${m.titulo}"?`, { accion: 'Descartar', detalle: 'Sale de la lista pero se conserva con su historia, para no volver a proponerla.' })) return;
    await fetch('/api/crm/mejoras', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, estado: 'descartada' }),
    }).catch(() => {});
    setMenu(null); cargar(); flash('Descartada');
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

  /* Las dos listas que el dueño pidió separar. Una IDEA es lo que se puede
     vender; una OPORTUNIDAD ya tiene monto y trato, y es la única que entra al
     pronóstico. Y la que YA se cotizó sale de las dos: cambia de carril y
     abajo queda su rastro — una lista de ideas llena de cosas ya vendidas deja
     de servir para trabajar. */
  const ideas = rows.filter(m => m.estado === 'idea' && !m.deal_id && !m.quote_id);
  const oportunidades = rows.filter(m => m.estado === 'idea' && m.deal_id && !m.quote_id);
  const yaCotizadas = rows.filter(m => m.quote_id && m.estado !== 'entregada');
  const entregadas = rows.filter(m => m.estado === 'entregada');
  /* La OBRA ya no vive aquí: se fue a la pestaña Taller de la cuenta.
     Medido el día que se partió: 74 ideas abiertas contra 9 compromisos reales
     en todo el CRM, y una cuenta con 58 ideas y un solo compromiso. Una lista
     de uno a tres renglones no sobrevive debajo de una de cincuenta y ocho —y
     así fue como tres cosas prometidas para el 19 de agosto llevaban 26 días
     vencidas sin que nadie lo notara.
     Lo que SÍ se queda es lo que hace el consultor: las capacitaciones, los
     videos y los pendientes sueltos. Mandarlos a desarrollo le mete ruido a un
     tablero de ingeniería y le quita a Consultoría lo único suyo que era una
     tarea. */
  const enObra = rows.filter(m => abierto(m) && ['personalizacion', 'plugin', 'modulo', 'ajuste'].includes(m.categoria));
  const grupos = [
    { k: 'video', l: 'Videos por enviar', filas: rows.filter(m => abierto(m) && m.categoria === 'capacitacion' && modoDe(m) === 'video').sort(porFecha) },
    { k: 'cap', l: 'Capacitaciones programadas', filas: rows.filter(m => abierto(m) && m.categoria === 'capacitacion' && modoDe(m) !== 'video').sort(porFecha) },
    { k: 'pend', l: 'Otros pendientes', filas: rows.filter(m => abierto(m) && ['pendiente', 'otro'].includes(m.categoria)).sort(porFecha) },
  ].filter(g => g.filas.length);
  const porHacer = grupos.reduce((a, g) => a + g.filas.length, 0);

  const hoyISO = new Date().toISOString().slice(0, 10);
  /* Cuánto se pasó lo que se está construyendo. La fecha que vale es la que el
     taller prometió; si todavía no la puso, la que se le dijo al cliente —
     porque contra ESA se llega tarde. */
  const diasDe = (d: string) => Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);
  const fechaObra = (m: any) => ligas[m.id]?.fecha_prometida || m.fecha_compromiso || null;
  const obraTarde = Math.max(0, ...enObra.map(m => { const f = fechaObra(m); return f && f < hoyISO ? diasDe(f) : 0; }));
  const obraSinFecha = enObra.filter(m => !fechaObra(m)).length;
  const CARRILES = [
    { k: 'vender' as const,    l: 'Por vender',   n: ideas.length + oportunidades.length },
    { k: 'tuyo' as const,      l: 'Lo tuyo',      n: porHacer },
    { k: 'taller' as const,    l: 'En el taller', n: enObra.length },
    { k: 'entregado' as const, l: 'Ya entregado', n: entregadas.length },
  ];
  const enObraIds = new Set(enObra.map(m => m.id));
  const vencidasTuyas = vencidas.filter((v: any) => !enObraIds.has(v.id));
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

     Qué cotizaciones entran: TODAS las de la cuenta que cobren trabajo, se
     haya ligado una entrega a mano o no. Antes se exigía esa liga y por eso
     Vende Tu Closet —que pagó $49,450 de una implementación el 7 de
     septiembre— reportaba $0: nadie había capturado la entrega todavía. Medido
     en producción, ese requisito escondía $118,632 ya cobrados en 3 cuentas.

     Y entra solo la PARTE DE TRABAJO de cada una (`trabajo` / `trabajo_pagado`,
     calculadas en el endpoint): una licencia no es consultoría y aquí no pinta
     nada, así que una cotización mezclada aporta su porción y nada más. */
  const cotsTrabajo = cots.filter((c: any) =>
    Number(c.trabajo || 0) > 0 &&
    // Una rechazada o vencida SIN dinero encima ya no está sobre la mesa; con
    // abonos sí cuenta, porque ese dinero entró pase lo que pase.
    (Number(c.trabajo_pagado || 0) > 0 || !['rejected', 'expired'].includes(c.estado)));
  const cotizado = cotsTrabajo.reduce((a: number, c: any) => a + Number(c.trabajo || 0), 0);
  const entrado = cotsTrabajo.reduce((a: number, c: any) => a + Number(c.trabajo_pagado || 0), 0);
  const porEntrar = Math.max(0, cotizado - entrado);
  const ultimoPago = cotsTrabajo.filter((c: any) => Number(c.trabajo_pagado || 0) > 0)
    .map((c: any) => c.ultimo_pago).filter(Boolean).sort().pop() || null;

  /* Trabajo que el cliente YA está pagando y que no tiene su renglón en «Ya
     entregado». No es un descuido menor: el reporte de entregas —el documento
     con el que se le justifica el trabajo al cliente— se arma de esos
     renglones, así que sin ellos sale vacío aunque lleve medio proyecto
     pagado. Se ofrece capturarla con la partida y el monto ya puestos. */
  const sinRegistrar = cotsTrabajo
    .filter((c: any) => Number(c.pagado || 0) > 0)
    .flatMap((c: any) => (c.partidas || [])
      .filter((it: any) => it.categoria !== 'plan' && !(it.tomada || []).length)
      .map((it: any) => ({ cot: c, it })));
  /* El acuerdo de pago: lo que el cliente firmó que iba a pagar y cuándo.
     Estaba dentro de la cotización y no salía de ahí — ni en Consultoría, ni
     en Pagos—, así que al abrir la ficha no había forma de saber que ese
     trabajo se está cobrando en cinco partes ni cuándo toca la siguiente. */
  const conPlan = cotsTrabajo.filter((c: any) => (c.plan || []).length > 1);
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
            <div style={{ fontSize: '0.68rem', marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#5B4BD6', fontWeight: 700 }}>
                En el taller · {ligas[m.id].folio} · {ETAPAS_TALLER[ligas[m.id].etapa] || ligas[m.id].etapa}
                {ligas[m.id].fecha_prometida
                  ? ` · para el ${fmtDate(ligas[m.id].fecha_prometida)}`
                  : ''}
              </span>
              {!ligas[m.id].fecha_prometida && (
                <span style={{ color: '#9a6a10', fontWeight: 700 }}>sin fecha: el taller no la puede arrancar</span>
              )}
              {/* Se edita AQUÍ. Lo interno del taller —rebotes, SLA, quién
                  tardó— sigue sin asomarse: lo que se toca desde la ficha es lo
                  que le prometiste al cliente. */}
              <button onClick={() => abrirOrden(ligas[m.id].id)}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 800, color: '#9c3d70', textDecoration: 'underline' }}>
                editar la orden
              </button>
            </div>
          )}
          {/* ══ UNA SOLA ACCIÓN PRINCIPAL ══
              Había SEIS botones del mismo peso en cada renglón y ninguno
              mandaba: cotizar, mandar al taller, marcar entregada, en proceso,
              editar y quitar, todos igual de grandes. Ahora manda la que
              corresponde al carril donde está la fila —en una idea, cotizar— y
              las demás viven detrás del «···». */}
          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {m.estado === 'idea'
              ? <button style={S.btnAzul} onClick={() => cotizar(m)}>Cotizar</button>
              : m.estado !== 'entregada'
                ? <button style={S.btnAzul} onClick={() => cambiarEstado(m, 'entregada')}>
                    {m.categoria === 'capacitacion' ? (modoDe(m) === 'video' ? 'Marcar enviado' : 'Marcar impartida') : m.categoria === 'pendiente' ? 'Marcar hecho' : 'Marcar entregada'}
                  </button>
                : null}
            <button style={{ ...S.btnG, color: '#8b8698', padding: '5px 10px' }}
              onClick={() => setMenu(menu === m.id ? null : m.id)} title="Más acciones">···</button>
          </div>
          {menu === m.id && (
            <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap', padding: '9px 10px', background: '#FBFAFE', border: '1px solid #f0edf8', borderRadius: 10 }}>
              {m.estado === 'idea' && !m.deal_id && (
                <button style={S.btnG} onClick={() => setAOportunidad({ id: m.id, titulo: m.titulo, valor: m.valor || '' })}>Volverla oportunidad</button>
              )}
              {!ligas[m.id] && m.estado !== 'entregada' && m.categoria !== 'capacitacion' && (
                <button style={S.btnG} onClick={() => alTaller(m)}>Mandar al taller</button>
              )}
              {m.estado === 'idea' && <button style={S.btnG} onClick={() => cambiarEstado(m, 'en_proceso')}>En proceso</button>}
              {m.estado !== 'entregada' && m.estado !== 'idea' && (
                <button style={S.btnG} onClick={() => cotizar(m)}>Cotizar</button>
              )}
              <button style={S.btnG} onClick={() => setEditando(m)}>Editar</button>
              <button style={{ ...S.btnG, color: '#C0554E' }} onClick={() => descartar(m)}>Descartar</button>
              <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => archivar(m)}>Quitar</button>
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, whiteSpace: 'nowrap', color: m.cortesia ? '#a5a2af' : m.estado === 'entregada' ? '#1E8A63' : '#5B4BD6' }}>
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
      {/* Lo prometido que ya venció va ARRIBA de todo, antes de las cifras: una
          promesa que no llegó hace más daño que una que nunca se hizo. */}
      {/* El aviso de arriba solo cuenta LO TUYO. Lo que está en el taller ya se
          avisa en el puente del hito 1 con su propia pastilla, y decirlo dos
          veces en la misma pantalla —arriba en rojo y abajo otra vez— hace que
          se deje de leer. */}
      {vencidasTuyas.length > 0 && (
        <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '11px 13px', marginBottom: 12, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>⚠️</span>
          <div style={{ fontSize: '0.79rem', color: '#C0554E', lineHeight: 1.6 }}>
            <b style={{ color: '#8c2f28' }}>{vencidasTuyas.length} {vencidasTuyas.length === 1 ? 'cosa comprometida se pasó de fecha' : 'cosas comprometidas se pasaron de fecha'}.</b>
            {vencidasTuyas.map((v: any) => (
              <div key={v.id}>{v.titulo} · se prometió para el {fmtDate(v.fecha_compromiso)}, {v.dias} {v.dias === 1 ? 'día' : 'días'} tarde</div>
            ))}
          </div>
        </div>
      )}
      {/* ══════ EL MISMO ESQUELETO QUE EL TALLER ══════
          Esta pestaña había acumulado cinco formas distintas de encerrar
          información: la tarjeta del dinero, una tira de cifras sueltas SIN
          tarjeta, un bloque gris de reportes, un riel con una tarjeta por hito
          y, dentro del segundo hito, otra tarjeta para las sugerencias. Tres
          niveles de anidamiento y ninguno es el del resto del CRM.

          Ahora es lo mismo que el Taller: fila de tarjetas arriba, un segmento
          que filtra, y renglones planos. Una tarjeta = una cosa.

          Y el carril se elige: con 58 ideas abiertas en una sola cuenta —el
          caso real de Rubens— cualquier diseño que las muestre todas junto a
          lo demás se ahoga. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ ...S.kpi, borderLeft: '3px solid #4FBF95' }}>
          <div style={S.kl}>Cobrado de trabajo</div>
          <div style={{ ...S.kv, color: entrado ? '#1E8A63' : '#c2bfcc' }}>{money(entrado)}</div>
          <div style={S.ks}>
            {cotizado > 0
              ? (porEntrar > 0 ? <>faltan {money(porEntrar)} de {money(cotizado)}</> : <>liquidado</>)
              : 'nada cotizado todavía'}
            {ultimoPago && <> · el último el {fmtDate(ultimoPago)}</>}
          </div>
        </div>
        <div style={{ ...S.kpi, borderLeft: '3px solid #EFA6CA' }}>
          <div style={S.kl}>Por vender</div>
          <div style={{ ...S.kv, color: ideas.length || oportunidades.length ? '#9c3d70' : '#c2bfcc' }}>
            {potencial > 0 ? '~' + money(potencial) : String(ideas.length + oportunidades.length)}
          </div>
          <div style={S.ks}>
            {potencial > 0
              ? <>{oportunidades.length} con monto · {ideas.length} idea{ideas.length === 1 ? '' : 's'} sin estimar</>
              : ideas.length ? <>ideas · ninguna con monto</> : 'nada sobre la mesa'}
          </div>
        </div>
        <div style={{ ...S.kpi, borderLeft: `3px solid ${obraTarde ? '#EF7A72' : '#9B8CFA'}` }}>
          <div style={S.kl}>En el taller</div>
          <div style={{ ...S.kv, color: enObra.length ? (obraTarde ? '#C0554E' : '#5B4BD6') : '#c2bfcc' }}>{enObra.length}</div>
          <div style={S.ks}>
            {obraTarde ? <>el más atrasado, {obraTarde} días</>
              : obraSinFecha ? <>{obraSinFecha} sin fecha</>
              : enObra.length ? 'en construcción' : 'nada en construcción'}
          </div>
        </div>
        <div style={{ ...S.kpi, borderLeft: '3px solid #4FBF95' }}>
          <div style={S.kl}>Entregado este año</div>
          <div style={{ ...S.kv, color: esteAnio ? '#1E8A63' : '#c2bfcc' }}>{esteAnio}</div>
          <div style={S.ks}>{delAnio[0]?.fecha_entrega ? <>el último el {fmtDate(delAnio[0].fecha_entrega)}</> : 'sin entregas este año'}</div>
        </div>
      </div>

      {/* El segmento. El elegido va morado sólido y los demás neutros: si todos
          llevan borde morado, ninguno se ve activo. */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
        {CARRILES.map(c => {
          const on = carril === c.k;
          return (
            <button key={c.k} onClick={() => setCarril(c.k)}
              style={{
                border: on ? '1px solid #9B8CFA' : '1px solid #e9e3ee', background: on ? '#9B8CFA' : '#fff',
                color: on ? '#fff' : '#666', borderRadius: 9, padding: '7px 13px', fontSize: '0.76rem',
                fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer',
              }}>
              {c.l} <span style={{ opacity: .75, fontWeight: 700 }}>{c.n}</span>
            </button>
          );
        })}
        <button style={{ ...S.btn, marginLeft: 'auto' }}
          onClick={() => setEditando({ estado: 'idea', categoria: 'personalizacion', visible_cliente: true })}>
          + Agregar
        </button>
      </div>

      {/* ── POR VENDER ── */}
      {carril === 'vender' && (<>
        {(sugerencias.length > 0 || sugYaEnLista > 0) && (<>
          <div style={S.grupo}>Sugerencias del sistema <span style={S.grupoC}>{sugerencias.length}</span>
            {sugerencias.length > 1 && (
              <button onClick={() => setVerSug(v => !v)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700, color: '#5B4BD6', textTransform: 'none', letterSpacing: 0 }}>
                {verSug ? 'ver menos' : `ver ${sugerencias.length - 1} más`}
              </button>
            )}
          </div>
          {(verSug ? sugerencias : sugerencias.slice(0, 1)).map((sn: any) => (
            <div key={sn.tipo} style={S.fila}>
              <span style={{ ...S.franja, background: sn.nivel === 'riesgo' ? '#EF7A72' : '#EFA6CA' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.83rem', fontWeight: 700, color: sn.nivel === 'riesgo' ? '#C0554E' : '#1a1a1a' }}>{sn.titulo}</div>
                <div style={{ fontSize: '0.71rem', color: '#888', marginTop: 2, lineHeight: 1.45 }}>
                  {sn.detalle} <b style={{ color: '#4a4a52' }}>{sn.nivel === 'riesgo' ? 'Hacer:' : 'Ofrecerle:'}</b> {sn.accion}
                </div>
              </div>
              <button style={S.btnAzul} onClick={() => adoptarSenal(sn)}>Agregar a la lista</button>
              <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => descartarSenal(sn)} title="Ya la tienes, o no aplica">No sugerirla</button>
            </div>
          ))}
          {sugYaEnLista > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#a5a2af', padding: '9px 0 0' }}>
              {sugYaEnLista} más ya {sugYaEnLista === 1 ? 'está' : 'están'} en la lista · no se repite{sugYaEnLista === 1 ? '' : 'n'}
            </div>
          )}
        </>)}

        {oportunidades.length > 0 && (<>
          <div style={S.grupo}>Oportunidades <span style={S.grupoC}>
            {money(oportunidades.reduce((a: number, m: any) => a + Number(m.valor || 0), 0))} · sí cuentan en el pronóstico</span></div>
          {oportunidades.map(m => <Renglon key={m.id} m={m} />)}
        </>)}

        {ideas.length > 0 && (<>
          <div style={S.grupo}>Ideas <span style={S.grupoC}>{ideas.length} · ninguna entra al pronóstico sin monto</span></div>
          {(verTodoIdeas ? ideas : ideas.slice(0, TOPE)).map(m => (
            <div key={m.id}>
              <Renglon m={m} />
              {/* La conversión pide monto ahí mismo: mandar al usuario a otra
                  pantalla para escribir un número es como se pierden. */}
              {aOportunidad?.id === m.id && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 10px', padding: '11px 13px', background: '#fff', border: '1px solid #f3cadb', borderLeft: '3px solid #D9538E', borderRadius: 10 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#9c3d70' }}>¿En cuánto la estimas?</span>
                  <input type="number" autoFocus value={aOportunidad.valor}
                    onChange={e => setAOportunidad({ ...aOportunidad, valor: e.target.value })}
                    placeholder="Monto" style={{ ...S.input, width: 120 }} />
                  <input type="date" value={aOportunidad.fecha || ''}
                    onChange={e => setAOportunidad({ ...aOportunidad, fecha: e.target.value })}
                    title="Cierre esperado" style={{ ...S.input, width: 150 }} />
                  <button style={{ ...S.btnAzul, borderColor: '#D9538E', color: '#9c3d70' }} onClick={volverOportunidad}>Crear oportunidad</button>
                  <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => setAOportunidad(null)}>Cancelar</button>
                  <span style={{ fontSize: '0.68rem', color: '#a5a2af', flexBasis: '100%' }}>
                    Con monto entra al pronóstico de ventas; sin monto se queda como idea.
                  </span>
                </div>
              )}
            </div>
          ))}
          {ideas.length > TOPE && (
            <button onClick={() => setVerTodoIdeas(v => !v)} style={S.mas}>
              {verTodoIdeas ? 'Ver solo las primeras' : `Ver las ${ideas.length - TOPE} ideas restantes`}
            </button>
          )}
        </>)}

        {ideas.length === 0 && oportunidades.length === 0 && sugerencias.length === 0 && (
          <div style={S.vacio}>Lo que se te ocurra en una junta y le pueda interesar al cliente va aquí. De ahí sale la siguiente venta.</div>
        )}

        {yaCotizadas.length > 0 && (
          <div style={{ fontSize: '0.71rem', color: '#888', lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f0f4' }}>
            <b style={{ color: '#5B4BD6' }}>{yaCotizadas.length} {yaCotizadas.length === 1 ? 'idea ya se cotizó' : 'ideas ya se cotizaron'}</b> y por eso no están en esta lista:
            {' '}{yaCotizadas.slice(0, 3).map((m: any, i: number) => (
              <span key={m.id}>{i ? ', ' : ''}{m.titulo}{m.quotes?.numero ? ` (${m.quotes.numero})` : ''}</span>
            ))}
            {yaCotizadas.length > 3 && <> y {yaCotizadas.length - 3} más</>}.
          </div>
        )}
      </>)}

      {/* ── LO TUYO: capacitaciones, videos y pendientes. La obra vive en la
             pestaña Taller y aquí solo se asoma como una línea. ── */}
      {carril === 'tuyo' && (<>
        {porHacer === 0 && <div style={S.vacio}>Nada pendiente de tu lado. Lo que salga de la próxima junta aparece aquí — o en el taller, si hay que construirlo.</div>}
        {grupos.map(g => (
          <div key={g.k}>
            <div style={S.grupo}>{g.l} <span style={S.grupoC}>{g.filas.length}</span></div>
            {g.filas.map((m: any) => <Renglon key={m.id} m={m} />)}
          </div>
        ))}
      </>)}

      {/* ── EN EL TALLER: una línea, no una lista. El detalle tiene su pestaña. ── */}
      {carril === 'taller' && (
        <div style={S.fila}>
          <span style={{ ...S.franja, background: obraTarde ? '#EF7A72' : enObra.length ? '#9B8CFA' : '#e9e7ef' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>
              {enObra.length ? <>{enObra.length} {enObra.length === 1 ? 'cosa se está construyendo' : 'cosas se están construyendo'}</> : 'Nada en el taller'}
            </div>
            <div style={{ fontSize: '0.71rem', color: '#888', marginTop: 2 }}>
              {obraTarde ? `Se pasó lo que le prometiste: el más atrasado lleva ${obraTarde} días.`
                : obraSinFecha ? `${obraSinFecha} sin fecha: nadie las puede arrancar.`
                : enObra.length ? 'Todas con fecha comprometida.'
                : 'Lo que haya que construir para esta cuenta aparece aquí.'}
            </div>
          </div>
          {enObra.length > 0 && (
            <>
              <span style={{ ...S.badge, ...(obraTarde ? { background: '#FEF0EF', color: '#C0554E' } : { background: '#EEECFE', color: '#5B4BD6' }) }}>
                {obraTarde ? `${obraTarde} días tarde` : `${enObra.length} en curso`}
              </span>
              <button style={S.btnAzul} onClick={() => irATaller?.()}>Ver el taller de la cuenta</button>
            </>
          )}
        </div>
      )}

      {/* ── YA ENTREGADO ── */}
      {carril === 'entregado' && (<>
        {sinRegistrar.length > 0 && (<>
          <div style={S.grupo}>Se cobró y falta registrarlo <span style={S.grupoC}>{sinRegistrar.length} · sin esto el reporte de entregas sale vacío</span></div>
          {sinRegistrar.map(({ cot, it }: any) => (
            <div key={`${cot.id}|${it.clave}`} style={S.fila}>
              <span style={{ ...S.franja, background: '#4FBF95' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>{it.nombre}</div>
                <div style={{ fontSize: '0.71rem', color: '#888', marginTop: 2 }}>cobrado en {cot.numero}</div>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1E8A63', fontVariantNumeric: 'tabular-nums' }}>{money(it.neto)}</span>
              <button style={S.btnAzul}
                onClick={() => setEditando({
                  estado: 'entregada', categoria: catDePartida(it),
                  titulo: it.nombre, valor: it.neto, quote_id: cot.id, quote_item: it.clave,
                  visible_cliente: true, cortesia: false,
                })}>Registrar la entrega</button>
            </div>
          ))}
        </>)}
        {entregadas.length === 0 && sinRegistrar.length === 0 && (
          <div style={S.vacio}>Todavía no se le ha entregado nada a este cliente.</div>
        )}
        {entregadas.length > 0 && (<>
          <div style={S.grupo}>Entregado <span style={S.grupoC}>{entregadas.length} en total</span></div>
          {(verTodo ? entregadas : entregadas.slice(0, TOPE)).map(m => <Renglon key={m.id} m={m} />)}
          {entregadas.length > TOPE && (
            <button onClick={() => setVerTodo(v => !v)} style={S.mas}>
              {verTodo ? 'Ver solo las últimas' : `Ver las ${entregadas.length - TOPE} entregas anteriores`}
            </button>
          )}
        </>)}
      </>)}

      {/* ══════ LOS REPORTES AL CLIENTE ══════
          Van SIEMPRE visibles y al pie, no dentro de un carril: son el
          documento con el que se le justifica el trabajo al cliente y esconderlos
          detrás de un filtro es perderlos. El de ENTREGAS se arma solo con las
          mejoras entregadas en el periodo que elijas —con su video—; el
          EJECUTIVO cuenta el periodo completo. Siguen siendo dos documentos
          distintos y ninguno cambió. */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f0f4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={S.kl}>Reportes al cliente</span>
          <span style={{ fontSize: '0.71rem', color: '#a5a2af' }}>se generan del periodo que elijas</span>
          <button style={{ ...S.btnAzul, marginLeft: 'auto' }} onClick={() => setEntregas(true)}>Reporte de entregas</button>
          <button style={S.btnG} onClick={() => setReporte(true)}>Reporte ejecutivo</button>
        </div>
        <SeguimientoReportes reportes={reportes} flash={flash} recargar={cargarReportes} />
      </div>

      {editando && <EditorMejora m={editando} reuniones={reuniones} cots={cots} onCerrar={() => setEditando(null)} onGuardar={guardar} />}
      {orden && <OrdenDelTaller orden={orden} equipo={equipoTaller} onCerrar={() => setOrden(null)} onGuardar={guardarOrden} />}
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
