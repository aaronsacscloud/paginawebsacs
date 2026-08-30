// WHATSAPP · Plantillas de Meta + Snippets, con VALIDACIÓN EN VIVO (portado
// de sacs_inbox: contadores que se ponen rojos, auto-slug del nombre, chips de
// variables detectadas, máx 3 botones ≤20 chars, guardar deshabilitado por
// conjunción) y preview en mockup de teléfono.
import { useEffect, useMemo, useState } from 'react';
import Cargando, { Corazones } from '../ui/Cargando';
import { S, Tag, Aviso, Vacio, chip } from '../email/ui';
import { C, label } from './estilo';
import MockupWhatsApp from './MockupWhatsApp';
import SubirImagen from '../ui/SubirImagen';
import { confirmar } from '../../../../lib/ui/confirmar';

const TONO: Record<string, string> = { APPROVED: 'ok', PENDING: 'aviso', REJECTED: 'malo', PAUSED: 'malo', DISABLED: 'gris' };
const MOTIVO: Record<string, string> = {
  INVALID_FORMAT: 'Formato inválido: faltan ejemplos de variables, están mal numeradas o hay saltos/espacios raros.',
  ABUSIVE_CONTENT: 'Contenido que Meta considera abusivo o engañoso.',
  INCORRECT_CATEGORY: 'La categoría no corresponde al contenido (marketing disfrazado de utilidad, o al revés).',
  SCAM: 'Meta lo consideró posible fraude.',
  TAG_CONTENT_MISMATCH: 'El contenido no coincide con la categoría.',
};
/** Dato del CRM que puede ir en cada {{n}} (prellenado al enviar y en masivos). */
export const CAMPOS_VARIABLE = [
  { v: '', l: 'Escribir a mano' }, { v: 'primer_nombre', l: 'Primer nombre' }, { v: 'nombre', l: 'Nombre completo' }, { v: 'empresa', l: 'Empresa' },
  { v: 'plan', l: 'Plan' }, { v: 'email', l: 'Email' }, { v: 'telefono', l: 'Teléfono' }, { v: 'etapa', l: 'Etapa' }, { v: 'mrr', l: 'MRR' },
  { v: 'fecha_renovacion', l: 'Fecha de renovación' }, { v: 'sucursales', l: 'Sucursales' }, { v: 'agente', l: 'Nombre del agente' },
];
const LIM = { cuerpo: 1024, header: 60, footer: 60, boton: 20, botones: 3 };
const extraerVars = (t: string) => [...new Set([...t.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]))];

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', background: '#fff' };
const Contador = ({ n, max }: { n: number; max: number }) => (
  <span style={{ fontSize: 11, fontWeight: n > max ? 700 : 400, color: n > max ? C.rojo500 : C.g400, fontVariantNumeric: 'tabular-nums' }}>{n}/{max}</span>
);

type Vista = 'plantillas' | 'snippets';

export default function Plantillas() {
  const [vista, setVista] = useState<Vista>('plantillas');
  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', gap: 16, borderBottom: `1px solid ${C.g200}`, marginBottom: 16 }}>
        {(['plantillas', 'snippets'] as const).map(v => (
          <button key={v} onClick={() => setVista(v)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '8px 2px', color: vista === v ? C.moradoTinta : C.g400, borderBottom: `2px solid ${vista === v ? C.morado : 'transparent'}` }}>
            {v === 'plantillas' ? 'Plantillas de Meta' : 'Snippets (respuestas rápidas)'}
          </button>
        ))}
      </div>
      {vista === 'plantillas' ? <PlantillasMeta /> : <Snippets />}
    </div>
  );
}

