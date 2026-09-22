/* ARMAR LA LISTA DE HOY · los filtros de verdad.
 *
 * PEDIDO DEL DUEÑO (21-sep-2026): «al crear la llamada inteligente debes darme
 * más opciones de filtros: que pueda seleccionar un giro de las ABM y llamarle
 * a las que ya están verificadas que sí tienen WhatsApp, o las que tienen
 * teléfono sin WhatsApp, o ambas; que pueda seleccionar por sucursales, que de
 * forma general pueda decidir más de X sucursales; que pueda seleccionar uno o
 * varios giros, sea de ABM o de leads normales; que pueda excluir los que he
 * llamado más de X veces y nunca han contestado, y otros 10 filtros que
 * consideres importantes, para que pueda meter varios a la vez y sea muy
 * flexible y así mi lista funcione en orden».
 *
 * DE QUÉ TAMAÑO ES EL CAMBIO. Antes se elegía entre tres desplegables sobre el
 * inbox: bandeja, etapa y estado de la conversación. Eso alcanzaba mientras
 * llamar significara «marcarle a una conversación». Ahora el universo son
 * también las 29,770 cuentas del ABM, que no tienen conversación ninguna, y lo
 * que separa una lista buena de una mala no es la bandeja: es el giro, cuántas
 * tiendas tiene, si su WhatsApp está verificado y a cuántos ya les marqué sin
 * que contestaran.
 *
 * CÓMO SE ORDENÓ LA PANTALLA, que es la mitad del pedido («que sea fácil de
 * entender»): tres bloques en el orden en que se piensa una lista.
 *   1. A QUIÉN     — de dónde salen y por dónde se les puede hablar.
 *   2. CÓMO SON    — giro, tamaño, dónde están, qué tan buenos se ven.
 *   3. A QUIÉN NO  — todo lo que se quita, junto y en un solo sitio.
 * Los filtros que no aplican a la fuente elegida no se desactivan: DESAPARECEN.
 * Un campo gris que no hace nada se intenta usar igual.
 *
 * Y el número grande de la derecha es el número REAL —sale de preguntar con el
 * filtro puesto, no de estimar—, con los primeros nombres debajo. Ver a quién
 * vas a llamar antes de que suene el primer timbre es lo que evita descubrir a
 * media jornada que la lista no era la que creías.
 */
