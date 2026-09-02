// Configuración → Comisiones.
//
// Se separó de la pantalla operativa a propósito. En Comisiones se trabaja cada
// lunes: se revisa el corte, se ajusta y se paga. Esto otro se toca una vez y
// no se vuelve a mirar en meses: qué porcentaje paga cada SKU, a quién le toca
// cada cuenta y cómo se arma el ciclo.
//
// Tenerlos juntos hacía que la pantalla del lunes arrancara con cuatro
// pestañas de configuración delante de lo único que había que hacer.
import { useEffect, useMemo, useState } from 'react';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
import { useIsMobile } from '../../../lib/ui/mobile';
import Cargando, { Chispas } from './ui/Cargando';
import { confirmar } from '../../../lib/ui/confirmar';
import { ORIGENES, ORIGEN_LABEL, CUENTAS } from '../../../lib/crm/comisiones.lib';

const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

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

/** Envoltorio para que cada editor sirva igual suelto o dentro de Configuración. */
function Marco({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1100 }}>{children}</div>;
}

export function ComisionesModelo() {
  const movil = useIsMobile();
  return <Marco><VistaModelo movil={movil} /></Marco>;
}
export function ComisionesAtribucion() {
  const movil = useIsMobile();
  return <Marco><VistaAtribucion movil={movil} /></Marco>;
}

const DIAS = [
  { v: 1, l: 'Lunes' }, { v: 2, l: 'Martes' }, { v: 3, l: 'Miércoles' },
  { v: 4, l: 'Jueves' }, { v: 5, l: 'Viernes' }, { v: 6, l: 'Sábado' }, { v: 7, l: 'Domingo' },
];

/**
 * El ciclo de pago. Es de la empresa y no de cada persona: cortes con
 * calendarios distintos volverían imposible cuadrar una semana.
 */
export function ComisionesCiclo() {
  const [c, setC] = useState<{ dia_cierre: number; dias_a_pago: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch('/api/crm/comisiones/config').then(r => r.json())
      .then(j => setC(j.ciclo || { dia_cierre: 5, dias_a_pago: 3 }))
      .catch(e => setError(String(e)));
  }, []);

  async function guardar(patch: Partial<{ dia_cierre: number; dias_a_pago: number }>) {
    const nuevo = { ...(c as any), ...patch };
    setC(nuevo); setOk(false);
    const r = await fetch('/api/crm/comisiones/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'ciclo', ...nuevo }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    setError(null); setOk(true); setTimeout(() => setOk(false), 2200);
  }

  if (!c) return <Cargando texto="Cargando el ciclo…" alto={160} />;

  const cierre = DIAS.find(d => d.v === c.dia_cierre)?.l || '—';
  const pago = DIAS.find(d => d.v === ((c.dia_cierre - 1 + c.dias_a_pago) % 7) + 1)?.l || '—';

  return (
    <Marco>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ ...E.card, marginBottom: 14 }}>
        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: P.suave, maxWidth: '68ch' }}>
          Define cuándo cierra el corte y cuántos días después se paga. Lo usan el cron de los lunes y el botón de generar: cambiarlo aquí cambia las dos cosas.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <div>
            <label style={E.lbl}>El corte cierra el</label>
            <select value={c.dia_cierre} onChange={e => guardar({ dia_cierre: Number(e.target.value) })} style={{ ...E.input, width: '100%' }}>
              {DIAS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
          </div>
          <div>
            <label style={E.lbl}>Se paga días después</label>
            <input type="number" min={0} max={14} defaultValue={c.dias_a_pago} style={{ ...E.input, width: '100%' }}
              onBlur={e => Number(e.target.value) !== c.dias_a_pago && guardar({ dias_a_pago: Number(e.target.value) })} />
          </div>
        </div>
        <div style={{ marginTop: 14, padding: '11px 13px', background: P.violetaAgua, borderRadius: 9, fontSize: '0.85rem', color: P.violetaTinta, fontWeight: 600 }}>
          Queda así: el corte cierra el <b>{cierre}</b> y se paga el <b>{pago}</b> siguiente.
          {ok && <span style={{ marginLeft: 10, color: P.verdeTinta }}>✓ guardado</span>}
        </div>
      </div>
      <div style={{ ...E.card, borderLeft: `3px solid ${P.ambar}`, background: P.ambarAgua }}>
        <div style={{ fontWeight: 800, fontSize: '0.82rem', color: P.ambarTinta, marginBottom: 5 }}>Qué NO cambia al mover esto</div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: P.texto, maxWidth: '68ch' }}>
          Los cortes ya generados conservan sus fechas y su día de pago. El ciclo nuevo aplica del siguiente corte en adelante: mover el calendario no reescribe lo que ya se le prometió a alguien.
        </p>
      </div>
    </Marco>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODELO
   ══════════════════════════════════════════════════════════════════ */
