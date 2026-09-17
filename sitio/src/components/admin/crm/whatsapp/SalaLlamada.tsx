/* LA SALA DE LA LLAMADA · lo que ves mientras hablas, y lo que ves al colgar.
 *
 * PEDIDO DEL DUEÑO (17-sep-2026): «cuando el cliente responda, que me aparezca
 * una pantalla, un modal bonito y grande, con el contexto de lo que se ha
 * hablado con la persona, las sucursales, la marca en grande, si hemos tenido
 * otras llamadas anteriormente, y la parte de agendar una reunión… Todo el
 * proceso similar al que tenemos automatizado en llamadas inteligentes.»
 *
 * Y EL SEGUNDO PEDIDO, el mismo día, después de una llamada real: «me pidió
 * una acción: enviar la información por WhatsApp. En el momento en que alguien
 * pida una acción, la IA tiene que ejecutar esa acción. Debes explicar qué
 * acción hiciste o, si no reconoces qué acción hacer, que yo te explique cuál
 * deberías hacer para que aprendas… Al momento de que yo responda, me tiene
 * que mostrar una pantalla completa con toda esta información.»
 *
 * DE AHÍ SALEN LAS DOS MITADES DE ESTA PANTALLA:
 *  · VIVA: quién es, qué se le ha dicho, lo que se está oyendo ahora mismo, y
 *    las acciones que pidió —hechas o a un clic—, más el campo para dictarle
 *    a la máquina lo que no reconoció (y que ahí aprende).
 *  · AL COLGAR: la misma pantalla se queda y se vuelve el resumen completo —lo
 *    que se hizo, lo que la IA propone cerrar— en vez de desaparecer dejando
 *    un toast. Una llamada que se evapora al colgar es una llamada que se
 *    escribe de memoria media hora después, o no se escribe.
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
import { useIsMobile } from '../../../../lib/ui/mobile';

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
  /** Ya se colgó: la sala se queda, pero como resumen. */
  fin?: boolean;
};

const RESULTADOS: { id: string; l: string; tono: string }[] = [
  { id: 'interesado', l: 'Le interesa', tono: '#1E8A63' },
  { id: 'agendado', l: 'Quedamos de vernos', tono: '#1E8A63' },
  { id: 'volver', l: 'Volver a llamar', tono: '#9a6a10' },
  { id: 'no_interesa', l: 'No le interesa', tono: '#C0554E' },
  { id: 'no_era', l: 'No era él', tono: '#74727F' },
];

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
/* «+52 56 1035 3669» NO es un nombre. Quien llama de fuera llega sin nombre y
   en el camino alguien lo sustituye por el teléfono legible; si eso gana, la
   ficha —que sí tiene el nombre— nunca se enseña. Es exactamente lo que
   reportó el dueño: «me aparecía el nombre de la empresa, no el de la persona». */
const esNumero = (s?: string | null) => !String(s || '').trim() || /^[+\d\s()\-.]+$/.test(String(s));
const dia = (f: any) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');

type Accion = {
  id: string; accion: string; etiqueta: string; auto: boolean; frase: string | null;
  origen: string; estado: string; resultado: string | null; params: any; aprendido_de?: string | null;
  pide: { campo: string; etiqueta: string; tipo: string; valor?: string }[];
  pide_texto: boolean; envio_id: string | null;
};

