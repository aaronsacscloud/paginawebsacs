// TRABAJO INTELIGENTE · «Próximos envíos» — lo que el agente SDR va a mandar,
// con su cuenta regresiva. Aquí vive el veto (N2): editar, detener o mandar ya;
// y el botón «Esto hubiera contestado yo», que es la lección de máxima
// prioridad del agente. Sobrio, sin emoji, estándar enterprise.
import { useEffect, useState } from 'react';

type Envio = {
  id: string; contact_id: string | null; telefono: string; origen: string; estado: string;
  mensaje: string; mensaje_original?: string | null; salida: any; sale_at: string; enviado_at?: string | null;
  motivo_veto?: string | null; error?: string | null; created_at: string;
  contacto?: { nombre?: string | null; giro?: string | null; lifecycle_stage?: string | null } | null;
};

const ESTADO_L: Record<string, string> = { nuevo: 'Nuevo', descubriendo: 'Descubriendo', proponiendo: 'Proponiendo', agendada: 'Agendada', confirmando: 'Confirmando', no_show: 'No-show', reunion_hecha: 'Reunión hecha', silencio: 'Silencio', descalificado: 'Descalificado', humano: 'Humano' };

function faltan(iso: string, ahora: number) {
  const s = Math.round((Date.parse(iso) - ahora) / 1000);
  if (s <= 0) return 'saliendo…';
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `sale en ${m} min ${String(r).padStart(2, '0')} s` : `sale en ${r} s`;
}

