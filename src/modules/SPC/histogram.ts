// Pure histogram-binning for the SPC distribution panel. Frameworkless so it
// unit-tests under the node env — no recharts / DOM coupling.

export interface HistogramBin {
  /** Inclusive lower edge of the bin. */
  x0: number
  /** Exclusive upper edge of the bin (inclusive for the final bin). */
  x1: number
  /** Bin center (handy as a chart X key). */
  center: number
  /** Sample count falling in [x0, x1). */
  count: number
}

/**
 * Bin `values` into `binCount` equal-width buckets spanning [domainMin, domainMax].
 * Values are clamped into the domain so out-of-spec samples still land in the edge
 * bins rather than being dropped. Returns evenly-spaced bins even when empty so the
 * chart axis stays stable as data streams in. Degenerate inputs (binCount < 1 or a
 * zero-width domain) yield an empty array.
 */
export function binValues(
  values: number[],
  domainMin: number,
  domainMax: number,
  binCount: number,
): HistogramBin[] {
  if (binCount < 1 || !(domainMax > domainMin)) return []

  const width = (domainMax - domainMin) / binCount
  const bins: HistogramBin[] = []
  for (let i = 0; i < binCount; i++) {
    const x0 = domainMin + i * width
    const x1 = i === binCount - 1 ? domainMax : domainMin + (i + 1) * width
    bins.push({ x0, x1, center: (x0 + x1) / 2, count: 0 })
  }

  for (const v of values) {
    if (!Number.isFinite(v)) continue
    const clamped = Math.max(domainMin, Math.min(domainMax, v))
    // Map to a bin index, clamping the right edge into the last bin.
    let idx = Math.floor((clamped - domainMin) / width)
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    bins[idx].count++
  }

  return bins
}
