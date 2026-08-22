import { telefonoWhatsApp } from './telefono';
const KAPSO_API_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.KAPSO_API_KEY || '').trim()
  : '';


export async function sendWhatsApp(to: string, message: string): Promise<{ sent: boolean; error?: string }> {
  if (!KAPSO_API_KEY || !to) return { sent: false, error: 'Not configured or no number' };

  try {
    // Estricto a propósito: si el número no sirve, NO se manda a Kapso con
    // algo inventado. Un mensaje a un número que no existe se cobra igual y
    // desaparece sin error.
    const phone = telefonoWhatsApp(to);
    if (!phone) return { ok: false, error: `Teléfono no utilizable para WhatsApp: ${to}` } as any;
    const res = await fetch('https://api.kapso.ai/v1/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, apikey: KAPSO_API_KEY }),
    });
    const result = await res.json().catch(() => ({}));
    // Un 4xx/5xx de Kapso NO es enviado: quien dedupe por `sent` (p. ej. el
    // cron de recordatorios) marcaría como avisado un mensaje que nunca salió.
    if (!res.ok) return { sent: false, error: result?.error || `HTTP ${res.status}` };
    return { ...result, sent: true };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}
