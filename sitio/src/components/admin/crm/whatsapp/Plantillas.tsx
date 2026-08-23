// WHATSAPP · Plantillas de Meta desde el CRM.
//
// Crear aquí = crear en Meta (vía Kapso). La aprobación es de Meta y tarda:
// por eso cada plantilla carga su chip PENDING/APPROVED/REJECTED y el motivo
// de rechazo cuando lo hay. Una aprobada no se edita — se versiona.
import { useEffect, useState } from 'react';
import Cargando, { Corazones } from '../ui/Cargando';
import { S, Tag, Aviso, Vacio, chip } from '../email/ui';

const TONO: Record<string, string> = { APPROVED: 'ok', PENDING: 'aviso', REJECTED: 'malo' };
const CATS = [
  { id: 'UTILITY', label: 'Utilidad', ayuda: 'Transaccional: avisos, recordatorios, confirmaciones.' },
  { id: 'MARKETING', label: 'Marketing', ayuda: 'Promociones y ofertas. El cliente puede darse de baja.' },
];

const VACIA = { nombre: '', idioma: 'es_MX', categoria: 'UTILITY', cuerpo: '', header: '', footer: '' };

export default function Plantillas() {
  const [d, setD] = useState<any>(null);
  const [form, setForm] = useState<any>(null);      // null = lista; objeto = editor
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tono: string; texto: string } | null>(null);
  const [prueba, setPrueba] = useState<any>(null);  // { plantilla, telefono, params[] }

  const cargar = () => fetch('/api/crm/whatsapp/plantillas').then(r => r.json()).then(setD).catch(() => setD({ plantillas: [] }));
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    setGuardando(true); setMsg(null);
    const r = await fetch('/api/crm/whatsapp/plantillas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setGuardando(false);
    if (r.error) { setMsg({ tono: 'malo', texto: r.error }); return; }
    setMsg({ tono: 'ok', texto: 'Enviada a Meta. Quedó PENDING: la aprobación suele tardar minutos u horas.' });
    setForm(null); cargar();
  };

  const enviarPrueba = async () => {
    setGuardando(true); setMsg(null);
    const r = await fetch('/api/crm/whatsapp/plantillas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'probar', nombre: prueba.plantilla.nombre, idioma: prueba.plantilla.idioma,
        telefono: prueba.telefono, params: prueba.params,
      }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setGuardando(false);
    if (r.error) { setMsg({ tono: 'malo', texto: r.error }); return; }
    setMsg({ tono: 'ok', texto: 'Prueba enviada. Revisa el teléfono — y el Inbox, donde quedó espejada.' });
    setPrueba(null);
  };

  if (!d) return <Cargando texto="Cargando plantillas…" />;
  const lista: any[] = d.plantillas || [];

  // Vista previa con las variables marcadas
  const preview = (cuerpo: string) => cuerpo.split(/(\{\{\d+\}\})/g).map((t, i) =>
    /^\{\{\d+\}\}$/.test(t)
      ? <span key={i} style={{ background: '#EEECFE', color: '#5B4BD6', fontWeight: 800, borderRadius: 5, padding: '0 4px' }}>{t}</span>
      : <span key={i}>{t}</span>);

  return (
    <div style={S.wrap}>
      {msg && <div style={{ marginBottom: 12 }}><Aviso tono={msg.tono as any}>{msg.texto}</Aviso></div>}
      {d.sync_error && <div style={{ marginBottom: 12 }}><Aviso tono="aviso" titulo="Catálogo sin sincronizar">{d.sync_error}</Aviso></div>}

      {!form && !prueba && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Plantillas de WhatsApp</h3>
          <span style={{ flex: 1 }} />
          <button style={S.btnG} onClick={cargar}>Actualizar estados</button>
          <button style={S.btnP} onClick={() => setForm({ ...VACIA })}>Nueva plantilla</button>
        </div>

        {!lista.length && <Vacio titulo="Sin plantillas todavía"
          texto="Las plantillas son los mensajes pre-aprobados por Meta: sirven para escribirle a un cliente fuera de la ventana de 24 horas y para los masivos." />}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {lista.map(p => (
            <div key={p.id} style={{ ...S.card, borderLeft: `3px solid ${p.status === 'APPROVED' ? '#4FBF95' : p.status === 'REJECTED' ? '#EF7A72' : '#E8A838'}` }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.84rem', wordBreak: 'break-all' }}>{p.nombre}</b>
                <Tag tono={TONO[p.status] || 'gris'}>{p.status}</Tag>
                <Tag tono="gris">{p.idioma}</Tag>
                <Tag tono={p.categoria === 'MARKETING' ? 'acento' : 'info'}>{p.categoria}</Tag>
              </div>
              {p.header && <div style={{ fontSize: '0.74rem', fontWeight: 700, marginTop: 8 }}>{p.header}</div>}
              <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{preview(p.cuerpo || '')}</div>
              {p.footer && <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 6 }}>{p.footer}</div>}
              {p.status === 'REJECTED' && p.rechazo_motivo && (
                <div style={{ fontSize: '0.7rem', color: '#C0554E', marginTop: 8 }}>Meta la rechazó: {p.rechazo_motivo}</div>
              )}
              <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                {p.status === 'APPROVED' && (
                  <button style={S.btnA} onClick={() => setPrueba({ plantilla: p, telefono: '', params: Array(p.variables || 0).fill('') })}>
                    Enviar prueba
                  </button>
                )}
                {p.status === 'APPROVED' && (
                  <button style={S.btnG} onClick={() => setForm({ ...VACIA, nombre: `${p.nombre}_v2`, idioma: p.idioma, categoria: p.categoria, cuerpo: p.cuerpo, header: p.header || '', footer: p.footer || '' })}>
                    Nueva versión
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </>)}

      {form && (
        <div style={{ ...S.card, maxWidth: 640 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem' }}>Nueva plantilla</h3>
          <p style={{ margin: '0 0 14px', fontSize: '0.74rem', color: '#8a8a92', lineHeight: 1.5 }}>
            Se crea directo en Meta y queda PENDING hasta que la aprueben. Variables: escríbelas
            como {'{{1}}'}, {'{{2}}'}… en orden. Una plantilla aprobada ya no se puede editar.
          </p>
          <label style={S.lbl}>Nombre (minúsculas y guión bajo, p. ej. recordatorio_renovacion)</label>
          <input style={S.inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {CATS.map(c => (
              <button key={c.id} style={chip(form.categoria === c.id)} title={c.ayuda}
                onClick={() => setForm({ ...form, categoria: c.id })}>{c.label}</button>
            ))}
            <select style={{ ...S.inp, width: 'auto' }} value={form.idioma} onChange={e => setForm({ ...form, idioma: e.target.value })}>
              <option value="es_MX">es_MX</option>
              <option value="es">es</option>
              <option value="en_US">en_US</option>
            </select>
          </div>
          <label style={{ ...S.lbl, marginTop: 12 }}>Encabezado (opcional)</label>
          <input style={S.inp} value={form.header} onChange={e => setForm({ ...form, header: e.target.value })} />
          <label style={{ ...S.lbl, marginTop: 12 }}>Cuerpo</label>
          <textarea style={{ ...S.inp, minHeight: 120, resize: 'vertical' }} value={form.cuerpo}
            onChange={e => setForm({ ...form, cuerpo: e.target.value })}
            placeholder={'Hola {{1}}, tu suscripción de {{2}} se renueva el {{3}}.'} />
          <label style={{ ...S.lbl, marginTop: 12 }}>Pie (opcional)</label>
          <input style={S.inp} value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} />

          {form.cuerpo && (
            <div style={{ marginTop: 14, background: '#f7f6fb', borderRadius: 10, padding: '11px 13px' }}>
              <div style={S.kl}>Vista previa</div>
              {form.header && <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: 5 }}>{form.header}</div>}
              <div style={{ fontSize: '0.8rem', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{preview(form.cuerpo)}</div>
              {form.footer && <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 5 }}>{form.footer}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            <button style={S.btnP} disabled={guardando} onClick={crear}>
              {guardando ? <Corazones size={9} color="#fff" /> : 'Crear en Meta'}
            </button>
            <button style={S.btnG} onClick={() => { setForm(null); setMsg(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {prueba && (
        <div style={{ ...S.card, maxWidth: 520 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Probar «{prueba.plantilla.nombre}»</h3>
          <label style={S.lbl}>Teléfono (10 dígitos o E.164)</label>
          <input style={S.inp} value={prueba.telefono} onChange={e => setPrueba({ ...prueba, telefono: e.target.value })} placeholder="55 1234 5678" />
          {prueba.params.map((v: string, i: number) => (
            <div key={i}>
              <label style={{ ...S.lbl, marginTop: 10 }}>{`Variable {{${i + 1}}}`}</label>
              <input style={S.inp} value={v} onChange={e => {
                const params = [...prueba.params]; params[i] = e.target.value;
                setPrueba({ ...prueba, params });
              }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            <button style={S.btnP} disabled={guardando} onClick={enviarPrueba}>
              {guardando ? <Corazones size={9} color="#fff" /> : 'Enviar prueba'}
            </button>
            <button style={S.btnG} onClick={() => setPrueba(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
