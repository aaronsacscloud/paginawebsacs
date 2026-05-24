// Wrapper de compatibilidad — el componente real vive en
// src/components/scheduling/SchedulingHub.tsx para reusarlo desde el partner portal.
// Cualquier mejora al hub se propaga automáticamente al CRM admin y al partner portal.
//
// Lazy-loaded: el Hub son ~2k líneas, no las queremos en el bundle inicial del CRM.

import { lazy, Suspense } from 'react';

const SchedulingHub = lazy(() => import('../../scheduling/SchedulingHub'));

export default function SchedulingTab() {
  return (
    <Suspense fallback={
      <div style={{ padding: 48, textAlign: 'center', color: '#bbb', fontSize: '0.875rem' }}>
        Cargando agenda…
      </div>
    }>
      <SchedulingHub variant="admin" />
    </Suspense>
  );
}
