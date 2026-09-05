// CUENTAS OBJETIVO · el motor Account-Based del CRM.
//
// 810 negocios de moda mexicanos investigados en frío. Esta pantalla existe
// para responder una sola pregunta cada mañana: a quién le escribo hoy y por
// qué. Por eso ordena por puntaje —encaje + dolor + accesibilidad— y no por
// nombre, y por eso cada fila dice por dónde entrarle.
//
// Misma gramática visual que el resto del CRM: paleta de lib/crm/paleta,
// tarjetas con franja, TablaEnterprise para la lista, Sheet para la ficha.
import { useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import TablaEnterprise, { type ColDef, type VistaDef } from '../TablaEnterprise';
import Sheet from '../ui/Sheet';
import Cargando from '../ui/Cargando';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Ficha360 from './Ficha360';
import ColaTelefono from './ColaTelefono';
import { ETAPA_TONO, Pastilla, Puntaje, fmt, enlaceDe } from './ui';

const GIROS: Record<string, string> = {
  cadenas: 'Cadenas de moda', boutiques: 'Boutiques', renta: 'Renta de vestidos y trajes', novias: 'Novias',
  zapaterias: 'Zapaterías', western: 'Botas western', vintage: 'Vintage y segunda mano', joyeria: 'Joyería',
  charro: 'Charro y danza', scrubs: 'Uniformes médicos', telas: 'Telas y mercería',
  tallas: 'Tallas extra, maternidad y bebé', operadores: 'Operadores y concept stores',
  aliados: 'Consultoras y escuelas', canal: 'Canal mayorista',
};

export default function AbmTab() {
  const isMobile = useIsMobile();
  const [resumen, setResumen] = useState<any>(null);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [truncado, setTruncado] = useState(false);
  // Una vez que la lista no cupo, la caja se queda: si desapareciera al bajar
  // el total, se desmontaría a media escritura y dejaría filtrado sin salida.
  const [modoServidor, setModoServidor] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<null | 'calientes' | 'diagnostico' | 'correo' | 'sinvia'>(null);
  const [giro, setGiro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [vista, setVista] = useState<'lista' | 'llamadas'>('lista');

  useEffect(() => { fetch('/api/crm/abm/resumen').then(r => r.json()).then(setResumen).catch(() => {}); }, []);

  // Desde la llamada se puede abrir la ficha: si preguntan "¿quién habla?", el
  // vendedor necesita las fuentes y la bitácora, no solo el guion.
  useEffect(() => {
    const abrir = (e: any) => { if (e?.detail?.id) setAbierta(e.detail.id); };
    window.addEventListener('crm:abm-ficha', abrir as any);
    return () => window.removeEventListener('crm:abm-ficha', abrir as any);
  }, []);

  const traer = () => {
    setCargando(true);
    const p = new URLSearchParams({ orden: 'puntaje', todo: '1' });
    if (giro) p.set('giro', giro);
    if (busca.trim()) p.set('q', busca.trim());
    fetch(`/api/crm/abm/cuentas?${p}`).then(r => r.json()).then(r => {
      setCuentas(r.cuentas || []); setTotal(r.total || 0); setTruncado(!!r.truncado); if (r.truncado) setModoServidor(true); setCargando(false);
    }).catch(() => setCargando(false));
  };
  useEffect(traer, [giro]);

  // Si la lista vino truncada, el buscador de la tabla mentiría (buscaría solo
  // en lo que alcanzó a llegar). En ese caso se busca en el servidor.
  useEffect(() => {
    if (!truncado && !busca) return;
    const t = setTimeout(traer, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const canalesDe = (row: any) => {
    const c = row.canales || [];
    const mail = c.find((x: any) => x.tipo.startsWith('email'));
    const wa = c.find((x: any) => x.tipo.startsWith('whatsapp'));
    return { mail, wa, n: c.length };
  };

  const cuentasFiltradas = filtro ? cuentas.filter(r =>
    filtro === 'calientes' ? (r.puntaje || 0) >= 60
    : filtro === 'diagnostico' ? r.ruta === 'diagnostico'
    : filtro === 'correo' ? r.tiene_email
    : !r.canales_n) : cuentas;

  const cols: ColDef[] = useMemo(() => [
    {
      key: 'nombre', label: 'Cuenta', fija: true, width: 300, val: (r) => r.nombre,
      render: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.875rem', color: '#222', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
            {r.ya_es_cliente && <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }} titulo={`Ya está en el CRM como ${r.ya_es_cliente}`}>cliente</Pastilla>}
          </div>
          <div style={{ fontSize: '.6875rem', color: '#8a8a8a', marginTop: 2 }}>
            {GIROS[r.giro] || r.giro} · {r.ciudad || 'México'}
          </div>
        </div>
      ),
    },
    {
      key: 'puntaje', label: 'Puntaje', num: true, width: 130, val: (r) => r.puntaje || 0,
      render: (r) => <Puntaje v={r.puntaje || 0} />,
    },
    {
      key: 'sucursales', label: 'Tiendas', num: true, width: 95, ftype: 'number', val: (r) => r.sucursales || 0,
      render: (r) => r.sucursales
        ? <span style={{ fontWeight: 700, color: r.sucursales >= 5 ? P.azulTinta : '#444' }}>{r.sucursales}</span>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      key: 'google_rating', label: 'Google', num: true, width: 100, val: (r) => Number(r.google_rating || 0),
      render: (r) => r.google_rating
        ? <span><b style={{ color: P.verdeTinta }}>{Number(r.google_rating).toFixed(1)}</b>{r.google_resenas ? <span style={{ color: '#aaa', fontSize: '.6875rem' }}> · {fmt(r.google_resenas)}</span> : null}</span>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      key: 'tecnologia', label: 'Su sistema hoy', width: 165, val: (r) => r.plataforma_web || '',
      render: (r) => (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {r.plataforma_web && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }} titulo={r.plataforma_web} max={150}>{r.plataforma_web}</Pastilla>}
          {(r.sitio_http === 0 || Number(r.sitio_http) >= 400) && <Pastilla tono={{ bg: P.rojoAgua, fg: P.rojoTinta }}>sitio caído</Pastilla>}
          {r.sitio_carrito === false && <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }}>sin tienda en línea</Pastilla>}
          {!r.plataforma_web && r.sitio_http !== 0 && !r.sitio && <span style={{ color: '#bbb' }}>sin sitio</span>}
        </div>
      ),
    },
    {
      key: 'contacto', label: 'Por dónde entrarle', width: 240, ftype: 'number', val: (r) => canalesDe(r).n,
      render: (r) => {
        const { mail, wa, n } = canalesDe(r);
        if (!n) return <span style={{ fontSize: '.75rem', color: P.rojoTinta }}>sin vía verificada</span>;
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {mail && <a href={enlaceDe(mail.tipo, mail.valor) || '#'} onClick={e => e.stopPropagation()} style={{ fontSize: '.75rem', fontWeight: 600, color: P.violetaTinta, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{mail.valor}</a>}
            {wa && <a href={enlaceDe(wa.tipo, wa.valor) || '#'} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}><Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>WhatsApp</Pastilla></a>}
            {!mail && !wa && <span style={{ fontSize: '.75rem', color: '#888' }}>{n} vías</span>}
          </div>
        );
      },
    },
    {
      key: 'ruta', label: 'Va a', width: 120, ftype: 'select',
      options: [{ v: 'demo', l: 'Demo' }, { v: 'diagnostico', l: 'Diagnóstico' }],
      val: (r) => r.ruta || 'demo',
      render: (r) => r.ruta === 'diagnostico'
        ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>diagnóstico</Pastilla>
        : <span style={{ fontSize: '.75rem', color: '#888' }}>demo</span>,
    },
    {
      key: 'accion', label: '', width: 92, sortable: false,
      render: (r) => {
        const { mail, wa } = canalesDe(r);
        const url = mail ? enlaceDe(mail.tipo, mail.valor) : wa ? enlaceDe(wa.tipo, wa.valor) : null;
        if (!url) return <span style={{ fontSize: '.6875rem', color: '#bbb' }}>—</span>;
        return (
          <a href={url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
            style={{ fontSize: '.6875rem', fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {mail ? 'Escribir' : 'WhatsApp'}
          </a>
        );
      },
    },
    {
      key: 'etapa', label: 'Etapa', width: 130, ftype: 'select',
      options: Object.entries(ETAPA_TONO).map(([v, t]) => ({ v, l: t.l })),
      val: (r) => r.etapa,
      render: (r) => <Pastilla tono={ETAPA_TONO[r.etapa] || ETAPA_TONO.sin_tocar}>{(ETAPA_TONO[r.etapa] || ETAPA_TONO.sin_tocar).l}</Pastilla>,
    },
  ], []);

  const vistas: VistaDef[] = useMemo(() => [
    { key: 'calientes', nombre: 'Las más calientes', fija: true, config: { sort: { key: 'puntaje', dir: -1 } } },
    { key: 'diagnostico', nombre: 'Van a diagnóstico', fija: true, config: { conds: [{ campo: 'ruta', op: 'es', v1: 'diagnostico' }], sort: { key: 'puntaje', dir: -1 } } },
    { key: 'contactables', nombre: 'Con vía de contacto', fija: true, config: { conds: [{ campo: 'contacto', op: 'mayor', v1: '0' }], sort: { key: 'puntaje', dir: -1 } } },
    { key: 'sintocar', nombre: 'Sin tocar', fija: true, config: { conds: [{ campo: 'etapa', op: 'es', v1: 'sin_tocar' }], sort: { key: 'puntaje', dir: -1 } } },
  ], []);

  const AGUA: Record<string, string> = { [P.violeta]: P.violetaAgua, [P.azul]: P.azulAgua, [P.verde]: P.verdeAgua, [P.rojo]: P.rojoAgua, [P.ambar]: P.ambarAgua };
  const kpi = (etiqueta: string, valor: any, pie: string, color: string, tinta: string, alTocar?: () => void, clave?: string) => (
    // Un filtro que no se ve es un filtro que la gente deja puesto y luego jura
    // que se perdieron cuentas: la tarjeta activa se marca y hay cómo salir.
    <div style={{ ...tarjetaKpi(color), ...(alTocar ? { cursor: 'pointer' } : {}),
      ...(clave && clave === filtro ? { background: AGUA[color] || P.violetaAgua, boxShadow: `0 0 0 2px ${color}` } : {}) }}
      onClick={alTocar} role={alTocar ? 'button' : undefined} tabIndex={alTocar ? 0 : undefined}
      onKeyDown={alTocar ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alTocar(); } } : undefined}
      title={alTocar ? 'Ver solo estas' : undefined}
      aria-pressed={alTocar ? clave === filtro : undefined}>
      <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>{etiqueta}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tinta, lineHeight: 1.15 }}>{valor}</div>
      <div style={{ fontSize: '.6875rem', color: '#888' }}>{pie}</div>
    </div>
  );

  return (
    <div style={WRAP}>
      {/* En móvil el encabezado se calla: la barra de la app ya dice "Cuentas
          objetivo", y con el título repetido, la prosa, cinco KPI apilados y
          quince chips, el primer negocio quedaba a 1,176 px de una pantalla de
          844 — vez y media de scroll antes de ver una sola cuenta. */}
      {!isMobile && (
        <>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>Cuentas objetivo</h1>
          <p style={{ fontSize: '.875rem', color: '#666', margin: '0 0 18px', maxWidth: '68ch' }}>
            Negocios de moda mexicanos investigados uno por uno: qué venden, cuántas tiendas tienen, con qué operan hoy
            y por dónde se les puede entrar. Ordenados por lo único que importa a la hora de escribir — qué tanto encajan,
            qué tanto les duele y qué tan fácil es alcanzarlos.
          </p>
        </>
      )}

      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: `1px solid ${P.linea}` }}>
        {([['lista', 'Las cuentas', resumen?.total], ['llamadas', 'Cola de teléfono', resumen ? resumen.total - resumen.con_email : null]] as const).map(([v, l, n]) => (
          <button key={v} onClick={() => setVista(v as any)} style={{
            font: 'inherit', fontSize: '.875rem', fontWeight: vista === v ? 800 : 500, padding: '9px 15px',
            border: 'none', borderBottom: vista === v ? `2px solid ${P.violeta}` : '2px solid transparent',
            background: vista === v ? P.violetaAgua : 'transparent', color: vista === v ? P.violetaTinta : '#666',
            borderRadius: '9px 9px 0 0', cursor: 'pointer',
          }}>
            {l}
            {n ? <span style={{ marginLeft: 7, fontSize: '.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: vista === v ? '#fff' : P.violetaAgua, color: P.violetaTinta }}>{fmt(n as number)}</span> : null}
          </button>
        ))}
      </div>

      {vista === 'llamadas' ? (
        <ColaTelefono onCambio={() => { fetch('/api/crm/abm/resumen').then(r => r.json()).then(setResumen).catch(() => {}); }} />
      ) : (<>

      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fit,minmax(160px,1fr))', gap: isMobile ? 8 : 12, marginBottom: 18 }}>
          {kpi('Cuentas', fmt(resumen.total), 'negocios verificados', P.violeta, P.violetaTinta, () => setFiltro(null))}
          {/* Ámbar, no morado: la franja dice de qué habla el número, y lo que
              urge no puede tener el mismo color que el total. */}
          {kpi('Calientes', fmt(resumen.calientes), 'puntaje de 60 o más', P.ambar, P.ambarTinta, () => setFiltro('calientes'), 'calientes')}
          {kpi('Van a diagnóstico', fmt(resumen.diagnostico), 'cinco o más sucursales', P.azul, P.azulTinta, () => setFiltro('diagnostico'), 'diagnostico')}
          {kpi('Con correo', fmt(resumen.con_email), `y ${fmt(resumen.con_wa)} con WhatsApp`, P.verde, P.verdeTinta, () => setFiltro('correo'), 'correo')}
          {kpi('Sin ninguna vía', fmt(resumen.sin_canal), 'hay que buscarles contacto', P.rojo, P.rojoTinta, () => setFiltro('sinvia'), 'sinvia')}
        </div>
      )}

      {filtro && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: '.8125rem', color: '#666' }}>
            Viendo solo {fmt(cuentasFiltradas.length)} {filtro === 'calientes' ? 'calientes' : filtro === 'diagnostico' ? 'que van a diagnóstico' : filtro === 'correo' ? 'con correo' : 'sin ninguna vía'}.
          </span>
          <button onClick={() => setFiltro(null)} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${P.violeta}`, background: '#fff', color: P.violetaTinta }}>
            Ver todas
          </button>
        </div>
      )}

      {/* Los giros, que es como se piensa este mercado */}
      {resumen?.porGiro && (
        <div style={{ display: 'flex', gap: 7, marginBottom: 16, ...(isMobile ? { overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 } : { flexWrap: 'wrap' }) }}>
          <BotonGiro activo={!giro} onClick={() => { setGiro(''); }} etiqueta="Todos" n={resumen.total} />
          {Object.entries(resumen.porGiro)
            .sort((a: any, b: any) => b[1].n - a[1].n)
            .map(([g, v]: any) => (
              <BotonGiro key={g} activo={giro === g} onClick={() => { setGiro(g); }} etiqueta={GIROS[g] || g} n={v.n} pts={v.puntaje} />
            ))}
        </div>
      )}

      {cargando && !cuentas.length ? (
        <Cargando texto="Cargando las cuentas…" />
      ) : (
        <>
          {(truncado || modoServidor) && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: P.ambarAgua, borderRadius: 9, padding: '10px 13px', marginBottom: 12 }}>
              <span style={{ fontSize: '.8125rem', color: P.ambarTinta, flex: 1, minWidth: 240 }}>
                Son {fmt(total)} cuentas y aquí caben {fmt(cuentas.length)}. Para no buscar solo en lo que se alcanzó a traer, escribe aquí y la búsqueda se hace sobre todas.
              </span>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Buscar en las ${fmt(total)}…`}
                style={{ font: 'inherit', fontSize: '.8125rem', padding: '7px 11px', borderRadius: 8, border: `1px solid ${P.ambar}`, minWidth: 220 }} />
            </div>
          )}
          <div style={{ opacity: cargando ? .5 : 1, transition: 'opacity .15s' }}>
          <TablaEnterprise
            tabla="abm_cuentas"
            data={cuentasFiltradas}
            cols={cols}
            vistasBase={vistas}
            headerTint
            searchPlaceholder="Buscar por nombre, ciudad o contexto…"
            searchText={(r) => `${r.nombre} ${r.ciudad || ''} ${r.contexto || ''} ${r.nota || ''} ${GIROS[r.giro] || r.giro}`}
            onRowClick={(r) => setAbierta(r.id)}
            minWidth={1120}
            emptyMsg="Ninguna cuenta con esos filtros."
            mobileCard={(r) => (
              <div style={{ display: 'grid', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9375rem' }}>{r.nombre}</div>
                  <Puntaje v={r.puntaje || 0} ancho={40} />
                </div>
                <div style={{ fontSize: '.75rem', color: '#888' }}>{GIROS[r.giro] || r.giro} · {r.ciudad || 'México'}</div>
                <div style={{ fontSize: '.75rem', color: canalesDe(r).mail ? P.violetaTinta : P.rojoTinta, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {canalesDe(r).mail ? canalesDe(r).mail.valor : canalesDe(r).wa ? 'Solo WhatsApp' : 'Sin vía verificada'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {canalesDe(r).wa ? <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>WhatsApp</Pastilla> : null}
                  {r.sucursales ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{r.sucursales} tiendas</Pastilla> : null}
                  {r.google_rating ? <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>{Number(r.google_rating).toFixed(1)} en Google</Pastilla> : null}
                  {r.plataforma_web ? <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }} titulo={r.plataforma_web} max={160}>{r.plataforma_web}</Pastilla> : null}
                  <Pastilla tono={ETAPA_TONO[r.etapa] || ETAPA_TONO.sin_tocar}>{(ETAPA_TONO[r.etapa] || ETAPA_TONO.sin_tocar).l}</Pastilla>
                </div>
              </div>
            )}
          />
          </div>
        </>
      )}

      </>)}

      {/* El nombre del negocio como título del panel: "Cuenta objetivo" era
          genérico y el nombre real se repetía sesenta píxeles abajo. */}
      <Sheet open={!!abierta} onClose={() => setAbierta(null)} width={860}
        title={cuentas.find(c => c.id === abierta)?.nombre || 'Cuenta objetivo'}>
        {abierta && <Ficha360 id={abierta} onCerrar={() => setAbierta(null)} onCambio={traer} />}
      </Sheet>
    </div>
  );
}

function BotonGiro({ activo, onClick, etiqueta, n, pts }: { activo: boolean; onClick: () => void; etiqueta: string; n: number; pts?: number }) {
  return (
    <button onClick={onClick} title={pts ? `Puntaje promedio del giro: ${pts}` : undefined}
      style={{
        font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
        border: activo ? `1.5px solid ${P.violeta}` : '1px solid #e6e4ee',
        background: activo ? P.violeta : '#fff', color: activo ? '#fff' : '#666',
        // Sin esto, en la tira deslizable de móvil los chips se aplastan hasta
        // volverse círculos con el texto partido en cuatro renglones.
        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
      }}>
      {etiqueta}
      <span style={{ fontSize: '.6875rem', opacity: activo ? .85 : .55, fontWeight: 700 }}>{n}</span>
    </button>
  );
}
