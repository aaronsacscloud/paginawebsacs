// Comisiones · Cortes — el ciclo semanal, operable.
//
// La pantalla existe para tres momentos concretos, y está ordenada en ese mismo
// orden porque es la secuencia de cada lunes:
//
//   1. generar el corte de la semana (o uno manual para un periodo suelto),
//   2. revisarlo: qué líneas trae y qué pagos NO alcanzó a comisionar,
//   3. cerrarlo, mandárselo al consultor y marcarlo pagado.
//
// Lo que la hace útil de verdad es la lista de pagos sin comisionar: dinero que
// entró y que el motor no supo repartir. Desde ahí se convierte en ajuste con
// un clic, en vez de quedarse invisible hasta que alguien lo note en el banco.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
import Cargando, { Chispas } from './ui/Cargando';
import { confirmar } from '../../../lib/ui/confirmar';
import { explicar, CUENTAS } from '../../../lib/crm/comisiones.lib';

// El signo va ANTES del peso: "−$800", no "$-800". Es dinero y se lee de reojo.
const pesos = (n: number) => {
  const v = Math.round(Number(n || 0));
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-MX');
};
const conDia = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')
  : '—';

const fechaLarga = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  : '—';

const fecha = (d?: string | null) => d
  ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '')
  : '—';

const E = {
  card: { background: P.papel, border: `1px solid ${P.linea}`, borderRadius: 12, padding: '15px 17px' } as const,
  lbl: { fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', display: 'block', marginBottom: 4 },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' as const },
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: P.violeta, color: '#fff' } as const,
  btn2: { padding: '7px 13px', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta } as const,
  btn3: { padding: '7px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', border: '1px solid #ddd', color: '#444' } as const,
  th: { textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', padding: '9px 10px', borderBottom: `1px solid ${P.linea}`, whiteSpace: 'nowrap' as const },
  td: { padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, fontSize: '0.82rem', color: P.texto, verticalAlign: 'top' as const },
  chip: { fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, display: 'inline-block' },
};

/** Nombres cortos: en una celda de tabla, "Cuenta corporativa" no cabe. */
const ETIQUETA_CUENTA: Record<string, string> = {
  corporativa: 'Corporativa', pagadora: 'Pagadora', ninguna: 'Sin descuento',
};

