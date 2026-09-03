// Minuta de descubrimiento: la que se levanta después de una reunión con un
// LEAD, no con un cliente.
//
// La diferencia no es cosmética. La minuta de un cliente contesta "qué
// acordamos y quién lo debe" y lo que sale de ahí son compromisos. La de un
// lead contesta "qué necesita y cuánto vale", y lo que sale son renglones que
// van a la cotización. Por eso el botón de cierre no es "Guardar": es "Crear
// la cotización".
//
// Tres cosas salen del mismo pegado:
//  · La minuta en siete campos.
//  · Los requerimientos cotizables, cada uno con la frase con la que se pidió.
//  · Los datos de la ficha —sucursales, giro, sistema actual— que hoy nadie
//    captura a mano y que después le hacen falta al embudo.
//
// Regla que no se rompe: lo DEDUCIDO entra apagado. Un supuesto no sube de
// categoría a requerimiento sin que lo confirme alguien que estuvo en la junta.
import { useState } from 'react';
import { MINUTA_LEAD_CAMPOS, minutaLeadVacia, minutaLlena } from '../../../lib/crm/reuniones';

const PLANES: Record<string, { nombre: string; precio: number }> = {
  vende: { nombre: 'Vende', precio: 600 },
  controla: { nombre: 'Controla', precio: 900 },
  fideliza: { nombre: 'Fideliza y Multiplica', precio: 1400 },
  automatiza: { nombre: 'Automatiza', precio: 2800 },
};
const FICHA: { k: string; label: string }[] = [
  { k: 'sucursales', label: 'Sucursales' }, { k: 'giro', label: 'Giro' },
  { k: 'sistema_actual', label: 'Sistema actual' }, { k: 'urgencia', label: 'Urgencia' },
  { k: 'presupuesto', label: 'Presupuesto' }, { k: 'usuarios', label: 'Usuarios' },
];
const money = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

