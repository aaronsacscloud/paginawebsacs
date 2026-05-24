// AgendaTab del partner portal — reusa SchedulingHub (mismo componente que el
// CRM admin). El scope (qué bookings/event_types/availability ve el partner)
// lo aplica el backend basándose en la cookie sacs_session.
//
// Cualquier mejora a SchedulingHub se propaga automáticamente al admin y aquí.

import { useEffect, useState } from 'react';
import SchedulingHub from '../../scheduling/SchedulingHub';
import { SS, C } from './styles';
import { copyToClipboard } from './utils';

type Props = {
  user: { id: string; nombre: string; email: string };
};

type EventType = { id: string; nombre: string; slug: string; activo: boolean; duracion_minutos: number };

export default function AgendaTab({ user: _user }: Props) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h1 style={SS.h1Small}>Agenda</h1>
        <p style={SS.leadSm}>
          Conecta tu Google Calendar, configura tu disponibilidad y comparte tu link de
          agendamiento. Las citas que tus clientes reserven aparecen aquí y en tu calendario.
        </p>
      </div>

      <ShareLinkCard />

      <div style={{ marginTop: 18, background: '#fff', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden' }}>
        <SchedulingHub variant="partner" />
      </div>
    </div>
  );
}

// Card que muestra el link público principal del partner para que lo comparta.
// Se basa en el primer event_type activo. Si no hay, sugiere crear uno.
function ShareLinkCard() {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/scheduling/event-types?activo=true', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : [])
      .then((data: EventType[]) => {
        const list = Array.isArray(data) ? data : [];
        setEventTypes(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch(() => setEventTypes([]));
  }, []);

  const selected = eventTypes?.find((e) => e.id === selectedId) || null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.sacscloud.com';
  const publicUrl = selected ? `${origin}/agendar/${selected.slug}` : '';
  const qrUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicUrl)}&margin=4`
    : '';

  const copy = async () => {
    if (!publicUrl) return;
    await copyToClipboard(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (eventTypes === null) {
    return (
      <div style={{ padding: 18, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 16, color: C.muted, fontSize: 13 }}>
        Cargando tu link de agenda…
      </div>
    );
  }

  if (!eventTypes.length) {
    return (
      <div style={{
        padding: 18, background: C.brandSoft, border: `1px solid ${C.brandTint}`, borderRadius: 14, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Aún no tienes tipos de evento
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            Crea uno (ej. "Demo de 30 minutos") y aquí aparecerá tu link público para compartir con prospectos.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-share-card" style={{
      padding: 18, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 16,
      display: 'flex', gap: 16, alignItems: 'stretch',
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Tu link de agenda
          </div>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5 }}>
            Comparte este link con tus prospectos para que agenden directamente en tu calendario.
          </div>
        </div>

        {eventTypes.length > 1 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', background: '#fafafa', color: C.text,
            }}
          >
            {eventTypes.map((et) => (
              <option key={et.id} value={et.id}>{et.nombre} ({et.duracion_minutos} min)</option>
            ))}
          </select>
        )}

        <div style={{
          padding: '10px 12px', background: C.brandSoft, borderRadius: 8,
          fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 12, color: C.brandDark, wordBreak: 'break-all',
        }}>
          {publicUrl}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={copy} style={{ ...SS.btn, padding: '8px 16px', fontSize: 13 }}>
            {copied ? '✓ Copiado' : 'Copiar link'}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener"
            style={{ ...SS.btnGhost, padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}
          >
            Abrir vista cliente
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Agenda directo en mi calendario: ${publicUrl}`)}`}
            target="_blank"
            rel="noopener"
            style={{
              padding: '8px 16px', fontSize: 13, textDecoration: 'none', fontWeight: 600,
              background: '#25D366', color: '#fff', borderRadius: 8, display: 'inline-block',
            }}
          >
            Compartir por WhatsApp
          </a>
        </div>
      </div>

      {qrUrl && (
        <div className="ag-share-qr" style={{
          flexShrink: 0, padding: 8, background: '#fff', border: `1px solid ${C.border}`,
          borderRadius: 10, alignSelf: 'center',
        }}>
          <img
            src={qrUrl}
            alt="QR del link de agenda"
            width={120}
            height={120}
            style={{ display: 'block' }}
          />
          <div style={{ fontSize: 10, textAlign: 'center', color: C.muted, marginTop: 4 }}>
            Escanea para agendar
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .ag-share-card { flex-direction: column !important; }
          .ag-share-qr { align-self: flex-start !important; }
        }
      `}} />
    </div>
  );
}
