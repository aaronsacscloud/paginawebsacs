import { useState } from 'react';

/* Diagnóstico de relaciones cliente↔contacto: encuentra los clientes que salen
 * "sin contacto" aunque tengan suscripción, y liga el contacto que la suscripción
 * ya referencia (o el que coincide por Stripe). Corre en análisis primero. */

const KEY = 'sacs-arr-2026';
const EP = '/api/crm/arr/diagnostico-relaciones?key=' + KEY;

const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' };
const btnDark: React.CSSProperties = { ...btn, background: '#1a1a1a', color: '#fff', border: 'none' };
const pill = (bg: string, color: string): React.CSSProperties => ({ background: bg, color, borderRadius: 8, padding: '10px 12px', minWidth: 100, textAlign: 'center' });

export default function RevisarRelaciones({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rep, setRep] = useState<any>(null);
  const [loading, setLoading] = useState<'' | 'load' | 'fix'>('');
  const [applied, setApplied] = useState<any>(null);

  async function analizar() {
    setLoading('load'); setApplied(null);
    try {
      const r = await fetch(EP);
      const j = await r.json();
      if (j.error) alert(j.error); else setRep(j);
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setLoading('');
  }
  async function reparar() {
    setLoading('fix');
    try {
      const r = await fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: false }) });
      const j = await r.json();
      if (j.error) alert(j.error); else { setApplied(j); onDone?.(); }
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setLoading('');
  }
  function openModal() { setOpen(true); setRep(null); setApplied(null); analizar(); }

  const s = rep?.resumen || {};
  return (
    <>
      <button style={btn} title="Encuentra clientes con suscripción pero sin contacto ligado y repara la relación" onClick={openModal}>🔗 Revisar relaciones</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflow: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 22, width: 'min(720px, 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Relaciones cliente ↔ contacto</h3>
              <button style={{ ...btn, border: 'none' }} onClick={() => setOpen(false)}>✕</button>
            </div>
            <p style={{ color: '#666', fontSize: '0.82rem', margin: '0 0 14px', lineHeight: 1.5 }}>
              Un cliente sale <b>"sin contacto"</b> cuando ningún contacto está ligado a su empresa. Muchas veces la
              relación sí existe en la <b>suscripción</b> (referencia un contacto que no quedó ligado) o coincide por
              <b> Stripe</b>. Aquí se detectan y se pueden ligar de golpe.
            </p>

            {loading === 'load' && <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Analizando…</div>}

            {rep && (
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={pill('#fdecea', '#b93333')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.clientes_sin_contacto || 0}</div><div style={{ fontSize: '0.7rem' }}>sin contacto</div></div>
                  <div style={pill('#e8f5e9', '#1b5e20')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.reparables || 0}</div><div style={{ fontSize: '0.7rem' }}>reparables</div></div>
                  <div style={pill('#fff3e0', '#a06600')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.conflictos || 0}</div><div style={{ fontSize: '0.7rem' }}>conflictos</div></div>
                  <div style={pill('#f3f4f6', '#555')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.sin_candidato || 0}</div><div style={{ fontSize: '0.7rem' }}>sin candidato</div></div>
                  <div style={pill('#eef2ff', '#3730a3')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.contactos_huerfanos_sin_empresa || 0}</div><div style={{ fontSize: '0.7rem' }}>contactos huérfanos</div></div>
                </div>

                {rep.reparables?.length > 0 && (
                  <details open style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#1b5e20', fontSize: '0.82rem' }}>{rep.reparables.length} reparables (se ligará el contacto a su empresa)</summary>
                    <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 6, fontSize: '0.75rem' }}>
                      {rep.reparables.map((r: any, i: number) => (
                        <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <b>{r.sacs_account || r.empresa}</b> → contacto <b>{r.contacto || r.email || r.contact_id}</b> <span style={{ color: '#999' }}>({r.via === 'reparable_stripe' ? 'por Stripe' : 'de su suscripción'})</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {rep.conflictos?.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#a06600', fontSize: '0.82rem' }}>{rep.conflictos.length} conflictos (el contacto ya pertenece a otra empresa — no se toca)</summary>
                    <div style={{ maxHeight: 160, overflow: 'auto', marginTop: 6, fontSize: '0.75rem' }}>
                      {rep.conflictos.map((c: any, i: number) => <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>{c.empresa} → {c.contacto} <span style={{ color: '#999' }}>(ya es de {c.pertenece_a})</span></div>)}
                    </div>
                  </details>
                )}
                {rep.sin_candidato?.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#555', fontSize: '0.82rem' }}>{rep.sin_candidato.length} sin candidato (falta capturar el contacto a mano)</summary>
                    <div style={{ maxHeight: 160, overflow: 'auto', marginTop: 6, fontSize: '0.75rem' }}>
                      {rep.sin_candidato.map((c: any, i: number) => <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>{c.sacs_account || c.empresa} · {c.subs} suscripción(es)</div>)}
                    </div>
                  </details>
                )}

                {!applied && (rep.reparables?.length > 0) && (
                  <button style={btnDark} disabled={loading !== ''} onClick={reparar}>{loading === 'fix' ? 'Ligando…' : `🔗 Reparar ${rep.reparables.length} relaciones`}</button>
                )}
                {applied && (
                  <div style={{ background: '#e8f5e9', color: '#1b5e20', borderRadius: 8, padding: 12, fontSize: '0.85rem', fontWeight: 600 }}>
                    ✅ {applied.ligados} contactos ligados a su empresa{applied.errores?.length ? ` · ${applied.errores.length} errores` : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
