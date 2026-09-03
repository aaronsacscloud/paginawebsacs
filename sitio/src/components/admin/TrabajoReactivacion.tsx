import { useEffect, useMemo, useRef, useState } from 'react';
import ContextoLead, { BotonContexto, MiniHilo } from './crm/ti/ContextoLead';

/* ═══ Reactivación de leads viejos ═══ (rediseño 2026-09-04, decisión del dueño)
   Un HEADER fijo (no una tarjeta) con el progreso y los ajustes, y UNA sola tarjeta a la vez con todo el peso en el
   botón de acción: apruebas, corriges o rechazas y aparece la siguiente. Todo lo que el agente redactó ya está listo
   al entrar: si faltan por redactar, se redactan solos en lotes mientras trabajas. Cada decisión tuya es un ejemplo que
   el redactor lee la próxima vez: eso es lo que «aprende». */
const postJ = (body: any) => fetch('/api/crm/ti/reactivacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const MOTIVOS = ['No es el lead correcto', 'El ángulo no le pega', 'Muy vendedor', 'Todavía no: esperar', 'Otro'];
const fecha = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const FAM_L: Record<string, string> = { seguimiento: 'Seguimiento', reactivacion: 'Reactivación', promo: 'Promoción', cierre: 'Cierre', no_show: 'No-show', preparacion: 'Preparación' };
const primerNombre = (n: any) => { const s = String(n || '').trim(); return !s || /^contacto\s*\d*$/i.test(s) ? 'qué tal' : s.split(/\s+/)[0]; };
/** El cuerpo real de la plantilla con las variables puestas: lo gris lo pone Meta, lo negro lo escribió el agente. */
function Preview({ cuerpo, nombre, texto }: { cuerpo?: string | null; nombre: string; texto: string }) {
  if (!cuerpo) return <div className="rx-prev">{texto}</div>;
  const partes = cuerpo.split(/(\{\{1\}\}|\{\{2\}\})/);
  return <div className="rx-prev">{partes.map((p, i) => p === '{{1}}' ? <b key={i}>{nombre}</b> : p === '{{2}}' ? <span key={i} className="rx-var">{texto || '…'}</span> : <span key={i} className="rx-fijo">{p}</span>)}</div>;
}

export default function TrabajoReactivacion() {
  const [d, setD] = useState<any>(null);
  const [filtro, setFiltro] = useState<'pendientes' | 'intencion' | 'conversacion' | 'programadas' | 'historial'>('pendientes');
  const [idx, setIdx] = useState(0);
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [criterio, setCriterio] = useState<Record<string, string>>({});
  const [familia, setFamilia] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [ctx, setCtx] = useState<any>(null);
  const [ajustes, setAjustes] = useState(false);
  const [saliendo, setSaliendo] = useState<string | null>(null);
  const [redactando, setRedactando] = useState<{ hechas: number; total: number } | null>(null);
  const [decididos, setDecididos] = useState(0);
  const generando = useRef(false);
  const cargar = () => fetch('/api/crm/ti/reactivacion').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  const filas: any[] = d?.filas || []; const seg = d?.segmentos || {}; const rampa = d?.rampa || {}; const panel = d?.panel || {};
  const pend = filas.filter(f => f.estado === 'propuesta');
  const lista = useMemo(() => filtro === 'pendientes' ? pend : filtro === 'intencion' || filtro === 'conversacion' ? pend.filter(f => f.segmento === filtro) : filtro === 'programadas' ? filas.filter(f => f.estado === 'programada') : filas.filter(f => !['propuesta', 'programada'].includes(f.estado)), [filas, filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  const actual = lista[Math.min(idx, Math.max(0, lista.length - 1))] || null;
  useEffect(() => { if (idx >= lista.length) setIdx(0); }, [lista.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Todo listo al entrar: si quedan candidatos sin redactar, se redactan en lotes de 8 mientras trabajas. */
  useEffect(() => {
    if (!d || d.error || generando.current) return;
    const total = Number(d.candidatos_total || 0);
    if (!total || d.activa === false) return;
    generando.current = true;
    (async () => {
      let hechas = 0; setRedactando({ hechas, total });
      for (let i = 0; i < 20; i++) {
        const r = await postJ({ accion: 'generar', n: 8 }).catch(() => ({}));
        hechas += Number(r.propuestas || 0) + Number(r.descartadas || 0) + Number(r.errores || 0);
        setRedactando({ hechas, total }); await cargar();
        if (!r.candidatos || (Number(r.propuestas || 0) + Number(r.descartadas || 0) + Number(r.errores || 0)) === 0) break;
      }
      setRedactando(null); generando.current = false;
    })();
  }, [d?.candidatos_total]); // eslint-disable-line react-hooks/exhaustive-deps

  const aviso = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 3500); };
  const siguiente = () => setIdx(i => (lista.length ? (i + 1) % Math.max(1, lista.length) : 0));
  const decidir = async (f: any, accion: 'aprobar' | 'rechazar', motivo?: string) => {
    setOcupado(f.id);
    const r = await postJ(accion === 'aprobar' ? { accion, id: f.id, mensaje: texto[f.id] ?? f.mensaje, familia: familia[f.id] || undefined, criterio: criterio[f.id] || undefined } : { accion, id: f.id, motivo });
    setOcupado(null); setRechazando(false);
    if (r?.error) { aviso('No se pudo: ' + r.error, false); return; }
    setSaliendo(f.id); setDecididos(n => n + 1);
    aviso(accion === 'aprobar' ? `Programado: sale ${fecha(r.sale_at)}.` : 'Rechazado. El redactor lo toma como lección.');
    setTimeout(async () => { setSaliendo(null); await cargar(); }, 420);
  };
  useEffect(() => {
    const h = (ev: KeyboardEvent) => { const tag = (ev.target as HTMLElement)?.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !actual || ocupado) return; if (ev.key === 'a') decidir(actual, 'aprobar'); if (ev.key === 'r') setRechazando(true); if (ev.key === 'j' || ev.key === 'ArrowRight') siguiente(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const guardarConfig = async (c: any) => { const r = await postJ({ accion: 'config', ...c }); if (r.error) aviso(r.error, false); else { aviso('Ajuste guardado.'); cargar(); } };

  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const totalHoy = decididos + pend.length + (panel.aprendizaje?.decididos_hoy || 0) - decididos;
  const hechosHoy = panel.aprendizaje?.decididos_hoy || 0;
  const pct = totalHoy ? Math.round(hechosHoy / totalHoy * 100) : 0;
  const chip = (k: typeof filtro, l: string, n?: number) => <button key={k} className={'rx-chip' + (filtro === k ? ' on' : '')} onClick={() => { setFiltro(k); setIdx(0); }}>{l}{typeof n === 'number' ? <span>{n}</span> : null}</button>;
  const cuerpoDe = (fam?: string) => { const p = (panel.plantillas || []).find((x: any) => x.familia === (fam || panel.familia_usada)); return p ? { m: p.cuerpo_marketing, u: p.cuerpo_utility, aprobada: p.aprobada } : { m: panel.cuerpo_usado?.marketing, u: panel.cuerpo_usado?.utility, aprobada: true }; };

  return (
    <div className="rx">
      {/* HEADER fijo: progreso, filtros, aprendizaje, ajustes. Sin tarjeta. */}
      <div className="rx-head">
        <div className="rx-head-fila">
          <div className="rx-prog"><div className="rx-prog-l"><b>{hechosHoy}</b> de {totalHoy} decididos hoy{redactando ? <span className="rx-red"> · redactando {redactando.hechas} de {redactando.total}…</span> : Number(d.candidatos_total) > 0 ? <span className="rx-red"> · {d.candidatos_total} por redactar</span> : null}</div><div className="rx-bar"><i style={{ width: `${pct}%` }} /></div></div>
          <div className="rx-stats">
            <span title="Aprobadas seguidas sin editar; a las 20 salen solas con veto de 10 min">Rampa <b>{Math.min(20, Number(rampa.sin_editar) || 0)}/20</b>{rampa.automatico ? ' · automática' : ''}</span>
            <span title="Ejemplos tuyos (aprobados o corregidos) que el redactor lee en cada propuesta nueva">Aprende de <b>{panel.aprendizaje?.ejemplos || 0}</b> ejemplos tuyos</span>
            <span title="Respondieron / enviadas">Responden <b>{panel.aprendizaje?.tasa == null ? '—' : `${panel.aprendizaje.tasa}%`}</b>{panel.aprendizaje?.enviadas ? ` de ${panel.aprendizaje.enviadas}` : ''}</span>
            <button className="rx-link" onClick={() => setAjustes(a => !a)}>{ajustes ? 'Cerrar ajustes' : 'Plantilla y horario'}</button>
          </div>
        </div>
        <div className="rx-head-fila">
          <div className="rx-chips">{chip('pendientes', 'Por aprobar', pend.length)}{chip('intencion', seg.intencion?.corto || 'Pidió precio/demo', pend.filter(f => f.segmento === 'intencion').length)}{chip('conversacion', seg.conversacion?.corto || 'Preguntó', pend.filter(f => f.segmento === 'conversacion').length)}{chip('programadas', 'Programados', filas.filter(f => f.estado === 'programada').length)}{chip('historial', 'Historial')}</div>
          {lista.length > 1 && <span className="rx-pos">{Math.min(idx + 1, lista.length)} de {lista.length} · <button className="rx-link" onClick={siguiente}>saltar ›</button></span>}
        </div>
        {ajustes && (
          <div className="rx-ajustes">
            <div>
              <div className="rx-lbl">Plantilla con la que sale (marketing primero; si Meta no la entrega en 10 min, cae sola a la de utilidad)</div>
              <div className="rx-fams">{(panel.plantillas || []).filter((p: any) => ['reactivacion', 'seguimiento', 'promo'].includes(p.familia)).map((p: any) => <button key={p.familia} className={'rx-chip' + ((panel.familia_usada === p.familia) ? ' on' : '')} disabled={!p.aprobada} title={p.aprobada ? '' : 'Meta aún no la aprueba; mientras, cae a la de seguimiento'} onClick={() => guardarConfig({ familia: p.familia })}>{FAM_L[p.familia] || p.familia}{!p.aprobada ? ' · pendiente en Meta' : ''}</button>)}</div>
              <div className="rx-cuerpos"><div><span>Marketing</span>{cuerpoDe().m}</div><div><span>Utilidad (respaldo)</span>{cuerpoDe().u}</div></div>
            </div>
            <div>
              <div className="rx-lbl">Horas a las que sale (México) · se reparte una por hora libre, máximo {panel.max_dia} al día, entre semana</div>
              <div className="rx-fams">{[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => { const on = (panel.horas || []).includes(h); return <button key={h} className={'rx-chip' + (on ? ' on' : '')} onClick={() => guardarConfig({ horas: on ? (panel.horas || []).filter((x: number) => x !== h) : [...(panel.horas || []), h] })}>{h}:00</button>; })}</div>
              <div className="rx-lbl" style={{ marginTop: 8 }}>Por qué así: a media mañana y a primera hora de la tarde es cuando quien atiende una tienda revisa el teléfono con calma; se evita el arranque del día y el cierre de caja. Una por hora para que no parezca campaña.</div>
              <div className="rx-lbl" style={{ marginTop: 6 }}>Tope diario: <input type="number" min={1} max={60} defaultValue={panel.max_dia} onBlur={e => Number(e.target.value) !== panel.max_dia && guardarConfig({ max_dia: e.target.value })} style={{ width: 60, border: '1px solid #e8e5f0', borderRadius: 6, padding: '2px 6px', fontFamily: 'inherit' }} /> · Próximo hueco: <b>{fecha(panel.proximo_hueco) || '—'}</b></div>
            </div>
          </div>
        )}
        {msg && <div className={'rx-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
      </div>

      {/* UNA tarjeta a la vez */}
      {!actual && <div className="ti-carta rx-vacio"><h2>{filtro === 'pendientes' ? (redactando ? 'Redactando las propuestas…' : 'Nada por aprobar') : 'Nada en esta vista'}</h2><p>{filtro === 'pendientes' ? 'Cuando el agente encuentre leads viejos con conversación, aparecen aquí ya redactados. También los redacta solo cada hora.' : ''}</p></div>}
      {actual && (() => {
        const f = actual; const k = f.contacts || {}; const emp = k.companies?.nombre_comercial || k.companies?.nombre; const nombre = primerNombre(k.nombre);
        const editable = f.estado === 'propuesta'; const txt = texto[f.id] ?? f.mensaje; const cambiado = editable && txt.trim() !== String(f.mensaje_original || f.mensaje).trim();
        const fam = familia[f.id] || panel.familia_usada; const cu = cuerpoDe(fam);
        return (
          <div className={'ti-carta rx-card' + (saliendo === f.id ? ' saliendo' : '')} key={f.id}>
            <div className="rx-card-cab">
              <span className="ti-chip" style={{ background: f.segmento === 'intencion' ? '#fef3c7' : '#f3f4f6', color: f.segmento === 'intencion' ? '#78350f' : '#4a4658' }}>{seg[f.segmento]?.l || f.segmento}</span>
              <span className="rx-suave">hace {f.meses_sin_hablar} {f.meses_sin_hablar === 1 ? 'mes' : 'meses'}{f.estado !== 'propuesta' ? ` · ${f.estado}${f.sale_at ? ` · ${fecha(f.sale_at)}` : ''}` : ''}</span>
              <span style={{ marginLeft: 'auto' }}><BotonContexto compacto onClick={() => setCtx(f)} /></span>
            </div>
            <div className="rx-grid">
              <div className="rx-quien">
                <div className="rx-lbl">Quién es</div>
                <div className="rx-nombre">{k.nombre || 'Sin nombre'}{emp ? <span> · {emp}</span> : null}</div>
                <div className="rx-suave">{f.telefono}{k.email ? ` · ${k.email}` : ''}</div>
                {f.pregunta_original && <div className="rx-p"><span>Preguntó:</span> «{f.pregunta_original}»</div>}
                {f.resumen_lead && <div className="rx-p">{f.resumen_lead}</div>}
                {f.angulo && <div className="rx-palanca">Palanca: {f.angulo}</div>}
                {f.por_que && <div className="rx-suave">{f.por_que}</div>}
                {f.contact_id && <MiniHilo contactId={f.contact_id} n={8} onAbrir={() => setCtx(f)} />}
              </div>
              <div className="rx-dice">
                <div className="rx-lbl">Así le llega por WhatsApp {cambiado && <em>· se guardará tu versión y el agente la aprende</em>}</div>
                <Preview cuerpo={cu.m} nombre={nombre} texto={txt} />
                {editable ? <textarea className="ti-campo rx-ta" rows={4} value={txt} onChange={e => setTexto(t => ({ ...t, [f.id]: e.target.value }))} /> : null}
                {editable && cambiado && <input className="ti-campo" style={{ margin: '6px 0 0' }} placeholder="Criterio para el redactor (lo que aprende): «no menciones precio si no preguntó», «usa su ciudad»…" value={criterio[f.id] || ''} onChange={e => setCriterio(c => ({ ...c, [f.id]: e.target.value }))} />}
                <div className="rx-suave" style={{ marginTop: 6 }}>Sale como plantilla <b>{FAM_L[fam] || fam}</b>{!cu.aprobada ? ' (pendiente en Meta: mientras, cae a Seguimiento)' : ''} · si Meta no la entrega en 10 min, cae sola a la de utilidad · próximo hueco {fecha(panel.proximo_hueco)}
                  {editable && <> · <select value={fam || ''} onChange={e => setFamilia(x => ({ ...x, [f.id]: e.target.value }))} style={{ border: '1px solid #e8e5f0', borderRadius: 6, padding: '1px 4px', fontFamily: 'inherit', fontSize: 11 }}>{(panel.plantillas || []).filter((p: any) => p.aprobada && ['reactivacion', 'seguimiento', 'promo'].includes(p.familia)).map((p: any) => <option key={p.familia} value={p.familia}>{FAM_L[p.familia] || p.familia}</option>)}</select></>}
                </div>
                {editable && !rechazando && (
                  <div className="rx-acciones">
                    <button className="rx-btn p" disabled={!!ocupado} onClick={() => decidir(f, 'aprobar')}>{ocupado === f.id ? 'Programando…' : cambiado ? 'Aprobar mi versión y programar' : 'Aprobar y programar'}<small>A</small></button>
                    <button className="rx-btn" disabled={!!ocupado} onClick={() => setRechazando(true)}>Rechazar<small>R</small></button>
                    <button className="rx-btn ghost" onClick={siguiente}>Saltar<small>J</small></button>
                  </div>
                )}
                {editable && rechazando && (
                  <div className="rx-acciones col"><div className="rx-lbl">Por qué no (el redactor lo aprende)</div><div className="rx-fams">{MOTIVOS.map(m => <button key={m} className="rx-chip" disabled={!!ocupado} onClick={() => decidir(f, 'rechazar', m)}>{m}</button>)}<button className="rx-chip" onClick={() => setRechazando(false)}>Cancelar</button></div></div>
                )}
                {f.estado === 'programada' && <div className="rx-acciones"><button className="rx-btn" disabled={!!ocupado} onClick={() => decidir(f, 'rechazar', 'cancelado antes de salir')}>Cancelar envío</button></div>}
              </div>
            </div>
          </div>
        );
      })()}
      <ContextoLead contactId={ctx?.contact_id || null} open={!!ctx} onClose={() => setCtx(null)}
        acciones={ctx?.estado === 'propuesta' ? [{ label: 'Aprobar y programar', primario: true, disabled: !!ocupado, onClick: async () => { await decidir(ctx, 'aprobar'); setCtx(null); } }, { label: 'Rechazar: no es el lead correcto', disabled: !!ocupado, onClick: async () => { await decidir(ctx, 'rechazar', 'No es el lead correcto'); setCtx(null); } }] : []} />
      <style>{`
        .rx{max-width:980px;margin:0 auto;padding:0 0 60px}
        .rx-head{position:sticky;top:0;z-index:20;background:var(--fondo,#f6f5f9);padding:12px 4px 10px;border-bottom:1px solid #ecebf2;margin-bottom:14px}
        .rx-head-fila{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:8px}.rx-head-fila:first-child{margin-top:0}
        .rx-prog{flex:1;min-width:240px}.rx-prog-l{font-size:12.5px;color:#4a4658}.rx-prog-l b{font-size:15px;color:#241d43}.rx-red{color:#5B4BD6;font-weight:700}
        .rx-bar{height:6px;border-radius:99px;background:#e8e5f0;margin-top:6px;overflow:hidden}.rx-bar i{display:block;height:100%;background:#5B4BD6;transition:width .4s}
        .rx-stats{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#6b6580;align-items:center}.rx-stats b{color:#241d43}
        .rx-chips{display:flex;gap:6px;flex-wrap:wrap}.rx-chip{border:1px solid #e8e5f0;background:#fff;color:#4a4658;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;gap:6px;align-items:center}.rx-chip span{background:#f3f4f6;border-radius:999px;padding:0 6px;font-size:11px}.rx-chip.on{border-color:#5B4BD6;background:#EEECFE;color:#4c1d95}.rx-chip.on span{background:#fff}.rx-chip:disabled{opacity:.5;cursor:default}
        .rx-pos{margin-left:auto;font-size:12px;color:#8e88a8}.rx-link{border:none;background:transparent;color:#5B4BD6;font-weight:800;cursor:pointer;font-family:inherit;font-size:12px;padding:0}
        .rx-ajustes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px;background:#fff;border:1px solid #e8e5f0;border-radius:12px;padding:12px 14px}
        .rx-lbl{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8e88a8;margin-bottom:6px}.rx-lbl em{font-style:normal;color:#b45309;text-transform:none;letter-spacing:0}
        .rx-fams{display:flex;gap:6px;flex-wrap:wrap}.rx-cuerpos{display:grid;gap:6px;margin-top:8px;font-size:12px;color:#4a4658}.rx-cuerpos span{display:block;font-size:10px;font-weight:800;color:#8e88a8;text-transform:uppercase;letter-spacing:.05em}
        .rx-msg{margin-top:8px;font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:8px}.rx-msg.ok{background:#e7f7ee;color:#14532d}.rx-msg.err{background:#fde7e5;color:#b3261e}
        .rx-card{padding:18px 20px;transition:opacity .35s,transform .35s}.rx-card.saliendo{opacity:0;transform:translateX(24px)}
        .rx-card-cab{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.rx-suave{font-size:12px;color:#8e88a8}
        .rx-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:18px}
        .rx-quien{background:#faf9fc;border:1px solid #ecebf2;border-radius:12px;padding:12px 14px;min-width:0}.rx-nombre{font-weight:800;font-size:16px}.rx-nombre span{font-weight:600;color:#6b6580}.rx-p{margin-top:8px;font-size:13px;line-height:1.45}.rx-p span{color:#8e88a8}.rx-palanca{margin-top:8px;font-size:12px;color:#5B4BD6;font-weight:700}
        .rx-prev{background:#e7f7ee;border-radius:12px 12px 12px 4px;padding:10px 12px;font-size:14px;line-height:1.5;color:#241d43;white-space:pre-wrap}.rx-fijo{color:#6b6580}.rx-var{background:#fff;border-radius:6px;padding:0 3px;box-shadow:inset 0 0 0 1px #c9ead6}
        .rx-ta{margin-top:8px !important;font-size:14px !important}
        .rx-acciones{display:flex;gap:8px;margin-top:14px;align-items:stretch}.rx-acciones.col{flex-direction:column;align-items:flex-start}
        .rx-btn{border:1px solid #e8e5f0;background:#fff;color:#241d43;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:10px}.rx-btn.p{flex:1;justify-content:center;background:#5B4BD6;border-color:#5B4BD6;color:#fff;font-size:15px;box-shadow:0 8px 20px rgba(91,75,214,.25)}.rx-btn.ghost{border-color:transparent;color:#8e88a8}.rx-btn small{font-size:10px;font-weight:800;border:1px solid currentColor;border-radius:5px;padding:0 5px;opacity:.7}.rx-btn:disabled{opacity:.5;cursor:default}
        .rx-vacio{text-align:center;padding:40px 20px}
        @media (max-width:820px){.rx-grid{grid-template-columns:1fr}.rx-ajustes{grid-template-columns:1fr}.rx-acciones{flex-wrap:wrap}.rx-btn.p{flex-basis:100%}}
      `}</style>
    </div>
  );
}
