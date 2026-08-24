import { useCallback, useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import { ESTADOS, normalizaEstado } from '../../../lib/crm/reuniones';
import KpiCard from './ui/KpiCard';
import Cargando from './ui/Cargando';
import ClienteDrawer360 from './ClienteDrawer360';
import { useIsMobile } from '../../../lib/ui/mobile';
import { origenDe, origenDeRegistro } from '../../../lib/crm/origenes';

/* ═══ Reuniones (VENTAS) — listado operativo de TODAS las reuniones ═══
 * Las del founder y las de partners, segmentadas y ligadas al CRM real:
 * cliente → 360 del ARR, prospecto/contacto → perfil de contacto.
 * La CONFIGURACIÓN de agenda (tipos de evento, disponibilidad, links) vive
 * aparte en Sistema → Agenda. */

type Segmento = 'hoy' | 'semana' | 'proximas' | 'pasadas' | 'todas';

/**
 * De dónde venía quien agendó ESTA reunión.
 *
 * Solo aplica a las que se agendaron desde el sitio: las que capturó el equipo
 * (origen 'crm') no tienen canal que mostrar y pintarles "Página de agenda"
 * sería ruido. La atribución la escribe /api/scheduling/book.
 */
function origenDeReunion(b: any): { l: string; color: string; campana?: string } | null {
  if (b?.origen === 'crm') return null;
  const primero = b?.atribucion?.primer_toque;
  const ultimo = b?.atribucion?.ultimo_toque;
  const referrer = primero?.referrer;
  // Sin canal identificable no se pinta nada. Poner "Página de agenda" en cada
  // fila sería repetir dónde llenó el formulario, que ya se sabe, y taparía
  // las pocas filas que sí traen la campaña que las pagó.
  if (!b?.utm_source && !referrer) return null;
  // SIN `fuente`, a propósito: con ella `origenDeRegistro` devolvía siempre
  // 'agenda' (por DESDE_FUENTE), así que `o.v` nunca era vacío, el fallback
  // 'Referido' era CÓDIGO MUERTO y una reunión con utm_source='newsletter'
  // se pintaba "Página de agenda · promo" — justo el ruido que este chip
  // existe para no poner.
  const o = origenDe(origenDeRegistro({ utm_source: b?.utm_source }));
  const crudo = String(b?.utm_source || '').trim();
  return {
    // Canal reconocido → su nombre bonito. Canal no catalogado (newsletter,
    // bing, un partner) → el utm_source tal cual, que dice más que "Referido".
    // Solo referrer → "Referido".
    l: o.v ? o.l : (crudo ? crudo.charAt(0).toUpperCase() + crudo.slice(1) : 'Referido'),
    // `origenDe('')` devuelve el gris casi blanco #e0dee6, que sobre fondo
    // blanco deja el puntito invisible. Desde que se quita `fuente`, ese caso es
    // frecuente (todo canal no catalogado y todo "Referido").
    color: o.v ? o.color : '#8a8a92',
    // La campaña tiene que salir del MISMO toque que la etiqueta. La etiqueta
    // viene de `utm_source` (el toque con canal) y esto leía `primer_toque`
    // crudo: con 1ª visita orgánica + anuncio después el chip decía "TikTok" y se
    // comía `demo_agosto`; peor aún, podía mezclar el canal de un toque con la
    // campaña del otro.
    campana: (primero?.fuente && primero.fuente === b?.utm_source
      ? primero?.campana
      : (ultimo?.fuente === b?.utm_source ? ultimo?.campana : primero?.campana)) || undefined,
  };
}

function ChipOrigen({ b }: { b: any }) {
  const o = origenDeReunion(b);
  if (!o) return null;
  return (
    <div style={{ fontSize: '0.68rem', color: '#8a8a8a', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}
         title={o.campana ? `Campaña: ${o.campana}` : undefined}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: o.color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {o.l}{o.campana ? ` · ${o.campana}` : ''}
      </span>
    </div>
  );
}

/* Los estados NO se declaran aquí. Esta pestaña tenía su propio diccionario
   —pendiente/realizada/no_show— mientras la base guarda el vocabulario de
   `lib/crm/reuniones`: agendada/confirmada/asistio/no_asistio. Nada empataba,
   así que "Realizadas" decía 0 con 17 reuniones asistidas, la tasa de no-show
   daba 0% con una falta real, y las 'agendada' se caían de Próximas.
   Se lee SIEMPRE por `normalizaEstado`, que además traduce lo viejo. */

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
  /* JERARQUÍA DE BOTONES (regla del CRM, ver la skill crm-design-system):
      · principal   → morado sólido, letra blanca. Uno por pantalla.
      · secundario  → fondo blanco, BORDE y LETRA morados.
      · terciario   → gris, para lo que casi nunca se toca.
     Aquí todo era negro, que no es de la paleta y además ponía "Esta semana"
     al mismo nivel visual que la acción principal de la pantalla. */
  btnPrim: { padding: '7px 15px', border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit' } as const,
  btnSec: { padding: '7px 14px', border: '1.5px solid #9B8CFA', background: '#fff', color: '#5B4BD6', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit' } as const,
  btnSmall: { padding: '5px 11px', border: '1.5px solid #ddd6fb', background: '#fff', color: '#5B4BD6', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit' } as const,
  /* El segmento elegido es el morado; los demás quedan neutros. Si todos
     llevaran borde morado no se distinguiría cuál está activo. */
  seg: (on: boolean) => ({
    padding: '6px 14px', borderRadius: 99,
    border: '1.5px solid ' + (on ? '#9B8CFA' : '#e6e5ec'),
    background: on ? '#9B8CFA' : '#fff',
    color: on ? '#fff' : '#6b7280',
    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  }) as const,
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
  const isMobile = useIsMobile();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // El calendario abre la pestaña. Una agenda se lee en una cuadrícula de mes;
  // la tabla es para buscar algo concreto, y eso viene después.
  const [vista, setVista] = useState<'lista' | 'calendario'>('calendario');
  // Arranca en la semana y no en 'proximas': lo primero que se pregunta al
  // entrar es qué hay estos días, y con la agenda vacía a futuro 'proximas'
  // dejaba la pestaña en blanco aunque la semana tuviera diez reuniones.
  const [segmento, setSegmento] = useState<Segmento>('semana');
  const [fEstado, setFEstado] = useState('');
  const [fHost, setFHost] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [search, setSearch] = useState('');
  const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
  const [reagendar, setReagendar] = useState<any>(null);
  const [cancelArmed, setCancelArmed] = useState<string | null>(null);
  const [menuFila, setMenuFila] = useState<{ id: string; x: number; y: number } | null>(null);
  // Agendar arranca por el CLIENTE: una reunión sin cuenta detrás no alimenta
  // nada —ni su ficha, ni consultoría, ni el reporte— y es la basura que ya
  // hay que andar borrando. Elegido el cliente, se abre su ficha en Reuniones,
  // que es donde el alta ya existe y funciona.
  const [eligiendoCliente, setEligiendoCliente] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [resCliente, setResCliente] = useState<any[]>([]);
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
  // La semana natural de lunes a domingo, con hoy adentro. `getDay()` pone el
  // domingo en 0, que es el caso que rompía el cálculo anterior.
  const [iniSemana, finSemana] = useMemo(() => {
    const d = new Date(hoy + 'T12:00:00');
    const dow = d.getDay() === 0 ? 7 : d.getDay();   // lunes 1 … domingo 7
    const lunes = new Date(d); lunes.setDate(d.getDate() - (dow - 1));
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return [lunes.toISOString().slice(0, 10), domingo.toISOString().slice(0, 10)];
  }, [hoy]);

  const filtered = useMemo(() => {
    let rows = data;
    const est = (b: any) => normalizaEstado(b.estado);
    if (segmento === 'hoy') rows = rows.filter(b => b.fecha === hoy);
    // "Esta semana" es la semana COMPLETA, de lunes a domingo, no lo que queda
    // de ella: en domingo `hoy..finSemana` era un solo día y la pestaña salía
    // vacía con seis reuniones a la espalda.
    else if (segmento === 'semana') rows = rows.filter(b => b.fecha >= iniSemana && b.fecha <= finSemana);
    else if (segmento === 'proximas') rows = rows.filter(b => b.fecha >= hoy && (est(b) === 'confirmada' || est(b) === 'agendada'));
    else if (segmento === 'pasadas') rows = rows.filter(b => b.fecha < hoy || est(b) === 'asistio' || est(b) === 'no_asistio');
    if (fEstado) rows = rows.filter(b => est(b) === fEstado);
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
  }, [data, segmento, fEstado, fHost, fTipo, search, hoy, iniSemana, finSemana]);

  /* Cuántas trae cada pestaña. Mismas reglas que `filtered`, pero SIN los
     filtros de búsqueda/host/tipo: el número de la pestaña dice qué hay ahí,
     no qué queda después de filtrar. */
  const conteoSegmento = (sg: Segmento) => {
    const est = (b: any) => normalizaEstado(b.estado);
    if (sg === 'hoy') return data.filter(b => b.fecha === hoy).length;
    if (sg === 'semana') return data.filter(b => b.fecha >= iniSemana && b.fecha <= finSemana).length;
    if (sg === 'proximas') return data.filter(b => b.fecha >= hoy && (est(b) === 'confirmada' || est(b) === 'agendada')).length;
    if (sg === 'pasadas') return data.filter(b => b.fecha < hoy || est(b) === 'asistio' || est(b) === 'no_asistio').length;
    return data.length;
  };

  const eventTypes = useMemo(() => {
    const m = new Map<string, any>();
    data.forEach(b => { if (b.event_types) m.set(b.event_types.id, b.event_types); });
    return Array.from(m.values());
  }, [data]);

  /* ── Qué se está agendando ──
     Antes arriba había cuatro números que no decían de QUÉ eran las reuniones:
     con "Próximas 3" no se sabe si son tres demos de venta o tres capacitaciones
     que ya se pagaron. Una tarjeta por tipo, con su color del catálogo, y dentro
     el desenlace: cuántas se presentaron, cuántas faltaron y cuántas nadie marcó.
     Se cuentan TODAS menos las canceladas —cancelar con aviso no es una reunión
     que salió mal, es una que no ocurrió—. */
  const resumenTipos = useMemo(() => {
    const m = new Map<string, any>();
    for (const b of data) {
      const t = b.event_types;
      if (!t) continue;
      const e = normalizaEstado(b.estado);
      if (e === 'cancelada' || e === 'reagendada') continue;
      const row = m.get(t.id) || { id: t.id, nombre: t.nombre, color: t.color || '#9B8CFA', n: 0, asistio: 0, falto: 0, pend: 0 };
      row.n++;
      if (e === 'asistio') row.asistio++;
      else if (e === 'no_asistio') row.falto++;
      // Ya pasó y nadie dijo si llegó: ni éxito ni falta, un dato que falta.
      else if (b.fecha < hoy) row.pend++;
      m.set(t.id, row);
    }
    return Array.from(m.values()).sort((a, b) => b.n - a.n);
  }, [data, hoy]);

  /* Reuniones que ya pasaron y siguen sin resolver. Es la razón por la que la
     tasa de asistencia no se puede creer, así que se enseña y se puede cerrar
     desde aquí en vez de esconderse en el segmento "Pasadas". */
  // Obedece el filtro por tipo igual que la lista y el calendario: si tocar
  // "Demo" no cambiara este bloque, la tarjeta filtraría a medias.
  const pendientes = useMemo(() => data.filter(b => {
    const e = normalizaEstado(b.estado);
    if (fTipo && b.event_types?.id !== fTipo) return false;
    return b.fecha < hoy && (e === 'agendada' || e === 'confirmada');
  }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))), [data, hoy, fTipo]);

  /* Lo que ve el calendario: los mismos filtros de arriba MENOS el segmento
     —el calendario ya acota por mes, y cruzarlo con "esta semana" dejaría el
     resto del mes en blanco sin que nadie entienda por qué—. */
  const paraCalendario = useMemo(() => {
    let rows = data.filter(b => {
      const e = normalizaEstado(b.estado);
      return e !== 'cancelada' && e !== 'reagendada';
    });
    if (fTipo) rows = rows.filter(b => b.event_types?.id === fTipo);
    if (fEstado) rows = rows.filter(b => normalizaEstado(b.estado) === fEstado);
    if (fHost === 'mias') rows = rows.filter(b => b.host_es_mio);
    else if (fHost === 'partners') rows = rows.filter(b => b.host_es_partner);
    else if (fHost) rows = rows.filter(b => b.host_id === fHost);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(b => [b.invitee_nombre, b.invitee_email, b.invitee_empresa, b.invitado_company_nombre, b.host_nombre]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    return rows;
  }, [data, fTipo, fEstado, fHost, search]);

  const deHoy = useMemo(() => data.filter(b => {
    const e = normalizaEstado(b.estado);
    if (fTipo && b.event_types?.id !== fTipo) return false;
    return b.fecha === hoy && e !== 'cancelada' && e !== 'reagendada';
  }).sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''))), [data, hoy, fTipo]);

  const kpis = useMemo(() => {
    const est = (b: any) => normalizaEstado(b.estado);
    // Activa = todavía va a pasar. 'agendada' entra: es el estado con el que
    // nace una reunión reservada desde la página, y quedaba fuera.
    const activas = data.filter(b => est(b) === 'confirmada' || est(b) === 'agendada');
    // El histórico son las que YA se resolvieron. Cancelar con aviso no es
    // plantar a nadie, así que las canceladas no entran al denominador.
    const historicas = data.filter(b => est(b) === 'asistio' || est(b) === 'no_asistio');
    const noShows = historicas.filter(b => est(b) === 'no_asistio').length;
    return {
      hoy: activas.filter(b => b.fecha === hoy).length,
      semana: data.filter(b => b.fecha >= iniSemana && b.fecha <= finSemana && est(b) !== 'cancelada').length,
      proximas: activas.filter(b => b.fecha >= hoy).length,
      realizadas: historicas.filter(b => est(b) === 'asistio').length,
      noShowPct: historicas.length ? Math.round(noShows * 100 / historicas.length) : 0,
    };
  }, [data, hoy, iniSemana, finSemana]);

  async function marcar(b: any, estado: 'asistio' | 'no_asistio') {
    setBusyId(b.id);
    try {
      const r = await adminFetch('/api/scheduling/bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, estado }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      avisar(estado === 'asistio' ? 'Marcada como se presentó ✓' : 'Marcada como no se presentó');
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

  /* Un renglón compacto de reunión, para los bloques de arriba (Hoy y lo que
     falta marcar). Lo que manda es el CLIENTE, no el invitado: esta pestaña se
     nutre de clientes y desde aquí se llega a su ficha de un clic. */
  const Fila = ({ b, marcar: conMarcar }: { b: any; marcar?: boolean }) => {
    const e = normalizaEstado(b.estado);
    const est = ESTADOS[e];
    const t = b.event_types;
    const cliente = b.invitado_company_nombre || b.invitee_empresa || null;
    const puedeAbrir = !!(b.invitado_company_id || b.invitado_contact_id);
    const bs = isMobile ? { ...S.btnSmall, minHeight: 40, padding: '8px 12px' } : S.btnSmall;
    return (
      <div style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '9px 0', borderTop: '1px solid #f5f4f8' }}>
        <div style={{ width: 76, flexShrink: 0 }}>
          <div style={{ fontSize: '0.79rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(b.hora_inicio)}</div>
          <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.04em' }}>{fmtDate(b.fecha).replace(/ \d{4}$/, '')}</div>
        </div>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: t?.color || '#c9c7d0', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cliente
              ? (puedeAbrir
                ? <button onClick={() => abrirInvitado(b)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: '#5B4BD6', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>{cliente}</button>
                : cliente)
              : <span style={{ color: '#a5a2af', fontWeight: 600 }}>sin cliente ligado</span>}
          </div>
          <div style={{ fontSize: '0.71rem', color: '#a5a2af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {b.invitee_nombre || '—'}{t?.nombre ? ' · ' + t.nombre : ''}
          </div>
        </div>
        {conMarcar
          ? (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button disabled={busyId === b.id} style={{ ...bs, color: '#1E8A63', borderColor: '#bfe8df', fontWeight: 700 }} onClick={() => marcar(b, 'asistio')}>Se presentó</button>
              <button disabled={busyId === b.id} style={{ ...bs, color: '#C0554E', borderColor: '#f7c9c5', fontWeight: 700 }} onClick={() => marcar(b, 'no_asistio')}>No llegó</button>
            </div>
          )
          : <span style={{ ...S.badge, background: est.bg, color: est.color, flexShrink: 0 }}>{est.label}</span>}
      </div>
    );
  };

  /* Borrar ≠ cancelar. Una cancelada pasó de verdad y se queda en el historial;
     una de PRUEBA nunca existió y solo ensucia la agenda, el conteo por tipo y
     la tasa de asistencia. Por eso vive escondida en el ⋮ y pregunta antes. */
  async function borrar(b: any, forzar = false) {
    const quien = b.invitado_company_nombre || b.invitee_nombre || 'esta reunión';
    if (!forzar && !confirm(`¿Borrar la reunión de ${quien} del ${fmtDate(b.fecha)}?\n\nSe borra de verdad, no se cancela. Úsalo solo para reuniones de prueba.`)) return;
    setBusyId(b.id);
    const r = await adminFetch(`/api/scheduling/reuniones?id=${b.id}${forzar ? '&forzar=1' : ''}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    setBusyId(null);
    if (j?.requiere_confirmacion) {
      if (confirm(j.error + '\n\n¿Borrarla de todos modos?')) return borrar(b, true);
      return;
    }
    if (!r.ok || j?.error) { avisar(j?.error || 'No se pudo borrar'); return; }
    avisar(j.mejoras_desligadas ? `Reunión borrada · ${j.mejoras_desligadas} compromiso(s) conservado(s)` : 'Reunión borrada');
    setMenuFila(null);
    await load();
  }

  const filaAcciones = (b: any) => {
    // Normalizado: con el literal, una 'agendada' —el estado con el que nace
    // una reserva desde la página— se quedaba SIN botones para marcarla.
    const e = normalizaEstado(b.estado);
    const activa = e === 'agendada' || e === 'confirmada';
    const bs = isMobile ? { ...S.btnSmall, minHeight: 44, padding: '10px 14px', fontSize: '0.8rem' } : S.btnSmall;
    return (
      <div style={{ display: 'flex', gap: isMobile ? 8 : 6, flexWrap: 'wrap' }}>
        {activa && <>
          <button disabled={busyId === b.id} style={{ ...bs, color: '#065F46', borderColor: '#A7F3D0' }} onClick={() => marcar(b, 'asistio')}>Asistió</button>
          <button disabled={busyId === b.id} style={{ ...bs, color: '#B91C1C', borderColor: '#FECACA' }} onClick={() => marcar(b, 'no_asistio')}>No asistió</button>
          <button disabled={busyId === b.id} style={bs} onClick={() => setReagendar(b)}>Reagendar</button>
          <button disabled={busyId === b.id} style={{ ...bs, color: cancelArmed === b.id ? '#fff' : '#999', background: cancelArmed === b.id ? '#B91C1C' : '#fff' }} onClick={() => cancelar(b)}>
            {cancelArmed === b.id ? '¿Confirmar?' : 'Cancelar'}
          </button>
        </>}
        {/* Lo que casi nunca se usa no merece un botón permanente. Se ancla
            FIJO porque la tabla se desplaza y un panel absoluto se recorta. */}
        <button style={{ ...bs, padding: '4px 8px', color: '#a5a2af' }} title="Más acciones"
          onClick={ev => {
            ev.stopPropagation();
            if (menuFila?.id === b.id) { setMenuFila(null); return; }
            const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            const alto = b.google_meet_link ? 210 : 96;
            const y = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto) : r.bottom + 6;
            setMenuFila({ id: b.id, x: r.right, y });
          }}>⋮</button>
        {menuFila && menuFila.id === b.id && (
          <>
            <div onClick={() => setMenuFila(null)} style={{ position: 'fixed', inset: 0, zIndex: 1400 }} />
            <div style={{ position: 'fixed', left: Math.max(8, menuFila.x - 232), top: menuFila.y, zIndex: 1401, width: 232, background: '#fff', border: '1px solid #e6e6ea', borderRadius: 11, boxShadow: '0 12px 32px rgba(16,24,40,.18)', padding: 6, textAlign: 'left' as const }}>
              {b.google_meet_link && (<>
                <a href={b.google_meet_link} target="_blank" rel="noreferrer" onClick={() => setMenuFila(null)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 8, padding: '8px 10px', fontSize: '0.79rem', fontWeight: 700, color: '#241d43', textDecoration: 'none' }}>
                  Entrar a la reunión
                  <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 400, color: '#a5a2af', marginTop: 1 }}>Abre el Meet</span>
                </a>
                <button onClick={() => { navigator.clipboard?.writeText(b.google_meet_link); setMenuFila(null); avisar('Link de Meet copiado'); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: '0.79rem', fontWeight: 700, color: '#241d43', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Copiar el link
                </button>
                <div style={{ height: 1, background: '#f1f1f5', margin: '5px 4px' }} />
              </>)}
              <button disabled={busyId === b.id} onClick={() => borrar(b)}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: '0.79rem', fontWeight: 700, color: '#C0554E', cursor: 'pointer', fontFamily: 'inherit' }}>
                Eliminar reunión
                <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 400, color: '#a5a2af', marginTop: 1 }}>Para las de prueba. Cancelar es otra cosa.</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) return <Cargando texto="Cargando reuniones…" />;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div style={WRAP}>
      {/* La página se presenta, como Clientes y Cotizaciones: título, cuánto hay
          y las acciones a la derecha. Era la única del CRM que entraba directo a
          las tarjetas, y sin saber dónde estabas parado. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, letterSpacing: '-0.015em' }}>Reuniones</h1>
          <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>
            {data.length} totales · {filtered.length} en vista
            {fTipo && resumenTipos.find(t => t.id === fTipo) ? ` · ${resumenTipos.find(t => t.id === fTipo)!.nombre}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Una sola acción. El ↻ se fue —la lista ya se recarga después de cada
              cambio, así que era un botón que no hacía falta apretar— y los tipos
              de reunión y la disponibilidad viven en Configuración → Reuniones:
              son ajustes que se tocan una vez, no trabajo del día. */}
          <button onClick={() => setEligiendoCliente(true)}
            style={{ border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Agendar reunión
          </button>
        </div>
      </div>

      {/* Una tarjeta por tipo, con el KpiCard compartido del CRM. Antes era una
          tarjeta propia de este módulo: otro tamaño de número y sin el "· ver"
          que anuncia que filtra. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%, 230px),1fr))', gap: 14, marginBottom: 18 }}>
        {resumenTipos.map(t => {
          const pct = (x: number) => (t.n ? (x / t.n) * 100 : 0);
          return (
            <KpiCard key={t.id}
              label={t.nombre.replace(/^reuni[oó]n de\s+/i, '')}
              valor={t.n}
              color={t.color}
              franja={t.color}
              activo={fTipo === t.id}
              onClick={() => setFTipo(fTipo === t.id ? '' : t.id)}
              sub={<>
                {t.asistio > 0 && <><b style={{ color: '#1E8A63' }}>{t.asistio}</b> se {t.asistio === 1 ? 'presentó' : 'presentaron'}</>}
                {t.falto > 0 && <> · <b style={{ color: '#C0554E' }}>{t.falto}</b> {t.falto === 1 ? 'falta' : 'faltas'}</>}
                {t.asistio === 0 && t.falto === 0 && 'sin resolver'}
                {t.pend > 0 && <> · <b style={{ color: '#9a6a10' }}>{t.pend} sin marcar</b></>}
              </>}
              barra={[
                { pct: pct(t.asistio), color: '#4FBF95' },
                { pct: pct(t.falto), color: '#EF7A72' },
                { pct: pct(t.pend), color: '#dcd9e4' },
              ]} />
          );
        })}
        {!resumenTipos.length && (
          <div style={{ background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '14px 16px', color: '#a5a2af', fontSize: '0.82rem' }}>
            Todavía no hay reuniones agendadas.
          </div>
        )}
      </div>

      {/* Hoy, siempre a la vista: no debería hacer falta elegir un filtro para
          saber a quién ves en las próximas horas. */}
      <div style={{ ...S.card, marginBottom: 12, borderColor: deHoy.length ? '#ddd6fb' : '#ececec' }}>
        <div style={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.9px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: deHoy.length ? 8 : 0 }}>
          Hoy
          <span style={{ marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#a5a2af' }}>
            {deHoy.length ? `${deHoy.length} reunión${deHoy.length === 1 ? '' : 'es'}` : 'nada agendado'}
          </span>
        </div>
        {!deHoy.length
          ? <div style={{ fontSize: '0.82rem', color: '#a5a2af' }}>Sin reuniones hoy.</div>
          : deHoy.map(b => <Fila key={b.id} b={b} />)}
      </div>

      {/* Lo que ya pasó y nadie cerró. Sin esto la tasa de asistencia miente y
          nadie sabe por qué. */}
      {pendientes.length > 0 && (
        <div style={{ ...S.card, marginBottom: 12, borderColor: '#E8A838', background: '#FFFDF8' }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.9px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#9a6a10' }}>
            Ya pasaron y nadie las marcó
            <span style={{ marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#9a6a10' }}>
              {pendientes.length} · mientras sigan así, la tasa de asistencia no cuadra
            </span>
          </div>
          {pendientes.slice(0, 6).map(b => <Fila key={b.id} b={b} marcar />)}
          {pendientes.length > 6 && (
            <div style={{ fontSize: '0.72rem', color: '#9a6a10', paddingTop: 8 }}>y {pendientes.length - 6} más en “Pasadas”.</div>
          )}
        </div>
      )}

      {/* Pestañas con contador, como Cotizaciones. Eran píldoras —otro lenguaje—
          y sin número: había que entrar a cada una para saber si traía algo. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #eeeef1' }}>
        {(['hoy', 'semana', 'proximas', 'pasadas', 'todas'] as Segmento[]).map(sg => {
          const on = segmento === sg;
          const n = conteoSegmento(sg);
          return (
            <button key={sg} onClick={() => setSegmento(sg)}
              style={{
                padding: '9px 15px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: on ? '#EEECFE' : 'transparent', color: on ? '#5B4BD6' : '#666',
                borderRadius: '9px 9px 0 0', borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent',
                fontWeight: on ? 800 : 600, fontSize: '0.83rem', marginBottom: -1,
                display: 'inline-flex', alignItems: 'center', gap: 7,
              }}>
              {{ hoy: 'Hoy', semana: 'Esta semana', proximas: 'Próximas', pasadas: 'Pasadas', todas: 'Todas' }[sg]}
              <span style={{ fontSize: '0.66rem', fontWeight: 800, background: on ? '#fff' : '#f5f4f8', color: on ? '#5B4BD6' : '#a5a2af', borderRadius: 20, padding: '1px 7px' }}>{n}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button style={S.seg(vista === 'calendario')} onClick={() => setVista('calendario')}>▦ Calendario</button>
        <button style={S.seg(vista === 'lista')} onClick={() => setVista('lista')}>☰ Lista</button>
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

      {vista === 'lista' && isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(b => {
            const est = ESTADOS[normalizaEstado(b.estado)];
            const ti = b.invitado_tipo ? TIPO_INVITADO[b.invitado_tipo] : null;
            const clickable = !!(b.invitado_company_id || b.invitado_contact_id);
            return (
              <div key={b.id} style={{ ...S.card, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.86rem' }}>{fmtDate(b.fecha)}{b.fecha === hoy ? ' · hoy' : ''}</span>
                  <span style={{ fontSize: '0.82rem', color: '#555', fontWeight: 600 }}>{fmtTime(b.hora_inicio)}</span>
                  <span style={{ ...S.badge, background: est.bg, color: est.color, marginLeft: 'auto' }}>{est.label}</span>
                </div>
                <div onClick={() => clickable && abrirInvitado(b)} style={{ cursor: clickable ? 'pointer' : 'default', minHeight: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: clickable ? '#1D4ED8' : '#333' }}>{b.invitee_nombre || '—'}{clickable ? ' ›' : ''}</span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>{b.invitado_company_nombre || b.invitee_empresa || b.invitee_email || ''}</span>
                  <ChipOrigen b={b} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                  {ti && <span style={{ ...S.badge, background: ti.bg, color: ti.color }}>{ti.label}</span>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#555' }}><span style={{ width: 8, height: 8, borderRadius: 99, background: b.event_types?.color || '#999' }} />{b.event_types?.nombre || '—'}</span>
                  <span style={{ fontSize: '0.72rem', color: '#999', marginLeft: 'auto' }}>{b.host_es_mio ? 'Tú' : (b.host_nombre || '—')}{b.host_es_partner ? ' · partner' : ''}</span>
                </div>
                {b.referrer_nombre ? <div style={{ fontSize: '0.68rem', color: '#a06600', marginTop: 4 }}>ref: {b.referrer_nombre}</div> : null}
                <div style={{ marginTop: 10 }}>{filaAcciones(b)}</div>
              </div>
            );
          })}
          {!filtered.length && <div style={{ ...S.card, padding: 28, textAlign: 'center', color: '#999' }}>Sin reuniones en este segmento. Ajusta filtros o cambia de segmento.</div>}
        </div>
      ) : vista === 'lista' ? (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead><tr>{['Fecha', 'Hora', 'Invitado', 'Tipo', 'Evento', 'Host', 'Estado', 'Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(b => {
                  const est = ESTADOS[normalizaEstado(b.estado)];
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
                          <ChipOrigen b={b} />
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
        <>
          <CalendarioMes mes={calMes} setMes={setCalMes} bookings={paraCalendario} hoy={hoy} onOpen={abrirInvitado} isMobile={isMobile} />
          {/* La leyenda la pinta CalendarioMes: tenerla también aquí la
              duplicaba al pie del mes. */}
        </>
      )}

      {eligiendoCliente && (
        <div onClick={e => { if (e.target === e.currentTarget) setEligiendoCliente(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 20px 20px' }}>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 'min(460px, 100%)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#241d43' }}>¿Con qué cliente?</div>
              <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 2 }}>La reunión se agenda desde su ficha, para que quede ligada a su cuenta.</div>
            </div>
            <div style={{ padding: '12px 17px' }}>
              <input autoFocus value={buscaCliente} placeholder="Buscar cliente…"
                onChange={async e => {
                  const q = e.target.value; setBuscaCliente(q);
                  if (q.trim().length < 2) { setResCliente([]); return; }
                  try {
                    const j = await adminFetch('/api/crm/search?q=' + encodeURIComponent(q)).then(r => r.json());
                    setResCliente((j.results || []).filter((r: any) => r.type === 'company').slice(0, 8));
                  } catch { setResCliente([]); }
                }}
                style={{ ...S.input, width: '100%', padding: '10px 12px', fontSize: '0.9rem' }} />
            </div>
            <div style={{ overflowY: 'auto', padding: '0 8px 12px' }}>
              {resCliente.map((r: any) => (
                <button key={r.id} onClick={() => { setEligiendoCliente(false); setBuscaCliente(''); setResCliente([]); setDrawerCompanyId(r.id); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', borderRadius: 9, padding: '10px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#241d43' }}>{r.nombre}</div>
                  <div style={{ fontSize: '0.72rem', color: '#a5a2af' }}>{r.plan || r.email || 'cliente'}</div>
                </button>
              ))}
              {buscaCliente.trim().length >= 2 && !resCliente.length && (
                <div style={{ padding: '12px 11px', fontSize: '0.8rem', color: '#a5a2af' }}>Sin clientes que coincidan con “{buscaCliente}”.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {drawerCompanyId && <ClienteDrawer360 companyId={drawerCompanyId} onClose={() => setDrawerCompanyId(null)} onChanged={load} />}
      {reagendar && <ReagendarModal booking={reagendar} onClose={() => setReagendar(null)} onDone={() => { setReagendar(null); avisar('Reunión reagendada ✓'); load(); }} onError={(m) => avisar('Error: ' + m)} />}

      {toast && (
        <div className="crm-toast-bottom" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: '0.8125rem', zIndex: 3000, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>{toast}</div>
      )}
    </div>
  );
}

/* ── Vista calendario mensual (desktop) / agenda de día (mobile) ── */
function CalendarioMes({ mes, setMes, bookings, hoy, onOpen, isMobile }: { mes: string; setMes: (m: string) => void; bookings: any[]; hoy: string; onOpen: (b: any) => void; isMobile?: boolean }) {
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
  const DIA_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const navBtn = { minWidth: 44, minHeight: 44, border: '1px solid #ddd', borderRadius: 10, background: '#fff', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' } as const;

  // ── MOBILE: agenda vertical (mismos eventos del mes, agrupados por día) ──
  if (isMobile) {
    const diasConEventos = Object.keys(porDia).sort();
    const totalEv = diasConEventos.reduce((s, f) => s + porDia[f].length, 0);
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <button style={navBtn} onClick={() => nav(-1)} aria-label="Mes anterior">‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{MES_LARGO[m - 1]} {y}</div>
            <div style={{ fontSize: '0.7rem', color: '#999' }}>{totalEv} {totalEv === 1 ? 'reunión' : 'reuniones'}</div>
          </div>
          <button style={navBtn} onClick={() => nav(1)} aria-label="Mes siguiente">›</button>
        </div>
        {!diasConEventos.length ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Sin reuniones en {MES_LARGO[m - 1]}.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {diasConEventos.map(f => {
              const d = new Date(f + 'T12:00:00');
              const esHoy = f === hoy;
              return (
                <div key={f}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, position: 'sticky', top: 0, background: '#fff', zIndex: 1, padding: '2px 0' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: esHoy ? '#5B4BD6' : '#333' }}>{DIA_SEM[d.getDay()]} {Number(f.slice(-2))} {MESES[m - 1]}</span>
                    {esHoy && <span style={{ ...S.badge, background: '#EEECFE', color: '#5B4BD6' }}>hoy</span>}
                    <span style={{ fontSize: '0.7rem', color: '#bbb', marginLeft: 'auto' }}>{porDia[f].length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {porDia[f].sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')).map(b => {
                      const est = ESTADOS[normalizaEstado(b.estado)];
                      return (
                        <div key={b.id} onClick={() => onOpen(b)} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid #f0f0f0', background: '#fff', cursor: 'pointer', borderLeft: `3px solid ${b.event_types?.color || '#999'}` }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#333', whiteSpace: 'nowrap', minWidth: 62 }}>{fmtTime(b.hora_inicio)}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.invitee_nombre || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.event_types?.nombre || ''}{b.invitado_company_nombre ? ` · ${b.invitado_company_nombre}` : ''}</div>
                          </div>
                          <span style={{ ...S.badge, background: est.bg, color: est.color, flexShrink: 0 }}>{est.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const totalMes = Object.values(porDia).reduce((a, l) => a + l.length, 0);
  const hoyMes = hoy.slice(0, 7);
  const conEventos = Object.keys(porDia).sort();
  /* El día abierto en el panel. Arranca en hoy si hoy tiene algo; si no, en el
     primer día del mes que sí tenga: abrir el panel vacío en un mes viejo hace
     pensar que no hay nada en todo el mes. */
  const [sel, setSel] = useState<string>(() => (porDia[hoy] ? hoy : conEventos[0] || hoy));
  useEffect(() => { setSel(porDia[hoy] ? hoy : conEventos[0] || `${mes}-01`); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mes]);

  const delSel = (porDia[sel] || []).slice().sort((x, y) => (x.hora_inicio || '').localeCompare(y.hora_inicio || ''));
  const selD = sel ? new Date(sel + 'T12:00:00') : null;
  const DIA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // La leyenda es lo que vuelve legibles los puntos: sin ella, un punto ámbar
  // no dice nada. Solo los tipos que de verdad aparecen este mes.
  const tiposDelMes: [string, string][] = [];
  Object.values(porDia).flat().forEach((b: any) => {
    const n = b.event_types?.nombre; const c = b.event_types?.color || '#9B8CFA';
    if (n && !tiposDelMes.some(t => t[0] === n)) tiposDelMes.push([n, c]);
  });

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button style={S.btnSmall} onClick={() => nav(-1)} aria-label="Mes anterior">‹</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#241d43', letterSpacing: '-.01em' }}>{MES_LARGO[m - 1]} {y}</div>
          <div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{totalMes} {totalMes === 1 ? 'reunión' : 'reuniones'}</div>
        </div>
        <button style={S.btnSmall} onClick={() => nav(1)} aria-label="Mes siguiente">›</button>
        {mes !== hoyMes && <button style={S.btnSec} onClick={() => setMes(hoyMes)}>Ir a hoy</button>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 13, flexWrap: 'wrap', fontSize: '0.68rem', color: '#8a8590' }}>
          {tiposDelMes.map(([n, c]) => (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{n.replace(/^Reunión de |^Sesión de /i, '')}
            </span>
          ))}
        </div>
      </div>

      {/* Mes a la izquierda, el día abierto a la derecha. El mes deja de ser
          una pared de etiquetas: cada día enseña puntos del color de sus
          reuniones y el detalle vive en el panel. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 292px', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
              <div key={d} style={{ fontSize: '0.6rem', fontWeight: 800, color: i > 4 ? '#c9c6d2' : '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {celdas.map((fecha, i) => {
              if (!fecha) return <div key={i} style={{ height: 56 }} />;
              const esHoy = fecha === hoy;
              const esSel = fecha === sel;
              const delDia = porDia[fecha] || [];
              return (
                <button key={i} onClick={() => setSel(fecha)}
                  title={delDia.length ? `${delDia.length} ${delDia.length === 1 ? 'reunión' : 'reuniones'}` : 'Sin reuniones'}
                  style={{
                    height: 56, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    border: '1.5px solid ' + (esSel ? '#9B8CFA' : esHoy ? '#9B8CFA' : 'transparent'),
                    background: esSel ? '#9B8CFA' : 'transparent',
                    transition: 'background .13s, border-color .13s',
                  }}>
                  <span style={{
                    fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums',
                    fontWeight: esSel || esHoy ? 800 : delDia.length ? 700 : 600,
                    color: esSel ? '#fff' : esHoy ? '#5B4BD6' : delDia.length ? '#241d43' : '#c9c6d2',
                  }}>{Number(fecha.slice(-2))}</span>
                  <span style={{ display: 'flex', gap: 3, height: 7, alignItems: 'center' }}>
                    {delDia.slice(0, 4).map((b: any) => (
                      <i key={b.id} style={{
                        width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                        background: b.event_types?.color || '#9B8CFA',
                        boxShadow: esSel ? '0 0 0 1.5px rgba(255,255,255,.7)' : 'none',
                      }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: '#f7f6fa', border: '1px solid #f0eff5', borderRadius: 12, padding: 14, minHeight: 260 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a5a2af' }}>
            {selD ? DIA_LARGO[selD.getDay()] : ''}{sel === hoy ? ' · hoy' : ''}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#241d43', marginBottom: 12 }}>
            {selD ? `${selD.getDate()} de ${MES_LARGO[m - 1].toLowerCase()}` : ''}
          </div>
          {delSel.length === 0
            ? <div style={{ fontSize: '0.79rem', color: '#a5a2af', textAlign: 'center', padding: '26px 0' }}>Sin reuniones este día.</div>
            : delSel.map((b: any) => {
              const est = ESTADOS[normalizaEstado(b.estado)];
              return (
                <div key={b.id} onClick={() => onOpen(b)}
                  style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${b.event_types?.color || '#9B8CFA'}`, borderRadius: 10, padding: '9px 11px', marginBottom: 7, cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#5B4BD6', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(b.hora_inicio)}{b.hora_fin ? ` – ${fmtTime(b.hora_fin)}` : ''}
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#241d43', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.invitee_nombre || '—'}
                  </div>
                  <div style={{ fontSize: '0.69rem', color: '#8a8590', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{(b.event_types?.nombre || '').replace(/^Reunión de |^Sesión de /i, '')}</span>
                    <span style={{ ...S.badge, background: est.bg, color: est.color, fontSize: '0.62rem' }}>{est.label}</span>
                  </div>
                  {b.invitado_company_nombre && (
                    <div style={{ fontSize: '0.67rem', color: '#b3afbd', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.invitado_company_nombre}</div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ── Modal de reagendar con slots reales ── */
function ReagendarModal({ booking, onClose, onDone, onError }: { booking: any; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const isMobile = useIsMobile();
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', zIndex: 2500, padding: isMobile ? '16px 12px' : 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', maxHeight: isMobile ? 'none' : '85vh', overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? '20px 18px calc(24px + env(safe-area-inset-bottom))' : 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Reagendar reunión</h3>
          <button style={isMobile ? { ...S.btnSmall, minWidth: 44, minHeight: 44, fontSize: '1rem' } : S.btnSmall} onClick={onClose}>✕</button>
        </div>
        <p style={{ margin: '4px 0 16px', fontSize: '0.78rem', color: '#888' }}>
          {booking.invitee_nombre} · {booking.event_types?.nombre} · hoy: {fmtDate(booking.fecha)} {fmtTime(booking.hora_inicio)}
        </p>
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Buscando horarios disponibles…</div> : !dias.length ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Sin horarios disponibles en los próximos 14 días. Revisa la disponibilidad en Sistema → Agenda.</div>
        ) : <>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {dias.map(f => (
              <button key={f} style={isMobile ? { ...S.seg(dia === f), minHeight: 44, padding: '10px 16px' } : S.seg(dia === f)} onClick={() => setDia(f)}>{fmtDate(f)}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(96px, 1fr))' : 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {(slots[dia || ''] || []).map(h => (
              <button key={h} disabled={saving} onClick={() => elegir(h)}
                style={{ minHeight: isMobile ? 48 : undefined, padding: isMobile ? '12px 6px' : '9px 6px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', fontSize: isMobile ? '0.9rem' : '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
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
