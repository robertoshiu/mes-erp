import type { ModuleRoute, SelectedEntity } from '@/lib/uiStore'
import type { AppTopic } from '@/lib/events'

export type Lang = 'zh' | 'en'

export interface I18nText {
  zh: string
  en: string
}

export interface TourStep {
  id: string
  /** Navigate to this route before showing the step. */
  route?: ModuleRoute
  /** `data-tour` attribute value to spotlight. undefined => centered modal-style step. */
  target?: string
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  title: I18nText
  /** Supports `**bold**` and `` `code` `` inline (mini renderer in TourCard). */
  body: I18nText
  /** Autoplay seconds, default 12. */
  duration?: number
  /** Hold step until a bus event arrives (or timeout); flashes "LIVE" on the card. */
  waitFor?: { topic: AppTopic; timeoutMs: number }
  action?:
    | { type: 'selectEntity'; entity: SelectedEntity }
    | { type: 'clearSelection' }
  /** Extra sonar ring on the target. */
  pulse?: boolean
}

export interface TourChapter {
  id: string
  title: I18nText
  steps: TourStep[]
}

export interface TourDefinition {
  id: string
  title: I18nText
  description: I18nText
  estMinutes: number
  chapters: TourChapter[]
}
