/* LO QUE EL CLIENTE PIDIÓ EN LA LLAMADA · el panel, una sola vez.
 *
 * Lo usan las DOS pantallas donde se cierra una llamada:
 *   · `SalaLlamada.tsx` — las entrantes y las que se marcan a mano.
 *   · `Cabina.tsx`      — Llamadas inteligentes, al colgar con una persona.
 *
 * Nació dentro de la sala y se sacó el mismo día, en cuanto hizo falta en la
 * cabina: dos copias de esto serían dos paneles que en un mes ya no se parecen
 * —y cada arreglo, dos veces— sobre algo que MANDA WHATSAPPS A CLIENTES.
 *
 * Quién trae los datos: si el padre ya está preguntando por la llamada (la
 * sala lo hace cada 3 s para pintar lo que se oye), pasa `acciones` y este
 * panel no pide nada. Si no (la cabina), pregunta él solo. Dos pantallas
 * consultando lo mismo a la vez sería pagar dos veces por el mismo dato.
 */
import { useEffect, useRef, useState } from 'react';
import { C } from './estilo';

export type Accion = {
  id: string; accion: string; etiqueta: string; auto: boolean; frase: string | null;
  origen: string; estado: string; resultado: string | null; params: any; aprendido_de?: string | null;
  pide: { campo: string; etiqueta: string; tipo: string; valor?: string }[];
  pide_texto: boolean; envio_id: string | null;
};

type Props = {
  callId: string;
  /** Si el padre ya las trae, este panel no consulta. */
  acciones?: Accion[];
  onAcciones?: (a: Accion[]) => void;
  /** La última frase del CLIENTE, para que lo dictado se aprenda. */
  fraseCliente?: string | null;
  /** Sin el campo de dictar ni los atajos: sólo lo que pidió y su resultado. */
  soloLectura?: boolean;
  /** Menos aire: dentro de la cabina, que ya es una columna angosta. */
  compacto?: boolean;
};

const ATAJOS: [string, string][] = [
  ['mandar_info', 'Mandar info'],
  ['mandar_cotizacion', 'Mandar cotización'],
  ['volver_a_llamar', 'Volver a llamar'],
  ['no_llamar', 'No llamarle más'],
];

