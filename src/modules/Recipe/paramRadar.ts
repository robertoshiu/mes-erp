// Parse a recipe's string parameter map into normalized 0..100 radar axes.
// Parameters are stored as display strings (e.g. "RF Power (W)": "640"); we pull
// the leading numeric token and scale it against a per-key nominal range so each
// axis is comparable on the radar. Pure + framework-free → node-env unit test.

export interface RadarAxis {
  /** Short axis label (the parameter key, trimmed of its unit suffix). */
  axis: string
  /** Raw parsed numeric value (NaN-free; non-numeric params are dropped upstream). */
  raw: number
  /** 0..100 normalized magnitude for the radar plot. */
  value: number
}

/** Pull the first numeric token from a parameter string ("−50" / "640" / "3.2"). */
export function parseParamNumber(s: string): number | null {
  const m = s.match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/** Strip a trailing " (unit)" so the axis label stays compact. */
function shortKey(key: string): string {
  return key.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/**
 * Build normalized radar axes from a recipe parameter map. Each numeric param is
 * normalized against the max magnitude in *this* recipe (so the shape reflects the
 * relative parameter profile). Non-numeric params (e.g. "Alignment Mode") are
 * dropped. Returns at most `limit` axes — a radar needs ≥3 to render a polygon.
 */
export function buildParamRadar(
  parameters: Record<string, string>,
  limit = 6,
): RadarAxis[] {
  const parsed: { axis: string; raw: number }[] = []
  for (const [key, val] of Object.entries(parameters)) {
    const n = parseParamNumber(val)
    if (n === null) continue
    parsed.push({ axis: shortKey(key), raw: Math.abs(n) })
  }
  const trimmed = parsed.slice(0, limit)
  const max = Math.max(1, ...trimmed.map(p => p.raw))
  return trimmed.map(p => ({
    axis: p.axis,
    raw: p.raw,
    value: Math.round((p.raw / max) * 100),
  }))
}
