// MOTOR DE DEMANDA · SEO.
//
// Lo que el motor encontró al mirar nuestro propio sitio. Dos listas y una
// regla de lectura: arriba lo que impide que una página exista para un buscador
// o para una IA, abajo lo que solo la deja peor de lo que podría estar.
//
// La cola se cierra sola: lo que deja de aparecer en el rastreo pasa a resuelto
// sin que nadie tenga que acordarse de tacharlo. Sin eso, en tres meses esto
// sería una lista de doscientas filas viejas que nadie vuelve a abrir.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando, { Chispas } from '../ui/Cargando';
import { Kpi, Pastilla, Seccion, Tarjeta, btn, haceRato } from './ui';

/** La fecha y hora de una revisión, dichas como las diría alguien, no un ISO. */
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** «Se cerraron 12 · 3 nuevos · quedan 64 abiertos», o la verdad de que nada
 *  cambió: sin este caso, revisar dos veces seguidas se ve como que no pasó
 *  nada — cuando lo que pasó es que ya no hay nada nuevo que encontrar. */
function resumenRevision(r: { nuevos: number; resueltos: number; abiertos: number }): string {
  if (!r.nuevos && !r.resueltos) return 'Nada cambió desde la última revisión';
  const partes: string[] = [];
  if (r.resueltos) partes.push(`Se cerraron ${r.resueltos}`);
  if (r.nuevos) partes.push(`${r.nuevos} nuevos`);
  partes.push(`quedan ${r.abiertos} abiertos`);
  const texto = partes.join(' · ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

type ResultadoRevision = { nuevos: number; resueltos: number; abiertos: number; paginas_rastreadas: number; hecha_at: string };

const TONO_SEV: Record<string, { fondo: string; tinta: string }> = {
  critica: { fondo: P.rojoAgua, tinta: P.rojoTinta },
  alta:    { fondo: P.rosaAgua, tinta: P.rosaTinta },
  media:   { fondo: P.ambarAgua, tinta: P.ambarTinta },
  baja:    { fondo: P.lineaSuave, tinta: P.suave },
};

/** Cada hallazgo dicho como lo diría una persona, y qué se hace con él. */
const EXPLICA: Record<string, { que: string; hacer: string }> = {
  estado_http:         { que: 'La página devuelve error', hacer: 'Sacarla del sitemap o arreglar la respuesta' },
  noindex_en_sitemap:  { que: 'Pide que no la indexen, pero está en el sitemap', hacer: 'Quitarla del sitemap: el sitemap dice «mírame» y la etiqueta «ignórame»' },
  huerfana:            { que: 'Ninguna página del sitio la enlaza', hacer: 'Enlazarla desde donde tenga sentido, o retirarla' },
  sin_titulo:          { que: 'No tiene título', hacer: 'Ponerle uno: es lo que se ve en el buscador' },
  titulo_duplicado:    { que: 'Varias páginas comparten el mismo título', hacer: 'Diferenciarlos: compiten entre ellos' },
  canonical_distinta:  { que: 'Su canónica apunta a otra página', hacer: 'Confirmar que es a propósito' },
  sin_h1:              { que: 'No tiene encabezado principal', hacer: 'Agregar un H1 que diga de qué trata' },
  sin_meta:            { que: 'Sin meta descripción', hacer: 'Escribirla: si no, Google inventa el resumen que decide el clic' },
  sin_schema:          { que: 'Sin datos estructurados', hacer: 'Agregarlos: sin ellos una IA adivina qué es esta página' },
  contenido_delgado:   { que: 'Muy poco contenido', hacer: 'Ampliarla o unirla con otra' },
  titulo_corto:        { que: 'Título muy corto', hacer: 'Aprovechar el espacio disponible' },
  titulo_largo:        { que: 'Título que se va a cortar', hacer: 'Dejar lo importante en los primeros 60 caracteres' },
  meta_larga:          { que: 'Meta descripción que se va a cortar', hacer: 'Recortar a 160 caracteres' },
  meta_corta:          { que: 'Meta descripción corta', hacer: 'Usar el espacio para dar una razón de entrar' },
  meta_duplicada:      { que: 'Varias páginas con la misma descripción', hacer: 'Escribir una propia para cada una' },
  sin_canonical:       { que: 'Sin URL canónica', hacer: 'Declararla' },
  sin_enlaces_salientes: { que: 'No enlaza a ninguna otra página', hacer: 'Conectarla con lo relacionado' },
};

export default function DemandaSeo() {
  const isMobile = useIsMobile();
  const [issues, setIssues] = useState<any[]>([]);
  const [paginas, setPaginas] = useState<any[]>([]);
  const [res, setRes] = useState<any>(null);
  const [vista, setVista] = useState<'problemas' | 'paginas'>('problemas');
  const [cargando, setCargando] = useState(true);

  // Revisar ahora vuelve a pedir exactamente lo que ya carga este efecto — así
  // el botón nunca puede quedar desincronizado de lo que se ve al entrar.
  const [revisando, setRevisando] = useState(false);
  const [ultimaRevision, setUltimaRevision] = useState<ResultadoRevision | null>(null);
  const [errorRevision, setErrorRevision] = useState<string | null>(null);

  const cargar = () => Promise.all([
    fetch('/api/crm/demanda/demanda?vista=issues&limite=300').then(r => r.json()),
    fetch('/api/crm/demanda/demanda?vista=paginas&limite=300').then(r => r.json()),
    fetch('/api/crm/demanda/demanda?vista=resumen').then(r => r.json()),
  ]).then(([a, b, c]) => { setIssues(a.issues || []); setPaginas(b.paginas || []); setRes(c); });

  useEffect(() => { cargar().catch(() => {}).finally(() => setCargando(false)); }, []);

  const revisarAhora = async () => {
    setRevisando(true); setErrorRevision(null);
    try {
      // Vuelve a LEER cada página del sitio en vivo (no solo relee lo que ya
      // estaba guardado): así lo que el dueño acaba de corregir aparece
      // corregido hoy, no hasta el próximo rastreo semanal del motor.
      const r = await fetch('/api/crm/demanda/correr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ que: 'tecnico' }),
      }).then(r => r.json());
      if (!r.ok) throw new Error(r.error || 'el motor no pudo terminar la revisión');
      await cargar();
      setUltimaRevision({ nuevos: r.nuevos, resueltos: r.resueltos, abiertos: r.abiertos, paginas_rastreadas: r.paginas_rastreadas, hecha_at: new Date().toISOString() });
    } catch {
      // Sin tecnicismos: a quien opera el panel no le sirve el mensaje de
      // Supabase, le sirve saber que puede intentar otra vez.
      setErrorRevision('No se pudo revisar el sitio. Intenta de nuevo en un momento.');
    } finally {
      setRevisando(false);
    }
  };

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  const c = res?.conteos || {};
  const serios = issues.filter(i => ['critica', 'alta'].includes(i.severidad));
  const menores = issues.filter(i => !['critica', 'alta'].includes(i.severidad));
  const corto = (u: string) => u.replace('https://www.sacscloud.com', '') || '/';

  // Lo que va bien, no solo lo que falta: de las páginas que trae este panel,
  // cuántas el rastreo ya revisó sin encontrarles ni un solo hallazgo abierto.
  // Ambos números salen de datos que el propio motor ya cargó, ninguno se inventa.
  const urlsConProblemas = new Set(issues.map(i => i.url));
  const paginasSinHallazgos = paginas.filter(p => !urlsConProblemas.has(p.url)).length;

  const fila = (i: any) => (
    <Tarjeta key={i.id} franja={TONO_SEV[i.severidad].tinta} style={{ padding: '11px 14px' }}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pastilla tono={TONO_SEV[i.severidad]}>{i.severidad}</Pastilla>
            <strong style={{ fontSize: 14, color: P.tinta }}>{EXPLICA[i.tipo]?.que || i.tipo}</strong>
          </div>
          <a href={i.url} target="_blank" rel="noopener noreferrer"
             style={{ display: 'block', fontSize: 13, color: P.violetaTinta, marginTop: 3, wordBreak: 'break-all' }}>
            {corto(i.url)}
          </a>
          {EXPLICA[i.tipo]?.hacer ? (
            <div style={{ fontSize: 12.5, color: P.suave, marginTop: 3 }}>{EXPLICA[i.tipo].hacer}</div>
          ) : null}
          {i.detalle?.paginas?.length > 1 ? (
            <div style={{ fontSize: 12, color: P.tenue, marginTop: 3 }}>
              y {i.detalle.paginas.length - 1} más: {i.detalle.paginas.slice(1, 4).map(corto).join(', ')}
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: 11.5, color: P.tenue, whiteSpace: 'nowrap' }}>{haceRato(i.detectado_at)}</span>
      </div>
    </Tarjeta>
  );

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>SEO técnico</h2>
          <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5, maxWidth: '64ch' }}>
            Lo que el motor encontró al rastrear nuestro propio sitio. Lo que se arregla desaparece solo
            de esta lista en el siguiente rastreo — o al momento, con «Revisar ahora».
          </p>
        </div>
        {/* Sin este botón, arreglar algo aquí significaba esperar al rastreo
            SEMANAL del motor para verlo reflejado — hasta dos días viendo un
            hallazgo que ya no existía. El botón vuelve a LEER cada página en
            vivo, no solo relee lo que ya estaba guardado; por eso tarda medio
            minuto y no es instantáneo. `disabled` evita dos revisiones
            pisándose. */}
        <button
          onClick={revisarAhora}
          disabled={revisando}
          style={{ ...btn(true), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...(isMobile ? { width: '100%' } : { flexShrink: 0 }), opacity: revisando ? 0.75 : 1, cursor: revisando ? 'default' : 'pointer' }}
        >
          {revisando ? <><Chispas size={13} color="#fff" /> Revisando el sitio…</> : 'Revisar ahora'}
        </button>
      </div>

      {revisando ? (
        <div style={{ marginTop: 12, background: P.violetaAgua, color: P.violetaHondo, borderRadius: 8, padding: '10px 13px', fontSize: 13 }}>
          Puede tardar medio minuto — no se quedó pegado: está leyendo de nuevo, una por una, cada página del sitio.
        </div>
      ) : errorRevision ? (
        <div style={{ marginTop: 12, background: P.rojoAgua, color: P.rojoTinta, borderRadius: 8, padding: '11px 14px', fontSize: 13.5, fontWeight: 600 }}>
          {errorRevision}
        </div>
      ) : ultimaRevision ? (
        <div style={{ marginTop: 12, background: P.verdeAgua, color: P.verdeTinta, borderRadius: 8, padding: '10px 13px', fontSize: 13.5, fontWeight: 600 }}>
          Revisó {ultimaRevision.paginas_rastreadas} páginas del sitio: {resumenRevision(ultimaRevision).charAt(0).toLowerCase() + resumenRevision(ultimaRevision).slice(1)}
          <span style={{ fontWeight: 400, color: P.suave }}> · revisado el {fechaHora(ultimaRevision.hecha_at)}</span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 16 }}>
        <Kpi franja={serios.length ? P.rojo : P.verde} titulo="Serios" valor={serios.length} pie="impiden que una página exista" />
        <Kpi franja={P.ambar} titulo="Menores" valor={menores.length} pie="la dejan peor de lo que puede estar" />
        <Kpi franja={P.azul} titulo="Páginas" valor={c.paginas ?? paginas.length} pie={`${c.publicadas || 0} publicadas por el motor`} />
        <Kpi franja={c.huerfanas ? P.ambar : P.verde} titulo="Huérfanas" valor={c.huerfanas ?? 0} pie="nadie las enlaza" />
      </div>

      {/* Lo que también dice el rastreo, y que el panel nunca enseñaba: no
          todo es lista de pendientes. */}
      <Tarjeta franja={P.verde} style={{ marginTop: 12 }}>
        <span style={{ fontSize: 13.5, color: P.texto }}>
          De las <strong>{paginas.length}</strong> páginas que trae este panel, <strong>{paginasSinHallazgos}</strong> no
          tienen ni un solo hallazgo abierto.
        </span>
      </Tarjeta>

      <div style={{ display: 'flex', gap: 6, marginTop: 20, flexWrap: 'wrap' }}>
        {([['problemas', `Problemas (${issues.length})`], ['paginas', `Páginas (${paginas.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setVista(k as any)} style={{ ...btn(vista === k), borderRadius: 999, padding: '7px 15px' }}>{l}</button>
        ))}
      </div>

      {vista === 'problemas' ? (
        <>
          <Seccion titulo="Lo serio primero">
            {serios.length === 0
              ? <Tarjeta franja={P.verde}><span style={{ fontSize: 13.5, color: P.texto }}>Nada serio abierto.</span></Tarjeta>
              : <div style={{ display: 'grid', gap: 8 }}>{serios.map(fila)}</div>}
          </Seccion>
          {menores.length ? <Seccion titulo="Lo menor">
            <div style={{ display: 'grid', gap: 8 }}>{menores.map(fila)}</div>
          </Seccion> : null}
        </>
      ) : (
        <Seccion titulo="El inventario del sitio" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>ordenado por cuántas páginas lo enlazan</span>}>
          <div className="crm-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 700 : undefined }}>
              <thead><tr>{['Página', 'Palabras', 'Enlaces que recibe', 'Enlaces que da', 'Schema'].map((h, i) => (
                <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, color: P.tenue, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {paginas.map(p2 => (
                  <tr key={p2.url}>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, maxWidth: 380 }}>
                      <a href={p2.url} target="_blank" rel="noopener noreferrer" style={{ color: P.tinta, fontWeight: 600, textDecoration: 'none' }}>
                        {corto(p2.url)}
                      </a>
                      {p2.titulo ? <div style={{ fontSize: 12, color: P.suave, marginTop: 2 }}>{p2.titulo.slice(0, 80)}</div> : null}
                    </td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (p2.palabras || 0) < 300 ? P.ambarTinta : P.texto }}>{p2.palabras ?? '—'}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p2.huerfana ? P.rojoTinta : P.texto }}>{p2.enlaces_in}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: P.suave }}>{p2.enlaces_out}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontSize: 12, color: P.suave }}>{(p2.schema_tipos || []).length || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}
    </div>
  );
}
