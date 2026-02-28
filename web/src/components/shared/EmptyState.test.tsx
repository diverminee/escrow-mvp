import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState, NoEscrowsEmptyState, NoDisputesEmptyState, NotConnectedEmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Test Title" description="Test Description" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  it('renders custom icon when provided', () => {
    render(<EmptyState title="Title" description="Desc" icon="escrow" />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders action button with label', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        title="Title"
        description="Desc"
        action={{ label: 'Click Me', onClick: handleClick }}
      />
    )
    expect(screen.getByText('Click Me')).toBeInTheDocument()
  })

  it('calls onClick when action button is clicked', () => {
    const handleClick = vi.fn()
    render(
      <EmptyState
        title="Title"
        description="Desc"
        action={{ label: 'Click Me', onClick: handleClick }}
      />
    )
    screen.getByText('Click Me').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

describe('NoEscrowsEmptyState', () => {
  it('renders correct title and description', () => {
    render(<NoEscrowsEmptyState />)
    expect(screen.getByText('No Escrows Yet')).toBeInTheDocument()
    expect(screen.getByText(/Create your first escrow/)).toBeInTheDocument()
    expect(screen.getByText('Create Escrow')).toBeInTheDocument()
  })

  it('calls onCreateNew when button clicked', () => {
    const handleClick = vi.fn()
    render(<NoEscrowsEmptyState onCreateNew={handleClick} />)
    screen.getByText('Create Escrow').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

describe('NoDisputesEmptyState', () => {
  it('renders correct title', () => {
    render(<NoDisputesEmptyState />)
    expect(screen.getByText('No Disputes')).toBeInTheDocument()
  })
})

describe('NotConnectedEmptyState', () => {
  it('renders correct title', () => {
    render(<NotConnectedEmptyState />)
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
  })
})
