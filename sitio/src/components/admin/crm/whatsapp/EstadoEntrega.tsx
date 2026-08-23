// WHATSAPP · Estado de entrega con los checks de WhatsApp y el tooltip que
// traduce los códigos de error de Meta a español (portado de sacs_inbox).
// Nuestro wa_mensajes.error viene como "131047 Re-engagement message; ..." —
// se extrae el primer código numérico.
import { useState } from 'react';
import { C } from './estilo';

const ERROR_LABELS: Record<string, string> = {
  '131042': 'Problema de pago en la cuenta de WhatsApp Business',
  '131047': 'Más de 24h sin respuesta, se requiere plantilla',
  '131026': 'El mensaje no pudo ser entregado',
  '131051': 'Tipo de mensaje no soportado',
  '131053': 'Error al subir el archivo multimedia',
  '131009': 'Parámetro inválido',
  '130472': 'Número no registrado en WhatsApp',
  '131021': 'Destino no válido',
  '131048': 'Spam detectado por Meta',
  '131056': 'Demasiados mensajes al mismo número',
};

const Reloj = () => (
  <svg width={14} height={14} style={{ color: C.emerald300 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const Check = ({ color }: { color: string }) => (
  <svg width={14} height={14} style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const DobleCheck = ({ color }: { color: string }) => (
  <svg width={16} height={14} style={{ color }} viewBox="0 0 24 16" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M1 9l4 4L15 3" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 9l4 4L21 3" />
  </svg>
);
const IconoError = () => (
  <svg width={14} height={14} style={{ color: C.rojo400 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function Fallo({ error }: { error?: string | null }) {
  const [tip, setTip] = useState(false);
  if (!error) return <IconoError />;
  const codigo = error.match(/\b(\d{6})\b/)?.[1] || null;
  const label = codigo ? ERROR_LABELS[codigo] : null;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'help' }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <IconoError />
      <span style={{ fontSize: 10, color: C.rojo400, fontWeight: 500 }}>Error</span>
      {tip && (
        <span style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, zIndex: 960, width: 256,
          background: C.g900, color: '#fff', fontSize: 12, borderRadius: 8, padding: '8px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,.25)', pointerEvents: 'none', lineHeight: 1.45,
        }}>
          {label && <span style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>{label}</span>}
          {codigo && <span style={{ display: 'block', color: C.g400, fontSize: 10 }}>Código: {codigo}</span>}
          {!label && <span style={{ display: 'block', marginTop: 2 }}>{error.slice(0, 160)}</span>}
        </span>
      )}
    </span>
  );
}

export default function EstadoEntrega({ status, direccion, error }: {
  status?: string | null; direccion: string; error?: string | null;
}) {
  if (direccion !== 'saliente' || !status) return null;
  switch (status) {
    case 'pending': return <Reloj />;
    case 'sent': return <Check color={C.emerald300} />;
    case 'delivered': return <DobleCheck color={C.emerald300} />;
    case 'read': return <DobleCheck color={C.sky300} />;
    case 'failed': return <Fallo error={error} />;
    default: return null;
  }
}
