import { useEffect, useState } from 'react';
import { ESTILOS_ENVIOS } from './TrabajoEnvios';

/* ═══ Revisión diaria ═══ Cada mañana, por conversación con actividad ayer: qué pasó, qué funcionó y UNA
   propuesta concreta con fundamento. Aceptar la ejecuta (mensaje programado, tarea, ángulo, descalificar);
   rechazar enseña. Rampa: 20 aceptadas seguidas sin cambios → las de bajo riesgo salen solas. */
const TIPO_L: Record<string, string> = { mensaje_extra: 'Mensaje extra', plantilla: 'Plantilla', llamada: 'Llamada', adjunto: 'Adjunto', cambiar_angulo: 'Cambiar ángulo', descalificar: 'Descalificar', ninguna: 'Nada que hacer' };
const AVANCE: Record<string, { l: string; c: string }> = { avanzo: { l: 'Avanzó', c: '#14532d' }, igual: { l: 'Igual', c: '#6b6580' }, retrocedio: { l: 'Retrocedió', c: '#b93333' } };
const postJ = (body: any) => fetch('/api/crm/ti/revision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(e => ({ error: String(e) }));

export default function TrabajoRevision() {
  const [d, setD] = useState<any>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const cargar = () => fetch('/api/crm/ti/revision?dias=3').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const filas: any[] = d.filas || [];
  const pendientes = filas.filter(f => f.estado === 'propuesta');
  const lista = verTodo ? filas : pendientes;
  const rampa = d.rampa || {};
  const decidir = async (f: any, accion: 'aceptar' | 'rechazar') => {
    setOcupado(true);
    const r = await postJ({ accion, id: f.id, texto: textos[f.id], motivo: accion === 'rechazar' ? (prompt('¿Por qué no? (es lo que aprende)') || '') : undefined });
    setOcupado(false); setMsg(r.error ? 'No se pudo: ' + r.error : (r.hecho || 'Listo.')); cargar();
  };
  return (
    <div className="ti-envios" style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{ESTILOS_ENVIOS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div><h2 className="ti-h" style={{ margin: 0 }}>Revisión diaria</h2><p className="ti-porque" style={{ margin: '4px 0 0' }}>A las 8:00 el sistema lee cada conversación de ayer y propone una acción para que el prospecto pregunte más y llegue a la demo. Aceptar la ejecuta; rechazar enseña.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ti-chip chip-tipo">Rampa {Math.min(20, Number(rampa.aceptadas) || 0)}/20 · {rampa.automatico ? 'bajo riesgo automático' : 'con tu clic'}</span>
          <button className="ti-btn" onClick={async () => { await postJ({ accion: 'rampa', automatico: !rampa.automatico }); cargar(); }}>{rampa.automatico ? 'Volver al clic' : 'Automático ya'}</button>
          <button className="ti-btn" disabled={ocupado} onClick={async () => { setOcupado(true); const r = await postJ({ accion: 'correr', horas: 26 }); setOcupado(false); setMsg(r.error ? 'No se pudo: ' + r.error : `Revisadas ${r.revisadas} · propuestas ${r.propuestas}`); cargar(); }}>{ocupado ? 'Revisando…' : 'Revisar ahora'}</button>
          <button className="ti-chip-btn" onClick={() => setVerTodo(v => !v)}>{verTodo ? 'Solo pendientes' : `Ver todo (${filas.length})`}</button>
        </div>
      </div>
      {msg && <div className={'ti-envio-aviso ' + (msg.startsWith('No') ? 'err' : 'ok')} style={{ marginBottom: 10 }}>{msg}</div>}
      {lista.length === 0 && <div className="ti-fin"><h2>{pendientes.length ? '' : 'Sin propuestas pendientes'}</h2><p>La próxima revisión corre a las 8:00. También puedes correrla ahora.</p></div>}
      {lista.map(f => {
        const p = f.propuesta || {}; const av = AVANCE[f.avance] || AVANCE.igual;
        return (
          <div key={f.id} className="ti-envio">
            <div className="ti-envio-cab"><b className="ti-envio-nombre">{f.contacto?.nombre || 'Lead'}</b>{f.contacto?.giro && <span className="ti-chip chip-tipo">{f.contacto.giro}</span>}<span className="ti-chip" style={{ color: av.c, borderColor: av.c }}>{av.l}{f.etapa_antes && f.etapa_despues && f.etapa_antes !== f.etapa_despues ? ` · ${f.etapa_antes} → ${f.etapa_despues}` : ''}</span><span className="ti-chip chip-p2">{TIPO_L[p.tipo] || p.tipo}</span>{p.riesgo && <span className="ti-chip chip-tipo">riesgo {p.riesgo}</span>}<span className="ti-suave" style={{ margin: '0 0 0 auto', fontSize: '.72rem' }}>{f.dia} · {f.estado}</span></div>
            <div className="ti-envio-obj"><span>Qué pasó</span>{f.resumen}</div>
            {f.que_funciono && <div className="ti-envio-obj"><span>Qué funcionó</span>{f.que_funciono}</div>}
            {Array.isArray(f.preguntas_abiertas) && f.preguntas_abiertas.length > 0 && <div className="ti-envio-obj"><span>Preguntas abiertas</span>{f.preguntas_abiertas.join(' · ')}</div>}
            <div className="ti-envio-obj"><span>Por qué esta acción</span>{p.fundamento}</div>
            {(p.tipo === 'mensaje_extra' || p.tipo === 'adjunto' || p.tipo === 'plantilla') && f.estado === 'propuesta' && (<>
              <label className="ti-envio-lbl">El mensaje propuesto — puedes editarlo</label>
              <textarea className="ti-envio-texto" rows={4} value={textos[f.id] ?? p.texto ?? ''} onChange={e => setTextos({ ...textos, [f.id]: e.target.value })} />
            </>)}
            {p.tipo !== 'mensaje_extra' && p.tipo !== 'plantilla' && p.texto && <div className="ti-envio-msg">{p.texto}</div>}
            {f.estado === 'propuesta' && p.tipo !== 'ninguna' && (
              <div className="ti-envio-acc" style={{ marginTop: 8 }}>
                <button className="ti-btn primario" disabled={ocupado} onClick={() => decidir(f, 'aceptar')}>{p.tipo === 'descalificar' ? 'Sí, descalificar' : p.tipo === 'llamada' ? 'Sí, crear la llamada' : 'Aceptar y programar'}</button>
                <button className="ti-btn" disabled={ocupado} onClick={() => decidir(f, 'rechazar')}>No (di por qué)</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
