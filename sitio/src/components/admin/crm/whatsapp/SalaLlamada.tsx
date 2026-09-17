/* LA SALA DE LA LLAMADA · lo que ves mientras hablas con alguien.
 *
 * PEDIDO DEL DUEÑO (17-sep-2026): «cuando el cliente responda, que me aparezca
 * una pantalla, un modal bonito y grande, con el contexto de lo que se ha
 * hablado con la persona, las sucursales, la marca en grande, si hemos tenido
 * otras llamadas anteriormente, y la parte de agendar una reunión —simple, y
 * que yo pueda ver los horarios que tienen disponibles—. Todo el proceso
 * similar al que tenemos automatizado en llamadas inteligentes… que nos permita
 * tener certeza de lo que está pasando y seguir el proceso de forma sencilla,
 * poder agregar las notas, etcétera.»
 *
 * POR QUÉ ES UN COMPONENTE APARTE Y NO CÓDIGO DENTRO DE `Telefonia.tsx`.
 * La cabina de Llamadas inteligentes ya resuelve esto mismo para las llamadas
 * en lista. Duplicarlo daría dos salas que en un mes ya no se parecen y cada
 * arreglo habría que hacerlo dos veces. Esta nace fuera de las dos, viviendo
 * sólo de props y de endpoints que ya existen, para que la cabina pueda
 * adoptarla después sin arrastrar nada suyo.
 *
 * LO QUE NO HACE, A PROPÓSITO: no marca, no cuelga y no toca el micrófono. Eso
 * lo sigue haciendo el widget de `Telefonia.tsx`, que es quien tiene el Device
 * de Twilio. Esta sala mira y anota. Dos dueños del mismo audio es cómo se
 * corta una llamada viva.
 */
import { useEffect, useRef, useState } from 'react';
import { C } from './estilo';
import { telefonoLegible } from '../../../../lib/telefono';

type Props = {
  telefono: string;
  /** El CallSid de Twilio: es la llave con la que el servidor encuentra ESTA
      llamada. Sin él la nota y el desenlace no tienen a qué colgarse. */
  callId?: string | null;
  nombre?: string | null;
  segundos: number;
  /** El texto del apunte vive arriba: al colgar tiene que seguir existiendo. */
  nota: string;
  setNota: (v: string) => void;
  onColgar: () => void;
  onSilenciar: () => void;
  mudo: boolean;
  onCerrar: () => void;
};

const RESULTADOS: { id: string; l: string; tono: string }[] = [
  { id: 'interesado', l: 'Le interesa', tono: '#1E8A63' },
  { id: 'agendado', l: 'Quedamos de vernos', tono: '#1E8A63' },
  { id: 'volver', l: 'Volver a llamar', tono: '#9a6a10' },
  { id: 'no_interesa', l: 'No le interesa', tono: '#C0554E' },
  { id: 'no_era', l: 'No era él', tono: '#74727F' },
];

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const dia = (f: any) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');

