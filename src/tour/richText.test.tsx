import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderInline, renderBody } from './richText'

/* ──────────────────────────────────────────────────────────────────────────
 * richText parser tests. The parser returns React nodes (no DOM needed):
 * we assert on the element-tree SHAPE — element type, className, children —
 * rather than rendering to a DOM. React.createElement works in the node env.
 * ────────────────────────────────────────────────────────────────────────── */

interface Shape {
  type: string | 'text'
  text?: string
  className?: string
}

/** Reduce a renderInline() node array to a comparable shape list. */
function shapeOf(nodes: ReactNode[]): Shape[] {
  return nodes.map((n): Shape => {
    if (isValidElement(n)) {
      const el = n as ReactElement<{ className?: string; children?: ReactNode }>
      const type = el.type
      // Fragment renders plain text; <strong>/<code> are intrinsic string types.
      if (typeof type === 'string') {
        return {
          type,
          className: el.props.className,
          text: typeof el.props.children === 'string' ? el.props.children : undefined,
        }
      }
      // Fragment (Symbol) wrapping a text slice.
      return { type: 'text', text: typeof el.props.children === 'string' ? el.props.children : undefined }
    }
    return { type: 'text', text: String(n) }
  })
}

describe('renderInline', () => {
  it('passes plain text through as a single text node', () => {
    const out = shapeOf(renderInline('hello world', 'k'))
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('hello world')
  })

  it('wraps **bold** in a <strong>', () => {
    const out = shapeOf(renderInline('a **bold** b', 'k'))
    const strong = out.find(s => s.type === 'strong')
    expect(strong).toBeDefined()
    expect(strong!.text).toBe('bold')
    expect(strong!.className).toContain('font-semibold')
    // surrounding text preserved
    expect(out[0].text).toBe('a ')
    expect(out[out.length - 1].text).toBe(' b')
  })

  it('wraps `code` in a <code> with the accent chip classes', () => {
    const out = shapeOf(renderInline('use `OEE` here', 'k'))
    const code = out.find(s => s.type === 'code')
    expect(code).toBeDefined()
    expect(code!.text).toBe('OEE')
    expect(code!.className).toContain('font-mono')
  })

  it('handles multiple mixed spans in order', () => {
    const out = shapeOf(renderInline('**A** mid `B` end', 'k'))
    const types = out.map(s => s.type)
    expect(types).toContain('strong')
    expect(types).toContain('code')
    expect(out.find(s => s.type === 'strong')!.text).toBe('A')
    expect(out.find(s => s.type === 'code')!.text).toBe('B')
  })

  it('leaves unmatched markers as literal text', () => {
    const out = shapeOf(renderInline('a * b ` c', 'k'))
    // No strong/code produced.
    expect(out.some(s => s.type === 'strong' || s.type === 'code')).toBe(false)
  })
})

describe('renderBody', () => {
  it('splits on blank lines into multiple <p> elements', () => {
    const node = renderBody('first para\n\nsecond para', 'b')
    const paras = node as ReactElement[]
    expect(Array.isArray(paras)).toBe(true)
    expect(paras).toHaveLength(2)
    expect(paras.every(p => isValidElement(p) && p.type === 'p')).toBe(true)
  })

  it('produces a single <p> for text without blank lines', () => {
    const node = renderBody('only one', 'b')
    const paras = node as ReactElement[]
    expect(paras).toHaveLength(1)
  })

  it('applies inline markdown inside each paragraph', () => {
    const node = renderBody('has **bold** inside', 'b')
    const paras = node as ReactElement<{ children: ReactNode[] }>[]
    const inlineShapes = shapeOf(paras[0].props.children)
    expect(inlineShapes.some(s => s.type === 'strong')).toBe(true)
  })
})
