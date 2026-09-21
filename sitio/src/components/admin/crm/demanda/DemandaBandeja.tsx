// MOTOR DE DEMANDA · Bandeja de borradores.
//
// Lo que el motor escribió y espera que alguien lo lea.
//
// LA DECISIÓN DE DISEÑO QUE IMPORTA: lo primero que se ve de cada pieza no es
// el título, es **la pregunta que contesta** y **lo que el brief avisó que NO
// se puede afirmar**. Leer un artículo de dos mil palabras buscando una mentira
// es agotador y no se sostiene una semana; leerlo sabiendo dónde mirar toma
// dos minutos.
//
// Y el rechazo EXIGE motivo, a propósito. El motivo es lo único que hace que la
// siguiente tanda salga mejor: el brief lo lee y no repite el error. Un rechazo
// sin motivo es trabajo tirado dos veces — el de ahora y el de la próxima, que
// va a cometer el mismo fallo.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Seccion, Tarjeta, btn, haceRato } from './ui';

type Referee = {
  pasa: boolean; promedio: number; puntajes: Record<string, number>; ronda: number;
  por_que: string; fallos: string[]; mejor_que_competencia: boolean; cuando: string | null;
  probabilidad_cita?: number; primera_correccion?: string;
  criterios?: { clave: string; ok: boolean; nota: string }[];
  elementos?: { elemento: string; veredicto: 'mantener' | 'cambiar'; confianza: number; propuesta: string }[];
  preguntas_ia_cubiertas?: string[]; preguntas_ia_sin_cubrir?: string[];
  video_sugerido?: string; necesita_del_dueno?: string[]; funciones_prometidas?: string[];
  wow?: { clave: string; ok: boolean; nota: string }[];
};
type Resumen = {
  id: string; seccion: string; slug: string; titulo: string; meta_desc: string;
  estado: string; created_at: string; palabras: number; bloques: number;
  pregunta: string | null; quien: string | null; advertencia: string | null; revisado: boolean;
  referee: Referee | null; portada: string | null; giro: string | null; atascada: boolean;
};
type Similar = { url: string; titulo: string; tipo: string; palabras_aprox: number; tiene_faq: boolean; tiene_tabla_o_pasos: boolean; cubre_bien: string[]; le_falta: string[]; por_que_rankea: string };
type Pieza = Omit<Resumen, 'portada' | 'giro'> & {
  html: string; cuerpo: any[]; brief: any; url: string; preview: string;
  portada: { url: string; alt: string } | null;
  giro: { label: string; href: string } | null;
  competencia: { paginas: Similar[]; hueco: string | null };
};

const NOMBRE_CRITERIO: Record<string, string> = {
  competencia_superada: 'Mejor que lo que rankea', elementos_seo: 'Título, meta, H1, FAQ, schema', preguntas_ia: 'Contesta lo que se le pregunta a la IA',
  probabilidad_cita: 'Probabilidad de ser citada', intencion_compradora: 'Términos que convierten', enlaces_internos: 'Enlaces internos con razón',
  checks_duros: 'Comprobaciones sí/no', glosario: 'Glosario del ramo', lenguaje_ramo: 'Lenguaje del ramo', fotos: 'Fotos', diagrama: 'Imagen con el dato',
  datos_con_fuente: 'Datos con fuente', cta_mitad: 'CTA a mitad de camino', entidad: 'Entidad / E-E-A-T', respuesta_corta: 'Respuesta corta arriba',
  frescura: 'Frescura', legibilidad: 'Se lee en el celular', video_media: 'Video u otro medio',
};

const EJES: Record<string, string> = {
  contesta: 'Contesta la pregunta', profundidad: 'Enseña algo', voz_experto: 'Voz de mostrador',
  honestidad: 'Solo afirma lo real', estructura_geo: 'Citable por una IA', vs_competencia: 'Mejor que lo que rankea',
};

function Puntaje({ n }: { n: number }) {
  const color = n >= 8.5 ? P.verdeTinta : n >= 7 ? P.ambarTinta : P.rojoTinta;
  return <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{n}</span>;
}

/* El veredicto del referee: por qué esta página llegó hasta aquí. Es lo que
   le ahorra al dueño leer dos mil palabras buscando dónde falla. */
