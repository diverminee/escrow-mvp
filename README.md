# Credence

> Programmable escrow infrastructure for international trade. Built on Ethereum. Secured by smart contracts.

Credence replaces the institutional trust layer in cross-border commerce with deterministic, on-chain escrow. Funds lock into a non-custodial smart contract at deal inception. Release is triggered by cryptographic proof of delivery, buyer confirmation, or arbitrated resolution — eliminating the banks, brokers, and intermediaries that have extracted margin from global trade for decades.

The protocol introduces two settlement modes — full cash-lock escrow and partial-collateral payment commitments — alongside document-anchored Merkle proofs, tokenized trade receivables (ERC-721), reputation-driven fee tiers, and a two-tier dispute arbitration system. Every mechanism is transparent, auditable, and enforceable without human gatekeepers.

---

## Table of Contents

- [The Problem We Solve](#the-problem-we-solve)
- [Why Previous Blockchain Trade Platforms Failed](#why-previous-blockchain-trade-platforms-failed)
- [How Credence Is Different](#how-credence-is-different)
- [Protocol Overview](#protocol-overview)
- [Architecture](#architecture)
- [Settlement Modes](#settlement-modes)
  - [Cash Lock](#cash-lock)
  - [Payment Commitment](#payment-commitment)
- [Document Commitment](#document-commitment)
- [Trade Receivable NFTs](#trade-receivable-nfts)
- [KYC and Access Control](#kyc-and-access-control)
- [Oracle Integration](#oracle-integration)
- [Reputation and Fee Tiers](#reputation-and-fee-tiers)
- [Dispute Resolution](#dispute-resolution)
- [Deployment Tiers](#deployment-tiers)
- [Contract Reference](#contract-reference)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## The Problem We Solve

International trade is a $32 trillion annual market still running on infrastructure designed in the 1930s. A standard letter of credit takes 5-10 business days to issue, costs 0.5-3% of the transaction value in bank fees, and requires manual document handling where forgery and loss are routine. The result: $1.7 trillion in unmet trade finance demand globally, with small and mid-market exporters shut out entirely.

| Problem                    | Traditional Trade Finance                                        | Credence                                                               |
| -------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Cost**                   | 0.5-3% bank LC fees + correspondent bank charges + FX spreads    | 0.7-1.2% protocol fee, no intermediary margin                          |
| **Settlement speed**       | 5-10 business days for LC issuance; 2-3 days SWIFT settlement    | Instant on-chain settlement upon delivery confirmation                 |
| **Counterparty risk**      | Relies on bank guarantees and institutional trust                | Funds locked in non-custodial smart contract; no unilateral withdrawal |
| **Dispute resolution**     | Weeks to months of litigation across jurisdictions               | 14-day primary arbitration + 7-day escalation, fully on-chain          |
| **Geographic access**      | Requires correspondent banking network in both countries         | Any two KYC-approved addresses on any EVM chain                        |
| **Currency exposure**      | FX conversion at each leg of the transaction                     | Settle in USDC/USDT — invoice and payment in the same unit             |
| **Document integrity**     | Paper-based bills of lading, manually verified, routinely forged | Merkle-anchored document hashes, cryptographically verified on-chain   |
| **Fee transparency**       | Hidden deductions, opaque pricing, relationship-dependent        | Fee rate snapshotted at escrow creation, permanently visible on-chain  |
| **Reputation portability** | Credit history locked inside a single banking relationship       | On-chain reputation — portable, public, and bank-independent           |
| **Capital efficiency**     | Full face-value collateral required for LC                       | Payment Commitment mode: 10-50% collateral with deferred settlement    |
| **Trade receivables**      | Manual receivable assignment, paper-heavy, illiquid              | Tokenized ERC-721 receivables minted on document commitment            |

---

## Why Previous Blockchain Trade Platforms Failed

Earlier blockchain-based trade finance platforms — several backed by major global banks — promised to digitize letters of credit and streamline cross-border settlement. Most shut down within 2-4 years despite raising significant capital. The failures shared common root causes:

**1. Permissioned chains with no real decentralization.** Consortium blockchains required every participant to join the same private network, creating the same gatekeeping problem they claimed to solve. Onboarding a new bank took months of legal and technical integration.

**2. Digital wrappers on the same process.** Most platforms digitized the existing LC workflow rather than replacing it. The same intermediaries sat in the same positions — they just had a blockchain receipt instead of a SWIFT message.

**3. No capital efficiency gain.** Full collateralization remained the norm. Buyers still locked 100% of the trade value upfront, eliminating the working capital benefit that trade finance is supposed to provide.

**4. No composability.** Trade receivables and escrow positions were trapped inside walled-garden platforms with no secondary market access, no DeFi integration, and no path to liquidity.

**5. Consortium governance paralysis.** Decision-making required consensus across competing banks, leading to feature stagnation and inability to adapt to market needs.

Credence was designed from the ground up to avoid every one of these failure modes.

---

## How Credence Is Different

| Failed approach               | Credence design decision                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Permissioned consortium chain | Public Ethereum — permissionless, censorship-resistant, globally accessible                |
| Digitized LC workflow         | Purpose-built escrow primitive with two settlement modes, not a wrapper on legacy process  |
| 100% collateral required      | Payment Commitment mode: 10-50% collateral with maturity-based settlement                  |
| Trapped receivables           | ERC-721 trade receivable NFTs — composable, transferable, DeFi-compatible                  |
| Bank-controlled onboarding    | KYC as a configurable access layer; pluggable with any identity provider                   |
| Single oracle dependency      | Pluggable oracle interface (`ITradeOracle`) with centralized and Chainlink implementations |
| Governance deadlock           | Single owner with transparent on-chain admin; optional multisig arbiter                    |
| Opaque fee structures         | Reputation-based fees (0.7-1.2%) locked at escrow creation                                 |

---

## Protocol Overview

```
Buyer creates escrow (Cash Lock or Payment Commitment)
        │
        ▼
   Buyer funds escrow (full amount or collateral only)
        │
        ▼
   Seller commits trade documents (invoice, B/L, packing list, COO)
        │                                    │
        │                         [Payment Commitment mode]
        │                                    │
        │                         Receivable NFT minted ──► tradeable on secondary markets
        │
        ├──► Buyer confirms delivery ──► funds released to seller
        │
        ├──► Oracle confirms delivery ──► funds released to seller
        │
        ├──► Dispute raised ──► primary arbiter (14 days)
        │         │
        │         ├──► ruling: release to seller
        │         ├──► ruling: refund to buyer
        │         └──► timeout ──► escalate to protocol arbiter (7 days)
        │                              │
        │                              └──► timeout ──► either party reclaims
        │
        └──► [Payment Commitment only]
                  │
                  ├──► Buyer fulfills commitment (pays remaining balance)
                  └──► Maturity passes without fulfillment ──► seller claims collateral
```

---

## Architecture

```
src/
├── core/
│   ├── BaseEscrow.sol              # Abstract base: escrow state, KYC, tokens, tiers,
│   │                               # documents, receivables, fund/release/refund logic
│   ├── DisputeEscrow.sol           # Two-tier dispute and escalation layer
│   └── TradeInfraEscrow.sol        # Entry point: delivery, oracle, commitments
├── interfaces/
│   ├── ITradeOracle.sol            # Pluggable oracle interface
│   └── IReceivableMinter.sol       # Receivable NFT minting interface
├── libraries/
│   ├── EscrowTypes.sol             # Enums, structs, shared type definitions
│   └── ReputationLibrary.sol       # Pure fee/tier calculation functions
├── governance/
│   └── ProtocolArbiterMultisig.sol # Multi-signature protocol arbiter
├── CentralizedTradeOracle.sol      # Owner-controlled oracle (testnet/early production)
├── ChainlinkTradeOracle.sol        # Chainlink Functions oracle (decentralized)
└── CredenceReceivable.sol          # ERC-721 trade receivable NFT

script/
├── DeployCredence.s.sol            # Full deployment: oracle + escrow + receivable + multisig
└── DeployChainlinkOracle.s.sol     # Standalone Chainlink oracle deployment
```

**Inheritance chain:**

```
BaseEscrow (abstract)
    └── DisputeEscrow (abstract)
            └── TradeInfraEscrow   ← deploy this
```

`TradeInfraEscrow` is the production-facing contract. It inherits escrow state management, KYC, document commitment, and receivable hooks from `BaseEscrow`, all dispute logic from `DisputeEscrow`, and adds delivery confirmation, oracle settlement, payment commitment fulfillment, and default claims.

**Total protocol size:** ~1,200 nSLOC across 11 Solidity source files.

---

## Settlement Modes

Credence supports two escrow modes, selectable at creation time.

### Cash Lock

The standard escrow model. The buyer deposits the full trade amount upfront. Funds are held in the contract until delivery is confirmed or a dispute is resolved.

```solidity
// 6-parameter overload — defaults to CASH_LOCK mode
escrow.createEscrow(seller, arbiter, token, amount, tradeId, tradeDataHash);
```

- `collateralAmount` = `amount` (full face value locked)
- No maturity date
- Funds release in full on confirmation; refund in full on reversal

Best for: spot trades, first-time counterparties, low-trust scenarios.

### Payment Commitment

A capital-efficient mode where the buyer posts partial collateral (10-50% of face value) and commits to pay the remaining balance before a maturity date. This is the on-chain equivalent of a deferred payment letter of credit — but without the bank, the 5-day issuance delay, or the 0.5-3% LC fee.

```solidity
// 9-parameter overload — PAYMENT_COMMITMENT mode
escrow.createEscrow(
    seller, arbiter, token, amount, tradeId, tradeDataHash,
    collateralBps,   // e.g. 2000 = 20% collateral
    maturityDays,    // e.g. 60 = due in 60 days
    true             // isPaymentCommitment = true
);
```

- `collateralBps` range: 1000-5000 (10%-50%)
- `collateralAmount` = `amount * collateralBps / 10000`
- `maturityDate` = `block.timestamp + (maturityDays * 1 days)`
- Buyer funds only the collateral amount
- Before maturity: buyer calls `fulfillCommitment()` to pay the remaining balance
- If fulfilled: full `amount` releases to seller on confirmation
- If not fulfilled by maturity: seller calls `claimDefaultedCommitment()` to seize collateral
- If not fulfilled but not yet matured: only collateral releases on confirmation

**Capital efficiency example:**

A $500,000 USDC trade with 20% collateral:
- Traditional LC: buyer locks $500,000 + pays $2,500-$15,000 in bank fees
- Credence Payment Commitment: buyer locks $100,000 USDC, retains $400,000 in working capital until fulfillment

| Parameter               | Default    | Range               |
| ----------------------- | ---------- | ------------------- |
| Collateral basis points | 2000 (20%) | 1000-5000 (10%-50%) |
| Maturity period         | 60 days    | Custom (in days)    |

---

## Document Commitment

After an escrow is funded, the seller commits trade documents by submitting their cryptographic hashes on-chain. The contract computes a Merkle root from up to four document hashes:

| Leaf | Document                         |
| ---- | -------------------------------- |
| 1    | Commercial invoice               |
| 2    | Bill of lading                   |
| 3    | Packing list                     |
| 4    | Certificate of origin (optional) |

```solidity
escrow.commitDocuments(
    escrowId,
    invoiceHash,
    bolHash,
    packingListHash,
    cooHash             // bytes32(0) if not applicable
);
```

The Merkle root is computed bottom-up using pair-wise `keccak256` hashing. It is stored on-chain and emitted in the `DocumentsCommitted` event, creating an immutable, timestamped proof that specific documents were presented at a specific point in time.

**Oracle integration:** `confirmByOracle()` requires documents to be committed before it will accept oracle confirmation — ensuring that settlement cannot occur without a verifiable document trail.

**Why this matters for trade:** Document fraud is a systemic problem in international trade. The UN estimates that 1-2% of global trade involves fraudulent documentation. Merkle-anchored hashes allow any party — buyer, seller, insurer, financier — to independently verify that the documents presented match the on-chain commitment, without revealing the documents themselves.

---

## Trade Receivable NFTs

When a seller commits documents on a Payment Commitment escrow, the protocol automatically mints an ERC-721 receivable NFT representing the buyer's obligation to pay the remaining balance.

```
Seller commits documents
        │
        ▼
CredenceReceivable.mint(seller, escrowId, faceValue, collateralAmount, maturityDate)
        │
        ▼
ERC-721 token issued to seller
        │
        ▼
Receivable is tradeable, transferable, and DeFi-composable
```

Each receivable NFT encodes:
- Escrow ID
- Face value of the trade
- Collateral already posted
- Maturity date
- Settlement status

**Settlement lifecycle:** The receivable is automatically settled (marked as resolved) when:
- The buyer confirms delivery
- The oracle confirms delivery
- A dispute is resolved
- The buyer fulfills the payment commitment
- The seller claims a defaulted commitment
- The escrow is refunded

Receivable NFTs are not minted for Cash Lock escrows (where no future obligation exists).

**Why this matters:** Trade receivables are a $3 trillion asset class globally but remain largely illiquid due to manual assignment processes and lack of standardization. ERC-721 tokenization makes these receivables instantly transferable, pledgeable as collateral in DeFi lending protocols, and tradeable on secondary markets — unlocking liquidity for exporters that was previously inaccessible.

---

## KYC and Access Control

Credence includes an on-chain KYC gate managed by the contract owner.

- `kycApproved[address]` — mapping from address to approval status
- `createEscrow()` reverts with `NotKYCApproved()` if either buyer or seller is not approved
- KYC status does not affect funding, disputes, or settlement — only escrow creation

```solidity
// Single address
escrow.setKYCStatus(user, true);

// Bulk onboarding
escrow.batchSetKYCStatus(users, true);

// Transfer admin to multisig
escrow.transferOwnership(newOwner);
```

The KYC layer is intentionally minimal and designed to be extended by plugging in an off-chain verification provider (Synaps, Fractal, Civic, or equivalent) which calls the above functions once a user completes identity verification. The contract does not store personal data.

---

## Oracle Integration

Credence uses a pluggable oracle interface (`ITradeOracle`) with two production implementations.

### CentralizedTradeOracle

Owner-controlled on-chain registry. The Credence backend (or a multisig) calls `submitVerification()` after independently confirming that shipment or delivery data matches the trade record.

```solidity
oracle.submitVerification(tradeDataHash, true);   // backend confirms
oracle.verifyTradeData(tradeDataHash);             // escrow queries
```

Suitable for testnet, early production, and use cases where the protocol operator performs shipment verification.

### ChainlinkTradeOracle

Decentralized oracle powered by Chainlink Functions. A custom JavaScript source executes against external shipping APIs and returns verification results on-chain without relying on a single operator.

```solidity
oracle.requestVerification(escrowId, trackingNumber);   // triggers Chainlink request
// ... Chainlink DON executes JS source, calls back ...
oracle.verifyTradeData(tradeDataHash);                   // returns result
```

Suitable for production deployments requiring trustless, decentralized delivery verification.

The oracle owner can be changed at any time via `oracle.transferOwnership(address)`.

---

## Reputation and Fee Tiers

Every address accumulates a reputation score from completed escrows. Fees are deducted from the escrowed amount at release and forwarded to the `feeRecipient`.

| Tier        | Requirement                                      | Protocol Fee |
| ----------- | ------------------------------------------------ | ------------ |
| **BRONZE**  | Default                                          | 1.2%         |
| **SILVER**  | 5+ successful trades                             | 0.9%         |
| **GOLD**    | 20+ successful trades, 1 or fewer dispute losses | 0.8%         |
| **DIAMOND** | 50+ successful trades, 0 dispute losses          | 0.7%         |

The fee tier is based on the **seller's** reputation (the party receiving funds). It is evaluated at escrow creation and snapshotted in the `feeRate` field, locking fee terms for the lifetime of that escrow regardless of subsequent reputation changes.

**Example:** On a $100,000 USDC trade, a BRONZE user pays $1,200 in protocol fees. A DIAMOND user pays $700. For high-volume importers and exporters, the fee reduction compounds meaningfully over time. Both are substantially below the 0.5-3% charged by traditional LC-issuing banks — before accounting for correspondent bank fees, SWIFT charges, and FX spreads.

---

## Dispute Resolution

Credence uses a two-tier escalation model to prevent arbitration deadlock.

```
FUNDED ──► DISPUTED ──► arbiter resolves (14-day window)
                │
                └──► ESCALATED ──► protocol arbiter resolves (7-day window)
                         │
                         └──► timeout ──► either party reclaims funds
```

1. **Raise** — buyer or seller calls `raiseDispute()`, opening a 14-day window for the designated arbiter.
2. **Resolve** — arbiter calls `resolveDispute(ruling)`. Ruling `1` releases to seller; ruling `2` refunds buyer.
3. **Escalate** — if the arbiter does not act within 14 days, either party escalates to the protocol arbiter, opening a 7-day window.
4. **Timeout** — if the protocol arbiter also fails to act, either party calls `claimTimeout()` to recover funds.

**Abuse prevention:** Users with 10+ disputes initiated, or a >50% loss rate with 3+ losses, are blocked from raising further disputes.

**Protocol Arbiter Multisig:** The `ProtocolArbiterMultisig` contract provides on-chain multi-signature governance for escalated disputes. Multiple signers vote on rulings, and resolution executes automatically when the threshold is met.

---

## Deployment Tiers

Credence implements progressive deployment tiers that cap the maximum escrow amount as the protocol matures through production milestones. Tier ceilings are configurable by the owner via `setTierLimits()` to accommodate different token decimals (e.g., 18-decimal ETH vs 6-decimal USDC).

| Tier        | Default Max Amount | Use Case                              |
| ----------- | ------------------ | ------------------------------------- |
| **TESTNET** | Unlimited          | Development and testing               |
| **LAUNCH**  | 50,000 tokens      | Early production, limited exposure    |
| **GROWTH**  | 500,000 tokens     | Scaling with operational track record |
| **MATURE**  | 10,000,000 tokens  | Full production                       |

Tiers can only be upgraded (never downgraded) by the contract owner via `upgradeTier()`. Existing escrows are unaffected by tier changes. The maximum can also be set manually within the tier ceiling via `setMaxEscrowAmount()`. The minimum escrow amount is configurable via `setMinEscrowAmount()` (default: 0.01 ether).

---

## Contract Reference

### `TradeInfraEscrow`

| Function                                                      | Access           | Description                                         |
| ------------------------------------------------------------- | ---------------- | --------------------------------------------------- |
| `createEscrow(seller, arbiter, token, amount, tradeId, hash)` | KYC-approved     | Create a Cash Lock escrow                           |
| `createEscrow(..., collateralBps, maturityDays, true)`        | KYC-approved     | Create a Payment Commitment escrow                  |
| `fund(id)`                                                    | Buyer            | Deposit funds (full amount or collateral)           |
| `commitDocuments(id, invoice, bol, packing, coo)`             | Seller           | Anchor trade documents on-chain                     |
| `confirmDelivery(id)`                                         | Buyer            | Release funds to seller                             |
| `confirmByOracle(id)`                                         | Anyone           | Settle via oracle verification (requires documents) |
| `fulfillCommitment(id)`                                       | Buyer            | Pay remaining balance on Payment Commitment         |
| `claimDefaultedCommitment(id)`                                | Seller           | Claim collateral after maturity default             |
| `raiseDispute(id)`                                            | Buyer / Seller   | Transition to DISPUTED                              |
| `resolveDispute(id, ruling)`                                  | Arbiter          | Resolve primary dispute                             |
| `escalateToProtocol(id)`                                      | Buyer / Seller   | Escalate after primary arbiter timeout              |
| `resolveEscalation(id, ruling)`                               | Protocol Arbiter | Final on-chain resolution                           |
| `claimTimeout(id)`                                            | Buyer / Seller   | Recover funds after escalation timeout              |
| `setKYCStatus(user, approved)`                                | Owner            | Approve or revoke KYC                               |
| `batchSetKYCStatus(users, approved)`                          | Owner            | Bulk KYC updates                                    |
| `addApprovedToken(token)`                                     | Owner            | Add token to recommended list                       |
| `removeApprovedToken(token)`                                  | Owner            | Remove token from recommended list                  |
| `upgradeTier(tier)`                                           | Owner            | Upgrade deployment tier                             |
| `setMaxEscrowAmount(amount)`                                  | Owner            | Set max within tier ceiling                         |
| `setMinEscrowAmount(min)`                                     | Owner            | Set minimum escrow amount                           |
| `setTierLimits(launch, growth, mature)`                       | Owner            | Set per-tier maximum ceilings                       |
| `setFeeRecipient(recipient)`                                  | Owner            | Update protocol fee recipient                       |
| `setProtocolArbiter(arbiter)`                                 | Owner            | Update escalation authority                         |
| `setReceivableMinter(minter)`                                 | Owner            | Register receivable NFT contract                    |
| `pause()`                                                     | Owner            | Emergency pause — blocks createEscrow, fund, fulfillCommitment |
| `unpause()`                                                   | Owner            | Restore normal operation after pause                |
| `paused()`                                                    | View             | Returns true if contract is paused                  |
| `transferOwnership(newOwner)`                                 | Owner            | Transfer admin rights                               |
| `getEscrow(id)`                                               | View             | Return escrow transaction data                      |
| `getMaturityStatus(id)`                                       | View             | Return maturity and fulfillment status              |
| `getUserTier(addr)`                                           | View             | Return UserTier enum                                |
| `getUserTierName(addr)`                                       | View             | Return tier as human-readable string                |
| `getReceivableTokenId(id)`                                    | View             | Return receivable NFT token ID                      |
| `canRaiseDispute(user)`                                       | View             | Check if user is eligible to raise disputes         |

### `ProtocolArbiterMultisig`

| Function                                     | Access   | Description                                              |
| -------------------------------------------- | -------- | -------------------------------------------------------- |
| `proposeResolution(escrowId, ruling)`         | Signer   | Create a resolution proposal (auto-approves for proposer)|
| `proposeGovernanceAction(target, callData)`   | Signer   | Propose a generic governance action (e.g., addSigner)    |
| `approveResolution(proposalId)`               | Signer   | Approve an existing proposal                             |
| `revokeApproval(proposalId)`                  | Signer   | Withdraw approval before threshold is reached            |
| `addSigner(signer)`                           | Self     | Add a new signer (executed via proposal)                 |
| `removeSigner(signer)`                        | Self     | Remove a signer (executed via proposal)                  |
| `getSignerCount()`                            | View     | Return current number of signers                         |
| `hasApproved(proposalId, signer)`             | View     | Check if a signer has approved a proposal                |

Proposals expire after 7 days (`PROPOSAL_EXPIRY`). Execution is automatic when the approval threshold is met.

### `CentralizedTradeOracle`

| Function                                               | Access | Description                                          |
| ------------------------------------------------------ | ------ | ---------------------------------------------------- |
| `submitVerification(hash, result)`                      | Owner  | Submit trade verification result                     |
| `submitVerification(hash, result, documentFlags)`       | Owner  | Submit verification with per-document flag breakdown |
| `verifyTradeData(hash)`                                 | View   | Query verification status for a trade data hash      |
| `getDocumentVerification(merkleRoot)`                   | View   | Return overall result and per-document flags         |
| `transferOwnership(newOwner)`                           | Owner  | Transfer oracle admin rights                         |

### Constructor

```solidity
constructor(
    address _oracleAddress,   // ITradeOracle implementation
    address _feeRecipient,    // Receives protocol fees on release
    address _protocolArbiter  // Final escalation authority (multisig recommended)
)
```

### Supported Tokens

| Token    | Network       | Address                                      |
| -------- | ------------- | -------------------------------------------- |
| **ETH**  | Any EVM chain | `address(0)`                                 |
| **USDC** | Mainnet       | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| **USDT** | Mainnet       | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| **USDC** | Sepolia       | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| **USDT** | Sepolia       | `0x7169D38820dfd117C3FA1f22a697dBA58d90BA06` |

The allowlist is a soft recommendation layer. The escrow contract accepts any ERC20. The owner can add tokens via `addApprovedToken()` as the stablecoin landscape evolves.

### Events

All state transitions emit indexed events for off-chain indexing, analytics, and frontend integration.

**BaseEscrow**

| Event                    | Parameters                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `EscrowCreated`          | `uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, address token, uint8 mode, uint256 faceValue` |
| `EscrowFunded`           | `uint256 indexed escrowId, address indexed buyer, uint256 amount, uint256 timestamp`          |
| `EscrowSettled`          | `uint256 indexed escrowId, address indexed recipient, uint256 amount, uint256 fee`            |
| `EscrowRefunded`         | `uint256 indexed escrowId, address indexed recipient, uint256 amount`                         |
| `DocumentsCommitted`     | `uint256 indexed escrowId, bytes32 merkleRoot, uint256 timestamp`                             |
| `ReceivableMinted`       | `uint256 indexed escrowId, uint256 tokenId`                                                   |
| `ReceivableMintFailed`   | `uint256 indexed escrowId, bytes reason`                                                      |
| `KYCStatusUpdated`       | `address indexed user, bool status`                                                           |
| `ApprovedTokenAdded`     | `address indexed token`                                                                       |
| `ApprovedTokenRemoved`   | `address indexed token`                                                                       |
| `OwnershipTransferred`   | `address indexed oldOwner, address indexed newOwner`                                          |
| `DeploymentTierUpgraded` | `uint8 indexed oldTier, uint8 indexed newTier, uint256 maxAmount`                             |
| `ReceivableMinterUpdated`| `address indexed oldMinter, address indexed newMinter`                                        |
| `MinEscrowAmountUpdated` | `uint256 oldMin, uint256 newMin`                                                              |
| `TierLimitsUpdated`     | `uint256 launchLimit, uint256 growthLimit, uint256 matureLimit`                                |
| `FeeRecipientUpdated`   | `address indexed oldRecipient, address indexed newRecipient`                                   |
| `ProtocolArbiterUpdated`| `address indexed oldArbiter, address indexed newArbiter`                                       |
| `Paused`                 | `address account` (inherited from OpenZeppelin Pausable)                                      |
| `Unpaused`               | `address account` (inherited from OpenZeppelin Pausable)                                      |

**DisputeEscrow**

| Event               | Parameters                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `DisputeRaised`     | `uint256 indexed escrowId, address indexed initiator, uint256 deadline, uint256 timestamp`       |
| `DisputeResolved`   | `uint256 indexed escrowId, uint8 ruling, address indexed arbiter, uint256 timestamp`             |
| `DisputeEscalated`  | `uint256 indexed escrowId, address indexed escalatedBy, uint256 newDeadline, uint256 timestamp`  |
| `EscalationResolved`| `uint256 indexed escrowId, uint8 indexed ruling, uint256 timestamp`                              |
| `TimeoutClaimed`    | `uint256 indexed escrowId, address indexed claimedBy, address indexed refundedTo, uint256 timestamp` |

**TradeInfraEscrow**

| Event                  | Parameters                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `DeliveryConfirmed`    | `uint256 indexed escrowId, address indexed buyer, uint256 timestamp`                        |
| `OracleConfirmed`      | `uint256 indexed escrowId, bytes32 merkleRoot, uint256 timestamp`                           |
| `CommitmentFulfilled`  | `uint256 indexed escrowId, address indexed buyer, uint256 remainingAmount, uint256 timestamp`|
| `CommitmentDefaulted`  | `uint256 indexed escrowId, address indexed seller, uint256 collateralAmount, uint256 timestamp` |

**ProtocolArbiterMultisig**

| Event                | Parameters                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| `ResolutionProposed` | `uint256 indexed proposalId, uint256 indexed escrowId, uint8 ruling, address indexed proposer` |
| `ResolutionApproved` | `uint256 indexed proposalId, address indexed approver`                          |
| `ResolutionRevoked`  | `uint256 indexed proposalId, address indexed revoker`                           |
| `ResolutionExecuted` | `uint256 indexed proposalId, uint256 indexed escrowId, uint8 ruling`            |
| `SignerAdded`        | `address indexed signer`                                                        |
| `SignerRemoved`      | `address indexed signer`                                                        |
| `GovernanceActionProposed` | `uint256 indexed proposalId, address indexed target, address indexed proposer` |
| `GovernanceActionExecuted` | `uint256 indexed proposalId, address indexed target`                          |

**CredenceReceivable**

| Event                 | Parameters                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `ReceivableMintedNFT` | `uint256 indexed tokenId, uint256 indexed escrowId, address indexed seller` |
| `ReceivableSettledNFT`| `uint256 indexed tokenId, uint256 indexed escrowId`                     |

**CentralizedTradeOracle**

| Event                  | Parameters                                      |
| ---------------------- | ----------------------------------------------- |
| `TradeVerified`        | `bytes32 indexed tradeDataHash, bool result`    |
| `OwnershipTransferred` | `address indexed previousOwner, address indexed newOwner` |

**ChainlinkTradeOracle**

| Event                    | Parameters                                               |
| ------------------------ | -------------------------------------------------------- |
| `VerificationRequested`  | `bytes32 indexed tradeDataHash, bytes32 indexed requestId` |
| `VerificationFulfilled`  | `bytes32 indexed tradeDataHash, bool result`             |
| `SourceUpdated`          | `string newSource`                                       |
| `OwnershipTransferred`   | `address indexed previousOwner, address indexed newOwner`|

---

## Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

```shell
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Install

```shell
git clone <repo-url>
cd credence
forge install
```

### Build

```shell
forge build
```

### Local Node

```shell
anvil
```

---

## Testing

```shell
# Run all 301 tests
forge test

# Verbose output with traces
forge test -vvv

# Run a specific test file
forge test --match-path test/PaymentCommitmentTest.t.sol -vvv

# Gas snapshot
forge snapshot
```

| Test Suite                          | Tests | Coverage                                                               |
| ----------------------------------- | ----- | ---------------------------------------------------------------------- |
| `BaseEscrowTest.t.sol`              | 59    | Escrow creation, funding, KYC, token allowlist, ownership, tiers       |
| `DisputeEscrowTest.t.sol`           | 42    | Dispute lifecycle, escalation, timeouts, reputation, rate limiting     |
| `PaymentCommitmentTest.t.sol`       | 36    | PC creation, collateral funding, fulfillment, default claims, maturity |
| `PauseTest.t.sol`                   | 27    | Emergency pause access control, inflow blocking, settlement during pause, E2E flows |
| `TradeInfraEscrowTest.t.sol`        | 22    | Delivery confirmation, oracle settlement, fee tiers, full flows        |
| `ChainlinkOracleTest.t.sol`         | 22    | Chainlink Functions integration, callbacks, re-requests, ownership     |
| `SecurityFixesTest`*                | 21    | Configurable bounds, fee recipient/arbiter setters, access control     |
| `DeployCredenceTest.t.sol`          | 18    | Deploy script, env overrides, post-deploy interactions, tier config    |
| `ProtocolArbiterMultisigTest.t.sol` | 18    | Multisig proposals, approvals, execution, revocation, governance       |
| `ReceivableTest.t.sol`              | 16    | NFT minting, settlement, metadata, failure resilience                  |
| `DocumentCommitmentTest.t.sol`      | 14    | Merkle tree (1-4 leaves), document anchoring, oracle gating            |
| `SettledNFTTransferTest`*           | 4     | Settled receivable transfer blocking, active transfer, mint after settle|
| `OracleMerkleRootTest`*             | 2     | Oracle verifies merkle root, rejects tradeDataHash                     |

*\* Test contracts in `SecurityFixesTest.t.sol`*

**301 tests, 0 failures.**

> Tests run with `jobs = 1` (set in `foundry.toml`). The deploy test suite uses `vm.setEnv` to test environment variable overrides; parallel execution would create race conditions on the shared OS process environment.

---

## Deployment

### Environment Variables

| Variable               | Default          | Description                                           |
| ---------------------- | ---------------- | ----------------------------------------------------- |
| `PRIVATE_KEY`          | Anvil key #0     | Deployer private key                                  |
| `FEE_RECIPIENT`        | Anvil address #1 | Protocol fee collector                                |
| `PROTOCOL_ARBITER`     | Anvil address #2 | Final escalation authority                            |
| `ORACLE_OWNER`         | Deployer         | Oracle admin address                                  |
| `USDC_ADDRESS`         | Sepolia USDC     | USDC for token allowlist                              |
| `USDT_ADDRESS`         | Sepolia USDT     | USDT for token allowlist                              |
| `DEPLOYMENT_TIER`      | TESTNET          | TESTNET, LAUNCH, GROWTH, or MATURE                    |
| `USE_CHAINLINK_ORACLE` | false            | Deploy Chainlink oracle instead of centralized        |
| `MULTISIG_SIGNERS`     | (empty)          | Comma-separated signer addresses for multisig arbiter |
| `MULTISIG_THRESHOLD`   | 2                | Required approvals for multisig resolution            |

### Local (Anvil)

```shell
anvil                    # terminal 1
make deploy-local        # terminal 2
```

### Testnet / Mainnet

```shell
export PRIVATE_KEY=<deployer_key>
export FEE_RECIPIENT=<fee_address>
export PROTOCOL_ARBITER=<multisig_address>
export DEPLOYMENT_TIER=LAUNCH

forge script script/DeployCredence.s.sol \
  --rpc-url <rpc_url> \
  --broadcast \
  --verify
```

The deploy script deploys the oracle, `TradeInfraEscrow`, and `CredenceReceivable` NFT contract in sequence, registers the receivable minter with the escrow, and seeds the token allowlist with ETH, USDC, and USDT. The deployer address becomes the escrow owner. Deployed addresses are written to `.env.deployed`.

**Post-deploy checklist:**

- [ ] KYC-onboard initial traders via `batchSetKYCStatus()`
- [ ] Transfer oracle ownership to operational multisig: `oracle.transferOwnership(multisig)`
- [ ] Transfer escrow ownership to governance multisig: `escrow.transferOwnership(multisig)`
- [ ] Upgrade deployment tier as volume grows: `escrow.upgradeTier(LAUNCH)`
- [ ] Verify contracts on Etherscan using `--verify` flag

---

## Security

### Design Safeguards

- **Reentrancy** — all state-changing external calls use `nonReentrant` (OpenZeppelin `ReentrancyGuard`).
- **Safe transfers** — all ERC20 operations use OpenZeppelin `SafeERC20` to handle non-standard return values.
- **Role separation** — buyer, seller, arbiter, protocol arbiter, and fee recipient are strictly distinct; constructor enforces this.
- **KYC gate** — both escrow parties must be approved before an escrow can be created.
- **Phantom escrow prevention** — the `escrowExists` mapping blocks operations on non-existent IDs.
- **Fee snapshot** — fee rate is locked at escrow creation; no mid-flight manipulation is possible.
- **Dispute rate limiting** — users with 10+ disputes or >50% loss rate (3+ losses) are blocked from raising further disputes.
- **Amount bounds** — configurable `minEscrowAmount` (default 0.01 ether) prevents dust attacks. Configurable tier limits via `setTierLimits()` support any token decimals. Deployment tier caps prevent overexposure.
- **Non-custodial** — no admin function can unilaterally drain funds; all fund movements require valid state transitions.
- **Emergency pause** — owner can pause capital inflow (`createEscrow`, `fund`, `fulfillCommitment`) while leaving settlement, disputes, and safety-valve functions operational. Pausing never traps funds.
- **Resilient minting** — receivable NFT minting uses `try/catch` so a failing minter never blocks escrow operations.
- **Document gating** — oracle confirmation requires prior document commitment, preventing settlement without a verifiable document trail.
- **Collateral bounds** — Payment Commitment collateral is bounded to 10-50% of face value, preventing both under-collateralization and economic equivalence to Cash Lock.
- **Settled receivable lock** — settled receivable NFTs are non-transferable, preventing double-claim and stale-obligation trading.
- **Mutable admin addresses** — `feeRecipient` and `protocolArbiter` can be updated post-deployment via owner setters, enabling key rotation without redeployment.

### Audit Status

Static analysis has been performed using [Aderyn](https://github.com/Cyfrin/aderyn). You can regenerate the report by running `aderyn .` from the project root.

> A formal third-party audit has not yet been conducted. **Do not deploy to mainnet with real funds until a professional audit is completed.**

For responsible disclosure of security vulnerabilities, see [SECURITY.md](SECURITY.md).

### Known Limitations

- `CentralizedTradeOracle` is centralized by design. A compromised oracle owner can submit false verifications. Deploy the `ChainlinkTradeOracle` for trustless operation.
- The `protocolArbiter` should be a multisig (the included `ProtocolArbiterMultisig` or a Gnosis Safe), not a single EOA.
- Contracts are immutable — re-deployment is required for upgrades.
- Receivable NFTs represent protocol-internal claims and do not constitute legal instruments without off-chain legal framework.
- `ITradeOracle` interface only defines `verifyTradeData()`. Extended functions like `getDocumentVerification()` and `submitVerification()` with document flags are available on `CentralizedTradeOracle` directly but not abstracted behind the interface. `ChainlinkTradeOracle` does not support per-document flags.

---

## Roadmap

- [x] Full cash-lock escrow with ETH and ERC20 support
- [x] KYC gate and on-chain token allowlist
- [x] Centralized oracle implementation (`CentralizedTradeOracle`)
- [x] Chainlink Functions oracle implementation (`ChainlinkTradeOracle`)
- [x] Two-tier dispute arbitration with timeout recovery
- [x] Reputation-based fee tiers (BRONZE through DIAMOND)
- [x] Payment Commitment mode with partial collateral
- [x] Merkle-anchored document commitment system
- [x] ERC-721 trade receivable NFTs (`CredenceReceivable`)
- [x] Multi-signature protocol arbiter (`ProtocolArbiterMultisig`)
- [x] Progressive deployment tiers (TESTNET through MATURE)
- [x] Automated deployment script with environment configuration
- [x] 301 tests with full feature coverage
- [x] Emergency pause mechanism (OpenZeppelin Pausable)
- [x] Security hardening: configurable bounds, mutable admin addresses, settled NFT locks, oracle merkle root verification, multisig governance actions
- [x] Subgraph schema for trade history and analytics
- [ ] Frontend interface for trade participants
- [ ] Testnet deployment (Sepolia / Base Sepolia)
- [ ] Third-party security audit
- [ ] Mainnet deployment
- [ ] Subgraph mapping handlers and deployment
- [ ] Secondary market integration for receivable NFTs
- [ ] Multi-chain deployment (Arbitrum, Base, Optimism)

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository and create a feature branch (`git checkout -b feat/your-feature`).
2. Write or update tests for any changed behaviour — all tests must pass (`forge test`).
3. Format code before opening a PR (`forge fmt`).
4. Open a pull request with a clear description of the change and its motivation.

For significant changes or new features, please open an issue first to discuss the approach.

---

## License

This project is licensed under the [MIT License](LICENSE).
