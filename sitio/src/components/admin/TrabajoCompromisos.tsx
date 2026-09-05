/**
 * PROGRAMADOS · lo que el prospecto pidió con fecha (decisión del dueño, 2026-09-05).
 * «Llámame el jueves», «búscame en 30 días», «lo checo». Cada uno con: quién, qué dijo textual, qué vamos a hacer,
 * cuándo y a qué hora (y por qué esa hora). Se puede mover, cancelar o disparar ya. Mientras tanto, silencio total.
 */
import { useEffect, useState } from 'react';
import ContextoLead from './crm/ti/ContextoLead';

const f = (iso?: string | null, opts: any = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) => iso ? new Date(iso).toLocaleString('es-MX', { ...opts, timeZone: 'America/Mexico_City' }) : '—';
const GRUPO_L: Record<string, string> = { sin_hora: 'Falta que nos diga la hora', hoy: 'Hoy', manana: 'Mañana', semana: 'Esta semana', despues: 'Más adelante' };
const ACC_L: Record<string, string> = { escribir: 'Le escribimos', llamar: 'Le llamamos', agendar: 'Le proponemos agenda' };

export default function TrabajoCompromisos() {
  const [d, setD] = useState<any>(null);
  const [ctx, setCtx] = useState<string | null>(null);
  const [mover, setMover] = useState<Record<string, { fecha: string; hora: string }>>({});
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verHist, setVerHist] = useState(false);
  const cargar = () => fetch('/api/crm/ti/compromisos').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, []);
  const aviso = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 4000); };
  const act = async (id: string, accion: string, extra: any = {}) => {
    setOcupado(id);
    const r = await fetch('/api/crm/ti/compromisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, accion, ...extra }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(null);
    if (r.error) { aviso(r.error, false); return; }
    setD(r); aviso(accion === 'cancelar' ? 'Cancelado: el agente vuelve a su ritmo normal con ese lead.' : accion === 'ahora' ? 'Disparado: el mensaje ya está en la cola.' : `Movido al ${f(r.programado_para)}.`);
  };
  if (!d) return <div className="ti-lienzo"><div className="ti-suave">Cargando…</div></div>;
  if (d.error) return <div className="ti-lienzo"><div className="ti-card">{d.error}</div></div>;
  const r = d.resumen || {};
  const grupos = ['sin_hora', 'hoy', 'manana', 'semana', 'despues'];
  return (
    <div className="ti-lienzo pg">
      <style>{CSS}</style>
      <div className="pg-head">
        <div className="pg-num"><b>{r.total || 0}</b><span>programados</span></div>
        <div className="pg-stats"><span><b>{r.hoy || 0}</b> hoy</span><span><b>{r.semana || 0}</b> esta semana</span>{r.sin_hora > 0 && <span className="pg-ojo"><b>{r.sin_hora}</b> esperando que digan la hora</span>}</div>
        <span className="pg-pos"><button className="pg-link" onClick={() => setVerHist(v => !v)}>{verHist ? 'ver programados' : `historial (${(d.historial || []).length})`}</button></span>
      </div>
      <div className="ti-suave" style={{ margin: '0 0 12px' }}>Cuando un prospecto pide que lo busquemos después, el agente le confirma con empatía, se programa aquí el día y la hora que le acomoda, y mientras tanto nadie le escribe. Al vencer, el mensaje se genera con el contexto exacto de lo que quedó.</div>
      {msg && <div className={'pg-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}

      {!verHist && (d.proximos || []).length === 0 && <div className="ti-card pg-vacio"><b>Nada programado.</b><div className="ti-suave">Aquí aparecerán los «llámame el jueves», «búscame en 30 días» y «lo checo» con su fecha y su hora.</div></div>}
      {!verHist && grupos.map(g => {
        const items = (d.proximos || []).filter((x: any) => x.grupo === g); if (!items.length) return null;
        return (
          <div key={g}>
            <div className="pg-sec">{GRUPO_L[g]} · {items.length}</div>
            {items.map((x: any) => {
              const mv = mover[x.id] || { fecha: String(x.programado_para).slice(0, 10), hora: String(x.hora_local ?? 10) };
              return (
                <div key={x.id} className={'ti-card pg-item' + (g === 'sin_hora' ? ' ojo' : '')}>
                  <div className="pg-cab"><span className="pg-chip">{x.tipo_label}</span><b className="pg-link" onClick={() => setCtx(x.contact_id)}>{x.lead?.nombre}</b>{x.lead?.empresa ? <span className="ti-suave" style={{ margin: 0 }}>· {x.lead.empresa}</span> : null}{x.lead?.giro ? <span className="ti-suave" style={{ margin: 0 }}>· {x.lead.giro}</span> : null}</div>
                  <div className="pg-dijo">«{x.pidio}»</div>
                  {x.interpretacion && <div className="pg-p">{x.interpretacion}</div>}
                  <div className="pg-cuando">
                    {x.estado === 'preguntando_hora'
                      ? <>Le preguntamos a qué hora le marcamos. En cuanto conteste, queda agendada la llamada.</>
                      : <><b>{ACC_L[x.accion_al_vencer] || x.accion_al_vencer}</b> el <b>{f(x.programado_para)}</b> · {x.por_que_hora ? `hora elegida: ${x.por_que_hora}` : ''} · pidió el {f(x.created_at, { day: 'numeric', month: 'short' })}</>}
                  </div>
                  <div className="pg-acc">
                    <input type="date" className="ti-campo" value={mv.fecha} onChange={e => setMover({ ...mover, [x.id]: { ...mv, fecha: e.target.value } })} style={{ width: 150 }} />
                    <select className="ti-campo" value={mv.hora} onChange={e => setMover({ ...mover, [x.id]: { ...mv, hora: e.target.value } })} style={{ width: 90 }}>{Array.from({ length: 11 }, (_, i) => 9 + i).map(h => <option key={h} value={h}>{h}:00</option>)}</select>
                    <button className="ti-btn" disabled={ocupado === x.id} onClick={() => act(x.id, x.estado === 'preguntando_hora' ? 'fijar_hora' : 'mover', { fecha: mv.fecha, hora: Number(mv.hora) })}>{x.estado === 'preguntando_hora' ? 'Fijar hora' : 'Mover'}</button>
                    <button className="ti-btn" disabled={ocupado === x.id} onClick={() => act(x.id, 'ahora')}>Enviar ahora</button>
                    <button className="ti-btn ghost" disabled={ocupado === x.id} onClick={() => { if (window.confirm('¿Cancelar? El agente vuelve a su ritmo normal con este lead.')) act(x.id, 'cancelar'); }}>Cancelar</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {verHist && (
        <div className="ti-card">
          {(d.historial || []).length === 0 && <div className="ti-suave">Sin historial todavía.</div>}
          {(d.historial || []).map((x: any) => <div key={x.id} className="pg-h"><span className={'pg-chip ' + x.estado}>{x.estado}</span><b>{x.lead?.nombre}</b><span className="ti-suave" style={{ margin: 0 }}>«{String(x.pidio).slice(0, 80)}» · {x.tipo_label} · {f(x.programado_para)}</span></div>)}
        </div>
      )}
      <ContextoLead contactId={ctx} open={!!ctx} onClose={() => setCtx(null)} />
    </div>
  );
}

const CSS = `
.pg{max-width:1060px}
.pg-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.pg-num{display:flex;align-items:baseline;gap:6px}.pg-num b{font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1}.pg-num span{font-size:13px;color:#8e88a8;font-weight:700}
.pg-stats{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#6b6580}.pg-stats b{color:#241d43}.pg-ojo{color:#8a5a00}.pg-ojo b{color:#8a5a00}
.pg-pos{margin-left:auto}.pg-link{border:none;background:none;color:#5B4BD6;font-weight:800;cursor:pointer;font-family:inherit;font-size:12px;padding:0}
.pg-msg{font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:8px;margin-bottom:10px}.pg-msg.ok{background:#e7f7ee;color:#14532d}.pg-msg.err{background:#fde7e5;color:#b3261e}
.pg-sec{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b6580;margin:14px 0 8px}
.pg-item{padding:14px 16px}.pg-item.ojo{border-left:4px solid #e0a82e}
.pg-cab{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.pg-cab b{font-size:15px;cursor:pointer}
.pg-chip{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#3d2fb0;background:#EEECFE;border-radius:999px;padding:3px 9px}.pg-chip.cumplido{background:#e7f7ee;color:#14532d}.pg-chip.cancelado{background:#ecebf2;color:#6b6580}
.pg-dijo{font-size:14px;line-height:1.45;color:#241d43;border-left:3px solid #e8e5f0;padding-left:10px;margin:4px 0}
.pg-p{font-size:13px;color:#4a4658;margin-top:4px}
.pg-cuando{font-size:13px;margin-top:8px;color:#241d43}.pg-cuando b{color:#3d2fb0}
.pg-acc{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.pg-acc .ti-btn.ghost{border-color:transparent;color:#8e88a8}
.pg-vacio{text-align:center;padding:40px 20px}
.pg-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0eef5;font-size:13px}
`;
