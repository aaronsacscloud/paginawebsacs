/**
 * POR DESCALIFICAR · su propia sección (decisión del dueño, 2026-09-04).
 * Un lead a la vez, con lo que hace falta para decidir: qué dijo, cuánto lleva, si dejó dinero en la mesa y
 * qué pasa con cada opción. Se decide por el mismo camino que la Torre (/api/crm/ti/tarea), así que la rampa
 * de descalificación sigue aprendiendo de cada veredicto.
 */
import { useEffect, useState } from 'react';
import ContextoLead, { MiniHilo } from './crm/ti/ContextoLead';

const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const fecha = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' }) : '—';
const MOTIVO_L: Record<string, string> = { dijo_no: 'Dijo que no le interesa', indice: 'Se agotaron los intentos', silencio: 'Silencio total', nunca_respondio: 'Nunca contestó', pensandolo: 'Dijo que lo iba a ver' };

export default function TrabajoDescalificar() {
  const [d, setD] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [ctx, setCtx] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [saliendo, setSaliendo] = useState(false);
  const cargar = () => fetch('/api/crm/ti/descalificar').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  const aviso = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 4000); };
  if (!d) return <div className="ti-lienzo"><div className="ti-suave">Cargando…</div></div>;
  if (d.error) return <div className="ti-lienzo"><div className="ti-card">{d.error}</div></div>;
  const cola: any[] = d.cola || [];
  const p = d.panel || {};
  const c = cola[Math.min(idx, Math.max(0, cola.length - 1))] || null;

  const decidir = async (resultado: string) => {
    if (!c || ocupado) return;
    setOcupado(true);
    const r = await fetch('/api/crm/ti/tarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, accion: 'hecha', resultado, texto: nota || undefined }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false); setNota('');
    if (r?.error) { aviso('No se pudo: ' + r.error, false); return; }
    setSaliendo(true);
    aviso(resultado === 'descalificar' ? `${c.nombre} sale del ciclo del agente y pasa a nutrición.` : resultado === 'seguir' ? `${c.nombre} sigue: el agente le insiste con otro ángulo.` : resultado === 'no_era_lead' ? 'Marcado como «no era lead»: el ciclo nocturno lo usa para filtrar esa fuente.' : 'Listo.');
    setTimeout(async () => { setSaliendo(false); await cargar(); }, 380);
  };

  return (
    <div className="ti-lienzo dq">
      <style>{CSS}</style>
      <div className="dq-head">
        <div className="dq-num"><b>{p.total || 0}</b><span>por decidir</span></div>
        <div className="dq-stats">
          {p.dijeron_no > 0 && <span><b>{p.dijeron_no}</b> dijeron que no</span>}
          {p.nunca_contestaron > 0 && <span><b>{p.nunca_contestaron}</b> nunca contestaron</span>}
          {p.con_dinero > 0 && <span className="dq-ojo"><b>{p.con_dinero}</b> con cotización abierta · {dinero(p.dinero)} en juego</span>}
        </div>
        {cola.length > 1 && <span className="dq-pos">{Math.min(idx, cola.length - 1) + 1} de {cola.length}</span>}
      </div>
      {msg && <div className={'dq-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}

      {!c && <div className="ti-card dq-vacio"><b>Nadie por descalificar.</b><div className="ti-suave">Aquí llegan los leads que dijeron que no y los que ya no dan señales, con su contexto, para que decidas de una vez.</div></div>}
      {c && (
        <div className={'ti-card dq-card' + (saliendo ? ' saliendo' : '')} key={c.id}>
          <div className="dq-cab">
            <span className="dq-chip">{MOTIVO_L[c.motivo] || 'Se sugiere cerrar'}</span>
            <b className="dq-nombre">{c.nombre}</b>{c.empresa ? <span className="ti-suave" style={{ margin: 0 }}>· {c.empresa}</span> : null}
            <span className="ti-suave" style={{ margin: 0 }}>{c.etapa}{c.giro ? ` · ${c.giro}` : ''}{c.fuente ? ` · llegó por ${c.fuente}` : ''} · desde {fecha(c.creado)}</span>
          </div>

          <div className="dq-grid">
            <div>
              <div className="dq-lbl">Por qué se propone cerrarlo</div>
              <div className="dq-txt">{c.resumen || c.porque || c.titulo}</div>
              {c.dijo && c.dijo !== c.resumen && <div className="dq-cita">«{c.dijo}»</div>}
              {c.indice !== null && c.indice !== undefined && <div className="ti-suave" style={{ margin: '6px 0 0' }}>Índice de vida: {c.indice}/100</div>}
              {c.contact_id && <MiniHilo contactId={c.contact_id} n={8} onAbrir={() => setCtx(c.contact_id)} />}
            </div>
            <div>
              <div className="dq-lbl">Por qué importa esta decisión</div>
              <ul className="dq-razones">{(c.razones || []).map((r: string, i: number) => <li key={i} className={/cotizaci|demo/.test(r) ? 'ojo' : ''}>{r}</li>)}</ul>
              <div className="dq-cifras">
                <div><b>{c.respondio}</b><span>respuestas suyas</span></div>
                <div><b>{c.escritos}</b><span>mensajes nuestros</span></div>
                <div><b>{c.dias_sin_respuesta ?? '—'}</b><span>días sin contestar</span></div>
                {c.dinero > 0 && <div className="ojo"><b>{dinero(c.dinero)}</b><span>cotizado</span></div>}
              </div>
            </div>
          </div>

          <input className="ti-campo" style={{ marginTop: 12 }} placeholder="Nota (opcional): lo que sepas y el sistema no, por ejemplo «me dijo por teléfono que abre otra tienda en enero»" value={nota} onChange={e => setNota(e.target.value)} />
          <div className="dq-btns">
            <button className="dq-btn p" disabled={ocupado} onClick={() => decidir('descalificar')}>{ocupado ? 'Guardando…' : 'Descalificar: sale del ciclo'}</button>
            <button className="dq-btn" disabled={ocupado} onClick={() => decidir('seguir')}>Que siga: el agente insiste</button>
            {c.resultados?.no_era_lead && <button className="dq-btn" disabled={ocupado} onClick={() => decidir('no_era_lead')}>No era lead</button>}
          </div>
          <div className="dq-despues"><b>Después:</b> descalificar no borra a nadie. Lo saca del ciclo del agente y lo manda a nutrición; si un día escribe, vuelve solo. Cada veredicto entrena la rampa: cuando 20 seguidos coincidan con la propuesta, el sistema empieza a cerrarlos solo.</div>
        </div>
      )}
      <ContextoLead contactId={ctx} open={!!ctx} onClose={() => setCtx(null)} />
    </div>
  );
}

const CSS = `
.dq{max-width:1060px}
.dq-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.dq-num{display:flex;align-items:baseline;gap:6px}.dq-num b{font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1}.dq-num span{font-size:13px;color:#8e88a8;font-weight:700}
.dq-stats{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#6b6580}.dq-stats b{color:#241d43}
.dq-ojo{color:#8a5a00}.dq-ojo b{color:#8a5a00}
.dq-pos{margin-left:auto;font-size:12px;color:#8e88a8}
.dq-msg{font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:8px;margin-bottom:10px}.dq-msg.ok{background:#e7f7ee;color:#14532d}.dq-msg.err{background:#fde7e5;color:#b3261e}
.dq-card{padding:18px 20px;transition:opacity .35s,transform .35s}.dq-card.saliendo{opacity:0;transform:translateX(24px)}
.dq-cab{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.dq-chip{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#b3261e;background:#fde7e5;border-radius:999px;padding:3px 9px}
.dq-nombre{font-size:17px}
.dq-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}
.dq-lbl{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8e88a8;margin-bottom:6px}
.dq-txt{font-size:14px;line-height:1.5}
.dq-cita{margin-top:8px;font-size:13px;line-height:1.45;color:#4a4658;border-left:3px solid #e8e5f0;padding-left:10px}
.dq-razones{margin:0;padding-left:18px;font-size:13px;line-height:1.5}.dq-razones li{margin-bottom:5px}.dq-razones li.ojo{color:#8a5a00;font-weight:600}
.dq-cifras{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #f0eef5}
.dq-cifras div{display:flex;flex-direction:column}.dq-cifras b{font-size:19px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}.dq-cifras span{font-size:11px;color:#8e88a8}.dq-cifras .ojo b{color:#8a5a00}
.dq-btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.dq-btn{border:1px solid #e8e5f0;background:#fff;color:#241d43;border-radius:12px;padding:13px 18px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}
.dq-btn.p{flex:1;background:#b3261e;border-color:#b3261e;color:#fff;box-shadow:0 8px 20px rgba(179,38,30,.2)}
.dq-btn:disabled{opacity:.5;cursor:default}
.dq-despues{margin-top:14px;font-size:12.5px;color:#6b6580;line-height:1.5}
.dq-vacio{text-align:center;padding:40px 20px}
@media (max-width:820px){.dq-grid{grid-template-columns:1fr}}
`;
