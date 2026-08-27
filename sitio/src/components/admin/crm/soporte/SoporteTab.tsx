// SOPORTE · Dashboard GLOBAL de soporte (tab del CRM). Volumen por estado/tema,
// SLA (primera respuesta y resolución), sentimiento, quién consume el soporte y
// tendencia. Founder-only (middleware).
//
// Habla el MISMO idioma visual que el dashboard de Cotizaciones: tarjetas con
// franja de color a la izquierda, comparativo contra el periodo anterior, y la
// gama de abajo. No se inventa color aquí — el mostaza que había antes no
// existe en el sistema.
import { useEffect, useState } from 'react';
import { useIsMobile } from '../../../../lib/ui/mobile';
import { S, Tag, Aviso, Vacio, Cargando, fmtFecha } from '../email/ui';
import ClienteDrawer360 from '../ClienteDrawer360';
import Hallazgos from './Hallazgos';
import Capacitacion from './Capacitacion';
import { TEMA_LABEL } from '../../../../lib/soporte/clasificar';

// ─── Gama (la de Cotizaciones) ───
// Morado y azul cielo son los protagonistas y visten todo lo estructural. El
// verde es lo que cierra bien (resuelto), el rojo SOLO la alarma de verdad
// (estancado, urgente) — si el rojo se usa para todo, deja de gritar.
const VERDE = '#4FBF95';        // verde pastel — barras y franjas de lo resuelto
const VERDE_TINTA = '#1E8A63';  // el mismo, legible — para las CANTIDADES
const MORADO = '#9B8CFA';       // morado — estructura, volumen
const MORADO_SUAVE = '#B6ABFC'; // morado claro
const AZUL = '#7DA6F5';         // azul cielo — lo que entra, todavía en juego
const ROJO = '#C0554E';         // rojo pastel en tinta — la alarma
const TINTA = '#5B4BD6';        // morado oscuro — texto y énfasis

