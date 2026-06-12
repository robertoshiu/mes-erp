// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModuleHeader } from './ModuleHeader'

afterEach(cleanup)

describe('ModuleHeader', () => {
  it('renders the title and domain chip label', () => {
    render(<ModuleHeader title="Materials" domain="ERP" />)
    expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument()
    expect(screen.getByText('ERP')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<ModuleHeader title="Inventory" subtitle="Stock & movements" domain="ERP" />)
    expect(screen.getByText('Stock & movements')).toBeInTheDocument()
  })

  it('renders pill labels and values', () => {
    render(
      <ModuleHeader
        title="Cockpit"
        domain="MES"
        pills={[
          { label: 'OEE', value: '82%', tone: 'success' },
          { label: 'WIP', value: 1280, tone: 'info' },
        ]}
      />,
    )
    expect(screen.getByText('OEE')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('WIP')).toBeInTheDocument()
    expect(screen.getByText('1280')).toBeInTheDocument()
  })

  it('renders the right slot content', () => {
    render(<ModuleHeader title="Finance" domain="ERP" right={<button>Refresh</button>} />)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })
})
