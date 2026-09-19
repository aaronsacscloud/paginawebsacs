/* LAS GRABACIONES DE LAS LLAMADAS · buscarlas, oírlas y sacarte a ti solo.
 *
 * PEDIDO DEL DUEÑO (19-sep-2026): «todo hay que grabarlo, porque quiero usar
 * esto luego para pasarlo a ElevenLabs y clonar mi voz junto al pitch que hago,
 * para optimizar la llamada inicial».
 *
 * Eso pide dos cosas que no existían:
 *
 * 1. PODER BUSCARLAS. El audio sólo se alcanzaba desde la tarjeta de la llamada
 *    que tenías delante. Para clonar una voz hacen falta varias grabaciones
 *    buenas, de días distintos, elegidas a oído.
 *
 * 2. SACAR UNA SOLA VOZ. Y esto es lo que de verdad decide si el clon sale
 *    bien: las llamadas se graban en DUAL —una pista por persona, que es como
 *    Twilio las entrega— pero el archivo es un estéreo con las dos. Subir eso a
 *    ElevenLabs es pedirle que aprenda de dos personas hablando encima; el clon
 *    sale turbio y con el timbre del teléfono del otro.
 *
 *    Aquí se separa en el navegador: se decodifica el mp3, se toma UNA pista y
 *    se escribe un WAV mono. Sin servidor, sin ffmpeg y sin subir nada a
 *    ninguna parte — el audio ya está en la máquina de quien lo pide.
 *
 *    Cuál pista es cuál depende de cómo se armó la llamada, así que no se
 *    adivina: se ofrecen las dos, se oyen antes de bajarlas y cada una dice
 *    cuánto habló. La que más habla en una llamada de ventas suele ser la tuya.
 */
import { useEffect, useRef, useState } from 'react';
import { P as C } from '../../../../lib/crm/paleta';
import { telefonoLegible } from '../../../../lib/telefono';

