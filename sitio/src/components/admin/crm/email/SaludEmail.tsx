// Salud del correo: ¿estoy quemando mi dominio? y ¿esto sirve para vender?
//
// La segunda tabla es la que ninguna herramienta de correo puede dar, porque
// no tiene el CRM: qué campaña produjo reuniones y cuánto ARR tocó.
import { useEffect, useState } from 'react';
import { S, Kpi, Aviso, Cargando, Tag, chip, money, pct, fmtFecha } from './ui';

export default function SaludEmail() {
  const [d, setD] = useState<any>(null);
  const [dias, setDias] = useState(30);
  const [supr, setSupr] = useState<any[] | null>(null);
  const [verSupr, setVerSupr] = useState(false);

  useEffect(() => { setD(null); fetch(`/api/crm/email/salud?dias=${dias}`).then(r => r.json()).then(setD).catch(() => setD({ error: 1 })); }, [dias]);
  useEffect(() => { if (verSupr && !supr) fetch('/api/crm/email/suprimidos').then(r => r.json()).then(j => setSupr(j.suprimidos || [])).catch(() => setSupr([])); }, [verSupr]);

  async function restaurar(email: string) {
    if (!confirm(`¿Volver a enviarle correos a ${email}?`)) return;
    await fetch('/api/crm/email/suprimidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, accion: 'restaurar' }) });
    setSupr(s => (s || []).filter(x => x.email !== email));
  }

  if (!d) return <Cargando que="las métricas" />;
  const g = d.global || {};

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Salud del correo</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>
            Entrega y reputación · y qué produjo cada campaña
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {[7, 30, 90].map(n => <button key={n} style={chip(dias === n)} onClick={() => setDias(n)}>{n} días</button>)}
        </div>
      </div>

      {(d.alertas || []).map((a: any, i: number) => (
        <Aviso key={i} tono={a.nivel === 'urgente' ? 'malo' : 'aviso'} titulo={a.nivel === 'urgente' ? 'Atiende esto antes de la próxima campaña' : undefined}>{a.texto}</Aviso>
      ))}
      {(d.alertas || []).length === 0 && g.enviados > 0 && (
        <Aviso tono="ok">Todo en orden: sin rebotes ni quejas fuera de rango en los últimos {dias} días.</Aviso>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 14 }}>
        <Kpi etiqueta="Enviados" valor={g.enviados ?? 0} sub={`desde ${d.dominio_remitente || '—'}`} />
        <Kpi etiqueta="Entrega" valor={pct(g.tasa_entrega)} sub={`${g.entregados} confirmados por el proveedor`} tono={g.tasa_entrega >= 95 ? 'ok' : undefined} />
        <Kpi etiqueta="Clics" valor={pct(g.tasa_clic)} sub={<>{g.clics} personas · <b>la señal confiable</b></>} tono="acento" />
        <Kpi etiqueta="Rebotes" valor={pct(g.tasa_rebote)} sub={`${g.rebotes} correos · sano por debajo de 2%`} tono={g.tasa_rebote > 2 ? 'malo' : 'ok'} />
        <Kpi etiqueta="Quejas de spam" valor={pct(g.tasa_queja)} sub="Gmail no las reporta aquí" tono={g.tasa_queja > 0.1 ? 'malo' : 'ok'} />
        <Kpi etiqueta="Bajas" valor={g.bajas ?? 0} sub={`${pct(g.tasa_baja)} de lo enviado`} />
      </div>

      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={S.kl}>Aperturas</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4 }}>{pct(g.tasa_apertura)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#8a8a8a' }}>({g.aperturas})</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 260, fontSize: '0.75rem', color: '#8a8a8a', lineHeight: 1.55, borderLeft: '2px solid #f0eff3', paddingLeft: 12 }}>
            Se muestra por completitud, pero <b>no decidas con este número</b>: Apple Mail abre los correos solo y
            Outlook corporativo bloquea las imágenes que lo miden. {d.nota_gmail}
          </div>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 10px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Qué produjo cada campaña</div>
          <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 2 }}>
            Reuniones y ARR de quienes hicieron clic — cruzado con el CRM. Ninguna herramienta de correo puede decirte esto.
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>Campaña</th><th style={S.th}>Enviados</th><th style={S.th}>Clics</th>
              <th style={S.th}>Rebotes</th><th style={S.th}>Bajas</th><th style={S.th}>Reuniones</th><th style={S.th}>ARR tocado</th>
            </tr></thead>
            <tbody>
              {(d.campanas || []).length === 0 && (
                <tr><td style={{ ...S.td, color: '#a5a2af' }} colSpan={7}>Todavía no hay campañas en este periodo.</td></tr>
              )}
              {(d.campanas || []).map((c: any) => (
                <tr key={c.id}>
                  <td style={S.td}><b>{c.nombre}</b> {c.estado !== 'completada' && <Tag tono="info">{c.estado}</Tag>}</td>
                  <td style={S.td}>{c.enviados}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#5B4BD6' }}>{c.clics}</td>
                  <td style={{ ...S.td, color: c.rebotes ? '#C0554E' : undefined }}>{c.rebotes}</td>
                  <td style={S.td}>{c.bajas}</td>
                  <td style={{ ...S.td, fontWeight: 800, color: c.reuniones ? '#1E8A63' : '#c9c7d0' }}>{c.reuniones}</td>
                  <td style={{ ...S.td, fontWeight: 800 }}>{c.arr_tocado ? money(c.arr_tocado) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Quién no recibe correos</div>
            <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 2 }}>
              {g.suprimidos} personas suprimidas · {d.dormidos} sin señales en 180 días (candidatos a limpieza)
            </div>
          </div>
          <button style={{ ...S.btnG, marginLeft: 'auto' }} onClick={() => setVerSupr(v => !v)}>{verSupr ? 'Ocultar' : 'Ver lista'}</button>
        </div>
        {verSupr && (
          <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #f5f4f8' }}>
            {supr === null && <div style={{ padding: 16, color: '#a5a2af', fontSize: '0.8rem' }}>Cargando…</div>}
            {supr?.length === 0 && <div style={{ padding: 16, color: '#a5a2af', fontSize: '0.8rem' }}>Nadie suprimido todavía.</div>}
            {(supr || []).map((s: any) => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f7f6fa', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: '0.79rem', fontWeight: 600 }}>{s.nombre || s.email}</div>
                  <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{s.nombre ? s.email + ' · ' : ''}{fmtFecha(s.created_at)}</div>
                </div>
                <Tag tono={s.riesgoso_restaurar ? 'malo' : 'gris'}>{s.etiqueta}</Tag>
                <button style={{ ...S.btnG, padding: '4px 10px', fontSize: '0.7rem' }}
                  title={s.riesgoso_restaurar ? 'Restaurar a quien marcó spam o rebotó duro daña tu reputación' : undefined}
                  onClick={() => restaurar(s.email)}>Restaurar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
