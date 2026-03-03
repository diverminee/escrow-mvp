# Credence Technical Specification

> Programmable escrow infrastructure for international trade. Built on Ethereum. Secured by smart contracts.

This document provides comprehensive technical requirements for the Credence protocol, covering smart contracts, frontend, and backend infrastructure.

---

## Table of Contents

- [Credence Technical Specification](#credence-technical-specification)
  - [Table of Contents](#table-of-contents)
  - [PART 1: SMART CONTRACT REQUIREMENTS](#part-1-smart-contract-requirements)
    - [Contract Architecture Overview](#contract-architecture-overview)
    - [1. TradeInfraEscrow.sol (Production Contract)](#1-tradeinfraescrowsol-production-contract)
    - [2. BaseEscrow.sol (Abstract Base)](#2-baseescrowsol-abstract-base)
    - [3. DisputeEscrow.sol (Abstract)](#3-disputeescrowsol-abstract)
    - [4. CentralizedTradeOracle.sol](#4-centralizedtradeoraclesol)
    - [5. ChainlinkTradeOracle.sol](#5-chainlinktradeoraclesol)
    - [6. CredenceReceivable.sol (ERC-721 NFT)](#6-credencereceivablesol-erc-721-nft)
    - [7. ProtocolArbiterMultisig.sol](#7-protocolarbitermultisigsol)
    - [8. Libraries](#8-libraries)
      - [EscrowTypes.sol](#escrowtypessol)
      - [ReputationLibrary.sol](#reputationlibrarysol)
  - [PART 2: FRONTEND TECHNICAL REQUIREMENTS](#part-2-frontend-technical-requirements)
    - [Pages](#pages)
    - [Components](#components)
    - [Key Hooks](#key-hooks)
    - [Tech Stack](#tech-stack)
  - [PART 3: BACKEND \& INFRASTRUCTURE ANALYSIS](#part-3-backend--infrastructure-analysis)
    - [Traditional Trade Finance vs. Credence](#traditional-trade-finance-vs-credence)
    - [Required Backend Services](#required-backend-services)
      - [1. Oracle Operator Service (CRITICAL)](#1-oracle-operator-service-critical)
      - [2. KYC Onboarding Service (CRITICAL)](#2-kyc-onboarding-service-critical)
      - [3. Maturity Monitor (Batch Job - RECOMMENDED)](#3-maturity-monitor-batch-job---recommended)
      - [4. Notification Service (OPTIONAL)](#4-notification-service-optional)
    - [AI Integration Opportunities](#ai-integration-opportunities)
  - [PART 4: SECURITY CONSIDERATIONS](#part-4-security-considerations)
    - [Implemented Security Measures](#implemented-security-measures)
    - [Known Limitations](#known-limitations)
    - [Pre-Mainnet Requirements](#pre-mainnet-requirements)
  - [APPENDIX: Constants](#appendix-constants)
    - [Deployment Tiers](#deployment-tiers)
    - [Fee Structure](#fee-structure)
    - [Time Constants](#time-constants)
    - [Collateral Parameters](#collateral-parameters)

---

## PART 1: SMART CONTRACT REQUIREMENTS

### Contract Architecture Overview

```
Inheritance Chain:
BaseEscrow (abstract)
    └── DisputeEscrow (abstract)
            └── TradeInfraEscrow (production)
```

---

### 1. TradeInfraEscrow.sol (Production Contract)

**Purpose:** Main production-grade escrow contract for international trade with oracle integration and arbitration.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `confirmDelivery(uint256 _escrowId)` | Buyer | Buyer manually confirms goods/services delivery and releases funds to seller. Only buyer can call. Requires escrow state to be FUNDED. Triggers _releaseFunds() internal function. Emits DeliveryConfirmed event. |
| `confirmByOracle(uint256 _escrowId)` | Anyone | Release funds based on oracle verification. Requires documents to be committed first (merkleRoot != 0). Calls oracle.verifyTradeData() with the document merkle root. Reverts if oracle returns false. Emits OracleConfirmed event. |
| `confirmByOracleSecure(uint256 _escrowId)` | Anyone | Enhanced oracle verification that validates individual document hashes (invoice, BOL, packing, COO) not just the merkle root. Uses verifyTradeDataWithDocuments() for stronger security. |
| `fulfillCommitment(uint256 _escrowId)` | Buyer | Buyer pays the remaining balance for PAYMENT_COMMITMENT mode escrows. Requires: escrow in FUNDED state, caller is buyer, mode is PAYMENT_COMMITMENT, not already fulfilled, maturity not passed. For ETH: msg.value must equal remaining (amount - collateralAmount). For ERC20: safeTransferFrom remaining amount. Sets commitmentFulfilled = true. Emits CommitmentFulfilled. |
| `claimDefaultedCommitment(uint256 _escrowId)` | Seller | Seller claims collateral after buyer defaults. Requires: escrow FUNDED, caller is seller, PAYMENT_COMMITMENT mode, not yet fulfilled, maturity date passed. Releases collateralAmount to seller. Emits CommitmentDefaulted. |
| `getMaturityStatus(uint256 _escrowId)` | Public View | Returns tuple: (isPC, maturity, fulfilled, overdue, remaining). isPC = whether payment commitment mode. maturity = maturityDate timestamp. fulfilled = commitmentFulfilled flag. overdue = block.timestamp > maturityDate. remaining = amount - collateralAmount (0 if fulfilled). |
| `getUserTierName(address _user)` | Public View | Returns user's tier as human-readable string: "DIAMOND", "GOLD", "SILVER", or "BRONZE". |
| `escrowIsValid(uint256 _escrowId)` | Public View | Returns boolean indicating if escrow exists. Simple existence check. |
| `commitDocumentsHash(uint256 _escrowId, bytes32 _commitmentHash)` | Seller | **Security Fix:** First step of commit-reveal. Seller commits a hash of all document hashes combined: keccak256(keccak256(invoiceHash\|bolHash\|packingHash\|cooHash)). Prevents front-running. Stores commitment hash and timestamp. Reverts if documents already committed or commitment is zero. |
| `revealDocuments(uint256 _escrowId, bytes32 _invoiceHash, bytes32 _bolHash, bytes32 _packingHash, bytes32 _cooHash)` | Seller | **Security Fix:** Second step - reveals actual document hashes and verifies they match the commitment. Validates that revealed hash matches stored commitment. Calls _commitDocumentsInternal() if valid. Reverts if commitment not found or already revealed. |
| `_commitDocumentsInternal(...)` | Internal | Internal function that stores document hashes, computes Merkle root, emits DocumentsCommitted. For PAYMENT_COMMITMENT mode, mints receivable NFT via IReceivableMinter. Wrapped in try/catch so NFT failure doesn't block escrow. |

---

### 2. BaseEscrow.sol (Abstract Base)

**Purpose:** Core escrow logic with reputation system, KYC, tiers, documents, and receivables.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `createEscrow(...)` (6 params) | KYC-approved | Create CASH_LOCK mode escrow. Parameters: seller, arbiter, token, amount, tradeId, tradeDataHash. Validates: addresses not zero, amount > 0, amount >= minEscrowAmount, amount <= maxEscrowAmount, buyer != seller, arbiter != buyer/seller, both parties KYC-approved, protocol arbiter not party. Sets collateralAmount = amount (full value), feeRate snapshot from seller tier. Emits EscrowCreated. |
| `createEscrow(...)` (9 params) | KYC-approved | Create with explicit mode. Additional params: mode (CASH_LOCK or PAYMENT_COMMITMENT), maturityDays, collateralBps. For PAYMENT_COMMITMENT: validates collateralBps (1000-5000 = 10-50%), calculates collateralAmount = amount * bps / 10000, sets maturityDate = now + days. For CASH_LOCK: collateralAmount = amount. |
| `fund(uint256 _escrowId)` | Buyer | Fund escrow with ETH or ERC20. For ETH: msg.value must equal collateralAmount. For ERC20: safeTransferFrom buyer for collateralAmount. Changes state DRAFT → FUNDED. Emits EscrowFunded. |
| `commitDocuments(uint256 _escrowId, bytes32 _invoiceHash, bytes32 _bolHash, bytes32 _packingHash, bytes32 _cooHash)` | Seller | Commit trade documents with Merkle root. Computes merkle root from up to 4 document hashes. Stores all hashes + merkleRoot + timestamp. For PAYMENT_COMMITMENT: mints receivable NFT. Reverts if already committed or no document hashes. Emits DocumentsCommitted. |
| `setKYCStatus(address _user, bool _status)` | Owner | Approve/revoke KYC for single user. Simple boolean mapping. Emits KYCStatusUpdated. |
| `batchSetKYCStatus(address[] _users, bool _status)` | Owner | Bulk KYC update. **Security:** Limited to MAX_BATCH_KYC_SIZE (100). Prevents gas exhaustion attacks. Emits KYCStatusUpdated for each. |
| `addApprovedToken(address _token)` | Owner | Add ERC20 token to allowlist. Emits ApprovedTokenAdded. |
| `removeApprovedToken(address _token)` | Owner | Remove token from allowlist. Emits ApprovedTokenRemoved. |
| `transferOwnership(address _newOwner)` | Owner | Transfer admin rights. Cannot be zero address. Emits OwnershipTransferred. |
| `upgradeTier(DeploymentTier _newTier)` | Owner | Upgrade deployment tier (one-way). TESTNET → LAUNCH → GROWTH → MATURE. Sets maxEscrowAmount to tier ceiling. Cannot decrease tier. Emits DeploymentTierUpgraded. |
| `setMaxEscrowAmount(uint256 _amount)` | Owner | Set custom max within current tier ceiling. Reverts if exceeds tier limit. |
| `setMinEscrowAmount(uint256 _min)` | Owner | Set minimum escrow amount (default 0.01 ether). Prevents dust attacks. Emits MinEscrowAmountUpdated. |
| `setTierLimits(uint256 _launch, uint256 _growth, uint256 _mature)` | Owner | Set tier ceiling limits. Must maintain launch <= growth <= mature. Emits TierLimitsUpdated. |
| `setFeeRecipient(address _feeRecipient)` | Owner | Update protocol fee collector. Cannot be zero or same as protocolArbiter. Emits FeeRecipientUpdated. |
| `setProtocolArbiter(address _protocolArbiter)` | Owner | Update escalation authority. Cannot be zero or same as feeRecipient. Emits ProtocolArbiterUpdated. |
| `setReceivableMinter(address _minter)` | Owner | Register/unregister receivable NFT minter. Emits ReceivableMinterUpdated. |
| `pause()` | Owner | Emergency pause. Blocks createEscrow, fund, fulfillCommitment. Other functions (settlement, disputes) still work. |
| `unpause()` | Owner | Resume normal operations. |
| `initiateFeeRecipientChange(address _newFeeRecipient)` | Owner | **Security Fix:** Timelock initiation. Must wait TIMELOCK_DELAY (48 hours) before confirming. Stores pending address + execution time. |
| `confirmFeeRecipientChange()` | Owner | **Security Fix:** Execute after timelock. Validates timelock expired, updates feeRecipient, clears pending. |
| `initiateProtocolArbiterChange(address _newArbiter)` | Owner | **Security Fix:** Timelock initiation for protocol arbiter change. |
| `confirmProtocolArbiterChange()` | Owner | **Security Fix:** Execute after timelock for protocol arbiter. |
| `getEscrow(uint256 _escrowId)` | Public View | Returns full EscrowTransaction struct: buyer, seller, arbiter, token, amount, tradeId, tradeDataHash, state, disputeDeadline, feeRate, mode, faceValue, collateralAmount, collateralBps, maturityDate, commitmentFulfilled. |
| `getEscrowCount()` | Public View | Returns nextEscrowId (total count). |
| `getUserTier(address _user)` | Public View | Returns UserTier enum based on successfulTrades and disputesLost. |
| `getUserFeeRate(address _user)` | Public View | Returns fee rate in per-mille (e.g., 12 = 1.2%). |
| `getUserStats(address _user)` | Public View | Returns tuple: (successfulTrades, disputesInitiated, disputesLost). |
| `getReceivableTokenId(uint256 _escrowId)` | Public View | Returns ERC-721 token ID for Payment Commitment escrows (0 if not minted). |
| `calculateFee(uint256 _amount, uint256 _feeRate)` | Public View Pure | Calculates fee with MIN_FEE_AMOUNT threshold (0.0001 ether) to prevent dust. |

**Internal Functions:**
- `_createEscrowInternal(...)` - Core creation logic with all validations
- `_releaseFunds(uint256 _escrowId, address _recipient)` - Release to seller with fee deduction
- `_refundFunds(uint256 _escrowId, address _recipient)` - Refund to buyer
- `_settleReceivable(uint256 _escrowId)` - Mark NFT as settled
- `_transferFunds(...)` - ETH or ERC20 transfer
- `_computeMerkleRoot(...)` - Compute Merkle from 1-4 leaves
- `_getTierCeiling(DeploymentTier)` - Get max for tier

---

### 3. DisputeEscrow.sol (Abstract)

**Purpose:** Two-tier dispute resolution with escalation.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `raiseDispute(uint256 _escrowId)` | Buyer/Seller | Open dispute on FUNDED escrow. Rate limiting: max 10 disputes per user. Loss rate check: >50% loss rate with 3+ losses blocks raising. Increments disputesInitiated. Sets disputeDeadline = now + 14 days. State → DISPUTED. Emits DisputeRaised. |
| `resolveDispute(uint256 _escrowId, uint8 _ruling)` | Arbiter | Primary arbiter resolves. Ruling 1: releases to seller, increments buyer disputesLost. Ruling 2: refunds buyer, increments seller disputesLost. Ruling 3: **Security Fix** - split ruling (10-90%). Must resolve before disputeDeadline. Emits DisputeResolved. |
| `resolveDisputeWithSplit(uint256 _escrowId, uint256 _buyerPercentage)` | Arbiter | **Security Fix:** Split ruling. buyerPercentage must be 10-90. Calculates split amounts, updates both parties' disputesLost, transfers funds proportionally. State → RELEASED. Emits DisputeResolved with ruling=3. |
| `escalateToProtocol(uint256 _escrowId)` | Buyer/Seller | Escalate after primary arbiter timeout. Only after disputeDeadline passed. State → ESCALATED. Sets new deadline = now + 7 days (ESCALATION_TIMELOCK). Emits DisputeEscalated. |
| `resolveEscalation(uint256 _escrowId, uint8 _ruling)` | Protocol Arbiter | Final resolution. Same rulings as primary. Updates disputesLost accordingly. Emits EscalationResolved. |
| `resolveEscalationWithSplit(uint256 _escrowId, uint256 _buyerPercentage)` | Protocol Arbiter | **Security Fix:** Split at protocol level. Same split logic as primary. |
| `claimTimeout(uint256 _escrowId)` | Anyone | Timeout recovery. After ESCALATION_TIMELOCK passes with no resolution. Refunds buyer. Permissionless - anyone can trigger. Emits TimeoutClaimed. |
| `canRaiseDispute(address _user)` | Public View | Returns bool if user eligible. Checks: <10 disputes, loss rate <=50% (if 3+ losses). |

---

### 4. CentralizedTradeOracle.sol

**Purpose:** Owner-controlled on-chain registry for trade verification.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `submitVerification(bytes32 tradeDataHash, bool result)` | Owner | Owner submits verification for a trade data hash. Simple boolean result. Updates verifiedTrades mapping. Emits TradeVerified. |
| `submitVerification(bytes32 tradeDataHash, bool result, bytes32[] documentFlags)` | Owner | Submit with per-document breakdown. documentFlags: ordered flags (0x01 = verified, 0x00 = failed) for each of 4 documents. Stores in _documentFlags mapping. |
| `getDocumentVerification(bytes32 merkleRoot)` | Public View | Returns tuple: (overallResult, documentFlags). Allows querying per-document verification. |
| `verifyTradeData(bytes32 tradeDataHash)` | Public View | ITradeOracle interface. Returns verifiedTrades[tradeDataHash]. |
| `verifyTradeDataWithDocuments(...)` | Public View | **Security Fix:** Verifies not just merkle root but checks document flags exist and are valid. |
| `transferOwnership(address newOwner)` | Owner | Transfer oracle admin rights. |

---

### 5. ChainlinkTradeOracle.sol

**Purpose:** Decentralized oracle using Chainlink Functions for trustless verification.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `requestVerification(bytes32 tradeDataHash, string trackingReference)` | Owner | Request verification via Chainlink Functions. Build request with JavaScript source, send to DON. Stores request with timestamp. Blocks re-request unless 24h timeout passed. Emits VerificationRequested. |
| `verifyTradeData(bytes32 tradeDataHash)` | Public View | Returns stored verification result from latest request. |
| `verifyTradeDataWithDocuments(...) | Public View | Delegates to stored result. |
| `getPendingRequest(bytes32 tradeDataHash)` | Public View | Returns (pending, requestId). pending = true if request not yet fulfilled. |
| `setSource(string _source)` | Owner | Update JavaScript source code for future requests. |
| `setCallbackGasLimit(uint32 _callbackGasLimit)` | Owner | Update gas limit for callback. |
| `transferOwnership(address newOwner)` | Owner | Transfer admin. |
| `fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err)` | Internal | Chainlink callback. Decode response as bool, store in verificationResults. If error or empty response, store false. Mark request fulfilled. Emit VerificationFulfilled. |

---

### 6. CredenceReceivable.sol (ERC-721 NFT)

**Purpose:** Tokenized trade receivables for Payment Commitment mode.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `mintReceivable(uint256 escrowId, address seller, uint256 faceValue, uint256 maturityDate, bytes32 documentMerkleRoot, address token)` | Only Escrow | Mint ERC-721 for Payment Commitment. Only callable by registered escrowContract. Stores: escrowId, faceValue, maturityDate, documentMerkleRoot, paymentToken, isSettled=false. Increments _nextTokenId. Emits ReceivableMintedNFT. |
| `settleReceivable(uint256 tokenId)` | Only Escrow | Mark receivable as settled. Only callable by escrow. Sets isSettled=true. Reverts if already settled. Emits ReceivableSettledNFT. |
| `getReceivableData(uint256 tokenId)` | Public View | Returns ReceivableData struct. Reverts if token doesn't exist. |
| `tokenURI(uint256 tokenId)` | Public View | Returns base64-encoded JSON metadata with: name, description, attributes (Face Value, Maturity Date, Status, Payment Token, Escrow ID). Status = "ACTIVE" or "SETTLED". |
| `_update(...)` | Internal Override | Blocks transfer of settled receivables. Allows mint (from==0) and burn (to==0). Reverts SettledReceivableNotTransferable if both from and to are non-zero and isSettled=true. |

---

### 7. ProtocolArbiterMultisig.sol

**Purpose:** Multi-signature governance for escalated dispute resolution.

| Function | Access | Detailed Description |
|----------|--------|---------------------|
| `proposeResolution(uint256 escrowId, uint8 ruling)` | Signer | Create resolution proposal. Auto-approves for proposer. If threshold already met (e.g., threshold=1), immediately executes. Increments nextProposalId. Emits ResolutionProposed, ResolutionApproved. |
| `approveResolution(uint256 proposalId)` | Signer | Signer approves pending proposal. Cannot approve twice. Cannot approve after 7-day expiry. Increments approvalCount. If threshold met, executes. Emits ResolutionApproved. |
| `revokeApproval(uint256 proposalId)` | Signer | Withdraw approval before execution. Decrements approvalCount. Emits ResolutionRevoked. |
| `proposeGovernanceAction(address _target, bytes _callData)` | Signer | Generic governance: addSigner, removeSigner, etc. Stores target + callData. Auto-approves proposer. If threshold met, executes immediately. |
| `addSigner(address signer)` | Self (via proposal) | Add new signer. Only callable from this contract (via governance execution). Reverts if already signer or zero address. Adds to signers array. Emits SignerAdded. |
| `removeSigner(address signer)` | Self (via proposal) | Remove signer. Must maintain threshold (signers-1 >= threshold). Removes from array. Emits SignerRemoved. |
| `getSignerCount()` | Public View | Returns signers.length. |
| `hasApproved(uint256 proposalId, address signer)` | Public View | Returns proposals[proposalId].approvals[signer]. |
| `_executeProposal(uint256 proposalId)` | Internal | If callData > 0: execute governance action (call target). Else: call escrow.resolveEscalation(escrowId, ruling). |

---

### 8. Libraries

#### EscrowTypes.sol

**Enums:**
```solidity
enum State {
    DRAFT,      // Escrow created, not yet funded
    FUNDED,     // Funds locked in contract
    RELEASED,   // Funds released to seller
    REFUNDED,   // Funds refunded to buyer
    DISPUTED,   // Dispute raised, awaiting arbiter
    ESCALATED   // Escalated to protocol arbiter
}

enum UserTier {
    BRONZE,   // Default tier
    SILVER,   // 5+ successful trades
    GOLD,     // 20+ successful trades, ≤1 loss
    DIAMOND   // 50+ successful trades, 0 losses
}

enum DeploymentTier {
    TESTNET,  // Unlimited (development)
    LAUNCH,   // 50,000 tokens max
    GROWTH,   // 500,000 tokens max
    MATURE    // 10,000,000 tokens max
}

enum EscrowMode {
    CASH_LOCK,           // Full amount locked
    PAYMENT_COMMITMENT  // Partial collateral, deferred payment
}
```

**Structs:**
```solidity
struct DocumentSet {
    bytes32 invoiceHash;      // Commercial invoice hash
    bytes32 bolHash;          // Bill of lading hash
    bytes32 packingHash;      // Packing list hash
    bytes32 cooHash;          // Certificate of origin hash
    bytes32 merkleRoot;       // Combined Merkle root
    uint256 committedAt;      // Timestamp of commitment
}

struct EscrowTransaction {
    address buyer;
    address seller;
    address arbiter;
    address token;                    // address(0) for ETH
    uint256 amount;                   // Total trade amount
    uint256 tradeId;                  // External trade identifier
    bytes32 tradeDataHash;            // Hash of trade data
    State state;                      // Current state
    uint256 disputeDeadline;           // Deadline for arbiter action
    uint256 feeRate;                  // Protocol fee (per-mille)
    EscrowMode mode;                  // CASH_LOCK or PAYMENT_COMMITMENT
    uint256 faceValue;                // Full face value
    uint256 collateralAmount;          // Collateral posted
    uint256 collateralBps;             // Collateral as basis points
    uint256 maturityDate;             // Payment commitment due date
    bool commitmentFulfilled;          // Remaining amount paid
}
```

#### ReputationLibrary.sol

**Fee Rates (per-mille):**
| Tier | Successful Trades | Losses Required | Fee Rate |
|------|------------------|-----------------|----------|
| DIAMOND | 50+ | 0 | 0.7% |
| GOLD | 20+ | ≤1 | 0.8% |
| SILVER | 5+ | Any | 0.9% |
| BRONZE | Any | Any | 1.2% |

---

## PART 2: FRONTEND TECHNICAL REQUIREMENTS

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Main hub showing user stats (tier, successful trades, disputes, fee rate), escrow list (max 5), create escrow button |
| Escrow Detail | `/escrow/[id]` | Full escrow details, actions (fund, confirm, dispute), document commitment status, timeline |
| Admin | `/admin` | KYC management, tier configuration, token management |
| Disputes | `/disputes` | List of disputes user is party to, dispute details |
| Receivables | `/receivables` | User's receivable NFTs, transfer functionality |

### Components

| Component | Purpose |
|-----------|---------|
| Header | Navigation, wallet connection, network indicator |
| CreateEscrowForm | Multi-step modal: form → review → success. Supports CASH_LOCK and PAYMENT_COMMITMENT modes |
| EscrowList | Paginated list of escrows with filters |
| EscrowActions | Context-aware buttons: Fund (buyer), Confirm Delivery (buyer), Raise Dispute (any party), etc. |
| DisputeList | List of disputes |
| ReceivableList | NFT grid/list view |
| AdminPanel | KYC batch operations, tier settings |
| AddressDisplay | Truncated address with copy to clipboard |
| StateChip | Colored badge for escrow state (DRAFT, FUNDED, RELEASED, etc.) |
| TierBadge | User tier badge (BRONZE/SILVER/GOLD/DIAMOND) |
| TokenAmount | Formatted token display with symbol |
| NetworkSelector | Chain switching dropdown |
| TransactionPreviewModal | Preview transaction details before signing |

### Key Hooks

| Hook | Function |
|------|----------|
| useCreateEscrow | Create escrow (6-param for CASH_LOCK, 9-param for PAYMENT_COMMITMENT) |
| useEscrowActions | Fund, confirm, dispute, fulfill, claim default |
| useEscrowList | Fetch and filter escrow list |
| useEscrowRead | Read escrow details, maturity status |
| useFundEscrow | Fund with ETH or ERC20 |
| useUserStats | Get tier, fee rate, trade count |
| useAdmin | KYC, tier management |
| useReceivable | NFT operations |
| useGasEstimate | Transaction gas estimation |
| useRealTimeBalances | Live token balances |

### Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Web3:** Wagmi + viem
- **Styling:** Tailwind CSS
- **Testing:** Vitest + React Testing Library + Playwright (E2E)
- **Theme:** Light/dark mode support

---

## PART 3: BACKEND & INFRASTRUCTURE ANALYSIS

### Traditional Trade Finance vs. Credence

| Traditional Trade Finance Function | Credence's On-Chain Equivalent | Backend Needed? |
|-----------------------------------|-------------------------------|-----------------|
| Letter of Credit issuance | Smart contract escrow creation | No |
| Fund custody | Non-custodial smart contract | No |
| Document presentation | Merkle-anchored document commitment | Partially |
| Payment confirmation | confirmDelivery() / confirmByOracle() | **YES** |
| Dispute resolution | Two-tier arbiter system | Partially |
| KYC/AML | on-chain KYC mapping + off-chain verification | **YES** |
| Trade finance monitoring | On-chain events + subgraph | Partially |
| Payment scheduling | Payment Commitment maturity | No |

### Required Backend Services

#### 1. Oracle Operator Service (CRITICAL)

**Purpose:** Verify shipment/delivery data from external sources

**Responsibilities:**
- Poll shipping APIs (FedEx, DHL, UPS, customs databases)
- Verify shipment status matches trade details
- Submit verification results to oracle contract

**Implementation Options:**
- **Centralized:** Manual review → `submitVerification()` call
- **Automated:** Chainlink Functions + external APIs

**Recommendation:** Build oracle operator service regardless of oracle choice:
- Chainlink needs subscription funded
- JS source still needs to query external APIs
- Someone must own the verification logic

#### 2. KYC Onboarding Service (CRITICAL)

**Purpose:** Identity verification for escrow participants

**Responsibilities:**
- Integrate with identity provider (Synaps, Fractal, Civic, SumSub)
- Webhook handler for verification callbacks
- Call `setKYCStatus()` / `batchSetKYCStatus()` on-chain
- Store PII off-chain (NEVER on-chain)

**Flow:**
```
User → KYC Provider → Webhook → Backend → on-chain setKYCStatus()
```

#### 3. Maturity Monitor (Batch Job - RECOMMENDED)

**Purpose:** Monitor Payment Commitment escrows for maturity

**Responsibilities:**
- Scheduled job (every hour)
- Query active Payment Commitment escrows
- Identify overdue escrows (block.timestamp > maturityDate)
- Notify sellers when they can claim defaulted collateral

**Optional Enhancement:** Auto-claim defaulted commitments
- Requires backend wallet with gas funds
- Automatically calls `claimDefaultedCommitment()`

#### 4. Notification Service (OPTIONAL)

**Purpose:** Alert users of on-chain events

**Events to Monitor:**
- EscrowCreated
- EscrowFunded
- DocumentsCommitted
- DeliveryConfirmed / OracleConfirmed
- DisputeRaised
- DisputeResolved
- CommitmentFulfilled / CommitmentDefaulted

**Implementation:**
- Use The Graph for event listening
- Integrate email/push notifications

### AI Integration Opportunities

AI can **partially** enhance certain functions:

| Function | AI Opportunity | Limitation |
|----------|---------------|------------|
| Document Verification | AI OCR + fraud detection for invoice/BOL images | Still needs oracle to submit on-chain |
| Risk Assessment | ML model predicts counterparty risk | Useful for UI but not replacing contracts |
| Dispute Resolution | AI suggests rulings based on evidence | Cannot replace human arbiter (regulatory) |
| Anomaly Detection | AI flags suspicious trade patterns | Useful for monitoring, not execution |

**Verdict:** AI cannot fully replace backend for trade finance due to:
- Regulatory requirements for identity verification
- Need for external data sources (shipping APIs)
- Legal enforceability of dispute outcomes

---

## PART 4: SECURITY CONSIDERATIONS

### Implemented Security Measures

1. **Reentrancy Protection:** All state-changing functions use `nonReentrant` modifier
2. **Safe Transfers:** OpenZeppelin SafeERC20 for non-standard token handling
3. **Role Separation:** Buyer, seller, arbiter, protocol arbiter must all be distinct
4. **KYC Gate:** Both parties must be KYC-approved to create escrow
5. **Fee Snapshot:** Fee rate locked at escrow creation
6. **Dispute Rate Limiting:** Max 10 disputes, >50% loss rate blocks raising
7. **Amount Bounds:** Configurable min/max escrow amounts
8. **Emergency Pause:** Owner can pause capital inflow without trapping funds
9. **Timelocked Admin:** 48-hour delay for sensitive admin changes
10. **Batch Limits:** Max 100 KYC updates per transaction

### Known Limitations

1. **Centralized Oracle Risk:** Compromised owner can submit false verifications
   - **Mitigation:** Deploy ChainlinkTradeOracle for trustless operation
2. **Protocol Arbiter:** Should be multisig, not single EOA
3. **Immutable Contracts:** No upgrade path, requires re-deployment
4. **Receivable NFTs:** Internal protocol claims, not legal instruments

### Pre-Mainnet Requirements

- [ ] Third-party security audit (CRITICAL)
- [ ] Testnet deployment and testing
- [ ] Oracle operator service operational
- [ ] KYC integration live
- [ ] Incident response plan

---

## APPENDIX: Constants

### Deployment Tiers

| Tier | Max Amount | Use Case |
|------|------------|----------|
| TESTNET | Unlimited | Development |
| LAUNCH | 50,000 tokens | Early production |
| GROWTH | 500,000 tokens | Scaling |
| MATURE | 10,000,000 tokens | Full production |

### Fee Structure

| Tier | Fee Rate |
|------|----------|
| BRONZE | 1.2% |
| SILVER | 0.9% |
| GOLD | 0.8% |
| DIAMOND | 0.7% |

### Time Constants

| Parameter | Value |
|-----------|-------|
| DISPUTE_TIMELOCK | 14 days |
| ESCALATION_TIMELOCK | 7 days |
| PROPOSAL_EXPIRY | 7 days |
| TIMELOCK_DELAY | 48 hours |
| COMMIT_REVEAL_TIMELOCK | 5 minutes |
| REQUEST_TIMEOUT | 24 hours |

### Collateral Parameters

| Parameter | Default | Range |
|-----------|---------|-------|
| Collateral BPS | 2000 (20%) | 1000-5000 (10-50%) |
| Maturity Days | 60 | Custom |

---

*This specification is based on codebase commit: 678c6cd30b31abb0392aa48f6d61f7f98341bc27*