/**
 * CHURN · el caso, que es donde se trabaja el rescate.
 *
 * Arriba el bloque «Rescate»: en qué etapa va, qué se pactó, cuántos días le
 * quedan y —lo que de verdad decide— si está usando el sistema. Abajo, la
 * línea de tiempo, que es la MISMA de la ficha 360: el rescate se lee con todo
 * lo que ya pasó con ese cliente, no en una burbuja aparte.
 *
 * Las transiciones piden lo que la etapa destino exige y NO más. El servidor
 * valida igual: aquí solo se evita el viaje en balde y se explica el porqué.
 */
import { Suspense, useEffect, useState } from 'react';
import { lazySeguro } from '../../../lib/ui/lazySeguro';
import { useIsMobile, useDrawerHistory } from '../../../lib/ui/mobile';
/* La ficha del cliente entera, reusada tal cual: cotizaciones, soporte,
   reuniones y actividad se ven aquí exactamente como en Clientes. */
const ClienteDrawer360 = lazySeguro(() => import('./ClienteDrawer360'));
import { ETAPAS, ETAPA, MOTIVOS, MOTIVO, diasDeGracia, saludDeGracia, modulosVivos, compararUso, veredictoRescate, type Etapa } from '../../../lib/crm/churn.reglas';
import { confirmar } from '../../../lib/ui/confirmar';

const dinero = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

/* Plantillas de gracia. Salen de lo que MIDIÓ el módulo: el 65% del MRR se
   fue por servicio, no por precio — así que el primer acuerdo que se ofrece
   arregla el soporte, no regala meses. */
const PLANTILLAS = [
  { l: '30 días con soporte dedicado', dias: 30, nota: 'Acompañamiento directo para resolver lo que quedó mal.' },
  { l: '60 días al 50%', dias: 60, nota: 'Descuento mientras se recupera la confianza.' },
  { l: '30 días de cortesía', dias: 30, nota: 'Acceso completo sin costo para que vuelva a probarlo.' },
];

