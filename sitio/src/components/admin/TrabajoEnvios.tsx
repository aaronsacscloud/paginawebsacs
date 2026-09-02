// TRABAJO INTELIGENTE · «Próximos envíos» — lo que el agente SDR va a mandar,
// de UNO EN UNO (como la fila de tareas): apruebas, corriges o detienes, ves
// la confirmación y pasa el siguiente. Aquí vive el veto (N2) y aquí se ve, sin
// adivinar, qué aprende el agente de cada cosa que haces. También el par
// «lo que propuso el agente / lo que contestó el consultor», con tu veredicto.
// Sobrio, sin emoji, estándar enterprise.
import { useEffect, useRef, useState } from 'react';

type Envio = {
  id: string; contact_id: string | null; telefono: string; origen: string; estado: string;
  mensaje: string; mensaje_original?: string | null; salida: any; sale_at: string; enviado_at?: string | null;
  motivo_veto?: string | null; error?: string | null; created_at: string; editado_por?: string | null;
  humano_respuesta?: string | null; humano_at?: string | null; veredicto_par?: string | null;
  contacto?: { nombre?: string | null; giro?: string | null; lifecycle_stage?: string | null } | null;
  imagen_id?: string | null; imagen_url?: string | null;
};
type ImagenGal = { id: string; nombre: string; url: string; descripcion?: string | null; cuando?: string | null; usos?: number };
type Aprendizaje = { ejemplos_dueno: number; ejemplos_7d: number; vetos_7d: number; ediciones_7d: number; ultimos: { estado: string; situacion: string; pulida: string; created_at: string }[] };

const ESTADO_L: Record<string, string> = { nuevo: 'Nuevo', descubriendo: 'Descubriendo', proponiendo: 'Proponiendo', agendada: 'Agendada', confirmando: 'Confirmando', no_show: 'No-show', reunion_hecha: 'Reunión hecha', silencio: 'Silencio', descalificado: 'Descalificado', humano: 'Humano' };
const ORIGEN_L: Record<string, string> = { respuesta: 'Respuesta', silencio: 'Toque de silencio', cita: 'Cita', confirmacion: 'Confirmación' };
const RESULTADO_L: Record<string, string> = { enviado: 'enviado', vetado: 'detenido', sombra: 'habría salido así', humano_respondio: 'el consultor contestó antes', reemplazado: 'el lead volvió a escribir', fallido: 'falló el envío', expirado: 'expiró' };
const MOTIVOS_VETO = ['No era el momento', 'El tono no es el nuestro', 'Información incorrecta', 'Este lead lo llevo yo', 'No era lead', 'Otro'];

