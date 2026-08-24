// Cobranza: solo lo que está pendiente de cobro.
//
// Es una pantalla de TRABAJO, no de análisis: se abre para cobrar, así que cada
// fila trae con qué hacerlo y la lista viene ordenada por días de atraso —lo más
// viejo primero, que es lo que menos se cobra solo.
//
// Anuales y mensuales van separadas porque se cobran distinto: la anual pone en
// juego la renovación completa; en la mensual lo que importa no es el monto sino
// cuántos meses lleva sin pagar.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import ClienteDrawer360 from './ClienteDrawer360';
import Cargando, { Corazones } from './ui/Cargando';
import KpiCard from './ui/KpiCard';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';
const fmtCorta = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '—';
const iso = (d: Date) => d.toISOString().slice(0, 10);

const GESTION: Record<string, { l: string; bg: string; fg: string }> = {
  sin_contactar: { l: 'sin contactar', bg: '#f4f4f6', fg: '#6B7280' },
  contactado: { l: 'contactado', bg: '#E3EDFD', fg: '#2C5FC4' },
  promesa: { l: 'promesa de pago', bg: '#EEECFE', fg: '#5B4BD6' },
  negociando: { l: 'negociando', bg: '#FEF6E7', fg: '#9a6a10' },
  plan_pagos: { l: 'en parcialidades', bg: '#EEECFE', fg: '#5B4BD6' },
  incobrable: { l: 'incobrable', bg: '#FEF0EF', fg: '#C0554E' },
};
const SENAL: Record<string, { l: string; bg: string; fg: string }> = {
  vendiendo: { l: 'vendiendo hoy', bg: '#EAF8F2', fg: '#1E8A63' },
  tibia: { l: 'poca venta', bg: '#FEF6E7', fg: '#9a6a10' },
  'sin vender': { l: 'sin vender', bg: '#FEF0EF', fg: '#C0554E' },
};

