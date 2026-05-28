import { create } from 'zustand'

export type ModuleRoute =
  | 'fab-floor'
  | 'production'
  | 'equipment'
  | 'spc'
  | 'recipe'
  | 'alarms'
  | 'kpi'

export interface SelectedEntity {
  type: 'lot' | 'equipment' | 'alarm' | 'recipe'
  id: string
}

export interface BadgeCounts {
  alarms: number
  production: number
  equipmentDown: number
}

interface UiState {
  activeRoute: ModuleRoute
  setRoute: (route: ModuleRoute) => void

  selectedEntity: SelectedEntity | null
  selectEntity: (entity: SelectedEntity | null) => void

  badges: BadgeCounts
  updateBadges: (badges: Partial<BadgeCounts>) => void

  currentShift: 'A' | 'B' | 'C'
  setShift: (shift: 'A' | 'B' | 'C') => void
}

export const useUiStore = create<UiState>((set) => ({
  activeRoute: 'fab-floor',
  setRoute: (route) => set({ activeRoute: route, selectedEntity: null }),

  selectedEntity: null,
  selectEntity: (entity) => set({ selectedEntity: entity }),

  badges: { alarms: 0, production: 0, equipmentDown: 0 },
  updateBadges: (badges) =>
    set((state) => ({ badges: { ...state.badges, ...badges } })),

  currentShift: 'A',
  setShift: (shift) => set({ currentShift: shift }),
}))
