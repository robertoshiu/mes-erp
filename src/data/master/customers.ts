export interface Customer {
  customerId: string
  customerName: string
  displayName: string
}

const CUSTOMERS: [string, string][] = [
  ['CUST-001', 'GlobalTech Semiconductor'],
  ['CUST-002', 'Pacific Micro Systems'],
  ['CUST-003', 'NovaStar Electronics'],
  ['CUST-004', 'Quantum Chip Corp'],
  ['CUST-005', 'SilkRoad IC Design'],
  ['CUST-006', 'DragonBridge Foundry'],
  ['CUST-007', 'AuroraWave Tech'],
  ['CUST-008', 'SummitPeak Digital'],
]

export function generateCustomers(): Customer[] {
  return CUSTOMERS.map(([id, name]) => ({
    customerId: id,
    customerName: name,
    displayName: name.split(' ')[0],
  }))
}