function VistaModelo({ movil }: { movil: boolean }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modeloId, setModeloId] = useState('');
  const [nueva, setNueva] = useState<any>({ plan_id: '', categoria: '', origen: '', pct: '' });

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch('/api/crm/comisiones/config');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setD(j);
      setModeloId(prev => prev || (j.modelos.find((m: any) => m.es_default)?.id || j.modelos[0]?.id || ''));
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  const modelo = useMemo(() => (d?.modelos || []).find((m: any) => m.id === modeloId), [d, modeloId]);
  const reglas = useMemo(() => (d?.reglas || []).filter((r: any) => r.modelo_id === modeloId), [d, modeloId]);
  const planPorId = useMemo(() => new Map((d?.planes || []).map((p: any) => [p.id, p])), [d]);

  async function guardarModelo(patch: any) {
    const r = await fetch('/api/crm/comisiones/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: modeloId, ...patch }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    await cargar();
  }

  async function agregarRegla() {
    if (nueva.pct === '' || Number.isNaN(Number(nueva.pct))) { setError('Escribe el porcentaje.'); return; }
    setError(null);
    const r = await fetch('/api/crm/comisiones/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'regla', modelo_id: modeloId, ...nueva, pct: Number(nueva.pct) }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    setNueva({ plan_id: '', categoria: '', origen: '', pct: '' });
    await cargar();
  }

  async function borrarRegla(id: string) {
    if (!(await confirmar('¿Quitar esta tarifa? Las comisiones ya calculadas conservan el porcentaje con el que se sacaron.'))) return;
    await fetch(`/api/crm/comisiones/config?regla_id=${id}`, { method: 'DELETE' });
    await cargar();
  }

  async function asignar(team_member_id: string, campos: Record<string, string>) {
    const r = await fetch('/api/crm/comisiones/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'asignar', team_member_id, ...campos }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    await cargar();
  }

  if (cargando) return <Cargando texto="Cargando el modelo…" />;

  return (
    <>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <label style={E.lbl}>Modelo</label>
          <select value={modeloId} onChange={e => setModeloId(e.target.value)} style={{ ...E.input, minWidth: 260 }}>
            {(d?.modelos || []).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}{m.es_default ? ' · por defecto' : ''}</option>)}
          </select>
        </div>
        {modelo && !modelo.es_default && (
          <button onClick={() => guardarModelo({ es_default: true })} style={E.btn2}>Hacerlo el modelo por defecto</button>
        )}
      </div>

      {modelo && (
        <>
          {/* ── Descuentos antes del cálculo ── */}
          <div style={{ ...E.card, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Descuentos antes de calcular</div>
            <p style={{ margin: '0 0 11px', fontSize: '0.78rem', color: P.suave, maxWidth: '64ch' }}>
              Se restan del monto cobrado y el porcentaje se aplica sobre lo que queda, nunca sobre el bruto.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '180px'}, 1fr))`, gap: 11 }}>
              <div>
                <label style={E.lbl}>Cuenta corporativa (IVA)</label>
                <input type="number" defaultValue={modelo.desc_corporativa_pct} style={{ ...E.input, width: '100%' }}
                  onBlur={e => Number(e.target.value) !== Number(modelo.desc_corporativa_pct) && guardarModelo({ desc_corporativa_pct: Number(e.target.value) })} />
              </div>
              <div>
                <label style={E.lbl}>Cuenta pagadora</label>
                <input type="number" defaultValue={modelo.desc_pagadora_pct} style={{ ...E.input, width: '100%' }}
                  onBlur={e => Number(e.target.value) !== Number(modelo.desc_pagadora_pct) && guardarModelo({ desc_pagadora_pct: Number(e.target.value) })} />
              </div>
              <div>
                <label style={E.lbl}>Cuenta que se asume</label>
                <select defaultValue={modelo.cuenta_default} style={{ ...E.input, width: '100%' }}
                  onChange={e => guardarModelo({ cuenta_default: e.target.value })}>
                  {CUENTAS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Reglas que no son una tarifa por SKU ── */}
          <div style={{ ...E.card, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Topes y reglas especiales</div>
            <p style={{ margin: '0 0 11px', fontSize: '0.78rem', color: P.suave, maxWidth: '68ch' }}>
              Cuatro números que no dependen del SKU: hasta dónde se puede descontar sin costo, qué tasa aplica una renovación que no cumplió, cuántos días hay para cobrarla, y cuánto gana quien reclutó a un partner.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '150px' : '210px'}, 1fr))`, gap: 11 }}>
              <div>
                <label style={E.lbl}>Tope de descuento (%)</label>
                <input type="number" defaultValue={modelo.tope_descuento_pct} style={{ ...E.input, width: '100%' }}
                  onBlur={e => Number(e.target.value) !== Number(modelo.tope_descuento_pct) && guardarModelo({ tope_descuento_pct: Number(e.target.value) })} />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 3 }}>Lo que se pase sale de su comisión.</div>
              </div>
              <div>
                <label style={E.lbl}>Tasa si no cumple renovación (%)</label>
                <input type="number" defaultValue={modelo.tasa_incumplimiento_pct ?? ''} placeholder="sin castigo"
                  style={{ ...E.input, width: '100%' }}
                  onBlur={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v !== (modelo.tasa_incumplimiento_pct == null ? null : Number(modelo.tasa_incumplimiento_pct))) guardarModelo({ tasa_incumplimiento_pct: v });
                  }} />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 3 }}>Vacío = siempre se paga la tasa completa.</div>
              </div>
              <div>
                <label style={E.lbl}>Margen para cobrar (días)</label>
                <input type="number" defaultValue={modelo.dias_gracia_cobro ?? ''} placeholder="no se evalúa"
                  style={{ ...E.input, width: '100%' }}
                  onBlur={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v !== (modelo.dias_gracia_cobro == null ? null : Number(modelo.dias_gracia_cobro))) guardarModelo({ dias_gracia_cobro: v });
                  }} />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 3 }}>Una renovación cobrada más tarde que esto paga la tasa reducida.</div>
              </div>
              <div>
                <label style={E.lbl}>Override de partners (%)</label>
                <input type="number" defaultValue={modelo.override_partner_pct ?? ''} placeholder="sin override"
                  style={{ ...E.input, width: '100%' }}
                  onBlur={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v !== (modelo.override_partner_pct == null ? null : Number(modelo.override_partner_pct))) guardarModelo({ override_partner_pct: v });
                  }} />
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 3 }}>Gana esto sobre las ventas de los partners que reclutó.</div>
              </div>
            </div>
          </div>

          {/* ── Tarifas ── */}
          <div style={{ ...E.card, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Tarifas por SKU y origen</div>
            <p style={{ margin: '0 0 11px', fontSize: '0.78rem', color: P.suave, maxWidth: '68ch' }}>
              Gana siempre la regla <b>más específica</b>: un SKU concreto le gana a su categoría, y la categoría le gana al comodín. Si nada aplica, la comisión sale en cero y la línea queda marcada.
            </p>

            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
                <thead><tr>
                  <th style={E.th}>Aplica a</th><th style={E.th}>Origen</th>
                  <th style={{ ...E.th, textAlign: 'right' }}>%</th><th style={E.th}>Nota</th><th style={{ ...E.th, width: 40 }} />
                </tr></thead>
                <tbody>
                  {reglas.length === 0 && <tr><td style={{ ...E.td, color: P.suave }} colSpan={5}>Este modelo todavía no tiene tarifas.</td></tr>}
                  {reglas.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>
                        {r.plan_id ? (planPorId.get(r.plan_id) as any)?.nombre || 'SKU' : r.categoria ? `Categoría: ${r.categoria}` : 'Cualquier concepto'}
                      </td>
                      <td style={E.td}>{r.origen ? ORIGEN_LABEL[r.origen] : 'Cualquiera'}</td>
                      <td style={{ ...E.td, textAlign: 'right' }}>
                        <input type="number" defaultValue={r.pct} style={{ ...E.input, width: 70, textAlign: 'right' }}
                          onBlur={async e => {
                            if (Number(e.target.value) === Number(r.pct)) return;
                            await fetch('/api/crm/comisiones/config', {
                              method: 'PUT', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tipo: 'regla', id: r.id, pct: Number(e.target.value) }),
                            });
                            cargar();
                          }} />
                      </td>
                      <td style={{ ...E.td, color: P.suave, fontSize: '0.75rem' }}>{r.nota || '—'}</td>
                      <td style={E.td}>
                        <button onClick={() => borrarRegla(r.id)} aria-label="Quitar tarifa"
                          style={{ ...E.btn3, padding: '3px 8px', color: P.rojoTinta, borderColor: '#f0c4bd' }}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: 12, borderTop: `1px solid ${P.lineaSuave}` }}>
              <div>
                <label style={E.lbl}>SKU exacto</label>
                <select value={nueva.plan_id} onChange={e => setNueva({ ...nueva, plan_id: e.target.value, categoria: '' })} style={{ ...E.input, minWidth: 190 }}>
                  <option value="">— toda una categoría —</option>
                  {(d?.planes || []).map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={E.lbl}>o categoría</label>
                <select value={nueva.categoria} disabled={!!nueva.plan_id}
                  onChange={e => setNueva({ ...nueva, categoria: e.target.value })}
                  style={{ ...E.input, minWidth: 150, opacity: nueva.plan_id ? 0.5 : 1 }}>
                  <option value="">Cualquiera</option>
                  {(d?.categorias || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={E.lbl}>Origen</label>
                <select value={nueva.origen} onChange={e => setNueva({ ...nueva, origen: e.target.value })} style={{ ...E.input, minWidth: 150 }}>
                  <option value="">Cualquiera</option>
                  {ORIGENES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={E.lbl}>%</label>
                <input type="number" value={nueva.pct} onChange={e => setNueva({ ...nueva, pct: e.target.value })} style={{ ...E.input, width: 80 }} />
              </div>
              <button onClick={agregarRegla} style={E.btn}>Agregar tarifa</button>
            </div>
          </div>
        </>
      )}

      {/* ── Quién usa qué modelo ── */}
      <div style={{ ...E.card }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Modelo de cada persona</div>
        <p style={{ margin: '0 0 11px', fontSize: '0.78rem', color: P.suave, maxWidth: '64ch' }}>
          Cada consultor puede tener condiciones distintas. Sin modelo asignado se le aplica el que está por defecto.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
            <thead><tr><th style={E.th}>Persona</th><th style={E.th}>Rol</th><th style={E.th}>Modelo</th><th style={E.th}>Reclutado por</th></tr></thead>
            <tbody>
              {(d?.miembros || []).filter((m: any) => m.activo).map((m: any) => (
                <tr key={m.id}>
                  <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{m.nombre}<div style={{ fontSize: '0.7rem', color: '#999' }}>{m.email}</div></td>
                  <td style={E.td}>{m.rol}</td>
                  <td style={E.td}>
                    <select value={m.comision_modelo_id || ''} onChange={e => asignar(m.id, { modelo_id: e.target.value })} style={{ ...E.input, minWidth: 220 }}>
                      <option value="">Modelo por defecto</option>
                      {(d?.modelos || []).map((mo: any) => <option key={mo.id} value={mo.id}>{mo.nombre}</option>)}
                    </select>
                  </td>
                  <td style={E.td}>
                    <select value={m.reclutado_por_id || ''} onChange={e => asignar(m.id, { reclutado_por_id: e.target.value })} style={{ ...E.input, minWidth: 190 }}>
                      <option value="">Nadie</option>
                      {(d?.miembros || []).filter((o: any) => o.id !== m.id).map((o: any) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ATRIBUCIÓN
   ══════════════════════════════════════════════════════════════════ */
function VistaAtribucion({ movil }: { movil: boolean }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloFaltantes, setSoloFaltantes] = useState(true);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [owner, setOwner] = useState('');
  const [origen, setOrigen] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch(`/api/crm/comisiones/atribucion?${soloFaltantes ? 'sin_asignar=1&' : ''}${q ? `q=${encodeURIComponent(q)}` : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setD(j); setSel(new Set());
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [soloFaltantes]);

  async function aplicar(limpiar: boolean) {
    if (!sel.size || (!limpiar && !owner && !origen)) return;
    if (limpiar && !(await confirmar(`¿Quitar el consultor y el origen de ${sel.size} cuenta(s)? Sus pagos dejarán de generar comisión.`))) return;
    setGuardando(true);
    try {
      const body: any = { company_ids: [...sel], limpiar };
      if (!limpiar && owner) body.owner_id = owner;
      if (!limpiar && origen) body.origen = origen;
      const r = await fetch('/api/crm/comisiones/atribucion', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  }

  if (cargando && !d) return <Cargando texto="Cargando cuentas…" />;

  const cob = d?.cobertura;
  const pct = cob?.total ? Math.round((cob.asignadas / cob.total) * 100) : 0;

  return (
    <>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ ...E.card, borderLeft: `3px solid ${pct === 100 ? P.verde : P.ambar}`, marginBottom: 14 }}>
        <span style={E.lbl}>Cuentas con consultor asignado</span>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: pct === 100 ? P.verdeTinta : P.ambarTinta }}>
          {cob?.asignadas || 0} <span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 600 }}>de {cob?.total || 0} · {pct}%</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: P.suave, maxWidth: '66ch' }}>
          Un pago de una cuenta sin consultor no genera comisión para nadie. El origen decide el porcentaje: se fija una vez, al registrar al cliente.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', color: P.texto, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloFaltantes} onChange={e => setSoloFaltantes(e.target.checked)} />
          Solo las que faltan
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="Buscar empresa…" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cargar()} style={{ ...E.input, minWidth: 190 }} />
          <button onClick={cargar} style={E.btn3}>Buscar</button>
        </div>
      </div>

      {sel.size > 0 && (
        <div style={{ ...E.card, background: P.violetaAgua, border: `1px solid ${P.violetaBorde}`, marginBottom: 12, display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: P.violetaTinta, alignSelf: 'center' }}>{sel.size} cuenta(s)</div>
          <div>
            <label style={E.lbl}>Consultor</label>
            <select value={owner} onChange={e => setOwner(e.target.value)} style={{ ...E.input, minWidth: 190 }}>
              <option value="">— sin cambio —</option>
              {(d?.miembros || []).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={E.lbl}>Origen</label>
            <select value={origen} onChange={e => setOrigen(e.target.value)} style={{ ...E.input, minWidth: 180 }}>
              <option value="">— sin cambio —</option>
              {ORIGENES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={() => aplicar(false)} disabled={guardando || (!owner && !origen)} style={{ ...E.btn, opacity: guardando || (!owner && !origen) ? 0.55 : 1 }}>
            {guardando ? <><Chispas size={10} color="#fff" /> Guardando…</> : 'Aplicar'}
          </button>
          {/* Vaciar el desplegable significa "sin cambio", así que quitar el
              consultor necesita su propio botón o no habría forma de hacerlo. */}
          <button onClick={() => aplicar(true)} disabled={guardando}
            style={{ ...E.btn3, color: P.rojoTinta, borderColor: '#f0c4bd' }}>Quitar asignación</button>
        </div>
      )}

      <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
          <thead><tr>
            <th style={{ ...E.th, width: 34 }}>
              <input type="checkbox" aria-label="Seleccionar todas"
                checked={sel.size > 0 && sel.size === (d?.empresas || []).length}
                onChange={e => setSel(e.target.checked ? new Set((d?.empresas || []).map((c: any) => c.id)) : new Set())} />
            </th>
            <th style={E.th}>Empresa</th>
            <th style={{ ...E.th, textAlign: 'right' }}>ARR</th>
            <th style={E.th}>Consultor</th><th style={E.th}>Origen</th>
          </tr></thead>
          <tbody>
            {(d?.empresas || []).length === 0 && (
              <tr><td style={{ ...E.td, color: P.verdeTinta, fontWeight: 600 }} colSpan={5}>No queda ninguna cuenta sin asignar.</td></tr>
            )}
            {(d?.empresas || []).map((c: any) => (
              <tr key={c.id}>
                <td style={E.td}>
                  <input type="checkbox" aria-label="Seleccionar empresa" checked={sel.has(c.id)}
                    onChange={e => { const s = new Set(sel); e.target.checked ? s.add(c.id) : s.delete(c.id); setSel(s); }} />
                </td>
                <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{c.nombre_comercial || c.nombre}</td>
                <td style={{ ...E.td, textAlign: 'right' }}>{c.arr ? pesos(c.arr) : '—'}</td>
                <td style={E.td}>
                  {c.comision_owner_id
                    ? ((d?.miembros || []).find((m: any) => m.id === c.comision_owner_id)?.nombre || '—')
                    : <span style={{ ...E.chip, background: P.ambarAgua, color: P.ambarTinta }}>Sin asignar</span>}
                </td>
                <td style={E.td}>{c.comision_origen ? ORIGEN_LABEL[c.comision_origen] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

