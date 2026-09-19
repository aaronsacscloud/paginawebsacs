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

type Resumen = {
  id: string; seccion: string; slug: string; titulo: string; meta_desc: string;
  estado: string; created_at: string; palabras: number; bloques: number;
  pregunta: string | null; quien: string | null; advertencia: string | null; revisado: boolean;
};
type Pieza = Resumen & { html: string; cuerpo: any[]; brief: any; url: string };

export default function DemandaBandeja() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [abierta, setAbierta] = useState<Pieza | null>(null);
  const [cargandoPieza, setCargandoPieza] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const movil = useIsMobile();

  const cargar = () =>
    fetch('/api/crm/demanda/borradores?estado=borrador,aprobado')
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
        <button style={{ ...btn, marginBottom: 14 }} onClick={() => { setAbierta(null); setAviso(null); }}>← Volver a la bandeja</button>

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
                style={{ ...btn, background: P.verdeTinta, color: '#fff', borderColor: P.verdeTinta, opacity: trabajando ? .6 : 1 }}
                disabled={trabajando}
                onClick={() => decidir('publicar')}
              >
                {trabajando ? 'Publicando…' : 'Publicar ahora'}
              </button>
              <button
                style={{ ...btn, color: P.rojoTinta, borderColor: P.rojo, opacity: trabajando ? .6 : 1 }}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '.98rem', fontWeight: 600, lineHeight: 1.4 }}>
                      {p.pregunta || p.titulo}
                    </p>
                    <p style={{ margin: '.3rem 0 0', fontSize: '.83rem', color: P.suave }}>
                      /{p.seccion}/{p.slug}/ · {p.palabras} palabras · {haceRato(p.created_at)}
                    </p>
                    {p.advertencia && (
                      <p style={{ margin: '.5rem 0 0', fontSize: '.82rem', color: P.ambarTinta, lineHeight: 1.5 }}>
                        ⚠ {p.advertencia.slice(0, 150)}{p.advertencia.length > 150 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <button style={{ ...btn, flex: 'none' }} onClick={() => abrir(p.id)}>Leerla</button>
                </div>
              </Tarjeta>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cómo leer un borrador en dos minutos">
        <Tarjeta>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem', lineHeight: 1.7, color: P.tinta }}>
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