function VeredictoReferee({ r }: { r: Referee }) {
  return (
    <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 10, background: r.pasa ? P.verdeAgua : P.rojoAgua, borderLeft: `3px solid ${r.pasa ? P.verdeTinta : P.rojoTinta}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ fontSize: 11.5, color: r.pasa ? P.verdeTinta : P.rojoTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>
          {r.pasa ? 'Pasó el referee' : 'No pasó el referee'} · promedio {r.promedio} / 10 · {r.ronda === 0 ? 'a la primera' : `tras ${r.ronda} reescritura${r.ronda > 1 ? 's' : ''}`}
        </div>
        <span style={{ fontSize: '.8rem', color: P.suave }}>{r.mejor_que_competencia ? 'Mejor que lo que hoy rankea' : 'NO supera a lo que hoy rankea'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px 14px', marginTop: 10 }}>
        {Object.entries(r.puntajes).map(([k, n]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', color: P.texto, borderBottom: `1px solid ${P.lineaSuave}`, padding: '3px 0' }}>
            <span>{EJES[k] || k}</span><Puntaje n={n} />
          </div>
        ))}
      </div>
      <p style={{ margin: '.8rem 0 0', fontSize: '.88rem', lineHeight: 1.6, color: P.texto }}>{r.por_que}</p>
      {typeof r.probabilidad_cita === 'number' && r.probabilidad_cita > 0 && (
        <p style={{ margin: '.6rem 0 0', fontSize: '.85rem', color: P.texto }}>
          <strong>Probabilidad de que una IA la cite: {r.probabilidad_cita}%.</strong>{r.primera_correccion ? ` Lo que más la subiría: ${r.primera_correccion}` : ''}
        </p>
      )}
      {r.criterios && r.criterios.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: '.85rem', fontWeight: 600, color: P.texto }}>
            {r.criterios.filter(k => k.ok).length} de {r.criterios.length} criterios en orden
          </summary>
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {r.criterios.map(k => (
              <div key={k.clave} style={{ display: 'grid', gridTemplateColumns: '18px 190px 1fr', gap: 8, fontSize: '.82rem', lineHeight: 1.5, alignItems: 'baseline' }}>
                <span style={{ color: k.ok ? P.verdeTinta : P.rojoTinta, fontWeight: 700 }}>{k.ok ? '✓' : '✗'}</span>
                <span style={{ fontWeight: 600, color: P.texto }}>{NOMBRE_CRITERIO[k.clave] || k.clave}</span>
                <span style={{ color: P.suave }}>{k.nota}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {r.necesita_del_dueno && r.necesita_del_dueno.length > 0 && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: P.papel, border: `1px solid ${P.linea}` }}>
          <div style={{ fontSize: 11.5, color: P.ambarTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Lo que el motor no puede generar y te pide</div>
          <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem', fontSize: '.85rem', lineHeight: 1.6, color: P.texto }}>
            {r.necesita_del_dueno.map((x, i) => <li key={i}>{x}</li>)}
            {r.video_sugerido && r.video_sugerido.startsWith('grabar') && <li>Video: {r.video_sugerido}</li>}
          </ul>
        </div>
      )}
      {r.wow && r.wow.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: '.85rem', fontWeight: 600, color: P.texto }}>
            WOW {r.wow.filter(k => k.ok).length} de {r.wow.length} (no bloquean: son lo que la vuelve la referencia)
          </summary>
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {r.wow.map(k => (
              <div key={k.clave} style={{ display: 'grid', gridTemplateColumns: '18px 190px 1fr', gap: 8, fontSize: '.82rem', lineHeight: 1.5, alignItems: 'baseline' }}>
                <span style={{ color: k.ok ? P.verdeTinta : P.suave, fontWeight: 700 }}>{k.ok ? '✓' : '○'}</span>
                <span style={{ fontWeight: 600, color: P.texto }}>{k.clave.replace(/_/g, ' ')}</span>
                <span style={{ color: P.suave }}>{k.nota}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {r.funciones_prometidas && r.funciones_prometidas.length > 0 && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: P.papel, border: `1px solid ${P.linea}` }}>
          <div style={{ fontSize: 11.5, color: P.violetaTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Lo que promete y no está construido (para ventas)</div>
          <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem', fontSize: '.85rem', lineHeight: 1.6, color: P.texto }}>
            {r.funciones_prometidas.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      )}
      {!r.pasa && r.fallos.length > 0 && (
        <ul style={{ margin: '.6rem 0 0', paddingLeft: '1.1rem', fontSize: '.85rem', lineHeight: 1.6, color: P.texto }}>
          {r.fallos.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function DemandaBandeja() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [abierta, setAbierta] = useState<Pieza | null>(null);
  const [cargandoPieza, setCargandoPieza] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const movil = useIsMobile();

  const cargar = () =>
    fetch('/api/crm/demanda/borradores?estado=aprobado,borrador')
      .then(r => r.json())
      .then(j => setLista(j.ok ? j.piezas : []))
      .catch(() => setLista([]));

  useEffect(() => { cargar(); }, []);

  const abrir = (id: string) => {
    setCargandoPieza(true); setMotivo(''); setAviso(null);
    fetch(`/api/crm/demanda/borradores?id=${id}`)
      .then(r => r.json())
      .then(j => setAbierta(j.ok ? j.pieza : null))
      .finally(() => setCargandoPieza(false));
  };

  const decidir = async (accion: 'publicar' | 'rechazar') => {
    if (!abierta) return;
    if (accion === 'rechazar' && motivo.trim().length < 10) {
      setAviso('Escribe por qué no sirve. Es lo que el motor lee para no repetirlo.');
      return;
    }
    setTrabajando(true); setAviso(null);
    try {
      const r = await fetch('/api/crm/demanda/borradores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: abierta.id, accion, motivo: motivo.trim() || undefined }),
      }).then(x => x.json());
      if (!r.ok) { setAviso(r.error || 'no se pudo'); return; }
      setAviso(accion === 'publicar' ? `Publicada: ${r.url}` : 'Rechazada. El motivo se guardó para la próxima tanda.');
      setAbierta(null);
      await cargar();
    } finally { setTrabajando(false); }
  };

  if (!lista) return <Cargando />;

  // ── una pieza abierta ─────────────────────────────────────────────────
  if (abierta) {
    return (
      <div style={WRAP}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btn()} onClick={() => { setAbierta(null); setAviso(null); }}>← Volver a la bandeja</button>
          <a href={abierta.preview} target="_blank" rel="noopener noreferrer" style={{ ...btn(true), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Ver la página real (preview) ↗
          </a>
          <span style={{ fontSize: '.8rem', color: P.suave }}>Tal cual va a salir: plantilla, portada, diagrama y cierre por giro. Solo la ves tú.</span>
        </div>

        <Tarjeta>
          <div style={{ fontSize: 11.5, color: P.tenue, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>
            Contesta esta pregunta
          </div>
          <p style={{ margin: '.3rem 0 0', fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.4 }}>
            {abierta.brief?.pregunta || abierta.titulo}
          </p>
          {abierta.brief?.quien && (
            <p style={{ margin: '.7rem 0 0', fontSize: '.88rem', color: P.suave, lineHeight: 1.6 }}>
              <strong style={{ color: P.texto }}>Quién pregunta:</strong> {abierta.brief.quien}
            </p>
          )}
        </Tarjeta>

        {abierta.referee && <VeredictoReferee r={abierta.referee} />}

        {abierta.competencia.paginas.length > 0 && (
          <Seccion titulo="Contra qué compite" aparte={<span style={{ fontSize: '.8rem', color: P.suave }}>lo que hoy rankea para esta pregunta</span>}>
            <Tarjeta>
              {abierta.competencia.hueco && (
                <p style={{ margin: '0 0 .8rem', fontSize: '.88rem', lineHeight: 1.6, color: P.texto }}>
                  <strong>El hueco que ninguna cubre:</strong> {abierta.competencia.hueco}
                </p>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {abierta.competencia.paginas.map(c => (
                  <div key={c.url} style={{ fontSize: '.83rem', lineHeight: 1.5, borderTop: `1px solid ${P.lineaSuave}`, paddingTop: 8 }}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: P.azulTinta, fontWeight: 600 }}>{c.titulo || c.url}</a>
                    <span style={{ color: P.suave }}> · {c.tipo} · ~{c.palabras_aprox} palabras{c.tiene_faq ? ' · faq' : ''}{c.tiene_tabla_o_pasos ? ' · tabla/pasos' : ''}</span>
                    {c.le_falta?.length > 0 && <div style={{ color: P.suave }}>Le falta: {c.le_falta.join('; ')}</div>}
                  </div>
                ))}
              </div>
            </Tarjeta>
          </Seccion>
        )}

        {abierta.brief?.nota_honestidad && (
          <div style={{
            marginTop: 12, padding: '14px 16px', borderRadius: 10,
            background: P.ambarAgua, borderLeft: `3px solid ${P.ambar}`,
          }}>
            <div style={{ fontSize: 11.5, color: P.ambarTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>
              Lo primero que hay que comprobar
            </div>
            <p style={{ margin: '.4rem 0 0', fontSize: '.9rem', lineHeight: 1.6, color: P.texto }}>
              {abierta.brief.nota_honestidad}
            </p>
            <p style={{ margin: '.6rem 0 0', fontSize: '.82rem', color: P.ambarTinta }}>
              El motor se avisó a sí mismo de esto antes de escribir. Comprueba que la página lo respete.
            </p>
          </div>
        )}

        <Seccion
          titulo={abierta.titulo}
          aparte={<span style={{ fontSize: '.8rem', color: P.suave }}>{abierta.palabras} palabras · irá a {abierta.url.replace('https://www.sacscloud.com', '')}</span>}
        >
          <Tarjeta>
            {abierta.portada ? (
              <img src={abierta.portada.url} alt={abierta.portada.alt} style={{ width: '100%', height: 'auto', aspectRatio: '1200 / 630', objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />
            ) : (
              <p style={{ margin: '0 0 1rem', fontSize: '.83rem', color: P.ambarTinta }}>Sin portada todavía: se genera en el ciclo diario después de pasar el referee.</p>
            )}
            {abierta.giro && (
              <p style={{ margin: '0 0 .6rem', fontSize: '.83rem', color: P.suave }}>
                Cierra mandando a <strong style={{ color: P.texto }}>Sacs para {abierta.giro.label}</strong> ({abierta.giro.href}).
              </p>
            )}
            <p style={{ margin: '0 0 1rem', fontSize: '.85rem', color: P.suave, borderBottom: `1px solid ${P.lineaSuave}`, paddingBottom: '.8rem' }}>
              <strong style={{ color: P.texto }}>En el buscador se verá:</strong> {abierta.meta_desc}
              <span style={{ marginLeft: 6, color: abierta.meta_desc.length > 160 ? P.rojoTinta : P.suave }}>
                ({abierta.meta_desc.length} caracteres)
              </span>
            </p>
            <div
              style={{ fontSize: '.95rem', lineHeight: 1.7, color: P.texto }}
              dangerouslySetInnerHTML={{ __html: abierta.html }}
            />
          </Tarjeta>
        </Seccion>

        <Seccion titulo="¿Qué hacemos con esta?">
          <Tarjeta>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Si la rechazas, di por qué. El motor lo lee antes de escribir la próxima tanda, así que un motivo concreto («promete un reporte que no existe», «el ejemplo no es de moda») vale más que «no me gustó»."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, resize: 'vertical',
                border: `1px solid ${P.linea}`, background: P.papel, color: P.texto,
                fontFamily: 'inherit', fontSize: '.9rem', lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                style={{ ...btn(), background: P.verdeTinta, color: '#fff', borderColor: P.verdeTinta, opacity: trabajando ? .6 : 1 }}
                disabled={trabajando}
                onClick={() => decidir('publicar')}
              >
                {trabajando ? 'Publicando…' : 'Publicar ahora'}
              </button>
              <button
                style={{ ...btn(), color: P.rojoTinta, borderColor: P.rojo, opacity: trabajando ? .6 : 1 }}
                disabled={trabajando}
                onClick={() => decidir('rechazar')}
              >
                Rechazar
              </button>
              <span style={{ fontSize: '.8rem', color: P.suave, alignSelf: 'center' }}>
                Publicar no despliega nada: queda en línea en segundos y Bing se entera al momento.
              </span>
            </div>
            {aviso && (
              <p style={{ margin: '.8rem 0 0', fontSize: '.88rem', color: aviso.startsWith('Publicada') ? P.verdeTinta : P.rojoTinta }}>
                {aviso}
              </p>
            )}
          </Tarjeta>
        </Seccion>
      </div>
    );
  }

  // ── la bandeja ────────────────────────────────────────────────────────
  return (
    <div style={WRAP}>
      <Seccion
        titulo="Lo que el motor escribió"
        aparte={<span style={{ fontSize: '.8rem', color: P.suave }}>{lista.length} esperando lectura</span>}
      >
        {cargandoPieza && <Cargando />}

        {lista.length === 0 ? (
          <Tarjeta>
            <p style={{ margin: 0, color: P.suave }}>
              Nada que leer. El motor escribe en el ciclo diario a partir de las oportunidades
              que detecta; si aquí no hay nada es que no encontró ninguna sin atender.
            </p>
          </Tarjeta>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {lista.map(p => (
              <Tarjeta key={p.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: movil ? 'wrap' : 'nowrap' }}>
                  {p.portada && !movil && (
                    <img src={p.portada} alt="" style={{ width: 120, height: 63, objectFit: 'cover', borderRadius: 6, flex: 'none' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '.98rem', fontWeight: 600, lineHeight: 1.4 }}>
                      {p.pregunta || p.titulo}
                    </p>
                    <p style={{ margin: '.3rem 0 0', fontSize: '.83rem', color: P.suave }}>
                      /{p.seccion}/{p.slug}/ · {p.palabras} palabras · {haceRato(p.created_at)}{p.giro ? ` · ${p.giro}` : ''}
                    </p>
                    {p.referee && (
                      <p style={{ margin: '.4rem 0 0', fontSize: '.82rem', color: p.atascada ? P.rojoTinta : P.verdeTinta, fontWeight: 600 }}>
                        {p.atascada
                          ? `Atascada: no pasó el referee en ${p.referee.ronda + 1} rondas (${p.referee.promedio}/10). Léela con el veredicto al lado.`
                          : `Referee ${p.referee.promedio}/10 · ${p.referee.mejor_que_competencia ? 'mejor que lo que hoy rankea' : 'sin comparar'}${p.portada ? ' · con portada' : ' · sin portada aún'}`}
                      </p>
                    )}
                    {p.advertencia && (
                      <p style={{ margin: '.5rem 0 0', fontSize: '.82rem', color: P.ambarTinta, lineHeight: 1.5 }}>
                        ⚠ {p.advertencia.slice(0, 150)}{p.advertencia.length > 150 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <button style={{ ...btn(), flex: 'none' }} onClick={() => abrir(p.id)}>Leerla</button>
                </div>
              </Tarjeta>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cómo leer un borrador en dos minutos">
        <Tarjeta>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem', lineHeight: 1.7, color: P.tinta }}>
            <li><strong>Lo que ves aquí ya pasó el referee:</strong> se leyó lo que hoy rankea para esa pregunta, se juzgó la página en seis ejes (contesta, enseña, voz de mostrador, honestidad, citable, mejor que la competencia) y se reescribió hasta pasar. Lo que no pasó en dos rondas aparece como «atascada» con el veredicto, para que decidas tú.</li>
            <li><strong>Empieza por el aviso en ámbar</strong>, si lo hay. Es lo que el motor se advirtió a sí mismo que no podía afirmar; comprobar que lo respetó es el 80% de la revisión.</li>
            <li><strong>Lee el primer párrafo y el FAQ.</strong> Si el primero contesta la pregunta y el FAQ no promete nada raro, el resto casi siempre está bien.</li>
            <li><strong>Busca cifras y nombres de producto.</strong> Es donde un modelo inventa. Los precios de Sacs son $810, $1,215, $1,890 y $3,780 al mes por tienda; cualquier otro número junto a «plan» hay que mirarlo.</li>
            <li><strong>Si la rechazas, di por qué en una frase concreta.</strong> Ese texto entra al siguiente brief. Es la diferencia entre corregir una vez y corregir lo mismo cada semana.</li>
          </ul>
        </Tarjeta>
      </Seccion>
    </div>
  );
}
