// WHATSAPP · Configuración unificada: TODO el catálogo que el usuario puede
// personalizar del inbox vive aquí — plantillas de Meta, snippets, etiquetas,
// archivos, etapas del ciclo de vida, motivos de cierre, automatización y el
// número (salud, perfil y pagos de Meta). Antes estaba regado en 4 lugares.
import { useEffect, useState } from 'react';
import { useIsMobile } from '../../../../lib/ui/mobile';
import { S, Aviso, Vacio } from '../email/ui';
import { C } from './estilo';
import Cargando, { Corazones } from '../ui/Cargando';
import { PlantillasMeta, Snippets } from './Plantillas';
import EtapasModal from './EtapasModal';
import AjustesWA from './AjustesWA';
import NumeroWA from './NumeroWA';
import { confirmar } from '../../../../lib/ui/confirmar';

export type Seccion = 'plantillas' | 'snippets' | 'etiquetas' | 'archivos' | 'etapas' | 'motivos' | 'automatizacion' | 'numero' | 'telefonia' | 'duplicados';

export const SECCIONES: { id: Seccion; label: string; desc: string }[] = [
  { id: 'plantillas', label: 'Plantillas de Meta', desc: 'Mensajes aprobados para abrir conversación' },
  { id: 'snippets', label: 'Snippets', desc: 'Respuestas rápidas con "/" en el chat' },
  { id: 'etiquetas', label: 'Etiquetas', desc: 'El catálogo transversal del CRM' },
  { id: 'archivos', label: 'Archivos', desc: 'Biblioteca de medios para adjuntar' },
  { id: 'etapas', label: 'Ciclo de vida', desc: 'Las etapas del contacto' },
  { id: 'motivos', label: 'Motivos de cierre', desc: 'Por qué se resuelve una conversación' },
  { id: 'automatizacion', label: 'Automatización', desc: 'Bienvenida, horario, asignación' },
  { id: 'numero', label: 'Número y pagos', desc: 'Salud, perfil y facturación de Meta' },
  { id: 'telefonia', label: 'Telefonía', desc: 'Llamadas normales con número de México' },
  { id: 'duplicados', label: 'Duplicados', desc: 'Contactos repetidos, para fusionar' },
];

export default function ConfigWhatsApp({ inicial }: { inicial?: Seccion }) {
  const esMovilCfg = useIsMobile();
  const [sec, setSec] = useState<Seccion>(inicial || 'plantillas');
  useEffect(() => {
    // Deep-link: ?tab=wa-config&sec=numero
    try { const s = new URLSearchParams(window.location.search).get('sec') as Seccion | null; if (s && SECCIONES.some(x => x.id === s)) setSec(s); } catch { /* SSR */ }
  }, []);

  // En el teléfono no caben dos columnas: el menú de 228 px dejaba el
  // contenido en 140 y todo salía cortado. Una sola columna, con las secciones
  // como una tira de pestañas arriba.
  return (
    <div style={{ ...S.wrap, display: 'flex', flexDirection: esMovilCfg ? 'column' : 'row', gap: esMovilCfg ? 12 : 22, alignItems: esMovilCfg ? 'stretch' : 'flex-start' }}>
      {/* OJO: crm.astro esconde todo <nav> del sitio con display:none — aside, no nav */}
      <aside className={esMovilCfg ? 'mod-tabs crm-scroll-x' : undefined}
        style={esMovilCfg
          ? { display: 'flex', gap: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }
          : { width: 228, flexShrink: 0, position: 'sticky', top: 34 }}>
        {!esMovilCfg && <p style={{ fontSize: '0.62rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2px 0 8px 10px' }}>Configuración WhatsApp</p>}
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => setSec(s.id)} className={esMovilCfg && sec === s.id ? 'seg-on' : undefined} style={esMovilCfg ? {
            flex: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            borderRadius: 9, padding: '0 12px', minHeight: 40, fontSize: 13, fontWeight: sec === s.id ? 800 : 600,
            background: sec === s.id ? '#EEECFE' : 'transparent', color: sec === s.id ? '#5B4BD6' : '#83808e',
          } : {
            display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 9, padding: '8px 11px', marginBottom: 2,
            background: sec === s.id ? '#EEECFE' : 'transparent',
          }}>
            <b style={{ fontSize: esMovilCfg ? 13 : 12.5, color: sec === s.id ? '#5B4BD6' : (esMovilCfg ? '#83808e' : '#444'), display: 'block' }}>{s.label}</b>
            {!esMovilCfg && <span style={{ fontSize: 10.5, color: sec === s.id ? '#7C6BF0' : '#999', display: 'block', marginTop: 1 }}>{s.desc}</span>}
          </button>
        ))}
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}><SeccionWA id={sec} /></div>
    </div>
  );
}

/**
 * UNA sección suelta. Existe porque estos ajustes ya no viven solo aquí: la
 * Configuración del sistema los muestra como renglones propios, cada uno con su
 * nombre y su explicación, junto a los ajustes de todo lo demás. Tener el
 * cuerpo en un solo lugar es lo que evita que las dos pantallas se separen con
 * el tiempo — que es exactamente como esto acabó regado en 4 sitios la vez
 * pasada.
 */
