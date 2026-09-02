// Comisiones · Cortes — el ciclo semanal, operable.
//
// La pantalla existe para tres momentos concretos, y está ordenada en ese mismo
// orden porque es la secuencia de cada lunes:
//
//   1. generar el corte de la semana (o uno manual para un periodo suelto),
//   2. revisarlo: qué líneas trae y qué pagos NO alcanzó a comisionar,
//   3. cerrarlo, mandárselo al consultor y marcarlo pagado.
//
// Lo que la hace útil de verdad es la lista de pagos sin comisionar: dinero que
// entró y que el motor no supo repartir. Desde ahí se convierte en ajuste con
// un clic, en vez de quedarse invisible hasta que alguien lo note en el banco.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
import Cargando, { Chispas } from './ui/Cargando';
import { confirmar } from '../../../lib/ui/confirmar';
import { explicar } from '../../../lib/crm/comisiones.lib';

// El signo va ANTES del peso: "−$800", no "$-800". Es dinero y se lee de reojo.
const pesos = (n: number) => {
  const v = Math.round(Number(n || 0));
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-MX');
};
const fecha = (d?: string | null) => d
  ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '')
  : '—';

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

const TONO: Record<string, { bg: string; fg: string; label: string }> = {
  abierto: { bg: P.violetaAgua, fg: P.violetaTinta, label: 'Abierto' },
  cerrado: { bg: P.azulAgua, fg: P.azulTinta, label: 'Enviado' },
  pagado: { bg: P.verdeAgua, fg: P.verdeTinta, label: 'Pagado' },
};

