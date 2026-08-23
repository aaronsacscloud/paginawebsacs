// WHATSAPP · Nuevo chat: buscar un contacto con WhatsApp utilizable y
// arrancarle conversación. Si ya existe la conversación, se abre; si no,
// SIEMPRE arranca con plantilla (una conversación nueva no tiene ventana).
import { useEffect, useMemo, useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { Avatar } from './ListaConversaciones';
import { SelectorPlantilla } from './Composer';

export default function NuevoChat({ lista, api, onAbrir, onClose }: {
  lista: any[]; api: any; onAbrir: (id: string) => void; onClose: () => void;
}) {
  const [audiencia, setAudiencia] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [telPlantilla, setTelPlantilla] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/crm/whatsapp/broadcasts?audiencia=1').then(r => r.json())
      .then(j => setAudiencia(j.audiencia || [])).catch(() => setAudiencia([]));
  }, []);

  const filtrada = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = audiencia || [];
    if (!s) return base.slice(0, 30);
    return base.filter(a => `${a.nombre} ${a.empresa || ''} ${a.telefono}`.toLowerCase().includes(s)).slice(0, 30);
  }, [audiencia, q]);

  const elegir = (a: any) => {
    const existente = lista.find(c => c.telefono === a.telefono);
    if (existente) { onAbrir(existente.id); onClose(); return; }
    setTelPlantilla(a.telefono);
  };

  if (telPlantilla) {
    return <SelectorPlantilla telefono={telPlantilla} api={api} onClose={onClose} />;
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,40,.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', width: 'min(460px, 94vw)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column' }}>
        <b style={{ fontSize: '0.9rem' }}>Nuevo chat</b>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contacto o empresa…"
          style={{ marginTop: 10, border: '1.5px solid #e4dffb', borderRadius: 9, padding: '9px 12px', fontSize: '0.82rem', fontFamily: 'inherit', background: '#fdfcff' }} />
        <div style={{ overflowY: 'auto', marginTop: 10, minHeight: 120 }}>
          {audiencia === null && <div style={{ padding: 14, fontSize: '0.76rem', color: '#a5a2af' }}>Cargando contactos…</div>}
          {audiencia !== null && !filtrada.length && (
            <div style={{ padding: 14, fontSize: '0.76rem', color: '#a5a2af', lineHeight: 1.6 }}>
              Nadie con WhatsApp utilizable coincide. Los contactos sin teléfono válido no aparecen.
            </div>
          )}
          {filtrada.map(a => (
            <button key={a.telefono} onClick={() => elegir(a)}
              style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 6px', borderBottom: '1px solid #f7f6fa' }}>
              <Avatar nombre={a.nombre} telefono={a.telefono} size={32} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: '0.79rem', display: 'block' }}>{a.nombre}</b>
                {a.empresa && <span style={{ fontSize: '0.68rem', color: '#8a8a92' }}>{a.empresa}</span>}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#8a8a92', fontVariantNumeric: 'tabular-nums' }}>{telefonoLegible(a.telefono)}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 10, alignSelf: 'flex-end', border: '1px solid #e2e4e9', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.74rem', fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
      </div>
    </div>
  );
}
