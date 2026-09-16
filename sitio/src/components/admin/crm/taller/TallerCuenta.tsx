/* El taller DENTRO de la cuenta del cliente.
 *
 * Por qué existe. La pestaña de Consultoría contestaba tres preguntas a la vez
 * —cuánto vale la cuenta, qué se le puede vender y qué se le está construyendo—
 * y la tercera perdía siempre. Medido en producción el día que se partió: 74
 * ideas abiertas contra 9 compromisos reales en todo el CRM, y una cuenta con
 * 58 ideas y un solo compromiso. Una lista de uno a tres renglones no puede
 * vivir debajo de una que tiene cincuenta y ocho: se pierde. Así fue como tres
 * cosas prometidas para el 19 de agosto llevaban 26 días vencidas sin que nadie
 * lo notara, las tres con orden abierta y ninguna con fecha.
 *
 * El corte es una sola pregunta: ¿esto cambia lo que el cliente PAGA, o cambia
 * lo que alguien de Sacs tiene que CONSTRUIR? Lo primero es Consultoría. Lo
 * segundo es esto.
 *
 * No es otra tabla: es el mismo renglón de `mejoras` con su orden de taller,
 * visto desde el otro lado. Dos tablas obligarían a sincronizar, y lo que se
 * sincroniza se desincroniza.
 *
 * Lo interno del taller NO se asoma aquí: rebotes, SLA, quién tardó y la
 * conversación técnica se quedan en el módulo. Si el consultor ve que la mejora
 * del cliente rebotó dos veces, la junta deja de ser sobre lo que va a recibir.
 */
import { useEffect, useState } from 'react';
import Cargando from '../ui/Cargando';
import OrdenDelTaller, { ETAPAS_TALLER } from './OrdenDelTaller';
import { SIN_FECHA } from '../ui/KpiCard';

const hoy = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '')
  : '';
const diasDesde = (d: string) => Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);

/* Las etapas en el orden en que se trabajan. `devuelta`, `espera` y `trabada`
   no salen en el riel: no son avance, son cosas detenidas — y se ven en el
   renglón, que es donde se pueden destrabar. */
const RIEL = [
  ['recibida', 'Recibida'], ['analisis', 'Análisis'], ['desarrollo', 'Desarrollo'],
  ['pruebas', 'Pruebas'], ['lista', 'Lista'], ['entregada', 'Entregada'],
] as const;

const CATS: Record<string, { label: string; bg: string; fg: string }> = {
  personalizacion: { label: 'personalización', bg: '#EEECFE', fg: '#5B4BD6' },
  ajuste:          { label: 'ajuste',          bg: '#F4F4F6', fg: '#6B7280' },
  plugin:          { label: 'plugin',          bg: 'rgba(244,168,205,.22)', fg: '#9c3d70' },
  modulo:          { label: 'módulo',          bg: '#EAF8F2', fg: '#1E8A63' },
};
const cat = (k: string) => CATS[k] || CATS.ajuste;

