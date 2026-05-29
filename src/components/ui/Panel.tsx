import type { ReactNode, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Use frosted-glass surface instead of the solid panel fill. */
  glass?: boolean
  /** Lift border + glow on hover (for interactive panels). */
  hover?: boolean
  children?: ReactNode
}

/** The workhorse surface: layered fill, hairline cyan edge, top highlight, soft shadow. */
export function Panel({ glass, hover, className, children, ...rest }: PanelProps) {
  return (
    <div
      className={cn(glass ? 'glass rounded-lg' : 'panel', hover && 'panel-hover', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

interface PanelHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  right?: ReactNode
  className?: string
}

/** Consistent panel header: glowing accent tick + uppercase tracked label + optional right slot. */
export function PanelHeader({ title, subtitle, icon, right, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2.5 px-3.5 py-2.5 border-b border-edge', className)}>
      <span className="accent-tick self-stretch min-h-[20px]" aria-hidden />
      {icon && <span className="text-accent flex items-center">{icon}</span>}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2 leading-tight truncate">
          {title}
        </div>
        {subtitle && <div className="text-[10px] text-ink-3 mt-0.5 truncate">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  )
}
