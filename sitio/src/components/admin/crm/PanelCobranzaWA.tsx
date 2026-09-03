// Mandar el recordatorio de pago por WhatsApp a todos los que deben.
//
// El orden de la pantalla es el orden de la duda de quien va a apretar:
//   1 · qué es esto y a cuántos les va a llegar   (el contexto, arriba)
//   2 · el mensaje EXACTO, como lo va a ver el cliente
//   3 · la lista con los montos, y quién queda fuera y por qué
//   4 · un botón
// Enseñar el botón antes que el mensaje es pedirle a alguien que mande algo
// que no ha leído; y a 13 clientes a la vez, eso no se puede deshacer.
//
// La vista previa la resuelve el SERVIDOR contra la plantilla viva de Meta. Un
// texto de ejemplo escrito aquí se desincronizaría el día que alguien edite la
// plantilla, y entonces la pantalla estaría mintiendo sobre lo que sale.
import { useEffect, useState } from 'react';

const money = (n: number) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

export default function PanelCobranzaWA({ tipo, onCerrar, onListo }: {
  tipo: 'vencidos' | 'proximos';
  onCerrar: () => void;
  onListo?: (r: any) => void;
}) {
  const [d, setD] = useState<any>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/crm/cobranza/whatsapp?tipo=${tipo}`).then(r => r.json())
      .then(j => {
        if (j.error) { setError(j.error); return; }
        setD(j);
        // Todos marcados de entrada: el caso normal es mandarles a todos, y
        // hacer 13 clics para eso es la razón por la que nadie lo hace.
        setSel(new Set((j.destinatarios || []).map((x: any) => x.subscription_id)));
      })
      .catch(() => setError('No se pudo cargar. Vuelve a intentar.'));
  }, [tipo]);

  const dest: any[] = d?.destinatarios || [];
  const marcados = dest.filter(x => sel.has(x.subscription_id));
  const montoSel = marcados.reduce((s, x) => s + x.monto, 0);

  async function enviar() {
    setEnviando(true); setError('');
    const j = await fetch('/api/crm/cobranza/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, ids: marcados.map(x => x.subscription_id) }),
    }).then(r => r.json()).catch(() => ({ error: 'Error de red.' }));
    setEnviando(false);
    if (j.error) { setError(j.error); return; }
    setRes(j); onListo?.(j);
  }

  const overlay = { position: 'fixed' as const, inset: 0, background: 'rgba(20,16,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 };
  const caja = { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && !enviando) onCerrar(); }}>
      <div style={caja}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 17px', borderBottom: '1px solid #f0eef6' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>
            Recordatorio de pago por WhatsApp
          </h3>
          <button onClick={onCerrar} disabled={enviando} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ padding: '14px 17px', overflowY: 'auto' }}>
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '10px 12px', fontSize: '0.8rem', color: '#C0554E', marginBottom: 12 }}>{error}</div>}

          {/* ── El resultado, cuando ya se mandó ── */}
          {res ? (
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 4 }}>
                {res.enviados} de {res.resultados.length} enviados · {money(res.monto)} en juego
              </div>
              <div style={{ fontSize: '0.76rem', color: '#8e88a8', marginBottom: 12 }}>
                Cada mensaje quedó en el inbox de su cliente y anotado en su ficha.
              </div>
              {res.resultados.filter((r: any) => !r.ok).length > 0 && (
                <div style={{ border: '1px solid #f0dfae', background: '#fff8e8', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9a6a10', marginBottom: 6 }}>
                    No salieron {res.fallidos} — y por qué:
                  </div>
                  {res.resultados.filter((r: any) => !r.ok).map((r: any) => (
                    <div key={r.subscription_id} style={{ fontSize: '0.74rem', color: '#7a5c14' }}>
                      · <b>{r.empresa}</b> — {r.motivo}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={onCerrar} style={{ width: '100%', marginTop: 14, border: 'none', background: '#f2f2f2', color: '#555', borderRadius: 9, padding: '11px', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
            </div>
          ) : !d ? (
            <div style={{ color: '#8e88a8', fontSize: '0.84rem', padding: '20px 0', textAlign: 'center' }}>Preparando…</div>
          ) : (<>

            {/* ── 1 · El contexto ── */}
            <div style={{ fontSize: '0.82rem', color: '#4a4a52', lineHeight: 1.5, marginBottom: 12 }}>
              Le vas a escribir a <b>{marcados.length} {marcados.length === 1 ? 'cliente' : 'clientes'}</b> con
              pagos {tipo === 'vencidos' ? 'vencidos' : 'de esta semana'} por <b>{money(montoSel)}</b>.
              Sale de tu número de siempre y la respuesta llega al inbox.
            </div>

            {/* ── 2 · La plantilla y cómo se verá ── */}
            {d.plantilla ? (
              <div style={{ border: '1px solid #e8e5f0', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#faf9ff', borderBottom: '1px solid #f0eef6' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5B4BD6' }}>PLANTILLA · {d.plantilla.nombre}</span>
                  {/* La categoría no es un adorno: una MARKETING se puede
                      bloquear en silencio y el cobro nunca llega. */}
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: .3, borderRadius: 5, padding: '2px 6px', color: d.plantilla.categoria === 'UTILITY' ? '#1E8A63' : '#9a6a10', background: d.plantilla.categoria === 'UTILITY' ? '#eaf8f2' : '#fff8e8' }}>
                    {d.plantilla.categoria}
                  </span>
                </div>
                {/* La burbuja, como la ve el cliente: el primero de la lista, con
                    su nombre y su fecha ya puestos. */}
                <div style={{ padding: 14, background: '#ECE5DD' }}>
                  <div style={{ background: '#fff', borderRadius: '10px 10px 10px 2px', padding: '9px 11px', fontSize: '0.8rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', maxWidth: 380, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
                    {marcados[0]?.preview || dest[0]?.preview || '(sin vista previa)'}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#5a6b62', marginTop: 6 }}>
                    Así lo verá {marcados[0]?.empresa || dest[0]?.empresa || 'el primero'}. A cada quien le llega con su nombre y su fecha.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '10px 12px', fontSize: '0.8rem', color: '#C0554E', marginBottom: 14 }}>
                {d.plantilla_falta}
              </div>
            )}

            {/* ── 3 · Los montos ── */}
            <div style={{ border: '1px solid #e8e5f0', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0eef6', fontSize: '0.74rem', color: '#8e88a8' }}>
                <span style={{ flex: 1 }}>A quién le llega</span>
                <button onClick={() => setSel(sel.size === dest.length ? new Set() : new Set(dest.map(x => x.subscription_id)))}
                  style={{ border: 'none', background: 'none', color: '#5B4BD6', fontWeight: 700, cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit' }}>
                  {sel.size === dest.length ? 'ninguno' : 'todos'}
                </button>
              </div>
              {dest.map((x: any) => (
                <label key={x.subscription_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderTop: '1px solid #f7f5fb', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel.has(x.subscription_id)} onChange={() => {
                    const n = new Set(sel);
                    n.has(x.subscription_id) ? n.delete(x.subscription_id) : n.add(x.subscription_id);
                    setSel(n);
                  }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{x.empresa}</span>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: '#a7abb3' }}>
                      {x.plan} · {x.dias > 0 ? `${x.dias} días de atraso` : `vence ${x.fecha}`} · {x.telefono}
                    </span>
                  </span>
                  <b style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{money(x.monto)}</b>
                </label>
              ))}
              {!dest.length && <div style={{ padding: 16, textAlign: 'center', color: '#a7abb3', fontSize: '0.8rem' }}>No hay a quién escribirle ahora.</div>}
            </div>

            {/* Quién NO recibe y por qué. Un envío que dice «13» y sale a 9 sin
                explicar la diferencia es un envío en el que se deja de confiar. */}
            {(d.omitidos || []).length > 0 && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: '0.76rem', color: '#8e88a8', cursor: 'pointer' }}>
                  {d.omitidos.length} {d.omitidos.length === 1 ? 'queda' : 'quedan'} fuera
                </summary>
                <div style={{ marginTop: 6 }}>
                  {d.omitidos.map((o: any) => (
                    <div key={o.subscription_id} style={{ fontSize: '0.73rem', color: '#8e88a8', padding: '3px 0' }}>
                      · <b style={{ color: '#4a4a52' }}>{o.empresa}</b> ({money(o.monto)}) — {o.motivo}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>)}
        </div>

        {/* ── 4 · El botón ── */}
        {!res && d && (
          <div style={{ borderTop: '1px solid #f0eef6', padding: '12px 17px' }}>
            <button onClick={enviar} disabled={enviando || !marcados.length || !d.plantilla}
              style={{ width: '100%', border: 'none', borderRadius: 10, padding: '12px', fontSize: '0.86rem', fontWeight: 800, fontFamily: 'inherit',
                background: (!marcados.length || !d.plantilla) ? '#e8e5f0' : '#1E8A63',
                color: (!marcados.length || !d.plantilla) ? '#a7abb3' : '#fff',
                cursor: (enviando || !marcados.length || !d.plantilla) ? 'default' : 'pointer', opacity: enviando ? 0.6 : 1 }}>
              {enviando ? 'Enviando…'
                : !marcados.length ? 'No hay nadie marcado'
                : `Enviar a ${marcados.length} · ${money(montoSel)}`}
            </button>
            <div style={{ fontSize: '0.68rem', color: '#a7abb3', textAlign: 'center', marginTop: 7 }}>
              No se le escribe a quien ya recibió este mensaje hace menos de {d.dias_silencio} días.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
