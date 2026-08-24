// Tablero del CRM.
//
// Abre en HOY, no en el mes. Un tablero que arranca con el ARR total contesta
// una pregunta que casi nunca cambia; lo primero que se necesita al entrar es
// qué hay que atender antes de que acabe el día.
//
// De ahí para arriba, el periodo contesta cuatro preguntas en orden:
//   1. ¿Cuánto dinero se movió?      2. ¿De dónde vino?
//   3. ¿Cómo va el embudo?           4. ¿Cómo acompañé a los clientes?
// Todo lo demás —cobranza, metas, salud— vive debajo, porque se consulta, no
// se vigila.
//
// Cada número trae una línea que dice QUÉ es, con el dato propio adentro: no
// "el NRR mide expansión neta", sino "de cada $100 que te pagaban, hoy te
// pagan $104". Un tablero que hay que saber leer no lo lee nadie. Y lo que no
// se puede calcular se dice: un número inventado en una pantalla que puede ver
// un inversionista es peor que un hueco.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import ClienteDrawer360 from './ClienteDrawer360';
import Cargando from './ui/Cargando';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
// Los millones de la cartera no caben en una tarjeta; los pesos del negocio sí.
const corto = (n?: number | null) => {
  const v = Math.abs(Number(n || 0));
  if (v >= 1000000) return '$' + (Number(n) / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 10000) return '$' + Math.round(Number(n) / 1000) + 'K';
  return money(n);
};
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const hace = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const S = {
  wrap: WRAP,
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '18px 20px', marginBottom: 14 } as const,
  h: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 } as const,
  hr: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  hd: { fontSize: '0.72rem', color: '#8a8a8a', marginBottom: 13, lineHeight: 1.5 } as const,
  kl: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.06em' } as const,
  kv: { fontSize: '1.85rem', fontWeight: 800, marginTop: 6, letterSpacing: '-.02em', lineHeight: 1 } as const,
  ks: { fontSize: '0.7rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.45 } as const,
  ke: { fontSize: '0.66rem', color: '#b3b1bb', marginTop: 6, paddingTop: 6, borderTop: '1px solid #f5f4f8', lineHeight: 1.45 } as const,
  fila: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f5f4f8', fontSize: '0.78rem' } as const,
  btnA: { border: '1.5px solid #cdc4fb', borderRadius: 8, padding: '4px 10px', background: '#fff', fontSize: '0.69rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  btnP: { border: 'none', borderRadius: 8, padding: '5px 11px', background: '#9B8CFA', color: '#fff', fontSize: '0.69rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  pill: (bg: string, fg: string) => ({ fontSize: '0.6rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const }) as const,
};
// El rosa marca lo ELEGIDO, igual que en los filtros del resto del módulo.
const seg = (on: boolean) => ({
  border: 'none', cursor: 'pointer', padding: '6px 13px', fontSize: '0.72rem', fontWeight: 700,
  fontFamily: 'inherit', background: on ? 'rgba(244,168,205,.34)' : 'transparent', color: on ? '#9c3d70' : '#8a8a92',
}) as const;

type Rango = 'hoy' | '7' | '30' | '90' | '365' | 'custom';
const PRESETS: [Rango, string, number][] = [['hoy', 'Hoy', 0], ['7', '7 días', 7], ['30', '30 días', 30], ['90', '3 meses', 90], ['365', '12 meses', 365]];

export default function DashboardTab() {
  const [rango, setRango] = useState<Rango>('hoy');
  const [desde, setDesde] = useState(iso(new Date()));
  const [hasta, setHasta] = useState(iso(new Date()));
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = () => {
    setD(null); setErr('');
    fetch(`/api/crm/reports/tablero?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json()).then(j => { if (j.error) setErr(j.error); else setD(j); })
      .catch(() => setErr('No se pudo cargar el tablero.'));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [desde, hasta]);

  const preset = (k: Rango, n: number) => { setRango(k); setDesde(hace(n)); setHasta(iso(new Date())); };

  if (err) return <div style={{ ...S.wrap, color: '#C0554E', fontSize: '0.85rem' }}>{err}</div>;
  if (!d) return <div style={S.wrap}><Cargando texto="Cargando tablero…" /></div>;

  const esHoy = rango === 'hoy';
  const crudo = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoyTxt = crudo.charAt(0).toUpperCase() + crudo.slice(1);

  return (
    <div style={S.wrap}>
      {/* Las rejillas van por clase y no con auto-fit: con minmax el navegador
          decidía 3 columnas y dejaba un hueco del ancho de una tarjeta. */}
      <style>{`
        .tb-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; }
        .tb-3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:22px; }
        .tb-2 { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px; }
        @media (max-width: 1100px) { .tb-4 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 900px)  { .tb-3, .tb-2 { grid-template-columns:1fr; gap:16px; } }
        @media (max-width: 620px)  { .tb-4 { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Tablero</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2,  }}>
            {esHoy ? hoyTxt : `Del ${fmtDate(desde)} al ${fmtDate(hasta)} · ${d.periodo.dias} días`}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', border: '1px solid #efe7f1', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
            {PRESETS.map(([v, l, n]) => <button key={v} onClick={() => preset(v, n)} style={seg(rango === v)}>{l}</button>)}
            <button onClick={() => setRango('custom')} style={seg(rango === 'custom')}>Personalizado</button>
          </span>
          {/* Los campos de fecha solo aparecen cuando se piden: ocupaban un
              tercio de la barra para algo que se usa una vez al mes. */}
          {rango === 'custom' && (<>
            <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)}
              style={{ border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' }} />
            <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)}
              style={{ border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' }} />
          </>)}
        </div>
      </div>

      {esHoy ? <Hoy d={d} abrir={setAbierto} /> : <Periodo d={d} desde={desde} />}

      <Cobranza d={d} abrir={setAbierto} />
      <Metas d={d} />
      <Salud d={d} />

      <div className="tb-2">
        <Planes d={d} />
        <Atencion d={d} abrir={setAbierto} />
      </div>

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}

/* ════════════════════════════ HOY ════════════════════════════
   Un lunes a las 9 de la mañana casi todo está en ceros, así que Hoy no
   enseña el dinero del día: enseña lo que hay que atender y cómo va la
   semana. Así la pantalla nunca aparece vacía. */
function Hoy({ d, abrir }: any) {
  const h = d.hoy, reuHoy = d.reuniones.filter((r: any) => r.hoy);
  return (
    <>
      <div className="tb-4" style={{ marginBottom: 14 }}>
        <Tile color="#9B8CFA" label="Reuniones hoy" valor={String(h.reuniones)}
          sub={reuHoy[0] ? `La próxima a las ${reuHoy[0].hora}` : 'La agenda está libre'} />
        <Tile color="#4FBF95" label="Se cobra hoy" valor={h.cobro_hoy.monto ? money(h.cobro_hoy.monto) : '—'}
          sub={h.cobro_hoy.n ? `${h.cobro_hoy.n} ${h.cobro_hoy.n === 1 ? 'renovación vence' : 'renovaciones vencen'} hoy` : 'Nada vence hoy'} />
        <Tile color={h.vencidos.n ? '#C0554E' : '#c9c7d0'} label="Compromisos vencidos" valor={String(h.vencidos.n)}
          sub={h.vencidos.n ? `En ${h.vencidos.cuentas} ${h.vencidos.cuentas === 1 ? 'cuenta' : 'cuentas'}. Pasó la fecha pactada.` : 'Nada pactado se pasó de fecha'} />
        <Tile color="#F0B84E" label="Cotizaciones vivas" valor={money(h.semana.cotizaciones.monto)}
          sub={`${h.semana.cotizaciones.n} en manos del cliente`} />
      </div>

      <div className="tb-2" style={{ marginBottom: 14, alignItems: 'start' }}>
        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>La agenda de hoy<span style={S.hr}>{h.reuniones} {h.reuniones === 1 ? 'reunión' : 'reuniones'}</span></div>
          {reuHoy.length === 0 && <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '14px 0' }}>Sin reuniones hoy.</div>}
          {reuHoy.map((r: any) => (
            <div key={r.id} style={S.fila}>
              <span style={S.pill('#EEECFE', '#5B4BD6')}>{r.hora}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{r.asunto || r.tipo || 'Reunión'}</div>
                <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{r.tipo || ''}{r.con ? ` · ${r.con}` : ''}</div>
              </div>
              {r.company_id && <button style={{ ...S.btnA, marginLeft: 'auto' }} onClick={() => abrir(r.company_id)}>Ver cuenta</button>}
            </div>
          ))}
        </div>

        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>Esta semana<span style={S.hr}>próximos 7 días</span></div>
          <div style={S.hd}>Lo que viene, para no llegar con la semana encima.</div>
          <Renglon label="Por cobrar" valor={money(h.semana.cobro.monto)} nota={`${h.semana.cobro.n} ${h.semana.cobro.n === 1 ? 'renovación' : 'renovaciones'}`} />
          <Renglon label="Reuniones" valor={String(h.semana.reuniones)} nota="ya agendadas" />
          <Renglon label="Cotizaciones por vencer" valor={String(d.atencion.cotizaciones.length)} nota="pierden vigencia" />
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════ EL PERIODO ══════════════════════════
   Cuatro preguntas en orden: cuánto entró, de quién, cómo va el embudo y
   cómo se acompañó. En ese orden porque así se cuenta el mes. */
function Periodo({ d, desde }: any) {
  const din = d.dinero, emb = d.embudo, ori = d.origen, car = d.cartera, ac = d.acompanamiento;
  const totalOrigen = Math.max(1, ori.base.monto + ori.nuevas.monto + ori.sin_ligar.monto);
  const cortoLedger = desde < din.ledger_desde;

  return (
    <>
      {/* 1 · Cuánto dinero se movió */}
      <div className="tb-4" style={{ marginBottom: 14 }}>
        <Tile color="#4FBF95" label="Cobrado" valor={money(din.cobrado.monto)}
          sub={`${din.cobrado.n} ${din.cobrado.n === 1 ? 'pago recibido' : 'pagos recibidos'}`}
          pie="Dinero que de verdad entró a la cuenta en el periodo." />
        <Tile color="#5B4BD6" label="ARR nuevo" valor={money(din.arr_nuevo.monto)}
          sub={<>{din.arr_nuevo.n} {din.arr_nuevo.n === 1 ? 'cuenta nueva' : 'cuentas nuevas'}{din.arr_nuevo.expansion ? <> · <b style={{ color: '#1E8A63' }}>+{money(din.arr_nuevo.expansion)}</b> de expansión</> : ''}</>}
          pie={cortoLedger
            ? `Solo cuenta desde el ${fmtDate(din.ledger_desde)}: antes de esa fecha no hay historial de altas.`
            : 'Lo que estas altas facturarán en 12 meses. La expansión es de clientes que ya tenías.'} />
        <Tile color="#F0B84E" label="Pagos únicos" valor={money(din.unicos.monto)}
          sub={`${din.unicos.n} ${din.unicos.n === 1 ? 'cobro' : 'cobros'} sin recurrencia`}
          pie="Personalizaciones, plugins, implementaciones. No se repite el mes que viene." />
        <Tile color="#2C5FC4" label="Cotizaciones aceptadas" valor={money(din.aceptadas.monto)}
          sub={`${din.aceptadas.n} ${din.aceptadas.n === 1 ? 'aceptada' : 'aceptadas'} en el periodo`}
          pie="El cliente ya dijo que sí. Puede que todavía no pague." />
      </div>

      <div className="tb-2" style={{ marginBottom: 14 }}>
        {/* 2 · De dónde vino */}
        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>De dónde vino el dinero<span style={S.hr}>{money(din.cobrado.monto)} cobrados</span></div>
          <div style={S.hd}>Crecer con los clientes que ya tienes cuesta menos que conseguir nuevos. Esta es la mezcla.</div>
          {din.cobrado.monto === 0
            ? <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '10px 0' }}>Sin pagos en el periodo.</div>
            : <>
              <div style={{ display: 'flex', height: 12, borderRadius: 9, overflow: 'hidden', background: '#f4f3f7', marginBottom: 12 }}>
                {[[ori.base.monto, '#9B8CFA'], [ori.nuevas.monto, '#4FBF95'], [ori.sin_ligar.monto, '#dcdae4']].map(([v, c]: any, i) =>
                  v > 0 ? <span key={i} style={{ width: `${(v / totalOrigen) * 100}%`, background: c }} /> : null)}
              </div>
              <Renglon punto="#9B8CFA" label="Clientes que ya tenías" valor={money(ori.base.monto)} nota={`${ori.base.cuentas} ${ori.base.cuentas === 1 ? 'cuenta' : 'cuentas'} · ${Math.round((ori.base.monto / totalOrigen) * 100)}%`} />
              <Renglon punto="#4FBF95" label="Cuentas nuevas" valor={money(ori.nuevas.monto)} nota={`${ori.nuevas.cuentas} ${ori.nuevas.cuentas === 1 ? 'cuenta' : 'cuentas'} · ${Math.round((ori.nuevas.monto / totalOrigen) * 100)}%`} />
              {ori.sin_ligar.monto > 0 && <Renglon punto="#dcdae4" label="Sin cliente ligado" valor={money(ori.sin_ligar.monto)} nota={`${ori.sin_ligar.n} ${ori.sin_ligar.n === 1 ? 'pago' : 'pagos'} · conviene asignarlos`} />}
            </>}
        </div>

        {/* 3 · El embudo */}
        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>El embudo<span style={S.hr}>del contacto al contrato</span></div>
          <div style={S.hd}>Dónde se atora. Los saltos entre pasos dicen más que los totales.</div>
          <Paso color="#7DA6F5" label="Leads nuevos" valor={String(emb.leads)} nota="empresas que entraron y aún no son clientes" />
          <Paso color="#9B8CFA" label="Cotizado" valor={money(emb.cotizado.monto)} nota={`${emb.cotizado.n} ${emb.cotizado.n === 1 ? 'cotización enviada' : 'cotizaciones enviadas'}`} />
          <Paso color="#4FBF95" label="Aceptado" valor={money(emb.aceptado.monto)}
            nota={emb.cotizado.n ? `${emb.aceptado.n} de ${emb.cotizado.n} · ${Math.round((emb.aceptado.n / emb.cotizado.n) * 100)}% de las enviadas` : 'sin cotizaciones que comparar'} />
          <Paso color="#1E8A63" label="Clientes nuevos" valor={String(emb.clientes_nuevos)} nota="con licencia que arrancó en el periodo" ultimo />
        </div>
      </div>

      {/* 4 · Cómo acompañé */}
      <div className="tb-2" style={{ marginBottom: 14 }}>
        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>Reuniones<span style={S.hr}>{ac.reuniones.total} en el periodo</span></div>
          <div style={S.hd}>En qué se fue el tiempo. Si casi todo es soporte y poco es demo, el mes que viene no entra nadie.</div>
          {ac.reuniones.total === 0
            ? <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '10px 0' }}>Sin reuniones en el periodo.</div>
            : <>
              {ac.reuniones.tipos.map((t: any, i: number) => {
                const col = ['#9B8CFA', '#7DA6F5', '#4FBF95', '#F0B84E', '#C9C7D0'][i % 5];
                return (
                  <div key={t.nombre} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: col, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t.nombre}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 800 }}>{t.n}</span>
                    </div>
                    <div style={{ height: 7, background: '#f4f3f7', borderRadius: 9, overflow: 'hidden', marginTop: 3 }}>
                      <span style={{ display: 'block', height: '100%', borderRadius: 9, background: col, width: `${Math.max(3, (t.n / ac.reuniones.total) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ ...S.ke, marginTop: 10 }}>
                Asistieron <b style={{ color: '#3f3b4d' }}>{ac.reuniones.fueron}</b> de {ac.reuniones.total}.
                {ac.reuniones.sin_marcar > 0 && <> Quedan <b style={{ color: '#9a6a10' }}>{ac.reuniones.sin_marcar}</b> ya pasadas sin marcar asistencia.</>}
              </div>
            </>}
        </div>

        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>Consultoría<span style={S.hr}>compromisos con el cliente</span></div>
          <div style={S.hd}>Lo que se prometió en las juntas. Un compromiso vencido cuesta más que una junta perdida.</div>
          <Renglon punto="#7DA6F5" label="Nuevos en el periodo" valor={String(ac.consultoria.nuevas)} nota="pactados con el cliente" />
          <Renglon punto="#4FBF95" label="Entregados" valor={String(ac.consultoria.entregadas)} nota="cerrados en total" />
          <Renglon punto="#F0B84E" label="En proceso" valor={String(ac.consultoria.en_proceso)} nota={`${ac.consultoria.idea} más apuntados como idea`} />
          <Renglon punto={ac.consultoria.vencidas ? '#C0554E' : '#dcdae4'} label="Vencidos" valor={String(ac.consultoria.vencidas)}
            nota={ac.consultoria.vencidas ? `en ${ac.consultoria.cuentas_vencidas} ${ac.consultoria.cuentas_vencidas === 1 ? 'cuenta' : 'cuentas'}` : 'ninguno pasado de fecha'} />
        </div>
      </div>

      {/* Lo que facturan ELLOS: no es dinero de SACS, es el argumento de la
          renovación. Si el cliente vende, el cliente se queda. */}
      <div style={S.card}>
        <div style={S.h}>Lo que facturan tus clientes<span style={S.hr}>últimos 30 días · no depende del periodo</span></div>
        <div style={S.hd}>El dinero que ellos mueven dentro de SACS. Es la mejor prueba de que el sistema les sirve.</div>
        <div className="tb-4">
          <Tile plano color="#5B4BD6" label="Facturado por la cartera" valor={corto(car.facturacion)} sub={`${car.cuentas} cuentas activas medidas`} />
          <Tile plano color="#4FBF95" label="Ventas capturadas" valor={Number(car.ventas || 0).toLocaleString('es-MX')} sub="tickets en 30 días" />
          <Tile plano color="#9B8CFA" label="Cuentas operando" valor={`${car.operando} de ${car.cuentas}`} sub="con ventas en los últimos 30 días" />
          <Tile plano color={car.cuentas - car.operando ? '#C0554E' : '#c9c7d0'} label="Sin vender" valor={String(car.cuentas - car.operando)}
            sub={car.cuentas - car.operando ? 'pagan y no usan: riesgo de baja' : 'todas están vendiendo'} />
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════ Bloques que no cambian con la vista ═══════════════════════ */

function Cobranza({ d, abrir }: any) {
  const cob = d.cobrar;
  return (
    <div style={S.card}>
      <div style={S.h}>ARR por cobrar<span style={S.hr}>próximos 90 días</span></div>
      <div style={S.hd}>Lo que ya está contratado y toca renovar. No es una proyección: son fechas con nombre y monto.</div>
      <div className="tb-4" style={{ marginBottom: 12 }}>
        {[
          ['Vencido', cob.vencido, '#FEF0EF', '#f7c9c5', '#C0554E'],
          ['En 30 días', cob.d30, '#FEF6E7', '#f5e2b8', '#9a6a10'],
          ['En 60 días', cob.d60, '#EEECFE', '#ddd6fb', '#5B4BD6'],
          ['En 90 días', cob.d90, '#E3EDFD', '#cfe0fa', '#2C5FC4'],
        ].map(([t, v, bg, bd, fg]: any) => (
          <div key={t} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: fg, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: fg, marginTop: 4, letterSpacing: '-.02em' }}>{money(v.monto)}</div>
            <div style={{ fontSize: '0.67rem', color: fg, marginTop: 3 }}>{v.n} {v.n === 1 ? 'renovación' : 'renovaciones'}</div>
          </div>
        ))}
      </div>
      {[...cob.vencido.items, ...cob.d30.items].slice(0, 6).map((r: any) => {
        const venc = r.fecha < iso(new Date());
        return (
          <div key={r.id} style={S.fila}>
            <span style={S.pill(venc ? '#FEF0EF' : '#FEF6E7', venc ? '#C0554E' : '#9a6a10')}>{venc ? 'vencido' : fmtDate(r.fecha)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => abrir(r.company_id)}>{r.cliente}</div>
              <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{r.plan} · {venc ? `venció el ${fmtDate(r.fecha)}` : `renueva el ${fmtDate(r.fecha)}`}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <b style={{ color: venc ? '#C0554E' : '#1a1a1a' }}>{money(r.monto)}</b>
              <div style={{ marginTop: 4, display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                <button style={S.btnA} onClick={() => window.open(`/estado-cuenta/cliente/${r.company_id}?subs=${r.id}`, '_blank', 'noopener')}>Estado de cuenta</button>
                {r.link && <a style={S.btnP} href={r.link} target="_blank" rel="noreferrer">Cobrar</a>}
              </div>
            </div>
          </div>
        );
      })}
      {cob.vencido.n === 0 && cob.d30.n === 0 && <div style={{ padding: '14px 0', color: '#c9c7d0', fontSize: '0.8rem' }}>Nada por cobrar en los próximos 30 días.</div>}
    </div>
  );
}

function Metas({ d }: any) {
  const m = d.metas;
  const barra = (real: number, meta: number, color: string) => (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.02em' }}>{money(real)}</span>
        <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>de {money(meta)}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 800, color: meta && real / meta >= 0.8 ? '#1E8A63' : '#C0554E' }}>
          {meta > 0 ? Math.round((real / meta) * 100) : 0}%
        </span>
      </div>
      <div style={{ height: 9, background: '#f1f0f5', borderRadius: 9, overflow: 'hidden', margin: '7px 0 5px' }}>
        <span style={{ display: 'block', height: '100%', borderRadius: 9, background: color, width: `${Math.min(100, meta > 0 ? (real / meta) * 100 : 0)}%` }} />
      </div>
    </>
  );
  return (
    <div style={S.card}>
      <div style={S.h}>Meta del mes<span style={S.hr}>siempre del mes corriente · quedan {m.dias_restantes} días</span></div>
      <div className="tb-3">
        <div>
          <div style={S.kl}>Ingresos totales</div>
          {barra(m.ingresos.real, m.ingresos.meta, '#9B8CFA')}
          <div style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>Faltan <b style={{ color: '#3f3b4d' }}>{money(Math.max(0, m.ingresos.meta - m.ingresos.real))}</b> · todo lo cobrado en el mes</div>
        </div>
        <div>
          <div style={S.kl}>ARR nuevo</div>
          {barra(m.arr.real, m.arr.meta, '#7DA6F5')}
          <div style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>Pipeline abierto <b style={{ color: '#3f3b4d' }}>{money(m.pipeline)}</b></div>
        </div>
        <div>
          <div style={S.kl}>Pagos únicos</div>
          {barra(m.unicos.real, m.unicos.meta, '#F0B84E')}
          <div style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>Personalizaciones, plugins y extras</div>
        </div>
      </div>
      {/* Recurrente y pago único se venden distinto y valen distinto: una sola
          barra los mezclaba y escondía cuál de los dos va mal. */}
      {m.arr.meta > m.arr.real && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid #f5f4f8', fontSize: '0.76rem', fontWeight: 700, color: m.pipeline >= (m.arr.meta - m.arr.real) ? '#1E8A63' : '#C0554E' }}>
          {m.pipeline >= (m.arr.meta - m.arr.real)
            ? `El pipeline alcanza: ${money(m.pipeline)} abiertos contra ${money(m.arr.meta - m.arr.real)} que faltan.`
            : `Con el pipeline abierto no alcanzas la meta de ARR: faltarían ${money(m.arr.meta - m.arr.real - m.pipeline)} aun cerrando todo.`}
        </div>
      )}
    </div>
  );
}

function Salud({ d }: any) {
  const sal = d.salud, k = d.kpis;
  return (
    <div style={S.card}>
      <div style={S.h}>Salud del negocio<span style={S.hr}>ARR {money(k.arr)} · {k.clientes} clientes activos</span></div>
      <div style={S.hd}>Lo que preguntan un inversionista y tu equipo. Cada número dice qué significa; lo que todavía no se puede calcular con la historia que hay, lo dice.</div>
      <div className="tb-3">
        <Metrica rosa titulo="Retención neta (NRR)" valor={sal.nrr != null ? `${sal.nrr}%` : '—'} color={sal.nrr != null && sal.nrr >= 100 ? '#1E8A63' : '#9a6a10'}
          explica={sal.nrr != null
            ? <>De cada $100 que te pagaban al inicio del periodo, hoy te pagan <b>${sal.nrr}</b> los MISMOS clientes. Arriba de 100 creces sin vender a nadie nuevo.</>
            : <>Hace falta más historia de altas y bajas para calcularla.</>} />
        <Metrica rosa titulo="Bajas (churn)" valor={sal.churn_pct != null ? `${sal.churn_pct}%` : '—'}
          explica={sal.churn_arr ? <>Se fueron <b>{money(sal.churn_arr)} de ARR</b> en el periodo. A ese ritmo, perderías esa proporción del negocio cada mes.</>
            : <>Sin bajas en el periodo. Eso es lo que sostiene el ARR.</>} />
        <Metrica rosa titulo="Ingreso por cuenta" valor={money(sal.arpa)}
          explica={<>ARR entre clientes activos. Sube cuando vendes plugins y personalizaciones, no solo licencias.</>} />
        <Metrica titulo="Tasa de cierre" valor={sal.cierre_pct != null ? `${sal.cierre_pct}%` : '—'} color="#5B4BD6"
          explica={sal.cierre_pct != null
            ? <>De cada 10 cotizaciones resueltas, <b>{Math.round(sal.cierre_pct / 10)} se pagan</b>. Sobre {sal.cierre_n} cotizaciones cerradas.</>
            : <>Todavía no hay cotizaciones resueltas para calcularla.</>} />
        <Metrica titulo="Ciclo de venta" valor={sal.ciclo_dias != null ? `${sal.ciclo_dias} días` : '—'} color="#5B4BD6"
          explica={sal.ciclo_dias != null
            ? <>Lo que pasa entre que mandas la cotización y te pagan. Para cerrar este mes, hay que cotizar con {sal.ciclo_dias} días de anticipación.</>
            : <>Aún no hay cotizaciones pagadas para medirlo.</>} />
        <Metrica rosa titulo="Antigüedad promedio"
          valor={sal.antiguedad_meses != null ? (sal.antiguedad_meses >= 12 ? `${(sal.antiguedad_meses / 12).toFixed(1).replace('.0', '')} años` : `${sal.antiguedad_meses} meses`) : '—'}
          explica={sal.antiguedad_meses != null
            ? <>Lo que llevan tus <b>{sal.antiguedad_n} cuentas activas</b> contigo, desde su primera suscripción. Es lo que separa un negocio que retiene de uno que solo repone.</>
            : <>Faltan fechas de inicio en las suscripciones para calcularla.</>} />
        <Metrica titulo="Concentración" valor={sal.concentracion != null ? `${sal.concentracion}%` : '—'} color={(sal.concentracion || 0) > 30 ? '#9a6a10' : '#1E8A63'}
          explica={<>Tus <b>5 cuentas más grandes</b> son ese porcentaje del ARR. Arriba de 30% un inversionista lo marca como riesgo.</>} />
      </div>
    </div>
  );
}

function Planes({ d }: any) {
  return (
    <div style={{ ...S.card, margin: 0 }}>
      <div style={S.h}>Ingresos por plan<span style={S.hr}>MRR {money(d.mrr_total)}</span></div>
      {d.planes.length === 0 && <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '10px 0' }}>Sin suscripciones activas.</div>}
      {d.planes.map((p: any, i: number) => {
        const tope = Math.max(1, ...d.planes.map((x: any) => x.mrr));
        const col = ['#9B8CFA', '#7DA6F5', '#4FBF95', '#F0B84E', '#C9C7D0'][i % 5];
        return (
          <div key={p.nombre} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: col, flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.nombre}</span>
              <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{p.clientes} {p.clientes === 1 ? 'cliente' : 'clientes'}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 800 }}>{money(p.mrr)}</span>
            </div>
            <div style={{ height: 7, background: '#f4f3f7', borderRadius: 9, overflow: 'hidden', marginTop: 3 }}>
              <span style={{ display: 'block', height: '100%', borderRadius: 9, background: col, width: `${Math.max(2, (p.mrr / tope) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Atencion({ d, abrir }: any) {
  return (
    <div style={{ ...S.card, margin: 0 }}>
      <div style={S.h}>Atención<span style={S.hr}>{d.atencion.cotizaciones.length} por vencer · {d.atencion.riesgo.length} en riesgo</span></div>
      {d.atencion.cotizaciones.length === 0 && d.atencion.riesgo.length === 0 && (
        <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '10px 0' }}>Nada urgente. Bien ahí.</div>
      )}
      {d.atencion.cotizaciones.map((q: any) => (
        <div key={q.id} style={S.fila}>
          <span style={S.pill('#FEF6E7', '#9a6a10')}>vence en {q.dias} d</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{q.numero} · {q.empresa}</div>
            <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{money(q.total)} · {q.vistas ? `vista ${q.vistas} ${q.vistas === 1 ? 'vez' : 'veces'}` : 'sin abrir'}</div>
          </div>
          <a style={{ ...S.btnA, marginLeft: 'auto' }} href={`/cotizacion/${q.id}`} target="_blank" rel="noreferrer">Abrir</a>
        </div>
      ))}
      {d.atencion.riesgo.map((c: any) => (
        <div key={c.id} style={S.fila}>
          <span style={S.pill('#FEF0EF', '#C0554E')}>{c.dias} d sin vender</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{c.nombre}</div>
            <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{money(c.arr)} de ARR en riesgo</div>
          </div>
          <button style={{ ...S.btnA, marginLeft: 'auto' }} onClick={() => abrir(c.id)}>Ver cuenta</button>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════ Piezas chicas ══════════════════════════ */

/** La tarjeta de cifra. La franja de color a la izquierda es lo único que la
 *  distingue de sus vecinas: cuatro tarjetas con cuatro fondos distintos se
 *  leen como una alerta, y ninguna de estas lo es. */
function Tile({ color, label, valor, sub, pie, plano }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={S.kl}>{label}</div>
      <div style={{ ...S.kv, fontSize: plano ? '1.5rem' : '1.85rem', color }}>{valor}</div>
      <div style={S.ks}>{sub}</div>
      {pie && <div style={S.ke}>{pie}</div>}
    </div>
  );
}

/** Renglón etiqueta → cifra, con punto de color opcional. */
function Renglon({ punto, label, valor, nota }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderTop: '1px solid #f5f4f8' }}>
      {punto && <span style={{ width: 9, height: 9, borderRadius: 99, background: punto, flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{nota}</div>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: '0.92rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{valor}</span>
    </div>
  );
}

/** Un escalón del embudo: la línea vertical encadena los pasos para que se
 *  lea como un recorrido y no como cuatro cifras sueltas. */
function Paso({ color, label, valor, nota, ultimo }: any) {
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: color, flexShrink: 0 }} />
        {!ultimo && <span style={{ flex: 1, width: 2, background: '#f0eff5', marginTop: 3 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '9px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{nota}</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '1.05rem', fontWeight: 800, color, whiteSpace: 'nowrap' }}>{valor}</span>
      </div>
    </div>
  );
}

/** Una métrica con su explicación. El rosa marca las de inversionista: son las
 *  que no se tocan a diario, y así se distinguen sin gritar. */
function Metrica({ titulo, valor, explica, color, rosa }: any) {
  return (
    <div style={{
      border: '1px solid', borderColor: rosa ? 'rgba(244,168,205,.45)' : '#f0eff3',
      background: rosa ? 'rgba(244,168,205,.13)' : '#fff', borderRadius: 11, padding: '12px 14px',
    }}>
      <div style={{ fontSize: '0.63rem', fontWeight: 800, color: rosa ? '#9c3d70' : '#5B4BD6', textTransform: 'uppercase', letterSpacing: '.06em' }}>{titulo}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 4, letterSpacing: '-.02em', color: color || '#1a1a1a' }}>{valor}</div>
      <div style={{ fontSize: '0.68rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.5 }}>{explica}</div>
    </div>
  );
}
