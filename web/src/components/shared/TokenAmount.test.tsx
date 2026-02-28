import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokenAmount } from './TokenAmount'
import { ZERO_ADDRESS } from '@/lib/constants'

describe('TokenAmount', () => {
  it('renders ETH for zero address', () => {
    render(<TokenAmount amount={1000000000000000000n} token={ZERO_ADDRESS} />)
    expect(screen.getByText(/1.*ETH/)).toBeInTheDocument()
  })

  it('renders Token for non-zero address', () => {
    const tokenAddress = '0x1234567890123456789012345678901234567890'
    render(<TokenAmount amount={500000000000000000n} token={tokenAddress} />)
    expect(screen.getByText(/0\.5.*Token/)).toBeInTheDocument()
  })

  it('renders large amounts correctly', () => {
    render(<TokenAmount amount={1000000000000000000000n} token={ZERO_ADDRESS} />)
    expect(screen.getByText(/1000.*ETH/)).toBeInTheDocument()
  })

  it('renders zero amount', () => {
    render(<TokenAmount amount={0n} token={ZERO_ADDRESS} />)
    expect(screen.getByText(/0.*ETH/)).toBeInTheDocument()
  })
})
