import { useEffect, useState } from 'react';
import KpiCard from './ui/KpiCard';
import Sheet from './ui/Sheet';
import LeadDrawer from './LeadDrawer';

/* ═══ Finanzas ═══ Mes a mes: qué entró, qué falta por entrar (renovaciones), qué hay que pagar (suscripciones,
   nómina, comisiones…) con su palomita de pagado, qué traen los vendedores en pipeline y la utilidad. Cerrar el mes
   congela los números; el reporte anual los pone en fila. */
const CATS: Record<string, string> = { suscripcion: 'Suscripciones', nomina: 'Nómina', comision: 'Comisiones', marketing: 'Marketing', impuestos: 'Impuestos', otro: 'Otros' };
const PER: Record<string, string> = { mensual: 'Mensual', anual: 'Anual', unico: 'Una vez' };
const pesos = (n: number) => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n || 0)).toLocaleString('es-MX');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const mover = (m: string, d: number) => { const y = Number(m.slice(0, 4)), mm = Number(m.slice(5, 7)) - 1 + d; const dt = new Date(Date.UTC(y, mm, 1)); return dt.toISOString().slice(0, 7); };
const postJ = (body: any) => fetch('/api/crm/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const vacio = { id: '', nombre: '', categoria: 'suscripcion', monto: '', periodicidad: 'mensual', dia_cobro: '', inicio: '', fin: '', proveedor: '', notas: '', probable: false };
const inp = { display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit', boxSizing: 'border-box' as const, fontSize: 13 };
const lbl = { fontSize: 11, color: '#8e88a8', fontWeight: 800 as const };
const hoyCdmx = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
/** Fecha de vencimiento del gasto en el mes: su día de cobro (o el último día si no tiene / si el día no existe). */
const venceEn = (g: any, mes: string) => { const y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)); const ult = new Date(Date.UTC(y, m, 0)).getUTCDate(); const d = Math.min(Number(g.dia_cobro) || ult, ult); return `${mes}-${String(d).padStart(2, '0')}`; };
const diasPara = (fecha: string) => Math.round((Date.parse(fecha) - Date.parse(hoyCdmx())) / 86400e3);
const textoDias = (n: number) => n === 0 ? 'hoy' : n > 0 ? `en ${n} día${n === 1 ? '' : 's'}` : `venció hace ${-n} día${n === -1 ? '' : 's'}`;