export default function ComisionesCortes({ movil }: { movil: boolean }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [det, setDet] = useState<any>(null);
  const [manual, setManual] = useState({ desde: '', hasta: '' });

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch('/api/crm/comisiones/cortes');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setD(j);
      if (!manual.desde && j.sugerido) setManual({ desde: j.sugerido.desde, hasta: j.sugerido.hasta });
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function verDetalle(id: string) {
    if (abierto === id) { setAbierto(null); setDet(null); return; }
    setAbierto(id); setDet(null);
    const r = await fetch(`/api/crm/comisiones/cortes?id=${id}`);
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    setDet(j);
  }

  async function generar(usarManual: boolean) {
    setGenerando(true); setError(null);
    try {
      const body = usarManual ? { desde: manual.desde, hasta: manual.hasta } : {};
      const r = await fetch('/api/crm/comisiones/cortes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      if (j.resultado?.errores?.length) setError(j.resultado.errores.join(' · '));
      await cargar();
      if (abierto) await verDetalle(abierto);
    } catch (e: any) { setError(e.message); } finally { setGenerando(false); }
  }

  async function accionCorte(id: string, accion: string) {
    const textos: Record<string, string> = {
      cerrar: '¿Cerrar el corte? Deja de absorber cosas nuevas y queda listo para enviarse. Lo que llegue después entra al siguiente.',
      reabrir: '¿Reabrir el corte para que vuelva a absorber líneas y ajustes?',
      pagar: '¿Marcar el corte como pagado? Sus líneas quedan congeladas y el recálculo ya no las toca.',
    };
    if (textos[accion] && !(await confirmar(textos[accion]))) return;
    const referencia = accion === 'pagar' ? (window.prompt('Referencia del pago (opcional):') ?? null) : '';
    if (accion === 'pagar' && referencia === null) return;
    const r = await fetch('/api/crm/comisiones/cortes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, accion, referencia }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    setError(null);
    await cargar(); await verDetalle(id); setAbierto(id);
  }

  if (cargando && !d) return <Cargando texto="Cargando cortes…" />;

  const cortes = d?.cortes || [];
  const porPagar = cortes.filter((c: any) => c.estado !== 'pagado')
    .reduce((a: number, c: any) => a + Number(c.total || 0), 0);

  return (
    <>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ ...E.card, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>El ciclo semanal</div>
        <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: P.suave, maxWidth: '72ch' }}>
          El corte cierra el <b>viernes</b> y se paga el <b>lunes siguiente</b>. Se arma solo cada lunes a las 5 de la mañana; este botón hace lo mismo a mano si hace falta adelantarlo o rehacerlo.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <button onClick={() => generar(false)} disabled={generando} style={{ ...E.btn, opacity: generando ? 0.6 : 1 }}>
            {generando ? <><Chispas size={10} color="#fff" /> Generando…</> : `Generar el corte de la semana (${d?.sugerido?.desde} → ${d?.sugerido?.hasta})`}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.lineaSuave}` }}>
          <div><label style={E.lbl}>O un periodo específico · desde</label>
            <input type="date" value={manual.desde} onChange={e => setManual({ ...manual, desde: e.target.value })} style={E.input} /></div>
          <div><label style={E.lbl}>hasta</label>
            <input type="date" value={manual.hasta} onChange={e => setManual({ ...manual, hasta: e.target.value })} style={E.input} /></div>
          <button onClick={() => generar(true)} disabled={generando || !manual.desde || !manual.hasta} style={E.btn2}>Generar corte manual</button>
        </div>
      </div>

      {/* ── Ajustes que todavía no entran a ningún corte ── */}
      {(d?.pendientes || []).length > 0 && (
        <div style={{ ...E.card, borderLeft: `3px solid ${P.ambar}`, background: P.ambarAgua, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.ambarTinta, marginBottom: 6 }}>
            {d.pendientes.length} ajuste(s) esperando el próximo corte
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: P.texto, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {d.pendientes.map((a: any, i: number) => (
              <li key={i}><b>{a.nombre}</b> · {a.concepto} · <b style={{ color: a.tipo === 'cargo' ? P.rojoTinta : P.verdeTinta }}>
                {a.tipo === 'cargo' ? '−' : '+'}{pesos(a.monto)}</b></li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '170px'}, 1fr))`, gap: 11, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.ambar)}>
          <span style={E.lbl}>Por pagar en cortes abiertos</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ambarTinta }}>{pesos(porPagar)}</div>
        </div>
        <div style={tarjetaKpi(P.violeta)}>
          <span style={E.lbl}>Cortes</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta }}>{cortes.length}</div>
        </div>
      </div>

      {cortes.length === 0 ? (
        <div style={{ ...E.card, color: P.suave, fontSize: '0.85rem' }}>
          Todavía no hay cortes. Aprieta <b>Generar el corte de la semana</b>: si no aparece nada, es que ninguna cuenta con pagos de esa semana tiene consultor asignado.
        </div>
      ) : (
        <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead><tr>
              <th style={E.th}>Consultor</th><th style={E.th}>Periodo</th><th style={E.th}>Paga el</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Líneas</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Ajustes</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Total</th>
              <th style={E.th}>Estado</th><th style={{ ...E.th, width: 90 }} />
            </tr></thead>
            <tbody>
              {cortes.map((c: any) => {
                const t = TONO[c.estado] || TONO.abierto;
                return (
                  <tr key={c.id} style={abierto === c.id ? { background: P.violetaAgua } : undefined}>
                    <td style={{ ...E.td, fontWeight: 700, color: P.tinta }}>
                      {c.team_members?.nombre || '—'}
                      {!c.automatico && <span style={{ ...E.chip, background: P.lineaSuave, color: P.suave, marginLeft: 6 }}>manual</span>}
                    </td>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(c.desde)} — {fecha(c.hasta)}</td>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(c.paga_el)}</td>
                    <td style={{ ...E.td, textAlign: 'right' }}>{c.lineas}</td>
                    <td style={{ ...E.td, textAlign: 'right', color: Number(c.monto_ajustes) < 0 ? P.rojoTinta : P.texto }}>
                      {Number(c.monto_ajustes) === 0 ? '—' : (Number(c.monto_ajustes) > 0 ? '+' : '') + pesos(Number(c.monto_ajustes))}
                    </td>
                    <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(c.total)}</td>
                    <td style={E.td}><span style={{ ...E.chip, background: t.bg, color: t.fg }}>{t.label}</span></td>
                    <td style={E.td}>
                      <button onClick={() => verDetalle(c.id)} style={{ ...E.btn3, padding: '3px 9px' }}>
                        {abierto === c.id ? 'Cerrar' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierto && <Detalle det={det} movil={movil}
        onAccion={(a) => accionCorte(abierto, a)}
        onCambio={async () => { await cargar(); await verDetalle(abierto); setAbierto(abierto); }}
        onError={setError} />}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DETALLE DE UN CORTE
   ══════════════════════════════════════════════════════════════════ */
function Detalle({ det, movil, onAccion, onCambio, onError }: {
  det: any; movil: boolean;
  onAccion: (a: string) => void; onCambio: () => void; onError: (m: string) => void;
}) {
  const [nuevo, setNuevo] = useState({ tipo: 'abono', concepto: '', monto: '', nota: '' });
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!det) return <div style={{ marginTop: 14 }}><Cargando texto="Abriendo el corte…" alto={180} /></div>;
  const c = det.corte;
  const firme = c.estado !== 'abierto';
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/comisiones/${c.id}` : '';

  async function agregar(pago?: any) {
    const cuerpo = pago
      ? { tipo: 'abono', concepto: `Pago no reconocido · ${pago.empresa}`, monto: pago.monto, payment_id: pago.id, nota: pago.motivo }
      : { tipo: nuevo.tipo, concepto: nuevo.concepto, monto: Number(nuevo.monto), nota: nuevo.nota };
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/comisiones/ajustes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corte_id: c.id, owner_id: c.owner_id, ...cuerpo }),
      });
      const j = await r.json();
      if (!r.ok) { onError(j.error || 'Error'); return; }
      if (j.aviso) onError(j.aviso);
      if (!pago) setNuevo({ tipo: 'abono', concepto: '', monto: '', nota: '' });
      onCambio();
    } finally { setGuardando(false); }
  }

  async function quitar(id: string) {
    if (!(await confirmar('¿Quitar este ajuste del corte?'))) return;
    const r = await fetch(`/api/crm/comisiones/ajustes?id=${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) { onError(j.error || 'Error'); return; }
    onCambio();
  }

  return (
    <div style={{ ...E.card, marginTop: 14, borderLeft: `3px solid ${P.violeta}` }}>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: '0.95rem', color: P.tinta }}>
          {c.team_members?.nombre} · {fecha(c.desde)} — {fecha(c.hasta)}
        </strong>
        <span style={{ fontWeight: 800, color: P.violetaTinta }}>{pesos(c.total)}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => { navigator.clipboard?.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} style={E.btn3}>
          {copiado ? '✓ Copiado' : 'Copiar enlace'}
        </button>
        <a href={enlace} target="_blank" rel="noopener" style={{ ...E.btn3, textDecoration: 'none', display: 'inline-block' }}>Ver estado de cuenta</a>
        {c.estado === 'abierto' && <button onClick={() => onAccion('cerrar')} style={E.btn2}>Cerrar y enviar</button>}
        {c.estado === 'cerrado' && <button onClick={() => onAccion('reabrir')} style={E.btn3}>Reabrir</button>}
        {c.estado !== 'pagado' && <button onClick={() => onAccion('pagar')} style={E.btn}>Marcar pagado</button>}
      </div>

      {/* ── Líneas ── */}
      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
          <thead><tr>
            <th style={E.th}>Fecha</th><th style={E.th}>Cliente</th><th style={E.th}>Concepto</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Base</th>
            <th style={{ ...E.th, textAlign: 'right' }}>%</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Comisión</th>
          </tr></thead>
          <tbody>
            {det.lineas.length === 0 && <tr><td style={{ ...E.td, color: P.suave }} colSpan={6}>Sin comisiones de venta: el total sale de los ajustes.</td></tr>}
            {det.lineas.map((l: any) => (
              <tr key={l.id}>
                <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(l.fecha)}</td>
                <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{l.companies?.nombre_comercial || l.companies?.nombre || '—'}</td>
                <td style={E.td}>{l.concepto || 'Sin SKU'}<div style={{ fontSize: '0.68rem', color: '#999', marginTop: 2 }}>{explicar(l)}</div></td>
                <td style={{ ...E.td, textAlign: 'right' }}>{pesos(l.base)}</td>
                <td style={{ ...E.td, textAlign: 'right' }}>{l.sin_regla ? '—' : Number(l.pct) + '%'}</td>
                <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(l.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Ajustes ── */}
      <div style={{ fontWeight: 800, fontSize: '0.8rem', color: P.tinta, marginBottom: 6 }}>Ajustes</div>
      {det.ajustes.length === 0 && <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: P.suave }}>Ninguno.</p>}
      {det.ajustes.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
            <tbody>
              {det.ajustes.map((a: any) => (
                <tr key={a.id}>
                  <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{a.concepto}<div style={{ fontSize: '0.68rem', color: '#999' }}>{a.nota || ''}</div></td>
                  <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: a.tipo === 'cargo' ? P.rojoTinta : P.verdeTinta, whiteSpace: 'nowrap' }}>
                    {a.tipo === 'cargo' ? '−' : '+'}{pesos(a.monto)}
                  </td>
                  <td style={{ ...E.td, width: 70 }}>
                    {!firme && <button onClick={() => quitar(a.id)} style={{ ...E.btn3, padding: '2px 8px', color: P.rojoTinta, borderColor: '#f0c4bd' }}>Quitar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!firme && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: 10, borderTop: `1px solid ${P.lineaSuave}`, marginBottom: 14 }}>
          <div>
            <label style={E.lbl}>Tipo</label>
            <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })} style={{ ...E.input, minWidth: 110 }}>
              <option value="abono">Abono (+)</option>
              <option value="cargo">Cargo (−)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={E.lbl}>Concepto</label>
            <input value={nuevo.concepto} onChange={e => setNuevo({ ...nuevo, concepto: e.target.value })}
              placeholder="Lo que se va a leer en el estado de cuenta" style={{ ...E.input, width: '100%' }} />
          </div>
          <div><label style={E.lbl}>Monto</label>
            <input type="number" value={nuevo.monto} onChange={e => setNuevo({ ...nuevo, monto: e.target.value })} style={{ ...E.input, width: 110 }} /></div>
          <button onClick={() => agregar()} disabled={guardando || !nuevo.concepto.trim() || !nuevo.monto} style={E.btn}>Agregar ajuste</button>
        </div>
      )}

      {/* ── Pagos que el motor no supo comisionar ── */}
      {!firme && (det.no_reconocidos || []).length > 0 && (
        <div style={{ background: P.ambarAgua, border: `1px solid ${P.linea}`, borderLeft: `3px solid ${P.ambar}`, borderRadius: 10, padding: '13px 15px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: P.ambarTinta, marginBottom: 3 }}>
            {det.no_reconocidos.length} pago(s) de este periodo no generaron comisión
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: P.texto, maxWidth: '70ch' }}>
            Entró el dinero pero el motor no supo a quién dárselo o con qué tarifa. Si alguno le corresponde a <b>{c.team_members?.nombre}</b>, agrégalo al corte con el monto que acuerden.
          </p>
          <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 540 }}>
              <tbody>
                {det.no_reconocidos.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(p.fecha)}</td>
                    <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{p.empresa}</td>
                    <td style={{ ...E.td, fontSize: '0.72rem', color: P.suave }}>{p.motivo}</td>
                    <td style={{ ...E.td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{pesos(p.monto)}</td>
                    <td style={{ ...E.td, width: 96 }}>
                      <button onClick={() => agregar(p)} disabled={guardando} style={{ ...E.btn3, padding: '3px 9px' }}>Agregar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
