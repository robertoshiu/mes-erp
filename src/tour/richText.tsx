import { Fragment, type ReactNode } from 'react'

/**
 * Tiny inline markdown parser shared by the Handbook (a local copy of the same
 * rules TourCard uses internally — TourCard's parser is not exported, and the
 * engine files are off-limits to edit, so this lives as its own sibling util).
 *
 *   `**bold**`  => <strong> (ink-1, semibold)
 *   `` `code` `` => mono accent chip
 *
 * No dangerouslySetInnerHTML — returns React nodes.
 */
export function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</Fragment>)
    if (m[1] !== undefined) {
      out.push(
        <strong key={`${keyBase}-b${i}`} className="text-ink-1 font-semibold">
          {m[1]}
        </strong>,
      )
    } else if (m[2] !== undefined) {
      out.push(
        <code
          key={`${keyBase}-c${i}`}
          className="font-mono text-[12px] text-accent bg-accent/10 border border-accent/20 rounded px-1 py-0.5"
        >
          {m[2]}
        </code>,
      )
    }
    last = re.lastIndex
    i++
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}-t${i}`}>{text.slice(last)}</Fragment>)
  return out
}

/**
 * Render a body string into paragraphs split on blank lines, each with inline
 * markdown applied. `keyBase` namespaces React keys when several bodies render
 * in the same list.
 */
export function renderBody(text: string, keyBase = 'b'): ReactNode {
  const paras = text.split(/\n\n+/)
  return paras.map((p, i) => (
    <p key={`${keyBase}-p${i}`} className={i > 0 ? 'mt-2' : undefined}>
      {renderInline(p, `${keyBase}-p${i}`)}
    </p>
  ))
}
