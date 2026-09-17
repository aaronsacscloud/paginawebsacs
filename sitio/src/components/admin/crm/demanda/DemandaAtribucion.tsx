// MOTOR DE DEMANDA · ¿qué de esto trae clientes?
//
// Es la pantalla que justifica el motor entero. Todo lo demás cuenta lo que el
// motor HACE —páginas, menciones, herramientas—; esta cuenta lo que el motor
// CONSIGUE. Sin ella, el sistema optimiza lo que sabe medir en vez de lo que
// importa, que es la forma elegante de trabajar mucho para nada.
//
// La decisión de diseño que manda sobre todas: **la cobertura va arriba, antes
// que cualquier cifra**. Hoy solo el 4% de los contactos trae rastro web,
// porque la mayoría de los leads del CRM llegan por WhatsApp, por el ABM y por
// los formularios de TikTok — esa gente nunca tuvo una cookie nuestra. Enseñar
// «0 clientes atribuidos» sin decir sobre cuántos se puede opinar es inventar
// un fracaso, y a un dueño que lee eso hay que darle tres meses para que vuelva
// a creer en el número.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Pastilla, Seccion, Tarjeta, haceRato } from './ui';

const TONO_TIPO: Record<string, { fondo: string; tinta: string }> = {
  herramienta: { fondo: P.violetaAgua, tinta: P.violetaHondo },
  pagina:      { fondo: P.azulAgua,    tinta: P.azulTinta },
};

