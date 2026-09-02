// El expediente de una cuenta: lo que hay que mirar ANTES de marcar seguimiento.
//
// Antes esta decisión se tomaba con un desplegable de tres opciones y nada más
// en pantalla. Aquí está la evidencia, en el orden en que se pregunta:
//
//   ¿está usando más Sacs? → ¿nos hemos visto? → ¿contestan? → ¿está sufriendo?
//
// No decide nada. La condición A sigue siendo de criterio y la marca una
// persona; esto solo hace que la marque mirando algo. Y sirve para lo otro que
// pidió el negocio: ver de un golpe qué cuenta necesita atención y dónde hay
// algo que venderle —los módulos que nunca ha tocado son justamente eso—.
import { useEffect, useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import Cargando from './ui/Cargando';

const E = {
  lbl: { fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', display: 'block', marginBottom: 4 },
  chip: { fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, display: 'inline-block' },
  caja: { background: '#fff', border: `1px solid ${P.linea}`, borderRadius: 10, padding: '12px 14px' } as const,
};

const fecha = (d?: string | null) => d
  ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '')
  : '—';

const ESTADO_REUNION: Record<string, { bg: string; fg: string; t: string }> = {
  asistio:    { bg: P.verdeAgua,   fg: P.verdeTinta,   t: 'Asistió' },
  no_asistio: { bg: P.rojoAgua,    fg: P.rojoTinta,    t: 'No asistió' },
  cancelada:  { bg: P.rojoAgua,    fg: P.rojoTinta,    t: 'Cancelada' },
  reagendada: { bg: P.ambarAgua,   fg: P.ambarTinta,   t: 'Reagendada' },
  agendada:   { bg: P.violetaAgua, fg: P.violetaTinta, t: 'Agendada' },
  confirmada: { bg: P.azulAgua,    fg: P.azulTinta,    t: 'Confirmada' },
};

/**
 * La minuta NO es texto: `bookings.minuta` es jsonb, y viene en dos formas.
 *
 *   · consultoría (20 de 24) — acuerdos, lo que le toca a Sacs, lo que le toca
 *     al cliente, qué se revisó y qué sigue;
 *   · demostración (4)       — ficha del prospecto, qué le duele, qué le
 *     mostramos, qué le interesó, objeciones, requerimientos cotizables.
 *
 * Las dos traen `raw`, la transcripción completa.
 *
 * Pintarla con `{r.minuta}` reventaba la pantalla entera con el React #31
 * ("objects are not valid as a React child") en CUALQUIER cuenta que tuviera
 * reuniones — es decir, justo las que importan. No se vio antes porque la
 * cuenta con la que se probó no tenía ninguna.
 *
 * Por eso este render es a prueba de formas: muestra lo conocido con su
 * etiqueta, y de lo desconocido solo lo que sea texto de verdad. Un valor que
 * no se sabe pintar se omite, nunca se pinta crudo.
 */
const ETIQUETAS_MINUTA: [string, string][] = [
  ['acuerdos', 'Acuerdos'],
  ['sacs', 'Le toca a Sacs'],
  ['cliente', 'Le toca al cliente'],
  ['siguiente', 'Qué sigue'],
  ['reviso', 'Qué se revisó'],
  ['duele', 'Qué le duele'],
  ['opera', 'Cómo opera'],
  ['mostramos', 'Qué le mostramos'],
  ['intereso', 'Qué le interesó'],
  ['objeciones', 'Objeciones'],
  ['decide', 'Quién decide'],
];

/** Devuelve texto pintable, o null si el valor no lo es. */
function comoTexto(v: any): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) return v.join('\n') || null;
  return null;
}

