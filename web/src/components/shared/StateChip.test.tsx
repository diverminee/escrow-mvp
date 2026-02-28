import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StateChip } from './StateChip'

describe('StateChip', () => {
  it('renders correct label for DRAFT state (0)', () => {
    render(<StateChip state={0} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders correct label for FUNDED state (1)', () => {
    render(<StateChip state={1} />)
    expect(screen.getByText('Funded')).toBeInTheDocument()
  })

  it('renders correct label for RELEASED state (2)', () => {
    render(<StateChip state={2} />)
    expect(screen.getByText('Released')).toBeInTheDocument()
  })

  it('renders correct label for REFUNDED state (3)', () => {
    render(<StateChip state={3} />)
    expect(screen.getByText('Refunded')).toBeInTheDocument()
  })

  it('renders correct label for DISPUTED state (4)', () => {
    render(<StateChip state={4} />)
    expect(screen.getByText('Disputed')).toBeInTheDocument()
  })

  it('renders correct label for ESCALATED state (5)', () => {
    render(<StateChip state={5} />)
    expect(screen.getByText('Escalated')).toBeInTheDocument()
  })

  it('renders Unknown for invalid state', () => {
    render(<StateChip state={99} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('renders with correct inline styles', () => {
    const { container } = render(<StateChip state={0} />)
    const span = container.querySelector('span')
    expect(span).toHaveStyle({ display: 'inline-block' })
    expect(span).toHaveStyle({ borderRadius: '9999px' })
    expect(span).toHaveStyle({ color: '#ffffff' })
  })
})