const S = {
  wrap: WRAP,
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '16px 18px', marginBottom: 14 } as const,
  // Misma escala que las tarjetas de Cotizaciones: rótulo de 10 px, número de
  // 22 y una línea de 11. Con el número a 26 px las cinco no cabían y la última
  // se salía de la pantalla.
  kl: { fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.08em' } as const,
  kv: { fontSize: '1.375rem', fontWeight: 700, marginTop: 4, letterSpacing: '-.01em', lineHeight: 1.15 } as const,
  ks: { fontSize: '0.6875rem', color: '#888', marginTop: 2, lineHeight: 1.45 } as const,
  h: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 } as const,
  hr: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  hd: { fontSize: '0.72rem', color: '#8a8a8a', marginBottom: 12 } as const,
  th: { fontSize: '0.55rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase' as const, letterSpacing: '.07em', textAlign: 'left' as const, padding: '7px 8px', borderBottom: '1px solid #f0eff3' } as const,
  td: { padding: '10px 8px', fontSize: '0.78rem', borderBottom: '1px solid #f7f6fa', verticalAlign: 'middle' as const } as const,
  mini: { border: '1px solid #e2e4e9', borderRadius: 7, padding: '4px 9px', fontSize: '0.68rem', fontWeight: 700, color: '#555', background: '#fff', whiteSpace: 'nowrap' as const, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  mp: { border: 'none', background: '#9B8CFA', color: '#fff' } as const,
  mv: { borderColor: '#cdeadd', color: '#1E8A63', background: '#EAF8F2' } as const,
  tag: (bg: string, fg: string) => ({ fontSize: '0.56rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap' as const }) as const,
  btnP: { border: 'none', borderRadius: 9, padding: '8px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  fi: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.78rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as const,
  fl: { fontSize: '0.62rem', fontWeight: 800, color: '#7a7684', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 4 } as const,
};

/**
 * `embebido` = vive DENTRO del módulo de Pagos, como su vista de Recuperación.
 * Entonces no pone su propio título ni sus propios márgenes: los pone Pagos.
 * Sin esto se veían dos encabezados y el doble de padding en el mismo alto.
 */
export default function CobranzaTab({ embebido = false }: { embebido?: boolean } = {}) {
  const [d, setD] = useState<any>(null);
  // Las vistas mandan, como en Cotizaciones: una barra de pestañas con su
  // conteo en vez de dos tablas fijas. Anual y mensual no son secciones, son
  // dos filtros más — y faltaba el tercero, que es lo cotizado.
  const [vista, setVista] = useState<string>('todas');
  const [abierta, setAbierta] = useState<string | null>(null);   // fila con el plan desplegado
  const [gestion, setGestion] = useState<any>(null);
  const [partir, setPartir] = useState<any>(null);
  const [cancelar, setCancelar] = useState<any>(null);
  const [panel, setPanel] = useState<'' | 'recuperado'>('');
  // Los tramos de atraso dejaron de ser cuatro cajas fijas y son un filtro: la
  // pantalla arranca con la tabla a la vista y el dato sigue estando, a un clic.
  const [tramoSel, setTramoSel] = useState<any>(null);
  const [menuTramo, setMenuTramo] = useState(false);
  const [busca, setBusca] = useState('');
  // El tablero es una VISTA, no un modal: se analiza, se cambia el periodo y se
  // compara. Un modal invita a cerrarlo, no a quedarse.
  const [modo, setModo] = useState<'trabajo' | 'tablero'>('trabajo');
  const [tablero, setTablero] = useState<any>(null);
  const [rango, setRango] = useState<{ desde: string; hasta: string; label: string }>(() => {
    const h = new Date();
    const d1 = new Date(h.getFullYear(), h.getMonth(), 1);
    const d2 = new Date(h.getFullYear(), h.getMonth() + 1, 0);
    return { desde: iso(d1), hasta: iso(d2), label: 'Este mes' };
  });
  useEffect(() => {
    if (modo !== 'tablero') return;
    setTablero(null);
    fetch(`/api/crm/cobranza/tablero?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then(r => r.json()).then(setTablero).catch(() => setTablero({ error: true }));
  }, [modo, rango.desde, rango.hasta]);
  // El menú de la fila se ancla con position FIXED: dentro de la tabla lo
  // recortaba el contenedor con desplazamiento y solo se veía la primera opción.
  const [menuFila, setMenuFila] = useState<any>(null);
  useEffect(() => {
    if (!menuFila) return;
    const cerrar = () => setMenuFila(null);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    document.addEventListener('mousedown', cerrar);
    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
      document.removeEventListener('mousedown', cerrar);
    };
  }, [menuFila]);
  const [cliente, setCliente] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const cargar = () => fetch('/api/crm/cobranza').then(r => r.json()).then(setD).catch(() => setD({ error: true }));
  useEffect(() => { cargar(); }, []);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 2400); };

  if (!d) return <div style={S.wrap}><Cargando texto="Cargando cobranza…" onReintentar={cargar} /></div>;
  if (d.error) return <div style={{ ...S.wrap, color: '#C0554E', fontSize: '0.85rem' }}>No se pudo cargar la cobranza.</div>;

  const k = d.kpis;
  const cots = d.cotizaciones || [];
  const promesas = d.promesas || [];
  const todas = [...d.anuales, ...d.mensuales, ...cots].sort((a: any, b: any) => b.dias - a.dias);

  // Cada vista trae su lista, su explicación y su conteo. La explicación no es
  // adorno: "anualidades" y "recurrencia" se cobran distinto y la frase es lo
  // que evita tratarlas igual.
  const VISTAS: { id: string; label: string; filas: any[]; nota: string }[] = [
    { id: 'todas', label: 'Todas', filas: d.vencido || todas, nota: 'Todo lo vencido —suscripciones y parcialidades—, de lo más viejo a lo más nuevo. Lo viejo es lo que menos se cobra solo.' },
    { id: 'anualidades', label: 'Anualidades', filas: d.anuales, nota: 'Un solo cobro grande al año. Si el cliente no puede de golpe, se parte en exhibiciones desde aquí.' },
    { id: 'recurrencia', label: 'Recurrencia', filas: d.mensuales, nota: 'Aquí la deuda se acumula mes con mes: lo que importa no es el precio del plan, es cuántos meses lleva sin pagar.' },
    // Cotizaciones y parcialidades eran la misma lista: las cotizaciones que se
    // cobran aquí son justo las que van en exhibiciones.
    { id: 'parcialidades', label: 'En parcialidades', filas: [...(d.con_plan || []), ...(d.abonos_sueltos || [])], nota: 'Anualidades y cotizaciones que se cobran de a poco. Con plan, cada exhibición vence sola y se cobra sola; las que llevan abonos sin fechas acordadas se pueden formalizar con “Partir en pagos”.' },
    { id: 'promesas', label: 'Promesas', filas: promesas, nota: 'No es un plan pactado: es alguien que ya se atrasó y se comprometió a una fecha. El día que llega, vuelve a subir en la lista.' },
    { id: 'porvencer', label: 'Por vencer', filas: d.vence_mes || d.por_vencer, nota: 'Todavía no deben nada y vencen antes de fin de mes. Cobrar antes del vencimiento es lo más barato que existe.' },
  ];
  const activa = VISTAS.find(v => v.id === vista) || VISTAS[0];

  // El filtro de atraso y el buscador se aplican sobre la vista activa.
  const filtra = (fs: any[]) => fs.filter((f: any) => {
    if (tramoSel && !(f.dias >= tramoSel.a && f.dias <= tramoSel.b)) return false;
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return [f.cliente, f.cuenta, f.plan, f.detalle].some((x: any) => String(x || '').toLowerCase().includes(t));
  });
  const filas = filtra(activa.filas);

  const Fila = ({ f }: any) => {
    const g = GESTION[f.gestion] || GESTION.sin_contactar;
    const se = f.senal ? SENAL[f.senal] : null;
    const abierto = abierta === f.id;
    const esCot = f.tipo === 'cotizacion';
    const mensual = f.ciclo === 'mensual';
    return (
      <>
        <tr>
          <td style={S.td}>
            <div style={{ fontWeight: 700, cursor: f.company_id ? 'pointer' : 'default' }} onClick={() => f.company_id && setCliente(f.company_id)}>{f.cliente}</div>
            {f.cuenta && <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{f.cuenta}</div>}
          </td>
          <td style={S.td}>
            {f.plan}
            <div style={{ fontSize: '0.62rem', color: '#b3b1bb' }}>{esCot ? 'cotización' : mensual ? 'recurrencia' : 'anualidad'}</div>
          </td>
          <td style={S.td}>{fmtDate(f.vence)}</td>
          <td style={{ ...S.td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: f.dias > 90 ? '#C0554E' : f.dias > 7 ? '#9a6a10' : '#5B4BD6' }}>
            <b>{f.dias}</b> <span style={{ fontSize: '0.65rem', fontWeight: 500, color: '#b3b1bb' }}>{f.dias === 1 ? 'día' : 'días'}</span>
          </td>
          {/* El monto solo. La explicación de CÓMO se llega a él va en su propia
              columna: apiladas se leían como un renglón de tres pisos y el
              número —que es lo que se cobra— quedaba enterrado. */}
          <td style={{ ...S.td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ fontSize: '0.86rem', color: f.dias > 90 ? '#C0554E' : '#1a1a1a' }}>{money(f.deuda)}</b>
          </td>
          <td style={S.td}>
            <span style={S.tag(g.bg, g.fg)}>{g.l}</span>
            {f.promesa && <div style={{ fontSize: '0.65rem', color: String(f.promesa) < iso(new Date()) ? '#C0554E' : '#5B4BD6', marginTop: 3 }}>promete el {fmtCorta(f.promesa)}</div>}
          </td>
          <td style={S.td}>{se ? <span style={S.tag(se.bg, se.fg)}>{se.l}</span> : <span style={{ color: '#c9c7d0' }}>—</span>}</td>
          <td style={{ ...S.td, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }}>
            {/* Una acción a la vista —cobrar, que es a lo que se entra— y el
                resto en el menú, como en Cotizaciones. Seis botones por fila
                obligaban a leer todos para encontrar uno. */}
            <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <button style={{ ...S.mini, ...S.mp }} onClick={() => setGestion({ ...f, modo: 'pago' })}>Registrar pago</button>
              <button title="Más acciones" style={{ ...S.mini, padding: '4px 9px', fontWeight: 800 }}
                onClick={e => {
                  if (menuFila?.id === f.id) { setMenuFila(null); return; }
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const alto = 250;
                  const arriba = r.bottom + alto > window.innerHeight && r.top > alto;
                  setMenuFila({ id: f.id, x: Math.max(8, window.innerWidth - r.right), y: arriba ? window.innerHeight - r.top + 6 : r.bottom + 6, arriba, f });
                }}>⋮</button>
            </div>
          </td>
        </tr>
        {abierto && f.plan_pagos.length > 0 && (
          <tr>
            <td colSpan={8} style={{ background: '#faf8ff', borderTop: '1px solid #ece7fa', padding: '11px 14px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#5B4BD6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Plan de pagos · {money(f.plan_pagos.reduce((a: number, x: any) => a + x.monto, 0))} en {f.plan_pagos.length} exhibiciones
              </div>
              {f.plan_pagos.map((x: any) => {
                const venc = x.estado === 'pendiente' && String(x.fecha) < iso(new Date());
                return (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: '0.76rem', borderTop: '1px solid #ece7fa' }}>
                    <span style={{ width: 74, fontWeight: 700 }}>{x.numero} de {x.total}</span>
                    <span style={{ width: 92, color: '#6b6b74' }}>{fmtDate(x.fecha)}</span>
                    <span style={{ width: 84, fontWeight: 800 }}>{money(x.monto)}</span>
                    <span style={{ width: 130 }}>
                      {x.estado === 'pagada'
                        ? <span style={S.tag('#EAF8F2', '#1E8A63')}>pagada</span>
                        : venc ? <span style={S.tag('#FEF0EF', '#C0554E')}>vencida</span>
                          : <span style={S.tag('#f4f4f6', '#6B7280')}>por vencer</span>}
                    </span>
                    {x.estado === 'pendiente' && (
                      <button style={{ ...S.mini, ...S.mp, marginLeft: 'auto' }}
                        onClick={() => setGestion({ ...f, modo: 'pago', exhibicion: x })}>Cobrar esta</button>
                    )}
                  </div>
                );
              })}
            </td>
          </tr>
        )}
      </>
    );
  };

  const Tabla = ({ filas }: any) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...S.th, minWidth: 150 }}>Cliente</th>
            <th style={{ ...S.th, minWidth: 150 }}>Concepto</th>
            <th style={{ ...S.th, minWidth: 104 }}>Venció</th>
            <th style={{ ...S.th, minWidth: 78 }}>Atraso</th>
            <th style={{ ...S.th, minWidth: 96 }}>Debe</th>
            <th style={{ ...S.th, minWidth: 120 }}>Gestión</th>
            <th style={{ ...S.th, minWidth: 96 }}>Señal</th>
            <th style={{ ...S.th, minWidth: 170, textAlign: 'right' as const }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && <tr><td style={{ ...S.td, color: '#c9c7d0' }} colSpan={8}>Nada por cobrar aquí.</td></tr>}
          {filas.map((f: any) => <Fila key={f.id} f={f} />)}
        </tbody>
      </table>
    </div>
  );

  // La tarjeta es la MISMA que usa Pagos (y con el mismo aire que Cotizaciones):
  // vive en ui/KpiCard para que no se puedan separar con el tiempo.
  const Kpi = KpiCard;

  return (
    <div style={embebido ? { margin: 0, padding: 0 } : S.wrap}>
      <style>{`
        .cob-5 { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:10px; }
        .cob-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
        @media (max-width: 1100px) { .cob-4 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 1250px) { .cob-5 { grid-template-columns:repeat(3, minmax(0,1fr)); } }
        @media (max-width: 780px)  { .cob-5 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 620px)  { .cob-5, .cob-4 { grid-template-columns:1fr; } }
      `}</style>

      {/* Embebido, esta franja ya no lleva título: es solo la barra del botón de
          Dashboard, así que se aprieta contra las pestañas de Pagos en vez de
          dejar un hueco donde antes iba el encabezado. */}
      <div style={{ marginTop: embebido ? -6 : 0, marginBottom: embebido ? 8 : 14, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
        {!embebido && <>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Cobranza</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>
            Lo pendiente de cobro y lo que sí entró este mes: a quién, desde cuándo y con qué
          </div>
        </>}
        </div>
        {/* Mismo botón que abre el dashboard en Cotizaciones: contorno azul,
            sin ícono. El segmentado rosa era otro idioma para lo mismo. */}
        <button onClick={() => setModo(modo === 'tablero' ? 'trabajo' : 'tablero')}
          style={{ background: '#fff', color: '#2C5FC4', border: '1.5px solid #7DA6F5', borderRadius: 12, padding: '9px 20px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          {modo === 'tablero' ? 'Ver lo que hay que cobrar' : 'Dashboard'}
        </button>
      </div>

      {msg && <div style={{ background: '#EAF8F2', color: '#1E8A63', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}

      {/* Las tarjetas del MES se abren: un número que nadie puede desarmar es un
          número que hay que creer. */}
      {modo === 'tablero'
        ? <Tablero d={tablero} rango={rango} setRango={setRango} onCliente={(id: string) => setCliente(id)} />
        : (<>
      {/* Cinco tarjetas con el patrón de Cotizaciones: barra de color, rótulo,
          número y una línea que explica. "Bajas del mes" se fue al tablero de
          ARR —una baja no se cobra, es churn— y su lugar lo toma lo que vence
          antes de fin de mes, que es lo único accionable que faltaba. */}
      <div className="cob-5" style={{ marginBottom: 14 }}>
        <Kpi label="Vencido" valor={money(k.vencido)} color="#C0554E" franja="#EF7A72"
          sub={`${k.vencido_n} cobro${k.vencido_n === 1 ? '' : 's'}${k.atraso_max ? ` · el más viejo, ${k.atraso_max} días` : ''}`}
          onClick={() => { setVista('todas'); setTramoSel(null); }} />
        <Kpi label="Vence este mes" valor={money(k.vence_mes)} color="#1a1a1a" franja="#E8A838"
          sub={`${k.vence_mes_n} cobro${k.vence_mes_n === 1 ? '' : 's'}${k.vence_mes_parcialidades ? ` · ${k.vence_mes_parcialidades} de parcialidades` : ' · sin parcialidades'}`}
          onClick={() => setVista('porvencer')} />
        <Kpi label="Cobrado este mes" valor={money(k.recuperado)} color="#1E8A63" franja="#4FBF95"
          sub={`${(d.recuperado_detalle || []).length} pagos desde el día 1`} onClick={() => setPanel('recuperado')} />
        <Kpi label="En parcialidades" valor={money(k.en_parcialidades)} color="#5B4BD6" franja="#9B8CFA"
          sub={`${k.planes} plan${k.planes === 1 ? '' : 'es'} · ${k.exhibiciones_pendientes} pago${k.exhibiciones_pendientes === 1 ? '' : 's'}${k.abonos_sueltos ? ` · ${k.abonos_sueltos} sin fechas` : ''}`}
          onClick={() => setVista('parcialidades')} />
        <Kpi label="Promesas de pago" valor={k.promesas} color="#9a6a10" franja="#9B8CFA"
          sub={`${money(k.promesas_monto)} comprometidos`} onClick={() => setVista('promesas')} />
      </div>

      {/* Buscador y filtros, como en Cotizaciones. Los tramos de atraso viven
          aquí adentro: cuatro cajas de colores fijas empujaban la tabla fuera
          de la pantalla y el dato se consulta, no se mira todo el día. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, cuenta o concepto…"
          style={{ ...S.fi, flex: '1 1 300px', maxWidth: 420, height: 36 }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuTramo(v => !v)}
            style={{ ...S.mini, height: 36, padding: '0 14px', fontSize: '0.8rem',
              background: tramoSel ? '#EEECFE' : '#fff', color: tramoSel ? '#5B4BD6' : '#555', borderColor: tramoSel ? '#ddd6fb' : '#e2e4e9' }}>
            Atraso{tramoSel ? `: ${tramoSel.k}` : ''} ▾
          </button>
          {menuTramo && (
            <div style={{ position: 'absolute', left: 0, top: 42, background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.14)', padding: 6, width: 250, zIndex: 40 }}>
              <button onClick={() => { setTramoSel(null); setMenuTramo(false); }}
                style={{ ...S.mini, width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 4, border: 'none', background: tramoSel ? 'transparent' : '#EEECFE', color: tramoSel ? '#444' : '#5B4BD6' }}>
                <span>Todos</span><span style={{ color: '#999' }}>{money(k.vencido)} · {k.vencido_n}</span>
              </button>
              {d.tramos.map((t: any) => (
                <button key={t.k} onClick={() => { setTramoSel(t); setVista('todas'); setMenuTramo(false); }}
                  style={{ ...S.mini, width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 4, border: 'none',
                    background: tramoSel?.k === t.k ? '#EEECFE' : 'transparent', color: tramoSel?.k === t.k ? '#5B4BD6' : '#444' }}>
                  <span>{t.k}</span><span style={{ color: '#999' }}>{money(t.monto)} · {t.n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {tramoSel && (
          <button onClick={() => setTramoSel(null)} style={{ ...S.mini, height: 36, padding: '0 12px', fontSize: '0.76rem', color: '#8a8a92' }}>Quitar filtro ✕</button>
        )}
      </div>

      {/* Pestañas al estilo de Cotizaciones: la activa se marca con fondo, no
          solo con la línea, y el conteo va en pastilla pegado al texto. */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #eceaf2', marginBottom: 14, overflowX: 'auto' }}>
        {VISTAS.map(v => {
          const on = v.id === activa.id;
          const n = v.filas.length;
          return (
            <button key={v.id} onClick={() => setVista(v.id)} style={{
              padding: '9px 14px', background: on ? '#EEECFE' : 'transparent',
              borderRadius: on ? '9px 9px 0 0' : 0, border: 'none',
              borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent',
              color: on ? '#5B4BD6' : '#6b6b74', fontWeight: on ? 800 : 500,
              fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: -1,
            }}>
              {v.label}
              <span style={{
                marginLeft: 6, fontSize: '0.66rem', fontWeight: on ? 800 : 700,
                background: on ? '#fff' : '#f3f3f6', color: on ? '#5B4BD6' : n === 0 ? '#c4c4cc' : '#8a8a92',
                borderRadius: 20, padding: '2px 8px',
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={S.card}>
        <div style={S.h}>{activa.label}<span style={S.hr}>{money(filas.reduce((a: number, f: any) => a + Number(f.deuda || 0), 0))} en {filas.length}{tramoSel || busca ? ` de ${activa.filas.length}` : ''}</span></div>
        <div style={S.hd}>{activa.nota}</div>
        <Tabla filas={filas} />
      </div>
      </>)}

      {menuFila && (() => {
        const f = menuFila.f;
        const esCot = f.tipo === 'cotizacion';
        /* Dos documentos con el mismo propósito: el de la cotización desglosa
           las parcialidades; el de la suscripción, el ciclo y su atraso. */
        const ecUrl = (x: any) => x.tipo === 'cotizacion' ? `/estado-cuenta/cotizacion/${x.id}` : `/estado-cuenta/${x.id}`;
        const mensual = f.ciclo === 'mensual';
        const item = (label: string, onClick: () => void, color?: string) => (
          <button onClick={() => { setMenuFila(null); onClick(); }}
            style={{ ...S.mini, width: '100%', textAlign: 'left' as const, border: 'none', marginBottom: 3, padding: '8px 10px', color: color || '#444' }}>{label}</button>
        );
        return (
          <div data-menu-fila onMouseDown={e => e.stopPropagation()} style={{
            position: 'fixed', right: menuFila.x, ...(menuFila.arriba ? { bottom: menuFila.y } : { top: menuFila.y }),
            background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, boxShadow: '0 12px 34px rgba(16,24,40,.16)',
            padding: 6, minWidth: 230, zIndex: 980,
          }}>
            {/* De qué está hecha la deuda. Era una columna que casi siempre iba
                vacía y le robaba ancho a la tabla; aquí se lee justo cuando se
                va a hacer algo con esa cuenta. */}
            <div style={{ padding: '7px 10px 8px', borderBottom: '1px solid #f4f3f7', marginBottom: 5 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>{f.cliente}</div>
              <div style={{ fontSize: '0.71rem', color: '#8a8590', lineHeight: 1.5, marginTop: 2 }}>
                {f.plan} · debe <b style={{ color: '#3f3b4d' }}>{money(f.deuda)}</b>
                {f.detalle ? <><br />{f.detalle}</> : f.pagado > 0 ? <><br />lleva {money(f.pagado)} pagados</> : null}
                {f.promesa ? <><br />promete el {fmtCorta(f.promesa)}</> : null}
              </div>
            </div>
            {item('Gestión y promesa', () => setGestion({ ...f, modo: 'gestion' }))}
            {f.plan_pagos.length > 0 && item(abierta === f.id ? 'Ocultar plan de pagos' : 'Ver plan de pagos', () => setAbierta(abierta === f.id ? null : f.id))}
            {f.plan_pagos.length === 0 && !mensual && item('Partir en pagos', () => setPartir(f))}
            {esCot && item('Ver cotización', () => window.open(`/cotizacion/${f.id}`, '_blank'))}
            {/* El estado de cuenta es el comprobante que se manda cuando un
                cobro no pasó: dice cuánto se debe, desde cuándo y qué se
                prometió. Existe para las dos: la cotización en parcialidades y
                la suscripción vencida. Antes solo salía en cotizaciones, que
                son la minoría de lo que se cobra. */}
            {item('Ver estado de cuenta', () => window.open(ecUrl(f), '_blank'))}
            {item('Copiar liga del estado de cuenta', async () => {
              try { await navigator.clipboard.writeText(location.origin + ecUrl(f)); flash('Liga copiada'); }
              catch { window.open(ecUrl(f), '_blank'); }
            })}
            {f.link && item('Abrir link de cobro', () => window.open(f.link, '_blank'), '#1E8A63')}
            {f.company_id && item('Abrir ficha del cliente', () => setCliente(f.company_id))}
            {!esCot && item('Dar de baja', () => setCancelar(f), '#C0554E')}
          </div>
        );
      })()}
      {panel === 'recuperado' && <DetalleMes filas={d.recuperado_detalle || []} total={k.recuperado} onCerrar={() => setPanel('')} onCliente={(id: string) => { setPanel(''); setCliente(id); }} />}
      {gestion && <Gestion f={gestion} onCerrar={() => setGestion(null)} onListo={(t: string) => { setGestion(null); flash(t); cargar(); }} />}
      {partir && <PartirEnPagos f={partir} onCerrar={() => setPartir(null)} onListo={() => { setPartir(null); flash('Plan de pagos creado'); cargar(); }} />}
      {cancelar && <DarDeBaja f={cancelar} onCerrar={() => setCancelar(null)} onListo={(t: string) => { setCancelar(null); flash(t); cargar(); }} />}
      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={cargar} />}
    </div>
  );
}

/* ─── El detalle del mes ───
 * De dónde salió cada peso de "cobrado este mes". Sin esto el KPI es un número
 * que no se puede auditar ni contra el banco ni contra el cliente. */
function DetalleMes({ filas, total, onCerrar, onCliente }: any) {
  const [tipo, setTipo] = useState<'todos' | 'suscripcion' | 'cotizacion'>('todos');
  const lista = tipo === 'todos' ? filas : filas.filter((f: any) => f.tipo === tipo);
  const suma = lista.reduce((a: number, f: any) => a + Number(f.monto || 0), 0);
  const mes = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return (
    <Modal titulo={`Cobrado en ${mes}`} nota={`${money(total)} en ${filas.length} pagos`} onCerrar={onCerrar} ancho={620}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
        {([['todos', 'Todos'], ['suscripcion', 'Suscripciones'], ['cotizacion', 'Cotizaciones']] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTipo(id)} style={{
            ...S.mini, background: tipo === id ? '#EEECFE' : '#fff',
            color: tipo === id ? '#5B4BD6' : '#555', borderColor: tipo === id ? '#ddd6fb' : '#e2e4e9',
          }}>{l} <b>{id === 'todos' ? filas.length : filas.filter((f: any) => f.tipo === id).length}</b></button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 800, color: '#1E8A63' }}>{money(suma)}</span>
      </div>
      <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ ...S.th, width: 78 }}>Fecha</th>
            <th style={S.th}>Cliente</th>
            <th style={S.th}>Concepto</th>
            <th style={{ ...S.th, width: 96 }}>Cómo</th>
            <th style={{ ...S.th, width: 92, textAlign: 'right' as const }}>Monto</th>
          </tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={5} style={{ ...S.td, color: '#c9c7d0' }}>Nada aquí todavía.</td></tr>}
            {lista.map((f: any) => (
              <tr key={f.id}>
                <td style={{ ...S.td, color: '#8a8a92' }}>{fmtCorta(f.fecha)}</td>
                <td style={{ ...S.td, fontWeight: 700, cursor: f.company_id ? 'pointer' : 'default' }} onClick={() => f.company_id && onCliente(f.company_id)}>{f.cliente}</td>
                <td style={{ ...S.td, color: '#6b6b74' }}>{f.concepto}</td>
                <td style={{ ...S.td, color: '#8a8a92' }}>{f.metodo}</td>
                <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 800, color: '#1E8A63' }}>{money(f.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}


/* ─── Tablero de cobranza ───
 * Dos naturalezas conviven aquí y no hay que confundirlas: lo del PERIODO
 * —cobrado, lo que venció, cómo entró el dinero— cambia con el filtro y se
 * compara contra el periodo anterior; la CARTERA —vencido, aging, proyección,
 * promesas— es una foto de hoy, porque lo que se debe se debe hoy. */
const PERIODOS = (): { label: string; desde: string; hasta: string }[] => {
  const h = new Date();
  const m = (off: number) => [new Date(h.getFullYear(), h.getMonth() + off, 1), new Date(h.getFullYear(), h.getMonth() + off + 1, 0)];
  const [a1, a2] = m(0), [b1, b2] = m(-1);
  return [
    { label: 'Este mes', desde: iso(a1), hasta: iso(a2) },
    { label: 'Mes pasado', desde: iso(b1), hasta: iso(b2) },
    { label: 'Últimos 3 meses', desde: iso(new Date(h.getFullYear(), h.getMonth() - 2, 1)), hasta: iso(a2) },
    { label: 'Este año', desde: `${h.getFullYear()}-01-01`, hasta: `${h.getFullYear()}-12-31` },
  ];
};

function Tablero({ d, rango, setRango, onCliente }: any) {
  const [abierto, setAbierto] = useState(false);
  const barra = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setAbierto(v => !v)} style={{ ...S.mini, height: 36, padding: '0 14px', fontSize: '0.8rem', background: '#EEECFE', color: '#5B4BD6', borderColor: '#ddd6fb' }}>
          {rango.label} ▾
        </button>
        {abierto && (
          <div style={{ position: 'absolute', left: 0, top: 42, background: '#fff', border: '1px solid #e6e3ee', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.14)', padding: 6, width: 230, zIndex: 40 }}>
            {PERIODOS().map(p => (
              <button key={p.label} onClick={() => { setRango({ ...p }); setAbierto(false); }}
                style={{ ...S.mini, width: '100%', textAlign: 'left' as const, border: 'none', marginBottom: 3, padding: '8px 10px', background: rango.label === p.label ? '#EEECFE' : 'transparent', color: rango.label === p.label ? '#5B4BD6' : '#444' }}>
                {p.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #f2f1f6', marginTop: 4, paddingTop: 7, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={rango.desde} onChange={e => setRango({ ...rango, desde: e.target.value, label: 'Personalizado' })} style={{ ...S.fi, padding: '6px 8px', fontSize: '0.72rem' }} />
              <input type="date" value={rango.hasta} onChange={e => setRango({ ...rango, hasta: e.target.value, label: 'Personalizado' })} style={{ ...S.fi, padding: '6px 8px', fontSize: '0.72rem' }} />
            </div>
          </div>
        )}
      </div>
      <span style={{ fontSize: '0.73rem', color: '#a5a2af' }}>
        {fmtDate(rango.desde)} al {fmtDate(rango.hasta)}
        {d?.previo ? ` · se compara contra ${fmtCorta(d.previo.desde)}–${fmtCorta(d.previo.hasta)}` : ''}
      </span>
    </div>
  );

  if (!d) return <div>{barra}<Cargando texto="Armando el tablero…" alto={240} /></div>;
  if (d.error) return <div>{barra}<div style={{ ...S.card, color: '#C0554E' }}>No se pudo cargar el tablero.</div></div>;

  const K = ({ label, valor, sub, color, franja, midiendo }: any) => (
    <div style={{ ...S.card, marginBottom: 0, padding: '14px 16px', borderLeft: `3px solid ${midiendo ? '#f5e2b8' : (franja || '#9B8CFA')}` }}>
      <div style={{ ...S.kl, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {label}{midiendo && <span style={{ fontSize: '0.52rem', background: '#FEF6E7', color: '#9a6a10', borderRadius: 20, padding: '1px 6px' }}>midiendo</span>}
      </div>
      <div style={{ ...S.kv, color: valor === '—' ? '#c9c7d0' : (color || '#1a1a1a') }}>{valor}</div>
      <div style={S.ks}>{sub}</div>
    </div>
  );
  const dias = (x: any) => (x?.dias == null ? '—' : `${x.dias} d`);
  const maxMes = Math.max(1, ...(d.proyeccion || []).map((m: any) => m.total));
  const maxDia = Math.max(1, ...(d.dinero.por_dia || []).map((x: any) => x.monto));
  const varTxt = (v: number | null) => v == null
    ? <span style={{ color: '#c4c4cc' }}>sin periodo anterior</span>
    : <span style={{ color: v > 0 ? '#1E8A63' : v < 0 ? '#C0554E' : '#888', fontWeight: 700 }}>{v > 0 ? '↑' : v < 0 ? '↓' : '='} {Math.abs(v)}%</span>;

  return (
    <div>
      {barra}

      <div style={{ ...S.kl, marginBottom: 8 }}>El dinero del periodo</div>
      <div className="cob-4" style={{ marginBottom: 16 }}>
        <K label="Cobrado" valor={money(d.dinero.cobrado)} color="#1E8A63" franja="#4FBF95"
          sub={<>{varTxt(d.dinero.variacion)} vs. periodo anterior · {d.dinero.pagos} pagos</>} />
        <K label="Venció en el periodo" valor={money(d.dinero.vencio)} franja="#E8A838"
          sub={`${d.dinero.vencio_n} cobros con fecha en el rango`} />
        <K label="Tasa de cobro" valor={d.dinero.tasa == null ? '—' : d.dinero.tasa + '%'} franja="#9B8CFA"
          color={(d.dinero.tasa || 0) >= 90 ? '#1E8A63' : undefined}
          sub="de lo que tocaba cobrar, cuánto entró" />
        <K label="Pago promedio" valor={money(d.dinero.ticket)} franja="#7DA6F5"
          sub={`${money(d.dinero.suscripciones)} de suscripciones · ${money(d.dinero.cotizaciones)} de cotizaciones`} />
      </div>

      {(d.dinero.por_dia || []).length > 0 && (
        <div style={S.card}>
          <div style={S.h}>Ritmo de cobro<span style={S.hr}>{d.dinero.pagos} pagos en el periodo</span></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, marginTop: 10 }}>
            {d.dinero.por_dia.map((x: any) => (
              <div key={x.fecha} title={`${fmtDate(x.fecha)} · ${money(x.monto)}`}
                style={{ flex: 1, minWidth: 4, height: Math.max(3, Math.round((x.monto / maxDia) * 86)), background: '#9B8CFA', borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#a5a2af', marginTop: 5 }}>
            <span>{fmtCorta(d.periodo.desde)}</span><span>{fmtCorta(d.periodo.hasta)}</span>
          </div>
        </div>
      )}

      <div style={{ ...S.kl, marginBottom: 8 }}>Qué tan rápido se cobra</div>
      <div className="cob-4" style={{ marginBottom: 16 }}>
        <K label="Anualidades" valor={dias(d.velocidad.anual)} color="#5B4BD6" midiendo={d.velocidad.anual.dias == null}
          sub={`${d.velocidad.anual.n} pago${d.velocidad.anual.n === 1 ? '' : 's'} medidos en el periodo`} />
        <K label="Mensuales" valor={dias(d.velocidad.mensual)} color="#5B4BD6" midiendo={d.velocidad.mensual.dias == null}
          sub={`${d.velocidad.mensual.n} pago${d.velocidad.mensual.n === 1 ? '' : 's'} medidos`} />
        <K label="Cotizaciones" valor={dias(d.velocidad.cotizacion)} color="#2C5FC4" franja="#7DA6F5" midiendo={d.velocidad.cotizacion.dias == null}
          sub={`${d.velocidad.cotizacion.n} abono${d.velocidad.cotizacion.n === 1 ? '' : 's'} medidos`} />
        <K label="Pagan a tiempo" valor={d.velocidad.a_tiempo == null ? '—' : d.velocidad.a_tiempo + '%'} color="#1E8A63" franja="#4FBF95"
          midiendo={d.velocidad.a_tiempo == null} sub="el día pactado o antes" />
      </div>
      <div style={{ fontSize: '0.72rem', color: '#a5a2af', marginTop: -8, marginBottom: 16, lineHeight: 1.5 }}>
        Se mide desde que cada pago guarda la fecha que venía a cubrir: {d.velocidad.medidos} de los {d.velocidad.medidos + d.velocidad.sin_medir} pagos
        del periodo ya la traen. Los anteriores no se pueden reconstruir —esa fecha se pisa en cada renovación.
      </div>

      <div style={{ ...S.kl, marginBottom: 8 }}>La cartera hoy</div>
      <div className="cob-4" style={{ marginBottom: 16 }}>
        <K label="Vencido" valor={money(d.cartera.vencido)} color="#C0554E" franja="#EF7A72"
          sub={`${d.cartera.cuentas} cobros · ${d.cartera.atraso_prom || 0} días de atraso promedio`} />
        <K label="Sobre el ARR" valor={d.cartera.pct_arr == null ? '—' : d.cartera.pct_arr + '%'} franja="#EF7A72"
          sub={`${money(d.cartera.arr_activo)} de ARR activo`} />
        <K label="Sin contactar" valor={money(d.proceso.sin_contactar_monto)} franja="#E8A838"
          sub={`${d.proceso.sin_contactar} cobros que nadie ha trabajado`} />
        <K label="Deben y no venden" valor={money((d.cartera.en_riesgo || []).reduce((a: number, x: any) => a + x.monto, 0))} color="#C0554E" franja="#EF7A72"
          sub={`${(d.cartera.en_riesgo || []).length} cuentas · ahí la cobranza es otra conversación`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.h}>Antigüedad del atraso</div>
          <div style={S.hd}>A 7 días se cobra con un recordatorio; a 90 ya es una negociación.</div>
          {d.cartera.tramos.map((t: any) => {
            const pct = d.cartera.vencido > 0 ? Math.round((t.monto / d.cartera.vencido) * 100) : 0;
            return (
              <div key={t.k} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', fontSize: '0.76rem', marginBottom: 3 }}>
                  <span style={{ flex: 1, color: '#6b6b74' }}>{t.k}</span>
                  <b>{money(t.monto)}</b><span style={{ color: '#a5a2af', marginLeft: 6 }}>{t.n}</span>
                </div>
                <div style={{ height: 7, background: '#f3f2f7', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: pct + '%', background: t.k.includes('90') ? '#C0554E' : t.k.includes('31') ? '#EF7A72' : t.k.includes('8') ? '#E8A838' : '#9B8CFA', borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.h}>Quién debe más</div>
          <div style={S.hd}>Los ocho que concentran la cartera. Da clic para abrir su ficha.</div>
          {(d.cartera.top || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Nada vencido. Buen día.</div>}
          {(d.cartera.top || []).map((x: any, i: number) => (
            <div key={x.id + '' + i} onClick={() => x.company_id && onCliente(x.company_id)}
              style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '7px 0', borderTop: i ? '1px solid #f5f4f8' : 'none', fontSize: '0.78rem', cursor: x.company_id ? 'pointer' : 'default' }}>
              <span style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{x.cliente}
                <span style={{ fontWeight: 400, color: '#a5a2af' }}> · {x.concepto}</span>
              </span>
              <span style={{ color: x.dias > 90 ? '#C0554E' : '#9a6a10', whiteSpace: 'nowrap' }}>{x.dias} d</span>
              <b style={{ whiteSpace: 'nowrap' }}>{money(x.monto)}</b>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.h}>Lo que entra los próximos meses</div>
        <div style={S.hd}>Renovaciones por su fecha y parcialidades por la fecha pactada. Es la caja que se puede prometer.</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, marginTop: 8 }}>
          {(d.proyeccion || []).map((m: any) => (
            <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}>
              <b style={{ fontSize: '0.75rem' }}>{money(m.total)}</b>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end' }}>
                {m.parcial > 0 && <div title={`Parcialidades ${money(m.parcial)}`} style={{ height: Math.round((m.parcial / maxMes) * 100), background: '#c9c2f7', borderRadius: '6px 6px 0 0' }} />}
                <div title={`Renovaciones ${money(m.subs)}`} style={{ height: Math.max(4, Math.round((m.subs / maxMes) * 100)), background: '#9B8CFA', borderRadius: m.parcial > 0 ? 0 : '6px 6px 0 0' }} />
              </div>
              <span style={{ fontSize: '0.68rem', color: '#8a8590' }}>{m.mes} · {m.n}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 8 }}>Morado sólido: renovaciones. Claro: parcialidades con fecha pactada.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.h}>En qué va la cobranza</div>
          <div style={S.hd}>Cada peso vencido, según hasta dónde se ha trabajado.</div>
          {(d.proceso.embudo || []).map((e: any, i: number) => (
            <div key={e.estado} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '7px 0', borderTop: i ? '1px solid #f5f4f8' : 'none', fontSize: '0.78rem' }}>
              <span style={S.tag(GESTION[e.estado]?.bg || '#f4f4f6', GESTION[e.estado]?.fg || '#6B7280')}>{GESTION[e.estado]?.l || e.estado}</span>
              <span style={{ flex: 1, color: '#a5a2af' }}>{e.n} cobro{e.n === 1 ? '' : 's'}</span>
              <b>{money(e.monto)}</b>
            </div>
          ))}
          <div style={{ fontSize: '0.73rem', color: '#a5a2af', marginTop: 8, lineHeight: 1.5 }}>
            {d.proceso.gestiones} gestión{d.proceso.gestiones === 1 ? '' : 'es'} registrada{d.proceso.gestiones === 1 ? '' : 's'} en el periodo
            {(d.proceso.por_accion || []).length ? ` · ${d.proceso.por_accion.map((a: any) => `${GESTION[a.tipo]?.l || a.tipo} ${a.n}`).join(' · ')}` : ' · la bitácora se llena al usar “Gestión” en cada fila'}
          </div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.h}>Promesas de pago</div>
          <div style={S.hd}>Lo único que convierte una lista en una agenda.</div>
          {[['Vivas', `${d.proceso.promesas.vivas} · ${money(d.proceso.promesas.monto)}`],
            ['Cumplidas', String(d.proceso.promesas.cumplidas)],
            ['Rotas', String(d.proceso.promesas.rotas)],
            ['Cumplimiento', d.proceso.promesas.cumplimiento == null ? '— · aún sin promesas cerradas' : d.proceso.promesas.cumplimiento + '%']]
            .map(([a, b], i) => (
              <div key={a} style={{ display: 'flex', fontSize: '0.79rem', padding: '7px 0', borderTop: i ? '1px solid #f5f4f8' : 'none' }}>
                <span style={{ flex: 1, color: '#6b6b74' }}>{a}</span><b>{b}</b>
              </div>
            ))}
        </div>
      </div>

      {(d.dinero.por_metodo || []).length > 0 && (
        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={S.h}>Cómo entró el dinero<span style={S.hr}>{fmtCorta(d.periodo.desde)} al {fmtCorta(d.periodo.hasta)}</span></div>
          {d.dinero.por_metodo.map((m: any, i: number) => {
            const pct = d.dinero.cobrado > 0 ? Math.round((m.monto / d.dinero.cobrado) * 100) : 0;
            return (
              <div key={m.metodo} style={{ marginBottom: 9, paddingTop: i ? 4 : 0 }}>
                <div style={{ display: 'flex', fontSize: '0.77rem', marginBottom: 3 }}>
                  <span style={{ flex: 1, color: '#6b6b74' }}>{m.metodo} <span style={{ color: '#c4c2cc' }}>· {m.n}</span></span>
                  <b>{money(m.monto)}</b><span style={{ color: '#a5a2af', marginLeft: 6 }}>{pct}%</span>
                </div>
                <div style={{ height: 7, background: '#f3f2f7', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: pct + '%', background: '#4FBF95', borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Dar de baja ───
 * El motivo es obligatorio del lado del servidor y aquí también: es lo único
 * que después contesta "por qué se nos van". */
const MOTIVOS_BAJA = [
  'Precio · le salió caro',
  'Cerró o pausó el negocio',
  'Se fue con la competencia',
  'No lo usaba',
  'Le faltaban funciones',
  'Mal servicio o soporte',
  'Solo lo necesitaba por un tiempo',
];

function DarDeBaja({ f, onCerrar, onListo }: any) {
  const [motivo, setMotivo] = useState(MOTIVOS_BAJA[0]);
  const [detalle, setDetalle] = useState('');
  const [cuando, setCuando] = useState<'ya' | 'alvencer'>('ya');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setBusy(true); setError('');
    const razon = detalle.trim() ? `${motivo} — ${detalle.trim()}` : motivo;
    const body: any = cuando === 'ya'
      ? { id: f.id, estado: 'cancelada', razon_cancelacion: razon }
      // "Al vencer" no cancela hoy: el cliente ya pagó su periodo y tiene
      // derecho a usarlo. Se marca para no renovar y el ARR cae cuando toca.
      : { id: f.id, cancela_al_vencer: true, razon_cancelacion: razon };
    const r = await fetch('/api/crm/arr/subscriptions', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo dar de baja.'); return; }
    onListo(cuando === 'ya' ? 'Suscripción cancelada' : 'Marcada para no renovar');
  }

  return (
    <Modal titulo="Dar de baja" nota={f.cliente} onCerrar={onCerrar} ancho={420}>
      <div style={{ fontSize: '0.78rem', color: '#6b6b74', marginBottom: 12 }}>
        <b>{f.plan}</b> · {f.ciclo === 'mensual' ? 'recurrencia mensual' : 'anualidad'}<br />
        Debe {money(f.deuda)} desde hace {f.dias} días.
      </div>
      <div style={S.fl}>Cuándo</div>
      <select style={S.fi} value={cuando} onChange={e => setCuando(e.target.value as any)}>
        <option value="ya">Ahora · deja de contar en el ARR hoy</option>
        <option value="alvencer">Al vencer · no se renueva, sigue hasta su fecha</option>
      </select>
      <div style={{ marginTop: 9 }}><div style={S.fl}>Por qué se va</div>
        <select style={S.fi} value={motivo} onChange={e => setMotivo(e.target.value)}>
          {MOTIVOS_BAJA.map(m => <option key={m} value={m}>{m}</option>)}
        </select></div>
      <div style={{ marginTop: 9 }}><div style={S.fl}>Con sus palabras</div>
        <textarea style={{ ...S.fi, resize: 'vertical' }} rows={2} value={detalle} onChange={e => setDetalle(e.target.value)}
          placeholder="Lo que dijo textual. Es lo que sirve dentro de seis meses." /></div>
      <div style={{ fontSize: '0.68rem', color: '#a5a2af', lineHeight: 1.45, marginTop: 9 }}>
        La baja queda con su motivo y aparece en “Bajas del mes”, agrupada por razón.
      </div>
      {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginTop: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
        <button style={{ ...S.btnP, background: '#C0554E', opacity: busy ? .6 : 1 }} disabled={busy} onClick={guardar}>
          {busy ? 'Guardando…' : cuando === 'ya' ? 'Dar de baja' : 'Marcar para no renovar'}
        </button>
        <button style={{ ...S.mini, padding: '8px 14px' }} onClick={onCerrar}>Cancelar</button>
      </div>
    </Modal>
  );
}

/* Envoltura común de los paneles: el encabezado lila del sistema y el clic
 * fuera para cerrar, sin repetir 40 líneas por modal. */
function Modal({ titulo, nota, ancho = 460, onCerrar, children }: any) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 963, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: ancho, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1, textTransform: 'capitalize' }}>{titulo}</h3>
          {nota && <span style={{ fontSize: '0.72rem', color: '#7a6fc9' }}>{nota}</span>}
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

/* Registrar el pago o dejar constancia de la gestión.
 * La promesa CON FECHA es lo que convierte una lista en una agenda: el día que
 * vence, la cuenta vuelve a subir sola. */
function Gestion({ f, onCerrar, onListo }: any) {
  const esPago = f.modo === 'pago';
  const [monto, setMonto] = useState(String(f.exhibicion?.monto ?? f.deuda));
  const [fecha, setFecha] = useState(iso(new Date()));
  const [metodo, setMetodo] = useState('transferencia');
  const [referencia, setReferencia] = useState('');
  const [estado, setEstado] = useState(f.gestion === 'plan_pagos' ? 'contactado' : f.gestion);
  const [promesa, setPromesa] = useState(f.promesa || '');
  const [nota, setNota] = useState(f.nota || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const esCot = f.tipo === 'cotizacion';

  async function guardar() {
    setBusy(true); setError('');
    if (esPago) {
      // Cada dinero por su camino: el abono de una cotización se guarda como
      // pago de esa cotización —así cuadra el "lleva X de Y"—; el de una
      // suscripción pasa por el endpoint que recalcula próxima factura y ARR.
      // Duplicar cualquiera de los dos aquí sería la forma segura de que un día
      // dejen de coincidir.
      const r = esCot
        ? await fetch('/api/revenue/payments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quote_id: f.id, company_id: f.company_id, monto: Number(monto), fecha, metodo, referencia }),
          }).then(x => x.json()).catch(() => null)
        : await fetch('/api/crm/arr/register-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: f.id, company_id: f.company_id, monto: Number(monto), fecha, metodo, referencia }),
      }).then(x => x.json()).catch(() => null);
      if (!r || r.error) { setBusy(false); setError(r?.error || 'No se pudo registrar el pago.'); return; }
      if (f.exhibicion) {
        await fetch('/api/crm/cobranza', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exhibicion_id: f.exhibicion.id, pago_id: r.payment_id || r.payment?.id || null }),
        }).catch(() => {});
      }
      setBusy(false); onListo('Pago registrado'); return;
    }
    await fetch('/api/crm/cobranza', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(esCot ? { quote_id: f.id } : { subscription_id: f.id }),
        estado, promesa: estado === 'promesa' ? promesa : null, nota,
      }),
    }).catch(() => {});
    setBusy(false); onListo('Gestión guardada');
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 420 }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>{esPago ? 'Registrar pago' : 'Gestión de cobranza'}</h3>
          <span style={{ fontSize: '0.72rem', color: '#7a6fc9' }}>{f.cliente}</span>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          {esPago ? (<>
            {f.exhibicion && (
              <div style={{ background: '#EEECFE', borderRadius: 9, padding: '8px 11px', fontSize: '0.75rem', color: '#5B4BD6', marginBottom: 11, fontWeight: 700 }}>
                Exhibición {f.exhibicion.numero} de {f.exhibicion.total} · vencía el {fmtDate(f.exhibicion.fecha)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <div><div style={S.fl}>Monto</div><input style={S.fi} type="number" value={monto} onChange={e => setMonto(e.target.value)} /></div>
              <div><div style={S.fl}>Fecha</div><input style={S.fi} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 9 }}><div style={S.fl}>Cómo pagó</div>
              <select style={S.fi} value={metodo} onChange={e => setMetodo(e.target.value)}>
                {['transferencia', 'efectivo', 'tarjeta', 'oxxo', 'mercadopago', 'stripe', 'otro'].map(m => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div style={{ marginTop: 9 }}><div style={S.fl}>Referencia</div>
              <input style={S.fi} value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="folio, últimos 4 dígitos…" /></div>
          </>) : (<>
            <div style={S.fl}>En qué va</div>
            <select style={S.fi} value={estado} onChange={e => setEstado(e.target.value)}>
              {Object.entries(GESTION).filter(([k]) => k !== 'plan_pagos').map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
            </select>
            {estado === 'promesa' && (
              <div style={{ marginTop: 9 }}>
                <div style={S.fl}>¿Qué día paga?</div>
                <input style={S.fi} type="date" value={String(promesa).slice(0, 10)} onChange={e => setPromesa(e.target.value)} />
                <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4 }}>Ese día la cuenta vuelve a subir en la lista.</div>
              </div>
            )}
            <div style={{ marginTop: 9 }}><div style={S.fl}>Qué dijo</div>
              <textarea style={{ ...S.fi, resize: 'vertical' }} rows={3} value={nota} onChange={e => setNota(e.target.value)} placeholder="Pidió factura antes de pagar…" /></div>
          </>)}
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginTop: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
            <button style={{ ...S.btnP, opacity: busy ? .6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={busy} onClick={guardar}>
              {busy ? <><Corazones size={9} color="#fff" /> Guardando…</> : esPago ? 'Registrar pago' : 'Guardar'}
            </button>
            <button style={{ ...S.mini, padding: '8px 14px' }} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Partir una anualidad en exhibiciones. */
function PartirEnPagos({ f, onCerrar, onListo }: any) {
  const [n, setN] = useState(3);
  const [primera, setPrimera] = useState(iso(new Date()));
  const [cada, setCada] = useState<'mes' | 'quincena'>('mes');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const base = Math.floor(f.deuda / n);
  const prev = Array.from({ length: n }, (_, i) => {
    const d = new Date(primera + 'T12:00:00');
    d.setDate(d.getDate() + (cada === 'mes' ? 30 : 15) * i);
    return { fecha: iso(d), monto: i === 0 ? f.deuda - base * (n - 1) : base };
  });

  async function crear() {
    setBusy(true); setError('');
    const r = await fetch('/api/crm/cobranza', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(f.tipo === 'cotizacion' ? { quote_id: f.id } : { subscription_id: f.id }),
        exhibiciones: n, primera, cada, total: f.deuda,
      }),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo crear el plan.'); return; }
    onListo();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 420, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Partir en exhibiciones</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={{ fontSize: '0.78rem', color: '#6b6b74', marginBottom: 12 }}>
            <b>{f.cliente}</b> · {f.plan}<br />Se debe <b>{money(f.deuda)}</b>, vencido hace {f.dias} días.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div><div style={S.fl}>Exhibiciones</div>
              <select style={S.fi} value={n} onChange={e => setN(Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 8, 10, 12].map(x => <option key={x} value={x}>{x}</option>)}
              </select></div>
            <div><div style={S.fl}>Primera el</div><input style={S.fi} type="date" value={primera} onChange={e => setPrimera(e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 9 }}><div style={S.fl}>Cada</div>
            <select style={S.fi} value={cada} onChange={e => setCada(e.target.value as any)}>
              <option value="mes">Mes</option><option value="quincena">Quincena</option>
            </select></div>

          <div style={{ background: '#faf8ff', border: '1px solid #ece7fa', borderRadius: 10, padding: '10px 12px', margin: '12px 0' }}>
            {prev.map((x, i) => (
              <div key={i} style={{ display: 'flex', fontSize: '0.75rem', padding: '3px 0' }}>
                <span>{i + 1} · {fmtDate(x.fecha)}</span><b style={{ marginLeft: 'auto' }}>{money(x.monto)}</b>
              </div>
            ))}
            <div style={{ display: 'flex', fontSize: '0.78rem', borderTop: '1px solid #ece7fa', marginTop: 4, paddingTop: 6, color: '#5B4BD6', fontWeight: 800 }}>
              <span>Total</span><b style={{ marginLeft: 'auto' }}>{money(f.deuda)}</b>
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#a5a2af', lineHeight: 1.45, marginBottom: 11 }}>
            {f.tipo === 'cotizacion'
              ? 'La cotización no cambia de monto: esto solo parte cómo se cobra lo que falta. Lo ya abonado no se vuelve a partir.'
              : 'La renovación no se mueve: sigue venciendo en su fecha. Esto solo parte cómo se cobra lo de este periodo.'}
          </div>
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...S.btnP, opacity: busy ? .6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={busy} onClick={crear}>
              {busy ? <><Corazones size={9} color="#fff" /> Creando…</> : 'Crear plan'}
            </button>
            <button style={{ ...S.mini, padding: '8px 14px' }} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
