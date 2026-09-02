// TRABAJO INTELIGENTE · «Próximos envíos» — lo que el agente SDR va a mandar,
// con su cuenta regresiva. Aquí vive el veto (N2) y aquí se ve, sin adivinar,
// qué aprende el agente de cada cosa que haces: aprobar, corregir, detener o
// escribir tu versión. Sobrio, sin emoji, estándar enterprise.
import { useEffect, useState } from 'react';

type Envio = {
  id: string; contact_id: string | null; telefono: string; origen: string; estado: string;
  mensaje: string; mensaje_original?: string | null; salida: any; sale_at: string; enviado_at?: string | null;
  motivo_veto?: string | null; error?: string | null; created_at: string; editado_por?: string | null;
  contacto?: { nombre?: string | null; giro?: string | null; lifecycle_stage?: string | null } | null;
};
type Aprendizaje = { ejemplos_dueno: number; ejemplos_7d: number; vetos_7d: number; ediciones_7d: number; ultimos: { estado: string; situacion: string; pulida: string; created_at: string }[] };

const ESTADO_L: Record<string, string> = { nuevo: 'Nuevo', descubriendo: 'Descubriendo', proponiendo: 'Proponiendo', agendada: 'Agendada', confirmando: 'Confirmando', no_show: 'No-show', reunion_hecha: 'Reunión hecha', silencio: 'Silencio', descalificado: 'Descalificado', humano: 'Humano' };
const ORIGEN_L: Record<string, string> = { respuesta: 'Respuesta', silencio: 'Toque de silencio', cita: 'Cita', confirmacion: 'Confirmación' };
const MOTIVOS_VETO = ['No era el momento', 'El tono no es el nuestro', 'Información incorrecta', 'Este lead lo llevo yo', 'No era lead', 'Otro'];

function faltan(iso: string, ahora: number) {
  const s = Math.round((Date.parse(iso) - ahora) / 1000);
  if (s <= 0) return 'saliendo…';
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `sale en ${m} min ${String(r).padStart(2, '0')} s` : `sale en ${r} s`;
}
const hora = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '';

