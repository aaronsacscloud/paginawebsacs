// WHATSAPP · Ajustes de automatización: bienvenida, fuera de horario y
// round-robin. Vive en un modal desde el engrane del rail.
import { useEffect, useState } from 'react';
import { Corazones } from '../ui/Cargando';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fdfcff' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#888', margin: '12px 0 4px' };
const DIAS = [{ v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' }, { v: 4, l: 'J' }, { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 7, l: 'D' }];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#333' }}>
      <span onClick={() => onChange(!on)} role="switch" aria-checked={on}
        style={{ width: 34, height: 19, borderRadius: 20, background: on ? '#9B8CFA' : '#d9d8e0', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
      </span>
      {label}
    </label>
  );
}

export default function AjustesWA({ onClose }: { onClose: () => void }) {
  const [a, setA] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/crm/whatsapp/ajustes').then(r => r.json())
      .then(j => setA({
        bienvenida_activa: false, bienvenida_texto: '', fuera_activa: false, fuera_texto: '',
        asignacion_rr: false, ...j.ajustes,
        horario: j.ajustes?.horario || { dias: [1, 2, 3, 4, 5], desde: '09:00', hasta: '18:00' },
      }))
      .catch(() => setA({}));
  }, []);

  const guardar = async () => {
    setGuardando(true); setMsg('');
    const r = await fetch('/api/crm/whatsapp/ajustes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setGuardando(false);
    if (r?.error) { setMsg(r.error); return; }
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,40,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', width: 'min(500px, 94vw)', maxHeight: '86dvh', overflowY: 'auto' }}>
        <b style={{ fontSize: '0.95rem' }}>Automatización del inbox</b>
        <ImportarHistorial />
        {!a ? <div style={{ padding: 20, fontSize: '0.78rem', color: '#a5a2af' }}>Cargando…</div> : (<>
          <div style={{ marginTop: 16 }}>
            <Toggle on={!!a.bienvenida_activa} onChange={v => setA({ ...a, bienvenida_activa: v })} label="Mensaje de bienvenida" />
            <p style={{ margin: '4px 0 0 43px', fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.5 }}>
              Se manda UNA vez por conversación, al primer mensaje del cliente.
            </p>
            {a.bienvenida_activa && (
              <textarea style={{ ...inp, marginTop: 8, resize: 'vertical' }} rows={2} value={a.bienvenida_texto || ''}
                onChange={e => setA({ ...a, bienvenida_texto: e.target.value })}
                placeholder="¡Hola! Gracias por escribir a SACS. En un momento te atendemos." />
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <Toggle on={!!a.fuera_activa} onChange={v => setA({ ...a, fuera_activa: v })} label="Respuesta fuera de horario" />
            {a.fuera_activa && (<>
              <textarea style={{ ...inp, marginTop: 8, resize: 'vertical' }} rows={2} value={a.fuera_texto || ''}
                onChange={e => setA({ ...a, fuera_texto: e.target.value })}
                placeholder="Nuestro horario es L-V de 9:00 a 18:00. Te respondemos en cuanto abramos." />
              <label style={lbl}>Horario de atención (hora CDMX)</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {DIAS.map(d => {
                  const on = (a.horario?.dias || []).includes(d.v);
                  return (
                    <button key={d.v} onClick={() => setA({
                      ...a, horario: { ...a.horario, dias: on ? a.horario.dias.filter((x: number) => x !== d.v) : [...(a.horario.dias || []), d.v] },
                    })}
                      style={{
                        width: 30, height: 30, borderRadius: 99, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '0.72rem', fontWeight: 800,
                        borderColor: on ? '#c9bcf7' : '#e2e4e9', background: on ? '#EEECFE' : '#fff', color: on ? '#5B4BD6' : '#a5a2af',
                      }}>{d.l}</button>
                  );
                })}
                <input type="time" value={a.horario?.desde || '09:00'} onChange={e => setA({ ...a, horario: { ...a.horario, desde: e.target.value } })}
                  style={{ ...inp, width: 'auto' }} />
                <span style={{ fontSize: '0.75rem', color: '#8a8a92' }}>a</span>
                <input type="time" value={a.horario?.hasta || '18:00'} onChange={e => setA({ ...a, horario: { ...a.horario, hasta: e.target.value } })}
                  style={{ ...inp, width: 'auto' }} />
              </div>
            </>)}
          </div>

          <div style={{ marginTop: 18 }}>
            <Toggle on={!!a.asignacion_rr} onChange={v => setA({ ...a, asignacion_rr: v })} label="Asignación automática (round-robin)" />
            <p style={{ margin: '4px 0 0 43px', fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.5 }}>
              Cada conversación nueva sin dueño se reparte al siguiente del equipo.
            </p>
          </div>

          {msg && <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#C0554E' }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ border: '1px solid #e2e4e9', borderRadius: 9, padding: '8px 14px', background: '#fff', fontSize: '0.76rem', fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando}
              style={{ border: 'none', borderRadius: 9, padding: '8px 16px', background: '#9B8CFA', color: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {guardando ? <Corazones size={9} color="#fff" /> : 'Guardar'}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

/** Backfill del historial que Kapso ya tenía antes del webhook (página por página). */
function ImportarHistorial() {
  const [estado, setEstado] = useState<'idle' | 'corriendo' | 'listo' | 'error'>('idle');
  const [n, setN] = useState(0);
  const [msg, setMsg] = useState('');
  const correr = async () => {
    setEstado('corriendo'); setN(0); setMsg('');
    let after: string | null = null; let total = 0; let paginas = 0;
    try {
      do {
        const r: any = await fetch('/api/crm/whatsapp/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ after }) }).then(x => x.json());
        if (r.error) throw new Error(r.error);
        total += r.importados || 0; setN(total); after = r.next || null; paginas++;
        if (!r.vistos) break;
      } while (after && paginas < 200);
      setEstado('listo'); setMsg(`Listo: ${total} mensajes nuevos importados (${paginas} páginas).`);
    } catch (e: any) { setEstado('error'); setMsg(e?.message || 'Falló la importación'); }
  };
  return (
    <div style={{ marginTop: 14, border: '1px solid #ececec', borderRadius: 10, padding: '10px 12px', background: '#fafafa' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Importar historial de Kapso</div>
          <div style={{ fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.4 }}>Trae al inbox las conversaciones anteriores a la conexión del webhook. Se puede repetir: no duplica.</div>
        </div>
        <button disabled={estado === 'corriendo'} onClick={correr}
          style={{ border: 'none', borderRadius: 8, padding: '7px 12px', background: estado === 'corriendo' ? '#ddd' : '#9B8CFA', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {estado === 'corriendo' ? `Importando… ${n}` : 'Importar'}
        </button>
      </div>
      {msg && <div style={{ marginTop: 6, fontSize: '0.72rem', color: estado === 'error' ? '#C0554E' : '#1E8A63' }}>{msg}</div>}
    </div>
  );
}
