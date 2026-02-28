import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUserStats } from './useUserStats'

// Mock wagmi
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(({ functionName, query }) => {
    if (query?.enabled === false) {
      return { data: undefined, isLoading: false }
    }
    if (functionName === 'getUserStats') {
      return { data: [10n, 5n, 2n], isLoading: false }
    }
    if (functionName === 'getUserTier') {
      return { data: 1n, isLoading: false }
    }
    if (functionName === 'getUserFeeRate') {
      return { data: 9n, isLoading: false }
    }
    if (functionName === 'canRaiseDispute') {
      return { data: true, isLoading: false }
    }
    return { data: undefined, isLoading: false }
  }),
}))

// Mock contract config
vi.mock('@/lib/contracts/config', () => ({
  getEscrowContract: vi.fn(() => ({
    address: '0xEscrow',
    abi: [],
  })),
}))

describe('useUserStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user stats when address is provided', async () => {
    const { result } = renderHook(() => 
      useUserStats('0xUser' as `0x${string}`, 84532)
    )
    
    await waitFor(() => {
      expect(result.current.stats).toBeDefined()
    })
    
    expect(result.current.stats).toEqual([10n, 5n, 2n])
    expect(result.current.tier).toBe(1n)
    expect(result.current.feeRate).toBe(9n)
    expect(result.current.canDispute).toBe(true)
  })

  it('returns undefined when address is undefined', async () => {
    const { result } = renderHook(() => 
      useUserStats(undefined, 84532)
    )
    
    await waitFor(() => {
      expect(result.current.stats).toBeUndefined()
      expect(result.current.tier).toBeUndefined()
      expect(result.current.feeRate).toBeUndefined()
      expect(result.current.canDispute).toBeUndefined()
    })
  })
})
