// Comisiones · el motor configurable.
//
// Cuatro vistas, en el orden en que se trabaja y no en el que se construyó:
//
//   Periodo      — lo que hay que pagar este corte. Es la pantalla que se abre
//                  todos los días, así que es la que arranca.
//   Modelo       — el % por SKU × origen, el tope de descuento, el override de
//                  partners, y a qué persona le aplica cada modelo.
//   Atribución   — de quién es cada cuenta. Es trabajo de una vez, pero sin
//                  ella el periodo sale en ceros: por eso el aviso de "sin
//                  atribuir" vive arriba, en Periodo, y no aquí.
//   Renovaciones — las dos condiciones anuales. La del 50% se calcula sola;
//                  la de seguimiento la marca una persona.
//
// La regla que gobierna la pantalla: nada se esconde. Un pago sin dueño, un SKU
// sin tarifa y una comisión revertida después de pagada SE VEN, porque son
// justo los tres casos en los que alguien cobra de menos sin enterarse.
import { useEffect, useMemo, useState } from 'react';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
import { WRAP } from '../../../lib/crm/layout';
import { useIsMobile } from '../../../lib/ui/mobile';
import Cargando, { Chispas } from './ui/Cargando';
import { confirmar } from '../../../lib/ui/confirmar';
import { ORIGENES, ORIGEN_LABEL, CUENTAS, explicar } from '../../../lib/crm/comisiones.lib';
import ComisionesCortes from './ComisionesCortes';

type Vista = 'cortes' | 'periodo' | 'renovaciones';

const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (d?: string | null) =>
  d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '') : '—';

const E = {
  card: { background: P.papel, border: `1px solid ${P.linea}`, borderRadius: 12, padding: '15px 17px' } as const,
  lbl: { fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', display: 'block', marginBottom: 4 },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' as const },
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: P.violeta, color: '#fff' } as const,
  btn2: { padding: '7px 13px', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta } as const,
  btn3: { padding: '7px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', border: '1px solid #ddd', color: '#444' } as const,
  th: { textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', padding: '9px 10px', borderBottom: `1px solid ${P.linea}`, whiteSpace: 'nowrap' as const },
  td: { padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, fontSize: '0.82rem', color: P.texto, verticalAlign: 'top' as const },
  chip: { fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, display: 'inline-block' },
};

const ESTADO_TONO: Record<string, { bg: string; fg: string; label: string }> = {
  calculada: { bg: P.violetaAgua, fg: P.violetaTinta, label: 'Calculada' },
  aprobada:  { bg: P.azulAgua,    fg: P.azulTinta,    label: 'Aprobada' },
  pagada:    { bg: P.verdeAgua,   fg: P.verdeTinta,   label: 'Pagada' },
  cancelada: { bg: P.rojoAgua,    fg: P.rojoTinta,    label: 'Cancelada' },
};

/**
 * El último corte cerrado: de lunes a viernes.
 *
 * El corte cierra el viernes y se paga el lunes siguiente, así que lo que
 * interesa casi siempre es «la semana que ya cerró». Se ancla al viernes más
 * reciente que ya pasó —hoy mismo si hoy es viernes— y se retrocede cuatro
 * días: así el botón dice lo mismo un lunes que un miércoles.
 */
function corteSemanal() {
  const h = new Date();
  const atras = (h.getDay() - 5 + 7) % 7;   // 0=dom … 5=vie
  const vie = new Date(h.getFullYear(), h.getMonth(), h.getDate() - atras);
  const lun = new Date(vie.getFullYear(), vie.getMonth(), vie.getDate() - 4);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { desde: iso(lun), hasta: iso(vie) };
}

/** Primer día del mes en curso, en local. */
function mesActual() {
  const h = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    desde: `${h.getFullYear()}-${p(h.getMonth() + 1)}-01`,
    hasta: `${h.getFullYear()}-${p(h.getMonth() + 1)}-${p(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate())}`,
  };
}

