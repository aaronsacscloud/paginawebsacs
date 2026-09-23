// «Enviar email» desde la ficha de la cuenta — opción A del dueño (22-sep-2026).
//
// A la izquierda se escribe; a la derecha, el correo tal como le llega (lo
// compila el servidor con el mismo sistema de plantillas, no una imitación en
// el navegador). Los documentos van como tarjetas con liga: los reportes se
// generan al mandar, y lo de la biblioteca sale con una liga propia por
// persona para saber quién lo abrió.
import { useEffect, useMemo, useRef, useState } from 'react';
import ReporteRecomendaciones from './ReporteRecomendaciones';

const iso = (d: Date) => d.toISOString().slice(0, 10);
type Rep = { tipo: 'entregas' | 'curso' | 'trabajo'; on: boolean; desde: string; hasta: string };
const REP_INFO: Record<string, { t: string; d: string; ic: string; bg: string }> = {
  entregas: { t: 'Reporte de entregas', d: 'Lo entregado en el periodo, con el video de cada mejora.', ic: '▶', bg: '#EAF8F2' },
  curso: { t: 'Trabajo en curso', d: 'Lo que está vivo en el taller y cuándo llega.', ic: '◔', bg: 'rgba(244,168,205,.3)' },
  trabajo: { t: 'Reporte ejecutivo', d: 'El periodo completo: entregas, soporte, uso y oportunidades.', ic: '▤', bg: '#EEECFE' },
};

