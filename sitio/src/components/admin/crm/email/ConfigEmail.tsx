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
            {campo('sitio_url', 'Sitio web', '«Visita nuestro sitio web» en el pie y en la firma de todos los correos.')}
            {campo('tiktok_url', 'TikTok', '«Visita nuestro TikTok» en el pie de todos los correos.')}
            <div style={{ marginBottom: 13 }}>
              <span style={S.lbl}>Aviso de confidencialidad</span>
              <textarea value={t.confidencialidad ?? ''} onChange={e => set('confidencialidad', e.target.value)}
                style={{ ...S.inp, minHeight: 64, resize: 'vertical' }} />
            </div>
            {campo('nota_papel', 'Nota del papel', 'La frase de «queremos eliminar el papel». Vacía, no sale.')}
            <div style={{ ...S.kl, marginTop: 6 }}>Firma por defecto</div>
            <div style={{ fontSize: '0.72rem', color: '#8a8a8a', margin: '2px 0 10px', lineHeight: 1.5 }}>
              Se agrega sola al final de cualquier correo que no traiga su bloque de firma. La foto es la misma en todas las cadencias.
            </div>
            {campo('firma_nombre', 'Quién firma', 'Nombre de la persona que firma los correos.')}
            {campo('firma_puesto', 'Puesto', 'Debajo del nombre, p. ej. «Tu consultora en Sacs».')}
            {campo('firma_foto_url', 'Foto de la firma', 'Cuadrada; sale en circulito pequeño junto al nombre.')}
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
            {campo('limite_diario', 'Límite de correos por día', 'Déjalo vacío para no limitar. Es el techo al que llega la rampa de calentamiento.', 'number')}

            <div style={{ borderTop: '1px solid #f0eff4', marginTop: 18, paddingTop: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 3 }}>Reputación del dominio</div>
              <div style={{ fontSize: '0.72rem', color: '#a5a2af', marginBottom: 13, lineHeight: 1.55 }}>
                Lo que evita quemar el dominio: arrancar despacio, ver dónde cae el correo y
                apagarse solo si algo se descompone.
              </div>

              {campo('calentamiento_inicio', 'Empezó a enviar desde este dominio el',
                'Con esta fecha el sistema arranca en 50 correos al día y dobla cada dos días hasta tu límite. Un dominio nuevo que manda miles el primer día es, para Gmail, la definición de spam. Vacío = sin rampa.', 'date')}

              <div style={{ marginBottom: 13 }}>
                <span style={S.lbl}>Direcciones semilla</span>
                <input type="text" value={Array.isArray(t.semillas) ? t.semillas.join(', ') : (t.semillas || '')}
                  onChange={e => set('semillas', e.target.value)} style={S.inp}
                  placeholder="tucorreo@gmail.com, tucorreo@outlook.com" />
                <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 4, lineHeight: 1.5 }}>
                  Una dirección tuya por proveedor. Reciben copia de cada campaña para que
                  <b> veas dónde cayó</b>: bandeja principal, Promociones o spam. Las aperturas no
                  distinguen entre las tres, así que una campaña que se fue entera a spam se ve
                  igual que una que simplemente no interesó. Máximo 10.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 6 }}>
                <div>
                  <span style={S.lbl}>Freno · quejas %</span>
                  <input type="number" step="0.1" value={t.freno_umbral_quejas ?? 0.3}
                    onChange={e => set('freno_umbral_quejas', Number(e.target.value))} style={S.inp} />
                </div>
                <div>
                  <span style={S.lbl}>Freno · rebotes %</span>
                  <input type="number" step="0.5" value={t.freno_umbral_rebotes ?? 5}
                    onChange={e => set('freno_umbral_rebotes', Number(e.target.value))} style={S.inp} />
                </div>
                <div>
                  <span style={S.lbl}>Muestra mínima</span>
                  <input type="number" value={t.freno_muestra_minima ?? 50}
                    onChange={e => set('freno_muestra_minima', Number(e.target.value))} style={S.inp} />
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginBottom: 13, lineHeight: 1.5 }}>
                Si en 24 horas se cruza alguno de los dos, el marketing se apaga solo y las campañas
                en vuelo quedan en pausa; el correo de cobranza y renovación sigue saliendo. El 0.3%
                de quejas es el límite que publican Gmail y Yahoo. La muestra mínima evita que dos
                rebotes de tres envíos —66%— disparen el freno.
              </div>

              {campo('proveedor_key_env', 'Variable de entorno con su llave de SendGrid',
                'Solo si este inquilino usa su PROPIA cuenta de SendGrid. Va el NOMBRE de la variable (p. ej. SENDGRID_API_KEY_ACME), nunca la llave. Vacío = cuenta compartida.')}
            </div>
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
            {(t.firma_nombre || t.from_nombre) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                {t.firma_foto_url && <img src={t.firma_foto_url} alt="" width={40} height={40} style={{ borderRadius: '50%', border: '2px solid #EEECFE', objectFit: 'cover' }} />}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1a1633' }}>{t.firma_nombre || t.from_nombre}</div>
                  {t.firma_puesto && <div style={{ fontSize: '0.72rem', color: '#8a8a92' }}>{t.firma_puesto}</div>}
                  {t.sitio_url && <div style={{ fontSize: '0.7rem', color: '#5B4BD6', fontWeight: 700 }}>{t.sitio_url.replace(/^https?:\/\//, '')}</div>}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.68rem', color: '#8A8598', lineHeight: 1.7 }}>
              {(t.sitio_url || t.tiktok_url) && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 10 }}>
                  {t.sitio_url && <div><div style={{ fontSize: '0.58rem', letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700 }}>Visita nuestro sitio web</div><b style={{ color: '#5B4BD6', fontSize: '0.76rem' }}>{t.sitio_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</b></div>}
                  {t.tiktok_url && <div style={{ borderLeft: '1px solid #D9D4F0', paddingLeft: 18 }}><div style={{ fontSize: '0.58rem', letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700 }}>Visita nuestro TikTok</div><b style={{ color: '#5B4BD6', fontSize: '0.76rem' }}>{(t.tiktok_url.match(/@[\w.-]+/) || [t.tiktok_url])[0]}</b></div>}
                </div>
              )}
              <div style={{ borderTop: '1px solid #D9D4F0', paddingTop: 10 }}><b style={{ color: '#4A4560' }}>{t.nombre || '—'}</b></div>
              {t.direccion_fisica && <div>{t.direccion_fisica}</div>}
              {t.footer_extra && <div style={{ marginTop: 3 }}>{t.footer_extra}</div>}
              <div style={{ marginTop: 6 }}>{t.motivo_recepcion || 'Recibiste este correo de ' + (t.nombre || 'tu negocio') + '.'}</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: '#5B4BD6', textDecoration: 'underline' }}>Cancelar suscripción</span>
                <span> · Preferencias</span>
                {t.aviso_privacidad_url && <span> · Aviso de privacidad</span>}
              </div>
              {t.confidencialidad && <div style={{ marginTop: 10, fontSize: '0.62rem', lineHeight: 1.5 }}><b style={{ color: '#6B6580' }}>Aviso de confidencialidad.</b> {t.confidencialidad}</div>}
              {t.nota_papel && <div style={{ marginTop: 5, fontSize: '0.62rem', lineHeight: 1.5 }}>{t.nota_papel}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
