// INBOX · Modal "Mensaje interactivo": lo que WhatsApp deja mandar además de
// texto y media. Cada pestaña arma la forma simple que entiende
// /api/crm/whatsapp/enviar (interactivo | ubicacion | contacto) y el servidor
// aplica los límites de Meta (títulos ≤20, filas ≤10, etc.). La previsualización
// de la derecha imita el teléfono para que el agente vea lo que verá el cliente.
import { useEffect, useState } from 'react';
import { C } from './estilo';
import SubirImagen from '../ui/SubirImagen';

type Tab = 'botones' | 'lista' | 'cta_url' | 'pedir_ubicacion' | 'pedir_contacto' | 'ubicacion' | 'contacto' | 'carrusel' | 'producto' | 'catalogo';
const TABS: { id: Tab; l: string; d: string }[] = [
  { id: 'botones', l: 'Botones', d: 'Hasta 3 respuestas rápidas' },
  { id: 'lista', l: 'Lista', d: 'Menú de hasta 10 opciones' },
  { id: 'cta_url', l: 'Botón con link', d: 'Abre una URL sin copiarla' },
  { id: 'pedir_ubicacion', l: 'Pedir ubicación', d: 'Botón nativo "Compartir ubicación"' },
  { id: 'pedir_contacto', l: 'Pedir contacto', d: 'Le pide su teléfono' },
  { id: 'ubicacion', l: 'Enviar ubicación', d: 'Pin de una sucursal u oficina' },
  { id: 'contacto', l: 'Enviar contacto', d: 'Tarjeta (vCard) de alguien del equipo' },
  { id: 'carrusel', l: 'Carrusel', d: '2 a 10 tarjetas con imagen' },
  { id: 'producto', l: 'Producto', d: 'Del catálogo de Meta' },
  { id: 'catalogo', l: 'Catálogo', d: 'Botón "Ver catálogo"' },
];

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' };
const lab: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 4px' };
const Cont = ({ n, max }: { n: number; max: number }) => <span style={{ float: 'right', fontSize: 10, color: n > max ? C.rojo500 : C.g300, fontWeight: n > max ? 700 : 400 }}>{n}/{max}</span>;

