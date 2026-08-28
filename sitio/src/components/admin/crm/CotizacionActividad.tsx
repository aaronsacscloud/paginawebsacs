import { useEffect, useState } from 'react';
import Cargando from './ui/Cargando';
import RegistrarPagoModal, { resumenCierre } from './RegistrarPagoModal';
import { useIsMobile } from '../../../lib/ui/mobile';

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
  // Los mismos tres pesos que en el resto de Cotizaciones: morado sólido para
  // la acción principal, contorno azul para las importantes que no lo son, y
  // gris para lo secundario.
  btn: { padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff' } as const,
  btnA: { padding: '6px 13px', border: '1.5px solid #c9bcf7', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#5B4BD6' } as const,
  // Verde aguado con tinta legible, el mismo par que usan las pastillas de
  // "Pagada" y las cifras cobradas. El relleno saturado pesaba más que el
  // morado del resto del módulo y se robaba la pantalla.
  btnV: { padding: '7px 14px', border: '1.5px solid #cdeadd', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#EAF8F2', color: '#1E8A63' } as const,
  btnG: { padding: '6px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  fila: { display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #f5f5f5', fontSize: '0.8rem' } as const,
};

// El historial mostraba las claves internas: "created", "sent", "edited". Son
// el nombre del evento en la base, no algo que alguien deba leer.
const ESTADO_ES: Record<string, string> = {
  draft: 'borrador', sent: 'enviada', accepted: 'aceptada', paid: 'pagada',
  expired: 'vencida', rejected: 'rechazada', deleted: 'eliminada',
};
const EVENTO_ES: Record<string, string> = {
  created: 'Se creó la cotización', sent: 'Se envió al cliente', edited: 'Se editó',
  accepted: 'La aceptó el cliente', paid: 'Se marcó pagada', rejected: 'Se marcó rechazada',
  expired: 'Venció', extended: 'Se extendió la vigencia', duplicated: 'Se duplicó',
};

const METODOS = ['transferencia', 'efectivo', 'tarjeta', 'oxxo', 'mercadopago', 'stripe', 'otro'];

// `embebido`: la actividad vive DENTRO de la hoja (VistaRapida), que ya pone
// superficie, asa, identidad y acciones.
export default function CotizacionActividad({ quoteId, onClose, onCambio, embebido }: {
  quoteId: string; onClose: () => void; onCambio?: () => void; embebido?: boolean;
}) {
  const esMovilCot = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState('');
  const [nuevoAbono, setNuevoAbono] = useState<any>(null);
  const [editPago, setEditPago] = useState<string | null>(null);
  const [ep, setEp] = useState<any>({});
  const [cobrando, setCobrando] = useState(false);
  const [editFechaPago, setEditFechaPago] = useState(false);
  const [menuEdo, setMenuEdo] = useState(false);

  const cargar = () => fetch(`/api/revenue/quotes/actividad?id=${quoteId}`).then(r => r.json()).then(setD).catch(() => {});
  useEffect(() => { cargar(); }, [quoteId]);

  if (!d) {
    return (
      <div style={P.panel}>
        <Cargando texto="Cargando…" />
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
      // Solo lo que el endpoint espera: `concepto` y `vence` son ayuda visual
      // del formulario, no campos del pago.
      body: JSON.stringify({
        quote_id: quoteId,
        fecha: nuevoAbono.fecha, monto: nuevoAbono.monto,
        metodo: nuevoAbono.metodo, referencia: nuevoAbono.referencia,
      }),
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

  // Los cambios de estado se hacen DESDE AQUÍ: es la pantalla donde se ve el
  // historial, los abonos y las vistas, o sea el contexto para decidir. En el
  // menú de la lista eran cuatro opciones más entre las que había que buscar.
  async function cambiarEstado(accion: 'aceptada' | 'pagada' | 'rechazada' | 'extender') {
    setBusy(true);
    try {
      // El cobro se registra en su modal: forma de pago con botones (escrita a
      // mano se colaban typos y el reporte por método dejaba de cuadrar),
      // referencia, fecha y el aviso de que cobrar cierra la oportunidad.
      if (accion === 'pagada') { setCobrando(true); return; }
      if (accion === 'aceptada') {
        if (!confirm('¿Marcar esta cotización como ACEPTADA?\n\nSe registra como aceptada por el cliente y avanza su oportunidad.')) return;
        const j = await fetch('/api/revenue/mark-accepted', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: quoteId, aceptado_por: 'admin' }),
        }).then(r => r.json());
        if (j?.error) { alert(j.error); return; }
      }
      if (accion === 'rechazada') {
        // El motivo es obligatorio: sin él, en tres meses no se sabe si se
        // pierde por precio, por función o por no dar seguimiento.
        const op = prompt('¿Por qué se rechazó?\n\n1 No aceptó el monto\n2 Contrató otro sistema\n3 No era el momento\n4 Le faltaba una función\n5 Nunca respondió\n6 Canceló el proyecto\n7 Otro\n\nEscribe el número:', '1');
        if (!op) return;
        const mapa: Record<string, string> = { '1': 'precio', '2': 'competidor', '3': 'timing', '4': 'no_fit', '5': 'sin_respuesta', '6': 'cancelo_proyecto', '7': 'otro' };
        const motivo = mapa[String(op).trim()];
        if (!motivo) { alert('Escribe un número del 1 al 7.'); return; }
        const detalle = prompt('¿Algo que agregar? (obligatorio si elegiste "Otro")', '') || '';
        if (motivo === 'otro' && !detalle.trim()) { alert('Escribe el motivo.'); return; }
        const j = await fetch('/api/revenue/mark-rejected', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: quoteId, motivo, detalle }),
        }).then(r => r.json());
        if (j?.error) { alert(j.error); return; }
      }
      if (accion === 'extender') {
        const dias = prompt('¿Cuántos días más de vigencia?', '7');
        if (!dias) return;
        const j = await fetch('/api/revenue/extend-quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: quoteId, days: parseInt(dias) || 7 }),
        }).then(r => r.json());
        if (j?.error) { alert(j.error); return; }
      }
      await refrescar();
    } catch (e: any) { alert('No se pudo: ' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  const wa = String(q.whatsapp || '').replace(/\D/g, '');
  const link = typeof window !== 'undefined' ? `${window.location.origin}/cotizacion/${q.id}` : '';

  return (
    <>
      {cobrando && d?.quote && (
        <RegistrarPagoModal
          quote={{ id: quoteId, numero: d.quote.numero, empresa: d.quote.empresa, total: d.quote.total, abonado: d.total_pagado || 0 }}
          onCerrar={() => setCobrando(false)}
          onListo={(r: any) => {
            setCobrando(false);
            const extra = resumenCierre(r?.cierre);
            if (extra) alert('✓ Pago registrado.\n' + extra.charAt(0).toUpperCase() + extra.slice(1) + '.');
            cargar(); onCambio?.();
          }}
        />
      )}
      {!embebido && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1199 }} />}
      <div style={embebido ? { background: 'transparent' } : P.panel}>
        {/* Encabezado con el mismo tinte morado del buscador de cliente: separa
            el título del contenido sin meter una línea más. */}
        {!embebido && <div style={{ position: 'sticky', top: 0, background: '#faf8ff', borderBottom: '1px solid #e6ddfa', padding: esMovilCot ? '8px 12px 10px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2, flexWrap: esMovilCot ? 'wrap' : undefined }}>
          {esMovilCot && !embebido && (
            <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', padding: '8px 12px 8px 4px', fontSize: '0.95rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit', flexBasis: '100%' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Volver
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            {!embebido && <div style={{ fontWeight: 800, fontSize: '1rem', color: '#3b2a6b' }}>Cotización <span style={{ whiteSpace: 'nowrap' }}>{q.numero}</span></div>}
            {!embebido && <div style={{ fontSize: '0.76rem', color: '#7a6fc9', lineHeight: 1.4 }}><span style={{ whiteSpace: 'nowrap' }}>{q.empresa || q.contacto}</span> <span style={{ whiteSpace: 'nowrap' }}>· {money(q.total)}</span> <span style={{ whiteSpace: 'nowrap' }}>· {ESTADO_ES[q.estado] || q.estado}</span></div>}
          </div>
          <button onClick={copiarHistorial} style={P.btnG} title="Copiar el historial para pegarlo en un correo o nota">Copiar</button>
          {!embebido && <a href={`/cotizacion/${q.id}?admin=1`} target="_blank" rel="noreferrer" style={{ ...P.btnA, textDecoration: 'none' }}>Ver documento</a>}
          {!esMovilCot && <button onClick={onClose} style={{ ...P.btnG, border: 'none', fontSize: '1rem' }}>✕</button>}
        </div>}

        <div style={{ padding: embebido ? '14px 0 24px' : 18 }}>
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

          {/* ── Cambiar estado ── */}
          {/* Aquí y no en el menú de la lista: este es el lugar donde ya estás
              viendo abonos, vistas e historial, que es lo que te dice si toca
              marcarla pagada, extenderla o darla por perdida. */}
          <div style={P.card}>
            <div style={P.h}>Cambiar estado</div>
            <div className="ficha-acciones" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {q.estado !== 'accepted' && q.estado !== 'paid' && (
                <button style={P.btnA} disabled={busy} onClick={() => cambiarEstado('aceptada')}>Marcar aceptada</button>
              )}
              {/* La principal de este bloque: es la que cierra la venta. */}
              {q.estado !== 'paid' && (
                <button style={P.btnV} disabled={busy} onClick={() => cambiarEstado('pagada')}>Registrar pago</button>
              )}
              <button style={P.btnA} disabled={busy} onClick={() => cambiarEstado('extender')}>Extender vigencia</button>
              {q.estado !== 'rejected' && q.estado !== 'paid' && (
                <button style={{ ...P.btnG, color: '#b4302f', borderColor: '#f0cfcf' }} disabled={busy} onClick={() => cambiarEstado('rechazada')}>Marcar rechazada</button>
              )}
            </div>
          </div>

          {/* ── Pagos y abonos ── */}
          <div style={P.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...P.h, marginBottom: 0, flex: 1 }}>Pagos y abonos</div>
              {/* Un solo botón para cobrar: el abono se registra desde aquí y,
                  si hay plan, el formulario pregunta a qué parcialidad va. Tener
                  el mismo botón repetido en cada renglón solo obligaba a
                  elegir dos veces lo mismo. */}
              <button style={P.btnA} onClick={() => {
                const pend = (d.plan_pagos || []).filter((x: any) => !x.pagada);
                const toca = pend.find((x: any) => x.vencida) || pend[0] || null;
                const falta = toca ? Math.max(0, Number(toca.monto || 0) - Number(toca.cubierto || 0)) : 0;
                setNuevoAbono({
                  fecha: hoy(),
                  monto: toca ? String(Math.round(falta)) : (d.saldo > 0 ? d.saldo : ''),
                  metodo: 'transferencia', referencia: '',
                  concepto: toca?.concepto || '', vence: toca?.fecha || '',
                });
              }}>+ Abono</button>
              {/* El estado de cuenta se manda; por eso es un icono y no un
                  botón que compita. Con plan de pagos deja elegir cuál mandar. */}
              <div style={{ position: 'relative' }}>
                <button title="Mandar el estado de cuenta" style={{ ...P.btnG, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5, color: '#5B4BD6', borderColor: '#ddd6fb' }}
                  onClick={() => {
                    const pend = (d.plan_pagos || []).filter((x: any) => !x.pagada);
                    if (pend.length <= 1) { window.open(`/estado-cuenta/cotizacion/${d.quote.id}`, '_blank'); return; }
                    setMenuEdo(v => !v);
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h4" />
                  </svg>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Edo. cuenta</span>
                </button>
                {menuEdo && (
                  <div style={{ position: 'absolute', right: 0, top: 32, background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.14)', padding: 6, minWidth: 230, zIndex: 40 }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 8px' }}>Qué mandar</div>
                    <button style={{ ...P.btnG, width: '100%', justifyContent: 'flex-start', textAlign: 'left', marginBottom: 4, padding: '7px 9px' }}
                      onClick={() => { setMenuEdo(false); window.open(`/estado-cuenta/cotizacion/${d.quote.id}`, '_blank'); }}>
                      Todo el saldo · {money(d.saldo)}
                    </button>
                    {(d.plan_pagos || []).map((x: any, ix: number) => x.pagada ? null : (
                      <button key={x.id || ix} style={{ ...P.btnG, width: '100%', justifyContent: 'flex-start', textAlign: 'left', marginBottom: 4, padding: '7px 9px' }}
                        onClick={() => { setMenuEdo(false); window.open(`/estado-cuenta/cotizacion/${d.quote.id}?exh=${ix + 1}`, '_blank'); }}>
                        {x.concepto} · {money(Number(x.monto || 0) - Number(x.cubierto || 0))}
                        <span style={{ color: x.vencida ? '#b93333' : '#999', marginLeft: 6, fontWeight: 400 }}>{fDate(x.fecha)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

            {nuevoAbono && (<>
              {/* De qué parcialidad viene el abono: sin decirlo, el formulario
                  aparece con un monto ya escrito y nadie sabe por qué. */}
              {/* Con plan de pagos, lo primero es a QUÉ parcialidad se abona:
                  el monto se llena solo y el abono deja de ser un número suelto
                  que después nadie sabe a qué correspondía. */}
              {(d.plan_pagos || []).some((x: any) => !x.pagada) && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: '#777', fontWeight: 700 }}>Abona a</span>
                  <select value={nuevoAbono.concepto || ''} style={{ ...P.input, flex: '1 1 200px' }}
                    onChange={e => {
                      const x = (d.plan_pagos || []).find((p: any) => p.concepto === e.target.value && !p.pagada);
                      if (!x) { setNuevoAbono({ ...nuevoAbono, concepto: '', vence: '' }); return; }
                      const falta = Math.max(0, Number(x.monto || 0) - Number(x.cubierto || 0));
                      setNuevoAbono({ ...nuevoAbono, concepto: x.concepto, vence: x.fecha, monto: String(Math.round(falta)) });
                    }}>
                    {(d.plan_pagos || []).filter((x: any) => !x.pagada).map((x: any, ix: number) => (
                      <option key={x.id || ix} value={x.concepto}>
                        {x.concepto} · {money(Number(x.monto || 0) - Number(x.cubierto || 0))} · {fDate(x.fecha)}{x.vencida ? ' · vencida' : ''}
                      </option>
                    ))}
                    <option value="">Otro monto (no va a una parcialidad)</option>
                  </select>
                  {nuevoAbono.vence && (
                    <span style={{ fontSize: '0.71rem', color: '#8a8590' }}>vencía el {fDate(nuevoAbono.vence)}</span>
                  )}
                </div>
              )}
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
            </>)}

            {/* Plan de parcialidades: lo PACTADO contra lo que entró. Separarlo
                de los abonos es lo que permite ver que falta un pago antes de
                que el cliente lo mencione. */}
            {(d.plan_pagos || []).length > 0 && (
              <div style={{ marginTop: 6, marginBottom: 4 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#999', letterSpacing: '0.4px' }}>PLAN ACORDADO</div>
                {d.plan_pagos.map((x: any, ix: number) => {
                  const falta = Math.max(0, Number(x.monto || 0) - Number(x.cubierto || 0));
                  return (
                    <div key={x.id || ix} style={{ padding: '9px 0', borderTop: '1px solid #f5f5f5' }}>
                      {/* El renglón NO se comparte con los botones: con cuatro
                          datos y dos acciones en la misma línea, el concepto y
                          el monto se partían en dos pisos. Las acciones van
                          debajo, alineadas a la derecha y en tamaño chico. */}
                      <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: '0.8rem' }}>
                        <span style={{ flex: '0 0 14px', fontSize: '0.72rem' }}>{x.pagada ? '✅' : x.vencida ? '⚠️' : '🕐'}</span>
                        <span style={{ flex: '0 0 96px', color: x.vencida ? '#b93333' : '#666' }}>{fDate(x.fecha)}</span>
                        <span style={{ flex: 1, minWidth: 0, color: '#444' }}>{x.concepto}</span>
                        <b style={{ whiteSpace: 'nowrap', color: x.pagada ? '#1A8F7A' : x.vencida ? '#b93333' : '#1a1a1a' }}>{money(x.monto)}</b>
                      </div>
                      {!x.pagada && x.cubierto > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#a06600', marginTop: 4, paddingLeft: 119 }}>
                          abonado {money(x.cubierto)} · falta {money(falta)}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                  target="_blank" rel="noreferrer" style={{ ...P.btnA, textDecoration: 'none' }}>Recordar por WhatsApp</a>
              )}
            </div>
            {d.vistas.total === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#999', paddingTop: 8 }}>Nadie la ha abierto todavía.</div>
            ) : [...(d.vistas.eventos || [])].reverse().slice(0, 15).map((v: any, i: number) => (
              <div key={i} style={P.fila}>
                <span style={{ flex: 1 }}>{fHora(v.at)}</span>
                {v.duracion_seg ? <span style={{ color: '#666' }}>{dur(v.duracion_seg)}</span> : null}
                {v.scroll_pct != null ? <span style={{ color: v.scroll_pct >= 70 ? '#1A8F7A' : '#a06600' }}>leyó {v.scroll_pct}%</span> : null}
                {v.dispositivo ? <span style={{ color: '#a5a2af', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{v.dispositivo === 'movil' ? 'móvil' : 'web'}</span> : null}
              </div>
            ))}
            {d.vistas.eventos?.length > 15 && <div style={{ fontSize: '0.72rem', color: '#bbb', paddingTop: 6 }}>… y {d.vistas.eventos.length - 15} más</div>}
            {d.vistas.total > 0 && !d.vistas.eventos?.some((v: any) => v.duracion_seg) && (
              <div style={{ fontSize: '0.72rem', color: '#bbb', paddingTop: 6 }}>El tiempo de lectura se registra desde ahora: las aperturas anteriores no lo tienen.</div>
            )}
          </div>

          {/* ── Cambios ── */}
          {(d.cambios || []).length === 0 ? (
            <div style={{ fontSize: '0.76rem', color: '#a5a2af', padding: '2px 4px 10px' }}>Sin ediciones registradas — el historial se guarda desde ahora.</div>
          ) : (
          <div style={P.card}>
            <div style={P.h}>Cambios</div>
            {d.cambios.map((c: any, i: number) => (
              <div key={i} style={{ ...P.fila, display: 'block' }}>
                <div style={{ color: '#8a8a8a', fontSize: '0.72rem', marginBottom: 5 }}>{fHora(c.at)} · {c.por}</div>

                {/* Campo a la izquierda, cambio a la derecha: el valor viejo
                    tachado y el nuevo en negritas se leen de un golpe, sin
                    tener que buscar la flecha en medio de una frase. */}
                {(c.campos || []).map((f: any, j: number) => (
                  <div key={'f' + j} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8, fontSize: '0.79rem', padding: '2px 0', alignItems: 'baseline' }}>
                    <span style={{ color: '#8a8a8a' }}>{f.k}</span>
                    <span><span style={{ color: '#b0b0b0', textDecoration: 'line-through', marginRight: 6 }}>{f.antes}</span><b>{f.despues}</b></span>
                  </div>
                ))}

                {(c.conceptos || []).length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8, fontSize: '0.79rem', padding: '2px 0', alignItems: 'start' }}>
                    <span style={{ color: '#8a8a8a' }}>Conceptos</span>
                    <span>
                      {c.conceptos.map((x: any, k: number) => (
                        <div key={'c' + k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0' }}>
                          <span style={{ width: 12, fontWeight: 800, textAlign: 'center', color: x.op === 'add' ? '#0f7a56' : x.op === 'del' ? '#b4302f' : '#2c5fc4' }}>
                            {x.op === 'add' ? '+' : x.op === 'del' ? '−' : '✎'}
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</span>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {x.antes && <span style={{ color: '#b0b0b0', textDecoration: 'line-through', marginRight: 6 }}>{x.antes}</span>}
                            {x.despues && <b>{x.despues}</b>}
                          </span>
                        </div>
                      ))}
                    </span>
                  </div>
                )}

                {/* Ediciones guardadas antes de este detalle: se muestran como
                    quedaron. No se pueden reconstruir, y fingir el desglose
                    sería peor que enseñarlas tal cual. */}
                {!c.campos && !c.conceptos && (c.cambios || []).map((x: string, j: number) => (
                  <div key={'v' + j} style={{ fontSize: '0.79rem', color: '#666' }}>· {x}</div>
                ))}
              </div>
            ))}
          </div>
          )}

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
                    : EVENTO_ES[t.event] || t.event}
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
