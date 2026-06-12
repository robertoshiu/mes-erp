// Pure finance computations for the Finance cash-position band. Framework-free
// so they unit-test under the node env. Inputs are the same ErpData slices the
// Finance module already reads — no randomness, no wall-clock coupling.
import type { ErpData, GlAccount } from '../../data/erp/types'

export interface CashPosition {
  /** Open receivables — net value of sales orders not yet complete. */
  openAr: number
  /** Open payables — net value of purchase orders not yet received. */
  openAp: number
  /** AR − AP: positive = creditor position, negative = net debt. */
  net: number
  /** Share of AR backed by the larger of the two sides, for a Gauge fill. */
  arShare: number
  apShare: number
}

/** Net cash position from open AR (sales) vs open AP (purchasing). The Gauges
 *  share a common scale (max of the two) so their fills are directly comparable. */
export function computeCashPosition(erpData: ErpData): CashPosition {
  const openAr = erpData.salesOrders
    .filter(so => so.status !== 'complete')
    .reduce((acc, so) => acc + so.netValue, 0)

  const openAp = erpData.purchaseOrders
    .filter(po => po.status !== 'received')
    .reduce((acc, po) => acc + po.netValue, 0)

  const scale = Math.max(openAr, openAp, 1)
  return {
    openAr,
    openAp,
    net: openAr - openAp,
    arShare: openAr / scale,
    apShare: openAp / scale,
  }
}

export interface TopAccount {
  accountNo: string
  name: string
  /** Sum of |amount| posted to this account across the supplied postings. */
  posted: number
}

/** Rank GL accounts by absolute posted amount across a window of postings.
 *  Accounts with no postings are dropped; names resolve from the chart of
 *  accounts (falls back to the account number when unknown). */
export function rankTopAccounts(
  postings: Array<{ accountNo: string; accountName?: string; amount: number }>,
  glAccounts: GlAccount[],
  limit = 6,
): TopAccount[] {
  const names = new Map<string, string>()
  for (const a of glAccounts) names.set(a.accountNo, a.name)

  const byAccount = new Map<string, { name: string; posted: number }>()
  for (const p of postings) {
    const prev = byAccount.get(p.accountNo)
    const name = prev?.name ?? p.accountName ?? names.get(p.accountNo) ?? p.accountNo
    byAccount.set(p.accountNo, {
      name,
      posted: (prev?.posted ?? 0) + Math.abs(p.amount),
    })
  }

  return [...byAccount.entries()]
    .map(([accountNo, v]) => ({ accountNo, name: v.name, posted: v.posted }))
    .sort((a, b) => b.posted - a.posted)
    .slice(0, limit)
}

/** Fold postings into a cumulative GL-balance trend of `points` buckets. Each
 *  bucket carries the net (signed) flow in that slice plus the running balance,
 *  so the chart can draw a glowing area (balance) + line (flow). Deterministic:
 *  ordering is by the postings array, evenly partitioned into buckets. */
export interface TrendPoint {
  i: number
  flow: number
  balance: number
}

export function buildGlTrend(
  postings: Array<{ amount: number }>,
  points = 12,
): TrendPoint[] {
  const out: TrendPoint[] = []
  const n = postings.length
  let balance = 0
  for (let i = 0; i < points; i++) {
    const start = Math.floor((i * n) / points)
    const end = Math.floor(((i + 1) * n) / points)
    let flow = 0
    for (let j = start; j < end; j++) flow += postings[j].amount
    balance += flow
    out.push({ i, flow, balance })
  }
  return out
}
