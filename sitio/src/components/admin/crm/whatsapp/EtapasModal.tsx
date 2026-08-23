// INBOX · Gestor del ciclo de vida (crm_lifecycle_etapas).
// Crear, renombrar, emoji, color, tipo (abierta/ganada/perdida), reordenar con
// ↑↓ explícitos, archivar migrando contactos y "temas relevantes" por etapa
// (plantillas/snippets sugeridos que salen en el chat).
import { useEffect, useState } from 'react';
import { C } from './estilo';
import { EMOJIS } from './VistaModales';
import { cargarLifecycle } from '../../../../lib/crm/lifecycle';

const COLORES = ['#6B7280', '#5B4BD6', '#2C5FC4', '#1E8A63', '#9a6a10', '#C0554E', '#9B8CFA', '#D9538E'];
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' };
const lab: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 4px' };

export default function EtapasModal({ onCerrar }: { onCerrar: () => void }) {
  const [etapas, setEtapas] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);          // etapa en edición (o {nueva:true})
  const [archivar, setArchivar] = useState<any>(null);  // etapa a archivar (pide destino si tiene contactos)
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/lifecycle-etapas').then(r => r.json()).then(j => setEtapas(j.etapas || [])).catch(() => setEtapas([]));
  useEffect(() => { cargar(); const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }; window.addEventListener('keydown', esc, true); return () => window.removeEventListener('keydown', esc, true); }, []);
  const refrescarTodo = () => { cargar(); cargarLifecycle(true); };

  const mover = async (i: number, dir: -1 | 1) => {
    const ids = (etapas || []).map(e => e.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setEtapas(es => { const a = [...(es || [])]; [a[i], a[j]] = [a[j], a[i]]; return a; });
    await fetch('/api/crm/lifecycle-etapas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'orden', ids }) });
    cargarLifecycle(true);
  };
  const guardar = async (f: any) => {
    setMsg('');
    const r = await fetch('/api/crm/lifecycle-etapas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).then(x => x.json());
    if (r.error) { setMsg(r.error); return; }
    setEdit(null); refrescarTodo();
  };
  const TIPO: Record<string, [string, string]> = { abierta: ['En proceso', C.g500], ganada: ['Ganada', C.emerald700], perdida: ['Perdida', C.rojo700] };

  return (
    <div role="dialog" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(640px, 96vw)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.g100}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <b style={{ fontSize: 15 }}>Ciclo de vida</b>
          <span style={{ fontSize: 11, color: C.g400 }}>La etapa es del CONTACTO (una a la vez) y aplica aunque no haya conversación.</span>
          <button onClick={onCerrar} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 16 }}>✕</button>
        </div>
        <div className="wa-scroll" style={{ overflowY: 'auto', padding: '10px 20px', flex: 1 }}>
          {!etapas ? <div style={{ padding: 20, fontSize: 12, color: C.g400 }}>Cargando…</div> : etapas.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.g100}`, marginBottom: 6, background: '#fff' }}>
              <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                <button aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', color: i === 0 ? C.g200 : C.g400, fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                <button aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === etapas.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', color: i === etapas.length - 1 ? C.g200 : C.g400, fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
              </span>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{e.emoji}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 13, color: e.color }}>{e.nombre}</b>
                <span style={{ display: 'block', fontSize: 10, color: C.g400 }}>{e.n} contacto{e.n === 1 ? '' : 's'} · <span style={{ color: TIPO[e.tipo]?.[1] }}>{TIPO[e.tipo]?.[0]}</span>{(e.sugerencias || []).length ? ` · ${e.sugerencias.length} tema${e.sugerencias.length === 1 ? '' : 's'}` : ''}</span>
              </span>
              <button onClick={() => setEdit({ ...e })} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: C.g700, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
              <button onClick={() => setArchivar({ ...e, destino: '' })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g300, fontSize: 12, padding: 4 }} title="Archivar etapa">Archivar</button>
            </div>
          ))}
          {msg && <div style={{ color: C.rojo700, fontSize: 12, margin: '6px 0' }}>{msg}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.g100}`, display: 'flex' }}>
          <button onClick={() => setEdit({ nueva: true, nombre: '', emoji: '✨', color: '#9B8CFA', tipo: 'abierta', sugerencias: [] })}
            style={{ border: 'none', background: C.morado, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nueva etapa</button>
        </div>
      </div>

      {edit && <EditorEtapa etapa={edit} onGuardar={guardar} onCerrar={() => setEdit(null)} />}
      {archivar && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, width: 'min(420px, 94vw)' }}>
            <b style={{ fontSize: 14 }}>Archivar "{archivar.nombre}"</b>
            {archivar.n > 0 ? (<>
              <p style={{ fontSize: 12, color: C.g500, margin: '6px 0 10px', lineHeight: 1.5 }}>Tiene <b>{archivar.n} contactos</b>. Elige a qué etapa moverlos (nadie se queda sin etapa):</p>
              <select style={inp} value={archivar.destino} onChange={e => setArchivar({ ...archivar, destino: e.target.value })}>
                <option value="">— elegir etapa destino —</option>
                {(etapas || []).filter(x => x.id !== archivar.id).map(x => <option key={x.id} value={x.id}>{x.emoji} {x.nombre}</option>)}
              </select>
            </>) : <p style={{ fontSize: 12, color: C.g500, margin: '6px 0 10px' }}>No tiene contactos; se archiva sin mover a nadie.</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setArchivar(null)} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button disabled={archivar.n > 0 && !archivar.destino} onClick={async () => {
                const r = await fetch('/api/crm/lifecycle-etapas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: archivar.id, migrar_a: archivar.destino || undefined }) }).then(x => x.json());
                if (r.error) { setMsg(r.error); } else setArchivar(null); refrescarTodo();
              }} style={{ border: 'none', background: archivar.n > 0 && !archivar.destino ? C.g200 : C.rojo500, color: '#fff', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Archivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorEtapa({ etapa, onGuardar, onCerrar }: { etapa: any; onGuardar: (f: any) => Promise<void>; onCerrar: () => void }) {
  const [f, setF] = useState<any>(etapa);
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [snippets, setSnippets] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/crm/whatsapp/plantillas').then(r => r.json()).then(j => setPlantillas((j.plantillas || []).filter((p: any) => p.status === 'APPROVED'))).catch(() => {});
    fetch('/api/crm/whatsapp/respuestas').then(r => r.json()).then(j => setSnippets(j.respuestas || [])).catch(() => {});
  }, []);
  const sug: any[] = f.sugerencias || [];
  return (
    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, width: 'min(520px, 94vw)', maxHeight: '86dvh', overflowY: 'auto' }} className="wa-scroll">
        <b style={{ fontSize: 14 }}>{f.nueva ? 'Nueva etapa' : `Editar "${etapa.nombre}"`}</b>
        <label style={lab}>Nombre</label>
        <input style={inp} value={f.nombre} maxLength={30} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Demo agendada" autoFocus />
        <label style={lab}>Emoji</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {['✨', '✅', '🎯', '📞', '🗓️', '🏆', '💰', '🤝', '💚', '⭐', '🌙', '📰', ...EMOJIS].slice(0, 24).map(e => (
            <button key={e} onClick={() => setF({ ...f, emoji: e })} style={{ fontSize: 16, border: f.emoji === e ? `2px solid ${C.morado}` : `1px solid ${C.g100}`, background: '#fff', borderRadius: 8, padding: '3px 6px', cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
        <label style={lab}>Color</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLORES.map(c => <button key={c} onClick={() => setF({ ...f, color: c })} style={{ width: 26, height: 26, borderRadius: 999, background: c, border: f.color === c ? '3px solid #111' : '2px solid #fff', cursor: 'pointer', boxShadow: '0 0 0 1px #e5e7eb' }} aria-label={c} />)}
        </div>
        <label style={lab}>Qué significa en el embudo</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['abierta', 'En proceso'], ['ganada', 'Ganada (es cliente)'], ['perdida', 'Perdida']].map(([v, l]) => (
            <button key={v} onClick={() => setF({ ...f, tipo: v })} style={{ flex: 1, border: `1px solid ${f.tipo === v ? C.morado : C.g200}`, background: f.tipo === v ? C.moradoAgua : '#fff', color: f.tipo === v ? C.moradoTinta : C.g500, borderRadius: 8, padding: '7px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
        <label style={lab}>Temas relevantes de esta etapa (salen como accesos rápidos en el chat)</label>
        {sug.map((s: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.tipo === 'plantilla' ? C.emerald700 : C.moradoTinta, width: 58, flexShrink: 0 }}>{s.tipo === 'plantilla' ? 'Plantilla' : 'Snippet'}</span>
            <span style={{ fontSize: 12, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titulo || s.ref}</span>
            <button onClick={() => setF({ ...f, sugerencias: sug.filter((_: any, j: number) => j !== i) })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <select style={inp} value="" onChange={e => { const p = plantillas.find(x => String(x.id) === e.target.value); if (p) setF({ ...f, sugerencias: [...sug, { tipo: 'plantilla', ref: p.nombre, idioma: p.idioma, titulo: p.nombre }] }); }}>
            <option value="">+ plantilla aprobada…</option>{plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select style={inp} value="" onChange={e => { const p = snippets.find(x => String(x.id) === e.target.value); if (p) setF({ ...f, sugerencias: [...sug, { tipo: 'snippet', ref: p.atajo, titulo: p.titulo || `/${p.atajo}` }] }); }}>
            <option value="">+ snippet…</option>{snippets.map(p => <option key={p.id} value={p.id}>{p.titulo || `/${p.atajo}`}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCerrar} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button disabled={!f.nombre?.trim()} onClick={() => onGuardar({ id: f.nueva ? undefined : f.id, nombre: f.nombre.trim(), emoji: f.emoji, color: f.color, tipo: f.tipo, sugerencias: f.sugerencias || [] })}
            style={{ border: 'none', background: f.nombre?.trim() ? C.morado : C.g200, color: '#fff', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