const CSS = `
  .sop { width: 100%; min-width: 0; }
  .sop-card { min-width: 0; }
  .sop-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
  .sop-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  @media (max-width: 1250px) { .sop-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px)  { .sop-2 { grid-template-columns: 1fr; } }
  @media (max-width: 700px)  { .sop-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const hoyMx = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
const hace = (d: number) => new Date(Date.parse(hoyMx() + 'T00:00:00Z') - d * 86400_000).toISOString().slice(0, 10);

// El sentimiento en la gama: urgente y negativo son alarma, positivo es lo que
// cierra bien, neutral no es noticia.
const SENT: Record<string, { bg: string; fg: string }> = {
  urgente: { bg: '#FBECEA', fg: ROJO },
  negativo: { bg: '#FBECEA', fg: ROJO },
  neutral: { bg: '#f4f4f6', fg: '#6B7280' },
  positivo: { bg: '#EAF8F2', fg: VERDE_TINTA },
};

// ─── Piezas del lenguaje de Cotizaciones ───
function Kpi({ t, v, barra, hijo }: { t: string; v: any; barra?: string; hijo?: any }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: `3px solid ${barra || MORADO}`, borderRadius: 12, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t}</div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em' }}>{v}</div>
      <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6', lineHeight: 1.5 }}>{hijo}</div>
    </div>
  );
}

/** Comparativo contra el periodo anterior. `invertido` para los tiempos: bajar
 *  es mejorar. `neutro` cuando más no es ni bueno ni malo (los que entran): un
 *  color ahí sería una opinión que el dato no sostiene. */
function Delta({ v, a, invertido, neutro }: { v: number | null; a: number | null; invertido?: boolean; neutro?: boolean }) {
  if (v == null || a == null || a === 0) return <span style={{ color: '#b3afbd' }}>sin comparativo</span>;
  const dif = Math.round(((v - a) / Math.abs(a)) * 100);
  if (dif === 0) return <span style={{ color: '#9c99a6' }}>igual que el periodo anterior</span>;
  const color = neutro ? '#7d7a88' : ((invertido ? dif < 0 : dif > 0) ? VERDE_TINTA : TINTA);
  return <span style={{ color, fontWeight: 800 }}>{dif > 0 ? '↑' : '↓'} {Math.abs(dif)}%</span>;
}

function Tarjeta({ titulo, cap, extra, children }: { titulo: string; cap?: string; extra?: any; children: any }) {
  return (
    <div className="sop-card" style={{ background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '18px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '0.83rem', margin: 0, fontWeight: 800, flex: 1 }}>{titulo}</h3>
        {extra}
      </div>
      {cap && <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 3, marginBottom: 16 }}>{cap}</div>}
      {!cap && <div style={{ height: 14 }} />}
      {children}
    </div>
  );
}

const VISTAS = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'chat', label: 'Lo que salió del chat' },
  { id: 'calificacion', label: 'Calificación' },
  { id: 'capacitacion', label: 'Capacitación' },
] as const;
type Vista = typeof VISTAS[number]['id'];

/** Barra de vistas. El tablero se estaba comiendo cuatro temas distintos en una
 *  sola pantalla de cinco mil píxeles; cada uno se gestiona por separado. */
function BarraVistas({ vista, setVista, pendientes }: { vista: Vista; setVista: (v: Vista) => void; pendientes: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid #f0eff3', marginBottom: 18 }}>
      {VISTAS.map(v => (
        <button key={v.id} onClick={() => setVista(v.id)} aria-current={vista === v.id ? 'page' : undefined}
          style={{
            border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            padding: '9px 13px 11px', fontSize: '0.82rem', position: 'relative',
            fontWeight: vista === v.id ? 800 : 500,
            color: vista === v.id ? '#5B4BD6' : '#8a8a92',
            boxShadow: vista === v.id ? 'inset 0 -3px 0 #9B8CFA' : 'none',
          }}>
          {v.label}
          {v.id === 'chat' && pendientes > 0 && (
            <span style={{ marginLeft: 6, background: '#9B8CFA', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 800 }}>{pendientes}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Encabezado({ periodo, children }: { periodo?: any; children?: any }) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
      <style>{CSS}</style>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Soporte</h2>
        <div style={{ fontSize: '0.74rem', color: '#9c99a6', marginTop: 3 }}>
          {periodo
            ? <>Del {fechaCorta(periodo.desde)} al {fechaCorta(periodo.hasta)} · comparado contra los {periodo.dias} días anteriores</>
            : 'Todo lo que entra por Intercom: qué se pide, qué tan rápido se resuelve y quién lo pide.'}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Selector de periodo: atajos + rango personalizado ──────────────────────
function SelectorPeriodo({ modo, dias, desde, hasta, onDias, onRango, onModo }: any) {
  const chip = (on: boolean) => ({
    border: '1px solid', borderColor: on ? '#cdbdf7' : '#e2e4e9', background: on ? '#EEECFE' : '#fff',
    color: on ? '#6d4bc7' : '#666', borderRadius: 8, padding: '5px 12px', fontSize: '0.74rem',
    fontWeight: on ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit',
  });
  const input = { border: '1px solid #cdbdf7', color: '#6d4bc7', borderRadius: 8, padding: '5px 9px', fontSize: '0.73rem', fontWeight: 700, fontFamily: 'inherit', background: '#fff' };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: '0.72rem', color: '#9c99a6', fontWeight: 700 }}>Periodo:</span>
      {[14, 30, 90].map(n => (
        <button key={n} onClick={() => onDias(n)} style={chip(modo === 'dias' && dias === n)}>{n} días</button>
      ))}
      <button onClick={() => onModo(modo === 'rango' ? 'dias' : 'rango')} style={chip(modo === 'rango')}>Personalizado</button>
      {modo === 'rango' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={desde} max={hasta || hoyMx()} onChange={e => onRango(e.target.value, hasta)} style={input} aria-label="Desde" />
          <span style={{ fontSize: '0.72rem', color: '#9c99a6' }}>al</span>
          <input type="date" value={hasta} min={desde} max={hoyMx()} onChange={e => onRango(desde, e.target.value)} style={input} aria-label="Hasta" />
        </div>
      )}
    </div>
  );
}

// ── Dona de temas ─────────────────────────────────────────────────────────
// Rampa morado→azul (los dos protagonistas de la gama) y gris SOLO para el
// cajón del clasificador: que la rebanada muerta se vea muerta.
const RAMPA = ['#7C6BF0', '#9B8CFA', '#B6ABFC', '#7DA6F5', '#A9C6F8', '#CFE0FA'];
const AZUL_RESTO = '#DDE8FC';
const GRIS_SIN = '#D7D4DE';

function DonaTemas({ temas, total, etiqueta }: { temas: any[]; total: number; etiqueta: string }) {
  // Los concretos mandan; 'otros' es el cajón y va SIEMPRE al final, en gris,
  // aunque sea la rebanada más grande — que hoy lo es.
  const concretos = temas.filter((x: any) => x.tema !== 'otros');
  const sinClasificar = temas.find((x: any) => x.tema === 'otros')?.n || 0;
  const top = concretos.slice(0, 6);
  const restoN = concretos.slice(6).reduce((a: number, x: any) => a + x.n, 0);
  const restoCuantos = concretos.slice(6).length;

  const piezas: Array<{ label: string; n: number; color: string; apagado?: boolean }> = [
    ...top.map((x: any, i: number) => ({ label: x.label, n: x.n, color: RAMPA[i] })),
    ...(restoN ? [{ label: `Otros ${restoCuantos} temas`, n: restoN, color: AZUL_RESTO }] : []),
    ...(sinClasificar ? [{ label: 'Sin clasificar', n: sinClasificar, color: GRIS_SIN, apagado: true }] : []),
  ];
  const suma = piezas.reduce((a, x) => a + x.n, 0) || 1;

  // conic-gradient en vez de arcos SVG: una dona de siete rebanadas no necesita
  // trigonometría, y así el anillo no depende de que corra JavaScript.
  let acc = 0;
  const tramos = piezas.map(x => {
    const ini = (acc / suma) * 100; acc += x.n;
    return `${x.color} ${ini.toFixed(3)}% ${((acc / suma) * 100).toFixed(3)}%`;
  }).join(',');
  const pctDe = (n: number) => Math.round((n / suma) * 100);
  const gris = sinClasificar / suma;

  return (
    <Tarjeta titulo="De qué se trata el soporte" cap="Cuánto pesa cada tema de lo que entró en el periodo."
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{total} tickets · {etiqueta}</span>}>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 168, height: 168, flexShrink: 0, borderRadius: '50%', background: `conic-gradient(${tramos})` }}>
          <div style={{ position: 'absolute', inset: 31, background: '#fff', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <b style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>{total}</b>
            <span style={{ fontSize: '0.55rem', color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3, fontWeight: 800 }}>tickets</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          {piezas.map((x, i) => (
            <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', fontSize: '0.77rem', borderTop: i ? '1px solid #f6f5f9' : 'none' }}>
              <i style={{ width: 9, height: 9, borderRadius: 3, background: x.color, display: 'block', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: x.apagado ? '#8a8a8a' : '#1a1a1a' }}>{x.label}</span>
              <span style={{ color: '#a5a2af', width: 34, textAlign: 'right' }}>{pctDe(x.n)}%</span>
              <b style={{ width: 30, textAlign: 'right', color: x.apagado ? '#8a8a8a' : '#1a1a1a' }}>{x.n}</b>
            </div>
          ))}
        </div>
      </div>
      {gris > 0.3 && (
        <div style={{ fontSize: '0.72rem', color: '#7d7a88', marginTop: 14, lineHeight: 1.6, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
          <b>La rebanada gris es {pctDe(sinClasificar)}%.</b> "Sin clasificar" no es un tema: es el cajón de <code style={{ background: '#f4f3f8', borderRadius: 4, padding: '1px 5px' }}>clasificar.ts</code>. Se arregla con reglas nuevas, no leyendo esa barra.
        </div>
      )}
    </Tarjeta>
  );
}

// ── Área: lo que entra contra lo que se resuelve ──────────────────────────
function AreaFlujo({ serie, periodo, kpis, etiqueta }: { serie: any[]; periodo: any; kpis: any; etiqueta: string }) {
  const W = 600, H = 143;
  const max = Math.max(1, ...serie.map((x: any) => Math.max(x.abiertos, x.resueltos)));
  const px = (i: number) => (serie.length < 2 ? W / 2 : (i / (serie.length - 1)) * W);
  const py = (v: number) => H - (v / max) * (H - 6) - 3;
  const linea = (k: string) => serie.map((d: any, i: number) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(d[k]).toFixed(1)}`).join(' ');
  const area = (k: string) => `${linea(k)} L${W} ${H} L0 ${H} Z`;
  const entraron = kpis?.entraron?.valor ?? 0, resueltos = kpis?.resueltos?.valor ?? 0;
  const acumulado = entraron - resueltos;
  const ancho = serie.length ? W / serie.length : W;

  return (
    <Tarjeta titulo="Lo que entra contra lo que se resuelve"
      cap={`Cuando la curva azul va arriba de la verde, se está acumulando trabajo. ${periodo?.agrupado === 'semana' ? 'Por semana.' : 'Por día.'}`}
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{etiqueta}</span>}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }} role="img"
        aria-label={`Entraron ${entraron} y se resolvieron ${resueltos} en el periodo`}>
        <defs>
          {/* El relleno se desvanece hacia abajo: dos áreas planas encimadas se
              mezclan en un verdeazul que no es ninguno de los dos colores. */}
          <linearGradient id="sopVerde" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VERDE} stopOpacity="0.42" /><stop offset="100%" stopColor={VERDE} stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="sopAzul" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AZUL} stopOpacity="0.34" /><stop offset="100%" stopColor={AZUL} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area('resueltos')} fill="url(#sopVerde)" />
        <path d={linea('resueltos')} fill="none" stroke={VERDE} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={area('abiertos')} fill="url(#sopAzul)" />
        <path d={linea('abiertos')} fill="none" stroke={AZUL} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {/* Bandas invisibles: sin ellas el área pierde el dato por día que las
            barras SÍ daban al pasar el cursor. */}
        {serie.map((d: any, i: number) => (
          <rect key={d.dia} x={(i * ancho).toFixed(1)} y={0} width={ancho.toFixed(1)} height={H} fill="transparent">
            <title>{`${fechaCorta(d.dia)}: entraron ${d.abiertos}, se resolvieron ${d.resueltos}`}</title>
          </rect>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', color: '#b3b1bb', marginTop: 6, fontWeight: 700 }}>
        <span>{fechaCorta(periodo?.desde || '')}</span><span>{fechaCorta(periodo?.hasta || '')}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a5a2af', marginTop: 12 }}>
        <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: AZUL }} />Entraron</span>
        <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: VERDE }} />Se resolvieron</span>
      </div>
      <div style={{ display: 'flex', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
        {[
          { et: 'Entraron', v: entraron, c: '#2C5FC4' },
          { et: 'Se resolvieron', v: resueltos, c: VERDE_TINTA },
          { et: acumulado >= 0 ? 'Se acumularon' : 'Se descontaron', v: Math.abs(acumulado), c: acumulado > 0 ? ROJO : VERDE_TINTA },
        ].map(x => (
          <div key={x.et} style={{ flex: 1 }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em' }}>{x.et}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 2, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

// ── La encuesta NATIVA de Intercom ────────────────────────────────────────
// Intercom trae su propia calificación al cerrar el chat y la expone en la API
// (`conversation_rating`). Es mejor pregunta que la nuestra: se hace en el
// momento y en el mismo lugar donde pasó la atención, no la próxima vez que el
// cliente entra al ERP. Hoy no llega ninguna porque está APAGADA en Intercom —
// y eso hay que decirlo, no dibujar un cero como si a nadie le importara.
function RatingIntercom({ intercom, etiqueta }: { intercom: any; etiqueta: string }) {
  const n = intercom?.n || 0;
  const dist = intercom?.dist || {};
  const max = Math.max(1, ...CARAS.map(c => dist[c.v] || 0));
  return (
    <Tarjeta titulo="Calificación al cerrar el chat (Intercom)"
      cap="La encuesta que Intercom le muestra al cliente en el momento en que se cierra la conversación."
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{etiqueta}</span>}>
      {!intercom?.activa ? (
        <div style={{ background: '#FFF6E3', border: '1px solid #E8C88A', borderRadius: 11, padding: '13px 15px', fontSize: '0.79rem', color: '#8a6512', lineHeight: 1.7 }}>
          <b>Está apagada en Intercom.</b> Revisé la cuenta entera: de 150 conversaciones traídas, 146 cerradas
          y <b>ninguna</b> con calificación. El campo existe en la API y el tablero ya lo está leyendo en cada
          sincronización — el día que se prenda, aparece aquí solo, sin tocar código.
          <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid #E8C88A66' }}>
            No se puede prender desde la API: es un interruptor en la configuración de Intercom
            (<i>Settings → Conversation ratings</i>). Es la única parte que tiene que hacer una persona.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 16 }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, color: (intercom.promedio ?? 0) >= 4 ? VERDE_TINTA : (intercom.promedio ?? 0) >= 3 ? TINTA : ROJO }}>{intercom.promedio}</span>
            <span style={{ fontSize: '0.9rem', color: '#a5a2af', fontWeight: 700 }}>/ 5</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#a5a2af', fontWeight: 700 }}>{n} calificación{n === 1 ? '' : 'es'}</span>
          </div>
          {CARAS.map(c => {
            const v = dist[c.v] || 0;
            return (
              <div key={c.v} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <span style={{ fontSize: '1.15rem', width: 24, textAlign: 'center' }}>{c.em}</span>
                <span style={{ flex: 1, height: 9, background: '#f3f2f7', borderRadius: 5, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 5, width: `${(v / max) * 100}%`, background: c.color }} />
                </span>
                <span style={{ width: 34, textAlign: 'right', fontWeight: 800, fontSize: '0.79rem' }}>{v}</span>
              </div>
            );
          })}
          {(intercom.comentarios || []).length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Lo que escribieron</div>
              {intercom.comentarios.map((c: any, i: number) => (
                <div key={i} style={{ padding: '7px 0', borderTop: i ? '1px solid #f7f6fa' : 'none' }}>
                  <span style={{ fontSize: '1rem', marginRight: 6 }}>{CARAS.find(x => x.v === c.rating)?.em}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.76rem' }}>{c.cuenta}</span>
                  <div style={{ fontSize: '0.77rem', color: '#3f3b4d', fontStyle: 'italic', marginTop: 3, lineHeight: 1.55 }}>"{c.remark}"</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}

// ── Cuándo pide soporte la cartera ────────────────────────────────────────
// Mapa de calor día × hora. Responde a "¿qué día se ocupa más?" y "¿a qué hora
// hay que tener a alguien?" — la única tarjeta del tablero que habla de turnos
// y no de clientes.
function Cuando({ cuando, etiqueta }: { cuando: any; etiqueta: string }) {
  const dias = cuando?.dias || [];
  const porHora: number[] = cuando?.por_hora || [];
  const n = cuando?.n || 0;
  if (!n) {
    return (
      <Tarjeta titulo="Cuándo pide soporte tu cartera" cap={`No se abrió ningún ticket en este periodo (${etiqueta}).`}>
        <div />
      </Tarjeta>
    );
  }
  const maxCelda = Math.max(1, ...dias.flatMap((d: any) => d.horas));
  const maxDia = Math.max(1, ...dias.map((d: any) => d.n));
  const maxHora = Math.max(1, ...porHora);
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const enReloj = (h: number) => { const x = h % 12 === 0 ? 12 : h % 12; return `${x}${h < 12 ? ' a.m.' : ' p.m.'}`; };
  const pd = cuando.pico_dia || {}, pf = cuando.pico_franja || {};
  const DIA_LARGO: Record<string, string> = { Lun: 'lunes', Mar: 'martes', Mié: 'miércoles', Jue: 'jueves', Vie: 'viernes', Sáb: 'sábado', Dom: 'domingo' };

  return (
    <Tarjeta titulo="Cuándo pide soporte tu cartera"
      cap="Cada ticket, por el día y la hora de México en que el cliente lo abrió. Mientras más oscuro, más carga."
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{n} tickets · {etiqueta}</span>}>
      <div className="crm-scroll-x">
        <div style={{ minWidth: 620 }}>
          {/* Eje de horas: una etiqueta cada tres, o no se lee. */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 82  /* 30 día + 2 gap + 40 barra + 8 margen + 2 gap */, marginBottom: 4 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ flex: 1, fontSize: '0.55rem', color: '#b3b1bb', textAlign: 'center', fontWeight: 700 }}>
                {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </div>
            ))}
          </div>
          {dias.map((d: any) => (
            <div key={d.i} style={{ display: 'flex', gap: 2, alignItems: 'center', marginBottom: 3 }}>
              <div style={{ width: 30, fontSize: '0.68rem', color: d.i === pd.i ? TINTA : '#8a8590', fontWeight: d.i === pd.i ? 800 : 600 }}>{d.label}</div>
              {/* Barra del día: contesta "qué día se ocupa más" sin sumar celdas. */}
              <div style={{ width: 40, marginRight: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1, height: 5, background: '#f3f2f7', borderRadius: 3 }}>
                  <div style={{ width: `${(d.n / maxDia) * 100}%`, height: '100%', background: d.i === pd.i ? MORADO : '#d8d3f3', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: '0.6rem', color: '#a5a2af', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.n}</span>
              </div>
              {d.horas.map((v: number, h: number) => (
                <div key={h} title={`${d.label} ${hh(h)} — ${v} ticket${v === 1 ? '' : 's'}`}
                  style={{ flex: 1, height: 20, borderRadius: 4, background: v ? `rgba(155,140,250,${(0.14 + (v / maxCelda) * 0.86).toFixed(2)})` : '#f7f6fa' }} />
              ))}
            </div>
          ))}
          {/* Totales por hora, para leer el pico sin recorrer la rejilla. */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', marginLeft: 82  /* 30 día + 2 gap + 40 barra + 8 margen + 2 gap */, marginTop: 7, height: 26 }}>
            {porHora.map((v, h) => (
              <div key={h} title={`${hh(h)} — ${v} ticket${v === 1 ? '' : 's'}`}
                style={{ flex: 1, height: `${Math.max(v ? 12 : 3, (v / maxHora) * 100)}%`, background: v ? AZUL : '#f1f0f6', borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.78rem', color: '#3f3b4d', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7', lineHeight: 1.65 }}>
        El día más cargado es el <b>{DIA_LARGO[pd.label] || pd.label}</b> ({pd.n} tickets, {pd.pct}% de la semana), y la hora fuerte va de
        las <b>{enReloj(pf.desde)}</b> a las <b>{enReloj(pf.hasta)}</b> ({pf.n} tickets).
        {cuando.fuera_horario > 0 && <> Fuera de 8 a.m. – 9 p.m. entran {cuando.fuera_horario} ({Math.round((cuando.fuera_horario / n) * 100)}%).</>}
        {n < 60 && <span style={{ color: '#a5a2af' }}> Ojo: son {n} tickets en el periodo, poca base para leerlo como patrón — amplía el rango para que signifique algo.</span>}
      </div>
    </Tarjeta>
  );
}

// ── Calificación de la atención (CSAT) ────────────────────────────────────
const CARAS = [
  { v: 5, em: '\u{1F600}', color: VERDE },
  { v: 4, em: '\u{1F642}', color: '#8FD7BC' },
  { v: 3, em: '\u{1F610}', color: MORADO_SUAVE },
  { v: 2, em: '\u{1F615}', color: '#E2938C' },
  { v: 1, em: '\u{1F61E}', color: ROJO },
];

function Calificacion({ csat, etiqueta }: { csat: any; etiqueta: string }) {
  const dist = csat?.dist || {};
  const n = csat?.n || 0;
  const max = Math.max(1, ...CARAS.map(c => dist[c.v] || 0));
  return (
    <Tarjeta titulo="Cómo califican la atención"
      cap="Las cinco caras que el cliente ve dentro del ERP al resolverse su ticket. Es la respuesta a &laquo;¿resolvimos bien?&raquo;, no a &laquo;¿resolvimos rápido?&raquo;."
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{etiqueta}</span>}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 16 }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, color: n === 0 ? '#c9c7d0' : (csat.promedio ?? 0) >= 4 ? VERDE_TINTA : (csat.promedio ?? 0) >= 3 ? TINTA : ROJO }}>{n === 0 ? '—' : csat.promedio}</span>
        <span style={{ fontSize: '0.9rem', color: '#a5a2af', fontWeight: 700 }}>/ 5</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#a5a2af', fontWeight: 700 }}>{n} respuesta{n === 1 ? '' : 's'}</span>
      </div>
      {CARAS.map(c => {
        const v = dist[c.v] || 0;
        return (
          <div key={c.v} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, opacity: n === 0 ? 0.45 : 1 }}>
            <span style={{ fontSize: '1.15rem', width: 24, textAlign: 'center' }}>{c.em}</span>
            <span style={{ flex: 1, height: 9, background: '#f3f2f7', borderRadius: 5, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', borderRadius: 5, width: `${(v / max) * 100}%`, background: c.color }} />
            </span>
            <span style={{ width: 34, textAlign: 'right', fontWeight: 800, fontSize: '0.79rem' }}>{v}</span>
            <span style={{ width: 38, textAlign: 'right', color: '#a5a2af', fontSize: '0.72rem' }}>{n ? Math.round((v / n) * 100) : 0}%</span>
          </div>
        );
      })}
      {n === 0 ? (
        <div style={{ fontSize: '0.75rem', color: '#a5a2af', lineHeight: 1.65, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
          Todavía no hay ni una calificación en este periodo. La encuesta se dispara sola cuando un ticket
          se resuelve <b>en vivo</b> por el webhook de Intercom, y se le muestra al cliente la próxima vez
          que entra a SACS — los resueltos que vinieron del backfill histórico nunca la dispararon.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, borderRadius: 20, padding: '5px 12px', background: '#EAF8F2', color: VERDE_TINTA }}>{csat.promotores_pct ?? 0}% contentos (5)</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, borderRadius: 20, padding: '5px 12px', background: '#FBECEA', color: ROJO }}>{csat.detractores_pct ?? 0}% molestos (1–2)</span>
          {csat.anterior != null && csat.promedio != null && (
            <span style={{ fontSize: '0.7rem', fontWeight: 800, borderRadius: 20, padding: '5px 12px', background: '#f4f4f6', color: '#6B7280' }}>
              {csat.promedio >= csat.anterior ? '↑' : '↓'} {Math.abs(Math.round((csat.promedio - csat.anterior) * 10) / 10)} vs. periodo anterior
            </span>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

function Cobertura({ csat, onAbrir }: { csat: any; onAbrir: (id: string) => void }) {
  const c = csat?.cobertura || {};
  const base = Math.max(1, c.resueltos || 0);
  const lista = csat?.lista_detractores || [];
  const Paso = ({ et, pie, v, color }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid #f4f3f7' }}>
      <div style={{ width: 150, flexShrink: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{et}</div>
        <div style={{ fontSize: '0.66rem', color: '#a5a2af', lineHeight: 1.35, marginTop: 1 }}>{pie}</div>
      </div>
      <div style={{ flex: 1, minWidth: 60, height: 16, background: '#f5f4f8', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, ((v || 0) / base) * 100)}%`, background: color, borderRadius: 8 }} />
      </div>
      <div style={{ width: 52, textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: v ? '#1a1a1a' : ROJO }}>{v || 0}</div>
    </div>
  );
  return (
    <Tarjeta titulo="Cuánta atención alcanzamos a calificar"
      cap="Un promedio no vale nada si contestaron tres personas. Este embudo dice qué tan confiable es el número de al lado.">
      <div style={{ marginTop: -4 }}>
        <div style={{ borderTop: 'none' }}><Paso et="Resueltos" pie="Tickets cerrados en el periodo." v={c.resueltos} color={MORADO} /></div>
        <Paso et="Se les preguntó" pie="Cuentas encoladas a la encuesta del ERP." v={c.preguntados} color={AZUL} />
        <Paso et="Contestaron" pie="Respuestas que llegaron de vuelta." v={c.respondieron} color={VERDE} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 18 }}>
        <span style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.03em', color: c.tasa_pct ? VERDE_TINTA : ROJO }}>
          {c.respondieron || 0} de {c.resueltos || 0}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#a5a2af', fontWeight: 700 }}>
          resueltos alcanzaron a calificarse{c.tasa_pct != null ? ` · ${c.tasa_pct}%` : ''}
        </span>
      </div>

      {lista.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f4f3f7' }}>
          <h3 style={{ fontSize: '0.83rem', fontWeight: 800, margin: 0 }}>A quién hay que llamar</h3>
          <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 3, marginBottom: 12 }}>Cada 1 o 2, con nombre. El sistema ya levanta el aviso y la tarea; aquí se ven juntos.</div>
          <div className="crm-scroll-x"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Cliente', 'Calificó', 'Sobre', 'Cuándo'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{lista.map((x: any) => {
              const ligado = !!x.company_id;
              return (
                <tr key={x.conversation_id} onClick={() => ligado && onAbrir(x.company_id)} style={{ cursor: ligado ? 'pointer' : 'default' }}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{x.nombre || x.cuenta || 'Sin identificar'}</td>
                  <td style={S.td}>
                    <span style={{ fontSize: '1.05rem', marginRight: 5 }}>{CARAS.find(c2 => c2.v === x.score)?.em}</span>
                    <b style={{ color: ROJO }}>{x.score}</b>
                  </td>
                  <td style={{ ...S.td, color: '#666' }}>{x.tema_label || '—'}</td>
                  <td style={{ ...S.td, color: '#9c99a6', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtFecha(x.fecha)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      )}
    </Tarjeta>
  );
}

// ── Clientes que más piden atención ────────────────────────────────────────
function TopClientes({ filas, etiqueta, onAbrir }: { filas: any[]; etiqueta: string; onAbrir: (id: string) => void }) {
  const [todos, setTodos] = useState(false);
  if (!filas.length) {
    return (
      <Tarjeta titulo="Clientes que más piden atención" cap={`Nadie abrió ni movió un ticket en este periodo (${etiqueta}).`}>
        <div />
      </Tarjeta>
    );
  }
  const vista = todos ? filas : filas.slice(0, 10);
  const max = Math.max(1, ...filas.map((f: any) => f.n));
  const th = (der?: boolean) => ({ ...S.th, textAlign: (der ? 'right' : 'left') as any });

  return (
    <Tarjeta titulo="Clientes que más piden atención"
      cap="Quién consume el soporte por este canal. Da clic en un cliente para abrir su ficha."
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{etiqueta}</span>}>
      {/* M2 · móvil: 7 columnas scrolleaban de lado (790 px). Fila v5: cliente ·
          lo que más pide · tickets a la derecha; la excepción (urgentes o
          estancados) es el 4º dato, en rojo. */}
      <div className="sop-clientes-movil" style={{ display: 'none' }}>
        {vista.map((f: any, i: number) => {
          const ligado = !!f.company_id;
          const nombre = f.nombre || f.cuenta || 'Sin identificar';
          const alerta = f.urgentes ? `${f.urgentes} urgente${f.urgentes > 1 ? 's' : ''}` : (f.estancados ? `${f.estancados} estancado${f.estancados > 1 ? 's' : ''}` : null);
          return (
            <div key={'m' + (f.company_id || f.cuenta || i)} className="m-row" style={{ padding: '13px 0', cursor: ligado ? 'pointer' : 'default' }}
              onClick={() => ligado && onAbrir(f.company_id)}>
              <div className="m-tx">
                <div className="m-n1" style={{ color: ligado ? '#1a1a1a' : '#8a8a8a' }}>{nombre}</div>
                <div className="m-n2">{f.tema_label || f.plan || '—'}</div>
              </div>
              <div className="m-fin">
                <div className="m-m1">{f.n}</div>
                {alerta && <div className="m-m2" style={{ color: '#C0554E' }}>{alerta}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@media (max-width:899px){ .sop-clientes-movil{display:block !important} .sop-clientes-desk{display:none !important} }`}</style>
      <div className="sop-clientes-desk crm-scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th()}>Cliente</th>
            <th style={th(true)}>Tickets</th>
            <th style={th(true)}>Abiertos</th>
            <th style={th(true)}>Estancados</th>
            <th style={th(true)}>Urgentes</th>
            <th style={th()}>Lo que más pide</th>
            <th style={th()}>Último movimiento</th>
          </tr></thead>
          <tbody>
            {vista.map((f: any, i: number) => {
              const ligado = !!f.company_id;
              const nombre = f.nombre || f.cuenta || 'Sin identificar';
              return (
                <tr key={f.company_id || `cta-${f.cuenta || i}`}
                  onClick={() => ligado && onAbrir(f.company_id)}
                  style={{ cursor: ligado ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (ligado) e.currentTarget.style.background = '#fafafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ ...S.td, minWidth: 190 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: ligado ? '#1a1a1a' : '#8a8a8a' }}>{nombre}</span>
                      {!ligado && <Tag tono="gris">sin ligar</Tag>}
                      {f.estado_cuenta === 'cancelado' && <Tag tono="malo">baja</Tag>}
                      {f.estado_cuenta === 'vencido' && <Tag tono="malo">vencido</Tag>}
                    </div>
                    {f.plan && <div style={{ fontSize: '0.66rem', color: '#b3b1bb', marginTop: 2, fontWeight: 600 }}>{f.plan}</div>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', minWidth: 96 }}>
                    <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{f.n}</div>
                    <div style={{ height: 5, background: '#f3f2f7', borderRadius: 3, marginTop: 4 }}>
                      <div style={{ width: `${(f.n / max) * 100}%`, height: '100%', background: MORADO, borderRadius: 3 }} />
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.abiertos ? TINTA : '#c9c7d0' }}>{f.abiertos || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.estancados ? ROJO : '#c9c7d0' }}>{f.estancados || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.urgentes ? ROJO : '#c9c7d0' }}>{f.urgentes || '—'}</td>
                  <td style={{ ...S.td, color: '#666' }}>{f.tema_label || '—'}</td>
                  <td style={{ ...S.td, color: '#9c99a6', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtFecha(f.ultimo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filas.length > 10 && (
        <button onClick={() => setTodos(!todos)} style={{ ...S.btnG, marginTop: 12 }}>
          {todos ? 'Ver solo el top 10' : `Ver los ${filas.length}`}
        </button>
      )}
    </Tarjeta>
  );
}

export default function SoporteTab() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [modo, setModo] = useState<'dias' | 'rango'>('dias');
  const [dias, setDias] = useState(30);
  const [desde, setDesde] = useState(hace(29));
  const [hasta, setHasta] = useState(hoyMx());
  const [cliente, setCliente] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [vista, setVista] = useState<Vista>('tablero');
  // El contador del menú se pide aparte del tablero: la vista de capacitación y
  // la de calificación no cargan el dashboard y aun así tienen que mostrarlo.
  const [pendientes, setPendientes] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch('/api/crm/soporte/hallazgos?estado=pendiente')
      .then(r => r.json()).then(j => { if (vivo && !j.error) setPendientes(j.resumen?.pendientes || 0); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [recarga]);

  const query = modo === 'rango' && desde && hasta && desde <= hasta
    ? `desde=${desde}&hasta=${hasta}` : `dias=${dias}`;

  useEffect(() => {
    let vivo = true; setD(null); setErr('');
    fetch(`/api/crm/soporte/dashboard?${query}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [query, recarga]);

  // ══ Móvil v5 (mockup Soporte): bandeja de tickets abiertos, no el tablero.
  // Chips Abiertos/Hoy; SIN RESPONDER (sin primera respuesta) arriba con la
  // edad en color (≥4h rojo, ≥1h ámbar), EN CONVERSACIÓN abajo con "hace X".
  const esMovilS = useIsMobile();
  const [bandeja, setBandeja] = useState<any[] | null>(null);
  const [chipS, setChipS] = useState<'abiertos' | 'hoy'>('abiertos');
  useEffect(() => {
    if (!esMovilS) return;
    let vivo = true;
    fetch('/api/crm/soporte/bandeja').then(r => r.json())
      .then(j => { if (vivo) setBandeja(j.tickets || []); }).catch(() => { if (vivo) setBandeja([]); });
    return () => { vivo = false; };
  }, [esMovilS, recarga]);
  if (esMovilS) {
    const ahora = Date.now();
    const hoyIso = new Date().toISOString().slice(0, 10);
    const todosB = bandeja || [];
    const lista = chipS === 'hoy' ? todosB.filter(t => String(t.abierto_at || '').slice(0, 10) === hoyIso) : todosB;
    // Sin responder: lo más viejo arriba (urgencia). En conversación: lo más
    // reciente arriba (actividad). Columna y orden cuentan la misma historia.
    const sinResp = lista.filter(t => !t.primera_respuesta_at)
      .sort((a, b) => String(a.abierto_at || '').localeCompare(String(b.abierto_at || '')));
    const enConv = lista.filter(t => !!t.primera_respuesta_at)
      .sort((a, b) => String(b.ultima_actividad_at || '').localeCompare(String(a.ultima_actividad_at || '')));
    const conSec = sinResp.length > 0;
    const edad = (iso: string | null) => {
      if (!iso) return { t: '—', c: '#8f8d98' };
      const m = Math.max(1, Math.round((ahora - Date.parse(iso)) / 60000));
      const t = m < 60 ? `${m} m` : m < 60 * 24 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
      return { t, c: m >= 240 ? '#C0554E' : m >= 60 ? '#a06600' : '#1a1a1a' };
    };
    const cased = (t: string) => String(t || '').replace(/\S+/g, w => w[0].toUpperCase() + (w.length > 2 && w === w.toUpperCase() ? w.slice(1).toLowerCase() : w.slice(1)));
    const fila = (t: any, esperando: boolean) => {
      const e = esperando ? edad(t.abierto_at) : null;
      const ult = !esperando && t.ultima_actividad_at
        ? (() => { const m = Math.max(1, Math.round((ahora - Date.parse(t.ultima_actividad_at)) / 60000)); return m < 60 ? `hace ${m} m` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; })()
        : null;
      return (
        <div key={t.conversation_id} className="m-row" onClick={() => { if (t.intercom_url) window.open(t.intercom_url, '_blank'); }}>
          <div className="m-tx">
            <div className="m-n1">{cased(t.empresa || 'Sin cliente ligado')}</div>
            <div className="m-n2">{(() => {
              let x = String(t.asunto || t.vista_previa || '').slice(0, 60).trim();
              if (!x) return '—';
              // Cita del cliente EN MAYÚSCULAS: se baja a sentence case solo al mostrar
              const letras = x.replace(/[^a-záéíóúñü]/gi, '');
              if (letras && letras === letras.toUpperCase()) x = x[0].toUpperCase() + x.slice(1).toLowerCase();
              return `“${x}”`;
            })()}</div>
          </div>
          <div className="m-fin">
            {esperando
              ? <div className="m-m1" style={{ color: e!.c }}>{e!.t}</div>
              : <div className="m-m1" style={{ fontWeight: 500, color: '#8f8d98', fontSize: '0.85rem' }}>{ult || '—'}</div>}
          </div>
        </div>
      );
    };
    return (
      <div style={{ background: '#fff', minHeight: '60dvh' }}>
        <div>
          <div className="m-hdr">
            <div className="m-tt">Soporte</div>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f4f3f6', color: '#6a6875', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>A</div>
          </div>
          <div className="m-chips">
            {([['abiertos', 'Abiertos'], ['hoy', 'Hoy']] as const).map(([v, l]) => {
              const on = chipS === v;
              const n = v === 'abiertos' ? todosB.length : todosB.filter(t => String(t.abierto_at || '').slice(0, 10) === hoyIso).length;
              return (
                <button key={v} className={'m-chip' + (on ? ' on' : '')} onClick={() => setChipS(v)}>
                  {l}{on ? ' ' + n : ''}
                </button>
              );
            })}
          </div>
          {bandeja === null && <div style={{ padding: '28px 24px', color: '#8f8d98', fontSize: '0.86rem' }}>Cargando…</div>}
          {bandeja !== null && lista.length === 0 && (
            <div style={{ padding: '28px 24px', color: '#8f8d98', fontSize: '0.86rem' }}>
              {chipS === 'hoy' ? 'Hoy no ha entrado nada.' : 'Bandeja limpia. Nada abierto.'}
            </div>
          )}
          {conSec && <div className="m-sec">Sin responder</div>}
          {sinResp.map(t => fila(t, true))}
          {conSec && enConv.length > 0 && <div className="m-sec">En conversación</div>}
          {enConv.map(t => fila(t, false))}
          {!conSec && sinResp.map(t => fila(t, true))}
        </div>
      </div>
    );
  }

  const selector = (
    <SelectorPeriodo modo={modo} dias={dias} desde={desde} hasta={hasta}
      onDias={(n: number) => { setModo('dias'); setDias(n); }}
      onModo={(m: 'dias' | 'rango') => setModo(m)}
      onRango={(a: string, b: string) => { setDesde(a); setHasta(b); }} />
  );

  const T = d?.totales || {}, K = d?.kpis || {}, per = d?.periodo || {};
  const etiqueta = per.personalizado ? `${fechaCorta(per.desde)} – ${fechaCorta(per.hasta)}` : `últimos ${per.dias || dias} días`;
  const sinResolver = K.sin_resolver || {};
  const hayAlarma = (sinResolver.estancados || 0) > 0;

  // ── Orden de la pantalla: título → CARTAS → pestañas → contenido.
  // Es el de Cotizaciones. Los cinco KPIs describen el estado del soporte
  // completo, no el de una vista: por eso viven arriba de la barra y se quedan
  // fijos al cambiar de pestaña. Mientras carga el tablero se pintan huecos en
  // vez de desaparecer — si la fila se cae y vuelve, todo lo de abajo salta.
  const filaKpis = (!d || !T.total) ? (
    <div className="sop-kpis" style={{ marginBottom: 18 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: '3px solid #ece9f8', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ height: 9, width: '55%', background: '#f3f2f7', borderRadius: 4 }} />
          <div style={{ height: 22, width: '45%', background: '#f3f2f7', borderRadius: 4, marginTop: 9 }} />
          <div style={{ height: 9, width: '80%', background: '#f8f7fb', borderRadius: 4, marginTop: 9 }} />
        </div>
      ))}
    </div>
  ) : (
    <div className="sop-kpis" style={{ marginBottom: 18 }}>
      <Kpi barra={AZUL} t="Entraron" v={K.entraron?.valor ?? 0}
        hijo={<><Delta v={K.entraron?.valor} a={K.entraron?.anterior} neutro /> · antes {K.entraron?.anterior ?? 0}</>} />
      <Kpi barra={VERDE} t="Resueltos" v={<span style={{ color: VERDE_TINTA }}>{K.resueltos?.valor ?? 0}</span>}
        hijo={<><Delta v={K.resueltos?.valor} a={K.resueltos?.anterior} /> · antes {K.resueltos?.anterior ?? 0}</>} />
      <Kpi barra={hayAlarma ? ROJO : MORADO} t="Sin resolver" v={sinResolver.valor ?? 0}
        hijo={<>
          {hayAlarma
            ? <span style={{ color: ROJO, fontWeight: 800 }}>{sinResolver.estancados} estancado{sinResolver.estancados === 1 ? '' : 's'} +48 h</span>
            : <span style={{ color: VERDE_TINTA, fontWeight: 800 }}>ninguno estancado</span>}
          {sinResolver.sin_1a_respuesta > 0 && <> · {sinResolver.sin_1a_respuesta} sin 1ª respuesta</>}
        </>} />
      <Kpi barra={MORADO} t="1ª respuesta" v={K.frt?.valor != null ? `${K.frt.valor} h` : '—'}
        hijo={<><Delta v={K.frt?.valor} a={K.frt?.anterior} invertido /> · sobre {K.frt?.n ?? 0} ticket{K.frt?.n === 1 ? '' : 's'}</>} />
      <Kpi barra={MORADO_SUAVE} t="Resolución" v={K.resolucion?.valor != null ? `${K.resolucion.valor} h` : '—'}
        hijo={<><Delta v={K.resolucion?.valor} a={K.resolucion?.anterior} invertido /> · sobre {K.resolucion?.n ?? 0} resuelto{K.resolucion?.n === 1 ? '' : 's'}</>} />
    </div>
  );

  const tablero = () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TopClientes filas={d.top_clientes || []} etiqueta={etiqueta} onAbrir={(id) => setCliente(id)} />

        <div className="sop-2">
          <AreaFlujo serie={d.tendencia || []} periodo={per} kpis={K} etiqueta={etiqueta} />
          <DonaTemas temas={d.por_tema || []} total={T.en_periodo || 0} etiqueta={etiqueta} />
        </div>

        <Cuando cuando={d.cuando || {}} etiqueta={etiqueta} />

        <div className="sop-2">
          <Tarjeta titulo="Cómo llegan los tickets" cap="El tono con el que escribe el cliente, clasificado por reglas sobre el primer mensaje.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(d.por_sentimiento || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]: any) => {
                const c = SENT[k] || SENT.neutral;
                return <span key={k} style={{ fontSize: '0.7rem', fontWeight: 800, background: c.bg, color: c.fg, borderRadius: 20, padding: '5px 12px' }}>{k}: {n}</span>;
              })}
            </div>

            {/* El CSAT se fue a su propia sección arriba; repetirlo aquí era
                invitar a que un día los dos números dejaran de coincidir. */}
            {T.reabiertos > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.07em' }}>Se resolvieron y volvieron a abrirse</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 3, color: ROJO }}>{T.reabiertos}</div>
              </div>
            )}

            {T.sin_ligar > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#f4f4f6', color: '#6B7280', borderRadius: 20, padding: '5px 12px' }}>{T.sin_ligar} sin ligar a cliente</span>
                <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 8, lineHeight: 1.55 }}>Conversaciones cuyo contacto no se pudo mapear a una cuenta SACS. El cron de backfill reintenta cada 30 min.</div>
              </div>
            )}
          </Tarjeta>

          {/* Intercom puede no mandar el admin asignado. Enseñar una tabla de una
              sola fila que dice "Sin asignar 161" simula un dato que no existe. */}
          {T.con_asignado > 0 ? (
            <Tarjeta titulo="Carga por agente" cap="Quién trae los pendientes encima.">
              <div className="crm-scroll-x"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Agente', 'Abiertos', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{(d.por_agente || []).map((a: any) => (
                  <tr key={a.agente}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{a.agente}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: a.abiertos ? TINTA : '#c9c7d0' }}>{a.abiertos}</td>
                    <td style={S.td}>{a.total}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Tarjeta>
          ) : (
            <Tarjeta titulo="Carga por agente">
              <div style={{ fontSize: '0.78rem', color: '#a5a2af', lineHeight: 1.6 }}>
                Ninguno de los <b>{T.total}</b> tickets trae agente asignado: Intercom no está mandando el <code>assignee</code> en el webhook, o nadie se asigna las conversaciones allá.
                Mientras eso no cambie, esta tarjeta no puede decir nada — y una tabla que solo dice "Sin asignar" aparenta un dato que no existe.
              </div>
            </Tarjeta>
          )}
        </div>
      </div>
  );

  const contenido = (() => {
    // Estas dos no dependen del periodo ni del dashboard: se sirven de inmediato.
    if (vista === 'chat') return <Hallazgos onAbrirCliente={(id) => setCliente(id)} onCambio={() => setRecarga(r => r + 1)} sinTope />;
    if (vista === 'capacitacion') return <Capacitacion onAbrirCliente={(id) => setCliente(id)} />;
    if (err) return <Aviso tono="malo" titulo="No se pudo cargar el dashboard">{err}</Aviso>;
    if (!d) return <Cargando que="el panel de soporte" />;
    if (!T.total) return <Vacio titulo="Sin tickets de soporte todavía" texto="Cuando entren conversaciones de Intercom aparecerán aquí, ligadas a cada cliente." />;
    if (vista === 'calificacion') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <RatingIntercom intercom={d.csat?.intercom || {}} etiqueta={etiqueta} />
        <div className="sop-2">
          <Calificacion csat={d.csat || {}} etiqueta={etiqueta} />
          <Cobertura csat={d.csat || {}} onAbrir={(id) => setCliente(id)} />
        </div>
      </div>
    );
    return tablero();
  })();


  return (
    <div className="sop" style={S.wrap}>
      <Encabezado periodo={d ? per : undefined}>{selector}</Encabezado>
      {filaKpis}
      <BarraVistas vista={vista} setVista={setVista} pendientes={pendientes} />
      {contenido}
      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={() => setRecarga(r => r + 1)} />}
    </div>
  );
}
