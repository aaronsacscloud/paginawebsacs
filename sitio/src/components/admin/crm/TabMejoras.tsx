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
};

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
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

      {/* ── El dinero, en UNA tarjeta ──
          Eran tres bloques apilados —la tarjeta «Cobrado», el acuerdo de pago
          en amarillo y de dónde salió el cobro— hablando todos del MISMO
          dinero, con tres colores distintos. Aquí es una sola cosa: cuánto
          entró, cuánto falta, qué parcialidad sigue y de qué conversación
          salió. Solo aparece si hay algo cotizado: una cuenta sin trabajo
          vendido no necesita una tarjeta que diga cero. */}
      {cotizado > 0 && (
        <div style={{
          background: 'linear-gradient(135deg,#EEECFE,rgba(244,168,205,.13))',
          border: '1px solid #ddd6fb', borderRadius: 12, padding: '15px 18px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1E8A63', letterSpacing: '-.035em' }}>{money(entrado)}</span>
            <span style={{ fontSize: '0.8rem', color: '#6b6878' }}>
              {porEntrar > 0
                ? <>cobrados de <b style={{ color: '#3f3b4d' }}>{money(cotizado)}</b> · faltan <b style={{ color: '#3f3b4d' }}>{money(porEntrar)}</b></>
                : <>cobrados · <b style={{ color: '#1E8A63' }}>liquidado</b></>}
              {ultimoPago && <> · último el {fmtDate(ultimoPago)}</>}
            </span>
          </div>
          {/* La barra dice de un vistazo si esto va empezando o va terminando,
              que es la pregunta real cuando el cobro es en parcialidades. */}
          <div style={{ height: 5, borderRadius: 5, background: 'rgba(91,75,214,.14)', margin: '11px 0 10px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 5,
              width: `${Math.min(100, Math.round((entrado / Math.max(1, cotizado)) * 100))}%`,
              background: 'linear-gradient(90deg,#9B8CFA,#4FBF95)',
            }} />
          </div>
          {conPlan.map((c: any) => {
            const pagadas = c.plan.filter((x: any) => x.estado === 'pagada').length;
            const prox = c.plan.find((x: any) => x.estado === 'pendiente');
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '7px 14px', flexWrap: 'wrap', fontSize: '0.755rem', color: '#4a4658', lineHeight: 1.5, marginBottom: 4 }}>
                <span>
                  <b style={{ color: '#2f2b3d' }}>{c.numero}</b> · {c.plan.length} parcialidades · {pagadas} pagada{pagadas === 1 ? '' : 's'}
                  {prox
                    ? <> · {prox.vencida
                        ? <b style={{ color: '#C0554E' }}>vencida {money(prox.monto)}</b>
                        : <>la próxima <b style={{ color: '#2f2b3d' }}>{money(prox.monto)}</b></>} el {fmtDate(prox.fecha)}</>
                    : <> · <b style={{ color: '#1E8A63' }}>liquidada</b></>}
                </span>
                {c.conversacion && (
                  <span title={`${fmtDate(c.conversacion.desde)} – ${fmtDate(c.conversacion.hasta)}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e3dffa', borderRadius: 999, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700, color: '#5B4BD6' }}>
                    Salió de «{c.conversacion.titulo}»
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Las tres cuentas, en una tira ──
          Eran tres tarjetas del mismo tamaño que la del dinero y en la mayoría
          de las cuentas las tres dicen cero: gritaban lo que no tenía nada que
          decir. Como tira se leen igual cuando traen número y desaparecen del
          ruido cuando no. El color solo entra si el dato pide atención. */}
      <div style={{ display: 'flex', gap: '10px 26px', flexWrap: 'wrap', padding: '0 3px', marginBottom: 14 }}>
        {[
          { l: porHacer && estaSemana ? `${estaSemana} vencen esta semana` : 'Tuyo por hacer', v: String(porHacer), col: porHacer ? '#9a6a10' : null },
          { l: enObra.length ? (obraTarde ? `el más atrasado, ${obraTarde} días` : obraSinFecha ? `${obraSinFecha} sin fecha` : 'en construcción') : 'En el taller',
            v: String(enObra.length), col: enObra.length ? (obraTarde ? '#C0554E' : '#5B4BD6') : null },
          { l: potencial > 0 ? `${ideas.length} idea${ideas.length === 1 ? '' : 's'} sin cerrar`
              : ideas.length ? `${ideasSinMonto} sin monto · no se puede estimar` : 'Sobre la mesa',
            v: potencial > 0 ? '~' + money(potencial) : '—', col: potencial > 0 ? '#9c3d70' : null },
          { l: delAnio[0]?.fecha_entrega ? `último el ${fmtDate(delAnio[0].fecha_entrega)}` : 'Entregado este año',
            v: String(esteAnio), col: esteAnio ? '#1E8A63' : null },
        ].map(x => (
          <div key={x.l} style={{ fontSize: '0.72rem', color: '#9a97a4' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 1, color: x.col || '#c2bfcc' }}>{x.v}</div>
            {x.l}
          </div>
        ))}
      </div>

      <SeguimientoReportes reportes={reportes} flash={flash} recargar={cargarReportes} />

      <div style={{ position: 'relative', paddingLeft: 26 }}>
        {/* El hilo en el lila del sistema y no en gris: sobre el fondo de la
            ficha un #ececec desaparece y los tres puntos quedan sueltos. */}
        <span style={{ position: 'absolute', left: 7, top: 6, bottom: 24, width: 2, background: '#ddd6fb', borderRadius: 2 }} />

        {/* 1 · Lo que le debes */}
        <Hito n={1} titulo="Lo tuyo con el cliente" color="#9B8CFA"
          resumen={porHacer ? `${porHacer} · lo más próximo primero` : 'nada pendiente de tu lado'}
          accion={<button style={S.btn} onClick={() => setEditando({ estado: 'en_proceso', categoria: 'capacitacion', visible_cliente: true })}>+ Agregar</button>}>
          {/* El puente al taller: una LÍNEA, no una lista. Lo que se está
              construyendo tiene su propia pestaña; aquí basta saber que existe
              y si va tarde — que es lo que antes no se veía. */}
          {enObra.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: porHacer ? 12 : 0, paddingBottom: porHacer ? 12 : 0, borderBottom: porHacer ? '1px solid #f4f4f4' : 'none' }}>
              <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...(obraTarde ? { background: '#FEF0EF', color: '#C0554E' } : obraSinFecha ? { background: '#FFF4E5', color: '#9a6a10' } : { background: '#EEECFE', color: '#5B4BD6' }) }}>
                {enObra.length} en el taller{obraTarde ? ` · ${obraTarde} ${obraTarde === 1 ? 'día' : 'días'} tarde` : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#888', flex: 1, minWidth: 180 }}>
                {obraTarde
                  ? 'Se pasó lo que le prometiste.'
                  : obraSinFecha
                    ? `${obraSinFecha} sin fecha: nadie las puede arrancar.`
                    : 'Lo que se está construyendo para esta cuenta.'}
              </span>
              <button style={S.btnAzul} onClick={() => irATaller?.()}>Ver el taller de la cuenta</button>
            </div>
          )}
          {porHacer === 0 && enObra.length === 0 && (
            <div style={{ color: '#999', fontSize: '0.82rem' }}>
              Nada pendiente con este cliente. Lo que salga de la próxima junta aparece aquí — o en el taller, si hay
              que construirlo.
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
        <Hito n={2} titulo="Por vender" color="#EFA6CA"
          resumen={`${ideas.length} idea${ideas.length === 1 ? '' : 's'}${oportunidades.length ? ` · ${oportunidades.length} oportunidad${oportunidades.length === 1 ? '' : 'es'}` : ''}${sugerencias.length ? ` · ${sugerencias.length} sugerencia${sugerencias.length === 1 ? '' : 's'}` : ''}`}
          accion={<button style={S.btn} onClick={() => setEditando({ estado: 'idea', categoria: 'personalizacion' })}>+ Agregar idea</button>}>

          {(sugerencias.length > 0 || sugYaEnLista > 0) && (
            <div style={{ border: '1px dashed #f3cadb', background: 'rgba(244,168,205,.16)', borderRadius: 10, padding: '11px 13px', marginBottom: 10 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9c3d70', display: 'flex', alignItems: 'center', gap: 8 }}>
                Sugerencias del sistema · {sugerencias.length}
                {sugerencias.length > 1 && (
                  <button onClick={() => setVerSug(v => !v)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.66rem', fontWeight: 700, color: '#9c3d70', textDecoration: 'underline', textTransform: 'none', letterSpacing: 0 }}>
                    {verSug ? 'Ver menos' : `Ver ${sugerencias.length - 1} más`}
                  </button>
                )}
              </div>
              {(verSug ? sugerencias : sugerencias.slice(0, 1)).map((sn: any, i: number) => (
                <div key={sn.tipo} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingTop: 9, marginTop: i ? 9 : 0, borderTop: i ? '1px solid #f3cadb' : 'none' }}>
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
                <div style={{ fontSize: '0.7rem', color: '#9c3d70', paddingTop: 9, marginTop: 9, borderTop: '1px solid #f3cadb' }}>
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
          {/* ── IDEAS: lo que se puede vender, sin monto y fuera del pronóstico ── */}
          {ideas.length > 0 && (
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em', margin: '11px 0 2px' }}>
              Ideas · {ideas.length}
            </div>
          )}
          {ideas.map(m => (
            <div key={m.id}>
              <Renglon m={m} />
              {/* La conversión pide monto ahí mismo: sin monto no hay
                  oportunidad, y mandar al usuario a otra pantalla para escribir
                  un número es como se pierden las conversiones. */}
              {aOportunidad?.id === m.id && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 10px', padding: '11px 13px', background: '#FCEFF5', border: '1px solid #f6d9e7', borderRadius: 10 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9c3d70' }}>¿En cuánto la estimas?</span>
                  <input type="number" autoFocus value={aOportunidad.valor}
                    onChange={e => setAOportunidad({ ...aOportunidad, valor: e.target.value })}
                    placeholder="Monto" style={{ width: 120, border: '1px solid #f0c9dd', borderRadius: 8, padding: '6px 9px', fontSize: '0.78rem', fontFamily: 'inherit' }} />
                  <input type="date" value={aOportunidad.fecha || ''}
                    onChange={e => setAOportunidad({ ...aOportunidad, fecha: e.target.value })}
                    title="Cierre esperado" style={{ border: '1px solid #f0c9dd', borderRadius: 8, padding: '6px 9px', fontSize: '0.75rem', fontFamily: 'inherit' }} />
                  <button style={{ ...S.btnAzul, background: '#D9538E' }} onClick={volverOportunidad}>Crear oportunidad</button>
                  <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={() => setAOportunidad(null)}>Cancelar</button>
                  <span style={{ fontSize: '0.68rem', color: '#9c3d70', flexBasis: '100%' }}>
                    Con monto entra al pronóstico de ventas; sin monto se queda como idea.
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* ── OPORTUNIDADES: ya tienen monto y trato. Entran al pipeline ── */}
          {oportunidades.length > 0 && (<>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c3d70', textTransform: 'uppercase', letterSpacing: '.07em', margin: '16px 0 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
              Oportunidades · {oportunidades.length}
              <span style={{ fontWeight: 700, color: '#a5a2af', textTransform: 'none', letterSpacing: 0 }}>
                {money(oportunidades.reduce((a: number, m: any) => a + Number(m.valor || 0), 0))} · sí cuentan en el pronóstico
              </span>
            </div>
            {oportunidades.map(m => <Renglon key={m.id} m={m} />)}
          </>)}

          {/* ── EL RASTRO: lo que ya se cotizó dejó de ser idea ── */}
          {yaCotizadas.length > 0 && (
            <div style={{ fontSize: '0.71rem', color: '#6b6b7a', lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1eff8' }}>
              <b style={{ color: '#9c3d70' }}>{yaCotizadas.length} {yaCotizadas.length === 1 ? 'idea ya se cotizó' : 'ideas ya se cotizaron'}</b> y por eso no están en esta lista:
              {' '}{yaCotizadas.slice(0, 3).map((m: any, i: number) => (
                <span key={m.id}>{i ? ', ' : ''}{m.titulo}{m.quotes?.numero ? ` (${m.quotes.numero})` : ''}</span>
              ))}
              {yaCotizadas.length > 3 && <> y {yaCotizadas.length - 3} más</>}. Viven arriba, en «Por hacer», y en Cotizaciones.
            </div>
          )}
        </Hito>

        {/* 3 · Lo que ya quedó atrás. Solo la última: es historia, se consulta.
            La lista completa empujaba fuera de pantalla lo que sí hay que hacer. */}
        <Hito n={3} titulo="Ya entregado" color="#4FBF95"
          resumen={entregadas.length ? `${entregadas.length} en total` : 'sin entregas'}
          /* Los reportes viven aquí y no en dos tarjetones arriba: son lo que
             sale de ESTA lista. El ejecutivo se manda cuando toca revisar la
             cuenta y el de entregas cuando el cliente pregunta «¿qué me han
             hecho?», así que siguen siendo dos documentos y no uno. */
          accion={<>
            <button style={{ ...S.btnG, borderColor: '#cfe9d9', color: '#1E8A63' }} onClick={() => setEntregas(true)}>Reporte de entregas</button>
            <button style={S.btnG} onClick={() => setReporte(true)}>Reporte ejecutivo</button>
          </>}>
          {/* Lo que se cobró y no tiene entrega. Era un bloque suelto allá
              arriba; su lugar es aquí, porque es exactamente lo que le falta a
              esta lista —y sin ese renglón el reporte de entregas sale vacío
              aunque el cliente lleve medio proyecto pagado—. */}
          {sinRegistrar.map(({ cot, it }: any) => (
            <div key={`${cot.id}|${it.clave}`} style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 9,
              background: '#F6FBF8', borderLeft: '3px solid #4FBF95', borderRadius: '0 9px 9px 0', padding: '10px 13px',
            }}>
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2f2b3d' }}>
                  Se cobró y falta registrar: {it.nombre}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#8a8590', marginTop: 2 }}>
                  {cot.numero} · sin este renglón el reporte de entregas sale vacío
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E8A63', fontVariantNumeric: 'tabular-nums' }}>{money(it.neto)}</div>
              <button style={{ ...S.btn, background: '#1E8A63', flexShrink: 0 }}
                onClick={() => setEditando({
                  estado: 'entregada', categoria: catDePartida(it),
                  titulo: it.nombre, valor: it.neto, quote_id: cot.id, quote_item: it.clave,
                  visible_cliente: true, cortesia: false,
                })}>Registrar la entrega</button>
            </div>
          ))}
          {entregadas.length === 0 && sinRegistrar.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem' }}>Todavía no se le ha entregado nada a este cliente.</div>}
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
