/**
 * CHURN · el caso, que es donde se trabaja el rescate.
 *
 * Arriba el bloque «Rescate»: en qué etapa va, qué se pactó, cuántos días le
 * quedan y —lo que de verdad decide— si está usando el sistema. Abajo, la
 * línea de tiempo, que es la MISMA de la ficha 360: el rescate se lee con todo
 * lo que ya pasó con ese cliente, no en una burbuja aparte.
 *
 * Las transiciones piden lo que la etapa destino exige y NO más. El servidor
 * valida igual: aquí solo se evita el viaje en balde y se explica el porqué.
 */
import { useEffect, useState } from 'react';
import { useIsMobile, useDrawerHistory } from '../../../lib/ui/mobile';
import { ETAPAS, ETAPA, MOTIVOS, MOTIVO, diasDeGracia, saludDeGracia, modulosVivos, compararUso, veredictoRescate, type Etapa } from '../../../lib/crm/churn.reglas';
import { confirmar } from '../../../lib/ui/confirmar';

const dinero = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

/* Plantillas de gracia. Salen de lo que MIDIÓ el módulo: el 65% del MRR se
   fue por servicio, no por precio — así que el primer acuerdo que se ofrece
   arregla el soporte, no regala meses. */
const PLANTILLAS = [
  { l: '30 días con soporte dedicado', dias: 30, nota: 'Acompañamiento directo para resolver lo que quedó mal.' },
  { l: '60 días al 50%', dias: 60, nota: 'Descuento mientras se recupera la confianza.' },
  { l: '30 días de cortesía', dias: 30, nota: 'Acceso completo sin costo para que vuelva a probarlo.' },
];

