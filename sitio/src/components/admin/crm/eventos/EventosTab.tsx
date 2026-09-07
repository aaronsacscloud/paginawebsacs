// FERIAS Y EVENTOS · dónde hay que estar y qué pasó cada vez que fuimos.
//
// La pantalla contesta dos preguntas: «¿a qué eventos vale la pena ir?» (la
// lista ordenada por encaje, con la decisión tomada a la vista) y «¿cuándo?»
// (el calendario mes por mes). Todo lo demás —preparación, registros del stand,
// gastos, embudo— vive en la edición, porque un evento se repite y cada vez es
// otra historia.
import { useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import Sheet from '../ui/Sheet';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import { useIsMobile } from '../../../../lib/ui/mobile';
import EventoFicha from './EventoFicha';
import Edicion from './Edicion';
import { TIPO_ETIQ, DECISION_TONO, PARTICIPACION_TONO, GIROS_EVENTO, Pastilla, Fit, Btn, fmt, rango, relativo, mesLargo, d, post, diaMX } from './ui';

export default function EventosTab() {
  const isMobile = useIsMobile();
  const [datos, setDatos] = useState<{ eventos: any[]; resumen: any; hoy: string; urge?: any[] } | null>(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista');
  const [giro, setGiro] = useState('');
  const [filtro, setFiltro] = useState<'' | 'ir' | 'evaluar' | 'proximas' | 'vamos'>('');
  // El calendario esconde los descartados: una expo de XV años cada quince días
  // tapaba las tres fechas que sí importan.
  const [conDescartados, setConDescartados] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [edicionAbierta, setEdicionAbierta] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const traer = () => fetch('/api/crm/eventos').then(r => r.json()).then(j => { if (j.error) setError(j.error); else setDatos(j); }).catch(e => setError(String(e)));
  useEffect(() => { traer(); }, []);

  // Abrir una edición desde fuera: un enlace con ?edicion= al cargar, o la campana
  // (el cron de eventos deja avisos con destino `eventos?edicion=<id>`) cuando la
  // pestaña ya estaba montada — ahí no hay remount, así que se escucha crm:destino.
  useEffect(() => {
    const abrir = () => {
      const q = new URLSearchParams(location.search).get('edicion');
      if (q) setEdicionAbierta(q);
    };
    abrir();
    window.addEventListener('crm:destino', abrir);
    return () => window.removeEventListener('crm:destino', abrir);
  }, []);

  const porGiro = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of datos?.eventos || []) for (const g of e.giros || []) m[g] = (m[g] || 0) + 1;
    return m;
  }, [datos]);

  const hoy = datos?.hoy || diaMX();
  const eventos = useMemo(() => {
    let l = datos?.eventos || [];
    if (giro) l = l.filter(e => (e.giros || []).includes(giro));
    if (filtro === 'ir' || filtro === 'evaluar') l = l.filter(e => e.decision === filtro);
    if (filtro === 'proximas') l = l.filter(e => e.ediciones.some((x: any) => x.inicio >= hoy));
    if (filtro === 'vamos') l = l.filter(e => e.ediciones.some((x: any) => x.participacion === 'vamos' && x.inicio >= hoy));
    return l;
  }, [datos, giro, filtro, hoy]);

  // Meses del calendario: desde el mes actual, todo lo que traiga fecha.
  const meses = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of eventos) for (const ed of e.ediciones) {
      if (!conDescartados && e.decision === 'no_ir' && ed.participacion !== 'vamos') continue;
      if (ed.fin && ed.fin < hoy) continue;
      const k = ed.inicio.slice(0, 7);
      (m.get(k) || m.set(k, []).get(k)!).push({ ...ed, evento: e });
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => [k, l.sort((a: any, b: any) => a.inicio.localeCompare(b.inicio))] as const);
  }, [eventos, hoy, conDescartados]);

  const decidir = async (evento_id: string, decision: string) => {
    try { await post('/api/crm/eventos', { accion: 'decision', evento_id, decision }); traer(); } catch (e: any) { alert(e.message); }
  };

  const evAbierto = datos?.eventos.find(e => e.id === abierto);
  const edAbierta = datos?.eventos.flatMap(e => e.ediciones.map((x: any) => ({ ...x, evento: e }))).find((x: any) => x.id === edicionAbierta);

  if (error) return <div style={WRAP}><EstadoVacio titulo="No se pudieron traer los eventos" pista={error} accion="Reintentar" onAccion={() => { setError(''); traer(); }} /></div>;
  if (!datos) return <div style={WRAP}><Cargando texto="Cargando ferias y eventos…" /></div>;
  const r = datos.resumen;

  const kpi = (label: string, valor: string, sub: string, franja: string, tinta: string, f: typeof filtro) => (
    <div onClick={() => setFiltro(filtro === f ? '' : f)} style={{ ...tarjetaKpi(franja), cursor: 'pointer', outline: filtro === f && f ? `2px solid ${franja}` : 'none' }}>
      <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tinta, lineHeight: 1.15, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: '.6875rem', color: '#888', marginTop: 3 }}>{sub}</div>
    </div>
  );

  return (
    <div style={WRAP}>
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>Ferias y eventos</h1>
            <p style={{ fontSize: '.875rem', color: '#666', margin: '0 0 18px', maxWidth: '70ch' }}>
              Los lugares donde la gente de la moda mexicana se junta a comprar: qué son, quién va, cuánto cuestan y qué tanto
              encajan con el cliente que buscamos. De cada edición sale un embudo —registros, contactados, demos, clientes— y
              un costo por cliente, para que la siguiente decisión sea con números y no con la sensación de que «estuvo lleno».
            </p>
          </div>
          <Btn nivel="primario" onClick={() => setNuevo(true)}>Nuevo evento</Btn>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fit,minmax(160px,1fr))', gap: isMobile ? 8 : 12, marginBottom: 18 }}>
        {kpi('Vamos', fmt(r.vamos), `${fmt(r.con_participacion)} ${r.con_participacion === 1 ? 'edición confirmada' : 'ediciones confirmadas'}`, P.verde, P.verdeTinta, 'ir')}
        {kpi('Por evaluar', fmt(r.por_evaluar), `de ${fmt(r.eventos)} en el radar`, P.ambar, P.ambarTinta, 'evaluar')}
        {kpi('Próximas fechas', fmt(r.proximas), 'ediciones por venir', P.azul, P.azulTinta, 'proximas')}
        {kpi('Registros', fmt(r.registros_total), 'personas conocidas en eventos', P.violeta, P.violetaTinta, '')}
      </div>

      {/* Lo que urge: plazos que vencen, ferias que encajan y siguen sin decisión, tareas
          vencidas. Ordenado por fecha. Es lo primero que se ve porque es lo único que
          cambia de un día a otro; el resto del catálogo no. */}
      {!!datos.urge?.length && (
        <div style={{ ...tarjetaKpi(P.ambar), padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Lo que urge</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {datos.urge.slice(0, 6).map((u: any, i: number) => (
              <button key={i} onClick={() => setEdicionAbierta(u.edicion_id)} style={{ font: 'inherit', textAlign: 'left', background: 'none', border: 'none', padding: isMobile ? '4px 0' : 0, cursor: 'pointer', display: isMobile ? 'grid' : 'flex', gap: isMobile ? 2 : 10, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ fontSize: '.75rem', fontWeight: 800, color: u.tipo === 'tareas' ? P.rojoTinta : P.ambarTinta, whiteSpace: 'nowrap', minWidth: isMobile ? 0 : 130 }}>
                  {u.tipo === 'plazo' ? `Apartar ${relativo(u.fecha)}` : u.tipo === 'decidir' ? `Decidir · es ${relativo(u.fecha)}` : `${u.n} ${u.n === 1 ? 'tarea vencida' : 'tareas vencidas'}`}
                </span>
                <span style={{ fontSize: '.8125rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{u.evento}</b> · {u.edicion}</span>
              </button>
            ))}
            {datos.urge.length > 6 && <span style={{ fontSize: '.75rem', color: '#888' }}>y {datos.urge.length - 6} más</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: `1px solid ${P.linea}`, alignItems: 'flex-end' }}>
        {([['lista', 'A dónde ir'], ['calendario', 'Calendario']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{
            font: 'inherit', fontSize: '.875rem', fontWeight: vista === v ? 800 : 500, padding: '9px 15px', border: 'none',
            borderBottom: vista === v ? `2px solid ${P.violeta}` : '2px solid transparent', background: vista === v ? P.violetaAgua : 'transparent',
            color: vista === v ? P.violetaTinta : '#666', borderRadius: '9px 9px 0 0', cursor: 'pointer',
          }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        {vista === 'calendario' && (
          <label style={{ fontSize: '.75rem', color: '#666', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={conDescartados} onChange={e => setConDescartados(e.target.checked)} /> incluir los que no vamos
          </label>
        )}
        {isMobile && <Btn nivel="primario" chico onClick={() => setNuevo(true)} style={{ marginBottom: 6 }}>Nuevo</Btn>}
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 16, ...(isMobile ? { overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 } : { flexWrap: 'wrap' }) }}>
        <Chip activo={!giro} onClick={() => setGiro('')}>Todos los giros</Chip>
        {Object.entries(porGiro).sort((a, b) => b[1] - a[1]).map(([g, n]) => <Chip key={g} activo={giro === g} onClick={() => setGiro(giro === g ? '' : g)}>{GIROS_EVENTO[g] || g} <span style={{ opacity: .6 }}>{n}</span></Chip>)}
      </div>

      {!eventos.length ? (
        <EstadoVacio titulo="Ningún evento con esos filtros" pista="Quita el filtro o agrega el evento que falta." accion="Nuevo evento" onAccion={() => setNuevo(true)} />
      ) : vista === 'lista' ? (
        <ListaEventos eventos={eventos} hoy={hoy} isMobile={isMobile} onAbrir={setAbierto} onDecidir={decidir} onEdicion={setEdicionAbierta} />
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {!meses.length && <EstadoVacio titulo="Sin fechas por venir" pista="Los eventos filtrados no tienen ediciones con fecha futura." />}
          {meses.map(([k, lista]) => {
            const [y, m] = k.split('-').map(Number);
            return (
              <div key={k}>
                <div style={{ fontSize: '.8125rem', fontWeight: 800, color: P.violetaTinta, textTransform: 'capitalize', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {mesLargo(y, m - 1)} <span style={{ flex: 1, height: 1, background: P.linea }} /><span style={{ fontSize: '.6875rem', color: '#999', fontWeight: 600 }}>{lista.length} {lista.length === 1 ? 'fecha' : 'fechas'}</span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {lista.map((ed: any) => <FilaEdicion key={ed.id} ed={ed} hoy={hoy} isMobile={isMobile} onAbrir={() => setEdicionAbierta(ed.id)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!abierto && !edicionAbierta} onClose={() => setAbierto(null)} width={880} title={evAbierto?.nombre || 'Evento'}>
        {evAbierto && <EventoFicha evento={evAbierto} hoy={hoy} onCambio={traer} onEdicion={(id) => setEdicionAbierta(id)} onCerrar={() => { setAbierto(null); traer(); }} />}
      </Sheet>

      <Sheet open={!!edicionAbierta} onClose={() => { setEdicionAbierta(null); traer(); }} width={980}
        title={edAbierta ? `${edAbierta.evento.nombre} · ${edAbierta.nombre}` : 'Edición'}
        headerActions={edAbierta && !abierto ? <Btn chico nivel="terciario" onClick={() => { setAbierto(edAbierta.evento.id); setEdicionAbierta(null); }}>Ver el evento</Btn> : undefined}>
        {edicionAbierta && <Edicion id={edicionAbierta} onCambio={traer} />}
      </Sheet>

      <Sheet open={nuevo} onClose={() => setNuevo(false)} width={720} title="Nuevo evento">
        {nuevo && <EventoFicha evento={null} hoy={hoy} onCambio={traer} onEdicion={() => {}} onCerrar={() => { setNuevo(false); traer(); }} />}
      </Sheet>
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: any }) {
  return (
    <button onClick={onClick} style={{
      font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1.5px solid ${activo ? P.violeta : '#e4e4e4'}`, background: activo ? P.violeta : '#fff', color: activo ? '#fff' : '#555',
    }}>{children}</button>
  );
}

/** La lista de «a dónde ir»: agrupada por decisión y ordenada por encaje. */
function ListaEventos({ eventos, hoy, isMobile, onAbrir, onDecidir, onEdicion }: {
  eventos: any[]; hoy: string; isMobile: boolean; onAbrir: (id: string) => void; onDecidir: (id: string, d: string) => void; onEdicion: (id: string) => void;
}) {
  const grupos: [string, string, any[]][] = [
    ['ir', 'Vamos', eventos.filter(e => e.decision === 'ir')],
    ['evaluar', 'Por evaluar', eventos.filter(e => e.decision === 'evaluar')],
    ['no_ir', 'No vamos', eventos.filter(e => e.decision === 'no_ir')],
  ];
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {grupos.filter(g => g[2].length).map(([k, titulo, lista]) => (
        <div key={k}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Pastilla tono={DECISION_TONO[k]}>{titulo}</Pastilla>
            <span style={{ fontSize: '.75rem', color: '#999' }}>{lista.length} {lista.length === 1 ? 'evento' : 'eventos'}{k === 'ir' ? ' · ordenados por encaje' : ''}</span>
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(420px,1fr))', opacity: k === 'no_ir' ? .75 : 1 }}>
            {lista.sort((a, b) => (b.fit_puntaje || 0) - (a.fit_puntaje || 0)).map(e => <TarjetaEvento key={e.id} e={e} hoy={hoy} onAbrir={() => onAbrir(e.id)} onDecidir={(d) => onDecidir(e.id, d)} onEdicion={onEdicion} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TarjetaEvento({ e, hoy, onAbrir, onDecidir, onEdicion }: { e: any; hoy: string; onAbrir: () => void; onDecidir: (d: string) => void; onEdicion: (id: string) => void }) {
  const prox = e.ediciones.find((x: any) => (x.fin || x.inicio) >= hoy);
  const franja = e.decision === 'ir' ? P.verde : e.decision === 'evaluar' ? P.ambar : '#ddd';
  return (
    <div style={{ ...tarjetaKpi(franja), display: 'grid', gap: 9, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <button onClick={onAbrir} style={{ font: 'inherit', fontSize: '1rem', fontWeight: 800, color: '#222', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>{e.nombre}</button>
          <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>{TIPO_ETIQ[e.tipo] || e.tipo} · {e.ciudad || 'México'}{e.frecuencia ? ` · ${e.frecuencia}` : ''}</div>
        </div>
        <Fit v={e.fit_puntaje} />
      </div>
      {e.fit_por_que && <div style={{ fontSize: '.8125rem', color: '#444', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.fit_por_que}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {(e.giros || []).slice(0, 4).map((g: string) => <Pastilla key={g} tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{GIROS_EVENTO[g] || g}</Pastilla>)}
        {e.expositores_n ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{fmt(e.expositores_n)} expositores</Pastilla> : null}
        {e.visitantes_n ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{fmt(e.visitantes_n)} visitantes</Pastilla> : null}
        {e.rol_recomendado && e.rol_recomendado !== 'ninguno' ? <Pastilla tono={{ bg: '#f3f3f3', fg: '#555' }}>Ir {e.rol_recomendado === 'stand' ? 'con stand' : e.rol_recomendado === 'recorrido' ? 'a recorrer' : e.rol_recomendado}</Pastilla> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: `1px solid ${P.lineaSuave}`, paddingTop: 9 }}>
        {prox ? (
          <button onClick={() => onEdicion(prox.id)} style={{ font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'grid', gap: 2 }}>
            <span style={{ fontSize: '.8125rem', fontWeight: 700, color: P.violetaTinta }}>{rango(prox.inicio, prox.fin)} <span style={{ color: '#999', fontWeight: 500 }}>· {relativo(prox.inicio)}{prox.estado_fecha === 'estimada' ? ' · fecha estimada' : ''}</span></span>
            <span style={{ fontSize: '.6875rem', color: '#888' }}><Pastilla tono={PARTICIPACION_TONO[prox.participacion] || PARTICIPACION_TONO.sin_decidir}>{(PARTICIPACION_TONO[prox.participacion] || PARTICIPACION_TONO.sin_decidir).l}</Pastilla>{prox.registros ? ` · ${prox.registros} registros` : ''}</span>
          </button>
        ) : <span style={{ fontSize: '.75rem', color: '#999' }}>Sin fecha próxima cargada</span>}
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {(['ir', 'evaluar', 'no_ir'] as const).map(dd => (
            <button key={dd} onClick={() => onDecidir(dd)} title={`Marcar: ${DECISION_TONO[dd].l}`} style={{
              font: 'inherit', fontSize: '.6875rem', fontWeight: 700, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
              border: `1.5px solid ${e.decision === dd ? P.violeta : '#e4e4e4'}`, background: e.decision === dd ? P.violeta : '#fff', color: e.decision === dd ? '#fff' : '#666',
            }}>{DECISION_TONO[dd].l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilaEdicion({ ed, hoy, isMobile, onAbrir }: { ed: any; hoy: string; isMobile: boolean; onAbrir: () => void }) {
  const enCurso = ed.inicio <= hoy && (ed.fin || ed.inicio) >= hoy;
  const a = d(ed.inicio);
  const tono = PARTICIPACION_TONO[ed.participacion] || PARTICIPACION_TONO.sin_decidir;
  return (
    <button onClick={onAbrir} style={{
      font: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateColumns: isMobile ? '52px 1fr' : '64px 1fr auto', gap: 14, alignItems: 'center',
      background: enCurso ? P.violetaAgua : P.papel, border: `1px solid ${enCurso ? P.violeta : P.linea}`, borderLeft: `3px solid ${ed.participacion === 'vamos' ? P.verde : ed.participacion === 'fuimos' ? P.violeta : ed.evento.decision === 'ir' ? P.ambar : '#ddd'}`, borderRadius: 10, padding: '10px 14px',
    }}>
      <div style={{ textAlign: 'center', lineHeight: 1.05 }}>
        <div style={{ fontSize: '1.375rem', fontWeight: 800, color: P.violetaTinta, fontVariantNumeric: 'tabular-nums' }}>{a.getDate()}</div>
        <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{ed.fin && ed.fin !== ed.inicio ? `al ${d(ed.fin).getDate()}` : a.toLocaleDateString('es-MX', { weekday: 'short' })}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '.9375rem', color: '#222', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {ed.evento.nombre} <span style={{ fontWeight: 500, color: '#888', fontSize: '.8125rem' }}>{ed.nombre}</span>
          {enCurso && <Pastilla tono={{ bg: P.violeta, fg: '#fff' }}>En curso</Pastilla>}
        </div>
        <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
          {rango(ed.inicio, ed.fin)} · {ed.ciudad || (ed.evento.ciudad && !ed.evento.ciudad.includes(',') ? ed.evento.ciudad : 'sede itinerante')}{ed.sede ? ` · ${ed.sede}` : ''}{ed.estado_fecha === 'estimada' ? ' · fecha estimada' : ''}{ed.inicio <= hoy ? '' : ` · ${relativo(ed.inicio)}`}
        </div>
        {isMobile && <div style={{ marginTop: 6, display: 'flex', gap: 6 }}><Pastilla tono={tono}>{tono.l}</Pastilla><Fit v={ed.evento.fit_puntaje} /></div>}
      </div>
      {!isMobile && (
        <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
          <Pastilla tono={tono}>{tono.l}{ed.registros ? ` · ${ed.registros} registros` : ''}</Pastilla>
          <Fit v={ed.evento.fit_puntaje} />
        </div>
      )}
    </button>
  );
}