const S = {
  lb: { fontSize: '0.64rem', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' as const, color: '#9c99a6', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 8 } as const,
  in: { width: '100%', border: '1.5px solid #e4dffb', borderRadius: 10, padding: '9px 11px', fontSize: '0.85rem', background: '#fdfcff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as const,
  btnP: { border: 'none', borderRadius: 10, padding: '9px 16px', background: '#9B8CFA', color: '#fff', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnG: { border: '1px solid #dcd8ea', borderRadius: 9, padding: '8px 13px', background: '#fff', color: '#3d3752', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  fecha: { border: '1.5px solid #e4dffb', borderRadius: 8, padding: '4px 6px', fontSize: '0.74rem', background: '#fff', fontFamily: 'inherit' } as const,
};

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();

export default function EnviarCorreo({ companyId, cliente, contactos = [], onCerrar, onEnviado }: any) {
  const hoy = new Date();
  const ini = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const fin = iso(hoy);
  const conCorreo = (contactos || []).filter((c: any) => c.email);
  const [para, setPara] = useState<string[]>(() => {
    const p = conCorreo.find((c: any) => c.es_principal) || conCorreo[0];
    return p ? [String(p.email).toLowerCase()] : [];
  });
  const [otro, setOtro] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [reps, setReps] = useState<Rep[]>([
    { tipo: 'entregas', on: false, desde: ini, hasta: fin },
    { tipo: 'curso', on: false, desde: ini, hasta: fin },
    { tipo: 'trabajo', on: false, desde: ini, hasta: fin },
  ]);
  const [biblio, setBiblio] = useState<any[] | null>(null);
  const [docs, setDocs] = useState<string[]>([]);
  const [html, setHtml] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState<any>(null);
  // El reporte de recomendaciones preparado para este correo (se genera aparte).
  const [recom, setRecom] = useState<any>(null);
  const [prepRec, setPrepRec] = useState(false);

  useEffect(() => {
    fetch('/api/crm/documentos?activos=1').then(r => r.json()).then(j => setBiblio(j?.documentos || [])).catch(() => setBiblio([]));
  }, []);

  const payload = useMemo(() => ({
    company_id: companyId, para: [...para, ...extra], asunto, mensaje,
    reportes: reps.filter(r => r.on).map(r => ({ tipo: r.tipo, desde: r.desde, hasta: r.hasta })),
    documentos: docs,
    recomendacion_id: recom?.on ? recom.id : null,
  }), [companyId, para, extra, asunto, mensaje, reps, docs, recom]);

  /* La vista previa se pide al servidor con una pausa: si se pidiera en cada
     tecla, el reporte ejecutivo —que junta todo el periodo— se calcularía
     treinta veces mientras se escribe una frase. */
  const t = useRef<any>(null);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const r = await fetch('/api/crm/correo-cuenta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, accion: 'vista' }) })
        .then(x => x.json()).catch(() => null);
      if (r?.html) { setHtml(r.html); setAvisos(r.avisos || []); }
    }, 650);
    return () => clearTimeout(t.current);
  }, [payload]);

  const destinatarios = para.length + extra.length;
  const toggle = (e: string) => setPara(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);
  const setRep = (tipo: string, o: Partial<Rep>) => setReps(v => v.map(r => r.tipo === tipo ? { ...r, ...o } : r));

  function agregarOtro() {
    const e = otro.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Ese correo no se ve bien.'); return; }
    setError(''); if (!extra.includes(e) && !para.includes(e)) setExtra(v => [...v, e]); setOtro('');
  }

  async function redactar() {
    setBusy('redactar'); setError('');
    const nombres = conCorreo.filter((c: any) => para.includes(String(c.email).toLowerCase())).map((c: any) => String(c.nombre || '').split(' ')[0]);
    const r = await fetch('/api/crm/correo-cuenta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'redactar', company_id: companyId, nombres }) })
      .then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo redactar.'); return; }
    if (r.asunto && !asunto) setAsunto(r.asunto);
    if (r.mensaje) setMensaje(r.mensaje);
  }

  async function enviar() {
    setBusy('enviar'); setError('');
    const r = await fetch('/api/crm/correo-cuenta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, accion: 'enviar' }) })
      .then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo enviar.'); return; }
    setListo(r); onEnviado?.(r);
  }

  const nDocs = reps.filter(r => r.on).length + docs.length + (recom?.on ? 1 : 0);

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Enviar email" style={{
        background: '#fff', borderRadius: 16, width: 'min(1180px, 100%)', height: 'min(860px, 94vh)', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,.95fr)', boxShadow: '0 24px 60px rgba(20,15,50,.3)',
      }} className="correo-cuenta">
        <style>{`@media (max-width: 860px){ .correo-cuenta{ grid-template-columns: 1fr !important } .correo-vista{ display:none !important } }`}</style>
        {/* ── Izquierda: escribir ── */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid #f1eff7' }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,#F4A8CD)', flex: 'none' }} />
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #f1eff7', flex: 'none', display: 'flex', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Correo a {cliente}</div>
              <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>Sale desde el correo del CRM, con tu firma. Si te contestan, te llega a ti.</div>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar" style={{ marginLeft: 'auto', border: '1px solid #ececf1', background: '#fff', borderRadius: 9, width: 32, height: 32, color: '#8a8590', cursor: 'pointer' }}>×</button>
          </div>

          {listo ? (
            <div style={{ padding: 24, flex: 1 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1E8A63' }}>Enviado ✓</div>
              <div style={{ fontSize: '0.88rem', color: '#555', marginTop: 8, lineHeight: 1.6 }}>
                Salió a <b>{listo.enviados.join(', ')}</b>.
                {listo.reportes?.length > 0 && <> Reportes: {listo.reportes.map((r: any) => r.folio).join(', ')}.</>}
                {listo.fallaron?.length > 0 && <div style={{ color: '#C0554E', marginTop: 6 }}>No salió a {listo.fallaron.map((f: any) => f.para).join(', ')}.</div>}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#8a8596', marginTop: 10 }}>Quedó en la Actividad de la cuenta. Cuando abran los documentos, lo vas a ver ahí mismo.</div>
              <button style={{ ...S.btnG, marginTop: 18 }} onClick={onCerrar}>Cerrar</button>
            </div>
          ) : (<>
            <div style={{ padding: '12px 18px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <div style={S.lb}>Para <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#a5a2af' }}>contactos de la cuenta</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {conCorreo.map((c: any) => {
                  const e = String(c.email).toLowerCase(); const on = para.includes(e);
                  return (
                    <button key={c.id || e} onClick={() => toggle(e)} title={c.email}
                      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', borderRadius: 999, padding: '5px 11px 5px 6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: '1.5px solid ' + (on ? '#9B8CFA' : '#ddd6fb'), background: on ? '#EEECFE' : '#fff', color: on ? '#5B4BD6' : '#3d3752' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.6rem', fontWeight: 800, background: '#e8e4fb', color: '#5B4BD6' }}>{iniciales(c.nombre || c.email)}</span>
                      {c.nombre || c.email}{c.puesto ? ` · ${c.puesto}` : ''}
                    </button>
                  );
                })}
                {extra.map(e => (
                  <button key={e} onClick={() => setExtra(v => v.filter(x => x !== e))} title="Quitar"
                    style={{ borderRadius: 999, padding: '5px 11px', fontSize: '0.78rem', fontWeight: 700, border: '1.5px solid #9B8CFA', background: '#EEECFE', color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>{e} ×</button>
                ))}
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input value={otro} onChange={e => setOtro(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarOtro(); }} placeholder="+ otro correo"
                    style={{ ...S.in, width: 170, padding: '5px 10px', fontSize: '0.78rem', borderRadius: 999 }} />
                </span>
              </div>
              {!conCorreo.length && <div style={{ fontSize: '0.76rem', color: '#9a6a10', marginTop: 6 }}>Esta cuenta no tiene contactos con correo: escribe uno arriba.</div>}

              <div style={{ ...S.lb, marginTop: 14 }}>Asunto</div>
              <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder={`${cliente} · lo que avanzamos y lo que sigue`} style={S.in} />

              <div style={{ ...S.lb, marginTop: 14 }}>Mensaje
                <button onClick={redactar} disabled={busy === 'redactar'} style={{ marginLeft: 'auto', border: 'none', borderRadius: 20, padding: '3px 10px', background: '#EEECFE', color: '#5B4BD6', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0 }}>
                  {busy === 'redactar' ? 'Redactando…' : '✦ Redactar con IA'}
                </button>
              </div>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={6} placeholder="Escribe lo que necesites decirles…" style={{ ...S.in, resize: 'vertical', lineHeight: 1.55 }} />

              <div style={{ ...S.lb, marginTop: 14 }}>Documentos <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#a5a2af' }}>{nDocs} en el correo</span></div>
              {reps.map(r => {
                const i = REP_INFO[r.tipo];
                return (
                  <div key={r.tipo} style={{ border: '1px solid ' + (r.on ? '#c9c1f5' : '#ecebf3'), background: r.on ? '#faf9ff' : '#fff', borderRadius: 12, padding: '9px 11px', marginBottom: 7 }}>
                    <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={r.on} onChange={e => setRep(r.tipo, { on: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#9B8CFA' }} />
                      <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: i.bg, flex: 'none' }}>{i.ic}</span>
                      <span style={{ flex: 1 }}><b style={{ fontSize: '0.82rem', display: 'block' }}>{i.t}</b><small style={{ fontSize: '0.72rem', color: '#9c99a6' }}>{i.d}</small></span>
                    </label>
                    {r.on && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, paddingLeft: 26, flexWrap: 'wrap' }}>
                        <input type="date" value={r.desde} onChange={e => setRep(r.tipo, { desde: e.target.value })} style={S.fecha} />
                        <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>al</span>
                        <input type="date" value={r.hasta} onChange={e => setRep(r.tipo, { hasta: e.target.value })} style={S.fecha} />
                        <span style={{ fontSize: '0.7rem', color: '#8a8596' }}>se genera al enviar</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Recomendaciones: no se genera en automático como los otros tres —
                  se prepara y se revisa— y por eso trae su propio botón. */}
              <div style={{ border: '1px solid ' + (recom?.on ? '#c9c1f5' : '#ecebf3'), background: recom?.on ? '#faf9ff' : '#fff', borderRadius: 12, padding: '9px 11px', marginBottom: 7, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" disabled={!recom} checked={!!recom?.on} onChange={e => setRecom((r: any) => r ? { ...r, on: e.target.checked } : r)} style={{ width: 16, height: 16, accentColor: '#9B8CFA' }} />
                <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#FFF4E5', flex: 'none' }}>✦</span>
                <span style={{ flex: 1 }}><b style={{ fontSize: '0.82rem', display: 'block' }}>Recomendaciones de la cuenta</b>
                  <small style={{ fontSize: '0.72rem', color: '#9c99a6' }}>{recom ? `${recom.folio} · ${recom.resumen?.a_medias || 0} flujos por cerrar` : 'Los flujos que no se están cerrando. Se prepara y se revisa antes.'}</small></span>
                <button onClick={() => setPrepRec(true)} style={{ border: '1.5px solid #9B8CFA', borderRadius: 8, padding: '5px 10px', background: '#fff', color: '#5B4BD6', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {recom ? 'Rehacer' : 'Preparar'}
                </button>
              </div>

              <div style={{ ...S.lb, marginTop: 12 }}>De la biblioteca</div>
              {biblio === null && <div style={{ fontSize: '0.78rem', color: '#a5a2af' }}>Cargando…</div>}
              {biblio?.length === 0 && <div style={{ fontSize: '0.78rem', color: '#a5a2af' }}>No hay documentos activos. Se agregan en Configuración → Documentos.</div>}
              {(biblio || []).map((d: any) => {
                const on = docs.includes(d.id);
                return (
                  <label key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', border: '1px solid ' + (on ? '#c9c1f5' : '#ecebf3'), background: on ? '#faf9ff' : '#fff', borderRadius: 12, padding: '9px 11px', marginBottom: 7 }}>
                    <input type="checkbox" checked={on} onChange={() => setDocs(v => on ? v.filter(x => x !== d.id) : [...v, d.id])} style={{ width: 16, height: 16, accentColor: '#9B8CFA' }} />
                    <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#1d1545', color: '#EFA6CA', flex: 'none' }}>✦</span>
                    <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: '0.82rem', display: 'block' }}>{d.titulo}</b>
                      <small style={{ fontSize: '0.72rem', color: '#9c99a6' }}>{d.tipo === 'presentacion' ? 'Presentación' : d.tipo === 'pdf' ? 'PDF' : 'Liga'}{d.vence ? ` · vence ${d.vence.slice(8, 10)}/${d.vence.slice(5, 7)}` : ''}</small></span>
                  </label>
                );
              })}
              {avisos.map((a, i) => <div key={i} style={{ fontSize: '0.75rem', color: '#9a6a10', marginTop: 6 }}>{a}</div>)}
              {error && <div style={{ marginTop: 10, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.78rem', color: '#C0554E' }}>{error}</div>}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
              <span style={{ fontSize: '0.72rem', color: '#8a8596' }}>Queda en la Actividad y ves cuándo lo abren.</span>
              <span style={{ flex: 1 }} />
              <button style={S.btnG} onClick={onCerrar}>Cancelar</button>
              <button style={{ ...S.btnP, opacity: busy || !destinatarios ? .6 : 1 }} disabled={!!busy || !destinatarios} onClick={enviar}>
                {busy === 'enviar' ? 'Enviando…' : `Enviar a ${destinatarios} ${destinatarios === 1 ? 'persona' : 'personas'}`}
              </button>
            </div>
          </>)}
        </div>

        {prepRec && <ReporteRecomendaciones companyId={companyId} cliente={cliente} onCerrar={() => setPrepRec(false)}
          onGenerado={(r: any) => { setRecom({ ...r, on: true }); setPrepRec(false); }} />}
        {/* ── Derecha: así le llega ── */}
        <div className="correo-vista" style={{ background: '#f7f6fb', padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={S.lb}>Así le llega</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#231d40', marginBottom: 8 }}>{asunto || <span style={{ color: '#b5b2bf' }}>(sin asunto)</span>}</div>
          {/* En la vista previa las ligas no se siguen: los reportes todavía no
              existen y al darle «Ver» el marco se iba a «Reporte no encontrado». */}
          <iframe title="Vista previa del correo" srcDoc={html.replace('</head>', '<style>a{pointer-events:none;cursor:default}</style></head>')} sandbox="" style={{ flex: 1, width: '100%', border: '1px solid #ecebf3', borderRadius: 12, background: '#fff' }} />
        </div>
      </div>
    </div>
  );
}
