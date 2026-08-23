// WHATSAPP · Etapa F: el número como activo. Sección propia del menú (wa-numero).
// Salud y calidad (con qué hacer), nombre visible, username, perfil del
// negocio, números conectados, diagnóstico de webhooks/API y setup links.
import { useEffect, useState } from 'react';
import Cargando from '../ui/Cargando';
import { S, Aviso } from '../email/ui';
import { C } from './estilo';
import SubirImagen from '../ui/SubirImagen';

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', background: '#fff' };
const label = (): React.CSSProperties => ({ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', margin: '10px 0 4px' });
const NIVEL = { ok: ['#EAF8F2', '#1E8A63', '#4FBF95'], aviso: ['#FFF4E5', '#9a6a10', '#E8A838'], malo: ['#FEF0EF', '#C0554E', '#EF7A72'] } as const;
const VERTICALES = ['RETAIL', 'PROF_SERVICES', 'OTHER', 'APPAREL', 'AUTO', 'BEAUTY', 'EDU', 'ENTERTAIN', 'EVENT_PLAN', 'FINANCE', 'GROCERY', 'GOVT', 'HOTEL', 'HEALTH', 'NONPROFIT', 'RESTAURANT', 'TRAVEL'];

export default function NumeroWA() {
  const [salud, setSalud] = useState<any>(null);
  const [err, setErr] = useState('');
  const cargarSalud = () => { setSalud(null); fetch('/api/crm/whatsapp/numero?salud=1').then(r => r.json()).then(j => j.error ? setErr(j.error) : setSalud(j)).catch(() => setErr('Sin conexión')); };
  useEffect(() => { cargarSalud(); }, []);
  if (err) return <div style={S.wrap}><Aviso tono="malo">{err}</Aviso></div>;
  if (!salud) return <Cargando texto="Revisando el número con Meta y Kapso…" />;
  const r = salud.resumen; const info = salud.info || {};
  const color = r.nivel === 'verde' ? NIVEL.ok : r.nivel === 'ambar' ? NIVEL.aviso : NIVEL.malo;

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Número de WhatsApp</h2>
        <span style={{ fontSize: 12, color: C.g500 }}>{info.display_phone_number} · {info.verified_name}</span>
        <span style={{ flex: 1 }} />
        <button style={S.btnG} onClick={cargarSalud}>Volver a revisar</button>
      </div>

      {/* 41/42 · Salud */}
      <div style={{ ...S.card, borderLeft: `3px solid ${color[2]}`, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: color[2] }} />
          <b style={{ fontSize: 14 }}>{r.titulo}</b>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.g400 }}>Calidad {info.quality_rating || '—'} · Límite {String(info.messaging_limit_tier || salud.salud?.checks?.phone_number_access?.details?.throughput_tier || '—').replace('TIER_', '')} · Modo {info.account_mode || '—'}</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {r.puntos.map((p: any, i: number) => { const c = NIVEL[p.nivel as keyof typeof NIVEL]; return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: c[0], borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: c[2], marginTop: 5, flexShrink: 0 }} />
              <span style={{ color: C.g900, lineHeight: 1.45 }}>{p.texto}{p.accion && <span style={{ display: 'block', color: c[1], fontWeight: 600, marginTop: 2 }}>Qué hacer: {p.accion}</span>}</span>
            </div>); })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        <DisplayName info={info} />
        <Username />
        <Perfil />
        <Numeros />
        <Diagnostico />
        <SetupLink />
      </div>
    </div>
  );
}

