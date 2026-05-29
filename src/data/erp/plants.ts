import type { Plant } from './types'

/** Generate the fab plants. FAB-01 is the primary site used by every generator. */
export function generatePlants(): Plant[] {
  return [
    {
      plantId: 'FAB-01',
      name: 'Hsinchu Fab 1',
      storageLocations: ['RAW', 'WIP', 'FG'],
    },
    {
      plantId: 'FAB-02',
      name: 'Tainan Fab 2',
      storageLocations: ['RAW', 'WIP', 'FG'],
    },
  ]
}
