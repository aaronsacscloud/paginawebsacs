import { useState } from 'react';

export default function BookingTest({ eventType }: { eventType: any }) {
  const [count, setCount] = useState(0);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center', maxWidth: 400 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Booking Test</h1>
        <p style={{ color: '#888', marginBottom: 16 }}>Event: {eventType?.nombre || 'unknown'}</p>
        <button onClick={() => setCount(c => c + 1)} style={{ padding: '12px 24px', background: '#4B7BE5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
          Clicked {count} times
        </button>
      </div>
    </div>
  );
}
