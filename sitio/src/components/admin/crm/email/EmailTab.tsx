// La sección Email del CRM.
//
// El gate de configuración es lo primero: mientras falte el remitente, la
// dirección física o el dominio, todas las pantallas lo dicen y el envío está
// apagado. Es mejor un candado explicado que seis pantallas vacías.
import { useEffect, useState } from 'react';
import { S, Aviso, chip, FOCO } from './ui';
import ConfigEmail from './ConfigEmail';
import Campanas from './Campanas';
import Audiencias from './Audiencias';
import Plantillas from './Plantillas';
import Bandeja from './Bandeja';
import SaludEmail from './SaludEmail';
import Oportunidades from './Oportunidades';
import Retorno from './Retorno';
import ReglasWeb from './ReglasWeb';

type Sec = 'oportunidades' | 'disparadores' | 'campanas' | 'audiencias' | 'plantillas' | 'bandeja' | 'salud' | 'retorno' | 'ajustes';

const SECCIONES: Array<{ id: Sec; label: string }> = [
  // Oportunidades va primero a propósito: es la pantalla que dice qué hacer
  // hoy con el dinero que ya está sobre la mesa. Campañas es la herramienta;
  // esto es la razón para abrirla.
  { id: 'oportunidades', label: 'Dinero en la mesa' },
  { id: 'disparadores', label: 'Disparadores' },
  { id: 'campanas', label: 'Campañas' },
  { id: 'audiencias', label: 'Audiencias' },
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'salud', label: 'Salud' },
  { id: 'retorno', label: 'Retorno' },
  { id: 'ajustes', label: 'Ajustes' },
];

export default function EmailTab() {
  const [sec, setSec] = useState<Sec>('oportunidades');
  const [cfg, setCfg] = useState<any>(null);
  const [sinLeer, setSinLeer] = useState(0);

  const revisar = () => fetch('/api/crm/email/config').then(r => r.json()).then(setCfg).catch(() => setCfg({ faltantes: [] }));
  useEffect(() => { revisar(); }, []);
  useEffect(() => {
    fetch('/api/crm/email/conversaciones?filtro=no_leidos').then(r => r.json()).then(j => setSinLeer(j.sin_leer || 0)).catch(() => {});
  }, [sec]);

  const faltan: string[] = cfg?.faltantes || [];
  const bloqueado = faltan.length > 0;

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
                // La activa se marca con una barra bajo el texto, no con un
                // borde alrededor: entre seis chips iguales, el "seleccionado"
                // por color de fondo casi no se lee (se ve en la captura).
                boxShadow: sec === s.id ? 'inset 0 -3px 0 #9B8CFA' : 'none',
              }}>
              {s.label}
              {s.id === 'bandeja' && sinLeer > 0 && (
                <span style={{ marginLeft: 6, background: '#9B8CFA', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 800 }}>{sinLeer}</span>
              )}
              {s.id === 'ajustes' && bloqueado && (
                <span style={{ marginLeft: 6, background: '#FFF6E3', color: '#9A6B15', borderRadius: 20, padding: '1px 6px', fontSize: '0.6rem', fontWeight: 800 }}>{faltan.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {bloqueado && sec !== 'ajustes' && (
        <div style={{ ...S.wrap, paddingBottom: 0 }}>
          <Aviso tono="aviso" titulo="Todavía no puedes enviar correos"
            accion={<button style={S.btnP} onClick={() => setSec('ajustes')}>Configurar</button>}>
            Falta: {faltan.join(' · ')}. Puedes preparar campañas y audiencias mientras tanto; nada saldrá hasta que esté listo.
          </Aviso>
        </div>
      )}

      {sec === 'oportunidades' && <Oportunidades onIrA={s => setSec(s as Sec)} />}
      {sec === 'disparadores' && <ReglasWeb onIrA={s => setSec(s as Sec)} />}
      {sec === 'campanas' && <Campanas onIrA={s => setSec(s as Sec)} />}
      {sec === 'audiencias' && <Audiencias />}
      {sec === 'plantillas' && <Plantillas />}
      {sec === 'bandeja' && <Bandeja />}
      {sec === 'salud' && <SaludEmail />}
      {sec === 'retorno' && <Retorno />}
      {sec === 'ajustes' && <ConfigEmail onCambio={revisar} />}
    </div>
  );
}
