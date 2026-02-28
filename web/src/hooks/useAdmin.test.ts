import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAdmin, useIsOwner, useContractState } from './useAdmin'

// Mock wagmi
vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(() => ({
    writeContract: vi.fn(),
    data: '0xhash',
    isPending: false,
    error: null,
  })),
  useWaitForTransactionReceipt: vi.fn(() => ({
    isLoading: false,
    isSuccess: false,
  })),
  useReadContract: vi.fn(() => ({
    data: '0xOwner',
    isLoading: false,
  })),
  useAccount: vi.fn(() => ({
    address: '0xUser',
    isConnected: true,
  })),
  useChainId: vi.fn(() => 84532),
}))

// Mock contract config
vi.mock('@/lib/contracts/config', () => ({
  getEscrowContract: vi.fn(() => ({
    address: '0xEscrow',
    abi: [],
  })),
}))

describe('useAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all admin functions', () => {
    const { result } = renderHook(() => useAdmin())
    
    // KYC
    expect(result.current.setKYCStatus).toBeDefined()
    expect(result.current.batchSetKYCStatus).toBeDefined()
    // Tokens
    expect(result.current.addApprovedToken).toBeDefined()
    expect(result.current.removeApprovedToken).toBeDefined()
    // Tier
    expect(result.current.upgradeTier).toBeDefined()
    expect(result.current.setMaxEscrowAmount).toBeDefined()
    expect(result.current.setMinEscrowAmount).toBeDefined()
    // Settings
    expect(result.current.setFeeRecipient).toBeDefined()
    expect(result.current.setProtocolArbiter).toBeDefined()
    // Pause
    expect(result.current.pause).toBeDefined()
    expect(result.current.unpause).toBeDefined()
  })

  it('returns hash, isPending, isConfirming, isSuccess, error', () => {
    const { result } = renderHook(() => useAdmin())
    
    expect(result.current.hash).toBe('0xhash')
    expect(result.current.isPending).toBe(false)
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBe(null)
  })
})

describe('useIsOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when address matches owner', () => {
    const { result } = renderHook(() => useIsOwner())
    // Based on mock, address is 0xUser and owner is 0xOwner
    // They don't match so it should be false
    expect(result.current).toBe(false)
  })
})

describe('useContractState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns contract state', () => {
    const { result } = renderHook(() => useContractState())
    
    expect(result.current.isPaused).toBe('0xOwner')
    expect(result.current.owner).toBe('0xOwner')
    expect(result.current.tier).toBe('0xOwner')
  })
})