export default function TrabajoEnvios() {
  const [pend, setPend] = useState<Envio[]>([]);
  const [rec, setRec] = useState<Envio[]>([]);
  const [cfg, setCfg] = useState<{ agente_activo: boolean; veto_min: number } | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [corr, setCorr] = useState<Record<string, string>>({});
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  const [ahora, setAhora] = useState(Date.now());
  const [msg, setMsg] = useState('');

  const cargar = () => fetch('/api/crm/ti/envios').then(r => r.json()).then(j => { if (j.error) { setMsg(j.error); return; } setPend(j.pendientes || []); setRec(j.recientes || []); setCfg(j.config || null); }).catch(() => setMsg('No se pudieron cargar los envíos'));
  useEffect(() => { cargar(); const a = setInterval(cargar, 20_000); const b = setInterval(() => setAhora(Date.now()), 1000); return () => { clearInterval(a); clearInterval(b); }; }, []);

  async function post(url: string, body: any) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { setMsg(j.error || 'No se pudo'); return false; }
    setMsg(''); cargar(); return true;
  }
  const nombre = (e: Envio) => (e.contacto?.nombre || e.telefono || 'Lead').split(' ')[0];
  const primerNombre = (e: Envio) => (e.contacto?.nombre || '').split(' ')[0];

  return (
    <div className="ti-lienzo">
      <div className="ti-carta">
        <div className="ti-cab">
          <div className="ti-chips">
            <span className={'ti-chip ' + (cfg?.agente_activo ? 'chip-verde' : 'chip-tipo')}>{cfg ? (cfg.agente_activo ? 'Agente encendido' : 'Agente apagado') : '…'}</span>
            {cfg && <span className="ti-chip chip-tipo">Ventana de veto: {cfg.veto_min} min</span>}
            <span className="ti-chip chip-tipo">{pend.length} por salir</span>
          </div>
          <h2 className="ti-h">Próximos envíos del agente</h2>
          <p className="ti-porque">Cada respuesta del agente espera aquí su ventana. Si no la tocas, sale sola. Editarla, detenerla o escribir la tuya es lo que le enseña.</p>
        </div>
        {msg && <div className="ti-err">{msg}</div>}

        {!pend.length && <div className="ti-fin"><h2>Nada por salir</h2><p>{cfg?.agente_activo ? 'Cuando un lead escriba, la respuesta del agente aparece aquí con su cuenta regresiva.' : 'El agente está apagado: no propone ni manda nada. Se enciende con node scripts/ti-agente.mjs --on.'}</p></div>}

        {pend.map(e => (
          <div className="ti-envio" key={e.id}>
            <div className="ti-envio-cab">
              <b>{nombre(e)}</b>
              {e.contacto?.giro && <span className="ti-chip chip-tipo">{e.contacto.giro}</span>}
              <span className="ti-chip chip-p2">{ESTADO_L[e.salida?.estado] || e.salida?.estado || '—'}</span>
              {e.salida?.interes?.nivel && <span className={'ti-chip ' + (e.salida.interes.nivel === 'alto' ? 'chip-verde' : e.salida.interes.nivel === 'bajo' ? 'chip-ambar' : 'chip-tipo')}>interés {e.salida.interes.nivel}</span>}
              <span className="ti-envio-reloj">{faltan(e.sale_at, ahora)}</span>
            </div>
            {e.salida?.ultimo_mensaje && <div className="ti-envio-lead"><span>{primerNombre(e) || 'Lead'} dijo:</span> {e.salida.ultimo_mensaje}</div>}
            {e.salida?.objetivo && <div className="ti-envio-obj">{e.salida.objetivo}</div>}
            {e.salida?.accion?.tipo && e.salida.accion.tipo !== 'ninguna' && (
              <div className="ti-envio-acc-tag">Al salir, el agente {e.salida.accion.tipo === 'agendar' ? `agenda la demo: ${e.salida.accion.fecha} ${e.salida.accion.hora}${e.salida.accion.email ? ` (invitación a ${e.salida.accion.email})` : ''}` : e.salida.accion.tipo === 'confirmar_asistencia' ? 'confirma la asistencia a su cita' : 'le manda la liga para reagendar'}.</div>
            )}
            <textarea className="ti-texto" rows={4} value={edit[e.id] ?? e.mensaje} onChange={ev => setEdit({ ...edit, [e.id]: ev.target.value })} />
            <div className="ti-envio-acc">
              {(edit[e.id] ?? e.mensaje) !== e.mensaje && <button className="ti-btn primario" onClick={() => post('/api/crm/ti/envios', { id: e.id, accion: 'editar', mensaje: edit[e.id] })}>Guardar mi versión</button>}
              <button className="ti-btn" onClick={() => post('/api/crm/ti/envios', { id: e.id, accion: 'enviar_ya' })}>Enviar ya</button>
              <button className="ti-btn peligro" onClick={() => { const m = prompt('¿Por qué lo detienes? (opcional: es lo que aprende)') || ''; post('/api/crm/ti/envios', { id: e.id, accion: 'vetar', motivo: m }); }}>Detener</button>
            </div>
            {!!(e.salida?.datos || []).length && (
              <details className="ti-envio-datos"><summary>{e.salida.datos.length} datos que registró</summary>
                <ul>{e.salida.datos.map((d: any, i: number) => <li key={i}><b>{d.campo}</b>: {d.valor} <span className="ti-suave">({Math.round((d.confianza || 0) * 100)}%)</span></li>)}</ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {!!rec.length && (
        <div className="ti-carta">
          <h3 className="ti-h3">Lo que ya pasó</h3>
          {rec.map(e => (
            <div className="ti-envio hecho" key={e.id}>
              <div className="ti-envio-cab">
                <b>{nombre(e)}</b>
                <span className={'ti-chip ' + (e.estado === 'enviado' ? 'chip-verde' : e.estado === 'vetado' ? 'chip-ambar' : 'chip-tipo')}>{e.estado}</span>
                <span className="ti-chip chip-tipo">{ESTADO_L[e.salida?.estado] || e.salida?.estado || '—'}</span>
                <span className="ti-envio-reloj">{new Date(e.enviado_at || e.created_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
              </div>
              {e.salida?.ultimo_mensaje && <div className="ti-envio-lead"><span>{primerNombre(e) || 'Lead'} dijo:</span> {e.salida.ultimo_mensaje}</div>}
              <div className="ti-envio-msg">{e.mensaje}</div>
              {e.mensaje_original && e.mensaje_original !== e.mensaje && <div className="ti-suave">Original del agente: {e.mensaje_original}</div>}
              {e.motivo_veto && <div className="ti-suave">Motivo: {e.motivo_veto}</div>}
              {e.error && <div className="ti-err">{e.error}</div>}
              <button className="ti-link" onClick={() => setAbierto({ ...abierto, [e.id]: !abierto[e.id] })}>Esto hubiera contestado yo</button>
              {abierto[e.id] && (
                <div className="ti-envio-corr">
                  <textarea className="ti-texto" rows={3} placeholder="Tu respuesta ideal para este caso…" value={corr[e.id] || ''} onChange={ev => setCorr({ ...corr, [e.id]: ev.target.value })} />
                  <button className="ti-btn primario" onClick={async () => { if (await post('/api/crm/ti/correccion', { envio_id: e.id, respuesta: corr[e.id] })) { setAbierto({ ...abierto, [e.id]: false }); setCorr({ ...corr, [e.id]: '' }); } }}>Guardar como ejemplo</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`
.ti-envio { border:1px solid var(--linea, #e5e7eb); border-radius:12px; padding:12px 14px; margin:10px 0; }
.ti-envio.hecho { opacity:.92; }
.ti-envio-cab { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center; font-size:.9rem; }
.ti-envio-reloj { margin-left:auto; font-variant-numeric:tabular-nums; font-size:.8rem; color:var(--suave, #6b7280); }
.ti-envio-lead { margin:8px 0 4px; font-size:.86rem; color:var(--tinta, #111827); } .ti-envio-lead span { color:var(--suave,#6b7280); }
.ti-envio-acc-tag { font-size:.8rem; color:var(--morado-tinta, #4c1d95); background:var(--morado-agua, #ede9fe); border-radius:8px; padding:6px 10px; margin-bottom:6px; }
.ti-envio-obj { font-size:.8rem; color:var(--suave,#6b7280); font-style:italic; margin-bottom:6px; }
.ti-envio-msg { white-space:pre-wrap; font-size:.92rem; margin:6px 0; }
.ti-envio-acc { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.ti-envio-datos { font-size:.8rem; margin-top:8px; color:var(--suave,#6b7280); } .ti-envio-datos ul { margin:6px 0 0; padding-left:18px; }
.ti-envio-corr { margin-top:8px; display:grid; gap:8px; }
.ti-link { background:none; border:none; padding:6px 0 0; color:var(--morado, #6d28d9); font-weight:700; font-size:.82rem; cursor:pointer; }
.ti-h3 { font-size:1rem; margin:0 0 6px; }
.ti-suave { font-size:.8rem; color:var(--suave,#6b7280); margin-top:4px; }
      `}</style>
    </div>
  );
}
