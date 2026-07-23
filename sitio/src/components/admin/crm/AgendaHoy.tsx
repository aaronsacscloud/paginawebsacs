// Vista "Hoy": lo primero que el vendedor quiere ver al entrar. Junta los
// seguimientos de contactos vencidos y de hoy, más las oportunidades cuyo
// cierre esperado está cerca. Clic → abre el contacto o la pestaña de deals.
import { useEffect, useState } from 'react';

const HOY = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`;
};
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-MX');
// Diferencia en días de CALENDARIO (ambos anclados a mediodía → entero exacto,
// sin drift por hora del día ni DST). Mínimo 1 para un seguimiento ya vencido.
const diasAtraso = (d: string) => {
  const hoy = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00').getTime();
  const fu = new Date(d + 'T12:00:00').getTime();
  return Math.max(1, Math.round((hoy - fu) / 86400000));
};

export default function AgendaHoy({ onOpenContact, onGoDeals }: { onOpenContact: (id: string) => void; onGoDeals: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [cj, dj] = await Promise.all([
        fetch('/api/crm/contacts?limit=500').then(r => r.json()),
        fetch('/api/crm/deals').then(r => r.json()).catch(() => []),
      ]);
      setContacts(cj.contacts || []);
      setDeals(Array.isArray(dj) ? dj : []);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const hoy = HOY();
  const conSeguimiento = contacts.filter(c => c.next_followup && c.tipo !== 'churned');
  const vencidos = conSeguimiento.filter(c => c.next_followup < hoy).sort((a, b) => a.next_followup.localeCompare(b.next_followup));
  const paraHoy = conSeguimiento.filter(c => c.next_followup === hoy);
  const isOpen = (s: string) => !/ganad|perdid/i.test(s || '');
  const cierresProximos = deals
    .filter(d => isOpen(d.stage) && d.fecha_cierre_esperada && d.fecha_cierre_esperada <= addDays(hoy, 7))
    .sort((a, b) => (a.fecha_cierre_esperada || '').localeCompare(b.fecha_cierre_esperada || ''));

  if (loading) return <div style={{ padding: 24 }}><SkeletonList /></div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button onClick={load} style={miniBtn}>Reintentar</button></div>;

  const total = vencidos.length + paraHoy.length;
  const nada = total === 0 && cierresProximos.length === 0;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Hoy</h2>
        <button onClick={load} style={miniBtn}>↻ Actualizar</button>
      </div>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        {nada ? 'Todo al día. Sin seguimientos pendientes.' : `${vencidos.length} vencidos · ${paraHoy.length} para hoy · ${cierresProximos.length} cierres próximos`}
      </div>

      {nada && (
        <div style={{ padding: 48, textAlign: 'center', color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#555' }}>Bandeja limpia</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Agenda seguimientos desde el detalle de cada lead u oportunidad.</div>
        </div>
      )}

      {vencidos.length > 0 && (
        <Section title="⏰ Vencidos" color="#b93333" count={vencidos.length}>
          {vencidos.map(c => (
            <Row key={c.id} onClick={() => onOpenContact(c.id)}
              nombre={nombreDe(c)} sub={c.companies?.nombre || c.email || c.whatsapp || ''}
              right={<span style={{ color: '#b93333', fontWeight: 700, fontSize: '0.75rem' }}>{diasAtraso(c.next_followup)}d de atraso</span>}
              badge={fmtDate(c.next_followup)} badgeColor="#b93333" />
          ))}
        </Section>
      )}

      {paraHoy.length > 0 && (
        <Section title="📅 Para hoy" color="#a06600" count={paraHoy.length}>
          {paraHoy.map(c => (
            <Row key={c.id} onClick={() => onOpenContact(c.id)}
              nombre={nombreDe(c)} sub={c.companies?.nombre || c.email || c.whatsapp || ''}
              right={c.whatsapp ? <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ color: '#2e7d32', fontWeight: 700, fontSize: '0.72rem', textDecoration: 'none' }}>WhatsApp</a> : null}
              badge="Hoy" badgeColor="#a06600" />
          ))}
        </Section>
      )}

      {cierresProximos.length > 0 && (
        <Section title="💰 Cierres próximos (7 días)" color="#2AB5A0" count={cierresProximos.length}>
          {cierresProximos.map(d => (
            <Row key={d.id} onClick={onGoDeals}
              nombre={d.nombre} sub={d.companies?.nombre || d.contacts?.nombre || ''}
              right={<span style={{ fontWeight: 800, color: '#1a1a1a', fontSize: '0.8rem' }}>{money(d.valor_total)}</span>}
              badge={fmtDate(d.fecha_cierre_esperada)} badgeColor="#2AB5A0" />
          ))}
        </Section>
      )}
    </div>
  );
}

function nombreDe(c: any) { return [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || '—'; }
function addDays(iso: string, n: number) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function Section({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1a1a1a' }}>{title}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color, background: color + '18', padding: '1px 8px', borderRadius: 12 }}>{count}</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Row({ nombre, sub, right, badge, badgeColor, onClick }: { nombre: string; sub: string; right: React.ReactNode; badge: string; badgeColor: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fb')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: badgeColor, background: badgeColor + '15', padding: '2px 8px', borderRadius: 8, minWidth: 46, textAlign: 'center' }}>{badge}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function SkeletonList() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ height: 28, width: 120, background: '#eee', borderRadius: 8, marginBottom: 20 }} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 14, marginBottom: 12 }}>
          {[0, 1, 2].map(j => (
            <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
              <div style={{ width: 46, height: 18, background: '#f0f0f0', borderRadius: 6 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, width: '40%', background: '#f0f0f0', borderRadius: 6, marginBottom: 6 }} />
                <div style={{ height: 10, width: '25%', background: '#f4f4f4', borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const miniBtn: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', color: '#555', cursor: 'pointer', fontFamily: 'inherit' };