const pesos = (n: number) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export default function DemandaAtribucion() {
  const isMobile = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/crm/demanda/demanda?vista=atribucion')
      .then(r => r.json()).then(setD).catch(() => {}).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  if (!d?.ok) return <div style={WRAP}><Tarjeta franja={P.rojo}>No se pudo leer. {d?.error}</Tarjeta></div>;

  const c = d.cobertura || {};
  const activos = d.activos || [];
  const toques = d.toques || [];
  const leads = activos.reduce((s: number, a: any) => s + Number(a.leads || 0), 0);
  const clientes = activos.reduce((s: number, a: any) => s + Number(a.clientes || 0), 0);
  const arr = activos.reduce((s: number, a: any) => s + Number(a.arr || 0), 0);

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, color: P.tinta }}>¿Qué de esto trae clientes?</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, color: P.suave, maxWidth: '62ch', lineHeight: 1.55 }}>
        El recorrido completo: alguien toca una página o una herramienta del motor, vuelve, deja
        sus datos, y acaba pagando. Se atribuye al <strong>primer</strong> activo que tocó.
      </p>

      {/* La cobertura va PRIMERO. Sin este marco, las cifras de abajo se leen mal. */}
      <Tarjeta franja={P.ambar} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: P.ambarTinta, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Sobre cuántos se puede opinar
        </div>
        <div style={{ fontSize: 13.5, color: P.texto, lineHeight: 1.6, maxWidth: '68ch' }}>
          De <strong>{c.contactos ?? 0}</strong> contactos, solo <strong>{c.con_rastro_web ?? 0}</strong>
          {' '}({c.pct_con_rastro ?? 0}%) traen rastro de navegación. El resto llegó por WhatsApp, por
          el ABM o por los formularios de TikTok, y esa gente nunca tuvo una cookie nuestra: su
          ausencia de esta pantalla <strong>no es un fallo del motor</strong>, es cómo llega hoy la
          gente. Este número sube solo conforme el motor traiga más tráfico propio.
        </div>
      </Tarjeta>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)' }}>
        <Kpi franja={P.violeta} titulo="Visitantes tocados" valor={c.visitantes_tocados ?? 0}
             pie="vieron algo del motor" />
        <Kpi franja={P.azul} titulo="Se volvieron contacto" valor={c.con_toque_del_motor ?? 0}
             pie={leads ? `${leads} atribuidos` : 'ninguno todavía'} />
        <Kpi franja={P.verde} titulo="Clientes" valor={clientes} pie="que pagan hoy" />
        <Kpi franja={P.verde} titulo="ARR atribuido" valor={pesos(arr)} pie="al primer toque" />
      </div>

      <Seccion titulo="Qué se está tocando"
        aparte={<span style={{ fontSize: 12.5, color: P.suave }}>{toques.length} activos con al menos un toque</span>}>
        {!toques.length ? (
          <Tarjeta><div style={{ fontSize: 13.5, color: P.suave }}>
            Nadie ha tocado todavía una página ni una herramienta del motor. Es lo esperable
            mientras el contenido es nuevo: primero tiene que encontrarlo alguien.
          </div></Tarjeta>
        ) : (
          <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 460 }}>
                <thead>
                  <tr style={{ background: P.lineaSuave }}>
                    <th style={{ ...th, textAlign: 'left' }}>Activo</th>
                    <th style={th}>Toques</th>
                    <th style={th}>Leads</th>
                    <th style={th}>Clientes</th>
                    <th style={th}>ARR</th>
                  </tr>
                </thead>
                <tbody>
                  {toques.map((t: any) => {
                    // El cruce se hace aquí y no en SQL a propósito: un activo
                    // puede tener toques y CERO leads —es el caso normal al
                    // principio— y un `join` lo dejaría fuera de la tabla. Que
                    // se vea con sus ceros es justamente el dato.
                    const a = activos.find((x: any) => x.tipo === t.tipo && x.activo === t.activo);
                    return (
                      <tr key={`${t.tipo}|${t.activo}`} style={{ borderTop: `1px solid ${P.lineaSuave}` }}>
                        <td style={{ ...td, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Pastilla tono={TONO_TIPO[t.tipo] || TONO_TIPO.pagina}>
                              {t.tipo === 'herramienta' ? 'herramienta' : 'página'}
                            </Pastilla>
                            <span style={{ fontWeight: 600, color: P.tinta }}>{t.activo}</span>
                          </div>
                        </td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{t.toques}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{a?.leads ?? 0}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: a?.clientes ? 700 : 400, color: a?.clientes ? P.verdeTinta : P.suave }}>
                          {a?.clientes ?? 0}
                        </td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{a?.arr ? pesos(a.arr) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Los recorridos"
        aparte={<span style={{ fontSize: 12.5, color: P.suave }}>quién tocó qué antes de dejar sus datos</span>}>
        {!(d.recorridos || []).length ? (
          <Tarjeta><div style={{ fontSize: 13.5, color: P.suave, lineHeight: 1.6 }}>
            Todavía ninguna persona que tocó el motor ha dejado sus datos. Cuando pase, aquí se va
            a ver qué la trajo, qué la convenció y cuántos días tardó — que es lo que dice si vale
            la pena escribir más de eso.
          </div></Tarjeta>
        ) : (
          <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 560 }}>
                <thead>
                  <tr style={{ background: P.lineaSuave }}>
                    <th style={{ ...th, textAlign: 'left' }}>Lo trajo</th>
                    <th style={{ ...th, textAlign: 'left' }}>Lo convenció</th>
                    <th style={th}>Toques</th>
                    <th style={th}>Días</th>
                    <th style={th}>Se dio de alta</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.recorridos || []).map((r: any) => (
                    <tr key={r.contact_id} style={{ borderTop: `1px solid ${P.lineaSuave}` }}>
                      <td style={{ ...td, textAlign: 'left' }}>{r.primer_activo}</td>
                      <td style={{ ...td, textAlign: 'left', color: r.ultimo_activo === r.primer_activo ? P.suave : P.tinta }}>
                        {r.ultimo_activo === r.primer_activo ? 'el mismo' : r.ultimo_activo}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.toques}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {r.dias_hasta_contacto != null ? Math.round(r.dias_hasta_contacto) : '—'}
                      </td>
                      <td style={{ ...td, color: P.suave }}>{haceRato(r.contacto_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        )}
      </Seccion>

      <p style={{ marginTop: 22, fontSize: 12.5, color: P.tenue, lineHeight: 1.6, maxWidth: '70ch' }}>
        Solo cuentan los toques <strong>anteriores</strong> al alta del contacto. Lo que alguien
        navegó después de ser cliente no lo trajo, y contarlo sería atribuirle al motor gente que
        ya estaba dentro — que es la manera más fácil de que estos números mientan a favor.
      </p>
    </div>
  );
}

const th: any = { padding: '9px 12px', fontSize: 11.5, textAlign: 'right', color: P.suave, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' };
const td: any = { padding: '10px 12px', textAlign: 'right', color: P.texto, whiteSpace: 'nowrap' };
