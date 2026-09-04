// El toque de WhatsApp: el mensaje ya escrito y un botón que abre la
// conversación con él cargado.
//
// Lo manda una persona a propósito. El número es el del mostrador: contesta
// una vendedora atendiendo clientas, y un mensaje automático con pitch ahí
// quema el número. Por eso el primer mensaje solo pregunta con quién se puede
// hablar — es enriquecimiento, no venta.
import { useEffect, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import { Pastilla, fechaHora } from './ui';

const PASOS: { v: 'abre' | 'sigue' | 'cierra'; l: string; pie: string }[] = [
  { v: 'abre', l: 'Primer mensaje', pie: 'Pregunta con quién se puede hablar. No vende.' },
  { v: 'sigue', l: 'Seguimiento', pie: 'Dos o tres días después, con otro ángulo.' },
  { v: 'cierra', l: 'Último', pie: 'Deja la puerta abierta y ya no insiste.' },
];

export default function Whatsapp({ cuentaId, onCambio }: { cuentaId: string; onCambio?: () => void }) {
  const [paso, setPaso] = useState<'abre' | 'sigue' | 'cierra'>('abre');
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    setCargando(true);
    fetch(`/api/crm/abm/whatsapp?cuenta_id=${cuentaId}&paso=${paso}`).then(r => r.json())
      .then(r => { setD(r); setTexto(r.texto || ''); setCargando(false); })
      .catch(() => setCargando(false));
  }, [cuentaId, paso]);

  const marcar = async () => {
    await fetch('/api/crm/abm/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuenta_id: cuentaId, paso, texto }),
    });
    onCambio?.();
  };

  if (cargando && !d) return <Cargando texto="Preparando el mensaje…" />;
  if (d?.error) return (
    <EstadoVacio titulo={d.error.charAt(0).toUpperCase() + d.error.slice(1)}
      pista="El WhatsApp que tenemos sale de lo que el negocio publica. Si no hay, la cola de llamadas es el camino." />
  );

  const enlace = d?.enlace ? d.enlace.split('?text=')[0] + '?text=' + encodeURIComponent(texto) : null;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PASOS.map(p => (
          <button key={p.v} onClick={() => setPaso(p.v)} style={{
            font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
            border: paso === p.v ? `1.5px solid ${P.violeta}` : '1px solid #e6e4ee',
            background: paso === p.v ? P.violeta : '#fff', color: paso === p.v ? '#fff' : '#666',
          }}>{p.l}</button>
        ))}
        {d?.es_de_la_tienda && (
          <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }} titulo="Contesta quien está atendiendo el mostrador">
            es el número de la tienda
          </Pastilla>
        )}
      </div>
      <p style={{ fontSize: '.75rem', color: '#888', margin: 0 }}>{PASOS.find(p => p.v === paso)?.pie}</p>

      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4}
        style={{ font: 'inherit', fontSize: '.8125rem', lineHeight: 1.6, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0dee8', resize: 'vertical' }} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {enlace && (
          <a href={enlace} target="_blank" rel="noopener" onClick={marcar}
            style={{ font: 'inherit', fontSize: '.8125rem', fontWeight: 700, padding: '9px 15px', borderRadius: 9, background: P.violeta, color: '#fff', textDecoration: 'none' }}>
            Abrir WhatsApp con este mensaje
          </a>
        )}
        <span style={{ fontSize: '.75rem', color: '#999' }}>{d?.numero}</span>
      </div>

      {(d?.previos || []).length > 0 && (
        <div style={{ fontSize: '.75rem', color: '#888' }}>
          Ya se mandó: {(d.previos || []).map((p: any, i: number) => (
            <span key={p.id}>{i > 0 ? ' · ' : ''}{p.detalle?.paso || 'mensaje'} el {fechaHora(p.ocurrio_at)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
