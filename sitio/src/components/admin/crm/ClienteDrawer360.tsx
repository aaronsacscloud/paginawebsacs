import { Fragment, useEffect, useRef, useState } from 'react';
import { computarSenales } from '../../../lib/crm/senales';
import NuevaOportunidadModal from './NuevaOportunidadModal';
import Etiquetas from './Etiquetas';
import { CamposFicha } from './CamposPersonalizados';
import ArchivosSuscripcion from './ArchivosSuscripcion';
import { useIsMobile, useDrawerHistory, BP } from '../../../lib/ui/mobile';
import { ESTADOS, MINUTA_CAMPOS, minutaLlena, minutaTexto, minutaVacia, normalizaEstado, siguientes } from '../../../lib/crm/reuniones';

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
  // ── Secciones de la ficha ──
  // Todas iguales: fondo blanco, contorno de color y título en ese color.
  // Morado lo que se captura y se gestiona; azul lo que solo se mira porque se
  // calcula solo. El color dice si se toca, sin tener que escribirlo.
  cardM: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  cardA: { background: '#fff', border: '1.5px solid #cfe0fa', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  // Título en negro: el color del CONTORNO ya dice si la sección se captura o
  // solo se mira, y con el título también teñido eran dos señales para lo mismo.
  hM: { fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as const,
  hA: { fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as const,
  // Campos con el lila del buscador: contorno tenue y fondo casi blanco.
  inputM: { padding: '8px 11px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.79rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fdfcff', fontFamily: 'inherit' } as const,
  hNota: { marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  h: { fontSize: '0.72rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 },
  kpi: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 14px', minWidth: 130, flex: 1 } as const,
  kl: { fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' as const },
  kv: { fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', marginTop: 2 } as const,
  input: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.83rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff' } as const,
  mi: { display: 'block', width: '100%', textAlign: 'left' as const, border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: '0.79rem', fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', fontFamily: 'inherit' } as const,
  miSub: { display: 'block', fontSize: '0.66rem', fontWeight: 400, color: '#a5a2af', marginTop: 1 } as const,
  miSep: { height: 1, background: '#f1f1f5', margin: '5px 4px' } as const,
  btnAzul: { padding: '7px 13px', border: '1.5px solid #7DA6F5', borderRadius: 9, fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#2C5FC4' } as const,
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
  // Cambiar de pestaña o cerrar con algo a medio escribir tira lo capturado sin
  // avisar. Cada sección reporta si tiene cambios pendientes.
  const [sucio, setSucio] = useState<Record<string, boolean>>({});
  const haySucio = Object.values(sucio).some(Boolean);
  const confirmarSalida = () => !haySucio || confirm('Hay cambios sin guardar en esta ficha.\n\n¿Salir y perderlos?');
  const irA = (t: any) => { if (confirmarSalida()) { setSucio({}); setTab(t); } };
  const cerrar = () => { if (confirmarSalida()) onClose(); };
  // Las inasistencias se piden al abrir la ficha, no al entrar a Reuniones: si
  // el cliente no está acudiendo a la consultoría que paga, eso tiene que verse
  // sin que nadie vaya a buscarlo.
  const [alertasReu, setAlertasReu] = useState<any[]>([]);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEd, setNombreEd] = useState('');
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
  useEffect(() => {
    let alive = true; setAlertasReu([]);
    fetch('/api/scheduling/reuniones?company_id=' + companyId)
      .then(r => r.json()).then(j => { if (alive) setAlertasReu(j.alertas || []); }).catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2600); }

  // Vacío = volver a la sugerencia automática, no dejar al cliente sin nombre.
  async function guardarNombre() {
    const v = nombreEd.trim();
    setEditandoNombre(false);
    await fetch('/api/crm/companies', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: companyId, nombre_comercial: v || null }),
    }).catch(() => {});
    flash(v ? 'Nombre de la empresa guardado' : 'Nombre restablecido');
    load();
  }

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
                  {/* El título es la EMPRESA y se puede corregir aquí mismo: el
                      nombre se sugirió partiendo la cuenta SACS, y cuando la
                      cuenta no se puede partir queda tal cual con la inicial en
                      mayúscula. Escribirlo bien es cosa de un clic. */}
                  {editandoNombre ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input autoFocus value={nombreEd} onChange={e => setNombreEd(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') guardarNombre(); if (e.key === 'Escape') setEditandoNombre(false); }}
                        placeholder="Nombre de la empresa"
                        style={{ fontSize: '1.05rem', fontWeight: 800, border: '1px solid #cfd6e4', borderRadius: 7, padding: '4px 8px', minWidth: 240 }} />
                      <button onClick={guardarNombre} style={{ ...D.btnG, color: '#1A8F7A', fontWeight: 800 }}>✓</button>
                      <button onClick={() => setEditandoNombre(false)} style={D.btnG}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {co.nombre_comercial || co.sacs_account || co.nombre}
                      <button title="Editar el nombre de la empresa"
                        onClick={() => { setNombreEd(co.nombre_comercial || ''); setEditandoNombre(true); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.55 }}>✏️</button>
                    </div>
                  )}
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
                <button aria-label={isMobile ? 'Atrás' : 'Cerrar'} onClick={cerrar} style={{ ...D.btnG, border: 'none', fontSize: '1.15rem', minWidth: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{isMobile ? '←' : '✕'}</button>
              </div>
              <div style={D.tabbar}>
                {/* Seis pestañas. Contactos entra en Info general, y "Resumen"
                    con "Actividad en SACS" se juntan: las dos contaban lo mismo
                    desde dos lados. */}
                <button style={D.tab(tab === 'info')} onClick={() => irA('info')}>Info general</button>
                <button style={D.tab(tab === 'subs')} onClick={() => irA('subs')}>Suscripciones ({subs.length})</button>
                <button style={D.tab(tab === 'oport')} onClick={() => irA('oport')}>Oportunidades</button>
                <button style={D.tab(tab === 'resumen')} onClick={() => irA('resumen')}>Actividad</button>
                <button style={D.tab(tab === 'reuniones')} onClick={() => irA('reuniones')}>
                  Reuniones
                  {alertasReu.length > 0 && <span title="Inasistencias" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: '#EF7A72', marginLeft: 5, verticalAlign: 'middle' }} />}
                </button>
                <button style={D.tab(tab === 'notas')} onClick={() => irA('notas')}>Notas</button>
              </div>
            </div>
            <div style={D.body}>
              {msg && <div style={{ background: '#e8f5e9', color: '#1b5e20', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}
              {tab === 'resumen' && alertasReu.map((a: any) => (
                <div key={a.categoria} onClick={() => irA('reuniones')}
                  style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '10px 13px', marginBottom: 12, fontSize: '0.79rem', color: '#C0554E', cursor: 'pointer', lineHeight: 1.5 }}>
                  <b style={{ color: '#8c2f28' }}>⚠️ {a.faltas} inasistencias en {String(a.tipo_nombre).toLowerCase()}.</b>{' '}
                  No está acudiendo a lo que tiene contratado — ver reuniones.
                </div>
              ))}
              {tab === 'resumen' && (<>
                <TabResumen res={res} co={co} act={act} subs={subs} acts={data?.activities || []} reload={() => { load(); onChanged(); }} />
                <TabSacs co={co} act={act} reload={() => { load(); onChanged(); }} flash={flash} />
              </>)}
              {tab === 'info' && <TabInfoGeneral co={co} companyId={companyId} subs={subs} pagos={data?.payments || []} contactos={contactos} principal={principal} sucio={sucio} setSucio={setSucio} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'subs' && <TabSubs companyId={companyId} subs={subs} reload={() => { load(); onChanged(); }} flash={flash} principal={principal} />}
              {tab === 'oport' && <TabOportunidades companyId={companyId} co={co} principal={principal} subs={subs} flash={flash} reload={() => { load(); onChanged(); }} />}
              {tab === 'reuniones' && <TabReuniones companyId={companyId} principal={principal} contactos={contactos} flash={flash} />}
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
  const [periodo, setPeriodo] = useState<'30d' | '12m'>('30d');
  const sucPlan = Number(co.sucursales || 0);
  const sucReales = act ? Number(act.sucursales || 0) : 0;
  return (
    <div>
      {/* ── Qué tan viva está la cuenta ──
          Fuera ARR, MRR, próxima factura y total pagado: eso es del CONTRATO y
          ya vive en Suscripciones y en Info general. Repetirlo aquí obligaba a
          preguntarse cuál de los dos estaba bien.
          Y se muestra lo ACTIVO contra lo dado de alta: el número solo no dice
          nada, la proporción sí — 146 usuarios de 418 con acceso significa que
          hay 272 cuentas que nadie usa. */}
      {(() => {
        const sucDet: any[] = Array.isArray(act?.sucursales_detalle) ? act.sucursales_detalle : [];
        const sucAltas = sucDet.length || sucReales;
        const sucVivas = sucDet.length ? sucDet.filter(x => x.activa).length : sucReales;
        const usTotal = Number(act?.usuarios || 0);
        const usVivos = Number(act?.usuarios_operando ?? 0);
        const t30 = Number(act?.total_30d || 0);
        const v30 = Number(act?.ventas_30d || 0);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 11, marginBottom: 14 }}>
            <div style={{ ...D.kpi, borderLeft: '3px solid #9B8CFA' }}>
              <div style={D.kl}>Sucursales activas</div>
              <div style={D.kv}>{sucAltas ? sucVivas : '—'}</div>
              <div style={{ fontSize: '0.66rem', color: '#a7abb3' }}>
                {sucAltas ? <>de {sucAltas} dadas de alta{sucAltas - sucVivas > 0 ? ` · ${sucAltas - sucVivas} sin vender` : ''}</> : 'sin datos de la cuenta'}
              </div>
            </div>
            <div style={{ ...D.kpi, borderLeft: '3px solid #9B8CFA' }}>
              <div style={D.kl}>Usuarios activos</div>
              <div style={D.kv}>{usTotal ? usVivos : '—'}</div>
              <div style={{ fontSize: '0.66rem', color: '#a7abb3' }}>
                {usTotal ? <>de {usTotal} con acceso{act?.ultimo_usuario_at ? ` · último ingreso ${fmtDate(act.ultimo_usuario_at)}` : ''}</> : 'sin datos de la cuenta'}
              </div>
            </div>
            <div style={{ ...D.kpi, borderLeft: '3px solid #4FBF95' }}>
              <div style={D.kl}>Facturación en el sistema</div>
              <div style={{ ...D.kv, color: '#1E8A63' }}>{money(periodo === '12m' ? t30 * 12 : t30)}</div>
              {/* En una cuenta de eventos el mes suelto engaña: el anual es una
                  proyección del último mes, y se dice que lo es. */}
              <div style={{ display: 'inline-flex', background: '#f3f3f6', borderRadius: 20, padding: 2, gap: 2, marginTop: 5 }}>
                {(['30d', '12m'] as const).map(k => (
                  <button key={k} onClick={() => setPeriodo(k)}
                    style={{ border: 'none', cursor: 'pointer', borderRadius: 20, padding: '2px 9px', fontSize: '0.6rem', fontWeight: 800, fontFamily: 'inherit', background: periodo === k ? '#9B8CFA' : 'transparent', color: periodo === k ? '#fff' : '#8a8a92' }}>
                    {k === '30d' ? '30 días' : '12 meses'}
                  </button>
                ))}
              </div>
              {periodo === '12m' && <div style={{ fontSize: '0.62rem', color: '#b3afbd', marginTop: 3 }}>proyectado del último mes</div>}
            </div>
            <div style={{ ...D.kpi, borderLeft: '3px solid #7DA6F5' }}>
              <div style={D.kl}>Qué tanto lo usa</div>
              <div style={D.kv}>{v30.toLocaleString('es-MX')} <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#a7abb3' }}>ventas</span></div>
              <div style={{ fontSize: '0.66rem', color: '#a7abb3' }}>
                {tend != null && <b style={{ color: tend >= 0 ? '#1E8A63' : '#C0554E' }}>{tend >= 0 ? '↑' : '↓'} {Math.abs(Math.round(tend))}%</b>}
                {tend != null ? ' vs. mes anterior' : ''}
                {act?.ultima_venta ? ` · vendió ${fmtDate(act.ultima_venta)}` : ''}
              </div>
            </div>
          </div>
        );
      })()}

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
    <div style={D.cardM}>
      <div style={D.hM}>Etapa del cliente<span style={D.hNota}>en qué momento de la relación está</span></div>
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
// Sucursales como LISTA, no como número libre: es lo que se filtra ("todos los
// de 5 o más") y con captura libre acaban conviviendo 4 y 40 por un dedazo.
// Arriba de 50 el número exacto ya no cambia ninguna decisión, así que se
// agrupa — pero NO se pisa el valor real de quien ya lo tenía (hay un cliente
// con 100): se sigue guardando y se muestra abajo.
const SUCURSALES_OPTS = Array.from({ length: 50 }, (_, i) => i + 1);
const MAS_DE_50 = 51;

const ESTADOS_MX = ['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'];

function TabInfoGeneral({ co, companyId, subs = [], pagos = [], contactos = [], principal, sucio, setSucio, reload, flash }: any) {
  const [f, setF] = useState<any>({ nombre: co.nombre || '', rfc: co.rfc || '', razon_social: co.razon_social || '', giro: co.giro || '', sitio_web: co.sitio_web || '', ciudad: co.ciudad || '', estado_geo: co.estado_geo || '', sucursales: co.sucursales || 1, estado_cuenta: co.estado_cuenta || 'activo' });
  const [saving, setSaving] = useState(false);
  // Ciudades que ya se usaron: autocompletar con lo real evita que la misma
  // ciudad se escriba de cuatro formas, sin tener que mantener un catálogo.
  const [ciudadesUsadas, setCiudadesUsadas] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/crm/companies').then(r => r.json())
      .then(j => setCiudadesUsadas(Array.from(new Set((j.companies || []).map((x: any) => String(x.ciudad || '').trim()).filter(Boolean))).sort() as string[]))
      .catch(() => {});
  }, []);
  // Nada se guarda al teclear. El guardado NO recarga la ficha: recargar
  // reconstruía el panel entero y se sentía como si te sacara de la pantalla a
  // media captura.
  const original = useRef<any>(null);
  if (!original.current) original.current = { ...f };
  const dirty = JSON.stringify(f) !== JSON.stringify(original.current);
  const [guardado, setGuardado] = useState(false);
  useEffect(() => { setSucio?.((s: any) => ({ ...s, info: dirty })); }, [dirty]);

  async function guardar() {
    if (!f.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    setSaving(true);
    const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: co.id, ...f, sucursales: parseInt(f.sucursales) || 1 }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok || j.error) { alert(j.error || 'No se pudo guardar.'); return; }
    original.current = { ...f };
    setSucio?.((s: any) => ({ ...s, info: false }));
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2600);
  }
  const barraGuardado = (dirty || guardado) ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, paddingTop: 11, borderTop: dirty ? '1px dashed #e6ddfa' : '1px solid #eaf6f1' }}>
      {dirty ? (<>
        <span style={{ fontSize: '0.74rem', color: '#5B4BD6', fontWeight: 700, flex: 1 }}>Cambios sin guardar</span>
        <button style={D.btnG} onClick={() => { setF({ ...original.current }); }}>Descartar</button>
        <button disabled={saving} onClick={guardar}
          style={{ border: 'none', borderRadius: 9, padding: '7px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </>) : (
        <span style={{ fontSize: '0.74rem', color: '#1E8A63', fontWeight: 700 }}>✓ Guardado</span>
      )}
    </div>
  ) : null;
  const campo = (label: string, k: string, ph = '') => (
    <div>
      <label style={D.lbl}>{label}</label>
      <input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph} style={D.inputM} />
    </div>
  );
  // ── Contrato: NO se captura, se deriva ──
  // El plan se tecleaba aquí Y se elegía en la cotización, y cuando no
  // coincidían nadie sabía cuál era el bueno. Derivado de las suscripciones y
  // los pagos no se puede desincronizar.
  const activas = (subs || []).filter((x: any) => x.estado === 'activa');
  const arr = activas.reduce((a: number, x: any) => a + Number(x.arr || 0), 0);
  const cobrado = (pagos || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0);
  const unicos = (subs || []).filter((x: any) => /vitalicia|unico|único/i.test(String(x.ciclo || x.nombre_plan || '')))
    .reduce((a: number, x: any) => a + Number(x.total_pagado || 0), 0);
  const renov = activas.map((x: any) => x.proxima_factura).filter(Boolean).sort()[0] || co.fecha_renovacion || null;
  const ciclos = Array.from(new Set(activas.map((x: any) => x.ciclo).filter(Boolean)));
  const planes = Array.from(new Set(activas.map((x: any) => x.nombre_plan).filter(Boolean)));

  const props = co.propiedades || {};
  const dato = (k: string, v: any, color?: string) => (
    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#9c99a6' }}>{k}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: 2, color: color || '#1a1a1a' }}>{v}</div>
    </div>
  );

  return (
    <div>
      {/* Contactos vive aquí y no en su propia pestaña: para ver el correo de
          alguien había que cambiar de pantalla. */}
      <div style={D.cardM}>
        <div style={D.hM}>Contactos<span style={D.hNota}>{(contactos || []).length} en esta cuenta</span></div>
        <TabContactos companyId={companyId} contactos={contactos} reload={reload} flash={flash} compacto />
      </div>

      <EtapaSelector co={co} reload={reload} flash={flash} />

      <div style={D.cardA}>
        <div style={D.hA}>Contrato
          <span style={D.hNota}>no se captura · se calcula de sus suscripciones y pagos</span>
        </div>
        {/* Rejilla pareja: el nombre del plan ocupaba tres renglones y empujaba
            las demás columnas. Ahora va en pastillas —una por suscripción— en
            una celda de doble ancho. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: '#9c99a6' }}>Plan</div>
            <div style={{ marginTop: 3 }}>
              {planes.length
                ? planes.map((n: any) => (
                  <span key={n} style={{ display: 'inline-block', background: '#EEECFE', color: '#4536BE', borderRadius: 20, padding: '3px 10px', fontSize: '0.66rem', fontWeight: 800, margin: '3px 4px 0 0' }}>{n}</span>
                ))
                : <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{co.plan || '—'}</span>}
            </div>
          </div>
          {dato('Ciclo', ciclos.length ? ciclos.join(' + ') : '—')}
          {dato('Sucursales', co.sucursales || 1)}
          {dato('Renovación', renov ? fmtDate(renov) : '—')}
          <div>
            <div style={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: '#9c99a6' }}>ARR · Cobrado</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 3, color: '#5B4BD6' }}>{arr > 0 ? money(arr) : '—'}</div>
            {cobrado > 0 && <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1E8A63' }}>{money(cobrado)} cobrado</div>}
            {unicos > 0 && <div style={{ fontSize: '0.68rem', color: '#1E8A63' }}>{money(unicos)} de pago único</div>}
          </div>
        </div>
      </div>

      <div style={D.cardM}>
        <div style={D.hM}>Identidad</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, marginBottom: 10, alignItems: 'start' }}>
          {campo('Nombre *', 'nombre')}
          {campo('Razón social', 'razon_social')}
          {campo('RFC', 'rfc')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, marginBottom: 10, alignItems: 'start' }}>
          {/* "Giro" en texto libre YA NO se captura aquí: lo sustituye el campo
              de lista "Giro de negocio" de arriba. Dejarlo abierto reintroducía
              el problema que se acaba de arreglar — "moda", "Moda" y "Ropa"
              volverían a ser tres giros. El valor viejo se conserva en la base
              y se muestra solo como referencia mientras quede alguno. */}
          {campo('Sitio web', 'sitio_web', 'https://…')}
          <div>
            <label style={D.lbl}>Ciudad</label>
            <input list="ciudades-usadas" value={f.ciudad} onChange={e => setF({ ...f, ciudad: e.target.value })} style={D.inputM} placeholder="empieza a escribir…" />
            <datalist id="ciudades-usadas">{(ciudadesUsadas || []).map((x: string) => <option key={x} value={x} />)}</datalist>
          </div>
          <div>
            <label style={D.lbl}>Estado</label>
            <select value={f.estado_geo} onChange={e => setF({ ...f, estado_geo: e.target.value })} style={D.inputM}>
              <option value="">—</option>
              {ESTADOS_MX.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, alignItems: 'start' }}>
          <div>
            <label style={D.lbl}>Sucursales</label>
            <select value={Number(f.sucursales) > 50 ? MAS_DE_50 : (f.sucursales || 1)} onChange={e => setF({ ...f, sucursales: e.target.value })} style={D.inputM}>
              {SUCURSALES_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
              <option value={MAS_DE_50}>Más de 50</option>
            </select>
            {Number(f.sucursales) > 50 && <div style={{ fontSize: '0.68rem', color: '#999', marginTop: 2 }}>guardado: {f.sucursales}</div>}
          </div>
          <div>
            <label style={D.lbl}>Estado de la cuenta</label>
            <select value={f.estado_cuenta} onChange={e => setF({ ...f, estado_cuenta: e.target.value })} style={D.inputM}>
              {['activo', 'prospecto', 'pausado', 'churned'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        {barraGuardado}
      </div>

      <div style={D.cardM}>
        <div style={D.hM}>Gestión interna<span style={D.hNota}>solo para el equipo · es lo que se filtra en la lista</span></div>
        <CamposFicha entidad="company" entidadId={co.id} valores={co.propiedades} onGuardado={reload} />
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
function TabContactos({ companyId, contactos, reload, flash, compacto = false }: any) {
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
      <div style={compacto ? { marginTop: -4 } : D.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          {!compacto && <div style={D.h}>Contactos de este cliente</div>}
          <button style={{ ...D.btnG, marginLeft: 'auto', border: '1.5px solid #7DA6F5', color: '#2C5FC4', fontWeight: 700 }} onClick={() => setAdding(!adding)}>{adding ? 'Cancelar' : '+ Agregar contacto'}</button>
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
// `cobro` no es columna de subscriptions: solo decide si, además de dar de alta
// la licencia, se crea la domiciliación en Mercado Pago en el mismo paso.
const NF_VACIO = { plan_slug: '', plan_id: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', estado: 'programada', cobro: 'manual', payer_email: '' };
const ES_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function TabSubs({ companyId, subs, reload, flash, principal }: any) {
  const [archivosSub, setArchivosSub] = useState<any>(null);
  // El menú se ancla con position FIXED y coordenadas del botón: la tabla vive
  // dentro de un contenedor con desplazamiento horizontal, y eso recorta
  // cualquier panel absoluto — por eso solo se veía la primera opción.
  const [menuSub, setMenuSub] = useState<{ id: string; x: number; y: number } | null>(null);
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
  const [nf, setNf] = useState<any>({ ...NF_VACIO });
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<null | 'nuevo' | 'edit'>(null);
  const [pausaSub, setPausaSub] = useState<any>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);
  // Link de domiciliación recién creado en el alta: se queda a la vista hasta
  // que lo mandas, porque el link es TODO el trámite (sin él no pasa nada).
  const [nuevoLink, setNuevoLink] = useState<any>(null);

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
    const texto = textoDomiciliacion(j.link, j.monto ?? s.precio, s.ciclo, s.nombre_plan);
    try { navigator.clipboard?.writeText(j.link); } catch { /* el link igual se abre abajo */ }
    window.open((wa ? 'https://wa.me/' + wa : 'https://wa.me/') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    flash(j.reusado ? 'Link de domiciliación vigente reusado · copiado' : 'Domiciliación creada · falta que él la autorice');
    reload();
  }

  // ── Traer los cobros que ya le hizo Mercado Pago ──
  // Primero se simula: importar a ciegas 11 meses de pagos viejos es de las
  // cosas que nadie quiere descubrir después.
  async function importarHistorial(s: any) {
    setCobrando(s.id);
    const sim = await fetch('/api/crm/arr/mp-importar-historial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: s.id }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo consultar el historial' }));
    setCobrando(null);
    if (sim?.error) { alert(sim.error); return; }
    if (!sim.por_importar) { alert(`No hay cobros nuevos que importar.\n\nEn Mercado Pago hay ${sim.cobros_en_mp} y ya están los ${sim.ya_registrados} que aplican.`); return; }
    if (!confirm(`Traer ${sim.por_importar} cobros de Mercado Pago (${money(sim.monto_total)}), de ${sim.desde} a ${sim.hasta}.\n\nSe agregan al historial de pagos de ${s.nombre_plan}. La próxima factura NO se mueve.\n\n¿Los importo?`)) return;
    setCobrando(s.id);
    const j = await fetch('/api/crm/arr/mp-importar-historial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: s.id, aplicar: true }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo importar' }));
    setCobrando(null);
    if (j?.error) { alert(j.error); return; }
    flash(`${j.importados} cobros importados · ${money(j.monto_total)}`);
    reload();
  }

  // ── Dejar de cobrarle en Mercado Pago ──
  async function cancelarMP(s: any) {
    const q = prompt(`¿Qué quieres hacer con el cobro automático de "${s.nombre_plan}" en Mercado Pago?\n\n`
      + `  cancelar  — deja de cobrarle. OJO: en Mercado Pago esto NO se deshace.\n`
      + `  pausar    — detiene el cobro y se puede reanudar.\n`
      + `  reanudar  — vuelve a cobrarle.\n\nEscribe una:`, 'pausar');
    if (!q) return;
    const accion = String(q).trim().toLowerCase();
    if (!['cancelar', 'pausar', 'reanudar'].includes(accion)) { alert('Escribe cancelar, pausar o reanudar.'); return; }
    // Detener el cargo y dar de baja al cliente no son lo mismo: se pregunta
    // aparte para no borrar ARR por querer parar una tarjeta.
    const tambien = accion === 'reanudar' ? false
      : confirm(`¿También quieres poner la suscripción como ${accion === 'cancelar' ? 'CANCELADA' : 'PAUSADA'} en el CRM?\n\nAceptar = sí, deja de contar en el ARR.\nCancelar = solo detengo el cobro en Mercado Pago y aquí la dejo igual.`);
    setCobrando(s.id);
    const j = await fetch('/api/crm/arr/mp-cancelar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: s.id, accion, tambien_crm: tambien }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo' }));
    setCobrando(null);
    if (j?.error) { alert(j.error); return; }
    flash(`Mercado Pago: ${j.estado_mp}${j.crm ? ' · en el CRM: ' + j.crm : ''}`);
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

  // Mensaje con el que se le manda el link de autorización. Igual desde el alta
  // que desde el 🔁: para el cliente es el mismo trámite.
  const textoDomiciliacion = (link: string, monto: number, ciclo: string, plan: string) =>
    `Hola 👋 Para que ya no tengas que pagar manual cada ${ciclo === 'anual' ? 'año' : 'mes'}, aquí puedes autorizar el cargo automático de tu ${plan} (${money(monto)}):\n${link}`;

  async function crear() {
    if (!nf.nombre_plan) { alert('Elige un plan.'); return; }
    const conMP = nf.cobro === 'mp';
    const correoMP = String(nf.payer_email || principal?.email || '').trim();
    // Se valida ANTES de insertar: si la domiciliación se cayera después, la sub
    // ya nació y habría que acordarse de volver por el 🔁 de su fila.
    if (conMP) {
      if (nf.ciclo === 'vitalicia') { alert('Una licencia vitalicia es un pago único: no se domicilia.'); return; }
      if (nf.estado === 'cancelada' || nf.estado === 'pausada') { alert('No se puede domiciliar una suscripción que nace cancelada o pausada.'); return; }
      if (!(parseFloat(nf.precio) > 0)) { alert('Para domiciliar hace falta el precio que se le va a cobrar cada periodo.'); return; }
      if (!ES_CORREO.test(correoMP)) { alert('Escribe el correo con el que el cliente paga en Mercado Pago.'); return; }
    }
    setBusy(true);
    // contact_id: el drawer no lo mandaba y `normalizar()` lo deja en null, así
    // que las subs dadas de alta desde aquí nacían SIN contacto —a diferencia de
    // las que se crean en la sección de Suscripciones, que sí lo llevan—. De ahí
    // cuelgan el estado de cuenta, los recordatorios y la cobranza.
    const body: any = { company_id: companyId, contact_id: principal?.id || null, nombre_plan: nf.nombre_plan, plan_id: nf.plan_id || null, ciclo: nf.ciclo, precio: parseFloat(nf.precio) || 0, estado: nf.estado };
    if (nf.proxima_factura) body.proxima_factura = nf.proxima_factura;
    const r = await fetch('/api/crm/arr/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { setBusy(false); alert(j.error || 'No se pudo crear.'); return; }

    if (conMP && j?.data?.id) {
      // Creada desde aquí lleva `external_reference: sub:<id>` desde el primer
      // cobro; la que se crea en el panel de Mercado Pago nace huérfana y hay
      // que venir a vincularla a mano.
      const d = await fetch('/api/crm/arr/mp-domiciliar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: j.data.id, payer_email: correoMP }),
      }).then(x => x.json()).catch(() => ({ error: 'No se pudo crear la domiciliación' }));
      setBusy(false);
      setAdding(false); setNf({ ...NF_VACIO });
      reload();
      if (d?.error) {
        // La licencia SÍ quedó: decirlo, o se da de alta otra creyendo que falló todo.
        alert(`La suscripción se creó, pero la domiciliación no:\n\n${d.error}\n\nPuedes reintentarla con el botón 🔁 de su fila.`);
        return;
      }
      try { navigator.clipboard?.writeText(d.link); } catch { /* el link queda a la vista abajo */ }
      setNuevoLink({ ...d, nombre_plan: body.nombre_plan, monto: d.monto ?? body.precio, ciclo: d.ciclo || body.ciclo, correo: d.correo || correoMP });
      flash('Suscripción creada · link de domiciliación copiado');
      return;
    }
    setBusy(false);
    setAdding(false); setNf({ ...NF_VACIO }); flash('Suscripción creada'); reload();
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
      {archivosSub && (
        <ArchivosSuscripcion subId={archivosSub.id} nombre={archivosSub.nombre_plan}
          onCerrar={() => setArchivosSub(null)} onCambio={() => reload()} />
      )}
      <div style={D.cardM}>
        {/* Encabezado con el destello morado y los botones en la escala del
            sistema: morado el que crea, contorno azul lo importante. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ ...D.hM, marginBottom: 0 }}>Suscripciones del cliente</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={D.btnAzul} title="Estado de cuenta con TODO lo próximo a pagar — 1 clic a PDF" onClick={abrirEstadoCuenta}>Estado de cuenta</button>
            {principal?.whatsapp && <button style={D.btnAzul} title="Enviar el link del estado de cuenta por WhatsApp" onClick={enviarWhatsApp}>Enviar por WhatsApp</button>}
            <button style={D.btnAzul}
              title="Busca si a este cliente ya le estás cobrando algo en Mercado Pago que no esté vinculado aquí"
              disabled={buscandoMP} onClick={buscarEnMP}>{buscandoMP ? '…' : 'Buscar en Mercado Pago'}</button>
            <button style={D.btn} onClick={() => setAdding(!adding)}>{adding ? 'Cancelar' : '+ Agregar'}</button>
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
              <select value={nf.ciclo} onChange={e => { const c = e.target.value; const p = planes.find((x: any) => x.slug === nf.plan_slug); setNf({ ...nf, ciclo: c, precio: p ? ((c === 'mensual' ? p.precio_mensual : p.precio_anual) ?? nf.precio) : nf.precio, cobro: c === 'vitalicia' ? 'manual' : nf.cobro }); }} style={{ ...D.input, flex: '0 1 120px' }}>
                {CICLOS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <input type="number" value={nf.precio} onChange={e => setNf({ ...nf, precio: e.target.value })} placeholder="Precio" style={{ ...D.input, flex: '0 1 110px' }} />
              <input type="date" value={nf.proxima_factura} onChange={e => setNf({ ...nf, proxima_factura: e.target.value })} style={{ ...D.input, flex: '0 1 150px' }} title="Próxima factura" />
              <select value={nf.estado} onChange={e => setNf({ ...nf, estado: e.target.value })} style={{ ...D.input, flex: '0 1 150px' }}>
                {ESTADOS_SUB.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            {/* ── Cómo se le va a cobrar ──
                Manual = le mandas el link cada periodo (💳). Automático = se crea
                la domiciliación aquí mismo y ya no hay que volver a acordarse. */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={nf.cobro} disabled={nf.ciclo === 'vitalicia'}
                onChange={e => setNf({ ...nf, cobro: e.target.value, payer_email: e.target.value === 'mp' && !nf.payer_email ? (principal?.email || '') : nf.payer_email })}
                title={nf.ciclo === 'vitalicia' ? 'Una vitalicia es un pago único: no se domicilia.' : 'Cómo se le va a cobrar cada periodo'}
                style={{ ...D.input, flex: '1 1 240px', opacity: nf.ciclo === 'vitalicia' ? 0.55 : 1 }}>
                <option value="manual">💳 Cobro manual — le mandas el link cada periodo</option>
                <option value="mp">🔁 Automático con Mercado Pago — se le cobra solo</option>
              </select>
              {nf.cobro === 'mp' && (
                <input type="email" value={nf.payer_email} onChange={e => setNf({ ...nf, payer_email: e.target.value })}
                  placeholder="correo con el que paga en Mercado Pago" style={{ ...D.input, flex: '1 1 240px' }} />
              )}
            </div>
            {nf.cobro === 'mp' && (
              <div style={{ fontSize: '0.72rem', color: '#8C8C8C', marginBottom: 8, lineHeight: 1.5 }}>
                Al crearla se genera el link de autorización y se copia listo para mandárselo. No se le cobra nada
                hasta que él lo autorice con su cuenta de Mercado Pago{nf.proxima_factura ? `, y el primer cargo sale hasta el ${fmtDate(nf.proxima_factura)}` : ''}. Solo funciona con tarjeta.
              </div>
            )}
            <button style={D.btn} disabled={busy} onClick={crear}>{busy ? '…' : (nf.cobro === 'mp' ? 'Crear y generar liga de domiciliación' : 'Crear suscripción')}</button>
          </div>
        )}

        {nuevoLink && (
          <div style={{ background: '#f2fbf8', border: '1px solid #bfe8df', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <b style={{ fontSize: '0.85rem' }}>🔁 Domiciliación creada{nuevoLink.modo === 'prueba' ? ' · MODO PRUEBA' : ''}</b>
              <button style={{ ...D.btnG, marginLeft: 'auto' }} onClick={() => setNuevoLink(null)}>✕</button>
            </div>
            <div style={{ fontSize: '0.76rem', color: '#555', marginBottom: 8, lineHeight: 1.5 }}>
              {money(nuevoLink.monto)} cada {nuevoLink.ciclo === 'anual' ? 'año' : 'mes'} a <b>{nuevoLink.correo}</b>
              {nuevoLink.arranca && nuevoLink.arranca !== 'al autorizar' ? ` · arranca el ${fmtDate(nuevoLink.arranca)}` : ' · arranca al autorizar'}.
              Falta que él la autorice: hasta entonces no se le cobra nada.
            </div>
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 8, padding: '7px 9px', fontSize: '0.72rem', color: '#4B7BE5', wordBreak: 'break-all', marginBottom: 8 }}>{nuevoLink.link}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={D.btnG} onClick={() => { try { navigator.clipboard?.writeText(nuevoLink.link); flash('Link copiado'); } catch { /* ya está a la vista */ } }}>📋 Copiar link</button>
              <button style={{ ...D.btnG, color: '#1A8F7A', borderColor: '#bfe8df', fontWeight: 700 }}
                onClick={() => {
                  const wa = String(principal?.whatsapp || '').replace(/\D/g, '');
                  const texto = textoDomiciliacion(nuevoLink.link, nuevoLink.monto, nuevoLink.ciclo, nuevoLink.nombre_plan);
                  window.open((wa ? 'https://wa.me/' + wa : 'https://wa.me/') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
                }}>💬 Enviar por WhatsApp</button>
            </div>
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
                      {/* Solo el ciclo: las etiquetas partían la celda en dos
                          y no pertenecían a esta columna. */}
                      <td style={D.td}>{s.ciclo}</td>
                      <td style={D.td}><EstadoBadge e={s.estado} /></td>
                      <td style={D.td}>{money(s.precio || s.arr)}</td>
                      <td style={D.td}>{s.estado === 'pausada' ? <span style={{ color: '#a06600' }}>en pausa</span> : fmtDate(s.proxima_factura)}</td>
                      <td style={D.td}>{s.pagos_realizados || 0}</td>
                      <td style={D.td}>{money(s.total_pagado)}</td>
                      <td style={{ ...D.td, textAlign: 'right' as const, position: 'relative' as const }}>
                        {/* Un menú en vez de siete iconos sueltos. Con siete no
                            cabían en la celda, se partían en dos renglones y
                            había que adivinar qué hacía cada dibujo. */}
                        <button style={{ ...D.btnG, padding: '5px 10px' }} title="Acciones"
                          onClick={e => {
                            e.stopPropagation();
                            if (menuSub?.id === s.id) { setMenuSub(null); return; }
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            // Si no cabe hacia abajo, se abre hacia arriba.
                            const alto = 300;
                            const y = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto) : r.bottom + 6;
                            setMenuSub({ id: s.id, x: r.right, y });
                          }}>⋮</button>
                        {menuSub?.id === s.id && (
                          <>
                            <div onClick={() => setMenuSub(null)} style={{ position: 'fixed', inset: 0, zIndex: 1400 }} />
                            <div style={{ position: 'fixed', left: (menuSub?.x ?? 0) - 254, top: menuSub?.y ?? 0, zIndex: 1401, width: 254, background: '#fff', border: '1px solid #e6e6ea', borderRadius: 11, boxShadow: '0 12px 32px rgba(16,24,40,.18)', padding: 6, textAlign: 'left' as const }}>
                              {s.estado !== 'cancelada' && s.estado !== 'pausada' && (
                                <button style={D.mi} disabled={cobrando === s.id} onClick={() => { setMenuSub(null); cobrarMP(s); }}>
                                  Generar link de cobro<small style={D.miSub}>del periodo, listo para WhatsApp</small>
                                </button>
                              )}
                              {s.estado !== 'cancelada' && s.estado !== 'pausada' && s.ciclo !== 'vitalicia' && !s.mp_preapproval_id && (
                                <button style={D.mi} disabled={cobrando === s.id} onClick={() => { setMenuSub(null); domiciliarMP(s); }}>
                                  Domiciliar en Mercado Pago<small style={D.miSub}>que se le cobre solo cada periodo</small>
                                </button>
                              )}
                              {s.mp_preapproval_id && (<>
                                <button style={D.mi} disabled={cobrando === s.id} onClick={() => { setMenuSub(null); importarHistorial(s); }}>
                                  Importar historial de cobros<small style={D.miSub}>los que Mercado Pago ya le hizo</small>
                                </button>
                                <button style={{ ...D.mi, color: '#C0554E' }} disabled={cobrando === s.id} onClick={() => { setMenuSub(null); cancelarMP(s); }}>
                                  Dejar de cobrar en Mercado Pago
                                </button>
                              </>)}
                              <div style={D.miSep} />
                              <button style={D.mi} onClick={() => { setMenuSub(null); setArchivosSub(s); }}>
                                Documentos y contratos{Array.isArray(s.archivos) && s.archivos.length ? ` (${s.archivos.length})` : ''}
                              </button>
                              <button style={D.mi} onClick={() => { setMenuSub(null); setPausaSub(s); }}>
                                {s.estado === 'pausada' ? 'Reactivar suscripción' : 'Pausar suscripción'}
                                <small style={D.miSub}>{s.estado === 'pausada' ? 'pide desde cuándo quedó activa' : 'deja de sumar ARR; pide el motivo'}</small>
                              </button>
                              <button style={D.mi} onClick={() => { setMenuSub(null); setEditId(s.id); setF({ nombre_plan: s.nombre_plan || '', plan_id: s.plan_id || '', plan_slug: (planes.find((p: any) => p.id && p.id === s.plan_id) || {}).slug || '', ciclo: s.ciclo || 'anual', estado: s.estado || 'activa', precio: s.precio ?? s.arr ?? '', proxima_factura: s.proxima_factura || '' }); }}>
                                Editar suscripción
                              </button>
                            </div>
                          </>
                        )}
                      </td>
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
// El módulo de agenda ya existía para que un prospecto reservara solo desde la
// página. Lo que faltaba es lo de DESPUÉS: si llegó, qué se acordó y dónde
// quedó la grabación. Aquí se agenda a mano (la mayoría se acuerdan por
// WhatsApp), se marca la asistencia y se levanta la minuta.
function TabReuniones({ companyId, principal, contactos, flash }: any) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [agendando, setAgendando] = useState(false);
  const [cerrando, setCerrando] = useState<any>(null);   // reunión que se está documentando
  const [verMinuta, setVerMinuta] = useState<any>(null);
  const [links, setLinks] = useState(false);

  const cargar = () => fetch('/api/scheduling/reuniones?company_id=' + companyId)
    .then(r => r.json()).then(j => { setRows(j.data || []); setAlertas(j.alertas || []); })
    .catch(() => setRows([]));
  useEffect(() => {
    let alive = true; setRows(null);
    fetch('/api/scheduling/reuniones?company_id=' + companyId)
      .then(r => r.json()).then(j => { if (alive) { setRows(j.data || []); setAlertas(j.alertas || []); } })
      .catch(() => { if (alive) setRows([]); });
    fetch('/api/scheduling/event-types?activo=true')
      // Este endpoint contesta un ARREGLO pelón, no {data:[…]}: leerlo como
      // objeto dejaba la lista vacía y sin tipos no se podía agendar nada.
      .then(r => r.json()).then(j => { if (alive) setTipos(Array.isArray(j) ? j : (j?.data || j?.event_types || [])); }).catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  async function marcar(r: any, estado: string) {
    const res = await fetch('/api/scheduling/reuniones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, estado }),
    }).then(x => x.json()).catch(() => null);
    if (!res || res.error) { flash(res?.error || 'No se pudo actualizar la reunión'); return; }
    flash(ESTADOS[estado]?.label || 'Actualizada');
    await cargar();
    // Si se presentó, lo que sigue es documentarla: se abre solo para no
    // depender de que alguien se acuerde de volver.
    if (estado === 'asistio' && r.event_types?.requiere_minuta !== false) {
      setCerrando({ ...r, estado });
    }
  }

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
  const orden = rows.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const proximas = rows.filter(r => r.fecha >= hoy && ['agendada', 'confirmada'].includes(normalizaEstado(r.estado)));
  const asistidas = rows.filter(r => normalizaEstado(r.estado) === 'asistio').length;

  return (
    <div>
      {/* La alerta va ARRIBA de todo: si el cliente no está usando la
          consultoría que paga, eso es lo primero que hay que saber al abrir. */}
      {alertas.map((a: any) => (
        <div key={a.categoria} style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '11px 13px', marginBottom: 12, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>⚠️</span>
          <div style={{ fontSize: '0.79rem', color: '#C0554E', lineHeight: 1.55 }}>
            <b style={{ color: '#8c2f28' }}>
              {a.faltas} inasistencias en {String(a.tipo_nombre).toLowerCase()}
              {a.seguidas >= a.umbral ? ` (${a.seguidas} seguidas)` : ''}.
            </b>{' '}
            No se presentó el {a.fechas.map((f: string) => fmtDate(f)).join(', el ')}. Conviene hablar con el dueño
            de la cuenta antes de la renovación.
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={D.kpi}><div style={D.kl}>Próxima reunión</div><div style={{ ...D.kv, fontSize: '1rem' }}>{proximas[0] ? `${fmtDate(proximas[0].fecha)} · ${String(proximas[0].hora_inicio || '').slice(0, 5)}` : '—'}</div></div>
        <div style={D.kpi}><div style={D.kl}>Se presentó</div><div style={D.kv}>{asistidas}</div></div>
        <div style={D.kpi}><div style={D.kl}>No se presentó</div><div style={{ ...D.kv, color: rows.filter(r => normalizaEstado(r.estado) === 'no_asistio').length ? '#C0554E' : '#1a1a1a' }}>{rows.filter(r => normalizaEstado(r.estado) === 'no_asistio').length}</div></div>
        <div style={D.kpi}><div style={D.kl}>Total</div><div style={D.kv}>{rows.length}</div></div>
      </div>

      <div style={D.cardM}>
        <div style={D.hM}>
          Reuniones
          <span style={D.hNota}>{rows.length} en total{proximas.length ? ` · ${proximas.length} por venir` : ''}</span>
          <button style={{ ...D.btn, padding: '7px 13px', fontSize: '0.77rem' }} onClick={() => setAgendando(true)}>+ Agendar reunión</button>
        </div>

        {rows.length === 0 && <div style={{ color: '#999', fontSize: '0.85rem', padding: '6px 0 10px' }}>Este cliente aún no tiene reuniones. Agenda la primera o mándale el link para que elija horario.</div>}

        {orden.map((r: any) => {
          const e = normalizaEstado(r.estado);
          const st = ESTADOS[e];
          const futura = r.fecha >= hoy;
          const [dd, mmm] = [String(r.fecha || '').slice(8, 10), fmtDate(r.fecha).split(' ')[1] || ''];
          const tono = e === 'asistio' ? { bg: '#EAF8F2', bd: '#cdeadd', tx: '#1E8A63' }
            : e === 'no_asistio' ? { bg: '#FEF0EF', bd: '#f7c9c5', tx: '#C0554E' }
            : (e === 'cancelada' || e === 'reagendada') ? { bg: '#f4f4f6', bd: '#eceaef', tx: '#8a8a92' }
            : { bg: '#faf8ff', bd: '#ede6fb', tx: '#5B4BD6' };
          return (
            <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid #f5f4f8' }}>
              <div style={{ flex: '0 0 62px', textAlign: 'center', background: tono.bg, border: `1px solid ${tono.bd}`, borderRadius: 9, padding: '5px 0' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tono.tx, lineHeight: 1 }}>{dd}</div>
                <div style={{ fontSize: '0.56rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.06em' }}>{mmm}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                  {r.asunto || r.event_types?.nombre || 'Reunión'}
                  {r.event_types?.nombre && <span style={{ fontSize: '0.58rem', fontWeight: 800, background: '#EEECFE', color: '#5B4BD6', borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>{r.event_types.nombre.replace(/^Reunión de |^Sesión de /i, '')}</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 2 }}>
                  {String(r.hora_inicio || '').slice(0, 5)}{r.hora_fin ? ` – ${String(r.hora_fin).slice(0, 5)}` : ''}
                  {r.host_nombre ? ` · ${r.host_nombre}` : ''}
                  {r.invitee_nombre ? ` · ${r.invitee_nombre}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                  {r.google_meet_link && futura && <a href={r.google_meet_link} target="_blank" rel="noreferrer" style={{ ...D.btnAzul, textDecoration: 'none', padding: '5px 11px', fontSize: '0.72rem' }}>Entrar</a>}
                  {r.grabacion_url && <a href={r.grabacion_url} target="_blank" rel="noreferrer" style={{ ...D.btnAzul, textDecoration: 'none', padding: '5px 11px', fontSize: '0.72rem' }}>▶ Ver grabación</a>}
                  {minutaLlena(r.minuta) && <button style={{ ...D.btnAzul, padding: '5px 11px', fontSize: '0.72rem' }} onClick={() => setVerMinuta(r)}>Ver minuta</button>}
                  {e === 'asistio' && !minutaLlena(r.minuta) && <button style={{ ...D.btnG, padding: '5px 11px', fontSize: '0.72rem' }} onClick={() => setCerrando(r)}>Levantar minuta</button>}
                  {(e === 'asistio' || e === 'no_asistio') && (r.grabacion_url || minutaLlena(r.minuta)) && <button style={{ ...D.btnG, padding: '5px 11px', fontSize: '0.72rem' }} onClick={() => setCerrando(r)}>Editar</button>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ ...D.badge, background: st.bg, color: st.color }}>{st.label}</span>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 7, flexWrap: 'wrap' }}>
                  {siguientes(r.estado, futura).slice(0, 3).map(sig => (
                    <button key={sig} onClick={() => marcar(r, sig)}
                      style={{ ...D.btnG, padding: '4px 9px', fontSize: '0.7rem', color: sig === 'no_asistio' ? '#C0554E' : sig === 'asistio' ? '#1E8A63' : '#555' }}>
                      {sig === 'asistio' ? 'Asistió' : sig === 'no_asistio' ? 'No llegó' : ESTADOS[sig].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* El link público sigue existiendo para cuando el cliente elige horario;
          se guarda plegado porque el 90% de las veces se agenda a mano. */}
      <div style={D.cardA}>
        <div style={D.hA}>
          Que el cliente elija horario
          <button style={{ ...D.btnG, marginLeft: 'auto', padding: '5px 11px', fontSize: '0.72rem' }} onClick={() => setLinks(v => !v)}>{links ? 'Ocultar' : 'Ver links'}</button>
        </div>
        {links && (tipos.length === 0
          ? <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin tipos de reunión activos. Configúralos en Reuniones → Tipos.</div>
          : <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tipos.map((t: any) => <button key={t.id} style={{ ...D.btnG, fontSize: '0.75rem' }} onClick={() => copiar(t.slug)}>{t.nombre} ({t.duracion_minutos} min)</button>)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 8 }}>Copia el link y mándaselo{principal?.email ? ` (se pre-llena con ${principal.email})` : ''}.</div>
          </>)}
      </div>

      {agendando && (
        <AgendarReunion companyId={companyId} tipos={tipos} principal={principal} contactos={contactos || []}
          onCerrar={() => setAgendando(false)}
          onListo={() => { setAgendando(false); cargar(); flash('Reunión agendada'); }} />
      )}
      {cerrando && (
        <MinutaReunion reunion={cerrando}
          onCerrar={() => setCerrando(null)}
          onListo={() => { setCerrando(null); cargar(); flash('Minuta guardada'); }} />
      )}
      {verMinuta && <MinutaReunion reunion={verMinuta} soloLectura onCerrar={() => setVerMinuta(null)} onListo={() => setVerMinuta(null)} />}
    </div>
  );
}

/* ── Agendar: la reunión ya se acordó por WhatsApp, aquí solo se registra ── */
function AgendarReunion({ companyId, tipos, principal, contactos, onCerrar, onListo }: any) {
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000).toISOString().slice(0, 10);
  const conCategoria = tipos.filter((t: any) => t.categoria && t.categoria !== 'otro');
  const lista = conCategoria.length ? conCategoria : tipos;
  const [tipoId, setTipoId] = useState(lista[0]?.id || '');
  const [fecha, setFecha] = useState(manana);
  const [hora, setHora] = useState('10:00');
  const [dur, setDur] = useState<number>(lista[0]?.duracion_minutos || 60);
  const [asunto, setAsunto] = useState('');
  const [meet, setMeet] = useState('');
  // Con quién fue la reunión. Por defecto el contacto principal porque es lo
  // más común, pero muchas veces se sienta el encargado de sucursal o el
  // contador: dejarlo fijo obligaría a registrar una reunión con quien no
  // estuvo.
  const [conId, setConId] = useState<string>(principal?.id || 'otro');
  const [otroNombre, setOtroNombre] = useState('');
  const [otroEmail, setOtroEmail] = useState('');
  const contacto = (contactos || []).find((c: any) => c.id === conId) || null;
  const nombreCon = conId === 'otro' ? otroNombre.trim() : [contacto?.nombre, contacto?.apellido].filter(Boolean).join(' ');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Los tipos llegan por fetch: si el modal se abre antes que la respuesta, el
  // useState inicial se queda vacío y "Agendar" reclama un tipo que sí existe.
  useEffect(() => { if (!tipoId && lista[0]) { setTipoId(lista[0].id); setDur(lista[0].duracion_minutos || 60); } }, [lista.length]);

  const elegir = (t: any) => { setTipoId(t.id); setDur(t.duracion_minutos || 60); };

  async function guardar() {
    // Decir cuál falta, no los tres: el mensaje genérico manda a buscar a ciegas.
    const falta = !tipoId ? 'Elige el tipo de reunión.' : !fecha ? 'Falta la fecha.' : !hora ? 'Falta la hora.'
      : (conId === 'otro' && !otroNombre.trim()) ? 'Escribe con quién fue la reunión.' : '';
    if (falta) { setError(falta); return; }
    setGuardando(true); setError('');
    const r = await fetch('/api/scheduling/reuniones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type_id: tipoId, fecha, hora_inicio: hora, duracion_minutos: dur,
        company_id: companyId,
        contact_id: conId === 'otro' ? null : conId,
        invitee_nombre: nombreCon || null,
        invitee_email: (conId === 'otro' ? otroEmail.trim() : contacto?.email) || null,
        asunto: asunto || null, google_meet_link: meet || null,
      }),
    }).then(x => x.json()).catch(() => null);
    setGuardando(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo agendar.'); return; }
    onListo();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 430, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Agendar reunión</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={{ ...D.lbl, textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '.05em' }}>Tipo de reunión</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {lista.length === 0 && <div style={{ fontSize: '0.76rem', color: '#C0554E' }}>No hay tipos de reunión activos. Créalos en Reuniones → Tipos.</div>}
            {lista.map((t: any) => (
              <button key={t.id} onClick={() => elegir(t)}
                style={{ border: '1.5px solid', borderColor: tipoId === t.id ? '#9B8CFA' : '#e2e2e8', background: tipoId === t.id ? '#9B8CFA' : '#fff', color: tipoId === t.id ? '#fff' : '#555', borderRadius: 20, padding: '5px 12px', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t.nombre.replace(/^Reunión de |^Sesión de /i, '')}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
            <div><div style={D.lbl}>Fecha</div><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={D.inputM} /></div>
            <div><div style={D.lbl}>Hora</div><input type="time" value={hora} onChange={e => setHora(e.target.value)} style={D.inputM} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
            <div><div style={D.lbl}>Duración</div>
              <select value={dur} onChange={e => setDur(Number(e.target.value))} style={D.inputM}>
                {[15, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n} min</option>)}
              </select>
            </div>
            <div><div style={D.lbl}>Con quién</div>
              <select value={conId} onChange={e => setConId(e.target.value)} style={D.inputM}>
                {(contactos || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{[c.nombre, c.apellido].filter(Boolean).join(' ')}{c.puesto ? ` · ${c.puesto}` : ''}</option>
                ))}
                <option value="otro">Otra persona…</option>
              </select>
            </div>
          </div>
          {conId === 'otro' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
              <div><div style={D.lbl}>Nombre</div><input value={otroNombre} onChange={e => setOtroNombre(e.target.value)} placeholder="Quién estuvo en la reunión" style={D.inputM} /></div>
              <div><div style={D.lbl}>Correo (opcional)</div><input value={otroEmail} onChange={e => setOtroEmail(e.target.value)} placeholder="correo@empresa.com" style={D.inputM} /></div>
            </div>
          )}
          <div style={{ marginBottom: 10 }}><div style={D.lbl}>Asunto</div>
            <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Revisión de avance" style={D.inputM} /></div>
          <div style={{ marginBottom: 12 }}><div style={D.lbl}>Liga de la reunión (opcional)</div>
            <input value={meet} onChange={e => setMeet(e.target.value)} placeholder="https://meet.google.com/…" style={D.inputM} /></div>

          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ ...D.btn, opacity: guardando ? .6 : 1 }}>{guardando ? 'Agendando…' : 'Agendar'}</button>
            <button onClick={onCerrar} style={D.btnG}>Cancelar</button>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 9, lineHeight: 1.45 }}>
            Queda como agendada y sin correo al cliente: esta pantalla registra lo que ya se acordó, no le pide que confirme.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Minuta y grabación ── */
function MinutaReunion({ reunion, soloLectura, onCerrar, onListo }: any) {
  const [m, setM] = useState<Record<string, string>>(() => ({ ...minutaVacia(), ...(reunion.minuta || {}) }));
  const [url, setUrl] = useState(reunion.grabacion_url || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setGuardando(true); setError('');
    const r = await fetch('/api/scheduling/reuniones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reunion.id, minuta: m, grabacion_url: url }),
    }).then(x => x.json()).catch(() => null);
    setGuardando(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo guardar.'); return; }
    onListo();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 470, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>
            {soloLectura ? 'Minuta' : 'Documentar la reunión'}
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#7a6fc9' }}>{reunion.event_types?.nombre || 'Reunión'} · {fmtDate(reunion.fecha)}</span>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ padding: '13px 17px', overflowY: 'auto', flex: 1 }}>
          <div style={D.lbl}>Liga de la grabación</div>
          {soloLectura
            ? <div style={{ fontSize: '0.79rem', marginBottom: 12 }}>{url ? <a href={url} target="_blank" rel="noreferrer" style={{ color: '#2C5FC4' }}>{url}</a> : <span style={{ color: '#a5a2af' }}>Sin grabación</span>}</div>
            : <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/…" style={{ ...D.inputM, marginBottom: 12 }} />}

          <div style={{ background: '#fbfaff', border: '1px solid #ede6fb', borderRadius: 9, padding: '11px 12px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#5B4BD6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Minuta</div>
            {MINUTA_CAMPOS.map(c => (
              <div key={c.k} style={{ marginTop: 9 }}>
                <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#3f3b4d' }}>{c.label}</div>
                {soloLectura
                  ? <div style={{ fontSize: '0.78rem', color: m[c.k] ? '#333' : '#a5a2af', whiteSpace: 'pre-wrap', marginTop: 3 }}>{m[c.k] || '—'}</div>
                  : <textarea value={m[c.k] || ''} onChange={e => setM(v => ({ ...v, [c.k]: e.target.value }))}
                      placeholder={c.hint} rows={2}
                      style={{ ...D.inputM, marginTop: 3, resize: 'vertical', fontFamily: 'inherit', background: '#fff' }} />}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 17px 15px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!soloLectura && <button onClick={guardar} disabled={guardando} style={{ ...D.btn, opacity: guardando ? .6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar minuta'}</button>}
          <button onClick={() => { navigator.clipboard?.writeText(minutaTexto({ ...reunion, minuta: m, grabacion_url: url })); }} style={D.btnG}>Copiar como texto</button>
          <button onClick={onCerrar} style={{ ...D.btnG, marginLeft: 'auto' }}>{soloLectura ? 'Cerrar' : 'Después'}</button>
          {error && <div style={{ fontSize: '0.73rem', color: '#C0554E' }}>{error}</div>}
        </div>
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
function TabOportunidades({ companyId, co, principal, subs = [], flash, reload }: any) {
  const senales = computarSenales(co, (subs || []).find((s: any) => s.estado === 'activa'));
  const [deals, setDeals] = useState<any[] | null>(null);
  const [verTodasSenales, setVerTodasSenales] = useState(false);
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
    // Ganar desde aquí también avisa si el registro todavía no es cliente: el
    // cierre crea un cliente nuevo, y eso se confirma, no se descubre después.
    if (isWon(stage)) {
      try {
        const p = await fetch(`/api/crm/deals/cierre-preview?deal_id=${d.id}`).then(r => r.json());
        if (p && !p.error && p.convierte_lead) {
          const ok = confirm([`“${p.cliente}” todavía no es cliente: al ganar esta oportunidad se va a CONVERTIR.`, '', 'Esto es lo que va a pasar:', ...(p.pasos || []).map((x: string) => '· ' + x), '', '¿Confirmas?'].join('\n'));
          if (!ok) return;
        }
      } catch { /* si el preview falla, no se bloquea el cierre */ }
    }
    // Perder exige motivo (lo valida el servidor): se pregunta antes para no
    // chocar contra un 400 y perder el clic.
    let motivo: string | undefined;
    if (isLost(stage)) {
      const m = prompt(`¿Por qué se perdió "${d.nombre}"?\n\nSugeridos: precio · se fue con competidor · no era el momento · falta una función · no contestó · presupuesto`, '');
      if (m === null) return;
      if (!m.trim()) { alert('Sin motivo no se puede marcar perdida.'); return; }
      motivo = m.trim();
    }
    setBusyId(d.id);
    const r = await fetch('/api/crm/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, stage, ...(motivo ? { motivo_perdida: motivo } : {}) }) });
    const j = await r.json().catch(() => ({}));
    setBusyId('');
    if (!r.ok || j.error) { alert(j.error || 'No se pudo mover la oportunidad.'); return; }
    // Se dice lo que de verdad quedó creado, no lo que se supone que pasa.
    const c = j?.cierre;
    const hechos = [c?.cliente_creado && 'cliente creado', c?.sub_creada && 'suscripción generada', c?.unico_creado && 'pago único registrado'].filter(Boolean).join(' · ');
    flash(isWon(stage) ? (hechos ? 'Ganada · ' + hechos : 'Oportunidad ganada') + (c?.avisos?.length ? ' · ⚠ ' + c.avisos[0] : '') : 'Etapa actualizada');
    cargar(); reload?.();
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
  // Un pago único no es MRR. Sumarlos juntos hacía que una implementación de
  // $80,000 se leyera como recurrencia que no existe.
  const mrrDe = (d: any) => Number(d.mrr ?? d.valor_mensual ?? 0);
  const unicoDe = (d: any) => Number(d.valor_unico ?? (d.billing_period === 'unico' ? d.valor_total : 0) ?? 0);
  const mrrGanado = ganadas.reduce((a, d) => a + mrrDe(d), 0);
  const unicoGanado = ganadas.reduce((a, d) => a + unicoDe(d), 0);
  // ── Cuántas se pagan y cuántas se rechazan ──
  // Sobre las RESUELTAS: las abiertas todavía no ganaron ni perdieron y
  // meterlas hundiría los dos porcentajes sin que haya pasado nada.
  const perdidas = deals.filter(d => isLost(d.stage));
  const resueltas = ganadas.length + perdidas.length;
  const pctGana = resueltas ? Math.round((ganadas.length / resueltas) * 100) : 0;
  const pctPierde = resueltas ? 100 - pctGana : 0;
  const montoPerdido = perdidas.reduce((a, d) => a + Number(d.valor_total || 0), 0);

  return (
    <div>
      {/* El botón encabeza la pestaña, no compite con las tarjetas: metido
          entre ellas se leía como una más y quedaba a distinta altura. */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ ...D.hM, marginBottom: 0, flex: 1 }}>Oportunidades del cliente</div>
        <button style={D.btn} onClick={() => setShowNew(true)}>+ Nueva oportunidad</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'stretch' }}>
        <div style={{ ...D.kpi, borderLeft: '3px solid #7DA6F5' }}><div style={D.kl}>En pipeline</div><div style={D.kv}>{money(pipeline)}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{abiertas.length} abierta{abiertas.length === 1 ? '' : 's'}</div></div>
        <div style={{ ...D.kpi, borderLeft: '3px solid #4FBF95' }}><div style={D.kl}>MRR / ARR ganado</div><div style={{ ...D.kv, color: '#1E8A63' }}>{money(mrrGanado)}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{money(mrrGanado * 12)} ARR</div></div>
        <div style={{ ...D.kpi, borderLeft: '3px solid #4FBF95' }}><div style={D.kl}>Pago único ganado</div><div style={{ ...D.kv, color: '#1E8A63' }}>{money(unicoGanado)}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>no suma al ARR</div></div>
        <div style={{ ...D.kpi, borderLeft: '3px solid #9B8CFA' }}><div style={D.kl}>Se pagan</div><div style={D.kv}>{resueltas ? pctGana + '%' : '—'}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{ganadas.length} de {resueltas} resueltas</div></div>
        <div style={{ ...D.kpi, borderLeft: '3px solid #EF7A72' }}><div style={D.kl}>Rechazadas</div><div style={{ ...D.kv, color: resueltas && pctPierde > 0 ? '#C0554E' : '#1a1a1a' }}>{resueltas ? pctPierde + '%' : '—'}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{perdidas.length}{montoPerdido > 0 ? ' · ' + money(montoPerdido) : ''}</div></div>
      </div>

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
                  MRR <b>{money(mrrDe(d))}</b> · ARR <b>{money(mrrDe(d) * 12)}</b>
                  {unicoDe(d) > 0 ? <span style={{ color: '#6C5CE7' }}> · pago único {money(unicoDe(d))}</span> : null}
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

      {/* El alta completa (catálogo, personalizado, descuentos, MRR/único) ya
          cuelga del cliente: por eso no hace falta contacto principal. */}
      {showNew && (
        <NuevaOportunidadModal
          companyIdInicial={companyId}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); cargar(); reload?.(); }}
        />
      )}
      {/* ── Qué venderle y atender ──
          Vive en Oportunidades y no en Actividad: las señales salen del uso
          real de la cuenta y todas terminan en lo mismo —venderle algo o
          atenderlo—. Van DEBAJO de las oportunidades ya abiertas: primero lo
          que está en curso, después lo que podría abrirse.
          Si no hay señales el bloque no aparece: una tarjeta que dice "sin
          señales" ocupa lo mismo que una con contenido y no enseña nada. */}
      {senales.length > 0 && (
        <div style={D.cardM}>
          <div style={D.hM}>Qué venderle y atender<span style={D.hNota}>del uso real de su cuenta en SACS</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(verTodasSenales ? senales : senales.slice(0, 2)).map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: s.nivel === 'riesgo' ? '#fdf2f2' : '#f0f7f4', border: '1px solid ' + (s.nivel === 'riesgo' ? '#f7d7d7' : '#d6ebe2') }}>
                <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>{s.nivel === 'riesgo' ? '⚠️' : '📈'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: 700, color: s.nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{s.titulo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 1 }}>{s.detalle}</div>
                  <div style={{ fontSize: '0.78rem', color: '#16181d', marginTop: 3 }}><b>Acción:</b> {s.accion}</div>
                </div>
              </div>
            ))}
            {/* Con cuatro o más, la sección empujaba la lista de oportunidades
                fuera de la pantalla. Son contexto para leer, no una lista para
                recorrer. */}
            {senales.length > 2 && (
              <button onClick={() => setVerTodasSenales(v => !v)}
                style={{ width: '100%', border: '1px dashed #ddd6fb', background: '#faf8ff', borderRadius: 10, padding: 9, fontSize: '0.76rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
                {verTodasSenales ? 'Ver menos' : `Ver ${senales.length - 2} señal${senales.length - 2 === 1 ? '' : 'es'} más`}
              </button>
            )}
          </div>
        </div>
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
