import { useEffect, useState } from 'react';
import KpiCard from './ui/KpiCard';

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
const vacio = { id: '', nombre: '', categoria: 'suscripcion', monto: '', periodicidad: 'mensual', dia_cobro: '', inicio: '', fin: '', proveedor: '', notas: '' };
const inp = { display: 'block', width: '100%', marginTop: 3, padding: 8, borderRadius: 8, border: '1px solid #e8e5f0', fontFamily: 'inherit', boxSizing: 'border-box' as const, fontSize: 13 };
const lbl = { fontSize: 11, color: '#8e88a8', fontWeight: 800 as const };

export default function FinanzasTab() {
  const [mes, setMes] = useState(() => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7));
  const [d, setD] = useState<any>(null);
  const [anual, setAnual] = useState<any>(null);
  const [vista, setVista] = useState<'gastos' | 'ingresos' | 'pipeline' | 'cierre'>('gastos');
  const [form, setForm] = useState<any>(vacio);
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState('');
  const [notas, setNotas] = useState('');
  const cargar = () => { fetch(`/api/crm/finanzas?mes=${mes}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' })); fetch(`/api/crm/finanzas?reporte=anual&anio=${mes.slice(0, 4)}`).then(r => r.json()).then(setAnual).catch(() => {}); };
  useEffect(() => { setD(null); cargar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = async () => { setMsg(''); const j = await postJ({ accion: 'gasto_guardar', gasto: form }); if (j.error) { setMsg(j.error); return; } setForm(vacio); setAbierto(false); setMsg('Guardado.'); cargar(); };
  const pagar = async (g: any, pagado: boolean) => { await postJ({ accion: 'gasto_pagar', gasto_id: g.id, mes, pagado }); cargar(); };
  const chip = (on: boolean) => ({ border: `1px solid ${on ? '#5B4BD6' : '#e8e5f0'}`, background: on ? '#EEECFE' : '#fff', color: on ? '#4c1d95' : '#4a4658', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' });
  const th = { textAlign: 'left' as const, padding: '8px 12px', fontWeight: 800, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: '#8e88a8', background: '#faf9fc' };
  const td = { padding: '8px 12px', borderTop: '1px solid #f0eef6', fontSize: 12.5 };
  const cerrado = !!d?.cierre;
  return (
    <div style={{ padding: '18px 22px 60px', maxWidth: 1180, margin: '0 auto', color: '#241d43' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#5B4BD6' }}>Finanzas</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 26, textTransform: 'capitalize' }}>{nombreMes(mes)} {cerrado && <span style={{ fontSize: 12, verticalAlign: 'middle', background: '#dcfce7', color: '#14532d', borderRadius: 999, padding: '3px 10px', textTransform: 'none', fontWeight: 800 }}>Mes cerrado</span>}</h1>
          <p style={{ margin: 0, color: '#6b6580', fontSize: 13.5 }}>Lo que entró, lo que falta por entrar, lo que hay que pagar y lo que queda.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={chip(false)} onClick={() => setMes(mover(mes, -1))}>‹ {MESES[Number(mover(mes, -1).slice(5, 7)) - 1]}</button>
          <button style={chip(true)} onClick={() => setMes(new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7))}>Hoy</button>
          <button style={chip(false)} onClick={() => setMes(mover(mes, 1))}>{MESES[Number(mover(mes, 1).slice(5, 7)) - 1]} ›</button>
        </div>
      </div>
      {!d && <p style={{ color: '#8e88a8', marginTop: 20 }}>Calculando…</p>}
      {d?.error && <p style={{ color: '#b91c1c' }}>{d.error}</p>}
      {d && !d.error && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
          <KpiCard label="Cobrado este mes" valor={pesos(d.ingresos.cobrado)} color="#14532d" sub={`${d.ingresos.pagos.length} pagos confirmados`} onClick={() => setVista('ingresos')} activo={vista === 'ingresos'} />
          <KpiCard label="Por cobrar (renovaciones)" valor={pesos(d.ingresos.por_cobrar)} color="#1e3a8a" sub={`${d.ingresos.por_cobrar_lista.length} suscripciones vencen este mes`} onClick={() => setVista('ingresos')} activo={false} />
          <KpiCard label="Gastos del mes" valor={pesos(d.utilidad.total_gastos)} color="#7f1d1d" sub={`${pesos(d.gastos.pagado)} ya pagados de ${pesos(d.gastos.previsto)}${d.gastos.por_categoria.comision ? '' : ` + ${pesos(d.comisiones.total)} comisiones`}`} onClick={() => setVista('gastos')} activo={vista === 'gastos'} />
          <KpiCard label="Pipeline ponderado" valor={pesos(d.pipeline.ponderado)} color="#78350f" sub={`${d.pipeline.abiertos.length} oportunidades · ${pesos(d.pipeline.total)} brutos`} onClick={() => setVista('pipeline')} activo={vista === 'pipeline'} />
          <KpiCard label="Utilidad estimada" valor={pesos(d.utilidad.estimada)} color={d.utilidad.estimada >= 0 ? '#14532d' : '#7f1d1d'} sub={`${pesos(d.utilidad.si_cobra_todo)} si cobras todo lo del mes`} onClick={() => setVista('cierre')} activo={vista === 'cierre'} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
          {(['gastos', 'ingresos', 'pipeline', 'cierre'] as const).map(v => <button key={v} style={chip(vista === v)} onClick={() => setVista(v)}>{{ gastos: 'Gastos y suscripciones', ingresos: 'Ingresos', pipeline: 'Pipeline de ventas', cierre: 'Cierre y reporte anual' }[v]}</button>)}
        </div>

        {vista === 'gastos' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(d.gastos.por_categoria).map(([c, v]: any) => <span key={c} style={{ fontSize: 12, background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 999, padding: '4px 10px' }}><b>{CATS[c] || c}</b> {pesos(v.previsto)} <span style={{ color: '#8e88a8' }}>· {pesos(v.pagado)} pagado</span></span>)}
                {!d.gastos.por_categoria.comision && d.comisiones.total > 0 && <span style={{ fontSize: 12, background: '#faf9fc', border: '1px solid #ecebf2', borderRadius: 999, padding: '4px 10px' }}><b>Comisiones (calculadas)</b> {pesos(d.comisiones.total)}</span>}
              </div>
              <button onClick={() => { setForm({ ...vacio, inicio: mes }); setAbierto(true); }} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ Agregar gasto</button>
            </div>
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
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead><tr><th style={th}>Pagado</th><th style={th}>Gasto</th><th style={th}>Categoría</th><th style={th}>Periodicidad</th><th style={th}>Día</th><th style={{ ...th, textAlign: 'right' }}>Monto</th><th style={th}></th></tr></thead>
                <tbody>
                  {d.gastos.lista.map((g: any) => (
                    <tr key={g.id} style={{ opacity: g.pago ? .75 : 1 }}>
                      <td style={td}><input type="checkbox" checked={!!g.pago} onChange={e => pagar(g, e.target.checked)} title={g.pago ? `Pagado ${new Date(g.pago.pagado_at).toLocaleDateString('es-MX')}` : 'Marcar como pagado este mes'} style={{ width: 18, height: 18, accentColor: '#5B4BD6', cursor: 'pointer' }} /></td>
                      <td style={td}><b>{g.nombre}</b>{g.proveedor ? <span style={{ color: '#6b6580' }}> · {g.proveedor}</span> : null}{g.notas ? <div style={{ color: '#8e88a8', fontSize: 11 }}>{g.notas}</div> : null}</td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>{CATS[g.categoria] || g.categoria}</span></td>
                      <td style={td}>{PER[g.periodicidad] || g.periodicidad}</td>
                      <td style={td}>{g.dia_cobro ? `día ${g.dia_cobro}` : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(g.monto)}</td>
                      <td style={{ ...td, textAlign: 'right' }}><button onClick={() => { setForm({ id: g.id, nombre: g.nombre, categoria: g.categoria, monto: g.monto, periodicidad: g.periodicidad, dia_cobro: g.dia_cobro || '', inicio: String(g.inicio).slice(0, 7), fin: g.fin ? String(g.fin).slice(0, 7) : '', proveedor: g.proveedor || '', notas: g.notas || '' }); setAbierto(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ border: 'none', background: 'transparent', color: '#5B4BD6', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Editar</button></td>
                    </tr>
                  ))}
                  {!d.gastos.lista.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#8e88a8', padding: 20 }}>Todavía no capturas gastos. Empieza por las suscripciones que pagas cada mes.</td></tr>}
                  {Object.keys(d.comisiones.por_vendedor).length > 0 && !d.gastos.por_categoria.comision && (<>
                    <tr><td colSpan={7} style={{ ...td, background: '#faf9fc', fontSize: 11, fontWeight: 800, color: '#8e88a8', letterSpacing: '.06em', textTransform: 'uppercase' }}>Comisiones calculadas por el sistema (pagos del mes)</td></tr>
                    {Object.entries(d.comisiones.por_vendedor).map(([n, m]: any) => <tr key={n}><td style={td}></td><td style={td}><b>{n}</b></td><td style={td}><span style={{ fontSize: 11, fontWeight: 800, background: '#f3f4f6', color: '#4a4658', borderRadius: 999, padding: '2px 8px' }}>Comisiones</span></td><td style={td}>Mensual</td><td style={td}>—</td><td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{pesos(m)}</td><td style={td}></td></tr>)}
                  </>)}
                </tbody>
              </table></div>
            </div>
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
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Cobrado</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.ingresos.cobrado)} en {d.ingresos.pagos.length} pagos</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {d.ingresos.pagos.map((p: any) => <tr key={p.id}><td style={td}><b>{p.companies?.nombre_comercial || p.companies?.nombre || p.contacts?.nombre || 'Pago'}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>{p.fecha} · {p.metodo || p.pasarela || ''}</div></td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{pesos(p.monto)}</td></tr>)}
                {!d.ingresos.pagos.length && <tr><td style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Sin pagos confirmados todavía.</td></tr>}
              </tbody></table>
            </div>
          </div>
        )}

        {vista === 'pipeline' && (
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eef6' }}><b>Oportunidades abiertas</b> <span style={{ color: '#8e88a8', fontSize: 12.5 }}>· {pesos(d.pipeline.total)} brutos · {pesos(d.pipeline.ponderado)} ponderados por probabilidad</span></div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead><tr><th style={th}>Oportunidad</th><th style={th}>Etapa</th><th style={th}>Vendedor</th><th style={th}>Cierre esperado</th><th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={{ ...th, textAlign: 'right' }}>Prob.</th><th style={{ ...th, textAlign: 'right' }}>Ponderado</th></tr></thead>
              <tbody>{d.pipeline.abiertos.map((o: any) => <tr key={o.id}><td style={td}><b>{o.companies?.nombre_comercial || o.companies?.nombre || o.contacts?.nombre || o.nombre}</b><div style={{ color: '#8e88a8', fontSize: 11 }}>{o.nombre}</div></td><td style={td}>{o.stage}</td><td style={td}>{o.team_members?.nombre || '—'}</td><td style={td}>{o.fecha_cierre_esperada || '—'}</td><td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pesos(o.valor)}</td><td style={{ ...td, textAlign: 'right' }}>{o.prob}%</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{pesos(o.valor * o.prob / 100)}</td></tr>)}
              {!d.pipeline.abiertos.length && <tr><td colSpan={7} style={{ ...td, color: '#8e88a8', textAlign: 'center', padding: 18 }}>Sin oportunidades abiertas.</td></tr>}</tbody>
            </table></div>
          </div>
        )}

        {vista === 'cierre' && (
          <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
            <div style={{ background: '#fff', border: `2px solid ${cerrado ? '#86efac' : '#d9d4ea'}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[['Ingresos', d.ingresos.cobrado], ['Gastos', d.gastos.previsto], ['Comisiones', d.comisiones.total], ['Utilidad', d.utilidad.estimada]].map(([l, v]: any) => <div key={l}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8' }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: l === 'Utilidad' ? (v >= 0 ? '#14532d' : '#7f1d1d') : '#241d43', fontVariantNumeric: 'tabular-nums' }}>{pesos(v)}</div></div>)}
              </div>
              {cerrado ? (
                <div style={{ marginTop: 12, fontSize: 12.5, color: '#6b6580' }}>Cerrado el {new Date(d.cierre.cerrado_at).toLocaleDateString('es-MX')}{d.cierre.notas ? ` · ${d.cierre.notas}` : ''}. Los números de arriba son los vivos; el reporte anual usa los congelados. <button onClick={async () => { if (!confirm('¿Reabrir el mes? Se borra el cierre guardado.')) return; await postJ({ accion: 'reabrir_mes', mes }); cargar(); }} style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Reabrir</button></div>
              ) : (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input style={{ ...inp, marginTop: 0, flex: 1, minWidth: 220 }} placeholder="Nota del cierre (opcional)" value={notas} onChange={e => setNotas(e.target.value)} />
                  <button onClick={async () => { const j = await postJ({ accion: 'cerrar_mes', mes, notas }); if (j.error) { setMsg(j.error); return; } setNotas(''); cargar(); }} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar {MESES[Number(mes.slice(5, 7)) - 1]}</button>
                  <span style={{ fontSize: 11.5, color: '#8e88a8' }}>Congela ingresos, gastos, comisiones y utilidad de este mes para el reporte.</span>
                </div>
              )}
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
    </div>
  );
}