export default function ChurnCaso({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio: () => void }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>({});
  const [pidiendo, setPidiendo] = useState<Etapa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toque, setToque] = useState<any>({ tipo: 'llamada', texto: '', proximo_paso: '', proximo_paso_at: '' });
  /* En qué pestaña estás. Abre en «Resumen»: al entrar a un caso lo primero
     que se necesita es saber quién es, desde cuándo y por qué se fue. */
  const [vista, setVista] = useState<'resumen' | 'conciliacion' | 'seguimiento' | 'cliente'>('resumen');
  const [extendiendo, setExtendiendo] = useState(false);
  const esMovil = useIsMobile();
  /* En el teléfono, «atrás» tiene que cerrar la hoja, no sacarte de la
     sección: es el estándar de las 17 pantallas del CRM móvil. */
  useDrawerHistory(esMovil, onCerrar);

  async function registrar(cuerpo: any) {
    setGuardando(true); setError('');
    const r = await fetch('/api/crm/churn/caso', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...cuerpo }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setError(r.error); return false; }
    setToque({ tipo: 'llamada', texto: '', proximo_paso: '', proximo_paso_at: '' });
    setExtendiendo(false); cargar(); onCambio(); return true;
  }

  const cargar = () => fetch(`/api/crm/churn/caso?id=${id}`).then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, [id]);
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', t);
    return () => document.removeEventListener('keydown', t);
  }, [onCerrar]);

  const caso = d?.caso, emp = caso?.companies || {};
  const quedan = caso ? diasDeGracia(caso) : null;
  const salud = caso ? saludDeGracia(caso, emp) : null;

  async function mover(destino: Etapa, extra: any = {}) {
    setGuardando(true); setError('');
    const r = await fetch('/api/crm/churn/caso', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, etapa: destino, ...extra }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setError(r.error); return; }
    // El desbloqueo de la cuenta es un hecho aparte: si falló, la etapa SÍ
    // cambió y hay que decirlo, no esconderlo tras un "listo".
    if (r?.acceso && !r.acceso.ok) setError(`La etapa cambió, pero no se pudo devolver el acceso en SACS: ${r.acceso.error}`);
    setPidiendo(null); setForm({}); cargar(); onCambio();
  }

  const Campo = ({ l, children }: any) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>{l}</span>
      {children}
    </label>
  );
  const inp: any = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e4e9', borderRadius: 9,
    padding: '9px 11px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' };

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(12,11,18,.55)', zIndex: 900 }} />
      {/* `crm-sheet` es lo que engancha el modo oscuro del CRM: sin esa clase,
          el caso salía como un panel BLANCO a pantalla completa encima de una
          app en oscuro. Y en el teléfono sube desde abajo, no entra por la
          derecha: por la derecha es un gesto de escritorio. */}
      <div className="crm-sheet" role="dialog" aria-modal="true" aria-label="Caso de churn" style={esMovil ? {
        position: 'fixed', left: 0, right: 0, bottom: 0, top: 'auto', height: '94dvh', background: '#fff',
        borderRadius: '24px 24px 0 0', boxShadow: '0 -12px 40px rgba(16,24,40,.22)', zIndex: 901,
        display: 'flex', flexDirection: 'column', overflow: 'hidden auto',
      } : {
        /* Mismo ancho y mismo fondo que la ficha de Clientes: a 560 px todo
           caía en una columna angosta y larguísima, y la misma información se
           leía como otra pantalla distinta. */
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(1240px, 97vw)', background: '#fafafa',
        boxShadow: '-12px 0 40px rgba(0,0,0,.18)', zIndex: 901,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {!d ? <div style={{ padding: 30, color: '#8e88a8' }}>Cargando…</div> : !caso ? <div style={{ padding: 30 }}>No existe ese caso.</div> : (<>
          {/* Cabecera de la ficha de Clientes: pegada arriba, nombre grande,
              una línea de identidad debajo y las acciones a la derecha —no
              sueltas en su propio renglón, que las hacía competir con las
              decisiones del caso—. */}
          {/* ══ Cabecera MÓVIL, la misma de la ficha de Clientes: agarradera,
              «Volver», inicial + nombre, las dos acciones que se hacen desde el
              teléfono y las dos cifras que deciden. Las pestañas van en el
              segmentado gris, no subrayadas: subrayadas no se ven de reojo y a
              390 px la última quedaba cortada sin que nada lo dijera. ══ */}
          {esMovil ? (() => {
            const nombre = String(emp.nombre || emp.sacs_account || 'Cliente');
            const vacias = ['de', 'del', 'la', 'los', 'las', 'y', 'e'];
            const ws = nombre.split(/\s+/).filter(w => w && !vacias.includes(w.toLowerCase()) && /[a-zA-ZÁÉÍÓÚÑáéíóúñ0-9]/.test(w[0]));
            const ini = (ws.length >= 2 ? ws[0][0] + ws[1][0] : (ws[0] || nombre).slice(0, 2)).toUpperCase();
            const tel = String(d.tel || '').replace(/\D/g, '');
            const nSeg = (d.historia || []).filter((h: any) => h.churn_caso_id).length;
            const PESTANAS: [string, string][] = [['resumen', 'Resumen'], ['conciliacion', 'Conciliación'],
              ['seguimiento', `Seguimiento${nSeg ? ` (${nSeg})` : ''}`], ['cliente', 'Ficha del cliente']];
            return (
              <div style={{ background: '#fff' }}>
                <div onClick={onCerrar} style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', cursor: 'pointer' }} aria-label="Cerrar">
                  <div style={{ width: 44, height: 5, borderRadius: 99, background: '#e2e1e8' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '2px 12px 6px' }}>
                  <button onClick={onCerrar} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', padding: '8px 12px 8px 8px', fontSize: '0.95rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                    Volver
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '0 20px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f4f3f6', color: '#6a6875', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.05rem', flex: 'none' }}>{ini}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{nombre}</div>
                    <div style={{ fontSize: '0.88rem', color: '#8f8d98', marginTop: 3, lineHeight: 1.4 }}>
                      {ETAPA(caso.etapa).l} · canceló {caso.fecha_estimada ? 'sin fecha' : String(caso.detectado_at || '').slice(0, 10)}
                      {caso.episodio > 1 && <b style={{ color: '#C0554E' }}> · {caso.episodio}ª vez</b>}
                    </div>
                  </div>
                </div>
                {tel && (
                  <div style={{ display: 'flex', gap: 10, padding: '16px 20px 0' }}>
                    <a href={`/admin/crm?tab=whatsapp&wa_search=${encodeURIComponent(String(d.tel || ''))}&wa_nuevo=1`}
                      style={{ flex: 1, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#5B4BD6', color: '#fff', borderRadius: 14, fontWeight: 700, fontSize: '0.92rem', textDecoration: 'none' }}>WhatsApp</a>
                    <a href={'tel:' + tel}
                      style={{ flex: 1, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#1a1a1a', border: '1px solid #dddce3', borderRadius: 14, fontWeight: 700, fontSize: '0.92rem', textDecoration: 'none' }}>Llamar</a>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'stretch', padding: '16px 20px 4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', color: '#8f8d98' }}>ARR que se fue</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: '#C0554E' }}>{dinero((Number(caso.mrr_perdido) || 0) * 12)}</div>
                  </div>
                  <div style={{ width: 1, background: '#ececf1', margin: '2px 18px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* En gracia lo que aprieta es el reloj del acuerdo; fuera de
                        gracia, cuánto lleva sin vender —que es lo que dice si
                        todavía hay algo que rescatar—. */}
                    <div style={{ fontSize: '0.88rem', color: '#8f8d98' }}>{caso.etapa === 'gracia' && quedan != null ? (quedan < 0 ? 'Gracia vencida' : 'Quedan de gracia') : 'Sin vender'}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2,
                      color: caso.etapa === 'gracia' && quedan != null && quedan < 0 ? '#C0554E' : '#1a1a1a' }}>
                      {caso.etapa === 'gracia' && quedan != null ? `${Math.abs(quedan)} d` : (emp.dias_sin_venta != null ? `${emp.dias_sin_venta} d` : '—')}
                    </div>
                  </div>
                </div>
                <div style={{ position: 'relative', margin: '14px 16px 0' }}>
                  <div className="fic-seg" style={{ display: 'flex', gap: 2, background: '#f2f2f5', borderRadius: 12, padding: 3, overflowX: 'auto' }}>
                    {PESTANAS.map(([k, l]) => (
                      <button key={k} onClick={() => setVista(k as any)} style={{
                        flex: 'none', padding: '9px 15px', borderRadius: 10, border: 'none',
                        background: vista === k ? '#fff' : 'transparent', boxShadow: vista === k ? '0 1px 3px rgba(16,24,40,.14)' : 'none',
                        fontWeight: 700, color: vista === k ? '#1a1a1a' : '#8f8d98', fontSize: '0.88rem',
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}>{l}</button>
                    ))}
                  </div>
                  {/* El degradado avisa que hay más pestañas a la derecha. */}
                  <div className="fic-seg-fade" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 30, background: 'linear-gradient(90deg, rgba(242,242,245,0), #f2f2f5 75%)', borderRadius: '0 12px 12px 0', pointerEvents: 'none' }} />
                </div>
              </div>
            );
          })() : (<>
          <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #ececec',
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 22px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#241d43', letterSpacing: '-.01em' }}>{emp.nombre || 'Sin nombre'}</div>
              <div style={{ fontSize: '0.8rem', color: '#71707C', marginTop: 3 }}>
                {dinero((Number(caso.mrr_perdido) || 0) * 12)} de ARR · canceló {String(caso.detectado_at || '').slice(0, 10)}
                {caso.fecha_estimada && <span title="El registro vino de Excel sin fecha de cancelación"> (estimada)</span>}
                {caso.episodio > 1 && <b style={{ color: '#C0554E' }}> · {caso.episodio}ª vez</b>}
              </div>
            </div>
            {caso.companies?.id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                <a href={`/admin/crm?tab=whatsapp&wa_search=${encodeURIComponent(String(d.tel || ''))}&wa_nuevo=1`}
                  style={{ ...btn('#fff', '#1E8A63'), textDecoration: 'none', display: 'inline-block' }}>WhatsApp</a>
              </div>
            )}
            <button onClick={onCerrar} aria-label="Cerrar" style={{ border: 'none', background: 'none', cursor: 'pointer',
              color: '#8e88a8', width: 32, height: 32, borderRadius: 8, fontSize: '1.1rem', flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ position: 'sticky', top: 64, zIndex: 4, background: '#fff', borderBottom: '1px solid #ececec', padding: '0 22px' }}>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'nowrap', overflowX: 'auto' }}>
              {([['resumen', 'Resumen'], ['conciliacion', 'Conciliación'], ['seguimiento', `Seguimiento${(d.historia || []).filter((h: any) => h.churn_caso_id).length ? ` (${(d.historia || []).filter((h: any) => h.churn_caso_id).length})` : ''}`], ['cliente', 'Ficha del cliente']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setVista(k as any)} style={{
                  background: vista === k ? '#EEECFE' : 'none', border: 'none',
                  borderRadius: '9px 9px 0 0', borderBottom: vista === k ? '2px solid #9B8CFA' : '2px solid transparent',
                  color: vista === k ? '#5B4BD6' : '#666', fontWeight: vista === k ? 800 : 500,
                  fontSize: '0.8125rem', padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap', marginBottom: -1, flexShrink: 0,
                }}>{l}</button>
              ))}
            </div>
          </div>
          </>)}

          {vista === 'cliente' ? (
            /* La ficha del cliente ENTERA, la misma de Clientes: cotizaciones,
               tickets de soporte, reuniones, actividad, WhatsApp. No se copia
               nada — si algo cambia allá, cambia aquí. Abre en Actividad, que
               es el historial que se viene a ver desde un caso. */
            caso.company_id
              ? <Suspense fallback={<div style={{ padding: 40, color: '#8e88a8' }}>Cargando la ficha…</div>}>
                  <ClienteDrawer360 companyId={caso.company_id} embebido tabInicial="resumen" onClose={() => {}} onChanged={() => { cargar(); onCambio(); }} />
                </Suspense>
              : <div style={{ padding: 40, textAlign: 'center', color: '#71707C' }}>
                  <div style={{ fontWeight: 700, color: '#241d43' }}>Este caso no tiene empresa ligada.</div>
                  <div style={{ fontSize: '0.83rem', marginTop: 4 }}>Sin empresa no hay ficha que mostrar: lígala desde el alta del caso.</div>
                </div>
          ) : (
          <div className="caso-reja" style={{ padding: 18 }}>
            <style>{`
              .caso-reja { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; }
              .caso-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
              /* En el teléfono: el aire de la ficha de Clientes, botón y campo
                 de 44 px —que es lo que un pulgar acierta— y 16 px de letra en
                 los campos, porque menos hace que iOS haga zoom al escribir. */
              @media (max-width: 760px) {
                .caso-reja { padding: 16px 16px 28px !important; gap: 12px; }
                .caso-reja button { min-height: 44px; }
                .caso-reja input, .caso-reja select, .caso-reja textarea { min-height: 44px; font-size: 16px; }
                /* Las decisiones del caso, a todo lo ancho: en el teléfono un
                   botón a la mitad del renglón se lee como si fuera opcional. */
                .caso-acc > button { width: 100%; }
              }
            `}</style>
            <div className="caso-col" style={{ display: vista === 'resumen' ? 'flex' : 'none' }}>
            {/* ── Bloque RESCATE ── */}
            <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ ...ETAPA(caso.etapa) as any, fontSize: '0.72rem', fontWeight: 800, borderRadius: 20,
                  padding: '4px 12px', background: ETAPA(caso.etapa).bg, color: ETAPA(caso.etapa).fg }}>{ETAPA(caso.etapa).l}</span>
                {salud && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 600,
                    color: salud.tono === 'bien' ? '#1E8A63' : salud.tono === 'mal' ? '#C0554E' : salud.tono === 'ojo' ? '#a06600' : '#74727F' }}>
                    {salud.texto}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#71707C', marginTop: 8, lineHeight: 1.5 }}>{ETAPA(caso.etapa).d}</div>

              {caso.etapa === 'gracia' && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 11,
                  background: quedan != null && quedan < 0 ? '#FDF6F5' : '#F3F0FE' }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: quedan != null && quedan < 0 ? '#C0554E' : '#5B4BD6' }}>
                    {quedan != null && quedan < 0 ? `La gracia venció hace ${Math.abs(quedan)} días` : `Quedan ${quedan} días de gracia`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 4 }}>{caso.gracia_acuerdo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#71707C', marginTop: 2 }}>
                    {/* Precio que se le cobra: al mes, porque así se pactó y así
                        lo firma. La conversión a año solo vive en las cifras de
                        negocio (ARR perdido, ARR en rescate). */}
                    Al terminar vuelve a {dinero(caso.gracia_mrr)}/mes · hasta {caso.gracia_fin}
                  </div>
                </div>
              )}

              {/* De quién es. Un caso sin dueño es un caso que nadie trabaja
                  — y con equipo, dos personas le escriben al mismo o ninguna. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: '#71707C' }}>Responsable:</span>
                <select value={caso.owner_id || ''} disabled={guardando}
                  onChange={async e => {
                    setGuardando(true);
                    await fetch('/api/crm/churn/caso', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id, owner_id: e.target.value || null }) }).catch(() => {});
                    setGuardando(false); cargar(); onCambio();
                  }}
                  style={{ border: '1px solid #e2e4e9', borderRadius: 9, padding: '6px 10px', fontSize: '0.8rem',
                    fontFamily: 'inherit', outline: 'none', background: caso.owner_id ? '#fff' : '#FFF8EC' }}>
                  <option value="">Sin asignar</option>
                  {(d.equipo || []).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              {caso.proximo_paso && (
                <div style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 10 }}>
                  <b>Qué sigue:</b> {caso.proximo_paso}
                  <span style={{ color: caso.proximo_paso_at && caso.proximo_paso_at < new Date().toISOString().slice(0, 10) ? '#C0554E' : '#71707C' }}>
                    {' · '}{caso.proximo_paso_at}
                  </span>
                </div>
              )}

              <div style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 12 }}>
                <b>Por qué se fue:</b> {MOTIVO(caso.motivo_categoria)}
                {(caso.motivo_detalle || caso.motivo_original) && <div style={{ color: '#71707C', marginTop: 3 }}>{caso.motivo_detalle || caso.motivo_original}</div>}
              </div>

              {error && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, background: '#FDF6F5',
                color: '#C0554E', fontSize: '0.8rem', lineHeight: 1.45 }}>{error}</div>}

              {/* ── Los botones que existen desde esta etapa ── */}
              {!pidiendo && (
                <div className="caso-acc" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {caso.etapa === 'detectado' && (
                    <button onClick={() => mover('conciliacion')} disabled={guardando} style={btn('#5B4BD6')}>Empezar conciliación</button>
                  )}
                  {(caso.etapa === 'detectado' || caso.etapa === 'conciliacion') && (
                    <button onClick={() => setPidiendo('gracia')} style={btn('#fff', '#5B4BD6')}>Pactar período de gracia</button>
                  )}
                  {caso.etapa === 'gracia' && (
                    <button onClick={() => setExtendiendo(true)} style={btn('#fff', '#5B4BD6')}>Extender la gracia</button>
                  )}
                  {/* Cerrar el caso NO es una cuarta opción del mismo peso: se
                      hace una vez y al final. Va en texto, debajo, para que
                      arriba quede solo lo que mueve el rescate. */}
                  {['detectado', 'conciliacion', 'gracia'].includes(caso.etapa) && (
                    <span style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', marginTop: 4, fontSize: '0.78rem' }}>
                      <button onClick={() => setPidiendo('recuperado')}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: '#1E8A63' }}>Marcar recuperado</button>
                      <button onClick={() => setPidiendo('irrecuperable')}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: '#C0554E' }}>Cerrar como perdido</button>
                    </span>
                  )}
                  {!['detectado', 'conciliacion', 'gracia'].includes(caso.etapa) && (
                    <div style={{ fontSize: '0.8rem', color: '#71707C' }}>
                      Caso cerrado. Si este cliente vuelve a irse, se abre un episodio nuevo.
                    </div>
                  )}
                </div>
              )}

              {extendiendo && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <Campo l="Nueva fecha de fin">
                    <input type="date" style={inp} value={form.gracia_fin || ''} onChange={e => setForm({ ...form, gracia_fin: e.target.value })} />
                  </Campo>
                  {(caso.gracia_extensiones || 0) >= 1 && (
                    <Campo l="Por qué se extiende otra vez">
                      <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.motivo || ''}
                        onChange={e => setForm({ ...form, motivo: e.target.value })} />
                    </Campo>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#71707C', marginBottom: 10 }}>
                    {(caso.gracia_extensiones || 0) >= 1
                      ? 'Es la segunda extensión: extender sin fin es regalar el sistema en cuotas, por eso hay que decir por qué.'
                      : 'Queda registrado en la historia del caso.'}
                  </div>
                  <Acciones onCancelar={() => { setExtendiendo(false); setForm({}); }} guardando={guardando}
                    onOk={() => registrar({ accion: 'extender', gracia_fin: form.gracia_fin, motivo: form.motivo })} />
                </div>
              )}

              {/* ── Pactar la gracia: los tres datos, o no pasa ── */}
              {pidiendo === 'gracia' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {PLANTILLAS.map(t => (
                      <button key={t.l} onClick={() => {
                        const f = new Date(Date.now() + t.dias * 864e5).toISOString().slice(0, 10);
                        setForm({ ...form, gracia_acuerdo: t.l, gracia_fin: f, gracia_mrr: form.gracia_mrr ?? caso.mrr_perdido });
                      }} style={{ border: '1px solid #e2dbf8', background: '#fff', color: '#5B4BD6', borderRadius: 20,
                        padding: '5px 12px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        title={t.nota}>{t.l}</button>
                    ))}
                  </div>
                  <Campo l="Qué se pactó">
                    <input style={inp} value={form.gracia_acuerdo || ''} placeholder="ej. 30 días con soporte dedicado"
                      onChange={e => setForm({ ...form, gracia_acuerdo: e.target.value })} />
                  </Campo>
                  <Campo l="Hasta cuándo">
                    <input type="date" style={inp} value={form.gracia_fin || ''} onChange={e => setForm({ ...form, gracia_fin: e.target.value })} />
                  </Campo>
                  {/* AL MES, dicho con todas sus letras. Es un precio pactado y
                      así se guarda; ponerle rótulo de ARR y dividir por dentro
                      haría que el acuerdo que firma el cliente saliera ×12 mal. */}
                  <Campo l="A cuánto vuelve a pagar al mes, al terminar">
                    <input type="number" style={inp} value={form.gracia_mrr ?? ''} placeholder={String(caso.mrr_perdido)}
                      onChange={e => setForm({ ...form, gracia_mrr: e.target.value })} />
                  </Campo>
                  <div style={{ fontSize: '0.75rem', color: '#71707C', marginBottom: 10, lineHeight: 1.5 }}>
                    Al guardar se le devuelve el acceso en SACS automáticamente, si la cuenta está ligada.
                  </div>
                  <Acciones onCancelar={() => { setPidiendo(null); setForm({}); }} guardando={guardando}
                    onOk={() => mover('gracia', { gracia_acuerdo: form.gracia_acuerdo, gracia_fin: form.gracia_fin, gracia_mrr: form.gracia_mrr })} />
                </div>
              )}

              {pidiendo === 'recuperado' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <div style={{ fontSize: '0.82rem', color: '#4a4756', marginBottom: 10, lineHeight: 1.5 }}>
                    Para marcar recuperado hace falta la suscripción nueva que lo respalda:
                    un recuperado que no paga mentiría en la ARR.
                  </div>
                  {(d.subs_vivas || []).length === 0 ? (
                    <div style={{ padding: '11px 13px', borderRadius: 10, background: '#FFF8EC', color: '#a06600',
                      fontSize: '0.81rem', lineHeight: 1.5, marginBottom: 10 }}>
                      Esta empresa no tiene ninguna suscripción viva. Créala primero en <b>Facturación → Suscripciones</b>
                      y vuelve: aquí va a aparecer sola.
                    </div>
                  ) : (
                    /* Un select con las subs vivas de ESTA empresa, no un campo
                       de uuid: pegar el id de la sub cancelada pasaba antes
                       todas las validaciones y dejaba un «recuperado» que no
                       paga. Ahora ni siquiera es posible elegirlo. */
                    <Campo l="Con qué suscripción volvió">
                      <select style={inp} value={form.subscription_nueva_id || ''}
                        onChange={e => setForm({ ...form, subscription_nueva_id: e.target.value })}>
                        <option value="">Elige la suscripción…</option>
                        {(d.subs_vivas || []).map((x: any) => (
                          <option key={x.id} value={x.id}>
                            {x.nombre_plan} · {dinero(x.mrr)}/mes · {x.estado}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                  <Acciones onCancelar={() => setPidiendo(null)} guardando={guardando}
                    onOk={() => mover('recuperado', { subscription_nueva_id: form.subscription_nueva_id })} />
                </div>
              )}

              {pidiendo === 'irrecuperable' && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0eef7' }}>
                  <Campo l="Categoría">
                    <select style={inp} value={form.motivo_categoria || caso.motivo_categoria || ''}
                      onChange={e => setForm({ ...form, motivo_categoria: e.target.value })}>
                      <option value="">Elige…</option>
                      {MOTIVOS.map(m => <option key={m.id} value={m.id}>{m.l}</option>)}
                    </select>
                  </Campo>
                  <Campo l="Por qué se perdió (esto es lo que enseña para el siguiente)">
                    <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.resultado_motivo || ''}
                      onChange={e => setForm({ ...form, resultado_motivo: e.target.value })} />
                  </Campo>
                  <Acciones onCancelar={() => setPidiendo(null)} guardando={guardando} peligro
                    onOk={async () => {
                      if (!await confirmar('¿Cerrar este caso como perdido?', { accion: 'Cerrar', detalle: 'Es definitivo: si el cliente vuelve, se abre un episodio nuevo.' })) return;
                      mover('irrecuperable', { resultado_motivo: form.resultado_motivo, motivo_categoria: form.motivo_categoria });
                    }} />
                </div>
              )}
            </div>

            {/* ── Episodios anteriores: un reincidente se trabaja distinto ── */}
            {(d.episodios || []).length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8' }}>
                  Ya se había ido antes
                </div>
                {d.episodios.map((e: any) => (
                  <div key={e.id} style={{ fontSize: '0.8rem', color: '#4a4756', marginTop: 8 }}>
                    <b>Episodio {e.episodio}</b> · {String(e.detectado_at || '').slice(0, 10)} → {e.resultado === 'recuperado' ? 'volvió' : 'se perdió'}
                    {e.resultado_motivo && <div style={{ color: '#71707C', fontSize: '0.76rem' }}>{e.resultado_motivo}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Datos duros del cliente: lo primero que se pregunta al abrir un
                caso es desde cuándo, por qué y de qué tamaño era. Estaba
                repartido entre la cabecera y la tabla de atrás. */}
            <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 12 }}>
                El cliente
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { l: 'Canceló', v: caso.fecha_estimada
                      ? <>sin fecha<span style={{ display: 'block', fontSize: '0.72rem', color: '#8e88a8', fontWeight: 500 }}>en la lista desde {String(caso.detectado_at || '').slice(0, 10)}</span></>
                      : <>{String(caso.detectado_at || '').slice(0, 10)}<span style={{ display: 'block', fontSize: '0.72rem', color: '#8e88a8', fontWeight: 500 }}>hace {Math.max(0, Math.round((Date.now() - Date.parse(String(caso.detectado_at))) / 86400000))} dias</span></> },
                  { l: 'Motivo', v: MOTIVO(caso.motivo_categoria) || '\u2014' },
                  { l: 'Sucursales', v: emp.sucursales ? String(emp.sucursales) : '\u2014' },
                  { l: 'Plan', v: emp.plan || '\u2014' },
                  { l: 'ARR que se fue', v: dinero((Number(caso.mrr_perdido) || 0) * 12) },
                  { l: 'Cuenta SACS', v: emp.sacs_account || <span style={{ color: '#a06600' }}>sin ligar</span> },
                ].map(c => (
                  <div key={c.l}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.l}</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#241d43', marginTop: 3 }}>{c.v}</div>
                  </div>
                ))}
              </div>
              {(caso.motivo_detalle || caso.motivo_original) && (
                <div style={{ fontSize: '0.82rem', color: '#4a4756', marginTop: 14, lineHeight: 1.5, paddingTop: 12, borderTop: '1px solid #f2f0f7' }}>
                  {caso.motivo_detalle || caso.motivo_original}
                </div>
              )}
            </div>
            <UsoAntes u={d.uso_antes} />
            <BloqueUso caso={caso} emp={emp} />
            </div>

            <div className="caso-col" style={{ display: vista === 'conciliacion' ? 'flex' : 'none' }}>
            {/* Qué es la conciliación, dicho antes de pedir nada. Estaba
                implícito: quien abría el caso veía cuatro botones y ninguno
                explicaba qué se estaba decidiendo. */}
            <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 8 }}>
                Qué es conciliar
              </div>
              <div style={{ fontSize: '0.84rem', color: '#4a4756', lineHeight: 1.55 }}>
                Es sentarse con el cliente que ya canceló y acordar en qué términos vuelve:
                un período sin costo, a qué nos comprometemos nosotros y a cuánto vuelve a
                pagar al terminar. Si acepta, la gracia queda pactada con esos términos y el
                caso pasa a seguirse solo.
                {caso.etapa === 'detectado' && <span style={{ display: 'block', marginTop: 6, color: '#a06600' }}>
                  Este caso todavía no entra a conciliación. Empieza desde el resumen.
                </span>}
              </div>
            </div>
            <BloquePropuesta d={d} id={id} onCambio={() => { cargar(); onCambio(); }} />
            <BloqueCompromisos lista={d.compromisos || []} />
            </div>

            <div className="caso-col" style={{ display: vista === 'seguimiento' ? 'flex' : 'none' }}>

            {/* ── Registrar lo que pasó. Va ARRIBA de la historia porque es
                    lo que se hace al terminar una llamada, no al final de
                    leerla. Y registrar un contacto real mueve el caso a
                    conciliación solo: la etapa describe lo que pasa, no es una
                    tarea aparte que el vendedor tenga que acordarse de hacer. ── */}
            {['detectado', 'conciliacion', 'gracia'].includes(caso.etapa) && (
              <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
                  Registrar un toque
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[['llamada', 'Llamada'], ['whatsapp', 'WhatsApp'], ['correo', 'Correo'], ['reunion', 'Reunión'], ['nota', 'Nota']].map(([v2, l]) => (
                    <button key={v2} onClick={() => setToque({ ...toque, tipo: v2 })}
                      style={{ border: '1px solid', borderColor: toque.tipo === v2 ? '#5B4BD6' : '#e2dbf8',
                        background: toque.tipo === v2 ? '#EEECFE' : '#fff', color: toque.tipo === v2 ? '#5B4BD6' : '#5a5a63',
                        borderRadius: 20, padding: '5px 12px', fontSize: '0.75rem', fontWeight: toque.tipo === v2 ? 800 : 600,
                        cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                  ))}
                </div>
                <textarea style={{ ...inp, minHeight: 62, resize: 'vertical' }} placeholder="Qué pasó…"
                  value={toque.texto} onChange={e => setToque({ ...toque, texto: e.target.value })} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <input style={{ ...inp, flex: '2 1 180px' }} placeholder="Qué sigue (opcional)"
                    value={toque.proximo_paso} onChange={e => setToque({ ...toque, proximo_paso: e.target.value })} />
                  <input type="date" style={{ ...inp, flex: '1 1 130px' }} value={toque.proximo_paso_at}
                    onChange={e => setToque({ ...toque, proximo_paso_at: e.target.value })} />
                </div>
                <button disabled={guardando || !toque.texto.trim()} style={{ ...btn('#5B4BD6'), marginTop: 10, opacity: toque.texto.trim() ? 1 : .5 }}
                  onClick={() => registrar(toque)}>{guardando ? 'Guardando…' : 'Guardar el toque'}</button>
              </div>
            )}

            {/* ── La línea de tiempo: la MISMA de la ficha 360 ── */}
            <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
                Todo lo que ha pasado con este cliente
              </div>
              {(d.historia || []).length === 0 ? <div style={{ fontSize: '0.82rem', color: '#71707C' }}>Todavía nada.</div>
              : d.historia.map((h: any) => (
                <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f6f5fa' }}>
                  <span style={{ flex: 'none', width: 6, height: 6, borderRadius: 99, marginTop: 7,
                    background: h.churn_caso_id ? '#7C6BF0' : '#d5d2e0' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: '#241d43', fontWeight: h.churn_caso_id ? 700 : 500 }}>{h.titulo}</div>
                    {h.descripcion && <div style={{ fontSize: '0.76rem', color: '#71707C', marginTop: 2 }}>{h.descripcion}</div>}
                    <div style={{ fontSize: '0.7rem', color: '#8e88a8', marginTop: 2 }}>{new Date(h.created_at).toLocaleString('es-MX')}</div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
          )}
        </>)}
      </div>
    </>
  );
}