function faltan(iso: string, ahora: number) {
  const s = Math.round((Date.parse(iso) - ahora) / 1000);
  if (s <= 0) return 'saliendo…';
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `sale solo en ${m} min ${String(r).padStart(2, '0')} s` : `sale solo en ${r} s`;
}
const hora = (iso?: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '';

/* Los estilos de las tarjetas se comparten con la pestaña Aprendizaje. */
export const ESTILOS_ENVIOS = `
.ti-banner { position:sticky; top:8px; z-index:5; border-radius:12px; padding:14px 18px; margin:0 0 12px; display:flex; flex-direction:column; gap:2px; box-shadow:0 8px 24px rgba(0,0,0,.08); }
.ti-banner.ok { background:var(--verde-agua, #dcfce7); color:var(--verde-tinta, #14532d); } .ti-banner.err { background:#fee2e2; color:#7f1d1d; }
.ti-banner b { font-size:1.05rem; } .ti-banner span { font-size:.86rem; opacity:.9; }
.ti-envio { border:1px solid var(--linea, #e5e7eb); border-radius:12px; padding:14px 16px; margin:12px 0; background:var(--carta, #fff); }
.ti-envio.actual { border-color:var(--morado,#6d28d9); box-shadow:0 0 0 3px var(--morado-agua,#ede9fe); }
.ti-envio.hecho { opacity:.95; } .ti-envio.par { border-color:var(--ambar, #f59e0b); }
.ti-envio-cab { display:flex; flex-wrap:wrap; gap:6px 8px; align-items:center; font-size:.9rem; }
.ti-envio-nombre { font-size:1rem; }
.ti-envio-reloj { margin-left:auto; font-variant-numeric:tabular-nums; font-size:.82rem; font-weight:700; color:var(--morado, #6d28d9); }
.ti-envio-reloj.apagado { color:var(--suave,#6b7280); font-weight:600; }
.ti-envio-lead, .ti-envio-obj, .ti-envio-orig { margin:10px 0 0; font-size:.88rem; line-height:1.45; }
.ti-envio-lead span, .ti-envio-obj span, .ti-envio-orig span, .ti-envio-lbl { display:block; font-size:.68rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--suave,#6b7280); margin-bottom:2px; }
.ti-envio-lbl { margin:12px 0 4px; }
.ti-envio-lead { background:var(--neutro, #f3f4f6); border-radius:10px; padding:8px 12px; }
.ti-envio-obj { color:var(--suave,#6b7280); font-style:italic; }
.ti-envio-acc-tag { font-size:.82rem; color:var(--morado-tinta, #4c1d95); background:var(--morado-agua, #ede9fe); border-radius:8px; padding:7px 10px; margin-top:8px; }
.ti-envio-texto { display:block; width:100%; box-sizing:border-box; border:1px solid var(--linea,#e5e7eb); border-radius:10px; padding:10px 12px; font:inherit; font-size:.95rem; line-height:1.45; background:var(--carta,#fff); color:inherit; resize:vertical; }
.ti-envio-texto.editado { border-color:var(--morado,#6d28d9); box-shadow:0 0 0 3px var(--morado-agua,#ede9fe); }
.ti-envio-input { display:block; width:100%; box-sizing:border-box; border:1px solid var(--linea,#e5e7eb); border-radius:9px; padding:8px 10px; font:inherit; font-size:.88rem; margin-top:6px; }
.ti-envio-acc { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; align-items:center; }
.ti-btn.grande { padding:12px 18px; font-size:.95rem; }
.ti-envio-pista { font-size:.78rem; color:var(--suave,#6b7280); }
.ti-envio-veto { margin-top:10px; padding:10px 12px; border:1px dashed var(--linea,#e5e7eb); border-radius:10px; }
.ti-envio-motivos { display:flex; flex-wrap:wrap; gap:6px; }
.ti-chip-btn { border:1px solid var(--linea,#e5e7eb); background:var(--carta,#fff); border-radius:20px; padding:4px 10px; font:inherit; font-size:.78rem; cursor:pointer; }
.ti-chip-btn.on { background:var(--morado-agua,#ede9fe); border-color:var(--morado,#6d28d9); color:var(--morado-tinta,#4c1d95); font-weight:700; }
.ti-envio-aviso { margin-top:10px; padding:9px 12px; border-radius:9px; font-size:.86rem; font-weight:600; }
.ti-envio-aviso.ok { background:var(--verde-agua, #dcfce7); color:var(--verde-tinta, #14532d); } .ti-envio-aviso.err { background:#fee2e2; color:#7f1d1d; }
.ti-envio-msg { white-space:pre-wrap; font-size:.92rem; margin:6px 0 0; line-height:1.45; }
.ti-envio-msg.humano { background:var(--neutro,#f3f4f6); border-radius:10px; padding:8px 12px; }
.ti-par { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:6px; } @media (max-width:720px) { .ti-par { grid-template-columns:1fr; } }
.ti-envio-datos { font-size:.82rem; margin-top:10px; color:var(--suave,#6b7280); } .ti-envio-datos ul { margin:6px 0 0; padding-left:18px; }
.ti-envio-corr { margin-top:8px; display:grid; gap:8px; }
.ti-link { background:none; border:none; padding:8px 0 0; color:var(--morado, #6d28d9); font-weight:700; font-size:.84rem; cursor:pointer; }
.ti-cola { margin-top:14px; border-top:1px solid var(--linea,#e5e7eb); padding-top:6px; }
.ti-cola-fila { display:grid; grid-template-columns:auto auto 1fr auto; gap:10px; align-items:center; width:100%; text-align:left; border:none; background:none; padding:8px 4px; border-bottom:1px solid var(--linea,#e5e7eb); font:inherit; cursor:pointer; color:inherit; }
.ti-cola-fila:hover { background:var(--neutro,#f3f4f6); }
.ti-cola-msg { font-size:.84rem; color:var(--suave,#6b7280); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.ti-cola-reloj { font-size:.76rem; color:var(--morado,#6d28d9); font-variant-numeric:tabular-nums; white-space:nowrap; }
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
      `;

export default function TrabajoEnvios() {
  const [pend, setPend] = useState<Envio[]>([]);
  const [rec, setRec] = useState<Envio[]>([]);
  const [cfg, setCfg] = useState<{ agente_activo: boolean; veto_min: number; modo?: string; pruebas?: string[] } | null>(null);
  const [apr, setApr] = useState<Aprendizaje | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [corr, setCorr] = useState<Record<string, string>>({});
  const [criterio, setCriterio] = useState<Record<string, string>>({});
  const [galeria, setGaleria] = useState<ImagenGal[]>([]);
  const [picker, setPicker] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  const [veto, setVeto] = useState<{ motivo: string; texto: string } | null>(null);
  const [banner, setBanner] = useState<{ texto: string; sub?: string; tipo: 'ok' | 'err' } | null>(null);
  const [avisoRec, setAvisoRec] = useState<{ id: string; texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [fijo, setFijo] = useState<string | null>(null);   // la tarjeta que estás viendo no se te quita de las manos
  const bannerTimer = useRef<any>(null);

  const cargar = () => fetch('/api/crm/ti/envios').then(r => r.json()).then(j => { if (j.error) { setBanner({ texto: j.error, tipo: 'err' }); return; } setGaleria(j.galeria || []); setPend(j.pendientes || []); setRec(j.recientes || []); setCfg(j.config || null); setApr(j.aprendizaje || null); }).catch(() => setBanner({ texto: 'No se pudieron cargar los envíos', tipo: 'err' }));
  useEffect(() => { cargar(); const a = setInterval(cargar, 15_000); const b = setInterval(() => setAhora(Date.now()), 1000); return () => { clearInterval(a); clearInterval(b); }; }, []);

  const actual = (fijo && pend.find(e => e.id === fijo)) || pend[0] || null;
  useEffect(() => { if (actual && actual.id !== fijo) setFijo(actual.id); }, [actual?.id]);
  const resto = pend.filter(e => e.id !== actual?.id);

  function mostrar(texto: string, sub: string | undefined, tipo: 'ok' | 'err' = 'ok') {
    setBanner({ texto, sub, tipo });
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), tipo === 'ok' ? 6000 : 12000);
  }
  async function post(url: string, body: any): Promise<any | null> {
    setOcupado(true);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok || j.error) { mostrar(j.error || 'No se pudo', undefined, 'err'); return null; }
    return j;
  }
  /** Tras actuar sobre la tarjeta actual: confirmación grande y pasa la siguiente. */
  async function terminar(texto: string, sub?: string) {
    const siguiente = resto[0];
    setFijo(siguiente?.id || null); setVeto(null);
    setEdit(x => { const y = { ...x }; if (actual) delete y[actual.id]; return y; });
    mostrar(texto, siguiente ? `${sub ? sub + ' · ' : ''}Sigue: ${nombre(siguiente)} (${ESTADO_L[siguiente.salida?.estado] || '—'})` : `${sub ? sub + ' · ' : ''}No hay más por salir.`);
    await cargar();
  }
  const nombre = (e: Envio) => (e.contacto?.nombre || e.telefono || 'Lead').split(' ')[0];
  const editado = (e: Envio) => (edit[e.id] ?? e.mensaje) !== e.mensaje;
  const decirRec = (id: string, texto: string, tipo: 'ok' | 'err' = 'ok') => { setAvisoRec({ id, texto, tipo }); setTimeout(() => setAvisoRec(a => (a?.id === id ? null : a)), 8000); };

  const esPrueba = (e: Envio) => (cfg?.pruebas || []).some(t => String(t).replace(/\D/g, '').slice(-10) === String(e.telefono).replace(/\D/g, '').slice(-10));

  return (
    <div className="ti-lienzo">
      {banner && (
        <div className={'ti-banner ' + banner.tipo} role="status">
          <b>{banner.texto}</b>{banner.sub && <span>{banner.sub}</span>}
        </div>
      )}

      <div className="ti-carta">
        <div className="ti-cab">
          <div className="ti-chips">
            <span className={'ti-chip ' + (cfg?.agente_activo ? 'chip-verde' : 'chip-tipo')}>{cfg ? (cfg.agente_activo ? (cfg.modo === 'vivo' ? 'Agente en vivo' : 'Agente en sombra') : 'Agente apagado') : '…'}</span>
            {cfg && <span className="ti-chip chip-tipo">Veto: {cfg.veto_min} min</span>}
            {!!cfg?.pruebas?.length && <span className="ti-chip chip-p2">Pruebas: {cfg.pruebas.length} número{cfg.pruebas.length > 1 ? 's' : ''}</span>}
            <span className="ti-chip chip-tipo">{pend.length ? `Envío 1 de ${pend.length}` : 'Nada por salir'}</span>
          </div>
          <h2 className="ti-h">Próximos envíos del agente</h2>
          <p className="ti-porque"><b>Aprobar</b> lo manda ya y pasa al siguiente. Si lo <b>editas</b>, tu versión sale y queda como ejemplo para ese estado. <b>Detener</b> lo cancela y el motivo también enseña. Si no lo tocas, sale solo al vencer la ventana.</p>
          {cfg?.modo !== 'vivo' && cfg?.agente_activo && <p className="ti-porque ti-sombra-nota">Modo sombra: solo se mandan los envíos a los números de prueba; el resto queda registrado como «habría salido así».</p>}
        </div>

        {!actual && <div className="ti-fin"><h2>Nada por salir</h2><p>{cfg?.agente_activo ? 'Cuando un lead escriba, la respuesta del agente aparece aquí con su cuenta regresiva.' : 'El agente está apagado: no propone ni manda nada.'}</p></div>}

        {actual && (() => { const e = actual; const s = e.salida || {}; const prueba = esPrueba(e); const saldra = cfg?.modo === 'vivo' || prueba; return (
          <div className="ti-envio actual" key={e.id}>
            <div className="ti-envio-cab">
              <b className="ti-envio-nombre">{nombre(e)}</b>
              {e.contacto?.giro && <span className="ti-chip chip-tipo">{e.contacto.giro}</span>}
              <span className="ti-chip chip-p2">{ESTADO_L[s.estado] || s.estado || '—'}</span>
              <span className="ti-chip chip-tipo">{ORIGEN_L[e.origen] || e.origen}</span>
              {s.interes?.nivel && <span className={'ti-chip ' + (s.interes.nivel === 'alto' ? 'chip-verde' : s.interes.nivel === 'bajo' ? 'chip-ambar' : 'chip-tipo')}>interés {s.interes.nivel}</span>}
              {prueba && <span className="ti-chip chip-p2">prueba</span>}
              <span className={'ti-envio-reloj' + (saldra ? '' : ' apagado')}>{saldra ? faltan(e.sale_at, ahora) : 'no saldrá (sombra)'}</span>
            </div>

            {s.ultimo_mensaje && <div className="ti-envio-lead"><span>{nombre(e)} dijo</span>{s.ultimo_mensaje}</div>}
            {s.objetivo && <div className="ti-envio-obj"><span>Qué busca el agente</span>{s.objetivo}</div>}
            {s.accion?.tipo && s.accion.tipo !== 'ninguna' && (
              <div className="ti-envio-acc-tag">Al salir, el agente {s.accion.tipo === 'agendar' ? `agenda la demo: ${s.accion.fecha} ${s.accion.hora}${s.accion.email ? ` (invitación a ${s.accion.email})` : ''}` : s.accion.tipo === 'confirmar_asistencia' ? 'confirma la asistencia a su cita' : 'le manda la liga para reagendar'}.</div>
            )}

            <FilaImagen e={e} s={s} galeria={galeria} abierto={picker === e.id} onAbrir={() => setPicker(picker === e.id ? null : e.id)} ocupado={ocupado}
              onCambiar={async (imagen_id: string | null) => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'imagen', imagen_id }); if (j) { setPend(prev => prev.map(x => x.id === e.id ? { ...x, imagen_id: j.imagen_id, imagen_url: j.imagen_url } : x)); setPicker(null); } }}
              onNueva={async (img: { nombre: string; url: string; descripcion: string; cuando: string }) => { const j = await post('/api/crm/ti/envios', { accion: 'galeria_agregar', ...img }); if (j?.imagen) { setGaleria(g => [j.imagen, ...g]); return j.imagen as ImagenGal; } return null; }} />
            <label className="ti-envio-lbl">{editado(e) ? 'Tu versión — se guardará como ejemplo' : 'El mensaje que va a salir — puedes editarlo'}</label>
            <textarea className={'ti-envio-texto' + (editado(e) ? ' editado' : '')} rows={Math.min(10, Math.max(4, Math.ceil((edit[e.id] ?? e.mensaje).length / 70) + 1))} value={edit[e.id] ?? e.mensaje} onChange={ev => setEdit({ ...edit, [e.id]: ev.target.value })} disabled={ocupado} />

            {editado(e) && (
              <div className="ti-envio-criterio">
                <label className="ti-envio-lbl">Qué debe considerar el agente (opcional): la regla detrás de tu cambio</label>
                <textarea className="ti-envio-texto criterio" rows={2} placeholder="Ej.: si el lead hace varias preguntas seguidas, contéstalas todas en un solo mensaje y cierra con una sola pregunta; no prometas lo que no está en el sistema…" value={criterio[e.id] ?? ''} onChange={ev => setCriterio({ ...criterio, [e.id]: ev.target.value })} />
              </div>
            )}
            {!veto && (
              <div className="ti-envio-acc">
                {editado(e) ? (<>
                  <button className="ti-btn primario grande" disabled={ocupado} onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'editar', mensaje: edit[e.id], criterio: criterio[e.id] || undefined, enviar: true }); if (j) terminar(`Enviado a ${nombre(e)} con tu versión.`, `Guardada como ejemplo de «${ESTADO_L[j.aprendido?.estado] || j.aprendido?.estado}»`); }}>Guardar mi versión y enviar</button>
                  <button className="ti-btn" disabled={ocupado} onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'editar', mensaje: edit[e.id], criterio: criterio[e.id] || undefined }); if (j) { setEdit(x => { const y = { ...x }; delete y[e.id]; return y; }); mostrar(`Guardado como ejemplo de «${ESTADO_L[j.aprendido?.estado] || j.aprendido?.estado}».`, 'Saldrá solo cuando venza la ventana.'); await cargar(); } }}>Guardar y dejar que salga</button>
                  <button className="ti-btn" onClick={() => setEdit(x => { const y = { ...x }; delete y[e.id]; return y; })}>Descartar cambios</button>
                </>) : (<>
                  <button className="ti-btn primario grande" disabled={ocupado} onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'enviar_ya' }); if (j) terminar(`Enviado a ${nombre(e)}.`, 'Aprobado: cuenta a favor del agente'); }}>{ocupado ? 'Enviando…' : 'Aprobar y enviar ya'}</button>
                  <button className="ti-btn peligro" disabled={ocupado} onClick={() => setVeto({ motivo: '', texto: '' })}>Detener…</button>
                  <span className="ti-envio-pista">o no hagas nada: {saldra ? faltan(e.sale_at, ahora) : 'en sombra no sale'}</span>
                </>)}
              </div>
            )}
            {veto && (
              <div className="ti-envio-veto">
                <div className="ti-envio-lbl">¿Por qué lo detienes? El motivo es lo que aprende.</div>
                <div className="ti-envio-motivos">{MOTIVOS_VETO.map(m => <button key={m} className={'ti-chip-btn' + (veto.motivo === m ? ' on' : '')} onClick={() => setVeto({ ...veto, motivo: m })}>{m}</button>)}</div>
                <input className="ti-envio-input" placeholder="Detalle (opcional): qué debió decir o por qué no" value={veto.texto} onChange={ev => setVeto({ ...veto, texto: ev.target.value })} />
                <div className="ti-envio-acc">
                  <button className="ti-btn peligro" disabled={!veto.motivo || ocupado} onClick={async () => { const v = veto; const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'vetar', motivo: [v.motivo, v.texto].filter(Boolean).join(': ') }); if (j) terminar(`Detenido: no se le manda nada a ${nombre(e)}.`, `Motivo registrado («${v.motivo}»)`); }}>Confirmar: detener</button>
                  <button className="ti-btn" onClick={() => setVeto(null)}>Cancelar</button>
                </div>
              </div>
            )}
            {!!(s.datos || []).length && (
              <details className="ti-envio-datos"><summary>{s.datos.length} datos que registró del lead</summary>
                <ul>{s.datos.map((d: any, i: number) => <li key={i}><b>{d.campo}</b>: {d.valor} <span className="ti-suave">({Math.round((d.confianza || 0) * 100)} %)</span></li>)}</ul>
              </details>
            )}
          </div>
        ); })()}

        {!!resto.length && (
          <div className="ti-cola">
            <div className="ti-envio-lbl">En fila ({resto.length})</div>
            {resto.slice(0, 8).map(e => (
              <button key={e.id} className="ti-cola-fila" onClick={() => setFijo(e.id)}>
                <b>{nombre(e)}</b><span className="ti-chip chip-tipo">{ESTADO_L[e.salida?.estado] || '—'}</span><span className="ti-cola-msg">{e.mensaje.slice(0, 90)}</span><span className="ti-cola-reloj">{(cfg?.modo === 'vivo' || esPrueba(e)) ? faltan(e.sale_at, ahora).replace('sale solo ', '') : 'sombra'}</span>
              </button>
            ))}
            {resto.length > 8 && <div className="ti-suave">…y {resto.length - 8} más.</div>}
          </div>
        )}
      </div>

      <div className="ti-carta ti-aprendizaje">
        <Galeria galeria={galeria}
          onQuitar={async (id: string) => { const j = await post('/api/crm/ti/envios', { accion: 'galeria_quitar', imagen_id: id }); if (j) setGaleria(g => g.filter(x => x.id !== id)); }}
          onNueva={async (img: { nombre: string; url: string; descripcion: string; cuando: string }) => { const j = await post('/api/crm/ti/envios', { accion: 'galeria_agregar', ...img }); if (j?.imagen) { setGaleria(g => [j.imagen, ...g]); return j.imagen as ImagenGal; } return null; }} />
        <h3 className="ti-h3">Lo que el agente ha aprendido de ti</h3>
        {apr ? (<>
          <div className="ti-apr-grid">
            <div><b>{apr.ejemplos_dueno}</b><span>ejemplos tuyos activos</span></div>
            <div><b>{apr.ediciones_7d}</b><span>ediciones esta semana</span></div>
            <div><b>{apr.vetos_7d}</b><span>detenidos esta semana</span></div>
            <div><b>{apr.ejemplos_7d}</b><span>lecciones nuevas (7 d)</span></div>
          </div>
          {!!apr.ultimos.length && <ul className="ti-apr-ultimos">{apr.ultimos.map((u, i) => <li key={i}><span className="ti-chip chip-p2">{ESTADO_L[u.estado] || u.estado}</span> <span className="ti-suave">{hora(u.created_at)}</span><div>{u.pulida}</div></li>)}</ul>}
          <p className="ti-suave">Cada ejemplo entra al prompt del agente en su estado desde el siguiente mensaje. Vetos y ediciones mueven la rampa: 2 correcciones en 7 días devuelven la ventana de veto; 30 envíos limpios proponen quitarla.</p>
        </>) : <p className="ti-suave">Cargando…</p>}
      </div>

      {!!rec.length && (
        <div className="ti-carta">
          <h3 className="ti-h3">Lo que ya pasó</h3>
          <p className="ti-suave">Cuando el consultor contestó antes que el agente, el par se muestra lado a lado: dile cuál debe aprender.</p>
          {rec.map(e => {
            const s = e.salida || {};
            const aprendio = !!(e.editado_por || e.motivo_veto || e.veredicto_par);
            const par = !!e.humano_respuesta;
            return (
              <div className={'ti-envio hecho' + (par ? ' par' : '')} key={e.id}>
                <div className="ti-envio-cab">
                  <b className="ti-envio-nombre">{nombre(e)}</b>
                  <span className={'ti-chip ' + (e.estado === 'enviado' ? 'chip-verde' : e.estado === 'vetado' || e.estado === 'humano_respondio' ? 'chip-ambar' : 'chip-tipo')}>{RESULTADO_L[e.estado] || e.estado}</span>
                  <span className="ti-chip chip-tipo">{ESTADO_L[s.estado] || s.estado || '—'}</span>
                  {aprendio && <span className="ti-chip chip-verde">aprendido</span>}
                  <span className="ti-envio-reloj">{hora(e.enviado_at || e.humano_at || e.created_at)}</span>
                </div>
                {s.ultimo_mensaje && <div className="ti-envio-lead"><span>{nombre(e)} dijo</span>{s.ultimo_mensaje}</div>}
                {par ? (
                  <div className="ti-par">
                    <div><span className="ti-envio-lbl">El agente propuso</span><div className="ti-envio-msg">{e.mensaje}</div></div>
                    <div><span className="ti-envio-lbl">El consultor contestó</span><div className="ti-envio-msg humano">{e.humano_respuesta}</div></div>
                  </div>
                ) : (<>
                  <div className="ti-envio-msg">{e.mensaje}</div>
                  {e.mensaje_original && e.mensaje_original !== e.mensaje && <div className="ti-envio-orig"><span>Lo que el agente había escrito</span>{e.mensaje_original}</div>}
                </>)}
                {e.motivo_veto && <div className="ti-envio-orig"><span>Motivo del veto</span>{e.motivo_veto}</div>}
                {e.error && <div className="ti-envio-aviso err">{e.error}</div>}
                {par && !e.veredicto_par && (
                  <div className="ti-envio-acc">
                    <button className="ti-btn primario" onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'par', veredicto: 'humano_mejor' }); if (j) { decirRec(e.id, 'El agente aprende la del consultor como ejemplo de ese estado.'); cargar(); } }}>La del consultor es mejor</button>
                    <button className="ti-btn" onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'par', veredicto: 'agente_mejor' }); if (j) { decirRec(e.id, 'Validada la del agente: queda como ejemplo aprobado.'); cargar(); } }}>La del agente era mejor</button>
                    <button className="ti-btn" onClick={async () => { const j = await post('/api/crm/ti/envios', { id: e.id, accion: 'par', veredicto: 'empate' }); if (j) { decirRec(e.id, 'Registrado como empate.'); cargar(); } }}>Iguales</button>
                  </div>
                )}
                {par && e.veredicto_par && <div className="ti-suave">Tu veredicto: {e.veredicto_par === 'humano_mejor' ? 'la del consultor (el agente la aprendió)' : e.veredicto_par === 'agente_mejor' ? 'la del agente (validada como ejemplo)' : 'iguales'}.</div>}
                <button className="ti-link" onClick={() => setAbierto({ ...abierto, [e.id]: !abierto[e.id] })}>{abierto[e.id] ? 'Cerrar' : 'Esto hubiera contestado yo'}</button>
                {abierto[e.id] && (
                  <div className="ti-envio-corr">
                    <textarea className="ti-envio-texto" rows={3} placeholder="Tu respuesta ideal para este caso…" value={corr[e.id] || ''} onChange={ev => setCorr({ ...corr, [e.id]: ev.target.value })} />
                    <div className="ti-envio-acc">
                      <button className="ti-btn primario" disabled={!(corr[e.id] || '').trim() || ocupado} onClick={async () => { const j = await post('/api/crm/ti/correccion', { envio_id: e.id, respuesta: corr[e.id] }); if (j) { setAbierto({ ...abierto, [e.id]: false }); setCorr({ ...corr, [e.id]: '' }); decirRec(e.id, `Guardado como ejemplo de «${ESTADO_L[s.estado] || s.estado}». El agente lo usa desde el siguiente mensaje de ese estado.`); cargar(); } }}>Guardar como ejemplo</button>
                    </div>
                  </div>
                )}
                {avisoRec?.id === e.id && <div className={'ti-envio-aviso ' + avisoRec.tipo}>{avisoRec.texto}</div>}
              </div>
            );
          })}
        </div>
      )}
      <style>{ESTILOS_ENVIOS}</style>
    </div>
  );
}

