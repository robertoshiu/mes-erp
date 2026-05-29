import { mulberry32, pick } from '../prng'
import type { MasterData } from '../master'
import type { BusinessPartner } from './types'

const BP_SEED = 510

const PAYMENT_TERMS = ['NET30', 'NET45', 'NET60']
const INCOTERMS = ['FOB', 'DDP', 'EXW']
const COUNTRIES = ['US', 'TW', 'JP', 'KR', 'NL', 'DE', 'CN', 'SG']

// Equipment / chemical / gas vendors. Equipment OEMs mirror the MES vendor set.
const VENDORS: { name: string; country: string }[] = [
  { name: 'ASML Holding', country: 'NL' },
  { name: 'LAM Research', country: 'US' },
  { name: 'Applied Materials (AMAT)', country: 'US' },
  { name: 'Tokyo Electron (TEL)', country: 'JP' },
  { name: 'KLA Corporation', country: 'US' },
  { name: 'SCREEN Semiconductor', country: 'JP' },
  { name: 'JSR Micro Chemicals', country: 'JP' },
  { name: 'Shin-Etsu Wafers', country: 'JP' },
  { name: 'SUMCO Substrates', country: 'JP' },
  { name: 'Air Liquide Gases', country: 'FR' },
  { name: 'Linde Electronics Gases', country: 'DE' },
  { name: 'Merck/EMD Performance Materials', country: 'DE' },
  { name: 'Entegris Consumables', country: 'US' },
  { name: 'Fujifilm Electronic Materials', country: 'JP' },
]

/**
 * Generate business partners:
 *  - one customer BP per MES customer (bpNo 'BP-C###'),
 *  - vendor BPs (bpNo 'BP-V###') for the equipment OEMs + chemical/gas suppliers.
 * Deterministic via a fixed seed.
 */
export function generateBusinessPartners(masterData: MasterData): BusinessPartner[] {
  const rng = mulberry32(BP_SEED)
  const partners: BusinessPartner[] = []

  // --- Customers ---
  masterData.customers.forEach((c, i) => {
    partners.push({
      bpNo: `BP-C${String(i + 1).padStart(3, '0')}`,
      role: 'customer',
      name: c.customerName,
      country: pick(COUNTRIES, rng),
      paymentTerms: pick(PAYMENT_TERMS, rng),
      incoterms: pick(INCOTERMS, rng),
      creditLimit: (Math.floor(rng() * 40) + 10) * 1_000_000,
    })
  })

  // --- Vendors ---
  VENDORS.forEach((vendor, i) => {
    partners.push({
      bpNo: `BP-V${String(i + 1).padStart(3, '0')}`,
      role: 'vendor',
      name: vendor.name,
      country: vendor.country,
      paymentTerms: pick(PAYMENT_TERMS, rng),
      incoterms: pick(INCOTERMS, rng),
      creditLimit: (Math.floor(rng() * 20) + 5) * 1_000_000,
    })
  })

  return partners
}