const S = {
  /* KPI_S del sistema: blanco, borde #eeeef1, radio 12, 14×16 de aire. */
  kpi: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '14px 16px' } as const,
  kl: { fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.08em' } as const,
  kv: { fontSize: '1.375rem', fontWeight: 800, marginTop: 4, letterSpacing: '-.01em', lineHeight: 1.15 } as const,
  ks: { fontSize: '0.6875rem', color: '#888', marginTop: 2, lineHeight: 1.45 } as const,
  /* D.badge: la MISMA pastilla de todo el CRM. Agua de fondo, tinta en la
     letra; las cifras en tabulares para que una columna de alertas se lea de
     corrido —«26, 26, 26»— que es lo que hace que se noten. */
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums' as const } as const,
  /* Secundario del sistema: blanco, borde y letra morados. El principal es uno
     solo por pantalla; tres morados sólidos seguidos no tienen jerarquía. */
  btn2: { padding: '7px 13px', border: '1.5px solid #9B8CFA', borderRadius: 9, fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#5B4BD6', fontFamily: 'inherit', flex: '0 0 auto' } as const,
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff', fontFamily: 'inherit' } as const,
};

const AGUA = {
  roja: { background: '#FEF0EF', color: '#C0554E' },
  // «Sin fecha» va en el degradado de la casa, no en ámbar: es el mismo estilo
  // que la tarjeta de proyecto del taller, escrito una sola vez en KpiCard.
  sinFecha: SIN_FECHA,
  ambar: { background: '#FFF4E5', color: '#9a6a10' },
  verde: { background: '#EAF8F2', color: '#1E8A63' },
  lila: { background: '#EEECFE', color: '#5B4BD6' },
};

/** El aviso de un renglón. Uno solo por fila y siempre el peor: dos avisos
 *  compitiendo es como ninguno. */
function avisoDe(prometida: string | null, etapa: string) {
  if (etapa === 'entregada') return { t: 'entregada', c: AGUA.verde };
  if (!prometida) return { t: 'sin fecha', c: AGUA.sinFecha };
  const d = diasDesde(prometida);
  if (d > 0) return { t: `${d} ${d === 1 ? 'día' : 'días'} tarde`, c: AGUA.roja, tarde: d };
  return { t: 'para el ' + fmtDate(prometida), c: AGUA.verde };
}

export default function TallerCuenta({ companyId, flash }: any) {
  const [datos, setDatos] = useState<any>(null);
  const [mejoras, setMejoras] = useState<any[]>([]);
  const [orden, setOrden] = useState<any>(null);

  const cargar = () => Promise.all([
    fetch('/api/crm/taller?company_id=' + companyId).then(r => r.json()).catch(() => null),
    fetch('/api/crm/mejoras?company_id=' + companyId).then(r => r.json()).catch(() => null),
  ]).then(([t, m]) => { setDatos(t || {}); setMejoras(m?.data || []); });

  useEffect(() => { setDatos(null); cargar(); }, [companyId]);

  async function abrirOrden(id: string) {
    setOrden({ cargando: true });
    const r = await fetch('/api/crm/taller?id=' + id).then(x => x.json()).catch(() => null);
    if (!r || r.error || !r.orden) { setOrden(null); flash(r?.error || 'No se pudo abrir la orden'); return; }
    setOrden(r.orden);
  }
  async function guardarOrden(cambios: any) {
    const r = await fetch('/api/crm/taller', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orden.id, ...cambios }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo guardar la orden'); return false; }
    setOrden(null); await cargar(); flash('Orden actualizada · el taller ya lo ve');
    return true;
  }
  async function alTaller(mejoraId: string) {
    const r = await fetch('/api/crm/taller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'crear', mejora_id: mejoraId }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo mandar al taller'); return; }
    await cargar();
    const nueva = r.ordenes?.[0];
    flash('En el taller: ' + (nueva?.folio || 'orden creada'));
    // Se abre de inmediato para ponerle fecha y criterio: dejarlo para después
    // es como nacen las órdenes sin fecha, que son las que rebotan.
    if (nueva) abrirOrden(nueva.id);
  }

  if (!datos) return <Cargando texto="Cargando el taller de la cuenta…" />;

  const ligas: Record<string, any> = datos.ligas || {};
  const porMejora = new Map(mejoras.map((m: any) => [m.id, m]));

  /* Cada renglón: la orden del taller con el compromiso que le dio origen. La
     fecha que vale es la del taller; si todavía no la puso, la que se le
     prometió al cliente — porque contra ESA se llega tarde. */
  const filas = Object.entries(ligas).map(([mejoraId, o]: any) => {
    const m: any = porMejora.get(mejoraId);
    const prometida = o.fecha_prometida || m?.fecha_compromiso || null;
    return { ...o, mejoraId, titulo: m?.titulo || '(sin título)', categoria: m?.categoria || 'ajuste', prometida, aviso: avisoDe(prometida, o.etapa) };
  }).sort((a, b) => (b.aviso.tarde || 0) - (a.aviso.tarde || 0) || String(a.prometida || '9999').localeCompare(String(b.prometida || '9999')));

  const vivas = filas.filter(f => f.etapa !== 'entregada');
  const tarde = vivas.filter(f => f.aviso.tarde);
  const peor = tarde[0]?.aviso.tarde || 0;
  const sinFecha = vivas.filter(f => !f.prometida).length;
  const sinOrden = (datos.sinOrden || []).filter((x: any) => x.company_id === companyId);
  const ideas = mejoras.filter((m: any) => m.estado === 'idea' && !m.quote_id).length;
  const esteAnio = mejoras.filter((m: any) => String(m.fecha_entrega || '').startsWith(String(new Date().getFullYear()))).length;
  const cuenta = (e: string) => filas.filter(f => f.etapa === e).length;

  return (
    <div>
      {/* La banda de destellos con «Aquí se pule cada estrella» la pinta la
          ficha del cliente para TODAS sus pestañas (FirmaFicha): dos juegos de
          destellos con distintos tamaños se ven como dos casas. */}
      {/* La fila de tarjetas. BLANCAS, con su franja de color de 3 px como el
          resto del CRM: el degradado lila→rosa se quitó a pedido del dueño
          (14-sep-2026) —«no quiero que pongas esos colores morados en las cards,
          déjalas en blanco como estaban»—. El adorno de la marca vive en la
          banda de destellos del título, no encima de las cifras. La jerarquía de
          la primera la da su tamaño y su tinta, no un fondo de color. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ ...S.kpi, gridColumn: 'span 2', borderLeft: `3px solid ${peor ? '#EF7A72' : sinFecha ? '#E8A838' : '#9B8CFA'}` }}>
          <div style={{ ...S.kl, color: peor ? '#C0554E' : '#999' }}>
            {peor ? 'Se pasó la fecha' : vivas.length ? 'Lo que le debes' : 'Nada pendiente'}
          </div>
          <div style={{ ...S.kv, color: peor ? '#C0554E' : vivas.length ? '#5B4BD6' : '#1a1a1a' }}>
            {peor ? `${peor} ${peor === 1 ? 'día' : 'días'} tarde` : vivas.length ? `${vivas.length} en curso` : 'Al día'}
          </div>
          <div style={S.ks}>
            {peor
              ? <>La más atrasada de <b style={{ color: '#C0554E' }}>{tarde.length}</b> que se pasaron de fecha{sinFecha ? <> · {sinFecha} sin fecha nueva</> : null}</>
              : vivas.length
                ? <>{sinFecha ? <><b style={{ color: '#9a6a10' }}>{sinFecha} sin fecha</b> · nadie las puede arrancar</> : 'todas con fecha comprometida'}</>
                : 'Lo que salga de la próxima junta aparece aquí'}
          </div>
        </div>
        <div style={{ ...S.kpi, borderLeft: '3px solid #9B8CFA' }}>
          <div style={S.kl}>En el taller</div>
          <div style={{ ...S.kv, color: vivas.length ? '#5B4BD6' : '#c2bfcc' }}>{vivas.length}</div>
          <div style={S.ks}>{sinOrden.length ? `${sinOrden.length} comprometida${sinOrden.length === 1 ? '' : 's'} sin orden` : 'nada comprometido fuera del taller'}</div>
        </div>
        <div style={{ ...S.kpi, borderLeft: '3px solid #4FBF95' }}>
          <div style={S.kl}>Entregado este año</div>
          <div style={{ ...S.kv, color: esteAnio ? '#1E8A63' : '#c2bfcc' }}>{esteAnio}</div>
          <div style={S.ks}>{esteAnio ? 'con su fecha y su video' : 'todavía nada con tu marca encima'}</div>
        </div>
      </div>

      {/* El riel: dónde está parado el trabajo de esta cuenta, de un vistazo. */}
      {filas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 14, flexWrap: 'wrap' }}>
          {RIEL.map(([k, l], i) => {
            const n = cuenta(k);
            return (
              <div key={k} style={{ display: 'contents' }}>
                <div style={{ textAlign: 'center', minWidth: 66, padding: '7px 5px', borderRadius: 9, background: n ? '#EEECFE' : 'transparent' }}>
                  <b style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: n ? '#5B4BD6' : '#dcdae2' }}>{n || '—'}</b>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: n ? '#7a6fc9' : '#b5b2bd' }}>{l}</span>
                </div>
                {i < RIEL.length - 1 && <i style={{ color: '#e0dee6', fontStyle: 'normal', fontSize: '0.9rem' }}>›</i>}
              </div>
            );
          })}
        </div>
      )}

      {filas.length === 0 && sinOrden.length === 0 && (
        <div style={{ ...S.kpi, color: '#999', fontSize: '0.82rem' }}>
          Esta cuenta no tiene nada en el taller. Lo que salga de una junta como personalización, ajuste o falla
          aterriza aquí con su fecha.
        </div>
      )}

      {filas.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #f4f4f4', flexWrap: 'wrap' }}>
          {/* La franja de 3 px del estado, como toda tarjeta del CRM. */}
          <span style={{ flex: '0 0 3px', alignSelf: 'stretch', minHeight: 34, borderRadius: 99, background: f.aviso.tarde ? '#EF7A72' : f.etapa === 'entregada' ? '#4FBF95' : f.prometida ? '#9B8CFA' : '#E8A838' }} />
          <div style={{ flex: '0 0 60px', fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', fontWeight: 700, color: '#5B4BD6' }}>{f.folio}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>
              {f.titulo}
              <span style={{ ...S.badge, fontSize: '0.62rem', marginLeft: 6, background: cat(f.categoria).bg, color: cat(f.categoria).fg }}>{cat(f.categoria).label}</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 3 }}>
              {ETAPAS_TALLER[f.etapa] || f.etapa}
              {f.prometida && <> · se prometió para el {fmtDate(f.prometida)}</>}
              {!f.asignado_id && f.etapa !== 'entregada' && <> · sin asignar</>}
            </div>
          </div>
          <span style={{ ...S.badge, ...f.aviso.c }}>{f.aviso.t}</span>
          <button style={S.btn2} onClick={() => abrirOrden(f.id)}>
            {f.prometida ? 'Editar la orden' : 'Ponerle fecha'}
          </button>
        </div>
      ))}

      {/* Comprometido y todavía sin orden. Es el hueco que hace que el taller
          nazca vacío y nadie lo abra dos veces. */}
      {sinOrden.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>
            Prometido y todavía sin orden · {sinOrden.length}
          </div>
          {sinOrden.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #f4f4f4', flexWrap: 'wrap' }}>
              <span style={{ flex: '0 0 3px', alignSelf: 'stretch', minHeight: 34, borderRadius: 99, background: '#E8A838' }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: '0.83rem', fontWeight: 700 }}>
                  {m.titulo}
                  <span style={{ ...S.badge, fontSize: '0.62rem', marginLeft: 6, background: cat(m.categoria).bg, color: cat(m.categoria).fg }}>{cat(m.categoria).label}</span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 3 }}>
                  {m.fecha_compromiso ? <>comprometida para el {fmtDate(m.fecha_compromiso)}</> : 'sin fecha comprometida'}
                </div>
              </div>
              <span style={{ ...S.badge, ...(m.fecha_compromiso && m.fecha_compromiso < hoy() ? AGUA.roja : AGUA.ambar) }}>
                {m.fecha_compromiso && m.fecha_compromiso < hoy() ? `${diasDesde(m.fecha_compromiso)} días tarde` : 'nadie la está haciendo'}
              </span>
              <button style={S.btn} onClick={() => alTaller(m.id)}>Mandar al taller</button>
            </div>
          ))}
        </div>
      )}

      {/* El puente: una LÍNEA del otro lado, no una lista. El que mira sabe que
          existe y con un clic está allá. */}
      <div style={{ marginTop: 14, paddingTop: 11, borderTop: '1px solid #f4f4f4', fontSize: '0.75rem', color: '#888', lineHeight: 1.6 }}>
        {ideas > 0
          ? <><b style={{ color: '#1a1a1a' }}>{ideas} idea{ideas === 1 ? '' : 's'}</b> de esta cuenta todavía no son trabajo: una idea cruza al taller cuando se cotiza y se paga.</>
          : <>No hay ideas abiertas de esta cuenta.</>}
        {' '}Lo que se le puede vender vive en <b style={{ color: '#5B4BD6' }}>Consultoría</b>.
      </div>

      {orden && <OrdenDelTaller orden={orden} equipo={datos.equipo || []} onCerrar={() => setOrden(null)} onGuardar={guardarOrden} />}
    </div>
  );
}
