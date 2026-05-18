// NotificationsTab — feed unificado y claro de TODO lo que pasa con tus referidos.
// Endpoint: /api/partner-portal/notifications
//
// Diseñado para dar certeza al partner ("no me sienta estafado"):
// cada visita, lead, demo, pago y comisión aparece aquí con timestamp,
// status y link directo al lugar del portal donde se ve el detalle.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SS, C } from './styles';
import { Icon } from './icons';
import { apiGet, fmtDate, fmtRel, isDemoMode } from './utils';

type Severity = 'info' | 'success' | 'warning' | 'critical';
type NotifType =
  | 'visita_link'
  | 'lead_registrado'
  | 'demo_agendada'
  | 'demo_realizada'
  | 'demo_no_show'
  | 'demo_cancelada'
  | 'cliente_pago'
  | 'comision_pendiente'
  | 'comision_earned'
  | 'comision_pagada';

type Notification = {
  id: string;
  type: NotifType;
  when: string;
  severity: Severity;
  title: string;
  detail?: string;
  link?: { hash: string; label: string };
  meta?: Record<string, any>;
};

type Response = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  serverTime: string;
};

const STORAGE_KEY = 'sacs_partner_notif_last_seen';

const TYPE_LABEL: Record<NotifType, string> = {
  visita_link:          'Visita',
  lead_registrado:      'Lead',
  demo_agendada:        'Demo agendada',
  demo_realizada:       'Demo completada',
  demo_no_show:         'No show',
  demo_cancelada:       'Demo cancelada',
  cliente_pago:         'Pago',
  comision_pendiente:   'Comisión pendiente',
  comision_earned:      'Comisión confirmada',
  comision_pagada:      'Comisión pagada',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  info:     C.accent,
  success:  C.green,
  warning:  C.amber,
  critical: C.red,
};

const TYPE_ICON: Record<NotifType, (p: any) => JSX.Element> = {
  visita_link:         Icon.Eye,
  lead_registrado:     Icon.Sparkle,
  demo_agendada:       Icon.Calendar,
  demo_realizada:      Icon.CheckCircle,
  demo_no_show:        Icon.AlertCircle,
  demo_cancelada:      Icon.Close,
  cliente_pago:        Icon.Handshake,
  comision_pendiente:  Icon.Money,
  comision_earned:     Icon.Money,
  comision_pagada:     Icon.Bank,
};

const DEMO_NOTIFS: Response = {
  serverTime: new Date().toISOString(),
  unreadCount: 4,
  total: 12,
  notifications: [
    {
      id: 'd-1', type: 'comision_earned', severity: 'success',
      when: new Date(Date.now() - 2 * 3600_000).toISOString(),
      title: 'Bono demo completada: $300 confirmada',
      detail: 'Se incluye en tu próximo pago del día 1',
      link: { hash: 'dinero', label: 'Ver próximo pago' },
    },
    {
      id: 'd-2', type: 'demo_realizada', severity: 'success',
      when: new Date(Date.now() - 3 * 3600_000).toISOString(),
      title: 'Demo completada: Carlos Martínez (Boutique CM)',
      detail: 'Realizada hoy 11:30am · genera tu bono de $300',
      link: { hash: 'dinero', label: 'Ver bono' },
    },
    {
      id: 'd-3', type: 'demo_agendada', severity: 'info',
      when: new Date(Date.now() - 9 * 3600_000).toISOString(),
      title: 'Demo agendada: Marta Núñez (Joyería Marta)',
      detail: 'Programada para el 22 may 4:00pm',
      link: { hash: 'leads', label: 'Ver en pipeline' },
    },
    {
      id: 'd-4', type: 'lead_registrado', severity: 'success',
      when: new Date(Date.now() - 28 * 3600_000).toISOString(),
      title: 'Nuevo lead atribuido: Andrés Vega (Cosméticos AV)',
      detail: 'Fuente: partner-link · interés en plan Fideliza',
      link: { hash: 'leads', label: 'Ver en pipeline' },
    },
    {
      id: 'd-5', type: 'visita_link', severity: 'info',
      when: new Date(Date.now() - 36 * 3600_000).toISOString(),
      title: '12 clicks en tu link',
      detail: 'Slug: andrea',
    },
    {
      id: 'd-6', type: 'comision_pagada', severity: 'success',
      when: new Date(Date.now() - 7 * 86400_000).toISOString(),
      title: 'Comisión venta directa: $2,400 pagada',
      detail: 'Depositado a tu cuenta',
      link: { hash: 'dinero', label: 'Histórico' },
    },
  ],
};

