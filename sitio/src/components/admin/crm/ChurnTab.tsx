/**
 * CHURN · la sección de rescate.
 *
 * Vive debajo de Clientes y trabaja a los que ya cancelaron. La anatomía es la
 * misma de Leads a propósito —KPIs arriba, pestañas por etapa, tabla con las
 * columnas que esa pestaña necesita— porque quien usa una ya sabe usar la otra.
 *
 * Lo que la hace distinta es el dato que manda: aquí no importa tanto cuándo
 * entró como si ESTÁ USANDO EL SISTEMA. Una gracia de 30 días con el sistema
 * en cero ya fracasó, y eso se tiene que ver desde la lista, sin abrir nada.
 */
import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { lazySeguro } from '../../../lib/ui/lazySeguro';
import Cargando from './ui/Cargando';
import { CSS_TABLA, T } from '../../../lib/crm/tabla.estilo';
import { ETAPAS, ETAPA, MOTIVOS, MOTIVO, diasDeGracia, saludDeGracia, type Etapa } from '../../../lib/crm/churn.reglas';
import { useIsMobile } from '../../../lib/ui/mobile';
import ChurnCaso from './ChurnCaso';
// El drawer del cliente pesa: se trae solo cuando se abre una cuenta de «Por cancelar».
const ClienteDrawer360 = lazySeguro(() => import('./ClienteDrawer360'));

const dinero = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const diasDesde = (iso?: string | null) => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;
const fechaCorta = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso), h = new Date();
  if (d.toDateString() === h.toDateString()) return 'hoy';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '');
};

const PESTANAS: { id: string; l: string }[] = [
  { id: 'detectado', l: 'Detectados' },
  { id: 'conciliacion', l: 'En conciliación' },
  { id: 'gracia', l: 'En gracia' },
  { id: 'recuperado', l: 'En observación' },
  { id: 'estable', l: 'Estables' },
  { id: 'irrecuperable', l: 'Irrecuperables' },
  // No son «todos»: los cerrados tienen su pestaña. Llamarlo Todos mentía.
  { id: 'todos', l: 'Abiertos' },
  /* Los que TODAVÍA NO cancelan. No son casos de churn —son cobranza— pero se
     analizan desde aquí porque conciliar antes cuesta menos que rescatar
     después. Van al final: primero lo que ya se perdió. */
  { id: 'por_cancelar', l: 'Por cancelar' },
];

/* El semáforo del uso real. Es la columna que justifica el módulo: sale del
   sync nocturno que ya existía y contesta «¿le sirvió que le devolviéramos el
   acceso?» sin abrir el caso. */
const TONOS: Record<string, { fg: string; bg: string }> = {
  bien: { fg: '#1E8A63', bg: '#EAF8F2' },
  ojo: { fg: '#a06600', bg: '#FFF8EC' },
  mal: { fg: '#C0554E', bg: '#FDF6F5' },
  nd: { fg: '#74727F', bg: '#f4f4f6' },
};

