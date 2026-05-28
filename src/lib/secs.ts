/**
 * Mock SECS/GEM message formatter.
 * Generates text that LOOKS like real SECS-II messages but carries no real transport.
 * Per design doc: S2F41 (Host Command Send) and S6F11 (Event Report Send) appearance only.
 */

export function formatS2F41(toolId: string, command: string, params: Record<string, string>): string {
  const paramLines = Object.entries(params)
    .map(([k, v]) => `      <A "${k}">\n      <A "${v}">`)
    .join('\n')
  return `S2F41 W
  <L [3]
    <A "${toolId}">
    <A "${command}">
    <L [${Object.keys(params).length}]
${paramLines}
    >
  >`
}

export function formatS6F11(toolId: string, ceid: number, reportData: Record<string, string | number>): string {
  const dataLines = Object.entries(reportData)
    .map(([k, v]) => `      <A "${k}">: ${typeof v === 'number' ? `<U4 ${v}>` : `<A "${v}">`}`)
    .join('\n')
  return `S6F11 W
  <L [3]
    <U4 ${ceid}>
    <A "${toolId}">
    <L [${Object.keys(reportData).length}]
${dataLines}
    >
  >`
}

export function formatE10Transition(toolId: string, fromState: string, toState: string, reason?: string): string {
  return formatS6F11(toolId, 1001, {
    TOOLID: toolId,
    PREV_STATE: fromState,
    CURR_STATE: toState,
    ...(reason ? { REASON: reason } : {}),
    TIMESTAMP: new Date().toISOString(),
  })
}

export function formatRecipeLoad(toolId: string, recipeId: string, version: string): string {
  return formatS2F41(toolId, 'PP-SELECT', {
    PPID: recipeId,
    PP_VERSION: version,
    PP_TYPE: 'PROCESS',
  })
}

export function formatLotTrackIn(toolId: string, lotId: string, carrierId: string): string {
  return formatS2F41(toolId, 'LOT-TRACK-IN', {
    LOTID: lotId,
    CARRIER_ID: carrierId,
    SLOT_MAP: '1111111111111111111111111',
  })
}