export default function TrabajoEnvios() {
  const [pend, setPend] = useState<Envio[]>([]);
  const [rec, setRec] = useState<Envio[]>([]);
  const [cfg, setCfg] = useState<{ agente_activo: boolean; veto_min: number; modo?: string; pruebas?: string[] } | null>(null);
  const [apr, setApr] = useState<Aprendizaje | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [corr, setCorr] = useState<Record<string, string>>({});
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  const [veto, setVeto] = useState<Record<string, { motivo: string; texto: string } | null>>({});
  const [aviso, setAviso] = useState<{ id: string; texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = () => fetch('/api/crm/ti/envios').then(r => r.json()).then(j => { if (j.error) { setAviso({ id: 'global', texto: j.error, tipo: 'err' }); return; } setPend(j.pendientes || []); setRec(j.recientes || []); setCfg(j.config || null); setApr(j.aprendizaje || null); }).catch(() => setAviso({ id: 'global', texto: 'No se pudieron cargar los envíos', tipo: 'err' }));
  useEffect(() => { cargar(); const a = setInterval(cargar, 20_000); const b = setInterval(() => setAhora(Date.now()), 1000); return () => { clearInterval(a); clearInterval(b); }; }, []);

  async function post(url: string, body: any, id: string): Promise<any | null> {
    setOcupado(id);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setOcupado(null);
    if (!r.ok || j.error) { setAviso({ id, texto: j.error || 'No se pudo', tipo: 'err' }); return null; }
    cargar(); return j;
  }
  const decir = (id: string, texto: string) => { setAviso({ id, texto, tipo: 'ok' }); setTimeout(() => setAviso(a => (a?.id === id ? null : a)), 9000); };
  const nombre = (e: Envio) => (e.contacto?.nombre || e.telefono || 'Lead').split(' ')[0];
  const editado = (e: Envio) => (edit[e.id] ?? e.mensaje) !== e.mensaje;

  const Aviso = ({ id }: { id: string }) => aviso && aviso.id === id ? <div className={'ti-envio-aviso ' + aviso.tipo}>{aviso.texto}</div> : null;

  return (
    <div className="ti-lienzo">
      <div className="ti-carta">
        <div className="ti-cab">
          <div className="ti-chips">
            <span className={'ti-chip ' + (cfg?.agente_activo ? 'chip-verde' : 'chip-tipo')}>{cfg ? (cfg.agente_activo ? (cfg.modo === 'vivo' ? 'Agente en vivo' : 'Agente en sombra') : 'Agente apagado') : '…'}</span>
            {cfg && <span className="ti-chip chip-tipo">Veto: {cfg.veto_min} min</span>}
            {!!cfg?.pruebas?.length && <span className="ti-chip chip-p2">Pruebas: {cfg.pruebas.length} número{cfg.pruebas.length > 1 ? 's' : ''}</span>}
            <span className="ti-chip chip-tipo">{pend.length} por salir</span>
          </div>
          <h2 className="ti-h">Próximos envíos del agente</h2>
          <p className="ti-porque">Cada respuesta espera aquí su ventana. <b>Aprobar</b> la manda ya. Si la <b>editas</b>, tu versión sale y queda guardada como ejemplo para los próximos mensajes de ese estado. <b>Detener</b> la cancela y el motivo también enseña. Si no la tocas, sale sola.</p>
          {cfg?.modo !== 'vivo' && cfg?.agente_activo && <p className="ti-porque ti-sombra-nota">Modo sombra: solo se mandan los envíos a los números de prueba; el resto queda registrado como «habría salido así».</p>}
        </div>
        <Aviso id="global" />

        {!pend.length && <div className="ti-fin"><h2>Nada por salir</h2><p>{cfg?.agente_activo ? 'Cuando un lead escriba, la respuesta del agente aparece aquí con su cuenta regresiva.' : 'El agente está apagado: no propone ni manda nada.'}</p></div>}

        {pend.map(e => {
          const s = e.salida || {};
          const esPrueba = (cfg?.pruebas || []).some(t => String(t).replace(/\D/g, '').slice(-10) === String(e.telefono).replace(/\D/g, '').slice(-10));
          const saldra = cfg?.modo === 'vivo' || esPrueba;
          return (
            <div className="ti-envio" key={e.id}>
              <div className="ti-envio-cab">
                <b className="ti-envio-nombre">{nombre(e)}</b>
                {e.contacto?.giro && <span className="ti-chip chip-tipo">{e.contacto.giro}</span>}
                <span className="ti-chip chip-p2">{ESTADO_L[s.estado] || s.estado || '—'}</span>
                <span className="ti-chip chip-tipo">{ORIGEN_L[e.origen] || e.origen}</span>
                {s.interes?.nivel && <span className={'ti-chip ' + (s.interes.nivel === 'alto' ? 'chip-verde' : s.interes.nivel === 'bajo' ? 'chip-ambar' : 'chip-tipo')}>interés {s.interes.nivel}</span>}
                {esPrueba && <span className="ti-chip chip-p2">prueba</span>}
                <span className={'ti-envio-reloj' + (saldra ? '' : ' apagado')}>{saldra ? faltan(e.sale_at, ahora) : 'no saldrá (sombra)'}</span>
              </div>

              {s.ultimo_mensaje && <div className="ti-envio-lead"><span>{nombre(e)} dijo</span>{s.ultimo_mensaje}</div>}
              {s.objetivo && <div className="ti-envio-obj"><span>Qué busca el agente</span>{s.objetivo}</div>}
              {s.accion?.tipo && s.accion.tipo !== 'ninguna' && (
                <div className="ti-envio-acc-tag">Al salir, el agente {s.accion.tipo === 'agendar' ? `agenda la demo: ${s.accion.fecha} ${s.accion.hora}${s.accion.email ? ` (invitación a ${s.accion.email})` : ''}` : s.accion.tipo === 'confirmar_asistencia' ? 'confirma la asistencia a su cita' : 'le manda la liga para reagendar'}.</div>
              )}

              <label className="ti-envio-lbl">{editado(e) ? 'Tu versión (se guardará como ejemplo)' : 'El mensaje que va a salir — puedes editarlo'}</label>
              <textarea className={'ti-envio-texto' + (editado(e) ? ' editado' : '')} rows={Math.min(10, Math.max(4, Math.ceil((edit[e.id] ?? e.mensaje).length / 70) + 1))} value={edit[e.id] ?? e.mensaje} onChange={ev => setEdit({ ...edit, [e.id]: ev.target.value })} />

              <div className="ti-envio-acc">
                {editado(e) ? (<>
                  <button className="ti-btn primario" disabled={ocupado === e.id} onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'editar', mensaje: edit[e.id], enviar: true }, e.id); if (j) decir(e.id, `Enviado tu texto. Guardado como ejemplo del estado «${ESTADO_L[j.aprendido?.estado] || j.aprendido?.estado}»: el agente lo usa desde el siguiente mensaje.`); }}>Guardar mi versión y enviar</button>
                  <button className="ti-btn" disabled={ocupado === e.id} onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'editar', mensaje: edit[e.id] }, e.id); if (j) { setEdit(x => { const y = { ...x }; delete y[e.id]; return y; }); decir(e.id, `Guardado como ejemplo de «${ESTADO_L[j.aprendido?.estado] || j.aprendido?.estado}». Saldrá cuando venza la ventana.`); } }}>Guardar y dejar que salga</button>
                  <button className="ti-btn" onClick={() => setEdit(x => { const y = { ...x }; delete y[e.id]; return y; })}>Descartar cambios</button>
                </>) : (<>
                  <button className="ti-btn primario" disabled={ocupado === e.id} onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'enviar_ya' }, e.id); if (j) decir(e.id, 'Aprobado y enviado. Cuenta a favor del agente en la rampa.'); }}>Aprobar y enviar ya</button>
                  <button className="ti-btn peligro" onClick={() => setVeto({ ...veto, [e.id]: veto[e.id] ? null : { motivo: '', texto: '' } })}>Detener…</button>
                </>)}
              </div>
              {veto[e.id] && (
                <div className="ti-envio-veto">
                  <div className="ti-envio-lbl">¿Por qué lo detienes? El motivo es lo que aprende.</div>
                  <div className="ti-envio-motivos">{MOTIVOS_VETO.map(m => <button key={m} className={'ti-chip-btn' + (veto[e.id]?.motivo === m ? ' on' : '')} onClick={() => setVeto({ ...veto, [e.id]: { ...(veto[e.id] as any), motivo: m } })}>{m}</button>)}</div>
                  <input className="ti-envio-input" placeholder="Detalle (opcional): qué debió decir o por qué no" value={veto[e.id]?.texto || ''} onChange={ev => setVeto({ ...veto, [e.id]: { ...(veto[e.id] as any), texto: ev.target.value } })} />
                  <div className="ti-envio-acc">
                    <button className="ti-btn peligro" disabled={!veto[e.id]?.motivo || ocupado === e.id} onClick={async () => { const v = veto[e.id]!; const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'vetar', motivo: [v.motivo, v.texto].filter(Boolean).join(': ') }, e.id); if (j) { setVeto({ ...veto, [e.id]: null }); decir(e.id, `Detenido. Motivo registrado («${v.motivo}»): cuenta en la rampa y entra al ciclo nocturno.`); } }}>Confirmar: detener</button>
                    <button className="ti-btn" onClick={() => setVeto({ ...veto, [e.id]: null })}>Cancelar</button>
                  </div>
                </div>
              )}
              <Aviso id={e.id} />
              {!!(s.datos || []).length && (
                <details className="ti-envio-datos"><summary>{s.datos.length} datos que registró del lead</summary>
                  <ul>{s.datos.map((d: any, i: number) => <li key={i}><b>{d.campo}</b>: {d.valor} <span className="ti-suave">({Math.round((d.confianza || 0) * 100)} %)</span></li>)}</ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="ti-carta ti-aprendizaje">
        <h3 className="ti-h3">Lo que el agente ha aprendido de ti</h3>
        {apr ? (<>
          <div className="ti-apr-grid">
            <div><b>{apr.ejemplos_dueno}</b><span>ejemplos tuyos activos</span></div>
            <div><b>{apr.ediciones_7d}</b><span>ediciones esta semana</span></div>
            <div><b>{apr.vetos_7d}</b><span>detenidos esta semana</span></div>
            <div><b>{apr.ejemplos_7d}</b><span>lecciones nuevas (7 d)</span></div>
          </div>
          {!!apr.ultimos.length && <ul className="ti-apr-ultimos">{apr.ultimos.map((u, i) => <li key={i}><span className="ti-chip chip-p2">{ESTADO_L[u.estado] || u.estado}</span> <span className="ti-suave">{hora(u.created_at)}</span><div>{u.pulida}</div></li>)}</ul>}
          <p className="ti-suave">Cada ejemplo entra al prompt del agente en su estado desde el siguiente mensaje. Los vetos y ediciones también mueven la rampa: con 2 correcciones en 7 días vuelve la ventana de veto; con 30 envíos limpios se propone quitarla.</p>
        </>) : <p className="ti-suave">Cargando…</p>}
      </div>

      {!!rec.length && (
        <div className="ti-carta">
          <h3 className="ti-h3">Lo que ya pasó</h3>
          {rec.map(e => {
            const s = e.salida || {};
            const aprendio = !!(e.editado_por || e.motivo_veto);
            return (
              <div className="ti-envio hecho" key={e.id}>
                <div className="ti-envio-cab">
                  <b className="ti-envio-nombre">{nombre(e)}</b>
                  <span className={'ti-chip ' + (e.estado === 'enviado' ? 'chip-verde' : e.estado === 'vetado' ? 'chip-ambar' : 'chip-tipo')}>{e.estado === 'sombra' ? 'habría salido así' : e.estado}</span>
                  <span className="ti-chip chip-tipo">{ESTADO_L[s.estado] || s.estado || '—'}</span>
                  {aprendio && <span className="ti-chip chip-verde">aprendido</span>}
                  <span className="ti-envio-reloj">{hora(e.enviado_at || e.created_at)}</span>
                </div>
                {s.ultimo_mensaje && <div className="ti-envio-lead"><span>{nombre(e)} dijo</span>{s.ultimo_mensaje}</div>}
                <div className="ti-envio-msg">{e.mensaje}</div>
                {e.mensaje_original && e.mensaje_original !== e.mensaje && <div className="ti-envio-orig"><span>Lo que el agente había escrito</span>{e.mensaje_original}</div>}
                {e.motivo_veto && <div className="ti-envio-orig"><span>Motivo del veto</span>{e.motivo_veto}</div>}
                {e.error && <div className="ti-envio-aviso err">{e.error}</div>}
                <button className="ti-link" onClick={() => setAbierto({ ...abierto, [e.id]: !abierto[e.id] })}>{abierto[e.id] ? 'Cerrar' : 'Esto hubiera contestado yo'}</button>
                {abierto[e.id] && (
                  <div className="ti-envio-corr">
                    <textarea className="ti-envio-texto" rows={3} placeholder="Tu respuesta ideal para este caso…" value={corr[e.id] || ''} onChange={ev => setCorr({ ...corr, [e.id]: ev.target.value })} />
                    <div className="ti-envio-acc">
                      <button className="ti-btn primario" disabled={!(corr[e.id] || '').trim() || ocupado === e.id} onClick={async () => { const j = await post('/api/crm/ti/correccion', { envio_id: e.id, respuesta: corr[e.id] }, e.id); if (j) { setAbierto({ ...abierto, [e.id]: false }); setCorr({ ...corr, [e.id]: '' }); decir(e.id, `Guardado como ejemplo de «${ESTADO_L[s.estado] || s.estado}». El agente lo usa desde el siguiente mensaje de ese estado.`); } }}>Guardar como ejemplo</button>
                    </div>
                  </div>
                )}
                <Aviso id={e.id} />
              </div>
            );
          })}
        </div>
      )}
      <style>{`
.ti-envio { border:1px solid var(--linea, #e5e7eb); border-radius:12px; padding:14px 16px; margin:12px 0; background:var(--carta, #fff); }
.ti-envio.hecho { opacity:.95; }
.ti-envio-cab { display:flex; flex-wrap:wrap; gap:6px 8px; align-items:center; font-size:.9rem; }
.ti-envio-nombre { font-size:1rem; }
.ti-envio-reloj { margin-left:auto; font-variant-numeric:tabular-nums; font-size:.82rem; font-weight:700; color:var(--morado, #6d28d9); }
.ti-envio-reloj.apagado { color:var(--suave,#6b7280); font-weight:600; }
.ti-envio-lead, .ti-envio-obj, .ti-envio-orig { margin:10px 0 0; font-size:.88rem; line-height:1.45; }
.ti-envio-lead span, .ti-envio-obj span, .ti-envio-orig span { display:block; font-size:.68rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--suave,#6b7280); margin-bottom:2px; }
.ti-envio-lead { background:var(--neutro, #f3f4f6); border-radius:10px; padding:8px 12px; }
.ti-envio-obj { color:var(--suave,#6b7280); font-style:italic; }
.ti-envio-acc-tag { font-size:.82rem; color:var(--morado-tinta, #4c1d95); background:var(--morado-agua, #ede9fe); border-radius:8px; padding:7px 10px; margin-top:8px; }
.ti-envio-lbl { display:block; font-size:.68rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--suave,#6b7280); margin:12px 0 4px; }
.ti-envio-texto { display:block; width:100%; box-sizing:border-box; border:1px solid var(--linea,#e5e7eb); border-radius:10px; padding:10px 12px; font:inherit; font-size:.95rem; line-height:1.45; background:var(--carta,#fff); color:inherit; resize:vertical; }
.ti-envio-texto.editado { border-color:var(--morado,#6d28d9); box-shadow:0 0 0 3px var(--morado-agua,#ede9fe); }
.ti-envio-input { display:block; width:100%; box-sizing:border-box; border:1px solid var(--linea,#e5e7eb); border-radius:9px; padding:8px 10px; font:inherit; font-size:.88rem; margin-top:6px; }
.ti-envio-acc { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.ti-envio-veto { margin-top:10px; padding:10px 12px; border:1px dashed var(--linea,#e5e7eb); border-radius:10px; }
.ti-envio-motivos { display:flex; flex-wrap:wrap; gap:6px; }
.ti-chip-btn { border:1px solid var(--linea,#e5e7eb); background:var(--carta,#fff); border-radius:20px; padding:4px 10px; font:inherit; font-size:.78rem; cursor:pointer; }
.ti-chip-btn.on { background:var(--morado-agua,#ede9fe); border-color:var(--morado,#6d28d9); color:var(--morado-tinta,#4c1d95); font-weight:700; }
.ti-envio-aviso { margin-top:10px; padding:9px 12px; border-radius:9px; font-size:.86rem; font-weight:600; }
.ti-envio-aviso.ok { background:var(--verde-agua, #dcfce7); color:var(--verde-tinta, #14532d); }
.ti-envio-aviso.err { background:#fee2e2; color:#7f1d1d; }
.ti-envio-msg { white-space:pre-wrap; font-size:.92rem; margin:8px 0 0; line-height:1.45; }
.ti-envio-datos { font-size:.82rem; margin-top:10px; color:var(--suave,#6b7280); } .ti-envio-datos ul { margin:6px 0 0; padding-left:18px; }
.ti-envio-corr { margin-top:8px; display:grid; gap:8px; }
.ti-link { background:none; border:none; padding:8px 0 0; color:var(--morado, #6d28d9); font-weight:700; font-size:.84rem; cursor:pointer; }
.ti-h3 { font-size:1rem; margin:0 0 8px; }
.ti-suave { font-size:.8rem; color:var(--suave,#6b7280); margin-top:6px; }
.ti-sombra-nota { color:var(--suave,#6b7280); font-size:.82rem; }
.ti-aprendizaje { margin-top:12px; }
.ti-apr-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin:8px 0; }
.ti-apr-grid div { background:var(--neutro,#f3f4f6); border-radius:10px; padding:10px 12px; }
.ti-apr-grid b { display:block; font-size:1.4rem; line-height:1.1; font-variant-numeric:tabular-nums; }
.ti-apr-grid span { font-size:.74rem; color:var(--suave,#6b7280); }
.ti-apr-ultimos { list-style:none; padding:0; margin:8px 0 0; display:grid; gap:8px; }
.ti-apr-ultimos li { font-size:.86rem; border-left:3px solid var(--morado,#6d28d9); padding:2px 0 2px 10px; } .ti-apr-ultimos li div { margin-top:3px; white-space:pre-wrap; }
      `}</style>
    </div>
  );
}
