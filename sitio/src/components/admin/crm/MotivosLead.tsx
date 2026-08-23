// CONFIGURACIÓN · Motivos de descarte y de desenlace de un lead.
//
// Los de fábrica se pueden DESACTIVAR pero no borrar: si se borrara uno ya
// usado, los leads descartados con él se quedarían sin explicación y el reporte
// de "por qué se caen" perdería justo lo que se quiere aprender.
import { useEffect, useState } from 'react';

const S = {
  card: { background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '16px 18px 18px', marginBottom: 14 } as const,
  inp: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.82rem', background: '#fdfcff', fontFamily: 'inherit' } as const,
  btnP: { border: 'none', borderRadius: 9, padding: '8px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnG: { border: '1px solid #e2e4e9', borderRadius: 9, padding: '6px 11px', background: '#fff', fontSize: '0.73rem', fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' } as const,
};

const TIPOS = [
  { k: 'descarte', t: 'Por qué NO califica', d: 'Se pide cuando marcas un lead como "a futuro" o "no califica". Sin motivo no se puede guardar: es lo único que después dice qué canal trae curiosos y cuál compradores.' },
  { k: 'desenlace', t: 'Cómo terminó', d: 'Se elige al cerrar un lead que ya llegó a cotización o negociación.' },
];

export default function MotivosLead() {
  const [ms, setMs] = useState<any[] | null>(null);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ t: string; m: string } | null>(null);
  const [busy, setBusy] = useState('');

  const cargar = () => fetch('/api/crm/leads/motivos').then(r => r.json()).then(j => setMs(j.motivos || [])).catch(() => setMs([]));
  useEffect(() => { cargar(); }, []);

  async function pedir(metodo: string, cuerpo: any, url = '/api/crm/leads/motivos') {
    setBusy(cuerpo?.id || cuerpo?.tipo || 'x'); setAviso(null);
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: metodo === 'DELETE' ? undefined : JSON.stringify(cuerpo) });
      const j = await r.json();
      if (!r.ok || j.error) { setAviso({ t: 'malo', m: j.error || 'No se pudo' }); return false; }
      await cargar(); return true;
    } catch { setAviso({ t: 'malo', m: 'Sin conexión' }); return false; }
    finally { setBusy(''); }
  }

  if (!ms) return <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Cargando motivos…</div>;

  return (
    <div>
      {aviso && (
        <div style={{ background: '#FEF0EF', border: '1px solid #C0554E33', borderRadius: 10, padding: '9px 12px', fontSize: '0.78rem', color: '#C0554E', marginBottom: 12 }}>{aviso.m}</div>
      )}
      {TIPOS.map(t => {
        const lista = ms.filter(m => m.tipo === t.k);
        return (
          <div key={t.k} style={S.card}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>{t.t}</div>
            <div style={{ fontSize: '0.74rem', color: '#a5a2af', marginTop: 3, marginBottom: 12, lineHeight: 1.55 }}>{t.d}</div>

            {lista.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f7f6fa' }}>
                <span style={{ flex: 1, fontSize: '0.81rem', fontWeight: 600, color: m.activo ? '#1a1a1a' : '#b3b1bb', textDecoration: m.activo ? 'none' : 'line-through' }}>{m.label}</span>
                {m.de_fabrica && <span style={{ fontSize: '0.56rem', fontWeight: 800, background: '#f4f4f6', color: '#6B7280', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>de fábrica</span>}
                <button style={S.btnG} disabled={busy === m.id} onClick={() => pedir('PUT', { id: m.id, activo: !m.activo })}>
                  {m.activo ? 'Desactivar' : 'Activar'}
                </button>
                {!m.de_fabrica && (
                  <button style={{ ...S.btnG, color: '#C0554E', borderColor: '#f0d6d4' }} disabled={busy === m.id}
                    onClick={() => pedir('DELETE', { id: m.id }, `/api/crm/leads/motivos?id=${m.id}`)}>Borrar</button>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f4f3f7', flexWrap: 'wrap' }}>
              <input style={{ ...S.inp, flex: 1, minWidth: 200 }} placeholder="Agrega el tuyo…"
                value={nuevo[t.k] || ''} onChange={e => setNuevo(p => ({ ...p, [t.k]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && (nuevo[t.k] || '').trim().length >= 3) pedir('POST', { tipo: t.k, label: nuevo[t.k] }).then(ok => ok && setNuevo(p => ({ ...p, [t.k]: '' }))); }} />
              <button style={{ ...S.btnP, opacity: (nuevo[t.k] || '').trim().length >= 3 ? 1 : 0.5 }}
                disabled={(nuevo[t.k] || '').trim().length < 3 || busy === t.k}
                onClick={() => pedir('POST', { tipo: t.k, label: nuevo[t.k] }).then(ok => ok && setNuevo(p => ({ ...p, [t.k]: '' })))}>Agregar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
