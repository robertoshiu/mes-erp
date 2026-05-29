// Design tokens — single source of truth for the FabPulse
// "Fab Operations Command Center" (Siemens Cyan) dark theme.
// Mirrors the CSS custom properties in index.css.

export const brand = {
  primary: '#22D3EE',   // electric cyan
  secondary: '#38BDF8', // sky
  tertiary: '#818CF8',  // indigo
} as const

export const surface = {
  canvas: '#0A0E18',
  s1: '#0E1422',
  s2: '#111A2C',
  s3: '#16223A',
} as const

export const neutral = {
  bg: '#0A0E18',
  surface: '#111A2C',
  border: 'rgba(56, 189, 248, 0.12)',
  divider: 'rgba(255, 255, 255, 0.06)',
  ink1: '#E8EEF7',
  ink2: '#AEBBD0',
  ink3: '#74849E',
  inkMute: '#4C5A74',
} as const

// E10 equipment-state colors (neon-grade for dark canvas)
export const e10Colors = {
  PROD: '#34D399', // emerald
  STBY: '#FBBF24', // amber
  SDT: '#FB7185',  // rose
  UDT: '#EF4444',  // red
  NSC: '#64748B',  // slate
  ENG: '#60A5FA',  // blue
  OUT: '#334155',  // deep slate
} as const

// Soft halo color per state (rgba) for glow effects
export const e10Glow: Record<string, string> = {
  PROD: 'rgba(52, 211, 153, 0.55)',
  STBY: 'rgba(251, 191, 36, 0.55)',
  SDT: 'rgba(251, 113, 133, 0.6)',
  UDT: 'rgba(239, 68, 68, 0.65)',
  NSC: 'rgba(100, 116, 139, 0.0)',
  ENG: 'rgba(96, 165, 250, 0.55)',
  OUT: 'rgba(51, 65, 85, 0.0)',
}

export const e10Symbols: Record<string, string> = {
  PROD: '●',
  STBY: '◐',
  SDT: '■',
  UDT: '▨',
  NSC: '○',
  ENG: '◆',
  OUT: '✕',
}

// Human-readable E10 labels
export const e10Labels: Record<string, string> = {
  PROD: 'Productive',
  STBY: 'Standby',
  SDT: 'Sched. Down',
  UDT: 'Unsched. Down',
  NSC: 'Non-Scheduled',
  ENG: 'Engineering',
  OUT: 'Offline',
}

export const sem = {
  info: '#38BDF8',
  warn: '#FBBF24',
  critical: '#F43F5E',
  success: '#34D399',
} as const

// Vibrant series palette for multi-line / multi-bar charts
export const chartSeries = ['#22D3EE', '#38BDF8', '#818CF8', '#34D399', '#FBBF24', '#FB7185'] as const

export const glow = {
  cyan: 'rgba(34, 211, 238, 0.55)',
  sky: 'rgba(56, 189, 248, 0.5)',
  indigo: 'rgba(129, 140, 248, 0.5)',
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