const DIA_NOMBRE: Record<number, string> = { 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado', 7: 'domingo' };

const TONO: Record<string, { bg: string; fg: string; label: string }> = {
  abierto: { bg: P.violetaAgua, fg: P.violetaTinta, label: 'Abierto' },
  cerrado: { bg: P.azulAgua, fg: P.azulTinta, label: 'Enviado' },
  pagado: { bg: P.verdeAgua, fg: P.verdeTinta, label: 'Pagado' },
};

export default function ComisionesCortes({ movil }: { movil: boolean }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [det, setDet] = useState<any>(null);
  const [asistente, setAsistente] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [creandoYa, setCreandoYa] = useState(false);

  /**
   * Vuelve a calcular EXACTAMENTE lo que mirará el próximo corte: su periodo más
   * la ventana de rezagadas.
   *
   * Antes decía "recalcular el mes" y recalculaba mes en curso más el anterior.
   * Era el botón heredado de la vista Periodo y no tenía nada que ver con el
   * ciclo: en una pantalla que habla de semanas, un botón que habla de meses
   * obliga a preguntarse qué acaba de pasar. Ahora se llama actualizar y su
   * alcance es el del corte que se está juntando, que es lo que se está mirando.
   */
  async function recalcular() {
    const f = d?.en_formacion;
    if (!f) return;
    const desde = d?.ciclo?.arrastrar_desde && d.ciclo.arrastrar_desde < f.desde
      ? d.ciclo.arrastrar_desde : f.desde;
    const hoy = new Date().toISOString().slice(0, 10);
    const hasta = f.hasta > hoy ? hoy : f.hasta;
    setRecalculando(true);
    try {
      const r = await fetch('/api/crm/comisiones/periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'recalcular', desde, hasta }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Error'); return; }
      setError(null);
      await cargar();
      if (abierto) await cargarDetalle(abierto);
    } catch (e: any) { setError(e.message); } finally { setRecalculando(false); }
  }

  /**
   * Adelanta el corte que se está juntando. Usa el MISMO camino que el cron
   * —sin fechas = el ciclo— para que adelantarlo y esperarlo den lo mismo.
   */
  async function crearYa() {
    if (!(await confirmar('¿Crear ya el corte de este periodo con lo que lleva? Queda abierto: podrás seguir ajustándolo hasta que lo cierres.'))) return;
    setCreandoYa(true);
    try {
      const r = await fetch('/api/crm/comisiones/cortes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Error'); return; }
      setError(null);
      await cargar();
      const nuevo = j.resultado?.cortes?.[0]?.id;
      if (nuevo) await cargarDetalle(nuevo);
    } catch (e: any) { setError(e.message); } finally { setCreandoYa(false); }
  }

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch('/api/crm/comisiones/cortes');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setD(j);
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  /**
   * Trae el detalle SIN alternar. Separado de `verDetalle` porque mezclarlos
   * dejaba el panel cargando para siempre: refrescar tras un cambio llamaba al
   * mismo botón que cierra, así que se cerraba (det = null) y enseguida se
   * volvía a marcar como abierto — con el detalle ya vaciado y nadie pidiéndolo
   * de nuevo. Se veía al agregar un ajuste.
   */
  async function cargarDetalle(id: string) {
    const r = await fetch(`/api/crm/comisiones/cortes?id=${id}`);
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    setDet(j); setAbierto(id);
  }

  async function verDetalle(id: string) {
    if (abierto === id) { setAbierto(null); setDet(null); return; }
    setAbierto(id); setDet(null);
    await cargarDetalle(id);
  }

  async function accionCorte(id: string, accion: string) {
    const textos: Record<string, string> = {
      cerrar: '¿Cerrar el corte? Deja de absorber cosas nuevas y queda listo para enviarse. Lo que llegue después entra al siguiente.',
      reabrir: '¿Reabrir el corte para que vuelva a absorber líneas y ajustes?',
      pagar: '¿Marcar el corte como pagado? Sus líneas quedan congeladas y el recálculo ya no las toca.',
    };
    if (textos[accion] && !(await confirmar(textos[accion]))) return;
    const referencia = accion === 'pagar' ? (window.prompt('Referencia del pago (opcional):') ?? null) : '';
    if (accion === 'pagar' && referencia === null) return;
    const r = await fetch('/api/crm/comisiones/cortes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, accion, referencia }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    setError(null);
    await cargar(); await cargarDetalle(id);
  }

  if (cargando && !d) return <Cargando texto="Cargando cortes…" />;

  const cortes = d?.cortes || [];
  const porPagar = cortes.filter((c: any) => c.estado !== 'pagado')
    .reduce((a: number, c: any) => a + Number(c.total || 0), 0);

  return (
    <>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => setAsistente(true)} style={{ ...E.btn, padding: '10px 18px', fontSize: '0.85rem' }}>Crear nuevo corte</button>
        {d?.en_formacion && (
          <span style={{ fontSize: '0.82rem', color: P.texto }}>
            Próximo corte: <b>{fechaLarga(d.en_formacion.se_arma_el)}</b> a las {d.en_formacion.hora}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <a href="/admin/crm?tab=config&cfg=comisiones" style={{ ...E.btn3, textDecoration: 'none' }}>Configurar el ciclo</a>
      </div>

      {asistente && <Asistente sugerido={d?.sugerido} ciclo={d?.ciclo}
        onCerrar={() => setAsistente(false)}
        onListo={async () => { setAsistente(false); await cargar(); }}
        onError={setError} />}

      {/* ── Ajustes que todavía no entran a ningún corte ── */}
      {(d?.pendientes || []).length > 0 && (
        <div style={{ ...E.card, borderLeft: `3px solid ${P.ambar}`, background: P.ambarAgua, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.ambarTinta, marginBottom: 6 }}>
            {d.pendientes.length} ajuste(s) esperando el próximo corte
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: P.texto, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {d.pendientes.map((a: any, i: number) => (
              <li key={i}><b>{a.nombre}</b> · {a.concepto} · <b style={{ color: a.tipo === 'cargo' ? P.rojoTinta : P.verdeTinta }}>
                {a.tipo === 'cargo' ? '−' : '+'}{pesos(a.monto)}</b></li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '170px'}, 1fr))`, gap: 11, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.ambar)}>
          <span style={E.lbl}>Por pagar en cortes abiertos</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ambarTinta }}>{pesos(porPagar)}</div>
        </div>
        <div style={tarjetaKpi(P.violeta)}>
          <span style={E.lbl}>Cortes</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta }}>{cortes.length}</div>
        </div>
      </div>

      {cortes.length === 0 && !(d?.en_formacion?.consultores || []).length ? (
        <div style={{ ...E.card, color: P.suave, fontSize: '0.85rem' }}>
          Todavía no hay cortes ni comisiones juntándose. Si esperabas ver algo, revisa que las cuentas con pagos tengan consultor asignado en <b>Configuración › Comisiones</b>.
        </div>
      ) : (
        <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead><tr>
              <th style={E.th}>Consultor</th><th style={E.th}>Periodo</th><th style={E.th}>Paga el</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Líneas</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Ajustes</th>
              <th style={{ ...E.th, textAlign: 'right' }}>Total</th>
              <th style={E.th}>Estado</th><th style={{ ...E.th, width: 90 }} />
            </tr></thead>
            <tbody>
              {/* ── Lo que se está juntando ahora ──
                  Va ARRIBA y con la fila punteada porque todavía no existe: es
                  una proyección con las mismas reglas del cron, no un registro.
                  Sin esto había que esperar al lunes para saber cuánto se va a
                  pagar, que es la pregunta de todos los días. */}
              {(d?.en_formacion?.consultores || []).map((f: any) => (
                <tr key={'form-' + f.owner_id} style={{ background: '#fbfaff' }}>
                  <td style={{ ...E.td, fontWeight: 700, color: P.tinta, borderLeft: `3px dashed ${P.violeta}` }}>
                    {f.nombre}
                    <span style={{ ...E.chip, background: P.violetaAgua, color: P.violetaTinta, marginLeft: 6 }}>en formación</span>
                  </td>
                  <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{conDia(d.en_formacion.desde)} — {conDia(d.en_formacion.hasta)}</td>
                  <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(d.en_formacion.paga_el)}</td>
                  <td style={{ ...E.td, textAlign: 'right' }}>
                    {f.lineas}
                    {f.rezagadas > 0 && <div style={{ fontSize: '0.68rem', color: '#999' }}>{f.rezagadas} rezagada(s)</div>}
                  </td>
                  <td style={{ ...E.td, textAlign: 'right', color: f.monto_ajustes < 0 ? P.rojoTinta : P.texto }}>
                    {f.monto_ajustes === 0 ? '—' : (f.monto_ajustes > 0 ? '+' : '') + pesos(f.monto_ajustes)}
                  </td>
                  <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>
                    {pesos(f.total)}
                    <div style={{ fontSize: '0.68rem', color: '#999', fontWeight: 500 }}>hasta ahora</div>
                  </td>
                  <td style={E.td}>
                    <span style={{ fontSize: '0.72rem', color: P.suave }}>
                      Se arma el <b>{fechaLarga(d.en_formacion.se_arma_el)}</b><br />a las {d.en_formacion.hora}
                    </span>
                  </td>
                  <td style={E.td}>
                    {/* Adelantarlo lo vuelve un corte de verdad, y desde ahí ya
                        se edita como cualquiera: cambiar %, cuenta o ajustes. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={crearYa} disabled={creandoYa}
                        title="Créalo ahora con lo que lleva, en vez de esperar al lunes. Queda abierto y editable."
                        style={{ ...E.btn3, padding: '3px 9px', opacity: creandoYa ? 0.6 : 1 }}>
                        {creandoYa ? '…' : 'Crear ya'}
                      </button>
                      <button onClick={recalcular} disabled={recalculando}
                        title="Vuelve a calcular este periodo con los pagos que hayan entrado desde la última madrugada."
                        style={{ ...E.btn3, padding: '3px 9px', opacity: recalculando ? 0.6 : 1 }}>
                        {recalculando ? <><Chispas size={9} /> …</> : 'Actualizar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cortes.map((c: any) => {
                const t = TONO[c.estado] || TONO.abierto;
                return (
                  <tr key={c.id} style={abierto === c.id ? { background: P.violetaAgua } : undefined}>
                    <td style={{ ...E.td, fontWeight: 700, color: P.tinta }}>
                      {c.team_members?.nombre || '—'}
                      {!c.automatico && <span style={{ ...E.chip, background: P.lineaSuave, color: P.suave, marginLeft: 6 }}>manual</span>}
                    </td>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(c.desde)} — {fecha(c.hasta)}</td>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(c.paga_el)}</td>
                    <td style={{ ...E.td, textAlign: 'right' }}>{c.lineas}</td>
                    <td style={{ ...E.td, textAlign: 'right', color: Number(c.monto_ajustes) < 0 ? P.rojoTinta : P.texto }}>
                      {Number(c.monto_ajustes) === 0 ? '—' : (Number(c.monto_ajustes) > 0 ? '+' : '') + pesos(Number(c.monto_ajustes))}
                    </td>
                    <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(c.total)}</td>
                    <td style={E.td}><span style={{ ...E.chip, background: t.bg, color: t.fg }}>{t.label}</span></td>
                    <td style={E.td}>
                      <button onClick={() => verDetalle(c.id)} style={{ ...E.btn3, padding: '3px 9px' }}>
                        {abierto === c.id ? 'Cerrar' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierto && <Detalle det={det} movil={movil}
        onAccion={(a) => accionCorte(abierto, a)}
        onCambio={async () => { await cargar(); await cargarDetalle(abierto); }}
        onError={setError} />}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ASISTENTE · crear un corte en tres pasos
   ══════════════════════════════════════════════════════════════════
   Antes esto eran dos botones y dos campos de fecha sueltos arriba de la
   pantalla: ocupaban el lugar de lo que se viene a hacer todos los días, que es
   revisar los cortes que ya existen. Ahora se pide cuando se necesita, y el
   paso 2 enseña lo que va a pasar ANTES de que pase — que es la diferencia
   entre generar y adivinar. */
function Asistente({ sugerido, ciclo, onCerrar, onListo, onError }: {
  sugerido?: { desde: string; hasta: string; paga_el: string };
  ciclo?: { dia_cierre: number; dias_a_pago: number };
  onCerrar: () => void; onListo: () => void; onError: (m: string) => void;
}) {
  const [paso, setPaso] = useState(1);
  const [modo, setModo] = useState<'ciclo' | 'manual'>('ciclo');
  const [rango, setRango] = useState({ desde: sugerido?.desde || '', hasta: sugerido?.hasta || '' });
  const [previa, setPrevia] = useState<any>(null);
  const [trabajando, setTrabajando] = useState(false);

  const esCiclo = modo === 'ciclo';
  const desde = esCiclo ? (sugerido?.desde || '') : rango.desde;
  const hasta = esCiclo ? (sugerido?.hasta || '') : rango.hasta;
  const pagaEl = esCiclo ? sugerido?.paga_el : null;

  // El paso 2 consulta el periodo SIN escribir nada: se ve qué va a entrar
  // antes de crear el corte.
  async function verPrevia() {
    setTrabajando(true);
    try {
      // Dos preguntas al mismo tiempo: qué hay en el periodo, y qué de eso YA
      // está cobrado en otro corte. La segunda es la que evita pagar dos veces.
      const [r, r2] = await Promise.all([
        fetch(`/api/crm/comisiones/periodo?desde=${desde}&hasta=${hasta}`),
        fetch(`/api/crm/comisiones/cortes?previa_desde=${desde}&previa_hasta=${hasta}`),
      ]);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      const j2 = r2.ok ? await r2.json() : { ya_cortadas: null };
      setPrevia({ ...j, ya_cortadas: j2.ya_cortadas }); setPaso(2);
    } catch (e: any) { onError(e.message); } finally { setTrabajando(false); }
  }

  async function crear() {
    setTrabajando(true);
    try {
      const r = await fetch('/api/crm/comisiones/cortes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esCiclo ? {} : { desde, hasta }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      if (j.resultado?.errores?.length) onError(j.resultado.errores.join(' · '));
      setPrevia({ ...previa, resultado: j.resultado }); setPaso(3);
    } catch (e: any) { onError(e.message); } finally { setTrabajando(false); }
  }

  const PASOS = ['Periodo', 'Qué va a entrar', 'Listo'];

  return (
    <div role="dialog" aria-modal="true" aria-label="Crear nuevo corte"
      onClick={e => { if (e.target === e.currentTarget && paso !== 3) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(36,29,67,.34)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640,
        maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px -20px rgba(36,29,67,.4)' }}>

        {/* pasos */}
        <div style={{ display: 'flex', gap: 6, padding: '16px 20px 12px', borderBottom: `1px solid ${P.linea}` }}>
          {PASOS.map((t, i) => (
            <div key={t} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ height: 3, borderRadius: 2, background: paso >= i + 1 ? P.violeta : P.linea }} />
              <span style={{ fontSize: '0.68rem', fontWeight: paso === i + 1 ? 800 : 600,
                color: paso >= i + 1 ? P.violetaTinta : P.gris }}>{i + 1}. {t}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 20px 20px' }}>
          {paso === 1 && (
            <>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: P.tinta, marginBottom: 10 }}>¿Qué periodo se corta?</div>
              <label style={{ display: 'flex', gap: 10, padding: '13px 14px', border: `1.5px solid ${esCiclo ? P.violeta : P.linea}`,
                background: esCiclo ? P.violetaAgua : '#fff', borderRadius: 10, cursor: 'pointer', marginBottom: 9 }}>
                <input type="radio" checked={esCiclo} onChange={() => setModo('ciclo')} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.87rem', color: P.tinta }}>El corte que se está juntando</div>
                  <div style={{ fontSize: '0.78rem', color: P.suave, marginTop: 2 }}>
                    {sugerido
                      ? <>De <b>{conDia(sugerido.desde)}</b> a <b>{conDia(sugerido.hasta)}</b>, se paga el <b>{fechaLarga(sugerido.paga_el)}</b>.
                          {' '}Es el mismo que se armaría solo el {fechaLarga((sugerido as any).se_arma_el)}: adelantarlo no cambia el resultado.</>
                      : 'Calculando…'}
                    {ciclo && <><br />La semana son 7 días y cierra el <b>{DIA_NOMBRE[ciclo.dia_cierre]}</b>, así que empieza el día siguiente
                      al cierre anterior. Se cambia en Configuración › Comisiones.</>}
                  </div>
                </div>
              </label>
              <label style={{ display: 'flex', gap: 10, padding: '13px 14px', border: `1.5px solid ${!esCiclo ? P.violeta : P.linea}`,
                background: !esCiclo ? P.violetaAgua : '#fff', borderRadius: 10, cursor: 'pointer' }}>
                <input type="radio" checked={!esCiclo} onChange={() => setModo('manual')} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.87rem', color: P.tinta }}>Un periodo específico</div>
                  <div style={{ fontSize: '0.78rem', color: P.suave, marginTop: 2, marginBottom: !esCiclo ? 9 : 0 }}>
                    Para un corte fuera del ciclo. No sustituye al automático de esa semana.
                  </div>
                  {!esCiclo && (
                    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                      <div><label style={E.lbl}>Desde</label>
                        <input type="date" value={rango.desde} onChange={e => setRango({ ...rango, desde: e.target.value })} style={E.input} /></div>
                      <div><label style={E.lbl}>Hasta</label>
                        <input type="date" value={rango.hasta} onChange={e => setRango({ ...rango, hasta: e.target.value })} style={E.input} /></div>
                    </div>
                  )}
                </div>
              </label>
              <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
                <button onClick={onCerrar} style={E.btn3}>Cancelar</button>
                <button onClick={verPrevia} disabled={trabajando || !desde || !hasta || hasta < desde}
                  style={{ ...E.btn, opacity: trabajando || !desde || !hasta || hasta < desde ? 0.55 : 1 }}>
                  {trabajando ? <><Chispas size={10} color="#fff" /> Revisando…</> : 'Ver qué va a entrar'}
                </button>
              </div>
            </>
          )}

          {paso === 2 && previa && (
            <>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: P.tinta, marginBottom: 3 }}>Esto es lo que va a entrar</div>
              <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: P.suave }}>
                Del {desde} al {hasta}{pagaEl ? <> · se pagaría el <b>{pagaEl}</b></> : null}. Todavía no se ha creado nada.
              </p>
              {previa.resumen.length === 0 ? (
                <div style={{ ...E.card, borderLeft: `3px solid ${P.ambar}`, background: P.ambarAgua, fontSize: '0.83rem', color: P.texto }}>
                  <b>No hay comisiones en este periodo.</b> El corte nacería vacío. Suele ser porque las cuentas con pagos de esos días todavía no tienen consultor asignado.
                </div>
              ) : (
                <div style={{ border: `1px solid ${P.linea}`, borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr><th style={E.th}>Consultor</th><th style={{ ...E.th, textAlign: 'right' }}>Líneas</th><th style={{ ...E.th, textAlign: 'right' }}>Total</th></tr></thead>
                    <tbody>
                      {previa.resumen.map((f: any) => (
                        <tr key={f.owner_id}>
                          <td style={{ ...E.td, fontWeight: 700, color: P.tinta }}>{f.nombre}</td>
                          <td style={{ ...E.td, textAlign: 'right' }}>{f.lineas}</td>
                          <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(f.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {previa.ya_cortadas?.total > 0 && (
                <div style={{ marginTop: 11, padding: '11px 13px', background: P.azulAgua, borderRadius: 9, fontSize: '0.8rem', color: P.texto }}>
                  <b>{previa.ya_cortadas.total} línea(s)</b> por {pesos(previa.ya_cortadas.monto)} de este periodo
                  {' '}<b>ya están en otro corte</b> y no se van a volver a cobrar. El corte nuevo se queda solo con lo que falta.
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', color: P.azulTinta, fontWeight: 700, fontSize: '0.76rem' }}>Ver cuáles</summary>
                    <div style={{ maxHeight: 190, overflowY: 'auto', marginTop: 6 }}>
                      {previa.ya_cortadas.detalle.map((d: any, i: number) => (
                        <div key={i} style={{ fontSize: '0.76rem', padding: '3px 0', borderBottom: `1px solid ${P.lineaSuave}` }}>
                          <b>{d.cliente}</b> · {fecha(d.fecha)} · {pesos(d.monto)}
                          <span style={{ color: '#999' }}> — corte {d.periodo} ({TONO[d.estado]?.label || d.estado})</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {previa.sin_atribuir?.pagos > 0 && (
                <div style={{ marginTop: 11, padding: '11px 13px', background: P.ambarAgua, borderRadius: 9, fontSize: '0.8rem', color: P.texto }}>
                  <b>{previa.sin_atribuir.pagos} pago(s)</b> por {pesos(previa.sin_atribuir.monto)} de este periodo no le cuentan a nadie. Podrás agregarlos como ajuste dentro del corte.
                </div>
              )}
              <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
                <button onClick={() => setPaso(1)} style={E.btn3}>Atrás</button>
                <button onClick={crear} disabled={trabajando} style={{ ...E.btn, opacity: trabajando ? 0.55 : 1 }}>
                  {trabajando ? <><Chispas size={10} color="#fff" /> Creando…</> : 'Crear el corte'}
                </button>
              </div>
            </>
          )}

          {paso === 3 && (
            <>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: P.verdeTinta, marginBottom: 8 }}>Corte creado</div>
              <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: '0.83rem', color: P.texto, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><b>{previa?.resultado?.cortes?.length || 0}</b> corte(s), del {desde} al {hasta}.</li>
                {previa?.resultado?.ajustes_absorbidos > 0 && <li><b>{previa.resultado.ajustes_absorbidos}</b> ajuste(s) pendientes entraron a este corte.</li>}
                {previa?.resultado?.rezagadas > 0 && <li><b>{previa.resultado.rezagadas}</b> línea(s) rezagada(s) de semanas anteriores, por {pesos(previa.resultado.monto_rezagado)}.</li>}
                {previa?.resultado?.ya_cortadas?.total > 0 && (
                  <li><b>{previa.resultado.ya_cortadas.total}</b> línea(s) por {pesos(previa.resultado.ya_cortadas.monto)} se
                  {' '}<b>dejaron fuera</b>: ya estaban en otro corte y no se cobran dos veces.</li>
                )}
                {previa?.resultado?.omitidos?.length > 0 && (
                  <li>{previa.resultado.omitidos.length} consultor(es) omitidos: {previa.resultado.omitidos.map((o: any) => o.motivo).join(' · ')}.</li>
                )}
              </ul>
              <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: P.suave }}>
                Queda <b>abierto</b>: revísalo, agrega lo que falte y ciérralo cuando esté listo para enviarse.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onListo} style={E.btn}>Ver los cortes</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DETALLE DE UN CORTE
   ══════════════════════════════════════════════════════════════════ */
/**
 * El % de una línea, editable en el sitio.
 *
 * Se confirma con Enter o al salir del campo, y Escape cancela. El valor
 * mostrado se resincroniza con el de la línea después de guardar, porque el
 * servidor puede devolver otro —al vaciarlo, la tarifa configurada— y dejar en
 * pantalla lo que se tecleó haría creer que se guardó algo distinto.
 */
function PctEditable({ linea, onGuardar }: { linea: any; onGuardar: (l: any, pct: string) => Promise<boolean> }) {
  const actual = linea.sin_regla && linea.pct_manual == null ? '' : String(Number(linea.pct));
  const [v, setV] = useState(actual);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setV(actual); /* eslint-disable-next-line */ }, [linea.pct, linea.pct_manual]);

  async function confirmarValor() {
    if (v === actual || ocupado) return;
    setOcupado(true);
    const ok = await onGuardar(linea, v);
    if (!ok) setV(actual);
    setOcupado(false);
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <input type="number" min={0} max={100} value={v} disabled={ocupado}
        title="Cambia el % solo para esta línea. Vacío lo devuelve a la tarifa configurada."
        onChange={e => setV(e.target.value)}
        onBlur={confirmarValor}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setV(actual); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          width: 56, padding: '4px 6px', textAlign: 'right', fontSize: '0.82rem', fontFamily: 'inherit',
          border: `1px solid ${linea.pct_manual != null ? P.ambar : '#e2e2e2'}`, borderRadius: 6,
          background: linea.pct_manual != null ? P.ambarAgua : '#fff',
          color: linea.pct_manual != null ? P.ambarTinta : P.texto,
          fontWeight: linea.pct_manual != null ? 800 : 400, outline: 'none',
        }} />
      <span style={{ color: '#aaa', fontSize: '0.75rem' }}>%</span>
    </span>
  );
}

/**
 * A qué cuenta entró el pago, corregible en el sitio.
 *
 * Cambiarlo rehace la base y la comisión, así que el renglón entero se mueve al
 * guardar. Se muestra el descuento junto al nombre porque el nombre solo no dice
 * nada: lo que importa es que son 16 puntos contra 6.
 */
function CuentaEditable({ linea, onGuardar }: { linea: any; onGuardar: (l: any, cuenta: string) => Promise<boolean> }) {
  const [ocupado, setOcupado] = useState(false);
  const corregida = !!linea.cuenta_manual;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <select value={linea.cuenta || 'corporativa'} disabled={ocupado}
        title="A qué cuenta entró el pago. Decide cuánto se descuenta antes de comisionar."
        onChange={async e => { setOcupado(true); await onGuardar(linea, e.target.value); setOcupado(false); }}
        style={{
          padding: '4px 6px', fontSize: '0.78rem', fontFamily: 'inherit', borderRadius: 6, outline: 'none',
          border: `1px solid ${corregida ? P.ambar : '#e2e2e2'}`,
          background: corregida ? P.ambarAgua : '#fff',
          color: corregida ? P.ambarTinta : P.texto,
          fontWeight: corregida ? 800 : 400,
        }}>
        {CUENTAS.map(c => <option key={c.v} value={c.v}>{ETIQUETA_CUENTA[c.v]}</option>)}
      </select>
      <span style={{ fontSize: '0.68rem', color: '#999' }}>
        −{Number(linea.descuento_pct)}%{corregida ? ' · corregida' : ''}
      </span>
    </span>
  );
}

function Detalle({ det, movil, onAccion, onCambio, onError }: {
  det: any; movil: boolean;
  onAccion: (a: string) => void; onCambio: () => void; onError: (m: string) => void;
}) {
  const [nuevo, setNuevo] = useState({ tipo: 'abono', concepto: '', monto: '', nota: '' });
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!det) return <div style={{ marginTop: 14 }}><Cargando texto="Abriendo el corte…" alto={180} /></div>;
  const c = det.corte;
  const firme = c.estado !== 'abierto';
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/comisiones/${c.id}` : '';

  async function agregar(pago?: any) {
    const cuerpo = pago
      ? { tipo: 'abono', concepto: `Pago no reconocido · ${pago.empresa}`, monto: pago.monto, payment_id: pago.id, nota: pago.motivo }
      : { tipo: nuevo.tipo, concepto: nuevo.concepto, monto: Number(nuevo.monto), nota: nuevo.nota };
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/comisiones/ajustes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corte_id: c.id, owner_id: c.owner_id, ...cuerpo }),
      });
      const j = await r.json();
      if (!r.ok) { onError(j.error || 'Error'); return; }
      if (j.aviso) onError(j.aviso);
      if (!pago) setNuevo({ tipo: 'abono', concepto: '', monto: '', nota: '' });
      onCambio();
    } finally { setGuardando(false); }
  }

  /**
   * Guarda el % de una línea. La nota se pide SOLO al poner un ajuste, no al
   * quitarlo: quitarlo devuelve la línea a la tarifa configurada, que no
   * necesita explicación.
   */
  async function cambiarPct(l: any, pct: string) {
    let nota = '';
    if (pct !== '') {
      const n = window.prompt(
        `¿Por qué esta línea cobra ${pct}% en vez de ${Number(l.pct)}%?\n` +
        'Queda escrito en el estado de cuenta que recibe el consultor.');
      if (n === null) return false;          // Cancelar no cambia nada
      nota = n.trim();
      if (!nota) { onError('Escribe el motivo: sin él, en tres meses nadie sabrá por qué esta línea cobró distinto.'); return false; }
    }
    const r = await fetch('/api/crm/comisiones/lineas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, pct, nota }),
    });
    const j = await r.json();
    if (!r.ok) { onError(j.error || 'Error'); return false; }
    onCambio();
    return true;
  }

  /** Corrige a qué cuenta entró el pago. No pide motivo: es un dato, no un trato. */
  async function cambiarCuenta(l: any, cuenta: string) {
    const r = await fetch('/api/crm/comisiones/lineas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, cuenta }),
    });
    const j = await r.json();
    if (!r.ok) { onError(j.error || 'Error'); return false; }
    onCambio();
    return true;
  }

  async function quitar(id: string) {
    if (!(await confirmar('¿Quitar este ajuste del corte?'))) return;
    const r = await fetch(`/api/crm/comisiones/ajustes?id=${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) { onError(j.error || 'Error'); return; }
    onCambio();
  }

  return (
    <div style={{ ...E.card, marginTop: 14, borderLeft: `3px solid ${P.violeta}` }}>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: '0.95rem', color: P.tinta }}>
          {c.team_members?.nombre} · {fecha(c.desde)} — {fecha(c.hasta)}
        </strong>
        <span style={{ fontWeight: 800, color: P.violetaTinta }}>{pesos(c.total)}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => { navigator.clipboard?.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} style={E.btn3}>
          {copiado ? '✓ Copiado' : 'Copiar enlace'}
        </button>
        <a href={enlace} target="_blank" rel="noopener" style={{ ...E.btn3, textDecoration: 'none', display: 'inline-block' }}>Ver estado de cuenta</a>
        {c.estado === 'abierto' && <button onClick={() => onAccion('cerrar')} style={E.btn2}>Cerrar y enviar</button>}
        {c.estado === 'cerrado' && <button onClick={() => onAccion('reabrir')} style={E.btn3}>Reabrir</button>}
        {c.estado !== 'pagado' && <button onClick={() => onAccion('pagar')} style={E.btn}>Marcar pagado</button>}
      </div>

      {/* ── Líneas ── */}
      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 840 }}>
          <thead><tr>
            <th style={E.th}>Fecha</th><th style={E.th}>Cliente</th><th style={E.th}>Concepto</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Pagó el cliente</th>
            <th style={E.th}>Entró a</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Base</th>
            <th style={{ ...E.th, textAlign: 'right' }}>%</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Comisión</th>
          </tr></thead>
          <tbody>
            {det.lineas.length === 0 && <tr><td style={{ ...E.td, color: P.suave }} colSpan={8}>Sin comisiones de venta: el total sale de los ajustes.</td></tr>}
            {det.lineas.map((l: any) => (
              <tr key={l.id}>
                <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(l.fecha)}</td>
                <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{l.companies?.nombre_comercial || l.companies?.nombre || '—'}</td>
                <td style={E.td}>
                  {l.concepto || 'Sin SKU'}
                  {l.pct_manual != null && (
                    <span style={{ ...E.chip, background: P.ambarAgua, color: P.ambarTinta, marginLeft: 6 }}>% a mano</span>
                  )}
                  <div style={{ fontSize: '0.68rem', color: '#999', marginTop: 2 }}>{explicar(l)}</div>
                </td>
                {/* Lo que de verdad salió de la cuenta del cliente, impuestos
                    incluidos: el numero que se teclea al registrar el pago. Es
                    el ancla para cuadrar contra el banco, y estaba solo dentro
                    del renglon de explicacion. */}
                <td style={{ ...E.td, textAlign: 'right', whiteSpace: 'nowrap' }}>{pesos(l.monto_bruto)}</td>
                <td style={E.td}>
                  {firme
                    ? <span style={{ fontSize: '0.78rem' }}>{ETIQUETA_CUENTA[l.cuenta] || l.cuenta} · −{Number(l.descuento_pct)}%</span>
                    : <CuentaEditable linea={l} onGuardar={cambiarCuenta} />}
                </td>
                <td style={{ ...E.td, textAlign: 'right' }}>{pesos(l.base)}</td>
                <td style={{ ...E.td, textAlign: 'right' }}>
                  {firme
                    ? (l.sin_regla && l.pct_manual == null ? '—' : Number(l.pct) + '%')
                    : <PctEditable linea={l} onGuardar={cambiarPct} />}
                </td>
                <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(l.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Ajustes ── */}
      <div style={{ fontWeight: 800, fontSize: '0.8rem', color: P.tinta, marginBottom: 6 }}>Ajustes</div>
      {det.ajustes.length === 0 && <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: P.suave }}>Ninguno.</p>}
      {det.ajustes.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
            <tbody>
              {det.ajustes.map((a: any) => (
                <tr key={a.id}>
                  <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{a.concepto}<div style={{ fontSize: '0.68rem', color: '#999' }}>{a.nota || ''}</div></td>
                  <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: a.tipo === 'cargo' ? P.rojoTinta : P.verdeTinta, whiteSpace: 'nowrap' }}>
                    {a.tipo === 'cargo' ? '−' : '+'}{pesos(a.monto)}
                  </td>
                  <td style={{ ...E.td, width: 70 }}>
                    {!firme && <button onClick={() => quitar(a.id)} style={{ ...E.btn3, padding: '2px 8px', color: P.rojoTinta, borderColor: '#f0c4bd' }}>Quitar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!firme && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: 10, borderTop: `1px solid ${P.lineaSuave}`, marginBottom: 14 }}>
          <div>
            <label style={E.lbl}>Tipo</label>
            <select value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })} style={{ ...E.input, minWidth: 110 }}>
              <option value="abono">Abono (+)</option>
              <option value="cargo">Cargo (−)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={E.lbl}>Concepto</label>
            <input value={nuevo.concepto} onChange={e => setNuevo({ ...nuevo, concepto: e.target.value })}
              placeholder="Lo que se va a leer en el estado de cuenta" style={{ ...E.input, width: '100%' }} />
          </div>
          <div><label style={E.lbl}>Monto</label>
            <input type="number" value={nuevo.monto} onChange={e => setNuevo({ ...nuevo, monto: e.target.value })} style={{ ...E.input, width: 110 }} /></div>
          <button onClick={() => agregar()} disabled={guardando || !nuevo.concepto.trim() || !nuevo.monto} style={E.btn}>Agregar ajuste</button>
        </div>
      )}

      {/* ── Pagos que el motor no supo comisionar ── */}
      {!firme && (det.no_reconocidos || []).length > 0 && (
        <div style={{ background: P.ambarAgua, border: `1px solid ${P.linea}`, borderLeft: `3px solid ${P.ambar}`, borderRadius: 10, padding: '13px 15px' }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: P.ambarTinta, marginBottom: 3 }}>
            {det.no_reconocidos.length} pago(s) de este periodo no generaron comisión
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: P.texto, maxWidth: '70ch' }}>
            Entró el dinero pero el motor no supo a quién dárselo o con qué tarifa. Si alguno le corresponde a <b>{c.team_members?.nombre}</b>, agrégalo al corte con el monto que acuerden.
          </p>
          <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 540 }}>
              <tbody>
                {det.no_reconocidos.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ ...E.td, whiteSpace: 'nowrap' }}>{fecha(p.fecha)}</td>
                    <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>{p.empresa}</td>
                    <td style={{ ...E.td, fontSize: '0.72rem', color: P.suave }}>{p.motivo}</td>
                    <td style={{ ...E.td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{pesos(p.monto)}</td>
                    <td style={{ ...E.td, width: 96 }}>
                      <button onClick={() => agregar(p)} disabled={guardando} style={{ ...E.btn3, padding: '3px 9px' }}>Agregar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
