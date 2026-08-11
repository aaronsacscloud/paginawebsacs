import { useEffect, useState } from 'react';

/* ═══ Panel de actividad de una cotización ═══
 *
 * Todo lo que la fila de la tabla ya no muestra vive aquí. La tabla es para
 * barrer 35 cotizaciones de un vistazo; el detalle de UNA no cabe ahí sin
 * volverla ilegible.
 *
 * Los bloques van en orden de lo que más se consulta y sin pestañas: esconder
 * el historial detrás de un tab es la forma más rápida de que nadie lo lea.
 */

const money = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fDate = (d?: string | null) => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fHora = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const dur = (s?: number) => !s ? '' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
const hoy = () => new Date().toISOString().slice(0, 10);

const P = {
  panel: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: '#fff', zIndex: 1200, boxShadow: '-8px 0 32px rgba(0,0,0,0.18)', overflowY: 'auto' as const },
  card: { border: '1px solid #ececec', borderRadius: 12, padding: 14, marginBottom: 12 } as const,
  h: { fontSize: '0.68rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 } as const,
  input: { padding: '7px 9px', border: '1px solid #ddd', borderRadius: 7, fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' as const, background: '#fff' },
  btn: { padding: '7px 12px', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '6px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  fila: { display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #f5f5f5', fontSize: '0.8rem' } as const,
};

const METODOS = ['transferencia', 'efectivo', 'tarjeta', 'oxxo', 'mercadopago', 'stripe', 'otro'];

export default function CotizacionActividad({ quoteId, onClose, onCambio }: {
  quoteId: string; onClose: () => void; onCambio?: () => void;
}) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState('');
  const [nuevoAbono, setNuevoAbono] = useState<any>(null);
  const [editPago, setEditPago] = useState<string | null>(null);
  const [ep, setEp] = useState<any>({});
  const [editFechaPago, setEditFechaPago] = useState(false);

  const cargar = () => fetch(`/api/revenue/quotes/actividad?id=${quoteId}`).then(r => r.json()).then(setD).catch(() => {});
  useEffect(() => { cargar(); }, [quoteId]);

  if (!d) {
    return (
      <div style={P.panel}>
        <div style={{ padding: 22, color: '#999' }}>Cargando…</div>
      </div>
    );
  }
  if (d.error) {
    return <div style={P.panel}><div style={{ padding: 22, color: '#b93333' }}>{d.error}</div></div>;
  }

  const q = d.quote;
  const refrescar = async () => { await cargar(); onCambio?.(); };

  async function guardarAbono() {
    if (!(Number(nuevoAbono.monto) > 0)) { alert('El monto del abono tiene que ser mayor a cero.'); return; }
    setBusy(true);
    const j = await fetch('/api/revenue/quotes/pagos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_id: quoteId, ...nuevoAbono }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo registrar' }));
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    setNuevoAbono(null); refrescar();
  }
  async function guardarEdicionPago(id: string) {
    setBusy(true);
    const j = await fetch('/api/revenue/quotes/pagos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago_id: id, ...ep }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    setEditPago(null); refrescar();
  }
  async function borrarPago(id: string) {
    if (!confirm('¿Quitar este abono? El saldo se recalcula.')) return;
    await fetch('/api/revenue/quotes/pagos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pago_id: id }) });
    refrescar();
  }
  async function guardarFechaPago(f: string) {
    const j = await fetch('/api/revenue/quotes/pagos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_id: quoteId, pagado_fecha: f || null }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo' }));
    if (j?.error) { alert(j.error); return; }
    setEditFechaPago(false); refrescar();
  }
  async function agregarNota() {
    if (!nota.trim()) return;
    await fetch('/api/revenue/quotes/actividad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: quoteId, nota }) });
    setNota(''); cargar();
  }

  // Copiar el historial: para pegarlo en un correo interno sin reescribirlo.
  function copiarHistorial() {
    const l: string[] = [`Cotización ${q.numero} · ${q.empresa || q.contacto} · ${money(q.total)} · ${q.estado}`];
    if (d.reemplaza_a?.length) l.push(`Reemplaza a: ${d.reemplaza_a.map((x: any) => x.numero).join(', ')}`);
    if (d.reemplazada_por) l.push(`Reemplazada por: ${d.reemplazada_por.numero}`);
    l.push(`Vistas: ${d.vistas.total}${d.vistas.ultima ? ` · última ${fHora(d.vistas.ultima)}` : ''}`);
    if (d.pagos?.length) { l.push('Abonos:'); d.pagos.forEach((p: any) => l.push(`  · ${fDate(p.fecha)} · ${money(p.monto)} · ${p.metodo}`)); }
    if (d.cambios?.length) { l.push('Cambios:'); d.cambios.forEach((c: any) => l.push(`  · ${fHora(c.at)} · ${c.por}: ${c.cambios.join('; ')}`)); }
    try { navigator.clipboard?.writeText(l.join('\n')); alert('Historial copiado'); } catch { /* */ }
  }

  const wa = String(q.whatsapp || '').replace(/\D/g, '');
  const link = typeof window !== 'undefined' ? `${window.location.origin}/cotizacion/${q.id}` : '';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1199 }} />
      <div style={P.panel}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Cotización {q.numero}</div>
            <div style={{ fontSize: '0.76rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.empresa || q.contacto} · {money(q.total)} · {q.estado}</div>
          </div>
          <button onClick={copiarHistorial} style={P.btnG} title="Copiar el historial para pegarlo en un correo o nota">📋</button>
          <a href={`/cotizacion/${q.id}?admin=1`} target="_blank" rel="noreferrer" style={{ ...P.btnG, textDecoration: 'none' }}>Ver documento</a>
          <button onClick={onClose} style={{ ...P.btnG, border: 'none', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ padding: 18 }}>
          {/* ── Resumen y vínculos ── */}
          <div style={P.card}>
            <div style={P.h}>Resumen</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <div><div style={{ color: '#999', fontSize: '0.68rem' }}>CREADA</div>{fDate(q.created_at)}</div>
              <div><div style={{ color: '#999', fontSize: '0.68rem' }}>VIGENCIA</div>{fDate(q.vigencia)}</div>
              <div><div style={{ color: '#999', fontSize: '0.68rem' }}>ABONADO</div><b>{money(d.total_pagado)}</b></div>
              <div><div style={{ color: '#999', fontSize: '0.68rem' }}>SALDO</div><b style={{ color: d.saldo > 0 ? '#b93333' : '#1A8F7A' }}>{money(d.saldo)}</b></div>
            </div>

            {/* Los vínculos, que salieron de la fila para no saturarla */}
            {d.reemplaza_a?.length > 0 && (
              <div style={{ marginTop: 10, fontSize: '0.8rem', background: '#eef2ff', border: '1px solid #dbe3fb', borderRadius: 8, padding: '8px 10px' }}>
                {/* Solo los folios: el monto de cada una junto al folio
                    amontonaba la línea y el dato que sí importa —cuánto cambió
                    en total— ya va abajo, en una sola frase. El monto de cada
                    cotización sigue a un clic, en su propio panel. */}
                ♻ <b>Reemplaza a</b> {d.reemplaza_a.map((x: any, i: number) => (
                  <span key={x.id}>{i > 0 ? ', ' : ''}
                    <a href={`/cotizacion/${x.id}?admin=1`} target="_blank" rel="noreferrer"
                      title={x.actual ? money(x.actual.total) : undefined} style={{ color: '#3764c4' }}>{x.numero}</a>
                  </span>
                ))}
                {/* E4 · comparar: la diferencia de precio contra lo que sustituye
                    responde sola por qué se recotizó. */}
                {d.reemplaza_a.some((x: any) => x.actual) && (() => {
                  const anterior = d.reemplaza_a.reduce((a: number, x: any) => a + Number(x.actual?.total || 0), 0);
                  const dif = Number(q.total) - anterior;
                  return anterior > 0 ? (
                    <div style={{ marginTop: 5, fontSize: '0.74rem', color: '#8a8f98' }}>
                      Antes sumaban {money(anterior)} · ahora {money(q.total)}
                      <span style={{ color: dif === 0 ? '#8a8f98' : dif > 0 ? '#1A8F7A' : '#b93333', fontWeight: 700 }}>
                        {' '}({dif >= 0 ? '+' : '−'}{money(Math.abs(dif))})
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            {d.reemplazada_por && (
              <div style={{ marginTop: 10, fontSize: '0.8rem', background: '#f3f4f6', borderRadius: 8, padding: '8px 10px' }}>
                🗄 Archivada · la reemplaza <a href={`/cotizacion/${d.reemplazada_por.id}?admin=1`} target="_blank" rel="noreferrer" style={{ color: '#3764c4' }}>{d.reemplazada_por.numero}</a>
              </div>
            )}
            {d.archivado && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#666' }}>
                Archivada el {fHora(d.archivado.at)} por {d.archivado.por} — {d.archivado.motivo_label}{d.archivado.detalle ? `: ${d.archivado.detalle}` : ''}
                {d.archivado.junto_con?.length ? ` · junto con ${d.archivado.junto_con.join(', ')}` : ''}
              </div>
            )}
          </div>

          {/* ── Pagos y abonos ── */}
          <div style={P.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...P.h, marginBottom: 0, flex: 1 }}>Pagos y abonos</div>
              <button style={P.btnG} onClick={() => setNuevoAbono({ fecha: hoy(), monto: d.saldo > 0 ? d.saldo : '', metodo: 'transferencia', referencia: '' })}>+ Abono</button>
            </div>

            {/* La fecha de pago SIEMPRE editable: el pago casi nunca se captura
                el día que ocurrió. */}
            {q.pagado_fecha && (
              <div style={{ ...P.fila, borderTop: 'none', color: '#1A8F7A', fontWeight: 700 }}>
                ✅ Pagada el {editFechaPago
                  ? <input type="date" defaultValue={String(q.pagado_fecha).slice(0, 10)} onBlur={e => guardarFechaPago(e.target.value)} style={{ ...P.input, marginLeft: 6 }} autoFocus />
                  : <span> {fDate(q.pagado_fecha)}</span>}
                {!editFechaPago && <button style={{ ...P.btnG, marginLeft: 6, padding: '3px 8px' }} onClick={() => setEditFechaPago(true)}>editar fecha</button>}
              </div>
            )}

            {nuevoAbono && (
              <div style={{ ...P.fila, flexWrap: 'wrap' }}>
                <input type="date" value={nuevoAbono.fecha} onChange={e => setNuevoAbono({ ...nuevoAbono, fecha: e.target.value })} style={{ ...P.input, flex: '0 0 140px' }} />
                <input type="number" value={nuevoAbono.monto} onChange={e => setNuevoAbono({ ...nuevoAbono, monto: e.target.value })} placeholder="monto" style={{ ...P.input, flex: '0 0 110px' }} />
                <select value={nuevoAbono.metodo} onChange={e => setNuevoAbono({ ...nuevoAbono, metodo: e.target.value })} style={{ ...P.input, flex: '0 0 130px' }}>
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input value={nuevoAbono.referencia} onChange={e => setNuevoAbono({ ...nuevoAbono, referencia: e.target.value })} placeholder="referencia" style={{ ...P.input, flex: '1 1 110px' }} />
                <button style={P.btn} disabled={busy} onClick={guardarAbono}>Guardar</button>
                <button style={P.btnG} onClick={() => setNuevoAbono(null)}>✕</button>
              </div>
            )}

            {/* Plan de parcialidades: lo PACTADO contra lo que entró. Separarlo
                de los abonos es lo que permite ver que falta un pago antes de
                que el cliente lo mencione. */}
            {(d.plan_pagos || []).length > 0 && (
              <div style={{ marginTop: 6, marginBottom: 4 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#999', letterSpacing: '0.4px' }}>PLAN ACORDADO</div>
                {d.plan_pagos.map((x: any) => (
                  <div key={x.id} style={P.fila}>
                    <span style={{ flex: '0 0 16px' }}>{x.pagada ? '✅' : x.vencida ? '⚠️' : '🕐'}</span>
                    <span style={{ flex: '0 0 100px', color: x.vencida ? '#b93333' : '#666' }}>{fDate(x.fecha)}</span>
                    <span style={{ flex: 1, color: '#666' }}>{x.concepto}</span>
                    <b style={{ color: x.pagada ? '#1A8F7A' : x.vencida ? '#b93333' : '#1a1a1a' }}>{money(x.monto)}</b>
                    {!x.pagada && x.cubierto > 0 && <span style={{ fontSize: '0.7rem', color: '#a06600' }}>abonado {money(x.cubierto)}</span>}
                  </div>
                ))}
              </div>
            )}

            {(d.pagos || []).length === 0 && !nuevoAbono && (
              <div style={{ fontSize: '0.8rem', color: '#999', paddingTop: 8 }}>Sin abonos registrados.</div>
            )}
            {(d.pagos || []).length > 0 && (d.plan_pagos || []).length > 0 && (
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#999', letterSpacing: '0.4px', marginTop: 8 }}>ABONOS REGISTRADOS</div>
            )}
            {(d.pagos || []).map((p: any) => (
              <div key={p.id} style={{ ...P.fila, flexWrap: 'wrap' }}>
                {editPago === p.id ? (
                  <>
                    <input type="date" defaultValue={String(p.fecha).slice(0, 10)} onChange={e => setEp({ ...ep, fecha: e.target.value })} style={{ ...P.input, flex: '0 0 140px' }} />
                    <input type="number" defaultValue={p.monto} onChange={e => setEp({ ...ep, monto: e.target.value })} style={{ ...P.input, flex: '0 0 110px' }} />
                    <select defaultValue={p.metodo} onChange={e => setEp({ ...ep, metodo: e.target.value })} style={{ ...P.input, flex: '0 0 130px' }}>
                      {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button style={P.btn} disabled={busy} onClick={() => guardarEdicionPago(p.id)}>Guardar</button>
                    <button style={P.btnG} onClick={() => setEditPago(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: '0 0 110px', color: '#666' }}>{fDate(p.fecha)}</span>
                    <b style={{ flex: '0 0 100px' }}>{money(p.monto)}</b>
                    <span style={{ color: '#888', flex: '1 1 90px' }}>{p.metodo}{p.referencia ? ` · ${p.referencia}` : ''}</span>
                    {p.numero_acuse && <a href={`/acuse/${p.id}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.75rem' }}>🧾 {p.numero_acuse}</a>}
                    <button style={{ ...P.btnG, padding: '3px 8px' }} onClick={() => { setEditPago(p.id); setEp({}); }}>editar</button>
                    <button style={{ ...P.btnG, padding: '3px 8px', color: '#b93333' }} onClick={() => borrarPago(p.id)}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Vistas del cliente ── */}
          <div style={P.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...P.h, marginBottom: 0, flex: 1 }}>La abrió {d.vistas.total} {d.vistas.total === 1 ? 'vez' : 'veces'}</div>
              {/* E2 · el momento de máximo interés ya pasó por aquí: recordarle
                  cuesta un clic. */}
              {d.vistas.total > 0 && q.estado !== 'paid' && (
                <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${q.contacto || ''} 👋 ¿Pudiste revisar la cotización ${q.numero}? Aquí la tienes:\n${link}`)}`}
                  target="_blank" rel="noreferrer" style={{ ...P.btnG, textDecoration: 'none', color: '#1A8F7A', borderColor: '#bfe8df', fontWeight: 700 }}>💬 Recordar</a>
              )}
            </div>
            {d.vistas.total === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#999', paddingTop: 8 }}>Nadie la ha abierto todavía.</div>
            ) : [...(d.vistas.eventos || [])].reverse().slice(0, 15).map((v: any, i: number) => (
              <div key={i} style={P.fila}>
                <span style={{ flex: 1 }}>{fHora(v.at)}</span>
                {v.duracion_seg ? <span style={{ color: '#666' }}>{dur(v.duracion_seg)}</span> : null}
                {v.scroll_pct != null ? <span style={{ color: v.scroll_pct >= 70 ? '#1A8F7A' : '#a06600' }}>leyó {v.scroll_pct}%</span> : null}
                {v.dispositivo ? <span style={{ color: '#bbb', fontSize: '0.72rem' }}>{v.dispositivo === 'movil' ? '📱' : '💻'}</span> : null}
              </div>
            ))}
            {d.vistas.eventos?.length > 15 && <div style={{ fontSize: '0.72rem', color: '#bbb', paddingTop: 6 }}>… y {d.vistas.eventos.length - 15} más</div>}
            {d.vistas.total > 0 && !d.vistas.eventos?.some((v: any) => v.duracion_seg) && (
              <div style={{ fontSize: '0.72rem', color: '#bbb', paddingTop: 6 }}>El tiempo de lectura se registra desde ahora: las aperturas anteriores no lo tienen.</div>
            )}
          </div>

          {/* ── Cambios ── */}
          <div style={P.card}>
            <div style={P.h}>Cambios</div>
            {(d.cambios || []).length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#999' }}>Sin ediciones registradas. El historial se guarda desde ahora.</div>
            ) : d.cambios.map((c: any, i: number) => (
              <div key={i} style={{ ...P.fila, display: 'block' }}>
                <div style={{ color: '#666', fontSize: '0.72rem' }}>{fHora(c.at)} · {c.por}</div>
                {c.cambios.map((x: string, j: number) => <div key={j} style={{ fontSize: '0.8rem' }}>· {x}</div>)}
              </div>
            ))}
          </div>

          {/* ── Notas internas ── */}
          <div style={P.card}>
            <div style={P.h}>Notas internas</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={nota} onChange={e => setNota(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarNota(); }}
                placeholder="pidió descuento por volumen, lo ve con su socio…" style={{ ...P.input, flex: 1 }} />
              <button style={P.btn} onClick={agregarNota}>Agregar</button>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#bbb', marginBottom: 4 }}>Solo para el equipo: nunca salen en la cotización del cliente.</div>
            {(d.notas_internas || []).map((n: any) => (
              <div key={n.id} style={{ ...P.fila, display: 'block' }}>
                <div style={{ fontSize: '0.82rem' }}>{n.texto}</div>
                <div style={{ fontSize: '0.7rem', color: '#aaa' }}>{n.por} · {fHora(n.at)}
                  <button onClick={async () => { await fetch('/api/revenue/quotes/actividad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: quoteId, nota_id: n.id, borrar: true }) }); cargar(); }}
                    style={{ background: 'none', border: 'none', color: '#c99', cursor: 'pointer', fontSize: '0.7rem' }}>quitar</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Todo lo que ha pasado ── */}
          <div style={P.card}>
            <div style={P.h}>Actividad</div>
            {[...(d.timeline || [])].reverse().map((t: any, i: number) => (
              <div key={i} style={P.fila}>
                <span style={{ flex: 1 }}>
                  {t.event === 'viewed' ? '👀 La abrió el cliente'
                    : t.event === 'eliminada' ? `🗄 Archivada — ${t.motivo || ''}`
                    : t.event === 'restaurada' ? '↩️ Restaurada'
                    : t.event === 'abono' ? `💵 ${t.detalle || 'abono'}`
                    : t.event === 'fecha_pago_editada' ? `📅 Fecha de pago: ${t.de || '—'} → ${t.a || '—'}`
                    : t.event}
                  {t.por ? <span style={{ color: '#aaa' }}> · {t.por}</span> : null}
                </span>
                <span style={{ color: '#aaa', fontSize: '0.72rem' }}>{fHora(t.at)}</span>
              </div>
            ))}
            {(d.actividades || []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.68rem', color: '#bbb', marginBottom: 4 }}>EN EL CRM</div>
                {d.actividades.map((a: any) => (
                  <div key={a.id} style={P.fila}>
                    <span style={{ flex: 1 }}>{a.titulo}</span>
                    <span style={{ color: '#aaa', fontSize: '0.72rem' }}>{fHora(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