export default function SalaLlamada({ telefono, callId, nombre, segundos, nota, setNota, onColgar, onSilenciar, mudo, onCerrar, fin }: Props) {
  /* En el teléfono esto NO es un modal: es la pantalla. Un recuadro centrado
     con el CRM asomando por los bordes, en 390 píxeles, se lee como algo que
     se va a cerrar solo — y aquí es donde se trabaja la llamada. */
  const esMovil = useIsMobile();
  const [ctx, setCtx] = useState<any>(null);
  const [horarios, setHorarios] = useState<any[] | null>(null);
  const [resultado, setResultado] = useState('');
  const [volverEl, setVolverEl] = useState('');
  const [guardado, setGuardado] = useState<'no' | 'guardando' | 'ok'>('no');
  const [msg, setMsg] = useState('');

  /* Lo que el servidor está oyendo y lo que ya detectó que el cliente pidió. */
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [oido, setOido] = useState<any[]>([]);
  const [cierre, setCierre] = useState<any>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [haciendo, setHaciendo] = useState('');
  const [dictado, setDictado] = useState('');
  const [campos, setCampos] = useState<Record<string, Record<string, string>>>({});
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [cerrando, setCerrando] = useState(false);
  const [aplicado, setAplicado] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(`/api/crm/telefonia/contexto?telefono=${encodeURIComponent(telefono)}`)
      .then(r => r.json()).then(j => j?.hay && setCtx(j)).catch(() => {});
  }, [telefono]);

  /* ══ EL PULSO DE LA SALA ═══════════════════════════════════════════════
     Cada 3 s se pregunta qué se ha oído y qué acciones aparecieron. Tres
     segundos es el punto donde una petición («mándame la info») se ve casi
     inmediata sin convertir la pantalla en un ventilador de red. Se para en
     cuanto se cuelga: ahí ya no llega nada nuevo. */
  useEffect(() => {
    if (!callId || fin) return;
    let vivo = true;
    let veces = 0;
    let t: any = null;
    const tira = async () => {
      veces++;
      const j = await fetch(`/api/crm/telefonia/sala?call_id=${encodeURIComponent(callId)}`).then(r => r.json()).catch(() => null);
      if (!vivo) return;
      if (j?.hay) {
        setAcciones(j.acciones || []);
        setOido(j.oido || []);
        setItemId(j.item_id || null);
        if (j.cierre?.estado) setCierre(j.cierre);
      }
      /* Se pregunta cada 3 s los primeros cinco minutos —que es cuando se
         deciden las cosas— y cada 8 s si la llamada se alarga. Una llamada de
         cuarenta minutos a tres segundos son ochocientas consultas para ver lo
         mismo. */
      if (vivo) t = setTimeout(tira, veces > 100 ? 8000 : 3000);
    };
    tira();
    return () => { vivo = false; if (t) clearTimeout(t); };
  }, [callId, fin]);

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

  /* ══ LO QUE TE PIDIÓ, HECHO EN EL MOMENTO ══════════════════════════════
     Todo pasa por el mismo endpoint y todo vuelve con la lista de acciones ya
     actualizada: una sola fuente de verdad en pantalla, aunque la acción la
     haya disparado el servidor al oírla y no tú. */
  const api = async (cuerpo: any) => {
    const j = await fetch('/api/crm/telefonia/sala', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, ...cuerpo }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo: revisa la conexión' }));
    if (j?.acciones) setAcciones(j.acciones);
    return j;
  };

  const hacer = async (a: Accion) => {
    setHaciendo(a.id); setMsg('');
    const j = await api({ accion: 'hacer', accion_id: a.id, params: campos[a.id] || {} });
    setHaciendo('');
    if (j?.error) setMsg(j.error);
    else if (j && j.ok === false && j.dicho) setMsg(j.dicho);
  };
  const descartar = async (a: Accion) => { setHaciendo(a.id); await api({ accion: 'descartar', accion_id: a.id }); setHaciendo(''); };

  const dictar = async () => {
    const texto = dictado.trim();
    if (texto.length < 4) { setMsg('Escribe qué había que hacer, aunque sea corto.'); return; }
    setHaciendo('dictado'); setMsg('');
    /* La frase del CLIENTE que nadie cazó viaja junto al dictado: es LO QUE SE
       APRENDE. Sin ella sólo se hace la acción de esta vez. */
    const suya = [...oido].reverse().find(o => o.quien !== 'vendedor')?.texto || null;
    const j = await api({ accion: 'dictar', texto, frase: suya });
    setHaciendo('');
    setDictado('');
    if (j?.error) setMsg(j.error);
    else if (j?.dicho) setMsg(j.ok ? `Hecho · ${j.dicho}` : j.dicho);
  };

  const responder = async (a: Accion) => {
    const texto = (respuestas[a.id] || '').trim();
    if (texto.length < 10) { setMsg('Escribe al menos una línea: eso es lo que se le manda.'); return; }
    setHaciendo(a.id); setMsg('');
    const j = await api({ accion: 'responder', envio_id: a.envio_id, accion_id: a.id, texto });
    setHaciendo('');
    if (j?.ok) setRespuestas(r => ({ ...r, [a.id]: '' }));
    else setMsg(j?.dicho || j?.motivo || 'No se pudo mandar');
  };

  const agregar = async (cual: string) => {
    setHaciendo(cual);
    await api({ accion: 'agregar', cual });
    setHaciendo('');
  };

  /* ══ COLGAR ════════════════════════════════════════════════════════════
     Se cuelga el audio PRIMERO —el cliente no tiene por qué esperar a que el
     CRM escriba— y después se cierra la llamada en el servidor: item cerrado y
     cierre con IA pedido. La pantalla se queda enseñando el resultado. */
  const cerrarLlamada = async () => {
    if (!resultado) { setMsg('Di qué pasó antes de colgar: es lo que alimenta todo lo demás.'); return; }
    setMsg(''); setCerrando(true);
    onColgar();
    if (callId) {
      await fetch('/api/crm/telefonia/nota', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, texto: nota, resultado, volver_el: volverEl || null }),
      }).catch(() => {});
      const j = await api({ accion: 'cerrar', resultado, nota });
      if (j?.item_id) setItemId(j.item_id);
      if (j?.cierre) setCierre(j.cierre);
    }
    setCerrando(false);
  };

  const aplicarCierre = async () => {
    setCerrando(true);
    const j = await api({ accion: 'aplicar', item_id: itemId, resultado, nota });
    setCerrando(false);
    if (j?.hecho) setAplicado(j.hecho);
    else setMsg(j?.error || 'No se pudo aplicar el cierre');
  };

  const CAJA: any = { background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 14, padding: '14px 16px' };
  const ROT: any = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', marginBottom: 7 };
  const BTN: any = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
  const CAMPO: any = { border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' };

  /* Quién es, en una sola decisión y no repartida por la pantalla. */
  const persona = ctx?.nombre || (esNumero(nombre) ? null : nombre);
  const titulo = ctx?.marca || ctx?.empresa || persona || telefonoLegible(telefono);
  const hechas = acciones.filter(a => a.estado === 'hecha');
  const abiertas = acciones.filter(a => ['propuesta', 'haciendo', 'pregunta', 'fallo'].includes(a.estado));
  const p = cierre?.propuesta;

  /* Lo que se está oyendo, aparte: en el escritorio va en la columna de la
     izquierda y en el TELÉFONO arriba del todo, pegado a las acciones. Es lo
     único que se mira mientras se habla. */
  /* ══ LO QUE SE ESTÁ OYENDO ═════════════════════════════════════════════
     No es un adorno: es la prueba de que la máquina oye lo mismo que tú.
     Cuando propone una acción rara, aquí se ve por qué. */
  const bloqueOido = (oido.length > 0 || !fin) ? (
              <div style={{ ...CAJA, background: fin ? '#fff' : '#FCFBFF' }}>
                <div style={{ ...ROT, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {fin ? 'Lo que se dijo' : 'Lo que se está oyendo'}
                  {!fin && <span style={{ width: 7, height: 7, borderRadius: 999, background: oido.length ? '#1E8A63' : '#d8d5e4', display: 'inline-block' }} />}
                </div>
                {!oido.length ? (
                  <div style={{ fontSize: 12.5, color: C.g500 }}>
                    Todavía nada. La transcripción tarda unos segundos en arrancar; si no llega, la llamada igual se graba y la minuta cae al colgar.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 4, maxHeight: fin ? 320 : 180, overflowY: 'auto' }}>
                    {oido.map((o, i) => (
                      <div key={i} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                        <b style={{ color: o.quien === 'vendedor' ? C.moradoTinta : '#1E8A63' }}>{o.quien === 'vendedor' ? 'Tú' : 'Él'}</b>
                        <span style={{ color: '#33313d' }}> · {o.texto}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
  ) : null;

  /* LOS CHIPS DE «¿QUÉ PASÓ?» · se usan en dos sitios: en su caja mientras
     hablas, y DENTRO del bloque de cierre cuando colgó el cliente — ahí tienen
     que estar pegados al botón que los necesita, no al final de la columna. */
  const quePaso = (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RESULTADOS.map(r => (
          <button key={r.id} onClick={() => setResultado(r.id)}
            style={{ border: `1px solid ${resultado === r.id ? r.tono : C.g200}`, background: '#fff',
              color: resultado === r.id ? r.tono : C.g500, borderRadius: 999, padding: '6px 12px', fontSize: 12.5,
              fontWeight: resultado === r.id ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{r.l}</button>
        ))}
      </div>
      {/* «Volver a llamar» sin fecha es la promesa que ya nos costó esta gente:
          si se elige, se pide el día. */}
      {resultado === 'volver' && (
        <label style={{ display: 'block', marginTop: 9 }}>
          <span style={{ ...ROT, marginBottom: 4 }}>¿Qué día le vuelves a marcar?</span>
          <input type="date" value={volverEl} min={new Date().toISOString().slice(0, 10)}
            onChange={e => setVolverEl(e.target.value)}
            style={{ border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit' }} />
        </label>
      )}
    </>
  );

  /* ── Una acción, con lo que le falte para poder salir ─────────────────── */
  const pintarAccion = (a: Accion) => {
    const hecha = a.estado === 'hecha';
    /* «No sé qué mandarle» no es un error: es una pregunta. Va en ámbar, no en
       rojo, porque lo único que hace falta es que alguien escriba una línea. */
    const pregunta = a.estado === 'pregunta' || a.pide_texto;
    const borde = hecha ? '#cbe8db' : a.estado === 'fallo' ? '#f0c4bd' : pregunta ? '#f0d9b0' : C.g200;
    return (
      <div key={a.id} style={{ border: `1px solid ${borde}`, background: hecha ? '#F4FBF8' : pregunta ? '#FFFCF6' : '#fff', borderRadius: 10, padding: '9px 11px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <b style={{ fontSize: 12.5, color: hecha ? '#1E8A63' : '#33313d', flex: 1 }}>{hecha ? '✓ ' : ''}{a.etiqueta}</b>
          {a.origen === 'dictada' && <span style={{ fontSize: 10, color: '#a5a2af', fontWeight: 700 }}>se lo dictaste</span>}
          {a.origen === 'aprendida' && <span style={{ fontSize: 10, color: '#a5a2af', fontWeight: 700 }}>lo aprendió de ti</span>}
        </div>
        {/* LA EVIDENCIA: la frase con la que se disparó. Sin ella, quien acaba
            de colgar no puede saber si la máquina entendió bien. */}
        {a.frase && <div style={{ fontSize: 11.5, color: C.g500, fontStyle: 'italic', marginTop: 3 }}>«{a.frase}»</div>}
        {/* Lo que quedó aprendido: la próxima vez que un cliente diga eso, esta
            acción se propone sola. Se enseña para que se pueda desmentir. */}
        {a.aprendido_de && <div style={{ fontSize: 11, color: '#5B4BD6', marginTop: 3 }}>Aprendido: si alguien dice «{a.aprendido_de}», lo propongo solo.</div>}
        {/* QUÉ PASÓ, no «listo»: el cliente ve cosas distintas si salió por
            plantilla o como mensaje, y quien llamó tiene que saber cuál. */}
        {a.resultado && <div style={{ fontSize: 12, color: hecha ? '#1E8A63' : pregunta ? '#9a6a10' : '#C0554E', fontWeight: 700, marginTop: 5 }}>{a.resultado}</div>}

        {/* No sabíamos qué mandarle: se escribe aquí, sale ahora y queda guardado. */}
        {!hecha && a.pide_texto && a.envio_id && (
          <div style={{ marginTop: 7 }}>
            <textarea rows={3} value={respuestas[a.id] || ''} onChange={e => setRespuestas(r => ({ ...r, [a.id]: e.target.value }))}
              placeholder="Escribe lo que hay que mandarle. Se manda ahora y se guarda para la próxima vez que alguien lo pida."
              style={{ ...CAMPO, width: '100%', lineHeight: 1.5, resize: 'vertical' }} />
            <button disabled={haciendo === a.id} onClick={() => responder(a)} style={{ ...BTN, marginTop: 5, borderColor: C.morado, color: C.moradoTinta }}>
              {haciendo === a.id ? 'Mandando…' : 'Mandarlo y guardarlo'}
            </button>
          </div>
        )}

        {/* Lo que le falta para poder salir (fecha de un compromiso, el dato a
            corregir, quién es la otra persona). */}
        {!hecha && !a.pide_texto && !!a.pide?.length && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {a.pide.map(c => (
              <label key={c.campo} style={{ fontSize: 10.5, color: '#999', fontWeight: 700 }}>
                <span style={{ display: 'block', marginBottom: 2 }}>{c.etiqueta}</span>
                <input type={c.tipo === 'fecha' ? 'date' : c.tipo === 'hora' ? 'time' : 'text'}
                  value={campos[a.id]?.[c.campo] ?? c.valor ?? ''}
                  onChange={e => setCampos(v => ({ ...v, [a.id]: { ...(v[a.id] || {}), [c.campo]: e.target.value } }))}
                  style={{ ...CAMPO, minWidth: c.tipo === 'texto' ? 160 : 120 }} />
              </label>
            ))}
          </div>
        )}

        {!hecha && !a.pide_texto && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button disabled={!!haciendo} onClick={() => hacer(a)} style={{ ...BTN, background: C.morado, color: '#fff', border: 'none' }}>
              {haciendo === a.id ? 'Haciéndolo…' : a.estado === 'fallo' ? 'Intentarlo otra vez' : 'Hacerlo'}
            </button>
            <button disabled={!!haciendo} onClick={() => descartar(a)} style={{ ...BTN, color: C.g500 }}>No era eso</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {!esMovil && <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,11,18,.55)', zIndex: 980 }} />}
      <div role="dialog" aria-label={fin ? 'Resumen de la llamada' : 'Llamada en curso'} style={esMovil ? {
        position: 'fixed', inset: 0, zIndex: 1001, overflowY: 'auto', background: C.g50,
        paddingBottom: 'env(safe-area-inset-bottom)', WebkitOverflowScrolling: 'touch',
      } : {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(1040px, 96vw)', maxHeight: '92vh', overflowY: 'auto', zIndex: 981,
        background: C.g50, borderRadius: 20, boxShadow: '0 24px 70px rgba(12,11,18,.4)',
      }}>
        {/* ══ LA CABECERA: la marca en grande, que es lo que se pidió primero.
            Es lo que dice en voz alta quien contesta, y equivocarla en el
            saludo cuesta la llamada entera. */}
        <div style={{
          padding: esMovil ? '14px 16px 12px' : '20px 24px 16px', background: '#fff',
          borderRadius: esMovil ? 0 : '20px 20px 0 0', borderBottom: `1px solid ${C.g200}`,
          display: 'flex', alignItems: 'center', gap: esMovil ? 10 : 16, flexWrap: 'wrap',
          ...(esMovil ? { position: 'sticky', top: 0, zIndex: 2, paddingTop: 'max(14px, env(safe-area-inset-top))' } : {}),
        }}>
          <span style={{ width: 54, height: 54, borderRadius: 16, background: fin ? C.g100 : C.moradoAgua, color: fin ? C.g500 : C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
            {reloj(segundos)}
          </span>
          <span style={{ flex: '1 1 260px', minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{titulo}</b>
            {/* EL NOMBRE SALE DEL CONTEXTO CUANDO NO VIENE EN LA LLAMADA.
                En una ENTRANTE, Twilio sólo trae el número: `enganchar()` la
                registra con `nombre = null`, así que la sala pintaba la marca
                —que sí viene de la ficha— y a la persona no. Lo reportó el
                dueño: «me aparecía el nombre de la empresa pero no el de la
                persona». El contexto ya lo traía; sólo no se estaba mirando. */}
            <span style={{ display: 'block', fontSize: 13, color: C.g500, marginTop: 3 }}>
              {/* Sin repetir el título: cuando no hay marca, el nombre YA está
                  arriba en grande y volver a ponerlo abajo se lee como un error. */}
              {[persona === titulo ? null : persona, ctx?.puesto, telefonoLegible(telefono), ctx?.ciudad].filter(Boolean).join(' · ')}
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
            {!fin && (
              <>
                <button onClick={onSilenciar} style={{ border: `1px solid ${C.g200}`, background: mudo ? '#FFF4E5' : '#fff', color: mudo ? '#9a6a10' : C.g700, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {mudo ? 'Estás en mudo' : 'Silenciar'}
                </button>
                <button onClick={cerrarLlamada} disabled={cerrando} style={{ border: 'none', background: '#C0554E', color: '#fff', borderRadius: esMovil ? 999 : 10, padding: esMovil ? '12px 22px' : '9px 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {cerrando ? 'Cerrando…' : 'Colgar'}
                </button>
              </>
            )}
            {fin && (
              <button onClick={onCerrar} style={{ border: 'none', background: C.morado, color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Listo</button>
            )}
          </span>
        </div>

        <div style={{ padding: 18, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* ── Columna izquierda: quién es y qué ha pasado ── */}
          <div style={{ flex: '1 1 380px', display: 'grid', gap: 12, minWidth: 0 }}>
            {!esMovil && bloqueOido}
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
              {/* QUIEN LLAMA SIN FICHA. Pasa seguido en las entrantes y es
                  justo cuando la pantalla parecía vacía: se dice qué es lo que
                  no hay, en vez de enseñar guiones. */}
              {!ctx && <div style={{ fontSize: 12.5, color: C.g500 }}>Este número no está en el CRM. Al colgar queda la llamada con su grabación; si es alguien que vale, créalo desde el inbox.</div>}
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

          {/* ── Columna derecha: lo que haces DURANTE la llamada ──
              En el teléfono va PRIMERO (`order: -1`): con una sola columna, lo
              que el cliente acaba de pedir no puede estar a tres pantallas de
              scroll de distancia. */}
          <div style={{ flex: '1 1 340px', display: 'grid', gap: 12, minWidth: 0, order: esMovil ? -1 : 0 }}>
            {esMovil && bloqueOido}
            {/* ══ AL COLGAR: EL CIERRE ════════════════════════════════════
                Lo que la IA leyó de la llamada, propuesto para confirmar. Si no
                hay IA —sin saldo, o la transcripción no alcanzó— se dice con
                todas sus letras en vez de fingir que no había nada que cerrar:
                las acciones que sí se hicieron siguen arriba, hechas. */}
            {fin && (
              <div style={{ ...CAJA, borderColor: C.morado }}>
                <div style={ROT}>Cerrar la llamada</div>
                {/* La IA tarda unos diez segundos en leer la llamada entera.
                    Se dice cuánto, o el silencio se lee como que se colgó. */}
                {cerrando && <div style={{ fontSize: 12.5, color: C.g500 }}>Leyendo la llamada… (unos diez segundos)</div>}
                {/* COLGÓ ÉL Y NADIE CERRÓ. Es el caso NORMAL —el que cuelga
                    suele ser el cliente— y antes dejaba la llamada abierta sin
                    apunte ni compromiso. Se pide el desenlace de arriba y se
                    cierra desde aquí. Si se cierra la pestaña sin hacerlo, el
                    latido la cierra solo a los dos minutos: esto es para que lo
                    haga quien estuvo en la llamada, que sabe más que la IA. */}
                {!cerrando && !aplicado && !cierre && (
                  <>
                    <div style={{ fontSize: 12.5, color: C.g500, lineHeight: 1.6, marginBottom: 9 }}>
                      La llamada terminó. Dime qué pasó y la cierro: apunte, compromisos y lo que quedó de mandar.
                    </div>
                    {quePaso}
                    <button onClick={cerrarLlamada} disabled={!resultado}
                      style={{ ...BTN, marginTop: 9, background: resultado ? C.morado : C.g100, color: resultado ? '#fff' : C.g500, border: 'none', width: '100%', cursor: resultado ? 'pointer' : 'default' }}>
                      {resultado ? 'Cerrar la llamada' : 'Elige qué pasó para cerrarla'}
                    </button>
                  </>
                )}
                {!cerrando && aplicado && (
                  <div style={{ fontSize: 12.5, color: '#1E8A63', fontWeight: 700, lineHeight: 1.7 }}>
                    {aplicado.length ? aplicado.map((h, i) => <div key={i}>✓ {h}</div>) : <div>✓ Quedó cerrada.</div>}
                  </div>
                )}
                {!cerrando && !aplicado && cierre && p && (
                  <>
                    <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p.nota}</div>
                    {p.siguiente_paso && <div style={{ fontSize: 12.5, color: C.moradoTinta, fontWeight: 700, marginTop: 6 }}>Sigue: {p.siguiente_paso}</div>}
                    {!!(p.compromisos || []).length && (
                      <div style={{ fontSize: 12.5, marginTop: 6 }}>{p.compromisos.map((c: any, i: number) => (
                        <div key={i}>📅 {c.tipo === 'reunion' ? 'Reunión' : 'Llamada'} el {c.fecha} a las {c.hora}</div>
                      ))}</div>
                    )}
                    {!!(p.envios || []).length && (
                      <div style={{ fontSize: 12.5, marginTop: 6 }}>{p.envios.map((e: any, i: number) => (
                        <div key={i}>📎 Mandarle {e.tema}{e.estado === 'falta' ? ' (no sabemos qué: te lo va a preguntar)' : ''}</div>
                      ))}</div>
                    )}
                    {!!(p.datos || []).length && <div style={{ fontSize: 12.5, marginTop: 6 }}>✍️ Datos: {p.datos.map((d: any) => `${d.campo} = ${d.valor}`).join(' · ')}</div>}
                    <button onClick={aplicarCierre} style={{ ...BTN, marginTop: 9, background: C.morado, color: '#fff', border: 'none', width: '100%' }}>Aplicar el cierre</button>
                  </>
                )}
                {!cerrando && !aplicado && cierre && !p && (
                  <div style={{ fontSize: 12.5, color: C.g500, lineHeight: 1.6 }}>
                    {/* El error de facturación de Anthropic llega en inglés y
                        con su JSON: aquí se dice en una frase lo que significa
                        y qué hay que hacer, que es cargarle saldo. */}
                    {/credit balance|billing|quota/i.test(cierre?.motivo || '')
                      ? 'No hay saldo de IA, así que nadie leyó la llamada por ti (se carga en console.anthropic.com).'
                      : cierre?.motivo ? `La IA no pudo cerrarla: ${cierre.motivo}.`
                      : 'No hubo suficiente conversación transcrita para cerrar con IA.'}
                    {' '}Tu apunte y el desenlace ya quedaron guardados, y lo que se hizo en la llamada está arriba.
                  </div>
                )}
              </div>
            )}

            {/* ══ LO QUE TE PIDIÓ ════════════════════════════════════════
                El corazón del pedido: lo que el cliente pide se hace AHORA y
                queda escrito qué pasó. Las seguras (mandar material, un
                recordatorio) ya salieron solas cuando se oyeron; las que tocan
                la ficha, la agenda o la baja esperan un clic. */}
            <div style={{ ...CAJA, borderColor: abiertas.length ? C.morado : C.g200 }}>
              <div style={ROT}>Te pidió algo</div>
              {!acciones.length && (
                <div style={{ fontSize: 12.5, color: C.g500 }}>
                  Nada todavía. Si pide algo —«mándame la info», «márcame el jueves»— aparece aquí solo.
                </div>
              )}
              <div style={{ display: 'grid', gap: 7 }}>
                {abiertas.map(pintarAccion)}
                {hechas.map(pintarAccion)}
              </div>

              {/* ══ «SI NO RECONOCES QUÉ ACCIÓN HACER, QUE YO TE EXPLIQUE» ══
                  Lo que se escriba aquí se HACE ahora y además se guarda como
                  ejemplo: la próxima vez que alguien diga esa misma frase, la
                  acción aparece sola. Es el mismo ciclo de reglas-como-datos
                  de Trabajo Inteligente, no un modelo nuevo. */}
              {/* También DESPUÉS de colgar: acordarse de lo que pidió es algo
                  que pasa justo al colgar, y entonces todavía se puede hacer. */}
              {(
                <div style={{ marginTop: 10, borderTop: `1px dashed ${C.g200}`, paddingTop: 10 }}>
                  <div style={{ ...ROT, marginBottom: 5 }}>¿Pidió algo que no ves aquí?</div>
                  <textarea rows={2} value={dictado} onChange={e => setDictado(e.target.value)}
                    placeholder="Dime qué había que hacer: «mándale el PDF de precios», «agéndale demo el jueves a las 4»…"
                    style={{ ...CAMPO, width: '100%', lineHeight: 1.5, resize: 'vertical' }} />
                  <button disabled={haciendo === 'dictado'} onClick={dictar} style={{ ...BTN, marginTop: 5, borderColor: C.morado, color: C.moradoTinta }}>
                    {haciendo === 'dictado' ? 'Haciéndolo…' : 'Hazlo y apréndelo'}
                  </button>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {[['mandar_info', 'Mandar info'], ['mandar_cotizacion', 'Mandar cotización'], ['volver_a_llamar', 'Volver a llamar'], ['no_llamar', 'No llamarle más']].map(([id, l]) => (
                      <button key={id} disabled={!!haciendo || acciones.some(a => a.accion === id)} onClick={() => agregar(id)}
                        style={{ ...BTN, padding: '5px 9px', fontSize: 11.5, opacity: acciones.some(a => a.accion === id) ? 0.4 : 1 }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {msg && <div style={{ fontSize: 12, color: msg.startsWith('Hecho') ? '#1E8A63' : '#C0554E', marginTop: 8, fontWeight: 700 }}>{msg}</div>}
            </div>

            <div style={CAJA}>
              <div style={ROT}>{fin ? 'Tu apunte' : 'Apunta mientras hablas'}</div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={fin ? 3 : 6}
                placeholder="Lo que diga, tal cual. Se guarda solo."
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
              <div style={{ fontSize: 11, color: guardado === 'ok' ? '#1E8A63' : '#a5a2af', marginTop: 5, fontWeight: 700 }}>
                {guardado === 'ok' ? 'Guardado' : guardado === 'guardando' ? 'Guardando…' : 'Se guarda solo mientras escribes'}
              </div>
            </div>

            {/* AGENDAR CON HORARIOS REALES. «Te mando la liga» es donde se
                enfrían las citas: si ya lo tienes al teléfono, la fecha se
                cierra ahí o no se cierra. */}
            {!fin && (
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
            )}

            {/* NO SE CUELGA SIN DECIR QUÉ PASÓ. El resultado es lo que alimenta
                la etapa, el seguimiento y los informes; pedirlo después, cuando
                ya colgaste y vas por el siguiente, es pedirlo para nunca.
                Cuando colgó el otro, estos mismos chips viven arriba, dentro
                del bloque de cierre. */}
            {!fin && (
              <div style={{ ...CAJA, borderColor: resultado ? C.g200 : '#f0c4bd' }}>
                <div style={ROT}>¿Qué pasó? · hace falta para colgar</div>
                {quePaso}
              </div>
            )}

            {!fin && (
              <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: C.g500, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 6 }}>
                Esconder la sala (la llamada sigue)
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
