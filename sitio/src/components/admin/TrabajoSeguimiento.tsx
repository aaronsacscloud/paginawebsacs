/**
 * SEGUIMIENTO · el agente aprende a contestar hasta la paridad 9/10 (decisión del dueño, 2026-09-03).
 *
 * Arriba, una sola barra: el promedio de las últimas 300 respuestas decididas contra la meta de 9. Debajo, UNA
 * sugerencia a la vez: quién es, qué dijo, qué respondería el agente, y tres salidas (Enviar · Modificar ·
 * Rechazar). Cada decisión califica y enseña. Cuando la ventana está llena y el promedio llega a la meta, el
 * agente pasa solo a responder todos los WhatsApps (y avisa). Las mismas sugerencias aparecen en el inbox como
 * compuerta encima del compositor: quien abra la conversación decide ahí mismo.
 */
import { useEffect, useState } from 'react';
import DecisionSugerencia from './crm/ti/DecisionSugerencia';
import ContextoLead, { MiniHilo } from './crm/ti/ContextoLead';
import ReglasAgente from './ReglasAgente';

const fecha = (s?: string | null) => s ? new Date(s).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }) : '—';
const DEC_L: Record<string, string> = { enviar: 'Tal cual', modificar: 'Modificada', rechazar: 'Rechazada', humano: 'Contestó por su cuenta' };

