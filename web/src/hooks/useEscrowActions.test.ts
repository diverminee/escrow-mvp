import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEscrowActions } from './useEscrowActions'

// Mock wagmi
vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(() => ({
    writeContract: vi.fn(),
    data: '0xhash',
    isPending: false,
    error: null,
    reset: vi.fn(),
  })),
  useWaitForTransactionReceipt: vi.fn(() => ({
    isLoading: false,
    isSuccess: false,
  })),
}))

// Mock contract config
vi.mock('@/lib/contracts/config', () => ({
  getEscrowContract: vi.fn((chainId: number) => ({
    address: chainId === 84532 ? '0xEscrow' : undefined,
    abi: [],
  })),
}))

describe('useEscrowActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all action functions', () => {
    const { result } = renderHook(() => useEscrowActions(84532))
    
    expect(result.current.confirmDelivery).toBeDefined()
    expect(result.current.commitDocuments).toBeDefined()
    expect(result.current.fulfillCommitment).toBeDefined()
    expect(result.current.raiseDispute).toBeDefined()
    expect(result.current.resolveDispute).toBeDefined()
    expect(result.current.escalateToProtocol).toBeDefined()
    expect(result.current.claimTimeout).toBeDefined()
  })

  it('returns hash, isPending, isConfirming, isSuccess, error, reset', () => {
    const { result } = renderHook(() => useEscrowActions(84532))
    
    expect(result.current.hash).toBe('0xhash')
    expect(result.current.isPending).toBe(false)
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.reset).toBeDefined()
  })

  it('returns functions when contract address is undefined', () => {
    const { result } = renderHook(() => useEscrowActions(1))
    
    expect(result.current.confirmDelivery).toBeDefined()
    expect(result.current.raiseDispute).toBeDefined()
    expect(result.current.resolveDispute).toBeDefined()
  })
})
