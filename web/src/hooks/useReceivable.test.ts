import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useReceivableById, useReceivableBalanceOf } from './useReceivable'

// Mock wagmi
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(({ functionName, args, query }) => {
    if (query?.enabled === false) {
      return { data: undefined, isLoading: false, isError: false }
    }
    if (functionName === 'getReceivable') {
      return {
        data: {
          escrowId: 1n,
          faceValue: 1000n,
          collateralAmount: 100n,
          maturityDate: 1700000000n,
          settled: false,
        },
        isLoading: false,
        isError: false,
      }
    }
    if (functionName === 'balanceOf') {
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
  getReceivableContract: vi.fn(() => ({
    address: '0xReceivable',
    abi: [],
  })),
  getEscrowContract: vi.fn(() => ({
    address: '0xEscrow',
    abi: [],
  })),
}))

describe('useReceivableById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns receivable data when found', async () => {
    const { result } = renderHook(() => useReceivableById(1n, 84532))
    
    await waitFor(() => {
      expect(result.current.receivable).toBeDefined()
    })
    
    expect(result.current.receivable?.escrowId).toBe(1n)
    expect(result.current.receivable?.faceValue).toBe(1000n)
  })

  it('returns undefined when tokenId is invalid', async () => {
    const { result } = renderHook(() => useReceivableById(-1n, 84532))
    
    await waitFor(() => {
      expect(result.current.receivable).toBeUndefined()
    })
  })
})

describe('useReceivableBalanceOf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns balance', async () => {
    const { result } = renderHook(() => 
      useReceivableBalanceOf('0xUser' as `0x${string}`, 84532)
    )
    
    await waitFor(() => {
      expect(result.current.balance).toBe(5)
    })
  })

  it('returns 0 when owner is undefined', async () => {
    const { result } = renderHook(() => 
      useReceivableBalanceOf(undefined, 84532)
    )
    
    await waitFor(() => {
      expect(result.current.balance).toBe(0)
    })
  })
})
