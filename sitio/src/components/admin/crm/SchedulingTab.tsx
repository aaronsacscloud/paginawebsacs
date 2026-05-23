// Wrapper de compatibilidad — el componente real vive en
// src/components/scheduling/SchedulingHub.tsx para reusarlo desde el partner portal.
// Cualquier mejora al hub se propaga automáticamente al CRM admin y al partner portal.

import SchedulingHub from '../../scheduling/SchedulingHub';

export default function SchedulingTab() {
  return <SchedulingHub variant="admin" />;
}
