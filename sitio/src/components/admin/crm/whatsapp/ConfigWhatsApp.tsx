// WHATSAPP · Configuración unificada: TODO el catálogo que el usuario puede
// personalizar del inbox vive aquí — plantillas de Meta, snippets, etiquetas,
// archivos, etapas del ciclo de vida, motivos de cierre, automatización y el
// número (salud, perfil y pagos de Meta). Antes estaba regado en 4 lugares.
import { useEffect, useState } from 'react';
import { S, Aviso, Vacio } from '../email/ui';
import { C } from './estilo';
import Cargando, { Corazones } from '../ui/Cargando';
import { PlantillasMeta, Snippets } from './Plantillas';
import EtapasModal from './EtapasModal';
import AjustesWA from './AjustesWA';
import NumeroWA from './NumeroWA';

type Seccion = 'plantillas' | 'snippets' | 'etiquetas' | 'archivos' | 'etapas' | 'motivos' | 'automatizacion' | 'numero';

const SECCIONES: { id: Seccion; label: string; desc: string }[] = [
  { id: 'plantillas', label: 'Plantillas de Meta', desc: 'Mensajes aprobados para abrir conversación' },
  { id: 'snippets', label: 'Snippets', desc: 'Respuestas rápidas con "/" en el chat' },
  { id: 'etiquetas', label: 'Etiquetas', desc: 'El catálogo transversal del CRM' },
  { id: 'archivos', label: 'Archivos', desc: 'Biblioteca de medios para adjuntar' },
  { id: 'etapas', label: 'Ciclo de vida', desc: 'Las etapas del contacto' },
  { id: 'motivos', label: 'Motivos de cierre', desc: 'Por qué se resuelve una conversación' },
  { id: 'automatizacion', label: 'Automatización', desc: 'Bienvenida, horario, asignación' },
  { id: 'numero', label: 'Número y pagos', desc: 'Salud, perfil y facturación de Meta' },
];

export default function ConfigWhatsApp({ inicial }: { inicial?: Seccion }) {
  const [sec, setSec] = useState<Seccion>(inicial || 'plantillas');
  useEffect(() => {
    // Deep-link: ?tab=wa-config&sec=numero
    try { const s = new URLSearchParams(window.location.search).get('sec') as Seccion | null; if (s && SECCIONES.some(x => x.id === s)) setSec(s); } catch { /* SSR */ }
  }, []);

  return (
    <div style={{ ...S.wrap, display: 'flex', gap: 22, alignItems: 'flex-start' }}>
      {/* OJO: crm.astro esconde todo <nav> del sitio con display:none — aside, no nav */}
      <aside style={{ width: 228, flexShrink: 0, position: 'sticky', top: 34 }}>
        <p style={{ fontSize: '0.62rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2px 0 8px 10px' }}>Configuración WhatsApp</p>
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => setSec(s.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 9, padding: '8px 11px', marginBottom: 2,
            background: sec === s.id ? '#EEECFE' : 'transparent',
          }}>
            <b style={{ fontSize: 12.5, color: sec === s.id ? '#5B4BD6' : '#444', display: 'block' }}>{s.label}</b>
            <span style={{ fontSize: 10.5, color: sec === s.id ? '#7C6BF0' : '#999', display: 'block', marginTop: 1 }}>{s.desc}</span>
          </button>
        ))}
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        {sec === 'plantillas' && <PlantillasMeta />}
        {sec === 'snippets' && <Snippets />}
        {sec === 'etiquetas' && <EtiquetasCatalogo />}
        {sec === 'archivos' && <Archivos />}
        {sec === 'etapas' && <EtapasModal inline />}
        {sec === 'motivos' && <MotivosCierre />}
        {sec === 'automatizacion' && <AjustesWA inline />}
        {sec === 'numero' && (<><PagosMeta /><NumeroWA /></>)}
      </div>
    </div>
  );
}