export default function SalaLlamada({ telefono, callId, nombre, segundos, nota, setNota, onColgar, onSilenciar, mudo, onCerrar }: Props) {
  const [ctx, setCtx] = useState<any>(null);
  const [horarios, setHorarios] = useState<any[] | null>(null);
  const [resultado, setResultado] = useState('');
  const [volverEl, setVolverEl] = useState('');
  const [guardado, setGuardado] = useState<'no' | 'guardando' | 'ok'>('no');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`/api/crm/telefonia/contexto?telefono=${encodeURIComponent(telefono)}`)
      .then(r => r.json()).then(j => j?.hay && setCtx(j)).catch(() => {});
  }, [telefono]);

  /* LA NOTA SE GUARDA SOLA. Un cierre que se pierde por cerrar la pestaña es
     peor que no tener nota: creíste que quedó escrito y no vuelves a mirarlo.
     Cada 4 s de silencio del teclado, no en cada tecla. */
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    if (!nota.trim() || !callId) return;
    setGuardado('guardando');
    const t = setTimeout(() => {
      fetch('/api/crm/telefonia/nota', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, texto: nota }),
      }).then(r => setGuardado(r.ok ? 'ok' : 'no')).catch(() => setGuardado('no'));
    }, 4000);
    return () => clearTimeout(t);
  }, [nota, callId]);

  /* Los horarios REALES, no un «te mando la liga». Se piden al abrir la agenda
     y no al abrir la sala: la mayoría de las llamadas no acaban en cita, y
     traerlos siempre sería pagar una consulta por cada timbrazo. */
  const verHorarios = async () => {
    setHorarios([]); setMsg('');
    /* `available-slots` y NO `availability`: el segundo devuelve la
       CONFIGURACIÓN de tu agenda (horarios semanales y excepciones), no huecos
       libres. Empecé pidiéndole slots y siempre devolvía la lista vacía sin
       decir por qué — el clásico «no hay horarios» que en realidad es «estás
       preguntando a la puerta equivocada». Éste sí cruza tu agenda con Google
       y devuelve los huecos de verdad. */
    const hoy = new Date().toISOString().slice(0, 10);
    const hasta = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const j = await fetch(`/api/scheduling/available-slots?slug=demo&from=${hoy}&to=${hasta}`)
      .then(r => r.json()).catch(() => null);
    if (j?.error) { setMsg(`No se pudieron traer los horarios: ${j.error}`); setHorarios([]); return; }
    /* La forma que devuelve es `{dates: {"2026-09-18": ["13:00","15:00"]}}`.
       Medido contra el endpoint, no supuesto: la primera versión buscaba
       `slots` y siempre pintaba vacío. */
    const slots = Object.entries(j?.dates || {})
      .flatMap(([fecha, horas]: any) => (horas || []).map((hora: string) => ({ fecha, hora })));
    setHorarios(slots.slice(0, 12));
  };

  /* «TE MANDO LA LIGA» DESDE AQUÍ, no después. El «después» es media hora más
     tarde, cuando ya vas por la cuarta llamada y no te acuerdas — y es
     exactamente la cita que se pierde. */
  const [ligaEnviada, setLigaEnviada] = useState(false);
  const mandarLiga = async () => {
    setLigaEnviada(true);
    const r = await fetch('/api/crm/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono, texto: 'Como quedamos, aquí puedes elegir el día y la hora que te acomode: https://www.sacscloud.com/agendar/demo' }),
    }).then(x => x.json()).catch(() => null);
    if (r?.error) { setLigaEnviada(false); setMsg(r.error); }
  };

  const cerrarLlamada = async () => {
    if (!resultado) { setMsg('Di qué pasó antes de colgar: es lo que alimenta todo lo demás.'); return; }
    setMsg('');
    /* Se guarda ANTES de colgar y se espera: si se colgara primero, el
       componente se desmonta y la petición se queda a medias. El desenlace es
       justo lo que no puede perderse. */
    if (callId) {
      await fetch('/api/crm/telefonia/nota', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, texto: nota, resultado, volver_el: volverEl || null }),
      }).catch(() => {});
    }
    onColgar();
  };

  const CAJA: any = { background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 14, padding: '14px 16px' };
  const ROT: any = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', marginBottom: 7 };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,11,18,.55)', zIndex: 980 }} />
      <div role="dialog" aria-label="Llamada en curso" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(1040px, 96vw)', maxHeight: '92vh', overflowY: 'auto', zIndex: 981,
        background: C.g50, borderRadius: 20, boxShadow: '0 24px 70px rgba(12,11,18,.4)',
      }}>
        {/* ══ LA CABECERA: la marca en grande, que es lo que se pidió primero.
            Es lo que dice en voz alta quien contesta, y equivocarla en el
            saludo cuesta la llamada entera. */}
        <div style={{ padding: '20px 24px 16px', background: '#fff', borderRadius: '20px 20px 0 0', borderBottom: `1px solid ${C.g200}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 54, height: 54, borderRadius: 16, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
            {reloj(segundos)}
          </span>
          <span style={{ flex: '1 1 260px', minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{ctx?.marca || nombre || ctx?.nombre || telefonoLegible(telefono)}</b>
            {/* EL NOMBRE SALE DEL CONTEXTO CUANDO NO VIENE EN LA LLAMADA.
                En una ENTRANTE, Twilio sólo trae el número: `enganchar()` la
                registra con `nombre = null`, así que la sala pintaba la marca
                —que sí viene de la ficha— y a la persona no. Lo reportó el
                dueño: «me aparecía el nombre de la empresa pero no el de la
                persona». El contexto ya lo traía; sólo no se estaba mirando. */}
            <span style={{ display: 'block', fontSize: 13, color: C.g500, marginTop: 3 }}>
              {[nombre || ctx?.nombre, ctx?.puesto, telefonoLegible(telefono), ctx?.ciudad].filter(Boolean).join(' · ')}
            </span>
            {/* SU HORA, NO LA TUYA. Marcar a Tijuana a las 9 de CDMX es llamar
                a las 7, y esa llamada no se recupera con una disculpa. Sólo se
                enseña si difiere: repetir tu propia hora es ruido. */}
            {ctx?.hora_local && (
              <span style={{ display: 'inline-block', marginTop: 5, fontSize: 11.5, fontWeight: 800, background: '#FFF4E5', color: '#9a6a10', borderRadius: 999, padding: '3px 10px' }}>
                Allá son las {ctx.hora_local.hora}
              </span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={onSilenciar} style={{ border: `1px solid ${C.g200}`, background: mudo ? '#FFF4E5' : '#fff', color: mudo ? '#9a6a10' : C.g700, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {mudo ? 'Estás en mudo' : 'Silenciar'}
            </button>
            <button onClick={cerrarLlamada} style={{ border: 'none', background: '#C0554E', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Colgar</button>
          </span>
        </div>

        <div style={{ padding: 18, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* ── Columna izquierda: quién es y qué ha pasado ── */}
          <div style={{ flex: '1 1 380px', display: 'grid', gap: 12, minWidth: 0 }}>
            <div style={CAJA}>
              <div style={ROT}>Quién es</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                {[['Sucursales', ctx?.sucursales ?? '—'], ['Giro', ctx?.giro || '—'], ['Etapa', ctx?.etapa || '—']].map(([k, v]) => (
                  <span key={String(k)}>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a5a2af' }}>{k}</span>
                    <b style={{ fontSize: 17 }}>{String(v)}</b>
                  </span>
                ))}
              </div>
              {ctx?.proximoPaso && <div style={{ fontSize: 12.5, color: C.moradoTinta, marginTop: 9, fontWeight: 700 }}>Pendiente: {ctx.proximoPaso}</div>}
            </div>

            {/* LLAMADAS ANTERIORES con su desenlace, no sólo el conteo: «la
                última cayó al buzón» y «la última habló seis minutos» piden
                saludos distintos. */}
            <div style={CAJA}>
              <div style={ROT}>Lo que ya le llamamos</div>
              {!(ctx?.previas || []).length ? <div style={{ fontSize: 13, color: C.g500 }}>Es la primera vez.</div> : (
                <div style={{ display: 'grid', gap: 5 }}>
                  {ctx.previas.map((l: any, i: number) => (
                    <div key={i} style={{ fontSize: 12.5, display: 'flex', gap: 9, alignItems: 'baseline' }}>
                      <span style={{ color: '#a5a2af', minWidth: 52 }}>{dia(l.started_at)}</span>
                      <b style={{ color: l.duracion_seg > 20 ? '#1E8A63' : C.g500 }}>{l.duracion_seg > 20 ? `habló ${reloj(l.duracion_seg)}` : l.estado}</b>
                      <span style={{ color: C.g500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.minuta || l.resultado || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LO ÚLTIMO QUE SE LE ESCRIBIÓ, textual. Llamar sin saberlo es cómo
                uno se contradice a los diez segundos de empezar. */}
            <div style={CAJA}>
              <div style={ROT}>Lo último que se dijeron</div>
              {!(ctx?.mensajes || []).length ? <div style={{ fontSize: 13, color: C.g500 }}>Nada por WhatsApp todavía.</div> : (
                <div style={{ display: 'grid', gap: 6, maxHeight: 210, overflowY: 'auto' }}>
                  {ctx.mensajes.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                      <b style={{ color: m.direccion === 'entrante' ? '#1E8A63' : C.moradoTinta }}>{m.direccion === 'entrante' ? 'Él' : 'Tú'}</b>
                      <span style={{ color: '#a5a2af' }}> · {dia(m.created_at)} · </span>
                      <span style={{ color: '#33313d' }}>{m.cuerpo || `(${m.tipo})`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Columna derecha: lo que haces DURANTE la llamada ── */}
          <div style={{ flex: '1 1 340px', display: 'grid', gap: 12, minWidth: 0 }}>
            <div style={CAJA}>
              <div style={ROT}>Apunta mientras hablas</div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={6}
                placeholder="Lo que diga, tal cual. Se guarda solo."
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
              <div style={{ fontSize: 11, color: guardado === 'ok' ? '#1E8A63' : '#a5a2af', marginTop: 5, fontWeight: 700 }}>
                {guardado === 'ok' ? 'Guardado' : guardado === 'guardando' ? 'Guardando…' : 'Se guarda solo mientras escribes'}
              </div>
            </div>

            {/* AGENDAR CON HORARIOS REALES. «Te mando la liga» es donde se
                enfrían las citas: si ya lo tienes al teléfono, la fecha se
                cierra ahí o no se cierra. */}
            <div style={CAJA}>
              <div style={ROT}>Agendar</div>
              {horarios === null ? (
                <>
                  <button onClick={verHorarios} style={{ border: `1.5px solid ${C.morado}`, background: '#fff', color: C.moradoTinta, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                    Ver los horarios que tengo libres
                  </button>
                  <button onClick={mandarLiga} disabled={ligaEnviada}
                    style={{ border: 'none', background: 'none', color: ligaEnviada ? '#1E8A63' : C.g500, fontSize: 12.5, fontWeight: 700, cursor: ligaEnviada ? 'default' : 'pointer', fontFamily: 'inherit', padding: '8px 0 0', width: '100%' }}>
                    {ligaEnviada ? 'Liga enviada por WhatsApp' : 'O mándale la liga por WhatsApp ahora'}
                  </button>
                </>
              ) : !horarios.length ? (
                <div style={{ fontSize: 12.5, color: C.g500 }}>No hay horarios libres en los próximos días. Queda como «volver a llamar» y lo cuadras después.</div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {horarios.map((h: any, i: number) => (
                    <span key={i} style={{ background: C.moradoAgua, color: C.moradoTinta, borderRadius: 999, padding: '6px 11px', fontSize: 12, fontWeight: 700 }}>
                      {new Date(`${h.fecha}T${h.hora}:00`).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* NO SE CUELGA SIN DECIR QUÉ PASÓ. El resultado es lo que alimenta
                la etapa, el seguimiento y los informes; pedirlo después, cuando
                ya colgaste y vas por el siguiente, es pedirlo para nunca. */}
            <div style={{ ...CAJA, borderColor: resultado ? C.g200 : '#f0c4bd' }}>
              <div style={ROT}>¿Qué pasó? · hace falta para colgar</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RESULTADOS.map(r => (
                  <button key={r.id} onClick={() => setResultado(r.id)}
                    style={{ border: `1px solid ${resultado === r.id ? r.tono : C.g200}`, background: resultado === r.id ? '#fff' : '#fff',
                      color: resultado === r.id ? r.tono : C.g500, borderRadius: 999, padding: '6px 12px', fontSize: 12.5,
                      fontWeight: resultado === r.id ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{r.l}</button>
                ))}
              </div>
              {/* «Volver a llamar» sin fecha es la promesa que ya nos costó
                  esta gente: si se elige, se pide el día. */}
              {resultado === 'volver' && (
                <label style={{ display: 'block', marginTop: 9 }}>
                  <span style={{ ...ROT, marginBottom: 4 }}>¿Qué día le vuelves a marcar?</span>
                  <input type="date" value={volverEl} min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setVolverEl(e.target.value)}
                    style={{ border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit' }} />
                </label>
              )}
              {msg && <div style={{ fontSize: 12, color: '#C0554E', marginTop: 8, fontWeight: 700 }}>{msg}</div>}
            </div>

            <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: C.g500, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 6 }}>
              Esconder la sala (la llamada sigue)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
