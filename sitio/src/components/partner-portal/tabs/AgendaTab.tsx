// AgendaTab del partner portal — reusa SchedulingHub (mismo componente que el
// CRM admin). El scope (qué bookings/event_types/availability ve el partner)
// lo aplica el backend basándose en la cookie sacs_session.
//
// Cualquier mejora a SchedulingHub se propaga automáticamente al admin y aquí.

import SchedulingHub from '../../scheduling/SchedulingHub';
import { SS } from './styles';

type Props = {
  user: { id: string; nombre: string; email: string };
};

export default function AgendaTab({ user: _user }: Props) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={SS.h1Small}>Agenda</h1>
        <p style={SS.leadSm}>
          Conecta tu Google Calendar, configura tu disponibilidad y comparte tu link de
          agendamiento. Las citas que tus clientes reserven aparecen aquí y en tu calendario.
        </p>
      </div>
      <div style={{ marginTop: 18, background: '#fff', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden' }}>
        <SchedulingHub variant="partner" />
      </div>
    </div>
  );
}
