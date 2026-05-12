// Icon library — SVG line-style icons (Squareup-inspired)
// Stroke 1.5px, viewBox 24x24, sin emojis.

import type { CSSProperties } from 'react';

type IconProps = {
  size?: number;
  color?: string;
  style?: CSSProperties;
  strokeWidth?: number;
};

function base(props: IconProps & { children: React.ReactNode }) {
  const { size = 18, color = 'currentColor', style, strokeWidth = 1.5, children } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Home: (p: IconProps) => base({ ...p, children: <>
    <path d="M3 12l9-9 9 9" />
    <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
  </> }),
  Money: (p: IconProps) => base({ ...p, children: <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10" />
    <path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" />
  </> }),
  Share: (p: IconProps) => base({ ...p, children: <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </> }),
  Level: (p: IconProps) => base({ ...p, children: <>
    <polyline points="20 7 12 15 8 11 4 15" />
    <polyline points="15 7 20 7 20 12" />
  </> }),
  Certificate: (p: IconProps) => base({ ...p, children: <>
    <circle cx="12" cy="9" r="5" />
    <polyline points="8.21 13.89 7 22 12 19 17 22 15.79 13.88" />
  </> }),
  Leads: (p: IconProps) => base({ ...p, children: <>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </> }),
  Customers: (p: IconProps) => base({ ...p, children: <>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </> }),
  BrandKit: (p: IconProps) => base({ ...p, children: <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </> }),
  SacsAccount: (p: IconProps) => base({ ...p, children: <>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </> }),
  Copy: (p: IconProps) => base({ ...p, children: <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </> }),
  Eye: (p: IconProps) => base({ ...p, children: <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </> }),
  Mail: (p: IconProps) => base({ ...p, children: <>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </> }),
  WhatsApp: (p: IconProps) => base({ ...p, children: <>
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </> }),
  Twitter: (p: IconProps) => base({ ...p, children: <>
    <path d="M22 4.01c-1 .49-1.98.689-3 .99-1.121-1.265-2.783-1.335-4.38-.737S11.977 6.323 12 8v1c-3.245.083-6.135-1.395-8-4 0 0-4.182 7.433 4 11-1.872 1.247-3.739 2.088-6 2 3.308 1.803 6.913 2.423 10.034 1.517 3.58-1.04 6.522-3.723 7.651-7.742a13.84 13.84 0 00.497-3.753c0-.249 1.51-2.772 1.818-4.013z" />
  </> }),
  QrCode: (p: IconProps) => base({ ...p, children: <>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </> }),
  Link: (p: IconProps) => base({ ...p, children: <>
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </> }),
  Check: (p: IconProps) => base({ ...p, children: <>
    <polyline points="20 6 9 17 4 12" />
  </> }),
  Plus: (p: IconProps) => base({ ...p, children: <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </> }),
  ArrowRight: (p: IconProps) => base({ ...p, children: <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </> }),
  ChevronDown: (p: IconProps) => base({ ...p, children: <polyline points="6 9 12 15 18 9" /> }),
  ChevronRight: (p: IconProps) => base({ ...p, children: <polyline points="9 18 15 12 9 6" /> }),
  Close: (p: IconProps) => base({ ...p, children: <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </> }),
  Sparkle: (p: IconProps) => base({ ...p, children: <>
    <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
  </> }),
  Book: (p: IconProps) => base({ ...p, children: <>
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </> }),
  Gift: (p: IconProps) => base({ ...p, children: <>
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
  </> }),
  Phone: (p: IconProps) => base({ ...p, children: <>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </> }),
  Handshake: (p: IconProps) => base({ ...p, children: <>
    <path d="M11 17l2 2a1 1 0 003 0c0-.5-.5-1-1-1.5l-.5-.5" />
    <path d="M14 16l2.5 2.5a1.5 1.5 0 002.12-2.12L16 14" />
    <path d="M16 14l3.5 3.5a1.5 1.5 0 002.12-2.12L18 12" />
    <path d="M18 12l1-1a4 4 0 00-5.66-5.66l-1.34 1.34M11 17H6a2 2 0 01-2-2v-5l3-3 4 4-3 3M11 17l4-4-4-4" />
  </> }),
  CheckCircle: (p: IconProps) => base({ ...p, children: <>
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </> }),
  TrendingUp: (p: IconProps) => base({ ...p, children: <>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </> }),
  Calendar: (p: IconProps) => base({ ...p, children: <>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </> }),
  Activity: (p: IconProps) => base({ ...p, children: <>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </> }),
  Briefcase: (p: IconProps) => base({ ...p, children: <>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
  </> }),
  Network: (p: IconProps) => base({ ...p, children: <>
    <circle cx="12" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M12 7v3M12 13l-5 4M12 13l5 4" />
  </> }),
};