const S = {
  velo: { position: 'fixed', inset: 0, background: 'rgba(23,21,31,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 70 } as const,
  caja: { background: '#fff', borderRadius: 16, width: 'min(940px,100%)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 70px rgba(23,21,31,.24)' } as const,
  cab: { padding: '18px 22px', borderBottom: '1px solid #f4f3f7', position: 'sticky' as const, top: 0, background: '#fff', zIndex: 2, display: 'flex', gap: 12, alignItems: 'flex-start' },
  h3: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.1em', color: '#a5a2af', display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 4px' },
  der: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, letterSpacing: 0, textTransform: 'none' as const, color: '#a5a2af' },
  hint: { fontSize: '0.73rem', color: '#8a8590', margin: '0 0 12px', lineHeight: 1.55 },
  ta: { width: '100%', border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 11, padding: '11px 13px', fontSize: '0.85rem', lineHeight: 1.55, fontFamily: 'inherit', color: '#3F3A52', resize: 'vertical' as const },
  btn: { border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', background: '#9B8CFA', color: '#fff', fontFamily: 'inherit' } as const,
  btnSec: { border: '1.5px solid #cdc4fb', borderRadius: 9, padding: '11px 20px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', background: '#fff', color: '#5B4BD6', fontFamily: 'inherit' } as const,
  chip: (bg: string, fg: string) => ({ fontSize: '0.6rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap' as const }),
};

export default function MinutaLead({ reunion, lead, soloLectura, onClose, onGuardado }: any) {
  const guardada = reunion.minuta || null;
  const [m, setM] = useState<Record<string, string>>(() => ({ ...minutaLeadVacia(), ...(guardada || {}) }));
  const [reqs, setReqs] = useState<any[]>(() => Array.isArray(guardada?.requerimientos) ? guardada.requerimientos : []);
  const [ficha, setFicha] = useState<Record<string, string>>(() => guardada?.ficha || {});
  const [planSug, setPlanSug] = useState<string | null>(guardada?.plan_sugerido || null);
  const [crudo, setCrudo] = useState<string>(guardada?.raw || '');
  // QUÉ SIGUE (decisión del dueño 2026-09-03): la minuta le dice al sistema y al agente qué pasa después.
  const [decision, setDecision] = useState<{ tipo: string; fecha: string; motivo: string }>(() => ({ tipo: guardada?.decision?.tipo || '', fecha: guardada?.decision?.fecha || '', motivo: guardada?.decision?.motivo || '' }));
  const [pegando, setPegando] = useState(!soloLectura && !minutaLlena(guardada));
  const [ia, setIa] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // El PRIMER número, no todos los dígitos pegados: "3 tiendas + 1 bodega"
  // se volvía 31 sucursales y el total salía en $43,400 al mes.
  const sucursales = Math.max(1, parseInt(String(ficha.sucursales || '').match(/\d+/)?.[0] || '1', 10));
  const activos = reqs.filter(r => r.incluir);
  // El total mensual solo cuenta el plan: los renglones incluidos no se cobran
  // aparte y los servicios sueltos son de una sola vez.
  const planCobrado = planSug && PLANES[planSug] ? PLANES[planSug].precio * sucursales : 0;
  const unicos = activos.filter(r => !r.incluido && r.categoria !== 'plan').reduce((a, r) => a + Number(r.valor || 0), 0);

  async function ordenar() {
    if (crudo.trim().length < 40) { setError('Pega la conversación completa: con tan poco texto no hay nada que acomodar.'); return; }
    setIa(true); setError('');
    try {
      const r = await fetch('/api/scheduling/reuniones/estructurar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: crudo, tipo: 'lead' }),
      }).then(x => x.json());
      if (r.error) { setError(r.error); return; }
      setM(v => ({ ...v, ...r.minuta }));
      setReqs(r.requerimientos || []);
      setFicha(r.ficha || {});
      setPlanSug(r.plan_sugerido || null);
      if (r.decision?.tipo) setDecision({ tipo: r.decision.tipo, fecha: r.decision.fecha || '', motivo: r.decision.motivo || '' });
      setPegando(false);
    } catch { setError('No se pudo acomodar la conversación.'); }
    finally { setIa(false); }
  }

  async function guardar(irACotizar: boolean) {
    if (!soloLectura && !decision.tipo) { setError('Di qué sigue: cotizar, segunda reunión, retomar después o sin interés.'); return; }
    if (!soloLectura && ['segunda_reunion', 'retomar'].includes(decision.tipo) && !decision.fecha) { setError(decision.tipo === 'retomar' ? '¿Cuándo retomamos? Pon la fecha: el agente la va a respetar.' : '¿Para cuándo es la siguiente reunión? Pon la fecha.'); return; }
    // La pestaña se abre AQUÍ, mientras todavía hay gesto del usuario. Si se
    // abre después del await, el navegador la bloquea sin avisar y parece que
    // el botón no hizo nada.
    const pestana = irACotizar ? window.open('', '_blank') : null;
    setGuardando(true); setError('');
    try {
      const minuta = { ...m, tipo: 'lead', raw: crudo || undefined, requerimientos: reqs, ficha, plan_sugerido: planSug, decision: { ...decision, at: new Date().toISOString() } };
      const r = await fetch('/api/scheduling/reuniones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reunion.id, minuta }),
      }).then(x => x.json());
      if (r.error) { pestana?.close(); setError(r.error); setGuardando(false); return; }
      onGuardado?.(minuta);
      if (irACotizar) {
        // El cotizador se abre con los conceptos ya puestos. No se crea la
        // cotización sola: el precio y el descuento los pone una persona.
        const p = new URLSearchParams({ nueva: '1', reunion: reunion.id });
        if (lead?.companies?.nombre || lead?.empresa) p.set('empresa', lead.companies?.nombre || lead.empresa);
        if (lead?.company_id) p.set('company_id', lead.company_id);
        const url = '/admin/crm?tab=cotizaciones&' + p.toString();
        // Si el navegador bloqueó la pestaña, se navega en la misma: peor
        // llevar al cotizador que dejar al usuario sin saber qué pasó.
        if (pestana) pestana.location.href = url; else window.location.href = url;
      }
      onClose();
    } catch (e: any) {
      pestana?.close();
      setError('No se pudo guardar: ' + String(e?.message || e));
      setGuardando(false);
    }
  }

  return (
    <div style={S.velo} onClick={onClose} role="dialog" aria-modal="true">
      <div style={S.caja} onClick={(e: any) => e.stopPropagation()}>
        <div style={S.cab}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.02em', color: '#1a1a1a' }}>Minuta de descubrimiento</div>
            <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 3 }}>
              {lead?.nombre || lead?.invitee_nombre || 'Lead'}{lead?.companies?.nombre ? ` · ${lead.companies.nombre}` : ''}
              {' · '}{reunion.event_types?.nombre || 'Reunión'} del {String(reunion.fecha || '').slice(8, 10)}/{String(reunion.fecha || '').slice(5, 7)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            style={{ marginLeft: 'auto', border: '1px solid #ececf1', background: '#fff', borderRadius: 9, width: 32, height: 32, fontSize: '1rem', color: '#8a8590', cursor: 'pointer', fontFamily: 'inherit', flex: '0 0 auto' }}>×</button>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {/* ── pegar ── */}
          {!soloLectura && (pegando ? (
            <div style={{ border: '1.5px dashed #cdc4fb', background: 'linear-gradient(150deg,#EEECFE,#fff)', borderRadius: 14, padding: '18px 20px', marginBottom: 18 }}>
              <div style={{ ...S.h3, color: '#5B4BD6' }}>Pega aquí lo que se habló<span style={S.der}>WhatsApp, transcripción o tus notas</span></div>
              <p style={S.hint}>No lo ordenes: pégalo tal cual. De ahí salen la minuta, los requerimientos para cotizar y los datos de la ficha.</p>
              <textarea rows={5} value={crudo} onChange={e => setCrudo(e.target.value)} style={{ ...S.ta, background: '#fff' }}
                placeholder="Pega la conversación, la transcripción o tus notas…" />
              <div style={{ display: 'flex', gap: 9, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button style={{ ...S.btn, opacity: ia ? .6 : 1 }} disabled={ia} onClick={ordenar}>{ia ? 'Ordenando…' : 'Ordenar con IA'}</button>
                <button style={S.btnSec} onClick={() => setPegando(false)}>Escribirla a mano</button>
                <span style={{ fontSize: '0.72rem', color: '#8a8590' }}>Nada se guarda hasta que tú lo revises.</span>
              </div>
            </div>
          ) : (
            <button style={{ ...S.btnSec, marginBottom: 16 }} onClick={() => setPegando(true)}>
              {crudo ? 'Volver a pegar la conversación' : 'Pegar la conversación'}
            </button>
          ))}

          {/* ── los siete campos ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {MINUTA_LEAD_CAMPOS.map(c => (
              <div key={c.k}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{c.label}</label>
                <div style={{ fontSize: '0.69rem', color: '#a5a2af', marginBottom: 7, lineHeight: 1.45 }}>{c.hint}</div>
                <textarea rows={3} value={m[c.k] || ''} readOnly={soloLectura}
                  onChange={e => setM(v => ({ ...v, [c.k]: e.target.value }))} style={S.ta} />
              </div>
            ))}
          </div>

          {/* ── datos de la ficha ── */}
          {Object.values(ficha).some(Boolean) && (
            <div style={{ marginTop: 22 }}>
              <div style={S.h3}>Datos que salieron solos<span style={S.der}>se guardan con la minuta</span></div>
              <p style={S.hint}>Estos campos casi nunca se llenan a mano. Salieron de la conversación: corrige lo que haga falta.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                {FICHA.filter(f => ficha[f.k]).map(f => (
                  <div key={f.k} style={{ border: '1px solid #ececf1', borderRadius: 11, padding: '10px 12px', background: '#fdfcff' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em' }}>{f.label}</div>
                    <input value={ficha[f.k]} readOnly={soloLectura} onChange={e => setFicha(v => ({ ...v, [f.k]: e.target.value }))}
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.9rem', fontWeight: 800, color: '#1a1a1a', marginTop: 4, padding: 0, fontFamily: 'inherit' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── requerimientos ── */}
          {reqs.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={S.h3}>Lo que necesita<span style={S.der}>{activos.length} de {reqs.length} para cotizar</span></div>
              <p style={S.hint}>Cada punto trae la frase con la que lo pidió y a qué se traduce en SACS. Desmarca lo que no vaya.</p>
              {reqs.map((r, i) => (
                <div key={i} style={{ border: '1px solid #ececf1', borderRadius: 13, padding: '13px 15px', marginBottom: 9, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: r.incluir ? 1 : .48 }}>
                  <button aria-label={r.incluir ? 'Quitar de la cotización' : 'Incluir en la cotización'} disabled={soloLectura}
                    onClick={() => setReqs(v => v.map((x, k) => k === i ? { ...x, incluir: !x.incluir } : x))}
                    style={{ width: 19, height: 19, borderRadius: 6, border: '2px solid ' + (r.incluir ? '#9B8CFA' : '#d8d4e4'), background: r.incluir ? '#9B8CFA' : '#fff', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.62rem', fontWeight: 900, flex: '0 0 auto', marginTop: 2, cursor: soloLectura ? 'default' : 'pointer' }}>
                    {r.incluir ? '✓' : ''}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.35 }}>{r.titulo}</div>
                    {r.cita
                      ? <div style={{ fontSize: '0.76rem', color: '#8a8590', fontStyle: 'italic', marginTop: 5, lineHeight: 1.5, borderLeft: '2px solid #ececf1', paddingLeft: 9 }}>“{r.cita}”</div>
                      : <div style={{ fontSize: '0.76rem', color: '#a5a2af', marginTop: 5, lineHeight: 1.5 }}>No lo pidió: se dedujo de la conversación.</div>}
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                      {r.plan && <span style={S.chip('#EEECFE', '#5B4BD6')}>Licencia {PLANES[r.plan]?.nombre || r.plan}</span>}
                      {r.incluido && <span style={S.chip('#EAF8F2', '#1E8A63')}>Ya viene incluido</span>}
                      {r.deducido && <span style={S.chip('#FBEAF2', '#D9538E')}>Deducido, no dicho</span>}
                      {!r.plan && !r.incluido && <span style={S.chip('#f4f3f7', '#8a8590')}>{r.categoria}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <b style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1a1a1a' }}>{r.incluido ? 'Incluido' : r.valor ? money(r.valor) : '—'}</b>
                    <div style={{ fontSize: '0.65rem', color: '#a5a2af', marginTop: 2 }}>{r.incluido ? 'no suma al total' : r.valor ? 'precio de lista' : 'por definir'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ marginTop: 14, color: '#C0554E', fontSize: '0.82rem' }}>{error}</div>}
        </div>

        <div style={{ borderTop: '1px solid #f4f3f7', padding: '15px 22px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fcfcfe', position: 'sticky', bottom: 0 }}>
          {!soloLectura && (
            <div style={{ width: '100%', marginBottom: 12 }}>
              <div style={S.h3}>Qué sigue <span style={S.der}>lo lee el sistema y el agente</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['cotizar', 'Cotizar'], ['segunda_reunion', 'Segunda reunión'], ['retomar', 'Retomar después'], ['sin_interes', 'Sin interés']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setDecision(d => ({ ...d, tipo: k }))} style={{ border: `1px solid ${decision.tipo === k ? '#5B4BD6' : '#e8e5f0'}`, background: decision.tipo === k ? '#EEECFE' : '#fff', color: decision.tipo === k ? '#4c1d95' : '#4a4658', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                ))}
                {['segunda_reunion', 'retomar'].includes(decision.tipo) && <input type="date" value={decision.fecha} onChange={e => setDecision(d => ({ ...d, fecha: e.target.value }))} style={{ border: '1px solid #e8e5f0', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12.5 }} />}
                {['retomar', 'sin_interes', 'segunda_reunion'].includes(decision.tipo) && <input value={decision.motivo} onChange={e => setDecision(d => ({ ...d, motivo: e.target.value }))} placeholder={decision.tipo === 'sin_interes' ? 'Por qué no (una línea)' : decision.tipo === 'retomar' ? 'Qué dijo: «después de temporada», «cuando abra la 2ª tienda»…' : 'Qué falta ver en la siguiente'} style={{ flex: 1, minWidth: 220, border: '1px solid #e8e5f0', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12.5 }} />}
              </div>
              <div style={{ fontSize: 11.5, color: '#8a8590', marginTop: 6 }}>{decision.tipo === 'cotizar' ? 'El agente se retira; en 48 h se espera la cotización.' : decision.tipo === 'segunda_reunion' ? 'No se exige cotización todavía; queda la tarea de agendar la siguiente.' : decision.tipo === 'retomar' ? 'El agente se pausa y retoma solo en esa fecha con lo que dijo.' : decision.tipo === 'sin_interes' ? 'El lead pasa a descalificado con este motivo y el agente no vuelve a escribirle.' : 'Elige una para poder guardar.'}</div>
            </div>
          )}
          {/* Descargar: la misma página que usan las minutas de cliente, con la
              marca y el folio. Solo aparece cuando ya hay algo guardado — una
              minuta a medias descargada es peor que no tenerla. */}
          {minutaLlena(guardada) && (
            <button style={S.btnSec} onClick={() => window.open(`/minuta/${reunion.id}`, '_blank', 'noopener')}>
              Descargar
            </button>
          )}
          {soloLectura ? <button style={S.btnSec} onClick={onClose}>Cerrar</button> : decision.tipo === 'cotizar' || !decision.tipo ? (<>
            <button style={{ ...S.btn, opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={() => guardar(true)}>
              {guardando ? 'Guardando…' : activos.length ? `Crear cotización con ${activos.length} concepto${activos.length === 1 ? '' : 's'}` : 'Guardar y cotizar'}
            </button>
            <button style={S.btnSec} disabled={guardando} onClick={() => guardar(false)}>Guardar minuta y cotizar después</button>
          </>) : (
            <button style={{ ...S.btn, opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={() => guardar(false)}>
              {guardando ? 'Guardando…' : decision.tipo === 'segunda_reunion' ? 'Guardar: queda pendiente la siguiente reunión' : decision.tipo === 'retomar' ? `Guardar: el agente retoma el ${decision.fecha}` : 'Guardar y cerrar el lead sin interés'}
            </button>
          )}
          {(planCobrado > 0 || unicos > 0) && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <b style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a' }}>
                {planCobrado > 0 ? `${money(planCobrado)} / mes` : money(unicos)}
              </b>
              <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>
                {planCobrado > 0 && `${sucursales} sucursal${sucursales === 1 ? '' : 'es'} · ${PLANES[planSug!]?.nombre}`}
                {planCobrado > 0 && unicos > 0 && ' · '}
                {unicos > 0 && `${money(unicos)} de una vez`}
                {' · antes de descuentos'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
