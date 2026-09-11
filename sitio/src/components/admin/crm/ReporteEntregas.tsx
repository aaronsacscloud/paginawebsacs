// Reporte de ENTREGAS: el documento que justifica el trabajo, con su video.
//
// El reporte ejecutivo cuenta el periodo entero —soporte, uso, oportunidades—
// y por eso pasa por la IA que lo redacta. Este contesta una sola pregunta,
// «¿qué me han hecho?», y su contenido son hechos que no hay que redactar: qué
// se pidió, de qué tipo fue, cuándo quedó y dónde está el video. Por eso aquí
// no hay paso de redacción: se genera y ya tiene liga.
//
// Ese video es la razón de existir del documento. Sin él, esto ya lo decía el
// reporte ejecutivo.
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

export default function ReporteEntregas({ companyId, cliente, onCerrar }: any) {
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
      body: JSON.stringify({ company_id: companyId, desde, hasta, tipo: 'entregas' }),
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

  const sinVideo = h ? Number(h.total || 0) - Number(h.con_video || 0) : 0;

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Reporte de entregas" style={{
        background: '#fff', borderRadius: 14, width: 'min(680px, 100%)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 22px 54px rgba(20,15,50,.25)',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f1eff7' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.015em' }}>Reporte de entregas</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>
            {cliente} · lo entregado en el periodo, con el video de cada mejora.
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
              Elige el periodo y dale a Generar. Salen las mejoras <b>entregadas</b> en esas fechas que
              estén marcadas como «se le puede mostrar al cliente», cada una con su tipo, su fecha y —si
              le pegaste la liga— su video.
            </div>
          )}
          {busy === 'generando' && <div style={{ padding: '26px 0', color: '#9c99a6', fontSize: '0.85rem' }}>Juntando las entregas…</div>}

          {rep && h && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid #f4f3f7' }}>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Entregas</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.total}</div></div>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Con video</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: h.con_video ? '#5B4BD6' : '#a5a2af' }}>{h.con_video}</div></div>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Sin costo</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.cortesias}</div></div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Folio</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#5B4BD6', fontFamily: 'ui-monospace, monospace' }}>{rep.folio}</div></div>
              </div>

              {/* El aviso que de verdad cambia lo que haces: si faltan videos,
                  lo útil no es explicar nada, es decir dónde se pegan. */}
              {sinVideo > 0 && (
                <div style={{ marginTop: 12, background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#7a5a10', lineHeight: 1.55 }}>
                  <b>{sinVideo === 1 ? 'Una entrega va sin video' : `${sinVideo} entregas van sin video`}.</b> Salen
                  igual en el documento, con la leyenda «sin video». Si quieres agregárselos, ábrelas en
                  <b> Editar</b>, pega la liga y vuelve a generar el reporte.
                </div>
              )}

              {h.internas > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.73rem', color: '#a5a2af' }}>
                  {h.internas} entrega(s) marcadas como internas no van en el documento.
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                {(h.entregas || []).map((e: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: '1px solid #f7f6fa', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 180, lineHeight: 1.4 }}>{e.titulo}</span>
                    <span style={{ ...S.chip, background: '#EEECFE', color: '#5B4BD6' }}>{TIPO_L[e.categoria] || 'mejora'}</span>
                    {e.cortesia && <span style={{ ...S.chip, background: '#EAF8F2', color: '#1E8A63' }}>sin costo</span>}
                    <span style={{ fontSize: '0.7rem', color: '#a5a2af', whiteSpace: 'nowrap' }}>{fmtDate(e.fecha)}</span>
                    {e.video
                      ? <a href={e.video} target="_blank" rel="noreferrer" style={{ ...S.chip, background: '#EEECFE', color: '#5B4BD6', textDecoration: 'none' }}>▶ video</a>
                      : <span style={{ ...S.chip, background: '#FFF4E5', color: '#9a6a10' }}>sin video</span>}
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
