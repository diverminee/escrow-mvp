# Credence

> Production-grade escrow infrastructure for international trade on Ethereum.

Credence is a smart contract escrow system designed to secure real-world trade transactions on-chain. It supports both ETH and ERC20 token escrows, integrates an off-chain trade oracle for automated settlement, and enforces a two-tier dispute resolution process with a reputation-based fee model — all without relying on a centralised intermediary.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Reputation & Fee Tiers](#reputation--fee-tiers)
- [Dispute Resolution](#dispute-resolution)
- [Contract Reference](#contract-reference)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Credence replaces trust in international trade with cryptographic guarantees. A buyer locks funds into an escrow contract; an oracle or the buyer confirms delivery; funds are released to the seller. If a dispute arises, a designated arbiter (and optionally a protocol-level arbiter) resolves it on-chain with strict timelocks.

**Key properties:**

- Non-custodial — no admin can unilaterally drain funds.
- Reentrancy-protected — uses OpenZeppelin `ReentrancyGuard` throughout.
- Oracle-agnostic — pluggable `ITradeOracle` interface; swap implementations without redeploying.
- Reputation-aware — fee rates automatically decrease as users build a verified trade history.

---

## Architecture

```
src/
├── core/
│   ├── BaseEscrow.sol          # Abstract base: state, events, fund logic
│   ├── DisputeEscrow.sol       # Dispute & escalation layer
│   └── TradeInfraEscrow.sol    # Main entry point (delivery confirm + oracle)
├── interfaces/
│   └── ITradeOracle.sol        # Oracle interface
└── libraries/
    ├── EscrowTypes.sol         # Shared enums and structs
    └── ReputationLibrary.sol   # Pure fee/tier calculation functions
```

**Inheritance chain:**

```
BaseEscrow (abstract)
    └── DisputeEscrow
            └── TradeInfraEscrow   ← deploy this
```

`TradeInfraEscrow` is the production-facing contract. It inherits all escrow state management from `BaseEscrow` and all dispute logic from `DisputeEscrow`, adding delivery confirmation and oracle settlement on top.

---

## Core Features

| Feature | Description |
|---|---|
| ETH & ERC20 escrows | Pass `address(0)` for native ETH or any ERC20 token address |
| Oracle settlement | `confirmByOracle()` verifies a `tradeDataHash` against the oracle |
| Manual confirmation | `confirmDelivery()` lets the buyer release funds directly |
| Dispute initiation | Either party can raise a dispute on any `FUNDED` escrow |
| Two-tier arbitration | Primary arbiter (14 days) → protocol arbiter escalation (7 days) |
| Timeout claims | If an arbiter misses their deadline, either party can reclaim funds |
| Reputation system | Trade history tracked on-chain; tiers and fees update automatically |
| Abuse prevention | Dispute rate limiting — 10+ initiations or >50% loss rate blocks further disputes |
| Amount bounds | Min: 1 000 units — Max: 10 000 000 tokens (prevents dust & overflow edge cases) |

---

## Reputation & Fee Tiers

Every address accumulates a reputation score from its completed escrows. Fees are deducted from the escrowed amount at release and forwarded to the `feeRecipient`.

| Tier | Requirement | Protocol Fee |
|---|---|---|
| **BRONZE** | New user / low activity | 1.2% |
| **SILVER** | ≥ 5 successful trades | 0.9% |
| **GOLD** | ≥ 20 successful trades, ≤ 1 dispute loss | 0.8% |
| **DIAMOND** | ≥ 50 successful trades, 0 dispute losses | 0.7% |

The tier is evaluated at escrow creation and snapshotted in the `feeRate` field, locking fee terms for the lifetime of that escrow regardless of subsequent reputation changes.

---

## Dispute Resolution

Credence uses a two-tier escalation model to prevent arbitration deadlock.

```
FUNDED ──► DISPUTED ──► (arbiter resolves within 14 days)
                │
                └──► ESCALATED ──► (protocol arbiter resolves within 7 days)
                          │
                          └──► timeout → either party reclaims funds
```

1. **Raise** — buyer or seller calls `raiseDispute()`, opening a 14-day window for the designated `arbiter`.
2. **Resolve** — arbiter calls `resolveDispute(ruling)`. Ruling `0` refunds the buyer; ruling `1` pays the seller.
3. **Escalate** — if the arbiter does not act within 14 days, either party escalates to the `protocolArbiter` (multisig), opening a fresh 7-day window.
4. **Timeout** — if the protocol arbiter also fails to act, either party can claim a timeout to recover funds.

The `disputesInitiated` and `disputesLost` mappings feed directly into reputation calculations and the abuse-prevention rate-limiter.

---

## Contract Reference

### `TradeInfraEscrow`

| Function | Access | Description |
|---|---|---|
| `createEscrow(...)` | Anyone | Create a new `DRAFT` escrow |
| `fundEscrow(id)` | Buyer | Move escrow to `FUNDED` state |
| `confirmDelivery(id)` | Buyer | Release funds to seller |
| `confirmByOracle(id)` | Anyone | Settle via oracle hash verification |
| `raiseDispute(id)` | Buyer / Seller | Transition to `DISPUTED` |
| `resolveDispute(id, ruling)` | Arbiter | Resolve primary dispute |
| `escalateDispute(id)` | Buyer / Seller | Move to `ESCALATED` after primary arbiter timeout |
| `resolveEscalation(id, ruling)` | Protocol Arbiter | Final on-chain resolution |
| `claimTimeout(id)` | Buyer / Seller | Recover funds after full escalation timeout |
| `getUserTier(addr)` | View | Returns the `UserTier` enum for an address |
| `getUserTierName(addr)` | View | Returns tier as a human-readable string |

### Constructor Parameters

```solidity
constructor(
    address _oracleAddress,   // ITradeOracle implementation
    address _feeRecipient,    // Receives protocol fees on release
    address _protocolArbiter  // Final escalation authority (multisig recommended)
)
```

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
# Run all tests
forge test

# Verbose output with gas usage
forge test -vvv

# Run a specific test file
forge test --match-path test/TradeInfraEscrowTest.t.sol -vvv

# Gas snapshot
forge snapshot
```

| Test File | Covers |
|---|---|
| `BaseEscrowTest.t.sol` | Escrow creation, funding, fee calculation |
| `DisputeEscrowTest.t.sol` | Dispute flow, escalation, timeouts |
| `TradeInfraEscrowTest.t.sol` | Delivery confirmation, oracle settlement |
| `DeployCredenceTest.t.sol` | Deployment script validation |

---

## Deployment

### Local (Anvil)

```shell
# Start a local node in a separate terminal
anvil

# Deploy using default Anvil keys
forge script script/DeployCredence.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### Testnet / Mainnet

```shell
export PRIVATE_KEY=<your_deployer_key>
export FEE_RECIPIENT=<fee_recipient_address>
export PROTOCOL_ARBITER=<multisig_address>

forge script script/DeployCredence.s.sol \
  --rpc-url <rpc_url> \
  --broadcast \
  --verify
```

> **Important:** Replace `MockOracle` with a production `ITradeOracle` implementation before mainnet deployment. The mock unconditionally returns `true` for any trade hash.

---

## Security

### Design Safeguards

- **Reentrancy** — all state-changing external functions use `nonReentrant`.
- **Role separation** — buyer, seller, arbiter, protocol arbiter, and fee recipient are strictly distinct; the constructor enforces this.
- **Phantom escrow prevention** — the `escrowExists` mapping blocks attacks on non-existent IDs.
- **Fee snapshot** — fee rate is locked at escrow creation; no mid-flight manipulation is possible.
- **Dispute rate limiting** — users with ≥ 10 disputes initiated, or a >50% loss rate (with ≥ 3 losses), are blocked from raising further disputes.
- **Amount bounds** — `MIN_ESCROW_AMOUNT = 1_000` and `MAX_ESCROW_AMOUNT = 10_000_000e18` prevent dust attacks and arithmetic overflow edge cases.

### Audit

An automated security analysis report generated by [Aderyn](https://github.com/Cyfrin/aderyn) is available at [`report.md`](report.md).

> A formal third-party audit has not yet been conducted. **Do not deploy to mainnet with real funds until a professional audit is completed.**

### Known Limitations

- `MockOracle` always returns `true` — never use it in production.
- The `protocolArbiter` is a single EOA by default; a multisig (e.g. Gnosis Safe) is strongly recommended.
- Contracts are immutable by design — re-deployment is required for any upgrades.

---

## Roadmap

- [ ] Production `ITradeOracle` implementation (Chainlink Functions / custom backend)
- [ ] Multi-sig protocol arbiter integration (Gnosis Safe)
- [ ] Frontend interface for trade participants
- [ ] Testnet deployment (Sepolia / Base Sepolia)
- [ ] Third-party security audit
- [ ] Mainnet deployment
- [ ] Subgraph indexing for trade history & analytics

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository and create a feature branch (`git checkout -b feat/your-feature`).
2. Write or update tests for any changed behaviour — all tests must pass (`forge test`).
3. Format code before opening a PR (`forge fmt`).
4. Open a pull request with a clear description of the change and its motivation.

For significant changes or new features, please open an issue first to discuss the approach before implementation.

---

## License

This project is licensed under the [MIT License](LICENSE).
