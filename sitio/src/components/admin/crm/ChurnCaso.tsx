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
import { ETAPAS, ETAPA, MOTIVOS, MOTIVO, diasDeGracia, saludDeGracia, type Etapa } from '../../../lib/crm/churn.reglas';
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
      <div role="dialog" aria-modal="true" aria-label="Caso de churn" style={{
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
                    Para marcar recuperado hace falta la suscripción nueva que lo respalda —
                    un recuperado que no paga mentiría en la ARR. Créala en Suscripciones y pega su id aquí.
                  </div>
                  <Campo l="Id de la suscripción nueva">
                    <input style={inp} value={form.subscription_nueva_id || ''} placeholder="uuid de la suscripción"
                      onChange={e => setForm({ ...form, subscription_nueva_id: e.target.value })} />
                  </Campo>
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