export default function ChurnCaso({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio: () => void }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>({});
  const [pidiendo, setPidiendo] = useState<Etapa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toque, setToque] = useState<any>({ tipo: 'llamada', texto: '', proximo_paso: '', proximo_paso_at: '' });
  const [extendiendo, setExtendiendo] = useState(false);
  const esMovil = useIsMobile();
  /* En el teléfono, «atrás» tiene que cerrar la hoja, no sacarte de la
     sección: es el estándar de las 17 pantallas del CRM móvil. */
  useDrawerHistory(esMovil, onCerrar);

  async function registrar(cuerpo: any) {
    setGuardando(true); setError('');
    const r = await fetch('/api/crm/churn/caso', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...cuerpo }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setError(r.error); return false; }
    setToque({ tipo: 'llamada', texto: '', proximo_paso: '', proximo_paso_at: '' });
    setExtendiendo(false); cargar(); onCambio(); return true;
  }

  const cargar = () => fetch(`/api/crm/churn/caso?id=${id}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, [id]);
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', t);
    return () => document.removeEventListener('keydown', t);
  }, [onCerrar]);

  const caso = d?.caso, emp = caso?.companies || {};
  const quedan = caso ? diasDeGracia(caso) : null;
  const salud = caso ? saludDeGracia(caso, emp) : null;

  async function mover(destino: Etapa, extra: any = {}) {
    setGuardando(true); setError('');
    const r = await fetch('/api/crm/churn/caso', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, etapa: destino, ...extra }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setError(r.error); return; }
    // El desbloqueo de la cuenta es un hecho aparte: si falló, la etapa SÍ
    // cambió y hay que decirlo, no esconderlo tras un "listo".
    if (r?.acceso && !r.acceso.ok) setError(`La etapa cambió, pero no se pudo devolver el acceso en SACS: ${r.acceso.error}`);
    setPidiendo(null); setForm({}); cargar(); onCambio();
  }

  const Campo = ({ l, children }: any) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>{l}</span>
      {children}
    </label>
  );
  const inp: any = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e4e9', borderRadius: 9,
    padding: '9px 11px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' };

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.32)', zIndex: 900 }} />
      {/* `crm-sheet` es lo que engancha el modo oscuro del CRM: sin esa clase,
          el caso salía como un panel BLANCO a pantalla completa encima de una
          app en oscuro. Y en el teléfono sube desde abajo, no entra por la
          derecha: por la derecha es un gesto de escritorio. */}
      <div className="crm-sheet" role="dialog" aria-modal="true" aria-label="Caso de churn" style={esMovil ? {
        position: 'fixed', left: 0, right: 0, bottom: 0, top: 44, background: '#FBFAFF',
        borderRadius: '16px 16px 0 0', boxShadow: '0 -12px 40px rgba(16,24,40,.22)', zIndex: 901,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      } : {
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 96vw)', background: '#FBFAFF',
        borderLeft: '1px solid #eae7f2', boxShadow: '-14px 0 44px rgba(16,24,40,.16)', zIndex: 901,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {!d ? <div style={{ padding: 30, color: '#8e88a8' }}>Cargando…</div> : !caso ? <div style={{ padding: 30 }}>No existe ese caso.</div> : (<>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '18px 20px 12px', borderBottom: '1px solid #f0eef7', background: '#fff' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#241d43', letterSpacing: '-.01em' }}>{emp.nombre || 'Sin nombre'}</div>
              <div style={{ fontSize: '0.79rem', color: '#71707C', marginTop: 2 }}>
                {dinero(caso.mrr_perdido)} de MRR · canceló {String(caso.detectado_at || '').slice(0, 10)}
                {caso.fecha_estimada && <span title="El registro vino de Excel sin fecha de cancelación"> (estimada)</span>}
                {caso.episodio > 1 && <b style={{ color: '#C0554E' }}> · {caso.episodio}ª vez</b>}
              </div>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar" style={{ border: 'none', background: 'none', cursor: 'pointer',
              color: '#8e88a8', width: 32, height: 32, borderRadius: 8, fontSize: '1.1rem' }}>✕</button>
          </div>

          {/* Escribirle desde aquí: el rescate se hace hablando, y salir a
              buscar el hilo a mano es donde se pierde la intención. */}
          {(caso.companies?.id) && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0', flexWrap: 'wrap' }}>
              <a href={`/admin/crm?tab=whatsapp&wa_search=${encodeURIComponent(String(d.tel || ''))}&wa_nuevo=1`}
                style={{ ...btn('#1E8A63'), textDecoration: 'none', display: 'inline-block' }}>WhatsApp</a>
              <a href={`/admin/crm?tab=cotizaciones&nueva=1&company=${caso.company_id}`}
                style={{ ...btn('#fff', '#5B4BD6'), textDecoration: 'none', display: 'inline-block' }}>Cotizar</a>
              <a href={`/admin/crm?tab=reuniones&nueva=1&company=${caso.company_id}`}
                style={{ ...btn('#fff', '#5B4BD6'), textDecoration: 'none', display: 'inline-block' }}>Agendar</a>
            </div>
          )}

          <div style={{ padding: 18 }}>
            {/* ── Bloque RESCATE ── */}
            <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ ...ETAPA(caso.etapa) as any, fontSize: '0.72rem', fontWeight: 800, borderRadius: 20,
                  padding: '4px 12px', background: ETAPA(caso.etapa).bg, color: ETAPA(caso.etapa).fg }}>{ETAPA(caso.etapa).l}</span>
                {salud && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 600,
                    color: salud.tono === 'bien' ? '#1E8A63' : salud.tono === 'mal' ? '#C0554E' : salud.tono === 'ojo' ? '#a06600' : '#74727F' }}>
                    {salud.texto}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#71707C', marginTop: 8, lineHeight: 1.5 }}>{ETAPA(caso.etapa).d}</div>

              {caso.etapa === 'gracia' && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 11,
                  background: quedan != null && quedan < 0 ? '#FDF6F5' : '#F3F0FE' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: quedan != null && quedan < 0 ? '#C0554E' : '#5B4BD6' }}>
                    {quedan != null && quedan < 0 ? `La gracia venció hace ${Math.abs(quedan)} días` : `Quedan ${quedan} días de gracia`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 4 }}>{caso.gracia_acuerdo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#71707C', marginTop: 2 }}>
                    Al terminar vuelve a {dinero(caso.gracia_mrr)} · hasta {caso.gracia_fin}
                  </div>
                </div>
              )}

              {/* De quién es. Un caso sin dueño es un caso que nadie trabaja
                  — y con equipo, dos personas le escriben al mismo o ninguna. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: '#71707C' }}>Responsable:</span>
                <select value={caso.owner_id || ''} disabled={guardando}
                  onChange={async e => {
                    setGuardando(true);
                    await fetch('/api/crm/churn/caso', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id, owner_id: e.target.value || null }) }).catch(() => {});
                    setGuardando(false); cargar(); onCambio();
                  }}
                  style={{ border: '1px solid #e2e4e9', borderRadius: 9, padding: '6px 10px', fontSize: '0.8rem',
                    fontFamily: 'inherit', outline: 'none', background: caso.owner_id ? '#fff' : '#FFF8EC' }}>
                  <option value="">Sin asignar</option>
                  {(d.equipo || []).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              {caso.proximo_paso && (
                <div style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 10 }}>
                  <b>Qué sigue:</b> {caso.proximo_paso}
                  <span style={{ color: caso.proximo_paso_at && caso.proximo_paso_at < new Date().toISOString().slice(0, 10) ? '#C0554E' : '#71707C' }}>
                    {' · '}{caso.proximo_paso_at}
                  </span>
                </div>
              )}

              <div style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 12 }}>
                <b>Por qué se fue:</b> {MOTIVO(caso.motivo_categoria)}
                {(caso.motivo_detalle || caso.motivo_original) && <div style={{ color: '#71707C', marginTop: 3 }}>{caso.motivo_detalle || caso.motivo_original}</div>}
              </div>

              {error && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, background: '#FDF6F5',
                color: '#C0554E', fontSize: '0.8rem', lineHeight: 1.45 }}>{error}</div>}

              {/* ── Los botones que existen desde esta etapa ── */}
              {!pidiendo && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {caso.etapa === 'detectado' && (
                    <button onClick={() => mover('conciliacion')} disabled={guardando} style={btn('#5B4BD6')}>Empezar conciliación</button>
                  )}
                  {(caso.etapa === 'detectado' || caso.etapa === 'conciliacion') && (
                    <button onClick={() => setPidiendo('gracia')} style={btn('#7C6BF0')}>Pactar período de gracia</button>
                  )}
                  {caso.etapa === 'gracia' && (
                    <button onClick={() => setExtendiendo(true)} style={btn('#fff', '#5B4BD6')}>Extender la gracia</button>
                  )}
                  {['detectado', 'conciliacion', 'gracia'].includes(caso.etapa) && (<>
                    <button onClick={() => setPidiendo('recuperado')} style={btn('#1E8A63')}>Marcar recuperado</button>
                    <button onClick={() => setPidiendo('irrecuperable')} style={btn('#fff', '#C0554E')}>Cerrar como perdido</button>
                  </>)}
                  {!['detectado', 'conciliacion', 'gracia'].includes(caso.etapa) && (
                    <div style={{ fontSize: '0.8rem', color: '#71707C' }}>
                      Caso cerrado. Si este cliente vuelve a irse, se abre un episodio nuevo.
                    </div>
                  )}
                </div>
              )}

              {extendiendo && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <Campo l="Nueva fecha de fin">
                    <input type="date" style={inp} value={form.gracia_fin || ''} onChange={e => setForm({ ...form, gracia_fin: e.target.value })} />
                  </Campo>
                  {(caso.gracia_extensiones || 0) >= 1 && (
                    <Campo l="Por qué se extiende otra vez">
                      <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.motivo || ''}
                        onChange={e => setForm({ ...form, motivo: e.target.value })} />
                    </Campo>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#71707C', marginBottom: 10 }}>
                    {(caso.gracia_extensiones || 0) >= 1
                      ? 'Es la segunda extensión: extender sin fin es regalar el sistema en cuotas, por eso hay que decir por qué.'
                      : 'Queda registrado en la historia del caso.'}
                  </div>
                  <Acciones onCancelar={() => { setExtendiendo(false); setForm({}); }} guardando={guardando}
                    onOk={() => registrar({ accion: 'extender', gracia_fin: form.gracia_fin, motivo: form.motivo })} />
                </div>
              )}

              {/* ── Pactar la gracia: los tres datos, o no pasa ── */}
              {pidiendo === 'gracia' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {PLANTILLAS.map(t => (
                      <button key={t.l} onClick={() => {
                        const f = new Date(Date.now() + t.dias * 864e5).toISOString().slice(0, 10);
                        setForm({ ...form, gracia_acuerdo: t.l, gracia_fin: f, gracia_mrr: form.gracia_mrr ?? caso.mrr_perdido });
                      }} style={{ border: '1px solid #e2dbf8', background: '#fff', color: '#5B4BD6', borderRadius: 20,
                        padding: '5px 12px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        title={t.nota}>{t.l}</button>
                    ))}
                  </div>
                  <Campo l="Qué se pactó">
                    <input style={inp} value={form.gracia_acuerdo || ''} placeholder="ej. 30 días con soporte dedicado"
                      onChange={e => setForm({ ...form, gracia_acuerdo: e.target.value })} />
                  </Campo>
                  <Campo l="Hasta cuándo">
                    <input type="date" style={inp} value={form.gracia_fin || ''} onChange={e => setForm({ ...form, gracia_fin: e.target.value })} />
                  </Campo>
                  <Campo l="A cuánto vuelve a pagar al terminar">
                    <input type="number" style={inp} value={form.gracia_mrr ?? ''} placeholder={String(caso.mrr_perdido)}
                      onChange={e => setForm({ ...form, gracia_mrr: e.target.value })} />
                  </Campo>
                  <div style={{ fontSize: '0.75rem', color: '#71707C', marginBottom: 10, lineHeight: 1.5 }}>
                    Al guardar se le devuelve el acceso en SACS automáticamente, si la cuenta está ligada.
                  </div>
                  <Acciones onCancelar={() => { setPidiendo(null); setForm({}); }} guardando={guardando}
                    onOk={() => mover('gracia', { gracia_acuerdo: form.gracia_acuerdo, gracia_fin: form.gracia_fin, gracia_mrr: form.gracia_mrr })} />
                </div>
              )}

              {pidiendo === 'recuperado' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <div style={{ fontSize: '0.82rem', color: '#4a4756', marginBottom: 10, lineHeight: 1.5 }}>
                    Para marcar recuperado hace falta la suscripción nueva que lo respalda:
                    un recuperado que no paga mentiría en la ARR.
                  </div>
                  {(d.subs_vivas || []).length === 0 ? (
                    <div style={{ padding: '11px 13px', borderRadius: 10, background: '#FFF8EC', color: '#a06600',
                      fontSize: '0.81rem', lineHeight: 1.5, marginBottom: 10 }}>
                      Esta empresa no tiene ninguna suscripción viva. Créala primero en <b>Facturación → Suscripciones</b>
                      y vuelve: aquí va a aparecer sola.
                    </div>
                  ) : (
                    /* Un select con las subs vivas de ESTA empresa, no un campo
                       de uuid: pegar el id de la sub cancelada pasaba antes
                       todas las validaciones y dejaba un «recuperado» que no
                       paga. Ahora ni siquiera es posible elegirlo. */
                    <Campo l="Con qué suscripción volvió">
                      <select style={inp} value={form.subscription_nueva_id || ''}
                        onChange={e => setForm({ ...form, subscription_nueva_id: e.target.value })}>
                        <option value="">Elige la suscripción…</option>
                        {(d.subs_vivas || []).map((x: any) => (
                          <option key={x.id} value={x.id}>
                            {x.nombre_plan} · {dinero(x.mrr)}/mes · {x.estado}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                  <Acciones onCancelar={() => setPidiendo(null)} guardando={guardando}
                    onOk={() => mover('recuperado', { subscription_nueva_id: form.subscription_nueva_id })} />
                </div>
              )}

              {pidiendo === 'irrecuperable' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <Campo l="Categoría">
                    <select style={inp} value={form.motivo_categoria || caso.motivo_categoria || ''}
                      onChange={e => setForm({ ...form, motivo_categoria: e.target.value })}>
                      <option value="">Elige…</option>
                      {MOTIVOS.map(m => <option key={m.id} value={m.id}>{m.l}</option>)}
                    </select>
                  </Campo>
                  <Campo l="Por qué se perdió (esto es lo que enseña para el siguiente)">
                    <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.resultado_motivo || ''}
                      onChange={e => setForm({ ...form, resultado_motivo: e.target.value })} />
                  </Campo>
                  <Acciones onCancelar={() => setPidiendo(null)} guardando={guardando} peligro
                    onOk={async () => {
                      if (!await confirmar('¿Cerrar este caso como perdido?', { accion: 'Cerrar', detalle: 'Es definitivo: si el cliente vuelve, se abre un episodio nuevo.' })) return;
                      mover('irrecuperable', { resultado_motivo: form.resultado_motivo, motivo_categoria: form.motivo_categoria });
                    }} />
                </div>
              )}
            </div>

            {/* ── Episodios anteriores: un reincidente se trabaja distinto ── */}
            {(d.episodios || []).length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8' }}>
                  Ya se había ido antes
                </div>
                {d.episodios.map((e: any) => (
                  <div key={e.id} style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 8 }}>
                    <b>Episodio {e.episodio}</b> · {String(e.detectado_at || '').slice(0, 10)} → {e.resultado === 'recuperado' ? 'volvió' : 'se perdió'}
                    {e.resultado_motivo && <div style={{ color: '#71707C', fontSize: '0.76rem' }}>{e.resultado_motivo}</div>}
                  </div>
                ))}
              </div>
            )}

            <BloquePropuesta d={d} id={id} onCambio={() => { cargar(); onCambio(); }} />
            <BloqueUso caso={caso} emp={emp} />
            <BloqueCompromisos lista={d.compromisos || []} />

            {/* ── Registrar lo que pasó. Va ARRIBA de la historia porque es
                    lo que se hace al terminar una llamada, no al final de
                    leerla. Y registrar un contacto real mueve el caso a
                    conciliación solo: la etapa describe lo que pasa, no es una
                    tarea aparte que el vendedor tenga que acordarse de hacer. ── */}
            {['detectado', 'conciliacion', 'gracia'].includes(caso.etapa) && (
              <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
                  Registrar un toque
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[['llamada', 'Llamada'], ['whatsapp', 'WhatsApp'], ['correo', 'Correo'], ['reunion', 'Reunión'], ['nota', 'Nota']].map(([v2, l]) => (
                    <button key={v2} onClick={() => setToque({ ...toque, tipo: v2 })}
                      style={{ border: '1px solid', borderColor: toque.tipo === v2 ? '#5B4BD6' : '#e2dbf8',
                        background: toque.tipo === v2 ? '#EEECFE' : '#fff', color: toque.tipo === v2 ? '#5B4BD6' : '#5a5a63',
                        borderRadius: 20, padding: '5px 12px', fontSize: '0.75rem', fontWeight: toque.tipo === v2 ? 800 : 600,
                        cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                  ))}
                </div>
                <textarea style={{ ...inp, minHeight: 62, resize: 'vertical' }} placeholder="Qué pasó…"
                  value={toque.texto} onChange={e => setToque({ ...toque, texto: e.target.value })} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <input style={{ ...inp, flex: '2 1 180px' }} placeholder="Qué sigue (opcional)"
                    value={toque.proximo_paso} onChange={e => setToque({ ...toque, proximo_paso: e.target.value })} />
                  <input type="date" style={{ ...inp, flex: '1 1 130px' }} value={toque.proximo_paso_at}
                    onChange={e => setToque({ ...toque, proximo_paso_at: e.target.value })} />
                </div>
                <button disabled={guardando || !toque.texto.trim()} style={{ ...btn('#5B4BD6'), marginTop: 10, opacity: toque.texto.trim() ? 1 : .5 }}
                  onClick={() => registrar(toque)}>{guardando ? 'Guardando…' : 'Guardar el toque'}</button>
              </div>
            )}

            {/* ── La línea de tiempo: la MISMA de la ficha 360 ── */}
            <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
                Todo lo que ha pasado con este cliente
              </div>
              {(d.historia || []).length === 0 ? <div style={{ fontSize: '0.82rem', color: '#71707C' }}>Todavía nada.</div>
              : d.historia.map((h: any) => (
                <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f6f5fa' }}>
                  <span style={{ flex: 'none', width: 6, height: 6, borderRadius: 99, marginTop: 7,
                    background: h.churn_caso_id ? '#7C6BF0' : '#d5d2e0' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: '#241d43', fontWeight: h.churn_caso_id ? 700 : 500 }}>{h.titulo}</div>
                    {h.descripcion && <div style={{ fontSize: '0.76rem', color: '#71707C', marginTop: 2 }}>{h.descripcion}</div>}
                    <div style={{ fontSize: '0.7rem', color: '#8e88a8', marginTop: 2 }}>{new Date(h.created_at).toLocaleString('es-MX')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>)}
      </div>
    </>
  );
}

const btn = (bg: string, color?: string) => ({
  border: color ? `1.5px solid ${color}` : 'none', borderRadius: 10, padding: '9px 15px',
  background: bg, color: color || '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
});

function Acciones({ onOk, onCancelar, guardando, peligro }: any) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onOk} disabled={guardando} style={btn(peligro ? '#C0554E' : '#5B4BD6')}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <button onClick={onCancelar} style={btn('#fff', '#71707C')}>Cancelar</button>
    </div>
  );
}

/* ── QUÉ ESTÁ USANDO ────────────────────────────────────────────────────────
   No un «sí lo usa» genérico: los módulos concretos con su movimiento. Es lo
   que contesta si el rescate está funcionando — y sobre todo si está usando
   AQUELLO por lo que se fue. Un cliente que se fue por soporte de inventario y
   durante la gracia solo factura, se va a ir otra vez. */
function BloqueUso({ caso, emp }: { caso: any; emp: any }) {
  if (!emp?.sacs_account) {
    return (
      <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 8 }}>Qué está usando</div>
        {/* No es un cero: es que no lo sabemos. La diferencia importa. */}
        <div style={{ fontSize: '0.83rem', color: '#71707C' }}>Esta empresa no tiene cuenta de SACS ligada, así que no hay uso que medir. Ligarla es lo primero para poder seguir el rescate.</div>
      </div>
    );
  }
  const vivos = modulosVivos(emp.uso_sacs);
  const cmp = compararUso(caso?.uso_al_abrir, emp.uso_sacs);
  const ver = veredictoRescate(caso, emp);
  const tonos: any = { bien: '#1E8A63', ojo: '#a06600', mal: '#C0554E', nd: '#74727F' };

  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8' }}>Qué está usando</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: tonos[ver.tono] }}>{ver.texto}</span>
      </div>

      {(cmp.arranco.length > 0 || cmp.dejo.length > 0) && (
        <div style={{ fontSize: '0.8rem', marginBottom: 10, lineHeight: 1.55 }}>
          {cmp.arranco.length > 0 && <div style={{ color: '#1E8A63' }}><b>Arrancó desde que se abrió el caso:</b> {cmp.arranco.join(' · ')}</div>}
          {/* Dejar de usar algo es la señal temprana de que se va otra vez. */}
          {cmp.dejo.length > 0 && <div style={{ color: '#C0554E' }}><b>Dejó de usar:</b> {cmp.dejo.join(' · ')}</div>}
        </div>
      )}

      {vivos.length === 0 ? (
        <div style={{ fontSize: '0.83rem', color: '#C0554E' }}>No ha tocado el sistema en 30 días.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {vivos.slice(0, 7).map((m: any) => (
            <div key={m.modulo} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.81rem' }}>
              <span style={{ flex: 1, minWidth: 0, color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.modulo}
                {m.familia && <span style={{ color: '#8e88a8', fontSize: '0.74rem' }}> · {m.familia}</span>}
              </span>
              <span style={{ color: '#71707C', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {m.docs_7d ? `${m.docs_7d} esta semana · ` : ''}{m.docs_30d} en 30 d
              </span>
            </div>
          ))}
          {vivos.length > 7 && <div style={{ fontSize: '0.76rem', color: '#8e88a8' }}>y {vivos.length - 7} módulos más</div>}
        </div>
      )}
    </div>
  );
}

/* ── LA PROPUESTA DE RESCATE ───────────────────────────────────────────────
   Es una cotización con forma de rescate: hereda PDF, link, conteo de vistas
   y aceptación firmada del sistema que ya existe. Lo que se ve aquí es su
   estado, que es lo que decide el siguiente movimiento: si no la ha visto, el
   problema es de entrega; si la vio y no contesta, es de oferta. */
function BloquePropuesta({ d, id, onCambio }: { d: any; id: string; onCambio: () => void }) {
  const [abriendo, setAbriendo] = useState(false);
  const [f, setF] = useState<any>({ meses: 3, rescate_mrr_regreso: '', rescate_compromisos: [], rescate_esperamos: '' });
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [compromisos, setCompromisos] = useState<string[]>([]);

  const caso = d?.caso;
  const props = d?.propuestas || [];
  const vigente = props.find((p: any) => ['draft', 'sent', 'accepted'].includes(p.estado));

  useEffect(() => {
    if (!abriendo || compromisos.length) return;
    fetch(`/api/crm/churn/propuesta?caso=${id}`).then(r => r.json())
      .then(j => setCompromisos(j.compromisos || [])).catch(() => {});
  }, [abriendo, compromisos.length, id]);

  const inp: any = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e4e9', borderRadius: 9,
    padding: '9px 11px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' };

  async function crear() {
    setGuardando(true); setErr('');
    const r = await fetch('/api/crm/churn/propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caso_id: id, ...f, rescate_mrr_regreso: Number(f.rescate_mrr_regreso) }) })
      .then(x => x.json()).catch(() => ({ error: 'No se pudo crear' }));
    setGuardando(false);
    if (r?.error) { setErr(r.error); return; }
    setAbriendo(false); onCambio();
    window.open(r.url, '_blank');
  }

  if (!caso || ['estable', 'irrecuperable'].includes(caso.etapa)) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
        Propuesta de rescate
      </div>

      {vigente ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <b style={{ fontSize: '0.88rem', color: '#241d43' }}>{vigente.numero || 'Propuesta'}</b>
            {/* El estado se lee como conducta del cliente, no como jerga:
                «no la ha visto» y «la vio y no contestó» piden guiones
                distintos, y por eso se distinguen. */}
            <span style={{ fontSize: '0.72rem', fontWeight: 800, borderRadius: 20, padding: '3px 10px',
              background: vigente.aceptado_fecha ? '#EAF8F2' : vigente.vistas ? '#E3EDFD' : '#FFF8EC',
              color: vigente.aceptado_fecha ? '#1E8A63' : vigente.vistas ? '#2C5FC4' : '#a06600' }}>
              {vigente.aceptado_fecha ? `Aceptada por ${vigente.aceptado_por || 'el cliente'}`
                : vigente.rechazado_fecha ? 'Rechazada'
                : vigente.vistas ? `La vio ${vigente.vistas} ${vigente.vistas === 1 ? 'vez' : 'veces'}`
                : 'Todavía no la ve'}
            </span>
          </div>
          <div style={{ fontSize: '0.81rem', color: '#4a4756', marginTop: 6, lineHeight: 1.5 }}>
            Sin costo hasta <b>{vigente.rescate_hasta}</b> · después {dinero(vigente.rescate_mrr_regreso)}/mes
            {(vigente.rescate_compromisos || []).length > 0 && (
              <div style={{ color: '#71707C', marginTop: 4 }}>
                Nos comprometimos a: {(vigente.rescate_compromisos || []).join(' · ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <a href={`/cotizacion/${vigente.id}`} target="_blank" rel="noreferrer" style={{ ...btn('#5B4BD6'), textDecoration: 'none', display: 'inline-block' }}>Ver el documento</a>
            {!vigente.aceptado_fecha && (<>
              <button style={btn('#fff', '#5B4BD6')} onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/cotizacion/${vigente.id}`);
              }}>Copiar el link</button>
              <button style={btn('#fff', '#71707C')} onClick={() => setAbriendo(true)}>Hacer otra</button>
            </>)}
          </div>
          {!vigente.aceptado_fecha && !vigente.vistas && (
            <div style={{ fontSize: '0.78rem', color: '#a06600', marginTop: 8 }}>
              Todavía no la abre. Si ya se la mandaste, el problema es de entrega — no de la oferta.
            </div>
          )}
        </>
      ) : !abriendo ? (
        <>
          <div style={{ fontSize: '0.82rem', color: '#71707C', lineHeight: 1.55 }}>
            Un documento con su link: período sin costo, a qué nos comprometemos y a cuánto vuelve.
            Al aceptarlo, la gracia se pacta sola con esos términos.
          </div>
          <button style={{ ...btn('#5B4BD6'), marginTop: 12 }} onClick={() => setAbriendo(true)}>Armar la propuesta</button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[1, 3, 6].map(m => (
              <button key={m} onClick={() => setF({ ...f, meses: m })}
                style={{ border: '1px solid', borderColor: f.meses === m ? '#5B4BD6' : '#e2dbf8',
                  background: f.meses === m ? '#EEECFE' : '#fff', color: f.meses === m ? '#5B4BD6' : '#5a5a63',
                  borderRadius: 20, padding: '5px 13px', fontSize: '0.76rem', fontWeight: f.meses === m ? 800 : 600,
                  cursor: 'pointer', fontFamily: 'inherit' }}>
                {m} {m === 1 ? 'mes' : 'meses'} sin costo
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 6 }}>
            A qué nos comprometemos
          </div>
          {/* Esto es lo que de verdad rescata: el 65% del MRR perdido se fue
              por servicio y cero por precio. Sin al menos uno, la propuesta es
              un descuento disfrazado y el servidor la rechaza. */}
          <div style={{ display: 'grid', gap: 5, marginBottom: 12 }}>
            {compromisos.map((c: string) => {
              const on = f.rescate_compromisos.includes(c);
              return (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => setF({ ...f,
                    rescate_compromisos: on ? f.rescate_compromisos.filter((x: string) => x !== c) : [...f.rescate_compromisos, c] })} />
                  {c}
                </label>
              );
            })}
          </div>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>A cuánto vuelve al terminar</span>
            <input type="number" style={inp} value={f.rescate_mrr_regreso} placeholder={String(Math.round(Number(caso.mrr_perdido || 0)))}
              onChange={e => setF({ ...f, rescate_mrr_regreso: e.target.value })} />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>Qué esperamos de ti (opcional)</span>
            <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={f.rescate_esperamos}
              placeholder="ej. que cargues tu catálogo la primera semana y tengamos una llamada al mes"
              onChange={e => setF({ ...f, rescate_esperamos: e.target.value })} />
          </label>

          {err && <div style={{ padding: '9px 12px', borderRadius: 9, background: '#FDF6F5', color: '#A8433C', fontSize: '0.8rem', marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={crear} disabled={guardando} style={btn('#5B4BD6')}>{guardando ? 'Creando…' : 'Crear y ver el documento'}</button>
            <button onClick={() => { setAbriendo(false); setErr(''); }} style={btn('#fff', '#71707C')}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── LO QUE PROMETIMOS ──────────────────────────────────────────────────────
   Los compromisos de la propuesta no se quedan en el PDF: se abren como
   tareas con fecha en el mismo lugar donde vive el resto de lo prometido, y
   el contador de vencidos del menú los vigila sin que nadie haga nada extra.
   Prometer y no tener quién lo persiga es cómo se perdió esta gente. */
function BloqueCompromisos({ lista }: { lista: any[] }) {
  if (!lista.length) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  const hechos = lista.filter(m => m.estado === 'entregada').length;
  const TONO: any = { entregada: ['#EAF8F2', '#1E8A63', 'listo'], en_proceso: ['#E3EDFD', '#2C5FC4', 'en curso'], idea: ['#f4f4f6', '#5D6470', 'sin empezar'] };

  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8' }}>
          Lo que prometimos
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hechos === lista.length ? '#1E8A63' : '#71707C' }}>
          {hechos} de {lista.length} cumplidos
        </span>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {lista.map((m: any) => {
          const [bg, fg, l] = TONO[m.estado] || ['#f4f4f6', '#5D6470', m.estado || '—'];
          // Vencido es rojo aunque el estado diga «en curso»: la fecha manda.
          const vencido = m.estado !== 'entregada' && m.fecha_compromiso && m.fecha_compromiso < hoy;
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.82rem' }}>
              <span style={{ flex: 1, minWidth: 0, color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.titulo}>{m.titulo}</span>
              {m.fecha_compromiso && (
                <span style={{ fontSize: '0.73rem', color: vencido ? '#C0554E' : '#8e88a8', fontWeight: vencido ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {vencido ? 'venció ' : ''}{m.fecha_compromiso}
                </span>
              )}
              <span style={{ fontSize: '0.68rem', fontWeight: 800, borderRadius: 20, padding: '2px 9px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{l}</span>
            </div>
          );
        })}
      </div>
      <a href="/admin/crm?tab=mejoras" style={{ display: 'inline-block', marginTop: 10, fontSize: '0.79rem', fontWeight: 700, color: '#5B4BD6' }}>
        Trabajarlos en Acompañamiento ›
      </a>
    </div>
  );
}
