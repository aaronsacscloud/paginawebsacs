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

export default function AjustesWA({ onClose, inline = false }: { onClose?: () => void; inline?: boolean }) {
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

  // Plantillas UTILITY aprobadas: el catálogo del selector de bienvenida a
  // leads de TikTok. Se cargan una vez al abrir la sección.
  const [plantillasUtil, setPlantillasUtil] = useState<any[]>([]);
  const [plantillasEmail, setPlantillasEmail] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/crm/whatsapp/plantillas').then(r => r.json()).then(j => {
      const todas = j.plantillas || j.data || [];
      setPlantillasUtil(todas.filter((x: any) => (x.category || x.categoria) === 'UTILITY' && (x.status || x.estado) === 'APPROVED'));
    }).catch(() => {});
    fetch('/api/crm/email/templates').then(r => r.json()).then(j => setPlantillasEmail(j.plantillas || [])).catch(() => {});
  }, []);

  const guardar = async () => {
    setGuardando(true); setMsg('');
    const r = await fetch('/api/crm/whatsapp/ajustes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setGuardando(false);
    if (r?.error) { setMsg(r.error); return; }
    if (inline) { setMsg('Guardado ✓'); setTimeout(() => setMsg(''), 2500); } else onClose?.();
  };

  // Modal desde el rail del inbox, o sección inline en Configuración WhatsApp.
  return (
    <div onClick={inline ? undefined : onClose} style={inline ? undefined : { position: 'fixed', inset: 0, background: 'rgba(20,15,40,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={inline
        ? { background: '#fff', borderRadius: 12, padding: '20px 22px', width: '100%', maxWidth: 560, border: '1px solid #ececec' }
        : { background: '#fff', borderRadius: 14, padding: '20px 22px', width: 'min(500px, 94vw)', maxHeight: '86dvh', overflowY: 'auto' }}>
        <b style={{ fontSize: '0.95rem' }}>Automatización del inbox</b>
        <ImportarHistorial />
        <AjustesLlamadas />
        <AjustesInactividad />
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
            <Toggle on={!!a.bienvenida_tiktok_activa} onChange={v => setA({ ...a, bienvenida_tiktok_activa: v })} label="Bienvenida a leads de TikTok" />
            <p style={{ margin: '4px 0 0 43px', fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.5 }}>
              Al entrar un registro de TikTok, se le manda al lead la plantilla UTILITY elegida
              (confirma SU registro; cuando responde, la conversación sigue libre). Los imports
              masivos nunca la disparan.
            </p>
            {a.bienvenida_tiktok_activa && (<>
              <select style={{ ...inp, marginTop: 8 }} value={a.bienvenida_tiktok_plantilla || ''}
                onChange={e => setA({ ...a, bienvenida_tiktok_plantilla: e.target.value })}>
                <option value="">— elegir plantilla UTILITY aprobada —</option>
                {plantillasUtil.map((x: any) => <option key={x.name || x.nombre} value={x.name || x.nombre}>{x.name || x.nombre}</option>)}
              </select>
              {(() => {
                const el = plantillasUtil.find((x: any) => (x.name || x.nombre) === a.bienvenida_tiktok_plantilla);
                const cuerpo = el?.components?.find?.((c: any) => c.type === 'BODY')?.text || el?.cuerpo || '';
                return cuerpo ? <p style={{ margin: '7px 0 0', fontSize: '0.72rem', color: '#5c5966', background: '#faf9fc', border: '1px solid #eeeef1', borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 }}>{cuerpo.replace('{{1}}', 'María')}</p> : null;
              })()}
            </>)}
          </div>

          <div style={{ marginTop: 18 }}>
            <Toggle on={!!a.email_bienvenida_tiktok_activa} onChange={v => setA({ ...a, email_bienvenida_tiktok_activa: v })} label="Correo de bienvenida a leads de TikTok" />
            <p style={{ margin: '4px 0 0 43px', fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.5 }}>
              Si el registro trae correo, se le manda este mensaje (categoría relación, no marketing).
              Variables: {'{{nombre}}'} y {'{{campana}}'}. Vacío = se usa la plantilla preestablecida.
            </p>
            {a.email_bienvenida_tiktok_activa && (<>
              {/* El correo ES una plantilla del sistema de email marketing:
                  se elige aquí y se EDITA en Email ▸ Plantillas (bloques,
                  imagen/GIF, aviso, botón, sellos — todo del editor). */}
              <select style={{ ...inp, marginTop: 8 }} value={a.email_bienvenida_template_id || ''}
                onChange={e => setA({ ...a, email_bienvenida_template_id: e.target.value })}>
                <option value="">— elegir plantilla del sistema de email —</option>
                {plantillasEmail.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
              <p style={{ margin: '6px 0 0', fontSize: '0.68rem', color: '#a5a2af' }}>
                El contenido se edita en <b>Email ▸ Plantillas</b> — bloques, imagen, botón y sellos. Un solo camino: todo por el CRM.
              </p>
            </>)}
          </div>

          <div style={{ marginTop: 18 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#333' }}>Leads por WhatsApp directo</span>
            <p style={{ margin: '4px 0 8px', fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.5 }}>
              Qué hacer cuando escribe un número desconocido. El lead nace como «Respondió»
              (él nos buscó) y avisa al equipo; soporte y spam solo marcan la conversación.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['triaje', 'La IA decide (ventas / soporte / spam)'], ['siempre', 'Crear lead siempre'], ['nunca', 'Nunca (manual)']] as const).map(([v, l]) => {
                const on = (a.alta_wa_entrante || 'triaje') === v;
                return (
                  <button key={v} onClick={() => setA({ ...a, alta_wa_entrante: v })} style={{
                    border: `1.5px solid ${on ? '#c9bcf7' : '#e2e4e9'}`, background: on ? '#EEECFE' : '#fff',
                    color: on ? '#5B4BD6' : '#666', borderRadius: 999, padding: '6px 13px',
                    fontSize: '0.72rem', fontWeight: on ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{l}</button>
                );
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              <Toggle on={a.alta_wa_saliente !== false} onChange={v => setA({ ...a, alta_wa_saliente: v })} label="Crear lead al escribirle a un número nuevo" />
            </div>
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
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block' }}>Catálogo de Meta (ID)</label>
            <p style={{ margin: '2px 0 6px', fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.5 }}>Para mandar productos y el botón "Ver catálogo" desde el chat. Está en Meta Commerce Manager → Catálogo → Configuración.</p>
            <input style={inp} value={a.catalog_id || ''} onChange={e => setA({ ...a, catalog_id: e.target.value })} placeholder="Ej. 1234567890123456" />
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

/** Calling API: activar que el cliente nos llame desde WhatsApp (y, donde Meta lo permita, llamar nosotros). */
function AjustesLlamadas() {
  const [a, setA] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { fetch('/api/crm/whatsapp/llamadas?ajustes=1').then(r => r.json()).then(j => setA(j.ajustes?.calling || j.error || null)).catch(() => {}); }, []);
  const guardar = async (calling: any) => {
    setOcupado(true); setMsg('');
    const r = await fetch('/api/crm/whatsapp/llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'configurar', calling }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r.error) { setMsg(r.error); return; }
    setA(calling); setMsg('Guardado en Meta.');
  };
  const activo = a && typeof a === 'object' && a.status === 'ENABLED';
  return (
    <div style={{ marginTop: 14, border: '1px solid #ececec', borderRadius: 10, padding: '10px 12px', background: '#fafafa' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Llamadas de WhatsApp</div>
          <div style={{ fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.4 }}>{typeof a === 'string' ? a : activo ? 'Activas: el cliente ve el botón de llamar en el chat y aquí timbra.' : 'Apagadas: el cliente no puede llamar a este número.'}</div>
        </div>
        {a && typeof a === 'object' && (
          <button disabled={ocupado} onClick={() => guardar(activo ? { status: 'DISABLED' } : { status: 'ENABLED', call_icon_visibility: 'DEFAULT', callback_permission_status: 'DISABLED' })}
            style={{ border: 'none', borderRadius: 8, padding: '7px 12px', background: activo ? '#eee' : '#9B8CFA', color: activo ? '#333' : '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{activo ? 'Desactivar' : 'Activar'}</button>
        )}
      </div>
      {activo && <div style={{ fontSize: '0.68rem', color: '#8a8a92', marginTop: 6 }}>Llamadas salientes del negocio: {a.callback_permission_status === 'ENABLED' ? 'habilitadas' : 'no disponibles para números de EE. UU. (restricción de Meta)'}.</div>}
      {msg && <div style={{ marginTop: 6, fontSize: '0.72rem', color: /Guardado/.test(msg) ? '#1E8A63' : '#C0554E' }}>{msg}</div>}
    </div>
  );
}

/** Etapa E: aviso cuando una conversación lleva X minutos sin actividad (evento de Kapso). */
function AjustesInactividad() {
  const [min, setMin] = useState(60);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const guardar = async () => {
    setOcupado(true); setMsg('');
    const r = await fetch('/api/crm/whatsapp/contacto-kapso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'webhook', inactivity_minutes: min }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false); setMsg(r.error ? r.error : `Kapso avisará a los ${min} min sin actividad (y cuando un cliente cambie de identidad).`);
  };
  return (
    <div style={{ marginTop: 14, border: '1px solid #ececec', borderRadius: 10, padding: '10px 12px', background: '#fafafa' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Aviso de conversación fría</div>
      <div style={{ fontSize: '0.7rem', color: '#8a8a92', lineHeight: 1.4 }}>Si el cliente escribió y nadie contesta en este tiempo, suena la campana y queda en el hilo.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input type="number" min={5} max={1440} value={min} onChange={e => setMin(Number(e.target.value))} style={{ ...inp, width: 90 }} /><span style={{ fontSize: '0.75rem' }}>minutos</span>
        <button disabled={ocupado} onClick={guardar} style={{ border: 'none', borderRadius: 8, padding: '7px 12px', background: '#9B8CFA', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar en Kapso</button>
      </div>
      {msg && <div style={{ marginTop: 6, fontSize: '0.72rem', color: /avisará/.test(msg) ? '#1E8A63' : '#C0554E' }}>{msg}</div>}
    </div>
  );
}
