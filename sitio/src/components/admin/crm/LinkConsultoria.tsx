// El link de consultoría: para que el cliente agende SOLO, dentro de tus
// horarios de atención y sin encimarse con lo que ya tienes en Google.
//
// Pedido del dueño (21-sep-2026), opción A del prototipo: un botón en
// Reuniones que abre todo en una ventana —el link, los horarios propios de la
// consultoría y el estado de Google—.
//
// Los horarios son SOLO de este tipo de reunión (event_types.schedule_id): las
// demos siguen con el horario general. La primera vez se parte de una copia
// del general, para no arrancar con la semana en blanco.
import { useEffect, useState } from 'react';

const SLUG = 'consultoria';
const DIAS: [string, string][] = [['1', 'Lun'], ['2', 'Mar'], ['3', 'Mié'], ['4', 'Jue'], ['5', 'Vie'], ['6', 'Sáb'], ['0', 'Dom']];
const GRAD = 'linear-gradient(100deg,#7C6BF0,#D9538E)';

const S = {
  btnP: { border: 'none', borderRadius: 10, padding: '9px 16px', background: '#5B4BD6', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnG: { border: '1px solid #dcd8ea', borderRadius: 9, padding: '7px 12px', background: '#fff', color: '#3d3752', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' } as const,
  lb: { fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#9c99a6', marginBottom: 8 } as const,
  hora: { border: '1.5px solid #e4dffb', borderRadius: 8, padding: '4px 6px', fontSize: '0.78rem', background: '#fdfcff', fontFamily: 'inherit', outline: 'none' } as const,
  num: { border: '1.5px solid #e4dffb', borderRadius: 8, padding: '4px 6px', fontSize: '0.78rem', background: '#fdfcff', fontFamily: 'inherit', outline: 'none', width: 62 } as const,
  sec: { padding: '13px 18px', borderBottom: '1px solid #f3f1f8' } as const,
};

type Dia = { enabled: boolean; ranges: { start: string; end: string }[] };

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{ width: 34, height: 19, borderRadius: 10, border: 'none', padding: 0, cursor: 'pointer', position: 'relative', background: on ? '#9B8CFA' : '#ddd', flex: 'none' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

export default function LinkConsultoria({ onCerrar, avisar }: { onCerrar: () => void; avisar: (m: string) => void }) {
  const [et, setEt] = useState<any>(null);
  const [semana, setSemana] = useState<Record<string, Dia> | null>(null);
  const [propio, setPropio] = useState(false);          // ¿ya tiene horario propio?
  const [google, setGoogle] = useState<any>(null);
  const [dur, setDur] = useState(60);
  const [aviso, setAviso] = useState(2);
  const [adelanto, setAdelanto] = useState(60);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cambio, setCambio] = useState(false);
  // Mandar a un cliente
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  const [quien, setQuien] = useState<any>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const tipos = await fetch('/api/scheduling/event-types?activo=true').then(r => r.json());
        const t = (tipos || []).find((x: any) => x.slug === SLUG);
        if (!t) { setError('No existe el tipo «Reunión de consultoría». Créalo en Configuración → Reuniones.'); return; }
        setEt(t); setDur(t.duracion_minutos || 60); setAviso(t.aviso_minimo_horas ?? 2); setAdelanto(t.max_dias_adelanto || 60);
        const [hs, g] = await Promise.all([
          fetch('/api/scheduling/availability?team_member_id=' + t.owner_id).then(r => r.json()).catch(() => null),
          fetch('/api/scheduling/google/status?team_member_id=' + t.owner_id).then(r => r.json()).catch(() => null),
        ]);
        setGoogle(g);
        const lista: any[] = Array.isArray(hs) ? hs : (hs?.schedules || hs?.data || []);
        const suyo = t.schedule_id ? lista.find(s => s.id === t.schedule_id) : null;
        const base = suyo || lista.find(s => s.es_default && s.activo !== false) || lista[0];
        setPropio(!!suyo);
        const w: Record<string, Dia> = {};
        for (const [k] of DIAS) {
          const d = base?.weekly_hours?.[k];
          w[k] = { enabled: !!d?.enabled, ranges: d?.ranges?.length ? d.ranges.map((r: any) => ({ ...r })) : [{ start: '10:00', end: '14:00' }] };
        }
        setSemana(w);
      } catch { setError('No se pudo cargar la consultoría.'); }
    })();
  }, []);

  const origen = typeof window !== 'undefined' ? window.location.origin : 'https://www.sacscloud.com';
  const liga = `${origen}/agendar/${SLUG}`;
  const ligaDe = (c: any) => {
    const p = new URLSearchParams();
    if (c?.email) p.set('email', c.email);
    const n = [c?.nombre, c?.apellido].filter(Boolean).join(' ');
    if (n) p.set('nombre', n);
    return p.toString() ? `${liga}?${p}` : liga;
  };
  const textoWa = (c?: any) => `Hola${c?.nombre ? ' ' + String(c.nombre).split(' ')[0] : ''}, aquí puedes elegir el día y la hora para tu sesión de consultoría con Sacs: ${ligaDe(c)}`;
  const waDe = (c?: any) => {
    const d = String(c?.whatsapp || '').replace(/\D/g, '');
    const n = d.length === 10 ? '52' + d : d;
    return `https://wa.me/${n.length >= 10 ? n : ''}?text=${encodeURIComponent(textoWa(c))}`;
  };

  const setDia = (k: string, f: (d: Dia) => Dia) => { setSemana(s => s ? { ...s, [k]: f(s[k]) } : s); setCambio(true); };

  async function guardar() {
    if (!et || !semana) return;
    // Un rango al revés no se guarda: la página no ofrecería nada ese día y
    // nadie sabría por qué.
    for (const [k, n] of DIAS) {
      const d = semana[k];
      if (d.enabled && d.ranges.some(r => !r.start || !r.end || r.start >= r.end)) { setError(`El ${n} tiene un horario al revés.`); return; }
    }
    setGuardando(true); setError('');
    try {
      /* La columna schedule_id llega con una migración. Si todavía no está,
         el tipo viene sin esa llave: se avisa en vez de crear un horario que
         nadie va a leer. */
      if (!('schedule_id' in et)) {
        setError('Falta un paso en la base (migración 2026-09-22-horario-por-tipo). Los horarios se guardan en cuanto se corra.');
        return;
      }
      let scheduleId = et.schedule_id;
      if (propio && scheduleId) {
        const r = await fetch('/api/scheduling/availability', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scheduleId, weekly_hours: semana, nombre: 'Consultoría' }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'No se guardaron los horarios.');
      } else {
        const r = await fetch('/api/scheduling/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: et.owner_id, weekly_hours: semana, es_default: false }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.id) throw new Error(j?.error || 'No se guardaron los horarios.');
        scheduleId = j.id;
        // El nombre no entra en el POST; se pone aparte para reconocerlo en Configuración.
        await fetch('/api/scheduling/availability', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scheduleId, nombre: 'Consultoría' }) }).catch(() => {});
      }
      const r2 = await fetch('/api/scheduling/event-types', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: et.id, schedule_id: scheduleId, duracion_minutos: dur, aviso_minimo_horas: aviso, max_dias_adelanto: adelanto }) });
      if (!r2.ok) throw new Error((await r2.json().catch(() => ({})))?.error || 'No se guardó la consultoría.');
      setEt((p: any) => ({ ...p, schedule_id: scheduleId })); setPropio(true); setCambio(false);
      avisar('Horarios de consultoría guardados');
    } catch (e: any) { setError(e?.message || 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }

  async function buscar(t: string) {
    setQ(t);
    if (t.trim().length < 2) { setRes([]); return; }
    const j = await fetch('/api/crm/search?q=' + encodeURIComponent(t)).then(r => r.json()).catch(() => null);
    setRes((j?.results || []).filter((r: any) => r.type === 'contact').slice(0, 6));
  }

  async function enviarCorreo() {
    if (!quien) return;
    setEnviando(true);
    const r = await fetch('/api/scheduling/link-enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: quien.id, slug: SLUG }) })
      .then(x => x.json()).catch(() => null);
    setEnviando(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo enviar.'); return; }
    avisar(`Link enviado a ${r.para}`); setQuien(null); setBuscando(false); setQ(''); setRes([]);
  }

  const copiar = async (t: string, m: string) => { try { await navigator.clipboard.writeText(t); avisar(m); } catch { avisar(t); } };

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Link de consultoría" style={{ background: '#fff', borderRadius: 14, width: 'min(620px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 22px 54px rgba(20,15,50,.28)', overflow: 'hidden' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,#F4A8CD)', flex: 'none' }} />
        <div style={{ padding: '14px 18px 11px', borderBottom: '1px solid #f1eff7', flex: 'none' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.015em' }}>Link de consultoría</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>El cliente elige su hora y cae en tu calendario de Google.</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* ── El link ── */}
          <div style={S.sec}>
            <div style={S.lb}>El link</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: '#5B4BD6', background: '#EEECFE', borderRadius: 8, padding: '7px 10px', flex: 1, minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liga.replace(/^https?:\/\/(www\.)?/, '')}</span>
              <button style={S.btnG} onClick={() => copiar(liga, 'Link copiado')}>Copiar</button>
              <a style={S.btnG} href={waDe()} target="_blank" rel="noreferrer">WhatsApp</a>
              <button style={{ ...S.btnG, border: 'none', background: GRAD, color: '#fff' }} onClick={() => setBuscando(v => !v)}>Mandar a un cliente…</button>
            </div>

            {buscando && (
              <div style={{ marginTop: 10, border: '1px solid #ece9f5', borderRadius: 10, padding: 10, background: '#fcfbff' }}>
                {!quien ? (<>
                  <input autoFocus value={q} onChange={e => buscar(e.target.value)} placeholder="Busca por nombre, correo o WhatsApp…"
                    style={{ ...S.hora, width: '100%', padding: '8px 10px', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                  {res.map(r => (
                    <button key={r.id} onClick={() => setQuien(r)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 6px', borderBottom: '1px solid #f3f1f8', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{[r.nombre, r.apellido].filter(Boolean).join(' ') || '(sin nombre)'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9c99a6' }}>{[r.email, r.whatsapp].filter(Boolean).join(' · ') || 'sin correo ni WhatsApp'}</div>
                    </button>
                  ))}
                  {q.trim().length >= 2 && !res.length && <div style={{ fontSize: '0.75rem', color: '#a5a2af', padding: '8px 4px' }}>Nadie coincide con «{q}».</div>}
                </>) : (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{[quien.nombre, quien.apellido].filter(Boolean).join(' ')}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9c99a6' }}>El link lleva su nombre y correo ya puestos.</div>
                    </div>
                    {quien.whatsapp && <a style={S.btnG} href={waDe(quien)} target="_blank" rel="noreferrer">Por WhatsApp</a>}
                    {quien.email && <button style={{ ...S.btnP, padding: '7px 13px', fontSize: '0.76rem' }} disabled={enviando} onClick={enviarCorreo}>{enviando ? 'Enviando…' : 'Por correo'}</button>}
                    <button style={S.btnG} onClick={() => copiar(ligaDe(quien), 'Link con sus datos copiado')}>Copiar</button>
                    <button style={{ ...S.btnG, border: 'none', color: '#8d8a97' }} onClick={() => setQuien(null)}>otro</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Horarios de atención ── */}
          <div style={S.sec}>
            <div style={{ ...S.lb, display: 'flex' }}>Horarios de atención · solo consultoría
              {!propio && semana && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#9a6a10' }}>hoy usa tu horario general</span>}
            </div>
            {!semana && !error && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Cargando…</div>}
            {semana && DIAS.map(([k, n]) => {
              const d = semana[k];
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0', flexWrap: 'wrap' }}>
                  <span style={{ width: 34, fontSize: '0.8rem', fontWeight: 700 }}>{n}</span>
                  <Switch on={d.enabled} onClick={() => setDia(k, x => ({ ...x, enabled: !x.enabled }))} />
                  {!d.enabled && <span style={{ fontSize: '0.76rem', color: '#b5b2bf' }}>no atiendo</span>}
                  {d.enabled && d.ranges.map((r, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <input type="time" step={900} value={r.start} style={S.hora}
                        onChange={e => setDia(k, x => ({ ...x, ranges: x.ranges.map((y, j) => j === i ? { ...y, start: e.target.value } : y) }))} />
                      –
                      <input type="time" step={900} value={r.end} style={S.hora}
                        onChange={e => setDia(k, x => ({ ...x, ranges: x.ranges.map((y, j) => j === i ? { ...y, end: e.target.value } : y) }))} />
                      {d.ranges.length > 1 && (
                        <button title="Quitar" onClick={() => setDia(k, x => ({ ...x, ranges: x.ranges.filter((_, j) => j !== i) }))}
                          style={{ border: 'none', background: 'none', color: '#b5b2bf', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}>×</button>
                      )}
                    </span>
                  ))}
                  {d.enabled && d.ranges.length < 3 && (
                    <button onClick={() => setDia(k, x => ({ ...x, ranges: [...x.ranges, { start: x.ranges[x.ranges.length - 1]?.end || '16:00', end: '18:00' }] }))}
                      style={{ border: 'none', background: 'none', color: '#5B4BD6', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit' }}>+ otro horario</button>
                  )}
                </div>
              );
            })}
            {semana && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.76rem', color: '#555', marginTop: 10, alignItems: 'center' }}>
                <span>Dura <input type="number" min={15} max={240} step={15} value={dur} style={S.num} onChange={e => { setDur(Number(e.target.value) || 60); setCambio(true); }} /> min</span>
                <span>Aviso mínimo <input type="number" min={0} max={72} value={aviso} style={S.num} onChange={e => { setAviso(Number(e.target.value) || 0); setCambio(true); }} /> h</span>
                <span>Hasta <input type="number" min={1} max={180} value={adelanto} style={S.num} onChange={e => { setAdelanto(Number(e.target.value) || 60); setCambio(true); }} /> días adelante</span>
              </div>
            )}
          </div>

          {/* ── Google ── */}
          <div style={{ ...S.sec, borderBottom: 'none' }}>
            {google?.connected ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#EAF8F2', border: '1px solid #cdeedd', borderRadius: 10, padding: '9px 12px', fontSize: '0.78rem', color: '#1E6B4E' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#1E8A63', flex: 'none' }} />
                <span><b>Ligado a {google.email}.</b> No ofrece horas donde ya tienes algo en tu calendario.</span>
              </div>
            ) : google ? (
              <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '9px 12px', fontSize: '0.78rem', color: '#C0554E' }}>
                <b>Google Calendar no está conectado.</b> El link ofrecería horas aunque tengas algo. Conéctalo en Configuración → Reuniones → Agenda.
              </div>
            ) : null}
          </div>

          {error && <div style={{ margin: '0 18px 12px', background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.77rem', color: '#C0554E', lineHeight: 1.5 }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 18px 14px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flex: 'none' }}>
          {cambio && <span style={{ fontSize: '0.72rem', color: '#9a6a10', marginRight: 'auto' }}>Cambios sin guardar</span>}
          <button style={S.btnG} onClick={onCerrar}>Cerrar</button>
          <button style={{ ...S.btnP, opacity: guardando || !semana ? .6 : 1 }} disabled={guardando || !semana} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar horarios'}</button>
        </div>
      </div>
    </div>
  );
}