type FilterKey = 'todas' | 'no_leidas' | NotifType;

export default function NotificationsTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [filter, setFilter] = useState<FilterKey>('todas');

  const fetchAll = useCallback(() => {
    setLoading(true);
    apiGet<Response>('/api/partner-portal/notifications?limit=200', isDemoMode() ? DEMO_NOTIFS : undefined)
      .then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh cada 60s mientras el tab está activo
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') fetchAll(); };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchAll(); }, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(id); };
  }, [fetchAll]);

  const notifications = data?.notifications || [];

  // Detectar no leídas: items posteriores a lastSeen
  const isUnread = useCallback((n: Notification) => !lastSeen || n.when > lastSeen, [lastSeen]);
  const unreadCount = useMemo(() => notifications.filter(isUnread).length, [notifications, isUnread]);

  // Marcar todas como leídas
  function markAllRead() {
    const ts = data?.serverTime || new Date().toISOString();
    setLastSeen(ts);
    try { localStorage.setItem(STORAGE_KEY, ts); } catch {}
  }

  // Filtros
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notifications) m[n.type] = (m[n.type] || 0) + 1;
    return m;
  }, [notifications]);

  const visibleNotifs = useMemo(() => {
    if (filter === 'todas') return notifications;
    if (filter === 'no_leidas') return notifications.filter(isUnread);
    return notifications.filter(n => n.type === filter);
  }, [filter, notifications, isUnread]);

  if (loading && !data) return <div style={SS.loading}>Cargando notificaciones…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' as const, marginBottom: 12 }}>
        <div>
          <h1 style={SS.h1Small}>Notificaciones</h1>
          <p style={SS.leadSm}>
            Todo lo que pasa con tus referidos en un solo lugar — desde el primer click hasta la comisión depositada.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={fetchAll} style={{ ...SS.btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon.Refresh size={13} /> Actualizar
          </button>
          <button onClick={markAllRead} disabled={unreadCount === 0}
            style={{ ...SS.btn, opacity: unreadCount === 0 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon.CheckCircle size={13} /> Marcar como leídas
          </button>
        </div>
      </div>

      {/* Stats hero */}
      <div style={SS.statGrid}>
        <Stat label="Eventos totales" value={String(notifications.length)} hint="Últimos 30 días" accent={C.accent} icon={Icon.Activity} />
        <Stat label="Sin leer" value={String(unreadCount)} hint={unreadCount === 0 ? 'Al día' : 'Necesita atención'} accent={unreadCount > 0 ? C.amber : C.green} icon={Icon.Bell} />
        <Stat
          label="Demos agendadas (semana)"
          value={String(notifications.filter(n => n.type === 'demo_agendada' && Date.now() - new Date(n.when).getTime() < 7 * 86400_000).length)}
          hint="Generadas vía tu link"
          accent={C.purple}
          icon={Icon.Calendar}
        />
        <Stat
          label="Comisiones ganadas (semana)"
          value={String(notifications.filter(n => (n.type === 'comision_earned' || n.type === 'comision_pagada') && Date.now() - new Date(n.when).getTime() < 7 * 86400_000).length)}
          hint="Confirmadas o pagadas"
          accent={C.greenDark}
          icon={Icon.Money}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 18 }}>
        <Chip active={filter === 'todas'} onClick={() => setFilter('todas')}>
          Todas · {notifications.length}
        </Chip>
        <Chip active={filter === 'no_leidas'} onClick={() => setFilter('no_leidas')} accent={C.amber}>
          No leídas · {unreadCount}
        </Chip>
        {(Object.keys(TYPE_LABEL) as NotifType[])
          .filter(t => (typeCounts[t] || 0) > 0)
          .map(t => (
            <Chip key={t} active={filter === t} onClick={() => setFilter(t)} accent={SEVERITY_COLOR[severityForType(t)]}>
              {TYPE_LABEL[t]} · {typeCounts[t]}
            </Chip>
          ))}
      </div>

      {/* Feed */}
      {visibleNotifs.length === 0 ? (
        <div style={{ ...SS.card, padding: '48px 32px', textAlign: 'center' as const, color: C.muted, fontSize: 14 }}>
          {filter === 'todas'
            ? 'Aún no hay actividad. En cuanto alguien haga click en tu link, agende demo o pague, aparecerá aquí en segundos.'
            : 'No hay eventos de este tipo. Cambia de filtro para ver más.'}
        </div>
      ) : (
        <div style={SS.card}>
          {visibleNotifs.map((n, i) => (
            <NotifRow key={n.id} n={n} unread={isUnread(n)} isLast={i === visibleNotifs.length - 1} />
          ))}
        </div>
      )}

      {/* Nota de cobertura */}
      <div style={{ ...SS.note, marginTop: 24, fontSize: 12, lineHeight: 1.55 }}>
        <strong>¿Cómo funciona esta lista?</strong> Cada vez que alguien que tiene tu cookie de partner (90 días)
        hace algo en SACS — visita una página, agenda demo, paga su plan — queda registrado aquí con timestamp y
        atribución directa a ti. Si ves algo que no esperabas o falta algo, escríbenos a partners@sacscloud.com.
      </div>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────

function Stat({ label, value, hint, accent, icon: IconCmp }: {
  label: string; value: string; hint?: string; accent: string; icon: (p: any) => JSX.Element;
}) {
  return (
    <div style={SS.statCard}>
      <span style={{ position: 'absolute', top: 24, right: 24, width: 30, height: 30, borderRadius: 8, background: `${accent}14`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconCmp size={15} />
      </span>
      <div style={SS.statLabel}>{label}</div>
      <div style={SS.statValueSm}>{value}</div>
      {hint && <div style={SS.statHint}>{hint}</div>}
    </div>
  );
}

function NotifRow({ n, unread, isLast }: { n: Notification; unread: boolean; isLast: boolean }) {
  const accent = SEVERITY_COLOR[n.severity];
  const IconCmp = TYPE_ICON[n.type] || Icon.Sparkle;

  return (
    <div
      style={{
        display: 'flex', gap: 14,
        padding: '16px 0',
        borderBottom: isLast ? 'none' : `1px solid ${C.borderSoft}`,
        alignItems: 'flex-start',
        position: 'relative' as const,
      }}
    >
      {/* Icon badge */}
      <span style={{
        flexShrink: 0,
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}14`, color: accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        <IconCmp size={17} />
      </span>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginBottom: 4 }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            background: `${accent}14`, color: accent,
            borderRadius: 999,
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          }}>
            {TYPE_LABEL[n.type]}
          </span>
          {unread && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 7px',
              background: '#fef3c7', color: '#92400e',
              borderRadius: 999, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase' as const,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
              Nuevo
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{n.title}</div>
        {n.detail && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{n.detail}</div>
        )}
        {n.link && (
          <a href={`#${n.link.hash}`}
            onClick={(e) => { e.preventDefault(); window.location.hash = n.link!.hash; }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 8, fontSize: 12, fontWeight: 600,
              color: C.brand, textDecoration: 'none',
            }}>
            {n.link.label} <Icon.ArrowRight size={12} />
          </a>
        )}
      </div>

      {/* When */}
      <span style={{
        fontSize: 12, color: C.mutedLight, flexShrink: 0,
        whiteSpace: 'nowrap' as const, marginTop: 4,
        textAlign: 'right' as const,
      }}>
        <div>{fmtRel(n.when)}</div>
        <div style={{ fontSize: 11, marginTop: 2 }}>{fmtDate(n.when)}</div>
      </span>
    </div>
  );
}

function Chip({ active, accent, onClick, children }: {
  active: boolean; accent?: string; onClick: () => void; children: React.ReactNode;
}) {
  const color = accent || C.brand;
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${active ? color : C.border}`,
        background: active ? color : '#fff',
        color: active ? '#fff' : C.text,
        fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        letterSpacing: '-0.005em',
        transition: 'background 0.15s, border-color 0.15s',
      }}>{children}</button>
  );
}

function severityForType(t: NotifType): Severity {
  switch (t) {
    case 'demo_realizada':
    case 'cliente_pago':
    case 'lead_registrado':
    case 'comision_earned':
    case 'comision_pagada':
      return 'success';
    case 'demo_cancelada':
    case 'demo_no_show':
      return 'warning';
    default:
      return 'info';
  }
}
