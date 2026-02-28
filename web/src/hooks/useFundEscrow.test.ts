import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFundEscrow } from './useFundEscrow'
import { ZERO_ADDRESS } from '@/lib/constants'

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
}))

// Mock contract config
vi.mock('@/lib/contracts/config', () => ({
  getEscrowContract: vi.fn((chainId: number) => ({
    address: chainId === 84532 ? '0xEscrow' : undefined,
    abi: [],
  })),
}))

describe('useFundEscrow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns fund function', () => {
    const { result } = renderHook(() => useFundEscrow(84532))
    expect(result.current.fund).toBeDefined()
    expect(typeof result.current.fund).toBe('function')
  })

  it('returns fundAfterApproval function', () => {
    const { result } = renderHook(() => useFundEscrow(84532))
    expect(result.current.fundAfterApproval).toBeDefined()
    expect(typeof result.current.fundAfterApproval).toBe('function')
  })

  it('returns hash, isPending, isConfirming, isSuccess, error', () => {
    const { result } = renderHook(() => useFundEscrow(84532))
    expect(result.current.hash).toBe('0xhash')
    expect(result.current.isPending).toBe(false)
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('returns functions when contract address is undefined', () => {
    const { result } = renderHook(() => useFundEscrow(1))
    expect(result.current.fund).toBeDefined()
    expect(result.current.fundAfterApproval).toBeDefined()
  })
})