/* ═══ Imágenes del agente ═══
 * Hay respuestas que valen más con imagen (la tabla de precios, la matriz talla × color).
 * La galería la llena el dueño con QUÉ muestra cada imagen y CUÁNDO usarla; el agente
 * la ve en su prompt y elige una cuando aporta; aquí el dueño la confirma, la cambia o
 * la quita —y cada ajuste queda como ejemplo. */
const estiloThumb: any = { width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #e8e5f0', background: '#f6f5fa', flexShrink: 0 };

function FormImagen({ onNueva, onListo }: { onNueva: (img: { nombre: string; url: string; descripcion: string; cuando: string }) => Promise<ImagenGal | null>; onListo?: (img: ImagenGal) => void }) {
  const [f, setF] = useState({ nombre: '', descripcion: '', cuando: '', url: '' });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const listo = f.nombre.trim().length >= 2 && (!!archivo || /^https?:\/\//.test(f.url));
  const guardar = async () => {
    if (ocupado || !listo) return;
    setOcupado(true); setError('');
    try {
      let url = f.url.trim();
      if (archivo) {
        const fd = new FormData(); fd.append('file', archivo); fd.append('nombre', f.nombre); fd.append('categoria', 'agente');
        const r = await fetch('/api/crm/whatsapp/media', { method: 'POST', body: fd }).then(x => x.json());
        if (!r?.archivo?.url) throw new Error(r?.error || 'No se pudo subir la imagen');
        url = r.archivo.url;
      }
      const img = await onNueva({ nombre: f.nombre.trim(), url, descripcion: f.descripcion.trim(), cuando: f.cuando.trim() });
      if (!img) throw new Error('No se guardó en la galería');
      setF({ nombre: '', descripcion: '', cuando: '', url: '' }); setArchivo(null);
      onListo?.(img);
    } catch (e: any) { setError(String(e?.message || e)); }
    setOcupado(false);
  };
  return (
    <div style={{ display: 'grid', gap: 6, padding: '10px 12px', border: '1px dashed #d9d4ea', borderRadius: 10, background: '#fbfaff' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b6580' }}>Subir imagen nueva</div>
      <input type="file" accept="image/*" onChange={ev => setArchivo(ev.target.files?.[0] || null)} style={{ fontSize: '0.78rem' }} />
      <input className="ti-envio-input" placeholder="o pega la URL pública de la imagen" value={f.url} onChange={ev => setF({ ...f, url: ev.target.value })} />
      <input className="ti-envio-input" placeholder="Nombre corto (ej. Tabla de precios 2026)" value={f.nombre} onChange={ev => setF({ ...f, nombre: ev.target.value })} />
      <input className="ti-envio-input" placeholder="Qué muestra (para que el agente decida)" value={f.descripcion} onChange={ev => setF({ ...f, descripcion: ev.target.value })} />
      <input className="ti-envio-input" placeholder="Cuándo conviene mandarla (ej. cuando pide precio con 2+ tiendas)" value={f.cuando} onChange={ev => setF({ ...f, cuando: ev.target.value })} />
      {error && <div style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>{error}</div>}
      <div><button className="ti-btn" disabled={ocupado || !listo} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar en la galería'}</button></div>
    </div>
  );
}

function FilaImagen({ e, s, galeria, abierto, onAbrir, onCambiar, onNueva, ocupado }: { e: Envio; s: any; galeria: ImagenGal[]; abierto: boolean; onAbrir: () => void; onCambiar: (id: string | null) => Promise<void>; onNueva: (img: any) => Promise<ImagenGal | null>; ocupado: boolean }) {
  const actual = e.imagen_url ? (galeria.find(g => g.id === e.imagen_id) || { id: e.imagen_id || '', nombre: 'Imagen', url: e.imagen_url }) : null;
  const eligioAgente = !!(s?.imagen?.id && s.imagen.id === e.imagen_id);
  return (
    <div style={{ margin: '8px 0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {actual ? (<>
          <img src={actual.url} alt={actual.nombre} style={estiloThumb} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Sale con imagen: {actual.nombre}</div>
            <div className="ti-suave" style={{ fontSize: '0.74rem' }}>{eligioAgente ? `El agente la eligió${s.imagen?.por_que ? `: ${s.imagen.por_que}` : ''}` : 'La adjuntaste tú'}</div>
          </div>
          <button className="ti-btn" disabled={ocupado} onClick={onAbrir}>Cambiar…</button>
          <button className="ti-btn" disabled={ocupado} onClick={() => onCambiar(null)}>Quitar imagen</button>
        </>) : (<>
          <span className="ti-suave" style={{ fontSize: '0.78rem' }}>Sin imagen.</span>
          <button className="ti-btn" disabled={ocupado} onClick={onAbrir}>Adjuntar imagen…</button>
        </>)}
      </div>
      {abierto && (
        <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
          {galeria.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {galeria.map(g => (
                <button key={g.id} disabled={ocupado} onClick={() => onCambiar(g.id)} title={g.cuando || ''} style={{ textAlign: 'left', border: `1px solid ${g.id === e.imagen_id ? '#5B4BD6' : '#e8e5f0'}`, background: '#fff', borderRadius: 10, padding: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <img src={g.url} alt={g.nombre} style={{ width: '100%', height: 84, objectFit: 'cover', borderRadius: 6, background: '#f6f5fa' }} />
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, marginTop: 5 }}>{g.nombre}</div>
                  {g.descripcion && <div className="ti-suave" style={{ fontSize: '0.7rem', lineHeight: 1.35 }}>{g.descripcion.slice(0, 70)}</div>}
                </button>
              ))}
            </div>
          )}
          <FormImagen onNueva={onNueva} onListo={img => onCambiar(img.id)} />
        </div>
      )}
    </div>
  );
}

function Galeria({ galeria, onQuitar, onNueva }: { galeria: ImagenGal[]; onQuitar: (id: string) => Promise<void>; onNueva: (img: any) => Promise<ImagenGal | null> }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ margin: '18px 0 6px' }}>
      <button onClick={() => setAbierta(a => !a)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 className="ti-h3" style={{ margin: 0 }}>Galería del agente</h3>
        <span className="ti-chip chip-tipo">{galeria.length} {galeria.length === 1 ? 'imagen' : 'imágenes'}</span>
        <span className="ti-suave" style={{ fontSize: '0.75rem' }}>{abierta ? 'ocultar' : 'ver y agregar'}</span>
      </button>
      <p className="ti-porque" style={{ marginTop: 4 }}>Las imágenes que el agente puede mandar solo. Dile qué muestra cada una y cuándo conviene: la tabla de precios cuando pide precio, la pantalla de tallas y colores cuando pregunta por tallas.</p>
      {abierta && (
        <div style={{ display: 'grid', gap: 10 }}>
          {galeria.map(g => (
            <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e8e5f0', borderRadius: 10, padding: 8, background: '#fff' }}>
              <img src={g.url} alt={g.nombre} style={estiloThumb} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{g.nombre} <span className="ti-suave" style={{ fontWeight: 500 }}>· usada {g.usos || 0} {g.usos === 1 ? 'vez' : 'veces'}</span></div>
                {g.descripcion && <div style={{ fontSize: '0.76rem', color: '#4a4658' }}>Muestra: {g.descripcion}</div>}
                {g.cuando && <div className="ti-suave" style={{ fontSize: '0.74rem' }}>Cuándo: {g.cuando}</div>}
              </div>
              <button className="ti-btn" onClick={() => onQuitar(g.id)}>Quitar</button>
            </div>
          ))}
          <FormImagen onNueva={onNueva} />
        </div>
      )}
    </div>
  );
}
