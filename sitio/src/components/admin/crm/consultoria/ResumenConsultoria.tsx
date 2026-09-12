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
  const [copiado, setCopiado] = useState('');
  /* Las juntas se pliegan: con 46 renglones la lista se come la pantalla antes
     de llegar al dinero, que es lo que se viene a ver. */
  const [verJuntas, setVerJuntas] = useState(false);

  const r = R.find(x => x.id === periodo) || R[0];
  const cargar = useCallback(async () => {
    setD(null);
    const j = await fetch(`/api/crm/consultoria/resumen?desde=${r.desde}&hasta=${r.hasta}`)
      .then(x => x.json()).catch(() => null);
    setD(j && !j.error ? j : { error: j?.error || 'No se pudo cargar' });
  }, [r.desde, r.hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!d) return <Cargando texto="Armando tu semana…" />;
  if (d.error) return <div style={{ ...S.caja, padding: 16, color: P.rojoTinta, fontSize: '0.85rem' }}>{d.error}</div>;

  const t = d.totales, din = d.dinero;
  const rinde = t.juntas ? (t.salidas / t.juntas).toFixed(1) : '0';
  // El pendiente comercial: ideas abiertas que todavía no se cotizan.
  const ideasAbiertas = (d.ideasPorVender || []).reduce((a: number, c: any) => a + c.n, 0);
  const valorIdeas = (d.ideasPorVender || []).reduce((a: number, c: any) => a + c.valor, 0);

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
      `DINERO (solo lo que salió de una idea de consultoría)`,
      `Cotizado: ${money(din.total_cotizado)} en ${din.cotizado.length}`,
      `Pagado: ${money(din.total_pagado)} en ${din.pagado.length}`,
      din.sinLigar.length ? `${din.sinLigar.length} cotizaciones de estas cuentas están sin ligar a una idea` : '',
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
            ? `${t.cuentas} ${t.cuentas === 1 ? 'cuenta' : 'cuentas'} · ${t.salidas} cosas salieron (${rinde} por junta)${t.juntasSinMinuta ? ` · ${t.juntasSinMinuta} sin minuta` : ''}`
            : 'sin juntas en el periodo'} />
        <KpiCard franja={P.azul} label="Cotizado" valor={money(din.total_cotizado)}
          color={din.total_cotizado ? P.azulTinta : undefined}
          sub={din.cotizado.length
            ? `${din.cotizado.length} ${din.cotizado.length === 1 ? 'cotización salida' : 'cotizaciones salidas'} de una idea tuya`
            : 'ninguna cotización ligada a una idea'} />
        <KpiCard franja={P.verde} label="Pagado" valor={money(din.total_pagado)}
          color={din.total_pagado ? P.verdeTinta : undefined}
          sub={din.pagado.length ? `${din.pagado.length} ${din.pagado.length === 1 ? 'cobrada' : 'cobradas'} en el periodo` : 'nada cobrado todavía'} />
        <KpiCard franja={P.rosa} label="Ideas por vender" valor={ideasAbiertas}
          sub={valorIdeas ? `~${money(valorIdeas)} estimado · en ${d.ideasPorVender.length} cuentas` : `en ${d.ideasPorVender.length} cuentas · sin monto capturado`} />
      </div>

      {/* ── Las juntas, una por una ── */}
      <div style={S.secT}>Tus juntas del periodo <span style={{ color: '#77738a', background: '#f1eff6', borderRadius: 99, padding: '1px 7px' }}>{t.juntas}</span></div>
      <div style={S.caja}>
        {d.juntas.length === 0 && <div style={S.vacio}>No hay juntas con minuta en este rango.</div>}
        {(verJuntas ? d.juntas : d.juntas.slice(-8)).map((j: any, i: number) => (
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
        {d.juntas.length > 8 && (
          <button onClick={() => setVerJuntas(v => !v)}
            style={{ width: '100%', border: 'none', borderTop: '1px solid #f5f4f8', background: '#faf9fd', padding: '9px', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
            {verJuntas ? 'Ver solo las últimas 8' : `Ver las ${d.juntas.length - 8} juntas anteriores`}
          </button>
        )}
        {t.sueltas > 0 && (
          <div style={{ ...S.fila, background: '#faf9fd', color: '#6b6b74', fontSize: '0.78rem' }}>
            Además, <b>&nbsp;{t.sueltas}&nbsp;</b> entraron fuera de junta —lo que el cliente pidió por WhatsApp o salió de soporte—.
          </div>
        )}
      </div>

      {/* ── El dinero de la consultoría: lo que salió de una idea tuya ── */}
      <div style={S.secT}>Cotizado y pagado desde tus ideas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={S.caja}>
          <div style={{ padding: '10px 15px', background: '#f7f9fd', fontSize: '0.73rem', fontWeight: 800, color: P.azulTinta }}>
            Cotizado · {money(din.total_cotizado)}
          </div>
          {din.cotizado.length === 0 && <div style={S.vacio}>Ninguna cotización del periodo cuelga de una idea tuya.</div>}
          {din.cotizado.map((q: any) => (
            <div key={q.id} style={S.fila}>
              <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: P.azulTinta }}>{q.numero}</b>
              <span style={{ flex: 1, minWidth: 120 }}>{q.cuenta}<div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{q.idea}</div></span>
              <b>{money(q.total)}</b>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{fmt(q.fecha)}</span>
            </div>
          ))}
        </div>
        <div style={S.caja}>
          <div style={{ padding: '10px 15px', background: '#f7fbf9', fontSize: '0.73rem', fontWeight: 800, color: P.verdeTinta }}>
            Pagado · {money(din.total_pagado)}
          </div>
          {din.pagado.length === 0 && <div style={S.vacio}>Nada de lo que salió de tus ideas se ha cobrado en este periodo.</div>}
          {din.pagado.map((q: any) => (
            <div key={q.id} style={S.fila}>
              <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: P.verdeTinta }}>{q.numero}</b>
              <span style={{ flex: 1, minWidth: 120 }}>{q.cuenta}<div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{q.idea}</div></span>
              <b style={{ color: P.verdeTinta }}>{money(q.total)}</b>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>pagó el {fmt(q.pagado_fecha)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Las cotizaciones sueltas NO se cuentan como resultado: se ofrecen para
          ligar. Si salió de la junta, se liga y entonces sí cuenta. */}
      {din.sinLigar.length > 0 && (<>
        <div style={S.secT}>Cotizaciones de estas cuentas sin ligar a una idea
          <span style={{ color: '#77738a', background: '#f1eff6', borderRadius: 99, padding: '1px 7px' }}>{din.sinLigar.length}</span>
        </div>
        <div style={S.caja}>
          <div style={{ padding: '10px 15px', fontSize: '0.76rem', color: '#6b6b74', background: '#faf9fd', lineHeight: 1.5 }}>
            No cuentan como resultado tuyo mientras no cuelguen de una idea — y no todas lo son.
            Si <b>esta</b> salió de tu junta, lígala desde la ficha del cliente y entra al cotizado.
          </div>
          {din.sinLigar.slice(0, 8).map((q: any) => (
            <div key={q.id} style={S.fila}>
              <b style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: '#6b6b74' }}>{q.numero}</b>
              <span style={{ flex: 1, minWidth: 120 }}>{q.cuenta}</span>
              <span style={{ color: '#6b6b74' }}>{money(q.total)}</span>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{q.pagado_fecha ? 'pagada el ' + fmt(q.pagado_fecha) : fmt(q.fecha)}</span>
            </div>
          ))}
          {din.sinLigar.length > 8 && <div style={{ ...S.fila, color: '#a5a2af', fontSize: '0.74rem' }}>y {din.sinLigar.length - 8} más</div>}
        </div>
      </>)}

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

      {/* ── Qué le puedes vender: tus propias ideas, sin cotizar ── */}
      <div style={S.secT}>Lo que te queda por venderle a cada cuenta</div>
      <div style={S.caja}>
        {d.ideasPorVender.length === 0 && <div style={S.vacio}>No hay ideas abiertas sin cotizar.</div>}
        {d.ideasPorVender.map((c: any, n: number) => (
          <div key={c.company_id} style={{ ...S.fila, borderTop: n ? '1px solid #f5f4f8' : 'none' }}>
            <b style={{ minWidth: 150 }}>{c.cuenta}</b>
            <span style={{ flex: 1, minWidth: 200, fontSize: '0.78rem', color: '#6b6b74' }}>{c.ejemplos.join(' · ')}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: P.violetaTinta }}>{c.n} {c.n === 1 ? 'idea' : 'ideas'}</span>
            {c.valor > 0 && <span style={{ fontSize: '0.75rem', color: P.azulTinta, fontWeight: 700 }}>~{money(c.valor)}</span>}
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
