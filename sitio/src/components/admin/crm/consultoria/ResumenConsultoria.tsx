// Consultoría · Mi semana — el reporte del CONSULTOR, no el del cliente.
//
// La pestaña de Consultoría servía para ver el trabajo pendiente, pero no
// contestaba la pregunta de quien da las juntas: «¿qué produjo mi semana?».
// La ejecución ya vive en el Taller; aquí queda el resultado: cuántas juntas
// di, qué salió de ellas, cuánto dinero movieron y qué me queda por vender.
//
// Dos reglas que sostienen los números:
//  · El periodo se mide por la FECHA DE LA JUNTA, no por cuándo se capturó la
//    minuta. La conversación pasó el martes aunque el renglón se escriba el
//    viernes.
//  · El dinero va en dos cajas que NO se suman: lo que cuelga de una idea
//    (directo, indiscutible) y lo que se cotizó a una cuenta dentro de los 30
//    días siguientes a su junta (atribuido, que es una ventana, no una prueba).
import { useEffect, useState, useCallback } from 'react';
import Cargando from '../ui/Cargando';
import KpiCard from '../ui/KpiCard';
import { P } from '../../../../lib/crm/paleta';

const money = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmt = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '')
  : '';
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Los periodos con los que de verdad se trabaja. El lunes manda: la semana de
 *  trabajo es lunes a domingo, no los últimos siete días corridos. */
function rangos() {
  const hoy = new Date();
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const lunesPasado = new Date(lunes); lunesPasado.setDate(lunes.getDate() - 7);
  const domingoPasado = new Date(lunes); domingoPasado.setDate(lunes.getDate() - 1);
  const primeroMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hace90 = new Date(Date.now() - 90 * 86400000);
  return [
    { id: 'semana', l: 'Esta semana', desde: dia(lunes), hasta: dia(hoy) },
    { id: 'pasada', l: 'Semana pasada', desde: dia(lunesPasado), hasta: dia(domingoPasado) },
    { id: 'mes', l: 'Este mes', desde: dia(primeroMes), hasta: dia(hoy) },
    { id: 'trimestre', l: 'Últimos 90 días', desde: dia(hace90), hasta: dia(hoy) },
  ];
}

