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
  const [pagina, setPagina] = useState(0);
  const [giro, setGiro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => { fetch('/api/crm/abm/resumen').then(r => r.json()).then(setResumen).catch(() => {}); }, []);

  const traer = () => {
    setCargando(true);
    const p = new URLSearchParams({ orden: 'puntaje', pagina: String(pagina) });
    if (giro) p.set('giro', giro);
    fetch(`/api/crm/abm/cuentas?${p}`).then(r => r.json()).then(r => {
      setCuentas(r.cuentas || []); setTotal(r.total || 0); setCargando(false);
    }).catch(() => setCargando(false));
  };
  useEffect(traer, [giro, pagina]);

  const canalesDe = (row: any) => {
    const c = row.canales || [];
    const mail = c.find((x: any) => x.tipo.startsWith('email'));
    const wa = c.find((x: any) => x.tipo.startsWith('whatsapp'));
    return { mail, wa, n: c.length };
  };

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
          {r.plataforma_web && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{r.plataforma_web}</Pastilla>}
          {(r.sitio_http === 0 || Number(r.sitio_http) >= 400) && <Pastilla tono={{ bg: P.rojoAgua, fg: P.rojoTinta }}>sitio caído</Pastilla>}
          {r.sitio_carrito === false && <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }}>sin tienda en línea</Pastilla>}
          {!r.plataforma_web && r.sitio_http !== 0 && !r.sitio && <span style={{ color: '#bbb' }}>sin sitio</span>}
        </div>
      ),
    },
    {
      key: 'contacto', label: 'Por dónde entrarle', width: 240, val: (r) => canalesDe(r).n,
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

  const kpi = (etiqueta: string, valor: any, pie: string, color: string, tinta: string) => (
    <div style={tarjetaKpi(color)}>
      <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>{etiqueta}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tinta, lineHeight: 1.15 }}>{valor}</div>
      <div style={{ fontSize: '.6875rem', color: '#888' }}>{pie}</div>
    </div>
  );

  return (
    <div style={WRAP}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>Cuentas objetivo</h1>
      <p style={{ fontSize: '.875rem', color: '#666', margin: '0 0 18px', maxWidth: '68ch' }}>
        Negocios de moda mexicanos investigados uno por uno: qué venden, cuántas tiendas tienen, con qué operan hoy
        y por dónde se les puede entrar. Ordenados por lo único que importa a la hora de escribir — qué tanto encajan,
        qué tanto les duele y qué tan fácil es alcanzarlos.
      </p>

      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
          {kpi('Cuentas', fmt(resumen.total), 'negocios verificados', P.violeta, P.violetaTinta)}
          {kpi('Calientes', fmt(resumen.calientes), 'puntaje de 60 o más', P.violeta, P.violetaTinta)}
          {kpi('Van a diagnóstico', fmt(resumen.diagnostico), 'cinco o más sucursales', P.azul, P.azulTinta)}
          {kpi('Con correo', fmt(resumen.con_email), `y ${fmt(resumen.con_wa)} con WhatsApp`, P.verde, P.verdeTinta)}
          {kpi('Sin ninguna vía', fmt(resumen.sin_canal), 'hay que buscarles contacto', P.rojo, P.rojoTinta)}
        </div>
      )}

      {/* Los giros, que es como se piensa este mercado */}
      {resumen?.porGiro && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          <BotonGiro activo={!giro} onClick={() => { setGiro(''); setPagina(0); }} etiqueta="Todos" n={resumen.total} />
          {Object.entries(resumen.porGiro)
            .sort((a: any, b: any) => b[1].n - a[1].n)
            .map(([g, v]: any) => (
              <BotonGiro key={g} activo={giro === g} onClick={() => { setGiro(g); setPagina(0); }} etiqueta={GIROS[g] || g} n={v.n} pts={v.puntaje} />
            ))}
        </div>
      )}

      {cargando && !cuentas.length ? (
        <Cargando texto="Cargando las cuentas…" />
      ) : (
        <>
          <TablaEnterprise
            tabla="abm_cuentas"
            data={cuentas}
            cols={cols}
            vistasBase={vistas}
            headerTint
            searchPlaceholder="Buscar por nombre, ciudad o contexto…"
            searchText={(r) => `${r.nombre} ${r.ciudad || ''} ${r.contexto || ''} ${r.nota || ''} ${GIROS[r.giro] || r.giro}`}
            onRowClick={(r) => setAbierta(r.id)}
            minWidth={1240}
            emptyMsg="Ninguna cuenta con esos filtros."
            mobileCard={(r) => (
              <div style={{ display: 'grid', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9375rem' }}>{r.nombre}</div>
                  <Puntaje v={r.puntaje || 0} ancho={40} />
                </div>
                <div style={{ fontSize: '.75rem', color: '#888' }}>{GIROS[r.giro] || r.giro} · {r.ciudad || 'México'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.sucursales ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{r.sucursales} tiendas</Pastilla> : null}
                  {r.google_rating ? <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>{Number(r.google_rating).toFixed(1)} ★</Pastilla> : null}
                  {r.plataforma_web ? <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{r.plataforma_web}</Pastilla> : null}
                  <Pastilla tono={ETAPA_TONO[r.etapa] || ETAPA_TONO.sin_tocar}>{(ETAPA_TONO[r.etapa] || ETAPA_TONO.sin_tocar).l}</Pastilla>
                </div>
              </div>
            )}
          />
          {total > cuentas.length && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', margin: '16px 0 30px' }}>
              <button disabled={pagina === 0} onClick={() => setPagina(p => Math.max(0, p - 1))}
                style={btnPag(pagina === 0)}>Anteriores</button>
              <span style={{ fontSize: '.8125rem', color: '#777' }}>
                {pagina * 60 + 1}–{Math.min(total, (pagina + 1) * 60)} de {fmt(total)}
              </span>
              <button disabled={(pagina + 1) * 60 >= total} onClick={() => setPagina(p => p + 1)}
                style={btnPag((pagina + 1) * 60 >= total)}>Siguientes</button>
            </div>
          )}
        </>
      )}

      <Sheet open={!!abierta} onClose={() => setAbierta(null)} title="Cuenta objetivo" width={860}>
        {abierta && <Ficha360 id={abierta} onCerrar={() => setAbierta(null)} onCambio={traer} />}
      </Sheet>
    </div>
  );
}

const btnPag = (off: boolean) => ({
  font: 'inherit', fontSize: '.8125rem', fontWeight: 600, padding: '7px 14px', borderRadius: 9,
  border: `1.5px solid ${off ? '#e6e4ee' : P.violeta}`, background: '#fff', color: off ? '#bbb' : P.violetaTinta,
  cursor: off ? 'default' : 'pointer',
});

function BotonGiro({ activo, onClick, etiqueta, n, pts }: { activo: boolean; onClick: () => void; etiqueta: string; n: number; pts?: number }) {
  return (
    <button onClick={onClick} title={pts ? `Puntaje promedio del giro: ${pts}` : undefined}
      style={{
        font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
        border: activo ? `1.5px solid ${P.violeta}` : '1px solid #e6e4ee',
        background: activo ? P.violeta : '#fff', color: activo ? '#fff' : '#666',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
      {etiqueta}
      <span style={{ fontSize: '.6875rem', opacity: activo ? .85 : .55, fontWeight: 700 }}>{n}</span>
    </button>
  );
}