import { useEffect, useMemo, useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import { useIsMobile } from '../../../lib/ui/mobile';

type Cat = { giros_abm: { giro: string; n: number; con_wa: number }[]; giros_crm: { giro: string; n: number }[]; estados: { estado: string; n: number }[] };

export type Filtros = {
  fuente: 'crm' | 'abm' | 'ambas';
  canal: '' | 'wa_verificado' | 'wa' | 'solo_tel';
  giros: string[];
  etapas: string[];
  suc_min: string; suc_max: string;
  estado_geo: string[]; ciudad: string;
  rating_min: string; resenas_min: string; puntaje_min: string;
  quemados: string; sin_tocar_dias: string;
  nunca_llamados: boolean; excluir_clientes: boolean;
  excluir_en_cadencia: boolean; excluir_con_reunion: boolean;
  excluir_con_accion: boolean;
  owner: '' | 'mias' | 'sin_asignar';
  orden: 'puntaje' | 'sucursales' | 'rating';
};

export const FILTROS_INICIALES: Filtros = {
  fuente: 'crm', canal: '', giros: [], etapas: [],
  suc_min: '', suc_max: '', estado_geo: [], ciudad: '',
  rating_min: '', resenas_min: '', puntaje_min: '',
  /* Los tres que vienen puestos de fábrica son los que casi siempre se quieren
     y casi nunca se acuerda uno de marcar: no volver a marcarle a quien ya
     ignoró tres llamadas, no llamarle a un cliente y no llamarle a alguien con
     quien ya tienes cita. Se pueden quitar, pero de entrada protegen. */
  quemados: '3', sin_tocar_dias: '',
  nunca_llamados: false, excluir_clientes: true,
  excluir_en_cadencia: false, excluir_con_reunion: true,
  /* 22-sep: los que ya tuvieron una acción (reunión, seguimiento, oportunidad,
     descalificado) no se vuelven a marcar. De fábrica, puesta. */
  excluir_con_accion: true,
  owner: '', orden: 'puntaje',
};

/** Los filtros → el query string que entiende `/api/crm/telefonia/candidatos`. */
export function qsDeFiltros(f: Filtros): string {
  const p = new URLSearchParams();
  p.set('fuente', f.fuente);
  if (f.canal) p.set('canal', f.canal);
  if (f.giros.length) p.set('giros', f.giros.join(','));
  if (f.etapas.length) p.set('etapa', f.etapas.join(','));
  if (f.suc_min) p.set('suc_min', f.suc_min);
  if (f.suc_max) p.set('suc_max', f.suc_max);
  if (f.estado_geo.length) p.set('estado_geo', f.estado_geo.join(','));
  if (f.ciudad.trim()) p.set('ciudad', f.ciudad.trim());
  if (f.rating_min) p.set('rating_min', f.rating_min);
  if (f.resenas_min) p.set('resenas_min', f.resenas_min);
  if (f.puntaje_min) p.set('puntaje_min', f.puntaje_min);
  if (f.quemados) p.set('quemados', f.quemados);
  if (f.sin_tocar_dias) p.set('sin_tocar_dias', f.sin_tocar_dias);
  if (f.nunca_llamados) p.set('nunca_llamados', '1');
  if (f.excluir_clientes) p.set('excluir_clientes', '1');
  if (f.excluir_en_cadencia) p.set('excluir_en_cadencia', '1');
  if (f.excluir_con_reunion) p.set('excluir_con_reunion', '1');
  // Al revés que las demás: excluirlos es lo de siempre (también en el servidor); sólo se avisa cuando se QUIEREN incluir.
  if (!f.excluir_con_accion) p.set('incluir_con_accion', '1');
  if (f.owner) p.set('owner', f.owner);
  if (f.orden) p.set('orden', f.orden);
  return p.toString();
}

/** El nombre de la jornada, armado solo con lo que el usuario sí eligió. */
export function tituloDeFiltros(f: Filtros): string {
  const t: string[] = [];
  t.push(f.fuente === 'abm' ? 'Prospección' : f.fuente === 'ambas' ? 'CRM + prospección' : 'Mis leads');
  if (f.giros.length) t.push(f.giros.slice(0, 2).join(' y ') + (f.giros.length > 2 ? ` +${f.giros.length - 2}` : ''));
  if (f.canal === 'wa_verificado') t.push('WhatsApp verificado');
  else if (f.canal === 'wa') t.push('con WhatsApp');
  else if (f.canal === 'solo_tel') t.push('solo teléfono');
  if (f.suc_min) t.push(`${f.suc_min}+ tiendas`);
  if (f.estado_geo.length === 1) t.push(f.estado_geo[0]);
  return t.join(' · ');
}

const rot: any = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: 6 };
const sel: any = { width: '100%', border: '1px solid #e0dfe6', borderRadius: 10, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' };
const inp: any = { ...sel, cursor: 'text' };

function Bloque({ titulo, children }: { titulo: string; children: any }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span style={rot}>{titulo}</span>
      {children}
    </div>
  );
}

/** Botones que se quedan marcados. Para elegir de una lista corta y conocida. */
function Opciones({ valor, onCambio, opts }: { valor: string; onCambio: (v: any) => void; opts: { v: string; l: string; sub?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opts.map(o => {
        const on = valor === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onCambio(o.v)} title={o.sub}
            style={{
              fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9, padding: '7px 11px', fontSize: 12.5,
              fontWeight: on ? 800 : 600, border: `1px solid ${on ? P.violeta : '#e6e4ec'}`,
              background: on ? '#EEECFE' : '#fff', color: on ? P.violetaTinta : '#4B5563',
            }}>{o.l}</button>
        );
      })}
    </div>
  );
}

