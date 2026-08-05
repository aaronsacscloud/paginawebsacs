import { Fragment, useEffect, useRef, useState } from 'react';
import { computarSenales } from '../../../lib/crm/senales';
import { CreateDealModal } from './DealsTab';
import { useIsMobile, useDrawerHistory, BP } from '../../../lib/ui/mobile';

/* ═══ Cliente 360 — drawer ancho con pestañas, TODO editable ═══
 * Pestañas: Resumen · Cliente & SACS · Contactos · Suscripciones · Actividad.
 * Reemplaza al ClienteDrawer angosto/solo-lectura. Autocontenido (estilos y
 * badges propios) para no crear ciclos de import con SubscriptionsTab. */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Formato WhatsApp Meta (+52…, sin el "1" de móvil) — igual que lib/kapso.ts.
function metaWa(p: string): string {
  let c = String(p || '').replace(/[^\d+]/g, '');
  if (!c) return '';
  if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
  if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
  return c;
}
const waLink = (p?: string | null) => p ? 'https://wa.me/' + String(metaWa(p)).replace(/\D/g, '') : '';

const D = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 900 } as const,
  panel: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(940px, 97vw)', background: '#fafafa', zIndex: 901, overflowY: 'auto' as const, boxShadow: '-12px 0 40px rgba(0,0,0,.18)' },
  head: { position: 'sticky' as const, top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #ececec', padding: '16px 22px 0' },
  // Una sola fila con scroll horizontal (9 pestañas). En desktop (940px) caben
  // igual; nowrap no cambia nada visible y arregla el wrap en mobile.
  tabbar: { display: 'flex', gap: 2, marginTop: 12, flexWrap: 'nowrap' as const, overflowX: 'auto' as const, WebkitOverflowScrolling: 'touch' as const },
  tab: (act: boolean) => ({ flexShrink: 0, minHeight: 44, padding: '9px 14px', border: 'none', borderBottom: act ? '2.5px solid #1a1a1a' : '2.5px solid transparent', background: 'none', cursor: 'pointer', fontWeight: act ? 800 : 600, fontSize: '0.83rem', color: act ? '#1a1a1a' : '#777', whiteSpace: 'nowrap' as const }) as const,
  body: { padding: 22 } as const,
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  h: { fontSize: '0.72rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 },
  kpi: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 14px', minWidth: 130, flex: 1 } as const,
  kl: { fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' as const },
  kv: { fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', marginTop: 2 } as const,
  input: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.83rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
  th: { textAlign: 'left' as const, padding: '7px 9px', fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, borderBottom: '1px solid #eee' },
  td: { padding: '8px 9px', fontSize: '0.8rem', color: '#333', borderBottom: '1px solid #f4f4f4', fontVariantNumeric: 'tabular-nums' as const },
};

function EstadoBadge({ e }: { e: string }) {
  const map: Record<string, [string, string]> = {
    activa: ['rgba(42,181,160,.15)', '#1A8F7A'], programada: ['rgba(75,123,229,.12)', '#3764c4'],
    pendiente_pago: ['rgba(232,168,56,.16)', '#a06600'], cancelada: ['rgba(229,75,75,.1)', '#b93333'],
    pausada: ['rgba(232,168,56,.16)', '#a06600'],
  };
  const [bg, color] = map[e] || ['#f3f4f6', '#555'];
  return <span style={{ ...D.badge, background: bg, color }}>{e || '—'}</span>;
}

const CICLOS = ['anual', 'mensual', 'vitalicia'];
const ESTADOS_SUB = ['activa', 'programada', 'pendiente_pago', 'pausada', 'cancelada'];
const ROLES = ['Dueño', 'Gerente', 'Facturación', 'Sistemas', 'Compras', 'Otro'];

export default function ClienteDrawer360({ companyId, onClose, onChanged }: { companyId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'resumen' | 'info' | 'sacs' | 'contactos' | 'subs' | 'oport' | 'reuniones' | 'notas' | 'act'>('resumen');
  const [msg, setMsg] = useState('');
  const [borrar, setBorrar] = useState(false);
  const isMobile = useIsMobile();
  useDrawerHistory(true, onClose); // atrás cierra el drawer + scroll-lock del body

  async function load() {
    setErr('');
    try {
      const r = await fetch('/api/crm/arr/company360?id=' + companyId);
      const j = await r.json();
      if (j.error) setErr(j.error); else setData(j);
    } catch (e: any) { setErr(e?.message || 'No se pudo cargar'); }
  }
  useEffect(() => { setData(null); setTab('resumen'); load(); }, [companyId]);

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2600); }

  const co = data?.company;
  const contactos: any[] = data?.contacts || [];
  const principal = contactos.find(c => c.es_principal) || contactos[0] || null;
  const subs: any[] = data?.subscriptions || [];
  const res = data?.resumen || {};
  const act = co?.actividad || null;

  return (
    <>
      <div style={D.overlay} onClick={onClose} />
      <div style={isMobile ? { ...D.panel, width: '100%', height: '100dvh' } : D.panel}>
        {!data && !err && <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando cliente…</div>}
        {err && <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{err} <button style={D.btnG} onClick={load}>Reintentar</button></div>}
        {data && co && (
          <>
            <div style={D.head}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{co.nombre}</div>
                  <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>
                    {co.sacs_account ? <>Cuenta SACS: <b>{co.sacs_account}</b></> : <span style={{ color: '#c62828' }}>Sin cuenta SACS ligada</span>}
                    {principal ? <> · {principal.nombre}{principal.email ? ` · ${principal.email}` : ''}</> : null}
                  </div>
                </div>
                {principal?.whatsapp && (
                  <a href={waLink(principal.whatsapp)} target="_blank" rel="noreferrer" style={{ ...D.btnG, textDecoration: 'none', color: '#1A8F7A', borderColor: '#bfe8df', fontWeight: 700 }}>💬 WhatsApp</a>
                )}
                {/* Eliminar cliente: visible en todas las pestañas (no escondido en
                    un menú), pero en rojo "outline" para que no compita con las
                    acciones normales. El modal es el que exige la confirmación. */}
                <button onClick={() => setBorrar(true)} title="Eliminar este cliente y todo su historial"
                  style={{ ...D.btnG, color: '#c0392b', borderColor: '#f0c4bd', background: '#fff6f4', fontWeight: 700, minHeight: 44, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  🗑{isMobile ? '' : ' Eliminar'}
                </button>
                <button aria-label={isMobile ? 'Atrás' : 'Cerrar'} onClick={onClose} style={{ ...D.btnG, border: 'none', fontSize: '1.15rem', minWidth: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{isMobile ? '←' : '✕'}</button>
              </div>
              <div style={D.tabbar}>
                <button style={D.tab(tab === 'resumen')} onClick={() => setTab('resumen')}>Resumen</button>
                <button style={D.tab(tab === 'info')} onClick={() => setTab('info')}>Info general</button>
                <button style={D.tab(tab === 'sacs')} onClick={() => setTab('sacs')}>Actividad en SACS</button>
                <button style={D.tab(tab === 'contactos')} onClick={() => setTab('contactos')}>Contactos ({contactos.length})</button>
                <button style={D.tab(tab === 'subs')} onClick={() => setTab('subs')}>Suscripciones ({subs.length})</button>
                <button style={D.tab(tab === 'oport')} onClick={() => setTab('oport')}>Oportunidades</button>
                <button style={D.tab(tab === 'reuniones')} onClick={() => setTab('reuniones')}>Reuniones</button>
                <button style={D.tab(tab === 'notas')} onClick={() => setTab('notas')}>Notas</button>
                <button style={D.tab(tab === 'act')} onClick={() => setTab('act')}>Actividad</button>
              </div>
            </div>
            <div style={D.body}>
              {msg && <div style={{ background: '#e8f5e9', color: '#1b5e20', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}
              {tab === 'resumen' && <TabResumen res={res} co={co} act={act} subs={subs} acts={data?.activities || []} reload={() => { load(); onChanged(); }} />}
              {tab === 'info' && <TabInfoGeneral co={co} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'sacs' && <TabSacs co={co} act={act} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'contactos' && <TabContactos companyId={companyId} contactos={contactos} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'subs' && <TabSubs companyId={companyId} subs={subs} reload={() => { load(); onChanged(); }} flash={flash} principal={principal} />}
              {tab === 'oport' && <TabOportunidades companyId={companyId} co={co} principal={principal} flash={flash} reload={() => { load(); onChanged(); }} />}
              {tab === 'reuniones' && <TabReuniones companyId={companyId} principal={principal} flash={flash} />}
              {tab === 'notas' && <TabNotas companyId={companyId} />}
              {tab === 'act' && <TabActividad companyId={companyId} data={data} reload={() => { load(); onChanged(); }} />}
            </div>
          </>
        )}
      </div>
      {borrar && co && (
        <EliminarClienteModal companyId={companyId} co={co} onCancel={() => setBorrar(false)}
          onDeleted={() => { setBorrar(false); onChanged(); onClose(); }} />
      )}
    </>
  );
}

/* ═══ Eliminar cliente (cascada) ═══
 * Doble candado: (1) muestra el inventario REAL de lo que se va a borrar —lo
 * calcula el endpoint en dry_run, no una lista adivinada— y (2) exige escribir
 * el nombre del cliente. Ojo: es irreversible y no toca la cuenta de SACS. */
function EliminarClienteModal({ companyId, co, onCancel, onDeleted }: { companyId: string; co: any; onCancel: () => void; onDeleted: () => void }) {
  const [inv, setInv] = useState<any>(null);
  const [err, setErr] = useState('');
  const [texto, setTexto] = useState('');
  const [borrando, setBorrando] = useState(false);
  const etiqueta = co.sacs_account || co.nombre || '';
  const validos = [co.nombre, co.sacs_account].filter(Boolean).map((s: string) => String(s).trim().toLowerCase());
  const ok = validos.includes(texto.trim().toLowerCase());

  async function pedir(body: any) {
    const r = await fetch('/api/crm/arr/eliminar-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, ...body }) });
    return r.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));
  }
  useEffect(() => {
    let vivo = true;
    pedir({ dry_run: true }).then(j => { if (!vivo) return; if (j.error) setErr(j.error); else setInv(j); }).catch(e => vivo && setErr(String(e)));
    return () => { vivo = false; };
  }, [companyId]);

  async function eliminar() {
    if (!ok || borrando) return;
    setBorrando(true); setErr('');
    const j = await pedir({ confirmar: texto.trim() });
    if (j?.error) { setErr(j.error); setBorrando(false); return; }
    onDeleted();
  }

  const wrap = { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.5)' };
  const box = { background: '#fff', borderRadius: 16, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 24px 60px rgba(0,0,0,.3)' };

  return (
    <div style={wrap} onClick={onCancel}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#c0392b' }}>Eliminar cliente definitivamente</div>
          <div style={{ fontSize: '0.84rem', color: '#555', marginTop: 6, lineHeight: 1.5 }}>
            Vas a borrar <b>{etiqueta}</b> y <b>todo</b> lo que representa su relación con nosotros.
            Esta acción <b>no se puede deshacer</b> y el ARR/histórico de este cliente desaparece de los reportes.
          </div>
        </div>
        <div style={{ padding: '14px 22px 0' }}>
          {!inv && !err && <div style={{ padding: 18, textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>Calculando qué se va a borrar…</div>}
          {inv && (
            <div style={{ border: '1px solid #f0dcd8', background: '#fffaf9', borderRadius: 12, padding: 14 }}>
              <div style={{ ...D.h, color: '#c0392b', marginBottom: 8 }}>Se eliminarán {inv.total} registros</div>
              {inv.detalle?.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 5, columnGap: 12, fontSize: '0.8rem' }}>
                  {inv.detalle.map((d: any) => (
                    <Fragment key={d.tabla}>
                      <span style={{ color: '#444' }}>{d.label}</span>
                      <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{d.n}</span>
                    </Fragment>
                  ))}
                  <span style={{ color: '#444' }}>Cliente (empresa)</span><span style={{ fontWeight: 800 }}>1</span>
                </div>
              ) : <div style={{ fontSize: '0.82rem', color: '#666' }}>Este cliente no tiene datos ligados: solo se borra la ficha.</div>}
            </div>
          )}
          {co.sacs_account && (
            <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#666', background: '#f6f8fa', border: '1px solid #e9eaee', borderRadius: 10, padding: '9px 12px' }}>
              ℹ️ La cuenta de SACS <b>{co.sacs_account}</b> <b>no</b> se toca: el cliente sigue operando su sistema. Esto solo borra el CRM.
            </div>
          )}
          {err && <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#b93333', fontWeight: 700 }}>{err}</div>}
          <div style={{ marginTop: 14 }}>
            <label style={D.lbl}>Para confirmar, escribe <b style={{ color: '#c0392b' }}>{etiqueta}</b></label>
            <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus placeholder={etiqueta}
              onKeyDown={e => { if (e.key === 'Enter' && ok) eliminar(); }}
              style={{ ...D.input, borderColor: texto && !ok ? '#e5a9a0' : '#ddd', height: 44 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 22px 20px' }}>
          <button onClick={onCancel} style={{ ...D.btnG, minHeight: 44, padding: '0 16px' }}>Cancelar</button>
          <button onClick={eliminar} disabled={!ok || borrando}
            style={{ ...D.btn, minHeight: 44, padding: '0 18px', background: ok && !borrando ? '#c0392b' : '#e8b8b0', cursor: ok && !borrando ? 'pointer' : 'not-allowed' }}>
            {borrando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Aviso de datos viejos: el cron de actividad corre cada 6 h, así que pasar de
 * 24 h sin sincronizar significa que el puente con SACS está caído y lo que se
 * ve en pantalla ya no es la realidad del cliente. */
function DatosDesactualizados({ syncAt }: { syncAt?: string | null }) {
  if (!syncAt) return null;
  const horas = Math.floor((Date.now() - new Date(syncAt).getTime()) / 3600000);
  if (!(horas >= 24)) return null;
  const cuanto = horas >= 48 ? `${Math.floor(horas / 24)} días` : `${horas} horas`;
  return (
    <div style={{ background: '#fff6f4', border: '1px solid #f0c4bd', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.78rem', color: '#a03323', fontWeight: 600 }}>
      ⚠️ Datos de hace <b>{cuanto}</b>: la sincronización con SACS no está corriendo. Lo de abajo es la última foto, no el estado de hoy.
    </div>
  );
}

/* ─────────── 📊 Resumen ─────────── */
function TabResumen({ res, co, act, subs, acts, reload }: any) {
  const isMobile = useIsMobile();
  const dias = co?.dias_sin_venta;
  const senales = computarSenales(co, (subs || []).find((s: any) => s.estado === 'activa'));
  // Tareas de onboarding del cliente (activities tipo 'tarea' category onboarding).
  const onboarding = (acts || []).filter((a: any) => a.tipo === 'tarea' && a.metadata?.category === 'onboarding');
  const [togMsg, setTogMsg] = useState('');
  async function toggleTarea(t: any) {
    setTogMsg(t.id);
    await fetch('/api/crm/activities', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, done: !(t.metadata?.done) }) }).catch(() => {});
    setTogMsg(''); reload?.();
  }
  // Auto-palomeo PERSISTIDO: si la cuenta SACS ya está ligada, "activar_cuenta"
  // se marca hecha en BD (si solo fuera visual, AgendaHoy la mostraría pendiente
  // para siempre). Corre una vez por apertura, best-effort.
  useEffect(() => {
    const t = onboarding.find((x: any) => x.metadata?.step === 'activar_cuenta' && !x.metadata?.done);
    if (t && co?.sacs_account) {
      fetch('/api/crm/activities', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, done: true }) }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [co?.id]);
  const tend = act && act.tendencia_pct;
  const sucPlan = Number(co.sucursales || 0);
  const sucReales = act ? Number(act.sucursales || 0) : 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['Subs activas', res.subs_activas ?? 0], ['ARR', money(res.arr)], ['MRR', money(res.mrr)],
          ['Próx. factura', fmtDate(res.proxima_factura)], ['Pagos', res.pagos_totales ?? 0], ['Total pagado', money(res.total_pagado)]].map(([l, v]) => (
          <div key={String(l)} style={D.kpi}><div style={D.kl}>{l}</div><div style={D.kv}>{v}</div></div>
        ))}
      </div>

      {/* ── Qué venderle (señales reales) ── */}
      {senales.length > 0 && (
        <div style={D.card}>
          <div style={D.h}>💡 Qué venderle / atender</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {senales.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: s.nivel === 'riesgo' ? '#fdf2f2' : '#f0f7f4', border: '1px solid ' + (s.nivel === 'riesgo' ? '#f7d7d7' : '#d6ebe2') }}>
                <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>{s.nivel === 'riesgo' ? '⚠️' : '📈'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: 700, color: s.nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{s.titulo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 1 }}>{s.detalle}</div>
                  <div style={{ fontSize: '0.78rem', color: '#16181d', marginTop: 3 }}><b>Acción:</b> {s.accion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Onboarding del cliente nuevo (checklist accionable) ── */}
      {onboarding.length > 0 && (
        <div style={D.card}>
          <div style={D.h}>Onboarding ({onboarding.filter((t: any) => t.metadata?.done || (t.metadata?.step === 'activar_cuenta' && co.sacs_account)).length}/{onboarding.length})</div>
          {onboarding.map((t: any) => {
            const autoOk = t.metadata?.step === 'activar_cuenta' && !!co.sacs_account; // se auto-palomea si la cuenta ya está ligada
            const done = t.metadata?.done || autoOk;
            const due = t.metadata?.due_at ? new Date(t.metadata.due_at) : null;
            const vencida = !done && due && due.getTime() < Date.now();
            return (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.83rem' }}>
                <input type="checkbox" checked={!!done} disabled={autoOk || togMsg === t.id} onChange={() => toggleTarea(t)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0, textDecoration: done ? 'line-through' : 'none', color: done ? '#9aa0a8' : '#16181d', fontWeight: 600 }}>
                  {t.titulo}{autoOk ? ' (auto: cuenta ligada)' : ''}
                </div>
                {due && !done && <span style={{ ...D.badge, background: vencida ? '#fdf2f2' : '#fff8e1', color: vencida ? '#b93333' : '#a06600' }}>{vencida ? 'vencida' : 'para ' + due.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Qué está usando (actividad real de SACS) ── */}
      <div style={D.card}>
        <div style={D.h}>Qué está usando en SACS</div>
        {/* Estos números vienen del cron; si el cron se cae, siguen pintándose
            igual y se leen como si fueran de hoy (pasó 6 días en jul-2026).
            Con más de 24 h sin sincronizar, dilo en la cara. */}
        <DatosDesactualizados syncAt={co.actividad_sync_at} />
        {/* Si el cliente opera varias cuentas, dilo: un "$639k en 30d" sin
            contexto se lee como una sola cuenta y no cuadra con lo que se ve
            dentro de SACS. */}
        {act?.cuentas?.length > 1 && (
          <div style={{ fontSize: '0.76rem', color: '#3764c4', background: '#f2f6ff', border: '1px solid #d9e3fb', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
            🔗 Suma de <b>{act.cuentas.length} cuentas de SACS</b>: {act.cuentas.join(' · ')}
          </div>
        )}
        {act ? (
          <div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.83rem' }}>
              <span>Última venta: <b style={{ color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#1A8F7A' }}>{fmtDate(co.ultima_venta_at)}{dias != null ? ` (hace ${dias}d)` : ''}</b></span>
              {act.ventas_7d != null && <span>Ventas 7d: <b>{act.ventas_7d}</b></span>}
              {act.ventas_30d != null && <span>Ventas 30d: <b>{act.ventas_30d}</b></span>}
              {act.total_30d != null && <span>Monto 30d: <b>{money(act.total_30d)}</b></span>}
              {tend != null && <span>Tendencia: <b style={{ color: tend >= 0 ? '#1A8F7A' : '#b93333' }}>{tend >= 0 ? '+' : ''}{tend}%</b></span>}
              {act.usuarios != null && <span>Usuarios: <b>{act.usuarios}</b>{act.usuarios_operando != null ? ` (${act.usuarios_operando} operando)` : ''}</span>}
              {/* "Sucursales" es las que OPERAN (vendieron en 30d), no las
                  registradas: hay cuentas con 145 dadas de alta y 8 vivas. Si
                  difieren, se dice, porque si no el número parece un error. */}
              {(sucReales > 0 || sucPlan > 0) && (
                <span title={act?.sucursales_totales ? `${act.sucursales_totales} registradas en total · ${act.sucursales_permitidas ?? '—'} asignadas a superadmin` : undefined}>
                  Sucursales operando: <b style={{ color: sucReales > sucPlan && sucPlan > 0 ? '#a06600' : '#16181d' }}>{sucReales || sucPlan}{sucPlan > 0 && sucReales > sucPlan ? ` (plan: ${sucPlan})` : ''}</b>
                  {act?.sucursales_totales > sucReales ? <span style={{ color: '#9aa0a8' }}> · {act.sucursales_totales} registradas</span> : null}
                </span>
              )}
              {co.health_score != null && <span>Salud: <b style={{ color: co.health_score >= 70 ? '#1A8F7A' : co.health_score >= 40 ? '#a06600' : '#b93333' }}>{co.health_score}</b></span>}
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Módulos que usa ({(act.modulos || []).length})</div>
              {(act.modulos || []).length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {act.modulos.map((m: string) => <span key={m} style={{ ...D.badge, background: '#eef2ff', color: '#3730a3' }}>{m}</span>)}
                </div>
              ) : <span style={{ color: '#999', fontSize: '0.8rem' }}>Sin módulos con actividad reciente.</span>}
            </div>
          </div>
        ) : <div style={{ color: '#999', fontSize: '0.82rem' }}>{co?.sacs_account ? 'Sin datos sincronizados aún — usa "Sincronizar" en la pestaña Cliente & SACS.' : 'Liga la cuenta SACS en la pestaña Cliente & SACS para ver su actividad real.'}</div>}
      </div>
      <div style={D.card}>
        <div style={D.h}>Suscripciones</div>
        {subs.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem' }}>Sin suscripciones — agrégala en la pestaña Suscripciones.</div>}
        {subs.map((s: any) => (
          <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.83rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <b style={{ minWidth: isMobile ? 0 : 150 }}>{s.nombre_plan}</b><span style={{ color: '#888' }}>{s.ciclo}</span>
            <span style={{ fontWeight: 700 }}>{money(s.arr)} ARR</span>
            <span style={{ color: '#888' }}>próx: {fmtDate(s.proxima_factura)}</span>
            <span style={{ marginLeft: 'auto' }}><EstadoBadge e={s.estado} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Selector de ETAPA del pipeline de clientes (se movió aquí desde la tabla).
 * Carga el catálogo de etapas de /api/crm/pipelines y guarda pipeline_stage. */
function EtapaSelector({ co, reload, flash }: any) {
  const [stages, setStages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/crm/pipelines').then(r => r.json()).then(pj => {
      if (!alive) return;
      const cli = (pj.data || []).find((p: any) => p.tipo === 'cliente');
      setStages(cli?.stages || []);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  async function cambiar(key: string) {
    setSaving(true);
    const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: co.id, pipeline_stage: key || null }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo cambiar la etapa.'); else { flash('Etapa actualizada'); reload(); }
  }
  const actual = stages.find(s => s.key === co.pipeline_stage);
  return (
    <div style={D.card}>
      <div style={D.h}>Etapa del cliente</div>
      {stages.length === 0 ? (
        <div style={{ color: '#999', fontSize: '0.82rem' }}>Configura las etapas en Configuración → Pipelines.</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={co.pipeline_stage || ''} disabled={saving} onChange={e => cambiar(e.target.value)}
            style={{ ...D.input, width: 'auto', minWidth: 200, fontWeight: 700, color: actual ? actual.color : '#666', borderColor: actual ? actual.color : '#e3e5e9' }}>
            <option value="">— sin etapa —</option>
            {stages.map(s => <option key={s.key} value={s.key} style={{ color: '#333' }}>{s.label}</option>)}
          </select>
          {saving && <span style={{ color: '#999', fontSize: '0.8rem' }}>guardando…</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────── 📇 Info general (datos editables del cliente) ─────────── */
function TabInfoGeneral({ co, reload, flash }: any) {
  const [f, setF] = useState<any>({ nombre: co.nombre || '', rfc: co.rfc || '', razon_social: co.razon_social || '', giro: co.giro || '', sitio_web: co.sitio_web || '', ciudad: co.ciudad || '', estado_geo: co.estado_geo || '', sucursales: co.sucursales || 1, estado_cuenta: co.estado_cuenta || 'activo' });
  const [saving, setSaving] = useState(false);
  async function guardar() {
    if (!f.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    setSaving(true);
    const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: co.id, ...f, sucursales: parseInt(f.sucursales) || 1 }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo guardar.'); else { flash('Datos del cliente guardados'); reload(); }
  }
  const campo = (label: string, k: string, ph = '') => (
    <div style={{ flex: '1 1 200px' }}>
      <label style={D.lbl}>{label}</label>
      <input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph} style={D.input} />
    </div>
  );
  return (
    <div>
      <EtapaSelector co={co} reload={reload} flash={flash} />
      <div style={D.card}>
        <div style={D.h}>Datos del cliente (editables)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {campo('Nombre *', 'nombre')}
          {campo('Razón social', 'razon_social')}
          {campo('RFC', 'rfc')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {campo('Giro', 'giro', 'boutique, papelería…')}
          {campo('Sitio web', 'sitio_web', 'https://…')}
          {campo('Ciudad', 'ciudad')}
          {campo('Estado', 'estado_geo')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ width: 120 }}>
            <label style={D.lbl}>Sucursales</label>
            <input type="number" min={1} value={f.sucursales} onChange={e => setF({ ...f, sucursales: e.target.value })} style={D.input} />
          </div>
          <div style={{ width: 180 }}>
            <label style={D.lbl}>Estado de la cuenta</label>
            <select value={f.estado_cuenta} onChange={e => setF({ ...f, estado_cuenta: e.target.value })} style={D.input}>
              {['activo', 'prospecto', 'pausado', 'churned'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <button style={{ ...D.btn, marginLeft: 'auto' }} disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

/* Panorama 360 de la cuenta en SACS (usuarios/sucursales/transacciones/promos +
 * uso profundo: 7 días, programas, administración, módulos nunca activados).
 * Carga on-demand desde /api/crm/sacs-cuenta-360; mientras llega, pinta el uso
 * persistido por el cron (co.uso_sacs). */
function Panorama360({ account, co }: { account: string; co?: any }) {
  const isMobile = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true; setD(null); setErr('');
    fetch('/api/crm/sacs-cuenta-360?account=' + encodeURIComponent(account))
      .then(r => r.json()).then(j => { if (!alive) return; if (j.error) setErr(j.error); else setD(j); })
      .catch(() => { if (alive) setErr('x'); });
    return () => { alive = false; };
  }, [account]);

  // uso: preferimos lo recién traído; si aún no llega (o falló), el caché del cron
  const uso = (d && d.uso) || co?.uso_sacs || null;

  if (err && !uso) return null;
  if (!d && !uso) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando panorama de SACS…</div>;

  const u = d?.usuarios || {}, suc = d?.sucursales || {}, tx = d?.ultimas_transacciones || [], pr = d?.promociones || {};
  const lbl: any = { fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' };
  const ell: any = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const usa = (b: boolean, txt: string, extra = '') => (
    <span style={{ ...D.badge, background: b ? '#e6f6f2' : '#fafafa', color: b ? '#1A8F7A' : '#9aa0a8', border: '1px solid ' + (b ? '#bfe8df' : '#e8e8ea') }}>
      <b>{txt}</b>{b ? <> · <b style={{ color: '#1A8F7A' }}>SÍ lo usa</b>{extra ? ` (${extra})` : ''}</> : <> · no lo usa</>}
    </span>
  );
  const le = uso?.lealtad, adm = uso?.administracion, fac = uso?.facturacion, tg = uso?.tarjetas_regalo, tr = uso?.transferencias;
  // Matriz integral de módulos agrupada por familia.
  const familias: any[] = [];
  (uso?.modulos || []).forEach((m: any) => {
    let f = familias.find(x => x.nombre === m.familia);
    if (!f) { f = { nombre: m.familia, items: [] }; familias.push(f); }
    f.items.push(m);
  });
  const nUsa = (uso?.modulos || []).filter((m: any) => m.usa).length;
  const chipMod = (m: any) => (
    <span key={m.modulo} style={{ ...D.badge, background: m.usa ? '#e6f6f2' : '#fafafa', color: m.usa ? '#1A8F7A' : '#9aa0a8', border: '1px solid ' + (m.usa ? '#bfe8df' : '#e8e8ea') }}>
      <b>{m.modulo}</b>{m.usa
        ? <> · <b style={{ color: '#1A8F7A' }}>SÍ</b>{m.docs_7d ? ` · ${m.docs_7d} en 7d` : m.docs_30d ? ` · ${m.docs_30d} en 30d` : ''}{m.total ? ` · ${Number(m.total).toLocaleString()} total` : ''}</>
        : <> · no lo usa</>}
    </span>
  );
  return (
    <>
    {d && <div style={D.card}>
      <div style={D.h}>Panorama en SACS</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={D.kpi}><div style={D.kl}>Usuarios</div><div style={D.kv}>{u.total ?? 0}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{u.activos ?? 0} activos</div></div>
        <div style={D.kpi}>
          <div style={D.kl}>Sucursales operando</div>
          <div style={D.kv}>{suc.activas ?? '—'}</div>
          <div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>de {suc.total ?? 0} registradas</div>
        </div>
        <div style={D.kpi}><div style={D.kl}>Promociones</div><div style={D.kv}>{pr.total ?? 0}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{pr.activas ?? 0} activas</div></div>
      </div>

      {u.por_grupo?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Usuarios por grupo</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {u.por_grupo.map((g: any, i: number) => <span key={i} style={{ ...D.badge, background: '#f3f4f6', color: '#475569' }}>{g.grupo}: {g.n}</span>)}
          </div>
        </div>
      ) : null}

      {/* Activas e inactivas por separado. Antes salían las 145 en verde por
          igual, y con eso no se puede decidir nada: en liveshows solo 8
          vendieron este mes y las otras 137 son pop-ups de conciertos que ya
          terminaron. "Activa" = vendió algo en los últimos 30 días. */}
      {suc.detalle?.length ? (() => {
        const act = suc.detalle.filter((x: any) => x.activa);
        const ina = suc.detalle.filter((x: any) => !x.activa);
        return (
          <div style={{ marginBottom: 12 }}>
            {act.length > 0 && (<>
              <div style={lbl}>Sucursales operando ({act.length}) · vendieron en 30 días</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: ina.length ? 10 : 0 }}>
                {act.map((x: any, i: number) => (
                  <span key={i} style={{ ...D.badge, background: '#e6f6f2', color: '#1A8F7A', border: '1px solid #bfe8df' }}>
                    <b>{x.nombre}</b> · {money(x.total_30d)}{x.ventas_30d ? ` · ${Number(x.ventas_30d).toLocaleString()} ventas` : ''}
                    {x.en_catalogo === false ? ' · fuera del catálogo' : ''}
                  </span>
                ))}
              </div>
            </>)}
            {ina.length > 0 && (<>
              <div style={lbl}>Sin ventas en 30 días ({ina.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ina.map((x: any, i: number) => (
                  <span key={i} style={{ ...D.badge, background: '#fafafa', color: '#9aa0a8', border: '1px solid #e8e8ea' }}>{x.nombre}</span>
                ))}
              </div>
            </>)}
          </div>
        );
      })() : suc.nombres?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Sucursales</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suc.nombres.map((n: string, i: number) => <span key={i} style={{ ...D.badge, background: '#f3f4f6', color: '#475569' }}>{n}</span>)}
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: pr.ultimas?.length ? 12 : 0 }}>
        <div style={lbl}>Últimas transacciones</div>
        {tx.length ? tx.map((t: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.8rem' }}>
            <b>#{t.folio}</b>
            <span style={{ color: '#888' }}>{fmtDate(t.fecha)}</span>
            {t.sucursal ? <span style={{ color: '#888', ...ell, maxWidth: isMobile ? '60vw' : 120 }}>{t.sucursal}</span> : null}
            <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{money(t.total)}</span>
          </div>
        )) : <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin ventas recientes.</div>}
      </div>

      {pr.ultimas?.length ? (
        <div>
          <div style={lbl}>Últimas promociones</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pr.ultimas.map((p: any, i: number) => <span key={i} style={{ ...D.badge, background: p.activa ? '#fff8e1' : '#f3f4f6', color: p.activa ? '#a06600' : '#777' }}>{p.nombre}{p.activa ? ' · activa' : ''}</span>)}
          </div>
        </div>
      ) : null}
    </div>}

    {uso && <div style={D.card}>
      <div style={D.h}>Uso últimos 7 días</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: (tr?.ultimas?.length || uso.conteos?.ultimo) ? 12 : 0 }}>
        <div style={D.kpi}><div style={D.kl}>Transferencias</div><div style={D.kv}>{tr?.total_7d ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Conteos físicos</div><div style={D.kv}>{uso.conteos?.total_7d ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Clientes nuevos</div><div style={D.kv}>{uso.clientes?.nuevos_7d ?? 0}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{Number(uso.clientes?.total || 0).toLocaleString()} en total</div></div>
        <div style={D.kpi}><div style={D.kl}>Facturas timbradas</div><div style={D.kv}>{fac?.timbradas_7d ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Promos creadas</div><div style={D.kv}>{uso.promociones?.creadas_7d ?? 0}</div></div>
      </div>
      {tr?.ultimas?.length ? (
        <div style={{ marginBottom: uso.conteos?.ultimo ? 10 : 0 }}>
          <div style={lbl}>Últimas transferencias</div>
          {tr.ultimas.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.8rem' }}>
              <span style={{ color: '#888' }}>{fmtDate(t.fecha)}</span>
              <span style={{ ...ell, maxWidth: isMobile ? '70vw' : 260 }}><b>{t.origen || '—'}</b> → <b>{t.destino || '—'}</b></span>
              <span style={{ marginLeft: 'auto', ...D.badge, background: /Recibida/.test(t.status) ? '#e6f6f2' : t.status === 'Cancelada' ? '#fdf2f2' : '#fff8e1', color: /Recibida/.test(t.status) ? '#1A8F7A' : t.status === 'Cancelada' ? '#b93333' : '#a06600' }}>{t.status || '—'}</span>
            </div>
          ))}
        </div>
      ) : null}
      {uso.conteos?.ultimo && <div style={{ fontSize: '0.78rem', color: '#666' }}>Último conteo: <b>{fmtDate(uso.conteos.ultimo.fecha)}</b> · {uso.conteos.ultimo.status}</div>}
    </div>}

    {/* ── Matriz INTEGRAL: TODOS los módulos por familia, uso real ── */}
    {familias.length > 0 && (
      <div style={D.card}>
        <div style={D.h}>Uso de módulos ({nUsa}/{uso.modulos.length})</div>
        <div style={{ fontSize: '0.74rem', color: '#999', marginTop: -6, marginBottom: 12 }}>
          <span style={{ color: '#1A8F7A', fontWeight: 700 }}>Verde = lo usa</span> · <span style={{ color: '#9aa0a8', fontWeight: 700 }}>gris = oportunidad de venta</span>
        </div>
        {familias.map((fam: any) => (
          <div key={fam.nombre} style={{ marginBottom: 12 }}>
            <div style={lbl}>{fam.nombre}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {fam.items.map((m: any) => chipMod(m))}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ── Detalle de programas (lo que la matriz no cabe: tipo, inscritos, promos) ── */}
    {uso && (le?.activo || fac?.configurada || tg?.usa || uso.promociones?.activas?.length || Number(adm?.cxp_pendientes || 0) > 0) ? (
      <div style={D.card}>
        <div style={D.h}>Detalle de programas y administración</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
          {le?.activo && <div>💎 <b>Lealtad {le.tipo === 'completo' ? 'COMPLETO' : le.tipo === 'basico' ? 'BÁSICO' : ''}</b> — {Number(le.inscritos || 0).toLocaleString()} inscritos{Number(le.nuevos_7d || 0) > 0 ? `, +${le.nuevos_7d} en 7d` : ''}</div>}
          {fac?.configurada && <div>🧾 <b>Facturación configurada</b>{fac.timbradas_7d ? ` — ${fac.timbradas_7d} timbradas en 7d` : ''}</div>}
          {tg?.usa && <div>🎁 <b>Tarjetas de regalo</b>{tg.activas ? ` — ${tg.activas} activas` : ''}</div>}
          {Number(adm?.cxp_pendientes || 0) > 0 && <div>📌 <b>Cuentas por pagar</b> — {adm.cxp_pendientes} pendientes</div>}
        </div>
        {uso.promociones?.activas?.length ? (
          <div style={{ marginTop: 10 }}>
            <div style={lbl}>Promociones activas ahora</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {uso.promociones.activas.map((p: any, i: number) => <span key={i} style={{ ...D.badge, background: '#fff8e1', color: '#a06600' }}>{p.nombre}{p.origen === 'pos' ? ' · POS' : ''}</span>)}
            </div>
          </div>
        ) : null}
      </div>
    ) : null}
    </>
  );
}

/* ─────────── 🏢 SACS (solo información de SACS: ligar cuenta + panorama) ─────────── */
function TabSacs({ co, act, reload, flash }: any) {
  // Un cliente puede operar VARIAS cuentas de SACS (el dueño de `boomfitness`
  // también es dueño de `urban`). Los números de arriba son la SUMA de todas;
  // aquí se ven una por una y se agregan/quitan.
  const [cuentas, setCuentas] = useState<any[] | null>(null);
  const [nueva, setNueva] = useState('');
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState<string>(co.sacs_account || '');

  async function cargar() {
    try {
      const j = await fetch('/api/crm/arr/sacs-cuentas?company_id=' + co.id).then(r => r.json());
      const ls = j.data || [];
      // Migración sin correr → al menos la principal, para no dejar la pestaña vacía.
      setCuentas(ls.length || !co.sacs_account ? ls : [{ id: null, cuenta: co.sacs_account, es_principal: true, sync_at: co.actividad_sync_at }]);
    } catch { setCuentas([]); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [co.id]);
  useEffect(() => { if (!ver && co.sacs_account) setVer(co.sacs_account); }, [co.sacs_account]);

  async function pedir(init: RequestInit, url: string, okMsg: string) {
    setBusy(true);
    try {
      const j = await fetch(url, init).then(r => r.json()).catch(() => ({ error: 'Respuesta inválida' }));
      if (j?.error) { alert(j.error); return false; }
      flash(okMsg); await cargar(); reload(); return true;
    } finally { setBusy(false); }
  }
  const agregar = async () => {
    const c = nueva.trim().toLowerCase();
    if (!c) { alert('Escribe el subdominio de la cuenta (ej. dibujotecnico).'); return; }
    if (await pedir({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: co.id, cuenta: c }) }, '/api/crm/arr/sacs-cuentas', 'Cuenta agregada y sincronizada')) setNueva('');
  };
  const quitar = (c: any) => {
    if (!c.id) { alert('Esta cuenta viene del registro viejo; sincroniza una vez para poder administrarla.'); return; }
    if (!confirm(`¿Desligar la cuenta "${c.cuenta}" de este cliente?\n\nNo se borra nada en SACS: solo deja de contar en sus métricas del CRM.`)) return;
    pedir({ method: 'DELETE' }, '/api/crm/arr/sacs-cuentas?id=' + c.id, 'Cuenta desligada');
  };
  const hacerPrincipal = (c: any) => c.id && pedir({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) }, '/api/crm/arr/sacs-cuentas', 'Cuenta principal actualizada');
  const syncAhora = () => pedir({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: co.id }) }, '/api/crm/arr/sync-cuenta', 'Actividad sincronizada');

  const lista = cuentas || [];
  const varias = lista.length > 1;

  return (
    <div>
      <div style={D.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={D.h}>Cuentas de SACS {lista.length ? `(${lista.length})` : ''}</div>
          {lista.length > 0 && <button style={{ ...D.btnG, marginLeft: 'auto' }} disabled={busy} onClick={syncAhora}>🔄 Sincronizar {varias ? 'todas' : 'ahora'}</button>}
        </div>

        {cuentas === null && <div style={{ color: '#999', fontSize: '0.82rem' }}>Cargando cuentas…</div>}
        {cuentas !== null && lista.length === 0 && (
          <div style={{ color: '#c62828', fontSize: '0.82rem', marginBottom: 10 }}>Este cliente no tiene ninguna cuenta de SACS ligada.</div>
        )}

        {lista.map((c: any) => {
          const a = c.actividad || null;
          return (
            <div key={c.cuenta} style={{ border: '1px solid #ececec', borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: c.es_principal ? '#f7fbfa' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.88rem' }}>{c.cuenta}</b>
                {c.es_principal && <span style={{ ...D.badge, background: 'rgba(42,181,160,.15)', color: '#1A8F7A' }}>principal</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {!c.es_principal && c.id && <button style={D.btnG} disabled={busy} onClick={() => hacerPrincipal(c)}>Hacer principal</button>}
                  <button style={{ ...D.btnG, color: '#c0392b', borderColor: '#f0c4bd' }} disabled={busy} onClick={() => quitar(c)}>Quitar</button>
                </div>
              </div>
              {a && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.78rem', color: '#555', marginTop: 6 }}>
                  <span>Última venta: <b>{fmtDate(a.ultima_venta)}</b></span>
                  <span>30d: <b>{a.ventas_30d ?? 0}</b> ventas · <b>{money(a.total_30d)}</b></span>
                  {a.usuarios != null && <span>Usuarios: <b>{a.usuarios}</b></span>}
                  {a.sucursales != null && (
                    <span title="Operando = vendió algo en los últimos 30 días">
                      Sucursales: <b>{a.sucursales}</b> operando
                      {a.sucursales_totales > a.sucursales ? <span style={{ color: '#9aa0a8' }}> de {a.sucursales_totales}</span> : null}
                    </span>
                  )}
                </div>
              )}
              {c.sync_at && <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 4 }}>Sincronizada: {new Date(c.sync_at).toLocaleString('es-MX')}</div>}
              <AccederCuenta account={c.cuenta} />
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={D.lbl}>Agregar otra cuenta (subdominio, ej. urban)</label>
            <input value={nueva} onChange={e => setNueva(e.target.value)} placeholder="cuenta" style={D.input}
              onKeyDown={e => { if (e.key === 'Enter') agregar(); }} />
          </div>
          <button style={D.btn} disabled={busy} onClick={agregar}>{busy ? '…' : '+ Agregar cuenta'}</button>
        </div>
        {varias && (
          <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#666', background: '#f6f8fa', border: '1px solid #e9eaee', borderRadius: 10, padding: '9px 12px' }}>
            ℹ️ Las métricas del cliente (ventas, salud, usuarios, sucursales) son la <b>suma de las {lista.length} cuentas</b>. La tendencia se recalcula sobre los montos totales, no es un promedio de porcentajes.
          </div>
        )}
      </div>

      {varias && (
        <div style={{ ...D.card, paddingBottom: 10 }}>
          <div style={D.h}>Ver el detalle de una cuenta</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {lista.map((c: any) => (
              <button key={c.cuenta} onClick={() => setVer(c.cuenta)}
                style={{ ...D.btnG, fontWeight: ver === c.cuenta ? 800 : 600, borderColor: ver === c.cuenta ? '#1A8F7A' : '#ddd', color: ver === c.cuenta ? '#1A8F7A' : '#333' }}>
                {c.cuenta}
              </button>
            ))}
          </div>
        </div>
      )}

      {ver && <Panorama360 account={ver} co={co} />}
      {lista.length > 0 && <Evolucion companyId={co.id} />}
      {ver && <UsuariosSacs account={ver} />}
    </div>
  );
}

/* Evolución del uso: compara el snapshot más reciente vs el más viejo dentro de
 * ~30 días (histórico en uso_snapshots que llenan los crons). */
function Evolucion({ companyId }: any) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    let alive = true; setRows(null);
    fetch('/api/crm/uso-historia?company_id=' + companyId + '&dias=45')
      .then(r => r.json()).then(j => { if (alive) setRows(j.data || []); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [companyId]);

  if (rows === null || rows.length < 2) return null; // sin historia suficiente aún

  const prev = rows[0], last = rows[rows.length - 1];
  const METS: { k: string; l: string }[] = [
    { k: 'total_30d', l: 'Venta 30d' },
    { k: 'ventas_30d', l: '# ventas 30d' },
    { k: 'clientes_total', l: 'Clientes' },
    { k: 'lealtad_inscritos', l: 'Lealtad' },
    { k: 'conteos_7d', l: 'Conteos 7d' },
    { k: 'facturas_7d', l: 'Facturas 7d' },
    { k: 'health_score', l: 'Salud' },
  ];
  const deltas = METS.map(m => {
    const a = prev[m.k], b = last[m.k];
    if (a == null || b == null) return null;
    const d = Number(b) - Number(a);
    const pct = Number(a) !== 0 ? Math.round((d / Number(a)) * 1000) / 10 : null;
    return { ...m, a: Number(a), b: Number(b), d, pct };
  }).filter(Boolean) as any[];
  if (!deltas.length) return null;

  return (
    <div style={D.card}>
      <div style={D.h}>Evolución (últimos {Math.max(1, Math.round((Date.parse(last.fecha) - Date.parse(prev.fecha)) / 86400000))} días)</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {deltas.map((x: any) => {
          const sube = x.d > 0, baja = x.d < 0;
          const esMoney = x.k === 'total_30d';
          return (
            <div key={x.k} style={{ ...D.kpi, minWidth: 118 }}>
              <div style={D.kl}>{x.l}</div>
              <div style={{ ...D.kv, fontSize: '1rem' }}>{esMoney ? money(x.b) : Number(x.b).toLocaleString()}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: sube ? '#1A8F7A' : baja ? '#b93333' : '#9aa0a8' }}>
                {sube ? '▲' : baja ? '▼' : '—'} {x.pct != null ? `${Math.abs(x.pct)}%` : (esMoney ? money(Math.abs(x.d)) : Math.abs(x.d))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 8 }}>vs snapshot del {fmtDate(prev.fecha)} · el histórico se acumula solo (cron diario).</div>
    </div>
  );
}

/* Botón "Acceder a la cuenta como Super Admin" — pide a sacs_api un custom token
 * (account-level, sin uid) y abre la página puente en app.sacscloud.com que canjea
 * la sesión Firebase y entra al panel de la cuenta. */
function AccederCuenta({ account, uid, label }: { account: string; uid?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function acceder() {
    setBusy(true); setErr('');
    // Abrir la pestaña SÍNCRONAMENTE dentro del gesto (iOS bloquea window.open
    // tras un await); luego se le asigna la URL o se cierra si falla.
    const w = window.open('', '_blank');
    try {
      const r = await fetch('/api/crm/sacs-impersonar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uid ? { account, uid } : { account }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) { setErr(j.error || 'No se pudo generar el acceso.'); setBusy(false); if (w) w.close(); return; }
      if (w) w.location.href = j.url; else window.location.href = j.url;
      setBusy(false);
    } catch (e: any) { setErr(e?.message || 'Error'); setBusy(false); if (w) w.close(); }
  }
  return (
    <div style={{ marginTop: 12 }}>
      <button style={{ ...D.btn, background: '#6D28D9' }} disabled={busy} onClick={acceder}>
        {busy ? 'Generando acceso…' : (label || '🔓 Acceder a la cuenta como Super Admin')}
      </button>
      {err && <div style={{ color: '#b93333', fontSize: '0.76rem', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/* Usuarios de la cuenta SACS, con filtro por sucursal y orden por último acceso
 * (más reciente primero). Carga on-demand desde /api/crm/sacs-usuarios?account= */
function UsuariosSacs({ account }: { account: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [filtroSuc, setFiltroSuc] = useState('__todas');
  useEffect(() => {
    let alive = true; setD(null); setErr(''); setFiltroSuc('__todas');
    fetch('/api/crm/sacs-usuarios?account=' + encodeURIComponent(account))
      .then(r => r.json()).then(j => { if (!alive) return; if (j.error) setErr(j.error); else setD(j); })
      .catch(() => { if (alive) setErr('x'); });
    return () => { alive = false; };
  }, [account]);

  if (err) return null;
  if (!d) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando usuarios…</div>;

  const usuarios: any[] = d.usuarios || [];
  // Catálogo de sucursales presente en los usuarios (+ opción "sin sucursal").
  const sucsSet = new Set<string>();
  let haySinSuc = false;
  usuarios.forEach(u => {
    const s = u.sucursales_nombres || [];
    if (s.length) s.forEach((x: string) => sucsSet.add(x)); else haySinSuc = true;
  });
  const sucOpciones = Array.from(sucsSet).sort((a, b) => a.localeCompare(b));

  // Filtrar por sucursal seleccionada.
  const ms = (u: any) => { const t = Date.parse(u.ultimo_login || ''); return isNaN(t) ? -1 : t; };
  const filtrados = usuarios.filter(u => {
    if (filtroSuc === '__todas') return true;
    if (filtroSuc === '__sin') return !(u.sucursales_nombres && u.sucursales_nombres.length);
    return (u.sucursales_nombres || []).indexOf(filtroSuc) >= 0;
  }).sort((a, b) => ms(b) - ms(a)); // más reciente primero

  return (
    <div style={D.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...D.h, margin: 0 }}>Usuarios ({filtrados.length}{filtroSuc !== '__todas' ? ` de ${usuarios.length}` : ''})</div>
        <select value={filtroSuc} onChange={e => setFiltroSuc(e.target.value)} style={{ ...D.input, width: 'auto', marginLeft: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}>
          <option value="__todas">Todas las sucursales</option>
          {sucOpciones.map(s => <option key={s} value={s}>{s}</option>)}
          {haySinSuc && <option value="__sin">(sin sucursal asignada)</option>}
        </select>
      </div>
      {filtrados.map((u: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.82rem' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.nombre}{u.es_super ? <span style={{ ...D.badge, background: '#EDE9FE', color: '#6D28D9', marginLeft: 6 }}>Super Admin</span> : null}{u.activo === false ? <span style={{ ...D.badge, background: '#fdf2f2', color: '#b93333', marginLeft: 6 }}>inactivo</span> : null}
            </div>
            <div style={{ color: '#888', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.grupo_nombre || '(sin grupo)'}{(u.sucursales_nombres && u.sucursales_nombres.length) ? ` · 🏬 ${u.sucursales_nombres.join(', ')}` : ''}{u.email ? ` · ${u.email}` : ''}
            </div>
          </div>
          <div style={{ color: '#999', fontSize: '0.72rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {u.ultimo_login ? <>último acceso<br /><b style={{ color: '#666' }}>{fmtDate(u.ultimo_login)}</b></> : 'sin registro'}
          </div>
        </div>
      ))}
      {!filtrados.length && <div style={{ color: '#999', fontSize: '0.82rem' }}>Sin usuarios en esta sucursal.</div>}
      <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 8 }}>Ordenados por último acceso (más reciente primero). El acceso a la cuenta entra como Super Admin (botón arriba).</div>
    </div>
  );
}

/* ─────────── 👤 Contactos (multi-contacto: lista + alta + principal) ─────────── */
function TabContactos({ companyId, contactos, reload, flash }: any) {
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState<any>({ nombre: '', email: '', whatsapp: '', telefono: '', rol: '' });
  const [busy, setBusy] = useState(false);
  const sinMigracion = contactos.length > 0 && contactos[0].es_principal === undefined;

  function validar(x: any): string | null {
    if (x.email && !EMAIL_RE.test(x.email.trim())) return 'El correo no se ve válido.';
    if (x.whatsapp && metaWa(x.whatsapp).replace(/\D/g, '').length < 12) return 'El WhatsApp debe tener 10 dígitos (se guarda como +52…).';
    return null;
  }

  async function guardarEdit(c: any) {
    const v = validar(f); if (v) { alert(v); return; }
    setBusy(true);
    const upd: any = { id: c.id, nombre: f.nombre, email: f.email.trim() || null, whatsapp: f.whatsapp ? metaWa(f.whatsapp) : null, telefono: f.telefono.trim() || null };
    if (!sinMigracion) upd.rol = f.rol || null;
    const r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upd) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo guardar.'); else { setEditId(null); flash('Contacto guardado'); reload(); }
  }

  async function agregar() {
    if (!nf.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    const v = validar(nf); if (v) { alert(v); return; }
    setBusy(true);
    try {
      // Dedupe/reasignación: si ya existe un contacto con ese email, se LIGA a esta
      // empresa en lugar de duplicarlo (un contacto puede cambiar de empresa).
      if (nf.email.trim()) {
        const rs = await fetch('/api/crm/contacts?search=' + encodeURIComponent(nf.email.trim()));
        const js = await rs.json().catch(() => ({}));
        const exacto = (js.data || js.contacts || []).find((x: any) => (x.email || '').toLowerCase() === nf.email.trim().toLowerCase());
        if (exacto) {
          const r2 = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: exacto.id, company_id: companyId, whatsapp: nf.whatsapp ? metaWa(nf.whatsapp) : undefined }) });
          const j2 = await r2.json().catch(() => ({}));
          setBusy(false);
          if (!r2.ok || j2.error) { alert(j2.error || 'No se pudo ligar.'); return; }
          setAdding(false); setNf({ nombre: '', email: '', whatsapp: '', telefono: '', rol: '' });
          flash('Ese contacto ya existía — se ligó a este cliente'); reload(); return;
        }
      }
      const body: any = { nombre: nf.nombre.trim(), email: nf.email.trim() || null, whatsapp: nf.whatsapp ? metaWa(nf.whatsapp) : null, telefono: nf.telefono.trim() || null, company_id: companyId, tipo: 'cliente', lifecycle_stage: 'cliente' };
      const r = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok || j.error) { alert(j.error || 'No se pudo crear.'); return; }
      // El POST tiene lista fija de campos (ignora rol) → se guarda con un PUT aparte.
      if (!sinMigracion && nf.rol && j.id) {
        await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.id, rol: nf.rol }) }).catch(() => {});
      }
      setAdding(false); setNf({ nombre: '', email: '', whatsapp: '', telefono: '', rol: '' });
      flash('Contacto agregado'); reload();
    } catch (e: any) { setBusy(false); alert('Error: ' + (e?.message || e)); }
  }

  async function marcarPrincipal(c: any) {
    const r = await fetch('/api/crm/contacts/principal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: c.id, company_id: companyId }) });
    const j = await r.json().catch(() => ({}));
    if (j.error) alert(j.error); else { flash('Contacto principal actualizado'); reload(); }
  }
  async function quitar(c: any) {
    if (!confirmar('¿Quitar a "' + c.nombre + '" de este cliente? (el contacto no se borra, solo se desliga)')) return;
    const r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, company_id: null, es_principal: false }) });
    const j = await r.json().catch(() => ({}));
    if (j.error) alert(j.error); else { flash('Contacto desligado'); reload(); }
  }
  // confirm nativo está bien aquí (panel interno admin, no es sacs3).
  function confirmar(m: string) { return window.confirm(m); }

  return (
    <div>
      {sinMigracion && (
        <div style={{ background: '#fff3e0', color: '#a06600', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.78rem' }}>
          ⚠ Para roles y contacto principal, corre <code>scripts/migration-2026-07-contactos-rol.sql</code> en Supabase (una vez).
        </div>
      )}
      <div style={D.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={D.h}>Contactos de este cliente</div>
          <button style={{ ...D.btnG, marginLeft: 'auto' }} onClick={() => setAdding(!adding)}>{adding ? '✕ Cancelar' : '+ Agregar contacto'}</button>
        </div>

        {adding && (
          <div style={{ background: '#fafafa', border: '1px dashed #ddd', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={nf.nombre} onChange={e => setNf({ ...nf, nombre: e.target.value })} placeholder="Nombre *" style={{ ...D.input, flex: '1 1 160px' }} />
              <input value={nf.email} onChange={e => setNf({ ...nf, email: e.target.value })} placeholder="correo@…" style={{ ...D.input, flex: '1 1 180px' }} />
              <input value={nf.whatsapp} onChange={e => setNf({ ...nf, whatsapp: e.target.value })} placeholder="WhatsApp (+52…)" style={{ ...D.input, flex: '1 1 140px' }} />
              <input value={nf.telefono} onChange={e => setNf({ ...nf, telefono: e.target.value })} placeholder="Tel. fijo (opcional)" style={{ ...D.input, flex: '1 1 130px' }} />
              {!sinMigracion && (
                <select value={nf.rol} onChange={e => setNf({ ...nf, rol: e.target.value })} style={{ ...D.input, flex: '0 1 140px' }}>
                  <option value="">— rol —</option>
                  {ROLES.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              )}
            </div>
            <button style={D.btn} disabled={busy} onClick={agregar}>{busy ? '…' : 'Guardar contacto'}</button>
            <span style={{ fontSize: '0.72rem', color: '#999', marginLeft: 10 }}>Si el correo ya existe en el CRM, se liga aquí en lugar de duplicarse.</span>
          </div>
        )}

        {contactos.length === 0 && !adding && <div style={{ color: '#999', fontSize: '0.82rem' }}>Este cliente no tiene contactos — agrégale al menos uno.</div>}

        {contactos.map((c: any) => (
          <div key={c.id} style={{ borderBottom: '1px solid #f2f2f2', padding: '10px 0' }}>
            {editId === c.id ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={{ ...D.input, flex: '1 1 150px' }} />
                <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="correo" style={{ ...D.input, flex: '1 1 180px' }} />
                <input value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="+52…" style={{ ...D.input, flex: '1 1 130px' }} />
                <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} placeholder="tel fijo" style={{ ...D.input, flex: '1 1 120px' }} />
                {!sinMigracion && (
                  <select value={f.rol} onChange={e => setF({ ...f, rol: e.target.value })} style={{ ...D.input, flex: '0 1 130px' }}>
                    <option value="">— rol —</option>
                    {ROLES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )}
                <button style={{ ...D.btnG, color: '#1A8F7A', fontWeight: 800 }} disabled={busy} onClick={() => guardarEdit(c)}>{busy ? '…' : '✓ Guardar'}</button>
                <button style={D.btnG} onClick={() => setEditId(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <b>{c.nombre}{c.apellido ? ' ' + c.apellido : ''}</b>
                  {c.es_principal && <span style={{ ...D.badge, background: '#fff8e1', color: '#a06600', marginLeft: 8 }}>★ principal</span>}
                  {c.rol && <span style={{ ...D.badge, background: '#f3f4f6', color: '#555', marginLeft: 6 }}>{c.rol}</span>}
                  <div style={{ fontSize: '0.76rem', color: '#888' }}>{c.email || 'sin correo'} · {c.whatsapp || c.telefono || 'sin teléfono'}</div>
                </div>
                {c.whatsapp && <a href={waLink(c.whatsapp)} target="_blank" rel="noreferrer" style={{ ...D.btnG, textDecoration: 'none', color: '#1A8F7A' }}>💬</a>}
                <button style={D.btnG} onClick={() => { setEditId(c.id); setF({ nombre: c.nombre || '', email: c.email || '', whatsapp: c.whatsapp || '', telefono: c.telefono || '', rol: c.rol || '' }); }}>✏️ Editar</button>
                {!c.es_principal && !sinMigracion && <button style={D.btnG} onClick={() => marcarPrincipal(c)}>★ Hacer principal</button>}
                {contactos.length > 1 && <button style={{ ...D.btnG, color: '#b93333' }} onClick={() => quitar(c)}>Quitar</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── 📋 Suscripciones (lista editable + alta) ─────────── */
function TabSubs({ companyId, subs, reload, flash, principal }: any) {
  // Estado de cuenta CONSOLIDADO del cliente (todas sus subs + próximo a pagar).
  const ecUrl = typeof window !== 'undefined' ? `${window.location.origin}/estado-cuenta/cliente/${companyId}` : '';
  function abrirEstadoCuenta() {
    window.open(ecUrl, '_blank', 'noopener'); // sync (iOS) — trae "Descargar PDF"
    try { navigator.clipboard?.writeText(ecUrl); } catch { /* */ }
    flash?.('Estado de cuenta abierto · link copiado');
  }
  function enviarWhatsApp() {
    const num = String(principal?.whatsapp || '').replace(/\D/g, '');
    const msg = `Hola 👋 Te comparto tu estado de cuenta SACS con tus próximos pagos:\n${ecUrl}`;
    window.open((num ? `https://wa.me/${num}` : 'https://wa.me/') + `?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }
  const [planes, setPlanes] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState<any>({ plan_slug: '', plan_id: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', estado: 'programada' });
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<null | 'nuevo' | 'edit'>(null);
  const [pausaSub, setPausaSub] = useState<any>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);

  // Genera (o reusa) el link de cobro del periodo y lo deja listo para mandar.
  async function cobrarMP(s: any) {
    setCobrando(s.id);
    const j = await fetch('/api/crm/arr/cobrar-mercadopago', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: s.id }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo generar el link' }));
    setCobrando(null);
    if (j?.error) { alert(j.error); return; }
    const wa = String(principal?.whatsapp || '').replace(/\D/g, '');
    const texto = `Hola 👋 Te comparto el link para pagar tu ${s.nombre_plan} (${money(j.monto)}):\n${j.link}\n\nPuedes pagar con tarjeta, en OXXO o por transferencia.`;
    try { navigator.clipboard?.writeText(j.link); } catch { /* el link igual se abre abajo */ }
    // Se abre síncrono por el bloqueo de ventanas emergentes de iOS.
    window.open((wa ? 'https://wa.me/' + wa : 'https://wa.me/') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    flash(j.reusado ? 'Link vigente reusado · copiado' : `Link generado${j.modo === 'prueba' ? ' (MODO PRUEBA)' : ''} · copiado`);
    reload();
  }

  // ── Domiciliar: que se le cobre solo cada mes ──
  // Distinto del link de arriba: aquel cobra UN periodo, este deja el cargo
  // recurrente autorizado. Creada desde aquí lleva la referencia `sub:<id>`
  // desde el primer cobro, así que nunca hay que venir a vincularla a mano.
  async function domiciliarMP(s: any) {
    const correo = principal?.email || '';
    const dest = prompt(`¿Con qué correo paga en Mercado Pago?\n\nSe le va a cobrar ${money(s.precio)} cada ${s.ciclo === 'anual' ? 'año' : 'mes'} en automático, en cuanto él lo autorice.`, correo);
    if (!dest) return;
    setCobrando(s.id);
    const j = await fetch('/api/crm/arr/mp-domiciliar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: s.id, payer_email: dest }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo crear la domiciliación' }));
    setCobrando(null);
    if (j?.error) { alert(j.error); return; }
    const wa = String(principal?.whatsapp || '').replace(/\D/g, '');
    const texto = `Hola 👋 Para que ya no tengas que pagar manual cada ${s.ciclo === 'anual' ? 'año' : 'mes'}, aquí puedes autorizar el cargo automático de tu ${s.nombre_plan} (${money(j.monto)}):\n${j.link}`;
    try { navigator.clipboard?.writeText(j.link); } catch { /* el link igual se abre abajo */ }
    window.open((wa ? 'https://wa.me/' + wa : 'https://wa.me/') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    flash(j.reusado ? 'Link de domiciliación vigente reusado · copiado' : 'Domiciliación creada · falta que él la autorice');
    reload();
  }

  // ── Buscar su suscripción en Mercado Pago ──
  // Antes había que salir a la pantalla general y encontrarlo entre 38.
  const [buscandoMP, setBuscandoMP] = useState(false);
  const [mpHallado, setMpHallado] = useState<any[] | null>(null);
  async function buscarEnMP() {
    setBuscandoMP(true);
    const j = await fetch('/api/crm/arr/mp-suscripciones?company_id=' + companyId)
      .then(r => r.json()).catch(() => ({ error: 'No se pudo consultar Mercado Pago' }));
    setBuscandoMP(false);
    if (j?.error) { alert(j.error); return; }
    setMpHallado(j.data || []);
  }
  async function vincularMP(mp: any, cand: any) {
    if (!confirm(`¿Vincular "${mp.concepto}" (${money(mp.monto)}) con ${cand.nombre_plan}?\n\nSus cobros se van a registrar solos en esa suscripción.`)) return;
    const j = await fetch('/api/crm/arr/mp-suscripciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: cand.subscription_id, mp_preapproval_id: mp.mp_id, payer_email: mp.correo_pagador }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo vincular' }));
    if (j?.error) { alert(j.error); return; }
    flash('Vinculada con Mercado Pago');
    setMpHallado(null); reload();
  }

  useEffect(() => { fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlanes(j.data || j.plans || [])).catch(() => {}); }, []);

  // Elegir del catálogo llena nombre + precio del ciclo actual. Si el plan es "a
  // la medida" no pisa el precio ya capturado (no hay tarifa que aplicar).
  //
  // OJO con las dos llaves: `plan_slug` es el texto del catálogo ('personalizada')
  // y solo sirve para buscar tarifas aquí; `plan_id` es el UUID de la tabla plans
  // y es lo ÚNICO que puede viajar a subscriptions.plan_id (columna uuid). Los
  // planes del fallback y los plugins no tienen uuid → van sin plan_id.
  function aplicarPlan(p: any, destino: 'nuevo' | 'edit') {
    const set = destino === 'nuevo' ? setNf : setF;
    const cur: any = destino === 'nuevo' ? nf : f;
    const tarifa = cur.ciclo === 'mensual' ? p.precio_mensual : p.precio_anual;
    set({ ...cur, plan_slug: p.slug || '', plan_id: p.id || '', nombre_plan: p.nombre, precio: tarifa ?? cur.precio ?? '' });
    setPicker(null);
  }

  async function crear() {
    if (!nf.nombre_plan) { alert('Elige un plan.'); return; }
    setBusy(true);
    // contact_id: el drawer no lo mandaba y `normalizar()` lo deja en null, así
    // que las subs dadas de alta desde aquí nacían SIN contacto —a diferencia de
    // las que se crean en la sección de Suscripciones, que sí lo llevan—. De ahí
    // cuelgan el estado de cuenta, los recordatorios y la cobranza.
    const body: any = { company_id: companyId, contact_id: principal?.id || null, nombre_plan: nf.nombre_plan, plan_id: nf.plan_id || null, ciclo: nf.ciclo, precio: parseFloat(nf.precio) || 0, estado: nf.estado };
    if (nf.proxima_factura) body.proxima_factura = nf.proxima_factura;
    const r = await fetch('/api/crm/arr/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo crear.'); else { setAdding(false); setNf({ plan_slug: '', plan_id: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', estado: 'programada' }); flash('Suscripción creada'); reload(); }
  }
  async function guardar(s: any) {
    setBusy(true);
    const body: any = { id: s.id, estado: f.estado, ciclo: f.ciclo, nombre_plan: f.nombre_plan, precio: parseFloat(f.precio) || 0 };
    if (f.proxima_factura) body.proxima_factura = f.proxima_factura;
    body.plan_id = f.plan_id || null; // uuid o nada: si cambió a un plan sin uuid, se limpia el viejo
    const r = await fetch('/api/crm/arr/subscriptions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo guardar.'); else { setEditId(null); flash('Suscripción actualizada'); reload(); }
  }

  return (
    <div>
      <div style={D.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={D.h}>Suscripciones del cliente</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={{ ...D.btnG, background: '#1A8F7A', color: '#fff', borderColor: '#1A8F7A' }} title="Estado de cuenta con TODO lo próximo a pagar — 1 clic a PDF" onClick={abrirEstadoCuenta}>📄 Estado de cuenta</button>
            {principal?.whatsapp && <button style={{ ...D.btnG, color: '#1A8F7A', borderColor: '#bfe8df', fontWeight: 700 }} title="Enviar el link del estado de cuenta por WhatsApp" onClick={enviarWhatsApp}>💬 Enviar</button>}
            <button style={{ ...D.btnG, color: '#009ee3', borderColor: '#b9e4f7', fontWeight: 700 }}
              title="Busca si a este cliente ya le estás cobrando algo en Mercado Pago que no esté vinculado aquí"
              disabled={buscandoMP} onClick={buscarEnMP}>{buscandoMP ? '…' : '🔎 Buscar en Mercado Pago'}</button>
            <button style={D.btnG} onClick={() => setAdding(!adding)}>{adding ? '✕ Cancelar' : '+ Agregar'}</button>
          </div>
        </div>

        {mpHallado && (
          <div style={{ background: '#FAFAF8', border: '1px solid #e6e3dc', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <b style={{ fontSize: '0.85rem' }}>Cobrándose en Mercado Pago sin vincular</b>
              <button style={{ ...D.btnG, marginLeft: 'auto' }} onClick={() => setMpHallado(null)}>✕</button>
            </div>
            {mpHallado.length ? mpHallado.map((mp: any) => (
              <div key={mp.mp_id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 9, padding: 10, marginBottom: 7 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {mp.concepto || '(sin concepto)'} · {money(mp.monto)}<span style={{ color: '#999', fontWeight: 400 }}>/{mp.ciclo === 'anual' ? 'año' : 'mes'}</span>
                </div>
                <div style={{ fontSize: '0.73rem', color: '#8C8C8C', marginBottom: 6 }}>
                  {mp.correo_pagador ? 'paga ' + mp.correo_pagador + ' · ' : ''}
                  {mp.cobros_hechos != null ? mp.cobros_hechos + ' cobros · ' : ''}
                  {mp.proximo_cobro ? 'próximo ' + mp.proximo_cobro : 'sin próximo cobro'}
                </div>
                {mp.candidatos?.length ? mp.candidatos.map((c: any) => (
                  <div key={c.subscription_id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <div style={{ flex: 1, minWidth: 180, fontSize: '0.79rem' }}>
                      {c.nombre_plan} · {money(c.precio)}
                      <div style={{ fontSize: '0.7rem', color: '#8C8C8C' }}>{c.porque.join(' · ') || 'sin coincidencias claras'}</div>
                    </div>
                    <button style={{ ...D.btnG, fontWeight: 700, background: c.puntos >= 100 ? '#4B7BE5' : '#fff', color: c.puntos >= 100 ? '#fff' : '#333', borderColor: c.puntos >= 100 ? '#4B7BE5' : '#ddd' }}
                      onClick={() => vincularMP(mp, c)}>Vincular</button>
                  </div>
                )) : <div style={{ fontSize: '0.76rem', color: '#a06600' }}>Este cliente no tiene una suscripción que se le parezca. Dala de alta desde Sistema → Cobro con Mercado Pago.</div>}
              </div>
            )) : <div style={{ fontSize: '0.8rem', color: '#8C8C8C' }}>No encontré nada de este cliente sin vincular en Mercado Pago.</div>}
          </div>
        )}

        {adding && (
          <div style={{ background: '#fafafa', border: '1px dashed #ddd', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => setPicker('nuevo')} title="Abrir el catálogo completo de planes y plugins"
                style={{ ...D.input, flex: '1 1 200px', minHeight: 44, textAlign: 'left', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontWeight: nf.nombre_plan ? 700 : 400, color: nf.nombre_plan ? '#1a1a1a' : '#999' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nf.nombre_plan || '— elegir plan —'}</span>
                <span style={{ color: '#999' }}>▾</span>
              </button>
              <select value={nf.ciclo} onChange={e => { const c = e.target.value; const p = planes.find((x: any) => x.slug === nf.plan_slug); setNf({ ...nf, ciclo: c, precio: p ? ((c === 'mensual' ? p.precio_mensual : p.precio_anual) ?? nf.precio) : nf.precio }); }} style={{ ...D.input, flex: '0 1 120px' }}>
                {CICLOS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <input type="number" value={nf.precio} onChange={e => setNf({ ...nf, precio: e.target.value })} placeholder="Precio" style={{ ...D.input, flex: '0 1 110px' }} />
              <input type="date" value={nf.proxima_factura} onChange={e => setNf({ ...nf, proxima_factura: e.target.value })} style={{ ...D.input, flex: '0 1 150px' }} title="Próxima factura" />
              <select value={nf.estado} onChange={e => setNf({ ...nf, estado: e.target.value })} style={{ ...D.input, flex: '0 1 150px' }}>
                {ESTADOS_SUB.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <button style={D.btn} disabled={busy} onClick={crear}>{busy ? '…' : 'Crear suscripción'}</button>
          </div>
        )}

        {subs.length === 0 && !adding && <div style={{ color: '#999', fontSize: '0.82rem' }}>Sin suscripciones registradas.</div>}

        <div className="crm-scroll-x">
          {subs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr>{['Plan', 'Ciclo', 'Estado', 'Precio/ARR', 'Próx. factura', 'Pagos', 'Acumulado', ''].map(h => <th key={h} style={D.th}>{h}</th>)}</tr></thead>
              <tbody>
                {subs.map((s: any) => (
                  editId === s.id ? (
                    <tr key={s.id}>
                      <td style={D.td}>
                        <button onClick={() => setPicker('edit')} title="Elegir del catálogo de planes y plugins"
                          style={{ ...D.input, minWidth: 150, minHeight: 40, textAlign: 'left', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre_plan || '— elegir plan —'}</span>
                          <span style={{ color: '#999', fontWeight: 400 }}>▾</span>
                        </button>
                      </td>
                      <td style={D.td}><select value={f.ciclo} onChange={e => { const c = e.target.value; const p = planes.find((x: any) => x.slug && x.slug === f.plan_slug); setF({ ...f, ciclo: c, precio: p ? ((c === 'mensual' ? p.precio_mensual : p.precio_anual) ?? f.precio) : f.precio }); }} style={D.input}>{CICLOS.map(x => <option key={x} value={x}>{x}</option>)}</select></td>
                      <td style={D.td}><select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={D.input}>{ESTADOS_SUB.filter(x => x !== 'pausada' || f.estado === 'pausada').map(x => <option key={x} value={x}>{x}</option>)}</select></td>
                      <td style={D.td}><input type="number" value={f.precio} onChange={e => setF({ ...f, precio: e.target.value })} style={{ ...D.input, width: 100 }} /></td>
                      <td style={D.td}><input type="date" value={f.proxima_factura} onChange={e => setF({ ...f, proxima_factura: e.target.value })} style={D.input} /></td>
                      <td style={D.td} colSpan={2}></td>
                      <td style={D.td}>
                        <button style={{ ...D.btnG, color: '#1A8F7A', fontWeight: 800 }} disabled={busy} onClick={() => guardar(s)}>✓</button>{' '}
                        <button style={D.btnG} onClick={() => setEditId(null)}>✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td style={{ ...D.td, fontWeight: 700 }}>
                        {s.nombre_plan}
                        {s.mp_preapproval_id && (
                          <span title={'Se le cobra solo por Mercado Pago' + (s.mp_payer_email ? ' · ' + s.mp_payer_email : '')}
                            style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(42,181,160,.15)', color: '#1A8F7A', whiteSpace: 'nowrap' }}>auto</span>
                        )}
                        {/* Desfase: lo que MP cobra dejó de coincidir con lo que
                            dice la suscripción, así que el ARR reportado es falso.
                            Se enseña donde se ve el precio, no en un reporte aparte. */}
                        {s.mp_desfase_at && s.mp_monto_cobrado != null && (
                          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#E54B4B', whiteSpace: 'normal', marginTop: 3 }}
                            title="Mercado Pago está cobrando un monto distinto al de esta suscripción. Mientras no coincidan, el ARR reportado está mal.">
                            ⚠ MP cobra {money(s.mp_monto_cobrado)}, aquí dice {money(s.precio)}
                          </div>
                        )}
                        {s.estado === 'pausada' && s.razon_pausa && (
                          <div style={{ fontSize: '0.68rem', fontWeight: 400, color: '#a06600', whiteSpace: 'normal', marginTop: 3 }}
                            title={s.pausa_espera ? 'Esperando: ' + s.pausa_espera : undefined}>
                            ⏸ {s.razon_pausa}{s.pausa_espera ? ' · esperando: ' + s.pausa_espera : ''}
                          </div>
                        )}
                      </td>
                      <td style={D.td}>{s.ciclo}</td>
                      <td style={D.td}><EstadoBadge e={s.estado} /></td>
                      <td style={D.td}>{money(s.precio || s.arr)}</td>
                      <td style={D.td}>{s.estado === 'pausada' ? <span style={{ color: '#a06600' }}>en pausa</span> : fmtDate(s.proxima_factura)}</td>
                      <td style={D.td}>{s.pagos_realizados || 0}</td>
                      <td style={D.td}>{money(s.total_pagado)}</td>
                      <td style={D.td}>
                        {s.estado !== 'cancelada' && s.estado !== 'pausada' && (
                          <button style={{ ...D.btnG, marginRight: 4, color: '#009ee3', borderColor: '#b9e4f7', fontWeight: 700 }}
                            title="Genera el link de pago del periodo y lo deja listo para WhatsApp"
                            disabled={cobrando === s.id} onClick={() => cobrarMP(s)}>{cobrando === s.id ? '…' : '💳'}</button>
                        )}
                        {s.estado !== 'cancelada' && s.estado !== 'pausada' && s.ciclo !== 'vitalicia' && !s.mp_preapproval_id && (
                          <button style={{ ...D.btnG, marginRight: 4, color: '#4B7BE5', borderColor: '#c9d8f7', fontWeight: 700 }}
                            title="Domiciliar: crea el cargo recurrente en Mercado Pago para que se le cobre solo cada periodo"
                            disabled={cobrando === s.id} onClick={() => domiciliarMP(s)}>🔁</button>
                        )}
                        <button style={{ ...D.btnG, marginRight: 4, color: s.estado === 'pausada' ? '#1A8F7A' : '#a06600', borderColor: s.estado === 'pausada' ? '#bfe8df' : '#f0dcb8' }}
                          title={s.estado === 'pausada' ? 'Reactivar: pide desde cuándo quedó activa y cuándo se le cobra' : 'Pausar: deja de sumar ARR; pide el motivo y qué esperamos del cliente'}
                          onClick={() => setPausaSub(s)}>{s.estado === 'pausada' ? '▶' : '⏸'}</button>
                        <button style={D.btnG} onClick={() => { setEditId(s.id); setF({ nombre_plan: s.nombre_plan || '', plan_id: s.plan_id || '', plan_slug: (planes.find((p: any) => p.id && p.id === s.plan_id) || {}).slug || '', ciclo: s.ciclo || 'anual', estado: s.estado || 'activa', precio: s.precio ?? s.arr ?? '', proxima_factura: s.proxima_factura || '' }); }}>✏️</button></td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {pausaSub && (
        <PausaModal sub={pausaSub} onCancel={() => setPausaSub(null)}
          onDone={() => { setPausaSub(null); flash(pausaSub.estado === 'pausada' ? 'Licencia reactivada' : 'Licencia pausada'); reload(); }} />
      )}
      {picker && (
        <PlanPickerModal
          planes={planes}
          ciclo={(picker === 'nuevo' ? nf.ciclo : f.ciclo) || 'anual'}
          actual={picker === 'nuevo' ? nf.nombre_plan : f.nombre_plan}
          onPick={p => aplicarPlan(p, picker)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

/* ═══ Pausar / reactivar una licencia ═══
 * El cliente YA compró y pagó, solo congela (p.ej. no abrió su plaza). No es un
 * churn: la relación sigue viva, solo deja de sumar ARR mientras esté pausada.
 * Por eso lo obligatorio al pausar es el MOTIVO y el "qué esperamos de él" —no
 * una fecha inventada— y al reactivar, las dos fechas que definen el cobro. */
function PausaModal({ sub, onCancel, onDone }: { sub: any; onCancel: () => void; onDone: () => void }) {
  const reactivando = sub.estado === 'pausada';
  const [f, setF] = useState<any>({
    razon_pausa: sub.razon_pausa || '', pausa_espera: sub.pausa_espera || '', pausada_hasta: sub.pausada_hasta || '',
    fecha_inicio: sub.fecha_inicio || new Date().toISOString().slice(0, 10),
    proxima_factura: sub.proxima_factura || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function guardar() {
    if (!reactivando && !f.razon_pausa.trim()) { setErr('Escribe por qué se pausa — es lo que permite darle seguimiento.'); return; }
    if (reactivando && (!f.fecha_inicio || !f.proxima_factura)) { setErr('Indica desde cuándo quedó activa y cuándo se le cobra.'); return; }
    setBusy(true); setErr('');
    const body: any = reactivando
      ? { id: sub.id, estado: 'activa', fecha_inicio: f.fecha_inicio, proxima_factura: f.proxima_factura }
      : { id: sub.id, estado: 'pausada', razon_pausa: f.razon_pausa.trim(), pausa_espera: f.pausa_espera.trim() || null, pausada_hasta: f.pausada_hasta || null };
    const j = await fetch('/api/crm/arr/subscriptions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json()).catch(() => ({ error: 'Respuesta inválida' }));
    if (j?.error) { setErr(j.error); setBusy(false); return; }
    onDone();
  }

  const wrap = { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.5)' };
  const box = { background: '#fff', borderRadius: 16, width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 24px 60px rgba(0,0,0,.3)' };

  return (
    <div style={wrap} onClick={onCancel}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 800, color: reactivando ? '#1A8F7A' : '#a06600' }}>
            {reactivando ? '▶ Reactivar licencia' : '⏸ Pausar licencia'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 5 }}>
            {sub.nombre_plan} · {money(sub.precio || sub.arr)}
            {reactivando ? ' — vuelve a sumar al ARR.' : ' — deja de sumar al ARR y no se le cobra ni se le manda dunning. La licencia sigue siendo suya.'}
          </div>
        </div>
        <div style={{ padding: '14px 22px 0' }}>
          {reactivando ? (
            <>
              {sub.razon_pausa && <div style={{ fontSize: '0.78rem', color: '#666', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>Estuvo pausada por: <b>{sub.razon_pausa}</b>{sub.pausa_espera ? <> · esperábamos: <b>{sub.pausa_espera}</b></> : null}</div>}
              <label style={D.lbl}>Activa desde *</label>
              <input type="date" value={f.fecha_inicio} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} style={{ ...D.input, height: 44 }} />
              <label style={{ ...D.lbl, marginTop: 10 }}>Se le va a cobrar el *</label>
              <input type="date" value={f.proxima_factura} onChange={e => setF({ ...f, proxima_factura: e.target.value })} style={{ ...D.input, height: 44 }} />
            </>
          ) : (
            <>
              <label style={D.lbl}>¿Por qué se pausa? *</label>
              <input value={f.razon_pausa} onChange={e => setF({ ...f, razon_pausa: e.target.value })} autoFocus
                placeholder="Ej. Compró la licencia pero no ha abierto su plaza" style={{ ...D.input, height: 44 }} />
              <label style={{ ...D.lbl, marginTop: 10 }}>¿Qué esperamos del cliente para reactivar?</label>
              <input value={f.pausa_espera} onChange={e => setF({ ...f, pausa_espera: e.target.value })}
                placeholder="Ej. Que confirme la fecha de apertura" style={{ ...D.input, height: 44 }} />
              <label style={{ ...D.lbl, marginTop: 10 }}>Fecha estimada de reanudación (opcional)</label>
              <input type="date" value={f.pausada_hasta} onChange={e => setF({ ...f, pausada_hasta: e.target.value })} style={{ ...D.input, height: 44 }} />
            </>
          )}
          {err && <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#b93333', fontWeight: 700 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 22px 20px' }}>
          <button onClick={onCancel} style={{ ...D.btnG, minHeight: 44, padding: '0 16px' }}>Cancelar</button>
          <button onClick={guardar} disabled={busy}
            style={{ ...D.btn, minHeight: 44, padding: '0 18px', background: reactivando ? '#1A8F7A' : '#a06600' }}>
            {busy ? '…' : (reactivando ? 'Reactivar' : 'Pausar licencia')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Catálogo de planes en modal ═══
 * Antes el plan se elegía en un <select> angosto al dar de alta, y al EDITAR ni
 * siquiera había catálogo: era un campo de texto libre (de ahí los planes
 * escritos a mano que no cuadran con nada). Aquí se ve el catálogo completo,
 * separado en Planes vs Plugins, con el precio del ciclo elegido; el texto libre
 * sigue disponible abajo, pero como excepción explícita. */
function PlanPickerModal({ planes, ciclo, actual, onPick, onClose }: { planes: any[]; ciclo: string; actual?: string; onPick: (p: any) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
  const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = planes.filter(p => !q.trim() || norm(p.nombre).includes(norm(q)) || norm(p.slug).includes(norm(q)));
  const grupos: [string, any[]][] = [
    ['Planes y licencias', lista.filter(p => (p.categoria || 'plan') === 'plan')],
    ['Plugins y módulos', lista.filter(p => p.categoria === 'plugin')],
    ['Otros', lista.filter(p => p.categoria && p.categoria !== 'plan' && p.categoria !== 'plugin')],
  ];
  const precio = (p: any) => (ciclo === 'mensual' ? p.precio_mensual : p.precio_anual);
  const sufijo = ciclo === 'mensual' ? '/mes' : ciclo === 'anual' ? '/año' : '';

  const wrap = { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,.5)' };
  const box = { background: '#fff', borderRadius: 16, width: 'min(680px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,.3)' };

  return (
    <div style={wrap} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f0f1f4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.02rem', fontWeight: 800 }}>Catálogo de planes</div>
              <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>Precios mostrados por ciclo <b>{ciclo}</b>. Al elegir se llena nombre y precio.</div>
            </div>
            <button onClick={onClose} style={{ ...D.btnG, border: 'none', fontSize: '1.1rem', minWidth: 44, height: 44 }}>✕</button>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Buscar plan o plugin…" style={{ ...D.input, marginTop: 10, height: 42 }} />
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {grupos.every(([, gs]) => !gs.length) && <div style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>Ningún plan coincide con “{q}”.</div>}
          {grupos.map(([titulo, items]) => items.length ? (
            <div key={titulo} style={{ marginBottom: 16 }}>
              <div style={D.h}>{titulo} ({items.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 8 }}>
                {items.map((p: any) => {
                  const sel = actual && (norm(actual) === norm(p.nombre) || actual === p.slug);
                  const pr = precio(p);
                  return (
                    <button key={p.slug || p.nombre} onClick={() => onPick(p)}
                      style={{ textAlign: 'left', padding: '10px 12px', minHeight: 62, borderRadius: 11, cursor: 'pointer',
                        border: sel ? '1.5px solid #1A8F7A' : '1px solid #e6e7eb', background: sel ? '#f2fbf8' : '#fff' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a1a1a' }}>{p.nombre}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: 3, color: pr ? '#1A8F7A' : '#a06600', fontWeight: 700 }}>
                        {pr ? money(pr) + sufijo : 'A la medida'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null)}
        </div>
        <div style={{ borderTop: '1px solid #f0f1f4', padding: '12px 20px 16px' }}>
          <label style={D.lbl}>¿No está en el catálogo? Nombre personalizado</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Ej. Licencia especial 2026" style={{ ...D.input, flex: 1, height: 44 }}
              onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) onPick({ slug: '', nombre: custom.trim(), precio_mensual: null, precio_anual: null, a_la_medida: true }); }} />
            <button disabled={!custom.trim()} onClick={() => onPick({ slug: '', nombre: custom.trim(), precio_mensual: null, precio_anual: null, a_la_medida: true })}
              style={{ ...D.btn, minHeight: 44, padding: '0 16px', background: custom.trim() ? '#1a1a1a' : '#ccc', cursor: custom.trim() ? 'pointer' : 'not-allowed' }}>Usar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 🕓 Actividad (pagos + notas + timeline) ─────────── */
/* ─────────── 📅 Reuniones del cliente (bookings) ─────────── */
const ESTADO_REUNION: Record<string, { bg: string; color: string }> = {
  pendiente: { bg: '#fff8e1', color: '#a06600' },
  confirmada: { bg: '#e6f6f2', color: '#1A8F7A' },
  realizada: { bg: '#eef2ff', color: '#3730a3' },
  no_show: { bg: '#fdf2f2', color: '#b93333' },
  cancelada: { bg: '#f3f4f6', color: '#9aa0a8' },
  reagendada: { bg: '#f3f4f6', color: '#9aa0a8' },
};
function TabReuniones({ companyId, principal, flash }: any) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [tipos, setTipos] = useState<any[]>([]);
  useEffect(() => {
    let alive = true; setRows(null);
    fetch('/api/scheduling/reuniones?company_id=' + companyId)
      .then(r => r.json()).then(j => { if (alive) setRows(j.data || []); }).catch(() => { if (alive) setRows([]); });
    fetch('/api/scheduling/event-types?activo=true')
      .then(r => r.json()).then(j => { if (alive) setTipos(j.data || j.event_types || []); }).catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  function linkAgendar(slug: string) {
    const base = window.location.origin + '/agendar/' + slug;
    const params = new URLSearchParams();
    if (principal?.email) params.set('email', principal.email);
    if (principal?.nombre) params.set('nombre', principal.nombre);
    return params.toString() ? `${base}?${params.toString()}` : base;
  }
  function copiar(slug: string) {
    const url = linkAgendar(slug);
    // Abrir ANTES del await del clipboard para no perder el gesto (iOS).
    window.open(url, '_blank', 'noopener');
    navigator.clipboard?.writeText(url).then(() => flash('Link copiado y abierto')).catch(() => flash('Link abierto'));
  }

  if (rows === null) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando reuniones…</div>;

  const hoy = new Date().toISOString().slice(0, 10);
  const proxima = rows.find(r => r.fecha >= hoy && !['cancelada', 'reagendada', 'no_show'].includes(r.estado));
  const realizadas = rows.filter(r => r.estado === 'realizada').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={D.kpi}><div style={D.kl}>Próxima reunión</div><div style={{ ...D.kv, fontSize: '1rem' }}>{proxima ? `${fmtDate(proxima.fecha)} · ${String(proxima.hora_inicio || '').slice(0, 5)}` : '—'}</div></div>
        <div style={D.kpi}><div style={D.kl}>Realizadas</div><div style={D.kv}>{realizadas}</div></div>
        <div style={D.kpi}><div style={D.kl}>Total</div><div style={D.kv}>{rows.length}</div></div>
      </div>

      <div style={D.card}>
        <div style={D.h}>Agendar una reunión</div>
        {tipos.length === 0 ? <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin tipos de reunión activos (Configúralos en Reuniones → Config).</div> : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tipos.map((t: any) => (
              <button key={t.id} style={D.btnG} onClick={() => copiar(t.slug)}>
                📅 {t.nombre} ({t.duracion_minutos} min) · copiar link
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 8 }}>Copia el link y mándaselo al cliente{principal?.email ? ` (se pre-llena con ${principal.email})` : ''}.</div>
      </div>

      <div style={D.card}>
        <div style={D.h}>Historial ({rows.length})</div>
        {rows.length === 0 && <div style={{ color: '#999', fontSize: '0.85rem' }}>Este cliente aún no tiene reuniones agendadas.</div>}
        {rows.slice().reverse().map((r: any) => {
          const st = ESTADO_REUNION[r.estado] || ESTADO_REUNION.pendiente;
          return (
            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.83rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{r.event_types?.nombre || 'Reunión'} · {fmtDate(r.fecha)} {String(r.hora_inicio || '').slice(0, 5)}</div>
                <div style={{ color: '#888', fontSize: '0.76rem' }}>{r.invitee_nombre || ''}{r.host_nombre ? ` · con ${r.host_nombre}` : ''}</div>
              </div>
              {r.google_meet_link && <a href={r.google_meet_link} target="_blank" rel="noreferrer" style={{ ...D.badge, background: '#e6f6f2', color: '#1A8F7A', textDecoration: 'none' }}>Meet</a>}
              <span style={{ ...D.badge, background: st.bg, color: st.color }}>{r.estado}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── 🗒️ Notas — lienzo tipo Milanote (tarjetas arrastrables) ─────────── */
const IDEA_COLORES = ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#f3e8ff'];
function TabNotas({ companyId }: any) {
  const tight = useIsMobile(BP.tight); // <560px: lista apilada en vez de lienzo
  const [nodes, setNodes] = useState<any[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [delId, setDelId] = useState('');           // confirmación de borrado en 2 toques
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fileTipo = useRef<'imagen' | 'pdf'>('imagen');
  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<any>(null);                    // { id, dx, dy }
  const saveTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    let alive = true; setNodes(null);
    fetch('/api/crm/notas?company_id=' + companyId)
      .then(r => r.json()).then(j => { if (alive) setNodes(j.data || []); }).catch(() => { if (alive) setNodes([]); });
    return () => { alive = false; };
  }, [companyId]);

  const upNode = (id: string, patch: any) => setNodes(ns => (ns || []).map(n => n.id === id ? { ...n, ...patch } : n));

  async function crear(tipo: string, extra: any = {}) {
    // posición: en cascada para no encimar
    const n = (nodes || []).length;
    const body = { company_id: companyId, tipo, pos_x: 30 + (n % 5) * 60, pos_y: 30 + (n % 8) * 44, width: tipo === 'idea' ? 200 : 250, color: tipo === 'idea' ? IDEA_COLORES[n % IDEA_COLORES.length] : null, ...extra };
    const r = await fetch('/api/crm/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (j.data) setNodes(ns => [...(ns || []), j.data]);
  }
  function guardar(id: string, patch: any, debounceMs = 600) {
    upNode(id, patch);
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      fetch('/api/crm/notas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) }).catch(() => {});
    }, debounceMs);
  }
  async function eliminar(id: string) {
    if (delId !== id) { setDelId(id); setTimeout(() => setDelId(d => d === id ? '' : d), 2500); return; }
    setDelId('');
    setNodes(ns => (ns || []).filter(n => n.id !== id));
    fetch('/api/crm/notas?id=' + id, { method: 'DELETE' }).catch(() => {});
  }

  // ── drag con pointer events (sin librerías) ──
  function onDown(e: any, node: any) {
    if (e.target.closest('textarea, input, a, button, select')) return; // no arrastrar desde campos
    const rect = lienzoRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { id: node.id, dx: e.clientX - rect.left - Number(node.pos_x), dy: e.clientY - rect.top - Number(node.pos_y) };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: any) {
    if (!drag.current) return;
    const rect = lienzoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, e.clientX - rect.left - drag.current.dx);
    const y = Math.max(0, e.clientY - rect.top - drag.current.dy);
    upNode(drag.current.id, { pos_x: x, pos_y: y });
  }
  function onUp() {
    if (!drag.current) return;
    const n = (nodes || []).find(x => x.id === drag.current.id);
    drag.current = null;
    if (n) fetch('/api/crm/notas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id, pos_x: n.pos_x, pos_y: n.pos_y }) }).catch(() => {});
  }

  async function subirArchivo(f: File) {
    setSubiendo(true);
    const fd = new FormData(); fd.append('file', f);
    const r = await fetch('/api/crm/notas/upload', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setSubiendo(false);
    if (!r.ok || !j.url) { alert(j.error || 'No se pudo subir el archivo.'); return; }
    await crear(j.es_pdf ? 'pdf' : 'imagen', { archivo_url: j.url, titulo: j.name });
  }

  if (nodes === null) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando lienzo…</div>;

  const minH = Math.max(560, ...nodes.map(n => Number(n.pos_y) + 260));
  const inputMini: any = { border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit' };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button style={D.btnG} onClick={() => crear('nota', { titulo: '', contenido: '' })}>📝 Nota</button>
        <button style={D.btnG} onClick={() => crear('minuta', { titulo: 'Minuta ' + new Date().toLocaleDateString('es-MX'), metadata: { asistentes: '', acuerdos: '', pendientes: '' } })}>📋 Minuta</button>
        <button style={D.btnG} onClick={() => crear('idea', { contenido: '' })}>💡 Idea</button>
        <button style={D.btnG} disabled={subiendo} onClick={() => { fileTipo.current = 'imagen'; fileRef.current?.click(); }}>{subiendo ? 'Subiendo…' : '🖼 Imagen'}</button>
        <button style={D.btnG} disabled={subiendo} onClick={() => { fileTipo.current = 'pdf'; fileRef.current?.click(); }}>📄 PDF</button>
        <span style={{ fontSize: '0.72rem', color: '#999', marginLeft: 'auto' }}>{tight ? 'Se guarda solo' : 'Arrastra las tarjetas desde su encabezado · se guarda solo'}</span>
        <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.target.value = ''; }} />
      </div>

      {/* Lienzo (canvas con drag) o LISTA apilada bajo 560px (sin drag) */}
      <div ref={lienzoRef} onPointerMove={tight ? undefined : onMove} onPointerUp={tight ? undefined : onUp}
        style={tight
          ? { display: 'flex', flexDirection: 'column', gap: 12 }
          : { position: 'relative', minHeight: minH, background: '#fbfbfd', backgroundImage: 'radial-gradient(#e4e6ec 1px, transparent 1px)', backgroundSize: '22px 22px', border: '1px solid #ececf1', borderRadius: 14, overflow: 'hidden' }}>
        {nodes.length === 0 && (
          <div style={tight
            ? { color: '#b8bcc4', fontSize: '0.88rem', textAlign: 'center', padding: 30 }
            : { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8bcc4', fontSize: '0.9rem', textAlign: 'center', padding: 30 }}>
            Lluvia de ideas del cliente: agrega notas, la minuta de la última llamada, sube su propuesta en PDF o pega capturas.
          </div>
        )}
        {(tight ? nodes.slice().sort((a: any, b: any) => Number(a.pos_y) - Number(b.pos_y)) : nodes).map((n: any) => (
          <div key={n.id}
            style={tight
              ? { position: 'relative', width: '100%', background: n.color || '#fff', border: '1px solid ' + (n.tipo === 'minuta' ? '#d8dcf0' : '#e6e8ee'), borderRadius: 10, boxShadow: '0 1px 3px rgba(16,24,40,0.08)' }
              : { position: 'absolute', left: Number(n.pos_x), top: Number(n.pos_y), width: Number(n.width) || 250, background: n.color || (n.tipo === 'minuta' ? '#fff' : '#fff'), border: '1px solid ' + (n.tipo === 'minuta' ? '#d8dcf0' : '#e6e8ee'), borderRadius: 10, boxShadow: '0 2px 8px rgba(16,24,40,0.08)', userSelect: drag.current ? 'none' : 'auto' }}>
            {/* header = HANDLE de arrastre (solo aquí touch-action:none; el cuerpo scrollea) */}
            <div onPointerDown={tight ? undefined : (e => onDown(e, n))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px', borderBottom: n.tipo === 'idea' ? 'none' : '1px solid #f0f1f5', fontSize: '0.68rem', color: '#9aa0a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: tight ? 'default' : 'grab', touchAction: tight ? 'auto' : 'none' }}>
              {n.tipo === 'nota' ? '📝 Nota' : n.tipo === 'minuta' ? '📋 Minuta' : n.tipo === 'idea' ? '💡 Idea' : n.tipo === 'imagen' ? '🖼 Imagen' : '📄 PDF'}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }} onPointerDown={e => e.stopPropagation()}>
                {n.tipo === 'idea' && IDEA_COLORES.map(c => (
                  <span key={c} onClick={() => guardar(n.id, { color: c }, 0)} style={{ width: 28, height: 28, borderRadius: 99, background: c, border: n.color === c ? '2px solid #666' : '1px solid #ddd', cursor: 'pointer', boxSizing: 'border-box', display: 'inline-block' }} />
                ))}
                <button onClick={() => eliminar(n.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: delId === n.id ? '#b93333' : '#c4c8cf', fontWeight: 800, fontSize: '0.85rem', minWidth: 40, height: 40 }}>{delId === n.id ? '¿Seguro?' : '✕'}</button>
              </span>
            </div>
            {/* cuerpo por tipo */}
            {(n.tipo === 'nota') && (
              <div style={{ padding: '8px 10px' }}>
                <input value={n.titulo || ''} placeholder="Título" onChange={e => guardar(n.id, { titulo: e.target.value })} style={{ ...inputMini, fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }} />
                <textarea value={n.contenido || ''} placeholder="Escribe aquí…" onChange={e => guardar(n.id, { contenido: e.target.value })} rows={4} style={{ ...inputMini, fontSize: '0.8rem', resize: 'vertical', minHeight: 60 }} />
              </div>
            )}
            {(n.tipo === 'idea') && (
              <div style={{ padding: '4px 10px 10px' }}>
                <textarea value={n.contenido || ''} placeholder="Idea: ¿qué ofrecerle?" onChange={e => guardar(n.id, { contenido: e.target.value })} rows={3} style={{ ...inputMini, fontSize: '0.86rem', fontWeight: 600, resize: 'vertical', minHeight: 48 }} />
              </div>
            )}
            {(n.tipo === 'minuta') && (
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input value={n.titulo || ''} placeholder="Minuta · fecha" onChange={e => guardar(n.id, { titulo: e.target.value })} style={{ ...inputMini, fontWeight: 800, fontSize: '0.85rem' }} />
                {(['asistentes', 'acuerdos', 'pendientes'] as const).map(k => (
                  <div key={k}>
                    <div style={{ fontSize: '0.64rem', color: '#8a8f98', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                    <textarea value={n.metadata?.[k] || ''} rows={k === 'asistentes' ? 1 : 2}
                      onChange={e => guardar(n.id, { metadata: { ...(n.metadata || {}), [k]: e.target.value } })}
                      style={{ ...inputMini, fontSize: '0.78rem', resize: 'vertical', borderBottom: '1px dashed #eceef2' }} />
                  </div>
                ))}
              </div>
            )}
            {(n.tipo === 'imagen') && (
              <div>
                <img src={n.archivo_url} alt={n.titulo || 'imagen'} style={{ display: 'block', width: '100%', borderRadius: '0 0 10px 10px' }} draggable={false} />
              </div>
            )}
            {(n.tipo === 'pdf') && (
              <div style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>📄</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titulo || 'Documento.pdf'}</div>
                  <a href={n.archivo_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.74rem', color: '#1A8F7A', fontWeight: 700 }}>Abrir PDF →</a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── 🎯 Oportunidades del cliente (deals) ─────────── */
function TabOportunidades({ companyId, co, principal, flash, reload }: any) {
  const [deals, setDeals] = useState<any[] | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [busyId, setBusyId] = useState('');
  const [showNew, setShowNew] = useState(false);

  function cargar() {
    fetch('/api/crm/deals?company_id=' + companyId).then(r => r.json())
      .then(j => setDeals(Array.isArray(j) ? j : (j.deals || j.data || []))).catch(() => setDeals([]));
    fetch('/api/crm/pipelines').then(r => r.json())
      .then(pj => { const o = (pj.data || []).find((p: any) => p.tipo === 'oportunidad'); setStages(o?.stages || []); }).catch(() => {});
  }
  useEffect(() => { setDeals(null); cargar(); }, [companyId]);

  const stageBy: Record<string, any> = {}; stages.forEach(s => stageBy[s.key] = s);
  const isWon = (k: string) => /ganad/i.test(k || '');
  const isLost = (k: string) => /perdid/i.test(k || '');

  async function cambiarStage(d: any, stage: string) {
    if (!stage || stage === d.stage) return;
    setBusyId(d.id);
    const r = await fetch('/api/crm/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, stage }) });
    const j = await r.json().catch(() => ({}));
    setBusyId('');
    if (!r.ok || j.error) { alert(j.error || 'No se pudo mover la oportunidad.'); return; }
    flash(isWon(stage) ? 'Oportunidad ganada · suscripción generada' : 'Etapa actualizada'); cargar(); reload?.();
  }
  async function convertir(d: any) {
    setBusyId(d.id);
    const w = window.open('', '_blank'); // síncrono en el gesto (iOS)
    const r = await fetch('/api/crm/deals/convertir-cotizacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: d.id }) });
    const j = await r.json().catch(() => ({}));
    setBusyId('');
    if (!r.ok || !j.url) { if (w) w.close(); flash(j.error || 'No se pudo convertir a cotización.'); return; }
    if (w) w.location.href = j.url; else window.location.href = j.url;
    flash('Cotización creada'); cargar(); reload?.();
  }

  if (deals === null) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando oportunidades…</div>;

  const abiertas = deals.filter(d => !isWon(d.stage) && !isLost(d.stage));
  const pipeline = abiertas.reduce((a, d) => a + Number(d.valor_total || 0), 0);
  const ponderado = abiertas.reduce((a, d) => a + Number(d.valor_total || 0) * (Number(d.probabilidad || 0) / 100), 0);
  const ganadas = deals.filter(d => isWon(d.stage));
  const mrrGanado = ganadas.reduce((a, d) => a + Number(d.valor_mensual || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={D.kpi}><div style={D.kl}>En pipeline</div><div style={D.kv}>{money(pipeline)}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{abiertas.length} abierta{abiertas.length === 1 ? '' : 's'}</div></div>
        <div style={D.kpi}><div style={D.kl}>Ponderado</div><div style={D.kv}>{money(ponderado)}</div></div>
        <div style={D.kpi}><div style={D.kl}>Ganadas</div><div style={D.kv}>{ganadas.length}</div></div>
        <div style={D.kpi}><div style={D.kl}>MRR / ARR ganado</div><div style={D.kv}>{money(mrrGanado)}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{money(mrrGanado * 12)} ARR</div></div>
        <button style={{ ...D.btn, marginLeft: 'auto', alignSelf: 'center' }} disabled={!principal} onClick={() => setShowNew(true)}>+ Nueva oportunidad</button>
      </div>
      {!principal && <div style={{ fontSize: '0.76rem', color: '#a06600', marginBottom: 10 }}>Agrega un contacto principal (tab Contactos) para poder crear oportunidades.</div>}

      {deals.length === 0 ? (
        <div style={{ ...D.card, color: '#999', fontSize: '0.85rem' }}>Este cliente aún no tiene oportunidades.</div>
      ) : deals.map((d: any) => {
        const st = stageBy[d.stage];
        const won = isWon(d.stage), lost = isLost(d.stage);
        return (
          <div key={d.id} style={D.card}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.nombre}</div>
                {d.descripcion && <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>{d.descripcion}</div>}
                <div style={{ fontSize: '0.8rem', color: '#16181d', marginTop: 4 }}>
                  MRR <b>{money(d.valor_mensual)}</b> · ARR <b>{money(Number(d.valor_mensual || 0) * 12)}</b>
                  {d.billing_period === 'unico' ? <span style={{ color: '#6C5CE7' }}> · pago único {money(d.valor_total)}</span> : null}
                </div>
              </div>
              <span style={{ ...D.badge, background: won ? '#e6f6f2' : lost ? '#fdf2f2' : '#eef2ff', color: won ? '#1A8F7A' : lost ? '#b93333' : (st?.color || '#3730a3') }}>
                {st?.label || d.stage}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
              <select value={d.stage} disabled={busyId === d.id} onChange={e => cambiarStage(d, e.target.value)} style={{ ...D.input, width: 'auto', padding: '5px 8px', fontSize: '0.78rem' }}>
                {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              {d.quote_id
                ? <a href={`/cotizacion/${d.quote_id}`} target="_blank" rel="noreferrer" style={{ ...D.btnG, textDecoration: 'none', fontSize: '0.78rem' }}>Ver cotización →</a>
                : <button style={{ ...D.btnG, fontSize: '0.78rem' }} disabled={busyId === d.id} onClick={() => convertir(d)}>{busyId === d.id ? '…' : 'Convertir a cotización'}</button>}
              {!won && !lost && <button style={{ ...D.btn, background: '#1A8F7A', fontSize: '0.78rem' }} disabled={busyId === d.id} onClick={() => { const g = stages.find(s => isWon(s.key)); if (g) cambiarStage(d, g.key); }}>Marcar ganada</button>}
            </div>
          </div>
        );
      })}

      {showNew && principal && (
        <CreateDealModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); cargar(); reload?.(); }}
          preset={{ contact: { id: principal.id, nombre: principal.nombre, email: principal.email, company_id: companyId, companies: { nombre: co.nombre } } as any }}
        />
      )}
    </div>
  );
}

function TabActividad({ companyId, data, reload }: any) {
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  async function agregarNota() {
    if (!nota.trim()) return;
    setSaving(true);
    await fetch('/api/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'nota', titulo: nota.trim().slice(0, 140), descripcion: nota.trim(), company_id: companyId }) });
    setNota(''); setSaving(false); reload();
  }
  return (
    <div>
      <div style={D.card}>
        <div style={D.h}>Pagos ({(data.payments || []).length})</div>
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Fecha', 'Método', 'Monto', ''].map(h => <th key={h} style={D.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data.payments || []).map((p: any) => {
                const negativo = Number(p.monto) < 0;
                return (
                  <tr key={p.id} style={{ opacity: p.reembolsado ? 0.5 : 1 }}>
                    <td style={D.td}>{fmtDate(p.fecha)}</td>
                    <td style={{ ...D.td, fontSize: '0.75rem' }}>{p.metodo}{p.migrado ? ' · histórico' : ''}{p.reembolsado ? ' · reembolsado' : ''}{negativo ? ' · ajuste' : ''}</td>
                    <td style={{ ...D.td, fontWeight: 700, color: negativo ? '#b93333' : '#333' }}>{money(p.monto)}</td>
                    <td style={D.td}>
                      {!p.reembolsado && !negativo && !p.migrado && (
                        <button style={{ ...D.btnG, fontSize: '0.7rem' }} onClick={async () => { const m = window.prompt('Motivo del reembolso (opcional):', ''); if (m === null) return; const r = await fetch('/api/crm/arr/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_id: p.id, motivo: m }) }); const j = await r.json(); if (j.error) alert(j.error); else reload(); }}>Reembolsar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!(data.payments || []).length && <div style={{ color: '#999', fontSize: '0.8rem', padding: 8 }}>Sin pagos registrados.</div>}
        </div>
      </div>

      {/* ── Cobros que rebotaron ──
          Van SEPARADOS de los pagos a propósito: un cobro rechazado no es un
          pago, y mezclarlos inflaría el historial de lo que este cliente ha
          pagado. Pero tienen que verse aquí — es donde alguien mira antes de
          llamarle, y llegar sabiendo que se le rebotó la tarjeta dos veces
          cambia por completo esa llamada. */}
      {!!(data.cobros_mp || []).filter((c: any) => c.estado !== 'approved').length && (
        <div style={{ ...D.card, borderColor: '#f0c4bd' }}>
          <div style={{ ...D.h, color: '#E54B4B' }}>
            Cobros rechazados ({(data.cobros_mp || []).filter((c: any) => c.estado !== 'approved').length})
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Fecha', 'Motivo', 'Monto'].map(h => <th key={h} style={D.th}>{h}</th>)}</tr></thead>
              <tbody>
                {(data.cobros_mp || []).filter((c: any) => c.estado !== 'approved').map((c: any) => (
                  <tr key={c.id}>
                    <td style={D.td}>{fmtDate(c.fecha)}</td>
                    <td style={{ ...D.td, fontSize: '0.75rem', color: '#E54B4B', fontWeight: 600 }}>
                      {c.motivo || c.detalle_estado || 'rechazado'}
                      {c.metodo ? <span style={{ color: '#999', fontWeight: 400 }}> · {c.metodo}</span> : null}
                    </td>
                    <td style={{ ...D.td, fontWeight: 700 }}>{money(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={D.card}>
        <div style={D.h}>Timeline comercial</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={nota} onChange={e => setNota(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarNota(); }} placeholder="Escribe una nota de lo hablado con el cliente…" style={{ ...D.input, flex: 1 }} />
          <button style={{ ...D.btn, opacity: saving || !nota.trim() ? 0.5 : 1 }} onClick={agregarNota} disabled={saving || !nota.trim()}>{saving ? '…' : 'Agregar'}</button>
        </div>
        <TimelineUnificado data={data} />
      </div>
    </div>
  );
}

/* Timeline unificado: activities + pagos + cotizaciones + reuniones (lo arma
 * company360 server-side en data.timeline). Chips para filtrar por tipo. */
const TL_FILTROS = [
  { v: '', l: 'Todo' }, { v: 'nota', l: 'Notas' }, { v: 'pago', l: 'Pagos' },
  { v: 'cotizacion', l: 'Cotizaciones' }, { v: 'reunion', l: 'Reuniones' }, { v: 'tarea', l: 'Tareas' },
];
function TimelineUnificado({ data }: any) {
  const [filtro, setFiltro] = useState('');
  const items: any[] = data.timeline || [];
  const vis = filtro ? items.filter(x => x.tipo === filtro || (filtro === 'reunion' && /^demo/.test(x.tipo))) : items;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {TL_FILTROS.map(f => (
          <button key={f.v} onClick={() => setFiltro(f.v)}
            style={{ ...D.badge, cursor: 'pointer', border: '1px solid ' + (filtro === f.v ? '#1a1a1a' : '#e6e8ee'), background: filtro === f.v ? '#1a1a1a' : '#fff', color: filtro === f.v ? '#fff' : '#555' }}>
            {f.l}
          </button>
        ))}
      </div>
      {vis.map((t: any) => (
        <div key={t.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f4f4', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.95rem', lineHeight: 1.3 }}>{t.icono}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{t.titulo}{t.link ? <> · <a href={t.link} target="_blank" rel="noreferrer" style={{ color: '#1A8F7A', fontWeight: 700 }}>abrir →</a></> : null}</div>
            {t.detalle && t.detalle !== t.titulo && <div style={{ fontSize: '0.76rem', color: '#666' }}>{t.detalle}</div>}
            <div style={{ fontSize: '0.7rem', color: '#a7abb3', marginTop: 1 }}>{new Date(t.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      ))}
      {!vis.length && <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin eventos{filtro ? ' de este tipo' : ' todavía — la primera conversación se registra aquí'}.</div>}
    </div>
  );
}
