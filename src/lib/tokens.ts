// Design tokens from the design doc — single source of truth.
// These are consumed by both Tailwind config and runtime code.

export const brand = {
  primary: '#0066B3',
  secondary: '#4A90A4',
} as const

export const neutral = {
  bg: '#F3F6F9',
  surface: '#FFFFFF',
  border: '#D1D5DB',
  divider: '#E5E7EB',
  ink1: '#1A1A1A',
  ink2: '#303030',
  ink3: '#6B7280',
  inkMute: '#9CA3AF',
} as const

export const e10Colors = {
  PROD: '#16A34A',
  STBY: '#F59E0B',
  SDT: '#DC2626',
  UDT: '#B91C1C',
  NSC: '#6B7280',
  ENG: '#2563EB',
  OUT: '#1F2937',
} as const

export const e10Symbols: Record<string, string> = {
  PROD: '●', // ●
  STBY: '◐', // ◐
  SDT: '■',  // ■
  UDT: '▨',  // ▨
  NSC: '○',  // ○
  ENG: '◆',  // ◆
  OUT: '✕',  // ✕
}

export const sem = {
  info: '#2563EB',
  warn: '#B45309',
  critical: '#DC2626',
  success: '#16A34A',
} as const

export const motion = {
  instant: 80,
  quick: 180,
  smooth: 300,
  deliberate: 600,
} as const

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decel: 'cubic-bezier(0, 0, 0.2, 1)',
} as const
