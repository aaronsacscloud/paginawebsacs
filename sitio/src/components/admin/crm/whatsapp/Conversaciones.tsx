// FICHA · Conversaciones: lo conectado y lo que pasó fuera, en un solo lugar.
//
// Medido el 12-sep-2026: de 85 clientes activos, 82 no tenían ni un mensaje ni
// una llamada en su historial. No es que no se les hable — se les habla por un
// grupo de WhatsApp, por un celular o por teléfono, y nada de eso llegaba al
// CRM. La ficha decía «sin conversación registrada» sobre cuentas que se
// atienden todos los días, y de esa evidencia depende si la cuenta conserva su
// tasa en la renovación.
//
// El trato con quien captura: TÚ PEGAS, ELLA CONVIERTE. Y el reparto importa —
// el chat se lee aquí (conteos, fechas, participantes: eso es dato) y la IA
// solo redacta. Del chat se guarda el RESUMEN, no el texto: un grupo trae
// gente que no es del cliente y conversación que no es del negocio.
import { useEffect, useState } from 'react';
import Cargando from '../ui/Cargando';
import { confirmar } from '../../../../lib/ui/confirmar';

const S = {
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '15px 17px', marginBottom: 12 } as const,
  cardM: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: '15px 17px', marginBottom: 12 } as const,
  h: { fontSize: '0.65rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '.9px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  n: { marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' },
  lbl: { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#9c99a6', display: 'block', marginBottom: 4 },
  inp: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '9px 11px', fontSize: '0.8rem', background: '#fdfcff', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const, color: '#241d43' } as const,
  btnV: { border: 'none', background: '#1E8A63', color: '#fff', borderRadius: 9, padding: '8px 15px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnP: { border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 9, padding: '8px 15px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnG: { border: '1px solid #ddd', background: '#fff', color: '#333', borderRadius: 9, padding: '7px 13px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as const,
};
const chip = (bg: string, fg: string) => ({ display: 'inline-block', fontSize: '0.63rem', fontWeight: 700, borderRadius: 20, padding: '2px 9px', background: bg, color: fg, whiteSpace: 'nowrap' as const });

const TONO: Record<string, { t: string; bg: string; fg: string }> = {
  bien: { t: 'de buenas', bg: '#EAF8F2', fg: '#1E8A63' },
  neutral: { t: 'normal', bg: '#f4f3f7', fg: '#6b7280' },
  molesto: { t: 'molesto', bg: '#FEF0EF', fg: '#C0554E' },
  'en espera': { t: 'esperando algo', bg: '#FFF4E5', fg: '#9a6a10' },
};

const fecha = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  : '';
const corta = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '')
  : '';

export default function Conversaciones({ companyId, contactId }: { companyId: string; contactId?: string | null }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = () => fetch('/api/crm/conversaciones?company_id=' + companyId)
    .then(r => r.json()).then(j => setLista(j.conversaciones || [])).catch(() => setLista([]));
  useEffect(() => { setLista(null); cargar(); /* eslint-disable-next-line */ }, [companyId]);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 2800); };

  async function borrar(c: any) {
    if (!await confirmar(`Se borra el registro de «${c.titulo || 'esta conversación'}» y las actividades que generó.\n\nLa cuenta va a volver a verse con menos seguimiento del que tuvo.`)) return;
    await fetch('/api/crm/conversaciones?id=' + c.id, { method: 'DELETE' }).catch(() => {});
    cargar(); flash('Registro borrado');
  }

  async function aGestion(c: any, i: number) {
    const r = await fetch('/api/crm/conversaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'gestion', conversacion_id: c.id, indice: i }),
    }).then(x => x.json()).catch(() => null);
    if (!r || r.error) { flash(r?.error || 'No se pudo crear la gestión'); return; }
    cargar(); flash('Ya está en Consultoría: ' + r.mejora.titulo);
  }

  return (
    <div>
      {msg && <div style={{ background: '#EAF8F2', color: '#1E8A63', borderRadius: 9, padding: '8px 12px', marginBottom: 11, fontSize: '0.79rem', fontWeight: 700 }}>{msg}</div>}

      <div style={S.cardM}>
        <div style={S.h}>Lo que pasó fuera del CRM
          <span style={S.n}>grupos, tu celular, llamadas</span></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={S.btnV} onClick={() => setAbrir(true)}>+ Registrar una conversación</button>
          <span style={{ fontSize: '0.75rem', color: '#8a8590', flex: 1, minWidth: 230, lineHeight: 1.5 }}>
            Pega el chat del grupo o cuenta qué se habló. Se guarda el <b>resumen</b> —no el chat— y
            la cuenta deja de verse sin seguimiento, con la fecha en que de verdad pasó.
          </span>
        </div>
      </div>

      {lista === null && <Cargando texto="Cargando conversaciones…" alto={120} />}

      {lista !== null && lista.length === 0 && (
        <div style={{ ...S.card, color: '#9c99a6', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Todavía no hay ninguna conversación registrada a mano. Si a este cliente lo atiendes por un
          grupo de WhatsApp, aquí es donde eso empieza a contar.
        </div>
      )}

      {(lista || []).map((c: any) => {
        const to = TONO[c.tono] || TONO.neutral;
        const acuerdos = Array.isArray(c.acuerdos) ? c.acuerdos : [];
        const pidio = Array.isArray(c.pidio) ? c.pidio : [];
        return (
          <div key={c.id} style={S.card}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={chip(c.canal === 'llamada' ? '#E3EDFD' : '#EAF8F2', c.canal === 'llamada' ? '#2C5FC4' : '#1E8A63')}>
                {c.canal === 'llamada' ? 'llamada' : 'WhatsApp'}
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, flex: 1, minWidth: 200, color: '#241d43' }}>
                {c.titulo || 'Conversación'}
              </span>
              <span style={chip(to.bg, to.fg)}>{to.t}</span>
              <span style={{ fontSize: '0.72rem', color: '#a5a2af', whiteSpace: 'nowrap' }}>
                {c.desde && c.hasta && c.desde !== c.hasta ? `${corta(c.desde)} – ${corta(c.hasta)}` : fecha(c.hasta || c.desde)}
              </span>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#8a8590', marginTop: 3 }}>
              {c.mensajes > 0
                ? <>{c.mensajes} mensajes · {c.del_cliente} del cliente</>
                : c.minutos ? <>{c.minutos} min</> : null}
              {c.creado_por && <> · lo registró {c.creado_por}</>}
            </div>

            {c.resumen && <div style={{ fontSize: '0.82rem', color: '#3c3748', lineHeight: 1.65, marginTop: 8, maxWidth: '78ch' }}>{c.resumen}</div>}

            {acuerdos.length > 0 && (
              <div style={{ borderTop: '1px solid #f4f3f7', marginTop: 11, paddingTop: 10 }}>
                <span style={S.lbl}>Lo que se acordó</span>
                {acuerdos.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', borderTop: i ? '1px solid #f8f7fb' : 'none', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 210 }}>
                      <div style={{ fontSize: '0.81rem', fontWeight: 700, color: '#241d43' }}>
                        {a.texto}
                        {a.quien && <span style={{ ...chip('#f4f3f7', '#6b7280'), marginLeft: 6 }}>{a.quien === 'cliente' ? 'le toca al cliente' : 'nos toca'}</span>}
                        {a.fecha && <span style={{ ...chip('#FFF4E5', '#9a6a10'), marginLeft: 5 }}>{corta(a.fecha)}</span>}
                      </div>
                      {a.resumen && <div style={{ fontSize: '0.77rem', color: '#71717a', lineHeight: 1.55, marginTop: 2 }}>{a.resumen}</div>}
                    </div>
                    {a.gestion_id
                      ? <span style={chip('#EAF8F2', '#1E8A63')}>ya es gestión</span>
                      : <button style={S.btnG} onClick={() => aGestion(c, i)}>Mandar a gestión</button>}
                  </div>
                ))}
              </div>
            )}

            {pidio.length > 0 && (
              <div style={{ borderTop: '1px solid #f4f3f7', marginTop: 10, paddingTop: 9 }}>
                <span style={S.lbl}>Lo que pidió</span>
                {pidio.map((p: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.79rem', color: '#3c3748', lineHeight: 1.55 }}>
                    · <b>{p.titulo}</b>{p.descripcion ? ` — ${p.descripcion}` : ''}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <button style={{ ...S.btnG, color: '#a5a2af', padding: '5px 10px', fontSize: '0.72rem' }} onClick={() => borrar(c)}>Quitar</button>
            </div>
          </div>
        );
      })}

      {abrir && <Registrar companyId={companyId} contactId={contactId}
        onCerrar={() => setAbrir(false)}
        onListo={(t: string) => { setAbrir(false); flash(t); cargar(); }} />}
    </div>
  );
}

/* ─── El modal: pegar → leer → redactar → guardar ─────────────────────────── */
function Registrar({ companyId, contactId, onCerrar, onListo }: any) {
  const [canal, setCanal] = useState<'whatsapp' | 'llamada'>('whatsapp');
  const [texto, setTexto] = useState('');
  const [fechaManual, setFechaManual] = useState('');
  const [minutos, setMinutos] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [medido, setMedido] = useState<any>(null);
  const [bor, setBor] = useState<any>(null);
  const [iaError, setIaError] = useState('');
  /* Quién de los que hablan es del cliente. Se propone por descarte —los que
     no somos nosotros— y se corrige con un clic: en un grupo hay gente de los
     dos lados y de eso depende el «contestaron», que es la señal. */
  const [suyos, setSuyos] = useState<string[]>([]);
  /* La junta se agenda solo si la persona lo confirma. Que se hayan dicho una
     fecha en el chat no es lo mismo que tenerla en el calendario, y una junta
     inventada le aparece a alguien en su agenda. */
  const [agendar, setAgendar] = useState(true);

  async function analizar() {
    setBusy('analizando'); setError(''); setIaError('');
    const r = await fetch('/api/crm/conversaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'analizar', texto, fecha: fechaManual || null }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo leer.'); return; }
    setMedido(r.medido); setBor(r.borrador); setIaError(r.ia_error || '');
    // De arranque, del cliente son todos menos el que más se parece a nosotros.
    const p = (r.medido?.participantes || []).map((x: any) => x.autor);
    setSuyos(p.filter((a: string) => !/sacs|andrea|aaron|soporte/i.test(a)));
  }

  async function guardar() {
    setBusy('guardando'); setError('');
    /* El desglose por día y lado se arma AQUÍ, no en el servidor: quién es del
       cliente lo acaba de decidir la persona con los chips de arriba, y el
       chat ya no existe fuera de esta pantalla. Del servidor solo vino fecha,
       autor y cuenta — nunca el texto. */
    const porDia: Record<string, { fecha: string; lado: string; n: number }> = {};
    for (const m of (medido?.dias_por_autor || [])) {
      const lado = suyos.includes(m.autor) ? 'cliente' : 'nosotros';
      const k = `${m.fecha}|${lado}`;
      porDia[k] = porDia[k] || { fecha: m.fecha, lado, n: 0 };
      porDia[k].n += Number(m.n) || 0;
    }
    const r = await fetch('/api/crm/conversaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar', company_id: companyId, contact_id: contactId || null,
        canal, titulo: bor.titulo, resumen: bor.resumen,
        acuerdos: bor.acuerdos, pidio: bor.pidio, tono: bor.tono,
        desde: medido?.desde, hasta: medido?.hasta,
        dias: Object.values(porDia),
        participantes: medido?.participantes || [],
        minutos: canal === 'llamada' ? Number(minutos) || null : null,
        reunion: agendar && bor.reunion ? bor.reunion : null,
      }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo guardar.'); return; }
    /* Si la junta no se pudo agendar se dice, aunque el resumen sí se haya
       guardado: callarlo dejaría a alguien creyendo que tiene una cita en el
       calendario que no existe. */
    onListo('Conversación registrada · ' + r.actividades + ' movimientos en el historial'
      + (r.reunion ? ' · y la reunión del ' + fecha(r.reunion.fecha) : '')
      + (r.reunion_error ? ' · OJO: la reunión NO se agendó (' + r.reunion_error + ')' : ''));
  }

  const set = (k: string, v: any) => setBor((b: any) => ({ ...b, [k]: v }));

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Registrar una conversación" style={{
        background: '#fff', borderRadius: 14, width: 'min(700px, 100%)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 22px 54px rgba(20,15,50,.25)',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f1eff7' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.015em' }}>Registrar una conversación</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>
            Se guarda el resumen, no el chat. Las fechas salen del texto.
          </div>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            {([['whatsapp', 'Chat de WhatsApp'], ['llamada', 'Una llamada']] as const).map(([id, l]) => (
              <button key={id} onClick={() => setCanal(id)} style={{
                ...S.btnG, background: canal === id ? '#EEECFE' : '#fff',
                color: canal === id ? '#5B4BD6' : '#555', borderColor: canal === id ? '#ddd6fb' : '#ddd', fontWeight: 700,
              }}>{l}</button>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <span style={S.lbl}>{canal === 'whatsapp' ? 'Pega el chat' : 'Cuenta qué se habló'}</span>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={8}
              placeholder={canal === 'whatsapp'
                ? 'En WhatsApp: abre el grupo → Exportar chat → Sin archivos, y pega aquí lo que salga.'
                : 'Con quién hablaste, qué te dijo y en qué quedaron.'}
              style={{ ...S.inp, resize: 'vertical', fontFamily: canal === 'whatsapp' ? 'ui-monospace, monospace' : 'inherit', fontSize: '0.76rem' }} />
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            {canal === 'llamada' && (<>
              <div style={{ width: 150 }}><span style={S.lbl}>Qué día fue</span>
                <input type="date" value={fechaManual} onChange={e => setFechaManual(e.target.value)} style={S.inp} /></div>
              <div style={{ width: 110 }}><span style={S.lbl}>Minutos</span>
                <input type="number" value={minutos} onChange={e => setMinutos(e.target.value)} placeholder="18" style={S.inp} /></div>
            </>)}
            <button style={{ ...S.btnP, marginLeft: 'auto' }} onClick={analizar} disabled={!!busy || texto.trim().length < 20}>
              {busy === 'analizando' ? 'Leyendo…' : 'Leer y redactar'}
            </button>
          </div>

          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '9px 11px', fontSize: '0.77rem', color: '#C0554E', lineHeight: 1.5 }}>{error}</div>}

          {medido && (
            <div style={{ borderLeft: '3px solid #4FBF95', background: '#F6FCF9', borderRadius: '0 10px 10px 0', padding: '11px 14px', fontSize: '0.79rem', color: '#2b5c48', lineHeight: 1.6, marginBottom: 12 }}>
              {medido.es_chat ? (<>
                <b>{medido.mensajes} mensajes</b> · del <b>{fecha(medido.desde)}</b> al <b>{fecha(medido.hasta)}</b> · {medido.participantes.length} participantes<br />
                <div style={{ marginTop: 6 }}>
                  <span style={{ color: '#4b7a66' }}>¿Quiénes son del cliente? Toca para cambiar:</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                    {medido.participantes.map((p: any) => {
                      const es = suyos.includes(p.autor);
                      return (
                        <button key={p.autor} onClick={() => setSuyos(s => es ? s.filter(x => x !== p.autor) : [...s, p.autor])}
                          style={{ ...chip(es ? '#EAF8F2' : '#f4f3f7', es ? '#1E8A63' : '#6b7280'), border: es ? '1px solid #a9dcc4' : '1px solid #e6e4ee', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {p.autor} ({p.n}){es ? ' · del cliente' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>) : <>Se va a registrar como una conversación del <b>{fecha(medido.desde)}</b>.</>}
            </div>
          )}

          {iaError && (
            <div style={{ background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 9, padding: '9px 11px', fontSize: '0.76rem', color: '#7a5a10', marginBottom: 11, lineHeight: 1.5 }}>
              La redacción automática falló, pero lo medido de arriba es real. Escribe el resumen a
              mano y guarda igual. <span style={{ color: '#a5a2af' }}>({iaError})</span>
            </div>
          )}

          {bor && (<>
            <div style={{ marginBottom: 10 }}><span style={S.lbl}>De qué se trató</span>
              <input value={bor.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Seguimiento de septiembre" style={S.inp} /></div>

            <div style={{ marginBottom: 10 }}><span style={S.lbl}>El resumen · es lo único que se guarda</span>
              <textarea value={bor.resumen} onChange={e => set('resumen', e.target.value)} rows={3} style={{ ...S.inp, resize: 'vertical' }} /></div>

            {bor.acuerdos.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={S.lbl}>Lo que se acordó · cada uno con su resumen para quien lo va a hacer</span>
                {bor.acuerdos.map((a: any, i: number) => (
                  <div key={i} style={{ border: '1px solid #ece7f8', borderRadius: 10, padding: '9px 11px', marginBottom: 7, background: '#fbfaff' }}>
                    <input value={a.texto || ''} onChange={e => set('acuerdos', bor.acuerdos.map((x: any, j: number) => j === i ? { ...x, texto: e.target.value } : x))}
                      style={{ ...S.inp, fontWeight: 700, marginBottom: 6 }} />
                    <textarea value={a.resumen || ''} rows={2}
                      onChange={e => set('acuerdos', bor.acuerdos.map((x: any, j: number) => j === i ? { ...x, resumen: e.target.value } : x))}
                      placeholder="Qué hay que hacer y para qué — esto es lo que se manda a la gestión."
                      style={{ ...S.inp, resize: 'vertical', fontSize: '0.77rem' }} />
                    <div style={{ display: 'flex', gap: 7, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select value={a.quien || 'sacs'} onChange={e => set('acuerdos', bor.acuerdos.map((x: any, j: number) => j === i ? { ...x, quien: e.target.value } : x))}
                        style={{ ...S.inp, width: 'auto', fontSize: '0.73rem', padding: '5px 8px' }}>
                        <option value="sacs">Nos toca</option><option value="cliente">Le toca al cliente</option>
                      </select>
                      <input type="date" value={a.fecha || ''} onChange={e => set('acuerdos', bor.acuerdos.map((x: any, j: number) => j === i ? { ...x, fecha: e.target.value } : x))}
                        style={{ ...S.inp, width: 'auto', fontSize: '0.73rem', padding: '5px 8px' }} />
                      <button onClick={() => set('acuerdos', bor.acuerdos.filter((_: any, j: number) => j !== i))}
                        style={{ ...S.btnG, marginLeft: 'auto', padding: '4px 9px', fontSize: '0.7rem', color: '#a5a2af' }}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {bor.reunion && (
              <div style={{ marginBottom: 10, border: '1.5px solid #cfe0fa', background: '#F6F9FF', borderRadius: 11, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ ...chip('#E3EDFD', '#2C5FC4') }}>quedaron de verse</span>
                  <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#241d43' }}>
                    {fecha(bor.reunion.fecha)} · {bor.reunion.hora}
                  </span>
                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.77rem', color: '#2C5FC4', fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={agendar} onChange={e => setAgendar(e.target.checked)} />
                    Agendarla
                  </label>
                </div>
                <input value={bor.reunion.asunto || ''} onChange={e => set('reunion', { ...bor.reunion, asunto: e.target.value })}
                  placeholder="De qué va la junta" style={{ ...S.inp, marginTop: 8 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                  <input type="date" value={bor.reunion.fecha} onChange={e => set('reunion', { ...bor.reunion, fecha: e.target.value })}
                    style={{ ...S.inp, width: 'auto', fontSize: '0.75rem', padding: '5px 8px' }} />
                  <input type="time" value={bor.reunion.hora} onChange={e => set('reunion', { ...bor.reunion, hora: e.target.value })}
                    style={{ ...S.inp, width: 'auto', fontSize: '0.75rem', padding: '5px 8px' }} />
                  <span style={{ fontSize: '0.71rem', color: '#8a8590', alignSelf: 'center' }}>
                    Queda en Reuniones{bor.reunion.fecha < new Date().toISOString().slice(0, 10) ? ', como ya realizada' : ', agendada'}.
                  </span>
                </div>
              </div>
            )}

            {bor.pidio.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={S.lbl}>Lo que pidió</span>
                {bor.pidio.map((p: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.79rem', color: '#3c3748', padding: '3px 0' }}>· <b>{p.titulo}</b>{p.descripcion ? ` — ${p.descripcion}` : ''}</div>
                ))}
              </div>
            )}
          </>)}
        </div>

        <div style={{ padding: '12px 18px 15px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {bor && <button style={S.btnV} onClick={guardar} disabled={!!busy || !String(bor.resumen || '').trim()}>
            {busy === 'guardando' ? 'Guardando…' : 'Guardar el resumen'}
          </button>}
          {bor && <span style={{ fontSize: '0.72rem', color: '#a5a2af', flex: 1, minWidth: 180 }}>
            El chat no se guarda. Los acuerdos se mandan a gestión desde la ficha, uno por uno.
          </span>}
          <button style={{ ...S.btnG, marginLeft: 'auto' }} onClick={onCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
