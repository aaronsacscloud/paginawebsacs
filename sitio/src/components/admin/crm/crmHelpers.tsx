// Helpers compartidos del CRM: toast propio, badge de SLA (días en etapa),
// chips de registro rápido de actividad y registro automático de cambios de
// etapa. Se usan en Leads / Oportunidades / Clientes para que las 3 vistas se
// comporten igual.
import { useState, useCallback } from 'react';

// ─── Toast propio del componente (no depende de nada global) ───
export type ToastKind = 'ok' | 'error' | 'info';
export function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const show = useCallback((msg: string, kind: ToastKind = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);
  return { toast, show };
}

export function Toast({ toast }: { toast: { msg: string; kind: ToastKind } | null }) {
  if (!toast) return null;
  const bg = toast.kind === 'error' ? '#b93333' : toast.kind === 'info' ? '#1a1a1a' : '#1A8F7A';
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
      background: bg, color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: '0.8125rem',
      fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,0.22)', maxWidth: '90vw',
    }}>{toast.msg}</div>
  );
}

// ─── SLA: días desde una fecha (cambio de etapa / creación) con semáforo ───
export function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Umbrales: <=umbralAmbar verde, hasta umbralRojo ámbar, más rojo.
export function SlaBadge({ since, umbralAmbar = 7, umbralRojo = 21, label = 'en etapa' }: {
  since: string | null | undefined; umbralAmbar?: number; umbralRojo?: number; label?: string;
}) {
  const d = diasDesde(since);
  if (d == null) return null;
  const color = d >= umbralRojo ? '#b93333' : d >= umbralAmbar ? '#a06600' : '#8a94a6';
  const bg = d >= umbralRojo ? '#fce8e8' : d >= umbralAmbar ? '#fff4e0' : '#f1f3f6';
  return (
    <span title={`${d} días ${label}`} style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10,
      background: bg, color, whiteSpace: 'nowrap',
    }}>{d}d{d >= umbralRojo ? ' ⚠' : ''}</span>
  );
}

// ─── Registro automático de cambio de etapa en el timeline ───
export async function logStageChange(opts: {
  contact_id?: string | null; company_id?: string | null; deal_id?: string | null;
  fromLabel?: string; toLabel: string;
}) {
  try {
    await fetch('/api/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: opts.contact_id || null,
        company_id: opts.company_id || null,
        deal_id: opts.deal_id || null,
        tipo: 'stage_change',
        titulo: `Movió a ${opts.toLabel}`,
        descripcion: opts.fromLabel ? `De ${opts.fromLabel} → ${opts.toLabel}` : null,
        automatico: true,
      }),
    });
  } catch { /* no bloquea el movimiento */ }
}

// ─── Chips de registro rápido de actividad ───
const CHIPS: { tipo: string; label: string; icon: string; color: string }[] = [
  { tipo: 'llamada', label: 'Llamada', icon: '📞', color: '#6C5CE7' },
  { tipo: 'whatsapp_enviado', label: 'WhatsApp', icon: '💬', color: '#25D366' },
  { tipo: 'email_enviado', label: 'Correo', icon: '✉️', color: '#1565c0' },
  { tipo: 'tarea', label: 'Tarea', icon: '✓', color: '#E8A838' },
];

export function ActivityChips({ onLog, disabled }: { onLog: (tipo: string, label: string) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {CHIPS.map(c => (
        <button key={c.tipo} disabled={disabled} onClick={() => onLog(c.tipo, c.label)} title={`Registrar ${c.label}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600,
            padding: '5px 10px', borderRadius: 20, cursor: disabled ? 'default' : 'pointer',
            border: '1px solid ' + c.color + '33', background: c.color + '12', color: c.color,
            fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
          }}>
          <span>{c.icon}</span>{c.label}
        </button>
      ))}
    </div>
  );
}
