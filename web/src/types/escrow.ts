// Mirrors EscrowTypes.sol exactly

export enum EscrowState {
  DRAFT = 0,
  FUNDED = 1,
  RELEASED = 2,
  REFUNDED = 3,
  DISPUTED = 4,
  ESCALATED = 5,
}

export enum EscrowMode {
  CASH_LOCK = 0,
  PAYMENT_COMMITMENT = 1,
}

export enum UserTier {
  BRONZE = 0,
  SILVER = 1,
  GOLD = 2,
  DIAMOND = 3,
}

export enum DeploymentTier {
  TESTNET = 0,
  LAUNCH = 1,
  GROWTH = 2,
  MATURE = 3,
}

// Mirrors EscrowTypes.EscrowTransaction struct
export interface EscrowTransaction {
  buyer: `0x${string}`;
  seller: `0x${string}`;
  arbiter: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  tradeId: bigint;
  tradeDataHash: `0x${string}`;
  state: EscrowState;
  disputeDeadline: bigint;
  feeRate: bigint;
  mode: EscrowMode;
  faceValue: bigint;
  collateralAmount: bigint;
  collateralBps: bigint;
  maturityDate: bigint;
  commitmentFulfilled: boolean;
}

// Mirrors EscrowTypes.DocumentSet struct
export interface DocumentSet {
  invoiceHash: `0x${string}`;
  bolHash: `0x${string}`;
  packingHash: `0x${string}`;
  cooHash: `0x${string}`;
  merkleRoot: `0x${string}`;
  committedAt: bigint;
}