export default function ComisionesTab() {
  const movil = useIsMobile();
  const [vista, setVista] = useState<Vista>('cortes');

  return (
    <div style={WRAP}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: movil ? '1.15rem' : '1.4rem', fontWeight: 800, color: P.tinta }}>Comisiones</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: P.suave, maxWidth: '72ch' }}>
          Se calculan sobre los pagos <b>cobrados</b>, con el porcentaje que le toca a cada SKU según el origen del cliente. Se recalculan solas cada madrugada. <b>Cortes</b> es lo que hay que pagar cada lunes; <b>Periodo</b> es para mirar cualquier rango.
        </p>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${P.linea}`, marginBottom: 16, overflowX: 'auto' }}>
        {([['cortes', 'Cortes'], ['periodo', 'Periodo'], ['renovaciones', 'Renovaciones']] as [Vista, string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} style={{
            padding: '9px 15px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: vista === v ? P.violetaAgua : 'transparent',
            borderRadius: '9px 9px 0 0',
            borderBottom: vista === v ? `2px solid ${P.violeta}` : '2px solid transparent',
            color: vista === v ? P.violetaTinta : '#666',
            fontWeight: vista === v ? 800 : 500, fontSize: '0.83rem',
          }}>{l}</button>
        ))}
      </div>

      {vista === 'cortes' && <ComisionesCortes movil={movil} />}
      {vista === 'periodo' && <VistaPeriodo movil={movil} />}
      {vista === 'renovaciones' && <VistaRenovaciones movil={movil} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PERIODO
   ══════════════════════════════════════════════════════════════════ */
/** A dónde se manda a alguien para resolver un hueco de configuración. */
const CFG_COMISIONES = '/admin/crm?tab=config&cfg=comisiones';

function VistaPeriodo({ movil }: { movil: boolean }) {
  // Se abre en el corte que toca pagar, que es la pregunta de todos los lunes.
  const inicial = corteSemanal();
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [data, setData] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [persona, setPersona] = useState('');

  async function cargar() {
    setCargando(true); setError(null);
    try {
      const r = await fetch(`/api/crm/comisiones/periodo?desde=${desde}&hasta=${hasta}${persona ? `&owner_id=${persona}` : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setData(j); setSel(new Set());
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [desde, hasta, persona]);

  async function recalcular() {
    setRecalculando(true);
    try {
      const r = await fetch('/api/crm/comisiones/periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'recalcular', desde, hasta }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setRecalculando(false); }
  }

  async function accion(a: 'marcar_pagado' | 'aprobar' | 'cancelar') {
    if (!sel.size) return;
    const textos: Record<string, string> = {
      marcar_pagado: `¿Marcar ${sel.size} línea(s) como pagadas? Una vez pagadas ya no se recalculan.`,
      aprobar: `¿Aprobar ${sel.size} línea(s)?`,
      cancelar: `¿Cancelar ${sel.size} línea(s)? Quedan en cero y dejan de sumar.`,
    };
    if (!(await confirmar(textos[a]))) return;
    let referencia = '';
    if (a === 'marcar_pagado') {
      // `prompt` devuelve null al cancelar. Convertirlo a '' con `|| ''` hacía
      // que Cancelar igual marcara como pagado, que es irreversible.
      const r = window.prompt('Referencia del pago (opcional):');
      if (r === null) return;
      referencia = r;
    }
    const r = await fetch('/api/crm/comisiones/periodo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: a, ids: [...sel], referencia }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    await cargar();
  }

  const lineas = data?.lineas || [];
  const t = data?.totales;

  if (cargando && !data) return <Cargando texto="Calculando comisiones…" />;

  return (
    <>
      {/* ── Rango y acciones ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div><label style={E.lbl}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={E.input} /></div>
        <div><label style={E.lbl}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={E.input} /></div>
        <div>
          <label style={E.lbl}>Consultor</label>
          <select value={persona} onChange={e => setPersona(e.target.value)} style={{ ...E.input, minWidth: 170 }}>
            <option value="">Todos</option>
            {(data?.personas || []).map((f: any) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </div>
        <button onClick={recalcular} disabled={recalculando} style={{ ...E.btn2, opacity: recalculando ? 0.6 : 1 }}>
          {recalculando ? <><Chispas size={10} /> Recalculando…</> : 'Recalcular'}
        </button>
        <button onClick={() => { const c = corteSemanal(); setDesde(c.desde); setHasta(c.hasta); }} style={E.btn3}>Corte de la semana</button>
        <button onClick={() => { const m = mesActual(); setDesde(m.desde); setHasta(m.hasta); }} style={E.btn3}>Mes actual</button>
      </div>

      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      {data?.truncado && (
        <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, background: P.rojoAgua, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>
          <b>Estos totales están incompletos.</b> El periodo tiene más líneas de las que se pueden leer de una vez. Acorta el rango de fechas o filtra por consultor.
        </div>
      )}

      {/* ── Totales ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '170px'}, 1fr))`, gap: 11, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.violeta)}>
          <span style={E.lbl}>Comisión del periodo</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta }}>{pesos(t?.monto)}</div>
          <div style={{ fontSize: '0.6875rem', color: '#888' }}>{t?.lineas || 0} línea(s)</div>
        </div>
        <div style={tarjetaKpi(P.ambar)}>
          <span style={E.lbl}>Por pagar</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ambarTinta }}>{pesos(t?.por_pagar)}</div>
        </div>
        <div style={tarjetaKpi(P.verde)}>
          <span style={E.lbl}>Ya pagado</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.verdeTinta }}>{pesos(t?.pagado)}</div>
        </div>
      </div>

      {/* ── Lo que falta por hacer, arriba y no escondido ── */}
      {(data?.sin_atribuir?.pagos > 0 || (t?.sin_regla || 0) > 0) && (
        <div style={{ ...E.card, borderLeft: `3px solid ${P.ambar}`, background: P.ambarAgua, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.ambarTinta, marginBottom: 6 }}>Hay dinero que no le está contando a nadie</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: P.texto, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data?.sin_atribuir?.pagos > 0 && (
              <li>
                <b>{data.sin_atribuir.pagos} pago(s)</b> por {pesos(data.sin_atribuir.monto)} sin consultor asignado.{' '}
                <a href={CFG_COMISIONES} style={{ ...E.btn3, padding: '2px 8px', fontSize: '0.72rem', textDecoration: 'none', display: 'inline-block' }}>Asignar</a>
              </li>
            )}
            {(t?.sin_regla || 0) > 0 && (
              <li>
                <b>{t.sin_regla} línea(s)</b> sin tarifa para su SKU: se calcularon en cero.{' '}
                <a href={CFG_COMISIONES} style={{ ...E.btn3, padding: '2px 8px', fontSize: '0.72rem', textDecoration: 'none', display: 'inline-block' }}>Configurar</a>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── Resumen por persona ── */}
      {(data?.resumen || []).length > 0 && (
        <div style={{ ...E.card, padding: 0, marginBottom: 14, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
            <thead><tr>
              <th style={E.th}>Consultor</th><th style={E.th}>Líneas</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Cobrado</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Base</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Por pagar</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Comisión</th>
            </tr></thead>
            <tbody>
              {data.resumen.map((f: any) => (
                <tr key={f.owner_id}>
                  <td style={{ ...E.td, fontWeight: 700, color: P.tinta }}>
                    {f.nombre}
                    {f.sin_regla > 0 && <span style={{ ...E.chip, background: P.ambarAgua, color: P.ambarTinta, marginLeft: 6 }}>{f.sin_regla} sin tarifa</span>}
                    {f.tardias > 0 && <span style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta, marginLeft: 6 }}>{f.tardias} cobro tardío</span>}
                  </td>
                  <td style={E.td}>{f.lineas}</td>
                  <td style={{ ...E.td, textAlign: 'right' }}>{pesos(f.bruto)}</td>
                  <td style={{ ...E.td, textAlign: 'right' }}>{pesos(f.base)}</td>
                  <td style={{ ...E.td, textAlign: 'right', color: P.ambarTinta, fontWeight: 700 }}>{pesos(f.por_pagar)}</td>
                  <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(f.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detalle ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.85rem', color: P.tinta }}>Detalle</strong>
        {sel.size > 0 && (
          <>
            <span style={{ fontSize: '0.78rem', color: P.suave }}>{sel.size} seleccionada(s)</span>
            <button onClick={() => accion('aprobar')} style={E.btn3}>Aprobar</button>
            <button onClick={() => accion('marcar_pagado')} style={E.btn}>Marcar pagado</button>
            <button onClick={() => accion('cancelar')} style={{ ...E.btn3, color: P.rojoTinta, borderColor: '#f0c4bd' }}>Cancelar</button>
          </>
        )}
      </div>

      {lineas.length === 0 ? (
        <div style={{ ...E.card, color: P.suave, fontSize: '0.85rem' }}>
          No hay comisiones en este periodo. Si esperabas ver algo, revisa que las cuentas tengan consultor asignado en la pestaña <b>Atribución</b> y aprieta <b>Recalcular</b>.
        </div>
      ) : (
        <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
            <thead><tr>
              <th style={{ ...E.th, width: 34 }}>
                <input type="checkbox" aria-label="Seleccionar todas"
                  checked={sel.size > 0 && sel.size === lineas.length}
                  onChange={e => setSel(e.target.checked ? new Set(lineas.map((l: any) => l.id)) : new Set())} />
              </th>
              <th style={E.th}>Fecha</th><th style={E.th}>Cliente</th><th style={E.th}>Concepto</th>
              <th style={E.th}>Origen</th><th style={E.th}>Consultor</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Cobrado</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Base</th>
              <th style={{ ...E.th, textAlign: 'right' }}>%</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Comisión</th>
              <th style={E.th}>Estado</th>
            </tr></thead>
            <tbody>
              {lineas.map((l: any) => {
                const tono = ESTADO_TONO[l.estado] || ESTADO_TONO.calculada;
                return (
                  <tr key={l.id} style={l.sin_regla ? { background: P.ambarAgua } : undefined}>
                    <td style={E.td}>
                      <input type="checkbox" aria-label="Seleccionar línea" checked={sel.has(l.id)}
                        onChange={e => { const s = new Set(sel); e.target.checked ? s.add(l.id) : s.delete(l.id); setSel(s); }} />
                    </td>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(l.fecha)}</td>
                    <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{l.companies?.nombre_comercial || l.companies?.nombre || '—'}</td>
                    <td style={E.td}>
                      {l.concepto || <span style={{ color: P.ambarTinta, fontWeight: 700 }}>Sin SKU</span>}
                      <div style={{ fontSize: '0.68rem', color: '#999', marginTop: 2 }}>{explicar(l)}</div>
                    </td>
                    <td style={E.td}>
                      {l.origen ? ORIGEN_LABEL[l.origen] : '—'}
                      {l.tipo === 'override_partner' && <div style={{ ...E.chip, background: P.azulAgua, color: P.azulTinta, marginTop: 3 }}>Override</div>}
                      {l.tasa_reducida && <div style={{ ...E.chip, background: P.ambarAgua, color: P.ambarTinta, marginTop: 3 }}>Tasa reducida</div>}
                      {l.fuera_de_tiempo && <div style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta, marginTop: 3 }}>Cobro tardío</div>}
                      {Number(l.descuento_exceso) > 0 && <div style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta, marginTop: 3 }}>Descuento sobre tope</div>}
                    </td>
                    <td style={E.td}>{l.team_members?.nombre || '—'}</td>
                    <td style={{ ...E.td, textAlign: 'right' }}>{pesos(l.monto_bruto)}</td>
                    <td style={{ ...E.td, textAlign: 'right' }}>{pesos(l.base)}</td>
                    <td style={{ ...E.td, textAlign: 'right', fontWeight: 700 }}>{l.sin_regla ? '—' : `${Number(l.pct)}%`}</td>
                    <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(l.monto)}</td>
                    <td style={E.td}><span style={{ ...E.chip, background: tono.bg, color: tono.fg }}>{tono.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RENOVACIONES  ·  las dos condiciones de la cláusula 4
   ══════════════════════════════════════════════════════════════════ */
function VistaRenovaciones({ movil }: { movil: boolean }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch(`/api/crm/comisiones/renovaciones?anio=${anio}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setD(j);
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio]);

  async function recalcular() {
    setCalculando(true); setError(null);
    try {
      const r = await fetch('/api/crm/comisiones/renovaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setCalculando(false); }
  }

  async function marcarA(company_id: string, valor: boolean | null) {
    const r = await fetch('/api/crm/comisiones/renovaciones', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id, anio, condicion_a: valor }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    await cargar();
  }

  if (cargando && !d) return <Cargando texto="Cargando evaluaciones…" />;
  const r = d?.resumen;

  return (
    <>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ ...E.card, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Cómo se conserva la tasa cada año</div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave, maxWidth: '70ch' }}>
          Hay que cumplir <b>las tres</b>: seguimiento real al cliente, <b>expandir la cuenta un 30% de su plan anual vigente</b> en vitalicias, plugins o servicios, y <b>cobrarle la anualidad a tiempo</b> —antes del vencimiento, el mismo día, o dentro del margen de días del modelo—. La segunda se calcula sola, la tercera sale de la fecha de cada pago, y la primera la marcas tú. <b>Mientras no la marques no se castiga nada</b>: la cuenta cobra su tasa completa.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <label style={E.lbl}>Año</label>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...E.input, minWidth: 110 }}>
            {[0, 1, 2, 3].map(i => { const a = new Date().getFullYear() - i; return <option key={a} value={a}>{a}</option>; })}
          </select>
        </div>
        <button onClick={recalcular} disabled={calculando} style={{ ...E.btn2, opacity: calculando ? 0.6 : 1 }}>
          {calculando ? <><Chispas size={10} /> Calculando…</> : 'Recalcular el 50%'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '170px'}, 1fr))`, gap: 11, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.violeta)}>
          <span style={E.lbl}>Cuentas evaluadas</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta }}>{r?.total ?? 0}</div>
        </div>
        <div style={tarjetaKpi(P.verde)}>
          <span style={E.lbl}>Cumplen el 30%</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.verdeTinta }}>{r?.cumplen_b ?? 0}</div>
        </div>
        <div style={tarjetaKpi(P.ambar)}>
          <span style={E.lbl}>Falta marcar seguimiento</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ambarTinta }}>{r?.sin_marcar_a ?? 0}</div>
        </div>
        <div style={tarjetaKpi(P.rojo)}>
          <span style={E.lbl}>Cobrarán tasa reducida</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.rojoTinta }}>{r?.no_cumplen ?? 0}</div>
        </div>
      </div>

      <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
          <thead><tr>
            <th style={E.th}>Empresa</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Plan anual</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Meta (30%)</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Expansión vendida</th>
            <th style={E.th}>Expansión</th>
            <th style={E.th}>Seguimiento</th>
            <th style={E.th}>Resultado</th>
          </tr></thead>
          <tbody>
            {(d?.evaluaciones || []).length === 0 && (
              <tr><td style={{ ...E.td, color: P.suave }} colSpan={7}>Sin evaluaciones de {anio}. Aprieta «Recalcular el 30%».</td></tr>
            )}
            {(d?.evaluaciones || []).map((e: any) => (
              <tr key={e.id} style={e.cumple === false ? { background: P.rojoAgua } : undefined}>
                <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>
                  {e.companies?.nombre_comercial || e.companies?.nombre || '—'}
                </td>
                <td style={{ ...E.td, textAlign: 'right' }}>{pesos(e.base_anterior)}</td>
                <td style={{ ...E.td, textAlign: 'right' }}>{pesos(e.meta)}</td>
                <td style={{ ...E.td, textAlign: 'right', fontWeight: 700 }}>{pesos(e.vendido)}</td>
                <td style={E.td}>
                  <span style={{ ...E.chip, background: e.cumple_b ? P.verdeAgua : P.ambarAgua, color: e.cumple_b ? P.verdeTinta : P.ambarTinta }}>
                    {e.cumple_b ? 'Cumple' : 'No llega'}
                  </span>
                </td>
                <td style={E.td}>
                  <select value={e.condicion_a == null ? '' : String(e.condicion_a)}
                    onChange={ev => marcarA(e.company_id, ev.target.value === '' ? null : ev.target.value === 'true')}
                    style={{ ...E.input, minWidth: 130 }}>
                    <option value="">Sin evaluar</option>
                    <option value="true">Sí hubo</option>
                    <option value="false">No hubo</option>
                  </select>
                </td>
                <td style={E.td}>
                  {e.cumple == null
                    ? <span style={{ ...E.chip, background: P.lineaSuave, color: P.suave }}>Paga completo</span>
                    : e.cumple
                      ? <span style={{ ...E.chip, background: P.verdeAgua, color: P.verdeTinta }}>Tasa completa</span>
                      : <span style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta }}>Tasa reducida</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