/** Varios a la vez, con su número al lado: «joyería (2,321)». */
function Chips({ valores, onCambio, opts, vacio }: { valores: string[]; onCambio: (v: string[]) => void; opts: { v: string; l: string; n?: number }[]; vacio: string }) {
  const [ver, setVer] = useState(false);
  const mostrar = ver ? opts : opts.slice(0, 12);
  if (!opts.length) return <p style={{ fontSize: 12, color: '#a5a2af', margin: 0 }}>{vacio}</p>;
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {mostrar.map(o => {
          const on = valores.includes(o.v);
          return (
            <button key={o.v} type="button"
              onClick={() => onCambio(on ? valores.filter(x => x !== o.v) : [...valores, o.v])}
              style={{
                fontFamily: 'inherit', cursor: 'pointer', borderRadius: 999, padding: '5px 11px', fontSize: 12,
                fontWeight: on ? 800 : 600, border: `1px solid ${on ? P.violeta : '#e6e4ec'}`,
                background: on ? '#EEECFE' : '#fff', color: on ? P.violetaTinta : '#4B5563',
              }}>
              {o.l}{o.n != null && <span style={{ fontWeight: 600, color: on ? P.violeta : '#a5a2af' }}> {o.n.toLocaleString('es-MX')}</span>}
            </button>
          );
        })}
      </div>
      {opts.length > 12 && (
        <button type="button" onClick={() => setVer(v => !v)}
          style={{ marginTop: 7, border: 'none', background: 'none', color: P.violetaTinta, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {ver ? 'Ver menos' : `Ver los ${opts.length}`}
        </button>
      )}
    </>
  );
}

function Palomita({ on, onCambio, texto, porque }: { on: boolean; onCambio: (v: boolean) => void; texto: string; porque?: string }) {
  return (
    <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 9 }}>
      <input type="checkbox" checked={on} onChange={e => onCambio(e.target.checked)} style={{ marginTop: 2, accentColor: P.violetaTinta, width: 15, height: 15, cursor: 'pointer' }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3a3a44' }}>{texto}</span>
        {porque && <span style={{ display: 'block', fontSize: 11, color: '#a5a2af', lineHeight: 1.45 }}>{porque}</span>}
      </span>
    </label>
  );
}

