// TELEFONÍA · Llamadas normales (Twilio Voice SDK) desde el navegador, con el
// número mexicano del negocio como caller ID. La grabación y la minuta las
// hace el SERVIDOR (Twilio graba → webhook → Whisper → Claude): aquí solo se
// marca, se contesta y se cuelga. Convive con Llamadas.tsx (WhatsApp).
import { useEffect, useRef, useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { C } from './estilo';

let DeviceCtor: any = null;   // import perezoso: el SDK pesa y casi nadie lo usa en cada carga

type Activa = { call: any; telefono: string; nombre?: string | null; direccion: 'entrante' | 'saliente'; desde: number };

export default function Telefonia() {
  const [activa, setActiva] = useState<Activa | null>(null);
  const [entrante, setEntrante] = useState<any>(null);   // call de Twilio timbrando
  const [seg, setSeg] = useState(0);
  const [mute, setMute] = useState(false);
  const [error, setError] = useState('');
  const [numero, setNumero] = useState('');
  const deviceRef = useRef<any>(null);
  const activaRef = useRef<Activa | null>(null); activaRef.current = activa;

  const asegurarDevice = async (): Promise<any> => {
    if (deviceRef.current) return deviceRef.current;
    const r = await fetch('/api/crm/telefonia/token').then(x => x.json()).catch(() => null);
    if (!r?.token) throw new Error(r?.faltantes ? `Telefonía sin configurar (faltan ${r.faltantes.length} variables — ve a Configuración WhatsApp → Telefonía)` : (r?.error || 'Sin token'));
    setNumero(r.numero);
    if (!DeviceCtor) DeviceCtor = (await import('@twilio/voice-sdk')).Device;
    const device = new DeviceCtor(r.token, { codecPreferences: ['opus', 'pcmu'] });
    device.on('error', (e: any) => setError(String(e?.message || e)));
    device.on('tokenWillExpire', async () => {
      const t = await fetch('/api/crm/telefonia/token').then(x => x.json()).catch(() => null);
      if (t?.token) device.updateToken(t.token);
    });
    device.on('incoming', (call: any) => {
      // Si ya estoy en llamada, esta se rechaza sola al no contestarla aquí.
      if (activaRef.current) return;
      setEntrante(call);
      call.on('cancel', () => setEntrante((c: any) => c === call ? null : c));
      call.on('disconnect', () => setEntrante((c: any) => c === call ? null : c));
    });
    await device.register();
    deviceRef.current = device;
    return device;
  };

  // Latido: mientras el CRM esté abierto, renovamos identidad cada 4 min para
  // que las entrantes nos timbren. Solo si la telefonía está configurada.
  useEffect(() => {
    let vivo = true;
    const latido = () => fetch('/api/crm/telefonia/token').then(r => r.json()).then(j => {
      if (!vivo || !j?.token) return;
      setNumero(j.numero || '');
      // Registrar el Device en cuanto sabemos que hay config (para RECIBIR).
      asegurarDevice().catch(() => {});
    }).catch(() => {});
    latido();
    const t = setInterval(() => { if (!document.hidden) latido(); }, 4 * 60e3);
    return () => { vivo = false; clearInterval(t); deviceRef.current?.destroy?.(); };
  }, []);

  useEffect(() => { if (!activa) { setSeg(0); return; } const t = setInterval(() => setSeg(Math.round((Date.now() - activa.desde) / 1000)), 1000); return () => clearInterval(t); }, [activa?.desde]);

  const conectar = (call: any, telefono: string, nombre: string | null, direccion: 'entrante' | 'saliente') => {
    call.on('disconnect', () => { setActiva(null); setMute(false); });
    call.on('cancel', () => { setActiva(null); setMute(false); });
    setActiva({ call, telefono, nombre, direccion, desde: Date.now() });
  };

  // Saliente: lo dispara el botón del hilo con un CustomEvent.
  useEffect(() => {
    const h = async (ev: any) => {
      const { telefono, nombre } = ev.detail || {};
      setError('');
      try {
        const device = await asegurarDevice();
        const call = await device.connect({ params: { To: telefono } });
        conectar(call, telefono, nombre, 'saliente');
      } catch (e: any) {
        setError(/NotAllowed|Permission/i.test(String(e)) ? 'El navegador no dio acceso al micrófono.' : String(e?.message || e));
      }
    };
    document.addEventListener('tel-llamar', h); return () => document.removeEventListener('tel-llamar', h);
  }, []);

  const contestar = () => { const c = entrante; if (!c) return; c.accept(); setEntrante(null); conectar(c, c.parameters?.From || '?', null, 'entrante'); };
  const rechazar = () => { entrante?.reject(); setEntrante(null); };
  const colgar = () => { activaRef.current?.call?.disconnect(); setActiva(null); };
  const toggleMute = () => { const a = activaRef.current; if (!a) return; a.call.mute(!mute); setMute(!mute); };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const btn = (bg: string, t: string, onClick: () => void) => <button onClick={onClick} style={{ border: 'none', background: bg, color: '#fff', borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>;

  if (!entrante && !activa && !error) return null;
  return (
    <div style={{ position: 'fixed', top: 62, left: '50%', transform: 'translateX(-50%)', zIndex: 121, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      {entrante && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.g900, color: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 12px 40px rgba(0,0,0,.35)', minWidth: 360 }}>
          <span className="wa-pulso" style={{ width: 34, height: 34, borderRadius: 999, background: '#9B8CFA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>☎</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block', fontSize: 13 }}>Llamada telefónica{numero ? ` · ${telefonoLegible(numero)}` : ''}</b>
            <span style={{ fontSize: 12, color: '#d1d5db' }}>{telefonoLegible(entrante.parameters?.From || '')}</span>
          </span>
          {btn(C.emerald500, 'Contestar', contestar)}
          {btn(C.rojo500, 'Rechazar', rechazar)}
        </div>
      )}
      {activa && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.g900, color: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 12px 40px rgba(0,0,0,.35)', minWidth: 360 }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: '#9B8CFA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{fmt(seg)}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block', fontSize: 13 }}>{activa.nombre || telefonoLegible(activa.telefono)}</b>
            <span style={{ fontSize: 11, color: '#d1d5db' }}>Llamada telefónica · al colgar se genera la minuta sola</span>
          </span>
          {btn(mute ? C.ambar400 : 'rgba(255,255,255,.15)', mute ? 'Activar mic' : 'Silenciar', toggleMute)}
          {btn(C.rojo500, 'Colgar', colgar)}
        </div>
      )}
      {error && (
        <div style={{ background: C.rojo50, color: C.rojo700, border: `1px solid ${C.rojo200}`, borderRadius: 10, padding: '8px 12px', fontSize: 12, maxWidth: 460 }}>
          {error} <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.rojo700, marginLeft: 6 }}>✕</button>
        </div>
      )}
    </div>
  );
}