export function SeccionWA({ id }: { id: Seccion }) {
  if (id === 'plantillas') return <PlantillasMeta />;
  if (id === 'snippets') return <Snippets />;
  if (id === 'etiquetas') return <EtiquetasCatalogo />;
  if (id === 'archivos') return <Archivos />;
  if (id === 'etapas') return <EtapasModal inline />;
  if (id === 'motivos') return <MotivosCierre />;
  if (id === 'automatizacion') return <AjustesWA inline />;
  if (id === 'numero') return (<><PagosMeta /><NumeroWA /></>);
  if (id === 'telefonia') return <Telefonia />;
  if (id === 'duplicados') return <Duplicados />;
  return null;
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
    if (!await confirmar(`¿Borrar la etiqueta "${e.nombre}"? Se quita de las ${e.uso?.total || 0} cosas que la llevan.`)) return;
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
              <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</b>
              <span title={e.descripcion || undefined} style={{ fontSize: 10.5, color: '#999', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.uso?.total ? `${e.uso.total} uso${e.uso.total === 1 ? '' : 's'}` : 'Sin usar'}{e.descripcion ? ` · ${e.descripcion}` : ''}</span>
            </span>
            {/* Columna FIJA de acciones: la descripción larga no debe envolver los botones */}
            <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
              <button title="Editar" onClick={() => setForm({ ...e })} style={btnMini}>Editar</button>
              <button title="Borrar" onClick={() => borrar(e)} style={{ ...btnMini, color: '#C0554E' }}>Borrar</button>
            </span>
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
    if (!await confirmar(`¿Borrar "${a.nombre}" de la biblioteca?`)) return;
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

// ═════════════ Duplicados: detectar a un clic, fusionar con dos ═════════════
function Duplicados() {
  const [pares, setPares] = useState<any[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState('');
  const [fusionando, setFusionando] = useState<string | null>(null);
  const buscar = async () => {
    setCargando(true); setMsg('');
    const j = await fetch('/api/crm/contactos-duplicados').then(r => r.json()).catch(e => ({ error: String(e) }));
    setCargando(false);
    if (j?.error) { setMsg(j.error); return; }
    setPares(j.pares || []);
  };
  const fusionar = async (keep: any, merge: any, par: any) => {
    if (!await confirmar(`Conservar a "${keep.nombre}" y fusionarle todo lo de "${merge.nombre}" (mensajes, cotizaciones, reuniones, visitas). La ficha de "${merge.nombre}" se archiva. ¿Seguro?`)) return;
    setFusionando(par.llave);
    const r = await fetch('/api/crm/contacts/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keep_id: keep.id, merge_id: merge.id }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setFusionando(null);
    if (r?.error) { setMsg(r.error); return; }
    setPares(p => (p || []).filter(x => x.llave !== par.llave));
  };
  const lado = (x: any, otro: any, par: any) => (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid #efedf6', borderRadius: 9, padding: '8px 10px' }}>
      <b style={{ fontSize: 12.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</b>
      <span style={{ fontSize: 10.5, color: '#888', display: 'block', lineHeight: 1.5 }}>
        {x.empresa || 'sin empresa'}{x.tel ? ` · ${x.tel}` : ''}{x.email ? ` · ${x.email}` : ''}
        <br />{x.msjs} mensaje{x.msjs === 1 ? '' : 's'} · desde {x.creado}
      </span>
      <button disabled={fusionando === par.llave} onClick={() => fusionar(x, otro, par)}
        style={{ marginTop: 6, border: '1px solid #d9d3f8', background: '#F6F5FE', color: '#5B4BD6', borderRadius: 7, padding: '4px 10px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Conservar este</button>
    </div>
  );
  return (
    <div>
      <Cabecera titulo="Contactos duplicados" texto="La misma persona con dos fichas parte su historial en dos. El detector busca por teléfono, correo y nombre+empresa; TÚ decides qué ficha sobrevive — nada se fusiona solo."
        accion={<button style={S.btnP} onClick={buscar} disabled={cargando}>{cargando ? <Corazones size={9} color="#fff" /> : pares ? 'Buscar de nuevo' : 'Buscar duplicados'}</button>} />
      {msg && <Aviso tono="malo">{msg}</Aviso>}
      {pares === null && !cargando && <Vacio titulo="Sin buscar todavía" texto="El análisis corre solo cuando tú lo pides: pulsa «Buscar duplicados»." />}
      {pares !== null && !pares.length && <Vacio titulo="Sin duplicados" texto="Ningún par de contactos comparte teléfono, correo, ni nombre con la misma empresa." />}
      {(pares || []).map((p: any) => {
        p.llave = p.llave || `${p.a_id}|${p.b_id}`;
        const a = { id: p.a_id, nombre: p.a_nombre, empresa: p.a_empresa, tel: p.a_tel, email: p.a_email, msjs: p.a_msjs, creado: p.a_creado };
        const b = { id: p.b_id, nombre: p.b_nombre, empresa: p.b_empresa, tel: p.b_tel, email: p.b_email, msjs: p.b_msjs, creado: p.b_creado };
        return (
          <div key={p.llave} style={{ ...S.card, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, background: p.confianza >= 90 ? '#FEF0EF' : '#FFF4E5', color: p.confianza >= 90 ? '#C0554E' : '#9a6a10', borderRadius: 999, padding: '2px 9px' }}>{p.motivo} · {p.confianza}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>{lado(a, b, p)}{lado(b, a, p)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════ Telefonía (Twilio): estado + guía de alta ═════════════
function Telefonia() {
  const [st, setSt] = useState<any>(null);
  useEffect(() => { fetch('/api/crm/telefonia/setup').then(r => r.json()).then(setSt).catch(() => setSt({ configurada: false, faltantes: [] })); }, []);
  const paso = (n: number, titulo: string, detalle: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid #f2f0fa' }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: '#EEECFE', color: '#5B4BD6', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <span style={{ minWidth: 0 }}><b style={{ fontSize: 12.5, display: 'block' }}>{titulo}</b><span style={{ fontSize: 11.5, color: '#777', lineHeight: 1.55 }}>{detalle}</span></span>
    </div>
  );
  return (
    <div>
      <Cabecera titulo="Telefonía (llamadas normales)" texto="Llamadas de voz a cualquier teléfono, con un número de México como identificador. Al colgar, la llamada se transcribe y la minuta cae sola en la conversación, el panel y la ficha — igual que las de WhatsApp." />
      {!st ? <Cargando texto="Revisando la configuración…" /> : st.configurada ? (
        <div style={{ ...S.card, borderLeft: '3px solid #4FBF95', marginBottom: 14 }}>
          <b style={{ fontSize: 13, color: '#1E8A63' }}>Telefonía activa</b>
          <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.7 }}>
            <div>Número: <b>{st.numero}</b></div>
            {st.saldo && <div>Saldo en Twilio: <b>{st.saldo}</b></div>}
            {st.webhook_ok === false && <div style={{ color: '#C0554E' }}>⚠️ La TwiML App no apunta a nuestro webhook de voz: las llamadas no van a conectar.</div>}
            <div style={{ color: '#888', marginTop: 4 }}>Para llamar: abre un chat → ícono de teléfono → "Llamada telefónica normal".</div>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, borderLeft: '3px solid #E8A838', marginBottom: 14 }}>
          <b style={{ fontSize: 13, color: '#9a6a10' }}>Falta configurar</b>
          <p style={{ fontSize: 11.5, color: '#777', margin: '4px 0 0' }}>Variables pendientes en Vercel: {(st.faltantes || []).join(' · ') || '—'}</p>
        </div>
      )}
      {st?.configurada && <CallerId />}
      {st?.configurada && <Fernanda />}
      {st?.configurada && <Aprendido />}
      <ReglasLlamadas />
      <EnvioMinuta />
      <div style={{ ...S.card }}>
        <b style={{ fontSize: 13 }}>Cómo darse de alta (Twilio)</b>
        {paso(1, 'Crear la cuenta', <>En <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noreferrer">twilio.com/try-twilio</a> con tu correo; verifica tu celular.</>)}
        {paso(2, 'Cargar saldo', 'Console → Billing → agrega tarjeta y carga el mínimo ($20 USD). Las llamadas a celular en México cuestan ≈ $0.05 USD/min; a fijo ≈ $0.02.')}
        {paso(3, 'Regulatory Bundle de México', 'Phone Numbers → Regulatory Compliance → New Bundle (Mexico · Local). Piden dirección en México con comprobante de domicilio menor a 1 año (CFE/Telmex) e identificación (INE/pasaporte). Aprobación: 1 a 3 días hábiles.')}
        {paso(4, 'Comprar el número', 'Phone Numbers → Buy a Number → México → Local (ej. lada 55). Cuesta $6.25 USD/mes.')}
        {paso(5, 'Conectarlo al CRM', 'Comparte el Account SID y Auth Token con el equipo técnico: con eso se crea la API Key, la TwiML App y se configuran los webhooks. Cinco minutos después ya marcas desde cualquier chat.')}
      </div>
    </div>
  );
}

// ═════════════ Fernanda al teléfono (la voz de la IA) ═════════════
/**
 * La voz que hace las llamadas sola (modo «Fernanda» en Llamadas inteligentes).
 * Aquí se elige la voz, si dice que es IA cuando le preguntan, cuánto dura el
 * discovery que agenda, el tope de gasto por día y el anexo del dueño al guion.
 * El estado de la central (el proceso que conversa) se consulta en vivo.
 */
function Fernanda() {
  const [d, setD] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const cargar = () => fetch('/api/crm/telefonia/fernanda', { cache: 'no-store' }).then(r => r.json()).then(j => { setD(j); setC(j.config || null); }).catch(() => setD({ error: 'sin red' }));
  useEffect(() => { cargar(); }, []);
  const guardar = async () => {
    if (!c) return;
    setOcupado(true); setError(''); setOk('');
    const r = await fetch('/api/crm/telefonia/fernanda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: c }) }).then(x => x.json()).catch(() => ({ error: 'sin red' }));
    setOcupado(false);
    if (r?.error) { setError(r.error); return; }
    setOk('Guardado. Aplica en la siguiente llamada.'); setC(r.config);
  };
  if (!d) return <div style={{ ...S.card, marginBottom: 14 }}><Cargando texto="Consultando a Fernanda…" /></div>;
  const central = d.central || {};
  const viva = !!central.ok;
  const campo: React.CSSProperties = { width: '100%', border: '1px solid #e2e2e2', borderRadius: 8, padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' };
  const etiqueta: React.CSSProperties = { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', fontWeight: 700, display: 'block', marginBottom: 4 };
  const fila = (t: string, v: any) => <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555' }}><span style={{ color: '#999', minWidth: 120 }}>{t}</span><b>{v}</b></div>;
  return (
    <div style={{ ...S.card, marginBottom: 14, borderLeft: `3px solid ${viva ? '#4FBF95' : '#E8A838'}` }}>
      <b style={{ fontSize: 13.5, display: 'block' }}>Fernanda al teléfono</b>
      <p style={{ fontSize: 11.5, color: '#888', margin: '3px 0 12px', lineHeight: 1.55 }}>
        La voz de la IA que hace llamadas sola: se presenta, entiende el negocio, agenda el discovery o la demo y sigue con el siguiente. Se elige en Llamadas inteligentes con «Quién habla». Lo que aprendió el agente de WhatsApp (guion, wiki, reglas) lo usa también aquí, hablando de usted.
      </p>
      {!d.configurada ? (
        <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '8px 12px', fontSize: 12 }}>Falta el secreto de la central (VOZ_SECRET) en las variables de Vercel. Sin él, «Quién habla» solo ofrece «Yo».</div>
      ) : (
        <div style={{ display: 'grid', gap: 5, marginBottom: 12 }}>
          {fila('La central', viva ? `viva · ${central.vivas || 0} llamadas ahora · ${central.atendidas || 0} atendidas desde que arrancó` : `no responde${central.error ? ` (${central.error})` : ''}`)}
          {viva && fila('Motor voz-a-voz', central.openai ? `OpenAI ${central.openai}` : 'sin llave de OpenAI en la central')}
          {viva && fila('Cerebro (motor por partes)', `${central.modelo || '?'}${central.cerebro ? '' : ' · sin llave de Anthropic'}`)}
          {fila('Gasto de hoy', `US$ ${Number(d.gasto_hoy_usd || 0).toFixed(2)} de ${Number(c?.tope_dia_usd || 0)} (al llegar al tope las sesiones se pausan solas)`)}
        </div>
      )}
      {c && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={etiqueta}>Cómo habla</label>
            <select value={c.motor === 'relay' ? 'relay' : 'openai'} disabled={!d.puede_editar} onChange={e => setC({ ...c, motor: e.target.value })} style={campo}>
              <option value="openai">Voz a voz (OpenAI): oye y contesta en la misma red, más natural y rápida</option>
              <option value="relay">Por partes (Deepgram + Claude + ElevenLabs): voces mexicanas grabadas, más lenta</option>
            </select>
          </div>
          <div>
            <label style={etiqueta}>Su voz</label>
            <div style={{ display: 'grid', gap: 6 }}>
              {c.motor !== 'relay' && (d.voces_openai || []).map((v: any) => (
                <label key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#444', cursor: d.puede_editar ? 'pointer' : 'default' }}>
                  <input type="radio" name="voz_openai" checked={(c.voz_openai || 'marin') === v.id} disabled={!d.puede_editar} onChange={() => setC({ ...c, voz_openai: v.id })} style={{ marginTop: 3 }} />
                  <span><b>{v.nombre}</b> <span style={{ color: '#888' }}>· {v.nota}</span></span>
                </label>
              ))}
              {c.motor === 'relay' && (d.voces || []).map((v: any) => (
                <label key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#444', cursor: d.puede_editar ? 'pointer' : 'default' }}>
                  <input type="radio" name="voz" checked={c.voz === v.id} disabled={!d.puede_editar} onChange={() => setC({ ...c, voz: v.id })} style={{ marginTop: 3 }} />
                  <span><b>{v.nombre}</b> <span style={{ color: '#888' }}>· {v.nota}</span></span>
                </label>
              ))}
              {c.motor === 'relay' && c.voz && !(d.voces || []).some((v: any) => v.id === c.voz) && <span style={{ fontSize: 11.5, color: '#888' }}>Voz personalizada: {c.voz}</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={etiqueta}>Si le preguntan si es un robot</label>
              <select value={c.revelar_ia ? 'si' : 'no'} disabled={!d.puede_editar} onChange={e => setC({ ...c, revelar_ia: e.target.value === 'si' })} style={campo}>
                <option value="si">Dice que es la asistente virtual del equipo</option>
                <option value="no">Cambia de tema con naturalidad</option>
              </select>
            </div>
            <div>
              <label style={etiqueta}>Discovery que agenda</label>
              <select value={String(c.discovery_min)} disabled={!d.puede_editar} onChange={e => setC({ ...c, discovery_min: Number(e.target.value) })} style={campo}>
                {[15, 30, 45, 60].map(n => <option key={n} value={n}>{n} minutos</option>)}
              </select>
            </div>
            <div>
              <label style={etiqueta}>Tope de gasto por día (USD)</label>
              <input type="number" min={1} max={2000} value={c.tope_dia_usd} disabled={!d.puede_editar} onChange={e => setC({ ...c, tope_dia_usd: e.target.value })} style={campo} />
            </div>
            <div>
              <label style={etiqueta}>Máximo por llamada (minutos)</label>
              <input type="number" min={3} max={30} value={c.max_min_llamada} disabled={!d.puede_editar} onChange={e => setC({ ...c, max_min_llamada: e.target.value })} style={campo} />
            </div>
          </div>
          <div>
            <label style={etiqueta}>Instrucciones tuyas para las llamadas (mandan sobre el guion)</label>
            <textarea value={c.anexo || ''} disabled={!d.puede_editar} onChange={e => setC({ ...c, anexo: e.target.value })} rows={3} placeholder="Ej.: esta semana ofrece primero la demo de joyería; no menciones precios por teléfono." style={{ ...campo, resize: 'vertical' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#444', cursor: d.puede_editar ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={!!c.encendida} disabled={!d.puede_editar} onChange={e => setC({ ...c, encendida: e.target.checked })} /> Fernanda puede hacer llamadas
          </label>
          {error && <div style={{ fontSize: 12, color: '#C0554E' }}>{error}</div>}
          {ok && <div style={{ fontSize: 12, color: '#1E8A63' }}>{ok}</div>}
          {d.puede_editar && (
            <div>
              <button onClick={guardar} disabled={ocupado} style={{ ...S.btnP, opacity: ocupado ? 0.6 : 1 }}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}
          {(d.pruebas || []).length > 0 && (
            <div>
              <span style={etiqueta}>Últimas llamadas de prueba</span>
              <div style={{ display: 'grid', gap: 4 }}>
                {d.pruebas.map((p: any) => (
                  <div key={p.id} style={{ fontSize: 12, color: '#555' }}>
                    <span style={{ color: '#999' }}>{new Date(p.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {' · '}{p.resumen?.motivo || '—'}{p.resumen?.duracionS ? ` · ${p.resumen.duracionS} s` : ''}{p.resumen?.turnos != null ? ` · ${p.resumen.turnos} turnos` : ''}{p.resumen?.latencia?.mediana ? ` · responde en ${(p.resumen.latencia.mediana / 1000).toFixed(1)} s (p95 ${(p.resumen.latencia.p95 / 1000).toFixed(1)} s)` : ''}{p.resumen?.costoUsd != null ? ` · US$ ${Number(p.resumen.costoUsd).toFixed(3)}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════ Lo que el marcador aprende ═════════════
/**
 * Dos memorias del marcador de «Llamadas inteligentes»: las frases que
 * engañaron al detector de buzón/persona (el vendedor corrigió y la frase
 * queda propuesta hasta que el dueño la apruebe) y lo que ya se contestó
 * sobre qué mandarle al cliente (el cierre con IA lo reutiliza y arma el PDF).
 */
function Aprendido() {
  const [d, setD] = useState<any>(null);
  const [edit, setEdit] = useState<{ id: string; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState('');
  const cargar = () => fetch('/api/crm/telefonia/reglas', { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.error ? { error: j.error, reglas: [], conocimiento: [] } : j)).catch(() => setD({ error: 'No se pudo cargar lo aprendido. Revisa tu conexión.', reglas: [], conocimiento: [] }));
  useEffect(() => { cargar(); }, []);
  const post = async (cuerpo: any) => {
    setOcupado(cuerpo.id);
    const r = await fetch('/api/crm/telefonia/reglas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(x => x.json()).catch(() => ({ error: 'sin red' }));
    setOcupado('');
    if (r?.error) setD((x: any) => ({ ...(x || {}), error: r.error })); else { setD((x: any) => ({ ...(x || {}), error: '' })); setEdit(null); cargar(); }
  };
  if (!d) return <div style={{ ...S.card, marginBottom: 14 }}><Cargando texto="Cargando lo aprendido…" /></div>;
  const reglas: any[] = d.reglas || [], conocimiento: any[] = d.conocimiento || [];
  const puedeEditar = !!d.puede_editar;   // solo el dueño aprueba o quita (el servidor lo exige; aquí no se enseñan botones que van a fallar)
  const propuestas = reglas.filter(r => r.estado === 'propuesta');
  const activas = reglas.filter(r => r.estado === 'activa');
  const pill = (texto: string, bg: string, color: string) => <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: bg, color, letterSpacing: .3, textTransform: 'uppercase' }}>{texto}</span>;
  const btn = (texto: string, onClick: () => void, primario = false, peligro = false): React.ReactNode => (
    <button onClick={onClick} disabled={!!ocupado} style={{ cursor: 'pointer', fontFamily: 'inherit', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700,
      background: primario ? '#9B8CFA' : '#fff', color: primario ? '#fff' : peligro ? '#C0554E' : '#5B4BD6', border: `1.5px solid ${primario ? '#9B8CFA' : peligro ? '#f0c4bd' : '#9B8CFA'}`, opacity: ocupado ? .6 : 1 }}>{texto}</button>
  );
  const fila = (r: any) => (
    <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f2f0fa' }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {pill(r.tipo === 'buzon' ? 'suena a máquina' : 'suena a persona', r.tipo === 'buzon' ? '#FFF4E5' : '#EAF8F2', r.tipo === 'buzon' ? '#9a6a10' : '#1E8A63')}
          <b style={{ fontSize: 12.5 }}>«{r.patron}»</b>
          {r.veces > 1 && <span style={{ fontSize: 10.5, color: '#888' }}>{r.veces} veces</span>}
        </span>
        {r.ejemplo && <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 3, lineHeight: 1.5 }}>Se oyó: «{r.ejemplo}»</span>}
      </span>
      <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {puedeEditar && r.estado === 'propuesta' && btn('Aprobar', () => post({ accion: 'aprobar', id: r.id }), true)}
        {puedeEditar && btn(r.estado === 'propuesta' ? 'Descartar' : 'Quitar', async () => { if (await confirmar(r.estado === 'propuesta' ? `¿Descartar la frase «${r.patron}»? El detector no la va a aprender.` : `¿Quitar la frase «${r.patron}»? El detector deja de usarla en las siguientes llamadas.`)) post({ accion: 'descartar', id: r.id }); }, false, true)}
      </span>
    </div>
  );
  return (
    <div style={{ ...S.card, marginBottom: 14, borderLeft: `3px solid ${propuestas.length ? '#E8A838' : '#9B8CFA'}` }}>
      <b style={{ fontSize: 13.5, display: 'block' }}>Lo que el marcador aprende</b>
      {d.error && <div style={{ marginTop: 8 }}><Aviso tono="malo">{d.error}</Aviso></div>}
      {!puedeEditar && <span style={{ fontSize: 11, color: '#999', display: 'block', marginTop: 3 }}>Solo el dueño aprueba o quita lo aprendido.</span>}
      <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.55, display: 'block', marginTop: 3 }}>
        Cuando el vendedor toma una llamada que el detector creía buzón —o salta una que creía persona— la frase
        que lo engañó queda aquí propuesta. Al aprobarla, el detector la usa en las siguientes llamadas.
      </span>
      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', letterSpacing: .3, textTransform: 'uppercase' }}>Frases que engañaron al detector</span>
        {propuestas.length > 0 && <span style={{ marginLeft: 8 }}>{pill(`${propuestas.length} por revisar`, '#FFF4E5', '#9a6a10')}</span>}
        {!reglas.length && <p style={{ fontSize: 11.5, color: '#999', margin: '6px 0 0' }}>Todavía no hay correcciones: se llenan solas conforme el vendedor use el marcador.</p>}
        {propuestas.map(fila)}
        {activas.length > 0 && <div style={{ fontSize: 10.5, color: '#999', marginTop: 8 }}>Activas ({activas.length})</div>}
        {activas.map(fila)}
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f2f0fa' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', letterSpacing: .3, textTransform: 'uppercase' }}>Lo que ya sabemos mandar</span>
        <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.55, display: 'block', marginTop: 3 }}>
          Cada vez que en una llamada se promete mandar algo y el vendedor contesta qué, la respuesta se guarda aquí.
          La próxima vez el cierre arma el PDF solo y lo manda por WhatsApp.
        </span>
        {!conocimiento.length && <p style={{ fontSize: 11.5, color: '#999', margin: '6px 0 0' }}>Nada todavía. El primer «¿qué le mandamos sobre…?» de la cabina lo estrena.</p>}
        {conocimiento.map(k => (
          <div key={k.id} style={{ padding: '8px 0', borderBottom: '1px solid #f2f0fa' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 12.5 }}>{k.tema}</b>
                <span style={{ fontSize: 10.5, color: '#888', marginLeft: 6 }}>{k.veces_usado ? `se mandó ${k.veces_usado} ${k.veces_usado === 1 ? 'vez' : 'veces'}` : 'sin usar aún'}{k.origen ? ` · ${k.origen}` : ''}</span>
                {edit?.id !== k.id && <span style={{ fontSize: 11.5, color: '#666', display: 'block', marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{String(k.texto || '').slice(0, 280)}{String(k.texto || '').length > 280 ? '…' : ''}</span>}
              </span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {puedeEditar && edit?.id !== k.id && btn('Editar', () => setEdit({ id: k.id, texto: k.texto || '' }))}
                {puedeEditar && btn('Quitar', async () => { if (await confirmar(`¿Quitar «${k.tema}»? La próxima vez que lo pidan, la cabina va a volver a preguntar qué mandar.`)) post({ accion: 'conocimiento_quitar', id: k.id }); }, false, true)}
              </span>
            </div>
            {edit && edit.id === k.id && (
              <div style={{ marginTop: 8 }}>
                <textarea value={edit.texto} onChange={e => setEdit({ id: k.id, texto: e.target.value })} rows={6}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {btn('Guardar', () => post({ accion: 'conocimiento_editar', id: k.id, texto: edit?.texto || '' }), true)}
                  {btn('Cancelar', () => setEdit(null))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════ Caller ID: el número que ve el cliente ═════════════
/**
 * Twilio marca desde SU número, pero el cliente conoce el de ventas (el del
 * WhatsApp). Si le llamamos desde otro, no lo reconoce y no contesta, y si
 * devuelve la llamada le contesta una grabación. Twilio deja usar el de ventas
 * como remitente una vez que lo VERIFICA: le llama y hay que teclear un código.
 * Esta tarjeta hace ese trámite y guarda con cuál salen las llamadas.
 */
function CallerId() {
  const [d, setD] = useState<any>(null);
  const [tel, setTel] = useState('');
  const [codigo, setCodigo] = useState<{ codigo: string; telefono: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const cargar = () => fetch('/api/crm/telefonia/caller-id').then(r => r.json()).then(setD).catch(() => setD({ error: 'sin red' }));
  useEffect(() => { cargar(); }, []);
  const post = async (cuerpo: any) => {
    setOcupado(true); setError(''); setOk('');
    const r = await fetch('/api/crm/telefonia/caller-id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(x => x.json()).catch(() => ({ error: 'sin red' }));
    setOcupado(false);
    if (r?.error) { setError(r.error); return null; }
    return r;
  };
  const verificar = async () => {
    const r = await post({ accion: 'verificar', telefono: tel, nombre: 'Sacscloud ventas' });
    if (r) setCodigo({ codigo: r.codigo, telefono: r.telefono });
  };
  const usar = async (telefono: string | null) => {
    const r = await post({ accion: 'usar', telefono });
    if (r) { setOk(`Desde ahora las llamadas salen con ${r.actual}.`); setCodigo(null); cargar(); }
  };
  if (!d) return <div style={{ ...S.card, marginBottom: 14 }}><Cargando texto="Consultando los números…" /></div>;
  const verificados: { telefono: string; nombre: string | null }[] = d.verificados || [];
  const actual: string | null = d.actual || d.twilio;
  const fmt = (t: string) => t.replace(/^\+52(\d{3})(\d{3})(\d{4})$/, '+52 $1 $2 $3').replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1 $2 $3');
  const opciones = [{ telefono: d.twilio, nombre: 'Número de Twilio' }, ...verificados.filter(v => v.telefono !== d.twilio)];
  return (
    <div style={{ ...S.card, marginBottom: 14, borderLeft: '3px solid #9B8CFA' }}>
      <b style={{ fontSize: 13.5, display: 'block' }}>El número que ve el cliente</b>
      <p style={{ fontSize: 11.5, color: '#888', margin: '3px 0 12px', lineHeight: 1.55 }}>
        Las llamadas salen hoy con <b style={{ color: '#5B4BD6' }}>{fmt(actual || '')}</b>. Lo ideal es que salgan con el mismo número del WhatsApp de ventas: el cliente lo reconoce, contesta más, y si devuelve la llamada le cae al WhatsApp. Para eso Twilio primero lo verifica: llama a ese número y hay que teclear un código.
      </p>
      <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        {opciones.map(o => {
          const activo = o.telefono === actual;
          return (
            <div key={o.telefono} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', border: `1px solid ${activo ? '#9B8CFA' : '#ececf4'}`, background: activo ? '#EEECFE' : '#fff', borderRadius: 9 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: activo ? '#5B4BD6' : '#d9d6ea', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}><b>{fmt(o.telefono)}</b> <span style={{ color: '#888' }}>· {o.nombre || 'verificado'}</span></span>
              {activo ? <span style={{ fontSize: 11, fontWeight: 800, color: '#5B4BD6' }}>En uso</span>
                : <button type="button" style={btnMini} disabled={ocupado} onClick={() => usar(o.telefono === d.twilio ? null : o.telefono)}>Usar este</button>}
            </div>
          );
        })}
      </div>
      <div style={{ paddingTop: 12, borderTop: '1px solid #f2f0fa' }}>
        <label style={lbl}>Verificar otro número (el de ventas)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inp, maxWidth: 240 }} placeholder="+52 55 9302 7234" value={tel} onChange={e => setTel(e.target.value)} disabled={ocupado} />
          <button type="button" style={{ ...S.btnP, opacity: ocupado || !tel.trim() ? 0.6 : 1 }} disabled={ocupado || !tel.trim()} onClick={verificar}>
            {ocupado ? <Corazones size={9} color="#fff" /> : 'Que Twilio me llame'}
          </button>
        </div>
        {codigo && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#EEECFE', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: '#4536BE', lineHeight: 1.55 }}>
              Twilio está llamando a <b>{fmt(codigo.telefono)}</b>. Contesta y teclea este código:
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#5B4BD6', letterSpacing: 6, margin: '6px 0', fontVariantNumeric: 'tabular-nums' }}>{codigo.codigo}</div>
            <div style={{ fontSize: 11.5, color: '#666', marginBottom: 8 }}>Cuando lo hayas tecleado, el número queda verificado y lo puedes poner en uso.</div>
            <button type="button" style={S.btnP} disabled={ocupado} onClick={() => usar(codigo.telefono)}>Ya tecleé el código · usar este número</button>
          </div>
        )}
        {error && <div style={{ marginTop: 10 }}><Aviso tono="malo">{error}</Aviso></div>}
        {ok && <div style={{ marginTop: 10 }}><Aviso tono="ok">{ok}</Aviso></div>}
      </div>
    </div>
  );
}

// ═════════════ piecitas compartidas ═════════════
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e6e4f0', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', background: '#fff' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#999', marginBottom: 3 };
const btnMini: React.CSSProperties = { border: '1px solid #ececf4', background: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#666', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };

// ═════════════ Envío automático de la minuta en PDF ═════════════
/**
 * «Al terminar la llamada, mándale el PDF de la minuta al cliente.»
 *
 * La complicación no es el envío, es CUÁNDO deja Meta mandar un archivo: solo
 * en las 24 h siguientes al último mensaje del cliente. Una llamada no abre esa
 * ventana, así que el caso más común —le llamaste a alguien que nunca te ha
 * escrito— cae del lado en que Meta no deja. Esta pantalla existe para que eso
 * quede claro ANTES de prenderlo, y no como una sorpresa después.
 */
function EnvioMinuta() {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fetch('/api/crm/whatsapp/reglas-llamadas').then(r => r.json()).then(j => { setD(j); setF(j.regla || {}); }).catch(() => setD({ regla: {}, plantillas: [], plantillasDoc: [] }));
  }, []);
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); setOk(false); };
  const guardar = async () => {
    setGuardando(true);
    const cuerpo: any = {};
    for (const k of ['minuta_envio_activa', 'minuta_envio_plantilla_doc', 'minuta_envio_plantilla_aviso', 'minuta_envio_caduca_dias', 'minuta_envio_texto']) if (k in f) cuerpo[k] = f[k];
    const r = await fetch('/api/crm/whatsapp/reglas-llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(x => x.json()).catch(() => ({ error: 'sin red' }));
    setGuardando(false); setOk(!r?.error);
  };
  if (!d) return <div style={{ ...S.card, marginBottom: 14 }}><Cargando texto="Cargando…" /></div>;

  const activa = !!f.minuta_envio_activa;
  const docs = d.plantillasDoc || [];
  const eti: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 };

  return (
    <div style={{ ...S.card, marginBottom: 14, borderLeft: `3px solid ${activa ? '#4FBF95' : '#E5E7EB'}` }}>
      <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={activa} onChange={e => set('minuta_envio_activa', e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: '#5B4BD6', flexShrink: 0 }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 13.5, display: 'block' }}>Mandarle al cliente la minuta en PDF</b>
          <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.55 }}>
            Al colgar, la llamada se transcribe, se redacta la minuta y se arma un PDF con la marca de Sacs.
            Ese documento queda siempre en la conversación y en la ficha del cliente — eso no se apaga.
            Este interruptor es solo para <b>mandárselo también a él</b> por WhatsApp.
          </span>
        </span>
      </label>

      {activa && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f2f0fa' }}>
          <span style={eti}>El mensaje que acompaña al PDF</span>
          <textarea value={f.minuta_envio_texto || ''} onChange={e => set('minuta_envio_texto', e.target.value)} rows={3}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
          <span style={{ fontSize: 10.5, color: '#999', display: 'block', marginTop: 5 }}>Puedes usar <b>{'{{nombre}}'}</b>.</span>

          <div style={{ marginTop: 14, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '11px 13px' }}>
            <b style={{ fontSize: 12, color: '#B45309', display: 'block', marginBottom: 5 }}>Cuando la conversación está cerrada</b>
            <span style={{ fontSize: 11.5, color: '#8a6410', lineHeight: 1.6, display: 'block' }}>
              Meta solo deja mandar archivos durante las 24 h siguientes al último mensaje del cliente, y una
              llamada no abre esa ventana. Hay dos salidas, y el sistema las intenta en orden:
            </span>

            <div style={{ marginTop: 11 }}>
              <span style={{ ...eti, color: '#8a6410' }}>1. Plantilla que lleva el PDF adentro</span>
              {docs.length === 0 ? (
                <span style={{ display: 'block', fontSize: 11, color: '#8a6410', lineHeight: 1.6, background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '8px 10px' }}>
                  <b>Hoy no tienes ninguna.</b> De tus plantillas aprobadas, ninguna admite documentos —hace falta
                  una creada con encabezado de tipo DOCUMENTO y aprobada por Meta—. Mientras no exista, se usa
                  siempre la salida 2.
                </span>
              ) : (
                <select value={f.minuta_envio_plantilla_doc || ''} onChange={e => set('minuta_envio_plantilla_doc', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #FDE68A', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="">— No usar —</option>
                  {docs.map((p: any) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <span style={{ ...eti, color: '#8a6410' }}>2. Avisarle y esperar su respuesta</span>
              <span style={{ display: 'block', fontSize: 11, color: '#8a6410', lineHeight: 1.6, marginBottom: 7 }}>
                Se le manda una plantilla diciéndole que tenemos el resumen de la llamada. En cuanto conteste
                —lo que sea— se abre la ventana y <b>el PDF le sale solo</b>, sin que nadie lo mande a mano.
              </span>
              <select value={f.minuta_envio_plantilla_aviso || ''} onChange={e => set('minuta_envio_plantilla_aviso', e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #FDE68A', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">— Sin plantilla (entonces no se le manda nada) —</option>
                {(d.plantillas || []).map((p: any) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
              {f.minuta_envio_plantilla_aviso && (() => {
                const p = (d.plantillas || []).find((x: any) => x.nombre === f.minuta_envio_plantilla_aviso);
                return p ? <span style={{ fontSize: 11, color: '#8a6410', display: 'block', marginTop: 7, lineHeight: 1.55, fontStyle: 'italic' }}>«{String(p.cuerpo || '').slice(0, 200)}»</span> : null;
              })()}
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: '#8a6410' }}>Si no responde en</span>
              <input type="number" min={1} max={60} value={f.minuta_envio_caduca_dias ?? 7}
                onChange={e => set('minuta_envio_caduca_dias', e.target.value)}
                style={{ width: 58, border: '1px solid #FDE68A', borderRadius: 8, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' }} />
              <span style={{ fontSize: 11.5, color: '#8a6410' }}>días, la minuta ya no se le manda.</span>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#888', lineHeight: 1.6, background: '#F9FAFB', borderRadius: 9, padding: '9px 11px' }}>
            El PDF <b>no lleva la transcripción palabra por palabra</b> ni las notas internas del equipo: lleva el
            resumen, los temas, los acuerdos y los pendientes. La transcripción completa se queda en el CRM.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button onClick={guardar} disabled={guardando}
          style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 9, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit', opacity: guardando ? .6 : 1 }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {ok && <span style={{ fontSize: 12, color: '#1E8A63', fontWeight: 700 }}>Guardado ✓</span>}
      </div>
    </div>
  );
}

// ═════════════ Reglas automáticas de llamadas ═════════════
/**
 * «Cuando caiga en el buzón, que le llegue un WhatsApp de utilidad; y si le
 * vuelvo a marcar, que no se lo mande otra vez.»
 *
 * Los dos avisos que esta pantalla TIENE que dar, porque si no se prende la
 * regla y no se entiende por qué a veces no sale nada:
 *  1. Fuera de la ventana de 24 h Meta no acepta texto libre. Hace falta una
 *     plantilla UTILITY aprobada, y sin ella esos casos no se mandan.
 *  2. Sin conversación en el inbox no hay a dónde escribir.
 */
function ReglasLlamadas() {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fetch('/api/crm/whatsapp/reglas-llamadas').then(r => r.json()).then(j => { setD(j); setF(j.regla || {}); }).catch(() => setD({ regla: {}, plantillas: [] }));
  }, []);
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); setOk(false); };
  const guardar = async () => {
    setGuardando(true);
    const r = await fetch('/api/crm/whatsapp/reglas-llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).then(x => x.json()).catch(() => ({ error: 'sin red' }));
    setGuardando(false); setOk(!r?.error);
  };
  if (!d) return <div style={{ ...S.card, marginBottom: 14 }}><Cargando texto="Cargando las reglas…" /></div>;

  const activa = !!f.llamadas_regla_activa;
  const eti: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 };
  const check = (k: string, texto: string, detalle: string) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 10 }}>
      <input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} style={{ marginTop: 2, width: 15, height: 15, accentColor: '#5B4BD6', flexShrink: 0 }} />
      <span style={{ minWidth: 0 }}>
        <b style={{ fontSize: 12.5, display: 'block' }}>{texto}</b>
        <span style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>{detalle}</span>
      </span>
    </label>
  );

  return (
    <div style={{ ...S.card, marginBottom: 14, borderLeft: `3px solid ${activa ? '#4FBF95' : '#E5E7EB'}` }}>
      <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={activa} onChange={e => set('llamadas_regla_activa', e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: '#5B4BD6', flexShrink: 0 }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 13.5, display: 'block' }}>Mandar un WhatsApp cuando la llamada no logre contacto</b>
          <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.55 }}>
            Marcaste y no hablaste con nadie: entró el buzón o nadie contestó. En vez de que la persona se quede
            con una llamada perdida de un número que no conoce, le llega un mensaje diciéndole quién la buscó y
            por dónde seguir. Queda en la conversación, como cualquier otro mensaje.
          </span>
        </span>
      </label>

      {activa && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f2f0fa' }}>
          <span style={eti}>¿Cuándo se manda?</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {[['ambos', 'Buzón y sin contestar'], ['buzon', 'Solo si cae en el buzón'], ['sin_contestar', 'Solo si nadie contesta']].map(([v, l]) => (
              <button key={v} onClick={() => set('llamadas_regla_cuando', v)}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 700,
                  background: (f.llamadas_regla_cuando || 'ambos') === v ? '#EEECFE' : '#F3F4F6',
                  color: (f.llamadas_regla_cuando || 'ambos') === v ? '#5B4BD6' : '#6B7280' }}>{l}</button>
            ))}
          </div>

          <span style={eti}>El mensaje</span>
          <textarea value={f.llamadas_regla_texto || ''} onChange={e => set('llamadas_regla_texto', e.target.value)} rows={4}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }} />
          <span style={{ fontSize: 10.5, color: '#999', display: 'block', marginTop: 5, lineHeight: 1.55 }}>
            Puedes usar <b>{'{{nombre}}'}</b> (el nombre de pila del contacto) y <b>{'{{numero}}'}</b> (el número desde el que llamaste
            {d.numero ? `, hoy ${d.numero}` : ''}).
          </span>

          <div style={{ marginTop: 14, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px' }}>
            <b style={{ fontSize: 12, color: '#B45309', display: 'block', marginBottom: 4 }}>Si ya pasaron 24 h desde su último mensaje</b>
            <span style={{ fontSize: 11.5, color: '#8a6410', lineHeight: 1.6, display: 'block' }}>
              Meta no deja mandar texto libre fuera de esa ventana — y es justo el caso más común aquí, porque a quien
              le marcas muchas veces todavía no te ha escrito. Para esos casos hace falta una plantilla ya aprobada.
              Si la dejas vacía, en esos casos no se manda nada y la nota de la llamada lo dice.
            </span>
            <select value={f.llamadas_regla_plantilla || ''} onChange={e => set('llamadas_regla_plantilla', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 9, border: '1px solid #FDE68A', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
              <option value="">— Sin plantilla (no se manda fuera de la ventana) —</option>
              {(d.plantillas || []).map((p: any) => (
                <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
            {f.llamadas_regla_plantilla && (() => {
              const p = (d.plantillas || []).find((x: any) => x.nombre === f.llamadas_regla_plantilla);
              return p ? <span style={{ fontSize: 11, color: '#8a6410', display: 'block', marginTop: 7, lineHeight: 1.55, fontStyle: 'italic' }}>«{String(p.cuerpo || '').slice(0, 220)}»</span> : null;
            })()}
          </div>

          {check('llamadas_regla_una_vez', 'Solo una vez por contacto', 'Aunque le marques diez veces, el mensaje sale una sola vez. Si lo apagas, sale uno por cada llamada sin contacto.')}
          {check('llamadas_regla_horario', 'Respetar el horario de atención', 'Fuera del horario configurado en Automatización no se manda. Nadie quiere un WhatsApp del negocio a las 11 de la noche.')}

          <div style={{ marginTop: 14, fontSize: 11, color: '#888', lineHeight: 1.6, background: '#F9FAFB', borderRadius: 9, padding: '9px 11px' }}>
            Además, esta regla respeta los frenos que ya protegen a todo lo demás: no escribe si hoy ya salió otro
            WhatsApp para esa persona, ni si alguien del equipo tomó la conversación, ni si el teléfono no tiene
            conversación en el inbox.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button onClick={guardar} disabled={guardando}
          style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 9, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit', opacity: guardando ? .6 : 1 }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {ok && <span style={{ fontSize: 12, color: '#1E8A63', fontWeight: 700 }}>Guardado ✓</span>}
      </div>
    </div>
  );
}

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
