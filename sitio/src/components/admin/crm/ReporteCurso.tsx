// Reporte de TRABAJO EN CURSO: el documento que contesta «¿qué me están haciendo?».
//
// Hermano del de entregas y con su misma mecánica: se elige el periodo, se
// genera, queda con folio y liga, y se manda por correo. Lo que cambia es de
// dónde sale —las órdenes VIVAS del taller, no las entregadas— y qué enseña:
// la especificación de qué va a cambiar dentro del sistema, que es lo que el
// cliente pidió ver entre una entrega y la siguiente.
//
// Es un archivo aparte y no un `tipo` del otro a propósito: los dos documentos
// contestan preguntas distintas y sus cifras no se parecen —aquí no hay videos
// ni entregas, hay etapas y fechas comprometidas—. Meterlos en el mismo modal
// habría significado media pantalla de condicionales.
import { useState } from 'react';

const fmtDate = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '')
  : '';
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* Cómo se le dice al cliente cada tipo. `pendiente` es como el CRM llama por
   dentro a los bugs; en un documento de entregas ese renglón se leería como
   que NO está hecho. Misma traducción que el documento público. */
const TIPO_L: Record<string, string> = {
  personalizacion: 'personalización', ajuste: 'ajuste', pendiente: 'corrección',
  capacitacion: 'capacitación', plugin: 'plugin', modulo: 'módulo', otro: 'mejora',
};

const S = {
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', background: '#1E8A63', color: '#fff', fontFamily: 'inherit' } as const,
  btnG: { padding: '7px 13px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
  input: { padding: '7px 10px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.77rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' } as const,
  chip: { fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const },
};

export default function ReporteCurso({ companyId, cliente, onCerrar }: any) {
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [rep, setRep] = useState<any>(null);

  const liga = rep ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reporte/${rep.id}` : '';
  const h = rep?.hechos;
  const preset = (d: Date, hs: Date) => { setDesde(iso(d)); setHasta(iso(hs)); };

  async function generar() {
    setBusy('generando'); setError(''); setAviso(''); setRep(null);
    const r = await fetch('/api/crm/reportes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, desde, hasta, tipo: 'curso' }),
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

  const sinEspec = h ? (h.trabajos || []).filter((t: any) => !t.cambio).length : 0;

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Reporte de trabajo en curso" style={{
        background: '#fff', borderRadius: 14, width: 'min(680px, 100%)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 22px 54px rgba(20,15,50,.25)',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f1eff7' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.015em' }}>Reporte de trabajo en curso</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>
            {cliente} · lo que se le está construyendo, con la especificación de qué va a cambiar.
          </div>
        </div>

        <div style={{ padding: '12px 18px', display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f6f5fa' }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.input} />
          <span style={{ color: '#a5a2af', fontSize: '0.75rem' }}>al</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.input} />
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 0))}>Mes pasado</button>
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1), hoy)}>Trimestre</button>
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), 0, 1), hoy)}>Este año</button>
          <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={generar} disabled={!!busy}>
            {busy === 'generando' ? 'Generando…' : 'Generar'}
          </button>
        </div>

        <div style={{ padding: '4px 18px 16px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ marginTop: 12, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.77rem', color: '#C0554E', lineHeight: 1.5 }}>{error}</div>
          )}

          {!rep && !busy && !error && (
            <div style={{ padding: '26px 0', color: '#9c99a6', fontSize: '0.82rem', lineHeight: 1.65 }}>
              Dale a Generar. Sale todo lo que esta cuenta tiene <b>vivo en el taller</b> —lo que está en
              análisis, en desarrollo, en pruebas o esperando tu OK, más lo que aún no arranca—, agrupado
              por etapa y con la especificación de qué va a cambiar. Lo ya entregado no entra: eso es el
              reporte de entregas.
            </div>
          )}
          {busy === 'generando' && <div style={{ padding: '26px 0', color: '#9c99a6', fontSize: '0.85rem' }}>Juntando lo que está en curso…</div>}

          {rep && h && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid #f4f3f7' }}>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>En su cola</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#5B4BD6' }}>{h.total}</div></div>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Ya arrancadas</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: h.en_curso ? '#1E8A63' : '#a5a2af' }}>{h.en_curso}</div></div>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Sin costo</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.cortesias}</div></div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Folio</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#5B4BD6', fontFamily: 'ui-monospace, monospace' }}>{rep.folio}</div></div>
              </div>

              {/* El aviso que de verdad cambia lo que haces aquí no es el video
                  —todavía no hay ninguno—, es la especificación: un renglón sin
                  «qué va a cambiar» le llega al cliente como un título suelto que
                  no le dice nada a quien no estuvo en la junta. */}
              {sinEspec > 0 && (
                <div style={{ marginTop: 12, background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#7a5a10', lineHeight: 1.55 }}>
                  <b>{sinEspec === 1 ? 'Uno va sin especificación' : `${sinEspec} van sin especificación`}.</b> Salen
                  igual, solo con su título. Si quieres que el cliente entienda qué va a cambiar, ábrelos en el
                  taller y llena <b>«qué debería pasar»</b> en el paso 1.
                </div>
              )}
              {h.sin_fecha > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.73rem', color: '#a5a2af' }}>
                  {h.sin_fecha} de los {h.total} todavía no tienen fecha comprometida. El documento lo dice.
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                {(h.trabajos || []).map((e: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: '1px solid #f7f6fa', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 180, lineHeight: 1.4 }}>{e.titulo}</span>
                    <span style={{ ...S.chip, background: '#EEECFE', color: '#5B4BD6' }}>{e.etapa}</span>
                    {e.cortesia && <span style={{ ...S.chip, background: '#EAF8F2', color: '#1E8A63' }}>sin costo</span>}
                    {e.fecha
                      ? <span style={{ fontSize: '0.7rem', color: '#a5a2af', whiteSpace: 'nowrap' }}>{fmtDate(e.fecha)}</span>
                      : <span style={{ ...S.chip, background: '#FFF4E5', color: '#9a6a10' }}>sin fecha</span>}
                    {!e.cambio && <span style={{ ...S.chip, background: '#FFF4E5', color: '#9a6a10' }}>sin especificación</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px 15px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {rep && (<>
            {/* La liga se enseña completa a propósito: se manda por WhatsApp
                tan seguido como por correo. */}
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: '#5B4BD6', background: '#EEECFE', borderRadius: 7, padding: '5px 9px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liga}</span>
            <button style={S.btnG} onClick={copiarLiga}>Copiar liga</button>
            <a style={{ ...S.btnG, textDecoration: 'none', display: 'inline-block' }} href={liga} target="_blank" rel="noreferrer">Verlo como el cliente</a>
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
