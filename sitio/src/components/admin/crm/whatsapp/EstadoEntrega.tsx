// WHATSAPP · Estado de entrega con los checks de WhatsApp y el tooltip que
// traduce los códigos de error de Meta a español (portado de sacs_inbox).
// Nuestro wa_mensajes.error viene como "131047 Re-engagement message; ..." —
// se extrae el primer código numérico.
import { useState } from 'react';
import { C } from './estilo';

import { explicarError } from '../../../../lib/whatsapp/errores';

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
  const x = explicarError(error);
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
          <span style={{ display: 'block', fontWeight: 700, marginBottom: 3 }}>{x.titulo}</span>
          <span style={{ display: 'block', color: '#e5e7eb' }}>{x.que_paso}</span>
          <span style={{ display: 'block', marginTop: 4, color: '#A7F3D0' }}>Qué hacer: {x.que_hacer}</span>
          <span style={{ display: 'block', marginTop: 4, color: C.g400, fontSize: 10 }}>{x.codigo ? `Código Meta ${x.codigo}` : 'Sin código'} · {x.crudo.slice(0, 120)}</span>
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
    // Convención de WhatsApp, que es la que el usuario ya tiene aprendida:
    // gris = salió / llegó, azul = leído. El verde no significaba nada y hacía
    // dudar si «verde» y «azul» eran cosas distintas.
    case 'pending': return <Reloj />;
    case 'sent': return <Check color={C.g400} />;
    case 'delivered': return <DobleCheck color={C.g400} />;
    case 'read': return <DobleCheck color={C.sky300} />;
    case 'failed': return <Fallo error={error} />;
    default: return null;
  }
}

export function errorLegible(error?: string | null): string { return explicarError(error || '').titulo; }
