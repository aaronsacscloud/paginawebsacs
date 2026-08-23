// La sección WhatsApp del CRM: PURO inbox, a pantalla completa.
//
// Masivos y Plantillas son secciones propias del menú lateral (wa-masivos /
// wa-plantillas en CrmDashboard); aquí no hay sub-tabs que roben altura. Los
// avisos de configuración solo aparecen cuando algo está roto — con todo
// configurado, la pantalla entera es del inbox.
import { useEffect, useState } from 'react';
import { S, Aviso, FOCO } from '../email/ui';
import InboxPro from './InboxPro';

export default function WhatsAppTab() {
  const [setup, setSetup] = useState<any>(null);

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
      <InboxPro />
    </div>
  );
}
