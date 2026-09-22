// Reporte para el LEAD: el documento que sale de la minuta de una junta.
//
// Hermano de ReporteEntregas, con la misma maquinaria (se genera, se guarda una
// foto de los hechos y tiene liga), pero no pide periodo ni módulos: pide una
// JUNTA, y lo único que se decide aquí es la oferta —cuánto descuento y hasta
// cuándo—. Todo lo demás ya lo dijo el lead y está en la minuta.
import { useState } from 'react';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fLarga = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
  : '';

/* Verde → rosa: la piel del documento. El botón la adelanta para que se sepa
   qué documento sale antes de abrirlo. */
const GRAD = 'linear-gradient(100deg,#1E8A63,#4FBF95 40%,#D9538E)';
const S = {
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', background: GRAD, color: '#fff', fontFamily: 'inherit' } as const,
  btnG: { padding: '7px 13px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
  input: { padding: '7px 10px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.8rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' } as const,
  fl: { fontSize: '0.62rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 } as const,
  cifra: { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#9c99a6' } as const,
};

export default function ReporteLead({ reunion, lead, onCerrar }: any) {
  /* 35 o 40, según el caso, y SIN valor puesto: el dueño pidió que se lo
     pregunte antes de generarlo (22-sep-2026). Con un default ya marcado se
     iba el 35 aunque ese lead mereciera el 40. */
  const [pct, setPct] = useState<number | null>(null);
  const [vigencia, setVigencia] = useState(iso(new Date(Date.now() + 14 * 86400000)));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [rep, setRep] = useState<any>(null);

  const liga = rep ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reporte/${rep.id}` : '';
  const h = rep?.hechos;
  const nombre = [lead?.nombre, lead?.apellido].filter(Boolean).join(' ') || reunion?.invitee_nombre || 'el lead';
  // Al WhatsApp se le manda la liga tal cual: es por donde más se contesta.
  const wa = ((d: string) => d.length === 10 ? '52' + d : d)(String(lead?.whatsapp || lead?.telefono || '').replace(/\D/g, ''));

  async function generar() {
    if (pct == null) return;
    setBusy('generando'); setError(''); setAviso(''); setRep(null);
    const r = await fetch('/api/crm/reportes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'lead', booking_id: reunion.id, descuento: pct, vigencia }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo generar.'); return; }
    setRep(r);
  }

  async function copiarLiga() {
    try { await navigator.clipboard.writeText(liga); setAviso('Liga copiada.'); }
    catch { setAviso(liga); }
  }

  async function enviar() {
    setBusy('enviando'); setAviso('');
    const r = await fetch('/api/crm/reportes/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rep.id }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setAviso(r?.error || 'No se pudo enviar.'); return; }
    setAviso(`Enviado a ${r.para}.`);
    setRep((p: any) => ({ ...p, enviado_a: r.para }));
  }

  const textoWa = `Hola ${String(nombre).split(' ')[0]}, te dejo el resumen de nuestra sesión con lo que platicamos y cómo lo resolvemos en Sacs: ${liga}`;

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Reporte para el lead" style={{
        background: '#fff', borderRadius: 14, width: 'min(560px, 100%)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 22px 54px rgba(20,15,50,.25)', overflow: 'hidden',
      }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#4FBF95,#EFA6CA 55%,#D9538E)' }} />
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #f1eff7' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.015em' }}>Reporte para el lead</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>
            {nombre} · sale de la minuta de la sesión del {fLarga(reunion?.fecha)}.
          </div>
        </div>

        {/* La oferta. Es lo único que no está en la minuta. */}
        <div style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', borderBottom: '1px solid #f6f5fa' }}>
          <div>
            <div style={S.fl}>Descuento</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[35, 40].map(n => {
                const on = pct === n;
                return (
                  <button key={n} disabled={!!rep} onClick={() => setPct(n)} aria-pressed={on}
                    style={{ padding: '7px 16px', borderRadius: 9, fontSize: '0.9rem', fontWeight: 800, fontFamily: 'inherit', cursor: rep ? 'default' : 'pointer',
                      border: on ? 'none' : '1.5px solid #e4dffb', background: on ? GRAD : '#fdfcff', color: on ? '#fff' : '#6b6776' }}>
                    {n}%
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={S.fl}>Vale hasta</div>
            <input type="date" value={vigencia} min={iso(new Date())} disabled={!!rep}
              onChange={e => setVigencia(e.target.value)} style={S.input} />
          </div>
          {!rep && (
            <button style={{ ...S.btn, marginLeft: 'auto', opacity: busy || pct == null ? .5 : 1, cursor: pct == null ? 'not-allowed' : 'pointer' }}
              onClick={generar} disabled={!!busy || pct == null} title={pct == null ? 'Elige primero el descuento' : undefined}>
              {busy === 'generando' ? 'Generando…' : 'Generar'}
            </button>
          )}
        </div>

        <div style={{ padding: '4px 18px 16px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ marginTop: 12, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.77rem', color: '#C0554E', lineHeight: 1.5 }}>{error}</div>
          )}
          {!rep && !busy && !error && (
            <div style={{ padding: '18px 0 6px', color: '#9c99a6', fontSize: '0.8rem', lineHeight: 1.65 }}>
              El documento repite lo que te dijo —cómo opera hoy, qué le duele, qué le interesó— y al lado
              cómo lo resuelve Sacs. {pct == null
                ? <b style={{ color: '#D9538E' }}>Elige primero el descuento: 35 % o 40 %.</b>
                : <>El <b>{pct}%</b> en la licencia anual va al cierre, con su fecha límite.</>}
            </div>
          )}
          {busy === 'generando' && <div style={{ padding: '22px 0', color: '#9c99a6', fontSize: '0.85rem' }}>Leyendo la minuta…</div>}

          {rep && h && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '14px 0 4px' }}>
              <div><div style={S.cifra}>Lo que pidió</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.total_pedidos}</div></div>
              <div><div style={S.cifra}>Ya existe</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.ya_existen}</div></div>
              <div><div style={S.cifra}>Por desarrollar</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: h.por_desarrollar ? '#D9538E' : '#a5a2af' }}>{h.por_desarrollar}</div></div>
              <div><div style={S.cifra}>Oferta</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#D9538E' }}>{h.descuento?.pct}%
                  <span style={{ fontSize: '0.7rem', color: '#9c99a6', fontWeight: 600 }}> al {fLarga(h.descuento?.vigencia)}</span></div></div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={S.cifra}>Folio</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E8A63', fontFamily: 'ui-monospace, monospace' }}>{rep.folio}</div></div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px 15px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {rep && (<>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: '#1E8A63', background: '#EAF8F2', borderRadius: 7, padding: '5px 9px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liga}</span>
            <button style={S.btnG} onClick={copiarLiga}>Copiar liga</button>
            <a style={{ ...S.btnG, textDecoration: 'none', display: 'inline-block' }} href={liga} target="_blank" rel="noreferrer">Verlo como el lead</a>
            {wa.length >= 10 && (
              <a style={{ ...S.btnG, textDecoration: 'none', display: 'inline-block' }} target="_blank" rel="noreferrer"
                href={`https://wa.me/${wa}?text=${encodeURIComponent(textoWa)}`}>WhatsApp</a>
            )}
            <button style={S.btn} onClick={enviar} disabled={!!busy}>
              {busy === 'enviando' ? 'Enviando…' : rep.enviado_a ? 'Volver a enviar' : 'Enviar por correo'}
            </button>
          </>)}
          {aviso && <span style={{ fontSize: '0.73rem', color: '#1E8A63', fontWeight: 600 }}>{aviso}</span>}
          <button style={{ ...S.btnG, marginLeft: 'auto' }} onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
