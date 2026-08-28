// ══ Interruptor de avisos push del CRM ═════════════════════════════════════
//
// Con la PWA instalada, un lead nuevo debe SONAR en el teléfono. Aquí se pide
// el permiso y se registra la suscripción; el envío vive en lib/crm/push-crm.
//
// Se muestra el estado real, no una promesa: «Activos», «Actívalos» o
// «Bloqueados en el navegador» (que solo se arregla desde los ajustes del
// sistema y por eso se dice con todas sus letras).
import { useEffect, useState } from 'react';

type Estado = 'cargando' | 'no-soportado' | 'sin-vapid' | 'apagados' | 'activos' | 'bloqueados';

const b64aBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

export default function AvisosPush({ compacto }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return setEstado('no-soportado');
      if (Notification.permission === 'denied') return setEstado('bloqueados');
      const reg = await navigator.serviceWorker.getRegistration('/admin/crm').catch(() => null)
        || await navigator.serviceWorker.ready.catch(() => null);
      const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      setEstado(sub ? 'activos' : 'apagados');
    })();
  }, []);

  const encender = async () => {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado(permiso === 'denied' ? 'bloqueados' : 'apagados'); return; }
      const llave = await fetch('/api/crm/push').then(r => r.json()).catch(() => null);
      if (!llave?.publicKey) { setEstado('sin-vapid'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(llave.publicKey) });
      const r = await fetch('/api/crm/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      }).then(x => x.json()).catch(() => null);
      setEstado(r?.ok ? 'activos' : 'apagados');
    } finally { setOcupado(false); }
  };

  const apagar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/crm/push?endpoint=' + encodeURIComponent(sub.endpoint), { method: 'DELETE' }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setEstado('apagados');
    } finally { setOcupado(false); }
  };

  if (estado === 'cargando' || estado === 'no-soportado') return null;

  const texto: Record<Estado, string> = {
    cargando: '', 'no-soportado': '',
    'sin-vapid': 'Faltan las llaves del servidor para mandar avisos',
    apagados: 'Avísame cuando entre un lead',
    activos: 'Te avisamos cuando entre un lead',
    bloqueados: 'Los avisos están bloqueados en los ajustes del navegador',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compacto ? '12px 0' : '14px 24px', borderBottom: compacto ? 'none' : '1px solid #efeef2' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a' }}>Avisos de lead nuevo</div>
        <div style={{ fontSize: '0.78rem', color: '#8f8d98', marginTop: 2 }}>{texto[estado]}</div>
      </div>
      {estado === 'activos' ? (
        <button onClick={apagar} disabled={ocupado} style={{ minHeight: 40, padding: '0 14px', borderRadius: 12, border: '1px solid #dddce3', background: '#fff', color: '#1a1a1a', fontWeight: 650, fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', flex: 'none' }}>Apagar</button>
      ) : estado === 'apagados' ? (
        <button onClick={encender} disabled={ocupado} style={{ minHeight: 40, padding: '0 16px', borderRadius: 12, border: 'none', background: '#5B4BD6', color: '#fff', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', flex: 'none' }}>{ocupado ? 'Activando…' : 'Activar'}</button>
      ) : null}
    </div>
  );
}