const btn = (bg: string, color?: string) => ({
  border: color ? `1.5px solid ${color}` : 'none', borderRadius: 10, padding: '9px 15px',
  background: bg, color: color || '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
});

function Acciones({ onOk, onCancelar, guardando, peligro }: any) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onOk} disabled={guardando} style={btn(peligro ? '#C0554E' : '#5B4BD6')}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <button onClick={onCancelar} style={btn('#fff', '#71707C')}>Cancelar</button>
    </div>
  );
}

/* ── QUÉ ESTÁ USANDO ────────────────────────────────────────────────────────
   No un «sí lo usa» genérico: los módulos concretos con su movimiento. Es lo
   que contesta si el rescate está funcionando — y sobre todo si está usando
   AQUELLO por lo que se fue. Un cliente que se fue por soporte de inventario y
   durante la gracia solo factura, se va a ir otra vez. */
/* ── ¿ESTE CLIENTE SÍ LO USABA? ────────────────────────────────────────────
   La ventana viva marca cero para todo el que se fue, así que no distingue al
   que operaba todos los días del que nunca arrancó — y esa diferencia decide
   si vale la pena rescatarlo. Se contesta con lo que sí sobrevive: la foto que
   se guarda al abrir el caso, el mejor mes del histórico y su última venta.

   Cuando no hay registro NO se pintan ceros: un cero se lee como «nunca lo
   usó», y lo que pasa casi siempre es que se fue antes de que empezáramos a
   medir. Eso se dice con todas sus letras. */
