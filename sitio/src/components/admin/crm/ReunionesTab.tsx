import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClienteDrawer } from './SubscriptionsTab';

/* ═══ Reuniones (VENTAS) — listado operativo de TODAS las reuniones ═══
 * Las del founder y las de partners, segmentadas y ligadas al CRM real:
 * cliente → 360 del ARR, prospecto/contacto → perfil de contacto.
 * La CONFIGURACIÓN de agenda (tipos de evento, disponibilidad, links) vive
 * aparte en Sistema → Agenda. */

type Segmento = 'hoy' | 'semana' | 'proximas' | 'pasadas' | 'todas';

const ESTADOS: Record<string, { label: string; bg: string; color: string }> = {
  pendiente:  { label: 'Pendiente',  bg: '#FEF3C7', color: '#92400E' },
  confirmada: { label: 'Confirmada', bg: '#DBEAFE', color: '#1D4ED8' },
  realizada:  { label: 'Asistió',    bg: '#D1FAE5', color: '#065F46' },
  no_show:    { label: 'No asistió', bg: '#FEE2E2', color: '#B91C1C' },
  cancelada:  { label: 'Cancelada',  bg: '#F3F4F6', color: '#6B7280' },
  // reschedule.ts deja el booking viejo en 'reagendada' — sin esta llave el
  // badge caía a "Pendiente" y salían filas duplicadas en Próximas/calendario.
  reagendada: { label: 'Reagendada', bg: '#EDE9FE', color: '#5B21B6' },
};

const TIPO_INVITADO: Record<string, { label: string; bg: string; color: string }> = {
  cliente:   { label: 'Cliente',   bg: 'rgba(42,181,160,0.14)', color: '#1A8F7A' },
  prospecto: { label: 'Prospecto', bg: 'rgba(75,123,229,0.12)', color: '#3764c4' },
  contacto:  { label: 'Contacto',  bg: 'rgba(26,26,26,0.07)',   color: '#555' },
};

