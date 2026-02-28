import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierBadge } from './TierBadge'

describe('TierBadge', () => {
  it('renders correct label for BRONZE tier (0)', () => {
    render(<TierBadge tier={0} />)
    expect(screen.getByText('Bronze')).toBeInTheDocument()
  })

  it('renders correct label for SILVER tier (1)', () => {
    render(<TierBadge tier={1} />)
    expect(screen.getByText('Silver')).toBeInTheDocument()
  })

  it('renders correct label for GOLD tier (2)', () => {
    render(<TierBadge tier={2} />)
    expect(screen.getByText('Gold')).toBeInTheDocument()
  })

  it('renders correct label for DIAMOND tier (3)', () => {
    render(<TierBadge tier={3} />)
    expect(screen.getByText('Diamond')).toBeInTheDocument()
  })

  it('renders Unknown for invalid tier', () => {
    render(<TierBadge tier={99} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('renders with correct inline styles', () => {
    const { container } = render(<TierBadge tier={0} />)
    const span = container.querySelector('span')
    expect(span).toHaveStyle({ textTransform: 'uppercase' })
    expect(span).toHaveStyle({ fontWeight: '700' })
  })
})