function Minuta({ m }: { m: any }) {
  // Defensa por si algún día llega como texto plano.
  if (typeof m === 'string') return <Parrafo>{m}</Parrafo>;
  if (!m || typeof m !== 'object') return null;

  const campos = ETIQUETAS_MINUTA
    .map(([k, label]) => [label, comoTexto(m[k])] as const)
    .filter(([, v]) => v);

  const ficha = m.ficha && typeof m.ficha === 'object' && !Array.isArray(m.ficha)
    ? Object.entries(m.ficha).map(([k, v]) => [k.replace(/_/g, ' '), comoTexto(v)] as const).filter(([, v]) => v)
    : [];

  const reqs = Array.isArray(m.requerimientos)
    ? m.requerimientos.filter((r: any) => r && typeof r === 'object' && typeof r.titulo === 'string')
    : [];

  return (
    <div style={{ fontSize: '0.75rem', color: '#555', lineHeight: 1.5 }}>
      {campos.map(([label, v]) => (
        <div key={label} style={{ marginBottom: 7 }}>
          <span style={E.lbl}>{label}</span>
          <Parrafo>{v!}</Parrafo>
        </div>
      ))}

      {ficha.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <span style={E.lbl}>Ficha</span>
          {ficha.map(([k, v]) => (
            <div key={k}><b style={{ textTransform: 'capitalize' }}>{k}:</b> {v}</div>
          ))}
        </div>
      )}

      {reqs.length > 0 && (
        <div style={{ marginBottom: 7 }}>
          <span style={E.lbl}>Lo que pidió</span>
          {reqs.map((r: any, i: number) => (
            <div key={i}>
              · {r.titulo}
              {Number(r.valor) > 0 && <b> · ${Math.round(Number(r.valor)).toLocaleString('es-MX')}</b>}
            </div>
          ))}
        </div>
      )}

      {typeof m.raw === 'string' && m.raw.trim() && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', color: P.violetaTinta, fontWeight: 700 }}>La transcripción completa</summary>
          <Parrafo alto>{m.raw}</Parrafo>
        </details>
      )}
    </div>
  );
}

function Parrafo({ children, alto }: { children: string; alto?: boolean }) {
  return (
    <div style={{ whiteSpace: 'pre-wrap', maxHeight: alto ? 340 : 200, overflowY: 'auto', marginTop: 2 }}>
      {children}
    </div>
  );
}

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: any }) {
  return (
    <div style={E.caja}>
      <div style={{ fontWeight: 800, fontSize: '0.78rem', color: P.tinta, marginBottom: nota ? 2 : 8 }}>{titulo}</div>
      {nota && <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: 8 }}>{nota}</div>}
      {children}
    </div>
  );
}