// ═══════════════════════ Plantillas de Meta ═══════════════════════
export function PlantillasMeta() {
  const [d, setD] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tono: string; texto: string } | null>(null);
  const [prueba, setPrueba] = useState<any>(null);
  const [mapa, setMapa] = useState<any>(null);
  const borrar = async (p: any) => {
    if (!await confirmar(`¿Borrar la plantilla "${p.nombre}" en Meta? Se pierde la aprobación y no se puede deshacer.`)) return;
    const r = await fetch('/api/crm/whatsapp/plantillas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: p.nombre }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r.error) setMsg({ tono: 'malo', texto: r.error }); else { setMsg({ tono: 'ok', texto: `"${p.nombre}" borrada en Meta.` }); cargar(); }
  };
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<{ k: string; dir: 1 | -1 }>({ k: 'created_at', dir: -1 });
  const [pag, setPag] = useState(0);
  const porPag = 20;

  const cargar = () => fetch('/api/crm/whatsapp/plantillas').then(r => r.json()).then(setD).catch(() => setD({ plantillas: [] }));
  useEffect(() => { cargar(); }, []);

  const lista: any[] = useMemo(() => {
    const base = (d?.plantillas || []).filter((p: any) => !q || `${p.nombre} ${p.cuerpo}`.toLowerCase().includes(q.toLowerCase()));
    return [...base].sort((a, b) => String(a[orden.k] || '').localeCompare(String(b[orden.k] || '')) * orden.dir);
  }, [d, q, orden]);
  const pagina = lista.slice(pag * porPag, (pag + 1) * porPag);

  const crear = async () => {
    setGuardando(true); setMsg(null);
    const r = await fetch('/api/crm/whatsapp/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setGuardando(false);
    if (r.error) { setMsg({ tono: 'malo', texto: r.error }); return; }
    setMsg({ tono: 'ok', texto: 'Enviada a Meta. Queda PENDING: la aprobación suele tardar minutos u horas.' });
    setForm(null); cargar();
  };

  if (!d) return <Cargando texto="Cargando plantillas…" />;

  const th = (k: string, l: string) => (
    <th onClick={() => setOrden(o => ({ k, dir: o.k === k ? (o.dir === 1 ? -1 : 1) : 1 }))} style={{ ...S.th, cursor: 'pointer', userSelect: 'none' }}>
      {l} <span style={{ color: orden.k === k ? C.emerald600 : C.g300 }}>{orden.k === k ? (orden.dir === 1 ? '▲' : '▼') : '⇅'}</span>
    </th>
  );

  return (
    <div>
      {msg && <div style={{ marginBottom: 12 }}><Aviso tono={msg.tono as any}>{msg.texto}</Aviso></div>}
      {d.sync_error && <div style={{ marginBottom: 12 }}><Aviso tono="aviso" titulo="Catálogo sin sincronizar">{d.sync_error}</Aviso></div>}

      {!form && !prueba && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input value={q} onChange={e => { setQ(e.target.value); setPag(0); }} placeholder="Buscar plantilla…" style={{ ...inp, width: 260 }} />
          <span style={{ flex: 1 }} />
          <button style={S.btnG} onClick={cargar}>Sincronizar</button>
          <button style={S.btnP} onClick={() => setForm({ nombre: '', idioma: 'es_MX', categoria: 'UTILITY', cuerpo: '', header: '', footer: '', botones: [], header_tipo: 'TEXT', header_media_url: '', ejemplos: [], variables_map: [], otp_expira_min: 10 })}>Nueva plantilla</button>
        </div>
        {!lista.length ? <Vacio titulo="Sin plantillas todavía" texto="Las plantillas son los mensajes pre-aprobados por Meta: sirven fuera de la ventana de 24 horas y para los masivos." /> : (<>
          {/* M2 · móvil: la tabla de 7 columnas medía 1,205 px de lado. Fila v5:
              nombre · estado como dato de la derecha · un hecho (categoría).
              Tap = probar (si está aprobada); el resto de acciones, en escritorio. */}
          <div className="wa-plantillas-movil" style={{ display: 'none' }}>
            {pagina.map(p => (
              <div key={'m' + p.id} className="m-row" onClick={() => { if (p.status === 'APPROVED') setPrueba({ plantilla: p, telefono: '', params: Array(p.variables || 0).fill('') }); }}>
                <div className="m-tx">
                  <div className="m-n1" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{p.nombre}</div>
                  <div className="m-n2">{p.categoria === 'MARKETING' ? 'Marketing' : p.categoria === 'UTILITY' ? 'Utility' : p.categoria} · {p.idioma}</div>
                </div>
                <div className="m-fin">
                  <div className="m-m1" style={{ fontSize: '0.82rem', color: p.status === 'APPROVED' ? '#1E8A63' : p.status === 'REJECTED' ? '#C0554E' : '#a06600' }}>
                    {p.status === 'APPROVED' ? 'Aprobada' : p.status === 'REJECTED' ? 'Rechazada' : p.status === 'PENDING' ? 'En revisión' : p.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <style>{`@media (max-width:899px){ .wa-plantillas-movil{display:block !important} .wa-plantillas-desk{display:none !important} }`}</style>
          <div className="wa-plantillas-desk crm-scroll-x" style={{ ...S.card, padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>{th('nombre', 'Nombre')}{th('categoria', 'Categoría')}{th('idioma', 'Idioma')}{th('status', 'Estado')}{th('calidad', 'Calidad')}<th style={S.th}>Cuerpo</th><th style={S.th}></th></tr></thead>
              <tbody>
                {pagina.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...S.td, fontWeight: 700, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{p.nombre}</td>
                    <td style={S.td}><Tag tono={p.categoria === 'MARKETING' ? 'acento' : 'info'}>{p.categoria}</Tag></td>
                    <td style={S.td}>{p.idioma}</td>
                    <td style={S.td}>
                      <Tag tono={TONO[p.status] || 'gris'}>{p.status === 'APPROVED' ? 'Aprobada' : p.status === 'REJECTED' ? 'Rechazada' : p.status === 'PENDING' ? 'En revisión' : p.status === 'PAUSED' ? 'Pausada' : p.status === 'DISABLED' ? 'Deshabilitada' : p.status}</Tag>
                      {p.status === 'REJECTED' && <div style={{ fontSize: 10, color: C.rojo500, marginTop: 3, maxWidth: 220, lineHeight: 1.4 }} title={p.rechazo_motivo || ''}>{MOTIVO[p.rechazo_motivo] || p.rechazo_motivo || 'Meta no dio motivo'}</div>}
                      {p.status_at && <div style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>{new Date(p.status_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</div>}
                    </td>
                    <td style={S.td}>
                      {p.calidad && p.calidad !== 'UNKNOWN' ? <span title={`Calidad según Meta: ${p.calidad}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: p.calidad === 'GREEN' ? C.emerald700 : p.calidad === 'YELLOW' ? C.ambar700 : C.rojo700 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: p.calidad === 'GREEN' ? C.emerald500 : p.calidad === 'YELLOW' ? C.ambar400 : C.rojo500 }} />{p.calidad === 'GREEN' ? 'Alta' : p.calidad === 'YELLOW' ? 'Media' : 'Baja'}</span>
                        : <span style={{ fontSize: 10, color: C.g300 }} title="Meta la califica cuando ya se ha usado">Sin datos</span>}
                      {(p.header_tipo && p.header_tipo !== 'TEXT') && <div style={{ fontSize: 9, fontWeight: 700, color: C.g500, marginTop: 3 }}>{p.header_tipo === 'IMAGE' ? 'Imagen' : p.header_tipo === 'VIDEO' ? 'Video' : p.header_tipo === 'DOCUMENT' ? 'Documento' : 'Ubicación'} en encabezado</div>}
                      {p.tipo_especial === 'otp' && <div style={{ fontSize: 9, fontWeight: 700, color: C.g500, marginTop: 3 }}>Código OTP</div>}
                    </td>
                    <td style={{ ...S.td, maxWidth: 300, color: C.g500, fontSize: 12 }}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.cuerpo}</span>
                      {Array.isArray(p.botones) && p.botones.length > 0 && <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{p.botones.map((b: any, i: number) => <span key={i} style={{ fontSize: 9, fontWeight: 700, border: `1px solid ${C.g200}`, borderRadius: 999, padding: '0 6px', color: C.g500 }}>{b.tipo === 'URL' ? '↗ ' : b.tipo === 'PHONE_NUMBER' ? '☎ ' : ''}{b.texto || b.tipo}</span>)}</div>}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      {p.status === 'APPROVED' && <button style={S.btnA} onClick={() => setPrueba({ plantilla: p, telefono: '', params: Array(p.variables || 0).fill('') })}>Probar</button>}
                      {p.status === 'APPROVED' && <button style={{ ...S.btnG, marginLeft: 6 }} onClick={() => setForm({ nombre: `${p.nombre}_v2`, idioma: p.idioma, categoria: p.categoria, cuerpo: p.cuerpo, header: p.header || '', footer: p.footer || '', botones: p.botones || [], header_tipo: p.header_tipo || 'TEXT', header_media_url: p.header_media_url || '', ejemplos: p.ejemplos || [], variables_map: p.variables_map || [] })}>Nueva versión</button>}
                      {p.variables > 0 && <button style={{ ...S.btnG, marginLeft: 6 }} title="Qué dato del CRM va en cada variable" onClick={() => setMapa(p)}>Variables</button>}
                      <button style={{ ...S.btnG, marginLeft: 6, color: C.rojo500 }} title="Borrar en Meta" onClick={() => borrar(p)}>Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: `1px solid ${C.g100}`, fontSize: 12, color: C.g500 }}>
              <span>{lista.length ? `${pag * porPag + 1}-${Math.min((pag + 1) * porPag, lista.length)} de ${lista.length}` : '0'}</span>
              <span style={{ flex: 1 }} />
              <button style={S.btnG} disabled={pag === 0} onClick={() => setPag(p => p - 1)}>‹</button>
              <button style={S.btnG} disabled={(pag + 1) * porPag >= lista.length} onClick={() => setPag(p => p + 1)}>›</button>
            </div>
          </div>
        </>)}
      </>)}

      {form && <EditorPlantilla form={form} setForm={setForm} onCrear={crear} guardando={guardando} onCancelar={() => { setForm(null); setMsg(null); }} />}

      {mapa && (
        <div onClick={() => setMapa(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,40,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 20, width: 'min(460px, 94vw)' }}>
            <b style={{ fontSize: 14 }}>Variables de "{mapa.nombre}"</b>
            <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 12px' }}>Qué dato del CRM se rellena solo en cada variable al enviarla desde el chat o en un masivo.</p>
            <div style={{ fontSize: 12, background: C.g50, borderRadius: 8, padding: '8px 10px', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{mapa.cuerpo}</div>
            {Array.from({ length: mapa.variables || 0 }, (_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: C.moradoTinta, width: 40, fontSize: 12 }}>{`{{${i + 1}}}`}</span>
                <select style={inp} value={(mapa.variables_map || [])[i] || ''} onChange={e => { const m = [...(mapa.variables_map || [])]; m[i] = e.target.value; setMapa({ ...mapa, variables_map: m }); }}>
                  {CAMPOS_VARIABLE.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button style={S.btnG} onClick={() => setMapa(null)}>Cancelar</button>
              <button style={S.btnP} onClick={async () => { await fetch('/api/crm/whatsapp/plantillas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mapa.id, variables_map: mapa.variables_map || [] }) }); setMapa(null); cargar(); }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {prueba && (
        <div style={{ ...S.card, maxWidth: 520 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Probar «{prueba.plantilla.nombre}»</h3>
          <label style={S.lbl}>Teléfono (10 dígitos o E.164)</label>
          <input style={inp} value={prueba.telefono} onChange={e => setPrueba({ ...prueba, telefono: e.target.value })} placeholder="55 1234 5678" />
          {prueba.params.map((v: string, i: number) => (
            <div key={i}><label style={{ ...S.lbl, marginTop: 10 }}>{`Variable {{${i + 1}}}`}</label>
              <input style={inp} value={v} onChange={e => { const params = [...prueba.params]; params[i] = e.target.value; setPrueba({ ...prueba, params }); }} /></div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            <button style={S.btnP} disabled={guardando} onClick={async () => {
              setGuardando(true); setMsg(null);
              const r = await fetch('/api/crm/whatsapp/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'probar', nombre: prueba.plantilla.nombre, idioma: prueba.plantilla.idioma, telefono: prueba.telefono, params: prueba.params }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
              setGuardando(false);
              if (r.error) { setMsg({ tono: 'malo', texto: r.error }); return; }
              setMsg({ tono: 'ok', texto: 'Prueba enviada. Revisa el teléfono y el Inbox.' }); setPrueba(null);
            }}>{guardando ? <Corazones size={9} color="#fff" /> : 'Enviar prueba'}</button>
            <button style={S.btnG} onClick={() => setPrueba(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Editor con validación EN VIVO + mockup (portado de SnippetFormModal + CreateTemplateModal). */
function EditorPlantilla({ form, setForm, onCrear, guardando, onCancelar }: { form: any; setForm: (f: any) => void; onCrear: () => void; guardando: boolean; onCancelar: () => void }) {
  const vars = extraerVars(form.cuerpo || '');
  const varsOk = vars.every((v, i) => v === String(i + 1));   // Meta: {{1}},{{2}}… ascendentes
  const errores: string[] = [];
  if (!/^[a-z0-9_]+$/.test(form.nombre || '')) errores.push('El nombre solo admite minúsculas, números y guión bajo');
  const esAuth = form.categoria === 'AUTHENTICATION';
  const ht = form.header_tipo || 'TEXT';
  if (!esAuth && !form.cuerpo?.trim()) errores.push('Falta el cuerpo');
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && !/^https?:\/\/\S+/.test(form.header_media_url || '')) errores.push('El encabezado de media necesita la URL pública de un archivo de muestra');
  for (const b of form.botones || []) {
    if (b.tipo === 'URL' && !/^https?:\/\/\S+/.test(b.url || '')) errores.push(`El botón "${b.texto || 'URL'}" necesita una URL válida`);
    if (b.tipo === 'PHONE_NUMBER' && !/^\+?\d{8,15}$/.test((b.telefono || '').replace(/[\s-]/g, ''))) errores.push(`El botón "${b.texto || 'Llamar'}" necesita un teléfono con lada`);
  }
  if ((form.cuerpo || '').length > LIM.cuerpo) errores.push(`Cuerpo excede ${LIM.cuerpo} caracteres`);
  if ((form.header || '').length > LIM.header) errores.push(`Encabezado excede ${LIM.header}`);
  if ((form.footer || '').length > LIM.footer) errores.push(`Pie excede ${LIM.footer}`);
  if (!varsOk) errores.push('Las variables deben ser {{1}}, {{2}}… en orden y sin huecos');
  if ((form.botones || []).some((b: any) => !b.texto?.trim())) errores.push('Hay un botón sin texto');
  const ejemplos: string[] = form.ejemplos || [];
  if (!esAuth && vars.some((_, i) => !(ejemplos[i] || '').trim())) errores.push('Meta exige un ejemplo por cada variable');
  const setBotonCampo = (i: number, campo: string, v: string) => setForm({ ...form, botones: form.botones.map((b: any, j: number) => j === i ? { ...b, [campo]: v } : b) });
  const puede = errores.length === 0;
  const setEjemplo = (i: number, v: string) => { const e = [...ejemplos]; e[i] = v; setForm({ ...form, ejemplos: e }); };
  const setBoton = (i: number, texto: string) => setForm({ ...form, botones: form.botones.map((b: any, j: number) => j === i ? { ...b, texto: texto.slice(0, LIM.boton) } : b) });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem' }}>Nueva plantilla</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: C.g500, lineHeight: 1.5 }}>Se crea directo en Meta y queda PENDING hasta que la aprueben. Una plantilla aprobada ya no se edita: se versiona.</p>

        <label style={{ ...label(), display: 'block', marginBottom: 4 }}>Nombre</label>
        <input style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="recordatorio_renovacion" />
        <div style={{ fontSize: 10, color: C.g400, marginTop: 3 }}>Solo letras minúsculas, números y guiones bajos (se corrige solo).</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {[{ id: 'UTILITY', l: 'Utilidad' }, { id: 'MARKETING', l: 'Marketing' }, { id: 'AUTHENTICATION', l: 'Autenticación (OTP)' }].map(c => (
            <button key={c.id} style={chip(form.categoria === c.id)} onClick={() => setForm({ ...form, categoria: c.id })}>{c.l}</button>
          ))}
          <select style={{ ...inp, width: 'auto' }} value={form.idioma} onChange={e => setForm({ ...form, idioma: e.target.value })}>
            <option value="es_MX">es_MX</option><option value="es">es</option><option value="en_US">en_US</option>
          </select>
        </div>

        {esAuth ? (
          <div style={{ marginTop: 12, background: C.g50, border: `1px solid ${C.g100}`, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: C.g700, lineHeight: 1.5 }}>
            <b>Plantilla de código (OTP).</b> Meta fija el texto ("<i>{'{{1}}'} es tu código de verificación</i>") y el botón "Copiar código"; no se edita.
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 11 }}>Caduca en</label><input type="number" min={1} max={90} style={{ ...inp, width: 70 }} value={form.otp_expira_min || 10} onChange={e => setForm({ ...form, otp_expira_min: Number(e.target.value) })} /><span style={{ fontSize: 11 }}>min</span>
              <label style={{ fontSize: 11, marginLeft: 10, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={form.otp_recomendacion !== false} onChange={e => setForm({ ...form, otp_recomendacion: e.target.checked })} /> Aviso "no compartas este código"</label>
            </div>
          </div>
        ) : (<>
        <label style={{ ...label(), display: 'block', marginTop: 12, marginBottom: 4 }}>Encabezado</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['TEXT', 'Texto'], ['IMAGE', 'Imagen'], ['VIDEO', 'Video'], ['DOCUMENT', 'Documento'], ['LOCATION', 'Ubicación'], ['NONE', 'Sin encabezado']].map(([v, l]) => (
            <button key={v} style={chip((v === 'NONE' ? !form.header && ht === 'TEXT' : ht === v && (v !== 'TEXT' || !!form.header)))} onClick={() => setForm({ ...form, header_tipo: v === 'NONE' ? 'TEXT' : v, ...(v === 'NONE' ? { header: '' } : {}) })}>{l}</button>
          ))}
        </div>
        {ht === 'TEXT' && (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}><span style={{ fontSize: 11, color: C.g500 }}>Texto del encabezado (opcional)</span><Contador n={(form.header || '').length} max={LIM.header} /></div>
          <input style={{ ...inp, borderColor: (form.header || '').length > LIM.header ? C.rojo300 : C.g200 }} value={form.header} onChange={e => setForm({ ...form, header: e.target.value })} />
        </>)}
        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && (<>
          <div style={{ fontSize: 11, color: C.g500, marginTop: 8 }}>Archivo de muestra para Meta. Al enviar puedes cambiarlo por otro.</div>
          {ht === 'IMAGE' ? (
            <div style={{ marginTop: 4 }}>
              <SubirImagen valor={form.header_media_url || null} preset="plantilla_header" carpeta="plantillas" alto={120}
                ayuda="Se ajusta a 1200×628 (el formato que Meta muestra en el encabezado)"
                onCambio={u => setForm({ ...form, header_media_url: u || '' })} />
            </div>
          ) : (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input style={inp} value={form.header_media_url || ''} onChange={e => setForm({ ...form, header_media_url: e.target.value })} placeholder={ht === 'VIDEO' ? 'https://…/demo.mp4' : 'https://…/brochure.pdf'} />
            <button style={{ ...S.btnG, whiteSpace: 'nowrap' }} onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = ht === 'IMAGE' ? 'image/*' : ht === 'VIDEO' ? 'video/mp4' : '.pdf'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); fd.append('nombre', f.name); fd.append('categoria', 'plantillas'); const r = await fetch('/api/crm/whatsapp/media', { method: 'POST', body: fd }).then(x => x.json()).catch(() => null); if (r?.archivo?.url || r?.url) setForm({ ...form, header_media_url: r.archivo?.url || r.url }); }; i.click(); }}>Subir</button>
          </div>)}
        </>)}
        {ht === 'LOCATION' && <div style={{ fontSize: 11, color: C.g500, marginTop: 6 }}>La ubicación se elige al enviar (lat/lng + nombre).</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}><label style={label()}>Cuerpo</label><Contador n={(form.cuerpo || '').length} max={LIM.cuerpo} /></div>
        <textarea style={{ ...inp, minHeight: 120, resize: 'vertical', borderColor: (form.cuerpo || '').length > LIM.cuerpo || !varsOk ? C.rojo300 : C.g200 }} value={form.cuerpo}
          onChange={e => setForm({ ...form, cuerpo: e.target.value })} placeholder={'Hola {{1}}, tu suscripción de {{2}} se renueva el {{3}}.'} />
        {vars.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: C.g500, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            Variables: {vars.map(v => <span key={v} style={{ fontSize: 10, fontWeight: 700, background: varsOk ? C.moradoAgua : C.rojo50, color: varsOk ? C.moradoTinta : C.rojo500, borderRadius: 999, padding: '1px 7px' }}>{`{{${v}}}`}</span>)}
          </div>
        )}
        {vars.length > 0 && varsOk && (
          <div style={{ marginTop: 8, border: `1px solid ${C.g100}`, borderRadius: 8, padding: '8px 10px', background: C.g50 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g500, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Ejemplos para Meta (obligatorios)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
              {vars.map((v, i) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: C.moradoTinta, flexShrink: 0 }}>{`{{${v}}}`}</span>
                  <input value={ejemplos[i] || ''} onChange={e => setEjemplo(i, e.target.value)} placeholder={i === 0 ? 'María' : 'valor de ejemplo'}
                    style={{ ...inp, padding: '5px 8px', fontSize: 12, borderColor: (ejemplos[i] || '').trim() ? C.g200 : C.rojo300 }} />
                </label>
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.g400, marginTop: 6 }}>Meta revisa la plantilla con estos valores; sin ellos la rechaza de inmediato.</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g500, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 6px' }}>Se rellena solo con (opcional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
              {vars.map((v, i) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: C.moradoTinta, flexShrink: 0 }}>{`{{${v}}}`}</span>
                  <select style={{ ...inp, padding: '5px 8px', fontSize: 12 }} value={(form.variables_map || [])[i] || ''} onChange={e => { const m = [...(form.variables_map || [])]; m[i] = e.target.value; setForm({ ...form, variables_map: m }); }}>
                    {CAMPOS_VARIABLE.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}><label style={label()}>Pie (opcional)</label><Contador n={(form.footer || '').length} max={LIM.footer} /></div>
        <input style={{ ...inp, borderColor: (form.footer || '').length > LIM.footer ? C.rojo300 : C.g200 }} value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} />

        <label style={{ ...label(), display: 'block', marginTop: 12, marginBottom: 4 }}>Botones (respuesta rápida, link, llamada, copiar código, catálogo)</label>
        {(form.botones || []).map((b: any, i: number) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <select style={inp} value={b.tipo || 'QUICK_REPLY'} onChange={e => setBotonCampo(i, 'tipo', e.target.value)}>
              <option value="QUICK_REPLY">Respuesta rápida</option><option value="URL">Abrir link</option><option value="PHONE_NUMBER">Llamar</option><option value="COPY_CODE">Copiar código</option><option value="CATALOG">Ver catálogo</option><option value="MPM">Ver productos</option>
            </select>
            <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
              {b.tipo !== 'COPY_CODE' && <input style={{ ...inp, flex: 1 }} maxLength={LIM.boton} value={b.texto || ''} onChange={e => setBoton(i, e.target.value)} placeholder={b.tipo === 'URL' ? 'Ver cotización' : b.tipo === 'PHONE_NUMBER' ? 'Llámanos' : `Botón ${i + 1}`} />}
              {b.tipo === 'URL' && <input style={{ ...inp, flex: 1.5 }} value={b.url || ''} onChange={e => setBotonCampo(i, 'url', e.target.value)} placeholder="https://www.sacscloud.com/… (usa {{1}} para parte dinámica)" />}
              {b.tipo === 'PHONE_NUMBER' && <input style={{ ...inp, flex: 1 }} value={b.telefono || ''} onChange={e => setBotonCampo(i, 'telefono', e.target.value)} placeholder="+52 55 3663 4392" />}
              {b.tipo === 'COPY_CODE' && <input style={{ ...inp, flex: 1 }} value={b.ejemplo || ''} onChange={e => setBotonCampo(i, 'ejemplo', e.target.value)} placeholder="Código de ejemplo (ej. SACS20)" />}
              {b.tipo === 'URL' && /\{\{1\}\}/.test(b.url || '') && <input style={{ ...inp, flex: .8 }} value={b.ejemplo || ''} onChange={e => setBotonCampo(i, 'ejemplo', e.target.value)} placeholder="Ejemplo de {{1}}" />}
            </div>
            <button onClick={() => setForm({ ...form, botones: form.botones.filter((_: any, j: number) => j !== i) })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>
          </div>
        ))}
        {(form.botones || []).length < 10 && (
          <button onClick={() => setForm({ ...form, botones: [...(form.botones || []), { tipo: 'QUICK_REPLY', texto: '' }] })} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: C.moradoTinta, padding: 0 }}>+ Agregar botón</button>
        )}
        <div style={{ fontSize: 10, color: C.g400, marginTop: 4 }}>Meta permite hasta 10 botones: máx. 2 de link, 1 de llamada y 1 de copiar código.</div>
        </>)}

        {errores.length > 0 && (form.nombre || form.cuerpo) && (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 11, color: C.rojo500, lineHeight: 1.6 }}>{errores.map(e => <li key={e}>{e}</li>)}</ul>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
          <button style={{ ...S.btnP, opacity: puede ? 1 : .5 }} disabled={!puede || guardando} onClick={onCrear}>{guardando ? <Corazones size={9} color="#fff" /> : 'Crear en Meta'}</button>
          <button style={S.btnG} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
      <div style={{ position: 'sticky', top: 20 }}>
        <div style={{ ...label(10), textAlign: 'center', marginBottom: 10 }}>Así lo verá el cliente</div>
        <MockupWhatsApp header={esAuth ? null : (ht === 'TEXT' ? form.header : null)} headerMedia={esAuth ? null : (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(ht) ? { tipo: ht, url: form.header_media_url } : null)}
          cuerpo={esAuth ? '{{1}} es tu código de verificación. Por tu seguridad, no lo compartas.' : (form.cuerpo || '')} footer={esAuth ? (form.otp_expira_min ? `Este código caduca en ${form.otp_expira_min} minutos.` : null) : form.footer}
          botones={esAuth ? [{ texto: 'Copiar código', tipo: 'COPY_CODE' }] : (form.botones || [])} />
      </div>
    </div>
  );
}

// ═══════════════════════ Snippets ═══════════════════════
export function Snippets() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(null);
  const [q, setQ] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/respuestas').then(r => r.json()).then(j => setLista(j.respuestas || [])).catch(() => setLista([]));
  useEffect(() => { cargar(); }, []);
  if (!lista) return <Cargando texto="Cargando snippets…" />;
  const visibles = lista.filter(s => !q || `${s.titulo || ''} ${s.atajo} ${s.texto}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {!form && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar snippet…" style={{ ...inp, width: 260 }} />
          <span style={{ flex: 1 }} />
          <button style={S.btnP} onClick={() => setForm({ atajo: '', titulo: '', categoria: '', texto: '', header: '', footer: '', botones: [], media_tipo: 'text', media_url: '' })}>Nuevo snippet</button>
        </div>
        {!visibles.length && <Vacio titulo="Sin snippets" texto='Los snippets son respuestas rápidas: en el chat escribes "/" y aparecen.' />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {visibles.map(s => (
            <div key={s.id} style={{ ...S.card, borderLeft: `3px solid ${C.morado}` }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13 }}>{s.titulo || s.atajo}</b>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 4, padding: '1px 6px' }}>/{s.atajo}</span>
                {s.categoria && <Tag tono="gris">{s.categoria}</Tag>}
                {(s.usage_count || 0) >= 10 && <Tag tono="ok">Popular</Tag>}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: C.g400 }}>{s.usage_count || 0} usos</span>
              </div>
              <div style={{ fontSize: 12, color: C.g500, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.texto}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button style={S.btnG} onClick={() => setForm({ ...s, botones: s.botones || [], media_tipo: s.media_tipo || 'text' })}>Editar</button>
                <button style={{ ...S.btnG, color: C.rojo500 }} onClick={async () => { await fetch('/api/crm/whatsapp/respuestas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }) }); cargar(); }}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </>)}
      {form && <EditorSnippet form={form} setForm={setForm} onGuardado={() => { setForm(null); cargar(); }} onCancelar={() => setForm(null)} />}
    </div>
  );
}

function EditorSnippet({ form, setForm, onGuardado, onCancelar }: { form: any; setForm: (f: any) => void; onGuardado: () => void; onCancelar: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const vars = extraerVars(form.texto || '');
  const errs: string[] = [];
  if (!form.atajo) errs.push('Falta el atajo');
  if (!form.texto?.trim()) errs.push('Falta el texto');
  if ((form.texto || '').length > LIM.cuerpo) errs.push(`Texto excede ${LIM.cuerpo}`);
  if ((form.header || '').length > LIM.header) errs.push(`Encabezado excede ${LIM.header}`);
  if ((form.footer || '').length > LIM.footer) errs.push(`Pie excede ${LIM.footer}`);
  const puede = !errs.length;
  const TIPOS = [{ v: 'text', l: '📝 Texto' }, { v: 'image', l: '🖼️ Imagen' }, { v: 'document', l: '📎 Documento' }, { v: 'video', l: '🎬 Video' }];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
      <div style={S.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>{form.id ? 'Editar snippet' : 'Nuevo snippet'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={{ ...label(), display: 'block', marginBottom: 4 }}>Atajo rápido</label>
            <input style={inp} value={form.atajo} onChange={e => setForm({ ...form, atajo: e.target.value.toLowerCase().replace(/^\//, '').replace(/[^a-z0-9_-]/g, '') })} placeholder="Ej: saludo → /saludo" /></div>
          <div><label style={{ ...label(), display: 'block', marginBottom: 4 }}>Título</label>
            <input style={inp} value={form.titulo || ''} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Saludo inicial" /></div>
          <div><label style={{ ...label(), display: 'block', marginBottom: 4 }}>Categoría</label>
            <input style={inp} value={form.categoria || ''} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="ventas, soporte, cobranza…" /></div>
          <div><label style={{ ...label(), display: 'block', marginBottom: 4 }}>Tipo de media</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{TIPOS.map(t => (
              <button key={t.v} onClick={() => setForm({ ...form, media_tipo: t.v })} style={{ border: `1px solid ${form.media_tipo === t.v ? C.emerald500 : C.g200}`, background: form.media_tipo === t.v ? C.emerald50 : '#fff', color: form.media_tipo === t.v ? C.emerald700 : C.g500, borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.l}</button>
            ))}</div></div>
        </div>
        {form.media_tipo === 'image' ? (
          <div style={{ margin: '12px 0 4px' }}>
            <SubirImagen valor={form.media_url || null} preset="libre" carpeta="snippets" alto={120} etiqueta="Imagen del snippet"
              ayuda="Se optimiza sola (lado largo 1600 px) y se sube; también puedes pegar una URL"
              onCambio={u => setForm({ ...form, media_url: u || '' })} />
          </div>
        ) : form.media_tipo !== 'text' ? (<>
          <label style={{ ...label(), display: 'block', margin: '12px 0 4px' }}>URL del archivo</label>
          <input style={inp} value={form.media_url || ''} onChange={e => setForm({ ...form, media_url: e.target.value })} placeholder="https://…" />
        </>) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}><label style={label()}>Encabezado</label><Contador n={(form.header || '').length} max={LIM.header} /></div>
        <input style={{ ...inp, borderColor: (form.header || '').length > LIM.header ? C.rojo300 : C.g200 }} value={form.header || ''} onChange={e => setForm({ ...form, header: e.target.value })} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}><label style={label()}>Texto</label><Contador n={(form.texto || '').length} max={LIM.cuerpo} /></div>
        <textarea style={{ ...inp, minHeight: 110, resize: 'vertical', borderColor: (form.texto || '').length > LIM.cuerpo ? C.rojo300 : C.g200 }} value={form.texto || ''} onChange={e => setForm({ ...form, texto: e.target.value })} placeholder="Hola {{primer_nombre}}, gracias por escribir a SACS…" />
        {vars.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: C.g500, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>Variables: {vars.map(v => <span key={v} style={{ fontSize: 10, fontWeight: 700, background: C.azulAgua, color: C.azulTinta, borderRadius: 999, padding: '1px 7px' }}>{`{{${v}}}`}</span>)}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}><label style={label()}>Pie</label><Contador n={(form.footer || '').length} max={LIM.footer} /></div>
        <input style={{ ...inp, borderColor: (form.footer || '').length > LIM.footer ? C.rojo300 : C.g200 }} value={form.footer || ''} onChange={e => setForm({ ...form, footer: e.target.value })} />
        {errs.length > 0 && (form.atajo || form.texto) && <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 11, color: C.rojo500 }}>{errs.map(e => <li key={e}>{e}</li>)}</ul>}
        <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
          <button style={{ ...S.btnP, flex: 1, opacity: puede ? 1 : .5 }} disabled={!puede || guardando} onClick={async () => {
            setGuardando(true);
            await fetch('/api/crm/whatsapp/respuestas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => {});
            setGuardando(false); onGuardado();
          }}>{guardando ? <Corazones size={9} color="#fff" /> : form.id ? 'Guardar' : 'Crear'}</button>
          <button style={{ ...S.btnG, flex: 1 }} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
      <div style={{ position: 'sticky', top: 20 }}>
        <div style={{ ...label(10), textAlign: 'center', marginBottom: 10 }}>Vista previa</div>
        <MockupWhatsApp header={form.header} cuerpo={form.texto || ''} footer={form.footer} botones={form.botones || []} />
      </div>
    </div>
  );
}
