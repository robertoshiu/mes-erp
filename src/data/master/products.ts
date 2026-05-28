import { mulberry32 } from '../prng'

export interface Product {
  productCode: string
  productName: string
  technology: string
  layers: number
}

const TECHS = ['7nm', '5nm', '3nm', '14nm', '10nm', '28nm']
const PRODUCT_NAMES = [
  'Phoenix', 'Orion', 'Vega', 'Altair', 'Sirius',
  'Polaris', 'Deneb', 'Rigel', 'Capella', 'Antares',
  'Arcturus', 'Betelgeuse',
]

export function generateProducts(seed = 100): Product[] {
  const rng = mulberry32(seed)
  return PRODUCT_NAMES.map((name, i) => ({
    productCode: `DEV-${TECHS[i % TECHS.length].toUpperCase()}-${String.fromCharCode(65 + i)}${Math.floor(rng() * 9) + 1}`,
    productName: name,
    technology: TECHS[i % TECHS.length],
    layers: Math.floor(rng() * 40) + 20,
  }))
}