// ═════════════ Etiquetas: el catálogo transversal del CRM ═════════════
function EtiquetasCatalogo() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/etiquetas').then(r => r.json()).then(j => setLista(j.data || [])).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);
  if (!lista) return <Cargando texto="Cargando etiquetas…" />;

  const guardar = async () => {
    const nombre = String(form.nombre || '').trim();
    if (!nombre) { setMsg('Ponle nombre a la etiqueta'); return; }
    const metodo = form.id ? 'PUT' : 'POST';
    const r = await fetch('/api/crm/etiquetas', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: form.id, nombre, color: form.color, descripcion: form.descripcion || null }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(r.error); return; }
    setForm(null); setMsg(''); cargar();
  };
  const borrar = async (e: any) => {
    if (!confirm(`¿Borrar la etiqueta "${e.nombre}"? Se quita de las ${e.uso?.total || 0} cosas que la llevan.`)) return;
    await fetch('/api/crm/etiquetas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) }).catch(() => {});
    cargar();
  };

  return (
    <div>
      <Cabecera titulo="Etiquetas" texto="Son las mismas en todo el CRM: conversaciones, empresas, oportunidades y suscripciones."
        accion={<button style={S.btnP} onClick={() => setForm({ nombre: '', color: '#9B8CFA', descripcion: '' })}>Nueva etiqueta</button>} />
      {form && (
        <div style={{ ...S.card, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 160 }}><span style={lbl}>Nombre</span>
            <input autoFocus style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} onKeyDown={e => e.key === 'Enter' && guardar()} /></label>
          <label><span style={lbl}>Color</span>
            <input type="color" style={{ ...inp, width: 52, padding: 3, height: 36 }} value={form.color || '#9B8CFA'} onChange={e => setForm({ ...form, color: e.target.value })} /></label>
          <label style={{ flex: 2, minWidth: 200 }}><span style={lbl}>Descripción (opcional)</span>
            <input style={inp} value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></label>
          <button style={S.btnP} onClick={guardar}>{form.id ? 'Guardar' : 'Crear'}</button>
          <button style={btnMini} onClick={() => { setForm(null); setMsg(''); }}>Cancelar</button>
          {msg && <span style={{ color: '#C0554E', fontSize: 12, width: '100%' }}>{msg}</span>}
        </div>
      )}
      {!lista.length && <Vacio titulo="Sin etiquetas" texto="Crea la primera: sirven para marcar conversaciones, empresas y oportunidades." />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {lista.map(e => (
          <div key={e.id} style={{ ...S.card, borderLeft: `3px solid ${e.color || '#9B8CFA'}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: e.color || '#9B8CFA', flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ fontSize: 13, display: 'block' }}>{e.nombre}</b>
              <span style={{ fontSize: 10.5, color: '#999' }}>{e.uso?.total ? `${e.uso.total} uso${e.uso.total === 1 ? '' : 's'}` : 'Sin usar'}{e.descripcion ? ` · ${e.descripcion}` : ''}</span>
            </span>
            <button title="Editar" onClick={() => setForm({ ...e })} style={btnMini}>Editar</button>
            <button title="Borrar" onClick={() => borrar(e)} style={{ ...btnMini, color: '#C0554E' }}>Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════ Archivos: biblioteca de medios ═════════════
function Archivos() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/media').then(r => r.json()).then(j => setLista(j.archivos || [])).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);
  if (!lista) return <Cargando texto="Cargando archivos…" />;

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true); setMsg('');
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch('/api/crm/whatsapp/media', { method: 'POST', body: fd }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (r?.error) setMsg(`${f.name}: ${r.error}`);
    }
    setSubiendo(false); cargar();
  };
  const borrar = async (a: any) => {
    if (!confirm(`¿Borrar "${a.nombre}" de la biblioteca?`)) return;
    await fetch('/api/crm/whatsapp/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) }).catch(() => {});
    cargar();
  };
  const EMOJI: Record<string, string> = { image: '🖼️', video: '🎬', audio: '🎙️', document: '📄' };

  return (
    <div>
      <Cabecera titulo="Archivos" texto="La biblioteca del clip 📎 del chat: lo que el equipo adjunta seguido (catálogos, listas de precios, fichas)."
        accion={<label style={{ ...S.btnP, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {subiendo ? <Corazones size={9} color="#fff" /> : null}{subiendo ? 'Subiendo…' : 'Subir archivo'}
          <input type="file" multiple style={{ display: 'none' }} onChange={e => { subir(e.target.files); e.target.value = ''; }} />
        </label>} />
      {msg && <Aviso tono="malo">{msg}</Aviso>}
      {!lista.length && <Vacio titulo="Biblioteca vacía" texto="Sube los archivos que el equipo manda seguido: aparecen en el clip del composer." />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
        {lista.map(a => (
          <div key={a.id} style={{ ...S.card, display: 'flex', gap: 10, alignItems: 'center' }}>
            {a.tipo === 'image'
              ? <img src={a.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f4f4f6' }} />
              : <span style={{ width: 44, height: 44, borderRadius: 8, background: '#F6F5FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{EMOJI[a.tipo] || '📄'}</span>}
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ fontSize: 12.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</b>
              <span style={{ fontSize: 10.5, color: '#999' }}>{a.bytes ? `${Math.max(1, Math.round(a.bytes / 1024))} KB · ` : ''}{a.usage_count ? `enviado ${a.usage_count} ${a.usage_count === 1 ? 'vez' : 'veces'}` : 'sin enviar aún'}</span>
            </span>
            <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btnMini, textDecoration: 'none' }}>Ver</a>
            <button onClick={() => borrar(a)} style={{ ...btnMini, color: '#C0554E' }}>Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════ Motivos de cierre ═════════════
function MotivosCierre() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/cierre-categorias?todas=1').then(r => r.json()).then(j => setLista(j.categorias || [])).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);
  if (!lista) return <Cargando texto="Cargando motivos…" />;

  const llamar = async (metodo: string, body: any) => {
    const r = await fetch('/api/crm/whatsapp/cierre-categorias', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(r.error); return false; }
    setMsg(''); cargar(); return true;
  };
  const activos = lista.filter(c => c.activo), archivados = lista.filter(c => !c.activo);

  return (
    <div>
      <Cabecera titulo="Motivos de cierre" texto="Al resolver una conversación el equipo elige POR QUÉ: estos motivos alimentan la métrica de cierres." />
      <div style={{ ...S.card, marginBottom: 14, display: 'flex', gap: 10 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="Nuevo motivo… (p. ej. Cliente pausado)" value={nuevo}
          onChange={e => setNuevo(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && nuevo.trim()) { if (await llamar('POST', { nombre: nuevo })) setNuevo(''); } }} />
        <button style={S.btnP} onClick={async () => { if (nuevo.trim() && await llamar('POST', { nombre: nuevo })) setNuevo(''); }}>Agregar</button>
      </div>
      {msg && <Aviso tono="malo">{msg}</Aviso>}
      {activos.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid #f0eef8', marginBottom: 6, background: '#fff' }}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <button aria-label="Subir" disabled={i === 0} onClick={() => { const a = activos[i - 1]; llamar('PUT', { id: c.id, orden: a.orden }); llamar('PUT', { id: a.id, orden: c.orden }); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: i === 0 ? '#e3e2ea' : '#aaa', fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
            <button aria-label="Bajar" disabled={i === activos.length - 1} onClick={() => { const a = activos[i + 1]; llamar('PUT', { id: c.id, orden: a.orden }); llamar('PUT', { id: a.id, orden: c.orden }); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: i === activos.length - 1 ? '#e3e2ea' : '#aaa', fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
          </span>
          {editando?.id === c.id ? (
            <input autoFocus style={{ ...inp, flex: 1 }} value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })}
              onKeyDown={async e => { if (e.key === 'Enter') { if (await llamar('PUT', { id: c.id, nombre: editando.nombre })) setEditando(null); } if (e.key === 'Escape') setEditando(null); }}
              onBlur={() => setEditando(null)} />
          ) : (
            <b style={{ fontSize: 13, flex: 1 }}>{c.nombre}</b>
          )}
          <button style={btnMini} onClick={() => setEditando({ id: c.id, nombre: c.nombre })}>Renombrar</button>
          <button style={{ ...btnMini, color: '#C0554E' }} onClick={() => llamar('DELETE', { id: c.id })}>Archivar</button>
        </div>
      ))}
      {archivados.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ fontSize: 11.5, color: '#999', cursor: 'pointer' }}>Archivados ({archivados.length}) — los cierres viejos los conservan</summary>
          {archivados.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', color: '#aaa', fontSize: 12.5 }}>
              <s>{c.nombre}</s><span style={{ flex: 1 }} />
              <button style={btnMini} onClick={() => llamar('PUT', { id: c.id, activo: true })}>Restaurar</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

// ═════════════ Pagos de Meta ═════════════
function PagosMeta() {
  const [setup, setSetup] = useState<any>(null);
  useEffect(() => { fetch('/api/crm/whatsapp/setup').then(r => r.json()).then(setSetup).catch(() => setSetup({})); }, []);
  const waba = setup?.numeros?.[0]?.business_account_id || '';
  const url = waba
    ? `https://business.facebook.com/billing_hub/accounts?asset_id=${waba}`
    : 'https://business.facebook.com/billing_hub/accounts';
  return (
    <div style={{ ...S.card, marginBottom: 16, borderLeft: '3px solid #E8A838', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ minWidth: 240, flex: 1 }}>
        <b style={{ fontSize: 13.5, display: 'block' }}>Pagos de Meta</b>
        <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.5, display: 'block', marginTop: 2 }}>
          Las plantillas de marketing/utilidad y las llamadas se cobran a tu método de pago en Meta.
          Si un envío falla con "problema de pago" (error 131042), es aquí donde se arregla: método de pago vigente y saldo.
        </span>
      </span>
      <a href={url} target="_blank" rel="noreferrer" style={{ ...S.btnP, textDecoration: 'none', whiteSpace: 'nowrap' }}>Abrir facturación de Meta ↗</a>
    </div>
  );
}

// ═════════════ piecitas compartidas ═════════════
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e6e4f0', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', background: '#fff' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#999', marginBottom: 3 };
const btnMini: React.CSSProperties = { border: '1px solid #ececf4', background: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#666', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };

function Cabecera({ titulo, texto, accion }: { titulo: string; texto: string; accion?: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 15, display: 'block' }}>{titulo}</b>
        <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.5 }}>{texto}</span>
      </span>
      {accion}
    </div>
  );
}