export default function ChurnTab() {
  const esMovil = useIsMobile();
  const [etapa, setEtapa] = useState<string>('detectado');
  const [filas, setFilas] = useState<any[] | null>(null);
  const [cuenta, setCuenta] = useState<any>({});
  const [kpis, setKpis] = useState<any>({});
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [equipo, setEquipo] = useState<any[]>([]);
  const [orden, setOrden] = useState<'mrr' | 'reciente'>('mrr');
  const [alta, setAlta] = useState(false);
  // Las cuentas vencidas que aún no cancelan, para la pestaña «Por cancelar».
  const [porCaer, setPorCaer] = useState<any[]>([]);
  // Se abren con el drawer del CLIENTE, no con la ficha de caso: todavía son
  // clientes, no un caso de churn.
  const [clienteAbierto, setClienteAbierto] = useState<string | null>(null);
  const [verTablero, setVerTablero] = useState(false);
  const [tab, setTab] = useState<any>(null);
  useEffect(() => {
    if (!verTablero || tab) return;
    fetch('/api/crm/churn/tablero').then(r => r.json()).then(setTab).catch(() => setTab({}));
  }, [verTablero, tab]);
  const rejaRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const cargar = () => {
    fetch(`/api/crm/churn?etapa=${etapa}`)
      .then(r => r.json())
      /* Un error NO se pinta como lista vacía: el 403 de permisos salía como
         «Nadie sin atender», o sea una falla disfrazada de buena noticia. */
      .then(j => {
        if (j?.error) { setErrorCarga(j.error); setFilas([]); return; }
        setErrorCarga(''); setFilas(j.data || []); setCuenta(j.cuenta || {}); setKpis(j.kpis || {}); setEquipo(j.equipo || []);
        setPorCaer(j.por_caer || []);
      })
      .catch(() => { setErrorCarga('No se pudo cargar la lista.'); setFilas([]); });
  };
  useEffect(() => { cargar(); }, [etapa]);
  // La selección no sobrevive a un cambio de vista: actuar en bloque sobre
  // gente que ya no se ve es el bug que costó caro en Leads.
  useEffect(() => { setSel(new Set()); }, [etapa, busca]);

  // Deep-link de la campana: ?caso=<id> abre el caso exacto.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('caso');
    if (id && id.length > 20) setAbierto(id);
  }, []);

  /* El ÚNICO ×12 de la pantalla. En base y en el endpoint todo es mensual
     (mrr_perdido, gracia_mrr, rescate_mrr_regreso, mrr_movements); si además
     se convirtiera allá, saldría ×144. */
  const alAnio = (v: any) => (Number(v) || 0) * 12;

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    let r = !t ? (filas || []) : (filas || []).filter((c: any) =>
      `${c.companies?.nombre || ''} ${c.motivo_detalle || ''} ${c.gracia_acuerdo || ''}`.toLowerCase().includes(t));
    /* Por MRR de mayor a menor por omisión. Con 22 de 35 fechas estimadas —y
       todas iguales, la del import— ordenar por fecha era ordenar al azar; el
       dinero sí dice a quién llamar primero. */
    r = [...r].sort((a: any, b: any) => orden === 'mrr'
      ? Number(b.mrr_perdido || 0) - Number(a.mrr_perdido || 0)
      : String(b.detectado_at || '').localeCompare(String(a.detectado_at || '')));
    return r;
  }, [filas, busca, orden]);
  // Para la cabecera: cuántos hay en la pestaña y cuántos deja ver el buscador.
  const total = (filas || []).length;
  const visibles = lista.length;

  /* Columnas que solo existen donde significan algo: en «Detectados» la etapa
     es siempre la misma y la columna sería el nombre de la pestaña repetido. */
  const verEtapa = etapa === 'todos';
  const verGracia = etapa === 'gracia' || etapa === 'todos';
  const verCierre = ['recuperado', 'estable', 'irrecuperable'].includes(etapa);
  const nCols = 7 + (verEtapa ? 1 : 0) + (verGracia ? 1 : 0) + (verCierre ? 1 : 0);
  const ancho = 1040 + (verEtapa ? 120 : 0) + (verGracia ? 190 : 0) + (verCierre ? 200 : 0);

  // El alto se mide contra el borde real, no con un número inventado.
  useEffect(() => {
    const el = scrollRef.current, reja = rejaRef.current;
    if (!el || !reja) return;
    const medir = () => {
      reja.setAttribute('data-mas', el.scrollWidth - el.clientWidth - el.scrollLeft > 8 ? '1' : '0');
      reja.style.setProperty('--crm-tabla-alto', `${Math.max(280, Math.round(window.innerHeight - reja.getBoundingClientRect().top - 24))}px`);
    };
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', medir); window.removeEventListener('resize', medir); ro?.disconnect(); };
  }, [etapa, lista.length]);

  async function enBloque(cuerpo: any) {
    const ids = lista.filter((c: any) => sel.has(c.id)).map((c: any) => c.id);
    if (!ids.length) return;
    const r = await fetch('/api/crm/churn', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...cuerpo }) }).then(x => x.json()).catch(() => ({ error: 'No se pudo' }));
    /* Se dice cuántos se movieron Y cuántos se ignoraron: un «listo» que tapa
       que 4 de 10 no aplicaban es un listo que miente. */
    if (r?.error) setErrorCarga(r.error);
    else if (r?.ignorados) setErrorCarga(`Se movieron ${r.tocados}. ${r.ignorados} no aplicaban para esta acción.`);
    setSel(new Set()); cargar();
  }

  /* Misma tarjeta que Cotizaciones: franja de color a la izquierda, etiqueta
     en versalitas arriba y la cifra grande abajo. La franja dice de qué habla
     el número antes de leerlo. */
  const K = ({ v, l, sub, tono }: { v: any; l: string; sub?: any; tono?: 'rojo' | 'verde' }) => (
    <div style={{ background: '#fff', border: '1px solid #eae7f2', borderLeft: `3px solid ${tono === 'rojo' ? '#EF7A72' : tono === 'verde' ? '#4FBF95' : '#9B8CFA'}`,
      borderRadius: 14, padding: '14px 16px', minWidth: 0, boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', marginTop: 6,
        color: tono === 'rojo' ? '#C0554E' : tono === 'verde' ? '#1E8A63' : '#241d43' }}>{v}</div>
      {sub != null && <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 4, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );

  if (esMovil) return <ChurnMovil lista={lista} etapa={etapa} setEtapa={setEtapa} cuenta={cuenta} kpis={kpis}
    abierto={abierto} setAbierto={setAbierto} recargar={cargar} />;

  return (
    <div style={{ padding: '18px 22px 40px' }}>
      <style>{`
        ${CSS_TABLA}
        .churn-chip { border:1px solid #e8e5f0; background:#fff; color:#5a5a63; border-radius:20px; padding:7px 14px;
          font-size:0.8rem; font-weight:600; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:7px; }
        .churn-chip.on { background:#EEECFE; border-color:#c9bcf7; color:#5B4BD6; font-weight:800; }
        .churn-chip .n { font-size:0.7rem; font-weight:700; opacity:.6; font-variant-numeric:tabular-nums; }
      `}</style>

      {/* Cabecera de Cotizaciones: el subtítulo DEBAJO del título con el conteo
          de la vista, y las acciones de la pantalla a la derecha —no revueltas
          con las pestañas, que son otra cosa—. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', color: '#241d43', margin: 0 }}>Churn</h1>
          <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>
            Los que cancelaron y se están rescatando · {total} totales{total !== visibles ? ` · ${visibles} en vista` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <button onClick={() => setVerTablero(v => !v)}
            style={{ height: 36, padding: '0 14px', border: '1px solid #d9d5ea', borderRadius: 10, background: '#fff',
              color: '#5B4BD6', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {verTablero ? '← Volver a la lista' : 'Ver el tablero'}
          </button>
          <button onClick={() => setAlta(true)} title="Un cliente que canceló por fuera del sistema"
            style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 10, background: '#9B8CFA',
              color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Alta manual
          </button>
        </div>
      </div>

      {/* El dinero se PINTA al año, como en el resto de la vista de clientes,
          pero en base sigue siendo mensual (mrr_perdido, gracia_mrr…) y el
          endpoint también lo manda mensual: el ×12 vive AQUÍ y en ningún otro
          lado, o sale ×144. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, margin: '0 0 18px' }}>
        <K v={dinero(alAnio(kpis.mrr_en_rescate))} l="ARR en rescate" sub="casos abiertos" tono="rojo" />
        <K v={dinero(alAnio(kpis.mrr_recuperado))} l="ARR recuperado" sub="de los que volvieron" tono="verde" />
        <K v={kpis.tasa_recuperacion == null ? '—' : kpis.tasa_recuperacion + '%'} l="Tasa de recuperación" sub="de los cerrados, cuántos volvieron" />
        <K v={kpis.gracia_vencida || 0} l="Gracias vencidas" sub="sin decidir" tono={kpis.gracia_vencida ? 'rojo' : undefined} />
      </div>

      {/* Pestañas subrayadas con el contador en pastilla, como Cotizaciones. En
          píldoras y con las acciones metidas en la misma fila, «+ Alta manual»
          se leía como una pestaña más. En cero el contador va tenue: una
          pestaña vacía no debe invitar al clic. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e8eaee', overflowX: 'auto', flexWrap: 'nowrap' }}>
        {PESTANAS.map(p => {
          const on = etapa === p.id;
          // «Por cancelar» no vive en `cuenta` (esa cuenta casos de churn):
          // su número es el de las cuentas vencidas.
          const n = p.id === 'por_cancelar' ? (kpis.por_caer || 0) : (cuenta[p.id] ?? 0);
          return (
            <button key={p.id} onClick={() => setEtapa(p.id)} style={{
              background: 'none', border: 'none', borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent',
              color: on ? '#5B4BD6' : '#666', fontWeight: on ? 800 : 500, fontSize: '0.8125rem',
              padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: -1, flexShrink: 0,
            }}>
              {p.l}
              <span style={{
                marginLeft: 6, fontSize: '0.66rem', fontWeight: on ? 800 : 700,
                background: on ? '#EEECFE' : '#f3f3f6', color: on ? '#5B4BD6' : n === 0 ? '#c4c4cc' : '#8a8a92',
                borderRadius: 20, padding: '2px 8px',
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 0 14px' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 440, minWidth: 220 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente o acuerdo…"
            style={{ width: '100%', height: 38, boxSizing: 'border-box', border: '1px solid #e2e4e9', borderRadius: 10, padding: '0 12px 0 36px',
              fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }} />
        </div>
      </div>

      {errorCarga ? (
        <div style={{ padding: '30px 20px', background: '#FDF6F5', border: '1px solid #f3d9d6', borderRadius: 14, color: '#A8433C' }}>
          <b>No se pudo cargar Churn.</b><div style={{ fontSize: '0.85rem', marginTop: 4 }}>{errorCarga}</div>
        </div>
      ) : verTablero ? <Tablero d={tab} />
      : etapa === 'por_cancelar' ? (
        /* Otra tabla, porque son otra cosa: no hay caso, no hay etapa y no hay
           motivo de baja —todavía no se van—. Lo que sí hay, y es lo que se
           analiza, es desde cuándo no venden. El dinero NO se pinta: medido,
           ninguna de las 23 tiene precio ni en la empresa ni en una sub viva, y
           una columna de ceros diría que no hay nada en riesgo. */
        <PorCancelar filas={porCaer} busca={busca} onAbrir={setClienteAbierto} />
      )
      : filas === null ? <div style={{ padding: 40, color: '#8e88a8' }}>Cargando…</div>
      : lista.length === 0 ? (
        <div style={{ padding: '46px 20px', textAlign: 'center', color: '#71707C', background: '#fff',
          border: '1px solid #eae7f2', borderRadius: 14 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#241d43' }}>
            {etapa === 'detectado' ? 'Nadie sin atender.' : 'Nada en esta etapa.'}
          </div>
          <div style={{ fontSize: '0.83rem', marginTop: 4 }}>
            {etapa === 'todos' ? 'No hay casos abiertos. Los cerrados están en sus pestañas.' : ETAPA(etapa as Etapa).d}
          </div>
        </div>
      ) : (
      <div className="crm-reja churn-reja" ref={rejaRef}
        style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, overflow: 'hidden' }}>
        <span className="crm-orilla" aria-hidden="true" />
        <div className="crm-scroll-tabla" ref={scrollRef}>
          <table className="crm-tabla" style={{ minWidth: ancho }}>
            <thead><tr>
              <th scope="col" className="fija0" style={{ ...T.th, width: 40 }}>
                <input type="checkbox" aria-label="Seleccionar todos los de esta vista"
                  checked={lista.length > 0 && sel.size === lista.length}
                  ref={el => { if (el) el.indeterminate = sel.size > 0 && sel.size < lista.length; }}
                  onChange={e => setSel(e.target.checked ? new Set(lista.map((c: any) => c.id)) : new Set())} />
              </th>
              <th scope="col" className="fija1" style={{ ...T.th, width: 104 }}>Canceló</th>
              <th scope="col" className="fija2" style={{ ...T.th, width: 210 }}>Cliente</th>
              <th scope="col" className="num ord" aria-sort={orden === 'mrr' ? 'descending' : 'none'}
                style={{ ...T.th, width: 104, padding: 0 }}>
                <button type="button" onClick={() => setOrden(orden === 'mrr' ? 'reciente' : 'mrr')}
                  title="Ordenar por ARR / por cuándo entró"
                  style={{ all: 'unset', display: 'block', width: '100%', padding: '9px 14px', cursor: 'pointer', boxSizing: 'border-box', textAlign: 'right' }}>
                  ARR<span className="fl" aria-hidden="true">{orden === 'mrr' ? '↓' : ''}</span>
                </button>
              </th>
              <th scope="col" style={{ ...T.th, width: 190 }}>Por qué se fue</th>
              {verGracia && <th scope="col" style={{ ...T.th, width: 190 }}>Gracia</th>}
              {/* El rótulo cambia con la etapa porque el dato significa cosas
                  distintas: en gracia contesta «¿le sirvió que le devolviéramos
                  el acceso?»; en Detectados son cuentas ya bloqueadas, así que
                  medir su uso de hoy es una alarma sin información. Ahí lo que
                  vale es qué tanto lo usaba. */}
              <th scope="col" style={{ ...T.th, width: 150 }}>{verGracia || etapa === 'recuperado' ? 'Uso del sistema' : 'Qué tanto lo usaba'}</th>
              {verEtapa && <th scope="col" style={{ ...T.th, width: 120 }}>Etapa</th>}
              {verCierre && <th scope="col" style={{ ...T.th, width: 200 }}>Cierre</th>}
              <th scope="col" style={{ ...T.th, width: 150 }}>Siguiente paso</th>
            </tr></thead>
            <tbody>
              {lista.map((c: any) => {
                const emp = c.companies || {};
                const salud = saludDeGracia(c, emp);
                const tono = TONOS[salud.tono];
                const quedan = diasDeGracia(c);
                const et = ETAPA(c.etapa);
                return (
                  <Fragment key={c.id}>
                  <tr className={sel.has(c.id) ? 'sel' : undefined} onClick={() => setAbierto(c.id)}
                    style={{ cursor: 'pointer' }}>
                    <td className="fija0" style={T.td} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(c.id)}
                        aria-label={`Seleccionar a ${emp.nombre || 'este cliente'}`}
                        onChange={e => setSel(prev => { const n = new Set(prev); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
                    </td>
                    <td className="fija1" style={T.td}>
                      {/* Con fecha estimada NO se pinta antigüedad. 22 de los
                          35 históricos vinieron de Excel sin fecha y lo que se
                          guardó fue la fecha del import: decir «canceló hace 7
                          días» de alguien que lleva 400 sin vender no es un
                          matiz, es un dato falso con cara de dato. */}
                      {c.fecha_estimada ? (<>
                        <span style={{ fontWeight: 600, color: '#74727F', fontSize: '0.76rem' }}>sin fecha</span>
                        <span style={{ ...T.sub, display: 'block' }} title="El registro vino de Excel sin fecha de cancelación">
                          en la lista desde {fechaCorta(c.detectado_at)}
                        </span>
                      </>) : (<>
                        <span style={{ fontWeight: 600, color: '#4a4a52', fontSize: '0.76rem' }}>{fechaCorta(c.detectado_at)}</span>
                        <span style={{ ...T.sub, display: 'block' }}>hace {diasDesde(c.detectado_at)} d</span>
                      </>)}
                    </td>
                    <td className="fija2" style={T.td}>
                      <button type="button" className="crm-fila-nom" style={T.nombre} onClick={() => setAbierto(c.id)}
                        title={emp.nombre || undefined}>{emp.nombre || 'Sin nombre'}</button>
                      <span style={{ ...T.sub, display: 'block' }}>
                        {emp.sucursales ? `${emp.sucursales} ${emp.sucursales === 1 ? 'sucursal' : 'sucursales'}` : emp.plan || '—'}
                        {c.episodio > 1 && <b style={{ color: '#C0554E', marginLeft: 6 }}>·  {c.episodio}ª vez que se va</b>}
                      </span>
                    </td>
                    <td className="num" style={{ ...T.td, fontWeight: 700, color: '#241d43' }}>{dinero(alAnio(c.mrr_perdido))}</td>
                    <td style={T.td}>
                      {c.motivo_categoria
                        ? <span style={T.tag('#f4f4f6', '#5D6470')}>{MOTIVO(c.motivo_categoria)}</span>
                        : <span style={T.vacio}>sin clasificar</span>}
                      {(c.motivo_detalle || c.motivo_original) && (
                        <span style={{ ...T.sub, display: 'block' }} title={c.motivo_detalle || c.motivo_original}>
                          {c.motivo_detalle || c.motivo_original}
                        </span>
                      )}
                    </td>
                    {verGracia && (
                      <td style={T.td}>
                        {c.etapa === 'gracia' && quedan != null ? (<>
                          <span style={{ fontWeight: 700, color: quedan < 0 ? '#C0554E' : quedan <= 7 ? '#a06600' : '#241d43' }}>
                            {quedan < 0 ? `venció hace ${Math.abs(quedan)} d` : `quedan ${quedan} d`}
                          </span>
                          <span style={{ ...T.sub, display: 'block' }} title={c.gracia_acuerdo}>{c.gracia_acuerdo}</span>
                        </>) : <span style={T.vacio}>—</span>}
                      </td>
                    )}
                    <td style={T.td}>
                      {/* Con color en gracia y en observación —ahí el uso es la
                          señal que decide— y sin alarma en el resto: que una cuenta
                          cancelada no venda es lo esperado, no una urgencia. */}
                      {c.etapa === 'gracia' || c.etapa === 'recuperado'
                        ? <span style={T.tag(tono.bg, tono.fg)}>{salud.texto}</span>
                        /* Fuera de gracia: sin color de alarma. Que una cuenta
                           cancelada no venda es lo esperado, no una urgencia. */
                        : <span style={{ ...T.dato2, color: '#62606C' }}>{salud.tono === 'nd' ? salud.texto : salud.texto.replace(' sin vender', ' sin vender antes')}</span>}
                    </td>
                    {verEtapa && <td style={T.td}><span style={T.tag(et.bg, et.fg)}>{et.l}</span></td>}
                    {verCierre && (
                      <td style={T.td}>
                        <span style={{ color: c.resultado === 'recuperado' ? '#1E8A63' : '#5D6470', fontWeight: 600 }}>
                          {c.etapa === 'recuperado' ? `En observación${c.observacion_hasta ? ` hasta ${c.observacion_hasta}` : ''}`
                            : c.etapa === 'estable' ? 'Se quedó'
                            : 'Perdido'}
                        </span>
                        {c.resultado_motivo && <span style={{ ...T.sub, display: 'block' }} title={c.resultado_motivo}>{c.resultado_motivo}</span>}
                      </td>
                    )}
                    <td style={T.td}>
                      {c.proximo_paso
                        ? (<><span style={{ color: '#5c5870' }} title={c.proximo_paso}>{c.proximo_paso}</span>
                            <span style={{ ...T.sub, display: 'block', color: c.proximo_paso_at && c.proximo_paso_at < new Date().toISOString().slice(0, 10) ? '#C0554E' : undefined }}>
                              {c.proximo_paso_at || 'sin fecha'}</span></>)
                        : <span style={T.vacio}>sin definir</span>}
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {sel.size > 0 && (
          <div style={{ position: 'sticky', bottom: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', background: '#241d43', color: '#fff', borderRadius: '0 0 12px 12px', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '0.83rem' }}>{sel.size} {sel.size === 1 ? 'caso' : 'casos'}</b>
            <button onClick={() => setSel(new Set())} style={{ background: 'none', border: 'none', color: '#c9c2ec', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.76rem', fontWeight: 600 }}>Quitar la selección</button>
            <div style={{ flex: 1 }} />
            <button style={T.btnSel} onClick={() => exportar(lista.filter((c: any) => sel.has(c.id)))}>Exportar</button>
            <button style={T.btnSel} onClick={() => enBloque({ accion: 'conciliar' })}>Pasar a conciliación</button>
            <select value="" style={{ ...T.btnSel, appearance: 'none' as const }}
              onChange={e => { if (e.target.value) { enBloque({ accion: 'asignar', owner_id: e.target.value }); e.target.value = ''; } }}>
              <option value="">Asignar a…</option>
              {equipo.map((m: any) => <option key={m.id} value={m.id} style={{ color: '#241d43' }}>{m.nombre}</option>)}
            </select>
          </div>
        )}
      </div>
      )}

      {alta && <AltaManual equipo={equipo} onCerrar={() => setAlta(false)} onHecho={(id: string) => { setAlta(false); cargar(); setAbierto(id); }} />}
      {abierto && <ChurnCaso id={abierto} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
      {/* Las cuentas de «Por cancelar» se abren con el MISMO drawer de Clientes:
          siguen siendo clientes, no un caso de churn, y así el detalle se lee
          igual que en su pantalla de siempre. */}
      {clienteAbierto && (
        <Suspense fallback={<Cargando texto="Cargando cliente…" alto={260} />}>
          <ClienteDrawer360 companyId={clienteAbierto} onClose={() => setClienteAbierto(null)} onChanged={cargar} />
        </Suspense>
      )}
    </div>
  );
}

function exportar(filas: any[]) {
  // La columna se llama ARR y lleva el valor anual: si dijera «MRR» con el
  // número de la pantalla, quien cruce el CSV contra la base vería ×12 sin
  // explicación.
  const cols = ['Canceló', 'Cliente', 'ARR', 'Motivo', 'Detalle', 'Etapa', 'Acuerdo de gracia', 'Fin de gracia', 'Días sin vender'];
  const datos = filas.map((c: any) => [
    String(c.detectado_at || '').slice(0, 10), c.companies?.nombre || '', (Number(c.mrr_perdido) || 0) * 12,
    MOTIVO(c.motivo_categoria), c.motivo_detalle || c.motivo_original || '',
    ETAPA(c.etapa).l, c.gracia_acuerdo || '', c.gracia_fin || '', c.companies?.dias_sin_venta ?? '',
  ]);
  const csv = [cols, ...datos].map(f => f.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `churn-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

/* ── Móvil: la misma información con los estándares m-* ───────────────── */
function ChurnMovil({ lista, etapa, setEtapa, cuenta, kpis, abierto, setAbierto, recargar }: any) {
  return (
    <div>
      {/* Sin encabezado propio: el armazón del móvil ya pinta el título de la
          sección, y ponerlo otra vez lo repetía dos veces en la misma pantalla. */}
      <div style={{ padding: '14px 20px 10px' }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#C0554E', letterSpacing: '-.02em' }}>{dinero((Number(kpis.mrr_en_rescate) || 0) * 12)}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--m-soft)' }}>de ARR en rescate · {cuenta.todos || 0} casos abiertos</div>
      </div>
      <div className="crm-scroll-x" style={{ display: 'flex', gap: 6, padding: '4px 20px 12px', overflowX: 'auto' }}>
        {PESTANAS.map((p: any) => (
          <button key={p.id} onClick={() => setEtapa(p.id)} className={etapa === p.id ? 'seg-on' : undefined}
            style={{ flex: 'none', border: 'none', borderRadius: 20, padding: '0 14px', minHeight: 38, fontFamily: 'inherit',
              fontSize: 13, fontWeight: etapa === p.id ? 800 : 600, cursor: 'pointer',
              background: etapa === p.id ? '#EEECFE' : 'transparent', color: etapa === p.id ? '#5B4BD6' : 'var(--m-soft)' }}>
            {p.l} {cuenta[p.id] ?? 0}
          </button>
        ))}
      </div>
      {(lista || []).map((c: any) => {
        const emp = c.companies || {};
        const salud = saludDeGracia(c, emp);
        const quedan = diasDeGracia(c);
        return (
          <div key={c.id} className="m-row m-conv m-sin-avatar" onClick={() => setAbierto(c.id)}>
            <div className="m-tx">
              <div className="m-cab">
                <div className="m-n1">{emp.nombre || 'Sin nombre'}</div>
                <span className="m-hora" style={{ fontWeight: 700, color: '#C0554E' }}>{dinero((Number(c.mrr_perdido) || 0) * 12)}</span>
              </div>
              <div className="m-emp">
                {MOTIVO(c.motivo_categoria)}
                <span className="m-sep"> · </span>
                <span className="m-ciclo">{ETAPA(c.etapa).l}</span>
              </div>
              <div className="m-n2">
                <span className="m-txt" style={{ color: TONOS[salud.tono].fg, fontWeight: 600 }}>
                  {c.etapa === 'gracia' && quedan != null ? `${quedan < 0 ? 'gracia vencida' : `quedan ${quedan} d`} · ` : ''}{salud.texto}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {abierto && <ChurnCaso id={abierto} onCerrar={() => setAbierto(null)} onCambio={recargar} />}
    </div>
  );
}

/* ── El tablero: de qué nos morimos y cuánto recuperamos ───────────────── */
/* ── «Por cancelar»: las que están vencidas y todavía no se van ────────────
   Se ven aquí porque conciliar hoy cuesta menos que rescatar después, pero no
   son casos: se abren con el drawer del CLIENTE, que es lo que siguen siendo.
   La columna que decide es «sin vender», no el dinero: estas cuentas no traen
   precio en la empresa ni en una sub viva, y una columna de ceros diría que no
   hay nada en riesgo. */
function PorCancelar({ filas, busca, onAbrir }: { filas: any[]; busca: string; onAbrir: (id: string) => void }) {
  const t = busca.trim().toLowerCase();
  const vistas = !t ? filas : filas.filter((c: any) =>
    `${c.nombre_comercial || ''} ${c.nombre || ''} ${c.sacs_account || ''}`.toLowerCase().includes(t));

  if (!vistas.length) return (
    <div style={{ padding: '46px 20px', textAlign: 'center', color: '#71707C', background: '#fff', border: '1px solid #eae7f2', borderRadius: 14 }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#241d43' }}>Ninguna cuenta vencida.</div>
      <div style={{ fontSize: '0.83rem', marginTop: 4 }}>Nadie está a punto de caerse por falta de pago.</div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#FFF8EC',
        border: '1px solid #f2e3c8', borderRadius: 12, padding: '11px 15px', marginBottom: 12 }}>
        <span style={{ fontSize: '0.82rem', color: '#7a5a2a' }}>
          Estas <b>{filas.length}</b> todavía no cancelan: están vencidas de pago. Conciliar hoy cuesta menos que rescatar después.
        </span>
        <a href="/admin/crm?tab=pagos&vista=recuperacion" style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700, color: '#a06600' }}>Ver cobranza ›</a>
      </div>

      <div className="reja" style={{ background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr>
              <th scope="col" style={{ ...T.th, width: 240 }}>Cliente</th>
              <th scope="col" style={{ ...T.th, width: 150 }}>Sin vender</th>
              <th scope="col" style={{ ...T.th, width: 130 }}>Última venta</th>
              <th scope="col" style={{ ...T.th, width: 130 }}>Plan</th>
            </tr></thead>
            <tbody>
              {vistas.map((c: any) => {
                const d = c.dias_sin_venta;
                /* El color solo donde significa: a partir de 15 días sin vender
                   una cuenta vencida es la que de verdad se está yendo. */
                const grave = d != null && d >= 15;
                return (
                  <tr key={c.id} onClick={() => onAbrir(c.id)} style={{ cursor: 'pointer' }}>
                    <td style={T.td}>
                      <span className="crm-fila-nom" style={{ ...T.nombre, display: 'block' }}>{c.nombre_comercial || c.nombre || 'Sin nombre'}</span>
                      <span style={{ ...T.sub, display: 'block' }}>
                        {c.sacs_account || '—'}{c.sucursales ? ` · ${c.sucursales} ${c.sucursales === 1 ? 'sucursal' : 'sucursales'}` : ''}
                      </span>
                    </td>
                    <td style={T.td}>
                      {d == null ? <span style={T.vacio}>sin datos</span> : (
                        <span style={{ fontWeight: 700, color: grave ? '#C0554E' : d >= 3 ? '#a06600' : '#241d43' }}>
                          {d === 0 ? 'vendió hoy' : `${d} ${d === 1 ? 'día' : 'días'}`}
                        </span>
                      )}
                    </td>
                    <td style={T.td}>
                      {c.ultima_venta_at
                        ? <span style={{ ...T.dato2, color: '#62606C' }}>{fechaCorta(c.ultima_venta_at)}</span>
                        : <span style={T.vacio}>nunca</span>}
                    </td>
                    <td style={T.td}>
                      {c.plan ? <span style={{ ...T.dato2, color: '#62606C' }}>{c.plan}</span> : <span style={T.vacio}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Tablero({ d }: { d: any }) {
  if (!d) return <div style={{ padding: 40, color: '#8e88a8' }}>Cargando el tablero…</div>;
  const caja: any = { background: '#fff', border: '1px solid #eae7f2', borderRadius: 14, padding: 18, marginBottom: 14 };
  const rot: any = { fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8e88a8', marginBottom: 12 };
  const maxMrr = Math.max(1, ...(d.motivos || []).map((m: any) => m.mrr));
  const maxMes = Math.max(1, ...(d.meses || []).flatMap((m: any) => [m.perdido, m.recuperado]));
  return (
    <div>
      <div style={caja}>
        <div style={rot}>De qué nos morimos</div>
        {/* Ordenado por DINERO, no por conteo: cinco casos chicos importan
            menos que uno grande, y el orden lo decide lo que duele. */}
        {(d.motivos || []).map((m: any) => (
          <div key={m.id} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
              <span style={{ color: '#241d43', fontWeight: 600 }}>{m.l}</span>
              <span style={{ color: '#71707C', fontVariantNumeric: 'tabular-nums' }}>
                {dinero((Number(m.mrr) || 0) * 12)} · {m.n} {m.n === 1 ? 'caso' : 'casos'}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 20, background: '#f1f0f5', overflow: 'hidden' }}>
              <div style={{ width: `${(m.mrr / maxMrr) * 100}%`, height: '100%', borderRadius: 20,
                background: m.id === 'mal_servicio' ? '#C0554E' : m.id === 'no_uso' ? '#a06600' : '#7C6BF0' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={caja}>
        <div style={rot}>Perdido contra recuperado, por mes</div>
        <div style={{ fontSize: '0.76rem', color: '#71707C', marginBottom: 12 }}>
          Sale del ledger, no de sumar casos: es la misma cifra que el ARR. Cada
          mes, anualizado.
        </div>
        {(d.meses || []).length === 0 ? <div style={{ color: '#71707C', fontSize: '0.83rem' }}>Todavía sin movimientos en el período.</div>
        : (d.meses || []).map((m: any) => (
          <div key={m.mes} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 62, fontSize: '0.75rem', color: '#71707C', fontVariantNumeric: 'tabular-nums' }}>{m.mes}</span>
            <div style={{ flex: 1 }}>
              <div style={{ height: 7, width: `${(m.perdido / maxMes) * 100}%`, background: '#C0554E', borderRadius: 20, marginBottom: 3 }} />
              <div style={{ height: 7, width: `${(m.recuperado / maxMes) * 100}%`, background: '#1E8A63', borderRadius: 20 }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#71707C', fontVariantNumeric: 'tabular-nums', minWidth: 130, textAlign: 'right' }}>
              −{dinero((Number(m.perdido) || 0) * 12)} · +{dinero((Number(m.recuperado) || 0) * 12)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...caja, flex: '1 1 300px' }}>
          <div style={rot}>El embudo</div>
          {(d.embudo || []).map((e: any) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '5px 0' }}>
              <span>{e.l}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{e.n}</b>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f0f5', marginTop: 8, paddingTop: 8, fontSize: '0.8rem', color: '#71707C' }}>
            {d.resumen?.tasa == null ? 'Todavía no se cierra ningún caso.'
              : `${d.resumen.tasa}% de los ${d.resumen.cerrados} cerrados volvieron.`}
            {d.resumen?.dias_promedio != null && (
              /* El promedio va con su n: un promedio sin decir sobre cuántos
                 se calculó es un rumor. Y solo cuenta fechas reales. */
              <div style={{ marginTop: 4 }}>Rescatar tarda {d.resumen.dias_promedio} días en promedio (sobre {d.resumen.dias_base} casos con fecha real).</div>
            )}
          </div>
        </div>
        <div style={{ ...caja, flex: '1 1 300px' }}>
          <div style={rot}>Qué acuerdos funcionan</div>
          {(d.acuerdos || []).length === 0
            ? <div style={{ fontSize: '0.83rem', color: '#71707C' }}>Todavía no se cierra ninguna gracia. Cuando haya, aquí sale cuál trae más gente de vuelta.</div>
            : (d.acuerdos || []).map((a: any) => (
              <div key={a.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', padding: '5px 0' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.l}</span>
                <b style={{ color: a.ok ? '#1E8A63' : '#71707C', whiteSpace: 'nowrap', marginLeft: 10 }}>{a.ok}/{a.n}</b>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ── Alta manual: «canceló por fuera del sistema» ───────────────────────────
   El camino normal es automático; esto es la excepción, y por eso exige decir
   por qué en vez de dejarlo en blanco. Queda auditado quién lo abrió. */
function AltaManual({ equipo, onCerrar, onHecho }: any) {
  const [q, setQ] = useState('');
  const [ops, setOps] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [f, setF] = useState<any>({ motivo_categoria: '', motivo_detalle: '', mrr_perdido: '' });
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setOps([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/crm/empresas?search=${encodeURIComponent(q)}&limit=8`)
        .then(r => r.json()).then(j => setOps(j.data || j.companies || [])).catch(() => setOps([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const inp: any = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e4e9', borderRadius: 9,
    padding: '9px 11px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' };

  async function guardar() {
    if (!sel) { setErr('Elige la empresa.'); return; }
    setGuardando(true); setErr('');
    const r = await fetch('/api/crm/churn', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: sel.id, ...f, mrr_perdido: Number(f.mrr_perdido || 0) }) })
      .then(x => x.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setGuardando(false);
    if (r?.error) { setErr(r.error); return; }
    if (r?.ya_existia) { setErr('Esa empresa ya tenía un caso abierto: se anotó ahí.'); }
    onHecho(r.caso_id);
  }

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.32)', zIndex: 900 }} />
      <div role="dialog" aria-modal="true" aria-label="Alta manual de churn" className="crm-sheet" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px, 94vw)',
        background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(16,24,40,.24)', zIndex: 901, padding: 20,
      }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#241d43' }}>Abrir un caso a mano</div>
        <div style={{ fontSize: '0.8rem', color: '#71707C', margin: '4px 0 14px', lineHeight: 1.5 }}>
          Para el que canceló por fuera del sistema. Lo normal es que el caso se abra solo al cancelarse la suscripción.
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>Empresa</span>
          {sel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', border: '1px solid #c9bcf7', borderRadius: 9, background: '#F3F0FE' }}>
              <b style={{ fontSize: '0.86rem', color: '#241d43', flex: 1 }}>{sel.nombre}</b>
              <button onClick={() => { setSel(null); setQ(''); }} style={{ border: 'none', background: 'none', color: '#5B4BD6', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>cambiar</button>
            </div>
          ) : (
            <>
              <input style={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="Escribe el nombre…" />
              {ops.length > 0 && (
                <div style={{ border: '1px solid #eae7f2', borderRadius: 9, marginTop: 4, maxHeight: 170, overflowY: 'auto' }}>
                  {ops.map((o: any) => (
                    <button key={o.id} onClick={() => { setSel(o); setOps([]); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none',
                        padding: '8px 11px', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {o.nombre}{o.estado_cuenta ? <span style={{ color: '#8e88a8' }}> · {o.estado_cuenta}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>Por qué canceló</span>
          <select style={inp} value={f.motivo_categoria} onChange={e => setF({ ...f, motivo_categoria: e.target.value })}>
            <option value="">Elige…</option>
            {MOTIVOS.map(m => <option key={m.id} value={m.id}>{m.l}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>Detalle</span>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={f.motivo_detalle}
            onChange={e => setF({ ...f, motivo_detalle: e.target.value })} placeholder="Qué pasó, en tus palabras" />
        </label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          {/* Se teclea AL MES porque al mes se guarda (mrr_perdido). Cambiarlo a
              anual aquí y dividir por dentro es justo la clase de conversión
              callada que hace que un acuerdo salga ×12 mal; en vez de eso se
              dice la unidad y se enseña el equivalente al año. */}
          <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8e88a8', marginBottom: 4 }}>Lo que se pierde al mes</span>
          <input type="number" style={inp} value={f.mrr_perdido} onChange={e => setF({ ...f, mrr_perdido: e.target.value })} placeholder="0" />
          {Number(f.mrr_perdido) > 0 && (
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#8e88a8', marginTop: 4 }}>
              En la lista se verá como {dinero(Number(f.mrr_perdido) * 12)} de ARR.
            </span>
          )}
        </label>

        {err && <div style={{ padding: '9px 12px', borderRadius: 9, background: '#FDF6F5', color: '#A8433C', fontSize: '0.8rem', marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={guardar} disabled={guardando} style={{ border: 'none', borderRadius: 10, padding: '10px 16px',
            background: '#5B4BD6', color: '#fff', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando…' : 'Abrir el caso'}
          </button>
          <button onClick={onCerrar} style={{ border: '1.5px solid #71707C', borderRadius: 10, padding: '10px 16px',
            background: '#fff', color: '#71707C', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        </div>
      </div>
    </>
  );
}