const S = {
  secT: { fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#a5a2af', margin: '22px 0 6px', display: 'flex', alignItems: 'center', gap: 8 } as const,
  caja: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, overflow: 'hidden' } as const,
  fila: { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px', borderTop: '1px solid #f5f4f8', fontSize: '0.82rem', flexWrap: 'wrap' as const } as const,
  vacio: { padding: '14px 15px', fontSize: '0.82rem', color: '#999' } as const,
  btn: { padding: '6px 12px', border: 'none', borderRadius: 9, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', background: P.violeta, color: '#fff', fontFamily: 'inherit' } as const,
  btnG: { padding: '6px 11px', border: '1px solid #ddd', borderRadius: 9, fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#4a4a52', fontFamily: 'inherit' } as const,
  btnSec: { padding: '6px 12px', border: `1.5px solid ${P.violeta}`, borderRadius: 9, fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: P.violetaTinta, fontFamily: 'inherit' } as const,
};

export default function ResumenConsultoria() {
  const R = rangos();
  const [periodo, setPeriodo] = useState('semana');
  const [d, setD] = useState<any>(null);
  const [señales, setSeñales] = useState<any[]>([]);
  const [copiado, setCopiado] = useState('');

  const r = R.find(x => x.id === periodo) || R[0];
  const cargar = useCallback(async () => {
    setD(null);
    const j = await fetch(`/api/crm/consultoria/resumen?desde=${r.desde}&hasta=${r.hasta}`)
      .then(x => x.json()).catch(() => null);
    setD(j && !j.error ? j : { error: j?.error || 'No se pudo cargar' });
  }, [r.desde, r.hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  /* Lo que se le puede vender sale del RADAR que ya existe (la actividad real de
     cada cuenta en SACS). No se recalcula aquí: se trae y se recorta. */
  useEffect(() => {
    fetch('/api/crm/arr/oportunidades').then(x => x.json())
      /* Del radar solo interesa aquí la parte VENDIBLE: la lista viene ordenada
         por peso y encabezada muchas veces por un riesgo («su salud cayó»), que
         es otra conversación. Se toma la primera señal de oportunidad. */
      .then(j => setSeñales((j.data || j || [])
        .map((c: any) => ({ ...c, venta: (c.senales || []).find((s: any) => s.nivel === 'oportunidad') }))
        .filter((c: any) => c.venta)
        .sort((a: any, b: any) => (b.arr || 0) - (a.arr || 0))
        .slice(0, 8)))
      .catch(() => {});
  }, []);

  if (!d) return <Cargando texto="Armando tu semana…" />;
  if (d.error) return <div style={{ ...S.caja, padding: 16, color: P.rojoTinta, fontSize: '0.85rem' }}>{d.error}</div>;

  const t = d.totales, din = d.dinero;
  const rinde = t.juntas ? (t.salidas / t.juntas).toFixed(1) : '0';

  /* El resumen en texto plano: es lo que se pega en WhatsApp o en un correo sin
     tener que abrir el CRM del otro lado. */
  function copiar() {
    const L = [
      `CONSULTORÍA · ${fmt(d.periodo.desde)} al ${fmt(d.periodo.hasta)}`,
      ``,
      `${t.juntas} juntas con ${t.cuentas} cuentas` + (t.juntasSinMinuta ? ` (${t.juntasSinMinuta} sin minuta)` : ''),
      `${t.salidas} cosas salieron de ellas: ${t.mejoras} mejoras · ${t.bugs} bugs · ${t.ideas} ideas · ${t.capacitaciones} capacitaciones`,
      t.sueltas ? `${t.sueltas} más entraron fuera de junta (WhatsApp, soporte)` : '',
      `${t.entregadas} entregas cerradas` + (din.cortesias ? ` · ${din.cortesias} de cortesía` : ''),
      ``,
      `DINERO`,
      `Cotizado desde una idea: ${money(din.total_directo)}`,
      `Atribuido a la junta (30 días): ${money(din.total_atribuido)}`,
      `Cobrado: ${money(din.cobrado)}`,
      ``,
      `Conversión histórica idea → cotización: ${d.conversion.pct}% (${d.conversion.cotizadas} de ${d.conversion.ideas})`,
      d.sinTocar.length ? `Sin junta en 60 días: ${d.sinTocar.slice(0, 5).map((c: any) => c.nombre).join(', ')}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(L).then(
      () => { setCopiado('Resumen copiado'); setTimeout(() => setCopiado(''), 2500); },
      () => { setCopiado('No se pudo copiar'); setTimeout(() => setCopiado(''), 2500); },
    );
  }

  function cotizar(idea: any) {
    const q = new URLSearchParams({ nueva: '1', company_id: idea.company_id || '', empresa: idea.cuenta || '', concepto: idea.titulo, importe: String(Math.round(idea.valor || 0)) });
    window.open('/admin/revenue?' + q.toString(), '_blank', 'noopener');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {R.map(x => (
          <button key={x.id} style={periodo === x.id ? S.btn : S.btnG} onClick={() => setPeriodo(x.id)}>{x.l}</button>
        ))}
        <span style={{ fontSize: '0.74rem', color: '#8d8a97' }}>{fmt(d.periodo.desde)} al {fmt(d.periodo.hasta)}</span>
        <button style={{ ...S.btnSec, marginLeft: 'auto' }} onClick={copiar}>Copiar resumen</button>
        {copiado && <span style={{ fontSize: '0.74rem', color: P.verdeTinta, fontWeight: 700 }}>{copiado}</span>}
      </div>

      {/* Los indicadores del periodo. Una sola zona, arriba. */}
      <div className="cons-alertas" style={{ marginBottom: 4 }}>
        <KpiCard franja={P.violeta} label="Juntas que diste" valor={t.juntas}
          sub={t.juntas
            ? `${t.cuentas} ${t.cuentas === 1 ? 'cuenta' : 'cuentas'}${t.juntasSinMinuta ? ` · ${t.juntasSinMinuta} sin minuta` : ''}`
            : 'sin juntas en el periodo'} />
        <KpiCard franja={P.azul} label="Salió de esas juntas" valor={t.salidas}
          color={t.salidas ? P.azulTinta : undefined}
          sub={t.juntas ? `${rinde} por junta · ${t.mejoras} mejoras · ${t.bugs} bugs` : '—'} />
        <KpiCard franja={P.verde} label="Cotizado desde una idea" valor={money(din.total_directo)}
          color={din.total_directo ? P.verdeTinta : undefined}
          sub={din.total_atribuido ? `+ ${money(din.total_atribuido)} atribuido a la junta` : 'sin cotizaciones ligadas'} />
        <KpiCard franja={P.rosa} label="Entregado en el periodo" valor={t.entregadas}
          sub={din.cortesias
            ? `${din.cortesias} de cortesía${din.cortesia_valor ? ` · ${money(din.cortesia_valor)} de lista` : ''}`
            : 'sin entregas cerradas'} />
      </div>

      {/* ── Las juntas, una por una ── */}
      <div style={S.secT}>Tus juntas del periodo <span style={{ color: '#77738a', background: '#f1eff6', borderRadius: 99, padding: '1px 7px' }}>{t.juntas}</span></div>
      <div style={S.caja}>
        {d.juntas.length === 0 && <div style={S.vacio}>No hay juntas con minuta en este rango.</div>}
        {d.juntas.map((j: any, i: number) => (
          <div key={j.id} style={{ ...S.fila, borderTop: i ? '1px solid #f5f4f8' : 'none' }}>
            <span style={{ color: '#a5a2af', fontSize: '0.73rem', width: 56, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{fmt(j.fecha)}</span>
            <b style={{ minWidth: 150 }}>{j.cuenta}</b>
            <span style={{ color: '#6b6b74', flex: 1, minWidth: 140 }}>{j.asunto}</span>
            {!j.conMinuta && <span style={{ fontSize: '0.68rem', fontWeight: 800, color: P.ambarTinta, background: P.ambarAgua, borderRadius: 20, padding: '2px 9px' }}>sin minuta</span>}
            <span style={{ fontSize: '0.74rem', color: j.salidas ? P.violetaTinta : '#a5a2af', fontWeight: j.salidas ? 700 : 400 }}>
              {j.salidas ? `${j.salidas} ${j.salidas === 1 ? 'cosa' : 'cosas'}` : 'nada salió'}
            </span>
          </div>
        ))}
        {t.sueltas > 0 && (
          <div style={{ ...S.fila, background: '#faf9fd', color: '#6b6b74', fontSize: '0.78rem' }}>
            Además, <b>&nbsp;{t.sueltas}&nbsp;</b> entraron fuera de junta —lo que el cliente pidió por WhatsApp o salió de soporte—.
          </div>
        )}
      </div>

      {/* ── El dinero, en dos cajas que no se mezclan ── */}
      <div style={S.secT}>El dinero que movieron</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={S.caja}>
          <div style={{ padding: '10px 15px', background: '#f7fbf9', fontSize: '0.73rem', fontWeight: 800, color: P.verdeTinta }}>
            Cotizado desde una idea · {money(din.total_directo)}
          </div>
          {din.directo.length === 0 && <div style={S.vacio}>Ninguna cotización del periodo cuelga de una idea. Ligarlas desde la ficha del cliente es lo que hace que este número exista.</div>}
          {din.directo.map((q: any) => (
            <div key={q.id} style={S.fila}>
              <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: P.violetaTinta }}>{q.numero}</b>
              <span style={{ flex: 1, minWidth: 120 }}>{q.cuenta}<div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{q.idea}</div></span>
              <b style={{ color: q.pagada ? P.verdeTinta : '#1a1a1a' }}>{money(q.total)}</b>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{q.pagada ? 'pagada' : q.estado}</span>
            </div>
          ))}
        </div>
        <div style={S.caja}>
          <div style={{ padding: '10px 15px', background: '#f7f9fd', fontSize: '0.73rem', fontWeight: 800, color: P.azulTinta }}>
            Atribuido a la junta · {money(din.total_atribuido)}
          </div>
          {din.atribuido.length === 0 && <div style={S.vacio}>Nada se cotizó a estas cuentas dentro de los 30 días siguientes a su junta.</div>}
          {din.atribuido.slice(0, 8).map((q: any) => (
            <div key={q.id} style={S.fila}>
              <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: P.azulTinta }}>{q.numero}</b>
              <span style={{ flex: 1, minWidth: 120 }}>{q.cuenta}</span>
              <b style={{ color: q.pagada ? P.verdeTinta : '#1a1a1a' }}>{money(q.total)}</b>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{q.pagada ? 'pagada' : q.estado}</span>
            </div>
          ))}
          {din.atribuido.length > 8 && (
            <div style={{ ...S.fila, color: '#a5a2af', fontSize: '0.74rem' }}>y {din.atribuido.length - 8} más</div>
          )}
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#8d8a97', marginTop: 7, lineHeight: 1.5, maxWidth: 720 }}>
        Los dos números <b>no se suman</b>: el de la izquierda es indiscutible —la cotización cuelga de una idea que
        salió de la junta—; el de la derecha es una ventana de 30 días, y sirve para ver la tendencia, no para
        presumirla como propia.
      </div>

      {/* ── Las ideas que salieron: el pipeline del consultor ── */}
      <div style={S.secT}>Ideas que salieron de estas juntas <span style={{ color: '#77738a', background: '#f1eff6', borderRadius: 99, padding: '1px 7px' }}>{d.ideas.length}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: '#8d8a97' }}>
          conversión histórica idea → cotización: <b style={{ color: d.conversion.pct >= 20 ? P.verdeTinta : P.ambarTinta }}>{d.conversion.pct}%</b> ({d.conversion.cotizadas} de {d.conversion.ideas})
        </span>
      </div>
      <div style={S.caja}>
        {d.ideas.length === 0 && <div style={S.vacio}>De estas juntas no salió ninguna idea por vender.</div>}
        {d.ideas.slice(0, 12).map((i: any, n: number) => (
          <div key={i.id} style={{ ...S.fila, borderTop: n ? '1px solid #f5f4f8' : 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.azul, flex: 'none' }} />
            <b style={{ minWidth: 130 }}>{i.cuenta}</b>
            <span style={{ flex: 1, minWidth: 160 }}>{i.titulo}</span>
            <span style={{ fontSize: '0.75rem', color: i.valor ? P.azulTinta : '#a5a2af', fontWeight: i.valor ? 700 : 400 }}>
              {i.valor ? '~' + money(i.valor) : 'sin monto'}
            </span>
            <button style={S.btnG} onClick={() => cotizar(i)}>Cotizar</button>
          </div>
        ))}
        {d.ideas.length > 12 && <div style={{ ...S.fila, color: '#a5a2af', fontSize: '0.74rem' }}>y {d.ideas.length - 12} más en la lista de trabajo</div>}
      </div>

      {/* ── Qué venderle, según lo que cada cuenta USA ── */}
      <div style={S.secT}>Qué venderle, según su actividad en SACS</div>
      <div style={S.caja}>
        {señales.length === 0 && <div style={S.vacio}>El radar no encuentra oportunidades con señal ahora mismo.</div>}
        {señales.map((c: any, n: number) => (
          <div key={c.company_id} style={{ ...S.fila, borderTop: n ? '1px solid #f5f4f8' : 'none' }}>
            <b style={{ minWidth: 140 }}>{c.nombre_comercial || c.nombre}</b>
            <span style={{ flex: 1, minWidth: 200 }}>
              {c.venta.titulo}
              <div style={{ fontSize: '0.72rem', color: '#6b6b74' }}>{c.venta.accion}</div>
            </span>
            <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>{c.n_oportunidades} {c.n_oportunidades === 1 ? 'señal' : 'señales'}</span>
            {c.arr > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: P.verdeTinta }}>{money(c.arr)} ARR</span>}
          </div>
        ))}
      </div>

      {/* ── Lo que no estás viendo ── */}
      <div style={S.secT}>Cuentas activas sin junta en 60 días</div>
      <div style={S.caja}>
        {d.sinTocar.length === 0 && <div style={S.vacio}>Todas las cuentas activas tuvieron junta en los últimos dos meses.</div>}
        {d.sinTocar.map((c: any, n: number) => (
          <div key={c.id} style={{ ...S.fila, borderTop: n ? '1px solid #f5f4f8' : 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.ambar, flex: 'none' }} />
            <b style={{ flex: 1, minWidth: 140 }}>{c.nombre}</b>
            {c.arr > 0 && <span style={{ fontSize: '0.75rem', color: '#6b6b74' }}>{money(c.arr)} de ARR sin acompañar</span>}
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
