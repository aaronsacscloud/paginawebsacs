// La sección WhatsApp del CRM (arquitectura híbrida con Kapso).
//
// El chat vive en el inbox embebido de Kapso; Masivos y Plantillas son
// pantallas propias sobre su API. El gate de configuración va primero, como
// en Email: mientras falte una env o el webhook, cada pantalla lo dice en vez
// de fallar en silencio.
import { useEffect, useState } from 'react';
import { S, Aviso, FOCO } from '../email/ui';
import InboxEmbed from './InboxEmbed';
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
  // El deep-link de la ficha 360: /admin/crm?tab=whatsapp&wa_search=+521...
  const [buscar] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('wa_search'); } catch { return null; }
  });

  const revisar = () => fetch('/api/crm/whatsapp/setup').then(r => r.json()).then(setSetup).catch(() => setSetup({ faltantes: [] }));
  useEffect(() => { revisar(); }, []);

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

      {sec === 'inbox' && <InboxEmbed buscar={buscar} />}
      {sec === 'masivos' && <Masivos />}
      {sec === 'plantillas' && <Plantillas />}
    </div>
  );
}
