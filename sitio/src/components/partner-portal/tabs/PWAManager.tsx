// Componente invisible que maneja PWA: registro de SW, detección offline,
// suscripción a push notifications. Expone hooks via custom events.
//
// Eventos emitidos:
// - 'sacs-online' / 'sacs-offline' — cambios de conexión
// - 'sacs-push-permission-changed' — detail: 'granted' | 'denied' | 'default'
// - 'sacs-push-subscribed' — el usuario activó push exitosamente

import { useEffect, useState } from 'react';
import { C } from './styles';

type Props = {
  user: { id: string; nombre: string; email: string };
};

export default function PWAManager({ user }: Props) {
  const [offline, setOffline] = useState(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    // Registrar service worker
    if ('serviceWorker' in navigator && !location.pathname.startsWith('/admin')) {
      navigator.serviceWorker.register('/sw.js', { scope: '/partner/' }).catch(err => {
        console.warn('[pwa] SW register failed', err);
      });
    }

    // Estado online/offline
    const onOnline = () => {
      setOffline(false);
      setRecovered(true);
      setTimeout(() => setRecovered(false), 3000);
      window.dispatchEvent(new CustomEvent('sacs-online'));
    };
    const onOffline = () => {
      setOffline(true);
      window.dispatchEvent(new CustomEvent('sacs-offline'));
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (!navigator.onLine) onOffline();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // El SW envía mensaje cuando el usuario hace click en notificación
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'navigate' && msg.url) {
        const url = new URL(msg.url, location.origin);
        if (url.pathname === location.pathname) {
          location.hash = url.hash || '';
        } else {
          location.href = msg.url;
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      {offline && (
        <div role="status" aria-live="polite" className="pwa-offline-badge">
          <span className="pwa-offline-dot" /> Sin conexión · viendo última versión guardada
        </div>
      )}
      {recovered && !offline && (
        <div role="status" aria-live="polite" className="pwa-recovered-toast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Conectado · actualizando datos
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .pwa-offline-badge {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: ${C.amber};
          color: #1a1a1a;
          padding: 8px 16px 8px 14px;
          border-radius: 999px;
          font-family: var(--font-body, system-ui);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.005em;
          z-index: 200;
          box-shadow: 0 8px 24px -10px rgba(0,0,0,0.18);
          display: flex;
          align-items: center;
          gap: 8px;
          animation: pwa-slide-down 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .pwa-offline-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #1a1a1a;
          animation: pwa-pulse 1.4s ease-in-out infinite;
        }
        @keyframes pwa-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pwa-slide-down {
          from { transform: translate(-50%, -120%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .pwa-recovered-toast {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: ${C.greenDark};
          color: #fff;
          padding: 8px 16px;
          border-radius: 999px;
          font-family: var(--font-body, system-ui);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.005em;
          z-index: 200;
          box-shadow: 0 8px 24px -10px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          gap: 8px;
          animation: pwa-slide-down 0.3s cubic-bezier(0.16,1,0.3,1);
        }
      ` }} />
    </>
  );
}

// Helpers exportados para que otros componentes activen push

export async function ensurePushSubscription(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'no_window' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'push_not_supported' };
  }

  // 1. Pedir permiso
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'permission_denied' };
  }
  window.dispatchEvent(new CustomEvent('sacs-push-permission-changed', { detail: permission }));

  // 2. Obtener registration del SW
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (e) {
    return { ok: false, error: 'sw_not_ready' };
  }

  // 3. Obtener public key del servidor
  let publicKey: string;
  try {
    const r = await fetch('/api/partner-portal/push-public-key');
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, error: data.error || `public_key_${r.status}` };
    }
    const data = await r.json();
    publicKey = data.publicKey;
  } catch (e) {
    return { ok: false, error: 'public_key_fetch_failed' };
  }

  // 4. Crear suscripción
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || 'subscribe_failed' };
  }

  // 5. Enviar al backend
  const subJson = subscription.toJSON() as any;
  try {
    const r = await fetch('/api/partner-portal/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        user_agent: navigator.userAgent,
      }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, error: data.error || `save_${r.status}` };
    }
  } catch (e) {
    return { ok: false, error: 'save_failed' };
  }

  window.dispatchEvent(new CustomEvent('sacs-push-subscribed'));
  return { ok: true };
}

export async function checkPushStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, permission: 'default' as NotificationPermission, subscribed: false };
  }
  const permission = Notification.permission;
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
    }
  } catch { /* ignore */ }
  return { supported: true, permission, subscribed };
}

export async function sendTestPush(type: 'pago' | 'lead' | 'demo' | 'partner' | 'achievement' = 'pago'): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/partner-portal/push-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: data.error || `status_${r.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'test_send_failed' };
  }
}

// urlBase64ToUint8Array — utility estándar para VAPID keys
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