// 43 · Display name
function DisplayName({ info }: { info: any }) {
  const [lista, setLista] = useState<any[]>([]);
  const [nombre, setNombre] = useState('Sacscloud');
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/numero?display_name=1').then(r => r.json()).then(j => setLista(j.solicitudes || [])).catch(() => {});
  useEffect(() => { cargar(); }, []);
  const pedir = async () => { setMsg(''); const r = await fetch('/api/crm/whatsapp/numero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'display_name', nombre }) }).then(x => x.json()); setMsg(r.error || 'Solicitud enviada a Meta. Suele responder en 1-3 días.'); cargar(); };
  const EST: Record<string, string> = { submitted: 'Enviada', pending_review: 'En revisión', approved: 'Aprobada', available_without_review: 'Aprobada sin revisión', declined: 'Rechazada', expired: 'Expirada', failed: 'Falló', applied: 'Aplicada', deferred: 'Diferida', cancelled: 'Cancelada', no_review: 'Sin revisión' };
  return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Nombre visible (display name)</b>
      <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 8px', lineHeight: 1.5 }}>Es lo que el cliente ve en lugar del número. Actual: <b>{info.verified_name}</b> · estado <b>{info.name_status === 'DECLINED' ? 'rechazado' : info.name_status === 'APPROVED' ? 'aprobado' : String(info.name_status || '—').toLowerCase()}</b>. Meta aprueba nombres que coincidan con la marca (sitio web, redes, registro).</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Sacscloud" />
        <button style={S.btnP} onClick={pedir}>Solicitar</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: /enviada/i.test(msg) ? C.emerald700 : C.rojo700, marginTop: 6 }}>{msg}</div>}
      {lista.length > 0 && <div style={{ marginTop: 8 }}>{lista.slice(0, 5).map((s: any) => <div key={s.id} style={{ fontSize: 11, color: C.g500, padding: '3px 0', borderTop: `1px solid ${C.g50}` }}><b>{s.requested_display_name}</b> · {EST[s.status] || s.status} · {new Date(s.submitted_at || s.created_at).toLocaleDateString('es-MX')}{s.meta_error_message ? ` · ${s.meta_error_message}` : ''}</div>)}</div>}
    </div>
  );
}