export default function AccionesLlamada({ callId, acciones: deFuera, onAcciones, fraseCliente, soloLectura, compacto }: Props) {
  const [propias, setPropias] = useState<Accion[]>([]);
  const acciones = deFuera ?? propias;
  const [haciendo, setHaciendo] = useState('');
  const [msg, setMsg] = useState('');
  const [dictado, setDictado] = useState('');
  const [campos, setCampos] = useState<Record<string, Record<string, string>>>({});
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const solo = deFuera === undefined;
  const vivo = useRef(true);

  useEffect(() => () => { vivo.current = false; }, []);

  /* Pulso propio sólo si nadie más está preguntando. */
  useEffect(() => {
    if (!solo || !callId) return;
    let sigue = true;
    const tira = async () => {
      const j = await fetch(`/api/crm/telefonia/sala?call_id=${encodeURIComponent(callId)}`).then(r => r.json()).catch(() => null);
      if (sigue && j?.acciones) setPropias(j.acciones);
    };
    tira();
    const t = setInterval(tira, 4000);
    return () => { sigue = false; clearInterval(t); };
  }, [callId, solo]);

  const guardar = (as: Accion[]) => { if (deFuera === undefined) setPropias(as); onAcciones?.(as); };

  const api = async (cuerpo: any) => {
    const j = await fetch('/api/crm/telefonia/sala', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, ...cuerpo }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo: revisa la conexión' }));
    if (j?.acciones) guardar(j.acciones);
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
  const responder = async (a: Accion) => {
    const texto = (respuestas[a.id] || '').trim();
    if (texto.length < 10) { setMsg('Escribe al menos una línea: eso es lo que se le manda.'); return; }
    setHaciendo(a.id); setMsg('');
    const j = await api({ accion: 'responder', envio_id: a.envio_id, accion_id: a.id, texto });
    setHaciendo('');
    if (j?.ok) setRespuestas(r => ({ ...r, [a.id]: '' }));
    else setMsg(j?.dicho || j?.motivo || 'No se pudo mandar');
  };
  const dictar = async () => {
    const texto = dictado.trim();
    if (texto.length < 4) { setMsg('Escribe qué había que hacer, aunque sea corto.'); return; }
    setHaciendo('dictado'); setMsg('');
    const j = await api({ accion: 'dictar', texto, frase: fraseCliente || null });
    setHaciendo(''); setDictado('');
    if (j?.error) setMsg(j.error);
    else if (j?.dicho) setMsg(j.ok ? `Hecho · ${j.dicho}` : j.dicho);
  };
  const agregar = async (cual: string) => { setHaciendo(cual); await api({ accion: 'agregar', cual }); setHaciendo(''); };

  const CAJA: any = { background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 14, padding: compacto ? '11px 12px' : '14px 16px' };
  const ROT: any = { fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', marginBottom: 7 };
  const BTN: any = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
  const CAMPO: any = { border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' };

  const hechas = acciones.filter(a => a.estado === 'hecha');
  const abiertas = acciones.filter(a => ['propuesta', 'haciendo', 'pregunta', 'fallo'].includes(a.estado));

  const pintar = (a: Accion) => {
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
        {a.aprendido_de && <div style={{ fontSize: 11, color: '#5B4BD6', marginTop: 3 }}>Aprendido: si alguien dice «{a.aprendido_de}», lo propongo solo.</div>}
        {/* QUÉ PASÓ, no «listo»: el cliente ve cosas distintas si salió por
            plantilla o como mensaje, y quien llamó tiene que saber cuál. */}
        {a.resultado && <div style={{ fontSize: 12, color: hecha ? '#1E8A63' : pregunta ? '#9a6a10' : '#C0554E', fontWeight: 700, marginTop: 5 }}>{a.resultado}</div>}

        {!soloLectura && !hecha && a.pide_texto && a.envio_id && (
          <div style={{ marginTop: 7 }}>
            <textarea rows={3} value={respuestas[a.id] || ''} onChange={e => setRespuestas(r => ({ ...r, [a.id]: e.target.value }))}
              placeholder="Escribe lo que hay que mandarle. Se manda ahora y se guarda para la próxima vez que alguien lo pida."
              style={{ ...CAMPO, width: '100%', lineHeight: 1.5, resize: 'vertical' }} />
            <button disabled={haciendo === a.id} onClick={() => responder(a)} style={{ ...BTN, marginTop: 5, borderColor: C.morado, color: C.moradoTinta }}>
              {haciendo === a.id ? 'Mandando…' : 'Mandarlo y guardarlo'}
            </button>
          </div>
        )}

        {!soloLectura && !hecha && !a.pide_texto && !!a.pide?.length && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {a.pide.map(c => (
              <label key={c.campo} style={{ fontSize: 10.5, color: '#999', fontWeight: 700 }}>
                <span style={{ display: 'block', marginBottom: 2 }}>{c.etiqueta}</span>
                <input type={c.tipo === 'fecha' ? 'date' : c.tipo === 'hora' ? 'time' : 'text'}
                  value={campos[a.id]?.[c.campo] ?? c.valor ?? ''}
                  onChange={e => setCampos(v => ({ ...v, [a.id]: { ...(v[a.id] || {}), [c.campo]: e.target.value } }))}
                  style={{ ...CAMPO, minWidth: c.tipo === 'texto' ? 150 : 118 }} />
              </label>
            ))}
          </div>
        )}

        {!soloLectura && !hecha && !a.pide_texto && (
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
    <div style={{ ...CAJA, borderColor: abiertas.length ? C.morado : C.g200 }}>
      <div style={ROT}>Te pidió algo</div>
      {!acciones.length && (
        <div style={{ fontSize: 12.5, color: C.g500 }}>
          Nada todavía. Si pide algo —«mándame la info», «márcame el jueves»— aparece aquí solo.
        </div>
      )}
      <div style={{ display: 'grid', gap: 7 }}>
        {abiertas.map(pintar)}
        {hechas.map(pintar)}
      </div>

      {/* ══ «SI NO RECONOCES QUÉ ACCIÓN HACER, QUE YO TE EXPLIQUE» ══════════
          Lo que se escriba aquí se HACE ahora y además se guarda como ejemplo:
          la próxima vez que alguien diga esa misma frase, la acción aparece
          sola. Es el mismo ciclo de reglas-como-datos de Trabajo Inteligente. */}
      {!soloLectura && (
        <div style={{ marginTop: 10, borderTop: `1px dashed ${C.g200}`, paddingTop: 10 }}>
          <div style={{ ...ROT, marginBottom: 5 }}>¿Pidió algo que no ves aquí?</div>
          <textarea rows={2} value={dictado} onChange={e => setDictado(e.target.value)}
            placeholder="Dime qué había que hacer: «mándale el PDF de precios», «agéndale demo el jueves a las 4»…"
            style={{ ...CAMPO, width: '100%', lineHeight: 1.5, resize: 'vertical' }} />
          <button disabled={haciendo === 'dictado'} onClick={dictar} style={{ ...BTN, marginTop: 5, borderColor: C.morado, color: C.moradoTinta }}>
            {haciendo === 'dictado' ? 'Haciéndolo…' : 'Hazlo y apréndelo'}
          </button>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
            {ATAJOS.map(([id, l]) => (
              <button key={id} disabled={!!haciendo || acciones.some(a => a.accion === id)} onClick={() => agregar(id)}
                style={{ ...BTN, padding: '5px 9px', fontSize: 11.5, opacity: acciones.some(a => a.accion === id) ? 0.4 : 1 }}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: msg.startsWith('Hecho') ? '#1E8A63' : '#C0554E', marginTop: 8, fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}