function UsoAntes({ u }: { u: any }) {
  if (!u) return null;
  const hayNumeros = Number(u.mejor_ventas) > 0 || Number(u.mejor_monto) > 0;
  const fecha = (f: any) => f ? String(f).slice(0, 10) : null;
  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
        Cuando todavía lo usaba
      </div>

      {hayNumeros ? (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
          {[
            { l: 'Su mejor mes', v: dinero(u.mejor_monto) },
            { l: 'Ventas en ese mes', v: Number(u.mejor_ventas).toLocaleString('es-MX') },
            { l: 'Usuarios operando', v: u.usuarios ? String(u.usuarios) : '\u2014' },
            { l: 'Meses como cliente', v: u.meses_activo ? String(u.meses_activo) : '\u2014' },
          ].map(c => (
            <div key={c.l}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.l}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#241d43', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{c.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#71707C', marginTop: 12, paddingTop: 10, borderTop: '1px solid #f2f0f7', lineHeight: 1.5 }}>
          Es el mejor mes del que tenemos registro{fecha(u.mejor_fecha) ? ` (medido el ${fecha(u.mejor_fecha)})` : ''}.
          {fecha(u.ultima_venta_at) && <> Su última venta fue el <b>{fecha(u.ultima_venta_at)}</b>{u.dias_sin_venta != null ? `, hace ${u.dias_sin_venta} días` : ''}.</>}
        </div>
      </>) : (
        <div style={{ fontSize: '0.84rem', color: '#4a4756', lineHeight: 1.55 }}>
          {fecha(u.ultima_venta_at) ? (<>
            No tenemos registro de cómo lo usaba: dejó de vender el <b>{fecha(u.ultima_venta_at)}</b>
            {u.dias_sin_venta != null ? ` —hace ${u.dias_sin_venta} días—` : ''}
            {fecha(u.historico_desde) ? `, antes de que empezáramos a guardar el histórico (${fecha(u.historico_desde)})` : ''}.
            {u.meses_activo ? <> Alcanzó a ser cliente <b>{u.meses_activo} meses</b>.</> : null}
          </>) : (
            <>No hay registro de uso ni fecha de última venta. Sin cuenta de SACS ligada no hay nada que medir: ligarla es lo primero.</>
          )}
        </div>
      )}
    </div>
  );
}

function BloqueUso({ caso, emp }: { caso: any; emp: any }) {
  if (!emp?.sacs_account) {
    return (
      <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 8 }}>Qué está usando</div>
        {/* No es un cero: es que no lo sabemos. La diferencia importa. */}
        <div style={{ fontSize: '0.83rem', color: '#71707C' }}>Esta empresa no tiene cuenta de SACS ligada, así que no hay uso que medir. Ligarla es lo primero para poder seguir el rescate.</div>
      </div>
    );
  }
  const vivos = modulosVivos(emp.uso_sacs);
  const cmp = compararUso(caso?.uso_al_abrir, emp.uso_sacs);
  const ver = veredictoRescate(caso, emp);
  const tonos: any = { bien: '#1E8A63', ojo: '#a06600', mal: '#C0554E', nd: '#74727F' };

  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8' }}>Qué está usando</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: tonos[ver.tono] }}>{ver.texto}</span>
      </div>

      {(cmp.arranco.length > 0 || cmp.dejo.length > 0) && (
        <div style={{ fontSize: '0.8rem', marginBottom: 10, lineHeight: 1.55 }}>
          {cmp.arranco.length > 0 && <div style={{ color: '#1E8A63' }}><b>Arrancó desde que se abrió el caso:</b> {cmp.arranco.join(' · ')}</div>}
          {/* Dejar de usar algo es la señal temprana de que se va otra vez. */}
          {cmp.dejo.length > 0 && <div style={{ color: '#C0554E' }}><b>Dejó de usar:</b> {cmp.dejo.join(' · ')}</div>}
        </div>
      )}

      {vivos.length === 0 ? (
        <div style={{ fontSize: '0.83rem', color: '#C0554E' }}>No ha tocado el sistema en 30 días.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {vivos.slice(0, 7).map((m: any) => (
            <div key={m.modulo} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.81rem' }}>
              <span style={{ flex: 1, minWidth: 0, color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.modulo}
                {m.familia && <span style={{ color: '#8e88a8', fontSize: '0.74rem' }}> · {m.familia}</span>}
              </span>
              <span style={{ color: '#71707C', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {m.docs_7d ? `${m.docs_7d} esta semana · ` : ''}{m.docs_30d} en 30 d
              </span>
            </div>
          ))}
          {vivos.length > 7 && <div style={{ fontSize: '0.76rem', color: '#8e88a8' }}>y {vivos.length - 7} módulos más</div>}
        </div>
      )}
    </div>
  );
}

/* ── LA PROPUESTA DE RESCATE ───────────────────────────────────────────────
   Es una cotización con forma de rescate: hereda PDF, link, conteo de vistas
   y aceptación firmada del sistema que ya existe. Lo que se ve aquí es su
   estado, que es lo que decide el siguiente movimiento: si no la ha visto, el
   problema es de entrega; si la vio y no contesta, es de oferta. */
function BloquePropuesta({ d, id, onCambio }: { d: any; id: string; onCambio: () => void }) {
  const [abriendo, setAbriendo] = useState(false);
  const [f, setF] = useState<any>({ meses: 3, rescate_mrr_regreso: '', rescate_compromisos: [], rescate_esperamos: '' });
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [compromisos, setCompromisos] = useState<string[]>([]);

  const caso = d?.caso;
  const props = d?.propuestas || [];
  const vigente = props.find((p: any) => ['draft', 'sent', 'accepted'].includes(p.estado));

  useEffect(() => {
    if (!abriendo || compromisos.length) return;
    fetch(`/api/crm/churn/propuesta?caso=${id}`).then(r => r.json())
      .then(j => setCompromisos(j.compromisos || [])).catch(() => {});
  }, [abriendo, compromisos.length, id]);

  const inp: any = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e4e9', borderRadius: 9,
    padding: '9px 11px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' };

  async function crear() {
    setGuardando(true); setErr('');
    const r = await fetch('/api/crm/churn/propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caso_id: id, ...f, rescate_mrr_regreso: Number(f.rescate_mrr_regreso) }) })
      .then(x => x.json()).catch(() => ({ error: 'No se pudo crear' }));
    setGuardando(false);
    if (r?.error) { setErr(r.error); return; }
    setAbriendo(false); onCambio();
    window.open(r.url, '_blank');
  }

  if (!caso || ['estable', 'irrecuperable'].includes(caso.etapa)) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 10 }}>
        Propuesta de rescate
      </div>

      {vigente ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <b style={{ fontSize: '0.88rem', color: '#241d43' }}>{vigente.numero || 'Propuesta'}</b>
            {/* El estado se lee como conducta del cliente, no como jerga:
                «no la ha visto» y «la vio y no contestó» piden guiones
                distintos, y por eso se distinguen. */}
            <span style={{ fontSize: '0.72rem', fontWeight: 800, borderRadius: 20, padding: '3px 10px',
              background: vigente.aceptado_fecha ? '#EAF8F2' : vigente.vistas ? '#E3EDFD' : '#FFF8EC',
              color: vigente.aceptado_fecha ? '#1E8A63' : vigente.vistas ? '#2C5FC4' : '#a06600' }}>
              {vigente.aceptado_fecha ? `Aceptada por ${vigente.aceptado_por || 'el cliente'}`
                : vigente.rechazado_fecha ? 'Rechazada'
                : vigente.vistas ? `La vio ${vigente.vistas} ${vigente.vistas === 1 ? 'vez' : 'veces'}`
                : 'Todavía no la ve'}
            </span>
          </div>
          <div style={{ fontSize: '0.81rem', color: '#4a4756', marginTop: 6, lineHeight: 1.5 }}>
            Sin costo hasta <b>{vigente.rescate_hasta}</b> · después {dinero(vigente.rescate_mrr_regreso)}/mes
            {(vigente.rescate_compromisos || []).length > 0 && (
              <div style={{ color: '#71707C', marginTop: 4 }}>
                Nos comprometimos a: {(vigente.rescate_compromisos || []).join(' · ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <a href={`/cotizacion/${vigente.id}`} target="_blank" rel="noreferrer" style={{ ...btn('#5B4BD6'), textDecoration: 'none', display: 'inline-block' }}>Ver el documento</a>
            {!vigente.aceptado_fecha && (<>
              <button style={btn('#fff', '#5B4BD6')} onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/cotizacion/${vigente.id}`);
              }}>Copiar el link</button>
              <button style={btn('#fff', '#71707C')} onClick={() => setAbriendo(true)}>Hacer otra</button>
            </>)}
          </div>
          {!vigente.aceptado_fecha && !vigente.vistas && (
            <div style={{ fontSize: '0.78rem', color: '#a06600', marginTop: 8 }}>
              Todavía no la abre. Si ya se la mandaste, el problema es de entrega — no de la oferta.
            </div>
          )}
        </>
      ) : !abriendo ? (
        <>
          <div style={{ fontSize: '0.82rem', color: '#71707C', lineHeight: 1.55 }}>
            Un documento con su link: período sin costo, a qué nos comprometemos y a cuánto vuelve.
            Al aceptarlo, la gracia se pacta sola con esos términos.
          </div>
          <button style={{ ...btn('#5B4BD6'), marginTop: 12 }} onClick={() => setAbriendo(true)}>Armar la propuesta</button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[1, 3, 6].map(m => (
              <button key={m} onClick={() => setF({ ...f, meses: m })}
                style={{ border: '1px solid', borderColor: f.meses === m ? '#5B4BD6' : '#e2dbf8',
                  background: f.meses === m ? '#EEECFE' : '#fff', color: f.meses === m ? '#5B4BD6' : '#5a5a63',
                  borderRadius: 20, padding: '5px 13px', fontSize: '0.76rem', fontWeight: f.meses === m ? 800 : 600,
                  cursor: 'pointer', fontFamily: 'inherit' }}>
                {m} {m === 1 ? 'mes' : 'meses'} sin costo
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 6 }}>
            A qué nos comprometemos
          </div>
          {/* Esto es lo que de verdad rescata: el 65% del MRR perdido se fue
              por servicio y cero por precio. Sin al menos uno, la propuesta es
              un descuento disfrazado y el servidor la rechaza. */}
          <div style={{ display: 'grid', gap: 5, marginBottom: 12 }}>
            {compromisos.map((c: string) => {
              const on = f.rescate_compromisos.includes(c);
              return (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => setF({ ...f,
                    rescate_compromisos: on ? f.rescate_compromisos.filter((x: string) => x !== c) : [...f.rescate_compromisos, c] })} />
                  {c}
                </label>
              );
            })}
          </div>

          <label style={{ display: 'block', marginBottom: 10 }}>
            {/* Igual: al mes. Este número se imprime tal cual en el PDF de la
                propuesta que ve el cliente. */}
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>A cuánto vuelve al mes, al terminar</span>
            <input type="number" style={inp} value={f.rescate_mrr_regreso} placeholder={String(Math.round(Number(caso.mrr_perdido || 0)))}
              onChange={e => setF({ ...f, rescate_mrr_regreso: e.target.value })} />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>Qué esperamos de ti (opcional)</span>
            <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={f.rescate_esperamos}
              placeholder="ej. que cargues tu catálogo la primera semana y tengamos una llamada al mes"
              onChange={e => setF({ ...f, rescate_esperamos: e.target.value })} />
          </label>

          {err && <div style={{ padding: '9px 12px', borderRadius: 9, background: '#FDF6F5', color: '#A8433C', fontSize: '0.8rem', marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={crear} disabled={guardando} style={btn('#5B4BD6')}>{guardando ? 'Creando…' : 'Crear y ver el documento'}</button>
            <button onClick={() => { setAbriendo(false); setErr(''); }} style={btn('#fff', '#71707C')}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── LO QUE PROMETIMOS ──────────────────────────────────────────────────────
   Los compromisos de la propuesta no se quedan en el PDF: se abren como
   tareas con fecha en el mismo lugar donde vive el resto de lo prometido, y
   el contador de vencidos del menú los vigila sin que nadie haga nada extra.
   Prometer y no tener quién lo persiga es cómo se perdió esta gente. */
function BloqueCompromisos({ lista }: { lista: any[] }) {
  if (!lista.length) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  const hechos = lista.filter(m => m.estado === 'entregada').length;
  const TONO: any = { entregada: ['#EAF8F2', '#1E8A63', 'listo'], en_proceso: ['#E3EDFD', '#2C5FC4', 'en curso'], idea: ['#f4f4f6', '#5D6470', 'sin empezar'] };

  return (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8' }}>
          Lo que prometimos
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hechos === lista.length ? '#1E8A63' : '#71707C' }}>
          {hechos} de {lista.length} cumplidos
        </span>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {lista.map((m: any) => {
          const [bg, fg, l] = TONO[m.estado] || ['#f4f4f6', '#5D6470', m.estado || '—'];
          // Vencido es rojo aunque el estado diga «en curso»: la fecha manda.
          const vencido = m.estado !== 'entregada' && m.fecha_compromiso && m.fecha_compromiso < hoy;
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.82rem' }}>
              <span style={{ flex: 1, minWidth: 0, color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.titulo}>{m.titulo}</span>
              {m.fecha_compromiso && (
                <span style={{ fontSize: '0.73rem', color: vencido ? '#C0554E' : '#8e88a8', fontWeight: vencido ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {vencido ? 'venció ' : ''}{m.fecha_compromiso}
                </span>
              )}
              <span style={{ fontSize: '0.68rem', fontWeight: 800, borderRadius: 20, padding: '2px 9px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{l}</span>
            </div>
          );
        })}
      </div>
      <a href="/admin/crm?tab=mejoras" style={{ display: 'inline-block', marginTop: 10, fontSize: '0.79rem', fontWeight: 700, color: '#5B4BD6' }}>
        Trabajarlos en Acompañamiento ›
      </a>
    </div>
  );
}