export default function SeguimientoCuenta({ companyId, nombre }: { companyId: string; nombre: string }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    let vivo = true;
    setD(null);
    fetch(`/api/crm/comisiones/seguimiento?company_id=${companyId}`)
      .then(r => r.json())
      .then(j => { if (!vivo) return; j.error ? setError(j.error) : setD(j); })
      .catch(e => vivo && setError(String(e)));
    return () => { vivo = false; };
  }, [companyId]);

  if (error) return <div style={{ ...E.caja, borderLeft: `3px solid ${P.rojo}`, color: P.rojoTinta, fontSize: '0.8rem' }}>{error}</div>;
  if (!d) return <Cargando texto={`Reuniendo el expediente de ${nombre}…`} alto={140} />;

  const { uso, evolucion: ev, reuniones: R, conversacion: C, soporte: S } = d;
  const delta = ev.delta;
  const tonoDelta = delta == null ? P.suave : delta > 0 ? P.verdeTinta : delta < 0 ? P.rojoTinta : P.suave;

  return (
    <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))' }}>

      {/* ── 1 · USO ── */}
      <Bloque titulo="Uso de Sacs" nota={uso.medido_el ? `Medido el ${fecha(uso.medido_el)} · ${uso.dias_con_dato} día(s) con dato` : undefined}>
        {uso.medido_el == null ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave }}>
            Esta cuenta no tiene lecturas de uso. No es que no use Sacs: es que no hay dato para afirmarlo.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: P.violetaTinta }}>{uso.modulos_activos}</span>
              <span style={{ fontSize: '0.78rem', color: P.suave }}>módulos con movimiento en 30 días</span>
            </div>

            {/* La evolución solo se muestra si hay contra qué compararla. */}
            {ev.comparable ? (
              <div style={{ fontSize: '0.78rem', color: P.texto, marginBottom: 8 }}>
                <b style={{ color: tonoDelta }}>{delta > 0 ? `+${delta}` : delta}</b>{' '}
                contra {ev.base} de su línea base
                <span style={{ color: '#999' }}> · {ev.dias === 0 ? 'congelada hoy' : `hace ${ev.dias} día(s)`}</span>
                {ev.dias != null && ev.dias < 30 && (
                  <div style={{ fontSize: '0.7rem', color: P.ambarTinta, marginTop: 3 }}>
                    Ventana todavía corta: se lee como tendencia, no como resultado del año.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: P.suave, marginBottom: 8 }}>Sin línea base: todavía no hay contra qué comparar.</div>
            )}

            {ev.ganados?.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={E.lbl}>Empezó a usar</span>
                {ev.ganados.map((m: string) => (
                  <span key={m} style={{ ...E.chip, background: P.verdeAgua, color: P.verdeTinta, marginRight: 4, marginBottom: 4, textTransform: 'none' }}>{m}</span>
                ))}
              </div>
            )}
            {ev.perdidos?.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={E.lbl}>Dejó de usar</span>
                {ev.perdidos.map((m: string) => (
                  <span key={m} style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta, marginRight: 4, marginBottom: 4, textTransform: 'none' }}>{m}</span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {Object.entries(uso.por_familia || {}).map(([f, n]: any) => (
                <span key={f} style={{ ...E.chip, background: P.violetaAgua, color: P.violetaTinta, textTransform: 'none' }}>{f} · {n}</span>
              ))}
            </div>

            <div style={{ fontSize: '0.75rem', color: P.suave, borderTop: `1px solid ${P.lineaSuave}`, paddingTop: 7 }}>
              Salud {uso.health_score ?? '—'} · {uso.ventas_30d ?? 0} venta(s) en 30 días
              {uso.dias_sin_venta != null && uso.dias_sin_venta > 0 && <> · {uso.dias_sin_venta} día(s) sin vender</>}
              {uso.usuarios_operando != null && <> · {uso.usuarios_operando} usuario(s)</>}
            </div>

            {/* Lo que nunca ha tocado ES la lista de lo que se le puede vender. */}
            {uso.nunca_usados?.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: P.violetaTinta, fontWeight: 700 }}>
                  Nunca ha usado {uso.nunca_usados.length} módulo(s) — ahí está lo vendible
                </summary>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {uso.nunca_usados.map((m: string) => (
                    <span key={m} style={{ ...E.chip, background: '#f6f6f6', color: '#777', textTransform: 'none' }}>{m}</span>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </Bloque>

      {/* ── 2 · REUNIONES ── */}
      <Bloque titulo="Reuniones" nota={`${R.asistidas} asistida(s) · ${R.no_asistidas} sin asistir · ${R.proximas} próxima(s)`}>
        {R.total === 0 && <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave }}>Ninguna reunión agendada con esta cuenta.</p>}
        {(verTodos ? R.lista : R.lista.slice(0, 4)).map((r: any) => {
          const t = ESTADO_REUNION[r.estado] || { bg: P.lineaSuave, fg: P.suave, t: r.estado };
          return (
            <div key={r.id} style={{ borderTop: `1px solid ${P.lineaSuave}`, padding: '8px 0' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: P.tinta }}>{fecha(r.fecha)}</span>
                <span style={{ ...E.chip, background: t.bg, color: t.fg }}>{t.t}</span>
                {r.serie_total > 1 && <span style={{ fontSize: '0.68rem', color: '#999' }}>{r.serie_indice}/{r.serie_total}</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: P.texto, marginTop: 2 }}>{r.asunto || 'Sin asunto'}</div>
              {r.minuta && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.72rem', color: P.violetaTinta, fontWeight: 700 }}>Ver la minuta</summary>
                  <div style={{ marginTop: 5 }}><Minuta m={r.minuta} /></div>
                </details>
              )}
            </div>
          );
        })}
        {R.lista.length > 4 && (
          <button onClick={() => setVerTodos(v => !v)} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: P.violetaTinta, fontWeight: 700 }}>
            {verTodos ? 'Ver menos' : `Ver las ${R.lista.length}`}
          </button>
        )}
      </Bloque>

      {/* ── 3 · CONVERSACIÓN ── */}
      <Bloque titulo="Conversación" nota="Por WhatsApp. Las llamadas no se registran en el CRM, así que no se pueden contar.">
        <div style={{ display: 'flex', gap: 18 }}>
          <div>
            <span style={E.lbl}>Les escribimos</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: P.tinta }}>{C.enviados}</div>
          </div>
          <div>
            <span style={E.lbl}>Contestaron</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: C.recibidos > 0 ? P.verdeTinta : P.rojoTinta }}>{C.recibidos}</div>
          </div>
          <div>
            <span style={E.lbl}>Contestaron 90 d</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: C.recibidos_90d > 0 ? P.verdeTinta : P.ambarTinta }}>{C.recibidos_90d}</div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: P.suave, marginTop: 8 }}>
          {C.ultimo ? <>Último mensaje: {fecha(String(C.ultimo).slice(0, 10))}</> : 'Sin conversación registrada.'}
        </div>
      </Bloque>

      {/* ── 4 · SOPORTE ── */}
      <Bloque titulo="Soporte" nota={`${S.abiertos} abierto(s)${S.negativos ? ` · ${S.negativos} con molestia` : ''}${S.csat != null ? ` · CSAT ${S.csat}` : ''}`}>
        {S.total === 0 && <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave }}>Sin tickets. Puede ser buena señal o que no estén usando el sistema.</p>}
        {S.total > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: P.violetaTinta }}>{S.total}</span>
              <span style={{ fontSize: '0.78rem', color: P.suave }}>ticket(s)</span>
            </div>
            <div style={{ maxHeight: 230, overflowY: 'auto' }}>
              {S.lista.map((t: any) => (
                <button key={t.id} onClick={() => setTicket(t)} style={{
                  display: 'block', width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer',
                  border: 'none', borderTop: `1px solid ${P.lineaSuave}`, padding: '7px 0', font: 'inherit',
                }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ ...E.chip, background: t.estado === 'resuelto' ? P.verdeAgua : P.ambarAgua, color: t.estado === 'resuelto' ? P.verdeTinta : P.ambarTinta }}>
                      {t.estado === 'resuelto' ? 'Resuelto' : 'Abierto'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#999' }}>{fecha(String(t.abierto_at || '').slice(0, 10))}</span>
                    {t.sentimiento === 'negativo' && <span style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta }}>Molesto</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: P.tinta, fontWeight: 600, marginTop: 2 }}>{t.asunto || 'Sin asunto'}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </Bloque>

      {ticket && <TicketDrawer t={ticket} onCerrar={() => setTicket(null)} />}
    </div>
  );
}