// 43 · Username
function Username() {
  const [d, setD] = useState<any>(null);
  const [u, setU] = useState('');
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/numero?username=1').then(r => r.json()).then(setD).catch(() => {});
  useEffect(() => { cargar(); }, []);
  const accion = async (body: any) => { setMsg(''); const r = await fetch('/api/crm/whatsapp/numero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()); setMsg(r.error || 'Listo.'); cargar(); };
  return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Nombre de usuario (wa.me/…)</b>
      <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 8px', lineHeight: 1.5 }}>Un alias para que te escriban sin saber el número. {d?.username?.username ? <>Actual: <b>@{d.username.username}</b> ({d.username.status === 'approved' ? 'aprobado' : 'reservado'})</> : 'Sin username todavía.'}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={inp} value={u} onChange={e => setU(e.target.value.toLowerCase())} placeholder="sacscloud" />
        <button style={S.btnP} onClick={() => accion({ accion: 'username', username: u })}>Reservar</button>
        {d?.username?.username && <button style={S.btnG} onClick={() => accion({ accion: 'username_borrar' })}>Quitar</button>}
      </div>
      {Array.isArray(d?.sugerencias) && d.sugerencias.length > 0 && <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{d.sugerencias.slice(0, 6).map((s: string) => <button key={s} onClick={() => setU(s)} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>)}</div>}
      {msg && <div style={{ fontSize: 11, color: /Listo/.test(msg) ? C.emerald700 : C.rojo700, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

// 44 · Perfil del negocio
function Perfil() {
  const [p, setP] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [foto, setFoto] = useState('');
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    setFallo(false); setP(null);
    // Meta a veces tarda: a los 8 s el "cargando" se vuelve un error honesto con Reintentar.
    const tope = setTimeout(() => setFallo(true), 8000);
    fetch('/api/crm/whatsapp/numero?perfil=1').then(r => r.json())
      .then(j => { clearTimeout(tope); setP({ about: '', address: '', description: '', email: '', websites: [], vertical: 'OTHER', ...(j.perfil || {}) }); })
      .catch(() => { clearTimeout(tope); setFallo(true); });
    return () => clearTimeout(tope);
  }, [intento]);
  if (!p && fallo) return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Perfil del negocio</b>
      <p style={{ fontSize: 12, color: C.g500, margin: '6px 0 10px' }}>No se pudo cargar el perfil desde Meta (suele ser un tardío de su API, no algo tuyo).</p>
      <button style={S.btnG} onClick={() => setIntento(x => x + 1)}>Reintentar</button>
    </div>
  );
  if (!p) return <div style={S.card}><Cargando texto="Cargando el perfil de Meta…" /></div>;
  const guardar = async () => { setMsg(''); const r = await fetch('/api/crm/whatsapp/numero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'perfil', about: p.about, address: p.address, description: p.description, email: p.email, websites: p.websites, vertical: p.vertical }) }).then(x => x.json()); setMsg(r.error || 'Perfil guardado en Meta.'); };
  const subirFotoCon = async (url: string) => { setMsg(''); const r = await fetch('/api/crm/whatsapp/numero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'foto', url }) }).then(x => x.json()); setMsg(r.error || 'Foto actualizada en WhatsApp.'); };
  return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Perfil del negocio</b>
      <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 0' }}>Lo que el cliente ve al tocar el nombre en WhatsApp.</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
        {p.profile_picture_url ? <img src={p.profile_picture_url} alt="" style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 56, height: 56, borderRadius: 999, background: C.g100, display: 'inline-block', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SubirImagen valor={foto || null} preset="perfil" carpeta="perfil" alto={110} etiqueta="Foto de perfil"
            ayuda="Se recorta cuadrada a 640×640 y se comprime; así la pide WhatsApp"
            onCambio={u => { setFoto(u || ''); if (u) setTimeout(() => subirFotoCon(u), 50); }} />
        </div>
      </div>
      <label style={label()}>Frase (about) · {(p.about || '').length}/139</label><input style={inp} maxLength={139} value={p.about || ''} onChange={e => setP({ ...p, about: e.target.value })} placeholder="El sistema para tu negocio" />
      <label style={label()}>Descripción · {(p.description || '').length}/512</label><textarea style={{ ...inp, minHeight: 60 }} maxLength={512} value={p.description || ''} onChange={e => setP({ ...p, description: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><label style={label()}>Email</label><input style={inp} value={p.email || ''} onChange={e => setP({ ...p, email: e.target.value })} /></div>
        <div><label style={label()}>Giro</label><select style={inp} value={p.vertical || 'OTHER'} onChange={e => setP({ ...p, vertical: e.target.value })}>{VERTICALES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
      </div>
      <label style={label()}>Dirección</label><input style={inp} value={p.address || ''} onChange={e => setP({ ...p, address: e.target.value })} />
      <label style={label()}>Sitios web (máx. 2, uno por línea)</label><textarea style={{ ...inp, minHeight: 44 }} value={(p.websites || []).join('\n')} onChange={e => setP({ ...p, websites: e.target.value.split('\n') })} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}><button style={S.btnP} onClick={guardar}>Guardar en Meta</button>{msg && <span style={{ fontSize: 11, color: /guardado|actualizada/i.test(msg) ? C.emerald700 : C.rojo700 }}>{msg}</span>}</div>
    </div>
  );
}

// 46 · Números conectados
function Numeros() {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/numero?numeros=1').then(r => r.json()).then(setD).catch(() => setD({ numeros: [] }));
  useEffect(() => { cargar(); }, []);
  const guardar = async (n: any, cambios: any) => { setMsg(''); const r = await fetch('/api/crm/whatsapp/numero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'numero', ...n, ...cambios }) }).then(x => x.json()); setMsg(r.error || 'Guardado.'); cargar(); };
  return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Números conectados en Kapso</b>
      <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 8px', lineHeight: 1.5 }}>Cada número activo recibe mensajes en este inbox y se responde desde el mismo número por el que escribió el cliente. El default se usa para chats nuevos y masivos.</p>
      {!d ? <Cargando texto="Consultando Kapso…" /> : !d.numeros.length ? <div style={{ fontSize: 12, color: C.g400 }}>Kapso no devolvió números.</div> : d.numeros.map((n: any) => (
        <div key={n.phone_number_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.g50}`, fontSize: 12 }}>
          <span style={{ minWidth: 0, flex: 1 }}><b>{n.display_phone_number}</b> · {n.nombre}<span style={{ display: 'block', fontSize: 10, color: C.g400 }}>id {n.phone_number_id} · {n.kind}{n.calls_enabled ? ' · llamadas' : ''}{n.name_status === 'DECLINED' ? ' · nombre rechazado' : ''}</span></span>
          {n.es_default && <span style={{ fontSize: 9, fontWeight: 700, background: C.moradoAgua, color: C.moradoTinta, borderRadius: 999, padding: '1px 7px' }}>default</span>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><input type="checkbox" checked={!!n.activo} onChange={e => guardar(n, { activo: e.target.checked, es_default: n.es_default })} /> activo</label>
          {!n.es_default && <button style={S.btnG} onClick={() => guardar(n, { activo: true, es_default: true })}>Hacer default</button>}
        </div>
      ))}
      {msg && <div style={{ fontSize: 11, color: /Guardado/.test(msg) ? C.emerald700 : C.rojo700, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

// 45 · Diagnóstico
function Diagnostico() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/crm/whatsapp/numero?diagnostico=1').then(r => r.json()).then(setD).catch(() => setD({ entregas: [], fallidas: [], logs: [] })); }, []);
  if (!d) return <div style={S.card}><Cargando texto="Leyendo entregas de webhooks…" /></div>;
  const ok = d.entregas.filter((e: any) => e.status === 'delivered').length, tot = d.entregas.length;
  return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Diagnóstico (últimas 24 h / fallos de 7 días)</b>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12 }}>
        <span><b style={{ color: tot && ok === tot ? C.emerald700 : C.ambar700 }}>{ok}/{tot}</b> webhooks entregados</span>
        <span><b style={{ color: d.fallidas.length ? C.rojo700 : C.emerald700 }}>{d.fallidas.length}</b> fallidos en 7 d</span>
        <span><b style={{ color: d.logs.length ? C.rojo700 : C.emerald700 }}>{d.logs.length}</b> llamadas API con error</span>
      </div>
      {d.fallidas.slice(0, 6).map((f: any) => <div key={f.id} style={{ fontSize: 11, color: C.g500, padding: '4px 0', borderTop: `1px solid ${C.g50}` }}><b style={{ color: C.rojo700 }}>{f.response_status || 'sin respuesta'}</b> · {f.event} · {new Date(f.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · intentos {f.attempt_count} · {String(f.webhook_url || '').replace(/\?.*/, '').slice(0, 60)}</div>)}
      {d.logs.slice(0, 6).map((l: any) => <div key={l.id} style={{ fontSize: 11, color: C.g500, padding: '4px 0', borderTop: `1px solid ${C.g50}` }}><b style={{ color: C.rojo700 }}>{l.response_status}</b> {l.http_method} {l.endpoint} · {l.error_message || ''} · {new Date(l.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>)}
      {!d.fallidas.length && !d.logs.length && <div style={{ fontSize: 12, color: C.emerald700, marginTop: 8 }}>Sin fallos: todo lo que Kapso mandó llegó y todo lo que pedimos respondió bien.</div>}
    </div>
  );
}

// 47 · Setup link
function SetupLink() {
  const [d, setD] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [msg, setMsg] = useState('');
  const cargar = () => fetch('/api/crm/whatsapp/numero?setup=1').then(r => r.json()).then(setD).catch(() => setD({ links: [] }));
  useEffect(() => { cargar(); }, []);
  const crear = async () => { setMsg(''); const r = await fetch('/api/crm/whatsapp/numero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'setup_link', nombre: nombre || 'Cliente Sacscloud' }) }).then(x => x.json()); setMsg(r.error || (typeof r.link === 'string' ? `Link: ${r.link}` : 'Link creado.')); cargar(); };
  return (
    <div style={S.card}>
      <b style={{ fontSize: 13 }}>Conectar el WhatsApp de un cliente (setup link)</b>
      <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 8px', lineHeight: 1.5 }}>Genera una página de Kapso donde un cliente conecta SU número de WhatsApp Business (para cuando el inbox se venda como módulo). Solo aplica si el plan de Kapso lo incluye.</p>
      <div style={{ display: 'flex', gap: 6 }}><input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del cliente" /><button style={S.btnP} onClick={crear}>Generar link</button></div>
      {msg && <div style={{ fontSize: 11, color: /Link/.test(msg) ? C.emerald700 : C.rojo700, marginTop: 6, wordBreak: 'break-all' }}>{msg}</div>}
      {d?.links?.length > 0 && <div style={{ marginTop: 8 }}>{d.links.slice(0, 5).map((l: any, i: number) => <div key={l.id || i} style={{ fontSize: 11, color: C.g500, padding: '3px 0', borderTop: `1px solid ${C.g50}`, wordBreak: 'break-all' }}>{l.url || l.setup_url || JSON.stringify(l).slice(0, 120)} · {l.status || ''}</div>)}</div>}
    </div>
  );
}