export default function TrabajoSeguimiento({ soloAjustes }: { soloAjustes?: boolean } = {}) {
  const [d, setD] = useState<any>(null);
  const [vista, setVista] = useState<'pendientes' | 'historial' | 'reglas'>('pendientes');
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [ctx, setCtx] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const [como, setComo] = useState(false);
  const [activando, setActivando] = useState(false);
  const cargar = () => fetch('/api/crm/ti/seguimiento').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); const t = setInterval(cargar, 45000); return () => clearInterval(t); }, []);
  const aviso = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 4000); };
  if (soloAjustes) return <PanelAjustes d={d} onGuardado={cargar} />;
  if (!d) return <div className="ti-lienzo"><div className="ti-suave">Cargando…</div></div>;
  if (d.error) return <div className="ti-lienzo"><div className="ti-card">{d.error}</div></div>;
  const p = d.paridad || {};
  const pend: any[] = d.pendientes || [];
  const actual = pend[Math.min(idx, Math.max(0, pend.length - 1))] || null;
  const pct = p.promedio !== null && p.promedio !== undefined ? Math.max(0, Math.min(100, (p.promedio / 10) * 100)) : 0;
  const metaPct = (p.meta / 10) * 100;
  const onDecidido = (r: any) => {
    setSaliendo(true);
    const cal = r.calificacion;
    aviso(r.decision === 'rechazar' ? 'Rechazada: el agente toma la razón como lección. Contéstale tú desde el inbox.' : r.decision === 'modificar' ? `Enviada con tus cambios · calificación ${cal}/10${r.criterio_inferido ? ` · El agente entendió: «${r.criterio_inferido}»` : ''}${r.lista ? ' · ¡Llegó a la meta: ya puedes activar el automático!' : ''}` : `Enviada tal cual · 10/10${r.autonomo ? ' · ¡Llegó a la meta: ya responde solo!' : ''}`, r.decision !== 'rechazar');
    setTimeout(async () => { setSaliendo(false); await cargar(); }, 380);
  };
  return (
    <div className="ti-lienzo sg">
      <style>{CSS}</style>
      <div className="sg-head">
        <div className="sg-fila1">
          <div className="sg-num"><b>{p.promedio === null || p.promedio === undefined ? '—' : p.promedio.toFixed(1)}</b><span>/ 10</span></div>
          <div className="sg-barra-wrap">
            <div className="sg-barra"><i style={{ width: `${pct}%` }} className={p.alcanzada ? 'ok' : ''} /><em style={{ left: `${metaPct}%` }} title={`Meta ${p.meta}`} /></div>
            <div className="sg-sub">{p.llena ? `Ventana llena: últimas ${p.ventana} respuestas` : `${p.n} de ${p.ventana} respuestas calificadas · faltan ${p.faltan}`} · meta <b>{p.meta}</b>{p.tendencia?.reciente !== null && p.tendencia?.anterior !== null && p.tendencia?.reciente !== undefined && p.tendencia?.anterior !== undefined ? <> · últimas 50: <b>{p.tendencia.reciente.toFixed(1)}</b> vs {p.tendencia.anterior.toFixed(1)} antes</> : null}</div>
          </div>
          {p.modo !== 'vivo' && p.alcanzada ? (
            <button className="sg-activar" disabled={activando} onClick={async () => {
              if (!window.confirm(`El agente promedia ${p.promedio}/10 en las últimas ${p.n} respuestas. ¿Activar las respuestas automáticas? Desde ese momento manda directo a todos los leads sin esperar a nadie.`)) return;
              setActivando(true);
              const r = await fetch('/api/crm/ti/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'config', agente_modo: 'vivo' }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
              setActivando(false); if (r.error) aviso(r.error, false); else { aviso('Respuestas automáticas activadas.'); cargar(); }
            }}>{activando ? 'Activando…' : 'Activar respuestas automáticas'}</button>
          ) : (
            <div className={'sg-modo' + (p.modo === 'vivo' ? ' vivo' : '')}>{p.modo === 'vivo' ? <>Automático{p.alcanzada_at ? ` desde ${fecha(p.alcanzada_at)}` : ''}</> : 'En entrenamiento: todo pasa por un consultor'}</div>
          )}
          <button className="sg-link" onClick={() => setComo(true)}>¿Cómo funciona?</button>
        </div>
        <div className="sg-fila2">
          <span><b>{p.tal_cual || 0}</b> tal cual</span><span><b>{p.modificadas || 0}</b> modificadas</span><span><b>{p.rechazadas || 0}</b> rechazadas</span><span><b>{p.humano || 0}</b> por su cuenta</span><span><b>{p.hoy || 0}</b> hoy</span>
          {(p.por_usuario || []).slice(0, 4).map((u: any) => <span key={u.id} className="sg-u">{u.nombre}: {u.promedio} en {u.n}</span>)}
          {d.ofertas && d.ofertas.total_30d > 0 && <span className="sg-u" title="Demos o llamadas que el agente propuso sin conocer giro, tiendas y necesidad (30 días). Meta: menos del 10 %">ofertas prematuras <b>{d.ofertas.pct_prematuras}%</b> de {d.ofertas.total_30d}{d.ofertas.completas?.n > 3 && d.ofertas.prematuras_res?.n > 3 ? ` · agendan ${d.ofertas.completas.pct_agendan}% con datos vs ${d.ofertas.prematuras_res.pct_agendan}% sin` : ''}</span>}
          {d.rechazos_momento && (d.rechazos_momento.ultimos_14 > 0 || d.rechazos_momento.anteriores_14 > 0) && <span className="sg-u" title="Rechazos por «no era el momento» o «no entendió», últimos 14 días vs los 14 anteriores">rechazos por momento <b>{d.rechazos_momento.ultimos_14}</b> vs {d.rechazos_momento.anteriores_14}</span>}
          {d.resultados?.total?.n > 0 && <span className="sg-u" title="Resultado real de lo enviado: contestó en 48 h · agendó en 7 días">responden 48 h <b>{d.resultados.total.responden_48h ?? '—'}%</b>{d.resultados.por_decision?.enviar?.n > 2 && d.resultados.por_decision?.modificar?.n > 2 ? ` (tal cual ${d.resultados.por_decision.enviar.responden_48h}% · modificadas ${d.resultados.por_decision.modificar.responden_48h}%)` : ''} · agendan 7 d <b>{d.resultados.total.agendan_7d ?? '—'}%</b></span>}
          <span className="sg-pos">{vista === 'pendientes' ? <><b>{pend.length}</b> por decidir{pend.length > 1 ? ` · ${Math.min(idx, pend.length - 1) + 1} de ${pend.length}` : ''} · </> : null}{vista !== 'pendientes' && <><button className="sg-link" onClick={() => { setVista('pendientes'); setIdx(0); }}>por decidir</button> · </>}{vista !== 'historial' && <><button className="sg-link" onClick={() => setVista('historial')}>historial</button> · </>}{vista !== 'reglas' && <button className="sg-link" onClick={() => setVista('reglas')}>reglas</button>}</span>
        </div>
        {msg && <div className={'sg-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
      </div>

      {vista === 'pendientes' && !actual && (
        <div className="ti-card sg-vacio"><b>Nada por decidir.</b><div className="ti-suave">Cuando un lead escriba, el agente redacta y la sugerencia aparece aquí y en su conversación del inbox.</div></div>
      )}
      {vista === 'pendientes' && actual && (
        <div className={'ti-card sg-card' + (saliendo ? ' saliendo' : '')} key={actual.id}>
          <div className="sg-grid">
            <div className="sg-quien">
              <div className="sg-lbl">Quién es</div>
              <div className="sg-nombre">{actual.contacto?.nombre || 'Sin nombre'}{actual.contacto?.empresa ? <span> · {actual.contacto.empresa}</span> : null}</div>
              <div className="ti-suave" style={{ margin: 0 }}>{actual.telefono}{actual.contacto?.etapa ? ` · ${actual.contacto.etapa}` : ''}{actual.contacto?.giro ? ` · ${actual.contacto.giro}` : ''} · propuesta {fecha(actual.created_at)}</div>
              {actual.ultimo_mensaje && <div className="sg-p"><span>Escribió:</span> «{actual.ultimo_mensaje}»</div>}
              {actual.objetivo && <div className="sg-p"><span>El agente busca:</span> {actual.objetivo}</div>}
              {actual.contact_id && <MiniHilo contactId={actual.contact_id} n={10} onAbrir={() => setCtx(actual.contact_id)} />}
            </div>
            <div className="sg-dice">
              <div className="sg-lbl">Así respondería el agente</div>
              <DecisionSugerencia sug={actual} galeria={d.galeria || []} atajos onDecidido={onDecidido} />
            </div>
          </div>
        </div>
      )}
      {vista === 'reglas' && <ReglasAgente />}
      {vista === 'historial' && (
        <div className="ti-card">
          {(d.historial || []).length === 0 && <div className="ti-suave">Todavía no hay decisiones.</div>}
          {(d.historial || []).map((h: any) => (
            <details key={h.id} className="sg-h">
              <summary><span className={'sg-cal c' + Math.round(h.calificacion)}>{Number(h.calificacion).toFixed(0)}</span><b>{h.contacto || 'Lead'}</b><span className="sg-dec">{DEC_L[h.decision] || h.decision}</span><span className="ti-suave" style={{ margin: 0 }}>{h.usuario ? `${h.usuario} · ` : ''}{fecha(h.created_at)}{h.motivo ? ` · ${h.motivo}` : ''}</span></summary>
              <div className="sg-h-b"><div><i>Agente:</i> {h.mensaje_sugerido}</div>{h.mensaje_final && h.mensaje_final !== h.mensaje_sugerido && <div><i>{h.decision === 'humano' ? 'Consultor:' : 'Quedó:'}</i> {h.mensaje_final}</div>}{h.detalle && <div><i>Nota:</i> {h.detalle}</div>}</div>
            </details>
          ))}
        </div>
      )}
      <ContextoLead contactId={ctx} open={!!ctx} onClose={() => setCtx(null)} />
      {como && <ComoFunciona p={p} onCerrar={() => setComo(false)} />}
    </div>
  );
}

/* La explicación en un solo lugar (pedida por el dueño 3-sep): cómo se decide, cómo aprende, cada cuánto y qué cambia con cada acción. */
function ComoFunciona({ p, onCerrar }: { p: any; onCerrar: () => void }) {
  return (
    <div className="sg-velo" onClick={onCerrar}>
      <div className="sg-modal" onClick={e => e.stopPropagation()}>
        <div className="sg-modal-cab"><b>Cómo funciona Seguimiento</b><button className="sg-x" onClick={onCerrar} aria-label="Cerrar">×</button></div>
        <div className="sg-modal-cuerpo">
          <h4>Cada cuánto y qué se analiza</h4>
          <p>Cada <b>2 minutos</b> el agente revisa los mensajes nuevos de WhatsApp. Por cada lead que escribió lee la conversación completa (sus últimos mensajes, lo que ya sabemos de él, su etapa, la cita o cotización vigente), el guion de ventas y la wiki, los <b>ejemplos aprobados</b> (hasta 24, primero las correcciones de ustedes), lo que los consultores <b>rechazaron</b> (últimos 8) y la galería de imágenes, PDF y videos. Con eso redacta una respuesta y elige si conviene adjuntar algo.</p>
          <p>En entrenamiento <b>no manda nada</b>: deja la respuesta como sugerencia aquí y en la conversación del inbox, encima del compositor. Aplica a todas las conversaciones, también a las que lleva un consultor. Solo los teléfonos de prueba reciben el flujo en vivo. Hay una sola sugerencia por lead: si vuelve a escribir antes de que decidan, la sugerencia se reemplaza por una nueva.</p>
          <h4>Qué cambia con cada decisión</h4>
          <ul>
            <li><b>Enviar</b>: sale tal cual, con sus adjuntos, por el mismo canal del agente. Calificación <b>10</b>.</li>
            <li><b>Modificar → Enviar con modificaciones</b>: sale tu versión. Se guarda como ejemplo aprobado con tu criterio y tus adjuntos; una imagen que subas queda en la galería y el agente la puede volver a mandar cuando el caso se parezca. Calificación <b>9, 8, 6, 4 o 2</b> según cuánto quedó de lo que él propuso.</li>
            <li><b>Rechazar</b>: la razón es obligatoria y es la lección. Calificación <b>0</b>. Desde la siguiente redacción el agente ve ese caso en el bloque «no contestes así». El compositor se libera para que contestes tú.</li>
            <li><b>Contestaste por tu cuenta</b> (desde el teléfono u otra sesión): tu respuesta se compara con la sugerencia y se califica como «por su cuenta». Tu texto y tus adjuntos quedan como ejemplo por revisar en Informes → Biblioteca.</li>
            <li><b>Sin decisión 3 días</b>: la sugerencia expira y no cuenta.</li>
          </ul>
          <h4>Cómo aprende</h4>
          <p><b>Inmediato:</b> cada nueva redacción vuelve a leer los ejemplos aprobados y los rechazos, así que una corrección de hoy ya pesa en la respuesta de dentro de dos minutos. <b>Nocturno (2:00 am):</b> si un mismo tipo de corrección o rechazo se repite 3 veces en 14 días, el agente propone una regla del guion para que la apruebes, y avisa de las preguntas que la wiki no cubrió. Nada se modifica solo: las reglas propuestas se aceptan en la Torre.</p>
          <h4>Las reglas: dónde viven y cómo se prueban</h4>
          <p>En <b>Seguimiento → Reglas</b> cualquiera del equipo escribe una regla en español («no ofrezcas la demo hasta conocer el negocio y una o dos necesidades»). <b>Probar</b> hace que el agente conteste hasta 24 casos reales con y sin la regla; un juez califica cada respuesta y cuenta en cuántos casos la respuesta viola la regla. Si mejora, <b>Aprobar y activar</b> la mete al bloque «Reglas vigentes» que el agente lee antes de cada respuesta, con fecha y quién la activó. Si empeora, no se activa sin confirmar. El ciclo nocturno también propone reglas cuando un mismo tipo de corrección se repite 3 veces en 14 días; llegan ya redactadas y probadas a la Torre y a Reglas. El guion completo, la wiki y los límites viven en Configuración → Agente IA con versiones.</p>
          <h4>Cuándo responde solo</h4>
          <p>La meta es promedio <b>{p.meta}</b> en las últimas <b>{p.ventana}</b> decisiones. Cuando se cumple aparece arriba el botón <b>«Activar respuestas automáticas»</b>; nada cambia hasta que el dueño lo oprime. En automático manda directo, respetando el semáforo (horario de 8 a 21, un automático por día por lead, nunca a clientes ni a quien pidió que no le escriban) y sigue aprendiendo de cada veto o edición. Se puede regresar a entrenamiento en Configuración → Agente IA → Seguimiento.</p>
        </div>
      </div>
    </div>
  );
}

function PanelAjustes({ d, onGuardado }: { d: any; onGuardado: () => void }) {
  const c = d?.config || {};
  const [meta, setMeta] = useState<string>(''); const [ventana, setVentana] = useState<string>(''); const [modo, setModo] = useState<string>(''); const [tels, setTels] = useState<string>('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!d?.config) return; setMeta(String(c.paridad_meta)); setVentana(String(c.paridad_ventana)); setModo(c.agente_modo); setTels((c.agente_prueba_telefonos || []).join(', ')); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <div className="ti-suave">Cargando…</div>;
  const guardar = async () => {
    const r = await fetch('/api/crm/ti/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'config', paridad_meta: Number(meta), paridad_ventana: Number(ventana), agente_modo: modo, agente_prueba_telefonos: tels.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean) }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setMsg(r.error ? r.error : 'Guardado.'); if (!r.error) onGuardado(); setTimeout(() => setMsg(''), 3500);
  };
  const p = d.paridad || {};
  return (
    <div className="ti-card" style={{ display: 'grid', gap: 12 }}>
      <style>{CSS}</style>
      <div className="ti-suave" style={{ margin: 0 }}>Hoy: <b>{p.promedio ?? '—'}</b>/10 en {p.n} de {p.ventana} respuestas. En entrenamiento todo lo que el agente redacta pasa por un consultor (Seguimiento o la compuerta del inbox); al llegar a la meta con la ventana llena pasa solo a autónomo.</div>
      <div className="sg-aj">
        <label>Meta (de 10)<input className="ti-campo" type="number" step="0.5" min={5} max={10} value={meta} onChange={e => setMeta(e.target.value)} /></label>
        <label>Ventana (respuestas)<input className="ti-campo" type="number" min={20} max={2000} value={ventana} onChange={e => setVentana(e.target.value)} /></label>
        <label>Modo del agente<select className="ti-campo" value={modo} onChange={e => setModo(e.target.value)}><option value="sombra">En entrenamiento (todo pasa por un consultor)</option><option value="vivo">Autónomo (responde solo)</option></select></label>
        <label>Teléfonos de prueba (reciben el flujo en vivo)<input className="ti-campo" value={tels} onChange={e => setTels(e.target.value)} placeholder="5215512345678, …" /></label>
      </div>
      {modo === 'vivo' && c.agente_modo !== 'vivo' && <div className="sg-msg err">Ojo: en autónomo el agente manda a TODOS los leads sin esperar aprobación, sin importar la paridad.</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button className="ti-btn primario" onClick={guardar}>Guardar</button>{msg && <span className="ti-suave" style={{ margin: 0 }}>{msg}</span>}</div>
    </div>
  );
}

const CSS = `
.sg{max-width:1120px}
.sg-head{margin:0 0 14px}
.sg-fila1{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.sg-num{display:flex;align-items:baseline;gap:4px}.sg-num b{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1}.sg-num span{font-size:13px;color:#8e88a8;font-weight:700}
.sg-barra-wrap{flex:1;min-width:240px}
.sg-barra{position:relative;height:10px;background:#ecebf2;border-radius:999px;overflow:visible}.sg-barra i{display:block;height:100%;background:#5B4BD6;border-radius:999px;transition:width .5s}.sg-barra i.ok{background:#16a34a}
.sg-barra em{position:absolute;top:-4px;width:2px;height:18px;background:#241d43;border-radius:2px;transform:translateX(-1px)}
.sg-sub{font-size:12px;color:#8e88a8;margin-top:6px}.sg-sub b{color:#241d43}
.sg-modo{font-size:12px;font-weight:800;color:#8a5a00;background:#fff4dc;border-radius:999px;padding:6px 10px}.sg-modo.vivo{color:#14532d;background:#e7f7ee}
.sg-fila2{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#6b6580}.sg-fila2 b{color:#241d43}.sg-u{color:#8e88a8}
.sg-pos{margin-left:auto}.sg-link{border:none;background:none;color:#5B4BD6;font-weight:800;cursor:pointer;font-family:inherit;font-size:12px;padding:0}
.sg-msg{margin-top:8px;font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:8px}.sg-msg.ok{background:#e7f7ee;color:#14532d}.sg-msg.err{background:#fde7e5;color:#b3261e}
.sg-card{padding:18px 20px;transition:opacity .35s,transform .35s}.sg-card.saliendo{opacity:0;transform:translateX(24px)}
.sg-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:18px}
.sg-quien{background:#faf9fc;border:1px solid #ecebf2;border-radius:12px;padding:12px 14px;min-width:0}
.sg-lbl{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8e88a8;margin-bottom:6px}
.sg-nombre{font-weight:800;font-size:16px}.sg-nombre span{font-weight:600;color:#6b6580}
.sg-p{margin-top:8px;font-size:13px;line-height:1.45}.sg-p span{color:#8e88a8}
.sg-vacio{text-align:center;padding:40px 20px}
.sg-h{border-top:1px solid #f0eef5;padding:8px 0}.sg-h summary{display:flex;gap:10px;align-items:center;cursor:pointer;font-size:13px;flex-wrap:wrap;list-style:none}
.sg-cal{display:inline-flex;width:28px;height:28px;border-radius:8px;align-items:center;justify-content:center;font-weight:800;font-size:13px;background:#ecebf2;color:#241d43}
.sg-cal.c10,.sg-cal.c9{background:#e7f7ee;color:#14532d}.sg-cal.c8,.sg-cal.c7,.sg-cal.c6{background:#fff4dc;color:#8a5a00}.sg-cal.c0,.sg-cal.c2,.sg-cal.c4{background:#fde7e5;color:#b3261e}
.sg-dec{font-size:11px;font-weight:800;color:#5B4BD6;background:#EEECFE;border-radius:999px;padding:2px 8px}
.sg-h-b{margin:8px 0 4px 38px;display:grid;gap:6px;font-size:13px;line-height:1.45;white-space:pre-wrap}.sg-h-b i{font-style:normal;color:#8e88a8}
.sg-activar{border:none;background:#16a34a;color:#fff;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 8px 20px rgba(22,163,74,.25)}.sg-activar:disabled{opacity:.6}
.sg-velo{position:fixed;inset:0;background:rgba(36,29,67,.35);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}
.sg-modal{background:#fff;border-radius:16px;max-width:720px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 30px 60px rgba(36,29,67,.25)}
.sg-modal-cab{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #ecebf2;font-size:16px}.sg-x{border:none;background:none;font-size:22px;cursor:pointer;color:#8e88a8}
.sg-modal-cuerpo{padding:6px 20px 20px;overflow:auto;font-size:14px;line-height:1.55;color:#241d43}.sg-modal-cuerpo h4{margin:16px 0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5B4BD6}.sg-modal-cuerpo p{margin:0 0 8px}.sg-modal-cuerpo ul{margin:0 0 8px 18px;padding:0}.sg-modal-cuerpo li{margin-bottom:6px}
.sg-aj{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.sg-aj label{display:grid;gap:4px;font-size:12px;font-weight:700;color:#6b6580}
@media (max-width:820px){.sg-grid{grid-template-columns:1fr}.sg-pos{margin-left:0}}
`;