/** El ticket completo, sin sacar a nadie de la pantalla en la que estaba. */
function TicketDrawer({ t, onCerrar }: { t: any; onCerrar: () => void }) {
  // Escape cierra: es lo que la mano espera de un panel lateral.
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.35)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Ticket de soporte" style={{
        width: 'min(460px, 100%)', background: '#fff', height: '100%', overflowY: 'auto',
        padding: '20px 22px', boxShadow: '-8px 0 26px rgba(0,0,0,.13)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ ...E.chip, background: t.estado === 'resuelto' ? P.verdeAgua : P.ambarAgua, color: t.estado === 'resuelto' ? P.verdeTinta : P.ambarTinta }}>
            {t.estado === 'resuelto' ? 'Resuelto' : 'Abierto'}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#999', lineHeight: 1, padding: 0 }} aria-label="Cerrar">×</button>
        </div>

        <h3 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 800, color: P.tinta }}>{t.asunto || 'Sin asunto'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div><span style={E.lbl}>Abierto</span><div style={{ fontSize: '0.82rem' }}>{fecha(String(t.abierto_at || '').slice(0, 10))}</div></div>
          <div><span style={E.lbl}>Resuelto</span><div style={{ fontSize: '0.82rem' }}>{t.resuelto_at ? fecha(String(t.resuelto_at).slice(0, 10)) : '—'}</div></div>
          <div><span style={E.lbl}>Tema</span><div style={{ fontSize: '0.82rem' }}>{t.tema || '—'}</div></div>
          <div><span style={E.lbl}>Mensajes</span><div style={{ fontSize: '0.82rem' }}>{t.mensajes_count ?? '—'}</div></div>
          <div><span style={E.lbl}>Sentimiento</span><div style={{ fontSize: '0.82rem', color: t.sentimiento === 'negativo' ? P.rojoTinta : P.texto }}>{t.sentimiento || '—'}</div></div>
          <div><span style={E.lbl}>CSAT</span><div style={{ fontSize: '0.82rem' }}>{t.csat_score ?? '—'}</div></div>
        </div>

        {t.vista_previa && (
          <>
            <span style={E.lbl}>Lo que escribió el cliente</span>
            <div style={{ fontSize: '0.82rem', color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.55, background: '#fafafa', border: `1px solid ${P.lineaSuave}`, borderRadius: 8, padding: '10px 12px' }}>
              {t.vista_previa}
            </div>
          </>
        )}

        {t.intercom_url && (
          <a href={t.intercom_url} target="_blank" rel="noopener" style={{
            display: 'inline-block', marginTop: 14, padding: '8px 14px', borderRadius: 9,
            border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, textDecoration: 'none',
            fontSize: '0.8rem', fontWeight: 700,
          }}>Abrir la conversación completa</a>
        )}
      </div>
    </div>
  );
}