export default function FinanzasTab({ pagina }: { pagina?: 'gastos' | 'adeudos' | 'ingresos' | 'cierre' } = {}) {
  const [mes, setMes] = useState(() => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7));
  const [d, setD] = useState<any>(null);
  const [anual, setAnual] = useState<any>(null);
  const [vista, setVistaRaw] = useState<'gastos' | 'adeudos' | 'ingresos' | 'pipeline' | 'cierre'>(pagina || 'gastos');
  const setVista = (v: any) => setVistaRaw(pagina ? (v === 'pipeline' ? 'ingresos' : pagina) : v);
  const [semana, setSemana] = useState<number | null>(null);
  const [fOp, setFOp] = useState<{ tipo: 'todos' | 'nuevo' | 'expansion'; vendedor: string; etapa: string; orden: 'ponderado' | 'valor' | 'dias' | 'vistas' | 'cierre' }>({ tipo: 'todos', vendedor: '', etapa: '', orden: 'ponderado' });
  const [opId, setOpId] = useState<string | null>(null);      // oportunidad abierta en el modal
  const [op, setOp] = useState<any>(null);
  const [opEdit, setOpEdit] = useState<any>({});
  const [leadId, setLeadId] = useState<string | null>(null);  // contacto abierto en el drawer
  const abrirOp = (id: string) => { setOpId(id); setOp(null); setOpEdit({}); fetch(`/api/crm/finanzas?oportunidad=${id}`).then(r => r.json()).then(setOp).catch(() => setOp({ error: 'No se pudo cargar' })); };
  const [form, setForm] = useState<any>(vacio);
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState('');
  const [notas, setNotas] = useState('');
  const [orden, setOrden] = useState<{ k: 'nombre' | 'categoria' | 'dias' | 'monto'; asc: boolean }>({ k: 'dias', asc: true });
  const [detalle, setDetalle] = useState<any>(null);          // gasto abierto en el drawer
  const [det, setDet] = useState<any>(null);                  // su ficha + historial
  const [pago, setPago] = useState({ monto: '', fecha: hoyCdmx(), nota: '' });
  const [abono, setAbono] = useState<Record<string, { monto: string; fecha: string; nota: string }>>({});
  const [adForm, setAdForm] = useState<any>(null);   // alta/edición de adeudo
  const [verAbonos, setVerAbonos] = useState<string | null>(null);
  const abrirDetalle = (g: any) => { setDetalle(g); setDet(null); setPago({ monto: String(g.pago?.monto ?? g.monto), fecha: hoyCdmx(), nota: g.pago?.nota || '' }); fetch(`/api/crm/finanzas?gasto=${g.id}`).then(r => r.json()).then(setDet).catch(() => setDet({ error: 'No se pudo cargar' })); };
  const cargar = () => { fetch(`/api/crm/finanzas?mes=${mes}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' })); fetch(`/api/crm/finanzas?reporte=anual&anio=${mes.slice(0, 4)}`).then(r => r.json()).then(setAnual).catch(() => {}); };
  useEffect(() => { setD(null); cargar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = async () => { setMsg(''); const j = await postJ({ accion: 'gasto_guardar', gasto: form }); if (j.error) { setMsg(j.error); return; } setForm(vacio); setAbierto(false); setMsg('Guardado.'); cargar(); };
  const pagar = async (g: any, pagado: boolean) => { await postJ({ accion: 'gasto_pagar', gasto_id: g.id, mes, pagado }); cargar(); };
  const chip = (on: boolean) => ({ border: `1px solid ${on ? '#5B4BD6' : '#e8e5f0'}`, background: on ? '#EEECFE' : '#fff', color: on ? '#4c1d95' : '#4a4658', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' });
  const th = { textAlign: 'left' as const, padding: '8px 12px', fontWeight: 800, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: '#8e88a8', background: '#faf9fc' };
  const td = { padding: '8px 12px', borderTop: '1px solid #f0eef6', fontSize: 12.5 };
  const cerrado = !!d?.cierre;
  /* La categoría que se está mirando en la tabla de gastos. Las pastillas eran
     solo informativas: decían cuánto suma cada rubro y no se podía hacer nada
     con ellas. Como pestañas, el mismo dato SIRVE: dices «nómina» y ves la
     nómina. */
  const [catTab, setCatTab] = useState<string>('todos');
  const filasGasto = (() => { if (!d) return []; const xs = d.gastos.lista.filter((g: any) => catTab === 'todos' || g.categoria === catTab).map((g: any) => ({ ...g, vence: venceEn(g, mes), dias: diasPara(venceEn(g, mes)) })); const dir = orden.asc ? 1 : -1; return xs.sort((a: any, b: any) => { if (orden.k === 'monto') return (Number(a.monto) - Number(b.monto)) * dir; if (orden.k === 'dias') { if (!!a.pago !== !!b.pago) return a.pago ? 1 : -1; return (a.dias - b.dias) * dir; } return String(a[orden.k] || '').localeCompare(String(b[orden.k] || ''), 'es') * dir; }); })();
  const thSort = (k: typeof orden.k, l: string, right?: boolean) => <th style={{ ...th, textAlign: right ? 'right' : 'left', cursor: 'pointer', userSelect: 'none', color: orden.k === k ? '#4c1d95' : th.color }} onClick={() => setOrden(o => ({ k, asc: o.k === k ? !o.asc : k !== 'monto' }))} title="Ordenar">{l}{orden.k === k ? (orden.asc ? ' ↑' : ' ↓') : ''}</th>;
  return (
    <div style={{ padding: '18px 22px 60px', maxWidth: 1180, margin: '0 auto', color: '#241d43' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#5B4BD6' }}>Finanzas{pagina ? ` · ${({ gastos: 'Gastos', adeudos: 'Adeudos', ingresos: 'Ingresos y flujo', cierre: 'Cierre mensual y anual' } as any)[pagina]}` : ''}</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 26, textTransform: 'capitalize' }}>{nombreMes(mes)} {cerrado && <span style={{ fontSize: 12, verticalAlign: 'middle', background: '#dcfce7', color: '#14532d', borderRadius: 999, padding: '3px 10px', textTransform: 'none', fontWeight: 800 }}>Mes cerrado</span>}</h1>
          <p style={{ margin: 0, color: '#6b6580', fontSize: 13.5 }}>Lo que entró, lo que falta por entrar, lo que hay que pagar y lo que queda.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={chip(false)} onClick={() => setMes(mover(mes, -1))}>‹ {MESES[Number(mover(mes, -1).slice(5, 7)) - 1]}</button>
          <button style={chip(true)} onClick={() => setMes(new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7))}>Hoy</button>
          <button style={chip(false)} onClick={() => setMes(mover(mes, 1))}>{MESES[Number(mover(mes, 1).slice(5, 7)) - 1]} ›</button>
          {/* La acción principal vive ARRIBA, con los controles del mes. Estaba
              enterrada entre las pastillas y la tabla, a media pantalla: es lo
              que más se hace en esta vista y había que ir a buscarla. */}
          {vista === 'gastos' && d && !d.error && (
            <button onClick={() => { setForm({ ...vacio, inicio: mes }); setAbierto(true); }}
              style={{ marginLeft: 6, border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ Agregar gasto</button>
          )}
        </div>
      </div>
      {!d && <p style={{ color: '#8e88a8', marginTop: 20 }}>Calculando…</p>}
      {d?.error && <p style={{ color: '#b91c1c' }}>{d.error}</p>}
      {d && !d.error && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
          <KpiCard label="Cobrado este mes (neto)" valor={pesos(d.ingresos.cobrado_neto ?? d.ingresos.cobrado)} color="#14532d" sub={`${d.ingresos.pagos.length} pagos · bruto ${pesos(d.ingresos.cobrado)}${d.ingresos.comisiones_pasarela ? ` · pasarela −${pesos(d.ingresos.comisiones_pasarela)}` : ''}`} onClick={() => setVista('ingresos')} activo={vista === 'ingresos'} />
          <KpiCard label="Por cobrar (renovaciones)" valor={pesos(d.ingresos.por_cobrar)} color="#1e3a8a" sub={`${d.ingresos.por_cobrar_lista.length} suscripciones vencen este mes`} onClick={() => setVista('ingresos')} activo={false} />
          <KpiCard label="Por cobrar de venta nueva" valor={pesos(d.ingresos.ventas_aceptadas || 0)} color="#1e3a8a" sub={`${(d.ingresos.ventas_aceptadas_lista || []).length} cotizaciones aceptadas sin pago`} onClick={() => setVista('ingresos')} activo={false} />
          <KpiCard label="Gastos del mes" valor={pesos(d.utilidad.total_gastos)} color="#7f1d1d" sub={`${pesos(d.gastos.pagado)} pagados de ${pesos(d.gastos.previsto)}${d.gastos.por_categoria.comision ? '' : ` + ${pesos(d.comisiones.total)} comisiones`}${d.adeudos?.toca ? ` + ${pesos(d.adeudos.toca)} adeudos` : ''}${d.atrasados?.total ? ` + ${pesos(d.atrasados.total)} atrasados` : ''}`} onClick={() => setVista('gastos')} activo={vista === 'gastos'} />
          <KpiCard label="Pipeline ponderado" valor={pesos(d.pipeline.ponderado)} color="#78350f" sub={`${d.pipeline.abiertos.length} oportunidades · ${pesos(d.pipeline.total)} brutos · ${pesos(d.pipeline.esperado_mes || 0)} con cierre este mes`} onClick={() => setVista('pipeline')} activo={vista === 'pipeline'} />
          <KpiCard label="Utilidad estimada" valor={pesos(d.utilidad.estimada)} color={d.utilidad.estimada >= 0 ? '#14532d' : '#7f1d1d'} sub={`${pesos(d.utilidad.si_cobra_todo)} si cobras todo lo del mes`} onClick={() => setVista('cierre')} activo={vista === 'cierre'} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
          {!pagina && (['gastos', 'adeudos', 'ingresos', 'pipeline', 'cierre'] as const).map(v => <button key={v} style={chip(vista === v)} onClick={() => setVista(v)}>{{ gastos: 'Gastos y suscripciones', adeudos: 'Adeudos', ingresos: 'Ingresos y flujo', pipeline: 'Pipeline de ventas', cierre: 'Cierre y reporte anual' }[v]}</button>)}
        </div>

        {vista === 'gastos' && (
          <div style={{ marginTop: 14 }}>
            {/* Lo que NO es una categoría de la tabla se queda como dato al
                margen: las variables estimadas y la publicidad del embudo no
                tienen renglones que filtrar, y ponerlas de pestaña prometería
                una lista que no existe. */}
            {(d.variables?.probables > 0 || d.variables?.marketing_real > 0) && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: '#6b6580' }}>
                {d.variables?.probables > 0 && <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: '#fbbf24', marginRight: 6 }} />Variables estimadas <b style={{ color: '#241d43' }}>{pesos(d.variables.probables)}</b></span>}
                {d.variables?.marketing_real > 0 && <span>Publicidad real (Embudo) <b style={{ color: '#241d43' }}>{pesos(d.variables.marketing_real)}</b></span>}
              </div>
            )}
            {abierto && (
              <div style={{ marginTop: 12, background: '#fff', border: '1px solid #d9d4ea', borderRadius: 14, padding: 16 }}>
                <b>{form.id ? 'Editar gasto' : 'Nuevo gasto'}</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
                  <label style={lbl}>Nombre<input style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Vercel, Kapso, Andrea…" /></label>
                  <label style={lbl}>Categoría<select style={inp} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label style={lbl}>Monto MXN<input style={inp} type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></label>
                  <label style={lbl}>Periodicidad<select style={inp} value={form.periodicidad} onChange={e => setForm({ ...form, periodicidad: e.target.value })}>{Object.entries(PER).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label style={lbl}>Día de cobro<input style={inp} type="number" min={1} max={31} value={form.dia_cobro} onChange={e => setForm({ ...form, dia_cobro: e.target.value })} /></label>
                  <label style={lbl}>Desde (mes)<input style={inp} type="month" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label>
                  <label style={lbl}>Hasta (opcional)<input style={inp} type="month" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} /></label>
                  <label style={lbl}>Proveedor<input style={inp} value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></label>
                  <label style={{ ...lbl, gridColumn: '1 / -1' }}>Notas<input style={inp} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} /></label>
                  <label style={{ ...lbl, gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!form.probable} onChange={e => setForm({ ...form, probable: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#5B4BD6' }} />Variable probable: no es fijo, es un estimado (publicidad, viáticos…). Si capturas la inversión real en Embudo, sustituye al estimado.</label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={guardar} disabled={!form.nombre || form.monto === ''} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
                  <button onClick={() => { setAbierto(false); setForm(vacio); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                  {form.id && <button onClick={async () => { if (!confirm('¿Borrar este gasto de todos los meses?')) return; await postJ({ accion: 'gasto_borrar', id: form.id }); setAbierto(false); setForm(vacio); cargar(); }} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Borrar</button>}
                </div>
                {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: '#14532d', fontWeight: 700 }}>{msg}</div>}
              </div>
            )}
            <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              {/* ══ PESTAÑAS DE CATEGORÍA, PEGADAS A LA TABLA ══
                  Eran pastillas sueltas flotando entre los KPIs y la tabla:
                  decían cuánto suma cada rubro y no se podía hacer nada con
                  ellas, y de paso separaban la tabla de su propio resumen.
                  Como pestañas el mismo número SIRVE —tocas «Nómina» y ves la
                  nómina— y se lee como lo que es: el índice de esta tabla.
                  Ordenadas de mayor a menor: lo que más pesa, primero. */}
              {(() => {
                const cats = Object.entries(d.gastos.por_categoria as Record<string, any>)
                  .sort((a: any, b: any) => Number(b[1].previsto) - Number(a[1].previsto));
                const total = cats.reduce((s: number, [, v]: any) => s + Number(v.previsto || 0), 0);
                const pagadoTotal = cats.reduce((s: number, [, v]: any) => s + Number(v.pagado || 0), 0);
                const tabs: [string, string, number, number][] = [
                  ['todos', 'Todos', total, pagadoTotal],
                  ...cats.map(([c, v]: any) => [c, CATS[c] || c, Number(v.previsto || 0), Number(v.pagado || 0)] as [string, string, number, number]),
                ];
                return (
                  <div style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '1px solid #ecebf2', padding: '0 6px' }}>
                    {tabs.map(([k, l, prev, pag]) => {
                      const on = catTab === k;
                      return (
                        <button key={k} onClick={() => setCatTab(k)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            padding: '11px 14px 9px', borderBottom: `2px solid ${on ? '#5B4BD6' : 'transparent'}`,
                            color: on ? '#241d43' : '#6b6580', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <span style={{ display: 'block', fontSize: 12.5, fontWeight: on ? 800 : 600 }}>{l}</span>
                          <span style={{ display: 'block', fontSize: 11, color: on ? '#5B4BD6' : '#a5a0b8', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                            {pesos(prev)}{pag > 0 ? ` · ${pesos(pag)} pagado` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead><tr><th style={th}>Pagado</th>{thSort('nombre', 'Gasto')}{thSort('categoria', 'Categoría')}<th style={th}>Periodicidad</th>{thSort('dias', 'Vence')}{thSort('monto', 'Monto', true)}<th style={th}></th></tr></thead>
                <tbody>
                  {filasGasto.map((g: any) => (
                    <tr key={g.id} style={{ opacity: g.pago ? .75 : 1, cursor: 'pointer' }} onClick={() => abrirDetalle(g)}>
                      <td style={td} onClick={e => e.stopPropagation()}><input type="checkbox" checked={!!g.pago} onChange={e => pagar(g, e.target.checked)} title={g.pago ? `Pagado ${new Date(g.pago.pagado_at).toLocaleDateString('es-MX')}` : 'Marcar como pagado este mes'} style={{ width: 18, height: 18, accentColor: '#5B4BD6', cursor: 'pointer' }} /></td>
                      <td style={td}><b>{g.nombre}</b>{g.proveedor ? <span style={{ color: '#6b6580' }}> · {g.proveedor}</span> : null}{g.probable ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '1px 7px' }}>variable</span> : null}{g.notas ? <div style={{ color: '#8e88a8', fontSize: 11 }}>{g.notas}</div> : null}</td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>{CATS[g.categoria] || g.categoria}</span></td>
                      <td style={td}>{PER[g.periodicidad] || g.periodicidad}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{g.pago ? <span style={{ color: '#14532d', fontWeight: 700 }}>pagado {new Date(g.pago.pagado_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span> : <span style={{ fontWeight: 800, color: g.dias < 0 ? '#b91c1c' : g.dias <= 3 ? '#b45309' : '#241d43' }}>{textoDias(g.dias)}</span>}<div style={{ color: '#8e88a8', fontSize: 11 }}>{g.dia_cobro ? `día ${g.dia_cobro}` : 'fin de mes'}</div></td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(g.monto)}</td>
                      <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}><button onClick={() => { setForm({ id: g.id, nombre: g.nombre, categoria: g.categoria, monto: g.monto, periodicidad: g.periodicidad, dia_cobro: g.dia_cobro || '', inicio: String(g.inicio).slice(0, 7), fin: g.fin ? String(g.fin).slice(0, 7) : '', proveedor: g.proveedor || '', notas: g.notas || '', probable: !!g.probable }); setAbierto(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Editar</button></td>
                    </tr>
                  ))}
                  {/* Con un filtro puesto, «todavía no capturas gastos» sería
                      mentira: los hay, pero en otra pestaña. */}
                  {!filasGasto.length && (
                    <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#8e88a8', padding: 20 }}>
                      {catTab !== 'todos'
                        ? <>Sin gastos de <b>{CATS[catTab] || catTab}</b> este mes. <button onClick={() => setCatTab('todos')} style={{ border: 'none', background: 'none', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>Ver todos</button></>
                        : 'Todavía no capturas gastos. Empieza por las suscripciones que pagas cada mes.'}
                    </td></tr>
                  )}
                  {(d.comisiones.cortes || []).length > 0 && !d.gastos.por_categoria.comision && (<>
                    <tr><td colSpan={7} style={{ ...td, background: '#faf9fc', fontSize: 11, fontWeight: 800, color: '#8e88a8', letterSpacing: '.06em', textTransform: 'uppercase' }}>Comisiones: cortes que se pagan los lunes ({pesos(d.comisiones.por_pagar)} por pagar)</td></tr>
                    {d.comisiones.cortes.map((c: any) => <tr key={c.id} style={{ opacity: c.pagado ? .7 : 1 }}><td style={td}><input type="checkbox" checked={c.pagado} readOnly title="Se marca pagado desde Comisiones" style={{ width: 18, height: 18, accentColor: '#5B4BD6' }} /></td><td style={td}><b>{c.vendedor}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>corte {c.desde} → {c.hasta} · {c.aceptado ? 'aceptado por la vendedora' : c.estado}</div></td><td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>Comisiones</span></td><td style={td}>Lunes</td><td style={td}>{c.paga_el}</td><td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(c.monto)}</td><td style={td}></td></tr>)}
                  </>)}
                  {!(d.comisiones.cortes || []).length && Object.keys(d.comisiones.por_vendedor).length > 0 && !d.gastos.por_categoria.comision && (<>
                    <tr><td colSpan={7} style={{ ...td, background: '#faf9fc', fontSize: 11, fontWeight: 800, color: '#8e88a8', letterSpacing: '.06em', textTransform: 'uppercase' }}>Comisiones calculadas por el sistema (pagos del mes, aún sin corte)</td></tr>
                    {Object.entries(d.comisiones.por_vendedor).map(([n, m]: any) => <tr key={n}><td style={td}></td><td style={td}><b>{n}</b></td><td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>Comisiones</span></td><td style={td}>Mensual</td><td style={td}>—</td><td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(m)}</td><td style={td}></td></tr>)}
                  </>)}
                </tbody>
              </table></div>
            </div>

            {/* ATRASADOS: lo que no se pagó en meses anteriores se junta aquí */}
            {(d.atrasados?.lista || []).length > 0 && (
              <div style={{ marginTop: 14, background: '#fff', border: '1px solid #fecdd3', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><b style={{ color: '#7f1d1d' }}>Atrasado de meses anteriores</b><span style={{ color: '#7f1d1d', fontWeight: 800 }}>{pesos(d.atrasados.total)}</span></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                  {d.atrasados.lista.map((g: any) => <tr key={`${g.id}:${g.mes}`}><td style={td}><b>{g.nombre}</b> <span style={{ color: '#8e88a8', fontSize: 11, textTransform: 'capitalize' }}>· {nombreMes(g.mes)}</span></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(g.monto)}</td><td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><button onClick={async () => { await postJ({ accion: 'gasto_pagar', gasto_id: g.id, mes: g.mes, pagado: true }); cargar(); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Ya lo pagué</button></td></tr>)}
                </tbody></table>
              </div>
            )}

          </div>
        )}

        {(vista === 'adeudos' || (vista === 'gastos' && !pagina)) && (
          <div style={{ marginTop: 14 }}>
            {/* ADEUDOS: total, saldo, cuota del mes, atraso y abonos */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div><b style={{ fontSize: 15 }}>Adeudos</b> <span style={{ color: '#6b6580', fontSize: 12.5 }}>· saldo total {pesos(d.adeudos?.saldo_total || 0)} · toca este mes {pesos(d.adeudos?.toca || 0)} · abonado {pesos(d.adeudos?.abonado || 0)}</span></div>
                <button onClick={() => setAdForm({ id: '', nombre: '', acreedor: '', total: '', cuota: '', dia_pago: '', inicio: mes, fecha_limite: '', notas: '' })} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ Agregar adeudo</button>
              </div>
              {adForm && (
                <div style={{ marginTop: 10, background: '#fff', border: '1px solid #d9d4ea', borderRadius: 14, padding: 16 }}>
                  <b>{adForm.id ? 'Editar adeudo' : 'Nuevo adeudo'}</b>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
                    <label style={lbl}>Nombre<input style={inp} value={adForm.nombre} onChange={e => setAdForm({ ...adForm, nombre: e.target.value })} /></label>
                    <label style={lbl}>Acreedor<input style={inp} value={adForm.acreedor} onChange={e => setAdForm({ ...adForm, acreedor: e.target.value })} /></label>
                    <label style={lbl}>Total que se debe<input style={inp} type="number" value={adForm.total} onChange={e => setAdForm({ ...adForm, total: e.target.value })} /></label>
                    <label style={lbl}>Cuota mensual (opcional)<input style={inp} type="number" value={adForm.cuota} onChange={e => setAdForm({ ...adForm, cuota: e.target.value })} placeholder="si hay fecha límite se calcula" /></label>
                    <label style={lbl}>Día de pago<input style={inp} type="number" min={1} max={31} value={adForm.dia_pago} onChange={e => setAdForm({ ...adForm, dia_pago: e.target.value })} /></label>
                    <label style={lbl}>Desde (mes)<input style={inp} type="month" value={adForm.inicio} onChange={e => setAdForm({ ...adForm, inicio: e.target.value })} /></label>
                    <label style={lbl}>Fecha límite (opcional)<input style={inp} type="date" value={adForm.fecha_limite} onChange={e => setAdForm({ ...adForm, fecha_limite: e.target.value })} /></label>
                    <label style={{ ...lbl, gridColumn: '1 / -1' }}>Notas<input style={inp} value={adForm.notas} onChange={e => setAdForm({ ...adForm, notas: e.target.value })} /></label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={async () => { const j = await postJ({ accion: 'adeudo_guardar', adeudo: adForm }); if (j.error) { setMsg(j.error); return; } setAdForm(null); cargar(); }} disabled={!adForm.nombre || !adForm.total} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
                    <button onClick={() => setAdForm(null)} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    {adForm.id && <button onClick={async () => { if (!confirm('¿Quitar este adeudo de Finanzas? (se conserva el historial)')) return; await postJ({ accion: 'adeudo_borrar', id: adForm.id }); setAdForm(null); cargar(); }} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar</button>}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 10 }}>
                {(d.adeudos?.lista || []).map((a: any) => { const pct = Math.min(100, Math.round(a.pagado_total / Number(a.total) * 100)); const ab = abono[a.id] || { monto: String(a.toca_este_mes - a.abonado_mes > 0 ? a.toca_este_mes - a.abonado_mes : a.cuota_mes || ''), fecha: hoyCdmx(), nota: '' }; return (
                  <div key={a.id} style={{ background: '#fff', border: `1px solid ${a.liquidado ? '#86efac' : a.atraso > 0 ? '#fecdd3' : '#e8e5f0'}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div><b style={{ fontSize: 15 }}>{a.nombre}</b>{a.acreedor && a.acreedor !== a.nombre ? <span style={{ color: '#6b6580' }}> · {a.acreedor}</span> : null}<div style={{ color: '#8e88a8', fontSize: 11.5 }}>{a.dia_pago ? `día ${a.dia_pago}` : ''}{a.fecha_limite ? ` · límite ${a.fecha_limite}` : ''}{a.meses_restantes ? ` · ${a.meses_restantes} mes${a.meses_restantes === 1 ? '' : 'es'}` : ''}</div></div>
                      <button onClick={() => setAdForm({ id: a.id, nombre: a.nombre, acreedor: a.acreedor || '', total: a.total, cuota: a.cuota || '', dia_pago: a.dia_pago || '', inicio: String(a.inicio).slice(0, 7), fecha_limite: a.fecha_limite || '', notas: a.notas || '' })} style={{ border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Editar</button>
                    </div>
                    <div style={{ marginTop: 10, height: 8, background: '#f0eef6', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: a.liquidado ? '#22c55e' : '#5B4BD6' }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b6580', marginTop: 4 }}><span>Pagado {pesos(a.pagado_total)} ({pct}%)</span><span>Saldo <b style={{ color: '#241d43' }}>{pesos(a.saldo)}</b> de {pesos(a.total)}</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
                      <div><div style={{ fontSize: 10, fontWeight: 800, color: '#8e88a8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Cuota</div><div style={{ fontWeight: 800 }}>{a.sin_cuota ? <span style={{ color: '#b45309' }}>define la cuota</span> : pesos(a.cuota_mes)}</div></div>
                      <div><div style={{ fontSize: 10, fontWeight: 800, color: '#8e88a8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Toca este mes</div><div style={{ fontWeight: 800, color: a.atraso > 0 ? '#b91c1c' : '#241d43' }}>{pesos(a.toca_este_mes)}{a.atraso > 0 ? <div style={{ fontSize: 11, fontWeight: 700 }}>incluye {pesos(a.atraso)} atrasado</div> : null}</div></div>
                      <div><div style={{ fontSize: 10, fontWeight: 800, color: '#8e88a8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Abonado en {MESES[Number(mes.slice(5, 7)) - 1]}</div><div style={{ fontWeight: 800, color: a.abonado_mes >= a.toca_este_mes && a.toca_este_mes > 0 ? '#14532d' : '#241d43' }}>{pesos(a.abonado_mes)}</div></div>
                    </div>
                    {!a.liquidado && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                        <input style={{ ...inp, marginTop: 0 }} type="number" placeholder="Monto" value={ab.monto} onChange={e => setAbono({ ...abono, [a.id]: { ...ab, monto: e.target.value } })} />
                        <input style={{ ...inp, marginTop: 0 }} type="date" value={ab.fecha} onChange={e => setAbono({ ...abono, [a.id]: { ...ab, fecha: e.target.value } })} />
                        <input style={{ ...inp, marginTop: 0, gridColumn: '1 / -1' }} placeholder="Nota (referencia)" value={ab.nota} onChange={e => setAbono({ ...abono, [a.id]: { ...ab, nota: e.target.value } })} />
                        <button onClick={async () => { if (!(Number(ab.monto) > 0)) return; await postJ({ accion: 'adeudo_abonar', adeudo_id: a.id, mes, monto: ab.monto, fecha: ab.fecha, nota: ab.nota }); setAbono({ ...abono, [a.id]: { monto: '', fecha: hoyCdmx(), nota: '' } }); cargar(); }} style={{ gridColumn: '1 / -1', border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Registrar abono</button>
                      </div>
                    )}
                    <button onClick={() => setVerAbonos(verAbonos === a.id ? null : a.id)} style={{ marginTop: 8, border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>{verAbonos === a.id ? 'Ocultar abonos' : `Ver abonos (${a.abonos.length})`}</button>
                    {verAbonos === a.id && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><tbody>
                        {a.abonos.map((x: any) => <tr key={x.id} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '6px 2px' }}>{x.fecha}</td><td style={{ padding: '6px 2px', color: '#6b6580' }}>{x.nota || ''}</td><td style={{ padding: '6px 2px', textAlign: 'right', fontWeight: 800 }}>{pesos(x.monto)}</td><td style={{ padding: '6px 2px', textAlign: 'right' }}><button onClick={async () => { if (!confirm('¿Borrar este abono?')) return; await postJ({ accion: 'abono_borrar', id: x.id }); cargar(); }} style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>borrar</button></td></tr>)}
                        {!a.abonos.length && <tr><td style={{ padding: 8, color: '#8e88a8' }}>Sin abonos todavía.</td></tr>}
                      </tbody></table>
                    )}
                    {a.notas && <div style={{ marginTop: 6, fontSize: 11.5, color: '#8e88a8' }}>{a.notas}</div>}
                  </div>
                ); })}
                {!(d.adeudos?.lista || []).length && <div style={{ color: '#8e88a8', fontSize: 12.5 }}>Sin adeudos activos.</div>}
              </div>
            </div>
            {vista === 'adeudos' && (d.adeudos?.lista || []).length > 0 && (
              <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, padding: 16 }}>
                <b style={{ fontSize: 15 }}>Proyección</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}><thead><tr style={{ color: '#8e88a8', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: '6px 8px' }}>Adeudo</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Saldo</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Cuota</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Meses que faltan</th><th style={{ textAlign: 'left', padding: '6px 8px' }}>Se liquida</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Atraso</th></tr></thead>
                  <tbody>{d.adeudos.lista.map((a: any) => { const meses = a.cuota_mes ? Math.ceil(a.saldo / a.cuota_mes) : null; const fin = meses ? mover(mes, meses - 1) : null; return <tr key={a.id} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '8px', fontWeight: 800 }}>{a.nombre}</td><td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pesos(a.saldo)}</td><td style={{ padding: '8px', textAlign: 'right' }}>{a.cuota_mes ? pesos(a.cuota_mes) : <span style={{ color: '#b45309' }}>sin cuota</span>}</td><td style={{ padding: '8px', textAlign: 'right' }}>{meses ?? '—'}</td><td style={{ padding: '8px', textTransform: 'capitalize' }}>{fin ? nombreMes(fin) : '—'}{a.fecha_limite ? <div style={{ fontSize: 11, color: fin && fin > a.fecha_limite.slice(0, 7) ? '#b91c1c' : '#8e88a8' }}>límite {a.fecha_limite}</div> : null}</td><td style={{ padding: '8px', textAlign: 'right', color: a.atraso > 0 ? '#b91c1c' : undefined, fontWeight: a.atraso > 0 ? 800 : undefined }}>{a.atraso > 0 ? pesos(a.atraso) : '—'}</td></tr>; })}</tbody></table>
              </div>
            )}
          </div>
        )}

        {vista === 'ingresos' && (d.flujo || []).length > 0 && (
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><b>Flujo de caja por semana</b><span style={{ color: '#6b6580', fontSize: 12.5 }}>Cobrado neto real + renovaciones + venta nueva, contra gastos, adeudos, comisiones y atrasados. Toca una semana para ver el detalle.</span></div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={th}>Semana</th><th style={{ ...th, textAlign: 'right' }}>Entradas</th><th style={{ ...th, textAlign: 'right' }}>Salidas</th><th style={{ ...th, textAlign: 'right' }}>Neto</th><th style={{ ...th, textAlign: 'right' }}>Acumulado</th></tr></thead>
              <tbody>{d.flujo.map((s: any) => (<>
                <tr key={s.n} onClick={() => setSemana(semana === s.n ? null : s.n)} style={{ cursor: 'pointer', background: semana === s.n ? '#faf9fc' : undefined }}><td style={td}><b>Semana {s.n}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>{s.desde.slice(8)} al {s.hasta.slice(8)}</div></td><td style={{ ...td, textAlign: 'right', color: '#14532d', fontVariantNumeric: 'tabular-nums' }}>{pesos(s.entradas)}</td><td style={{ ...td, textAlign: 'right', color: '#7f1d1d', fontVariantNumeric: 'tabular-nums' }}>{pesos(s.salidas)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: s.neto >= 0 ? '#14532d' : '#7f1d1d' }}>{pesos(s.neto)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: s.acumulado >= 0 ? '#14532d' : '#7f1d1d' }}>{pesos(s.acumulado)}</td></tr>
                {semana === s.n && <tr key={s.n + 'd'}><td colSpan={5} style={{ ...td, background: '#faf9fc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#14532d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Entradas</div>{s.detalle_entradas.map((x: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '3px 0' }}><span>{x.fecha.slice(8)} · {x.que} <span style={{ color: '#8e88a8' }}>{x.real ? '' : `(${x.tipo === 'renovacion' ? 'por cobrar' : 'esperado'})`}</span></span><b>{pesos(x.monto)}</b></div>)}{!s.detalle_entradas.length && <div style={{ color: '#8e88a8', fontSize: 12.5 }}>Nada esta semana.</div>}</div>
                    <div><div style={{ fontSize: 10.5, fontWeight: 800, color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Salidas</div>{s.detalle_salidas.map((x: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '3px 0', opacity: x.real ? .7 : 1 }}><span>{x.fecha.slice(8)} · {x.que} <span style={{ color: '#8e88a8' }}>{x.real ? '(pagado)' : ''}</span></span><b>{pesos(x.monto)}</b></div>)}{!s.detalle_salidas.length && <div style={{ color: '#8e88a8', fontSize: 12.5 }}>Nada esta semana.</div>}</div>
                  </div></td></tr>}
              </>))}</tbody>
            </table></div>
          </div>
        )}

        {vista === 'ingresos' && (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Por cobrar este mes</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.por_cobrar)} en {d.ingresos.por_cobrar_lista.length} renovaciones</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {d.ingresos.por_cobrar_lista.map((s: any) => <tr key={s.id}><td style={td}><b>{s.companies?.nombre_comercial || s.companies?.nombre || 'Cuenta'}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>{s.nombre_plan} · {s.ciclo} · vence {s.proxima_factura}{s.cobranza_estado ? ` · ${s.cobranza_estado}` : ''}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(s.monto)}</td></tr>)}
                {!d.ingresos.por_cobrar_lista.length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Nada pendiente de cobrar este mes.</td></tr>}
              </tbody></table>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Venta nueva aceptada sin pago</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.ventas_aceptadas || 0)}</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {(d.ingresos.ventas_aceptadas_lista || []).map((q: any) => <tr key={q.id}><td style={td}><b>{q.companies?.nombre_comercial || q.companies?.nombre || q.contacts?.nombre || 'Cotización'}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>#{q.numero || 's/n'} · aceptada {String(q.updated_at).slice(0, 10)}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(q.monto)}</td></tr>)}
                {!(d.ingresos.ventas_aceptadas_lista || []).length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Ninguna cotización aceptada pendiente de pago.</td></tr>}
              </tbody></table>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Cobrado</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.cobrado)} en {d.ingresos.pagos.length} pagos</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {d.ingresos.pagos.map((p: any) => <tr key={p.id}><td style={td}><b>{p.companies?.nombre_comercial || p.companies?.nombre || p.contacts?.nombre || 'Pago'}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>{p.fecha} · {p.metodo || p.pasarela || ''}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(p.monto)}</td></tr>)}
                {!d.ingresos.pagos.length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Sin pagos confirmados todavía.</td></tr>}
              </tbody></table>
            </div>
          </div>
        )}

        {(vista === 'pipeline' || (vista === 'ingresos' && pagina)) && (() => {
          const ETQ: Record<string, string> = { calificacion: 'Calificación', demo_agendada: 'Demo agendada', demo_realizada: 'Demo realizada', cotizacion_enviada: 'Cotización enviada', negociacion: 'Negociación', aceptada: 'Aceptada' };
          const vendedores = [...new Set(d.pipeline.abiertos.map((o: any) => o.team_members?.nombre || 'Sin vendedor'))] as string[];
          const etapas = [...new Set(d.pipeline.abiertos.map((o: any) => o.stage))] as string[];
          let lista = d.pipeline.abiertos.filter((o: any) => (fOp.tipo === 'todos' || (fOp.tipo === 'expansion' ? o.expansion : !o.expansion)) && (!fOp.vendedor || (o.team_members?.nombre || 'Sin vendedor') === fOp.vendedor) && (!fOp.etapa || o.stage === fOp.etapa));
          lista = [...lista].sort((a: any, b: any) => fOp.orden === 'valor' ? b.valor - a.valor : fOp.orden === 'dias' ? b.dias_etapa - a.dias_etapa : fOp.orden === 'vistas' ? b.vistas - a.vistas : fOp.orden === 'cierre' ? String(a.fecha_cierre_esperada || '9999').localeCompare(String(b.fecha_cierre_esperada || '9999')) : b.valor * b.prob - a.valor * a.prob);
          const tot = lista.reduce((x: number, o: any) => x + o.valor, 0), pond = lista.reduce((x: number, o: any) => x + o.valor * o.prob / 100, 0);
          const fechaC = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
          const ch = (on: boolean) => ({ border: `1px solid ${on ? '#5B4BD6' : '#e8e5f0'}`, background: on ? '#EEECFE' : '#fff', color: on ? '#4c1d95' : '#4a4658', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' });
          return (<div style={{ marginTop: 14 }}>
            {/* Forecast por vendedor + conversión por canal */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0eef6' }}><b>Forecast por vendedor</b> <span style={{ color: '#8e88a8', fontSize: 12 }}>· comprometido = probabilidad ≥ 60 %</span></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><th style={th}>Vendedor</th><th style={{ ...th, textAlign: 'right' }}>Op.</th><th style={{ ...th, textAlign: 'right' }}>Bruto</th><th style={{ ...th, textAlign: 'right' }}>Comprometido</th><th style={{ ...th, textAlign: 'right' }}>Probable</th><th style={{ ...th, textAlign: 'right' }}>Este mes</th></tr></thead>
                  <tbody>{(d.pipeline.forecast || []).map((fc: any) => <tr key={fc.vendedor} style={{ cursor: 'pointer' }} onClick={() => setFOp({ ...fOp, vendedor: fOp.vendedor === fc.vendedor ? '' : fc.vendedor })}><td style={{ ...td, fontWeight: 800 }}>{fc.vendedor}</td><td style={{ ...td, textAlign: 'right' }}>{fc.n}</td><td style={{ ...td, textAlign: 'right' }}>{pesos(fc.total)}</td><td style={{ ...td, textAlign: 'right' }}>{pesos(fc.comprometido)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{pesos(fc.ponderado)}</td><td style={{ ...td, textAlign: 'right' }}>{pesos(fc.este_mes)}</td></tr>)}</tbody></table>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0eef6' }}><b>Conversión por canal</b> <span style={{ color: '#8e88a8', fontSize: 12 }}>· cerradas en 90 días</span></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}><thead><tr><th style={th}>Canal</th><th style={{ ...th, textAlign: 'right' }}>Ganadas</th><th style={{ ...th, textAlign: 'right' }}>Perdidas</th><th style={{ ...th, textAlign: 'right' }}>Tasa</th></tr></thead>
                  <tbody>{(d.pipeline.conversion || []).map((c: any) => <tr key={c.canal}><td style={td}>{c.canal}</td><td style={{ ...td, textAlign: 'right', color: '#14532d' }}>{c.ganadas}</td><td style={{ ...td, textAlign: 'right', color: '#7f1d1d' }}>{c.perdidas}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{c.pct == null ? '—' : `${c.pct}%`}</td></tr>)}{!(d.pipeline.conversion || []).length && <tr><td colSpan={4} style={{ ...td, color: '#8e88a8', textAlign: 'center' }}>Sin cierres en 90 días.</td></tr>}</tbody></table>
              </div>
            </div>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              {(['todos', 'nuevo', 'expansion'] as const).map(t => <button key={t} style={ch(fOp.tipo === t)} onClick={() => setFOp({ ...fOp, tipo: t })}>{t === 'todos' ? 'Todas' : t === 'nuevo' ? 'Cliente nuevo' : 'Expansión (ya es cliente)'}</button>)}
              <select value={fOp.vendedor} onChange={e => setFOp({ ...fOp, vendedor: e.target.value })} style={{ ...inp, marginTop: 0, width: 'auto', padding: '5px 8px', fontSize: 12 }}><option value="">Todos los vendedores</option>{vendedores.map(v => <option key={v} value={v}>{v}</option>)}</select>
              <select value={fOp.etapa} onChange={e => setFOp({ ...fOp, etapa: e.target.value })} style={{ ...inp, marginTop: 0, width: 'auto', padding: '5px 8px', fontSize: 12 }}><option value="">Todas las etapas</option>{etapas.map(v => <option key={v} value={v}>{ETQ[v] || v}</option>)}</select>
              <select value={fOp.orden} onChange={e => setFOp({ ...fOp, orden: e.target.value as any })} style={{ ...inp, marginTop: 0, width: 'auto', padding: '5px 8px', fontSize: 12 }}><option value="ponderado">Orden: ponderado</option><option value="valor">Orden: valor</option><option value="dias">Orden: días en etapa</option><option value="vistas">Orden: vistas</option><option value="cierre">Orden: fecha de cierre</option></select>
              <span style={{ marginLeft: 'auto', color: '#6b6580', fontSize: 12.5 }}>{lista.length} oportunidades · {pesos(tot)} brutos · <b>{pesos(pond)}</b> ponderados</span>
            </div>
            <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead><tr><th style={th}>Oportunidad</th><th style={th}>Etapa</th><th style={th}>Vendedor</th><th style={th}>Vistas</th><th style={th}>Última actividad</th><th style={th}>Cierre</th><th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={{ ...th, textAlign: 'right' }}>Prob.</th><th style={{ ...th, textAlign: 'right' }}>Ponderado</th></tr></thead>
                <tbody>{lista.map((o: any) => <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => abrirOp(o.id)}>
                  <td style={td}><b>{o.companies?.nombre_comercial || o.companies?.nombre || o.nombre}</b>{o.contacto_nombre ? <span style={{ color: '#6b6580' }}> · <a onClick={e => { e.stopPropagation(); if (o.contact_id) setLeadId(o.contact_id); }} style={{ color: '#5B4BD6', fontWeight: 700, cursor: 'pointer' }}>{o.contacto_nombre}</a></span> : null}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '1px 7px', background: o.expansion ? '#dcfce7' : '#EEECFE', color: o.expansion ? '#14532d' : '#4c1d95' }}>{o.expansion ? 'Expansión' : 'Cliente nuevo'}</span>
                      {o.lead_desde && <span style={{ fontSize: 10.5, color: '#8e88a8' }}>lead desde {fechaC(o.lead_desde)}</span>}
                      {o.canal && <span style={{ fontSize: 10.5, color: '#8e88a8' }}>· {o.canal}</span>}
                      {o.duplicados > 1 && <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '1px 7px', background: '#fef3c7', color: '#78350f' }}>{o.duplicados} oportunidades de este contacto</span>}
                    </div></td>
                  <td style={td}>{ETQ[o.stage] || o.stage}<div style={{ fontSize: 11, color: o.estancada ? '#b91c1c' : '#8e88a8', fontWeight: o.estancada ? 800 : 500 }}>{o.dias_etapa} días{o.estancada ? ' · estancada' : ''}</div></td>
                  <td style={td}>{o.team_members?.nombre || <span style={{ color: '#b45309' }}>sin vendedor</span>}</td>
                  <td style={td}>{o.quote_id ? <>{o.vistas}{o.ultima_vista_at ? <div style={{ fontSize: 11, color: '#8e88a8' }}>última {fechaC(o.ultima_vista_at)}</div> : <div style={{ fontSize: 11, color: '#b45309' }}>sin abrir</div>}</> : <span style={{ color: '#8e88a8' }}>sin cotización</span>}</td>
                  <td style={{ ...td, maxWidth: 220 }}>{o.ultima_actividad ? <><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.ultima_actividad.titulo || o.ultima_actividad.tipo}</div><div style={{ fontSize: 11, color: '#8e88a8' }}>{fechaC(o.ultima_actividad.at)}</div></> : <span style={{ color: '#8e88a8' }}>—</span>}{o.proximo_paso ? <div style={{ fontSize: 11, color: '#4c1d95' }}>Sigue: {o.proximo_paso}</div> : null}</td>
                  <td style={td}>{o.fecha_cierre_esperada ? <span style={{ color: o.cierre_vencido ? '#b91c1c' : o.cierre_en_mes ? '#14532d' : '#241d43', fontWeight: 700 }}>{o.fecha_cierre_esperada}{o.cierre_vencido ? ' · venció' : ''}</span> : <span style={{ color: '#b45309', fontSize: 12 }}>sin fecha</span>}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pesos(o.valor)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{o.prob}%{o.prob_manual ? <div style={{ fontSize: 10, color: '#8e88a8' }}>manual</div> : null}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{pesos(o.valor * o.prob / 100)}</td>
                </tr>)}
                {!lista.length && <tr><td colSpan={9} style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Sin oportunidades con este filtro.</td></tr>}</tbody>
              </table></div>
            </div>
          </div>);
        })()}

        {vista === 'cierre' && (
          <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
            <div style={{ background: '#fff', border: `2px solid ${cerrado ? '#86efac' : '#d9d4ea'}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[['Ingresos', d.ingresos.cobrado], ['Gastos', d.gastos.previsto], ['Comisiones', d.comisiones.total], ['Utilidad', d.utilidad.estimada]].map(([l, v]: any) => <div key={l}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8' }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: l === 'Utilidad' ? (v >= 0 ? '#14532d' : '#7f1d1d') : '#241d43', fontVariantNumeric: 'tabular-nums' }}>{pesos(v)}</div></div>)}
              </div>
              {cerrado ? (
                <div style={{ marginTop: 12, fontSize: 12.5, color: '#6b6580' }}>Cerrado el {new Date(d.cierre.cerrado_at).toLocaleDateString('es-MX')}{d.cierre.notas ? ` · ${d.cierre.notas}` : ''}. Los números de arriba son los vivos; el reporte anual usa los congelados. <button onClick={async () => { if (!confirm('¿Reabrir el mes? Se borra el cierre guardado.')) return; await postJ({ accion: 'reabrir_mes', mes }); cargar(); }} style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Reabrir</button></div>
              ) : (<>
                <div style={{ marginTop: 12, fontSize: 12.5 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', marginBottom: 4 }}>Antes de cerrar</div>
                  {[[d.gastos.lista.filter((g: any) => !g.pago && !g.probable).length, 'gastos fijos sin palomita de pagado'], [(d.adeudos?.lista || []).filter((a: any) => a.toca_este_mes > a.abonado_mes).length, 'adeudos con abono pendiente este mes'], [d.ingresos.por_cobrar_lista.length, 'renovaciones del mes sin cobrar'], [(d.atrasados?.lista || []).length, 'gastos atrasados de meses anteriores']].map(([n, l]: any) => <div key={l} style={{ color: n ? '#b45309' : '#14532d' }}>{n ? '•' : '✓'} {n ? `${n} ${l}` : `Sin ${l}`}</div>)}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input style={{ ...inp, marginTop: 0, flex: 1, minWidth: 220 }} placeholder="Nota del cierre (opcional)" value={notas} onChange={e => setNotas(e.target.value)} />
                  <button onClick={async () => { const j = await postJ({ accion: 'cerrar_mes', mes, notas }); if (j.error) { setMsg(j.error); return; } setNotas(''); cargar(); }} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar {MESES[Number(mes.slice(5, 7)) - 1]}</button>
                  <span style={{ fontSize: 11.5, color: '#8e88a8' }}>Congela ingresos, gastos, comisiones y utilidad de este mes para el reporte.</span>
                </div>
              </>)}
            </div>
            {anual && (
              <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><b>Reporte {anual.anio}</b><span style={{ color: '#6b6580', fontSize: 12.5 }}>Ingresos {pesos(anual.total.ingresos)} · Gastos {pesos(anual.total.gastos)} · Comisiones {pesos(anual.total.comisiones)} · Utilidad <b style={{ color: anual.total.utilidad >= 0 ? '#14532d' : '#7f1d1d' }}>{pesos(anual.total.utilidad)}</b></span></div>
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead><tr><th style={th}>Mes</th><th style={{ ...th, textAlign: 'right' }}>Ingresos</th><th style={{ ...th, textAlign: 'right' }}>Gastos</th><th style={{ ...th, textAlign: 'right' }}>Comisiones</th><th style={{ ...th, textAlign: 'right' }}>Utilidad</th><th style={th}>Estado</th></tr></thead>
                  <tbody>{anual.meses.map((x: any) => <tr key={x.mes} style={{ background: x.mes === mes ? '#faf9fc' : undefined, cursor: 'pointer' }} onClick={() => setMes(x.mes)}>
                    <td style={{ ...td, textTransform: 'capitalize', fontWeight: x.mes === mes ? 800 : 600 }}>{MESES[Number(x.mes.slice(5, 7)) - 1]}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{x.futuro ? '—' : pesos(x.ingresos)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pesos(x.gastos)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{x.futuro ? '—' : pesos(x.comisiones)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: x.utilidad == null ? '#8e88a8' : x.utilidad >= 0 ? '#14532d' : '#7f1d1d' }}>{x.utilidad == null ? '—' : pesos(x.utilidad)}</td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: x.cerrado ? '#dcfce7' : x.futuro ? '#f3f4f6' : '#fef3c7', color: x.cerrado ? '#14532d' : x.futuro ? '#6b6580' : '#78350f' }}>{x.cerrado ? 'Cerrado' : x.futuro ? 'Previsto' : 'Vivo'}</span></td>
                  </tr>)}</tbody>
                </table></div>
              </div>
            )}
          </div>
        )}
      </>)}
      <Sheet open={!!detalle} onClose={() => setDetalle(null)} width={560} zIndex={1200} title={detalle ? <span>{detalle.nombre}{detalle.proveedor ? <span style={{ color: '#8e88a8', fontWeight: 600 }}> · {detalle.proveedor}</span> : null}</span> : ''}>
        {detalle && (
          <div style={{ padding: '4px 18px 40px', fontSize: 13.5, color: '#241d43' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12.5, color: '#6b6580' }}>
              <span>{CATS[detalle.categoria] || detalle.categoria}</span><span>{PER[detalle.periodicidad] || detalle.periodicidad}</span><span>Vence <b style={{ color: '#241d43' }}>{venceEn(detalle, mes)}</b> · {textoDias(diasPara(venceEn(detalle, mes)))}</span><span>Monto previsto <b style={{ color: '#241d43' }}>{pesos(detalle.monto)}</b></span>
            </div>
            {detalle.notas && <div style={{ marginTop: 8, color: '#6b6580', fontSize: 12.5 }}>{detalle.notas}</div>}
            {/* Pagar este mes */}
            <div style={{ marginTop: 14, background: detalle.pago ? '#e7f7ee' : '#faf9fc', border: '1px solid #ecebf2', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: detalle.pago ? '#14532d' : '#8e88a8' }}>{detalle.pago ? `Pagado el ${new Date(detalle.pago.pagado_at).toLocaleDateString('es-MX')}` : `Pagar ${nombreMes(mes)}`}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <label style={lbl}>Monto pagado<input style={inp} type="number" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} /></label>
                <label style={lbl}>Fecha<input style={inp} type="date" value={pago.fecha} onChange={e => setPago({ ...pago, fecha: e.target.value })} /></label>
                <label style={{ ...lbl, gridColumn: '1 / -1' }}>Nota (referencia, quién, por qué cambió)<input style={inp} value={pago.nota} onChange={e => setPago({ ...pago, nota: e.target.value })} /></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={async () => { await postJ({ accion: 'gasto_pagar', gasto_id: detalle.id, mes, pagado: true, monto: pago.monto, fecha: pago.fecha, nota: pago.nota }); cargar(); abrirDetalle({ ...detalle, pago: { pagado_at: `${pago.fecha}T18:00:00Z`, monto: pago.monto, nota: pago.nota } }); }} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{detalle.pago ? 'Actualizar pago' : 'Marcar pagado'}</button>
                {detalle.pago && <button onClick={async () => { await postJ({ accion: 'gasto_pagar', gasto_id: detalle.id, mes, pagado: false }); cargar(); abrirDetalle({ ...detalle, pago: null }); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar pago</button>}
                <button onClick={() => { setDetalle(null); setForm({ id: detalle.id, nombre: detalle.nombre, categoria: detalle.categoria, monto: detalle.monto, periodicidad: detalle.periodicidad, dia_cobro: detalle.dia_cobro || '', inicio: String(detalle.inicio).slice(0, 7), fin: detalle.fin ? String(detalle.fin).slice(0, 7) : '', proveedor: detalle.proveedor || '', notas: detalle.notas || '', probable: !!detalle.probable }); setAbierto(true); setVista('gastos'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Editar gasto</button>
              </div>
            </div>
            {/* Historial */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', marginBottom: 6 }}>Historial de pagos</div>
              {!det && <p style={{ color: '#8e88a8' }}>Cargando…</p>}
              {det?.error && <p style={{ color: '#b91c1c' }}>{det.error}</p>}
              {det && !det.error && (<>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[['Pagos', det.stats.pagos], ['Total', pesos(det.stats.total)], ['Promedio', pesos(det.stats.promedio)], ['A tiempo', det.stats.a_tiempo_pct == null ? '—' : `${det.stats.a_tiempo_pct}%`]].map(([l, v]: any) => <div key={l} style={{ background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 10, padding: '8px 10px' }}><div style={{ fontSize: 10, fontWeight: 800, color: '#8e88a8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div><div style={{ fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{v}</div></div>)}
                </div>
                {det.stats.variacion_pct != null && <div style={{ marginTop: 8, fontSize: 12.5, color: det.stats.variacion_pct > 10 ? '#b91c1c' : det.stats.variacion_pct < -10 ? '#14532d' : '#6b6580' }}>El último pago fue {det.stats.variacion_pct > 0 ? `${det.stats.variacion_pct}% arriba` : det.stats.variacion_pct < 0 ? `${-det.stats.variacion_pct}% abajo` : 'igual'} del promedio.</div>}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12.5 }}>
                  <thead><tr style={{ color: '#8e88a8', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: '6px 4px' }}>Mes</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>Pagado el</th><th style={{ textAlign: 'right', padding: '6px 4px' }}>Monto</th><th style={{ textAlign: 'left', padding: '6px 4px' }}>Nota</th></tr></thead>
                  <tbody>{det.historial.map((p: any) => <tr key={p.mes} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '7px 4px', textTransform: 'capitalize', fontWeight: 700 }}>{nombreMes(p.mes)}</td><td style={{ padding: '7px 4px' }}>{new Date(p.pagado_at).toLocaleDateString('es-MX')}</td><td style={{ padding: '7px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: Number(p.monto) > Number(detalle.monto) ? '#b91c1c' : undefined }}>{pesos(p.monto)}</td><td style={{ padding: '7px 4px', color: '#6b6580' }}>{p.nota || ''}</td></tr>)}
                  {!det.historial.length && <tr><td colSpan={4} style={{ padding: 12, color: '#8e88a8', textAlign: 'center' }}>Todavía no hay pagos registrados de este gasto.</td></tr>}</tbody>
                </table>
              </>)}
            </div>
          </div>
        )}
      </Sheet>
      {leadId && <LeadDrawer contactId={leadId} onClose={() => setLeadId(null)} />}
      <Sheet open={!!opId} onClose={() => setOpId(null)} width={620} zIndex={1150} title={op?.deal ? <span>{op.deal.companies?.nombre_comercial || op.deal.companies?.nombre || op.deal.nombre}{op.expansion ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#14532d', borderRadius: 999, padding: '2px 8px' }}>Expansión</span> : <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, background: '#EEECFE', color: '#4c1d95', borderRadius: 999, padding: '2px 8px' }}>Cliente nuevo</span>}</span> : 'Oportunidad'}>
        {opId && (
          <div style={{ padding: '4px 18px 40px', fontSize: 13.5, color: '#241d43' }}>
            {!op && <p style={{ color: '#8e88a8' }}>Cargando…</p>}{op?.error && <p style={{ color: '#b91c1c' }}>{op.error}</p>}
            {op?.deal && (() => { const dl = op.deal; const k = dl.contacts || {}; const q = op.cotizacion; const ed = { probabilidad: opEdit.probabilidad ?? op.prob_efectiva ?? dl.probabilidad ?? '', fecha_cierre_esperada: opEdit.fecha_cierre_esperada ?? dl.fecha_cierre_esperada ?? '', stage: opEdit.stage ?? dl.stage, motivo_perdida: opEdit.motivo_perdida ?? dl.motivo_perdida ?? '', proximo_paso: opEdit.proximo_paso ?? dl.proximo_paso ?? '', proximo_paso_at: opEdit.proximo_paso_at ?? (dl.proximo_paso_at ? String(dl.proximo_paso_at).slice(0, 10) : '') };
              const guardar = async () => { const r = await postJ({ accion: 'deal_editar', id: dl.id, cambios: opEdit }); if (r.error) { alert(r.error); return; } setOpEdit({}); abrirOp(dl.id); cargar(); };
              return (<>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12.5, color: '#6b6580' }}>
                  <span>Contacto: <a onClick={() => k.id && setLeadId(k.id)} style={{ color: '#5B4BD6', fontWeight: 800, cursor: 'pointer' }}>{k.nombre || '—'} {k.apellido || ''}</a></span>
                  {k.created_at && <span>Lead desde <b style={{ color: '#241d43' }}>{String(k.created_at).slice(0, 10)}</b></span>}{k.fuente && <span>Canal <b style={{ color: '#241d43' }}>{k.fuente}</b></span>}<span>Vendedor <b style={{ color: '#241d43' }}>{dl.team_members?.nombre || '—'}</b></span>
                  {op.expansion && <span>Suscripciones activas: <b style={{ color: '#14532d' }}>{op.suscripciones_activas.map((s: any) => `${s.nombre_plan} (${pesos(s.mrr)}/mes)`).join(', ')}</b></span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {op.url_cotizacion && <a href={op.url_cotizacion} target="_blank" rel="noopener" style={{ border: '1px solid #e8e5f0', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, color: '#5B4BD6', textDecoration: 'none' }}>Abrir cotización pública</a>}
                  {k.whatsapp && <a href={`/admin/crm?tab=whatsapp&q=${encodeURIComponent(k.whatsapp)}`} style={{ border: '1px solid #e8e5f0', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, color: '#5B4BD6', textDecoration: 'none' }}>Ir al chat</a>}
                  <a href={`/admin/crm?tab=pipeline&lead=${k.id}`} style={{ border: '1px solid #e8e5f0', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, color: '#5B4BD6', textDecoration: 'none' }}>Ficha completa</a>
                </div>
                {/* Editar lo que decide el forecast */}
                <div style={{ marginTop: 14, background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8' }}>Lo que decide el forecast</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <label style={lbl}>Etapa<select style={inp} value={ed.stage} onChange={e => setOpEdit({ ...opEdit, stage: e.target.value })}>{['calificacion', 'demo_agendada', 'demo_realizada', 'cotizacion_enviada', 'negociacion', 'cerrada_ganada', 'cerrada_perdida'].map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></label>
                    <label style={lbl}>Probabilidad % {op.prob_manual ? <span style={{ color: '#8e88a8', fontWeight: 600 }}>· ajuste manual</span> : <span style={{ color: '#8e88a8', fontWeight: 600 }}>· por etapa</span>}<input style={inp} type="number" min={0} max={100} value={ed.probabilidad} onChange={e => setOpEdit({ ...opEdit, probabilidad: e.target.value })} placeholder="por etapa: 20/40/60/90" /></label>
                    <label style={lbl}>Fecha de cierre<input style={inp} type="date" value={ed.fecha_cierre_esperada} onChange={e => setOpEdit({ ...opEdit, fecha_cierre_esperada: e.target.value })} /></label>
                    <label style={lbl}>Siguiente paso · fecha<input style={inp} type="date" value={ed.proximo_paso_at} onChange={e => setOpEdit({ ...opEdit, proximo_paso_at: e.target.value })} /></label>
                    <label style={{ ...lbl, gridColumn: '1 / -1' }}>Siguiente paso<input style={inp} value={ed.proximo_paso} onChange={e => setOpEdit({ ...opEdit, proximo_paso: e.target.value })} placeholder="Llamar el lunes para cerrar; mandar comparativa…" /></label>
                    {/perdid/.test(ed.stage) && <label style={{ ...lbl, gridColumn: '1 / -1' }}>Motivo de pérdida (obligatorio)<input style={inp} value={ed.motivo_perdida} onChange={e => setOpEdit({ ...opEdit, motivo_perdida: e.target.value })} placeholder="precio / se fue con X / no era el momento / sin seguimiento" /></label>}
                  </div>
                  <button onClick={guardar} disabled={!Object.keys(opEdit).length} style={{ marginTop: 10, border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: Object.keys(opEdit).length ? 1 : .5 }}>Guardar cambios</button>
                </div>
                {/* Cotización */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', marginBottom: 6 }}>Cotización {q ? `#${q.numero || 's/n'} · ${q.estado} · ${pesos(q.total)}` : ''}</div>
                  {!q && <p style={{ color: '#8e88a8', fontSize: 12.5 }}>Sin cotización ligada.</p>}
                  {q && (<>
                    <div style={{ fontSize: 12.5, color: '#6b6580' }}>{q.plan ? `Plan ${q.plan} · ` : ''}{q.sucursales ? `${q.sucursales} sucursales · ` : ''}{q.periodo || ''}{q.vigencia ? ` · vigente hasta ${String(q.vigencia).slice(0, 10)}` : ''}</div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}><b>{q.vistas || 0} vistas</b>{q.primera_vista_at ? ` · primera ${String(q.primera_vista_at).slice(0, 16).replace('T', ' ')}` : ''}{q.ultima_vista_at ? ` · última ${String(q.ultima_vista_at).slice(0, 16).replace('T', ' ')}` : ' · todavía no la abre'}</div>
                    {Array.isArray(q.items) && q.items.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 12.5 }}><tbody>{q.items.slice(0, 12).map((it: any, i: number) => <tr key={i} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '5px 2px' }}>{it.nombre || it.titulo || it.concepto || it.descripcion || 'Concepto'}{it.cantidad ? <span style={{ color: '#8e88a8' }}> × {it.cantidad}</span> : null}</td><td style={{ padding: '5px 2px', textAlign: 'right', fontWeight: 700 }}>{it.total != null ? pesos(it.total) : it.precio != null ? pesos(it.precio) : ''}</td></tr>)}</tbody></table>}
                    {op.vistas.length > 0 && <div style={{ marginTop: 6, fontSize: 11.5, color: '#8e88a8' }}>Aperturas: {op.vistas.slice(0, 8).map((v: any) => `${String(v.created_at).slice(5, 16).replace('T', ' ')}${v.segundos ? ` (${v.segundos}s)` : ''}`).join(' · ')}</div>}
                  </>)}
                </div>
                {/* Actividades */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', marginBottom: 6 }}>Últimas actividades del prospecto</div>
                  {!op.actividades.length && <p style={{ color: '#8e88a8', fontSize: 12.5 }}>Sin actividades registradas.</p>}
                  {op.actividades.map((a: any) => <div key={a.id} style={{ padding: '6px 0', borderTop: '1px solid #f0eef6', fontSize: 12.5 }}><span style={{ color: '#8e88a8' }}>{String(a.created_at).slice(0, 16).replace('T', ' ')}</span> · <b>{a.titulo || a.tipo}</b>{a.descripcion ? <div style={{ color: '#6b6580' }}>{String(a.descripcion).slice(0, 220)}</div> : null}</div>)}
                </div>
                {op.otras_oportunidades.length > 0 && <div style={{ marginTop: 14, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: '#78350f' }}><b>Este contacto tiene {op.otras_oportunidades.length} oportunidad(es) más:</b> {op.otras_oportunidades.map((o: any) => `${o.nombre} (${o.stage}, ${pesos(o.valor_total || 0)})`).join(' · ')}. Si son la misma venta, ciérralas como perdidas con motivo «duplicada».</div>}
              </>); })()}
          </div>
        )}
      </Sheet>
    </div>
  );
}