const S = {
  kpi: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 16px', flex: 1, minWidth: 130 } as const,
  kLabel: { fontSize: '0.68rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  kValue: { fontSize: '1.35rem', fontWeight: 800, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' as const },
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16 } as const,
  input: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 7, fontSize: '0.8125rem', background: '#fff' } as const,
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.4px', borderBottom: '1px solid #f0f0f0' },
  td: { padding: '9px 10px', fontSize: '0.8125rem', color: '#333', borderBottom: '1px solid #f7f7f7', verticalAlign: 'middle' as const },
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700 } as const,
  btnSmall: { padding: '4px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' as const } as const,
  seg: (on: boolean) => ({ padding: '6px 14px', borderRadius: 99, border: '1px solid ' + (on ? '#1a1a1a' : '#ddd'), background: on ? '#1a1a1a' : '#fff', color: on ? '#fff' : '#555', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }) as const,
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MESES[m - 1]} ${y}`;
};
const fmtTime = (t?: string | null) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
const hoyStr = () => {
  // fecha "hoy" en horario de México (el server/browser puede estar en otra TZ)
  const now = new Date(Date.now() - 6 * 3600000);
  return now.toISOString().slice(0, 10);
};

function adminFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (!headers.has('x-user-id')) headers.set('x-user-id', 'founder');
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}

export default function ReunionesTab({ onOpenContact }: { onOpenContact?: (id: string) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista');
  const [segmento, setSegmento] = useState<Segmento>('proximas');
  const [fEstado, setFEstado] = useState('');
  const [fHost, setFHost] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [search, setSearch] = useState('');
  const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
  const [reagendar, setReagendar] = useState<any>(null);
  const [cancelArmed, setCancelArmed] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [calMes, setCalMes] = useState(() => hoyStr().slice(0, 7)); // YYYY-MM

  const avisar = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await adminFetch('/api/scheduling/reuniones');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j.data || []);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const hosts = useMemo(() => {
    const m = new Map<string, string>();
    data.forEach(b => { if (b.host_id && b.host_nombre && !b.host_es_mio) m.set(b.host_id, b.host_nombre); });
    return Array.from(m.entries());
  }, [data]);

  const hoy = hoyStr();
  const finSemana = useMemo(() => {
    const d = new Date(hoy + 'T12:00:00');
    d.setDate(d.getDate() + (7 - (d.getDay() === 0 ? 7 : d.getDay())));
    return d.toISOString().slice(0, 10);
  }, [hoy]);

  const filtered = useMemo(() => {
    let rows = data;
    if (segmento === 'hoy') rows = rows.filter(b => b.fecha === hoy);
    else if (segmento === 'semana') rows = rows.filter(b => b.fecha >= hoy && b.fecha <= finSemana);
    else if (segmento === 'proximas') rows = rows.filter(b => b.fecha >= hoy && (b.estado === 'confirmada' || b.estado === 'pendiente'));
    else if (segmento === 'pasadas') rows = rows.filter(b => b.fecha < hoy || b.estado === 'realizada' || b.estado === 'no_show');
    if (fEstado) rows = rows.filter(b => b.estado === fEstado);
    if (fHost === 'mias') rows = rows.filter(b => b.host_es_mio);
    else if (fHost === 'partners') rows = rows.filter(b => b.host_es_partner);
    else if (fHost) rows = rows.filter(b => b.host_id === fHost);
    if (fTipo) rows = rows.filter(b => b.event_types?.id === fTipo);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(b => [b.invitee_nombre, b.invitee_email, b.invitee_empresa, b.invitado_company_nombre, b.host_nombre]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    // pasadas: más recientes primero; resto cronológico
    return segmento === 'pasadas' ? [...rows].reverse() : rows;
  }, [data, segmento, fEstado, fHost, fTipo, search, hoy, finSemana]);

  const eventTypes = useMemo(() => {
    const m = new Map<string, any>();
    data.forEach(b => { if (b.event_types) m.set(b.event_types.id, b.event_types); });
    return Array.from(m.values());
  }, [data]);

  const kpis = useMemo(() => {
    const activas = data.filter(b => b.estado === 'confirmada' || b.estado === 'pendiente');
    const historicas = data.filter(b => b.estado === 'realizada' || b.estado === 'no_show');
    const noShows = historicas.filter(b => b.estado === 'no_show').length;
    return {
      hoy: activas.filter(b => b.fecha === hoy).length,
      proximas: activas.filter(b => b.fecha >= hoy).length,
      realizadas: data.filter(b => b.estado === 'realizada').length,
      noShowPct: historicas.length ? Math.round(noShows * 100 / historicas.length) : 0,
    };
  }, [data, hoy]);

  async function marcar(b: any, estado: 'realizada' | 'no_show') {
    setBusyId(b.id);
    try {
      const r = await adminFetch('/api/scheduling/bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, estado }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      avisar(estado === 'realizada' ? 'Marcada como asistió ✓' : 'Marcada como no asistió');
      await load();
    } catch (e: any) { avisar('Error: ' + (e?.message || 'no se pudo actualizar')); }
    setBusyId(null);
  }

  async function cancelar(b: any) {
    if (cancelArmed !== b.id) { setCancelArmed(b.id); setTimeout(() => setCancelArmed(c => c === b.id ? null : c), 4000); return; }
    setCancelArmed(null); setBusyId(b.id);
    try {
      const r = await adminFetch('/api/scheduling/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: b.id, admin: 1 }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      avisar('Reunión cancelada');
      await load();
    } catch (e: any) { avisar('Error: ' + (e?.message || 'no se pudo cancelar')); }
    setBusyId(null);
  }

  function abrirInvitado(b: any) {
    if (b.invitado_tipo === 'cliente' && b.invitado_company_id) setDrawerCompanyId(b.invitado_company_id);
    else if (b.invitado_contact_id && onOpenContact) onOpenContact(b.invitado_contact_id);
  }

  const filaAcciones = (b: any) => {
    const activa = b.estado === 'confirmada' || b.estado === 'pendiente';
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {activa && <>
          <button disabled={busyId === b.id} style={{ ...S.btnSmall, color: '#065F46', borderColor: '#A7F3D0' }} onClick={() => marcar(b, 'realizada')}>Asistió</button>
          <button disabled={busyId === b.id} style={{ ...S.btnSmall, color: '#B91C1C', borderColor: '#FECACA' }} onClick={() => marcar(b, 'no_show')}>No asistió</button>
          <button disabled={busyId === b.id} style={S.btnSmall} onClick={() => setReagendar(b)}>Reagendar</button>
          <button disabled={busyId === b.id} style={{ ...S.btnSmall, color: cancelArmed === b.id ? '#fff' : '#999', background: cancelArmed === b.id ? '#B91C1C' : '#fff' }} onClick={() => cancelar(b)}>
            {cancelArmed === b.id ? '¿Confirmar?' : 'Cancelar'}
          </button>
        </>}
        {b.google_meet_link && (
          <button style={{ ...S.btnSmall, color: '#3764c4' }} onClick={() => { navigator.clipboard?.writeText(b.google_meet_link); avisar('Link de Meet copiado'); }}>Meet ⧉</button>
        )}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando reuniones…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div style={{ padding: '18px 24px' }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['Hoy', kpis.hoy], ['Próximas', kpis.proximas], ['Realizadas', kpis.realizadas], ['Tasa no-show', kpis.noShowPct + '%']].map(([l, v]) => (
          <div key={String(l)} style={S.kpi}><div style={S.kLabel}>{l}</div><div style={S.kValue}>{v}</div></div>
        ))}
      </div>

      {/* Segmentos + vista */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {(['hoy', 'semana', 'proximas', 'pasadas', 'todas'] as Segmento[]).map(s => (
          <button key={s} style={S.seg(segmento === s)} onClick={() => setSegmento(s)}>
            {{ hoy: 'Hoy', semana: 'Esta semana', proximas: 'Próximas', pasadas: 'Pasadas', todas: 'Todas' }[s]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={S.seg(vista === 'lista')} onClick={() => setVista('lista')}>☰ Lista</button>
        <button style={S.seg(vista === 'calendario')} onClick={() => setVista('calendario')}>▦ Calendario</button>
        <button style={{ ...S.btnSmall, padding: '6px 12px' }} onClick={load}>↻</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar invitado, empresa o host…" style={{ ...S.input, flex: 1, minWidth: 200 }} />
        <select value={fHost} onChange={e => setFHost(e.target.value)} style={S.input}>
          <option value="">Todos los hosts</option>
          <option value="mias">Mías</option>
          <option value="partners">De partners</option>
          {hosts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={S.input}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={S.input}>
          <option value="">Todos los tipos</option>
          {eventTypes.map((et: any) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
        </select>
      </div>

      {vista === 'lista' ? (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead><tr>{['Fecha', 'Hora', 'Invitado', 'Tipo', 'Evento', 'Host', 'Estado', 'Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(b => {
                  const est = ESTADOS[b.estado] || ESTADOS.pendiente;
                  const ti = b.invitado_tipo ? TIPO_INVITADO[b.invitado_tipo] : null;
                  const clickable = !!(b.invitado_company_id || b.invitado_contact_id);
                  return (
                    <tr key={b.id}>
                      <td style={{ ...S.td, whiteSpace: 'nowrap', fontWeight: b.fecha === hoy ? 800 : 400 }}>{fmtDate(b.fecha)}{b.fecha === hoy ? ' · hoy' : ''}</td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{fmtTime(b.hora_inicio)}</td>
                      <td style={S.td}>
                        <div onClick={() => clickable && abrirInvitado(b)} style={{ cursor: clickable ? 'pointer' : 'default' }} title={clickable ? 'Abrir expediente' : undefined}>
                          <span style={{ fontWeight: 700, color: clickable ? '#1D4ED8' : '#333', textDecoration: clickable ? 'underline' : 'none', textUnderlineOffset: 3 }}>{b.invitee_nombre || '—'}</span>
                          <div style={{ fontSize: '0.7rem', color: '#999' }}>{b.invitado_company_nombre || b.invitee_empresa || b.invitee_email || ''}</div>
                        </div>
                      </td>
                      <td style={S.td}>{ti ? <span style={{ ...S.badge, background: ti.bg, color: ti.color }}>{ti.label}</span> : <span style={{ color: '#ccc' }}>—</span>}
                        {b.referrer_nombre ? <div style={{ fontSize: '0.66rem', color: '#a06600', marginTop: 2 }}>ref: {b.referrer_nombre}</div> : null}
                      </td>
                      <td style={S.td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: b.event_types?.color || '#999' }} />{b.event_types?.nombre || '—'}</span></td>
                      <td style={S.td}>{b.host_es_mio ? <strong>Tú</strong> : (b.host_nombre || '—')}{b.host_es_partner ? <span style={{ fontSize: '0.66rem', color: '#999' }}> · partner</span> : null}</td>
                      <td style={S.td}><span style={{ ...S.badge, background: est.bg, color: est.color }}>{est.label}</span></td>
                      <td style={S.td}>{filaAcciones(b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Sin reuniones en este segmento. Ajusta filtros o cambia de segmento.</div>}
          </div>
        </div>
      ) : (
        <CalendarioMes mes={calMes} setMes={setCalMes} bookings={data.filter(b => b.estado !== 'cancelada' && b.estado !== 'reagendada')} hoy={hoy} onOpen={abrirInvitado} />
      )}

      {drawerCompanyId && <ClienteDrawer companyId={drawerCompanyId} onClose={() => setDrawerCompanyId(null)} onChanged={load} />}
      {reagendar && <ReagendarModal booking={reagendar} onClose={() => setReagendar(null)} onDone={() => { setReagendar(null); avisar('Reunión reagendada ✓'); load(); }} onError={(m) => avisar('Error: ' + m)} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: '0.8125rem', zIndex: 3000, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>{toast}</div>
      )}
    </div>
  );
}

/* ── Vista calendario mensual ── */
function CalendarioMes({ mes, setMes, bookings, hoy, onOpen }: { mes: string; setMes: (m: string) => void; bookings: any[]; hoy: string; onOpen: (b: any) => void }) {
  const [y, m] = mes.split('-').map(Number);
  const primerDia = new Date(Date.UTC(y, m - 1, 1));
  const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // lunes = 0
  const offset = (primerDia.getUTCDay() + 6) % 7;
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)];
  while (celdas.length % 7) celdas.push(null);
  const porDia: Record<string, any[]> = {};
  bookings.forEach(b => { if (b.fecha?.startsWith(mes)) (porDia[b.fecha] = porDia[b.fecha] || []).push(b); });
  const nav = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const MES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button style={S.btnSmall} onClick={() => nav(-1)}>‹ Anterior</button>
        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{MES_LARGO[m - 1]} {y}</div>
        <button style={S.btnSmall} onClick={() => nav(1)}>Siguiente ›</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, minWidth: 720 }}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} style={{ fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', padding: '4px 6px' }}>{d}</div>
          ))}
          {celdas.map((fecha, i) => (
            <div key={i} style={{ minHeight: 84, border: '1px solid #f0f0f0', borderRadius: 8, padding: 6, background: fecha === hoy ? '#FFFBEB' : fecha ? '#fff' : '#fafafa' }}>
              {fecha && <>
                <div style={{ fontSize: '0.7rem', fontWeight: fecha === hoy ? 800 : 600, color: fecha === hoy ? '#92400E' : '#bbb', marginBottom: 4 }}>{Number(fecha.slice(-2))}</div>
                {(porDia[fecha] || []).slice(0, 3).map(b => {
                  const est = ESTADOS[b.estado] || ESTADOS.pendiente;
                  return (
                    <div key={b.id} onClick={() => onOpen(b)} title={`${fmtTime(b.hora_inicio)} · ${b.invitee_nombre} (${est.label})`}
                      style={{ fontSize: '0.64rem', padding: '2px 6px', borderRadius: 5, marginBottom: 3, background: est.bg, color: est.color, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fmtTime(b.hora_inicio)} {b.invitee_nombre}
                    </div>
                  );
                })}
                {(porDia[fecha] || []).length > 3 && <div style={{ fontSize: '0.62rem', color: '#999' }}>+{(porDia[fecha] || []).length - 3} más</div>}
              </>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Modal de reagendar con slots reales ── */
function ReagendarModal({ booking, onClose, onDone, onError }: { booking: any; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dia, setDia] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const from = hoyStr();
        const d = new Date(from + 'T12:00:00'); d.setDate(d.getDate() + 14);
        const to = d.toISOString().slice(0, 10);
        const r = await adminFetch(`/api/scheduling/available-slots?slug=${encodeURIComponent(booking.event_types?.slug || '')}&from=${from}&to=${to}`);
        const j = await r.json();
        // available-slots responde { dates: { 'YYYY-MM-DD': ['HH:MM', ...] } }
        const porDia: Record<string, string[]> = {};
        Object.entries((j?.dates || {}) as Record<string, any>).forEach(([f, hs]) => {
          const horas = (Array.isArray(hs) ? hs : []).map((s: any) => typeof s === 'string' ? s : s?.hora_inicio).filter(Boolean);
          if (horas.length) porDia[f] = horas;
        });
        setSlots(porDia);
        setDia(Object.keys(porDia)[0] || null);
      } catch { onError('no se pudieron cargar horarios'); }
      setLoading(false);
    })();
  }, [booking]);

  async function elegir(hora: string) {
    if (saving || !dia) return;
    setSaving(true);
    try {
      const r = await adminFetch('/api/scheduling/reschedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id, nueva_fecha: dia, nueva_hora: hora, timezone: 'America/Mexico_City' }),
      });
      if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || 'HTTP ' + r.status); }
      onDone();
    } catch (e: any) { onError(e?.message || 'no se pudo reagendar'); setSaving(false); }
  }

  const dias = Object.keys(slots).sort();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Reagendar reunión</h3>
          <button style={S.btnSmall} onClick={onClose}>✕</button>
        </div>
        <p style={{ margin: '4px 0 16px', fontSize: '0.78rem', color: '#888' }}>
          {booking.invitee_nombre} · {booking.event_types?.nombre} · hoy: {fmtDate(booking.fecha)} {fmtTime(booking.hora_inicio)}
        </p>
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Buscando horarios disponibles…</div> : !dias.length ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Sin horarios disponibles en los próximos 14 días. Revisa la disponibilidad en Sistema → Agenda.</div>
        ) : <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {dias.map(f => (
              <button key={f} style={S.seg(dia === f)} onClick={() => setDia(f)}>{fmtDate(f)}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {(slots[dia || ''] || []).map(h => (
              <button key={h} disabled={saving} onClick={() => elegir(h)}
                style={{ padding: '9px 6px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                {fmtTime(h)}
              </button>
            ))}
          </div>
          {saving && <div style={{ marginTop: 12, fontSize: '0.78rem', color: '#999', textAlign: 'center' }}>Reagendando…</div>}
        </>}
      </div>
    </div>
  );
}