export default function ModalInteractivo({ onCerrar, onEnviar, equipo, yo, contacto, empresa, catalogId }: {
  onCerrar: () => void;
  onEnviar: (body: any) => Promise<any>;
  equipo: any[]; yo: any; contacto?: any; empresa?: any; catalogId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>('botones');
  const [cuerpo, setCuerpo] = useState('');
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [botones, setBotones] = useState<string[]>(['Sí, me interesa', 'Más información']);
  const [boton, setBoton] = useState('Ver opciones');
  const [secciones, setSecciones] = useState<{ titulo: string; filas: { titulo: string; descripcion: string }[] }[]>([{ titulo: '', filas: [{ titulo: 'Plan Vende', descripcion: 'Punto de venta + inventario' }, { titulo: 'Plan Controla', descripcion: 'Multi-sucursal + reportes' }] }]);
  const [url, setUrl] = useState('');
  const [textoBoton, setTextoBoton] = useState('Ver');
  const [ubic, setUbic] = useState({ lat: '', lng: '', nombre: '', direccion: '' });
  const [vcard, setVcard] = useState({ nombre: yo?.nombre || '', telefono: '', email: yo?.email || '', empresa: 'Sacscloud', puesto: '' });
  const [tarjetas, setTarjetas] = useState<{ imagen: string; cuerpo: string; texto_boton: string; url: string }[]>([{ imagen: '', cuerpo: '', texto_boton: 'Ver', url: '' }, { imagen: '', cuerpo: '', texto_boton: 'Ver', url: '' }]);
  const [sku, setSku] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<any>(null);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }; window.addEventListener('keydown', esc, true); return () => window.removeEventListener('keydown', esc, true); }, []);

  const url_ok = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());
  const errores: string[] = [];
  if (['botones', 'lista', 'cta_url', 'pedir_ubicacion', 'pedir_contacto', 'carrusel', 'catalogo'].includes(tab) && !cuerpo.trim()) errores.push('Falta el texto del mensaje');
  if (cuerpo.length > 1024) errores.push('El texto pasa de 1024 caracteres');
  if (header.length > 60) errores.push('El encabezado pasa de 60');
  if (footer.length > 60) errores.push('El pie pasa de 60');
  if (tab === 'botones') { const b = botones.filter(x => x.trim()); if (!b.length) errores.push('Agrega al menos un botón'); if (b.some(x => x.length > 20)) errores.push('Cada botón: máximo 20 caracteres'); }
  if (tab === 'lista') { const filas = secciones.flatMap(s => s.filas).filter(f => f.titulo.trim()); if (!filas.length) errores.push('Agrega al menos una opción'); if (filas.length > 10) errores.push('Máximo 10 opciones en total'); if (filas.some(f => f.titulo.length > 24)) errores.push('Cada opción: máximo 24 caracteres'); if (!boton.trim() || boton.length > 20) errores.push('El botón del menú: 1 a 20 caracteres'); }
  if (tab === 'cta_url') { if (!url_ok(url)) errores.push('La URL debe empezar con http(s)://'); if (!textoBoton.trim() || textoBoton.length > 20) errores.push('Texto del botón: 1 a 20 caracteres'); }
  if (tab === 'ubicacion') { const la = parseFloat(ubic.lat), ln = parseFloat(ubic.lng); if (isNaN(la) || isNaN(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) errores.push('Latitud/longitud inválidas (ej. 19.4326, -99.1332)'); }
  if (tab === 'contacto') { if (!vcard.nombre.trim()) errores.push('Falta el nombre'); if (!vcard.telefono.trim() && !vcard.email.trim()) errores.push('Pon teléfono o email'); }
  if (tab === 'carrusel') { const t = tarjetas.filter(x => x.imagen.trim() || x.cuerpo.trim()); if (t.length < 2) errores.push('Un carrusel necesita al menos 2 tarjetas'); if (t.some(x => !url_ok(x.imagen))) errores.push('Cada tarjeta necesita una URL de imagen https'); if (t.some(x => !x.cuerpo.trim())) errores.push('Cada tarjeta necesita texto'); if (t.some(x => x.url && !url_ok(x.url))) errores.push('La URL del botón debe ser http(s)'); }
  if (tab === 'producto') { if (!catalogId) errores.push('Configura el ID del catálogo de Meta en Ajustes'); if (!sku.trim()) errores.push('Falta el ID del producto (retailer id)'); }
  if (tab === 'catalogo' && !catalogId) errores.push('Configura el ID del catálogo de Meta en Ajustes');

  const armar = (): any => {
    const base = { cuerpo: cuerpo.trim(), header: header.trim() || null, footer: footer.trim() || null };
    switch (tab) {
      case 'botones': return { interactivo: { tipo: 'botones', ...base, botones: botones.filter(x => x.trim()).map((t, i) => ({ id: `b${i + 1}_${t.trim().toLowerCase().replace(/\W+/g, '_').slice(0, 30)}`, titulo: t.trim() })) } };
      case 'lista': return { interactivo: { tipo: 'lista', ...base, boton: boton.trim(), secciones: secciones.map(s => ({ titulo: s.titulo.trim() || undefined, filas: s.filas.filter(f => f.titulo.trim()).map((f, i) => ({ id: `r${i + 1}_${f.titulo.trim().toLowerCase().replace(/\W+/g, '_').slice(0, 30)}`, titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || undefined })) })).filter(s => s.filas.length) } };
      case 'cta_url': return { interactivo: { tipo: 'cta_url', ...base, texto_boton: textoBoton.trim(), url: url.trim() } };
      case 'pedir_ubicacion': return { interactivo: { tipo: 'pedir_ubicacion', cuerpo: cuerpo.trim() } };
      case 'pedir_contacto': return { interactivo: { tipo: 'pedir_contacto', cuerpo: cuerpo.trim() } };
      case 'ubicacion': return { ubicacion: { lat: parseFloat(ubic.lat), lng: parseFloat(ubic.lng), nombre: ubic.nombre.trim() || undefined, direccion: ubic.direccion.trim() || undefined } };
      case 'contacto': return { contacto: { nombre: vcard.nombre.trim(), telefono: vcard.telefono.trim() || undefined, email: vcard.email.trim() || undefined, empresa: vcard.empresa.trim() || undefined, puesto: vcard.puesto.trim() || undefined } };
      case 'carrusel': return { interactivo: { tipo: 'carrusel', cuerpo: cuerpo.trim(), tarjetas: tarjetas.filter(x => x.imagen.trim()).map(x => ({ imagen: x.imagen.trim(), cuerpo: x.cuerpo.trim(), texto_boton: x.texto_boton.trim() || 'Ver', url: x.url.trim() || undefined })) } };
      case 'producto': return { interactivo: { tipo: 'producto', cuerpo: cuerpo.trim() || null, footer: footer.trim() || null, catalog_id: catalogId, product_retailer_id: sku.trim() } };
      case 'catalogo': return { interactivo: { tipo: 'catalogo', cuerpo: cuerpo.trim() } };
    }
  };
  const enviar = async () => {
    if (errores.length) return;
    setOcupado(true); setError(null);
    const r = await onEnviar(armar());
    setOcupado(false);
    if (r?.error) { setError(r.error_detalle || { titulo: r.error, que_hacer: '' }); return; }
    onCerrar();
  };

  // ── Preview estilo teléfono ──
  const Preview = () => {
    const burb: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: '8px 10px', fontSize: 12, color: '#111', boxShadow: '0 1px 1px rgba(0,0,0,.08)', maxWidth: 240 };
    const btnP = (t: string, k: any) => <div key={k} style={{ background: '#fff', borderRadius: 8, padding: '7px', textAlign: 'center', color: '#00A5F4', fontWeight: 700, fontSize: 12, marginTop: 4, boxShadow: '0 1px 1px rgba(0,0,0,.08)', maxWidth: 240 }}>{t}</div>;
    const texto = cuerpo || <span style={{ color: '#999' }}>Tu mensaje…</span>;
    return (
      <div style={{ background: '#ECE5DD', borderRadius: 14, padding: 14, minHeight: 260 }}>
        {tab === 'ubicacion' ? (
          <div style={burb}><div style={{ height: 90, background: '#cfe3d0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b7', fontSize: 22 }}>📍</div><b style={{ display: 'block', marginTop: 6 }}>{ubic.nombre || 'Ubicación'}</b><span style={{ color: '#666' }}>{ubic.direccion}</span></div>
        ) : tab === 'contacto' ? (
          <div style={burb}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ width: 34, height: 34, borderRadius: 999, background: '#ddd' }} /><span><b>{vcard.nombre || 'Nombre'}</b><br /><span style={{ color: '#666', fontSize: 11 }}>{vcard.telefono || vcard.email}</span></span></div><div style={{ borderTop: '1px solid #eee', marginTop: 6, paddingTop: 6, textAlign: 'center', color: '#00A5F4', fontWeight: 700 }}>Guardar contacto</div></div>
        ) : tab === 'carrusel' ? (
          <div><div style={{ ...burb, marginBottom: 6 }}>{texto}</div><div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>{tarjetas.map((t, i) => <div key={i} style={{ ...burb, width: 150, flexShrink: 0, padding: 0, overflow: 'hidden' }}>{t.imagen ? <img src={t.imagen} alt="" style={{ width: '100%', height: 90, objectFit: 'cover' }} /> : <div style={{ height: 90, background: '#eee' }} />}<div style={{ padding: 8 }}>{t.cuerpo || <span style={{ color: '#999' }}>Texto</span>}</div><div style={{ borderTop: '1px solid #eee', padding: 6, textAlign: 'center', color: '#00A5F4', fontWeight: 700 }}>{t.texto_boton || 'Ver'}</div></div>)}</div></div>
        ) : (
          <div>
            <div style={burb}>
              {header && <b style={{ display: 'block', marginBottom: 3 }}>{header}</b>}
              <div style={{ whiteSpace: 'pre-wrap' }}>{texto}</div>
              {footer && <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>{footer}</div>}
            </div>
            {tab === 'botones' && botones.filter(b => b.trim()).map((b, i) => btnP(b, i))}
            {tab === 'lista' && btnP(`≡ ${boton || 'Ver opciones'}`, 'l')}
            {tab === 'cta_url' && btnP(`↗ ${textoBoton || 'Ver'}`, 'u')}
            {tab === 'pedir_ubicacion' && btnP('📍 Enviar ubicación', 'p')}
            {tab === 'pedir_contacto' && btnP('Compartir contacto', 'pc')}
            {tab === 'producto' && btnP('Ver producto', 'pr')}
            {tab === 'catalogo' && btnP('Ver catálogo', 'cat')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div role="dialog" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(880px, 96vw)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.g100}`, display: 'flex', alignItems: 'center' }}>
          <b style={{ fontSize: 15 }}>Mensaje interactivo</b>
          <span style={{ marginLeft: 10, fontSize: 11, color: C.g400 }}>Solo dentro de la ventana de 24 h (fuera de ella, usa plantilla)</span>
          <button onClick={onCerrar} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 16 }}>✕</button>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div className="wa-scroll" style={{ width: 190, borderRight: `1px solid ${C.g100}`, overflowY: 'auto', padding: 8 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: tab === t.id ? C.moradoAgua : 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2 }}>
                <b style={{ fontSize: 12, color: tab === t.id ? C.moradoTinta : C.g900, display: 'block' }}>{t.l}</b>
                <span style={{ fontSize: 10, color: C.g400 }}>{t.d}</span>
              </button>
            ))}
          </div>
          <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 16px' }}>
            {['botones', 'lista', 'cta_url', 'pedir_ubicacion', 'pedir_contacto', 'carrusel', 'producto', 'catalogo'].includes(tab) && (<>
              {['botones', 'lista', 'cta_url'].includes(tab) && (<><label style={lab}>Encabezado (opcional) <Cont n={header.length} max={60} /></label><input style={inp} value={header} onChange={e => setHeader(e.target.value)} placeholder="Ej. Planes de Sacscloud" /></>)}
              <label style={lab}>Texto del mensaje <Cont n={cuerpo.length} max={1024} /></label>
              <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={cuerpo} onChange={e => setCuerpo(e.target.value)}
                placeholder={tab === 'pedir_ubicacion' ? 'Compártenos tu ubicación para asignarte la sucursal más cercana.' : tab === 'pedir_contacto' ? '¿Nos compartes tu número para darte seguimiento?' : tab === 'catalogo' ? 'Échale un ojo a nuestro catálogo.' : 'Hola {{nombre}}, ¿qué te gustaría hacer?'} />
              {['botones', 'lista', 'cta_url', 'producto'].includes(tab) && (<><label style={lab}>Pie (opcional) <Cont n={footer.length} max={60} /></label><input style={inp} value={footer} onChange={e => setFooter(e.target.value)} placeholder="Ej. Responde con un toque" /></>)}
            </>)}
            {tab === 'botones' && (<>
              <label style={lab}>Botones (máx. 3, 20 caracteres cada uno)</label>
              {botones.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input style={{ ...inp, borderColor: b.length > 20 ? C.rojo300 : C.g200 }} value={b} maxLength={20} onChange={e => setBotones(botones.map((x, j) => j === i ? e.target.value : x))} placeholder={`Botón ${i + 1}`} />
                  <button onClick={() => setBotones(botones.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>
                </div>
              ))}
              {botones.length < 3 && <button onClick={() => setBotones([...botones, ''])} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.moradoTinta, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>+ Agregar botón</button>}
            </>)}
            {tab === 'lista' && (<>
              <label style={lab}>Texto del botón del menú <Cont n={boton.length} max={20} /></label>
              <input style={inp} value={boton} maxLength={20} onChange={e => setBoton(e.target.value)} />
              {secciones.map((s, si) => (
                <div key={si} style={{ border: `1px solid ${C.g100}`, borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input style={{ ...inp, fontWeight: 700 }} value={s.titulo} maxLength={24} onChange={e => setSecciones(secciones.map((x, j) => j === si ? { ...x, titulo: e.target.value } : x))} placeholder={`Título de la sección ${si + 1} (opcional)`} />
                    {secciones.length > 1 && <button onClick={() => setSecciones(secciones.filter((_, j) => j !== si))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>}
                  </div>
                  {s.filas.map((f, fi) => (
                    <div key={fi} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 6, marginTop: 6 }}>
                      <input style={{ ...inp, borderColor: f.titulo.length > 24 ? C.rojo300 : C.g200 }} value={f.titulo} maxLength={24} onChange={e => setSecciones(secciones.map((x, j) => j === si ? { ...x, filas: x.filas.map((y, k) => k === fi ? { ...y, titulo: e.target.value } : y) } : x))} placeholder="Opción" />
                      <input style={inp} value={f.descripcion} maxLength={72} onChange={e => setSecciones(secciones.map((x, j) => j === si ? { ...x, filas: x.filas.map((y, k) => k === fi ? { ...y, descripcion: e.target.value } : y) } : x))} placeholder="Descripción (opcional)" />
                      <button onClick={() => setSecciones(secciones.map((x, j) => j === si ? { ...x, filas: x.filas.filter((_, k) => k !== fi) } : x))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setSecciones(secciones.map((x, j) => j === si ? { ...x, filas: [...x.filas, { titulo: '', descripcion: '' }] } : x))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.moradoTinta, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', padding: 0, marginTop: 6 }}>+ Opción</button>
                </div>
              ))}
              <button onClick={() => setSecciones([...secciones, { titulo: '', filas: [{ titulo: '', descripcion: '' }] }])} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g500, fontSize: 12, fontFamily: 'inherit', padding: 0, marginTop: 8 }}>+ Sección</button>
            </>)}
            {tab === 'cta_url' && (<>
              <label style={lab}>Texto del botón <Cont n={textoBoton.length} max={20} /></label><input style={inp} value={textoBoton} maxLength={20} onChange={e => setTextoBoton(e.target.value)} />
              <label style={lab}>URL</label><input style={{ ...inp, borderColor: url && !url_ok(url) ? C.rojo300 : C.g200 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.sacscloud.com/cotizacion/…" />
            </>)}
            {tab === 'ubicacion' && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={lab}>Latitud</label><input style={inp} value={ubic.lat} onChange={e => setUbic({ ...ubic, lat: e.target.value })} placeholder="19.4326" /></div>
                <div><label style={lab}>Longitud</label><input style={inp} value={ubic.lng} onChange={e => setUbic({ ...ubic, lng: e.target.value })} placeholder="-99.1332" /></div>
              </div>
              <label style={lab}>Nombre del lugar</label><input style={inp} value={ubic.nombre} onChange={e => setUbic({ ...ubic, nombre: e.target.value })} placeholder="Oficinas Sacscloud" />
              <label style={lab}>Dirección</label><input style={inp} value={ubic.direccion} onChange={e => setUbic({ ...ubic, direccion: e.target.value })} placeholder="Calle, colonia, ciudad" />
              <span style={{ fontSize: 10, color: C.g400 }}>Tip: en Google Maps, clic derecho sobre el punto → copia las coordenadas.</span>
            </>)}
            {tab === 'contacto' && (<>
              <label style={lab}>Del equipo</label>
              <select style={inp} onChange={e => { const m = equipo.find((x: any) => x.id === e.target.value); if (m) setVcard(v => ({ ...v, nombre: m.nombre, email: m.email || v.email })); }} defaultValue="">
                <option value="">— elegir —</option>{equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={lab}>Nombre</label><input style={inp} value={vcard.nombre} onChange={e => setVcard({ ...vcard, nombre: e.target.value })} /></div>
                <div><label style={lab}>Puesto</label><input style={inp} value={vcard.puesto} onChange={e => setVcard({ ...vcard, puesto: e.target.value })} placeholder="Ejecutivo de cuenta" /></div>
                <div><label style={lab}>Teléfono (con lada)</label><input style={inp} value={vcard.telefono} onChange={e => setVcard({ ...vcard, telefono: e.target.value })} placeholder="+52 55 3663 4392" /></div>
                <div><label style={lab}>Email</label><input style={inp} value={vcard.email} onChange={e => setVcard({ ...vcard, email: e.target.value })} /></div>
              </div>
              <label style={lab}>Empresa</label><input style={inp} value={vcard.empresa} onChange={e => setVcard({ ...vcard, empresa: e.target.value })} />
            </>)}
            {tab === 'carrusel' && (<>
              {tarjetas.map((t, i) => (
                <div key={i} style={{ border: `1px solid ${C.g100}`, borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}><b style={{ fontSize: 11 }}>Tarjeta {i + 1}</b>{tarjetas.length > 2 && <button onClick={() => setTarjetas(tarjetas.filter((_, j) => j !== i))} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>}</div>
                  <SubirImagen valor={t.imagen} preset="carrusel" carpeta="carrusel" alto={100}
                    onCambio={u => setTarjetas(tarjetas.map((x, j) => j === i ? { ...x, imagen: u || '' } : x))} />
                  <input style={{ ...inp, marginTop: 6 }} value={t.cuerpo} maxLength={160} onChange={e => setTarjetas(tarjetas.map((x, j) => j === i ? { ...x, cuerpo: e.target.value } : x))} placeholder="Texto de la tarjeta" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, marginTop: 6 }}>
                    <input style={inp} value={t.texto_boton} maxLength={20} onChange={e => setTarjetas(tarjetas.map((x, j) => j === i ? { ...x, texto_boton: e.target.value } : x))} placeholder="Botón" />
                    <input style={inp} value={t.url} onChange={e => setTarjetas(tarjetas.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="URL del botón (vacío = respuesta rápida)" />
                  </div>
                </div>
              ))}
              {tarjetas.length < 10 && <button onClick={() => setTarjetas([...tarjetas, { imagen: '', cuerpo: '', texto_boton: 'Ver', url: '' }])} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.moradoTinta, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', padding: 0, marginTop: 8 }}>+ Tarjeta</button>}
            </>)}
            {tab === 'producto' && (<>
              <label style={lab}>ID del producto en el catálogo (retailer id)</label><input style={inp} value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU-1234" />
              <span style={{ fontSize: 10, color: C.g400 }}>Catálogo: {catalogId || 'sin configurar (Ajustes → Catálogo de Meta)'}</span>
            </>)}
            {errores.length > 0 && cuerpo.length + header.length + footer.length > 0 && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 16, fontSize: 11, color: C.rojo500 }}>{errores.map(e => <li key={e}>{e}</li>)}</ul>
            )}
            {error && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: C.rojo50, border: `1px solid ${C.rojo200}`, borderRadius: 8, fontSize: 11, color: C.rojo700 }}>
                <b style={{ display: 'block' }}>{error.titulo}</b>{error.que_paso}<div><b>Qué hacer:</b> {error.que_hacer}</div>
              </div>
            )}
          </div>
          <div style={{ width: 300, borderLeft: `1px solid ${C.g100}`, padding: 16, background: 'rgba(249,250,251,.6)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Así lo verá {contacto?.nombre?.split(' ')[0] || 'el cliente'}</div>
            <Preview />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.g100}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCerrar} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button disabled={!!errores.length || ocupado} onClick={enviar}
            style={{ border: 'none', background: errores.length ? C.g200 : C.emerald600, color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: errores.length ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {ocupado ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
