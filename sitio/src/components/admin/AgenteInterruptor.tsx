/**
 * Prender / apagar el agente del CRM (29-sep-2026).
 *
 * El dueño lo apagó para frenar el gasto de IA (era lo que más consumía créditos de Anthropic) y lo quiere
 * prender en un clic cuando lo necesite. Vive en Configuración → Trabajo inteligente → Agente IA, junto a los
 * demás ajustes del agente. Lee y escribe `ti_config.agente_activo` por /api/crm/ti/envios (solo founder).
 * Apagado: el agente no propone ni manda nada y ninguna ruta llama a Claude. Los recordatorios y confirmaciones
 * de reuniones son plantillas y siguen saliendo igual.
 */
import { useEffect, useState } from 'react';

async function llamar(body: any): Promise<any> {
  const r = await fetch('/api/crm/ti/envios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'No se pudo');
  return j;
}

export default function AgenteInterruptor() {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);

  useEffect(() => { llamar({ accion: 'agente_estado' }).then(j => setActivo(j.agente_activo === true)).catch(e => setMsg({ t: e.message, err: true })); }, []);

  async function cambiar() {
    if (activo === null) return;
    setOcupado(true); setMsg(null);
    try {
      const j = await llamar({ accion: 'agente_interruptor', activo: !activo });
      setActivo(j.agente_activo === true);
      setMsg({ t: j.agente_activo ? 'Agente prendido: vuelve a proponer respuestas a los leads.' : 'Agente apagado: no propone ni gasta créditos de IA.' });
    } catch (e: any) { setMsg({ t: e.message, err: true }); }
    setOcupado(false);
  }

  const on = activo === true;
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 600,
          background: activo === null ? '#F1F5F9' : on ? '#DCFCE7' : '#F1F5F9', color: activo === null ? '#64748B' : on ? '#166534' : '#334155' }}>
          {activo === null ? 'Revisando…' : on ? 'Encendido' : 'Apagado'}
        </span>
        <button onClick={cambiar} disabled={ocupado || activo === null}
          style={{ padding: '8px 16px', borderRadius: 8, border: 0, fontWeight: 600, fontSize: 14, cursor: ocupado ? 'default' : 'pointer', opacity: ocupado || activo === null ? 0.6 : 1,
            background: on ? '#FEE2E2' : '#2563EB', color: on ? '#B91C1C' : '#FFFFFF' }}>
          {ocupado ? 'Guardando…' : on ? 'Apagar agente' : 'Prender agente'}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
        {on
          ? 'Propone respuestas a los leads que escriben, toques de seguimiento y mensajes de preparación de demos. Gasta créditos de IA.'
          : 'No propone ni manda nada y no gasta créditos de IA. Las confirmaciones y recordatorios de reuniones siguen saliendo (son plantillas).'}
      </p>
      {msg && <p style={{ margin: 0, fontSize: 13, color: msg.err ? '#B91C1C' : '#166534' }}>{msg.t}</p>}
    </div>
  );
}
