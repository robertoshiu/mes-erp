import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { domainTone, sem, brand, type Domain } from '@/lib/tokens'

/** Status pill tone vocabulary (mirrors the semantic palette). */
export type PillTone = 'accent' | 'success' | 'warn' | 'critical' | 'info'

export interface HeaderPill {
  label: string
  value: ReactNode
  tone?: PillTone
}

interface ModuleHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Drives the domain chip + title glow color. */
  domain: Domain
  icon?: ReactNode
  /** Compact status read-outs rendered as a pill array. */
  pills?: HeaderPill[]
  /** Right slot for screen-level KPIs / actions. */
  right?: ReactNode
  className?: string
}

const PILL_COLOR: Record<PillTone, string> = {
  accent: brand.primary,
  success: sem.success,
  warn: sem.warn,
  critical: sem.critical,
  info: sem.info,
}

/** Cinematic command-strip header: glowing display-font title, domain chip,
 *  status pills, animated shimmer hairline, staggered child reveal + HUD corners.
 *  Compact (≤72px tall) since screens are dense. */
export function ModuleHeader({
  title,
  subtitle,
  domain,
  icon,
  pills,
  right,
  className,
}: ModuleHeaderProps) {
  const tone = domainTone[domain]

  return (
    <header
      className={cn(
        'hud-frame relative overflow-hidden panel px-4 py-2.5',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-h-[44px]">
        {/* Domain chip — colored via currentColor by .chip-domain */}
        <span
          className="chip-domain animate-rise shrink-0"
          style={{ color: tone.color, animationDelay: '0ms' }}
        >
          {icon && <span className="flex items-center">{icon}</span>}
          {tone.label}
        </span>

        <div className="min-w-0 animate-rise" style={{ animationDelay: '60ms' }}>
          <h1
            className="text-display text-[19px] font-bold leading-none text-ink-1 truncate"
            style={{ textShadow: `0 0 16px ${tone.glow}` }}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="text-[10.5px] text-ink-3 mt-1 truncate tracking-wide">
              {subtitle}
            </div>
          )}
        </div>

        {pills && pills.length > 0 && (
          <div className="hidden md:flex items-center gap-2 ml-2">
            {pills.map((pill, i) => {
              const color = PILL_COLOR[pill.tone ?? 'accent']
              return (
                <div
                  key={`${pill.label}-${i}`}
                  className="animate-rise inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-3/40 px-2 py-1"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                    aria-hidden
                  />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    {pill.label}
                  </span>
                  <span
                    className="metric-value text-[12px] font-semibold text-ink-1 leading-none"
                  >
                    {pill.value}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {right && (
          <div
            className="ml-auto flex items-center gap-2 shrink-0 animate-rise"
            style={{ animationDelay: '180ms' }}
          >
            {right}
          </div>
        )}
      </div>

      {/* Animated shimmer hairline — slow gradient sweep tinted to the domain. */}
      <div
        className="animate-shimmer absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${tone.color}, transparent)`,
        }}
        aria-hidden
      />
    </header>
  )
}