export default function ArmadorLista({ etapas, onListo, onCerrar }: {
  etapas: { id: string; label: string }[];
  onListo: (l: { titulo: string; qs: string }) => void;
  onCerrar: () => void;
}) {
  const esMovil = useIsMobile();
  const [f, setF] = useState<Filtros>(FILTROS_INICIALES);
  const [cat, setCat] = useState<Cat | null>(null);
  const [previa, setPrevia] = useState<{ filas: any[]; total: number; descartados: any } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF(x => ({ ...x, [k]: v }));
  const qs = useMemo(() => qsDeFiltros(f), [f]);
  const titulo = useMemo(() => tituloDeFiltros(f), [f]);
  const conAbm = f.fuente === 'abm' || f.fuente === 'ambas';
  const conCrm = f.fuente === 'crm' || f.fuente === 'ambas';

  useEffect(() => {
    fetch('/api/crm/telefonia/candidatos?catalogo=1', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j?.ok) setCat(j); }).catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true); setError('');
    const t = setTimeout(() => {
      fetch(`/api/crm/telefonia/candidatos?${qs}&limit=40`, { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (!vivo) return;
          if (!j?.ok) { setError(j?.error || 'No se pudo contar'); setPrevia({ filas: [], total: 0, descartados: {} }); return; }
          setPrevia({ filas: j.conversaciones || [], total: Number(j.total_filtrado || 0), descartados: j.descartados || {} });
        })
        .catch(e => { if (vivo) setError(String(e?.message || e)); })
        .finally(() => { if (vivo) setCargando(false); });
    }, 380);   // el debounce evita una consulta por cada tecla del campo de ciudad
    return () => { vivo = false; clearTimeout(t); };
  }, [qs]);

  const n = previa?.total ?? 0;
  const girosOpts = conAbm
    ? (cat?.giros_abm || []).map(g => ({ v: g.giro, l: g.giro, n: f.canal === 'wa' || f.canal === 'wa_verificado' ? g.con_wa : g.n }))
    : (cat?.giros_crm || []).map(g => ({ v: g.giro, l: g.giro.length > 26 ? g.giro.slice(0, 26) + '…' : g.giro, n: g.n }));

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(12,11,18,.5)', zIndex: 960 }} />
      <div role="dialog" aria-label="Nueva llamada inteligente" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: esMovil ? '100%' : 'min(1060px, 95vw)', height: esMovil ? '100%' : undefined, maxHeight: esMovil ? '100%' : '92vh',
        display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: esMovil ? 0 : 20,
        zIndex: 961, boxShadow: '0 24px 70px rgba(12,11,18,.34)', overflow: 'hidden',
      }}>
        <div style={{ padding: esMovil ? '14px 16px' : '18px 24px', borderBottom: '1px solid #f0eff3', display: 'flex', alignItems: 'center', gap: 10 }}>
          <b style={{ fontSize: esMovil ? 16 : 18, letterSpacing: '-0.02em', flex: 1 }}>Nueva llamada inteligente</b>
          <button onClick={() => setF(FILTROS_INICIALES)}
            style={{ border: 'none', background: 'none', color: '#6b7280', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Empezar de cero
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: esMovil ? 'column' : 'row' }}>
          {/* ── Los filtros ── */}
          <div style={{ flex: esMovil ? '1 1 auto' : '0 0 420px', padding: esMovil ? 16 : 22, borderRight: esMovil ? 'none' : '1px solid #f0eff3', overflowY: 'auto' }}>

            <Bloque titulo="1 · De dónde salen">
              <Opciones valor={f.fuente} onCambio={v => set('fuente', v)} opts={[
                { v: 'crm', l: 'Mis leads', sub: 'Los contactos del CRM' },
                { v: 'abm', l: 'Prospección en frío', sub: 'Las cuentas del ABM' },
                { v: 'ambas', l: 'Las dos' },
              ]} />
            </Bloque>

            <Bloque titulo="Por dónde se les puede hablar">
              <Opciones valor={f.canal} onCambio={v => set('canal', v)} opts={[
                { v: '', l: 'Como sea' },
                { v: 'wa_verificado', l: 'WhatsApp verificado', sub: 'Ya comprobamos que ese número recibe WhatsApp' },
                { v: 'wa', l: 'Tienen WhatsApp' },
                { v: 'solo_tel', l: 'Teléfono sin WhatsApp' },
              ]} />
              {f.canal === 'wa_verificado' && (
                <p style={{ fontSize: 11.5, color: '#6b7280', margin: '7px 0 0', lineHeight: 1.5 }}>
                  Si no contesta, el seguimiento le llega por WhatsApp al mismo número — no se pierde el intento.
                </p>
              )}
            </Bloque>

            <Bloque titulo={`2 · Giro${f.giros.length ? ` · ${f.giros.length} elegidos` : ''}`}>
              <Chips valores={f.giros} onCambio={v => set('giros', v)} opts={girosOpts}
                vacio={conAbm ? 'Cargando los giros…' : 'Tus contactos todavía no tienen giro capturado.'} />
            </Bloque>

            <Bloque titulo="Tamaño del negocio">
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1 }}>
                  <span style={{ fontSize: 11.5, color: '#6b7280', display: 'block', marginBottom: 4 }}>Desde</span>
                  <input type="number" min={0} placeholder="tiendas" value={f.suc_min} onChange={e => set('suc_min', e.target.value)} style={inp} />
                </label>
                <label style={{ flex: 1 }}>
                  <span style={{ fontSize: 11.5, color: '#6b7280', display: 'block', marginBottom: 4 }}>Hasta</span>
                  <input type="number" min={0} placeholder="sin tope" value={f.suc_max} onChange={e => set('suc_max', e.target.value)} style={inp} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                {[['3', 'Más de 3'], ['5', 'Más de 5'], ['10', 'Más de 10']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set('suc_min', f.suc_min === v ? '' : v)}
                    style={{ fontFamily: 'inherit', cursor: 'pointer', borderRadius: 999, padding: '4px 10px', fontSize: 11.5, fontWeight: f.suc_min === v ? 800 : 600, border: `1px solid ${f.suc_min === v ? P.violeta : '#e6e4ec'}`, background: f.suc_min === v ? '#EEECFE' : '#fff', color: f.suc_min === v ? P.violetaTinta : '#4B5563' }}>{l}</button>
                ))}
              </div>
            </Bloque>

            {conCrm && (
              <Bloque titulo="Etapa del ciclo de vida">
                <Chips valores={f.etapas} onCambio={v => set('etapas', v)}
                  opts={etapas.map(e => ({ v: e.id, l: e.label }))} vacio="" />
              </Bloque>
            )}

            {conAbm && (
              <>
                <Bloque titulo="Dónde están">
                  <Chips valores={f.estado_geo} onCambio={v => set('estado_geo', v)}
                    opts={(cat?.estados || []).map(e => ({ v: e.estado, l: e.estado, n: e.n }))} vacio="Cargando…" />
                  <input placeholder="o escribe una ciudad" value={f.ciudad} onChange={e => set('ciudad', e.target.value)} style={{ ...inp, marginTop: 8 }} />
                </Bloque>

                <Bloque titulo="Qué tan bien se ven">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ flex: 1 }}>
                      <span style={{ fontSize: 11.5, color: '#6b7280', display: 'block', marginBottom: 4 }}>Estrellas mín.</span>
                      <input type="number" step="0.1" min={0} max={5} placeholder="4.0" value={f.rating_min} onChange={e => set('rating_min', e.target.value)} style={inp} />
                    </label>
                    <label style={{ flex: 1 }}>
                      <span style={{ fontSize: 11.5, color: '#6b7280', display: 'block', marginBottom: 4 }}>Reseñas mín.</span>
                      <input type="number" min={0} placeholder="20" value={f.resenas_min} onChange={e => set('resenas_min', e.target.value)} style={inp} />
                    </label>
                  </div>
                  {/* Una tienda de 5.0 con dos reseñas no es una buena tienda:
                      es una tienda sin reseñas. Por eso las dos juntas. */}
                  <p style={{ fontSize: 11, color: '#a5a2af', margin: '6px 0 0', lineHeight: 1.45 }}>
                    Un 5.0 con dos reseñas no dice nada. Las dos cosas juntas sí.
                  </p>
                </Bloque>
              </>
            )}

            {conCrm && (
              <Bloque titulo="De quién son">
                <Opciones valor={f.owner} onCambio={v => set('owner', v)} opts={[
                  { v: '', l: 'De cualquiera' }, { v: 'mias', l: 'Míos' }, { v: 'sin_asignar', l: 'Sin dueño' },
                ]} />
              </Bloque>
            )}

            <Bloque titulo="3 · A quién NO llamar">
              <label style={{ display: 'block', marginBottom: 11 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3a3a44' }}>Ya les marqué sin que contesten</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[['', 'No los quites'], ['2', '2 veces o más'], ['3', '3 veces o más'], ['5', '5 veces o más']].map(([v, l]) => (
                    <button key={v || 'no'} type="button" onClick={() => set('quemados', v)}
                      style={{ fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9, padding: '6px 10px', fontSize: 12, fontWeight: f.quemados === v ? 800 : 600, border: `1px solid ${f.quemados === v ? P.violeta : '#e6e4ec'}`, background: f.quemados === v ? '#EEECFE' : '#fff', color: f.quemados === v ? P.violetaTinta : '#4B5563' }}>{l}</button>
                  ))}
                </div>
                {previa?.descartados?.quemados > 0 && f.quemados && (
                  <span style={{ fontSize: 11, color: '#9a6a10', display: 'block', marginTop: 5 }}>
                    Se quitan {previa.descartados.quemados} números por esta regla.
                  </span>
                )}
              </label>
              <Palomita on={f.excluir_con_accion} onCambio={v => set('excluir_con_accion', v)}
                texto="Los que ya tuvieron una acción" porque="Reunión, seguimiento, oportunidad o descalificado: con ellos ya hay un proceso en marcha." />
              {previa?.descartados?.con_accion > 0 && f.excluir_con_accion && (
                <span style={{ fontSize: 11, color: '#9a6a10', display: 'block', margin: '-4px 0 8px' }}>
                  Se quitan {previa?.descartados?.con_accion} por esta regla.
                </span>
              )}
              <Palomita on={f.excluir_clientes} onCambio={v => set('excluir_clientes', v)}
                texto="Los que ya son clientes" porque="Venderle otra vez a quien ya compró se hace por otro camino." />
              <Palomita on={f.excluir_con_reunion} onCambio={v => set('excluir_con_reunion', v)}
                texto="Los que ya tienen cita próxima" porque="Llamarle a quien vas a ver el martes gasta el contacto." />
              {conAbm && (
                <Palomita on={f.excluir_en_cadencia} onCambio={v => set('excluir_en_cadencia', v)}
                  texto="Los que están en cadencia del ABM" porque="Ya les está escribiendo el correo automático hoy." />
              )}
              <Palomita on={f.nunca_llamados} onCambio={v => set('nunca_llamados', v)}
                texto="Solo los que nunca he tocado" porque="Para estrenar una lista sin repetir a nadie." />
              <label style={{ display: 'block', marginTop: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3a3a44' }}>Sin contacto desde hace</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[['', 'Da igual'], ['15', '15 días'], ['30', '1 mes'], ['90', '3 meses']].map(([v, l]) => (
                    <button key={v || 'no'} type="button" onClick={() => set('sin_tocar_dias', v)}
                      style={{ fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9, padding: '6px 10px', fontSize: 12, fontWeight: f.sin_tocar_dias === v ? 800 : 600, border: `1px solid ${f.sin_tocar_dias === v ? P.violeta : '#e6e4ec'}`, background: f.sin_tocar_dias === v ? '#EEECFE' : '#fff', color: f.sin_tocar_dias === v ? P.violetaTinta : '#4B5563' }}>{l}</button>
                  ))}
                </div>
              </label>
            </Bloque>

            {conAbm && (
              <Bloque titulo="Por dónde empezar">
                <Opciones valor={f.orden} onCambio={v => set('orden', v)} opts={[
                  { v: 'puntaje', l: 'Los que mejor encajan' },
                  { v: 'sucursales', l: 'Los más grandes' },
                  { v: 'rating', l: 'Los mejor calificados' },
                ]} />
                <p style={{ fontSize: 11, color: '#a5a2af', margin: '6px 0 0', lineHeight: 1.45 }}>
                  La jornada marca en este orden, así que si no da tiempo de terminarla, los primeros son los que más valían.
                </p>
              </Bloque>
            )}

            <p style={{ fontSize: 11.5, color: '#a5a2af', lineHeight: 1.55, margin: 0 }}>
              Siempre se quitan solos, elijas lo que elijas: los que no tienen teléfono,
              los marcados «no llamar», los que se descalificaron alguna vez y los que
              están en la lista de bloqueo.
            </p>
          </div>

          {/* ── A quién vas a llamar ── */}
          <div style={{ flex: 1, minWidth: 0, padding: esMovil ? 16 : 22, overflowY: 'auto', background: '#fafafb' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 4 }}>
              <b style={{ fontSize: 34, letterSpacing: '-0.03em', color: n ? P.violetaTinta : '#a5a2af', fontVariantNumeric: 'tabular-nums' }}>
                {cargando ? '…' : n.toLocaleString('es-MX')}
              </b>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{n === 1 ? 'para llamar' : 'para llamar'}</span>
            </div>
            {titulo && <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>{titulo}</div>}

            {error && (
              <div style={{ background: '#FDF0EE', border: '1px solid #f0c4bd', color: '#C0554E', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, marginBottom: 12 }}>{error}</div>
            )}
            {!cargando && !n && !error && (
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                Con esos filtros no queda nadie. Prueba quitando el giro o bajando las sucursales.
              </div>
            )}
            {n > 500 && (
              /* El tope real de una jornada. Decirlo aquí y no al crear la sesión
                 evita armar una lista de nueve mil y descubrir el corte después. */
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '9px 12px', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                Una jornada marca hasta <b>500</b>. Se van a tomar los primeros 500 en el orden que elegiste; el resto queda para la siguiente.
              </div>
            )}

            <div style={{ display: 'grid', gap: 4 }}>
              {(previa?.filas || []).map((c: any) => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 9, padding: '8px 11px', display: 'flex', gap: 9, alignItems: 'center' }}>
                  <b style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.contacto?.nombre || c.telefono}
                    {c.sucursales ? <span style={{ fontWeight: 500, color: '#999' }}> · {c.sucursales} tiendas</span> : null}
                  </b>
                  {c.tiene_wa && <span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 999, padding: '2px 7px', background: '#EAF8F2', color: '#1E8A63' }}>WA</span>}
                  <span style={{ fontSize: 11, color: '#999', flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.giro || c.contacto?.lifecycle_stage || ''}</span>
                </div>
              ))}
            </div>
            {n > (previa?.filas || []).length && (
              <div style={{ fontSize: 11.5, color: '#a5a2af', marginTop: 9 }}>
                y {(n - (previa?.filas || []).length).toLocaleString('es-MX')} más. Vas a poder revisarlos todos antes de marcar.
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: esMovil ? '12px 16px' : '14px 22px', borderTop: '1px solid #f0eff3', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#6b7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => onListo({ titulo: titulo || 'Lista a la medida', qs })} disabled={!n || cargando}
            style={{ border: 'none', borderRadius: 11, padding: '11px 20px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
              cursor: n && !cargando ? 'pointer' : 'default', background: n && !cargando ? P.violetaTinta : '#e0dfe6', color: '#fff' }}>
            {n ? `Llamar a estos ${Math.min(n, 500).toLocaleString('es-MX')}` : 'Llamar a estos'}
          </button>
        </div>
      </div>
    </>
  );
}
