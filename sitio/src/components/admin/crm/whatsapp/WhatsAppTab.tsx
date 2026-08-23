// La sección WhatsApp del CRM.
//
// El Inbox es PROPIO (InboxPro, estilo respond.io) sobre el espejo wa_* que
// alimentan los webhooks de Kapso; Kapso queda solo como transporte. El gate
// de configuración va primero, como en Email: mientras falte una env o el
// webhook, cada pantalla lo dice en vez de fallar en silencio.
import { useEffect, useState } from 'react';
import { S, Aviso, FOCO } from '../email/ui';
import InboxPro from './InboxPro';
import Masivos from './Masivos';
import Plantillas from './Plantillas';

type Sec = 'inbox' | 'masivos' | 'plantillas';

const SECCIONES: Array<{ id: Sec; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'masivos', label: 'Masivos' },
  { id: 'plantillas', label: 'Plantillas' },
];

export default function WhatsAppTab() {
  const [sec, setSec] = useState<Sec>('inbox');
  const [setup, setSetup] = useState<any>(null);
  const [sinLeer, setSinLeer] = useState(0);

  const revisar = () => fetch('/api/crm/whatsapp/setup').then(r => r.json()).then(setSetup).catch(() => setSetup({ faltantes: [] }));
  useEffect(() => { revisar(); }, []);
  useEffect(() => {
    // Contador del sub-tab (patrón Bandeja de EmailTab).
    const traer = () => fetch('/api/crm/whatsapp/inbox?limit=1').then(r => r.json())
      .then(j => setSinLeer(j.counts?.no_leidas || 0)).catch(() => {});
    traer();
    const t = setInterval(() => { if (!document.hidden) traer(); }, 30000);
    return () => clearInterval(t);
  }, [sec]);

  const faltan: string[] = setup?.faltantes || [];
  const sinWebhook = setup && !setup.webhook_registrado && !faltan.length;

  const registrarWebhook = async () => {
    await fetch('/api/crm/whatsapp/setup', { method: 'POST' }).catch(() => {});
    revisar();
  };

  return (
    <div className="em-sec">
      <style>{FOCO}</style>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0eff3', padding: '12px 24px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {SECCIONES.map(s => (
            <button key={s.id} onClick={() => setSec(s.id)}
              aria-current={sec === s.id ? 'page' : undefined}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '9px 14px 11px', fontSize: '0.82rem', position: 'relative',
                fontWeight: sec === s.id ? 800 : 500,
                color: sec === s.id ? '#5B4BD6' : '#8a8a92',
                boxShadow: sec === s.id ? 'inset 0 -3px 0 #9B8CFA' : 'none',
              }}>
              {s.label}
              {s.id === 'inbox' && sinLeer > 0 && (
                <span style={{ marginLeft: 6, background: '#9B8CFA', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 800 }}>{sinLeer}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {faltan.length > 0 && (
        <div style={{ ...S.wrap, paddingBottom: 0 }}>
          <Aviso tono="aviso" titulo="WhatsApp a medio conectar">
            Faltan variables en Vercel: {faltan.join(' · ')}.
            {setup?.numeros?.length > 0 && !setup.numeros[0]?.error && (
              <> Números detectados en Kapso: {setup.numeros.map((n: any) =>
                `${n.numero || '¿?'} (phone_number_id ${n.id}${n.business_account_id ? `, business_account_id ${n.business_account_id}` : ''})`).join(' · ')}.</>
            )}
          </Aviso>
        </div>
      )}
      {sinWebhook && (
        <div style={{ ...S.wrap, paddingBottom: 0 }}>
          <Aviso tono="aviso" titulo="Falta el webhook de Kapso"
            accion={<button style={S.btnP} onClick={registrarWebhook}>Registrarlo</button>}>
            Sin él, las conversaciones no se espejan en las fichas de los clientes ni en el timeline.
          </Aviso>
        </div>
      )}

      {sec === 'inbox' && <InboxPro />}
      {sec === 'masivos' && <Masivos />}
      {sec === 'plantillas' && <Plantillas />}
    </div>
  );
}
