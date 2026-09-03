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

/** «9 renovaciones · 1 pago diferido» — el rótulo tiene que decir de qué está
 *  hecho el monto: una parcialidad pactada no es una renovación, y si las dos
 *  se cuentan bajo la misma palabra nadie sabe qué está mirando. */
function desglosePorCobrar(lista: any[]) {
  const par = (lista || []).filter((x: any) => x.tipo === 'parcialidad');
  const ren = (lista || []).length - par.length;
  const venc = par.filter((x: any) => x.vencida).length;
  const partes: string[] = [];
  if (ren) partes.push(`${ren} ${ren === 1 ? 'renovación' : 'renovaciones'}`);
  if (par.length) partes.push(`${par.length} ${par.length === 1 ? 'pago diferido' : 'pagos diferidos'}${venc ? ` (${venc} vencida${venc === 1 ? '' : 's'})` : ''}`);
  return partes.join(' · ') || 'nada pendiente';
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const mover = (m: string, d: number) => { const y = Number(m.slice(0, 4)), mm = Number(m.slice(5, 7)) - 1 + d; const dt = new Date(Date.UTC(y, mm, 1)); return dt.toISOString().slice(0, 7); };
/* Comprobante: firmar → PUT al storage → guardar. Devuelve error o null. */
async function subirComprobante(file: File, destino: { tipo: 'pago'; gasto_id: string; mes: string } | { tipo: 'abono'; abono_id: string }) {
  const firma = await fetch('/api/crm/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'comprobante_firmar', nombre: file.name, mime: file.type, bytes: file.size }) }).then(r => r.json());
  if (firma.error) return firma.error;
  const put = await fetch(firma.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file });
  if (!put.ok) return 'No se pudo subir el archivo';
  const r = await fetch('/api/crm/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'comprobante_guardar', ...destino, path: firma.path, nombre: file.name }) }).then(x => x.json());
  return r.error || null;
}
async function verComprobante(path: string) { const r = await fetch('/api/crm/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'comprobante_ver', path }) }).then(x => x.json()); if (r.url) window.open(r.url, '_blank', 'noopener'); else alert(r.error || 'No disponible'); }
const postJ = (body: any) => fetch('/api/crm/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const vacio = { id: '', nombre: '', categoria: 'suscripcion', monto: '', periodicidad: 'mensual', dia_cobro: '', inicio: '', fin: '', proveedor: '', notas: '', probable: false, moneda_original: 'MXN', monto_original: '', tipo_cambio: '', dias_cobro: '', metodo_pago: '', cuenta_pago: '', deducible: '', centro_costo: 'empresa', monto_min: '', monto_max: '', recordatorio_dias: '3', pausado_hasta: '', etiquetas: '', activo: true };
const CATS_TODAS = { ...CATS } as Record<string, string>;
const PER_TODAS: Record<string, string> = { semanal: 'Semanal (4 al mes)', quincenal: 'Quincenal (2 al mes)', mensual: 'Mensual', bimestral: 'Cada 2 meses', trimestral: 'Cada 3 meses', semestral: 'Cada 6 meses', anual: 'Anual', unico: 'Una sola vez' };
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
  const [ingTab, setIngTab] = useState<'cobrado' | 'por_cobrar' | 'venta' | 'oportunidades' | 'flujo'>('cobrado');
  const [fOp, setFOp] = useState<{ tipo: 'todos' | 'nuevo' | 'expansion'; vendedor: string; etapa: string; orden: 'ponderado' | 'valor' | 'dias' | 'vistas' | 'cierre' }>({ tipo: 'todos', vendedor: '', etapa: '', orden: 'ponderado' });
  const [opId, setOpId] = useState<string | null>(null);      // oportunidad abierta en el modal
  const [op, setOp] = useState<any>(null);
  const [opEdit, setOpEdit] = useState<any>({});
  const [leadId, setLeadId] = useState<string | null>(null);  // contacto abierto en el drawer
  const abrirOp = (id: string) => { setOpId(id); setOp(null); setOpEdit({}); fetch(`/api/crm/finanzas?oportunidad=${id}`).then(r => r.json()).then(setOp).catch(() => setOp({ error: 'No se pudo cargar' })); };
  const [form, setForm] = useState<any>(vacio);
  const [abierto, setAbierto] = useState(false);
  const [masOpciones, setMasOpciones] = useState(false);
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
  const pagar = async (g: any, pagado: boolean) => { await postJ({ accion: 'gasto_pagar', gasto_id: g.id, mes: g.mes_pago || mes, pagado }); cargar(); };
  // Decisión sobre un gasto no pagado: recorrer / prórroga / condonado / no aplica
  const [decidiendo, setDecidiendo] = useState<{ tipo: 'gasto' | 'adeudo'; id: string; mes: string; nombre: string; monto: number } | null>(null);
  const [decForm, setDecForm] = useState<{ decision: string; nueva_fecha: string; monto: string; nota: string }>({ decision: 'recorrer', nueva_fecha: '', monto: '', nota: '' });
  const guardarDecision = async () => { if (!decidiendo) return; const body: any = decidiendo.tipo === 'gasto' ? { accion: 'decision_gasto', gasto_id: decidiendo.id } : { accion: 'decision_adeudo', adeudo_id: decidiendo.id }; const r = await postJ({ ...body, mes: decidiendo.mes, decision: decForm.decision, nueva_fecha: decForm.nueva_fecha || undefined, monto: decForm.monto || (decidiendo.tipo === 'adeudo' ? decidiendo.monto : undefined), nota: decForm.nota || undefined }); if (r.error) { alert(r.error); return; } setDecidiendo(null); cargar(); };
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
          <KpiCard label="Por cobrar este mes" valor={pesos(d.ingresos.por_cobrar)} color="#1e3a8a" sub={desglosePorCobrar(d.ingresos.por_cobrar_lista)} onClick={() => setVista('ingresos')} activo={false} />
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
                  <label style={lbl}>Categoría <span style={{ fontWeight: 500, color: '#8e88a8' }}>(elige o escribe una nueva)</span><input style={inp} list="fin-cats" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="suscripcion, nomina, impuestos…" /><datalist id="fin-cats">{Object.entries({ ...CATS_TODAS, ...Object.fromEntries((d?.gastos?.catalogo || []).map((g: any) => [g.categoria, CATS[g.categoria] || g.categoria])) }).map(([k, l]) => <option key={k} value={k}>{l as string}</option>)}</datalist></label>
                  <label style={lbl}>Monto {form.moneda_original === 'USD' ? 'USD' : 'MXN'}<div style={{ display: 'flex', gap: 6 }}><input style={{ ...inp, flex: 1 }} type="number" value={form.moneda_original === 'USD' ? form.monto_original : form.monto} onChange={e => setForm(form.moneda_original === 'USD' ? { ...form, monto_original: e.target.value, monto: String(Math.round(Number(e.target.value) * (Number(form.tipo_cambio) || 0))) } : { ...form, monto: e.target.value })} /><select style={{ ...inp, width: 82 }} value={form.moneda_original} onChange={e => setForm({ ...form, moneda_original: e.target.value })}><option value="MXN">MXN</option><option value="USD">USD</option></select></div>{form.moneda_original === 'USD' && <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: 12 }}>Tipo de cambio <input style={{ ...inp, width: 90, marginTop: 0 }} type="number" step="0.01" value={form.tipo_cambio} onChange={e => setForm({ ...form, tipo_cambio: e.target.value, monto: String(Math.round(Number(form.monto_original) * (Number(e.target.value) || 0))) })} placeholder="18.50" /> = {pesos(Number(form.monto) || 0)} MXN</div>}</label>
                  <label style={lbl}>Periodicidad<select style={inp} value={form.periodicidad} onChange={e => setForm({ ...form, periodicidad: e.target.value })}>{Object.entries(PER_TODAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label style={lbl}>Día(s) de cobro <span style={{ fontWeight: 500, color: '#8e88a8' }}>(uno o varios: 15, 30)</span><input style={inp} value={form.dias_cobro || form.dia_cobro} onChange={e => setForm({ ...form, dias_cobro: e.target.value, dia_cobro: e.target.value.split(/[,\s]+/)[0] || '' })} placeholder="15" /></label>
                  <label style={lbl}>Desde (mes)<input style={inp} type="month" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label>
                  <label style={lbl}>Hasta (opcional)<input style={inp} type="month" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} /></label>
                  <label style={lbl}>Proveedor<input style={inp} value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></label>
                  <label style={{ ...lbl, gridColumn: '1 / -1' }}>Notas<input style={inp} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} /></label>
                  <button type="button" onClick={() => setMasOpciones(!masOpciones)} style={{ gridColumn: '1 / -1', justifySelf: 'start', border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0 }}>{masOpciones ? '− Menos opciones' : '+ Más opciones (método de pago, deducible, rango, recordatorio, pausa, etiquetas)'}</button>
                  {masOpciones && (<>
                    <label style={lbl}>Método de pago<select style={inp} value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}><option value="">—</option><option value="tarjeta">Tarjeta</option><option value="domiciliado">Domiciliado</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="paypal">PayPal</option></select></label>
                    <label style={lbl}>Cuenta o tarjeta de la que sale<input style={inp} value={form.cuenta_pago} onChange={e => setForm({ ...form, cuenta_pago: e.target.value })} placeholder="BBVA empresa, Konfio…" /></label>
                    <label style={lbl}>Deducible<select style={inp} value={String(form.deducible)} onChange={e => setForm({ ...form, deducible: e.target.value })}><option value="">No sé</option><option value="true">Sí, con factura</option><option value="false">No</option></select></label>
                    <label style={lbl}>Centro de costo<select style={inp} value={form.centro_costo} onChange={e => setForm({ ...form, centro_costo: e.target.value })}><option value="empresa">Empresa</option><option value="personal">Personal (reembolso)</option><option value="mixto">Mixto</option></select></label>
                    <label style={lbl}>Rango si es variable (mín)<input style={inp} type="number" value={form.monto_min} onChange={e => setForm({ ...form, monto_min: e.target.value })} /></label>
                    <label style={lbl}>Rango si es variable (máx)<input style={inp} type="number" value={form.monto_max} onChange={e => setForm({ ...form, monto_max: e.target.value })} /></label>
                    <label style={lbl}>Avisar días antes<input style={inp} type="number" min={0} max={30} value={form.recordatorio_dias} onChange={e => setForm({ ...form, recordatorio_dias: e.target.value })} /></label>
                    <label style={lbl}>Pausar hasta (mes)<input style={inp} type="month" value={form.pausado_hasta} onChange={e => setForm({ ...form, pausado_hasta: e.target.value })} /></label>
                    <label style={{ ...lbl, gridColumn: '1 / -1' }}>Etiquetas (coma)<input style={inp} value={form.etiquetas} onChange={e => setForm({ ...form, etiquetas: e.target.value })} placeholder="ia, infraestructura, equipo…" /></label>
                    <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.activo !== false} onChange={e => setForm({ ...form, activo: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#5B4BD6' }} />Activo (desmarcar lo quita de los meses futuros sin borrar el historial)</label>
                  </>)}
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
                  ['todos', 'Todos', Number(d.utilidad?.total_gastos || total), pagadoTotal + Number(d.adeudos?.abonado || 0) + (d.comisiones?.cortes || []).filter((c: any) => c.pagado).reduce((a: number, c: any) => a + c.monto, 0)],
                  ...cats.map(([c, v]: any) => [c, CATS[c] || c, Number(v.previsto || 0), Number(v.pagado || 0)] as [string, string, number, number]),
                  // Adeudos y comisiones son pagos fijos del mes: van como pestañas aquí, no como secciones aparte (decisión 2026-09-04).
                  ['adeudos', 'Adeudos', Number(d.adeudos?.toca || 0), Number(d.adeudos?.abonado || 0)] as [string, string, number, number],
                  ['comisiones', 'Comisiones', Number(d.comisiones?.total || 0), (d.comisiones?.cortes || []).filter((c: any) => c.pagado).reduce((a: number, c: any) => a + c.monto, 0)] as [string, string, number, number],
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
              {catTab !== 'adeudos' && catTab !== 'comisiones' && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead><tr><th style={th}>Pagado</th>{thSort('nombre', 'Gasto')}{thSort('categoria', 'Categoría')}<th style={th}>Periodicidad</th>{thSort('dias', 'Vence')}{thSort('monto', 'Monto', true)}<th style={th}></th></tr></thead>
                <tbody>
                  {catTab === 'todos' && (d.adeudos?.lista || []).filter((a: any) => a.toca_este_mes > 0).map((a: any) => (
                    <tr key={'ad' + a.id} style={{ cursor: 'pointer', background: '#fcfbfe' }} onClick={() => setCatTab('adeudos')}>
                      <td style={td}><input type="checkbox" checked={a.abonado_mes >= a.toca_este_mes} readOnly style={{ width: 18, height: 18, accentColor: '#5B4BD6' }} /></td>
                      <td style={td}><b>{a.nombre}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>cuota {pesos(a.cuota_mes || 0)}{a.atraso > 0 ? ` + ${pesos(a.atraso)} atrasado` : ''} · saldo {pesos(a.saldo)}</div></td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#e0e7ff', color: '#1e3a8a', borderRadius: 999, padding: '2px 8px' }}>Adeudo</span></td>
                      <td style={td}>Mensual</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ fontWeight: 800 }}>{textoDias(diasPara(venceEn({ dia_cobro: a.dia_pago }, mes)))}</span><div style={{ color: '#8e88a8', fontSize: 11 }}>{a.dia_pago ? `día ${a.dia_pago}` : 'fin de mes'}</div></td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(a.toca_este_mes)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#5B4BD6', fontWeight: 800, fontSize: 12 }}>Abonar</td>
                    </tr>
                  ))}
                  {catTab === 'todos' && (d.comisiones?.cortes || []).map((c: any) => (
                    <tr key={'co' + c.id} style={{ cursor: 'pointer', background: '#fcfbfe', opacity: c.pagado ? .7 : 1 }} onClick={() => setCatTab('comisiones')}>
                      <td style={td}><input type="checkbox" checked={c.pagado} readOnly style={{ width: 18, height: 18, accentColor: '#5B4BD6' }} /></td>
                      <td style={td}><b>Comisión {c.vendedor}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>corte {c.desde} → {c.hasta} · {c.aceptado ? 'aceptado' : c.estado}</div></td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>Comisiones</span></td>
                      <td style={td}>Lunes</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ fontWeight: 800 }}>{textoDias(diasPara(c.paga_el))}</span><div style={{ color: '#8e88a8', fontSize: 11 }}>{c.paga_el}</div></td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(c.monto)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#8e88a8', fontSize: 11 }}>Comisiones</td>
                    </tr>
                  ))}
                  {filasGasto.map((g: any) => (
                    <tr key={g.id} style={{ opacity: g.pago ? .75 : 1, cursor: 'pointer' }} onClick={() => abrirDetalle(g)}>
                      <td style={td} onClick={e => e.stopPropagation()}><input type="checkbox" checked={!!g.pago} onChange={e => pagar(g, e.target.checked)} title={g.pago ? `Pagado ${new Date(g.pago.pagado_at).toLocaleDateString('es-MX')}` : 'Marcar como pagado este mes'} style={{ width: 18, height: 18, accentColor: '#5B4BD6', cursor: 'pointer' }} /></td>
                      <td style={td}><b>{g.nombre}</b>{g.proveedor ? <span style={{ color: '#6b6580' }}> · {g.proveedor}</span> : null}{g.probable ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '1px 7px' }}>variable</span> : null}{g.prorroga_de ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#e0e7ff', color: '#1e3a8a', borderRadius: 999, padding: '1px 7px' }}>prórroga de {g.prorroga_de}</span> : null}{g.decision && g.decision.decision === 'prorroga' && !g.prorroga_de ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#e0e7ff', color: '#1e3a8a', borderRadius: 999, padding: '1px 7px' }}>se paga el {g.decision.nueva_fecha}</span> : null}{g.pago?.comprobante_path ? <span title={g.pago.comprobante_nombre || 'comprobante'} style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#e7f7ee', color: '#14532d', borderRadius: 999, padding: '1px 7px' }}>factura</span> : g.pago ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#fef3c7', color: '#78350f', borderRadius: 999, padding: '1px 7px' }}>sin factura</span> : null}{g.notas ? <div style={{ color: '#8e88a8', fontSize: 11 }}>{g.notas}</div> : null}</td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>{CATS[g.categoria] || g.categoria}</span></td>
                      <td style={td}>{PER[g.periodicidad] || g.periodicidad}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{g.pago ? <span style={{ color: '#14532d', fontWeight: 700 }}>pagado {new Date(g.pago.pagado_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span> : <span style={{ fontWeight: 800, color: g.dias < 0 ? '#b91c1c' : g.dias <= 3 ? '#b45309' : '#241d43' }}>{textoDias(g.dias)}</span>}<div style={{ color: '#8e88a8', fontSize: 11 }}>{g.dia_cobro ? `día ${g.dia_cobro}` : 'fin de mes'}</div></td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(g.monto)}</td>
                      <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}><button onClick={() => { setForm({ ...vacio, id: g.id, nombre: g.nombre, categoria: g.categoria, monto: g.monto_base ?? g.monto, periodicidad: g.periodicidad, dia_cobro: g.dia_cobro || '', dias_cobro: (g.dias_cobro || (g.dia_cobro ? [g.dia_cobro] : [])).join(', '), inicio: String(g.inicio).slice(0, 7), fin: g.fin ? String(g.fin).slice(0, 7) : '', proveedor: g.proveedor || '', notas: g.notas || '', probable: !!g.probable, moneda_original: g.moneda_original || 'MXN', monto_original: g.monto_original || '', tipo_cambio: g.tipo_cambio || '', metodo_pago: g.metodo_pago || '', cuenta_pago: g.cuenta_pago || '', deducible: g.deducible == null ? '' : String(g.deducible), centro_costo: g.centro_costo || 'empresa', monto_min: g.monto_min || '', monto_max: g.monto_max || '', recordatorio_dias: String(g.recordatorio_dias ?? 3), pausado_hasta: g.pausado_hasta ? String(g.pausado_hasta).slice(0, 7) : '', etiquetas: (g.etiquetas || []).join(', '), activo: g.activo !== false }); setAbierto(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Editar</button></td>
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
                </tbody>
              </table></div>}
              {catTab === 'comisiones' && (
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead><tr><th style={th}>Pagado</th><th style={th}>Corte</th><th style={th}>Categoría</th><th style={th}>Se paga</th><th style={th}>Fecha</th><th style={{ ...th, textAlign: 'right' }}>Monto</th><th style={th}></th></tr></thead>
                  <tbody>
                  {(d.comisiones.cortes || []).length > 0 && (<>
                    <tr><td colSpan={7} style={{ ...td, background: '#faf9fc', fontSize: 11, fontWeight: 800, color: '#8e88a8', letterSpacing: '.06em', textTransform: 'uppercase' }}>Comisiones: cortes que se pagan los lunes ({pesos(d.comisiones.por_pagar)} por pagar)</td></tr>
                    {d.comisiones.cortes.map((c: any) => <tr key={c.id} style={{ opacity: c.pagado ? .7 : 1 }}><td style={td}><input type="checkbox" checked={c.pagado} readOnly title="Se marca pagado desde Comisiones" style={{ width: 18, height: 18, accentColor: '#5B4BD6' }} /></td><td style={td}><b>{c.vendedor}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>corte {c.desde} → {c.hasta} · {c.aceptado ? 'aceptado por la vendedora' : c.estado}</div></td><td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>Comisiones</span></td><td style={td}>Lunes</td><td style={td}>{c.paga_el}</td><td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(c.monto)}</td><td style={td}></td></tr>)}
                  </>)}
                  {!(d.comisiones.cortes || []).length && Object.keys(d.comisiones.por_vendedor).length > 0 && (<>
                    <tr><td colSpan={7} style={{ ...td, background: '#faf9fc', fontSize: 11, fontWeight: 800, color: '#8e88a8', letterSpacing: '.06em', textTransform: 'uppercase' }}>Comisiones calculadas por el sistema (pagos del mes, aún sin corte)</td></tr>
                    {Object.entries(d.comisiones.por_vendedor).map(([n, m]: any) => <tr key={n}><td style={td}></td><td style={td}><b>{n}</b></td><td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>Comisiones</span></td><td style={td}>Mensual</td><td style={td}>—</td><td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(m)}</td><td style={td}></td></tr>)}
                  </>)}
                  {!(d.comisiones.cortes || []).length && !Object.keys(d.comisiones.por_vendedor).length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#8e88a8', padding: 20 }}>Sin comisiones este mes.</td></tr>}
                  </tbody></table></div>
              )}
              {catTab === 'adeudos' && (
                <div style={{ padding: '4px 14px 14px' }}>
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
                        {a.abonos.map((x: any) => <tr key={x.id} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '6px 2px' }}>{x.fecha}</td><td style={{ padding: '6px 2px', color: '#6b6580' }}>{x.nota || ''}</td><td style={{ padding: '6px 2px', textAlign: 'right', fontWeight: 800 }}>{pesos(x.monto)}</td><td style={{ padding: '6px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>{x.comprobante_path ? <a onClick={() => verComprobante(x.comprobante_path)} style={{ color: '#5B4BD6', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginRight: 8 }}>comprobante</a> : <label style={{ color: '#5B4BD6', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginRight: 8 }}>adjuntar<input type="file" accept=".pdf,.xml,image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const err = await subirComprobante(f, { tipo: 'abono', abono_id: x.id }); if (err) alert(err); cargar(); }} /></label>}<button onClick={async () => { if (!confirm('¿Borrar este abono?')) return; await postJ({ accion: 'abono_borrar', id: x.id }); cargar(); }} style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>borrar</button></td></tr>)}
                        {!a.abonos.length && <tr><td style={{ padding: 8, color: '#8e88a8' }}>Sin abonos todavía.</td></tr>}
                      </tbody></table>
                    )}
                    {a.notas && <div style={{ marginTop: 6, fontSize: 11.5, color: '#8e88a8' }}>{a.notas}</div>}
                  </div>
                ); })}
                {!(d.adeudos?.lista || []).length && <div style={{ color: '#8e88a8', fontSize: 12.5 }}>Sin adeudos activos.</div>}
              </div>
            </div>
            {catTab === 'adeudos' && (d.adeudos?.lista || []).length > 0 && (
              <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, padding: 16 }}>
                <b style={{ fontSize: 15 }}>Proyección</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}><thead><tr style={{ color: '#8e88a8', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: '6px 8px' }}>Adeudo</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Saldo</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Cuota</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Meses que faltan</th><th style={{ textAlign: 'left', padding: '6px 8px' }}>Se liquida</th><th style={{ textAlign: 'right', padding: '6px 8px' }}>Atraso</th></tr></thead>
                  <tbody>{d.adeudos.lista.map((a: any) => { const meses = a.cuota_mes ? Math.ceil(a.saldo / a.cuota_mes) : null; const fin = meses ? mover(mes, meses - 1) : null; return <tr key={a.id} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '8px', fontWeight: 800 }}>{a.nombre}</td><td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pesos(a.saldo)}</td><td style={{ padding: '8px', textAlign: 'right' }}>{a.cuota_mes ? pesos(a.cuota_mes) : <span style={{ color: '#b45309' }}>sin cuota</span>}</td><td style={{ padding: '8px', textAlign: 'right' }}>{meses ?? '—'}</td><td style={{ padding: '8px', textTransform: 'capitalize' }}>{fin ? nombreMes(fin) : '—'}{a.fecha_limite ? <div style={{ fontSize: 11, color: fin && fin > a.fecha_limite.slice(0, 7) ? '#b91c1c' : '#8e88a8' }}>límite {a.fecha_limite}</div> : null}</td><td style={{ padding: '8px', textAlign: 'right', color: a.atraso > 0 ? '#b91c1c' : undefined, fontWeight: a.atraso > 0 ? 800 : undefined }}>{a.atraso > 0 ? pesos(a.atraso) : '—'}</td></tr>; })}</tbody></table>
              </div>
            )}
                </div>
              )}
            </div>

            {/* ATRASADOS: lo que no se pagó en meses anteriores se junta aquí */}
            {(d.atrasados?.lista || []).length > 0 && (
              <div style={{ marginTop: 14, background: '#fff', border: '1px solid #fecdd3', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><b style={{ color: '#7f1d1d' }}>Atrasado de meses anteriores</b><span style={{ color: '#7f1d1d', fontWeight: 800 }}>{pesos(d.atrasados.total)}</span></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                  {d.atrasados.lista.map((g: any) => <tr key={`${g.id}:${g.mes}`}><td style={td}><b>{g.nombre}</b> <span style={{ color: '#8e88a8', fontSize: 11, textTransform: 'capitalize' }}>· {nombreMes(g.mes)}</span></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(g.monto)}</td><td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><button onClick={async () => { await postJ({ accion: 'gasto_pagar', gasto_id: g.id, mes: g.mes, pagado: true }); cargar(); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Ya lo pagué</button> <button onClick={() => { setDecidiendo({ tipo: 'gasto', id: g.id, mes: g.mes, nombre: g.nombre, monto: Number(g.monto) }); setDecForm({ decision: 'prorroga', nueva_fecha: '', monto: '', nota: '' }); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#5B4BD6' }}>Decidir…</button></td></tr>)}
                </tbody></table>
              </div>
            )}

          </div>
        )}

        {vista === 'ingresos' && (
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '1px solid #ecebf2', marginTop: 14 }}>
            {([['cobrado', 'Cobrado', d.ingresos.cobrado_neto ?? d.ingresos.cobrado], ['por_cobrar', 'Por cobrar', d.ingresos.por_cobrar], ['venta', 'Venta nueva', d.ingresos.ventas_aceptadas || 0], ['oportunidades', 'Oportunidades', d.pipeline.ponderado], ['flujo', 'Flujo semanal', (d.flujo || []).length ? d.flujo[d.flujo.length - 1].acumulado : 0]] as any[]).map(([k, l, v]) => { const on = ingTab === k; return (
              <button key={k} onClick={() => setIngTab(k)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '11px 14px 9px', borderBottom: `2px solid ${on ? '#5B4BD6' : 'transparent'}`, color: on ? '#241d43' : '#6b6580', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: on ? 800 : 600 }}>{l}</span><span style={{ display: 'block', fontSize: 11, color: on ? '#5B4BD6' : '#a5a0b8', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{pesos(v)}</span>
              </button>); })}
          </div>
        )}
        {vista === 'ingresos' && ingTab === 'flujo' && (d.flujo || []).length > 0 && (
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

        {vista === 'ingresos' && ['cobrado', 'por_cobrar', 'venta'].includes(ingTab) && (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {ingTab === 'por_cobrar' && <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Por cobrar este mes</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.por_cobrar)} · {desglosePorCobrar(d.ingresos.por_cobrar_lista)}</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {d.ingresos.por_cobrar_lista.map((s: any) => <tr key={s.id}><td style={td}><b>{s.companies?.nombre_comercial || s.companies?.nombre || s.contacts?.nombre || 'Cuenta'}</b>
                  {s.tipo === 'parcialidad' && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, letterSpacing: .3, color: '#5B4BD6', background: '#EEECFE', borderRadius: 5, padding: '2px 6px' }}>PAGO DIFERIDO</span>}
                  {s.vencida && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: .3, color: '#b91c1c', background: '#fee2e2', borderRadius: 5, padding: '2px 6px' }}>VENCIDA</span>}
                  <div style={{ color: '#8e88a8', fontSize: 11 }}>{s.nombre_plan} · {s.ciclo} · vence {s.proxima_factura}{s.mes_original && s.mes_original !== d.mes ? ` (era de ${s.mes_original})` : ''}{s.cobranza_estado ? ` · ${s.cobranza_estado}` : ''}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(s.monto)}</td></tr>)}
                {!d.ingresos.por_cobrar_lista.length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Nada pendiente de cobrar este mes.</td></tr>}
              </tbody></table>
            </div>}
            {ingTab === 'venta' && <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Venta nueva aceptada sin pago</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.ventas_aceptadas || 0)}</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {(d.ingresos.ventas_aceptadas_lista || []).map((q: any) => <tr key={q.id}><td style={td}><b>{q.companies?.nombre_comercial || q.companies?.nombre || q.contacts?.nombre || 'Cotización'}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>#{q.numero || 's/n'} · aceptada {String(q.aceptado_fecha || q.created_at || '').slice(0, 10)}{q.abonado ? ` · lleva ${pesos(q.abonado)} de ${pesos(q.total)}` : ''}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(q.monto)}</td></tr>)}
                {!(d.ingresos.ventas_aceptadas_lista || []).length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Ninguna cotización aceptada pendiente de pago.</td></tr>}
              </tbody></table>
            </div>}
            {ingTab === 'cobrado' && <div style={{ background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Cobrado</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.cobrado)} en {d.ingresos.pagos.length} pagos</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {d.ingresos.pagos.map((p: any) => <tr key={p.id}><td style={td}><b>{p.companies?.nombre_comercial || p.companies?.nombre || p.contacts?.nombre || 'Pago'}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>{p.fecha} · {p.metodo || p.pasarela || ''}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(p.monto)}</td></tr>)}
                {!d.ingresos.pagos.length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Sin pagos confirmados todavía.</td></tr>}
              </tbody></table>
            </div>}
          </div>
        )}

        {(vista === 'pipeline' || (vista === 'ingresos' && ingTab === 'oportunidades')) && (() => {
          const ETQ: Record<string, string> = { calificacion: 'Calificación', demo_agendada: 'Demo agendada', demo_realizada: 'Demo realizada', cotizacion_enviada: 'Cotización enviada', negociacion: 'Negociación', aceptada: 'Aceptada' };
          const vendedores = [...new Set(d.pipeline.abiertos.map((o: any) => o.team_members?.nombre || 'Sin vendedor'))] as string[];
          const etapas = [...new Set(d.pipeline.abiertos.map((o: any) => o.stage))] as string[];
          let lista = d.pipeline.abiertos.filter((o: any) => (fOp.tipo === 'todos' || (fOp.tipo === 'expansion' ? o.expansion : !o.expansion)) && (!fOp.vendedor || (o.team_members?.nombre || 'Sin vendedor') === fOp.vendedor) && (!fOp.etapa || o.stage === fOp.etapa));
          lista = [...lista].sort((a: any, b: any) => fOp.orden === 'valor' ? b.valor - a.valor : fOp.orden === 'dias' ? b.dias_etapa - a.dias_etapa : fOp.orden === 'vistas' ? b.vistas - a.vistas : fOp.orden === 'cierre' ? String(a.fecha_cierre_esperada || '9999').localeCompare(String(b.fecha_cierre_esperada || '9999')) : b.valor * b.prob - a.valor * a.prob);
          const tot = lista.reduce((x: number, o: any) => x + o.valor, 0), pond = lista.reduce((x: number, o: any) => x + o.valor * o.prob / 100, 0);
          const fechaC = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
          const ch = (on: boolean) => ({ border: `1px solid ${on ? '#5B4BD6' : '#e8e5f0'}`, background: on ? '#EEECFE' : '#fff', color: on ? '#4c1d95' : '#4a4658', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' });
          return (<div style={{ marginTop: 14 }}>
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
                  {/* QUÉ HAGO CON LO QUE NO PAGUÉ (decisión 2026-09-04): cada pendiente se decide antes de cerrar. Sin decisión = se recorre y se junta como atrasado. */}
                  {(d.gastos.lista.filter((g: any) => !g.pago && !g.probable).length > 0 || (d.adeudos?.lista || []).some((a: any) => a.toca_este_mes > a.abonado_mes)) && (
                    <div style={{ marginTop: 10, border: '1px solid #ecebf2', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: '#faf9fc', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8' }}>Qué hago con lo que no pagué</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                        {d.gastos.lista.filter((g: any) => !g.pago && !g.probable).map((g: any) => <tr key={'dg' + g.id + g.mes_pago}><td style={td}><b>{g.nombre}</b> <span style={{ color: '#8e88a8' }}>{pesos(g.monto)}</span>{g.decision ? <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, background: '#e0e7ff', color: '#1e3a8a', borderRadius: 999, padding: '1px 7px' }}>{({ recorrer: 'se recorre', prorroga: `prórroga al ${g.decision.nueva_fecha}`, condonado: 'condonado', no_aplica: 'no aplica' } as any)[g.decision.decision]}</span> : <span style={{ marginLeft: 8, fontSize: 10.5, color: '#b45309' }}>sin decidir: se recorre y se junta</span>}</td><td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><button onClick={() => { setDecidiendo({ tipo: 'gasto', id: g.id, mes: g.mes_pago || mes, nombre: g.nombre, monto: Number(g.monto) }); setDecForm({ decision: g.decision?.decision || 'recorrer', nueva_fecha: g.decision?.nueva_fecha || '', monto: '', nota: g.decision?.nota || '' }); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#5B4BD6' }}>Decidir…</button></td></tr>)}
                        {(d.adeudos?.lista || []).filter((a: any) => a.toca_este_mes > a.abonado_mes).map((a: any) => { const dec = (a.decisiones || []).find((x: any) => x.mes === mes); return <tr key={'da' + a.id}><td style={td}><b>{a.nombre}</b> <span style={{ color: '#8e88a8' }}>faltan {pesos(a.toca_este_mes - a.abonado_mes)} de la cuota</span>{dec ? <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, background: '#e0e7ff', color: '#1e3a8a', borderRadius: 999, padding: '1px 7px' }}>{({ recorrer: 'se acumula', prorroga: `prórroga de ${pesos(dec.monto)} al ${dec.nueva_fecha}`, condonado: `condonado ${pesos(dec.monto)}` } as any)[dec.decision]}</span> : <span style={{ marginLeft: 8, fontSize: 10.5, color: '#b45309' }}>sin decidir: se acumula al siguiente mes</span>}</td><td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}><button onClick={() => { setDecidiendo({ tipo: 'adeudo', id: a.id, mes, nombre: a.nombre, monto: a.toca_este_mes - a.abonado_mes }); setDecForm({ decision: dec?.decision || 'recorrer', nueva_fecha: dec?.nueva_fecha || '', monto: String(dec?.monto || (a.toca_este_mes - a.abonado_mes)), nota: dec?.nota || '' }); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#5B4BD6' }}>Decidir…</button></td></tr>; })}
                      </tbody></table>
                    </div>
                  )}
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
                <label style={{ ...lbl, gridColumn: '1 / -1' }}>Factura o recibo (PDF, XML o foto){detalle.pago?.comprobante_path ? <> · <a onClick={() => verComprobante(detalle.pago.comprobante_path)} style={{ color: '#5B4BD6', cursor: 'pointer' }}>ver {detalle.pago.comprobante_nombre || 'comprobante'}</a></> : null}
                  <input type="file" accept=".pdf,.xml,image/*" style={{ display: 'block', marginTop: 4, fontSize: 12 }} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const err = await subirComprobante(f, { tipo: 'pago', gasto_id: detalle.id, mes }); if (err) alert(err); else { cargar(); abrirDetalle({ ...detalle, pago: { ...(detalle.pago || { pagado_at: new Date().toISOString(), monto: detalle.monto }), comprobante_path: 'x', comprobante_nombre: f.name } }); } e.target.value = ''; }} />
                  <span style={{ fontWeight: 500, color: '#8e88a8' }}>Adjuntar el comprobante también marca el mes como pagado.</span></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={async () => { await postJ({ accion: 'gasto_pagar', gasto_id: detalle.id, mes, pagado: true, monto: pago.monto, fecha: pago.fecha, nota: pago.nota }); cargar(); abrirDetalle({ ...detalle, pago: { pagado_at: `${pago.fecha}T18:00:00Z`, monto: pago.monto, nota: pago.nota } }); }} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{detalle.pago ? 'Actualizar pago' : 'Marcar pagado'}</button>
                {detalle.pago && <button onClick={async () => { await postJ({ accion: 'gasto_pagar', gasto_id: detalle.id, mes, pagado: false }); cargar(); abrirDetalle({ ...detalle, pago: null }); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar pago</button>}
                <button onClick={() => { setDetalle(null); setForm({ ...vacio, id: detalle.id, nombre: detalle.nombre, categoria: detalle.categoria, monto: detalle.monto_base ?? detalle.monto, periodicidad: detalle.periodicidad, dia_cobro: detalle.dia_cobro || '', dias_cobro: (detalle.dias_cobro || (detalle.dia_cobro ? [detalle.dia_cobro] : [])).join(', '), inicio: String(detalle.inicio).slice(0, 7), fin: detalle.fin ? String(detalle.fin).slice(0, 7) : '', proveedor: detalle.proveedor || '', notas: detalle.notas || '', probable: !!detalle.probable, moneda_original: detalle.moneda_original || 'MXN', monto_original: detalle.monto_original || '', tipo_cambio: detalle.tipo_cambio || '', metodo_pago: detalle.metodo_pago || '', cuenta_pago: detalle.cuenta_pago || '', deducible: detalle.deducible == null ? '' : String(detalle.deducible), centro_costo: detalle.centro_costo || 'empresa', monto_min: detalle.monto_min || '', monto_max: detalle.monto_max || '', recordatorio_dias: String(detalle.recordatorio_dias ?? 3), pausado_hasta: detalle.pausado_hasta ? String(detalle.pausado_hasta).slice(0, 7) : '', etiquetas: (detalle.etiquetas || []).join(', '), activo: detalle.activo !== false }); setAbierto(true); setVista('gastos'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Editar gasto</button>
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
                  <tbody>{det.historial.map((p: any) => <tr key={p.mes} style={{ borderTop: '1px solid #f0eef6' }}><td style={{ padding: '7px 4px', textTransform: 'capitalize', fontWeight: 700 }}>{nombreMes(p.mes)}</td><td style={{ padding: '7px 4px' }}>{new Date(p.pagado_at).toLocaleDateString('es-MX')}</td><td style={{ padding: '7px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: Number(p.monto) > Number(detalle.monto) ? '#b91c1c' : undefined }}>{pesos(p.monto)}</td><td style={{ padding: '7px 4px', color: '#6b6580' }}>{p.nota || ''}{p.comprobante_path ? <> {p.nota ? '· ' : ''}<a onClick={() => verComprobante(p.comprobante_path)} style={{ color: '#5B4BD6', cursor: 'pointer', fontWeight: 700 }}>comprobante</a></> : null}</td></tr>)}
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
      <Sheet open={!!decidiendo} onClose={() => setDecidiendo(null)} width={480} zIndex={1300} title={decidiendo ? `¿Qué hago con ${decidiendo.nombre}?` : ''}>
        {decidiendo && (
          <div style={{ padding: '4px 18px 30px', fontSize: 13.5, color: '#241d43' }}>
            <p style={{ color: '#6b6580', fontSize: 12.5 }}>{decidiendo.tipo === 'gasto' ? `${pesos(decidiendo.monto)} de ${nombreMes(decidiendo.mes)} sin pagar.` : `Faltan ${pesos(decidiendo.monto)} de la cuota de ${nombreMes(decidiendo.mes)}.`} Elige una opción; se puede cambiar después.</p>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {[
                ['recorrer', decidiendo.tipo === 'gasto' ? 'Todavía lo debo: se recorre al siguiente mes y se junta como atrasado' : 'Todavía lo debo: se acumula al siguiente mes como atraso'],
                ['prorroga', decidiendo.tipo === 'gasto' ? 'Me dieron prórroga: se paga en otra fecha y NO cuenta como atraso' : 'Me dieron prórroga: esa parte se paga en otra fecha y NO cuenta como atraso'],
                ['condonado', decidiendo.tipo === 'gasto' ? 'No se va a pagar (lo perdonaron o se canceló): desaparece de este mes' : 'Me lo perdonaron: baja el saldo del adeudo'],
                ...(decidiendo.tipo === 'gasto' ? [['no_aplica', 'Este mes no aplicaba (no hubo cargo): desaparece sin dejar rastro']] : []),
              ].map(([k, l]) => <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: `1px solid ${decForm.decision === k ? '#5B4BD6' : '#e8e5f0'}`, background: decForm.decision === k ? '#EEECFE' : '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}><input type="radio" name="dec" checked={decForm.decision === k} onChange={() => setDecForm({ ...decForm, decision: k })} style={{ marginTop: 3 }} /><span>{l}</span></label>)}
            </div>
            {decForm.decision === 'prorroga' && <label style={{ ...lbl, display: 'block', marginTop: 10 }}>Nueva fecha de pago<input style={inp} type="date" value={decForm.nueva_fecha} onChange={e => setDecForm({ ...decForm, nueva_fecha: e.target.value })} /></label>}
            {(decidiendo.tipo === 'adeudo' && ['prorroga', 'condonado'].includes(decForm.decision)) && <label style={{ ...lbl, display: 'block', marginTop: 10 }}>Monto<input style={inp} type="number" value={decForm.monto} onChange={e => setDecForm({ ...decForm, monto: e.target.value })} /></label>}
            <label style={{ ...lbl, display: 'block', marginTop: 10 }}>Nota (quién lo autorizó, por qué)<input style={inp} value={decForm.nota} onChange={e => setDecForm({ ...decForm, nota: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={guardarDecision} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar decisión</button>
              <button onClick={async () => { const body: any = decidiendo.tipo === 'gasto' ? { accion: 'decision_gasto', gasto_id: decidiendo.id } : { accion: 'decision_adeudo', adeudo_id: decidiendo.id }; await postJ({ ...body, mes: decidiendo.mes, decision: 'quitar' }); setDecidiendo(null); cargar(); }} style={{ border: '1px solid #e8e5f0', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar decisión</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
