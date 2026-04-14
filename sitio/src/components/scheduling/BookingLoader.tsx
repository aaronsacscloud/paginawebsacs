import { useState, useEffect, Component, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const BookingPage = lazy(() => import('./BookingPage'));

class ErrorCatcher extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message + '\n' + error.stack }; }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8', fontFamily: 'sans-serif', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#E54B4B', margin: '0 0 12px' }}>Error en el componente</h2>
          <pre style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 300, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>{this.state.error}</pre>
        </div>
      </div>
    );
    return this.props.children;
  }
}

interface Props {
  eventType: any;
  questions: any[];
}

export default function BookingLoader({ eventType, questions }: Props) {
  return (
    <ErrorCatcher>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Cargando calendario...</div>
            <div style={{ fontSize: '0.8125rem', color: '#999' }}>{eventType?.nombre || 'Demo'}</div>
          </div>
        </div>
      }>
        <BookingPage eventType={eventType} questions={questions || []} />
      </Suspense>
    </ErrorCatcher>
  );
}
