/**
 * RevenueTab — Wraps the existing RevenueHub component but hides its internal nav bar.
 * The CrmDashboard provides the unified nav, so we just need to tell RevenueHub which tab to show.
 *
 * Strategy: Import and render the full RevenueHub, but override its nav via CSS.
 * The parent CrmDashboard controls which tab is active via URL params.
 */
import { useEffect, useRef } from 'react';
import RevenueHub from '../RevenueHub';

type RevenueTabId = 'dashboard' | 'clientes' | 'pagos' | 'cotizaciones' | 'config';

interface Props {
  initialTab: RevenueTabId | string;
}

export default function RevenueTab({ initialTab }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click the correct tab inside RevenueHub when initialTab changes
  useEffect(() => {
    if (!wrapperRef.current) return;
    // Find the internal tab buttons and click the right one
    const buttons = wrapperRef.current.querySelectorAll<HTMLButtonElement>('[data-revenue-tab]');
    // Fallback: find by text content in the sticky nav
    const nav = wrapperRef.current.querySelector('[data-revenue-nav]');
    if (nav) {
      const tabBtns = nav.querySelectorAll<HTMLButtonElement>('button');
      tabBtns.forEach(btn => {
        if (btn.textContent?.toLowerCase().trim() === initialTab) {
          btn.click();
        }
      });
    }
  }, [initialTab]);

  return (
    <div ref={wrapperRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        /* Hide RevenueHub's internal nav bar — CrmDashboard provides one */
        .revenue-hub-nav { display: none !important; }
      `}</style>
      <RevenueHub _initialTab={initialTab as RevenueTabId} _hideNav={true} />
    </div>
  );
}
