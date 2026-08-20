// Ajustes de correo — la primera pantalla y el candado de todo lo demás.
//
// Mientras falte algo obligatorio, las otras secciones enseñan el aviso y no
// dejan enviar. Aquí se ve QUÉ falta y se arregla; nada de mensajes genéricos.
//
// Todo lo de esta pantalla es del INQUILINO: cuando un partner use la
// herramienta, verá su propio remitente, su logo y su dirección.
import { useEffect, useState } from 'react';
import { S, Aviso, Cargando, Tag, chip, BotonCopiar } from './ui';

export default function ConfigEmail({ onCambio }: { onCambio?: () => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);
  const [dns, setDns] = useState<any>(null);
  const [verificando, setVerificando] = useState(false);
  const [seccion, setSeccion] = useState<'remitente' | 'legal' | 'cadencia' | 'dominio'>('remitente');

  const cargar = () => fetch('/api/crm/email/config').then(r => r.json()).then(j => {
    setCfg(j); setForm(j.tenant || {});
  }).catch(() => setCfg({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  useEffect(() => { fetch('/api/crm/email/verificar-dominio').then(r => r.json()).then(setDns).catch(() => {}); }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function guardar(extra: any = {}) {
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch('/api/crm/email/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...extra }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg({ tipo: 'malo', texto: j.error || 'No se pudo guardar' }); return; }
      setCfg((c: any) => ({ ...c, tenant: j.tenant, faltantes: j.faltantes }));
      setForm(j.tenant); setMsg({ tipo: 'ok', texto: 'Guardado' });
      onCambio?.();
    } finally { setGuardando(false); }
  }

  async function verificar() {
    setVerificando(true);
    try {
      const r = await fetch('/api/crm/email/verificar-dominio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setDns(await r.json());
    } finally { setVerificando(false); }
  }

  if (!cfg) return <Cargando que="la configuración" />;
  const faltan: string[] = cfg.faltantes || [];
  const t = form;

  const campo = (k: string, etiqueta: string, ayuda?: string, tipo = 'text') => (
    <div style={{ marginBottom: 13 }}>
      <span style={S.lbl}>{etiqueta}</span>
      <input type={tipo} value={t[k] ?? ''} onChange={e => set(k, e.target.value)} style={S.inp} />
      {ayuda && <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 4, lineHeight: 1.5 }}>{ayuda}</div>}
    </div>
  );

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Ajustes de correo</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>
            Quién manda, cómo se ve el pie legal y cada cuánto puedes escribirle a una persona
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {faltan.length === 0
            ? <Tag tono="ok">LISTO PARA ENVIAR</Tag>
            : <Tag tono="aviso">{faltan.length} PENDIENTE{faltan.length > 1 ? 'S' : ''}</Tag>}
        </div>
      </div>

      {faltan.length > 0 && (
        <Aviso tono="aviso" titulo="Falta esto para poder enviar correos">
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{faltan.map(f => <li key={f}>{f}</li>)}</ul>
        </Aviso>
      )}
      {!cfg.entorno?.proveedor_listo && <Aviso tono="malo" titulo="Falta la llave de SendGrid">Agrega <code>SENDGRID_API_KEY</code> en las variables del proyecto. Sin ella no sale ningún correo.</Aviso>}
      {!cfg.entorno?.tokens_listos && <Aviso tono="malo" titulo="Falta el secreto de los links">Agrega <code>EMAIL_TOKEN_SECRET</code> (32+ caracteres). Sin él no se firman los links de baja, y un correo sin baja no se envía.</Aviso>}
      {msg && <Aviso tono={msg.tipo}>{msg.texto}</Aviso>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['remitente', 'Remitente y marca'], ['legal', 'Pie legal'], ['cadencia', 'Cadencia'], ['dominio', 'Dominio de envío']] as const).map(([id, l]) => (
          <button key={id} style={chip(seccion === id)} onClick={() => setSeccion(id as any)}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div style={S.card}>
          {seccion === 'remitente' && (<>
            {campo('nombre', 'Nombre del negocio', 'Aparece en el pie de todos los correos.')}
            {campo('from_nombre', 'Nombre del remitente', 'Lo que la persona ve en su bandeja. Un nombre de persona funciona mejor que uno genérico.')}
            {campo('from_email', 'Correo del remitente', 'Debe estar en un dominio verificado (pestaña "Dominio de envío").', 'email')}
            {campo('reply_to', 'Correo de respuesta', 'A dónde llegan las respuestas si alguien contesta.', 'email')}
            {campo('logo_url', 'URL del logo', 'Se usa en el encabezado de las plantillas.')}
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Color de acento</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={t.color_acento || '#9B8CFA'} onChange={e => set('color_acento', e.target.value)}
                  style={{ width: 44, height: 34, border: '1px solid #e2e4e9', borderRadius: 8, padding: 2, background: '#fff' }} />
                <input value={t.color_acento ?? ''} onChange={e => set('color_acento', e.target.value)} style={{ ...S.inp, width: 120 }} />
              </div>
            </div>
          </>)}

          {seccion === 'legal' && (<>
            {campo('direccion_fisica', 'Dirección física', 'Obligatoria por ley en correo comercial. Va en el pie de cada correo.')}
            {campo('aviso_privacidad_url', 'Liga al aviso de privacidad', 'Se muestra junto al link de baja.')}
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Por qué recibe este correo</span>
              <textarea value={t.motivo_recepcion ?? ''} onChange={e => set('motivo_recepcion', e.target.value)}
                style={{ ...S.inp, minHeight: 64, resize: 'vertical' }} />
              <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 4 }}>
                Explicarlo baja las quejas de spam: la gente marca como spam lo que no recuerda haber pedido.
              </div>
            </div>
            {campo('footer_extra', 'Texto extra del pie', 'Opcional: RFC, razón social, lo que necesites.')}
          </>)}

          {seccion === 'cadencia' && (<>
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Máximo de correos de marketing por persona a la semana</span>
              <input type="number" min={1} max={14} value={t.presion_max_semana ?? 2}
                onChange={e => set('presion_max_semana', Number(e.target.value))} style={{ ...S.inp, width: 110 }} />
              <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 4, lineHeight: 1.5 }}>
                Campañas y embudos suman juntos. Los correos de renovación y cobranza NO cuentan aquí: un tope de
                cortesía no puede costarte una renovación.
              </div>
            </div>
            <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!t.presion_por_empresa} onChange={e => set('presion_por_empresa', e.target.checked)} style={{ marginTop: 3 }} />
              <span style={{ fontSize: '0.8rem' }}>Solo un contacto por empresa al día
                <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 2 }}>Evita que cinco personas de la misma cuenta reciban lo mismo el mismo día.</div>
              </span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 13 }}>
              <div><span style={S.lbl}>Enviar desde</span><input type="time" value={String(t.ventana_inicio || '09:00').slice(0, 5)} onChange={e => set('ventana_inicio', e.target.value)} style={S.inp} /></div>
              <div><span style={S.lbl}>Hasta</span><input type="time" value={String(t.ventana_fin || '19:00').slice(0, 5)} onChange={e => set('ventana_fin', e.target.value)} style={S.inp} /></div>
            </div>
            <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!t.enviar_fines_semana} onChange={e => set('enviar_fines_semana', e.target.checked)} />
              <span style={{ fontSize: '0.8rem' }}>Enviar también sábados y domingos</span>
            </label>
            {campo('limite_diario', 'Límite de correos por día', 'Déjalo vacío para no limitar. Útil al estrenar un dominio: se empieza bajo y se sube.', 'number')}
          </>)}

          {seccion === 'dominio' && (<>
            <div style={{ fontSize: '0.82rem', color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
              Un dominio verificado es lo que separa tu correo del spam: le prueba a Gmail que de verdad eres tú
              quien manda. Agrega estos registros en tu DNS y presiona Verificar.
            </div>
            {dns?.dominio && <div style={{ fontSize: '0.8rem', marginBottom: 10 }}><b>{dns.dominio}</b> {dns.valido ? <Tag tono="ok">VERIFICADO</Tag> : <Tag tono="aviso">FALTAN REGISTROS</Tag>}</div>}
            {(dns?.registros || []).map((r: any, i: number) => (
              <div key={i} style={{ borderTop: '1px solid #f5f4f8', padding: '9px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', width: 46 }}>{r.tipo || 'CNAME'}</span>
                <code style={{ fontSize: '0.7rem', background: '#f7f6fb', padding: '3px 8px', borderRadius: 6, flex: 1, minWidth: 200, wordBreak: 'break-all' }}>
                  {r.host} → {r.valor}
                </code>
                <BotonCopiar texto={String(r.valor)} estilo={{ padding: '4px 10px', fontSize: '0.7rem' }} />
                {r.valido ? <Tag tono="ok">OK</Tag> : <Tag tono="gris">pendiente</Tag>}
              </div>
            ))}
            <button style={{ ...S.btnA, marginTop: 12 }} onClick={verificar} disabled={verificando}>
              {verificando ? 'Verificando…' : 'Verificar ahora'}
            </button>
          </>)}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f5f4f8' }}>
            <button style={{ ...S.btnP, opacity: guardando ? .6 : 1 }} onClick={() => guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.kl}>Estado del envío</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <label style={{ display: 'flex', gap: 9, alignItems: 'center', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700 }}>
                <input type="checkbox" checked={!!t.activo}
                  onChange={e => { set('activo', e.target.checked); guardar({ activo: e.target.checked }); }} />
                {t.activo ? 'Envío activo' : 'Envío apagado'}
              </label>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 8, lineHeight: 1.55 }}>
              Apagarlo detiene TODO envío de marketing al instante — campañas en curso incluidas. Es el freno de mano.
            </div>
          </div>

          <div style={S.card}>
            <div style={S.kl}>Así se verá el pie de tus correos</div>
            <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 12, paddingTop: 14, textAlign: 'center', fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.7 }}>
              <div>{t.motivo_recepcion || 'Recibiste este correo de ' + (t.nombre || 'tu negocio') + '.'}</div>
              <div style={{ marginTop: 3 }}><b style={{ color: '#64748B' }}>{t.nombre || '—'}</b>{t.direccion_fisica ? ' · ' + t.direccion_fisica : ''}</div>
              {t.footer_extra && <div style={{ marginTop: 3 }}>{t.footer_extra}</div>}
              <div style={{ marginTop: 9 }}>
                <span style={{ color: '#2563EB', textDecoration: 'underline' }}>Cancelar suscripción</span>
                <span> · Preferencias</span>
                {t.aviso_privacidad_url && <span> · Aviso de privacidad</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
