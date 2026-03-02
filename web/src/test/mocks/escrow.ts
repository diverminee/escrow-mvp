import { EscrowTransaction, EscrowState, EscrowMode } from "@/types/escrow";

/**
 * Mock escrow data for testing
 */

export const mockAddresses = {
  buyer: "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E",
  seller: "0x9B3a54D092fF5A68eE3f2dE4f9C4D7fF4d7c4B3a",
  arbiter: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
  random: "0xAb8483F64d9C6d1ECf9D849f5B7c3c6c6f1dC4E7",
  zero: "0x0000000000000000000000000000000000000000",
};

export const mockTokens = {
  eth: "0x0000000000000000000000000000000000000000",
  usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  usdt: "0xdac17f958d2ee523a2206206994597c13d831ec7",
};

export const createMockEscrow = (overrides: Partial<EscrowTransaction> = {}): EscrowTransaction => ({
  escrowId: 1n,
  buyer: mockAddresses.buyer as `0x${string}`,
  seller: mockAddresses.seller as `0x${string}`,
  arbiter: mockAddresses.arbiter as `0x${string}`,
  token: mockTokens.usdc as `0x${string}`,
  amount: 1000n * 10n ** 6n, // 1000 USDC
  tradeId: "TRADE-001",
  tradeDataHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  state: EscrowState.DRAFT,
  disputeDeadline: 0n,
  feeRate: 25n, // 2.5%
  mode: EscrowMode.CASH_LOCK,
  faceValue: 1000n * 10n ** 6n,
  collateralAmount: 0n,
  collateralBps: 0n,
  maturityDate: 0n,
  commitmentFulfilled: false,
  createdAt: BigInt(Math.floor(Date.now() / 1000)),
  ...overrides,
});

export const mockEscrowList: EscrowTransaction[] = [
  createMockEscrow({ escrowId: 1n, state: EscrowState.DRAFT, tradeId: "TRADE-001" }),
  createMockEscrow({ escrowId: 2n, state: EscrowState.FUNDED, tradeId: "TRADE-002" }),
  createMockEscrow({ escrowId: 3n, state: EscrowState.RELEASED, tradeId: "TRADE-003" }),
  createMockEscrow({ escrowId: 4n, state: EscrowState.DISPUTED, tradeId: "TRADE-004" }),
  createMockEscrow({ escrowId: 5n, state: EscrowState.REFUNDED, tradeId: "TRADE-005" }),
];

export const mockEscrowByState = {
  draft: createMockEscrow({ state: EscrowState.DRAFT }),
  funded: createMockEscrow({ state: EscrowState.FUNDED }),
  released: createMockEscrow({ state: EscrowState.RELEASED }),
  refunded: createMockEscrow({ state: EscrowState.REFUNDED }),
  disputed: createMockEscrow({ state: EscrowState.DISPUTED }),
  escalated: createMockEscrow({ state: EscrowState.ESCALATED }),
};

/**
 * Mock blockchain responses
 */
export const mockTxHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

export const mockBlockNumber = 12345678n;

export const mockGasEstimate = 50000n;
