// MOTOR DE DEMANDA · Oportunidades.
//
// El backlog: qué podemos HACER con lo que el motor encontró, ordenado por lo
// que más mueve la aguja.
//
// Dos decisiones de diseño que valen más que la tabla:
//   · el puntaje se abre y enseña sus ocho factores. Un número sin desglose se
//     obedece o se ignora, pero no se discute — y discutirlo es justo lo que
//     hace que los pesos mejoren;
//   · cada oportunidad trae su evidencia (cuántas veces se pidió, de qué área,
//     a qué tipo de negocio), porque aprobar a ciegas no es aprobar.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Pastilla, Seccion, Tarjeta, btn } from './ui';

const ETIQUETA_TIPO: Record<string, string> = {
  SEO_CONTENT: 'Página que lo explique',
  LANDING_PAGE: 'Página comercial',
  COMPARISON: 'Comparativa',
  PROGRAMMATIC_PAGE: 'Página en serie',
  CONTENT_REFRESH: 'Actualizar lo que ya está',
  FREE_TOOL: 'Herramienta gratis',
  CALCULATOR: 'Calculadora',
  MCP: 'Que la IA lo ejecute',
  DATASET: 'Dato propio del ramo',
  REPORT: 'Reporte',
  API: 'API',
  PRODUCT_FEATURE: 'Función del producto',
  WHOLESALE_NETWORK: 'Red de mayoreo',
  DIGITAL_PR: 'Prensa y menciones',
};

const TONO_TIPO = (t: string) =>
  t === 'PRODUCT_FEATURE' ? { fondo: P.ambarAgua, tinta: P.ambarTinta }
  : t.includes('TOOL') || t === 'CALCULATOR' || t === 'MCP' || t === 'API' ? { fondo: P.verdeAgua, tinta: P.verdeTinta }
  : t === 'DATASET' || t === 'WHOLESALE_NETWORK' ? { fondo: P.rosaAgua, tinta: P.rosaTinta }
  : { fondo: P.violetaAgua, tinta: P.violetaHondo };

const FACTOR: Record<string, string> = {
  demanda: 'Cuánto se pide', relevancia: 'Es de lo nuestro', intencion: 'Intención de compra',
  conversion: 'Probabilidad de cliente', capacidad: 'Podemos ganarlo', distribucion: 'Se puede distribuir',
  ventaja: 'Ventaja propia', eficiencia: 'Barato de hacer',
};

export default function DemandaOportunidades() {
  const isMobile = useIsMobile();
  const [ops, setOps] = useState<any[]>([]);
  const [res, setRes] = useState<any>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/demanda/demanda?vista=oportunidades&limite=200').then(r => r.json()),
      fetch('/api/crm/demanda/demanda?vista=resumen').then(r => r.json()),
    ]).then(([a, b]) => { setOps(a.oportunidades || []); setRes(b); }).catch(() => {}).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  const c = res?.conteos || {};
  const porTipo: Record<string, number> = {};
  for (const o of ops) porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1;

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>Oportunidades</h2>
      <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5, maxWidth: '64ch' }}>
        Qué podemos hacer con la demanda encontrada, ordenado por impacto esperado. Abre una para ver
        de dónde sale su puntaje.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 16 }}>
        <Kpi franja={P.violeta} titulo="En el backlog" valor={ops.length} pie="sin revisar" />
        <Kpi franja={P.verde} titulo="Herramientas" valor={(porTipo.FREE_TOOL || 0) + (porTipo.CALCULATOR || 0) + (porTipo.MCP || 0)} pie="se resuelven gratis" />
        <Kpi franja={P.azul} titulo="Contenido" valor={(porTipo.SEO_CONTENT || 0) + (porTipo.LANDING_PAGE || 0)} pie="páginas por escribir" />
        <Kpi franja={P.ambar} titulo="Producto" valor={porTipo.PRODUCT_FEATURE || 0} pie="va al roadmap, no a marketing" />
      </div>

      {ops.length === 0 ? (
        <Seccion titulo="Todavía nada">
          <Tarjeta franja={P.ambar}>
            <div style={{ fontSize: 13.5, color: P.texto }}>
              El motor tiene {c.problemas || 0} problemas detectados
              {c.sin_evaluar ? `, ${c.sin_evaluar} de ellos sin evaluar` : ''}. Las oportunidades aparecen
              cuando el ciclo los puntúa. Puedes lanzarlo a mano desde <strong>Sistema → Correr un ciclo</strong>.
            </div>
          </Tarjeta>
        </Seccion>
      ) : (
        <Seccion titulo={`Las ${ops.length} del backlog`}>
          <div style={{ display: 'grid', gap: 10 }}>
            {ops.map(o => {
              const abierto = abierta === o.id;
              return (
                <Tarjeta key={o.id} franja={TONO_TIPO(o.tipo).tinta} style={{ padding: '13px 16px' }}>
                  <div onClick={() => setAbierta(abierto ? null : o.id)} style={{ cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                        <Pastilla tono={TONO_TIPO(o.tipo)}>{ETIQUETA_TIPO[o.tipo] || o.tipo}</Pastilla>
                        {o.esfuerzo ? <span style={{ fontSize: 11.5, color: P.tenue }}>esfuerzo {o.esfuerzo}</span> : null}
                        {o.evidencia?.senales ? <span style={{ fontSize: 11.5, color: P.tenue }}>· visto {o.evidencia.senales} {o.evidencia.senales === 1 ? 'vez' : 'veces'}</span> : null}
                      </div>
                      <div style={{ fontWeight: 700, color: P.tinta, fontSize: 15 }}>{o.titulo}</div>
                      <div style={{ color: P.texto, fontSize: 13, marginTop: 3 }}>{o.accion_recomendada}</div>
                      {o.descripcion ? <div style={{ color: P.suave, fontSize: 12.5, marginTop: 3 }}>{o.descripcion}</div> : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: o.score >= 65 ? P.verdeTinta : o.score >= 45 ? P.ambarTinta : P.suave, fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(o.score ?? 0)}
                      </div>
                      <div style={{ fontSize: 11, color: P.gris }}>{abierto ? 'ocultar' : 'ver el puntaje'}</div>
                    </div>
                  </div>

                  {abierto ? (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.linea}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,190px), 1fr))', gap: 10 }}>
                        {Object.entries(o.desglose || {}).map(([k, v]: any) => (
                          <div key={k}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                              <span style={{ color: P.suave }}>{FACTOR[k] || k}</span>
                              <strong style={{ color: P.tinta, fontVariantNumeric: 'tabular-nums' }}>{Math.round(Number(v))}</strong>
                            </div>
                            <div style={{ height: 5, background: P.lineaSuave, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(0, Math.min(100, Number(v)))}%`, height: '100%', background: P.violeta }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {o.evidencia ? (
                        <div style={{ marginTop: 10, fontSize: 12.5, color: P.suave }}>
                          Evidencia: {o.evidencia.senales || 0} señales · {o.evidencia.formas_de_preguntarlo || 0} formas de preguntarlo
                          {o.evidencia.categoria ? ` · área ${o.evidencia.categoria}` : ''}
                          {o.evidencia.naturaleza ? ` · dato ${o.evidencia.naturaleza}` : ''}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Tarjeta>
              );
            })}
          </div>
        </Seccion>
      )}
    </div>
  );
}
