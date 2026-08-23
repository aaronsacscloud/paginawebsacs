// INBOX · Llamadas de WhatsApp (Calling API) en el navegador con WebRTC.
//
// Entrante: el cliente toca "Llamar" en WhatsApp → Meta manda el SDP offer por
// el webhook crudo → aquí timbra (banner + tono), y al contestar el navegador
// pide micrófono, arma el SDP answer y lo manda a Kapso (accept). El audio va
// directo entre Meta y este navegador.
// Saliente: solo donde Meta lo permite (en números de EE. UU. no): se pide
// permiso con un mensaje interactivo y luego "connect" con nuestro offer.
import { useEffect, useRef, useState } from 'react';
import { C } from './estilo';
import { telefonoLegible } from '../../../../lib/telefono';

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

async function esperarIce(pc: RTCPeerConnection, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>(res => { const t = setTimeout(res, ms); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
}

type Activa = { call_id: string; telefono: string; nombre?: string | null; direccion: 'entrante' | 'saliente'; desde: number; pc: RTCPeerConnection; stream: MediaStream };

/** Tono de llamada con WebAudio (sin archivos). */
function useTono(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    let ctx: AudioContext | null = null; let vivo = true;
    const sonar = () => {
      if (!vivo) return;
      try {
        ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 440; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.9);
        const o2 = ctx.createOscillator(); o2.frequency.value = 480; o2.connect(g); o2.start(ctx.currentTime + 0.15); o2.stop(ctx.currentTime + 0.9);
      } catch { /* sin audio */ }
      setTimeout(sonar, 3000);
    };
    sonar();
    return () => { vivo = false; ctx?.close().catch(() => {}); };
  }, [activo]);
}

