import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AddressDisplay } from './AddressDisplay'

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
}
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
})

describe('AddressDisplay', () => {
  const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234567'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders truncated address', () => {
    render(<AddressDisplay address={testAddress} />)
    expect(screen.getByText('0x742d...4567')).toBeInTheDocument()
  })

  it('shows copy text initially', () => {
    render(<AddressDisplay address={testAddress} />)
    expect(screen.getByText('copy')).toBeInTheDocument()
  })

  it('copies address to clipboard on click', async () => {
    render(<AddressDisplay address={testAddress} />)
    
    const button = screen.getByRole('button')
    button.click()
    
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(testAddress)
    })
  })

  it('shows copied text after click', async () => {
    render(<AddressDisplay address={testAddress} />)
    
    const button = screen.getByRole('button')
    button.click()
    
    await waitFor(() => {
      expect(screen.getByText('copied')).toBeInTheDocument()
    })
  })

  it('renders title with full address', () => {
    render(<AddressDisplay address={testAddress} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', testAddress)
  })

  it('handles short address', () => {
    const shortAddress = '0x1234'
    render(<AddressDisplay address={shortAddress} />)
    expect(screen.getByText(shortAddress)).toBeInTheDocument()
  })
})
