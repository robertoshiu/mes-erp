export interface ProcessStep {
  stepIndex: number
  stepName: string
  toolType: string
  nominalMinutes: number
}

export interface ProcessRoute {
  routeId: string
  routeName: string
  technology: string
  steps: ProcessStep[]
}

// Consult @lithography-expert for realistic step names
export function generateRoutes(): ProcessRoute[] {
  return [
    {
      routeId: 'RT-7NM-STD',
      routeName: '7nm Standard Logic',
      technology: '7nm',
      steps: [
        { stepIndex: 0, stepName: 'Gate Oxide Growth', toolType: 'DIFF', nominalMinutes: 45 },
        { stepIndex: 1, stepName: 'EUV Litho - Metal 1', toolType: 'LITHO', nominalMinutes: 30 },
        { stepIndex: 2, stepName: 'Metal 1 Etch', toolType: 'ETCH', nominalMinutes: 20 },
        { stepIndex: 3, stepName: 'ILD CMP', toolType: 'CMP', nominalMinutes: 15 },
        { stepIndex: 4, stepName: 'Cu Barrier PVD', toolType: 'PVD', nominalMinutes: 10 },
        { stepIndex: 5, stepName: 'Cu Seed CVD', toolType: 'CVD', nominalMinutes: 12 },
        { stepIndex: 6, stepName: 'Post-CMP Inspection', toolType: 'INSP', nominalMinutes: 8 },
        { stepIndex: 7, stepName: 'Ion Implant - S/D', toolType: 'IMPL', nominalMinutes: 25 },
      ],
    },
    {
      routeId: 'RT-5NM-HP',
      routeName: '5nm High Performance',
      technology: '5nm',
      steps: [
        { stepIndex: 0, stepName: 'HKMG Deposition', toolType: 'CVD', nominalMinutes: 35 },
        { stepIndex: 1, stepName: 'FinFET Litho', toolType: 'LITHO', nominalMinutes: 40 },
        { stepIndex: 2, stepName: 'Si Fin Etch', toolType: 'ETCH', nominalMinutes: 25 },
        { stepIndex: 3, stepName: 'Spacer CMP', toolType: 'CMP', nominalMinutes: 18 },
        { stepIndex: 4, stepName: 'S/D Epi Growth', toolType: 'DIFF', nominalMinutes: 50 },
        { stepIndex: 5, stepName: 'Contact PVD', toolType: 'PVD', nominalMinutes: 12 },
        { stepIndex: 6, stepName: 'CD Measurement', toolType: 'INSP', nominalMinutes: 10 },
      ],
    },
    {
      routeId: 'RT-3NM-GAA',
      routeName: '3nm GAA Nanosheet',
      technology: '3nm',
      steps: [
        { stepIndex: 0, stepName: 'Nanosheet Stack CVD', toolType: 'CVD', nominalMinutes: 55 },
        { stepIndex: 1, stepName: 'EUV Multi-Pattern Litho', toolType: 'LITHO', nominalMinutes: 45 },
        { stepIndex: 2, stepName: 'Channel Release Etch', toolType: 'ETCH', nominalMinutes: 30 },
        { stepIndex: 3, stepName: 'Inner Spacer CMP', toolType: 'CMP', nominalMinutes: 20 },
        { stepIndex: 4, stepName: 'Work Function Metal ALD', toolType: 'PVD', nominalMinutes: 15 },
        { stepIndex: 5, stepName: 'Overlay Measurement', toolType: 'INSP', nominalMinutes: 12 },
      ],
    },
    {
      routeId: 'RT-14NM-IOT',
      routeName: '14nm IoT Low Power',
      technology: '14nm',
      steps: [
        { stepIndex: 0, stepName: 'Thick Oxide Growth', toolType: 'DIFF', nominalMinutes: 30 },
        { stepIndex: 1, stepName: 'i-line Litho', toolType: 'LITHO', nominalMinutes: 15 },
        { stepIndex: 2, stepName: 'Poly Etch', toolType: 'ETCH', nominalMinutes: 12 },
        { stepIndex: 3, stepName: 'STI CMP', toolType: 'CMP', nominalMinutes: 10 },
        { stepIndex: 4, stepName: 'BF2 Implant', toolType: 'IMPL', nominalMinutes: 20 },
      ],
    },
    {
      routeId: 'RT-28NM-RF',
      routeName: '28nm RF/Analog',
      technology: '28nm',
      steps: [
        { stepIndex: 0, stepName: 'MIM Cap CVD', toolType: 'CVD', nominalMinutes: 25 },
        { stepIndex: 1, stepName: 'Inductor Litho', toolType: 'LITHO', nominalMinutes: 20 },
        { stepIndex: 2, stepName: 'Deep Trench Etch', toolType: 'ETCH', nominalMinutes: 18 },
        { stepIndex: 3, stepName: 'Thick Cu CMP', toolType: 'CMP', nominalMinutes: 22 },
        { stepIndex: 4, stepName: 'Parametric Test', toolType: 'INSP', nominalMinutes: 15 },
      ],
    },
  ]
}
