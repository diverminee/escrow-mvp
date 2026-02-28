import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useEscrowById, useEscrowCount } from './useEscrowList'

// Mock wagmi
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(({ functionName, args, query }) => {
    // Return undefined when query is disabled (invalid chainId)
    if (query?.enabled === false) {
      return { data: undefined, isLoading: false, isError: false }
    }
    if (functionName === 'getEscrow') {
      return {
        data: args?.[0] === 1n ? {
          buyer: '0xBuyer',
          seller: '0xSeller',
          amount: 1000n,
          state: 1,
        } : undefined,
        isLoading: false,
        isError: false,
      }
    }
    if (functionName === 'getEscrowCount') {
      return {
        data: 5n,
        isLoading: false,
        isError: false,
      }
    }
    return { data: undefined, isLoading: false, isError: false }
  }),
}))

// Mock contract config
vi.mock('@/lib/contracts/config', () => ({
  getEscrowContract: vi.fn((chainId: number) => ({
    address: chainId === 84532 ? '0xEscrow' : undefined,
    abi: [],
  })),
}))

describe('useEscrowById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns escrow data when found', async () => {
    const { result } = renderHook(() => useEscrowById(1n, 84532))
    
    await waitFor(() => {
      expect(result.current.escrow).toBeDefined()
    })
    
    expect(result.current.escrow?.buyer).toBe('0xBuyer')
    expect(result.current.escrow?.seller).toBe('0xSeller')
  })

  it('returns undefined when escrow not found', async () => {
    const { result } = renderHook(() => useEscrowById(999n, 84532))
    
    await waitFor(() => {
      expect(result.current.escrow).toBeUndefined()
    })
  })

  it('returns undefined when chainId is invalid', async () => {
    const { result } = renderHook(() => useEscrowById(1n, 1))
    
    await waitFor(() => {
      expect(result.current.escrow).toBeUndefined()
    })
  })
})

describe('useEscrowCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns escrow count', async () => {
    const { result } = renderHook(() => useEscrowCount(84532))
    
    await waitFor(() => {
      expect(result.current.count).toBe(5)
    })
  })

  it('returns 0 when chainId is invalid', async () => {
    const { result } = renderHook(() => useEscrowCount(1))
    
    await waitFor(() => {
      expect(result.current.count).toBe(0)
    })
  })
})
