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
  const [tareas, setTareas] = useState<any[]>([]);
  const [reuniones, setReuniones] = useState<any[]>([]);
  const [confirmTareaId, setConfirmTareaId] = useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const h = HOY();
      const [cj, dj, tj, rj] = await Promise.all([
        fetch('/api/crm/contacts?limit=500').then(r => r.json()),
        fetch('/api/crm/deals').then(r => r.json()).catch(() => []),
        fetch('/api/crm/activities?tipo=tarea&limit=200').then(r => r.json()).catch(() => []),
        fetch(`/api/scheduling/reuniones?from=${h}&to=${h}`).then(r => r.json()).catch(() => ({})),
      ]);
      setContacts(cj.contacts || []);
      setDeals(Array.isArray(dj) ? dj : []);
      setTareas((Array.isArray(tj) ? tj : []).filter((t: any) => t.metadata?.task && t.metadata?.done !== true));
      setReuniones((rj.data || []).filter((b: any) => !['cancelada', 'reagendada'].includes(b.estado))
        .sort((a: any, b: any) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''))));
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

  const tareasOrdenadas = tareas.slice().sort((a, b) => String(a.metadata?.due_at || '9999').localeCompare(String(b.metadata?.due_at || '9999')));
  const total = vencidos.length + paraHoy.length;
  const nada = total === 0 && cierresProximos.length === 0 && tareasOrdenadas.length === 0 && reuniones.length === 0;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Hoy</h2>
        <button onClick={load} style={miniBtn}>↻ Actualizar</button>
      </div>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        {nada ? 'Todo al día. Sin seguimientos pendientes.' : `${reuniones.length} reuniones · ${vencidos.length} vencidos · ${paraHoy.length} para hoy · ${cierresProximos.length} cierres · ${tareasOrdenadas.length} tareas`}
      </div>
      <style>{`@media (hover: hover) { .ah-row:hover { background: #f8f9fb; } }`}</style>

      {reuniones.length > 0 && (
        <Section title="📹 Reuniones de hoy" color="#2AB5A0" count={reuniones.length}>
          {reuniones.map(b => {
            const ev = Array.isArray(b.event_types) ? b.event_types[0] : b.event_types;
            const hasContact = !!b.invitado_contact_id;
            const goDetalle = () => { if (hasContact) onOpenContact(b.invitado_contact_id); };
            return (
              <Row key={b.id} onClick={goDetalle} clickable={hasContact}
                nombre={b.invitee_nombre || 'Invitado'}
                sub={`${ev?.nombre || 'Reunión'}${b.invitee_empresa ? ' · ' + b.invitee_empresa : ''}${b.host_nombre ? ' · con ' + b.host_nombre : ''}`}
                right={b.google_meet_link
                  ? <a href={b.google_meet_link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', color: '#1A8F7A', fontWeight: 700, fontSize: '0.74rem', textDecoration: 'none' }}>Meet</a>
                  : null}
                badge={String(b.hora_inicio || '').slice(0, 5)} badgeColor="#2AB5A0" />
            );
          })}
        </Section>
      )}

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
              right={c.whatsapp ? <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', color: '#2e7d32', fontWeight: 700, fontSize: '0.72rem', textDecoration: 'none' }}>WhatsApp</a> : null}
              badge="Hoy" badgeColor="#a06600" />
          ))}
        </Section>
      )}

      {tareasOrdenadas.length > 0 && (
        <Section title="✅ Tareas pendientes (onboarding)" color="#6C5CE7" count={tareasOrdenadas.length}>
          {tareasOrdenadas.map(t => {
            const due = t.metadata?.due_at ? new Date(t.metadata.due_at) : null;
            const vencida = due && due.getTime() < Date.now();
            const confirmando = confirmTareaId === t.id;
            return (
              <Row key={t.id}
                onClick={() => {
                  // Confirmación de 2 toques: el 1º arma, el 2º ejecuta (evita
                  // palomear por un click accidental — la fila entera es clickeable).
                  if (!confirmando) { setConfirmTareaId(t.id); setTimeout(() => setConfirmTareaId(c => c === t.id ? '' : c), 2600); return; }
                  setConfirmTareaId('');
                  fetch('/api/crm/activities', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, done: true }) }).then(load).catch(() => load());
                }}
                nombre={t.titulo} sub={confirmando ? '¿Marcar como hecha? click de nuevo para confirmar' : 'click para marcar hecha'}
                right={<span style={{ color: vencida ? '#b93333' : '#888', fontWeight: 700, fontSize: '0.72rem' }}>{due ? (vencida ? 'vencida' : 'para ' + due.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })) : ''}</span>}
                badge={confirmando ? '¿Seguro?' : (t.metadata?.category === 'onboarding' ? 'Onboarding' : 'Tarea')} badgeColor={confirmando ? '#b93333' : '#6C5CE7'} />
            );
          })}
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

function Row({ nombre, sub, right, badge, badgeColor, onClick, clickable = true }: { nombre: string; sub: string; right: React.ReactNode; badge: string; badgeColor: string; onClick: () => void; clickable?: boolean }) {
  // hover por CSS (@media hover:hover en el <style> del componente) + :active
  // táctil por la clase global .crm-row — evita el hover pegajoso en touch.
  return (
    <div onClick={clickable ? onClick : undefined} className={clickable ? 'ah-row crm-row' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', minHeight: 56, borderBottom: '1px solid #f5f5f5', cursor: clickable ? 'pointer' : 'default' }}>
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