export default function Llamadas({ onAbrir }: { onAbrir?: (conversationId: string) => void }) {
  const [timbrando, setTimbrando] = useState<any[]>([]);
  const [activa, setActiva] = useState<Activa | null>(null);
  const [seg, setSeg] = useState(0);
  const [mute, setMute] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const activaRef = useRef<Activa | null>(null); activaRef.current = activa;
  useTono(timbrando.length > 0 && !activa);

  // Polling de entrantes (5 s) y de estado de la activa (4 s).
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const j = await fetch('/api/crm/whatsapp/llamadas?activas=1').then(r => r.json()).catch(() => null);
      if (j) setTimbrando((j.llamadas || []).filter((l: any) => !activaRef.current || l.call_id !== activaRef.current.call_id));
      const a = activaRef.current;
      if (a) {
        const e = await fetch('/api/crm/whatsapp/llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'estado', call_id: a.call_id }) }).then(r => r.json()).catch(() => null);
        const l = e?.llamada;
        if (l && ['terminada', 'rechazada', 'fallida', 'perdida'].includes(l.estado)) colgar(false);
        else if (l?.sdp_answer && a.direccion === 'saliente' && a.pc.signalingState === 'have-local-offer') a.pc.setRemoteDescription({ type: 'answer', sdp: l.sdp_answer }).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (!activa) { setSeg(0); return; } const t = setInterval(() => setSeg(Math.round((Date.now() - activa.desde) / 1000)), 1000); return () => clearInterval(t); }, [activa?.call_id]);

  const prepararPC = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const pc = new RTCPeerConnection({ iceServers: ICE });
    stream.getTracks().forEach(tr => pc.addTrack(tr, stream));
    pc.ontrack = ev => { if (audioRef.current) { audioRef.current.srcObject = ev.streams[0]; audioRef.current.play().catch(() => {}); } };
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && activaRef.current?.pc === pc) setTimeout(() => { if (activaRef.current?.pc === pc && pc.connectionState !== 'connected') colgar(false); }, 4000); };
    return { pc, stream };
  };

  const contestar = async (l: any) => {
    setError('');
    try {
      const { pc, stream } = await prepararPC();
      await pc.setRemoteDescription({ type: 'offer', sdp: l.sdp_offer });
      const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); await esperarIce(pc);
      const r = await fetch('/api/crm/whatsapp/llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'aceptar', call_id: l.call_id, sdp: pc.localDescription?.sdp }) }).then(x => x.json());
      if (r?.error) { pc.close(); stream.getTracks().forEach(t => t.stop()); setError(r.error); return; }
      const nombre = l.wa_conversaciones?.contacts ? `${l.wa_conversaciones.contacts.nombre || ''} ${l.wa_conversaciones.contacts.apellido || ''}`.trim() : null;
      setActiva({ call_id: l.call_id, telefono: l.telefono, nombre, direccion: 'entrante', desde: Date.now(), pc, stream });
      setTimbrando(t => t.filter(x => x.call_id !== l.call_id));
      if (l.conversation_id) onAbrir?.(l.conversation_id);
    } catch (e: any) { setError(/Permission|NotAllowed/i.test(String(e)) ? 'El navegador no dio acceso al micrófono. Permítelo en el candado de la barra de direcciones.' : String(e?.message || e)); }
  };
  const rechazar = async (l: any) => {
    await fetch('/api/crm/whatsapp/llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'rechazar', call_id: l.call_id }) }).catch(() => {});
    setTimbrando(t => t.filter(x => x.call_id !== l.call_id));
  };
  const colgar = async (avisar = true) => {
    const a = activaRef.current; if (!a) return;
    try { a.pc.close(); a.stream.getTracks().forEach(t => t.stop()); } catch { /* nada */ }
    setActiva(null);
    if (avisar) await fetch('/api/crm/whatsapp/llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'terminar', call_id: a.call_id }) }).catch(() => {});
  };
  const toggleMute = () => { const a = activaRef.current; if (!a) return; a.stream.getAudioTracks().forEach(t => { t.enabled = mute; }); setMute(!mute); };

  // Saliente (expuesto por evento para el botón del header).
  useEffect(() => {
    const h = async (ev: any) => {
      const { conversation_id, telefono, nombre } = ev.detail || {};
      setError('');
      try {
        const { pc, stream } = await prepararPC();
        const offer = await pc.createOffer({ offerToReceiveAudio: true }); await pc.setLocalDescription(offer); await esperarIce(pc);
        const r = await fetch('/api/crm/whatsapp/llamadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'llamar', conversation_id, sdp: pc.localDescription?.sdp }) }).then(x => x.json());
        if (r?.error || !r?.call_id) { pc.close(); stream.getTracks().forEach(t => t.stop()); setError(r?.error || 'Meta no devolvió id de llamada'); return; }
        setActiva({ call_id: r.call_id, telefono, nombre, direccion: 'saliente', desde: Date.now(), pc, stream });
      } catch (e: any) { setError(/Permission|NotAllowed/i.test(String(e)) ? 'El navegador no dio acceso al micrófono.' : String(e?.message || e)); }
    };
    document.addEventListener('wa-llamar', h); return () => document.removeEventListener('wa-llamar', h);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const btn = (bg: string, t: string, onClick: () => void, color = '#fff') => <button onClick={onClick} style={{ border: 'none', background: bg, color, borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>;

  return (
    <>
      <audio ref={audioRef} autoPlay />
      {(timbrando.length > 0 || activa || error) && (
        <div style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 120, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {timbrando.map(l => (
            <div key={l.call_id} role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.g900, color: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 12px 40px rgba(0,0,0,.35)', minWidth: 360 }}>
              <span className="wa-pulso" style={{ width: 34, height: 34, borderRadius: 999, background: C.emerald500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ display: 'block', fontSize: 13 }}>Llamada de WhatsApp</b>
                <span style={{ fontSize: 12, color: '#d1d5db' }}>{l.wa_conversaciones?.contacts ? `${l.wa_conversaciones.contacts.nombre || ''} ${l.wa_conversaciones.contacts.apellido || ''}`.trim() : telefonoLegible(l.telefono)}{l.wa_conversaciones?.companies ? ` · ${l.wa_conversaciones.companies.nombre_comercial || l.wa_conversaciones.companies.nombre}` : ''}</span>
              </span>
              {btn(C.emerald500, 'Contestar', () => contestar(l))}
              {btn(C.rojo500, 'Rechazar', () => rechazar(l))}
            </div>
          ))}
          {activa && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.g900, color: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 12px 40px rgba(0,0,0,.35)', minWidth: 360 }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, background: activa.pc.connectionState === 'connected' ? C.emerald500 : C.ambar400, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{fmt(seg)}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ display: 'block', fontSize: 13 }}>{activa.nombre || telefonoLegible(activa.telefono)}</b>
                <span style={{ fontSize: 11, color: '#d1d5db' }}>{activa.pc.connectionState === 'connected' ? 'En llamada' : activa.direccion === 'saliente' ? 'Llamando…' : 'Conectando…'}</span>
              </span>
              {btn(mute ? C.ambar400 : 'rgba(255,255,255,.15)', mute ? 'Activar mic' : 'Silenciar', toggleMute)}
              {btn(C.rojo500, 'Colgar', () => colgar(true))}
            </div>
          )}
          {error && (
            <div style={{ background: C.rojo50, color: C.rojo700, border: `1px solid ${C.rojo200}`, borderRadius: 10, padding: '8px 12px', fontSize: 12, maxWidth: 420 }}>
              {error} <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.rojo700, marginLeft: 6 }}>✕</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Botón del header del hilo: estado del permiso + Llamar / pedir que nos llame. */
export function BotonLlamar({ conversationId, telefono, nombre, api }: { conversationId: string; telefono: string; nombre?: string | null; api: any }) {
  const [pop, setPop] = useState(false);
  const [permiso, setPermiso] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const abrir = async () => {
    setPop(p => !p); if (permiso) return;
    setCargando(true);
    const j = await fetch(`/api/crm/whatsapp/llamadas?permiso=${encodeURIComponent(telefono.replace(/\D/g, ''))}`).then(r => r.json()).catch(() => null);
    setPermiso(j || { no_disponible: true, motivo: 'Sin respuesta de Kapso' }); setCargando(false);
  };
  const puedeLlamar = !!permiso?.permiso?.actions?.find((a: any) => a.action_name === 'start_call')?.can_perform_action;
  const puedePedir = !!permiso?.permiso?.actions?.find((a: any) => a.action_name === 'send_call_permission_request')?.can_perform_action;
  const estado = permiso?.permiso?.permission?.status;
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={abrir} title="Llamadas de WhatsApp" aria-label="Llamadas" style={{ border: 'none', background: pop ? C.moradoAgua : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: pop ? C.moradoTinta : C.g400 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
      </button>
      {pop && <span onClick={() => setPop(false)} style={{ position: 'fixed', inset: 0, zIndex: 940 }} />}
      {pop && (
        <span style={{ position: 'absolute', right: 0, top: '112%', zIndex: 941, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.12)', width: 280, display: 'block', padding: 12, fontSize: 12 }}>
          <b style={{ display: 'block', marginBottom: 6 }}>Llamadas de WhatsApp</b>
          {cargando ? <span style={{ color: C.g400 }}>Consultando permiso…</span> : permiso?.no_disponible ? (<>
            <span style={{ display: 'block', color: C.g700, lineHeight: 1.45 }}>{permiso.motivo}</span>
            <span style={{ display: 'block', color: C.g500, marginTop: 6, lineHeight: 1.45 }}>Él sí puede llamarte: toca el teléfono arriba de este chat en su WhatsApp y aquí te timbra.</span>
            <button onClick={() => { setPop(false); api.enviarTexto?.(`Si prefieres hablar, puedes llamarnos por WhatsApp tocando el ícono de teléfono en la parte de arriba de este chat.`); }}
              style={{ marginTop: 8, border: 'none', background: C.emerald600, color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Pedirle que nos llame</button>
          </>) : (<>
            <span style={{ display: 'block', color: C.g700 }}>Permiso: <b>{estado === 'temporary' ? `concedido hasta ${new Date((permiso.permiso.permission.expiration_time || 0) * 1000).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'sin permiso'}</b></span>
            <span style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button disabled={!puedeLlamar} onClick={() => { setPop(false); document.dispatchEvent(new CustomEvent('wa-llamar', { detail: { conversation_id: conversationId, telefono, nombre } })); }}
                style={{ flex: 1, border: 'none', background: puedeLlamar ? C.emerald600 : C.g200, color: '#fff', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: puedeLlamar ? 'pointer' : 'default', fontFamily: 'inherit' }}>Llamar</button>
              <button disabled={!puedePedir} onClick={async () => { setPop(false); await api.enviarInteractivo?.({ tipo: 'permiso_llamada', cuerpo: 'Nos gustaría llamarte por WhatsApp para atenderte mejor. ¿Nos das permiso?' }); }}
                style={{ flex: 1, border: `1px solid ${C.g200}`, background: '#fff', color: puedePedir ? C.g700 : C.g300, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: puedePedir ? 'pointer' : 'default', fontFamily: 'inherit' }}>Pedir permiso</button>
            </span>
            <span style={{ display: 'block', color: C.g400, marginTop: 6, fontSize: 10 }}>Meta permite 1 solicitud cada 24 h (2 por semana) y hasta 5 llamadas al día por cliente.</span>
          </>)}
        </span>
      )}
    </span>
  );
}