const etiqueta: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: C.g400, marginBottom: 5 };
const btnS: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1.5px solid #9B8CFA', borderRadius: 9, padding: '6px 12px', background: '#fff', fontSize: '0.76rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' };
const campo: React.CSSProperties = { border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', width: '100%' };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Un WAV mono de 16 bits a partir de una pista. Es lo que ElevenLabs quiere:
 *  sin comprimir, una sola voz y sin metadatos de por medio. */
function wavDeUnCanal(datos: Float32Array, hz: number): Blob {
  const n = datos.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (pos: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, hz, true); v.setUint32(28, hz * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, datos[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Cuánto se habla en cada pista: la energía media, en porcentaje relativo.
 *  Sirve para saber cuál eres tú sin tener que oír las dos cada vez. */
function cuantoHabla(a: AudioBuffer): number[] {
  const por = [] as number[];
  for (let c = 0; c < a.numberOfChannels; c++) {
    const d = a.getChannelData(c);
    let suma = 0;
    // Una de cada cien muestras alcanza de sobra y evita congelar la pestaña.
    for (let i = 0; i < d.length; i += 100) suma += Math.abs(d[i]);
    por.push(suma / Math.max(1, d.length / 100));
  }
  const tot = por.reduce((a2, b) => a2 + b, 0) || 1;
  return por.map(x => Math.round((x / tot) * 100));
}

type Grab = { call_id: string; telefono: string; nombre: string; direccion: string; segundos: number; cuando: string; resultado: string | null; url: string; tiene_transcripcion: boolean };

export default function Grabaciones({ movil }: { movil?: boolean }) {
  const [grabs, setGrabs] = useState<Grab[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busca, setBusca] = useState('');
  const [dias, setDias] = useState(30);
  const [minSeg, setMinSeg] = useState(30);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pistas, setPistas] = useState<Record<string, { canales: number; reparto: number[] }>>({});
  const [bajando, setBajando] = useState('');
  const [error, setError] = useState('');
  const audios = useRef<Record<string, AudioBuffer>>({});

  const traer = () => {
    setCargando(true);
    fetch(`/api/crm/telefonia/grabaciones?dias=${dias}&min=${minSeg}${busca ? `&busca=${encodeURIComponent(busca)}` : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setGrabs(j.grabaciones || []); setError(j.error || ''); })
      .catch(() => setError('No se pudieron traer las grabaciones'))
      .finally(() => setCargando(false));
  };
  useEffect(traer, [dias, minSeg]);

  /* Se decodifica UNA vez por grabación y se guarda: volver a bajar y decodificar
     un mp3 de veinte minutos cada vez que se pica un botón es medio segundo de
     pestaña congelada por clic. */
  const preparar = async (g: Grab) => {
    if (audios.current[g.call_id]) return audios.current[g.call_id];
    const bruto = await fetch(g.url).then(r => r.arrayBuffer());
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = await ctx.decodeAudioData(bruto);
    ctx.close().catch(() => {});
    audios.current[g.call_id] = buf;
    setPistas(p => ({ ...p, [g.call_id]: { canales: buf.numberOfChannels, reparto: cuantoHabla(buf) } }));
    return buf;
  };

  const abrir = async (g: Grab) => {
    setAbierta(abierta === g.call_id ? null : g.call_id);
    setError('');
    if (abierta !== g.call_id) { try { await preparar(g); } catch { setError('No se pudo leer el audio de esa llamada'); } }
  };

  const bajarPista = async (g: Grab, canal: number) => {
    setError(''); setBajando(`${g.call_id}-${canal}`);
    try {
      const buf = await preparar(g);
      const wav = wavDeUnCanal(buf.getChannelData(Math.min(canal, buf.numberOfChannels - 1)), buf.sampleRate);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(wav);
      a.download = `${(g.nombre || g.telefono).replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'llamada'}-pista${canal + 1}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { setError('No se pudo separar la pista de esa llamada'); }
    finally { setBajando(''); }
  };

  const total = grabs.reduce((a, g) => a + g.segundos, 0);

  return (
    <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22, display: 'grid', gap: 14, alignContent: 'start' }}>
      <div>
        <b style={{ fontSize: 17, letterSpacing: '-0.02em' }}>Grabaciones de tus llamadas</b>
        <div style={{ fontSize: 12.5, color: C.g500, marginTop: 3, lineHeight: 1.5 }}>
          Cada conversación con una persona se graba sola, con una pista por voz. Ábrela para oírla y
          bájate <b>sólo tu voz</b> en WAV: es lo que ElevenLabs necesita para clonarla bien.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 220px' }}>
          <span style={etiqueta}>Buscar</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && traer()}
            placeholder="Nombre o teléfono" style={campo} />
        </label>
        <label>
          <span style={etiqueta}>Cuándo</span>
          <select value={dias} onChange={e => setDias(Number(e.target.value))} style={{ ...campo, width: 'auto' }}>
            <option value={7}>Última semana</option>
            <option value={30}>Último mes</option>
            <option value={90}>Últimos 3 meses</option>
            <option value={365}>Todo</option>
          </select>
        </label>
        <label>
          <span style={etiqueta}>Duración</span>
          <select value={minSeg} onChange={e => setMinSeg(Number(e.target.value))} style={{ ...campo, width: 'auto' }}>
            <option value={0}>Todas</option>
            <option value={30}>Más de 30 s</option>
            <option value={120}>Más de 2 min</option>
            <option value={300}>Más de 5 min</option>
          </select>
        </label>
        <button onClick={traer} style={btnS}>Buscar</button>
      </div>

      {error && <div style={{ background: '#FEF0EF', border: '1px solid #F3C9C6', color: '#C0554E', borderRadius: 10, padding: '9px 12px', fontSize: 12.5 }}>{error}</div>}

      <div style={{ fontSize: 11.5, color: C.g500 }}>
        {cargando ? 'Buscando…' : `${grabs.length} ${grabs.length === 1 ? 'grabación' : 'grabaciones'} · ${fmt(total)} de audio`}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {grabs.map(g => {
          const info = pistas[g.call_id];
          return (
            <div key={g.call_id} style={{ background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 11, padding: '11px 13px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.g900 }}>{g.nombre || telefonoLegible(g.telefono)}</div>
                  <div style={{ fontSize: 11.5, color: C.g500 }}>
                    {new Date(g.cuando).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{fmt(g.segundos)}
                    {g.direccion === 'entrante' ? ' · entrante' : ''}
                    {g.tiene_transcripcion ? ' · con transcripción' : ''}
                  </div>
                </div>
                <button onClick={() => abrir(g)} style={btnS}>{abierta === g.call_id ? 'Cerrar' : 'Oírla'}</button>
              </div>

              {abierta === g.call_id && (
                <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                  <audio src={g.url} controls preload="none" style={{ width: '100%', height: 36 }} />
                  {info && info.canales > 1 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <span style={etiqueta}>Bájate una sola voz (para clonarla)</span>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {Array.from({ length: info.canales }).map((_, c) => (
                          <button key={c} onClick={() => bajarPista(g, c)} disabled={!!bajando}
                            style={{ ...btnS, borderColor: info.reparto[c] >= 50 ? '#4FBF95' : '#9B8CFA', color: info.reparto[c] >= 50 ? '#1E8A63' : '#5B4BD6' }}>
                            {bajando === `${g.call_id}-${c}` ? 'Separando…' : `Pista ${c + 1} · habla el ${info.reparto[c]}%`}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: C.g500, lineHeight: 1.5 }}>
                        La que más habla en una llamada de ventas suele ser la tuya — va marcada en verde. Si al
                        oírla resulta ser la otra, baja la de al lado: no se adivina, se comprueba.
                      </div>
                    </div>
                  ) : info ? (
                    <div style={{ fontSize: 11.5, color: '#9a6a10' }}>
                      Esta grabación trae una sola pista con las dos voces mezcladas, así que no se puede separar.
                      Sirve para oírla, no para clonar.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: C.g500 }}>Preparando las pistas…</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!cargando && !grabs.length && (
          <div style={{ background: '#fff', border: `1px dashed ${C.g200}`, borderRadius: 11, padding: '18px 14px', textAlign: 'center', fontSize: 12.5, color: C.g500 }}>
            No hay grabaciones con esos filtros. Las llamadas se graban desde que alguien contesta,
            así que las de hoy aparecen aquí en cuanto cuelgues.
          </div>
        )}
      </div>
    </div>
  );
}
