import type { GlAccount } from './types'

// A small, conventional GL chart of accounts for a fab.
// Asset / liability / revenue / expense balanced enough for the Finance module.
const ACCOUNTS: GlAccount[] = [
  { accountNo: '110000', name: 'Inventory - Raw Materials', type: 'asset' },
  { accountNo: '120000', name: 'Inventory - Work in Process', type: 'asset' },
  { accountNo: '130000', name: 'Inventory - Finished Goods', type: 'asset' },
  { accountNo: '140000', name: 'Accounts Receivable', type: 'asset' },
  { accountNo: '150000', name: 'Equipment - Fab Tools', type: 'asset' },
  { accountNo: '210000', name: 'Accounts Payable', type: 'liability' },
  { accountNo: '220000', name: 'Accrued Liabilities', type: 'liability' },
  { accountNo: '400000', name: 'Revenue - Wafer Sales', type: 'revenue' },
  { accountNo: '410000', name: 'Revenue - Foundry Services', type: 'revenue' },
  { accountNo: '500000', name: 'COGS - Wafers', type: 'expense' },
  { accountNo: '510000', name: 'Production Variance', type: 'expense' },
  { accountNo: '520000', name: 'Scrap & Yield Loss', type: 'expense' },
  { accountNo: '600000', name: 'Maintenance & Spares', type: 'expense' },
  { accountNo: '610000', name: 'Utilities & Facilities', type: 'expense' },
]

/** Generate the fab's chart of accounts. Static, fully deterministic. */
export function generateGlAccounts(): GlAccount[] {
  return ACCOUNTS.map(a => ({ ...a }))
}
