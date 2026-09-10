// La renovación de una cuenta, dentro de su ficha.
//
// Vivía en una lista de setenta y un renglones dentro de Comisiones. Se movió
// aquí porque la meta de expansión es una propiedad de LA CUENTA, no del pago:
// se actúa sobre ella mirando al cliente —qué usa, qué le falta, qué se le puede
// vender— y no mirando una tabla de nómina.
//
// Contesta tres preguntas, en el orden en que importan:
//
//   1. ¿Conserva su tasa el año que viene?   → el veredicto y sus números
//   2. ¿Cuánto le falta vender, y de qué?    → las tres condiciones
//   3. ¿De dónde salió lo que ya se le vendió y qué se le ha trabajado?
//
// La decisión sigue siendo de una persona: el seguimiento se marca a mano. Lo
// que cambia es que se marca con la evidencia enfrente.
//
// ── Por qué se rediseñó (10-sep-2026) ──
// Eran siete bloques apilados: un banner lila con dos párrafos, tres tarjetas
// —cada una con su propio párrafo explicativo— y, abierto de par en par, el
// expediente completo: cuatro tarjetas densas de uso, minutas, conversación y
// tickets. Para saber si esta cuenta conserva su tasa había que leer media
// pantalla, y lo primero que aparecía no era la respuesta.
// Ahora se lee como Info general: una tarjeta con la pregunta y su respuesta,
// las condiciones a un renglón cada una, la explicación detrás de un clic, y
// la evidencia como una tira de cuatro lecturas con el expediente plegado.
import { useEffect, useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import Cargando from './ui/Cargando';
import SeguimientoCuenta from './SeguimientoCuenta';

const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—';
const fechaCorta = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  : '—';
/** Con año: la fecha de cobro se lee para agendar, y «25 nov» a secas no basta. */
const fechaMedia = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';
/** «1 día» / «5 días». El «día(s)» de antes se leía como una plantilla sin llenar. */
const dias = (n: number) => `${n} ${Math.abs(n) === 1 ? 'día' : 'días'}`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** De dónde nació el compromiso. Mismo vocabulario que Consultoría. */
const ORIGEN_L: Record<string, string> = {
  junta: 'Junta de consultoría', whatsapp: 'Pedido por WhatsApp', soporte: 'Salió de soporte',
  llamada: 'De una llamada', manual: 'Capturado a mano',
};

const E = {
  cardM: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: 16 } as const,
  card: { background: '#fff', border: `1px solid ${P.linea}`, borderRadius: 12, padding: 16 } as const,
  h: { fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', display: 'flex', alignItems: 'center', gap: 8 },
  hNota: { marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' },
  lbl: { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#9c99a6', display: 'block' },
  val: { fontSize: '0.95rem', fontWeight: 800, marginTop: 3, color: '#241d43', fontVariantNumeric: 'tabular-nums' as const },
  chip: { display: 'inline-block', fontSize: '0.66rem', fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: '#f4f3f7', color: '#6b7280', whiteSpace: 'nowrap' as const },
  sello: { fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderRadius: 5, padding: '2px 7px', display: 'inline-block', whiteSpace: 'nowrap' as const },
  hair: { borderTop: `1px solid ${P.lineaSuave}`, marginTop: 14, paddingTop: 13 },
  input: { padding: '7px 10px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.79rem', fontFamily: 'inherit', outline: 'none', background: '#fdfcff', color: '#241d43' },
  th: { textAlign: 'left' as const, padding: '6px 8px', fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: `1px solid ${P.linea}` },
  td: { padding: '9px 8px', borderBottom: '1px solid #f6f5f9', verticalAlign: 'top' as const, color: '#3c3748', fontSize: '0.81rem' },
};

const chipCol = (bg: string, fg: string) => ({ ...E.chip, background: bg, color: fg });

/** Un dato de la fila derivada: etiqueta en versalitas, cifra abajo. */
function Dato({ k, v, color, nota }: { k: string; v: any; color?: string; nota?: string }) {
  return (
    <div>
      <span style={E.lbl}>{k}</span>
      <div style={{ ...E.val, color: color || E.val.color }}>{v}</div>
      {nota && <div style={{ fontSize: '0.66rem', color: '#8a8590' }}>{nota}</div>}
    </div>
  );
}

/** Una condición, a UN renglón. La explicación no vive aquí. */
function Condicion({ letra, titulo, nota, extra, sello, children }: {
  letra: string; titulo: string; nota: any; extra?: any;
  sello: { t: string; bg: string; fg: string } | null; children?: any;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 0', borderTop: `1px solid ${P.lineaSuave}` }}>
      <div style={{ width: 23, height: 23, flexShrink: 0, borderRadius: 7, background: P.violetaAgua, color: '#4536BE', display: 'grid', placeItems: 'center', fontSize: '0.74rem', fontWeight: 800, marginTop: 1 }}>{letra}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#241d43' }}>{titulo}</div>
        <div style={{ fontSize: '0.78rem', color: '#8a8590', marginTop: 2 }}>{nota}</div>
        {extra}
      </div>
      <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
        {sello && <span style={{ ...E.sello, background: sello.bg, color: sello.fg }}>{sello.t}</span>}
        {children}
      </div>
    </div>
  );
}

export default function RenovacionCuenta({ companyId, nombre }: { companyId: string; nombre: string }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const anio = new Date().getFullYear();

  async function cargar() {
    const r = await fetch(`/api/crm/comisiones/renovacion-cuenta?company_id=${companyId}&anio=${anio}`);
    const j = await r.json();
    j.error ? setError(j.error) : setD(j);
  }
  useEffect(() => { setD(null); cargar(); /* eslint-disable-next-line */ }, [companyId]);

  /** Dispara el mismo cálculo del cron, para no tener que esperar a mañana. */
  async function calcular() {
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/comisiones/renovacion-cuenta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Error'); return; }
      setError(null); await cargar();
    } finally { setGuardando(false); }
  }

  async function marcar(v: string) {
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/comisiones/renovacion-cuenta', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, anio, condicion_a: v === '' ? null : v === 'true' }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Error'); return; }
      setError(null); await cargar();
    } finally { setGuardando(false); }
  }

  if (error) return <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>;
  if (!d) return <Cargando texto="Revisando la renovación…" alto={160} />;

  const ev = d.evaluacion;
  if (!ev) return (
    <div style={{ ...E.card, color: P.suave, fontSize: '0.84rem' }}>
      <p style={{ margin: '0 0 10px' }}>
        Esta cuenta todavía no tiene evaluación de {anio}. Se genera sola cada madrugada, en cuanto tenga
        una anualidad del año anterior contra la cual medir.
      </p>
      <button onClick={calcular} disabled={guardando} style={{
        padding: '8px 15px', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
        background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, opacity: guardando ? 0.6 : 1,
      }}>{guardando ? 'Calculando…' : 'Calcular ahora'}</button>
    </div>
  );

  const meta = Number(ev.meta || 0);
  /* El VENDIDO se toma del cálculo VIVO, no de la evaluación guardada.
     La evaluación es una foto que se genera de madrugada; la lista de abajo se
     arma en cada carga. Cuando no coinciden, la pantalla se contradice a sí
     misma: decía "VENDIDO $0 · NO CUMPLE" con los $119,764 de ARTIK listados
     tres renglones más abajo. El número de arriba tiene que ser la suma de lo
     que se está enseñando. */
  const vivo = Number(d.expansion?.vendido || 0);
  const lineas: any[] = d.expansion?.lineas || [];
  const vendido = lineas.length ? vivo : Number(ev.vendido || 0);
  // Y el veredicto sale de ese mismo número. Con `ev.cumple_b` guardado, el
  // sello decía "NO CUMPLE" junto a una barra llena y un "FALTA: Nada".
  const cumpleB = meta > 0 ? vendido >= meta : !!ev.cumple_b;
  const falta = Math.max(0, meta - vendido);
  const pct = meta > 0 ? Math.min(100, Math.round((vendido / meta) * 100)) : 0;
  const veces = meta > 0 ? vendido / meta : 0;
  const prox = d.proxima_anualidad;
  const mej = d.mejoras || { entregadas: 0, cortesias: 0, en_proceso: 0, ideas: 0 };

  // La urgencia del cobro es una propiedad del calendario, no del criterio de
  // nadie: o quedan días o no quedan.
  const urgente = prox && prox.dias != null && prox.dias <= 15;
  const vencida = prox && prox.dias != null && prox.dias < 0;
  const totalLineas = lineas.reduce((a, l) => a + Number(l.monto_bruto || 0), 0);
  // Todo lo cobrado por una misma cotización se paga junto: si es un solo
  // folio, el pie de la tabla lo dice una vez en vez de repetirlo por renglón.
  const folios = Array.from(new Set(lineas.map(l => l.origen_cotizacion).filter(Boolean)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── 1 · El veredicto y sus números, en UNA tarjeta ── */}
      <div style={E.cardM}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 230 }}>
            <span style={E.lbl}>
              Su tasa en la {prox ? `renovación del ${fechaCorta(prox.fecha)}` : 'próxima renovación'}
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-.02em', marginTop: 4, lineHeight: 1.25, color: ev.cumple === false ? P.rojoTinta : '#241d43' }}>
              {ev.cumple === false
                ? `Cobrará tasa reducida (${d.tasa_incumplimiento}%)`
                : ev.cumple
                  ? 'Conserva su tasa completa'
                  : 'Conserva su tasa completa'}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 9 }}>
              {ev.condicion_a == null
                ? <span style={E.chip}>Seguimiento sin marcar</span>
                : ev.condicion_a
                  ? <span style={chipCol(P.verdeAgua, P.verdeTinta)}>Hubo seguimiento</span>
                  : <span style={chipCol(P.rojoAgua, P.rojoTinta)}>Sin seguimiento</span>}
              {cumpleB
                ? <span style={chipCol(P.verdeAgua, P.verdeTinta)}>Meta cumplida</span>
                : <span style={chipCol(P.ambarAgua, P.ambarTinta)}>Falta {pesos(falta)}</span>}
              {prox && prox.dias != null && (
                vencida
                  ? <span style={chipCol(P.rojoAgua, P.rojoTinta)}>Vencida hace {dias(Math.abs(prox.dias))}</span>
                  : <span style={chipCol(urgente ? P.ambarAgua : P.verdeAgua, urgente ? P.ambarTinta : P.verdeTinta)}>Cobro en {dias(prox.dias)}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={E.lbl}>Vendido este año</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{pesos(vendido)}</div>
            <div style={{ fontSize: '0.72rem', color: '#8a8590' }}>
              {meta > 0
                ? (veces >= 1 ? `${(Math.round(veces * 10) / 10).toLocaleString('es-MX')}× la meta de ${pesos(meta)}` : `${pct}% de la meta de ${pesos(meta)}`)
                : 'sin meta que medir'}
            </div>
          </div>
        </div>

        <div style={{ ...E.hair, display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Dato k="Se cobra el" v={prox ? fechaMedia(prox.fecha) : '—'} color={vencida ? P.rojoTinta : urgente ? P.ambarTinta : undefined} />
          <Dato k="Anualidad" v={prox ? pesos(prox.monto) : '—'} />
          <Dato k="Meta (30%)" v={meta > 0 ? pesos(meta) : '—'} />
          <Dato k="Falta vender" v={falta > 0 ? pesos(falta) : 'Nada'} color={falta > 0 ? P.ambarTinta : P.verdeTinta} />
          <Dato k="Días de gracia" v={`${d.gracia} naturales`} />
        </div>

        <details style={{ ...E.hair }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: '0.74rem', fontWeight: 700, color: P.violetaTinta }}>
            Cómo se decide la tasa
          </summary>
          <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#55505f', lineHeight: 1.6, maxWidth: '74ch' }}>
            Hacen falta <b>las tres</b> condiciones. Mientras el seguimiento no se marque, <b>no se castiga
            nada</b>: la cuenta cobra su tasa completa. Si alguna falla, esa renovación paga <b>{d.tasa_incumplimiento}%</b> en
            vez de su tasa, y hay margen hasta <b>{d.gracia} días naturales</b> después del vencimiento para cobrarla.
            La meta cuenta la <b>expansión</b> —vitalicias, plugins y servicios—, no la renovación de la propia licencia:
            renovar es conservar, no crecer.
          </p>
        </details>
      </div>

      {/* ── 2 · Las tres condiciones, un renglón cada una ── */}
      <div style={E.card}>
        <div style={{ ...E.h, marginBottom: 2 }}>Las tres condiciones</div>

        <Condicion letra="A" titulo="Seguimiento real al cliente"
          nota="De criterio, y lo marcas tú mirando la evidencia de abajo."
          sello={ev.condicion_a == null ? null
            : ev.condicion_a ? { t: 'Cumple', bg: P.verdeAgua, fg: P.verdeTinta }
            : { t: 'No cumple', bg: P.rojoAgua, fg: P.rojoTinta }}>
          <select value={ev.condicion_a == null ? '' : String(ev.condicion_a)} disabled={guardando}
            onChange={e => marcar(e.target.value)} style={{ ...E.input, minWidth: 170, marginTop: ev.condicion_a == null ? 0 : 6 }}>
            <option value="">Sin evaluar</option>
            <option value="true">Sí hubo seguimiento</option>
            <option value="false">No hubo seguimiento</option>
          </select>
        </Condicion>

        <Condicion letra="B" titulo="Expandir la cuenta un 30%"
          nota={meta > 0
            ? <><b style={{ color: P.violetaTinta }}>{pesos(vendido)}</b> vendidos sobre una meta de {pesos(meta)}.</>
            : 'Sin anualidad del año anterior, no hay meta que medir.'}
          extra={meta > 0 && (
            <div style={{ height: 6, borderRadius: 4, background: '#f1eff8', overflow: 'hidden', marginTop: 7, maxWidth: 220 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: cumpleB ? P.verde : P.ambar }} />
            </div>
          )}
          sello={cumpleB ? { t: 'Cumple', bg: P.verdeAgua, fg: P.verdeTinta } : { t: 'No cumple', bg: P.rojoAgua, fg: P.rojoTinta }} />

        <Condicion letra="C" titulo="Cobrar la anualidad a tiempo"
          nota={prox
            ? <>{pesos(prox.monto)} el {fecha(prox.fecha)}. {vencida ? 'Ya se pasó de fecha.' : 'Todavía no se puede evaluar.'}</>
            : 'Sin fecha de próxima factura no se puede medir la puntualidad —y por eso no castiga—.'}
          sello={!prox ? { t: 'No aplica', bg: P.lineaSuave, fg: P.suave }
            : vencida ? { t: `Vencida ${dias(Math.abs(prox.dias))}`, bg: P.rojoAgua, fg: P.rojoTinta }
            : { t: `En ${dias(prox.dias)}`, bg: urgente ? P.ambarAgua : P.verdeAgua, fg: urgente ? P.ambarTinta : P.verdeTinta }} />
      </div>

      {/* ── 3 · De dónde salió la expansión ──
          El renglón que faltaba: qué se le vendió, de qué junta salió y si ya
          se entregó. Sin esto, una comisión se paga mirando un total. */}
      <div style={E.card}>
        <div style={E.h}>
          De dónde salió la expansión
          <span style={E.hNota}>montos netos, ya con el descuento aplicado</span>
        </div>

        {lineas.length === 0 ? (
          <p style={{ margin: '9px 0 0', fontSize: '0.8rem', color: P.suave }}>
            Todavía no se le ha vendido nada de expansión este año.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 9 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={E.th}>Partida</th>
                  <th style={E.th}>De dónde salió</th>
                  <th style={E.th}>Entrega</th>
                  <th style={{ ...E.th, textAlign: 'right' }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l: any, i: number) => {
                  /* Cobrado y sin entrega registrada NO es un error de cobro
                     —el dinero entró y cuenta para la meta— pero es justo el
                     renglón que uno quiere ver antes de pagar una comisión. */
                  const pendiente = !!l.origen_cotizacion && !l.entrega;
                  return (
                    <tr key={i} style={pendiente ? { background: '#FFFCF6' } : undefined}>
                      <td style={E.td}>
                        <b style={{ color: '#241d43' }}>{l.concepto || 'Sin concepto'}</b>
                        {l.origen_cotizacion && <div style={{ color: '#8a8590' }}>{l.origen_cotizacion}</div>}
                      </td>
                      <td style={E.td}>
                        {l.entrega?.origen
                          ? <span style={chipCol(P.violetaAgua, P.violetaTinta)}>{ORIGEN_L[l.entrega.origen] || l.entrega.origen}</span>
                          : l.origen_cotizacion
                            ? <span style={chipCol(P.azulAgua, P.azulTinta)}>Cotización</span>
                            : <span style={E.chip}>Licencia</span>}
                      </td>
                      <td style={E.td}>
                        {l.entrega
                          ? (l.entrega.estado === 'entregada'
                              ? <>Entregada el {fechaCorta(l.entrega.fecha)}</>
                              : <span style={{ color: P.ambarTinta, fontWeight: 700 }}>Comprometida, sin entregar</span>)
                          : l.origen_cotizacion
                            ? <span style={{ color: P.ambarTinta, fontWeight: 700 }}>Pagado, sin entrega registrada</span>
                            : <span style={{ color: '#a5a2af' }}>—</span>}
                      </td>
                      <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {pesos(l.monto_bruto)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} style={{ ...E.td, borderBottom: 'none', borderTop: `2px solid ${P.lineaSuave}`, fontWeight: 800, color: '#241d43' }}>
                    Total {folios.length === 1 ? `· ${folios[0]}` : `en ${lineas.length} partida(s)`}
                  </td>
                  <td style={{ ...E.td, borderBottom: 'none', borderTop: `2px solid ${P.lineaSuave}`, textAlign: 'right', fontWeight: 800, color: P.violetaTinta, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                    {pesos(totalLineas)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Lo trabajado sin cobro es la otra mitad del argumento de la A. */}
        <div style={{ ...E.hair, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Dato k="Mejoras entregadas" v={`${mej.entregadas} este año`} />
          <Dato k="De cortesía" v={`${mej.cortesias} sin cobro`} color={mej.cortesias > 0 ? P.verdeTinta : undefined} />
          <Dato k="Comprometido y abierto" v={`${mej.en_proceso} en proceso · ${plural(mej.ideas, 'idea', 'ideas')}`} />
        </div>
      </div>

      {/* ── 4 · La evidencia, en una tira. El expediente va plegado ──
          Abierto ocupaba media pantalla con cuatro tarjetas densas antes de que
          hubieras decidido nada. Aquí son cuatro lecturas y un clic. */}
      <div style={E.card}>
        <div style={{ ...E.h, marginBottom: 10 }}>
          La evidencia para marcar A
          <span style={E.hNota}>lo que se sabe de esta cuenta sin preguntarle a nadie</span>
        </div>
        <SeguimientoCuenta companyId={companyId} nombre={nombre} compacto />
      </div>
    </div>
  );
}
